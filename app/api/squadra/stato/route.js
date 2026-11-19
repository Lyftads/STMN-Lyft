import { chiChiama, chiama, rispostaErrore } from '../../../../lib/squadra/servizio'

export const dynamic = 'force-dynamic'

// Lo stato della squadra del cliente: agenti, lavori, bacheca, incarichi.
// Gli indirizzi delle immagini vengono riscritti perche' passino da questo prodotto
// (il browser non ha, e non deve avere, la chiave del servizio).
export async function GET() {
  try {
    const chi = await chiChiama()
    const s = await chiama(chi.workspaceId, '/squadra/api/stato')
    const lavori = (s.lavori || []).map(l => ({ ...l, immagini: (l.immagini || []).map(u => `/api/squadra/file/${encodeURIComponent(String(u).split('/').pop())}`) }))
    return Response.json({ ok: true, admin: !!chi.isAdmin, ...s, lavori }, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return rispostaErrore(e) }
}
