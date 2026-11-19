import { chiaveCliente } from './workspace'
// ============================================================================
//  Generazione della copy — con varianza vera, non sinonimi.
//
//  Due creatività dello stesso angolo devono dire la stessa cosa in modi
//  DIVERSI: attacco diverso, struttura diversa, lunghezza diversa. Cambiare
//  due parole produce la stessa creatività con un'altra didascalia.
//
//  I vincoli del brand sono un filtro, non un suggerimento: la copy che li
//  viola viene rigenerata, non pubblicata con una nota.
// ============================================================================

import { difetti, numeriAmmessi, punteggioCopy, SOGLIA_RENDER, MAX_PAROLE_HEADLINE, MAX_PAROLE_SUB, MAX_PAROLE_CTA } from './qualitaCopy'

// Attacchi diversi: è l'asse che cambia di più la percezione del messaggio.
// I sette attacchi originali. Sono la BASE anche per la copy delle importate
// (copyDaImmagine): cambiare quella lista cambierebbe l'attacco che una
// creativita' gia' esistente riceve se la si rigenera.
export const APERTURE_BASE = [
  { id: 'domanda',    istruzione: 'Apri con una DOMANDA diretta al lettore.' },
  { id: 'affermazione', istruzione: 'Apri con un\'AFFERMAZIONE secca, senza preamboli.' },
  { id: 'numero',     istruzione: 'Apri con un NUMERO concreto preso dai dati del prodotto.' },
  { id: 'obiezione',  istruzione: 'Apri disinnescando un\'OBIEZIONE che il lettore ha già in testa.' },
  { id: 'scena',      istruzione: 'Apri descrivendo una SCENA quotidiana in cui il lettore si riconosce.' },
  { id: 'contrasto',  istruzione: 'Apri con un CONTRASTO fra come va di solito e come va con questo prodotto.' },
  { id: 'confessione', istruzione: 'Apri con una frase in prima persona, come se parlasse il produttore.' },
]

// Tre attacchi in piu' per le creativita' generate. Vengono dal repertorio dei
// gancio per statiche (contrarian, curiosity gap, social proof): sono quelli
// che mancavano e che nella lista sopra nessuno copriva.
// "prova-sociale" esiste solo se ci sono prove vere da citare: senza recensioni
// e senza numeri del brand un attacco di prova sociale e' un invito a inventare.
export const APERTURE_NUOVE = [
  { id: 'contrarian',    istruzione: 'Apri CONTRO un luogo comune della categoria ("Tutti dicono che..., ma...") e ribaltalo con un fatto del prodotto.' },
  { id: 'curiosita',     istruzione: 'Apri con una CURIOSITA\' incompleta: una cosa che il lettore non sa e vuole sapere. Niente clickbait: la risposta arriva nel sottotitolo.' },
  { id: 'prova-sociale', istruzione: 'Apri con la PROVA SOCIALE: cosa dicono i clienti o quanti sono, usando SOLO le citazioni e i numeri forniti qui sotto.', servonoProve: true },
]
export const APERTURE = [...APERTURE_BASE, ...APERTURE_NUOVE]

export const LUNGHEZZE = [
  { id: 'lampo',  istruzione: 'Headline di massimo 4 parole. Sottotitolo di una riga.' },
  { id: 'media',  istruzione: 'Headline su due righe brevi. Sottotitolo di due righe.' },
  { id: 'distesa',istruzione: 'Headline discorsiva. Sottotitolo che aggiunge una prova concreta.' },
]

