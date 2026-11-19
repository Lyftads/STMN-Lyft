import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'
import { chiaveOpenAI, conChiaveDelCliente, MANCA_CHIAVE } from '../../../../lib/studio/chiaveAI'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

// ============================================================================
//  La voce di Lyft: una conversazione vera, in tempo reale.
//
//  Stesso impianto dell'assistente personale da cui Lyft nasce: il browser si
//  collega direttamente alla voce in tempo reale di OpenAI (ascolta, parla, si
//  lascia interrompere), e la voce NON sa niente da sola: per ogni domanda vera
//  passa la richiesta al cervello del prodotto e legge la risposta.
//
//  Qui si crea solo la chiave temporanea della conversazione (vale pochi
//  minuti): la chiave vera resta sul server e non arriva mai al browser.
// ============================================================================
const MODELLO = process.env.LYFT_MODELLO_VOCE || 'gpt-realtime-2.1'
const VOCE = process.env.LYFT_VOCE || 'cedar'
const LINGUE = { it: 'italiano', en: 'inglese', es: 'spagnolo', fr: 'francese', de: 'tedesco' }

const istruzioni = (lingua, nome, ctx) => `Sei la VOCE di Lyft, il cervello di questo prodotto${nome ? `; stai parlando con ${nome}` : ''}. Parli ${LINGUE[lingua] || 'italiano'} con un tono rilassato, amichevole e giovane, da collega che si conosce da anni: ritmo di conversazione, intonazione viva e naturale, mai da speaker o da centralino. Tu NON sai niente dei numeri del negozio, delle campagne, degli agenti, dell'agenda: la conoscenza e il ragionamento stanno nel cervello.
PAROLE CHE SENTIRAI (capiscile così, anche se pronunciate in fretta o all'italiana): ${ctx.azienda ? `l'azienda si chiama ${ctx.azienda}; ` : ''}MER, ROAS, CPA, CAC, CPO, AOV, CTR, CPC, CR (tasso di conversione), LTV, Meta, Shopify, Klaviyo, Google Ads, Analytics, Search Console, creatività, inserzioni, campagne, newsletter, Motore Creativo, Squadra agent${ctx.agenti.length ? `; gli agenti della squadra si chiamano ${ctx.agenti.join(', ')}` : ''}. Se una parola ti sembra strana, è quasi sempre una di queste.
REGOLE FERREE:
0. STRADA VELOCE (risposta in un attimo, senza cervello): per i NUMERI del negozio di oggi, ieri o degli ultimi 7 giorni (fatturato, ordini, carrello medio, clienti nuovi, visite, spesa Meta, MER) usa numeri_veloci; per sapere cosa fa la squadra, chi sta lavorando e cosa aspetta una decisione usa squadra_veloce; per i verdetti sulle creatività (quante da scalare, tenere, spegnere) usa creativita_veloci; per gli appuntamenti di oggi usa agenda_veloce. Sulla strada veloce NON dici "un attimo" né altre paroline di attesa: chiami lo strumento in silenzio e rispondi. Con il risultato rispondi TU, subito, nel tuo tono: usa SOLO i numeri che ricevi (arrotondati come li direbbe una persona), niente stime o cause inventate, massimo tre frasi, e rispondi SOLO a ciò che è stato chiesto. Al cervello (chiedi_al_cervello) vanno i PERCHÉ, le analisi, i confronti su più periodi, le cose da ricordare, le ricerche online, l'agenda da modificare e tutto ciò che è un lavoro da fare o da far fare agli agenti.
1. Rispondi da sola SOLO a saluti, frasi di cortesia e ai risultati della strada veloce. Per QUALSIASI altra cosa — numeri, analisi, opinioni, cose da fare, cose da ricordare, appuntamenti, ricerche online, lavori da dare agli agenti, correzioni su come vuole un lavoro — chiama chiedi_al_cervello passando la richiesta COMPLETA e con le parole della persona.
2. Prima di chiamare il CERVELLO (non la strada veloce) di' una sola parolina naturale e ogni volta diversa ("Vedo", "Un secondo", "Ci guardo", "Dammi un attimo", "Vado") e poi STAI ZITTA finché non arriva la risposta: niente "sto aspettando", niente "ci mette un attimo".
3. Quando arriva la risposta del cervello, LEGGILA COSÌ COM'È, ma DETTA come la direbbe una persona: pause dove servono, numeri arrotondati come si dicono a voce, un filo di sorriso sulle buone notizie. Non aggiungere commenti, numeri o dettagli tuoi, non inventare. Gli indirizzi web non si leggono: di' "ti ho messo le fonti a schermo".
4. Se non hai capito bene, chiedi di ripetere invece di indovinare.
5. NIENTE RIPETIZIONI: una cosa detta una volta non si ripete. Se la persona dice solo "ok", "va bene", "perfetto", "grazie": non aggiungere niente o al massimo due parole.
6. I messaggi che iniziano con [AVVISO] non li ha detti la persona: sono notizie da riferirle (un agente ha finito un lavoro, una ricerca nel browser è conclusa). Dille in una o due frasi, con naturalezza.`

const vuoto = { type: 'object', properties: {} }
const VELOCI = [
  { type: 'function', name: 'numeri_veloci', description: 'I numeri del negozio per oggi (finora), ieri o gli ultimi 7 giorni: fatturato, ordini, carrello medio, clienti nuovi, visite e conversione, spesa Meta e MER. Risposta immediata.', parameters: { type: 'object', properties: { periodo: { type: 'string', enum: ['oggi', 'ieri', 'ultimi_7_giorni'] } }, required: ['periodo'] } },
  { type: 'function', name: 'squadra_veloce', description: 'Stato della Squadra agent adesso: chi sta lavorando, prossimi giri, lavori che aspettano una decisione. Risposta immediata.', parameters: vuoto },
  { type: 'function', name: 'creativita_veloci', description: 'Verdetti del Motore Creativo sulle creatività Meta: quante da scalare, in stand by, da spegnere, e le più importanti. Risposta immediata.', parameters: vuoto },
  { type: 'function', name: 'agenda_veloce', description: 'Gli appuntamenti di oggi dal Google Calendar della persona. Risposta immediata.', parameters: vuoto },
]
const STRUMENTI = [...VELOCI, {
  type: 'function', name: 'chiedi_al_cervello',
  description: 'Passa la richiesta al cervello di Lyft, che legge tutti i dati del prodotto e delle piattaforme collegate, comanda gli agenti, ricorda, cerca online, legge e scrive l\'agenda. Restituisce la risposta da dire.',
  parameters: { type: 'object', properties: { domanda: { type: 'string', description: 'La richiesta della persona, completa e con le sue parole (periodo e dettagli compresi).' } }, required: ['domanda'] },
}]

async function POST__(req) {
  if (!(await getCurrentUserId().catch(() => null))) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 })
  const chiave = chiaveOpenAI()
  if (!chiave) return NextResponse.json({ errore: MANCA_CHIAVE }, { status: 400 })
  const b = await req.json().catch(() => ({}))
  const lingua = ['it', 'en', 'es', 'fr', 'de'].includes(b.lingua) ? b.lingua : 'it'
  const nome = String(b.nome || '').replace(/[^\p{L} .'-]/gu, '').trim().slice(0, 40)
  // Nomi propri del cliente (azienda, agenti): arrivano dalla pagina, entrano nelle istruzioni solo come vocabolario.
  const pulito = (x, n) => String(x || '').replace(/[^\p{L}\p{N} .'&-]/gu, '').trim().slice(0, n)
  const ctx = { azienda: pulito(b.azienda, 60), agenti: (Array.isArray(b.agenti) ? b.agenti : []).map(a => pulito(a, 30)).filter(Boolean).slice(0, 14) }
  const r = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
    method: 'POST', headers: { Authorization: `Bearer ${chiave}`, 'Content-Type': 'application/json' }, cache: 'no-store', signal: AbortSignal.timeout(20000),
    body: JSON.stringify({ session: { type: 'realtime', model: MODELLO, instructions: istruzioni(lingua, nome, ctx), tools: STRUMENTI,
      audio: { input: { transcription: { model: 'gpt-4o-transcribe', language: lingua, prompt: `Lyft, MER, ROAS, CPA, CAC, CPO, AOV, Meta, Shopify, Klaviyo, creatività, squadra${ctx.azienda ? ', ' + ctx.azienda : ''}${ctx.agenti.length ? ', ' + ctx.agenti.join(', ') : ''}` }, noise_reduction: { type: 'far_field' }, turn_detection: { type: 'semantic_vad', eagerness: 'medium' } }, output: { voice: VOCE } } } }),
  }).catch(() => null)
  const j = r ? await r.json().catch(() => ({})) : {}
  if (!r || !r.ok || !j.value) return NextResponse.json({ errore: `La voce non è partita: ${j?.error?.message || (r ? `OpenAI ha risposto ${r.status}` : 'OpenAI non risponde')}` }, { status: 502 })
  return NextResponse.json({ chiave: j.value, modello: MODELLO }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export const POST = (req) => conChiaveDelCliente(() => POST__(req), { stretta: true, soloStudio: true })
