export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext } from '../../../../lib/tenant/credentials'
import { callBrain } from '../../../../lib/agent/gateway'
import { buildBrandContext } from '../../../../lib/tenant/brand'

// ── Crea campagna (copy email AI per segmento) ──────────────────────────────
// Genera l'email (oggetto + preview + corpo + CTA) per un segmento di clienti,
// nel tono del brand e nella lingua del cliente. Pronta da incollare in Klaviyo.
// Read-only sull'AI (nessun invio): l'invio resta un'azione esplicita dell'utente.

const BRIEFS = {
  vip: {
    label: 'VIP (top spender, ancora attivi)',
    goal: 'Premiare la fedeltà e far sentire il cliente speciale. Tono esclusivo, niente sconti aggressivi: accesso anticipato, perk, ringraziamento sincero. Spingere all\'acquisto del nuovo/best seller.',
  },
  atRisk: {
    label: 'A rischio churn (repeat che hanno rallentato, 60–180 giorni dall\'ultimo ordine)',
    goal: 'Riattivare con gentilezza prima che si perdano. Ricordare il valore del brand, mostrare le novità, eventualmente un piccolo incentivo soft. Tono caldo, non disperato.',
  },
  winback: {
    label: 'Win-back (clienti persi, oltre 180 giorni dall\'ultimo ordine)',
    goal: 'Recuperare con un messaggio forte: "ci sei mancato", novità importanti dal loro ultimo acquisto, un incentivo concreto per tornare. Tono diretto e onesto.',
  },
  convert: {
    label: 'Da convertire (one-time recenti, da spingere al secondo acquisto)',
    goal: 'Trasformare un acquisto singolo in cliente abituale. Cross-sell coerente con il primo ordine, riprova sociale, un incentivo al riacquisto. Tono amichevole e utile.',
  },
}

const SKILL = {
  id: 'customer-campaign',
  temperature: 0.8,
  json: true,
  systemPrompt: 'Sei un copywriter email DTC senior. Scrivi email di marketing ad alta conversione per un segmento specifico di clienti, nel tono del brand. Rispondi SOLO con JSON valido: {"subject":"...","preview":"...","body":"...","cta":"...","angle":"..."}. "subject" max ~55 caratteri, "preview" max ~90, "body" testo dell\'email pronto (paragrafi separati da \\n\\n, niente HTML, niente segnaposto tipo [Nome] salvo {{ first_name }} di Klaviyo se serve), "cta" il testo del bottone, "angle" una frase che spiega la strategia. Niente emoji se non in linea col brand.',
}

export async function POST(req) {
  return withTenantContext(req, async () => {
    let payload = {}
    try { payload = await req.json() } catch {}
    const segment = String(payload.segment || '')
    const locale = payload.locale || null
    const brief = BRIEFS[segment]
    if (!brief) return NextResponse.json({ ok: false, error: 'Segmento non valido' }, { status: 400 })

    try {
      const brandContext = await buildBrandContext()
      const stats = payload.stats || null // { count, value, currency } passati dal client (opzionali)
      const { parsed, content } = await callBrain({
        skill: SKILL,
        conversation: false,
        locale,
        extraSystem: [brandContext],
        query: `Email per il segmento: ${brief.label}`,
        data: {
          segmento: brief.label,
          obiettivo: brief.goal,
          ...(stats ? { clienti_nel_segmento: stats.count, valore_segmento: stats.value, valuta: stats.currency } : {}),
        },
        dataLabel: 'BRIEF CAMPAGNA:',
      })
      const out = parsed || {}
      if (!out.subject && !out.body) {
        return NextResponse.json({ ok: false, error: 'Generazione non riuscita', raw: content?.slice(0, 500) }, { status: 200 })
      }
      return NextResponse.json({ ok: true, segment, ...out })
    } catch (e) {
      return NextResponse.json({ ok: false, error: e?.message || 'Errore generazione' }, { status: 200 })
    }
  })
}
