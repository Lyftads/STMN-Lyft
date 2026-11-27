export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'
import { oggiNegozio } from '../../../lib/periodi'
import { periodoDa } from '../../../lib/generale/periodo'

// ============================================================================
//  LA SPESA META DI UN PERIODO, e nient'altro.
//
//  Serve allo schermo «Dashboard generale». La spesa arrivava da /api/metrics, che per darla
//  rifa' anche tutto il conto di Shopify: su un periodo lungo e un negozio grande (Saracino,
//  90 giorni) non risponde entro il tempo della route, e lo schermo restava senza spesa e
//  senza MER (Marino, 27 nov 2026). Qui si fa una sola domanda a Meta per account: risponde
//  in un secondo anche su un anno.
//
//  E' la spesa di TUTTE le campagne di tutti gli account collegati, come in /api/metrics di
//  questa app. Le app dedicate tolgono le campagne per i negozi fisici e follower: quella
//  sottrazione la fa lo schermo, con la cifra che chiede a loro.
// ============================================================================

const tenute = new Map()   // «account|since|until» → { alle, spesa }

export async function GET(req) {
  return withTenantContext(req, async () => {
    const m = getMeta()
    const periodo = periodoDa(new URL(req.url).searchParams.get('preset') || 'today', oggiNegozio())
    const senza = { 'cache-control': 'no-store' }
    // Senza account Meta il negozio non fa pubblicita' li': zero e' la risposta giusta.
    // Con l'account ma senza gettone (collegamento scaduto, Nango muto) la spesa NON e' zero: e' ignota.
    if (!m?.adAccountId) return NextResponse.json({ ok: true, collegato: false, periodo, spesa: 0 }, { headers: senza })
    if (!m?.accessToken) return NextResponse.json({ ok: false, periodo, error: 'Meta: accesso non disponibile' }, { headers: senza })
    const account = String(m.adAccountId).split(',').map(s => s.trim()).filter(Boolean)
    const versione = m.graphVersion || 'v20.0'
    let spesa = 0
    try {
      for (const id of account) {
        const chiave = `${id}|${periodo.since}|${periodo.until}`
        const hit = tenute.get(chiave)
        if (hit && Date.now() - hit.alle < 4 * 60_000) { spesa += hit.spesa; continue }
        const url = `https://graph.facebook.com/${versione}/${id}/insights?fields=spend&level=account&time_range=${encodeURIComponent(JSON.stringify({ since: periodo.since, until: periodo.until }))}&access_token=${encodeURIComponent(m.accessToken)}`
        const r = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
        const d = await r.json().catch(() => null)
        // Un account che non risponde NON vale zero: mezza spesa farebbe un MER doppio.
        if (!r.ok || !d || d.error) return NextResponse.json({ ok: false, periodo, error: String(d?.error?.message || `Meta ${r.status}`).slice(0, 120) }, { headers: senza })
        const s = (d.data || []).reduce((a, x) => a + (parseFloat(x.spend) || 0), 0)
        tenute.set(chiave, { alle: Date.now(), spesa: s })
        if (tenute.size > 400) tenute.delete(tenute.keys().next().value)
        spesa += s
      }
    } catch (e) {
      return NextResponse.json({ ok: false, periodo, error: String(e?.message || e).slice(0, 120) }, { headers: senza })
    }
    return NextResponse.json({ ok: true, collegato: true, periodo, spesa: Math.round(spesa * 100) / 100 }, { headers: senza })
  })
}
