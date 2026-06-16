# help-video-worker — generazione video-guida su Railway

Servizio Railway "usa e getta" che esegue la pipeline
`scripts/help-video/generate.mjs` (script EN → voce OpenAI → sottotitoli →
registrazione Playwright → montaggio ffmpeg → upload Supabase → manifest).

Gira fuori da Vercel perché serve ffmpeg + un browser headless. Il Dockerfile
parte dall'immagine ufficiale Playwright (Chromium incluso) e aggiunge ffmpeg.

## Deploy su Railway (una volta)
1. Nel progetto Railway: **New → Deploy from Repo** (lo stesso repo STMN-Lyft).
2. Settings del servizio:
   - **Dockerfile Path**: `help-video-worker/Dockerfile`
   - **Root Directory**: lascia la root del repo (il build context deve vedere `scripts/` e `lib/`).
3. **Variables** (Settings → Variables):
   ```
   OPENAI_API_KEY            = sk-…            (script + TTS)
   HELP_BASE_URL             = https://lyftai.io
   HELP_USE_DEMO             = 1              (registra su /demo, niente login)
   SUPABASE_URL              = https://….supabase.co
   SUPABASE_SERVICE_ROLE_KEY = …             (per l'upload su Storage)
   # opzionali
   HELP_TTS_VOICE            = alloy
   HELP_BUCKET               = help-videos
   ```
4. Deploy. Il **CMD di default genera 3 tab** (dashboard, clienti, metaKpi)
   per validare resa e timing.

## Generare TUTTE le tab
Quando le 3 di prova convincono, su Railway imposta un **Custom Start Command**:
```
node scripts/help-video/generate.mjs
```
e ridella un deploy (oppure "Restart"). Il manifest si salva in modo
incrementale: se il job si interrompe, i video già fatti restano caricati.

## Dopo la generazione
La pipeline riscrive `lib/help/videos.js` **dentro il container** (effimero).
Per rendere i video visibili nell'app servono i loro URL pubblici nel manifest
committato. Due modi:
- **Consigliato**: alla fine del job, copia il contenuto di `lib/help/videos.js`
  loggato dal worker e incollalo nel repo (commit + push → Vercel deploya).
- In alternativa puoi far leggere all'app il manifest da una tabella Supabase
  invece che dal file statico (evolutivo, se vorrai rigenerare spesso).

> Gli asset mp4/vtt/jpg sono già pubblici su Supabase Storage appena caricati:
> manca solo portare gli URL nel manifest del repo.

## Run locale (alternativa al worker)
Se preferisci generarli dal tuo Mac:
```bash
brew install ffmpeg
npx playwright install chromium
OPENAI_API_KEY=… HELP_BASE_URL=https://lyftai.io HELP_USE_DEMO=1 \
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
npm run help:videos:start        # 3 tab di prova
# poi, per tutte:
… npm run help:videos
```
