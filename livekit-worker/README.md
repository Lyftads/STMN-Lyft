# Worker bridge — Agent della Squadra AI nelle call di gruppo

Servizio **always-on** che fa entrare gli agent (voce ElevenLabs + cervello LyftAI)
dentro le stanze LiveKit. Va deployato **fuori da Vercel** (Vercel è serverless).

## Come funziona
1. Nell'app premi "👥 Call di gruppo" → entri nella stanza (umani).
2. Premi "🤖 Sofia" (o altro) → l'app chiama `/api/team/call/agent-dispatch`.
3. LiveKit dispatcha questo worker (`agent name: lyft-agent`) nella stanza.
4. Il worker: ascolta (STT) → il **nostro cervello** risponde (persona+dati reali
   via `/api/team/call/llm`) → voce ElevenLabs dell'agente nella stanza.

## Deploy su Railway (consigliato, gratis)
1. Crea un nuovo progetto su https://railway.app → "Deploy from GitHub repo" e
   punta a questa cartella `livekit-worker/` (oppure carica i 3 file).
2. Imposta le **Environment Variables** (vedi `.env.example`): LIVEKIT_URL,
   LIVEKIT_API_KEY, LIVEKIT_API_SECRET, ELEVENLABS_API_KEY, OPENAI_API_KEY,
   CALL_SECRET, BRAIN_URL.
3. Start command: `npm start`.
4. Deploy. Il worker resta acceso e si registra su LiveKit come `lyft-agent`.

(Render/Fly.io: stesso principio — servizio Node always-on, `npm install` + `npm start`.)

## Note
- Lo STT usa OpenAI (`gpt-4o-transcribe`); in alternativa Deepgram
  (`@livekit/agents-plugin-deepgram`) per latenza più bassa.
- Il `CALL_SECRET` deve essere lo stesso impostato su Vercel (autorizza il cervello).
- L'API esatta di `@livekit/agents` può cambiare tra versioni: se al primo avvio
  dà errore su `VoicePipelineAgent`/plugin, segnalami la versione installata e
  adatto le 5 righe della pipeline.
