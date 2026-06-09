import { NextResponse } from 'next/server'
import { callBrain } from './gateway'
import { getTeamAgent, teamSkillPrompt } from './team'
import { recall, recallKnowledge } from '../tenant/agentMemory'
import { getAdminSupabase } from '../supabase/server'

// ============================================================================
//  Handler dell'LLM della CALL (ElevenLabs Conversational AI → "custom LLM").
//  Endpoint OpenAI-compatible /chat/completions: ElevenLabs gestisce voce,
//  ascolto e interruzioni; il ragionamento è il nostro cervello (callBrain →
//  persona + DATI LIVE reali) con modello economico → token bassi.
//  Esposto su /api/team/call/llm E /api/team/call/llm/chat/completions
//  (ElevenLabs appende sempre /chat/completions all'URL del server).
// ============================================================================

const ctxCache = new Map() // origin → { data, ts }
async function getLiveData(origin) {
  // 1) Snapshot "innescato" dal browser owner (percorso provato → dati reali).
  try {
    const admin = getAdminSupabase()
    const ownerWs = process.env.LYFT_OWNER_USER_ID
    if (admin && ownerWs) {
      const { data: row } = await admin.from('call_context').select('data, updated_at').eq('workspace_id', ownerWs).maybeSingle()
      if (row?.data && (Date.now() - new Date(row.updated_at).getTime() < 60 * 60000)) return row.data
    }
  } catch {}
  // 2) Fallback: fetch via cron secret (se configurato).
  const hit = ctxCache.get(origin)
  if (hit && Date.now() - hit.ts < 4 * 60000) return hit.data
  try {
    const r = await fetch(`${origin}/api/agent-context?preset=last_30d&days=30`, {
      headers: { 'x-internal-cron': process.env.CRON_SECRET || '' }, cache: 'no-store',
    })
    const data = r.ok ? await r.json() : (hit?.data || null)
    ctxCache.set(origin, { data, ts: Date.now() })
    return data
  } catch { return hit?.data || null }
}

function authorized(req) {
  const secret = process.env.CALL_SECRET || process.env.CRON_SECRET
  if (!secret) return true // se nessun secret è impostato, non bloccare (dev)
  const h = req.headers
  return h.get('x-call-secret') === secret || h.get('authorization') === `Bearer ${secret}`
}

function sseStream(text) {
  const id = 'chatcmpl-' + Date.now()
  const enc = new TextEncoder()
  const chunk = (delta, finish = null) => `data: ${JSON.stringify({ id, object: 'chat.completion.chunk', created: Math.floor(Date.now() / 1000), model: 'lyft-brain', choices: [{ index: 0, delta, finish_reason: finish }] })}\n\n`
  return new ReadableStream({
    start(c) {
      c.enqueue(enc.encode(chunk({ role: 'assistant' })))
      const parts = String(text).match(/[^.!?]+[.!?]*\s*/g) || [text]
      for (const p of parts) if (p) c.enqueue(enc.encode(chunk({ content: p })))
      c.enqueue(enc.encode(chunk({}, 'stop')))
      c.enqueue(enc.encode('data: [DONE]\n\n'))
      c.close()
    },
  })
}

