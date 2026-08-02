import { handlePeriodAgent } from '../../../lib/agent/periodAgent'

// Agent di periodo: prompt, contratto dati e guardie stanno in UN solo posto
// (lib/agent/periodAgent.js). Qui resta solo l'URL, che il tab chiama da sempre.
export const dynamic = 'force-dynamic'
export const maxDuration = 60

export async function POST(req) {
  return handlePeriodAgent(req, 'mensile')
}
