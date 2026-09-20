export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta, getTenantInfo } from '../../../lib/tenant/credentials'
import { getRange } from '../../../lib/metaRange'
import { swrSnapshot } from '../../../lib/cache/swr'
import { campagnaDaEscludere } from '../../../lib/ads/driveToStore'
import { tipoNegozio } from '../../../lib/team/tipoNegozio'
import { getAdminSupabase } from '../../../lib/supabase/server'

// ============================================================================
//  La spesa Drive to Store, mostrata A PARTE.
//
//  Queste campagne sono fuori da ROAS, MER, CAC e CPO in tutto il SaaS (vedi
//  lib/ads/driveToStore.js). Ma sono soldi spesi davvero: qui si leggono, per
//  farli vedere accanto ai numeri da cui sono stati tolti — e al conto
//  economico, che e' l'unico posto dove restano dentro.
//
//  Si legge a livello di CAMPAGNA e si filtra in codice con la stessa regola
//  del resto dell'app: cosi' una grafia nuova del nome vale subito anche qui.
//
//  GET ?since&until | ?preset=last_30d      → totale e campagne del periodo
//  GET ?part=monthly                        → spesa per mese (conto economico)
// ============================================================================

// Questa sezione esiste solo per chi ha NEGOZI FISICI. Le campagne si riconoscono dal nome, e
// tenere il riconoscimento acceso per tutti sarebbe pericoloso: un cliente che chiami una campagna
// "Drive to Store Launch" se la vedrebbe sparire da ROAS, MER e CAC senza nessun errore.
// Chi non l'ha configurato riceve `attivo: false` e non si chiama Meta per niente.
async function etichettaDelCliente() {
  try {
    const ws = getTenantInfo().userId
    if (!ws) return null
    const { data } = await getAdminSupabase().from('companies')
      .select('multimarca, marchi_rilevati, quota_primo_marchio, canali_esclusi, negozi_fisici, etichetta_negozi_fisici')
      .eq('user_id', ws).maybeSingle()
    const t = tipoNegozio(data || {})
    if (!t.negoziFisici) return null
    return t.etichettaNegoziFisici || 'drive to store'
  } catch { return null }
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round(num(n) * 100) / 100

async function leggi(params) {
  const m = getMeta()
  if (!m?.accessToken || !m?.adAccountId) return { errore: 'Meta non collegato', righe: [] }
  const G = `https://graph.facebook.com/${m.graphVersion || 'v20.0'}`
  const conti = String(m.adAccountId).split(',').map(x => x.trim().replace(/["']/g, '')).filter(Boolean).map(x => x.startsWith('act_') ? x : `act_${x}`)
  const righe = []
  for (const acc of conti) {
    const url = new URL(`${G}/${acc}/insights`)
    url.searchParams.set('level', 'campaign')
    url.searchParams.set('fields', 'campaign_id,campaign_name,spend,impressions,reach,inline_link_clicks')
    // Si chiede a Meta solo cio' che contiene "drive": meno righe da scorrere.
    // La decisione vera la prende isDriveToStore qui sotto.
    url.searchParams.set('filtering', JSON.stringify([{ field: 'campaign.name', operator: 'CONTAIN', value: 'drive' }]))
    url.searchParams.set('limit', '500')
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v)
    url.searchParams.set('access_token', m.accessToken)
    let next = url.toString()
    for (let p = 0; p < 10 && next; p++) {
      const j = await fetch(next, { cache: 'no-store', signal: AbortSignal.timeout(25000) }).then(r => r.json()).catch(() => ({}))
      if (j?.error) return { errore: String(j.error.message || 'Meta').slice(0, 140), righe }
      righe.push(...(j.data || []))
      next = j?.paging?.next || null
    }
  }
  return { errore: null, righe: righe.filter(r => campagnaDaEscludere(r.campaign_name, etichetta)) }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const etichetta = await etichettaDelCliente()
    if (!etichetta) return NextResponse.json({ ok: true, attivo: false, spesa: 0, campagne: [], motivo: 'nessun negozio fisico configurato' })
    const sp = new URL(req.url).searchParams

    if (sp.get('part') === 'monthly') {
      return swrSnapshot(req, { tab: 'driveToStoreMonthly@1', ttlMs: 6 * 60 * 60 * 1000, compute: async () => {
        const oggi = new Date()
        const da = new Date(Date.UTC(oggi.getUTCFullYear() - 2, 0, 1)).toISOString().slice(0, 10)
        const { errore, righe } = await leggi({ time_range: JSON.stringify({ since: da, until: oggi.toISOString().slice(0, 10) }), time_increment: 'monthly' })
        if (errore) return { ok: false, error: errore, __noCache: true }
        const perMese = {}
        for (const r of righe) { const k = String(r.date_start || '').slice(0, 7); if (k) perMese[k] = r2((perMese[k] || 0) + num(r.spend)) }
        return { ok: true, perMese }
      } })
    }

    const since = sp.get('since'), until = sp.get('until')
    const preset = sp.get('preset') || 'last_30d'
    const su = preset.match(/^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/)
    const range = (since && until) ? { since, until } : su ? { since: su[1], until: su[2] } : getRange(preset, sp)
    if (!range?.since || !range?.until) return NextResponse.json({ ok: false, error: 'Periodo non valido' }, { status: 400 })
    return swrSnapshot(req, { tab: 'driveToStore@1', ttlMs: 30 * 60 * 1000, compute: async () => {
      const { errore, righe } = await leggi({ time_range: JSON.stringify(range) })
      if (errore) return { ok: false, error: errore, range, __noCache: true }
      const perCampagna = new Map()
      for (const r of righe) {
        const v = perCampagna.get(r.campaign_id) || { nome: r.campaign_name, spesa: 0, impression: 0, copertura: 0, clic: 0 }
        v.spesa += num(r.spend); v.impression += num(r.impressions); v.copertura += num(r.reach); v.clic += num(r.inline_link_clicks)
        perCampagna.set(r.campaign_id, v)
      }
      const campagne = [...perCampagna.values()].map(c => ({ ...c, spesa: r2(c.spesa) })).sort((a, b) => b.spesa - a.spesa)
      return { ok: true, range, spesa: r2(campagne.reduce((a, c) => a + c.spesa, 0)), campagne }
    } })
  })
}
