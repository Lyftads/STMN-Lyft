import { chiChiama, chiama, rispostaErrore, ErroreSquadra } from '../../../../../lib/squadra/servizio'

export const dynamic = 'force-dynamic'

// Il ritratto di un agente della squadra del cliente.
export async function GET(_req, { params }) {
  try {
    const chi = await chiChiama()
    const id = String(params?.id || '')
    if (!/^[a-z]{2,24}$/.test(id)) throw new ErroreSquadra('agente non valido', 400, 'richiesta')
    const r = await chiama(chi.workspaceId, `/squadra/volti/${id}.jpg`, { grezzo: true })
    if (!r.ok) throw new ErroreSquadra('ritratto non trovato', 404, 'manca')
    return new Response(r.body, { headers: { 'Content-Type': 'image/jpeg', 'Cache-Control': 'private, max-age=86400' } })
  } catch (e) { return rispostaErrore(e) }
}
