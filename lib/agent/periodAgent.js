import { NextResponse } from 'next/server'
import { ACTION_QUALITY } from './actionQuality'
import { aiLangSystemMessage } from '../i18n/aiLang'
import { persistTurnMemory, persistDataMemory } from '../tenant/agentContext'
import { callBrain } from './gateway'
import { requireCaller } from '../tenant/credentials'
import { tenantPrompt } from './tenantPrompt'

// ============================================================================
//  Agent "di periodo": Weekly, Mensile, Quarter, Year.
//
//  Erano quattro route con quattro prompt separati, identici al 75% fra loro:
//  stessa struttura, stessi campi dati, stessi parametri del modello. Costo di
//  quella duplicazione, misurato: la correzione dell'identita' tenant e' andata
//  applicata quattro volte, e lo standard qualita' dei consigli era finito solo
//  in due su quattro (mensile e quarter ne erano rimasti senza).
//
//  Qui il tronco e' UNO: tono, regola d'oro, stile, contratto sui dati, guardia
//  anti-invenzione e standard qualita'. Cambia solo cio' che e' davvero
//  specifico del periodo — il nome, la competenza verticale, l'esempio.
//  Le quattro route restano ai loro URL (nessun cambio per il client): sono
//  righe sottili che dichiarano il proprio periodo e delegano a questo modulo.
// ============================================================================

// Righe di dati: i quattro tab mandano gli stessi KPI con nomi diversi.
// Il Weekly usa chiavi corte (fat/ord/ses/meta/adv), gli altri quelle lunghe.
const row = (r) => ({
  label: r.label ?? null,
  key: r.key ?? r.month ?? null,
  fatturato: r.fatturato ?? r.fat,
  fatturNC: r.fatturNC ?? r.fatNC,
  fatturRC: r.fatturRC ?? r.fatRC,
  resi: r.resi,
  ordini: r.ordini ?? r.ord,
  nc: r.nc,
  rc: r.rc,
  sessioni: r.sessioni ?? r.ses,
  metaSpend: r.metaSpend ?? r.meta,
  googleSpend: r.googleSpend ?? r.google,
  totalSpend: r.totalSpend ?? r.adv,
  mer: r.mer, aMer: r.aMer, cac: r.cac, cpo: r.cpo,
  aov: r.aov, aovNC: r.aovNC, aovRC: r.aovRC,
  retention: r.retention, cro: r.cro, ltv: r.ltv, ratio: r.ratio,
})

// Dati live del periodo in corso (arrivano da /api/metrics).
const liveBlock = (metrics) => metrics?.shopifyRange ? {
  currentLiveRevenue: metrics.shopifyRange.revenue,
  currentLiveOrders: metrics.shopifyRange.orders,
  currentLiveNc: metrics.shopifyRange.nc,
  currentLiveRc: metrics.shopifyRange.rc,
  currentLiveMetaSpend: metrics.metaRange?.spend,
} : null

