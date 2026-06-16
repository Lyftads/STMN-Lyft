# Servizio Railway per generare i video-guida delle tab (Centro Assistenza).
# Immagine Playwright (Chromium + dipendenze di sistema già incluse) + ffmpeg.
# Build context = root del repo. Su Railway imposta "Dockerfile Path" =
# help-video-worker/Dockerfile e lascia la root directory di default.

FROM mcr.microsoft.com/playwright:v1.60.0-jammy

# ffmpeg/ffprobe per montaggio e durate
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Solo le due dipendenze runtime della pipeline (le altre app deps non servono).
RUN npm i --no-save playwright@1.60.0 @supabase/supabase-js

# Registra su /demo (dati finti, niente login). Override via variabili Railway.
ENV HELP_USE_DEMO=1

# Default: le 3 tab di validazione. Per generarle TUTTE imposta su Railway un
# "Custom Start Command": node scripts/help-video/generate.mjs
CMD ["node", "scripts/help-video/generate.mjs", "dashboard", "clienti", "metaKpi"]
