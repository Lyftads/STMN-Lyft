import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import { cli, defineAgent, voice, WorkerOptions } from '@livekit/agents'
import * as openai from '@livekit/agents-plugin-openai'
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs'
import * as silero from '@livekit/agents-plugin-silero'

// ============================================================================
//  WORKER BRIDGE (@livekit/agents v1.x) — porta un agente della Squadra AI in
//  una stanza LiveKit. STT (OpenAI) → LLM (il NOSTRO cervello via
//  /api/team/call/llm, persona+dati+voce dell'agente) → TTS (ElevenLabs).
//  Dispatchato da /api/team/call/agent-dispatch con metadata {agentId}.
// ============================================================================

const VOICES = {
  ceo: 'XB0fDUnXU5powFXDhCwa', ads: '21m00Tcm4TlvDq8ikWAM', cro: 'EXAVITQu4vr4xnSDxMaL',
  creative: 'Xb7hH8MSUJpSbSDYk0k2', cfo: 'onwK4e9ZLuTAKqWW03F9', cmo: 'ErXwobaYiN019PkySvjV',
  seo: 'JBFqnCBsd6RMkjVDRZzb', data: 'TX3LPaxmHKxFdv7VOQHJ',
}
const NAMES = { ceo: 'Chiara', cfo: 'Marco', cmo: 'Luigi', ads: 'Sofia', seo: 'Davide', cro: 'Giulia', data: 'Alessandro', creative: 'Valentina' }
const ROLES = { ceo: 'CEO', cfo: 'CFO', cmo: 'CMO', ads: 'Advertising', seo: 'SEO', cro: 'CRO', data: 'Data Analyst', creative: 'Creative' }
const AVATARS = {
  ceo: 'https://randomuser.me/api/portraits/women/68.jpg', cfo: 'https://randomuser.me/api/portraits/men/32.jpg',
  cmo: 'https://randomuser.me/api/portraits/men/45.jpg', ads: 'https://randomuser.me/api/portraits/women/44.jpg',
  seo: 'https://randomuser.me/api/portraits/men/52.jpg', cro: 'https://randomuser.me/api/portraits/women/65.jpg',
  data: 'https://randomuser.me/api/portraits/men/76.jpg', creative: 'https://randomuser.me/api/portraits/women/12.jpg',
}

const BRAIN_URL = (process.env.BRAIN_URL || 'https://lyftai.io/api/team/call/llm').replace(/\/$/, '')

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect()
    let agentId = 'ceo'
    try { agentId = JSON.parse(ctx.job?.metadata || '{}').agentId || 'ceo' } catch {}
    const voiceId = VOICES[agentId] || VOICES.ceo
    const name = NAMES[agentId] || 'Assistente'

    // Nome + foto dell'agente, così nel tile della call (stile Meet) compaiono.
    // rtc-node usa updateName/updateMetadata (NON setName/setMetadata).
    try {
      const lp = ctx.room?.localParticipant
      if (lp) {
        await lp.updateName(name)
        await lp.updateMetadata(JSON.stringify({ isAgent: true, name, avatar: AVATARS[agentId] || '' }))
      }
    } catch (e) { console.log('[lyft-agent] updateName/Metadata err:', e?.message) }

    const vad = await silero.VAD.load()

    const session = new voice.AgentSession({
      vad,
      stt: new openai.STT({ model: 'gpt-4o-transcribe', language: 'it', apiKey: process.env.OPENAI_API_KEY }),
      // LLM = nostro cervello (endpoint OpenAI-compatible, model team-<id>).
      llm: new openai.LLM({ baseURL: BRAIN_URL, model: `team-${agentId}`, apiKey: process.env.CALL_SECRET || 'x' }),
      // apiKey esplicito: il plugin di default cerca ELEVEN_API_KEY, noi usiamo ELEVENLABS_API_KEY.
      tts: new elevenlabs.TTS({ voiceId, modelId: 'eleven_flash_v2_5', apiKey: process.env.ELEVENLABS_API_KEY || process.env.ELEVEN_API_KEY }),
    })

    // ── Diagnostica: capire dove si rompe il turno (STT → cervello → TTS) ────
    session.on('user_input_transcribed', (ev) => console.log(`[lyft-agent] STT utente: "${ev?.transcript}" final=${ev?.isFinal}`))
    session.on('user_state_changed', (ev) => console.log(`[lyft-agent] user ${ev?.oldState}→${ev?.newState}`))
    session.on('agent_state_changed', (ev) => console.log(`[lyft-agent] agent ${ev?.oldState}→${ev?.newState}`))
    session.on('conversation_item_added', (ev) => { try { console.log(`[lyft-agent] item ${ev?.item?.role}: ${String(ev?.item?.textContent ?? ev?.item?.content ?? '').slice(0, 140)}`) } catch {} })
    session.on('error', (ev) => console.log('[lyft-agent] SESSION ERROR:', ev?.error?.message || ev?.error || JSON.stringify(ev)))

    const agent = new voice.Agent({
      instructions: `Sei ${name}, ${ROLES[agentId] || ''} del brand. Sei in una call di gruppo con il team. Parla in italiano, breve e naturale.`,
    })

    await session.start({ agent, room: ctx.room })
    session.say(`Ciao a tutti, sono ${name}. Sono in ascolto, ditemi pure.`)
  },
})

console.log(`[lyft-agent] boot · LIVEKIT_URL=${process.env.LIVEKIT_URL || '(MANCANTE!)'} · agentName=lyft-agent · brain=${BRAIN_URL} · openaiKey=${process.env.OPENAI_API_KEY ? 'ok' : 'MANCANTE'} · elevenKey=${process.env.ELEVENLABS_API_KEY ? 'ok' : 'MANCANTE'} · callSecret=${process.env.CALL_SECRET ? 'ok' : 'MANCANTE'}`)

cli.runApp(new WorkerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: 'lyft-agent', // deve combaciare col dispatch lato app
}))
