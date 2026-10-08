// Ripiego AI per lo stadio del funnel delle creativita' che le regole di
// lib/creative/stadio.js non sanno piazzare (nomi muti, nessun pubblico,
// testo senza segnali). POST { ads: [{ ad_id, campagna, adset, testo }] }
// → { ok, stadi: { ad_id: 'top'|'middle'|'lower'|'riattivazione' } }.
//
// Una creativita' si classifica UNA volta: la risposta sta nello snapshot del
// workspace (chiave per annuncio + impronta del testo) e si riusa a ogni
// apertura. Si chiama l'AI solo per gli annunci mai visti. Tetto di 60 per
// chiamata: oltre, si risponde con quel che c'e' e il resto arriva alla
// prossima apertura (niente timeout, niente spesa a vuoto).

import { NextResponse } from 'next/server'
import { withTenantContext, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { callBrain } from '../../../lib/agent/gateway'
import { getSnapshotStale, setSnapshot } from '../../../lib/cache/snapshot'
import { STADI } from '../../../lib/creative/stadio'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

const TAB = 'creativeStadioAI'
const MAX_PER_CHIAMATA = 60

function impronta(a) {
  // impronta corta e stabile: se cambia il testo si riclassifica
  const s = `${a.campagna}|${a.adset}|${a.testo}`
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return String(h)
}

const SYSTEM = `Sei un media buyer esperto di Meta Ads. Per ogni inserzione devi dire in quale stadio del funnel sta, guardando nome campagna, nome adset e testo.
Stadi possibili (usa SOLO queste parole):
- "top": scoperta, pubblico freddo, gancio, problema, awareness, prodotto presentato per la prima volta.
- "middle": considerazione, recensioni, confronti, "come funziona", ingredienti, risultati, garanzia.
- "lower": conversione, sconto, offerta, codice, urgenza, carrello abbandonato, retargeting.
- "riattivazione": clienti che hanno gia' comprato, "bentornato", "ci manchi", riordino.
Rispondi SOLO con JSON: {"stadi": {"<ad_id>": "<stadio>", ...}}. Nessun altro testo.`

export async function POST(request) {
  return withTenantContext(request, async () => {
    let body
    try { body = await request.json() } catch { body = null }
    const ads = Array.isArray(body?.ads) ? body.ads.filter(a => a && a.ad_id) : []
    if (!ads.length) return NextResponse.json({ ok: true, stadi: {} })

    const wsId = await getEffectiveTenantId().catch(() => null)
    const salvato = wsId ? (await getSnapshotStale(wsId, TAB))?.payload : null
    const memoria = (salvato && typeof salvato === 'object') ? { ...salvato } : {}

    const stadi = {}
    const daChiedere = []
    for (const a of ads) {
      const k = String(a.ad_id)
      const imp = impronta(a)
      const m = memoria[k]
      if (m && m.impronta === imp && STADI.includes(m.stadio)) stadi[k] = m.stadio
      else daChiedere.push({ ...a, impronta: imp })
    }

    if (daChiedere.length && process.env.OPENAI_API_KEY) {
      const lotto = daChiedere.slice(0, MAX_PER_CHIAMATA)
      try {
        const { content } = await callBrain({
          skill: { id: 'creative-stadio', json: true, systemPrompt: SYSTEM },
          messages: [{ role: 'user', content: JSON.stringify(lotto.map(a => ({ ad_id: a.ad_id, campagna: a.campagna, adset: a.adset, testo: a.testo }))) }],
          conversation: false,
          liveTools: false,
          temperature: 0,
        })
        let parsed = null
        try { parsed = JSON.parse(content || '{}') } catch { parsed = null }
        const risposta = parsed?.stadi && typeof parsed.stadi === 'object' ? parsed.stadi : {}
        for (const a of lotto) {
          const st = risposta[a.ad_id]
          if (STADI.includes(st)) {
            stadi[a.ad_id] = st
            memoria[a.ad_id] = { stadio: st, impronta: a.impronta }
          }
        }
        if (wsId) await setSnapshot(wsId, TAB, memoria)
      } catch (e) {
        return NextResponse.json({ ok: true, stadi, error: e?.message || 'AI' })
      }
    }

    return NextResponse.json({ ok: true, stadi, restanti: Math.max(0, daChiedere.length - MAX_PER_CHIAMATA) })
  })
}
