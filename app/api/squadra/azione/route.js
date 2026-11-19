import { chiChiama, chiama, rispostaErrore, ErroreSquadra } from '../../../../lib/squadra/servizio'

export const dynamic = 'force-dynamic'

// ok = approva (non pubblica) · mod = rimanda con una nota · no = scarta
// pub = pubblica subito · prog = programma · annprog = annulla la programmazione
const AZIONI = new Set(['ok', 'mod', 'no', 'pub', 'prog', 'annprog'])
// Pubblicare e programmare eseguono davvero (inserzioni, modifiche al negozio): solo un amministratore.
const SOLO_ADMIN = new Set(['pub', 'prog', 'annprog'])

export async function POST(req) {
  try {
    const chi = await chiChiama()
    const b = await req.json().catch(() => ({}))
    const azione = String(b.azione || ''), id = String(b.id || '')
    if (!AZIONI.has(azione) || !/^[\w-]{1,80}$/.test(id)) throw new ErroreSquadra('richiesta non valida', 400, 'richiesta')
    if (SOLO_ADMIN.has(azione) && !chi.isAdmin) throw new ErroreSquadra('solo un amministratore puo\' pubblicare o programmare', 403, 'permesso')
    const r = await chiama(chi.workspaceId, '/squadra/api/azione', { metodo: 'POST', corpo: { id, azione, nota: String(b.nota || '').slice(0, 2000) }, attesa: 120000 })
    return Response.json(r, { headers: { 'Cache-Control': 'private, no-store' } })
  } catch (e) { return rispostaErrore(e) }
}
