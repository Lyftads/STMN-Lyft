# Worker R per il readout GeoLift certificato. Deploy su Railway (o qualsiasi host
# Docker). L'app LyftAI lo usa se GEOLIFT_R_URL punta a questo servizio.
FROM rocker/r-ver:4.4.1

# Dipendenze di sistema per augsynth/GeoLift e plumber.
RUN apt-get update && apt-get install -y --no-install-recommends \
    libcurl4-openssl-dev libssl-dev libxml2-dev libgit2-dev pandoc \
  && rm -rf /var/lib/apt/lists/*

# Pacchetti R: plumber (server), remotes (install da GitHub), augsynth (ASCM) e GeoLift.
RUN R -e "install.packages(c('plumber','remotes','jsonlite'), repos='https://cloud.r-project.org')" \
 && R -e "remotes::install_github('ebenmichael/augsynth', upgrade='never')" \
 && R -e "remotes::install_github('facebookincubator/GeoLift', upgrade='never')"

WORKDIR /app
COPY plumber.R /app/plumber.R

# Railway inietta PORT; plumber ci si lega.
ENV PORT=8080
EXPOSE 8080
CMD ["R", "-e", "pr <- plumber::plumb('/app/plumber.R'); pr$run(host='0.0.0.0', port=as.integer(Sys.getenv('PORT','8080')))"]
