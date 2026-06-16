export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../../lib/tenant/credentials'
import { callBrain } from '../../../../lib/agent/gateway'
import { buildBrandContext } from '../../../../lib/tenant/brand'

// ── Insight & raccomandazioni proattive sui clienti (RFM) ───────────────────
// Riceve dal client il riassunto dei segmenti/KPI (niente liste clienti) e
// restituisce insight descrittivi + azioni proattive nel tono del brand e nella
// lingua del cliente. Read-only sull'AI. Multi-tenant via withTenantContext.

const SEG_KEYS = ['new', 'potentialLoyal', 'loyal', 'loyalAtRisk', 'aboutToSleep', 'sleepers']

const SKILL = {
  id: 'customer-insights',
  temperature: 0.5,
  json: true,
  systemPrompt: 'Sei un consulente CRM/retention senior per un brand DTC. Analizzi i segmenti RFM dei clienti (Nuovi, Potenziali fedeli, Fedeli, Fedeli a rischio, Stanno per dormire, Dormienti) e i KPI. Rispondi SOLO con JSON valido: {"headline":"...","insights":[{"title":"...","detail":"...","tone":"good|warn|info"}],"recommendations":[{"segment":"<chiave>","title":"...","action":"...","why":"...","impact":"...","priority":"alta|media|bassa"}]}. Regole: usa SOLO i numeri forniti nei DATI (mai inventarli), cita cifre concrete (clienti, €, giorni, %), sii diretto e azionabile. "segment" DEVE essere una di: new, potentialLoyal, loyal, loyalAtRisk, aboutToSleep, sleepers. Max 4 insight e max 4 recommendations, ordinate per priorità/valore recuperabile. Niente emoji, niente markdown.',
}

export async function POST(req) {
  return withTenantContext(req, async () => {
    let body = {}
    try { body = await req.json() } catch {}
    const kpis = body.kpis || {}
    const segments = body.segments || {}
    const currency = body.currency || 'EUR'
    const locale = body.locale || null

    // Compatta i dati per il modello (solo metriche, niente PII/liste).
    const segData = {}
    for (const key of SEG_KEYS) {
      const s = segments[key]
      if (!s) continue
      segData[key] = {
        clienti: s.count, valore_medio: s.customerValue, ordini_medi: s.avgOrders,
        giorni_tra_ordini: s.daysBetween, scontrino_medio: s.aov, vendite_totali: s.totalSales,
      }
    }

    try {
      const brandContext = await buildBrandContext()
      const { parsed, content } = await callBrain({
        skill: SKILL,
        conversation: false,
        locale,
        extraSystem: [brandContext],
        query: 'Insight e raccomandazioni proattive sui segmenti clienti',
        data: {
          valuta: currency,
          kpi: {
            clienti_totali: kpis.totalCustomers, nuovi: kpis.firstTime, di_ritorno: kpis.returning,
            retention_pct: kpis.retention, clv: kpis.clv, scontrino_medio: kpis.aov,
            ordini_per_cliente: kpis.ordersPerCustomer, giorni_tra_ordini: kpis.daysBetween,
          },
          segmenti: segData,
        },
        dataLabel: 'DATI CLIENTI (RFM):',
      })
      const out = parsed || {}
      if (!out.insights && !out.recommendations) {
        return NextResponse.json({ ok: false, error: 'Generazione non riuscita', raw: content?.slice(0, 400) }, { status: 200 })
      }
      // Filtra recommendations con segment valido
      const recommendations = (out.recommendations || []).filter(r => SEG_KEYS.includes(r.segment))
      return NextResponse.json({ ok: true, headline: out.headline || '', insights: out.insights || [], recommendations })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e?.message || 'Errore generazione' }, { status: 200 })
    }
  })
}
