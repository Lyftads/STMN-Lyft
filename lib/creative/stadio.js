// Stadio del funnel di una creativita' Meta.
//
// Meta non dice "questa inserzione e' top of funnel": lo si deduce. Tre fonti,
// in ordine di affidabilita', e la prima che risponde vince:
//   1. nomi di campagna e adset (chi fa media buying li scrive: prospecting,
//      retargeting, riattivazione…);
//   2. quota di spesa per pubblico (breakdown nativo user_segment_key di Meta:
//      Nuovo / Ha interagito / Gia' clienti) — dato duro, ma distingue chi
//      VEDE l'annuncio, non cosa dice;
//   3. il testo della creativita' (sconto = fondo, recensione o confronto =
//      mezzo, "bentornato" = riattivazione).
// Chi resta fuori va al ripiego AI (/api/creative-stadio) o, se anche quello
// tace, in cima come ipotesi (`fonte: null`).
//
// Isomorfo: gira nel browser (tab Creative) e sul server (ripiego AI).

export const STADI = ['top', 'middle', 'lower', 'riattivazione']
// Colore della fase, da freddo a caldo (azzurro → rosso): la temperatura del
// pubblico lungo l'imbuto. Esadecimale perche' finisce anche nel WebGL e negli
// attributi SVG, dove var(--…) non vale.
export const COLORE_FASE = { top: '#38bdf8', middle: '#a78bfa', lower: '#f97316', riattivazione: '#ef4444' }

// Nei nomi le parole non valgono tutte uguali. Prima la FASE scritta per
// esteso (TOF/MOF/BOF, REM, riattivazione), poi il PUBBLICO (broad e
// lookalike = freddo; visitatori, carrello, DPA = caldo), per ultimo
// l'EVENTO di ottimizzazione (ATC, purchase): «ADV+_Broad_ATC_TOF» e' una
// campagna di scoperta ottimizzata all'aggiunta al carrello, non retargeting.
const RE = {
  riattivazione: /riattiv|reactiv|re-?activ|win-?back|lapsed|dormant|dormient|inattiv|churn|ex-?client|past-?purch|vecchi-?client|ex-?customer|lost-?customer|\bclienti\b|\bcustomers?\b|\bbuyers?\b|\bpurchasers?\b|acquirenti|\bcrm\b|\bltv\b/i,
  // fase scritta per esteso
  faseTop: /\btofu?\b|\btop\b|awareness|\bawr\b|scoperta|discovery|prospect|acquisi|\bcold\b/i,
  faseMiddle: /\bmofu?\b|middle|consider|\bwarm\b/i,
  faseLower: /\bbofu?\b|bottom|\brem\b|\brmk\b|\brtg\b|retarget|remarket|conversion/i,
  // pubblico
  pubblicoCaldo: /\bdpa\d*\b|catalog|visitator|visitors?|carrello|\bcart\b|checkout|abbandon|abandon|view-?content|\bvc\b|\bhot\b|\batc\b|add-?to-?cart|\bweb\b|site-?visit/i,
  pubblicoTiepido: /engag|interag|video-?view|\bvv\d*\b|\bvideow\b|social-?proof|\bugc\b|testimon|ig-?fb|fb-?ig/i,
  pubblicoFreddo: /\bbroad\b|lookalike|\blal\b|\blla\b|interest|interess|\bnuovi\b|\bnew\b|\basc\b|\bdaba\b|advantage\+?\s*shopping|\badv\+/i,
}

const TESTO = {
  riattivazione: /bentornat|ci manchi|ci sei mancat|torna da noi|welcome back|we miss you|miss you|è passato un po|it'?s been a while|come back|vuelve|te echamos|reviens|tu nous manques|komm zurück|wir vermissen/i,
  lower: /\b\d{1,2}\s?%|sconto|scont[io]|offerta|promo\b|promozion|codice|coupon|spedizione gratis|free shipping|ultimi pezzi|ultime ore|solo oggi|scade|black friday|saldi|\bsale\b|\boff\b|-\d{1,2}\s?%|descuento|envío gratis|réduction|livraison offerte|rabatt|gratis versand|last chance|ultima occasione|hurry|affrettati/i,
  middle: /recension|review|★|⭐|stelle|stars|clienti dicono|dicono di noi|testimon|\bvs\.?\b|confront|comparis|perch[eé] scegliere|why choose|differenza|difference|us vs|come funziona|how it works|ingredient|risultati in \d+|results in \d+|before.*after|prima.*dopo|garanzia|guarantee|cosa succede|what happens/i,
}

function testo(row) {
  const v = row?.variants || {}
  return [
    row?.copy, row?.headline, row?.description, row?.cta,
    ...(v.copies || []), ...(v.headlines || []), ...(v.descriptions || []),
  ].filter(Boolean).join(' \n ')
}

