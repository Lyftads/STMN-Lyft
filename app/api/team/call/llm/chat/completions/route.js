export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { handleCallLLM } from '../../../../../../../lib/agent/callLLMHandler'

// ElevenLabs Conversational AI chiama <URL del server>/chat/completions.
// Con URL = https://lyftai.io/api/team/call/llm → questa route risponde.
export const POST = handleCallLLM
