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

const BRAIN_URL = (process.env.BRAIN_URL || 'https://lyftai.io/api/team/call/llm').replace(/\/$/, '')

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect()
    let agentId = 'ceo'
    try { agentId = JSON.parse(ctx.job?.metadata || '{}').agentId || 'ceo' } catch {}
    const voiceId = VOICES[agentId] || VOICES.ceo
    const name = NAMES[agentId] || 'Assistente'

    const vad = await silero.VAD.load()

    const session = new voice.AgentSession({
      vad,
      stt: new openai.STT({ model: 'gpt-4o-transcribe', language: 'it' }),
      // LLM = nostro cervello (endpoint OpenAI-compatible, model team-<id>).
      llm: new openai.LLM({ baseURL: BRAIN_URL, model: `team-${agentId}`, apiKey: process.env.CALL_SECRET || 'x' }),
      tts: new elevenlabs.TTS({ voiceId, modelId: 'eleven_flash_v2_5' }),
    })

    const agent = new voice.Agent({
      instructions: `Sei ${name}, ${ROLES[agentId] || ''} del brand. Sei in una call di gruppo con il team. Parla in italiano, breve e naturale.`,
    })

    await session.start({ agent, room: ctx.room })
    session.say(`Ciao a tutti, sono ${name}. Sono in ascolto, ditemi pure.`)
  },
})

cli.runApp(new WorkerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: 'lyft-agent', // deve combaciare col dispatch lato app
}))
