import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { getTenantCreds } from '../../../../lib/tenant/credentials'
import { MESTIERI, controlli, leggiSquadra, salvaBozza, richiediSquadra, ErroreCreazione } from '../../../../lib/squadra/creazione'
import { studioAttivo, STUDIO_SPENTO } from '../../../../lib/studio/attivo'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const SENZA_CACHE = { 'Cache-Control': 'private, no-store' }
const errore = (e) => NextResponse.json({ ok: false, errore: e?.message || 'errore', codice: e?.codice || 'errore' }, { status: e instanceof ErroreCreazione ? e.stato : 500, headers: SENZA_CACHE })
async function chi() { const w = await resolveWorkspace().catch(() => null); if (!w?.workspaceId) throw new ErroreCreazione('devi rientrare', 401, 'accesso'); if (!studioAttivo(w.workspaceId)) throw new ErroreCreazione(STUDIO_SPENTO, 403, 'studio_spento'); return w }

// A che punto e' la squadra di questo cliente: cosa manca per crearla e cosa ha gia' scritto.
export async function GET() {
  try {
    const w = await chi()
    const [{ pronto, riga }, lista, creds] = await Promise.all([leggiSquadra(w.workspaceId), controlli(w.workspaceId), getTenantCreds(w.workspaceId).catch(() => null)])
    return NextResponse.json({
      ok: true, admin: !!w.isAdmin, pronto, stato: riga?.stato || null, richiesta_il: riga?.richiesta_il || null,
      controlli: lista, mestieri: MESTIERI, configurazione: riga?.configurazione || {},
      azienda: { nome: creds?.companyName || null, sito: creds?.shopify?.storeUrl ? `https://${creds.shopify.storeUrl}` : '' },
    }, { headers: SENZA_CACHE })
  } catch (e) { return errore(e) }
}

// salva = tiene la bozza · richiedi = «Crea la squadra». Solo un amministratore: da qui partono agenti che
// consumano il credito Claude dell'azienda e leggono i suoi conti.
export async function POST(req) {
  try {
    const w = await chi()
    if (!w.isAdmin) throw new ErroreCreazione('solo un amministratore puo\' creare la squadra', 403, 'permesso')
    const b = await req.json().catch(() => ({}))
    if (b.azione === 'salva') { await salvaBozza(w.workspaceId, b.dati || {}, w.userId); return NextResponse.json({ ok: true, stato: 'bozza' }, { headers: SENZA_CACHE }) }
    if (b.azione === 'richiedi') {
      const r = await richiediSquadra(w.workspaceId, b.dati || {}, w.userId)
      // Chi gestisce il prodotto deve saperlo: finche' il servizio non si accende da solo, lo accende lui.
      if (process.env.RESEND_API_KEY && process.env.CONTACT_TO) {
        fetch('https://api.resend.com/emails', { method: 'POST', headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ from: process.env.CONTACT_FROM || process.env.REPORT_FROM, to: [process.env.CONTACT_TO], subject: 'Squadra agent richiesta', text: `Un cliente ha chiesto la sua squadra.\nWorkspace: ${w.workspaceId}\nDa accendere con: node scripts/accendi-squadra.mjs ${w.workspaceId} <url del servizio>` }) }).catch(() => {})
      }
      return NextResponse.json({ ok: true, ...r }, { headers: SENZA_CACHE })
    }
    throw new ErroreCreazione('azione sconosciuta', 400, 'richiesta')
  } catch (e) { return errore(e) }
}
