# ============================================================================
#  Geo-lift readout worker (R) — LyftAI.
#  Espone POST /readout: riceve il pannello geografico + assegnazione test/control
#  e restituisce il lift causale calcolato con GeoLift ufficiale (Meta, ASCM+GSC).
#  È la parte "certificata" dell'ibrido; il fallback JS (Time-Based Regression)
#  gira nell'app quando questo worker non è configurato (GEOLIFT_R_URL).
#
#  Contratto (JSON):
#   IN  { regions:[{region, daily:[{date,value}]}], testRegions:[...],
#         controlRegions:[...], startDate:"YYYY-MM-DD", alpha:0.10 }
#   OUT { ok, method:"geolift", lift, incremental, liftCi:[lo,hi], pValue,
#         significant, observed, counterfactual, testDays }
# ============================================================================

library(plumber)
library(GeoLift)

#* @filter cors
function(req, res) {
  res$setHeader("Access-Control-Allow-Origin", "*")
  if (req$REQUEST_METHOD == "OPTIONS") { res$status <- 200; return(list()) }
  plumber::forward()
}

#* Health check
#* @get /health
function() { list(ok = TRUE, service = "geolift-r-worker") }

#* Readout causale con GeoLift
#* @post /readout
function(req, res) {
  body <- jsonlite::fromJSON(req$postBody, simplifyVector = FALSE)

  test_regions <- tolower(unlist(body$testRegions))
  start_date   <- body$startDate
  alpha        <- ifelse(is.null(body$alpha), 0.10, as.numeric(body$alpha))

  # Pannello long: una riga per (location, date). GeoLift vuole indici temporali
  # interi, quindi mappiamo le date ordinate → 1..N e ricaviamo l'indice di start.
  rows <- do.call(rbind, lapply(body$regions, function(r) {
    d <- r$daily
    data.frame(
      location = tolower(r$region),
      date     = vapply(d, function(x) x$date, character(1)),
      Y        = vapply(d, function(x) as.numeric(x$value), numeric(1)),
      stringsAsFactors = FALSE
    )
  }))
  if (is.null(rows) || nrow(rows) == 0) { res$status <- 400; return(list(ok = FALSE, reason = "no_data")) }

  dates <- sort(unique(rows$date))
  idx   <- match(rows$date, dates)
  rows$time <- idx
  treat_start <- match(TRUE, dates >= start_date)
  if (is.na(treat_start)) { res$status <- 400; return(list(ok = FALSE, reason = "bad_start")) }
  treat_end <- length(dates)

  # GeoLift richiede pannello completo senza buchi: GeoDataRead lo pulisce.
  gd <- tryCatch(
    GeoDataRead(data = rows, date_id = "date", location_id = "location", Y_id = "Y",
                format = "yyyy-mm-dd", summary = FALSE),
    error = function(e) NULL
  )
  if (is.null(gd)) { res$status <- 422; return(list(ok = FALSE, reason = "geodata_failed")) }

  fit <- tryCatch(
    GeoLift(Y_id = "Y", data = gd, locations = test_regions,
            treatment_start_time = treat_start, treatment_end_time = treat_end,
            alpha = alpha),
    error = function(e) NULL
  )
  if (is.null(fit)) { res$status <- 422; return(list(ok = FALSE, reason = "geolift_failed")) }

  s <- summary(fit)
  # Campi robusti a piccole differenze di versione dell'oggetto GeoLift.
  incremental   <- tryCatch(as.numeric(fit$incremental), error = function(e) NA)
  lift          <- tryCatch(as.numeric(fit$summary$stats$percent_lift %||% fit$att_estimator), error = function(e) NA)
  pv            <- tryCatch(as.numeric(fit$summary$stats$pvalue %||% fit$p_value), error = function(e) NA)

  list(
    ok = TRUE, method = "geolift",
    lift = ifelse(is.na(lift), NA, lift / 100),
    incremental = incremental,
    pValue = pv,
    significant = ifelse(is.na(pv), NA, pv < alpha),
    testDays = treat_end - treat_start + 1,
    alpha = alpha
  )
}

`%||%` <- function(a, b) if (is.null(a) || length(a) == 0) b else a