function prompt({ brief, prodotto, brand, apertura, lunghezza, temi = [], ammessi = [] }) {
  const vietati = (brand?.termini_vietati || []).join(', ')
  const obbligati = (brand?.termini_obbligati || []).join(' · ')
  // Il brief di brand: cio' che i concorrenti non possono dire, le esitazioni
  // vere di chi compra, le prove. Colonne di ce_brand (migrazione 27): finche'
  // non sono compilate la sezione non compare, e il modello non le inventa.
  const obiezioni = (brand?.obiezioni || []).filter(Boolean)
  const prove = brand?.prove && typeof brand.prove === 'object' ? brand.prove : null
  const righeProve = prove ? [
    prove.stelle ? `valutazione media ${prove.stelle} stelle` : null,
    prove.recensioni ? `${prove.recensioni} recensioni` : null,
    ...(Array.isArray(prove.numeri) ? prove.numeri : []),
    prove.testimonianza ? `testimonianza: «${prove.testimonianza}»` : null,
  ].filter(Boolean) : []
  // La lingua dei clienti: i temi ricorrenti delle recensioni con la citazione
  // verbatim. Le loro parole, non le nostre — e' la differenza fra una copy
  // che suona come una persona e una che suona come un brand.
  const righeTemi = temi.slice(0, 4).map(t =>
    `· ${t.nome || t.slug}${t.n ? ` (${t.n} recensioni)` : ''}${t.citazione ? `: «${t.citazione}»` : ''}`)
  return `Sei un copywriter pubblicitario per ${brand?.nome || 'il brand'}.
Tono: ${brand?.tono || 'concreto, senza retorica'}.

Devi scrivere il testo di UNA creatività Meta statica.

PRODOTTO: ${prodotto?.name || 'il prodotto'}${prodotto?.price ? ` — €${prodotto.price}` : ''}
ANGOLO COMUNICATIVO: ${brief.angolo || 'libero'}
FORMATO VISIVO: ${brief.formato || 'libero'}
FASE DEL FUNNEL: ${brief.funnel || 'MOFU'}${brief.persona ? `\nPERSONA: parla a ${brief.persona}` : ''}
${brief.direzione ? `\n${brief.direzione}\n` : ''}${brand?.differenziatore ? `\nCIO' CHE I CONCORRENTI NON POSSONO DIRE: ${brand.differenziatore}` : ''}${obiezioni.length ? `\nESITAZIONI VERE DI CHI COMPRA (scioglierne almeno una): ${obiezioni.join(' · ')}` : ''}
${righeTemi.length ? `\nCOME NE PARLANO I CLIENTI — usa le LORO parole, non le tue:\n${righeTemi.join('\n')}\n` : ''}${righeProve.length ? `\nPROVE DISPONIBILI (le uniche citabili): ${righeProve.join(' · ')}\n` : ''}
VARIAZIONE RICHIESTA — è obbligatoria, non stilistica:
${apertura.istruzione}
${lunghezza.istruzione}

REGOLE DELLA STATICA:
· La HEADLINE è un GANCIO, non un titolo: massimo ${MAX_PAROLE_HEADLINE} parole, e deve lasciare un pensiero
  incompleto o una tensione che il sottotitolo risolve. VIETATE le headline-etichetta che descrivono
  invece di fermare ("Olio italiano autentico", "Qualità garantita", "Scorte perfette"): sono le parole
  che tutti i concorrenti hanno già scritto. Parte a metà frase se serve, con le parole dei clienti.
  Non cominciare con un articolo, un possessivo ("Il nostro…") o un imperativo da catalogo ("Scopri…").
· Il SOTTOTITOLO è una riga di supporto, massimo ${MAX_PAROLE_SUB} parole.${['SOCIAL-PROOF', 'DATA-CALLOUT', 'LISTICLE'].includes(brief.formato) ? `\n· Questo formato vive di PROVA: il sottotitolo porta un numero o una citazione fra quelli forniti. Se non ce ne sono, dillo con un fatto del prodotto, non con una cifra inventata.` : ''}
· La CTA è un'azione di ${MAX_PAROLE_CTA} parole al massimo, coerente con la fase del funnel.

VINCOLI DEL BRAND, non negoziabili:
${vietati ? `· NON usare MAI queste parole: ${vietati}` : ''}
${obbligati ? `· Formule corrette da usare: ${obbligati}` : ''}
· MAI date o annate: mettono una scadenza dentro la creatività.
· Niente claim medici, niente promesse di risultato non verificabili.
· NUMERI AMMESSI: ${ammessi.length ? ammessi.join(', ') : 'nessuno oltre alle piccole quantità (fino a 10)'}. Qualunque altra cifra o percentuale è inventata: non scriverla. Vale anche per "100% italiano", "100% naturale" e simili: sono percentuali, e non sono fra i dati.

Rispondi SOLO JSON:
{"headline":"...","sub":"...","cta":"...","primary_text":"il testo lungo dell'inserzione, 2-4 frasi"}`
}

// Controllo dei vincoli DOPO la generazione: il modello a volte li ignora, e
// una copy che viola una regola del cliente non deve arrivare alla board.
export function violazioni(testo, brand) {
  const t = (Object.values(testo || {}).join(' ') || '').toLowerCase()
  const trovate = []
  for (const v of brand?.termini_vietati || []) {
    if (t.includes(String(v).toLowerCase())) trovate.push(v)
  }
  if (/\b(19|20)\d{2}\s*\/\s*\d{2,4}\b/.test(t)) trovate.push('annata')
  return trovate
}

// Ritorna la copy con il suo punteggio, oppure { scartata: true, motivo }.
// Il motivo si dichiara sempre: "null" era un buco nella tornata che nessuno
// sapeva spiegare.
export async function generaCopy({ brief, prodotto, brand, temi = [], variante = 0, tentativi = 4 }) {
  const key = chiaveCliente('openai')?.chiave
  if (!key) throw new Error('ChatGPT non collegato: inserisci la chiave nella tab Integrazioni')
  const temiUtili = (temi || []).filter(t => t && t.sentiment !== 'negativo' && (t.citazione || t.n))
  const haProve = temiUtili.length > 0 || !!brand?.prove
  const lista = APERTURE.filter(a => !a.servonoProve || haProve)
  const apertura = lista[variante % lista.length]
  const lunghezza = LUNGHEZZE[Math.floor(variante / lista.length) % LUNGHEZZE.length]
  const ammessi = numeriAmmessi({ prodotto, brand, temi: temiUtili })
  const sistema = prompt({ brief, prodotto, brand, apertura, lunghezza, temi: temiUtili, ammessi: [...ammessi] })

  let migliore = null, feedback = null, ultimoMotivo = null
  for (let t = 0; t < tentativi; t++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // Lo scrittore ha il suo modello. Misurato il 17 set 2026 su quattro
        // brief Saracino con lo STESSO giudice (gpt-4o): gpt-4o passava la
        // soglia una volta su dieci, sempre debole sul gancio; gpt-4.1 quattro
        // su quattro (18, 15, 17, 15) in meta' tempo. gpt-5 andava in timeout.
        // Le altre chiamate del motore restano su OPENAI_MODEL.
        model: process.env.OPENAI_MODEL_COPY || 'gpt-4.1',
        temperature: 0.85 + t * 0.05,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: sistema },
          { role: 'user', content: feedback || 'Scrivi.' },
        ],
      }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) { ultimoMotivo = `OpenAI ${res.status}`; continue }
    const j = await res.json()
    let p = {}
    try { p = JSON.parse(j.choices?.[0]?.message?.content || '{}') } catch { ultimoMotivo = 'risposta non JSON'; continue }

    // Prima i fatti: termini vietati, annate, lunghezze, cifre inventate.
    // Si rigenera dicendo ESATTAMENTE cosa non andava — "riscrivi rispettando
    // i vincoli" lasciava il modello a indovinare quale avesse violato.
    const problemi = [
      ...violazioni(p, brand).map(v => v === 'annata' ? 'contiene una data o un\'annata' : `usa il termine vietato "${v}"`),
      ...difetti(p, { ammessi }),
    ]
    if (problemi.length) {
      ultimoMotivo = problemi.join('; ')
      feedback = `Il tentativo precedente non passa: ${ultimoMotivo}. Riscrivi da capo rispettando TUTTE le regole, con lo stesso attacco richiesto.`
      continue
    }
    // Poi il giudizio. Se il giudice non risponde la copy passa lo stesso, col
    // punteggio dichiarato mancante: un giudizio in meno e' meglio di una
    // creativita' in meno.
    const punteggio = await punteggioCopy(p, { brief, prodotto, brand })
    const copia = { ...p, apertura: apertura.id, lunghezza: lunghezza.id, punteggio }
    if (!punteggio || punteggio.errore || punteggio.totale >= SOGLIA_RENDER) return copia
    if (!migliore || punteggio.totale > migliore.punteggio.totale) migliore = copia
    ultimoMotivo = `punteggio ${punteggio.totale}/25 (debole: ${punteggio.debole})`
    feedback = `La copy rispetta i vincoli ma vale ${punteggio.totale}/25, sotto la soglia di ${SOGLIA_RENDER}. `
      + `Dimensione piu' debole: ${punteggio.debole}. ${punteggio.correzione} `
      + (punteggio.debole === 'gancio' ? `La headline «${p.headline}» e' un'etichetta: descrive invece di fermare. Scrivine una che apra una tensione e non la chiuda. ` : '')
      + `Riscrivi con lo stesso attacco richiesto, tenendo cio' che funzionava.`
  }
  // Meglio un buco che una creativita' da buttare — ma il buco si spiega.
  return { scartata: true, motivo: `${ultimoMotivo || 'nessuna copy valida'} dopo ${tentativi} tentativi`,
    ...(migliore ? { migliore } : {}) }
}

