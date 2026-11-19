import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { getGoogleCreds, accessToken, fetchGa4Daily, fetchGoogleAdsSpendDaily } from '../../../../../lib/motore/google'
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
  const GIORNI = Number(process.env.CE_FINESTRA_GIORNI || 30)
  const until = new Date(Date.now() - 86400000)
  const since = new Date(until.getTime() - (GIORNI - 1) * 86400000)

  const esito = { ga4: null, ads: null }
  try {
    const g = await getGoogleCreds(ws)
    const token = await accessToken(g)
    if (!token) return NextResponse.json({ error: 'Google non collegato (client id/secret o refresh token mancanti)' }, { status: 400 })

    // I due pezzi sono INDIPENDENTI: se Google Ads fallisce (developer token,
    // permessi MCC) non deve buttare via anche il tasso di conversione GA4.
    let ga4 = {}, ads = {}
    if (g.ga4PropertyId) {
      try { ga4 = await fetchGa4Daily({ token, propertyId: g.ga4PropertyId, since: day(since), until: day(until) })
            esito.ga4 = `${Object.keys(ga4).length} giorni` }
      catch (e) { esito.ga4 = `errore: ${e.message}` }
    } else esito.ga4 = 'property GA4 non impostata'

    if (g.adsCustomerId && g.developerToken) {
      try { ads = await fetchGoogleAdsSpendDaily({ token, developerToken: g.developerToken,
              customerId: g.adsCustomerId, mccId: g.adsMccId, since: day(since), until: day(until) })
            esito.ads = `${Object.keys(ads).length} giorni` }
      catch (e) { esito.ads = `errore: ${e.message}` }
    } else esito.ads = g.developerToken ? 'customer id assente' : 'GOOGLE_ADS_DEVELOPER_TOKEN mancante'

    // Aggiorna le righe business già scritte da /api/cron/business.
    const { data: righe, error } = await db().from('ce_business_daily')
      .select('*').eq('workspace_id', ws).gte('day', day(since)).lte('day', day(until))
    if (error) throw new Error(error.message)

    const patch = []
    for (const r of righe || []) {
      const meta = +r.ad_spend_meta || 0
      const google = ads[r.day] ?? null
      // ad_spend_total include Google SOLO se il dato è arrivato davvero:
      // sommare uno zero finto farebbe sembrare il MER migliore del vero.
      const tot = google == null ? meta : meta + google
      const rev = +r.revenue || 0
      patch.push({
        workspace_id: ws, day: r.day,
        ad_spend_google: google,
        ad_spend_total: +tot.toFixed(2),
        // Il tasso di conversione NON si tocca qui: arriva da ShopifyQL in
        // /api/cron/business, dove sessioni e ordini vengono dallo stesso
        // sistema. GA4 resta fuori dal calcolo del CR.
        mer: tot ? +(rev / tot).toFixed(2) : null,
        cac: r.new_customers ? +(tot / r.new_customers).toFixed(2) : null,
        cpo: r.orders ? +(tot / r.orders).toFixed(2) : null,
      })
    }
    if (patch.length) {
      const { error: uErr } = await db().from('ce_business_daily').upsert(patch, { onConflict: 'workspace_id,day' })
      if (uErr) throw new Error(uErr.message)
    }

    const conTot = patch.filter(p => p.mer != null)
    const sum = (f) => conTot.reduce((a, p) => a + (+p[f] || 0), 0)
    const rev = (righe || []).filter(r => conTot.find(p => p.day === r.day)).reduce((a, r) => a + (+r.revenue || 0), 0)
    return NextResponse.json({
      ok: true, esito, giorniAggiornati: patch.length,
      spesaGoogle: +sum('ad_spend_google').toFixed(2),
      spesaTotale: +sum('ad_spend_total').toFixed(2),
      merReale: sum('ad_spend_total') ? +(rev / sum('ad_spend_total')).toFixed(2) : null,
    })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'ingest google fallito', esito }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
