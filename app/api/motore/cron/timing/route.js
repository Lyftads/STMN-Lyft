import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { getShopifyCreds, fetchTiming, fusoNegozio, fetchSessioniPerOra } from '../../../../../lib/motore/shopify'
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
  // Finestra più lunga della solita: per stabilizzare un pattern settimanale
  // servono più ripetizioni dello stesso giorno. Con 30 giorni ogni lunedì
  // pesa per 4 osservazioni, ed è il minimo per non leggere il caso.
  const GIORNI = Number(process.env.CE_FINESTRA_TIMING || 90)
  const until = new Date(Date.now() - 86400000)
  const since = new Date(until.getTime() - (GIORNI - 1) * 86400000)

  try {
    const sc = await getShopifyCreds(ws)
    if (!sc.storeUrl || !sc.adminToken) return NextResponse.json({ error: 'Shopify non collegato' }, { status: 400 })
    const fuso = await fusoNegozio(sc)
    const t = await fetchTiming({ ...sc, since: day(since), until: day(until), fuso })

    // Sessioni orarie da ShopifyQL: stesso sistema degli ordini, quindi il CR
    // orario è un rapporto fra numeri confrontabili.
    let sessOra = {}, esitoSess = 'ok'
    try {
      sessOra = await fetchSessioniPerOra({ ...sc, since: day(since), until: day(until) })
    } catch (e) { esitoSess = `errore: ${e.message}` }

    const righe = []
    for (const [v, d] of Object.entries(t.giorni)) {
      righe.push({ workspace_id: ws, dimensione: 'giorno', valore: +v, orders: d.orders, revenue: +d.revenue.toFixed(2), aggiornato: new Date().toISOString() })
    }
    for (const [v, d] of Object.entries(t.ore)) {
      const sess = sessOra[+v] ?? null
      righe.push({ workspace_id: ws, dimensione: 'ora', valore: +v, orders: d.orders, revenue: +d.revenue.toFixed(2),
        sessions: sess, conversion_rate: sess ? +((d.orders / sess) * 100).toFixed(3) : null,
        aggiornato: new Date().toISOString() })
    }
    if (righe.length) {
      const { error } = await db().from('ce_timing').upsert(righe, { onConflict: 'workspace_id,dimensione,valore' })
      if (error) throw new Error(error.message)
    }
    return NextResponse.json({ ok: true, fuso, giorniAnalizzati: GIORNI, righe: righe.length, sessioni: esitoSess })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'timing fallito' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
