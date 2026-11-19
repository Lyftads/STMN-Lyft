import { periodKPIs } from './brandSnapshot'
import { chiaveOpenAI, MANCA_CHIAVE } from '../studio/chiaveAI'
import { eventiDelGiorno, creaEvento } from '../studio/calendario'
import { getCurrentUserId, getEffectiveTenantId } from '../tenant/credentials'
import { remember } from '../tenant/agentMemory'
import { AGENT_ID } from './cervello'
import { createHash } from 'crypto'

// ============================================================================
//  STRUMENTI degli agent: interrogano i dati del software (snapshot arricchito)
//  per rispondere a QUALSIASI domanda — KPI, creative, adset, competitor, task,
//  Lyftimer. In formato OpenAI function-calling. Usati da call e chat.
// ============================================================================

const PERIODS = ['today', 'yesterday', 'this_week', 'last_week', 'last_7d', 'last_14d', 'this_month', 'last_month', 'last_30d', 'last_90d', 'ytd']

export const TOOLS = [
  { type: 'function', function: { name: 'get_kpis', description: 'KPI completi del brand per un periodo: fatturato, ordini, AOV, nuovi/ritorno clienti, repeat rate, LTV, sessioni, conversion rate, resi, spesa ads, ROAS, MER, CTR, CPC, CPM, frequency, CAC.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS } }, required: ['period'] } } },
  { type: 'function', function: { name: 'list_creatives', description: 'Performance pubblicitaria Meta a livello adset/creatività: spesa, ROAS, CTR link, CPC, acquisti e valore acquisti, per periodo.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS }, name: { type: 'string', description: 'filtra per nome creatività' }, sort: { type: 'string', enum: ['spend', 'roas', 'ctr', 'purchases'] }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'list_adsets', description: 'Elenca adset/campagne Meta con i loro KPI: spesa, ROAS, CTR, CPC, frequency, acquisti, valore acquisti.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS }, name: { type: 'string', description: 'filtra per nome adset o campagna' }, sort: { type: 'string', enum: ['spend', 'roas', 'ctr', 'purchases'] }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'list_tasks', description: 'Progetti e task del team: titolo, assegnatario, stato, priorità, scadenza.', parameters: { type: 'object', properties: { status: { type: 'string' }, assignee: { type: 'string' } } } } },
  { type: 'function', function: { name: 'get_time_tracking', description: 'Lyftimer: ore registrate dal team (per persona/progetto) e voci recenti.', parameters: { type: 'object', properties: { person: { type: 'string' } } } } },
  { type: 'function', function: { name: 'list_products', description: 'Top prodotti del brand per fatturato (Shopify).', parameters: { type: 'object', properties: { limit: { type: 'integer' } } } } },
]

// ── TOOL AGGIUNTIVI (solo live: leggono le route interne on-demand) ─────────
export const LIVE_TOOLS = [
  { type: 'function', function: { name: 'get_google_campaigns', description: 'Campagne Google Ads con KPI reali: spesa, ROAS, conversioni, valore conv., CPA, CTR, CPC, impression, click, budget/giorno, stato.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS }, limit: { type: 'integer' } } } } },
  { type: 'function', function: { name: 'get_search_console', description: 'Dati REALI Google Search Console del sito: click, impression, CTR, posizione media (con delta vs periodo prec.), top query, opportunità SEO (query quasi in prima pagina, CTR basso).', parameters: { type: 'object', properties: { days: { type: 'integer', description: '7, 28, 90 o 180 (default 28)' } } } } },
  { type: 'function', function: { name: 'get_incrementality', description: 'Contributo incrementale dei canali ads (Meta/Google) vs baseline organica: ricavi incrementali reali, ROAS incrementale, saturazione, affidabilità della stima.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'finestra giorni (default 90)' } } } } },
  { type: 'function', function: { name: 'get_inventory', description: 'Inventario e rischi stockout per prodotto/taglia: giorni-a-stockout, taglie rotte, vendite perse stimate.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_ltv', description: 'LTV Lordo e Netto (proiettati a maturità), CAC e ratio LTV:CAC del brand.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_email_marketing', description: 'Email marketing (Klaviyo/Omnisend/Mailchimp): fatturato da email, campagne inviate con open/click/revenue, flussi automatici, liste e segmenti.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'finestra giorni (default 30)' } } } } },
  { type: 'function', function: { name: 'get_pnl', description: 'Conto economico (P&L) per mese: fatturato lordo/netto, IVA, sconti, resi, ordini, COGS e commissioni; margine medio. La spesa ads va chiesta ai tool Meta/Google.', parameters: { type: 'object', properties: { months: { type: 'integer', description: 'mesi indietro (default 6)' } } } } },
  { type: 'function', function: { name: 'get_cro', description: 'Funnel e conversione del sito giorno-preciso: sessioni, add-to-cart, checkout, acquisti, conversion rate, nuovi vs ritornanti.', parameters: { type: 'object', properties: { period: { type: 'string', enum: PERIODS } } } } },
  { type: 'function', function: { name: 'get_customers', description: 'Base clienti segmentata (RFM): nuovi, potenziali fedeli, fedeli, a rischio, dormienti — con numero clienti, valore medio, ordini medi e giorni tra ordini.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'get_ga4_traffic', description: 'Traffico GA4: sessioni, utenti, bounce rate e conversioni totali; canali, pagine più viste e paesi.', parameters: { type: 'object', properties: { days: { type: 'integer', description: 'finestra giorni (default 30)' } } } } },
]
// Lyft Studio: il cervello vede anche le due sezioni nuove. Tre letture e UNA azione (dare un incarico a
// un agente), che parte solo se la persona lo chiede: un incarico fa lavorare un agente e consuma credito.
export const STUDIO_TOOLS = [
  { type: 'function', function: { name: 'get_creative_engine', description: 'Motore Creativo: verdetto sulle creatività Meta del periodo (quante da scalare, in stand by, da spegnere, in attesa), spesa, ROAS e costo per ordine dell\'account, e le creatività con più spesa con il loro verdetto e il perché.', parameters: { type: 'object', properties: { limit: { type: 'integer', description: 'quante creatività elencare (default 8, max 20)' } } } } },
  { type: 'function', function: { name: 'get_agent_team', description: 'Squadra agent del cliente: chi sono gli agenti, chi sta lavorando e su cosa, prossimi giri, lavori che aspettano una decisione (titolo, autore, riassunto) e ultimi messaggi in bacheca.', parameters: { type: 'object', properties: {} } } },
  { type: 'function', function: { name: 'give_agent_task', description: 'Passa alla Squadra agent una cosa DA FARE. Usalo ogni volta che la persona propone o chiede un lavoro che spetta alla squadra (un\'analisi, dei testi, delle creatività, una newsletter, un controllo, una modifica da preparare): tu non lo fai, lo riporti all\'agente giusto. agente = id del mestiere (direttore, campagne, kpi, stratega, copy, art, newsletter, sito, competitor, recensioni); se il lavoro tocca più mestieri o non sai a chi spetta, dallo al direttore, che lo distribuisce. NON usarlo per domande a cui puoi rispondere tu leggendo i dati.', parameters: { type: 'object', properties: { agente: { type: 'string' }, compito: { type: 'string', description: 'cosa deve fare, completo e autosufficiente: chi legge non ha visto la conversazione' } }, required: ['agente', 'compito'] } } },
  { type: 'function', function: { name: 'search_web', description: 'Ricerca online in tempo reale (notizie, prezzi dei concorrenti, tendenze, informazioni che non stanno nei dati del negozio). Restituisce una risposta con le fonti.', parameters: { type: 'object', properties: { domanda: { type: 'string', description: 'cosa cercare, in una frase completa' } }, required: ['domanda'] } } },
  { type: 'function', function: { name: 'browse_web', description: 'Naviga sul web GUIDANDO IL BROWSER della persona, che vede aprirsi le schede e ogni passo dal vivo (serve l\'estensione Lyft). Usalo quando chiede di "aprire", "andare a vedere", "guardare il sito di…", "cercare facendomi vedere", o quando una ricerca richiede di visitare pagine precise. Per una risposta veloce senza aprire schede usa search_web.', parameters: { type: 'object', properties: { obiettivo: { type: 'string', description: 'cosa trovare o guardare, completo: chi naviga non ha visto la conversazione' } }, required: ['obiettivo'] } } },
  { type: 'function', function: { name: 'get_calendar', description: 'Gli appuntamenti del Google Calendar della persona per un giorno (di serie oggi): orario, titolo, con chi, link della call.', parameters: { type: 'object', properties: { giorno: { type: 'string', description: 'AAAA-MM-GG; vuoto = oggi' } } } } },
  { type: 'function', function: { name: 'create_calendar_event', description: 'Fissa una call o un appuntamento sul Google Calendar della persona, con il link di Google Meet e gli inviti. Usalo quando ti chiede di fissare, segnare o programmare qualcosa a un giorno e a un\'ora precisi (anche un promemoria). Se manca il giorno o l\'ora, chiedili prima.', parameters: { type: 'object', properties: { titolo: { type: 'string' }, giorno: { type: 'string', description: 'AAAA-MM-GG' }, ora: { type: 'string', description: 'HH:MM, ora italiana' }, durata_minuti: { type: 'integer' }, invitati: { type: 'array', items: { type: 'string' }, description: 'indirizzi email' }, note: { type: 'string' }, con_meet: { type: 'boolean' } }, required: ['titolo', 'giorno', 'ora'] } } },
  { type: 'function', function: { name: 'remember_this', description: 'Salva per sempre una cosa detta dalla persona: una preferenza, una decisione, un fatto sull\'azienda, e SOPRATTUTTO ogni correzione o indicazione su COME vuole che un lavoro sia fatto. Usalo SUBITO, senza chiedere, ogni volta che corregge te o un lavoro degli agenti, o dice «d\'ora in poi», «la prossima volta», «voglio che», «non fare più». Se riguarda il lavoro della squadra metti per_la_squadra=true: la regola arriva agli agenti e vale da subito per tutti i lavori successivi. agente = a chi è rivolta (id del mestiere) oppure vuoto se vale per tutti.', parameters: { type: 'object', properties: { cosa: { type: 'string', description: 'la regola o il fatto, scritto in modo che si capisca da solo fra sei mesi e che un agente possa applicarlo senza aver visto la conversazione' }, per_la_squadra: { type: 'boolean' }, agente: { type: 'string' } }, required: ['cosa'] } } },
  { type: 'function', function: { name: 'get_connections', description: 'Quali piattaforme e chiavi il cliente ha collegato (Shopify, Meta, Google Analytics, Search Console, Google Ads, Klaviyo, ChatGPT, Claude, Higgsfield, casella di posta) e che cosa manca.', parameters: { type: 'object', properties: {} } } },
]

// Il cervello che LyftAI ha gia' (assistente che galleggia, agenti dei report) tiene gli strumenti di sempre.
export const ALL_TOOLS = [...TOOLS, ...LIVE_TOOLS]
// La tab Lyft ha in piu' quelli di Studio: Motore Creativo, Squadra agent, web, calendario, memoria esplicita.
export const LYFT_TOOLS = [...ALL_TOOLS, ...STUDIO_TOOLS]

// Subset VELOCE per i flussi generativi non-conversazionali (insight, azioni,
// note/to-do, report): esclude i tool lenti (competitor via Browserless,
// inventario via bulk Shopify) per non gonfiare la latenza dei job.
const SLOW_TOOL_NAMES = new Set(['get_inventory'])
export const FAST_TOOLS = ALL_TOOLS.filter(t => !SLOW_TOOL_NAMES.has(t.function.name))

// Mappa i periodi degli agent sui preset del timeframe picker delle tab.
const PRESET_MAP = { today: 'today', yesterday: 'yesterday', this_week: 'this_week', last_week: 'last_week', last_7d: 'last_7d', last_14d: 'last_14d', this_month: 'this_month', last_month: 'last_month', last_30d: 'last_30d', last_90d: 'last_90d', ytd: 'ytd' }
// Risolve il periodo del tool: preset noti, 'custom_<since>_<until>' passa
// così com'è (supportato da /api/metrics); ignoto → last_30d MA con nota jit
// esplicita (mai spacciare un periodo per un altro).
function resolvePeriod(period) {
  if (!period) return { preset: 'last_30d', note: null }
  if (PRESET_MAP[period]) return { preset: PRESET_MAP[period], note: null }
  if (/^custom_\d{4}-\d{2}-\d{2}_\d{4}-\d{2}-\d{2}$/.test(period)) return { preset: period, note: null }
  return { preset: 'last_30d', note: `ATTENZIONE: periodo "${period}" non supportato — questi dati coprono last_30d. Dillo esplicitamente all'utente.` }
}

// ── EXECUTOR LIVE (stile Sidekick) ──────────────────────────────────────────
// I tool leggono le route interne ON-DEMAND con l'auth della richiesta
// (cookie di sessione, o CRON_SECRET per call vocali/job) → multi-tenant per
// costruzione, dati sempre freschi, prompt di sistema magro e stabile.
// Ogni risultato torna { data, jit }: le istruzioni di dominio viaggiano COL
// dato (Just-in-Time), non nel system prompt.
// Fallback: se il fetch live fallisce e c'è uno snapshot, si degrada al
// vecchio executeTool (con nota jit), così niente si rompe.
// Le route rispondono spesso 200 con { ok:false, error }: senza questo check
// il tool restituiva oggetti vuoti e l'agente diceva "non ci sono dati".
function routeError(d) {
  if (!d || typeof d !== 'object') return null
  if (d.ok === false || d.configured === false) return d.error || d.reason || 'fonte non disponibile'
  return null
}

async function ifetch(ctx, path) {
  const headers = {}
  if (ctx.cookie) headers.cookie = ctx.cookie
  // Call vocale: il token firmato del workspace autorizza i tool live con le
  // credenziali di QUEL tenant (senza, in call i clienti non avevano dati).
  if (ctx.callToken) headers['x-lyft-call-ws'] = ctx.callToken
  else if (ctx.cronSecret) headers['x-internal-cron'] = ctx.cronSecret
  const r = await fetch(`${ctx.origin}${path}`, { headers, cache: 'no-store', signal: AbortSignal.timeout(25000) })
  if (!r.ok) throw new Error(`HTTP ${r.status}`)
  return r.json()
}
const capArr = (a, n) => Array.isArray(a) ? a.slice(0, n) : a
const JIT_NUM = 'Copia i numeri LETTERALMENTE, senza arrotondare né stimare. Se un campo è null/assente, dillo.'


// Converte un preset in date esplicite (per le route che accettano since/until).
function presetToDates(period) {
  const d = new Date()
  const iso = (x) => x.toISOString().slice(0, 10)
  const back = (n) => { const c = new Date(d); c.setDate(c.getDate() - n); return c }
  const m = /^custom_(\d{4}-\d{2}-\d{2})_(\d{4}-\d{2}-\d{2})$/.exec(period || '')
  if (m) return { since: m[1], until: m[2], label: 'periodo personalizzato' }
  switch (period) {
    case 'today': return { since: iso(d), until: iso(d), label: 'oggi' }
    case 'yesterday': return { since: iso(back(1)), until: iso(back(1)), label: 'ieri' }
    case 'this_week': { const c = new Date(d); const dow = (c.getDay() + 6) % 7; c.setDate(c.getDate() - dow); return { since: iso(c), until: iso(d), label: 'questa settimana' } }
    case 'last_week': { const c = new Date(d); const dow = (c.getDay() + 6) % 7; const end = new Date(c); end.setDate(c.getDate() - dow - 1); const st = new Date(end); st.setDate(end.getDate() - 6); return { since: iso(st), until: iso(end), label: 'settimana scorsa' } }
    case 'this_month': { const c = new Date(d.getFullYear(), d.getMonth(), 1); return { since: iso(c), until: iso(d), label: 'questo mese' } }
    case 'last_month': { const st = new Date(d.getFullYear(), d.getMonth() - 1, 1); const en = new Date(d.getFullYear(), d.getMonth(), 0); return { since: iso(st), until: iso(en), label: 'mese scorso' } }
    case 'last_7d': return { since: iso(back(6)), until: iso(d), label: 'ultimi 7 giorni' }
    case 'last_14d': return { since: iso(back(13)), until: iso(d), label: 'ultimi 14 giorni' }
    case 'last_90d': return { since: iso(back(89)), until: iso(d), label: 'ultimi 90 giorni' }
    case 'ytd': return { since: iso(new Date(d.getFullYear(), 0, 1)), until: iso(d), label: 'da inizio anno' }
    default: return { since: iso(back(29)), until: iso(d), label: 'ultimi 30 giorni' }
  }
}

async function liveResult(name, args, ctx) {
  if (name === 'get_creative_engine') {
    const d = await ifetch(ctx, '/api/motore/board').catch(() => null)
    if (!d || d.error || !Array.isArray(d.righe)) return { data: { stato: 'non disponibile', motivo: d?.error || 'il Motore Creativo non è acceso per questo cliente o non risponde' }, jit: 'Di\' che il Motore Creativo non è acceso o non ha dati, e che si accende dalla tab Motore Creativo.' }
    const conta = {}; for (const r of d.righe) conta[r.bandaLabel || r.banda || '—'] = (conta[r.bandaLabel || r.banda || '—'] || 0) + 1
    const n = Math.min(Math.max(Number(args.limit) || 8, 1), 20)
    const top = [...d.righe].sort((a, b) => (b.spend || 0) - (a.spend || 0)).slice(0, n).map(r => ({ nome: r.name, verdetto: r.bandaLabel || r.banda, perche: r.perche || null, spesa: Math.round(r.spend || 0), roas: +(r.roas || 0).toFixed(2), acquisti: r.purchases, costo_per_ordine: r.cpo ? Math.round(r.cpo) : null, frequenza: r.frequency ? +Number(r.frequency).toFixed(2) : null, giorni: r.eta ?? null }))
    return { data: { cliente: d.cliente?.nome || null, periodo: d.periodo || null, account: d.account || null, creativita: d.righe.length, per_verdetto: conta, piu_spesa: top }, jit: `Verdetti del Motore Creativo. ${JIT_NUM} Non proporre di spegnere una creatività che il Motore tiene: di' il verdetto e il suo perché.` }
  }
  if (name === 'get_agent_team') {
    const d = await ifetch(ctx, '/api/squadra/stato').catch(() => null)
    if (!d || !d.ok) return { data: { stato: 'nessuna squadra', motivo: 'questo cliente non ha ancora una squadra attiva' }, jit: 'Di\' che la squadra non c\'è ancora e che si crea dalla tab Squadra agent.' }
    const daDecidere = (d.lavori || []).filter(l => ['in_revisione', 'errore_pubblicazione', 'programmato'].includes(l.stato))
    return { data: {
      cliente: d.cliente, giri_oggi: d.giri_oggi,
      agenti: (d.agenti || []).map(a => ({ id: a.id, nome: a.nome, ruolo: a.ruolo, sta_lavorando_su: a.stato?.inCorso || null, ultimo: a.stato?.ultimo ? String(a.stato.ultimo).slice(0, 160) : null, prossimo_giro: a.prossimo ? `${a.prossimo.giorno} ${a.prossimo.ora}` : null, in_coda: a.in_coda })),
      da_decidere: daDecidere.slice(0, 12).map(l => ({ titolo: l.titolo, autore: l.autore_nome || l.autore, stato: l.stato, quando: l.aggiornato, riassunto: String(l.riassunto || '').slice(0, 300) })),
      bacheca: (d.bacheca || []).slice(0, 8).map(m => ({ da: m.da, quando: m.quando, testo: String(m.testo || '').slice(0, 220) })),
    }, jit: 'Stato vero della squadra. I lavori "da decidere" si approvano nella tab Squadra agent: tu non approvi né pubblichi niente. Se in bacheca ci sono errori ripetuti (per esempio credito esaurito), dillo per primo.' }
  }
  if (name === 'give_agent_task') {
    const agente = String(args.agente || '').toLowerCase().trim(), compito = String(args.compito || '').trim()
    if (!/^[a-z]{2,24}$/.test(agente) || compito.length < 8) return { data: { ok: false, errore: 'servono l\'agente e un compito chiaro' }, jit: 'Chiedi alla persona a chi dare l\'incarico e che cosa deve fare.' }
    const headers = { 'Content-Type': 'application/json' }; if (ctx.cookie) headers.cookie = ctx.cookie
    // Un incarico e' un'azione: parte solo dalla sessione di una persona, mai da un cron o da una chiamata vocale.
    if (!ctx.cookie) return { data: { ok: false, errore: 'da qui non posso dare incarichi' }, jit: 'Di\' che gli incarichi si danno dalla tab Lyft o dalla tab Squadra agent.' }
    const r = await fetch(`${ctx.origin}/api/squadra/incarico`, { method: 'POST', headers, body: JSON.stringify({ agente, compito }), cache: 'no-store', signal: AbortSignal.timeout(25000) })
    const j = await r.json().catch(() => ({}))
    return { data: { ok: !!j.ok, agente, incarico: j.id || null, errore: j.ok ? null : (j.errore || `HTTP ${r.status}`) }, jit: j.ok ? 'Incarico PASSATO, non ancora fatto: di\' a chi l\'hai dato e che avviserai tu appena l\'agente ha finito. Non dire che è fatto e non inventare il risultato.' : 'L\'incarico NON è partito: di\' il motivo così com\'è, senza addolcirlo.' }
  }
  if (name === 'browse_web') {
    const obiettivo = String(args.obiettivo || '').trim().slice(0, 700)
    if (obiettivo.length < 4) return { data: { errore: 'manca cosa cercare' }, jit: 'Chiedi che cosa deve cercare o aprire.' }
    if (!ctx.snapshot?._estensione) return { data: { estensione: false }, jit: 'L\'estensione Lyft del browser NON è installata: dillo, e proponi di cercare comunque online con search_web (senza aprire schede).' }
    return { data: { pronto: true }, jit: `La navigazione parte nel browser della persona appena finisci di rispondere. Scrivi UNA frase che dice cosa stai per andare a vedere e poi, su una riga a parte, esattamente: [[NAVIGA: ${obiettivo}]] . Non scrivere risultati: arriveranno dalla navigazione.` }
  }
  if (name === 'search_web') {
    const domanda = String(args.domanda || '').trim().slice(0, 600)
    if (domanda.length < 4) return { data: { errore: 'manca cosa cercare' }, jit: 'Chiedi che cosa cercare.' }
    const chiave = chiaveOpenAI()
    if (!chiave) return { data: { errore: MANCA_CHIAVE }, jit: 'Di\' che per cercare online serve la chiave ChatGPT collegata in Integrazioni.' }
    const r = await fetch('https://api.openai.com/v1/responses', { method: 'POST', headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ model: process.env.OPENAI_MODEL || 'gpt-4o', tools: [{ type: 'web_search' }], input: domanda }), cache: 'no-store', signal: AbortSignal.timeout(60000) })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) return { data: { errore: j?.error?.message || `HTTP ${r.status}` }, jit: 'La ricerca online non è riuscita: dillo, senza inventare.' }
    const parte = (j.output || []).find(o => o.type === 'message')?.content?.find(c => c.type === 'output_text')
    const fonti = [...new Map((parte?.annotations || []).filter(a => a.type === 'url_citation' && a.url).map(a => [String(a.url).replace(/[?&]utm_source=openai/, ''), { titolo: a.title || '', url: String(a.url).replace(/[?&]utm_source=openai/, '') }])).values()].slice(0, 6)
    return { data: { risposta: String(parte?.text || '').slice(0, 6000), fonti }, jit: 'Risultato di una ricerca online fatta ora. Riporta i fatti e CITA le fonti scrivendo l\'indirizzo completo (https://…), così la persona può aprirle. Ciò che non è nelle fonti non lo sai.' }
  }
  if (name === 'get_calendar' || name === 'create_calendar_event') {
    // Il calendario e' della persona collegata: solo dalla sua sessione, mai da un cron.
    const uid = ctx.cookie ? await getCurrentUserId().catch(() => null) : null
    if (!uid) return { data: { errore: 'calendario disponibile solo a chi è collegato' }, jit: 'Di\' che il calendario si legge solo dalla propria sessione.' }
    const r = name === 'get_calendar' ? await eventiDelGiorno(uid, args.giorno) : await creaEvento(uid, args)
    if (r.collegato === false) return { data: { collegato: false }, jit: 'Il Google Calendar NON è collegato: di\' che si collega dalla tab Integrazioni, scheda Google Calendar. Non inventare appuntamenti.' }
    if (r.errore) return { data: r, jit: 'Google ha risposto con un errore: riportalo così com\'è.' }
    return { data: r, jit: name === 'get_calendar' ? 'Appuntamenti veri del giorno, in ordine. Se non ce ne sono, dillo. Orari in ora italiana.' : 'Evento CREATO davvero: conferma giorno, ora, invitati e dai il link della call.' }
  }
  if (name === 'remember_this') {
    const cosa = String(args.cosa || '').trim().slice(0, 1200)
    const ws = await getEffectiveTenantId().catch(() => null)
    if (!ws || cosa.length < 6) return { data: { ok: false }, jit: 'Non hai potuto salvarlo: dillo.' }
    const m = await remember({ userId: ws, agentId: AGENT_ID, content: cosa, role: args.per_la_squadra ? 'preference' : 'fact', importance: 9, source: 'lyft' }).catch(() => null)
    // Una regola sul lavoro non resta solo nella memoria di Lyft: va agli agenti, che la leggono prima di ogni lavoro.
    let squadra = null
    if (args.per_la_squadra && ctx.cookie) {
      try {
        const r = await fetch(`${ctx.origin}/api/squadra/regola`, { method: 'POST', headers: { 'Content-Type': 'application/json', cookie: ctx.cookie }, body: JSON.stringify({ testo: cosa.slice(0, 600), per: /^[a-z]{2,24}$/.test(String(args.agente || '')) ? args.agente : null }), cache: 'no-store', signal: AbortSignal.timeout(20000) })
        const j = await r.json().catch(() => ({}))
        squadra = j.ok ? 'ricevuta' : (j.codice === 'senza_squadra' ? 'nessuna squadra' : (j.errore || `non ricevuta (HTTP ${r.status})`))
      } catch { squadra = 'non raggiungibile' }
    }
    return { data: { memoria: !!m, squadra }, jit: `${m ? 'Salvato nella memoria a lungo termine.' : 'Il salvataggio in memoria NON è riuscito: dillo.'} ${squadra === 'ricevuta' ? 'La squadra ha ricevuto la regola: vale da subito per i prossimi lavori. Conferma in una frase cosa hai segnato e che gli agenti lo sanno.' : squadra ? `La regola NON è arrivata alla squadra (${squadra}): dillo chiaramente, non dire che gli agenti lo sanno.` : 'Conferma in una frase cosa hai segnato.'}` }
  }
  if (name === 'get_connections') {
    const [st, ch] = await Promise.all([ifetch(ctx, '/api/integrations/status').catch(() => null), ifetch(ctx, '/api/integrations/chiavi').catch(() => null)])
    const con = new Set(st?.connected || []), k = ch?.servizi || {}
    const stato = { shopify: con.has('shopify') || !!st?.shopifyStore, meta: con.has('facebook') && !!st?.metaAccountId, google_analytics: !!st?.ga4PropertyId, search_console: !!st?.gscSiteUrl, google_ads: !!st?.adsCustomerId, klaviyo: con.has('klaviyo-oauth'), chatgpt: !!k.openai, claude: !!k.anthropic, higgsfield: !!k.higgsfield, casella_di_posta: !!k.posta }
    return { data: { collegati: Object.keys(stato).filter(x => stato[x]), mancanti: Object.keys(stato).filter(x => !stato[x]) }, jit: 'Stato vero dei collegamenti. Ciò che manca si collega dalla tab Integrazioni, dove c\'è la guida passo per passo.' }
  }
  if (name === 'get_kpis') {
    const { preset, note } = resolvePeriod(args.period)
    const d = await ifetch(ctx, `/api/metrics?preset=${preset}`)
    // COMPATTO: il payload intero di /api/metrics (weekly+monthly+daily) veniva
    // troncato prima dei TOTALI del periodo → il modello leggeva un JSON monco
    // e sommava a mano le settimane. Qui passiamo solo ciò che serve.
    const compact = d && typeof d === 'object' ? {
      periodo: preset,
      shopify: d.shopifyRange || null,
      shopifyPrecedente: d.shopifyPrevRange || null,
      meta: d.metaRange || null,
      metaPrecedente: d.metaPrevRange || null,
      
      aov30g: d.aovLive ?? null,   // finestra FISSA 30 giorni (non del preset)
      ordini30g: d.ordersLive ?? null,
      topProdotti: capArr(d.shopifyTopProducts || d.topProducts, 5),
      canali: capArr(d.shopifyMarketingSources, 5),
      fonti: d.sources || null,
    } : d
    return { data: compact, jit: `KPI live del periodo ${preset}. ${JIT_NUM} \`shopify\` e \`meta\` sono i totali ESATTI del periodo: non sommare nulla. ROAS/MER NON sono precalcolati: se servono, ricavali (ROAS = meta.purchaseValue / meta.spend; MER = shopify.revenue / meta.spend) e dì che è un calcolo. \`aov30g\`/\`ordini30g\` sono su finestra fissa 30 giorni: NON usarli come dato del periodo. Per la spesa Google usa get_google_campaigns.${note ? ' ' + note : ''}` }
  }
  if (name === 'list_creatives') {
    // Fonte creative-level VERA (/api/creative): con meta-detail?level=adsets
    // l'agente spacciava nomi di ADSET per creatività.
    const { preset, note } = resolvePeriod(args.period)
    const d = await ifetch(ctx, `/api/creative?preset=${preset}`)
    let rows = d?.rows || d?.creatives || d?.ads || []
    if (args.name) {
      const q = String(args.name).toLowerCase()
      const hit = rows.filter(r => `${r.name || ''} ${r.adset_name || ''} ${r.campaign_name || ''}`.toLowerCase().includes(q))
      if (hit.length) rows = hit
    }
    const SK = { ctr: 'ctr_link', cpc: 'cpc_link', purchases: 'purchases', spend: 'spend', roas: 'roas' }
    const k = SK[String(args.sort || 'spend').replace(/^-/, '')] || 'spend'
    rows = [...rows].sort((a, b) => (Number(b[k]) || 0) - (Number(a[k]) || 0))
    return {
      data: { rows: capArr(rows, Math.min(args.limit || 10, 25)), totals: d?.summary || null, periodo: preset },
      jit: `Creatività Meta live (periodo ${preset}). ${JIT_NUM} Cita i NOMI esatti delle creative.${note ? ' ' + note : ''}`,
    }
  }
  if (name === 'list_adsets') {
    const { preset, note } = resolvePeriod(args.period)
    // La route accetta 'campaigns' | 'adsets' | 'ads' (con adset_id): usare
    // 'ad'/'adset' dava 400 → l'agente rispondeva sempre "non ho i dati".
    const level = 'adsets'
    const d = await ifetch(ctx, `/api/meta-detail?level=${level}&preset=${preset}`)
    let rows = d?.campaigns || d?.rows || d?.data || []
    // Filtro per nome e ordinamento richiesti dal modello: prima venivano
    // applicati SOLO nel fallback snapshot → "non la trovo" su richieste per nome.
    if (args.name) {
      const q = String(args.name).toLowerCase()
      const hit = rows.filter(r => String(r.name || r.campaign_name || r.ad_name || '').toLowerCase().includes(q))
      if (hit.length) rows = hit
    }
    if (args.sort) {
      // le righe Meta usano ctr_link/cpc_link/purchase_value: mappa i nomi
      const MAP = { ctr: 'ctr_link', cpc: 'cpc_link', purchases: 'purchases', spend: 'spend', roas: 'roas' }
      const k = MAP[String(args.sort).replace(/^-/, '')] || String(args.sort)
      rows = [...rows].sort((a, b) => (Number(b[k]) || 0) - (Number(a[k]) || 0))
    }
    rows = capArr(rows, Math.min(args.limit || 10, 25))
    return { data: { rows, totals: d?.summary || null }, jit: `Meta Ads live (adset con le creative aggregate). ${JIT_NUM} Cita i NOMI esatti di campagne/adset/creative.${note ? ' ' + note : ''}` }
  }
  if (name === 'get_google_campaigns') {
    const { preset, note } = resolvePeriod(args.period)
    const d = await ifetch(ctx, `/api/google-detail?level=campaigns&preset=${preset}`)
    const rows = capArr(d?.rows || d?.campaigns || d?.data || [], Math.min(args.limit || 10, 25))
    const rerr = routeError(d)
    return { data: { rows, totals: d?.summary || null, errore: rerr }, jit: `${rerr ? `ATTENZIONE: la fonte Google ha risposto "${rerr}": dillo apertamente invece di concludere che non ci sono campagne. ` : ''}Google Ads live. ${JIT_NUM} ROAS Google = valore conv. ÷ spesa; le campagne PMAX non hanno breakdown keyword.${note ? ' ' + note : ''}` }
  }
  if (name === 'get_search_console') {
    const sites = await ifetch(ctx, '/api/gsc?action=sites')
    const site = sites?.saved || sites?.sites?.[0]?.siteUrl
    if (!site) return { data: { error: 'Search Console non collegata' }, jit: 'Suggerisci di collegare Google in Onboarding.' }
    const days = [7, 28, 90, 180].includes(args.days) ? args.days : 28
    const d = await ifetch(ctx, `/api/gsc?site=${encodeURIComponent(site)}&days=${days}`)
    return { data: { site, totals: d?.totals, deltas: d?.deltas, topQueries: capArr(d?.queries, 15), opportunities: { nearFirstPage: capArr(d?.opportunities?.nearFirstPage, 8), lowCtr: capArr(d?.opportunities?.lowCtr, 8) }, branded: d?.branded }, jit: `Search Console live (${days}g). ${JIT_NUM} "Posizione" più BASSA = migliore; delta position negativo = miglioramento.` }
  }
  if (name === 'get_incrementality') {
    const days = Number.isFinite(args.days) ? args.days : 90
    const d = await ifetch(ctx, `/api/incrementality?days=${days}`)
    const dc = d && typeof d === 'object' ? { ok: d.ok !== false, motivo: d.reason || null, canali: capArr(d.channels, 6), fatturatoTotale: d.totalRevenue ?? null, baseOrganica: d.baselineRevenue ?? null, affidabilita: d.confidence ?? d.r2 ?? null, giorni: days } : d
    return { data: dc, jit: `Incrementalità live. ${JIT_NUM} Il ROAS INCREMENTALE è più basso del ROAS di piattaforma per costruzione (esclude vendite che sarebbero arrivate comunque): NON confrontarli come se fossero la stessa metrica. Cita anche l'affidabilità della stima.` }
  }
  if (name === 'get_inventory') {
    const d = await ifetch(ctx, '/api/inventory')
    // Ordinati per PRIORITÀ: senza sort il cap prendeva le prime 20 righe
    // (tutte a rischio zero) e l'agente concludeva "nessun rischio stockout".
    const items = [...(d?.items || [])].sort((a, b) => (Number(b.priorityScore) || 0) - (Number(a.priorityScore) || 0))
    return { data: { kpi: d?.kpis || null, aRischio: capArr(items, 20), totale: (d?.items || []).length }, jit: `Inventario live. ${JIT_NUM} Le righe sono già ordinate per priorità (giorni a stockout + valore perso): cita le prime.` }
  }
  if (name === 'get_email_marketing') {
    const days = Number.isFinite(args.days) ? args.days : 30
    const [d, bd] = await Promise.all([
      ifetch(ctx, `/api/klaviyo?days=${days}`),
      ifetch(ctx, `/api/klaviyo?part=breakdown&days=${days}`).catch(() => null),
    ])
    const c = d && typeof d === 'object' ? {
      account: d.account?.name || null,
      kpi: d.kpis ? { inviate: d.kpis.received?.total, aperture: d.kpis.opened?.total, click: d.kpis.clicked?.total, openRate: d.kpis.openRate, clickRate: d.kpis.clickRate, fatturato: d.kpis.revenue?.total } : null,
      campagneInviate: capArr((bd?.revenueBreakdown?.campaigns?.rows || []).map(r => ({ nome: r.name, fatturato: r.revenue, destinatari: r.recipients, aperture: r.openRate, click: r.clickRate })), 10),
      flussiTop: capArr((bd?.revenueBreakdown?.flows?.rows || []).map(r => ({ nome: r.name, fatturato: r.revenue })), 8),
      flussi: capArr((d.flows || []).map(f => ({ nome: f.name, stato: f.status })), 10),
      liste: (d.lists || []).length, segmenti: (d.segments || []).length,
    } : d
    return { data: c, jit: `Email marketing live (${days}g). ${JIT_NUM} \`kpi.fatturato\` è il totale ordini del negozio nella finestra (metrica Placed Order), NON il fatturato attribuito alle email: per l'attribuzione usa \`campagneInviate[].fatturato\` e \`flussiTop[].fatturato\`.` }
  }
  if (name === 'get_pnl') {
    const months = Number.isFinite(args.months) ? Math.min(24, args.months) : 6
    const d = await ifetch(ctx, `/api/pnl?months=${months}`)
    const c = d && typeof d === 'object' ? { mesi: capArr(d.series, months), cogsPerMese: d.cogsByMonth || null, commissioniPerMese: d.feesByMonth || null, margineMedio: d.avgMargin ?? null, fonteCogs: d.cogsSource || null } : d
    return { data: c, jit: `Conto economico live (${months} mesi). ${JIT_NUM} EBIT e margine dipendono dai costi configurati: se mancano, dillo invece di stimare.` }
  }
  if (name === 'get_cro') {
    // /api/cro accetta SOLO since/until: col preset rispondeva sempre 30 giorni
    // etichettati col periodo chiesto (numeri sbagliati con sicurezza).
    const { since, until, label } = presetToDates(args.period)
    const d = await ifetch(ctx, `/api/cro?since=${since}&until=${until}`)
    const c = d && typeof d === 'object' ? { funnel: d.funnel || null, fatturato: d.totalRevenue, ordini: d.totalOrders, sessioni: d.sessions, nuoviClienti: d.newCustomers, ritornanti: d.returningCustomers, precedente: d.prev || null, periodo: d.range || { since, until } } : d
    return { data: c, jit: `Funnel sito live (${label}: ${since} → ${until}). ${JIT_NUM} Conversion rate = acquisti / sessioni.` }
  }
  if (name === 'get_customers') {
    const d = await ifetch(ctx, '/api/customers')
    const segs = d?.segments || {}
    const c = { kpi: d?.kpis || null, segmenti: Object.fromEntries(Object.entries(segs).map(([k, v]) => [k, { clienti: v?.count, valoreMedio: v?.customerValue, ordiniMedi: v?.avgOrders, giorniTraOrdini: v?.daysBetween }])) }
    return { data: c, jit: `Base clienti live (RFM). ${JIT_NUM} I segmenti a rischio sono quelli col valore recuperabile più alto: citali per primi se la domanda è su retention.` }
  }
  if (name === 'get_ga4_traffic') {
    const days = Number.isFinite(args.days) ? args.days : 30
    const d = await ifetch(ctx, `/api/ga4?days=${days}`)
    const c = d && typeof d === 'object' ? { totali: d.summary || null, canali: capArr(d.channels, 8), pagine: capArr(d.topPages, 8), paesi: capArr(d.topCountries, 6), configurato: d.configured !== false } : d
    return { data: c, jit: `Traffico GA4 live (${days}g). ${JIT_NUM} Le sessioni GA4 possono differire da quelle Shopify: sono strumenti di misura diversi, non sono un errore.` }
  }
  if (name === 'get_ltv') {
    const d = await ifetch(ctx, '/api/ltv-auto?months=24')
    return { data: d, jit: `LTV live. ${JIT_NUM} Attenzione: qui c'è solo l'LTV LORDO proiettato (projectedLtvGross), l'AOV e il repeat rate. LTV NETTO, CAC e ratio LTV:CAC NON sono in questi dati: per il netto serve il margine (get_pnl o costi prodotto) e per il CAC la spesa ads / nuovi clienti (get_kpis). Se li citi, dichiara che è un tuo calcolo.` }
  }
  if (name === 'list_products') {
    const d = await ifetch(ctx, '/api/product-performance')
    // Ordinati per ricavo: senza sort il cap prendeva 10 prodotti a caso su migliaia
    const all = [...(d?.products || d?.rows || [])].sort((a, b) => (Number(b.netRevenue) || 0) - (Number(a.netRevenue) || 0))
    const rows = capArr(all, Math.min(args.limit || 10, 20))
    return { data: { rows, totals: d?.totals || null }, jit: `Top prodotti per ricavo (P&L per prodotto). ${JIT_NUM} Guarda il margine operativo, non solo il ricavo.` }
  }
  return null // tool solo-snapshot (tasks, lyftimer)
}

// Micro-cache per-istanza dei risultati live (TTL 90s): nella stessa
// conversazione ridomandare un dato non rifà il fetch → round molto più rapidi.
const liveCache = new Map() // key → { out, ts }
const LIVE_TTL_MS = 90_000

export async function executeToolLive(name, args = {}, ctx = {}) {
  const canLive = ctx && ctx.origin && (ctx.cookie || ctx.cronSecret || ctx.callToken)
  if (canLive) {
    // Hash dell'INTERO cookie (l'active_workspace può stare ovunque nell'header:
    // gli ultimi 40 char mischiavano i workspace di un'agency entro i 90s) +
    // eventuale workspaceId esplicito del chiamante.
    const ident = createHash('sha1').update(String(ctx.cookie || ctx.callToken || ctx.cronSecret) + '|' + (ctx.workspaceId || '')).digest('hex')
    const key = `${ident}|${name}|${JSON.stringify(args)}`
    const hit = liveCache.get(key)
    if (hit && Date.now() - hit.ts < LIVE_TTL_MS) return hit.out
    try {
      const out = await liveResult(name, args, ctx)
      if (out) {
        if (liveCache.size > 300) liveCache.clear()
        liveCache.set(key, { out, ts: Date.now() })
        return out
      }
    } catch (e) {
      // live fallito → si degrada allo snapshot sotto
    }
  }
  if (ctx.snapshot) {
    const data = executeTool(name, args, ctx.snapshot)
    return { data, jit: 'Dato da snapshot (potrebbe non essere aggiornatissimo): se il numero è critico, dillo.' }
  }
  return { data: { error: 'dato non disponibile al momento' }, jit: 'Di\' onestamente che il dato non è raggiungibile ora, senza inventare.' }
}

const lc = s => String(s || '').toLowerCase()
const byNum = key => (a, b) => (Number(b[key]) || 0) - (Number(a[key]) || 0)

export function executeTool(name, args = {}, d = {}) {
  try {
    if (name === 'get_kpis') return periodKPIs(d, PERIODS.includes(args.period) ? args.period : 'last_30d')

    if (name === 'list_creatives') {
      let arr = Array.isArray(d.creatives) ? [...d.creatives] : []
      if (args.name) arr = arr.filter(c => lc(c.name).includes(lc(args.name)))
      const key = { spend: 'spend', roas: 'roas', ctr: 'ctr', purchases: 'purchases' }[args.sort] || 'spend'
      arr.sort(byNum(key))
      return arr.slice(0, Math.min(args.limit || 8, 20)).map(c => ({
        name: c.name, adset: c.adset, campaign: c.campaign, spend: Math.round(c.spend || 0),
        roas: c.roas, ctr: c.ctr, cpc: c.cpc, purchases: c.purchases,
        copy: c.copy ? String(c.copy).slice(0, 180) : null, cta: c.cta,
        products: Array.isArray(c.products) ? c.products.map(p => p.name).filter(Boolean).slice(0, 6) : [],
      }))
    }

    if (name === 'list_adsets') {
      let rows = Array.isArray(d.metaDetail?.campaigns) ? [...d.metaDetail.campaigns] : []
      if (args.name) rows = rows.filter(r => lc(r.adset_name).includes(lc(args.name)) || lc(r.campaign_name).includes(lc(args.name)) || lc(r.name).includes(lc(args.name)))
      const key = { spend: 'spend', roas: 'roas', ctr: 'ctr_link', purchases: 'purchases' }[args.sort] || 'spend'
      rows.sort(byNum(key))
      return rows.slice(0, Math.min(args.limit || 8, 25)).map(r => ({
        campaign: r.campaign_name, adset: r.adset_name, ad: r.ad_name || r.name,
        spend: Math.round(r.spend || 0), roas: r.roas, ctr: r.ctr_link, cpc: r.cpc_link,
        frequency: r.frequency, purchases: r.purchases, purchase_value: r.purchase_value, status: r.status,
      }))
    }

    if (name === 'list_tasks') {
      let tasks = Array.isArray(d._tasks) ? [...d._tasks] : []
      if (args.status) tasks = tasks.filter(t => lc(t.status) === lc(args.status))
      if (args.assignee) tasks = tasks.filter(t => lc(t.assignee_name || t.assignee).includes(lc(args.assignee)))
      return tasks.slice(0, 30).map(t => ({ title: t.title, status: t.status, priority: t.priority, assignee: t.assignee_name || t.assignee || null, due_date: t.due_date }))
    }

    if (name === 'get_time_tracking') {
      const lt = d._lyftimer || {}
      let entries = Array.isArray(lt.byPerson) ? lt.byPerson : (Array.isArray(lt.entries) ? lt.entries : [])
      if (args.person) entries = entries.filter(e => lc(e.name || e.person).includes(lc(args.person)))
      return { totalHours: lt.totalHours ?? null, byPerson: entries.slice(0, 30), byProject: (lt.byProject || []).slice(0, 30) }
    }

    if (name === 'list_products') {
      const arr = Array.isArray(d.shopify?.topProducts) ? d.shopify.topProducts : []
      return arr.slice(0, Math.min(args.limit || 10, 20)).map(p => ({ product: p.label || p.product, revenue: Math.round(p.revenue || 0), orders: p.orders, quantity: p.quantity }))
    }
  } catch (e) {
    return { error: e?.message || 'errore tool' }
  }
  return { error: 'strumento non disponibile in questo contesto (nessun dato live né snapshot): dillo esplicitamente invece di stimare' }
}
