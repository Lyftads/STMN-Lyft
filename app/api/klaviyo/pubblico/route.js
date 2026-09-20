export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getKlaviyo } from '../../../../lib/tenant/credentials'
import { rapportoValori } from '../../../../lib/klaviyo/rapporti'
import { FUSO_PREDEFINITO } from '../../../../lib/periodi'

// ============================================================================
//  Dettaglio di un SEGMENTO o di una LISTA.
//
//  Quello che serve per decidere se usarlo in una campagna: quante persone
//  contiene, come si muove nel tempo, in quali campagne e' stato usato e come
//  hanno reso.
//
//  UNA DIFFERENZA CHE NON VA NASCOSTA: una lista ha eventi di iscrizione e
//  cancellazione, quindi la crescita si misura. Un SEGMENTO e' una query viva:
//  le persone entrano ed escono quando cambiano i loro dati, e Klaviyo non
//  registra quei passaggi. Per i segmenti la crescita non esiste come dato, e
//  il pannello lo dice invece di disegnare una riga piatta.
//
//  Multi-cliente: l'id arriva dal client, la chiave di Klaviyo no — la risolve
//  withTenantContext, quindi si legge sempre e solo l'account di chi chiede.
//
//  GET ?id=XXX&tipo=segment|list
// ============================================================================

const BASE = 'https://a.klaviyo.com/api'
const GIORNI_CRESCITA = 90
const GIORNI_CAMPAGNE = 365
// Il fuso serve a Klaviyo per decidere dove finisce un giorno. Nel fork era
// scritto qui; qui viene dal posto unico, che e' un ripiego dichiarato finche'
// il fuso del negozio non e' un'impostazione del cliente (vedi lib/periodi.js).
const FUSO = FUSO_PREDEFINITO

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

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
const r2 = (n) => Math.round((Number(n) || 0) * 100) / 100

