import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { statoChiavi, salvaChiavi, togliChiavi, ErroreChiavi } from '../../../../lib/studio/chiavi'
import { dimenticaCliente } from '../../../../lib/motore/cliente'
import { studioAttivo, STUDIO_SPENTO } from '../../../../lib/studio/attivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

const SENZA_CACHE = { 'Cache-Control': 'private, no-store' }
const errore = (e) => NextResponse.json({ ok: false, errore: e?.message || 'errore', codice: e?.codice || 'errore' }, { status: e instanceof ErroreChiavi ? e.stato : 500, headers: SENZA_CACHE })

async function chi() {
  const w = await resolveWorkspace().catch(() => null)
  if (!w?.workspaceId) throw new ErroreChiavi('devi rientrare', 401, 'accesso')
  return w
}

// Quali chiavi ha collegato questo cliente. Mai i valori: solo la coda mascherata.
export async function GET() {
  try {
    const w = await chi()
    const s = await statoChiavi(w.workspaceId)
    return NextResponse.json({ ok: true, admin: !!w.isAdmin, studio: studioAttivo(w.workspaceId), ...s }, { headers: SENZA_CACHE })
  } catch (e) { return errore(e) }
}

// Salva (dopo averla provata) la chiave di un servizio. Solo un amministratore: sono i soldi e la posta dell'azienda.
export async function POST(req) {
  try {
    const w = await chi()
    if (!w.isAdmin) throw new ErroreChiavi('solo un amministratore puo\' collegare una chiave', 403, 'permesso')
    const b = await req.json().catch(() => ({}))
    const r = await salvaChiavi(w.workspaceId, String(b.servizio || ''), b.campi && typeof b.campi === 'object' ? b.campi : {}, w.userId)
    dimenticaCliente(w.workspaceId)
    return NextResponse.json({ ok: true, ...r }, { headers: SENZA_CACHE })
  } catch (e) { return errore(e) }
}

export async function DELETE(req) {
  try {
    const w = await chi()
    if (!w.isAdmin) throw new ErroreChiavi('solo un amministratore puo\' scollegare una chiave', 403, 'permesso')
    await togliChiavi(w.workspaceId, String(new URL(req.url).searchParams.get('servizio') || ''))
    dimenticaCliente(w.workspaceId)
    return NextResponse.json({ ok: true }, { headers: SENZA_CACHE })
  } catch (e) { return errore(e) }
}
