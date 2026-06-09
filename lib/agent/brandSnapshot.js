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
    const p = P[key]; return (p && (p.orders || p.fatturato)) ? { f: p.fatturato, o: p.orders } : null
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

ALTRI KPI (ultimi ~30 giorni): ROAS Meta ${roas ? roas.toFixed(1) : '-'} · AOV ${eur(aov)} · Sessioni ${ga.sessions ?? '-'}${klaviyoBlock}${gscBlock}

Top prodotti: ${prods || 'n/d'}
Fonti di traffico: ${srcs || 'n/d'}
Top creative: ${cre || 'n/d'}`
}
