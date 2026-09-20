export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getKlaviyo } from '../../../../lib/tenant/credentials'
import { rapportoValori } from '../../../../lib/klaviyo/rapporti'

// ============================================================================
//  Come e' andata UNA newsletter: consegna, aperture, clic per singolo link,
//  provider di posta, spam, rimbalzi, disiscrizioni.
//
//  Fonte dei TOTALI: il report per campagna, lo stesso da cui Klaviyo ricava
//  i numeri della sua interfaccia. Verificato riga per riga su un invio reale:
//  27 destinatari, 27 consegnate, 13 aperture uniche, 3 clic unici, 1
//  disiscritto, 0 spam — identici a quelli mostrati da Klaviyo.
//
//  Fonte del DETTAGLIO (link e client): gli aggregati per metrica, filtrati
//  sull'ID DELLA CAMPAGNA. Sembra debba essere quello del messaggio e invece
//  no: con il messaggio tornava zero ovunque.
//
//  COSA NON C'E', e non per pigrizia:
//  - il PAESE non e' una dimensione raggruppabile su queste metriche;
//  - il dettaglio PER DESTINATARIO (chi ha aperto, chi ha cliccato) sta negli
//    eventi singoli, che richiedono lo scope `events:read`.
//  Entrambi vengono dichiarati nella risposta invece di essere omessi in
//  silenzio: un dato assente e un dato a zero non sono la stessa cosa.
//
//  GET ?id=CAMPAIGN_ID
// ============================================================================

const BASE = 'https://a.klaviyo.com/api'
// Un anno: oltre, il report per campagna puo essere rifiutato.
const GIORNI = 365

const intestazioni = () => {
  const k = getKlaviyo()
  const token = k.apiKey || ''
  return {
    Authorization: k.isOAuth ? `Bearer ${token}` : `Klaviyo-API-Key ${token}`,
    accept: 'application/json',
    revision: '2024-10-15',
  }
}

async function kget(path) {
  try {
    const res = await fetch(`${BASE}${path}`, { headers: intestazioni(), cache: 'no-store', signal: AbortSignal.timeout(15000) })
    return { status: res.status, body: await res.json().catch(() => null) }
  } catch { return { status: 0, body: null } }
}

async function kpost(path, corpo) {
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST', cache: 'no-store', signal: AbortSignal.timeout(25000),
      headers: { ...intestazioni(), 'content-type': 'application/json' },
      body: JSON.stringify(corpo),
    })
    return { status: res.status, body: await res.json().catch(() => null) }
  } catch { return { status: 0, body: null } }
}

const somma = (g) => (g?.measurements?.count || []).reduce((a, b) => a + (Number(b) || 0), 0)

