# Video-guida automatici delle tab (Centro Assistenza)

Pipeline che genera, per ogni tab, un video walkthrough con **voiceover e
sottotitoli in inglese** e lo embedda nel pop-up della guida (stile Vendro).

**Non gira su Vercel**: ha bisogno di ffmpeg e di un browser headless. Eseguilo
in locale o sul worker Railway.

## Cosa fa, per ogni tab
1. **Narrazione** — genera uno script EN dalla guida (`lib/help/content.js`) con OpenAI.
2. **Voce** — TTS frase per frase (OpenAI `tts-1`) → clip mp3.
3. **Sottotitoli** — costruisce un `.vtt` EN sincronizzato dalle durate delle frasi.
4. **Registrazione** — Playwright apre la tab e fa scorrere la pagina mentre registra.
5. **Montaggio** — ffmpeg unisce video + voce (taglia alla durata audio) ed estrae il poster.
6. **Upload** — carica mp4/vtt/jpg su Supabase Storage e riscrive `lib/help/videos.js`.

Il player nel drawer compare **solo** per le tab presenti nel manifest: finché un
video non è prodotto, la guida resta solo testuale (nessun video rotto).

## Prerequisiti
```bash
# ffmpeg + ffprobe nel PATH
brew install ffmpeg            # macOS
# dipendenze node (una tantum)
npm i -D playwright @supabase/supabase-js
npx playwright install chromium
```

## Variabili d'ambiente
| Var | Obbligatoria | Note |
|-----|-------------|------|
| `OPENAI_API_KEY` | sì | usata per script EN + TTS |
| `HELP_BASE_URL` | sì | es. `https://lyftai.io` o `http://localhost:3000` |
| `HELP_USE_DEMO=1` | consigliata | registra su `/demo` (dati finti, niente login) |
| `HELP_AUTH_STORAGE` | alternativa | path a uno storageState Playwright loggato (se non usi /demo) |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | sì (per upload) | bucket pubblico `help-videos` creato in automatico |
| `HELP_TTS_VOICE` | no | voce OpenAI: alloy/echo/fable/onyx/nova/shimmer (default alloy) |
| `HELP_BUCKET` | no | nome bucket (default `help-videos`) |

### Sessione loggata (se non usi /demo)
```bash
# salva una sessione una tantum
npx playwright codegen --save-storage=auth.json https://lyftai.io
export HELP_AUTH_STORAGE=$PWD/auth.json
```

## Uso
```bash
# prova solo narrazione + voce + sottotitoli (no registrazione/upload)
DRY=1 OPENAI_API_KEY=… node scripts/help-video/generate.mjs dashboard

# genera una o più tab
HELP_USE_DEMO=1 HELP_BASE_URL=https://lyftai.io \
SUPABASE_URL=… SUPABASE_SERVICE_ROLE_KEY=… \
OPENAI_API_KEY=… node scripts/help-video/generate.mjs dashboard clienti

# genera TUTTE le tab
… node scripts/help-video/generate.mjs
```
Il manifest si salva in modo **incrementale**: se la run si interrompe, i video già
prodotti restano. Dopo la generazione, committa `lib/help/videos.js` (e gli asset
sono già su Supabase) e fai il deploy.

## Personalizzare il walkthrough
Di default il recorder fa uno scroll lento della pagina per la durata della voce.
Per movimenti su misura per una tab (hover, click su un toggle, apertura modale),
estendi `recordTab()` in `generate.mjs` con azioni Playwright specifiche per
`article.tab` (es. cliccare lo switch "Analytics" nella tab Clienti).

## Note
- La voce usa OpenAI `tts-1`. Per voci più naturali si può sostituire `ttsLine()`
  con ElevenLabs (stessa interfaccia: testo → mp3) senza toccare il resto.
- I sottotitoli sono soft (file `.vtt`), attivi di default nel player del drawer.
