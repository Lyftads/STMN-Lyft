# Servizio Railway per generare i video-guida delle tab (Centro Assistenza).
# Node standard + ffmpeg + Chromium installato via Playwright (--with-deps):
# robusto a prescindere dalla versione/tag dell'immagine Playwright.
# Build context = root del repo. Su Railway imposta "Dockerfile Path" =
# help-video-worker/Dockerfile, Root Directory vuota, niente Custom Start Command.

FROM node:22-bookworm-slim

# ffmpeg/ffprobe per montaggio e durate
RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY . .

# Dipendenze runtime della pipeline + Chromium con le sue librerie di sistema.
RUN npm i --no-save playwright @supabase/supabase-js \
    && npx playwright install --with-deps chromium

# Registra su /demo (dati finti, niente login). Override via variabili Railway.
ENV HELP_USE_DEMO=1

# Default: le 3 tab di validazione. Per tutte, su Railway imposta un
# "Custom Start Command": node scripts/help-video/generate.mjs
CMD ["node", "scripts/help-video/generate.mjs", "dashboard", "clienti", "metaKpi"]
