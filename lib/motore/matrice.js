// ============================================================================
//  La MATRICE — a chi parla ogni creatività, in che momento, con quale leva.
//
//  Il motore sapeva decidere COSA produrre (angolo, formato, fase) partendo dai
//  numeri, ma la scena e il destinatario uscivano da assi generici: "una donna
//  sui 30 anni" in "una cucina rustica". Le creatività erano diverse fra loro
//  come lo sono due foto di repertorio: nessuna parlava a qualcuno in
//  particolare.
//
//  La matrice (6 novembre 2026) è il lavoro che mancava a monte: 6 segmenti di
//  clienti → 18 cluster, uno per angolo → 36 avatar con nome, età, città,
//  abitudini e un momento preciso → 360 righe, una per avatar e per formato,
//  ognuna con situazione, inquadratura, leva, headline, copy e CTA.
//
//  Qui NON si decide cosa produrre: quello resta al brief, che parte dai dati.
//  Qui si sceglie, per ogni brief, la riga della matrice che gli dà una persona
//  e una scena. Il brief dice "serve un NOI-VS-LORO sull'angolo RISPARMIO"; la
//  matrice risponde "allora è Rita, 47 anni, quattro figli, al discount col
//  telefono in mano a confrontare il prezzo al litro".
//
//  I dati stanno in lib/motore/dati/<cliente>/ e sono lo stesso contenuto del documento
//  condiviso col cliente: se si corregge uno, si corregge l'altro.
// ============================================================================
import { insiemeDi } from './dati/indice'
import { clienteMotore } from './workspace'

// La matrice e' DEL CLIENTE: ogni workspace ha la sua (o nessuna). Quale usare
// lo dice la scheda del cliente (ce_brand.matrice), letta una volta per
// richiesta da conMotore. Senza matrice tutto qui sotto risponde "vuoto" e il
// generatore ripiega sugli assi generici, com'era prima del 6 novembre 2026.
const dati = () => insiemeDi(clienteMotore()?.matrice)
export const haMatrice = () => dati().MATRICE.length > 0
export const templateTutti = () => dati().TEMPLATE

export const avatarDi = (id) => dati().avatarPerId.get(id) || null
export const clusterDi = (id) => dati().clusterPerId.get(id) || null
export const rigaDi = (id) => dati().rigaPerId.get(id) || null
export const segmentoDi = (codice) => dati().segmentoPerCodice.get(codice) || null

// ---------------------------------------------------------------------------
//  Quali righe sono già state usate.
//
//  Il segno sta nel motivo del brief, fra parentesi quadre: "[matrice 4A-03]".
//  Non in una colonna dedicata, perché la colonna arriva con una migrazione e
//  finché non c'è il motore rifarebbe sempre le stesse dieci righe senza
//  saperlo. Il motivo del brief c'è da sempre ed è testo libero.
// ---------------------------------------------------------------------------
const SEGNO = /\[matrice (\d[ABC]-\d\d)\]/
export const segnoMatrice = (id) => `[matrice ${id}]`
export function idMatriceDa(creativita) {
  return creativita?.matrice_id || String(creativita?.brief_motivo || '').match(SEGNO)?.[1] || null
}
export function usateDa(creativita = []) {
  return new Set(creativita.map(idMatriceDa).filter(Boolean))
}

// Le persone storiche del motore (quelle con cui sono state classificate le
// inserzioni importate) non coincidono con i sei segmenti: qui il ponte, per
// far combaciare un brief che chiede "GOURMET" con le righe giuste.
function personaCombacia(briefPersona, riga) {
  if (!briefPersona) return false
  if (briefPersona === riga.segmento) return true
  return (segmentoDi(riga.segmento)?.persone_storiche || []).includes(briefPersona)
}

