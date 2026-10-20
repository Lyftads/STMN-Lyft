export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { waitUntil } from '@vercel/functions'
import { resolveWorkspace } from '../../../../lib/team/workspace'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { callBrain } from '../../../../lib/agent/gateway'
import { readSnapshot, buildBrief } from '../../../../lib/agent/brandSnapshot'
import { ALL_TOOLS, executeToolLive } from '../../../../lib/agent/tools'
import { GUARD_NUMBERS, AGENT_ID, tenantSystemPrompt } from '../../../../lib/agent/cervello'
import { persistTurnMemory } from '../../../../lib/tenant/agentContext'
import { nomeCervello, eCervello } from '../../../../lib/agent/cervelloChat'

// Il Cervello in LyftTalk (20 ott 2026: la Squadra AI non c'e' piu', resta solo lui).
// Chi scrive "@Cervello …" in un canale riceve la risposta li', dallo stesso Cervello del
// pulsante flottante: stesso carattere, stessa memoria, stessi strumenti sui dati.
// Prima un messaggio breve ("controllo…") cosi' il canale non resta muto, poi la risposta.

const ACKS = {
  it: ['Un attimo, controllo i numeri…', 'Ci guardo subito…', 'Apro i dati e ti dico…'],
  en: ['One moment, checking the numbers…', 'Looking into it…', 'Opening the data…'],
  es: ['Un momento, reviso los números…', 'Lo miro ahora…', 'Abro los datos…'],
  fr: ['Un instant, je regarde les chiffres…', 'Je regarde tout de suite…', 'J’ouvre les données…'],
  de: ['Einen Moment, ich prüfe die Zahlen…', 'Ich schaue gleich nach…', 'Ich öffne die Daten…'],
}
const ERRORE = {
  it: 'Non riesco a leggere i dati in questo momento: riprova tra poco.',
  en: 'I can’t read the data right now: please try again shortly.',
  es: 'Ahora mismo no puedo leer los datos: inténtalo de nuevo en un rato.',
  fr: 'Je n’arrive pas à lire les données pour le moment : réessaie dans un instant.',
  de: 'Ich kann die Daten gerade nicht lesen: versuch es gleich noch einmal.',
}
const lingua = (l) => (ACKS[String(l || '').slice(0, 2)] ? String(l).slice(0, 2) : 'it')

export async function POST(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, error: 'Non autenticato' }, { status: 401 })
  if (!process.env.OPENAI_API_KEY) return NextResponse.json({ ok: false, error: 'OPENAI_API_KEY non configurata' }, { status: 500 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ ok: false })

  let b = {}
  try { b = await req.json() } catch {}
  const channelId = b.channel_id
  if (!channelId) return NextResponse.json({ ok: false, error: 'channel_id mancante' }, { status: 400 })
  const l = lingua(b.locale)
  const nome = nomeCervello(l)

  // Ultimi messaggi del canale: il contesto della conversazione.
  const { data: rows } = await admin
    .from('channel_messages')
    .select('author_id, author_name, body, created_at')
    .eq('workspace_id', ws.workspaceId)
    .eq('channel_id', channelId)
    .order('created_at', { ascending: false })
    .limit(14)
  const recent = (rows || []).reverse().filter(m => m.body)

  // I messaggi del Cervello (author_id nullo + uno dei suoi nomi) sono "assistant",
  // tutto il resto "user", col nome di chi scrive davanti.
  const conversation = recent.map(m => (
    !m.author_id && eCervello(m.author_name)
      ? { role: 'assistant', content: m.body }
      : { role: 'user', content: `${String(m.author_name || 'Utente').split(' ')[0]}: ${m.body}` }
  ))
  const lastUserMsg = [...conversation].reverse().find(m => m.role === 'user')?.content || ''
  if (!lastUserMsg) return NextResponse.json({ ok: false, error: 'Nessuna domanda' }, { status: 400 })

  const origin = new URL(req.url).origin
  const cookie = req.headers.get('cookie') || ''

  const post = async (text) => {
    const t = String(text || '').trim()
    if (!t) return null
    const { data } = await admin.from('channel_messages').insert({
      channel_id: channelId, workspace_id: ws.workspaceId, author_id: null, author_name: nome, body: t,
    }).select('*').single()
    return data
  }

  const ack = await post(ACKS[l][Math.floor(Math.random() * ACKS[l].length)])

  try {
    // Strumenti live su qualsiasi dato. Il riassunto per periodo (call_context) lo rinfrescavano
    // le call della Squadra, che non ci sono piu': lo si usa solo se ha meno di 3 ore, mai vecchio.
    let briefBlock = null, snapData = null
    try {
      const snap = await readSnapshot(ws.workspaceId)
      const fresco = snap?.updatedAt && (Date.now() - new Date(snap.updatedAt).getTime()) < 3 * 3600e3
      if (snap?.data && fresco) { snapData = snap.data; briefBlock = buildBrief(snap.data) }
    } catch {}

    const { userId, content: reply } = await callBrain({
      skill: { id: AGENT_ID, systemPrompt: await tenantSystemPrompt(), guard: GUARD_NUMBERS },
      query: lastUserMsg,
      extraSystem: [
        ...(briefBlock ? [{ role: 'system', content: briefBlock }] : []),
        { role: 'system', content: 'STRUMENTI LIVE su QUALSIASI dato del software: get_kpis (ogni KPI, ogni periodo), list_creatives/list_adsets (Meta), get_google_campaigns, get_search_console, get_email_marketing, get_pnl, get_cro, get_customers, get_ga4_traffic, get_incrementality, get_inventory, get_ltv, list_products, list_tasks, get_time_tracking. È VIETATO rispondere "non ho il dato" senza aver PRIMA chiamato lo strumento pertinente. Ogni risultato include istruzioni "jit": seguile.' },
      ],
      messages: conversation,
      locale: l,
      temperature: 0.3,
      tools: ALL_TOOLS,
      onToolCall: (n, a) => executeToolLive(n, a, { origin, cookie, snapshot: snapData }),
      guardTail: `Sei il ${nome} e rispondi in una chat di team (LyftTalk), dove possono scrivere più persone: rivolgiti a chi ti ha chiamato per primo nome. Hai già scritto "controllo…": NON salutare, vai dritto alla risposta. Breve: 1-4 frasi, niente titoli, al massimo un elenco corto se serve davvero.`,
    })
    const answer = await post(reply)
    if (userId && reply) {
      waitUntil(Promise.resolve(persistTurnMemory({ agentId: AGENT_ID, userId, userMessage: lastUserMsg, assistantMessage: reply })).catch(() => {}))
    }
    return NextResponse.json({ ok: !!answer, messages: [ack, answer].filter(Boolean) })
  } catch (e) {
    // Aveva detto "controllo…": l'errore diventa un messaggio, mai un silenzio.
    const err = await post(ERRORE[l])
    return NextResponse.json({ ok: false, error: e?.message || 'Errore', messages: [ack, err].filter(Boolean) })
  }
}
