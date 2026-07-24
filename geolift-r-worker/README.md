# geolift-r-worker

Readout **certificato** dei test geo-lift con [GeoLift](https://github.com/facebookincubator/GeoLift) ufficiale (Meta, Augmented Synthetic Control). È la parte R dell'architettura ibrida: l'app LyftAI usa questo worker se la variabile `GEOLIFT_R_URL` è configurata, altrimenti ricade sul motore JS Time-Based Regression (`lib/incrementality/readout.js`), sempre disponibile.

## Cosa fa
Espone `POST /readout`. Riceve il pannello geografico (serie giornaliere per provincia/regione) + quali sono le regioni test/control + la data di inizio trattamento, e restituisce il lift causale (`lift`, `incremental`, `pValue`, `significant`) calcolato con `GeoLift::GeoLift()`.

## Deploy su Railway
1. Crea un nuovo servizio Railway puntato a questa cartella (`geolift-r-worker/`) come root, oppure a questo repo con Root Directory = `geolift-r-worker`.
2. Railway rileva il `Dockerfile` e builda (la prima build è lenta: compila augsynth + GeoLift da GitHub, ~10-15 min).
3. Railway assegna un dominio pubblico e inietta `PORT`. Verifica: `GET https://<dominio>/health` → `{"ok":true}`.
4. Nel progetto Vercel di LyftAI aggiungi la env: `GEOLIFT_R_URL=https://<dominio-railway>`.

Da quel momento lo "Stop test" nell'app calcola il readout con GeoLift; senza la env resta il fallback JS (identico contratto di output, metodo `tbr`).

## Contratto
```
POST /readout
IN  { regions:[{region, daily:[{date,value}]}], testRegions:[...],
      controlRegions:[...], startDate:"YYYY-MM-DD", alpha:0.10 }
OUT { ok, method:"geolift", lift, incremental, pValue, significant, testDays }
```

## Note / da collaudare
- `plumber.R` mappa il contratto su `GeoDataRead()` + `GeoLift()`. I nomi dei campi nel `summary(fit)` possono variare tra versioni di GeoLift: verificare `fit$summary$stats` al primo run reale e allineare l'estrazione di `percent_lift`/`pvalue`.
- GeoLift usa indici temporali interi: il worker ordina le date e mappa a `1..N`, ricavando `treatment_start_time` dalla `startDate`.
- Le location sono normalizzate in minuscolo per il match tra pannello e `testRegions`.