// ---------------------------------------------------------------------------
//  La scelta.
//
//  Si dà un punteggio a ogni riga libera e si prende la migliore. Tre cose
//  pesano, in quest'ordine:
//
//   1. quanto la riga RISPONDE al brief — formato, angolo, persona. È ciò che
//      tiene la matrice agganciata ai numeri invece di farla girare da sola;
//   2. quanto è DIVERSA dal resto del lotto — un avatar, un cluster e un
//      formato già presi nella stessa tornata costano punti. Dieci creatività
//      sulla stessa persona non sono dieci creatività;
//   3. l'ONDATA — a parità del resto vengono prima i cluster legati alla
//      stagione (olio nuovo, Natale), poi gli altri.
//
//  Il Reel non si sceglie mai: è un video, e qui si producono statiche.
// ---------------------------------------------------------------------------
export function scegliRiga({ brief = {}, usate = new Set(), lotto = [], ammesse = null }) {
  // Contati, non solo presenti: in un lotto ristretto a un cluster gli avatar
  // sono due, e senza il conto il primo si prenderebbe tutte le righe.
  const avatarNelLotto = new Map()
  for (const r of lotto) avatarNelLotto.set(r.avatar, (avatarNelLotto.get(r.avatar) || 0) + 1)
  const clusterNelLotto = new Set(lotto.map(r => r.cluster))
  const segmentiNelLotto = new Map()
  const formatiNelLotto = new Map()
  for (const r of lotto) {
    segmentiNelLotto.set(r.segmento, (segmentiNelLotto.get(r.segmento) || 0) + 1)
    formatiNelLotto.set(r.formato, (formatiNelLotto.get(r.formato) || 0) + 1)
  }
  let migliore = null
  for (const r of dati().MATRICE) {
    if (!r.formato_motore) continue                       // Reel
    if (usate.has(r.id)) continue
    if (ammesse && !ammesse(r)) continue
    let p = 0
    if (brief.formato && r.formato_motore === brief.formato) p += 4
    if (brief.angolo && r.angolo_motore === brief.angolo) p += 3
    if (personaCombacia(brief.persona, r)) p += 2
    p -= (avatarNelLotto.get(r.avatar) || 0) * 6
    if (clusterNelLotto.has(r.cluster)) p -= 2
    p -= (segmentiNelLotto.get(r.segmento) || 0) * 1.5
    p -= (formatiNelLotto.get(r.formato) || 0) * 2
    p += (5 - (r.ondata || 4)) * 0.6
    if (!migliore || p > migliore.p) migliore = { r, p }
  }
  return migliore ? { ...migliore.r, punteggioScelta: +migliore.p.toFixed(1) } : null
}

// ---------------------------------------------------------------------------
//  Dalla riga alla scena.
//
//  La descrizione resta nelle quattro frasi separate da "; " che il resto del
//  motore sa già rileggere (lib/scena.js): ambiente, soggetto, luce,
//  inquadratura. Cambia cosa c'è dentro — non più una voce di un elenco ma la
//  situazione e la persona di quella riga.
// ---------------------------------------------------------------------------
const pulito = (x) => String(x || '').replace(/;/g, ',').replace(/\s+/g, ' ').trim()

// Chi si vede. L'età si dichiara, ma con il tetto che il motore si è già dato:
// nessuna persona oltre i 65 anni in scena (lib/scena.js). L'avatar di 71 anni
// resta il DESTINATARIO; in immagine diventa un adulto maturo o le sue mani.
const TETTO_ETA = 62
export function soggettoDa(avatar) {
  if (!avatar) return 'solo mani, senza volto, in azione sul prodotto'
  const eta = (avatar.eta || []).map(e => Math.min(e, TETTO_ETA))
  const g = avatar.genere_eta.toLowerCase()
  const chi = g.startsWith('coppia') ? `una coppia${eta.length ? ` sui ${eta[0]} anni` : ''}`
    : g.startsWith('donna') ? `una donna sui ${eta[0] || 40} anni`
    : g.startsWith('uomo') ? `un uomo sui ${eta[0] || 40} anni`
    : 'una persona adulta'
  return pulito(`${chi} (${avatar.dove_con_chi}), gesto naturale e non posato`)
}

export function scenaDaRiga({ riga, stile, luce }) {
  const av = avatarDi(riga.avatar)
  const ambiente = pulito(`${riga.situazione}${stile ? `. Stile della casa: ${stile.desc}` : ''}`)
  return [ambiente, soggettoDa(av), pulito(luce?.desc || 'luce naturale credibile'), pulito(riga.angolazione)].join('; ')
}

