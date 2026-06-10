import { getAdminSupabase } from '../supabase/server'

// ============================================================================
//  Dati brand CONDIVISI da tutti gli agent (call E chat): stesso brief preciso
//  per ogni time frame. Lo snapshot arricchito (_periods/_klaviyo/_gsc) è scritto
//  in call_context dal prime; qui lo si legge e si formatta col brief.
// ============================================================================

// Legge lo snapshot arricchito (call_context) per il workspace.
export async function readSnapshot(workspaceId) {
  try {
    const admin = getAdminSupabase()
    if (!admin || !workspaceId) return null
    const { data } = await admin.from('call_context').select('data, updated_at').eq('workspace_id', workspaceId).maybeSingle()
    return data?.data ? { data: data.data, updatedAt: data.updated_at } : null
  } catch { return null }
}

const LTV_CFG = { freq: 1.69, life: 1.57, margin: 62 } // config STMN (page.js)

// Range date [from,to] per un periodo nominato.
function periodRange(period) {
  const ymd = x => x.toISOString().slice(0, 10)
  const add = (s, n) => { const x = new Date(s + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return ymd(x) }
  const now = new Date(), today = ymd(now), dd = (now.getUTCDay() + 6) % 7
  const thisMon = add(today, -dd), lastMon = add(thisMon, -7)
  const m1 = today.slice(0, 8) + '01'
  const lm = new Date(m1 + 'T00:00:00Z'); lm.setUTCMonth(lm.getUTCMonth() - 1)
  const lm1 = ymd(lm).slice(0, 8) + '01', lmEnd = add(m1, -1)
  switch (period) {
    case 'today': return [today, today]
    case 'yesterday': return [add(today, -1), add(today, -1)]
    case 'this_week': return [thisMon, today]
    case 'last_week': return [lastMon, add(lastMon, 6)]
    case 'this_month': return [m1, today]
    case 'last_month': return [lm1, lmEnd]
    case 'last_7d': return [add(today, -6), today]
    case 'last_14d': return [add(today, -13), today]
    default: return [add(today, -29), today] // last_30d
  }
}

// KPI COMPLETI (come il KPI Brain del software) per un periodo. money dai _periods
// (Admin GraphQL netto resi); tassi/clienti/Meta dalla serie weekly nel range.
export function periodKPIs(d, period) {
  const sh = d.shopify || {}, ma = d.metaAds || {}
  const P = d._periods || {}, GA = d._ga4 || {}
  const [from, to] = periodRange(period)
  const inR = dt => { const k = String(dt || '').slice(0, 10); return k >= from && k <= to }
  const sw = (sh.weekly || []).filter(w => inR(w.date) && (Number(w.ordini) || Number(w.fatturato)))
  const mw = (ma.weekly || []).filter(w => inR(w.date))
  const sum = (a, f) => a.reduce((s, x) => s + (Number(f(x)) || 0), 0)
  // money TAB-ESATTO: settimane → serie weekly ShopifyQL (= tab Weekly); altri
  // periodi → /api/metrics (_metricsPeriods, = tab); riserva Admin GraphQL (_periods).
  // money: settimane → serie weekly ShopifyQL (= tab Weekly, validata); altri
  // periodi → Admin GraphQL (_periods, AFFIDABILE: ShopifyQL/dayBreakdown è
  // parziale col lag e SOTTOSTIMA → non usarlo per i totali).
  const pm = P[period]
  const findWk = key => (sh.weekly || []).find(w => String(w.date || '').slice(0, 10) === key && (Number(w.ordini) || Number(w.fatturato)))
  let revenue, orders
  if (period === 'this_week' || period === 'last_week') { const w = findWk(from); if (w) { revenue = w.fatturato; orders = w.ordini } }
  if (revenue == null) { revenue = pm?.fatturato != null ? pm.fatturato : sum(sw, w => w.fatturato); orders = pm?.orders != null ? pm.orders : sum(sw, w => w.ordini) }
  // nuovi/ritorno: preferisci Admin GraphQL (_periods, affidabile), poi la weekly.
  const nc = (pm && pm.nc != null) ? pm.nc : sum(sw, w => w.nc)
  const rc = (pm && pm.rc != null) ? pm.rc : sum(sw, w => w.rc)
  const sessions = Number(GA[period]?.sessions) || sum(sw, w => w.uniqueSessions) || null
  const resi = sum(sw, w => w.resi)
  // META TAB-ESATTO per periodo da _metaPeriods (/api/meta-detail); riserva: serie weekly.
  const mp2 = (d._metaPeriods || {})[period]
  const spend = mp2?.spend != null ? mp2.spend : sum(mw, w => w.spend)
  const impressions = mp2?.impressions != null ? mp2.impressions : sum(mw, w => w.impressions)
  const clicks = mp2?.link_clicks != null ? mp2.link_clicks : sum(mw, w => w.linkClicks)
  const freq = mp2?.frequency != null ? mp2.frequency : (mw.length ? sum(mw, w => w.frequency) / mw.length : null)
  const aov = orders ? revenue / orders : null
  const repeat_rate = (nc + rc) ? rc / (nc + rc) * 100 : null
  const ltv = aov ? aov * LTV_CFG.freq * LTV_CFG.life * LTV_CFG.margin / 100 : null
  const roas_meta = mp2?.roas != null ? mp2.roas : (Number(d.metaDetail?.summary?.roas) || (spend ? revenue / spend : null))
  const mer = spend ? revenue / spend : null
  const cac = nc ? spend / nc : null
  const ctr = mp2?.ctr_link != null ? mp2.ctr_link : (impressions ? clicks / impressions * 100 : null)
  const cpc = mp2?.cpc_link != null ? mp2.cpc_link : (clicks ? spend / clicks : null)
  const cpm = mp2?.cpm != null ? mp2.cpm : (impressions ? spend / impressions * 1000 : null)
  const purchases = mp2?.purchases ?? null, purchase_value = mp2?.purchase_value ?? null
  const conversion_rate = (orders && sessions) ? orders / sessions * 100 : null
  const round = (n, dgt = 0) => n == null ? null : Math.round(n * 10 ** dgt) / 10 ** dgt
  return {
    period, from, to,
    revenue: round(revenue), orders: round(orders), aov: round(aov), returns: round(resi),
    new_customers: round(nc), returning_customers: round(rc), repeat_rate: round(repeat_rate, 1), ltv: round(ltv),
    sessions: round(sessions), conversion_rate: round(conversion_rate, 2),
    ad_spend: round(spend), roas_meta: round(roas_meta, 2), mer: round(mer, 2), cac: round(cac),
    ctr: round(ctr, 2), cpc: round(cpc, 2), cpm: round(cpm, 2), frequency: round(freq, 2),
    impressions: round(impressions), clicks: round(clicks),
    meta_purchases: purchases != null ? round(purchases) : null, meta_purchase_value: purchase_value != null ? round(purchase_value) : null,
  }
}

// Brief COMPLETO e PRECISO per ogni time frame (Shopify netto resi, Meta, Klaviyo, GSC).
export function buildBrief(d) {
  if (!d) return 'Dati del brand non disponibili in questo momento.'
  const r1 = n => Math.round(Number(n) || 0)
  const eur = n => `${r1(n)} euro`
  const sh = d.shopify || {}, ma = d.metaAds || {}, ga = (d.ga4 || {}).summary || {}
  const P = d._periods || {}
  const ymd = x => x.toISOString().slice(0, 10)
  const add = (s, n) => { const x = new Date(s + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return ymd(x) }
  const now = new Date(), today = ymd(now), dd = (now.getUTCDay() + 6) % 7
  const thisMon = add(today, -dd), lastMon = add(thisMon, -7)
  const thisMonthK = today.slice(0, 7)
  const lmD = new Date(today.slice(0, 8) + '01T00:00:00Z'); lmD.setUTCMonth(lmD.getUTCMonth() - 1); const lastMonthK = ymd(lmD).slice(0, 7)

  const findW = key => (sh.weekly || []).find(w => String(w.date || '').slice(0, 10) === key && (Number(w.ordini) || Number(w.fatturato)))
  const shop = key => {
    if (key === 'this_week') { const w = findW(thisMon); if (w) return { f: w.fatturato, o: w.ordini } }
    if (key === 'last_week') { const w = findW(lastMon); if (w) return { f: w.fatturato, o: w.ordini } }
    const p = P[key]; return (p && (p.orders || p.fatturato)) ? { f: p.fatturato, o: p.orders } : null // Admin GraphQL (affidabile)
  }
  const sLine = (key, lbl) => { const s = shop(key); return `  ${lbl}: ${s ? `${eur(s.f)}, ${r1(s.o)} ordini` : 'in aggiornamento'}` }

  const mw = key => (ma.weekly || []).find(w => String(w.date || '').slice(0, 10) === key)
  const monthSpend = yyyymm => { const mo = (ma.monthly || []).find(m => String(m.month || m.date || '').slice(0, 7) === yyyymm); return mo ? Number(mo.spend) : null }
  const m30 = (ma.weekly || []).slice(-4).reduce((s, w) => s + (Number(w.spend) || 0), 0)
  const mLine = (val, lbl) => `  ${lbl}: ${val != null ? eur(val) : 'n/d'}`

  const K = d._klaviyo || {}
  const num = v => (v && typeof v === 'object') ? Number(v.total) : Number(v)
  const kline = (k, lbl) => k ? `  ${lbl}: revenue ${eur(num(k.revenue))}, apertura ${r1(k.openRate)}%, click ${r1(k.clickRate)}%, inviate ${r1(num(k.received))}` : `  ${lbl}: n/d`
  const hasK = K.this_week || K.this_month || K.last_30d
  const klaviyoBlock = hasK ? `\n\nEMAIL Klaviyo, per periodo:\n${kline(K.this_week, 'Questa settimana')}\n${kline(K.this_month, 'Questo mese')}\n${kline(K.last_30d, 'Ultimi 30 giorni')}` : ''

  const G = d._gsc || {}
  const gt = g => g?.totals || g?.current || g || null
  const gline = (g, lbl) => { const t = gt(g); return (t && (t.clicks != null)) ? `  ${lbl}: ${r1(t.clicks)} click, ${r1(t.impressions)} impressioni, CTR ${(Number(t.ctr) || 0).toFixed(1)}%, posizione media ${(Number(t.position) || 0).toFixed(1)}` : `  ${lbl}: n/d` }
  const gPrev = (g, lbl) => { const p = g?.prev || g?.previous; return p ? `  ${lbl}: ${r1(p.clicks)} click, ${r1(p.impressions)} impressioni` : '' }
  const hasG = G.last_7d || G.last_30d
  const gscBlock = hasG ? `\n\nSEO Google Search Console, per periodo:\n${gline(G.last_7d, 'Ultimi 7 giorni')}\n${gPrev(G.last_7d, '7 giorni precedenti')}\n${gline(G.last_30d, 'Ultimi 30 giorni')}\n${gPrev(G.last_30d, '30 giorni precedenti')}`.replace(/\n\n+/g, '\n') : ''

  // Conversione (CRO): CR = ordini Shopify / sessioni GA4, per periodo.
  const GA = d._ga4 || {}
  const crLine = (key, lbl) => {
    const s = shop(key); const sess = Number(GA[key]?.sessions) || null
    return (s && s.o && sess) ? `  ${lbl}: ${(s.o / sess * 100).toFixed(2)}% (${r1(s.o)} ordini / ${r1(sess)} sessioni)` : `  ${lbl}: n/d`
  }
  const hasCR = GA.this_week || GA.this_month || GA.last_30d
  const croBlock = hasCR ? `\n\nCONVERSIONE (CRO):\n${crLine('this_week', 'Questa settimana')}\n${crLine('this_month', 'Questo mese')}\n${crLine('last_30d', 'Ultimi 30 giorni')}` : ''

  // Marginalità (P&L): ricavi netti, COGS, utile lordo, margine — per mese.
  const pnl = d._pnl || {}; const series = pnl.series || []; const cogsBy = pnl.cogsByMonth || {}
  const mRow = key => series.find(s => String(s.month || '').slice(0, 7) === key)
  const marginLine = (key, lbl) => {
    const row = mRow(key); if (!row) return `  ${lbl}: n/d`
    const net = Number(row.netSales) || 0; const c = Number(cogsBy[key]) || 0
    const gp = c ? net - c : null; const mg = (gp != null && net) ? (gp / net * 100) : null
    return `  ${lbl}: ricavi netti ${eur(net)}, ordini ${r1(row.orders)}${gp != null ? `, utile lordo ${eur(gp)}, margine ${r1(mg)}%` : ''}, resi ${eur(row.returns)}`
  }
  const pnlBlock = series.length ? `\n\nMARGINALITÀ (P&L mensile):\n${marginLine(thisMonthK, 'Questo mese')}\n${marginLine(lastMonthK, 'Scorso mese')}` : ''

  const roas = Number(d.metaDetail?.summary?.roas) || 0
  const aov = Number(sh.aovLive) || (P.last_30d?.orders ? P.last_30d.fatturato / P.last_30d.orders : 0)
  const prods = (sh.topProducts || []).slice(0, 5).map(p => p.label || p.product).join(', ')
  const srcs = (sh.marketingSources || []).slice(0, 4).map(s => `${s.label || s.source} (${eur(s.revenue)})`).join(', ')
  const cre = (Array.isArray(d.creatives) ? d.creatives : []).slice(0, 4).map(c => `"${c.name}" ROAS ${c.roas ?? '-'}`).join('; ')

  return `DATI REALI ESATTI del brand (al NETTO dei resi). Usa il numero del time frame ESATTO richiesto, tale e quale.

VENDITE Shopify (fatturato netto · ordini), per periodo:
${sLine('today', 'Oggi')}
${sLine('yesterday', 'Ieri')}
${sLine('this_week', 'Questa settimana (lun→oggi)')}
${sLine('last_week', 'Scorsa settimana (lun→dom)')}
${sLine('this_month', 'Questo mese')}
${sLine('last_month', 'Scorso mese')}
${sLine('last_30d', 'Ultimi 30 giorni')}

SPESA pubblicitaria Meta, per periodo:
${mLine(mw(thisMon) ? Number(mw(thisMon).spend) : null, 'Questa settimana')}
${mLine(mw(lastMon) ? Number(mw(lastMon).spend) : null, 'Scorsa settimana')}
${mLine(monthSpend(thisMonthK), 'Questo mese')}
${mLine(monthSpend(lastMonthK), 'Scorso mese')}
${mLine(m30, 'Ultimi 30 giorni (circa)')}

ALTRI KPI (ultimi ~30 giorni): ROAS Meta ${roas ? roas.toFixed(1) : '-'} · AOV ${eur(aov)} · Sessioni ${ga.sessions ?? '-'}${croBlock}${pnlBlock}${klaviyoBlock}${gscBlock}

Attribuzione — revenue per canale (ultimi ~30 giorni): ${srcs || 'n/d'}
Top prodotti: ${prods || 'n/d'}
Top creative: ${cre || 'n/d'}`
}
