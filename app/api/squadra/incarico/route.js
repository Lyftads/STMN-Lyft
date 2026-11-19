import { chiChiama, chiama, rispostaErrore, ErroreSquadra } from '../../../../lib/squadra/servizio'

export const dynamic = 'force-dynamic'

// Un incarico scritto a mano a un agente della squadra del cliente.
export async function POST(req) {
  try {
    const chi = await chiChiama()
    const b = await req.json().catch(() => ({}))
    const agente = String(b.agente || ''), compito = String(b.compito || '').trim().slice(0, 4000)
    if (!/^[a-z]{2,24}$/.test(agente) || !compito) throw new ErroreSquadra('scegli un agente e scrivi il compito', 400, 'richiesta')
    const r = await chiama(chi.workspaceId, '/squadra/api/incarico', { metodo: 'POST', corpo: { agente, compito } })
    return Response.json(r, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return rispostaErrore(e) }
}
