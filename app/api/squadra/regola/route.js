import { chiChiama, chiama, rispostaErrore, ErroreSquadra } from '../../../../lib/squadra/servizio'

export const dynamic = 'force-dynamic'

// Una regola del titolare per la sua squadra: come vuole che un lavoro sia fatto. Resta finché non la
// toglie, e ogni agente la legge prima di ogni lavoro. Solo un amministratore: cambia il modo di lavorare di tutti.
export async function POST(req) {
  try {
    const chi = await chiChiama()
    if (!chi.isAdmin) throw new ErroreSquadra('solo un amministratore puo\' dare regole alla squadra', 403, 'permesso')
    const b = await req.json().catch(() => ({}))
    const testo = String(b.testo || '').trim().slice(0, 600), per = b.per ? String(b.per).toLowerCase() : null
    if (b.togli) return Response.json(await chiama(chi.workspaceId, '/squadra/api/regola', { metodo: 'POST', corpo: { togli: String(b.togli).slice(0, 80) } }))
    if (testo.length < 6 || (per && !/^[a-z]{2,24}$/.test(per))) throw new ErroreSquadra('scrivi la regola', 400, 'richiesta')
    const r = await chiama(chi.workspaceId, '/squadra/api/regola', { metodo: 'POST', corpo: { testo, per } })
    return Response.json(r, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return rispostaErrore(e) }
}