// ── I quattro periodi ───────────────────────────────────────────────────────
// listKey: come si chiama l'array nel body inviato dal tab.
// focus:   la competenza DAVVERO specifica di quel periodo (il resto e' comune).
export const PERIODS = {
  weekly: {
    id: 'weekly', agentName: 'Weekly Agent', adjective: 'SETTIMANALE',
    noun: 'settimana', nounPl: 'settimane',
    listKey: 'weeks', dataKey: 'weeks', selKey: 'selectedWeek', prevKey: 'previousWeek',
    dataName: 'DATI SETTIMANALI',
    example: 'la settimana del 26 mag hai fatto €34.521, +8,1% vs la precedente',
    askExample: 'come e andata la scorsa settimana?',
    focus: [
      '**Settimana vs settimana** — delta tra la settimana selezionata e la precedente',
      '**Trend multi-settimanali** — accelerazioni, declini, plateau su piu settimane',
      '**Variabilita intra-mensile** — fluttuazioni settimanali dentro lo stesso mese',
      '**Effetto giorni della settimana / weekend** — quando i dati lo permettono',
      '**Stagionalita di breve periodo** — fine mese vs inizio mese, pre/post promozioni',
      '**Lettura grafici settimanali** — Fatturato/Spesa/MER, NC vs RC, AOV/CRO, Ratio LTV:CAC',
    ],
  },
  mensile: {
    id: 'mensile', agentName: 'Mensile Agent', adjective: 'MENSILE',
    noun: 'mese', nounPl: 'mesi',
    listKey: 'data', dataKey: 'months', selKey: 'selectedMonth', prevKey: 'previousMonth',
    dataName: 'DATI MENSILI',
    example: 'a Maggio hai fatto €147.874, +2,3% vs Aprile',
    askExample: 'come e andato Maggio vs Aprile?',
    focus: [
      '**Comparazione mese vs mese** — delta tra il mese selezionato e il precedente',
      '**Trend pluri-mensili** — stagionalita, accelerazioni, declini strutturali',
      '**Benchmark mensile** — confronto vs le medie storiche del brand',
      '**Forecasting basico** — proiezione sul mese in corso considerando i giorni trascorsi',
      '**Lettura grafici mensili** — Fatturato/Spesa/MER, Nuovi vs Ritorno, AOV/CRO, Ratio LTV:CAC',
    ],
  },
  quarter: {
    id: 'quarter', agentName: 'Quarter Agent', adjective: 'TRIMESTRALE',
    noun: 'trimestre', nounPl: 'trimestri',
    listKey: 'quarters', dataKey: 'quarters', selKey: 'selectedQuarter', prevKey: 'previousQuarter',
    dataName: 'DATI TRIMESTRALI',
    example: 'in Q1 hai fatto €386.000, +12,3% vs Q4',
    askExample: 'come e andato Q2 vs Q1?',
    focus: [
      '**Comparazione Q vs Q** — delta tra il trimestre selezionato e il precedente',
      '**Stagionalita** — pattern Q1/Q2/Q3/Q4 (saldi, estate, rientro, festivita)',
      '**Benchmark trimestrale** — confronto vs le medie storiche su base trimestrale',
      '**Run-rate e forecasting** — proiezione a fine trimestre coi giorni residui',
      '**Strategia macro** — pianificazione cross-quarter: budget, lancio collezioni, scaling adv',
    ],
  },
  year: {
    id: 'year', agentName: 'Year Agent', adjective: 'ANNUALE',
    noun: 'anno', nounPl: 'anni',
    listKey: 'years', dataKey: 'years', selKey: 'selectedYear', prevKey: 'previousYear',
    dataName: 'DATI ANNUALI',
    example: 'nel 2026 hai fatto €X, +Y% vs 2025',
    askExample: 'come e andato il 2026 vs il 2025?',
    focus: [
      '**Comparazione anno vs anno (YoY)** — delta tra l anno selezionato e il precedente',
      '**Crescita strutturale** — tasso di crescita YoY su fatturato, ordini, clienti',
      '**Trend pluri-annuali** — pattern attraverso piu anni del dataset',
      '**Benchmark annuale** — confronto vs le medie storiche del brand',
      '**Run-rate annuale** — proiezione a fine anno coi mesi residui',
      '**Strategia macro** — decisioni cross-year: budget annuale, scaling adv, espansione catalogo',
    ],
  },
}

// Prompt: tronco comune + innesto del periodo. La riga su cosa vende STMN resta
// (tenantPrompt la toglie per gli altri tenant, come per tutti gli altri agent).
function buildPrompt(p) {
  return `Sei "${p.agentName}", consulente di fiducia di Marino, founder di STMN Fitness, iper-specializzato sull'analisi ${p.adjective}.

## Tua specializzazione
Sei verticalizzato esclusivamente sulla cadenza ${p.adjective.toLowerCase()}. Non sei un agent generalista:

${p.focus.map(f => `- ${f}`).join('\n')}
- **Performance ranking ${p.nounPl}** — quale ${p.noun} e andato meglio/peggio e PERCHE, non solo il numero
- **Diagnosi anomalie** — ${p.noun} fuori scala rispetto al resto: individua la causa probabile
- **Lettura tabelle KPI** — MER, aMER, CAC, CPO, AOV, AOV NC/RC, Ret%, CRO%, LTV, Ratio

## Regola d'oro
UNA domanda = UNA risposta focalizzata. Se ti chiedono "${p.askExample}" rispondi SOLO su quello, senza aggiungere trend di altri periodi a meno che non te lo chiedano.

## Tono
Chiama la persona per nome. Tono umano, da consulente vero. Inizia spesso con "Allora", "Guarda", "Ok quindi", "Diciamo che". Niente preamboli da AI ("certo!", "ottima domanda"), niente saluti ripetuti.

## Stile risposta
- Italiano diretto, asciutto
- SEMPRE numeri esatti dal JSON ("${p.example}")
- Quando consigli: PERCHE farlo, COSA testare, COME misurare
- Risposte concise. Niente liste se non aggiungono valore reale
- Bold solo per i punti chiave. Niente emoji. Niente intestazioni \`##\`

## Dati che hai (CONTRATTO INVIOLABILE)
Ricevi un JSON \`${p.dataName}\` con:
- Array completo dei ${p.nounPl} disponibili nel dataset
- ${p.noun.charAt(0).toUpperCase() + p.noun.slice(1)} selezionato + quello precedente
- Per ogni ${p.noun}: fatturato, fatturNC, fatturRC, resi, ordini, NC, RC, sessioni, metaSpend, googleSpend, totalSpend, MER, aMER, CAC, CPO, AOV, AOV NC/RC, retention, CRO, LTV, Ratio
- Dati live aggiornati a oggi per il ${p.noun} in corso

OGNI numero, ogni nome, ogni percentuale che scrivi DEVE essere copiato letteralmente dal JSON. Se manca un dato, dillo apertamente ("Non ho il dato di X"). NON inventare valori. NON usare benchmark generici come se fossero dati del brand. STMN vende paracalli/corde/accessori CrossFit — mai supplementi.

Se ti chiedono un ${p.noun} che non e nei dati, dillo: "Quel ${p.noun} non e nei miei dati, posso confrontarti questi: [elenco]".${ACTION_QUALITY}`
}

