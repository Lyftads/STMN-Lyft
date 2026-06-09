export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { handleCallLLM } from '../../../../../lib/agent/callLLMHandler'

// LLM della call. ElevenLabs appende /chat/completions (vedi route annidata),
// ma esponiamo anche qui la root per robustezza.
export const POST = handleCallLLM
