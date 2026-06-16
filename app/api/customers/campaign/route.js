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
  new: {
    label: 'Nuovi (primo ordine di recente)',
    goal: 'Far sentire accolto il nuovo cliente, rafforzare la scelta fatta e creare le basi per il secondo ordine. Tono caldo e di benvenuto, riprova sociale, eventuale incentivo gentile al riacquisto. Niente sconti aggressivi.',
  },
  potentialLoyal: {
    label: 'Potenziali fedeli (più ordini di recente, in crescita)',
    goal: 'Consolidare l\'abitudine e spingere verso la fedeltà. Cross-sell coerente, valorizzare i benefici di tornare spesso, magari un perk/programma fedeltà. Tono di stima e crescita.',
  },
  loyal: {
    label: 'Fedeli (ordinano spesso e regolarmente)',
    goal: 'Premiare e far sentire speciale il cliente fedele. Accesso anticipato, perk esclusivi, ringraziamento sincero, novità/best seller. Tono esclusivo, niente sconti aggressivi.',
  },
  loyalAtRisk: {
    label: 'Fedeli a rischio (erano fedeli, non ordinano da un po\')',
    goal: 'Riattivare un cliente di valore prima che si perda. Ricordare il legame, mostrare le novità, incentivo concreto ma rispettoso. Tono caldo e personale, non disperato.',
  },
  aboutToSleep: {
    label: 'Stanno per dormire (primo ordine un po\' di tempo fa, in raffreddamento)',
    goal: 'Risvegliare l\'interesse prima che diventino dormienti. Novità, motivo per tornare ora, piccolo incentivo. Tono leggero e invitante.',
  },
  sleepers: {
    label: 'Dormienti (primo ordine molto tempo fa, inattivi)',
    goal: 'Recuperare con un messaggio forte di win-back: "ci sei mancato", cosa è cambiato dal loro ultimo acquisto, un incentivo concreto per tornare. Tono diretto e onesto.',
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
