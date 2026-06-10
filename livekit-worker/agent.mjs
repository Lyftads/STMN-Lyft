import { fileURLToPath } from 'node:url'
import 'dotenv/config'
import { cli, defineAgent, llm, pipeline, WorkerOptions } from '@livekit/agents'
import * as openai from '@livekit/agents-plugin-openai'
import * as elevenlabs from '@livekit/agents-plugin-elevenlabs'
import * as silero from '@livekit/agents-plugin-silero'

// ============================================================================
//  WORKER BRIDGE — porta un agente della Squadra AI dentro una stanza LiveKit.
//  Pipeline: STT (OpenAI) → LLM (il NOSTRO cervello via /api/team/call/llm,
//  con persona+dati+voce dell'agente) → TTS (ElevenLabs, voce per agente).
//  Dispatchato da /api/team/call/agent-dispatch con metadata {agentId}.
//
//  Deploy: servizio always-on (Railway/Render/Fly). Env richieste sotto.
// ============================================================================

// Voci ElevenLabs per agente (uguali a lib/agent/team.js).
const VOICES = {
  ceo: 'XB0fDUnXU5powFXDhCwa', ads: '21m00Tcm4TlvDq8ikWAM', cro: 'EXAVITQu4vr4xnSDxMaL',
  creative: 'Xb7hH8MSUJpSbSDYk0k2', cfo: 'onwK4e9ZLuTAKqWW03F9', cmo: 'ErXwobaYiN019PkySvjV',
  seo: 'JBFqnCBsd6RMkjVDRZzb', data: 'TX3LPaxmHKxFdv7VOQHJ',
}
const NAMES = { ceo: 'Chiara', cfo: 'Marco', cmo: 'Luigi', ads: 'Sofia', seo: 'Davide', cro: 'Giulia', data: 'Alessandro', creative: 'Valentina' }

const BRAIN_URL = (process.env.BRAIN_URL || 'https://lyftai.io/api/team/call/llm').replace(/\/$/, '')

export default defineAgent({
  entry: async (ctx) => {
    await ctx.connect()
    let agentId = 'ceo'
    try { agentId = JSON.parse(ctx.job?.metadata || '{}').agentId || 'ceo' } catch {}
    const voiceId = VOICES[agentId] || VOICES.ceo

    const vad = await silero.VAD.load()

    const agent = new pipeline.VoicePipelineAgent(
      vad,
      // STT realtime (OpenAI). In alternativa: @livekit/agents-plugin-deepgram.
      new openai.STT({ model: 'gpt-4o-transcribe', language: 'it' }),
      // LLM = il nostro cervello: endpoint OpenAI-compatible, model team-<id>,
      // auth col CALL_SECRET → risponde con persona + dati reali dell'agente.
      new openai.LLM({ baseURL: BRAIN_URL, model: `team-${agentId}`, apiKey: process.env.CALL_SECRET || 'x' }),
      // TTS ElevenLabs con la voce dell'agente.
      new elevenlabs.TTS({ voiceId, modelId: 'eleven_flash_v2_5' }),
      { chatCtx: new llm.ChatContext(), allowInterruptions: true },
    )

    agent.start(ctx.room)
    // Saluto d'ingresso.
    await agent.say(`Ciao a tutti, sono ${NAMES[agentId] || 'un membro della squadra'}. Sono in ascolto.`, true)
  },
})

cli.runApp(new WorkerOptions({
  agent: fileURLToPath(import.meta.url),
  agentName: 'lyft-agent', // deve combaciare col dispatch lato app
}))
