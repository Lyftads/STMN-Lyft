export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { withTenantContext, getTenantInfo, getCurrentUserId } from '../../../../lib/tenant/credentials'
import { leggiRegistro, scriviRegistro, decidi, bilancio } from '../../../../lib/pilota/registro'

// Approva · rifiuta · segna come fatta. Decide SEMPRE una persona: qui non si esegue niente da
// soli. `fatta` avvia il conto dei giorni di misura.
export async function POST(req) {
  return withTenantContext(req, async () => {
    const ws = getTenantInfo().userId
    const chi = await getCurrentUserId().catch(() => null)
    if (!ws || !chi) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    const { id, decisione } = await req.json().catch(() => ({}))
    if (!id || !['approva', 'rifiuta', 'fatta'].includes(decisione)) return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })
    try {
      const reg = await leggiRegistro(ws)
      const mossa = decidi(reg, String(id), decisione, chi)
      const salvato = await scriviRegistro(ws, reg)
      return NextResponse.json({ ok: true, mossa, bilancio: bilancio(salvato) })
    } catch (e) { return NextResponse.json({ error: e.message }, { status: 409 }) }
  })
}