// `segments`: cio' che da' /api/meta-segments?level=ad per un annuncio:
// { new: { spend, share… }, engaged: {…}, returning: {…}, unknown: {…} }.
// Lo "sconosciuto" non entra nel totale: non dice nulla sul funnel.
function quote(segments) {
  if (!segments || typeof segments !== 'object') return null
  const q = { new: 0, engaged: 0, returning: 0 }
  let tot = 0
  for (const k of Object.keys(q)) {
    const v = Number(segments[k]?.spend) || 0
    q[k] = v; tot += v
  }
  if (!tot) return null
  return { new: q.new / tot, engaged: q.engaged / tot, returning: q.returning / tot }
}

function daNomi(row) {
  // I nomi di campagna sono fatti di pezzi uniti da _ . - : per le regex
  // l'underscore e' una lettera, quindi \bdpa\b non trovava mai
  // «ABO_DPA_REM». Si spezzano in parole prima di leggerli.
  const nome = `${row?.campaign_name || ''} | ${row?.adset_name || ''}`.replace(/[_.\-/|:()+]+/g, ' ')
  if (RE.riattivazione.test(nome)) return 'riattivazione'
  if (RE.faseLower.test(nome)) return 'lower'
  if (RE.faseMiddle.test(nome)) return 'middle'
  if (RE.faseTop.test(nome)) return 'top'
  if (RE.pubblicoCaldo.test(nome)) return 'lower'
  if (RE.pubblicoTiepido.test(nome)) return 'middle'
  if (RE.pubblicoFreddo.test(nome)) return 'top'
  return null
}

function daTesto(row) {
  const tx = testo(row)
  if (!tx) return null
  for (const st of ['riattivazione', 'lower', 'middle']) {
    if (TESTO[st].test(tx)) return st
  }
  return null
}

// Ordine deciso da Marino (8 ott 2026): 1) spesa per tipo di pubblico,
// 2) contenuto e copy, 3) nome di campagna o creativita'. Con una
// precisazione, sempre sua: un'offerta EVIDENTE nel contenuto (prezzo barrato,
// sconto, codice) e' «pura conversione» a prescindere dal pubblico — «€99
// barrato €138» non puo' stare in Scoperta anche se il 54% va a nuovi.
//
// `ai` = lettura AI del contenuto (testo + immagine) da /api/creative-stadio:
// { stadio, offerta }. Arriva dopo, quindi lo stadio puo' cambiare quando
// arriva: prima si decide col resto.
//
// Ritorna { stadio, fonte, quote, nomi }. fonte = 'offerta' | 'pubblico' |
// 'testo' | 'ai' | 'nomi' | null (ipotesi: Scoperta).
export function stadioDi(row, segments, ai = null) {
  const q = quote(segments)
  const tx = daTesto(row)
  const n = daNomi(row)
  const base = { quote: q, nomi: !!n, tipo: ai?.tipo || '' }

  // 0. offerta evidente nel contenuto = conversione, sempre
  if (tx === 'lower' || ai?.offerta) return { stadio: 'lower', fonte: 'offerta', ...base }

  // 1. pubblico: Nuovo = scoperta; Ha interagito + Gia' clienti = caldo, e sul
  //    caldo e' il contenuto a dire considerazione o riattivazione; quote in
  //    mezzo (ne' freddo ne' caldo) non decidono
  if (q) {
    const caldo = q.engaged + q.returning
    if (q.returning >= 0.5) return { stadio: 'riattivazione', fonte: 'pubblico', ...base }
    if (caldo >= 0.5) return { stadio: (tx || ai?.stadio) === 'riattivazione' ? 'riattivazione' : 'middle', fonte: 'pubblico', ...base }
    if (q.new >= 0.6) return { stadio: 'top', fonte: 'pubblico', ...base }
  }

  // 2. contenuto: regole sul testo, poi la lettura AI (testo + immagine)
  if (tx) return { stadio: tx, fonte: 'testo', ...base }
  if (ai?.stadio && STADI.includes(ai.stadio)) return { stadio: ai.stadio, fonte: 'ai', ...base }

  // 3. nome di campagna o adset
  if (n) return { stadio: n, fonte: 'nomi', ...base }

  return { stadio: 'top', fonte: null, ...base }
}

// Solo il contenuto: il nome della campagna viene DOPO il contenuto
// nell'ordine di Marino, quindi all'AI non si passa.
export function estrattoPerAI(row) {
  const immagine = row?.thumbnail_url || row?.display_image_url || row?.image_url || row?.creative_image_url || row?.preview_image_url
    || (Array.isArray(row?.products) ? row.products.find(p => p?.image_url)?.image_url : '') || ''
  return { ad_id: row?.ad_id || row?.id, testo: testo(row).slice(0, 600), immagine, video_id: row?.video_id || null }
}
export function haContenuto(row) { const e = estrattoPerAI(row); return !!(e.testo.trim() || e.immagine) }
