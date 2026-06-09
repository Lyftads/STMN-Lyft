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

// Brief dati COMPATTO con numeri PARLATI/arrotondati (la voce li ripete meglio)
// e fallback robusti (shopify.weekly a volte è vuoto per il lag di ShopifyQL).
function buildBrief(d) {
  if (!d) return 'Dati del brand non disponibili in questo momento.'
  const r1 = n => Math.round(Number(n) || 0)
  const k = n => { n = r1(n); return n >= 10000 ? r1(n / 1000) + ' mila' : String(n) } // "141 mila"
  const sh = d.shopify || {}, kl = (d.klaviyo || {}).kpis || {}, ga = (d.ga4 || {}).summary || {}
  const wk = Array.isArray(sh.weekly) ? sh.weekly.slice(-4) : []
  const db = Array.isArray(sh.dayBreakdown) ? sh.dayBreakdown : []
  let rev = wk.reduce((s, w) => s + (Number(w.fatturato) || 0), 0)
  if (!rev) rev = db.reduce((s, x) => s + (Number(x.revenue) || 0), 0)
  if (!rev) rev = Number(ga.totalRevenue) || 0
  let ord = wk.reduce((s, w) => s + (Number(w.ordini) || 0), 0)
  if (!ord) ord = db.reduce((s, x) => s + (Number(x.orders) || 0), 0)
  if (!ord) ord = Number(sh.ordersLive) || 0
  const aov = Number(sh.aovLive) || (ord ? rev / ord : 0)
  const maWk = Array.isArray(d.metaAds?.weekly) ? d.metaAds.weekly.slice(-4) : []
  let spend = maWk.reduce((s, w) => s + (Number(w.spend) || 0), 0)
  if (!spend) { const mo = d.metaAds?.monthly; if (Array.isArray(mo) && mo.length) spend = Number(mo[mo.length - 1].spend) || 0 }
  const roas = Number(d.metaDetail?.summary?.roas) || 0
  const prods = (sh.topProducts || []).slice(0, 5).map(p => `${p.label || p.product} (~${k(p.revenue)} euro)`).join(', ')
  const srcs = (sh.marketingSources || []).slice(0, 4).map(s => `${s.label || s.source} ~${k(s.revenue)} euro`).join(', ')
  const cre = (Array.isArray(d.creatives) ? d.creatives : []).slice(0, 4).map(c => `"${c.name}" ROAS ${c.roas ?? '-'}`).join('; ')
  // Settimane PRECISE: prima da _weekStats (Admin GraphQL, affidabile, no lag);
  // fallback alla serie weekly per data (lun corrente / lun scorso).
  const mon = off => { const x = new Date(); const dd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - dd - off * 7); return x.toISOString().slice(0, 10) }
  const thisMon = mon(0), lastMon = mon(1)
  const ws = d._weekStats || {}
  const findW = key => (Array.isArray(sh.weekly) ? sh.weekly : []).find(w => String(w.date || '').slice(0, 10) === key && (Number(w.ordini) || Number(w.fatturato)))
  // PRIORITÀ: la serie weekly di ShopifyQL (= identica alla tab Weekly) se valida;
  // altrimenti Admin GraphQL (ripiego affidabile quando ShopifyQL torna a zero).
  const pick = (stat, key) => { const w = findW(key); if (w) return { fatturato: w.fatturato, ordini: w.ordini }; return (stat && (stat.orders || stat.fatturato)) ? { fatturato: stat.fatturato, ordini: stat.orders } : null }
  const tw = pick(ws.thisWeek, thisMon), lw = pick(ws.lastWeek, lastMon)
  const wline = (w, lbl) => w ? `${lbl}: ${r1(w.fatturato)} euro, ${r1(w.ordini)} ordini (ESATTI)` : `${lbl}: dato non ancora disponibile`
  const weeksBlock = `\nSETTIMANE (numeri ESATTI — usali tali e quali):\n${wline(tw, `QUESTA settimana (da lun ${thisMon} a oggi)`)}\n${wline(lw, `SCORSA settimana (lun ${lastMon} → dom)`)}`
  return `DATI REALI del brand (performance RECENTE — usali per qualsiasi domanda su andamento/settimana/mese; di' i numeri ARROTONDATI come scritti qui):
Vendite (Shopify): Fatturato ~${k(rev)} euro · Ordini ~${ord} · AOV ~${r1(aov)} euro
Advertising (Meta): Spesa ~${k(spend)} euro · ROAS ${roas ? roas.toFixed(1) : '-'} · MER ${spend ? (rev / spend).toFixed(1) : '-'}
Email (Klaviyo): apertura ${kl.openRate ?? '-'}%, click ${kl.clickRate ?? '-'}% · Sessioni ~${ga.sessions ? k(ga.sessions) : '-'}
Top prodotti (Shopify): ${prods || 'n/d'}
Fonti di traffico (Shopify): ${srcs || 'n/d'}
Top creative (Meta): ${cre || 'n/d'}${weeksBlock}`
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
SETTIMANE: se l'utente chiede "questa settimana" usa la riga QUESTA settimana del blocco SETTIMANE; se chiede "scorsa settimana" usa la riga SCORSA settimana. Riporta quei numeri in modo PRECISO (ordini esatti). Se per quella settimana il dato è "non ancora disponibile", dillo onestamente (è il lag di ShopifyQL sugli ultimi giorni) e offri il dato recente complessivo come riferimento — ma NON dire mai "zero" o che gli ordini "non ci sono".
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
