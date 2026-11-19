import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { statoCalendario, togliCalendario, eventiDelGiorno } from '../../../../lib/studio/calendario'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
const SENZA_CACHE = { 'Cache-Control': 'private, no-store' }

// Il calendario e' della PERSONA collegata (non dell'azienda): stato del collegamento e, con ?oggi=1, gli appuntamenti di oggi.
export async function GET(req) {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid) return NextResponse.json({ ok: false, errore: 'devi rientrare' }, { status: 401 })
  const s = await statoCalendario(uid)
  if (new URL(req.url).searchParams.get('oggi') === '1' && s.collegato) {
    const e = await eventiDelGiorno(uid).catch(() => ({ errore: 'calendario non raggiungibile' }))
    return NextResponse.json({ ok: true, ...s, eventi: e.eventi || [], errore: e.errore || null }, { headers: SENZA_CACHE })
  }
  return NextResponse.json({ ok: true, ...s }, { headers: SENZA_CACHE })
}

export async function DELETE() {
  const uid = await getCurrentUserId().catch(() => null)
  if (!uid) return NextResponse.json({ ok: false, errore: 'devi rientrare' }, { status: 401 })
  await togliCalendario(uid)
  return NextResponse.json({ ok: true }, { headers: SENZA_CACHE })
}