// Brief COMPLETO e PRECISO: per ogni time frame i numeri ESATTI (Shopify via
// Admin GraphQL al netto resi in _periods; ShopifyQL weekly preferito per
// questa/scorsa settimana = match tab; spesa Meta per periodo dalle serie).
function buildBrief(d) {
  if (!d) return 'Dati del brand non disponibili in questo momento.'
  const r1 = n => Math.round(Number(n) || 0)
  const eur = n => `${r1(n)} euro`
  const sh = d.shopify || {}, ma = d.metaAds || {}, kl = (d.klaviyo || {}).kpis || {}, ga = (d.ga4 || {}).summary || {}
  const P = d._periods || {}
  const ymd = x => x.toISOString().slice(0, 10)
  const add = (s, n) => { const x = new Date(s + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return ymd(x) }
  const now = new Date(), today = ymd(now), dd = (now.getUTCDay() + 6) % 7
  const thisMon = add(today, -dd), lastMon = add(thisMon, -7)
  const thisMonthK = today.slice(0, 7)
  const lmD = new Date(today.slice(0, 8) + '01T00:00:00Z'); lmD.setUTCMonth(lmD.getUTCMonth() - 1); const lastMonthK = ymd(lmD).slice(0, 7)

  // Shopify per periodo: ShopifyQL weekly (match tab) per le settimane, Admin GraphQL per il resto.
  const findW = key => (sh.weekly || []).find(w => String(w.date || '').slice(0, 10) === key && (Number(w.ordini) || Number(w.fatturato)))
  const shop = key => {
    if (key === 'this_week') { const w = findW(thisMon); if (w) return { f: w.fatturato, o: w.ordini } }
    if (key === 'last_week') { const w = findW(lastMon); if (w) return { f: w.fatturato, o: w.ordini } }
    const p = P[key]; return (p && (p.orders || p.fatturato)) ? { f: p.fatturato, o: p.orders } : null
  }
  const sLine = (key, lbl) => { const s = shop(key); return `  ${lbl}: ${s ? `${eur(s.f)}, ${r1(s.o)} ordini` : 'in aggiornamento'}` }

  // Spesa Meta per periodo (dalle serie weekly/monthly — Meta non ha lag).
  const mw = key => (ma.weekly || []).find(w => String(w.date || '').slice(0, 10) === key)
  const monthSpend = yyyymm => { const mo = (ma.monthly || []).find(m => String(m.month || m.date || '').slice(0, 7) === yyyymm); return mo ? Number(mo.spend) : null }
  const m30 = (ma.weekly || []).slice(-4).reduce((s, w) => s + (Number(w.spend) || 0), 0)
  const mLine = (val, lbl) => `  ${lbl}: ${val != null ? eur(val) : 'n/d'}`

  // Klaviyo per periodo
  const K = d._klaviyo || {}
  const kline = (k, lbl) => k ? `  ${lbl}: revenue ${eur(k.revenue)}, apertura ${r1(k.openRate)}%, click ${r1(k.clickRate)}%, inviate ${r1(k.received)}` : `  ${lbl}: n/d`
  const hasK = K.this_week || K.this_month || K.last_30d
  const klaviyoBlock = hasK ? `\n\nEMAIL Klaviyo, per periodo:\n${kline(K.this_week, 'Questa settimana')}\n${kline(K.this_month, 'Questo mese')}\n${kline(K.last_30d, 'Ultimi 30 giorni')}` : ''
  // Google Search Console per periodo
  const G = d._gsc || {}
  const gt = g => g?.totals || g?.current || g || null
  const gline = (g, lbl) => { const t = gt(g); return (t && (t.clicks != null)) ? `  ${lbl}: ${r1(t.clicks)} click, ${r1(t.impressions)} impressioni, CTR ${(Number(t.ctr) || 0).toFixed(1)}%, posizione media ${(Number(t.position) || 0).toFixed(1)}` : `  ${lbl}: n/d` }
  const gPrev = (g, lbl) => { const p = g?.prev || g?.previous; return p ? `  ${lbl}: ${r1(p.clicks)} click, ${r1(p.impressions)} impressioni` : '' }
  const hasG = G.last_7d || G.last_30d
  const gscBlock = hasG ? `\n\nSEO Google Search Console, per periodo:\n${gline(G.last_7d, 'Ultimi 7 giorni')}\n${gPrev(G.last_7d, '7 giorni precedenti')}\n${gline(G.last_30d, 'Ultimi 30 giorni')}\n${gPrev(G.last_30d, '30 giorni precedenti')}`.replace(/\n\n+/g, '\n') : ''

  const roas = Number(d.metaDetail?.summary?.roas) || 0
  const aov = Number(sh.aovLive) || (P.last_30d?.orders ? P.last_30d.fatturato / P.last_30d.orders : 0)
  const prods = (sh.topProducts || []).slice(0, 5).map(p => p.label || p.product).join(', ')
  const srcs = (sh.marketingSources || []).slice(0, 4).map(s => `${s.label || s.source} (${eur(s.revenue)})`).join(', ')
  const cre = (Array.isArray(d.creatives) ? d.creatives : []).slice(0, 4).map(c => `"${c.name}" ROAS ${c.roas ?? '-'}`).join('; ')

  return `DATI REALI ESATTI del brand (al NETTO dei resi). Usa il numero del time frame ESATTO richiesto, tale e quale.

VENDITE Shopify (fatturato netto · ordini), per periodo:
${sLine('today', 'Oggi')}
${sLine('yesterday', 'Ieri')}
${sLine('this_week', 'Questa settimana (lun→oggi)')}
${sLine('last_week', 'Scorsa settimana (lun→dom)')}
${sLine('this_month', 'Questo mese')}
${sLine('last_month', 'Scorso mese')}
${sLine('last_30d', 'Ultimi 30 giorni')}

SPESA pubblicitaria Meta, per periodo:
${mLine(mw(thisMon) ? Number(mw(thisMon).spend) : null, 'Questa settimana')}
${mLine(mw(lastMon) ? Number(mw(lastMon).spend) : null, 'Scorsa settimana')}
${mLine(monthSpend(thisMonthK), 'Questo mese')}
${mLine(monthSpend(lastMonthK), 'Scorso mese')}
${mLine(m30, 'Ultimi 30 giorni (circa)')}

ALTRI KPI (ultimi ~30 giorni): ROAS Meta ${roas ? roas.toFixed(1) : '-'} · AOV ${eur(aov)} · Sessioni ${ga.sessions ?? '-'}${klaviyoBlock}${gscBlock}

Top prodotti: ${prods || 'n/d'}
Fonti di traffico: ${srcs || 'n/d'}
Top creative: ${cre || 'n/d'}`
}

export async function handleCallLLM(req) {
  if (!authorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })

  let body = {}
  try { body = await req.json() } catch {}
  const agentId = String(body.lyft_agent || body.extra_body?.lyft_agent || '').trim() || String(body.model || '').replace(/^team-/, '') || 'ceo'
  const agent = getTeamAgent(agentId) || getTeamAgent('ceo')
  const msgs = Array.isArray(body.messages) ? body.messages : []
  const history = msgs.filter(m => m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string')
  const lastUser = [...history].reverse().find(m => m.role === 'user')?.content || ''
  const origin = new URL(req.url).origin
  const OPENAI_KEY = process.env.OPENAI_API_KEY

  // Dati + memoria + knowledge (corso/video) in PARALLELO (niente latenza serie).
  const ownerUser = process.env.LYFT_OWNER_USER_ID
  const [liveData, mems, know] = await Promise.all([
    getLiveData(origin),
    (ownerUser && lastUser) ? recall({ userId: ownerUser, agentId: 'team-call', query: lastUser, limit: 4 }).catch(() => []) : Promise.resolve([]),
    lastUser ? recallKnowledge({ query: lastUser, limit: 2 }).catch(() => []) : Promise.resolve([]),
  ])
  const brief = buildBrief(liveData)
  const memoryBlock = (Array.isArray(mems) && mems.length) ? '\n\nMEMORIA CALL PRECEDENTI (dai continuità):\n' + mems.map(m => `• ${m.content}`).join('\n') : ''
  const knowBlock = (Array.isArray(know) && know.length) ? '\n\nCONOSCENZA (dal corso e dai video YouTube — usala se pertinente, sintetizza):\n' + know.map(k => `• ${String(k.content || '').slice(0, 280)}`).join('\n') : ''

  const system = `${teamSkillPrompt(agent)}

SEI IN UNA CALL VOCALE con tutta la squadra. Se la domanda è di un collega (Ads→Sofia, CRO→Giulia, SEO→Davide, Dati→Alessandro, Finanza→Marco, Marketing→Luigi, Creatività→Valentina, Strategia→Chiara) passa la parola e riporta la sua risposta in prima persona.

${brief}${memoryBlock}${knowBlock}

REGOLE RISPOSTA: 1 frase, max 2, BREVISSIME come al telefono. Niente elenchi/markdown/preamboli. Cita solo numeri/nomi dei DATI REALI sopra; se manca un dato dillo. Chiama l'utente SOLO per nome (es. "Marino"), mai col cognome. Rispondi nella STESSA lingua dell'utente.
NUMERI (importante per la voce): dilli SEMPRE arrotondati e in modo PARLATO, come li diresti a voce — es. "circa 141 mila euro", "ROAS tre e sei", "MER quattro", "AOV settantatré euro". MAI leggere cifre lunghe e precise tipo "141.265" o "3,63": arrotonda e semplifica.
TIME FRAME (cruciale): per ogni domanda usa il numero del periodo ESATTO richiesto dalle liste sopra (oggi / ieri / questa settimana / scorsa settimana / questo mese / scorso mese / ultimi 30 giorni). NON confondere i periodi (es. la spesa "scorsa settimana" è quella riga, NON il totale dei 30 giorni). Riporta ordini e spesa in modo PRECISO. Se un periodo è "in aggiornamento", dillo onestamente — ma NON dire mai "zero" o che "non ci sono dati".
TONO: parla in modo ESPRESSIVO e umano, MAI meccanico. Usa esclamazioni e reazioni naturali coerenti col contenuto — entusiasmo se i dati sono buoni ("Ottimo, Marino!", "Wow, qui voliamo!"), preoccupazione se vanno male ("Mmh, qui c'è da lavorare…"), curiosità, pause naturali. Varia l'intonazione.`

  const oaiBody = {
    model: process.env.CALL_MODEL || 'gpt-4o-mini',
    messages: [{ role: 'system', content: system }, ...history.slice(-10)],
    temperature: 0.5,
    max_tokens: 160,
    stream: !!body.stream,
  }

  try {
    const oai = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST', headers: { Authorization: `Bearer ${OPENAI_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(oaiBody),
    })
    if (!oai.ok) throw new Error('openai ' + oai.status)
    // STREAMING: la risposta di OpenAI è già nel formato che ElevenLabs si aspetta
    // → la inoltro DIRETTAMENTE (audio parte appena arrivano le prime parole).
    if (body.stream) {
      return new Response(oai.body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive' } })
    }
    const j = await oai.json()
    return NextResponse.json(j)
  } catch {
    const reply = 'Scusa, ho avuto un problema un attimo, puoi ripetere?'
    if (body.stream) return new Response(sseStream(reply), { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store' } })
    return NextResponse.json({ id: 'chatcmpl-' + Date.now(), object: 'chat.completion', created: Math.floor(Date.now() / 1000), model: 'lyft-brain', choices: [{ index: 0, message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] })
  }
}
