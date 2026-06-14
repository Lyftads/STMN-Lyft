export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../lib/tenant/credentials'

// ============================================================================
//  PROBE diagnostico: verifica se la Marketing API del tenant espone il
//  breakdown per "segmento di pubblico" (Nuovo pubblico / Clienti esistenti /
//  Pubblico che ha interagito / Sconosciuto) che si vede nei dettagli campagna
//  di Ads Manager. Se sì → CAC nuovi clienti per canale ESATTO dal dato Meta.
//  Se no → fallback alla classificazione per targeting degli adset (qui sotto
//  dumpiamo anche audience + targeting per costruire la mappatura).
//
//  Apri:  /api/meta-segments-probe        (ultimi 30 giorni)
//         /api/meta-segments-probe?days=60
// ============================================================================

const GRAPH = 'v19.0'
const metaToken = () => getMeta().accessToken
const metaAccount = () => getMeta().adAccountId

function accounts() {
  return String(metaAccount() || '').split(',').map(s => {
    const x = s.trim().replace(/["']/g, ''); if (!x) return null
    return x.startsWith('act_') ? x : `act_${x}`
  }).filter(Boolean)
}

async function fb(path, params) {
  const url = new URL(`https://graph.facebook.com/${GRAPH}/${path}`)
  for (const [k, v] of Object.entries(params || {})) {
    if (v != null && v !== '') url.searchParams.set(k, typeof v === 'string' ? v : JSON.stringify(v))
  }
  url.searchParams.set('access_token', metaToken())
  const res = await fetch(url.toString(), { cache: 'no-store' })
  const text = await res.text()
  let data; try { data = JSON.parse(text) } catch { return { __raw: text.slice(0, 400), ok: res.ok } }
  return data
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!metaToken() || !metaAccount()) {
      return NextResponse.json({ ok: false, error: 'Meta non configurato' }, { status: 400 })
    }
    const days = Math.min(180, Math.max(1, Number(new URL(req.url).searchParams.get('days')) || 30))
    const until = new Date().toISOString().slice(0, 10)
    const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
    const time_range = JSON.stringify({ since, until })
    const acc = accounts()[0]

    const out = { account: acc, range: { since, until }, breakdownTests: {}, customAudiences: null, sampleAdsets: null }

    // 1) Prova i candidati di breakdown "segmento di pubblico" sugli insights.
    //    Se Meta li espone via API, uno di questi NON darà errore e tornerà righe
    //    con una dimensione di segmento.
    const candidates = [
      'user_segment_key', 'audience_segment', 'user_segment', 'standard_event_content_type',
      'is_conversion_id_modeled', 'mdsa_landing_destination', 'breakdown_reporting_ad_id',
    ]
    for (const b of candidates) {
      const r = await fb(`${acc}/insights`, {
        level: 'campaign', time_range, fields: 'campaign_name,spend,actions', breakdowns: b, limit: 5,
      })
      out.breakdownTests[b] = r?.error
        ? { ok: false, error: r.error.message, code: r.error.code }
        : { ok: true, sample: (r?.data || []).slice(0, 3) }
    }

    // 2) Custom audiences dell'account (id, nome, tipo) → per la classificazione targeting.
    const ca = await fb(`${acc}/customaudiences`, {
      fields: 'id,name,subtype,description,approximate_count_lower_bound', limit: 100,
    })
    out.customAudiences = ca?.error ? { error: ca.error.message } : (ca?.data || []).map(a => ({
      id: a.id, name: a.name, subtype: a.subtype, count: a.approximate_count_lower_bound,
    }))

    // 3) Campione di adset con targeting (audience incluse/escluse) + spesa/acquisti.
    const adsets = await fb(`${acc}/adsets`, {
      fields: 'id,name,campaign{name},effective_status,targeting{custom_audiences,excluded_custom_audiences}',
      effective_status: JSON.stringify(['ACTIVE']), limit: 25,
    })
    const rows = adsets?.error ? [] : (adsets?.data || [])
    out.sampleAdsets = adsets?.error ? { error: adsets.error.message } : rows.map(a => ({
      adset: a.name,
      campaign: a.campaign?.name,
      included: (a.targeting?.custom_audiences || []).map(x => x.id || x.name || x),
      excluded: (a.targeting?.excluded_custom_audiences || []).map(x => x.id || x.name || x),
    }))

    return NextResponse.json({ ok: true, ...out })
  })
}