export async function GET(req) {
  return withTenantContext(req, async () => {
    const sp = new URL(req.url).searchParams
    // Per un'email di flusso l'id e' quello del MESSAGGIO: i totali stanno nel
    // rapporto dei flussi e gli eventi si filtrano su quel messaggio.
    const flowMessage = sp.get('flowMessage')
    const id = flowMessage || sp.get('id')
    if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })
    const k = getKlaviyo()
    if (!k?.apiKey) return NextResponse.json({ ok: false, error: 'Klaviyo non collegato' }, { status: 200 })

    const metriche = await kget('/metrics')
    const perNome = new Map()
    for (const m of (metriche.body?.data || [])) {
      const n = String(m.attributes?.name || '')
      if (n && !perNome.has(n)) perNome.set(n, m.id)
    }
    const placedOrder = (metriche.body?.data || []).find(m =>
      String(m.attributes?.name || '').toLowerCase() === 'placed order')

    const oggi = new Date()
    // Il report accetta AL MASSIMO un anno e rifiuta le date future: con la
    // fine a domani rispondeva 400 e i totali restavano vuoti. Gli aggregati
    // invece accettano il giorno dopo, e serve per includere oggi.
    const da = new Date(oggi.getTime() - (GIORNI - 1) * 86400000).toISOString().slice(0, 10)
    const aReport = oggi.toISOString().slice(0, 10)
    const a = new Date(oggi.getTime() + 86400000).toISOString().slice(0, 10)

    // ── I totali vengono dal REPORT PER CAMPAGNA ──────────────────────────
    // E' la stessa fonte dei numeri che Klaviyo mostra nella sua interfaccia:
    // verificato, su una campagna reale torna 27 destinatari, 27 consegnate,
    // 13 aperture uniche, 3 clic unici, 1 disiscritto. Gli aggregati per
    // metrica servono solo per il DETTAGLIO (link e client).
    let base = null
    let avviso = null
    let inRitardo = null   // Klaviyo ha detto "riprova": il client non tiene la risposta e riprova da solo
    if (!placedOrder?.id) avviso = 'metrica Placed Order non trovata su Klaviyo'
    if (placedOrder?.id) {
      // Il rapporto torna TUTTE le campagne (o tutti i messaggi dei flussi) e qui se ne tiene
      // una riga: rifarlo a ogni email aperta portava dritti al 429. Dalla porta unica vale
      // 30 minuti per tutte le email e per tutti.
      const rep = await rapportoValori(flowMessage ? 'flow' : 'campaign', {
        statistics: ['recipients', 'delivered', 'bounced', 'spam_complaints', 'unsubscribes',
                     'opens_unique', 'clicks_unique', 'conversions', 'conversion_value'],
        start: da, end: aReport, conversionMetricId: placedOrder.id,
      })
      if (rep.status === 429) inRitardo = { traS: rep.riprovaTraS || 15 }
      if (rep.status !== 200) {
        avviso = `report per campagna non disponibile (${rep.status}${rep.body?.errors?.[0]?.detail ? ': ' + String(rep.body.errors[0].detail).slice(0, 90) : ''})`
      }
      if (rep.status === 200) {
        for (const riga of (rep.body?.data?.attributes?.results || [])) {
          if ((flowMessage ? riga.groupings?.flow_message_id : riga.groupings?.campaign_id) !== id) continue
          const st = riga.statistics || {}
          if (!base) base = { recipients: 0, delivered: 0, bounced: 0, spam: 0, unsub: 0, apriUnici: 0, clicUnici: 0, ordini: 0, entrate: 0 }
          base.recipients += Number(st.recipients || 0)
          base.delivered += Number(st.delivered || 0)
          base.bounced += Number(st.bounced || 0)
          base.spam += Number(st.spam_complaints || 0)
          base.unsub += Number(st.unsubscribes || 0)
          base.apriUnici += Number(st.opens_unique || 0)
          base.clicUnici += Number(st.clicks_unique || 0)
          base.ordini += Number(st.conversions || 0)
          base.entrate += Number(st.conversion_value || 0)
        }
      }
    }

    // ── Il dettaglio: gli eventi si filtrano sull'ID DELLA CAMPAGNA ───────
    // NON sull'id del messaggio. Sembra il contrario e infatti ci sono
    // cascato: filtrando per messaggio tornava zero ovunque e le schede
    // erano vuote, mentre la campagna aveva 27 invii e 3 clic.
    const finestra = [`greater-or-equal(datetime,${da})`, `less-than(datetime,${a})`, `equals($message,"${id}")`]
    const aggrega = async (nomeMetrica, by) => {
      const metricId = perNome.get(nomeMetrica)
      if (!metricId) return null
      const r = await kpost('/metric-aggregates', {
        data: { type: 'metric-aggregate', attributes: {
          metric_id: metricId, measurements: ['count'], interval: 'month',
          ...(by ? { by: [by] } : {}), filter: finestra, timezone: 'Europe/Rome',
        } },
      })
      if (r.status !== 200) return null
      return r.body?.data?.attributes?.data || []
    }
    const totale = (dati) => (dati || []).reduce((acc, g) => acc + somma(g), 0)

    // In sequenza e non in parallelo: Klaviyo strozza le richieste ravvicinate
    // e con cinque chiamate insieme tornavano 429 e schede a zero.
    const perUrl = await aggrega('Clicked Email', 'URL')
    const perClient = await aggrega('Clicked Email', 'Client Name')
    const apertureTotali = await aggrega('Opened Email')
    const clicTotali = await aggrega('Clicked Email')

    const link = (perUrl || []).map(g => ({
      url: String(g.dimensions?.[0] || ''), clic: somma(g),
    })).filter(x => x.url && x.clic > 0).sort((a, b) => b.clic - a.clic)
    const clicSuLink = link.reduce((s, l) => s + l.clic, 0)
    for (const l of link) l.quota = clicSuLink > 0 ? Math.round((l.clic / clicSuLink) * 1000) / 10 : 0

    const pct = (parte, tutto) => tutto > 0 ? Math.round((parte / tutto) * 1000) / 10 : null
    const consegnate = base?.delivered ?? 0

    if (!base && !avviso) avviso = flowMessage ? 'questa email non ha invii nel periodo' : 'questa campagna non compare nel report del periodo'

    return NextResponse.json({
      ok: true,
      campagna: id,
      avviso,
      // Solo quando Klaviyo ha chiesto di aspettare: `leggi` non tiene in memoria le risposte
      // con inRitardo, e il pop-up riprova da solo dopo `traS` secondi.
      ...(inRitardo ? { inRitardo: ['statistiche'], riprovaTraS: inRitardo.traS } : {}),
      consegna: {
        destinatari: base?.recipients ?? null,
        consegnate: base?.delivered ?? null,
        rimbalzi: base?.bounced ?? null,
        // Quante PERSONE, non quanti eventi: sono due numeri diversi e in
        // pagina vanno etichettati come tali.
        aperturePersone: base?.apriUnici ?? null,
        aperturePct: pct(base?.apriUnici, consegnate),
        apertureTotali: totale(apertureTotali) || null,
        clicPersone: base?.clicUnici ?? null,
        clicPct: pct(base?.clicUnici, consegnate),
        clicTotali: totale(clicTotali) || null,
        clicSuAperture: pct(base?.clicUnici, base?.apriUnici),
        clicPerPersona: base?.clicUnici > 0 ? Math.round((totale(clicTotali) / base.clicUnici) * 10) / 10 : null,
        nonHannoCliccato: consegnate > 0 ? consegnate - (base?.clicUnici || 0) : null,
        ordini: base?.ordini ?? null,
        entrate: base?.entrate != null ? Math.round(base.entrate * 100) / 100 : null,
        entratePerDestinatario: consegnate > 0 ? Math.round((base.entrate / consegnate) * 100) / 100 : null,
        disiscritti: base?.unsub ?? null,
        disiscrittiPct: pct(base?.unsub, consegnate),
        spam: base?.spam ?? null,
        spamPct: pct(base?.spam, consegnate),
      },
      link,
      clientClic: (perClient || []).map(g => ({
        client: String(g.dimensions?.[0] || '').trim() || null, valore: somma(g),
      })).filter(x => x.valore > 0).sort((a, b) => b.valore - a.valore),
      nonDisponibile: {
        paesi: 'Klaviyo non espone il paese come dimensione di queste metriche',
        destinatari: 'il dettaglio per singolo destinatario richiede lo scope events:read',
      },
      periodoGiorni: GIORNI,
    })
  })
}