// ============================================================================
//  La copy di una creativita' IMPORTATA, ricavata guardando l'immagine.
//
//  Le importate arrivano come file e basta: nel motore entrava il pixel e non
//  una riga di testo, cosi' al momento di caricarle su Meta la copy si andava a
//  cercare altrove o si riscriveva da zero. Recuperarla dalle inserzioni gia'
//  online non funziona — provato: nessuna delle 176 importate corrisponde a una
//  delle 113 gia' su Meta (impronta percettiva, distanza minima 9 su 64: sono
//  creativita' diverse, non le stesse ricompresse).
//
//  Quindi si guarda l'immagine. E qui c'e' la distinzione che regge tutto:
//
//    · headline, sottotitolo e CTA sono STAMPATI sopra la creativita': si
//      LEGGONO, alla lettera. Inventarli vorrebbe dire scrivere nel database
//      una promessa diversa da quella che l'utente vede.
//    · il testo primario NON e' nell'immagine — su Meta sta sopra — e va
//      SCRITTO, coerente con cio' che l'immagine gia' dice.
//
//  Confondere le due cose e' il modo di produrre una copy plausibile e falsa.
// ============================================================================
function promptDaImmagine({ prodotto, brand, angolo, persona, funnel, apertura }) {
  const vietati = (brand?.termini_vietati || []).join(', ')
  const obbligati = (brand?.termini_obbligati || []).join(' · ')
  return `Sei un copywriter pubblicitario per ${brand?.nome || 'il brand'}.
Tono: ${brand?.tono || 'concreto, senza retorica'}.

Ti mostro una creativita' Meta gia' pronta. Devi fare DUE cose diverse, e non vanno confuse.

1) LEGGERE il testo stampato sopra l'immagine, alla lettera:
   · headline — il titolo grande
   · sub — la riga di supporto sotto il titolo, se c'e'
   · cta — il testo dentro il bottone, se c'e'
   Copiali ESATTAMENTE come sono scritti, accenti e punteggiatura compresi. Non
   correggerli, non abbreviarli, non tradurli. Se una di queste cose NON e'
   stampata sull'immagine, metti null: inventarla vorrebbe dire scrivere una
   promessa diversa da quella che la persona vede davvero.

2) SCRIVERE il testo primario, che su Meta sta SOPRA l'immagine e nell'immagine
   non c'e'. Deve reggere quello che la creativita' mostra e dice, senza
   ripetere l'headline parola per parola. Da 2 a 4 frasi.

   ATTACCO OBBLIGATORIO — ${apertura.istruzione}
   Non cominciare con "Scopri", "Approfitta", "Vivi" o un altro imperativo da
   catalogo: sono gli attacchi che scrivono tutti e non dicono niente.

CONTESTO
Prodotto: ${prodotto?.nome_breve || prodotto?.name || 'il prodotto'}
Angolo comunicativo: ${angolo || 'non indicato'}
Fase del funnel: ${funnel || 'MOFU'}${persona ? `\nParla a: ${persona}` : ''}

VINCOLI DEL BRAND, non negoziabili nel testo primario:
${vietati ? `· NON usare MAI queste parole: ${vietati}` : ''}
${obbligati ? `· Formule corrette: ${obbligati}` : ''}
· MAI date o annate: mettono una scadenza dentro la creativita'.
· Niente claim medici, niente promesse di risultato non verificabili.
· Non inventare numeri, prezzi o percentuali: usa solo quelli stampati sull'immagine.

Rispondi SOLO JSON:
{"headline":"...|null","sub":"...|null","cta":"...|null","primary_text":"...","cosa_si_vede":"una frase su cosa mostra l'immagine"}`
}