// ---------------------------------------------------------------------------
//  Dalla riga alla copy.
//
//  La headline e il testo della matrice NON si stampano così come sono: sono
//  stati scritti a mano per un documento, senza i vincoli del brand (niente
//  annate, niente cifre che non stanno nei dati, otto parole di headline).
//  Entrano nel prompt come DIREZIONE: la persona, il momento, il sentimento,
//  il problema e la soluzione — e uno spunto da riscrivere, non da copiare.
//  Così la copy passa gli stessi tre cancelli di tutte le altre.
// ---------------------------------------------------------------------------
export function direzioneCreativa(riga) {
  const av = avatarDi(riga.avatar), cl = clusterDi(riga.cluster)
  if (!av || !cl) return ''
  return [
    `A CHI PARLI — una persona precisa, non un pubblico:`,
    `${av.nome}, ${av.genere_eta.toLowerCase()}. ${av.dove_con_chi}. ${av.abitudini}.`,
    `Il momento: ${av.situazione}.`,
    `Lo dice così: «${av.frase}»`,
    `Fa parte di: ${cl.nome} — ${cl.chi}. ${cl.cosa_li_accomuna}.`,
    `La leva che funziona su di loro: ${cl.leva}.`,
    ``,
    `LA SCENA CHE SI VEDRA': ${riga.situazione}.`,
    `L'IDEA DELLA CREATIVITA': ${riga.angle}.`,
    `SPUNTO (da riscrivere dentro le regole qui sotto, non da copiare): «${riga.headline}» — ${riga.copy}`,
    ``,
    `Headline e testo devono far sentire, in quest'ordine: il SENTIMENTO di questa persona,`,
    `il PROBLEMA che ha in quel momento, la SOLUZIONE. Scrivi come parlerebbe lei.`,
    `Mai nominare una città nei testi (niente «a Torino»): si scrive «dove vivi», «dove vivi per lavoro».`,
  ].join('\n')
}

// ---------------------------------------------------------------------------
//  I template.
//
//  1.032 schemi di impaginazione catalogati; 347 layout adatti all'olio, di cui
//  42 scelti a mano come i migliori per formato. Si propone un template VUOTO
//  (o singolo) del formato della riga, i migliori per primi, evitando quelli
//  già presi nel lotto.
// ---------------------------------------------------------------------------
export function templatePer(formatoMatrice, usati = new Set(), seme = '') {
  const candidati = dati().TEMPLATE.filter(t => t.formato === formatoMatrice && t.adatto === 'A' && t.url && t.ruolo !== 'E')
  if (!candidati.length) return null
  const liberi = candidati.filter(t => !usati.has(t.id))
  const rosa = liberi.length ? liberi : candidati
  const migliori = rosa.filter(t => t.migliore)
  const da = migliori.length ? migliori : rosa
  // La scelta dipende dal seme e non dal caso: rifare la stessa creatività
  // deve riproporre lo stesso template.
  let h = 2166136261
  for (const c of String(seme)) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) }
  return da[(h >>> 0) % da.length]
}
export const templateDi = (id) => dati().TEMPLATE.find(t => t.id === id) || null
export const segnoTemplate = (id) => `[template ${id}]`
export function idTemplateDa(creativita) {
  return creativita?.template_id || String(creativita?.brief_motivo || '').match(/\[template ([^\]]+)\]/)?.[1] || null
}

// ---------------------------------------------------------------------------
//  La confezione vera.
//
//  Due errori visti il 6 novembre 2026 sulla prima tornata fatta a mano, tutti
//  e due riconosciuti dal cliente al primo sguardo:
//   · il pacco di spedizione usciva marrone e anonimo: quello vero è GIALLO,
//     col logo rosso e i rosoni bianchi;
//   · la bag in box usciva quasi cubica e troppo grande, o vista solo dal lato
//     stretto, dove sembra un cartone alto qualunque.
//  Le regole entrano nel prompt e, quando la scena mostra un pacco, le foto
//  vere della scatola gialla si aggiungono ai riferimenti.
// ---------------------------------------------------------------------------
export const mostraUnPacco = (testo) => (dati().confezione?.mostraUnPacco?.(testo)) || false
// Le regole sulla confezione vera sono del cliente (lib/motore/dati/<cliente>/confezione.js):
// chi non le ha non riceve niente, e il prompt resta quello generico.
export const regoleConfezione = (x) => dati().confezione?.regoleConfezione?.(x) || ''
export const riferimentiPacco = (scena) => dati().confezione?.riferimentiPacco?.(scena) || []

// Quello che la scheda dell'app mostra: tutto, tranne il catalogo dei template
// che pesa e si chiede a parte.
export function documento() {
  const d = dati()
  return { aggiornato: d.aggiornato, documento: d.documento,
    segmenti: d.SEGMENTI, cluster: d.CLUSTER, avatar: d.AVATAR, matrice: d.MATRICE, regole: d.REGOLE, riferimenti: d.RIFERIMENTI }
}
