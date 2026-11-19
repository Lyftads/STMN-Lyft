import { chiChiama, chiama, rispostaErrore, ErroreSquadra } from '../../../../../lib/squadra/servizio'

export const dynamic = 'force-dynamic'

// Le immagini prodotte dalla squadra del cliente, lette dal suo servizio.
export async function GET(_req, { params }) {
  try {
    const chi = await chiChiama()
    const nome = String(params?.nome || '')
    if (!/^[\w.-]+\.png$/.test(nome)) throw new ErroreSquadra('file non valido', 400, 'richiesta')
    const r = await chiama(chi.workspaceId, `/squadra/file/${nome}`, { grezzo: true, attesa: 30000 })
    if (!r.ok) throw new ErroreSquadra('immagine non trovata', 404, 'manca')
    // private: l'immagine e' di UN cliente e l'indirizzo e' uguale per tutti — mai in una cache condivisa.
    return new Response(r.body, { headers: { 'Content-Type': 'image/png', 'Cache-Control': 'private, max-age=3600' } })
  } catch (e) { return rispostaErrore(e) }
}
