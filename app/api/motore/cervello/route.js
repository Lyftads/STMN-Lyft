import { NextResponse } from 'next/server'
import { contesto, SISTEMA } from '../../../../lib/motore/cervello'
import { conMotore, chiaveCliente } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Il cervello risponde sui NUMERI DI QUESTO ACCOUNT.
//
// Il contesto viene ricalcolato a ogni domanda dalle analitiche vere invece di
// essere tenuto in sessione: una conversazione lunga su dati vecchi produce
// consigli sicuri di sé e scaduti, ed è il modo più silenzioso di sbagliare.
async function POST__(req) {
  try {
    const chiave = chiaveCliente('openai')?.chiave
    if (!chiave) return NextResponse.json({ error: 'ChatGPT non collegato: inserisci la chiave nella tab Integrazioni' }, { status: 500 })
    const { domanda, storia = [], q = 'preset=ultimi-30' } = await req.json().catch(() => ({}))
    if (!domanda?.trim()) return NextResponse.json({ error: 'nessuna domanda' }, { status: 400 })

    const base = process.env.CE_BASE_URL || new URL(req.url).origin
    const { GET: analitiche } = await import('../analitiche/route')
    // Il cervello guarda lo STESSO periodo della schermata: se rispondesse su
    // trenta giorni mentre l'utente sta leggendo gli ultimi sette, i suoi
    // consigli citerebbero numeri che sullo schermo non ci sono.
    const r = await analitiche(new Request(`${base}/api/analitiche?${q}`))
    const d = await r.json()
    if (d.error) throw new Error(`analitiche: ${d.error}`)

    const ctx = contesto(d)
    const messaggi = [
      { role: 'system', content: SISTEMA },
      { role: 'system', content: `DATI DELL'ACCOUNT (usa solo questi):\n\n${ctx}` },
      // Si tiene solo la coda della conversazione: le domande vecchie fanno da
      // contesto, ma le risposte vecchie contengono numeri di un altro periodo
      // e il modello tende a ripescarli.
      ...storia.slice(-6).map(m => ({ role: m.ruolo === 'io' ? 'user' : 'assistant', content: m.testo })),
      { role: 'user', content: domanda },
    ]

    const risposta = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'gpt-4o', temperature: 0.3, max_tokens: 1400, messages: messaggi }),
    })
    const j = await risposta.json()
    if (!j.choices?.[0]) throw new Error(`openai: ${JSON.stringify(j).slice(0, 200)}`)
    return NextResponse.json({ ok: true, testo: j.choices[0].message.content, contestoRighe: ctx.split('\n').length })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
