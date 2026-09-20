export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getKlaviyo } from '../../../../lib/tenant/credentials'
import { rapportoValori } from '../../../../lib/klaviyo/rapporti'

// ============================================================================
//  La MAPPA di un flusso: cosa c'e' dentro, in che ordine, con quali rami.
//
//  L'elenco dei passi (`/flows/{id}/flow-actions`) non basta: dice che ci sono
//  due attese e tre email, non in che ordine ne' dove il flusso si biforca.
//  L'ordine sta nella DEFINIZIONE del flusso, che Klaviyo espone solo dalle
//  revisioni recenti dell'API (verificato: 2025-04-15) come campo aggiuntivo:
//  ogni passo porta i suoi legami — `next`, oppure `next_if_true` e
//  `next_if_false` per una suddivisione.
//
//  Le statistiche per singola email vengono dal rapporto dei flussi, che
//  raggruppa gia' per messaggio. Verificato: aggiungendo un filtro sul flusso
//  la risposta e' 200 ma VUOTA, quindi si chiede tutto e si filtra qui.
//
//  La chiave di Klaviyo e' quella del cliente della richiesta: la risolve
//  withTenantContext, e getKlaviyo() la legge dal contesto. Nessun workspace
//  fisso — l'id del flusso arriva dal client, ma le credenziali no.
//
//  GET ?id=FLOW_ID&days=30
// ============================================================================

const BASE = 'https://a.klaviyo.com/api'
const REV_DEFINIZIONE = '2025-04-15'
const attendi = (ms) => new Promise(r => setTimeout(r, ms))
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : 0 }

const intestazioni = (revision = '2024-10-15') => {
  const k = getKlaviyo()
  return { Authorization: k.isOAuth ? `Bearer ${k.apiKey}` : `Klaviyo-API-Key ${k.apiKey}`, accept: 'application/json', revision }
}
async function kget(path, revision) {
  try {
    const r = await fetch(`${BASE}${path}`, { headers: intestazioni(revision), cache: 'no-store', signal: AbortSignal.timeout(20000) })
    return { status: r.status, body: await r.json().catch(() => null) }
  } catch { return { status: 0, body: null } }
}

// L'attesa, detta come la direbbe una persona.
function descriviAttesa(d = {}) {
  const UNITA = { minutes: ['minuto', 'minuti'], hours: ['ora', 'ore'], days: ['giorno', 'giorni'], weeks: ['settimana', 'settimane'] }
  const v = num(d.value)
  const u = UNITA[d.unit] || [d.unit || '', d.unit || '']
  let testo = `Aspetta ${v} ${v === 1 ? u[0] : u[1]}`
  const GIORNI = { monday: 'lun', tuesday: 'mar', wednesday: 'mer', thursday: 'gio', friday: 'ven', saturday: 'sab', sunday: 'dom' }
  const quando = []
  if (Array.isArray(d.delay_until_weekdays) && d.delay_until_weekdays.length && d.delay_until_weekdays.length < 7) {
    quando.push(d.delay_until_weekdays.map(g => GIORNI[g] || g).join(', '))
  }
  if (d.delay_until_time) quando.push(`alle ${String(d.delay_until_time).slice(0, 5)}`)
  return { testo, dettaglio: quando.length ? `poi fino a ${quando.join(' ')}` : null }
}
const inGiorni = (d = {}) => {
  const v = num(d.value)
  return d.unit === 'minutes' ? v / 1440 : d.unit === 'hours' ? v / 24 : d.unit === 'weeks' ? v * 7 : v
}

