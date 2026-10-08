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

const RE = {
  riattivazione: /riattiv|reactiv|re-?activ|win-?back|lapsed|dormant|dormient|inattiv|churn|ex-?client|past-?purch|vecchi-?client|ex-?customer|lost-?customer/i,
  lower: /retarget|\brmk\b|\brtg\b|remarket|\bbofu\b|bottom|carrello|\bcart\b|checkout|abbandon|abandon|\batc\b|add-?to-?cart|view-?content|\bvc\b|visitator|\bhot\b|\bdpa\b|catalog/i,
  middle: /\bmofu\b|middle|engag|interag|video-?view|\bvv\d*\b|\bwarm\b|consider|social-?proof|\bugc\b|testimon/i,
  top: /\btofu\b|\btop\b|prospect|\bbroad\b|lookalike|\blal\b|\blla\b|interest|interess|\bcold\b|awareness|acquisi|\bnuovi\b|\bnew\b|scoperta|discovery|\basc\b|advantage\+?\s*shopping/i,
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
  const nome = `${row?.campaign_name || ''} | ${row?.adset_name || ''}`
  for (const st of ['riattivazione', 'lower', 'middle', 'top']) {
    if (RE[st].test(nome)) return st
  }
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

// Ritorna { stadio, fonte, quote } — `fonte` e' 'nomi' | 'pubblico' | 'testo' | null.
// Con fonte null lo stadio e' un'ipotesi (top) da far decidere all'AI.
export function stadioDi(row, segments) {
  const q = quote(segments)

  const n = daNomi(row)
  if (n) return { stadio: n, fonte: 'nomi', quote: q }

  if (q) {
    if (q.returning >= 0.5) return { stadio: 'riattivazione', fonte: 'pubblico', quote: q }
    if (q.engaged >= 0.5) {
      // chi ha interagito: offerta → fondo, altrimenti mezzo
      const tx = daTesto(row)
      return { stadio: tx === 'lower' ? 'lower' : 'middle', fonte: 'pubblico', quote: q }
    }
    if (q.new >= 0.7) {
      // nuovo pubblico: un'offerta a freddo resta in cima (e' acquisizione),
      // ma lo diciamo nel perche' tramite il testo
      return { stadio: 'top', fonte: 'pubblico', quote: q }
    }
  }

  const tx = daTesto(row)
  if (tx) return { stadio: tx, fonte: 'testo', quote: q }

  return { stadio: 'top', fonte: null, quote: q }
}

// Testo compatto per il ripiego AI: solo cio' che serve a decidere.
export function estrattoPerAI(row) {
  return {
    ad_id: row?.ad_id || row?.id,
    campagna: row?.campaign_name || '',
    adset: row?.adset_name || '',
    testo: testo(row).slice(0, 600),
  }
}
