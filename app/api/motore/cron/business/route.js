import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../../lib/motore/db'
import { getShopifyCreds, fetchOrdersByDay, fetchFunnelGiornaliero } from '../../../../../lib/motore/shopify'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300
const day = (d) => d.toISOString().slice(0, 10)

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  if (!ws) return NextResponse.json({ error: 'CE_WORKSPACE_ID mancante' }, { status: 500 })

  const until = new Date(Date.now() - 86400000)
  const since = new Date(until.getTime() - 29 * 86400000)   // 30 giorni: servono per il repeat rate

  try {
    const sc = await getShopifyCreds(ws)
    if (!sc.storeUrl || !sc.adminToken) return NextResponse.json({ error: 'Shopify non collegato' }, { status: 400 })

    const giorni = await fetchOrdersByDay({
      storeUrl: sc.storeUrl, adminToken: sc.adminToken, since: day(since), until: day(until),
    })

    // Funnel e tasso di conversione da ShopifyQL, NON da GA4: sessioni e ordini
    // devono venire dallo stesso sistema, altrimenti si dividono due numeri che
    // contano cose diverse (bot, consenso, attribuzione).
    let funnel = {}, esitoFunnel = 'ok'
    try {
      funnel = await fetchFunnelGiornaliero({
        storeUrl: sc.storeUrl, adminToken: sc.adminToken, since: day(since), until: day(until),
      })
    } catch (e) { esitoFunnel = `errore: ${e.message}` }

    // Spesa pubblicitaria per giorno, dai KPI Meta già ingeriti.
    // PAGINATO: PostgREST tronca a 1.000 righe in silenzio, e con 134 inserzioni
    // per 30 giorni sono ~4.000. Senza paginare la spesa risulta più bassa del
    // vero e MER, CAC e CPO escono tutti sbagliati — sembrando plausibili.
    const spesaMeta = {}
    for (let da = 0; ; da += 1000) {
      const { data, error } = await kpiDi('ce_kpi_daily', 'day, spend')
        .gte('day', day(since)).lte('day', day(until)).range(da, da + 999)
      if (error) throw new Error(error.message)
      for (const k of data || []) spesaMeta[k.day] = (spesaMeta[k.day] || 0) + (+k.spend || 0)
      if (!data || data.length < 1000) break
    }

    const righe = Object.entries(giorni).map(([d, g]) => {
      const meta = spesaMeta[d] || 0
      // ATTENZIONE: Saracino ha ANCHE Google Ads collegato (customer 4589634046)
      // ma non è ancora ingerito. Finché manca, ad_spend_total = solo Meta e il
      // MER risulta PIÙ ALTO del vero. Meglio dichiararlo che gonfiarlo in
      // silenzio: `mer` resta null e si espone `mer_meta` come misura parziale.
      const totNoto = meta
      const f = funnel[d]
      return {
        workspace_id: ws, day: d,
        sessions: f?.sessions ?? null,
        add_to_cart: f?.addToCart ?? null,
        checkout: f?.checkout ?? null,
        conversion_rate: f?.sessions ? +((g.orders / f.sessions) * 100).toFixed(3) : null,
        revenue: +g.revenue.toFixed(2),
        orders: g.orders,
        new_customers: g.new_customers,
        returning_customers: g.returning_customers,
        ad_spend_meta: +totNoto.toFixed(2),
        ad_spend_total: +totNoto.toFixed(2),
        mer: null,
        amer: null,
        cac: g.new_customers ? +(totNoto / g.new_customers).toFixed(2) : null,
        cpo: g.orders ? +(totNoto / g.orders).toFixed(2) : null,
      }
    })

    if (righe.length) {
      const { error } = await db().from('ce_business_daily')
        .upsert(righe, { onConflict: 'workspace_id,day' })
      if (error) throw new Error(error.message)
    }

    const tot = righe.reduce((a, r) => ({
      revenue: a.revenue + r.revenue, orders: a.orders + r.orders,
      nuovi: a.nuovi + r.new_customers, ritorno: a.ritorno + r.returning_customers,
      meta: a.meta + r.ad_spend_meta,
    }), { revenue: 0, orders: 0, nuovi: 0, ritorno: 0, meta: 0 })

    // Il MER si calcola SOLO sui giorni in cui esiste ANCHE la spesa: dividere
    // 30 giorni di fatturato per 7 di spesa dà un numero plausibile e falso.
    const conSpesa = righe.filter(r => r.ad_spend_meta > 0)
    const revSovr = conSpesa.reduce((s, r) => s + r.revenue, 0)
    const spesaSovr = conSpesa.reduce((s, r) => s + r.ad_spend_meta, 0)

    return NextResponse.json({
      ok: true, viaNango: sc.viaNango, store: sc.storeUrl, funnel: esitoFunnel,
      finestra: { since: day(since), until: day(until) }, giorni: righe.length,
      totali: {
        ...tot,
        aov: tot.orders ? +(tot.revenue / tot.orders).toFixed(2) : null,
        repeatRate: (tot.nuovi + tot.ritorno) ? +(tot.ritorno / (tot.nuovi + tot.ritorno)).toFixed(3) : null,
      },
      sovrapposizione: {
        giorniConSpesa: conSpesa.length,
        revenue: +revSovr.toFixed(2), spesaMeta: +spesaSovr.toFixed(2),
        merSoloMeta: spesaSovr ? +(revSovr / spesaSovr).toFixed(2) : null,
      },
      avviso: 'Google Ads è collegato sull account ma non ancora ingerito: il MER reale è più basso di merSoloMeta.',
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'ingest business fallito' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