// Handler condiviso: identico per i quattro periodi.
export async function handlePeriodAgent(req, kind) {
  const p = PERIODS[kind]
  if (!p) return NextResponse.json({ error: 'periodo non valido' }, { status: 500 })

  // Gate: route a pagamento (AI) — mai anonima.
  const gate = await requireCaller(req); if (gate) return gate
  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'OPENAI_API_KEY non configurata.' }, { status: 500 })
  }

  let body
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

  const messages = Array.isArray(body?.messages) ? body.messages : []
  if (!messages.length) return NextResponse.json({ error: 'messages mancante' }, { status: 400 })

  const list = Array.isArray(body?.[p.listKey]) ? body[p.listKey] : []
  const metrics = body?.metrics || null
  const rows = list.map(row)

  // Nomi delle chiavi IDENTICI a quelli delle quattro route originali
  // (selectedMonth/monthsAvailable/months, …): il modello legge il JSON, e
  // cambiarli avrebbe cambiato le risposte senza motivo.
  const context = {
    ...(body?.[p.selKey] !== undefined ? { [p.selKey]: body[p.selKey] || null } : {}),
    ...(body?.[p.prevKey] !== undefined ? { [p.prevKey]: body[p.prevKey] || null } : {}),
    [`${p.dataKey}Available`]: rows.map(r => r.label || r.key),
    [p.dataKey]: rows,
    live: liveBlock(metrics),
  }

  const clean = messages
    .filter(m => m && typeof m.content === 'string' && (m.role === 'user' || m.role === 'assistant'))
    .slice(-20)
  const lastUserMsg = [...clean].reverse().find(m => m.role === 'user')?.content || ''
  const langMsg = aiLangSystemMessage(body?.locale)

  try {
    const { userId, content: reply, usage } = await callBrain({
      skill: { id: p.id, systemPrompt: tenantPrompt(buildPrompt(p)) },
      query: lastUserMsg,
      data: context,
      dataLabel: `${p.dataName} — usa SOLO questi numeri, mai inventare:`,
      dataMax: 70000,
      messages: clean,
      locale: null,
      extraSystem: langMsg ? [langMsg] : [],
      temperature: 0.2,
      topP: 0.2,
      guardTail: `REMINDER: prima di rispondere verifica che OGNI numero e OGNI nome di ${p.noun} che scrivi sia letteralmente presente nel JSON ${p.dataName}. Se manca, scrivi "Non ho questo dato" invece di inventare.`,
    })

    if (userId && lastUserMsg && reply) {
      persistTurnMemory({ agentId: p.id, userId, userMessage: lastUserMsg, assistantMessage: reply }).catch(() => {})
    }
    if (userId && context) {
      persistDataMemory({ agentId: p.id, userId, data: context }).catch(() => {})
    }

    return NextResponse.json({ reply, usage: usage || null, updatedAt: new Date().toISOString() })
  } catch (err) {
    const status = err?.status ? 502 : 500
    return NextResponse.json({ error: err?.message || 'Errore OpenAI' }, { status })
  }
}