// Una condizione, riassunta. Non le copre tutte: quando non la riconosce lo
// dice in modo generico invece di inventare una frase.
function descriviCondizione(filtro, nomiMetriche) {
  try {
    const c = filtro?.condition_groups?.[0]?.conditions?.[0]
    if (!c) return 'Condizione sul profilo'
    if (c.type === 'profile-metric') {
      const nome = nomiMetriche.get(c.metric_id) || 'un evento'
      const f = c.measurement_filter || {}
      const OP = { equals: 'esattamente', 'greater-than': 'più di', 'less-than': 'meno di', 'greater-than-or-equal': 'almeno', 'less-than-or-equal': 'al massimo' }
      const quante = f.value === 0 && f.operator === 'equals' ? 'zero volte' : `${OP[f.operator] || f.operator || ''} ${f.value ?? ''} volte`.trim()
      const da = c.timeframe_filter?.type === 'date' && /flow-start/.test(JSON.stringify(c.timeframe_filter)) ? ' dall’avvio del flusso' : ''
      return `Ha fatto «${nome}» ${quante}${da}`
    }
    if (c.type === 'profile-property') return `Proprietà del profilo: ${c.property || ''}`.trim()
    if (c.type === 'profile-group-membership') return 'Appartenenza a una lista o a un segmento'
    return 'Condizione sul profilo'
  } catch { return 'Condizione sul profilo' }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    if (!getKlaviyo()?.apiKey) return NextResponse.json({ ok: false, error: 'Klaviyo non collegato' }, { status: 200 })
    const sp = new URL(req.url).searchParams
    const id = sp.get('id')
    const giorni = Math.min(365, Math.max(1, parseInt(sp.get('days') || '30', 10) || 30))
    if (!id) return NextResponse.json({ ok: false, error: 'id mancante' }, { status: 400 })

    const fl = await kget(`/flows/${encodeURIComponent(id)}?additional-fields%5Bflow%5D=definition`, REV_DEFINIZIONE)
    if (fl.status !== 200 || !fl.body?.data) {
      return NextResponse.json({ ok: false, error: fl.body?.errors?.[0]?.detail || `Klaviyo ha risposto ${fl.status}` }, { status: 200 })
    }
    const att = fl.body.data.attributes || {}
    const def = att.definition
    if (!def?.actions) return NextResponse.json({ ok: false, error: 'Klaviyo non ha restituito la struttura di questo flusso' }, { status: 200 })

    // I nomi delle metriche: servono per dire "Added to Cart" invece di "Tbevke".
    const metriche = await kget('/metrics')
    const nomiMetriche = new Map((metriche.body?.data || []).map(m => [m.id, m.attributes?.name]))
    const placedOrder = (metriche.body?.data || []).find(m => String(m.attributes?.name || '').toLowerCase() === 'placed order')

    // ── L'innesco ────────────────────────────────────────────────────────
    const tr = (def.triggers || [])[0] || {}
    const TIPI = { metric: 'Quando una persona fa', list: 'Quando una persona entra nella lista', segment: 'Quando una persona entra nel segmento', date: 'In base a una data del profilo', 'price-drop': 'Quando cala il prezzo di un prodotto visto', 'low-inventory': 'Quando un prodotto sta per finire' }
    const innesco = {
      testo: tr.type === 'metric' ? `${TIPI.metric} «${nomiMetriche.get(tr.id) || tr.id}»` : (TIPI[tr.type] || att.trigger_type || 'Innesco'),
      filtriEvento: !!tr.trigger_filter,
      filtriProfilo: !!def.profile_filter,
    }

    // ── Statistiche per singola email ────────────────────────────────────
    const oggi = new Date()
    const da = new Date(oggi.getTime() - (giorni - 1) * 86400000).toISOString().slice(0, 10)
    const a = oggi.toISOString().slice(0, 10)
    const perMessaggio = new Map()
    let avvisoStatistiche = null
    let diagnostica = null
    if (!placedOrder?.id) avvisoStatistiche = 'metrica Placed Order non trovata'
    else {
      const rep = await rapportoValori('flow', {
        statistics: ['recipients', 'delivered', 'opens_unique', 'open_rate', 'clicks_unique', 'click_rate', 'conversions', 'conversion_value', 'unsubscribes'],
        start: da, end: a, conversionMetricId: placedOrder.id,
      })
      if (rep.status !== 200) avvisoStatistiche = `rapporto dei flussi non disponibile (${rep.status}${rep.body?.errors?.[0]?.detail ? ': ' + String(rep.body.errors[0].detail).slice(0, 80) : ''})`
      const righeRapporto = rep.body?.data?.attributes?.results || []
      diagnostica = {
        righe: righeRapporto.length,
        diQuestoFlusso: righeRapporto.filter(r => r.groupings?.flow_id === id).length,
        chiaviGruppo: Object.keys(righeRapporto[0]?.groupings || {}),
      }
      for (const riga of righeRapporto) {
        const g = riga.groupings || {}
        if (g.flow_id !== id || !g.flow_message_id) continue
        const s = riga.statistics || {}
        const v = perMessaggio.get(g.flow_message_id) || { destinatari: 0, aperture: 0, clic: 0, ordini: 0, entrate: 0, disiscritti: 0 }
        v.destinatari += num(s.recipients); v.aperture += num(s.opens_unique); v.clic += num(s.clicks_unique)
        v.ordini += num(s.conversions); v.entrate += num(s.conversion_value); v.disiscritti += num(s.unsubscribes)
        perMessaggio.set(g.flow_message_id, v)
      }
    }

    // ── I passi ──────────────────────────────────────────────────────────
    const passi = []
    for (const az of def.actions) {
      const d = az.data || {}
      const base = { id: String(az.id), tipoOriginale: az.type, prossimo: null, seSi: null, seNo: null }
      const L = az.links || {}
      if (L.next != null) base.prossimo = String(L.next)
      if (L.next_if_true != null) base.seSi = String(L.next_if_true)
      if (L.next_if_false != null) base.seNo = String(L.next_if_false)

      if (az.type === 'time-delay') {
        const t = descriviAttesa(d)
        passi.push({ ...base, tipo: 'attesa', titolo: t.testo, sotto: t.dettaglio, giorni: inGiorni(d) })
      } else if (az.type === 'send-email' || az.type === 'send-sms' || az.type === 'send-push-notification') {
        const m = d.message || {}
        let messaggioId = m.id ? String(m.id) : null
        // La definizione non sempre porta l'id del messaggio: si chiede al passo.
        if (!messaggioId) {
          await attendi(250)
          const fm = await kget(`/flow-actions/${az.id}/flow-messages`)
          messaggioId = (fm.body?.data || [])[0]?.id || null
        }
        const st = messaggioId ? perMessaggio.get(messaggioId) : null
        passi.push({
          ...base, tipo: az.type === 'send-email' ? 'email' : 'messaggio',
          titolo: m.name || (az.type === 'send-email' ? 'Email' : 'Messaggio'),
          sotto: m.subject_line || m.body || null,
          anteprima: m.preview_text || null,
          stato: d.status || null,
          etichette: [m.smart_sending_enabled ? 'Smart Sending' : null, m.add_tracking_params ? 'Tracciamento UTM' : null].filter(Boolean),
          messaggioId,
          // Rapporto riuscito ma nessuna riga per questa email: non ha spedito
          // nel periodo. E' un fatto e si dice, non un dato che manca.
          senzaInvii: !st && !avvisoStatistiche,
          statistiche: st ? {
            destinatari: st.destinatari,
            aperturePct: st.destinatari > 0 ? Math.round((st.aperture / st.destinatari) * 1000) / 10 : null,
            clicPct: st.destinatari > 0 ? Math.round((st.clic / st.destinatari) * 1000) / 10 : null,
            ordini: Math.round(st.ordini), entrate: Math.round(st.entrate * 100) / 100,
          } : null,
        })
      } else if (az.type === 'conditional-split' || az.type === 'trigger-split') {
        passi.push({
          ...base, tipo: 'bivio',
          titolo: az.type === 'trigger-split' ? 'Suddivisione sull’evento' : 'Suddivisione condizionale',
          sotto: az.type === 'trigger-split' ? 'Condizione sui dati dell’evento' : descriviCondizione(d.profile_filter, nomiMetriche),
        })
      } else {
        const NOMI = { 'update-profile': 'Aggiorna il profilo', webhook: 'Webhook', 'ab-test': 'Test A/B', 'list-update': 'Aggiorna lista', 'back-in-stock-delay': 'Attesa disponibilità', 'countdown-delay': 'Attesa a data', 'target-date': 'Data obiettivo' }
        passi.push({ ...base, tipo: 'altro', titolo: NOMI[az.type] || az.type, sotto: null })
      }
    }

    const tot = [...perMessaggio.values()].reduce((x, v) => ({ destinatari: x.destinatari + v.destinatari, ordini: x.ordini + v.ordini, entrate: x.entrate + v.entrate }), { destinatari: 0, ordini: 0, entrate: 0 })

    return NextResponse.json({
      ok: true,
      flusso: { id, nome: att.name || id, stato: att.status || null, creato: att.created || null, aggiornato: att.updated || null },
      innesco,
      ingresso: def.entry_action_id != null ? String(def.entry_action_id) : null,
      passi,
      periodoGiorni: giorni,
      totali: { invii: tot.destinatari, ordini: Math.round(tot.ordini), entrate: Math.round(tot.entrate * 100) / 100 },
      avvisoStatistiche,
      ...(avvisoStatistiche && /\(429/.test(avvisoStatistiche) ? { inRitardo: ['statistiche'], riprovaTraS: 20 } : {}),
      diagnostica,
    })
  })
}