// Tutte le pagine di una risorsa: con poche liste basta una, ma i segmenti di
// un account maturo sono decine e troncarli falserebbe l'elenco campagne.
async function tuttePagine(path, max = 6) {
  const out = []
  let url = path
  for (let i = 0; i < max && url; i++) {
    const r = await kget(url)
    if (r.status !== 200) break
    out.push(...(r.body?.data || []))
    const next = r.body?.links?.next
    url = next ? next.replace(BASE, '') : null
  }
  return out
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const sp = new URL(req.url).searchParams
    const id = sp.get('id')
    const tipo = sp.get('tipo') === 'list' ? 'list' : 'segment'
    if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

    const k = getKlaviyo()
    if (!k?.apiKey) return NextResponse.json({ ok: false, error: 'Klaviyo non collegato' }, { status: 200 })

    // 1. Anagrafica e conteggio. Il conteggio esiste solo sulla risorsa
    //    SINGOLA: sull'elenco Klaviyo lo rifiuta.
    const risorsa = tipo === 'list'
      ? await kget(`/lists/${encodeURIComponent(id)}?additional-fields%5Blist%5D=profile_count`)
      : await kget(`/segments/${encodeURIComponent(id)}?additional-fields%5Bsegment%5D=profile_count`)
    if (risorsa.status !== 200 || !risorsa.body?.data) {
      return NextResponse.json({ ok: false, error: 'Non trovato su Klaviyo' }, { status: 200 })
    }
    const att = risorsa.body.data.attributes || {}
    const nome = att.name || id

    // 2. Campagne che lo hanno usato. L'informazione sta sulla campagna, non
    //    sul segmento: si scorrono le campagne e si guarda il pubblico.
    const campagne = await tuttePagine(`/campaigns?filter=${encodeURIComponent("equals(messages.channel,'email')")}`)
    const usato = []
    for (const c of campagne) {
      const a = c.attributes?.audiences || {}
      const incluso = (a.included || []).includes(id)
      const escluso = (a.excluded || []).includes(id)
      if (!incluso && !escluso) continue
      usato.push({
        id: c.id,
        nome: c.attributes?.name || c.id,
        stato: c.attributes?.status || null,
        inviata: c.attributes?.send_time || c.attributes?.scheduled_at || c.attributes?.created_at || null,
        incluso,
      })
    }
    usato.sort((a, b) => String(b.inviata || '').localeCompare(String(a.inviata || '')))

    // 3. Statistiche delle campagne. Stessa fonte della tab (report per
    //    campagna), su una finestra larga: una campagna che ha usato questo
    //    pubblico puo' essere di mesi fa.
    const metriche = await tuttePagine('/metrics')
    const placedOrder = metriche.find(m =>
      String(m.attributes?.name || '').toLowerCase() === 'placed order' &&
      String(m.attributes?.integration?.key || '') === 'shopify'
    ) || metriche.find(m => String(m.attributes?.name || '').toLowerCase() === 'placed order')

    const oggi = new Date()
    const inizio = new Date(oggi.getTime() - GIORNI_CAMPAGNE * 86400000)
    let statistiche = new Map()
    let statisticheErrore = null
    if (placedOrder?.id && usato.length) {
      const rep = await rapportoValori('campaign', {
        statistics: ['recipients', 'open_rate', 'click_rate', 'conversions', 'conversion_value', 'unsubscribes', 'bounced'],
        start: inizio.toISOString().slice(0, 10), end: oggi.toISOString().slice(0, 10), conversionMetricId: placedOrder.id,
      })
      if (rep.status === 200) {
        for (const riga of (rep.body?.data?.attributes?.results || [])) {
          const idc = riga.groupings?.campaign_id
          if (!idc) continue
          const s = riga.statistics || {}
          const gia = statistiche.get(idc) || { destinatari: 0, aperture: 0, click: 0, ordini: 0, entrate: 0, disiscritti: 0 }
          // I report tornano una riga per messaggio: si somma, e i tassi si
          // ricalcolano dai valori assoluti invece di fare medie di medie.
          gia.destinatari += num(s.recipients)
          gia.aperture += num(s.open_rate) * num(s.recipients)
          gia.click += num(s.click_rate) * num(s.recipients)
          gia.ordini += num(s.conversions)
          gia.entrate += num(s.conversion_value)
          gia.disiscritti += num(s.unsubscribes)
          statistiche.set(idc, gia)
        }
      } else {
        statisticheErrore = `report non disponibile (${rep.status})`
      }
    } else if (!placedOrder?.id) {
      statisticheErrore = 'metrica Placed Order non trovata'
    }

    const righe = usato.map(c => {
      const s = statistiche.get(c.id) || null
      const dest = s?.destinatari || 0
      return {
        ...c,
        destinatari: dest || null,
        aperturePct: dest > 0 ? r2((s.aperture / dest) * 100) : null,
        clickPct: dest > 0 ? r2((s.click / dest) * 100) : null,
        ordini: s ? Math.round(s.ordini) : null,
        entrate: s ? r2(s.entrate) : null,
        entratePerDestinatario: dest > 0 ? r2(s.entrate / dest) : null,
        disiscritti: s ? Math.round(s.disiscritti) : null,
      }
    })

    const somma = righe.reduce((a, r) => ({
      destinatari: a.destinatari + (r.destinatari || 0),
      ordini: a.ordini + (r.ordini || 0),
      entrate: a.entrate + (r.entrate || 0),
      aperture: a.aperture + ((r.aperturePct || 0) / 100) * (r.destinatari || 0),
      click: a.click + ((r.clickPct || 0) / 100) * (r.destinatari || 0),
      disiscritti: a.disiscritti + (r.disiscritti || 0),
    }), { destinatari: 0, ordini: 0, entrate: 0, aperture: 0, click: 0, disiscritti: 0 })

    const totali = {
      campagne: righe.length,
      destinatari: somma.destinatari,
      aperturePct: somma.destinatari > 0 ? r2((somma.aperture / somma.destinatari) * 100) : null,
      clickPct: somma.destinatari > 0 ? r2((somma.click / somma.destinatari) * 100) : null,
      ordini: somma.ordini,
      entrate: r2(somma.entrate),
      entratePerDestinatario: somma.destinatari > 0 ? r2(somma.entrate / somma.destinatari) : null,
      disiscritti: somma.disiscritti,
    }

    // 4. Crescita: SOLO per le liste, e solo perche' esistono gli eventi.
    //    Il raggruppamento di Klaviyo e' per NOME della lista, non per id.
    let crescita = null
    let crescitaNota = null
    if (tipo === 'list') {
      const voci = [
        ['iscritti', 'Subscribed to List'],
        ['aggiunti', 'Added to List'],
        ['disiscritti', 'Unsubscribed from List'],
        ['rimossi', 'Removed from List'],
      ]
      const da = new Date(oggi.getTime() - GIORNI_CRESCITA * 86400000).toISOString().slice(0, 10)
      const a = oggi.toISOString().slice(0, 10)
      const perGiorno = new Map()
      let qualcosa = false
      for (const [chiave, nomeMetrica] of voci) {
        const m = metriche.find(x => String(x.attributes?.name || '') === nomeMetrica)
        if (!m?.id) continue
        const agg = await kpost('/metric-aggregates', {
          data: { type: 'metric-aggregate', attributes: {
            metric_id: m.id, measurements: ['count'], interval: 'day', by: ['List'],
            filter: [`greater-or-equal(datetime,${da})`, `less-than(datetime,${a})`],
            timezone: FUSO,
          } },
        })
        if (agg.status !== 200) continue
        const date = (agg.body?.data?.attributes?.dates || []).map(x => String(x).slice(0, 10))
        for (const gruppo of (agg.body?.data?.attributes?.data || [])) {
          // Il gruppo porta il NOME della lista: si tiene solo il nostro.
          if (String(gruppo.dimensions?.[0] || '') !== nome) continue
          const serie = gruppo.measurements?.count || []
          serie.forEach((v, i) => {
            const g = date[i]
            if (!g) return
            if (!perGiorno.has(g)) perGiorno.set(g, { giorno: g, iscritti: 0, aggiunti: 0, disiscritti: 0, rimossi: 0 })
            perGiorno.get(g)[chiave] += num(v)
            if (num(v) > 0) qualcosa = true
          })
        }
      }
      crescita = [...perGiorno.values()].sort((a, b) => a.giorno.localeCompare(b.giorno))
      if (!qualcosa) crescitaNota = 'nessun movimento registrato nel periodo'
    } else {
      crescitaNota = 'segmento'
    }

    return NextResponse.json({
      ok: true,
      pubblico: {
        id, tipo, nome,
        profili: att.profile_count ?? null,
        creato: att.created || null,
        aggiornato: att.updated || null,
      },
      totali,
      campagne: righe,
      crescita,
      crescitaNota,
      statisticheErrore,
      ...(statisticheErrore && /\(429/.test(statisticheErrore) ? { inRitardo: ['statistiche'], riprovaTraS: 20 } : {}),
      periodoCrescita: GIORNI_CRESCITA,
      periodoCampagne: GIORNI_CAMPAGNE,
    })
  })
}