// L'attacco si ruota anche qui. Le prime otto copy prodotte senza rotazione
// cominciavano TUTTE con "Scopri": centosettantasei creativita' con lo stesso
// incipit non sono centosettantasei creativita', sono una ripetuta. La variante
// si ricava dall'id della riga e non da un contatore, cosi' rigenerando la
// stessa creativita' si riottiene lo stesso attacco invece di un altro a caso.
// Stessa ragione del telaio: "moltiplica per 31" e poi modulo sette distribuisce
// male su stringhe che si somigliano, e gli attacchi finirebbero tutti sugli
// stessi due. FNV-1a mescola i bit invece di sommarli.
function varianteDa(seme) {
  let h = 2166136261
  const t = String(seme || '')
  for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h ^ (h >>> 16)) >>> 0
}

export async function copyDaImmagine({ immagine, prodotto, brand, angolo, persona, funnel, seme, tentativi = 3 }) {
  const key = chiaveCliente('openai')?.chiave
  if (!key) throw new Error('ChatGPT non collegato: inserisci la chiave nella tab Integrazioni')
  const modello = process.env.OPENAI_VISION_MODEL || 'gpt-4o'
  const apertura = APERTURE_BASE[varianteDa(seme ?? immagine) % APERTURE_BASE.length]

  for (let t = 0; t < tentativi; t++) {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: modello,
        temperature: 0.6 + t * 0.1,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: promptDaImmagine({ prodotto, brand, angolo, persona, funnel, apertura }) },
          { role: 'user', content: [
            { type: 'image_url', image_url: { url: immagine, detail: 'high' } },
            ...(t > 0 ? [{ type: 'text', text: 'Il tentativo precedente violava un vincolo del brand. Riscrivi il testo primario rispettandoli tutti. Il testo LETTO sull\'immagine resta quello che c\'e\' scritto.' }] : []),
          ] },
        ],
      }),
      signal: AbortSignal.timeout(60000),
    })
    if (!res.ok) continue
    let p = {}
    try { p = JSON.parse((await res.json()).choices?.[0]?.message?.content || '{}') } catch { continue }
    if (!p.primary_text) continue
    // I vincoli si controllano SOLO su cio' che abbiamo scritto noi. Se una
    // parola vietata e' stampata sulla creativita', e' un fatto: cancellarla
    // dal database non la toglie dall'immagine, la nasconde soltanto.
    const v = violazioni({ primary_text: p.primary_text }, brand)
    if (v.length) continue
    // L'attacco da catalogo passa il controllo dei termini ma non serve a
    // niente: si rigenera come una violazione qualsiasi.
    if (/^\s*(scopri|approfitta|vivi|assapora|regalati)\b/i.test(p.primary_text)) continue
    return { ...p, apertura: apertura.id }
  }
  return null
}
