import sharp from 'sharp'
// opentype.js è un modulo CommonJS: in ESM `import opentype from` non trova
// un export default e Next si ferma con "Export default doesn't exist in
// target module". Si importa lo spazio dei nomi e si prende ciò che c'è.
import * as opentype from 'opentype.js'
import fs from 'node:fs/promises'
import path from 'node:path'

// ============================================================================
//  Layer brandizzato sopra una scena: scrim, logo, headline, sottotitolo,
//  bollini, pill CTA. È il template approvato dal cliente, riscritto con sharp
//  al posto di ImageMagick perché deve girare anche su Vercel.
//
//  Il testo passa da SVG con i glifi convertiti in contorni: senza,
//  il rendering cadrebbe su un font di sistema diverso da macchina a macchina,
//  e la stessa creatività uscirebbe diversa a seconda di dove viene prodotta.
// ============================================================================

// I glifi si disegnano come CONTORNI, non come testo con un @font-face.
//
// Il font incorporato in base64 funzionava in locale e NON su Vercel: là il
// rendering SVG di sharp non risolve il @font-face e restituisce quadratini —
// creatività complete di scrim e bottone, col testo ridotto a caselle vuote.
// Un difetto che in sviluppo non si vede mai, e in produzione esce su ogni
// creatività prodotta dal ciclo notturno.
//
// Convertire il testo in path toglie di mezzo il problema alla radice: non c'è
// piu' un font da risolvere a tempo di rendering. In piu' si ottengono le
// larghezze VERE dei caratteri, quindi l'a capo smette di essere una stima.
const RADICE = process.cwd()
const FONT = (n) => path.join(RADICE, 'assets', 'motore', 'font', `GeneralSans-${n}.otf`)
const cacheFont = {}

async function caricaFont(peso) {
  if (cacheFont[peso]) return cacheFont[peso]
  const b = await fs.readFile(FONT(peso))
  // opentype vuole un ArrayBuffer, non un Buffer di Node.
  cacheFont[peso] = opentype.parse(b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength))
  return cacheFont[peso]
}

// Il tracciato SVG lo scriviamo noi, invece di usare toPathData() di
// opentype.js.
//
// Il loro serializzatore, su certi valori di coordinata, emette "NaN" dentro
// il path: con cx=237,12 succede, con 237,5 no. Un NaN fa abbandonare a
// librsvg tutto il resto del tracciato, quindi "10 Litri di Gusto" veniva
// disegnato come "10" e basta. Un bug che non solleva errori: produce
// un'immagine, solo con mezza scritta.
//
// Qui i comandi si serializzano a mano e si verifica il risultato: se un
// numero non è finito si alza un'eccezione, perché una creatività con la
// headline mozzata è peggio di una creatività mancante — quella si nota.
const n2 = (v) => {
  if (!Number.isFinite(v)) throw new Error(`coordinata non valida nel tracciato: ${v}`)
  return (Math.round(v * 100) / 100).toString()
}
function tracciato(path) {
  let d = ''
  for (const c of path.commands) {
    if (c.type === 'M') d += `M${n2(c.x)} ${n2(c.y)}`
    else if (c.type === 'L') d += `L${n2(c.x)} ${n2(c.y)}`
    else if (c.type === 'C') d += `C${n2(c.x1)} ${n2(c.y1)} ${n2(c.x2)} ${n2(c.y2)} ${n2(c.x)} ${n2(c.y)}`
    else if (c.type === 'Q') d += `Q${n2(c.x1)} ${n2(c.y1)} ${n2(c.x)} ${n2(c.y)}`
    else if (c.type === 'Z') d += 'Z'
  }
  return d
}

// Larghezza reale di una stringa, in pixel, per un font e una dimensione.
function larghezza(font, testo, dim, spaziatura = 0) {
  return font.getAdvanceWidth(testo, dim) + spaziatura * Math.max(0, testo.length - 1)
}

// Una riga di testo come <path>. `ancora` centra sulla x data.
function riga(font, testo, x, y, dim, colore, { spaziatura = 0, ancora = 'middle' } = {}) {
  const t = String(testo || ''); if (!t) return ''
  const w = larghezza(font, t, dim, spaziatura)
  let cx = ancora === 'middle' ? x - w / 2 : ancora === 'end' ? x - w : x
  let d = ''
  if (spaziatura) {
    // Con la spaziatura si disegna carattere per carattere: getPath non la
    // conosce, e applicarla dopo sposterebbe i glifi senza allargare la riga.
    for (const ch of t) {
      d += tracciato(font.getPath(ch, cx, y, dim)) + ' '
      cx += font.getAdvanceWidth(ch, dim) + spaziatura
    }
  } else {
    d = tracciato(font.getPath(t, cx, y, dim))
  }
  return `<path d="${d}" fill="${colore}"/>`
}

const esc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

// Manda a capo sulla larghezza REALE del testo, non su un conteggio di
// caratteri: contando i caratteri, "MMM" e "iii" valevano uguale e la stima
// prudente sprecava mezza riga su ogni headline.
function aCapo(font, testo, dim, maxPx) {
  const parole = String(testo || '').split(/\s+/).filter(Boolean)
  const righe = []
  let r = ''
  for (const p of parole) {
    if (!r) { r = p; continue }
    if (larghezza(font, r + ' ' + p, dim) <= maxPx) r += ' ' + p
    else { righe.push(r); r = p }
  }
  if (r) righe.push(r)
  return righe
}

const FORMATI = {
  '1x1':  { w: 1080, h: 1080, logoW: 215, logoY: 42,  headPt: 50, subPt: 29, headY: 175, badPt: 24, badY: 160, ctaH: 86,  ctaPt: 34, ctaY: 58,  scrimTop: 600, scrimBot: 520, larghH: 900, larghS: 880 },
  '9x16': { w: 1080, h: 1920, logoW: 300, logoY: 70,  headPt: 80, subPt: 37, headY: 285, badPt: 29, badY: 315, ctaH: 104, ctaPt: 39, ctaY: 165, scrimTop: 980, scrimBot: 900, larghH: 940, larghS: 900 },
}

// Palette di default: la prima delle approvate. Ogni creatività ne riceve una
// diversa, così il lotto non esce tutto verde — è uno degli assi di varianza.
const DEFAULT = { scrim: '#0b140e', headline: '#ffffff', ctaBg: '#c0a062', ctaTesto: '#1f3a26', bollini: '#f3ead2' }

// ============================================================================
//  I LAYOUT.
//
//  Per mesi il livello di brand è stato uno solo: logo centrato in alto,
//  headline centrata, striscia e bottone centrati in basso. Duecento creatività
//  con lo stesso telaio non sono duecento creatività — a distanza d'occhio sono
//  un annuncio ripetuto, e Meta le raggruppa per come SONO FATTE oltre che per
//  quello che dicono. Il telaio è un asse di varianza come l'ambiente o la luce.
//
//  Ogni layout descrive DOVE vanno le cose, non come sono fatte: colori, font e
//  contenuti restano gli stessi. Le coordinate si ricavano dal formato invece di
//  essere scritte a mano due volte, così 1:1 e 9:16 non possono divergere.
// ============================================================================
export const LAYOUT = ['centro', 'basso', 'bandiera', 'fascia', 'angolo', 'editoriale']

// Il layout si sceglie dal SEME della creatività, non a caso: ricomporre la
// stessa creatività deve dare lo stesso telaio, altrimenti una correzione di
// composizione la trasformerebbe in un'altra creatività.
export function layoutDa(seme) {
  return LAYOUT[mescola(seme) % LAYOUT.length]
}

// FNV-1a, non "moltiplica per 31".
//
// Con 31 e sei layout il conto si riduceva alla SOMMA dei caratteri modulo sei
// (31 e' congruo a 1 modulo 6), e i semi della varianza sono stringhe che si
// somigliano: su venti creativita' otto finivano su 'centro', otto su 'angolo'
// e due telai non uscivano mai. FNV mescola davvero i bit alti con i bassi.
export function mescola(seme) {
  let h = 2166136261
  const t = String(seme || '')
  for (let i = 0; i < t.length; i++) {
    h ^= t.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h ^ (h >>> 16)) >>> 0
}

// ============================================================================
//  LE SAFE ZONE DI META.
//
//  Su Story e Reels l'interfaccia nativa copre le fasce estreme: in alto
//  l'header col nome dell'account, in basso la barra di risposta e lo swipe.
//  Quello che ci finisce dentro non e' tagliato — e' COPERTO, quindi non si
//  vede e non si clicca.
//
//  Il nostro livello di brand ci stava dentro da sempre: logo a 70px su 1920
//  (il 3,6%) e bottone a 165px dal fondo (l'8,6%). Nessun controllo se ne
//  accorgeva. L'ha trovato l'analisi del server MCP creative-engine-os, due
//  volte di fila: `safe_zone_respected: false`, `crop_risk: high`,
//  `platform_fit_score` 5 e 6 su 10 — e le violazioni nominate una per una.
//
//  Il vincolo si applica DOPO che il layout ha deciso, con una funzione sola:
//  cosi' vale per tutti e sei i telai e per quelli che verranno, invece di
//  essere sei serie di numeri ritoccati a mano che divergono al primo cambio.
// ============================================================================
const SICURO = {
  // Il quadrato va nel feed, dove non c'e' interfaccia sopra la creativita'.
  '1x1': { alto: 0, basso: 0 },
  '9x16': { alto: 0.14, basso: 0.20 },
}

function dentroSicuro(G, F, ratio) {
  const s = SICURO[ratio] || { alto: 0, basso: 0 }
  if (!s.alto && !s.basso) return G
  const yMin = Math.round(F.h * s.alto)
  const yMax = Math.round(F.h * (1 - s.basso))

  // Il logo scende sotto l'header.
  G.logo = { ...G.logo, y: Math.max(G.logo.y, yMin) }

  // Il bottone sale sopra la barra: si guarda il suo bordo INFERIORE.
  const ctaPrima = G.cta.y
  const ctaDopo = Math.min(G.cta.y, yMax - F.ctaH)
  const alzato = ctaPrima - ctaDopo
  G.cta = { ...G.cta, y: ctaDopo }

  if (alzato > 0) {
    // Tutto quello che era ancorato al fondo si alza dello stesso tanto,
    // altrimenti il bottone finisce sopra la striscia o fuori dalla fascia.
    if (G.badge) G.badge = { ...G.badge, y: G.badge.y - alzato }
    if (G.head?.daFondo != null) G.head = { ...G.head, daFondo: G.head.daFondo + alzato }
    // La fascia del piede CRESCE verso l'alto: il bottone deve restarci dentro.
    if (G.piede) G.piede = { h: G.piede.h + alzato, y: G.piede.y - alzato }
    if (G.head?.y != null && G.piede) G.head = { ...G.head, y: G.head.y - alzato }
  }

  // Una fascia in alto deve scendere anche lei, col suo testo dentro.
  if (G.fascia && G.fascia.h < yMin + F.headPt * 2) {
    const cresce = yMin + Math.round(F.headPt * 2) - G.fascia.h
    G.fascia = { h: G.fascia.h + cresce }
    if (G.head?.y != null) G.head = { ...G.head, y: G.head.y + Math.round(cresce * 0.5) }
  }
  return G
}

// La geometria di un layout, ricavata dal formato. `ancora` dice come allineare
// il testo: 'centro', 'sinistra'.
function geometria(nome, F, ratio) {
  const M = Math.round(F.w * 0.075)            // margine laterale
  const larghSx = F.w - M * 2
  const base = {
    scrim: 'entrambi',
    logo: { w: F.logoW, y: F.logoY, x: Math.round((F.w - F.logoW) / 2) },
    head: { x: F.w / 2, y: F.headY, ancora: 'centro', pt: F.headPt, largh: F.larghH },
    sub: { ancora: 'centro', pt: F.subPt, largh: F.larghS },
    badge: { x: F.w / 2, y: F.h - F.badY, ancora: 'centro' },
    cta: { x: F.w / 2, y: F.h - F.ctaY - F.ctaH, ancora: 'centro' },
  }
  switch (nome) {
    case 'centro':
      return base

    // Alto completamente libero: il prodotto respira, il testo sta tutto in
    // fondo. È il layout che regge meglio le scene con la persona in alto.
    case 'basso': {
      const yBlocco = Math.round(F.h * (F.h > F.w ? 0.60 : 0.52))
      return { ...base, scrim: 'basso',
        logo: { w: Math.round(F.logoW * 0.72), y: F.logoY, x: M },
        head: { x: M, y: yBlocco, ancora: 'sinistra', pt: F.headPt, largh: larghSx },
        sub: { ancora: 'sinistra', pt: F.subPt, largh: larghSx },
        badge: { x: M, y: F.h - F.badY, ancora: 'sinistra' },
        cta: { x: M, y: F.h - F.ctaY - F.ctaH, ancora: 'sinistra' } }
    }

    // A bandiera: tutto allineato a sinistra, dall'alto. Il taglio da manifesto.
    case 'bandiera':
      return { ...base,
        logo: { w: Math.round(F.logoW * 0.78), y: F.logoY, x: M },
        // A meta' altezza e con un filetto verticale accanto: allineare a
        // sinistra e basta lo rendeva quasi identico a 'centro', e due layout
        // che si somigliano non sono due layout.
        filetto: { x: M, w: 6 },
        head: { x: M + 26, y: Math.round(F.h * 0.30), ancora: 'sinistra', pt: F.headPt, largh: larghSx - 26 },
        sub: { ancora: 'sinistra', pt: F.subPt, largh: larghSx - 26 },
        badge: { x: M, y: F.h - F.badY, ancora: 'sinistra' },
        cta: { x: M, y: F.h - F.ctaY - F.ctaH, ancora: 'sinistra' } }

    // Una fascia piena in alto con dentro la headline: niente sfumatura, un
    // bordo netto. È il layout che stacca di più in un feed.
    case 'fascia': {
      const alt = Math.round(F.h * (F.h > F.w ? 0.26 : 0.30))
      return { ...base, scrim: 'basso', fascia: { h: alt },
        logo: { w: Math.round(F.logoW * 0.62), y: Math.round(F.logoY * 0.8), x: M },
        head: { x: M, y: Math.round(alt * 0.42), ancora: 'sinistra', pt: F.headPt, largh: larghSx },
        sub: { ancora: 'sinistra', pt: F.subPt, largh: larghSx },
        badge: null,
        cta: { x: F.w / 2, y: F.h - F.ctaY - F.ctaH, ancora: 'centro' } }
    }

    // Minimale: headline grande in basso a sinistra, bottone accanto, niente
    // striscia dei bollini. Serve quando la scena parla da sola.
    case 'angolo':
      // La headline si ancora al FONDO, non a un'altezza fissa: con
      // un'altezza fissa finiva sopra le scatole appena il testo andava a tre
      // righe. Niente sottotitolo — e' il layout che serve quando la scena
      // parla da sola, e infilarcelo lo rimetteva sul prodotto.
      return { ...base, scrim: 'basso',
        logo: { w: Math.round(F.logoW * 0.66), y: F.logoY, x: F.w - M - Math.round(F.logoW * 0.66) },
        head: { x: M, daFondo: F.ctaY + F.ctaH + Math.round(F.headPt * 0.9), ancora: 'sinistra',
          pt: Math.round(F.headPt * 1.05), largh: Math.round(larghSx * 0.9) },
        sub: null,
        badge: null,
        cta: { x: M, y: F.h - F.ctaY - F.ctaH, ancora: 'sinistra' } }

    // Editoriale: la scena occupa la parte alta, sotto una fascia piena col
    // testo. Il prodotto non ha niente sopra, che è il modo più sicuro di non
    // coprirlo mai.
    case 'editoriale': {
      // Il piede deve CONTENERE tutto: alla prima versione il sottotitolo usciva
      // dal quadro e la headline finiva sotto il bottone. Testo piu' piccolo,
      // larghezza limitata dalla colonna del bottone, e il bottone centrato
      // verticalmente nella fascia.
      const alt = Math.round(F.h * (F.h > F.w ? 0.28 : 0.32))
      const y0 = F.h - alt
      const pt = Math.round(F.headPt * 0.74)
      const largh = Math.round(F.w * 0.52)
      return { ...base, scrim: 'nessuno', piede: { h: alt, y: y0 },
        logo: { w: Math.round(F.logoW * 0.66), y: F.logoY, x: M },
        head: { x: M, y: y0 + Math.round(alt * 0.16), ancora: 'sinistra', pt, largh },
        sub: { ancora: 'sinistra', pt: Math.round(F.subPt * 0.92), largh },
        badge: null,
        cta: { x: F.w - M, y: y0 + Math.round(alt / 2 - F.ctaH / 2), ancora: 'destra' } }
    }
    default:
      return base
  }
}

export async function componi({ scena, ratio = '1x1', headline, sub, cta, bollini, palette, logo, logoScuro, layout, seme }) {
  const F = FORMATI[ratio]; if (!F) throw new Error(`ratio sconosciuto: ${ratio}`)
  const [bold, regular, semi] = await Promise.all([caricaFont('Bold'), caricaFont('Regular'), caricaFont('Semibold')])
  const P = { ...DEFAULT, ...(palette || {}) }
  const nomeLayout = LAYOUT.includes(layout) ? layout : layoutDa(seme)
  const G = dentroSicuro(geometria(nomeLayout, F, ratio), F, ratio)
  const anc = (a) => (a === 'centro' ? 'middle' : a === 'destra' ? 'end' : 'start')
  // Su scrim chiaro il logo bianco sparisce: serve la versione scura.
  const logoDaUsare = P.chiaro && logoScuro ? logoScuro : logo
  // Il logo si prepara PRIMA di posizionare il testo: senza la sua altezza
  // vera la headline gli finiva addosso appena il vincolo delle safe zone lo
  // spostava piu' in basso.
  const logoPronto = logoDaUsare ? await sharp(logoDaUsare).resize({ width: G.logo.w }).toBuffer() : null
  const logoH = logoPronto ? (await sharp(logoPronto).metadata()).height : 0

  // 1) sfondo. La scena arriva GIÀ nel formato finale: qui si ridimensiona e
  // basta. Il ritaglio 'attention' di sharp non sa che il prodotto deve restare
  // intero e lo mozzava sul bordo — per questo ogni formato ha la sua scena.
  const meta = await sharp(scena).metadata()
  const stessoRapporto = Math.abs((meta.width / meta.height) - (F.w / F.h)) < 0.04
  if (!stessoRapporto) {
    // Rete di sicurezza: se per errore arriva una scena di rapporto diverso,
    // si CONTIENE invece di ritagliare. Meglio due bande che un prodotto tagliato.
    console.warn(`[componi] scena ${meta.width}x${meta.height} non è ${ratio}: contengo invece di ritagliare`)
  }
  const sfondo = stessoRapporto
    ? await sharp(scena).resize(F.w, F.h, { fit: 'cover' }).toBuffer()
    : await sharp(scena).resize(F.w, F.h, { fit: 'contain', background: { r: 11, g: 20, b: 14 } }).toBuffer()
  // 2) testo: headline (a capo automatico), sottotitolo, bollini, CTA
  const righeH = aCapo(bold, headline, G.head.pt, G.head.largh)
  const righeS = G.sub ? aCapo(regular, sub, G.sub.pt, G.sub.largh) : []
  const interH = G.head.pt * 1.16, interS = (G.sub?.pt || 0) * 1.42
  // `daFondo` ancora il blocco al bordo inferiore invece che a un'altezza
  // fissa: con l'altezza fissa una headline a tre righe finiva sul prodotto.
  const yH = G.head.daFondo != null
    ? F.h - G.head.daFondo - (righeH.length - 1) * interH
    : G.head.y + G.head.pt
  let yS = yH + (righeH.length - 1) * interH + (G.sub?.pt || 0) * 2.1
  const testoCta = String(cta || '').toUpperCase()
  let yCta = G.cta.y
  let yBad = G.badge?.y

  // ---- il riordino verticale -------------------------------------------
  //
  // Spostare le posizioni dopo che il layout ha deciso non basta: portando il
  // logo sotto l'header e il bottone sopra la barra di risposta, la headline
  // finiva sul logo e il sottotitolo sulla striscia dei bollini. Il blocco va
  // RIORDINATO, e si puo' fare solo qui, dove si sa quante righe sono venute
  // dopo l'a capo.
  let yHead = yH
  const aria = Math.round(G.head.pt * 0.7)

  // 1) sotto il logo. Vale solo se il testo sta nella stessa fascia alta.
  const logoFine = logoPronto ? G.logo.y + logoH : 0
  const primaRiga = yHead - G.head.pt
  if (logoPronto && primaRiga < logoFine + aria && yHead < F.h * 0.55) {
    const giu = logoFine + aria - primaRiga
    yHead += giu; yS += giu
  }

  // 2) la pila dal fondo: bottone, poi striscia, poi il testo sopra.
  const finePila = []
  if (G.badge) {
    const minimo = yCta - Math.round(F.badPt * 1.9)
    yBad = Math.min(yBad, minimo)
    finePila.push(yBad - F.badPt)
  } else {
    finePila.push(yCta)
  }
  const tettoTesto = Math.min(...finePila) - aria
  const ultimaRiga = righeS.length
    ? yS + (righeS.length - 1) * interS
    : yHead + (righeH.length - 1) * interH
  if (ultimaRiga > tettoTesto) {
    const su = ultimaRiga - tettoTesto
    yHead -= su; yS -= su
  }

  // 3) la fascia piena deve CONTENERE il testo, e quanto e' alto il testo si sa
  // solo adesso. Con l'altezza fissa il sottotitolo cadeva fuori dalla banda,
  // mezzo sul colore pieno e mezzo sulla foto: illeggibile proprio dove il
  // telaio doveva staccare di piu'.
  if (G.fascia) {
    const fine = (righeS.length ? yS + (righeS.length - 1) * interS : yHead + (righeH.length - 1) * interH)
    G.fascia = { h: Math.max(G.fascia.h, Math.round(fine + aria)) }
  }

  // Lo scrim segue il layout: dove il testo non c'e' non serve scurire, e una
  // sfumatura messa dove non serve toglie luce alla scena senza motivo.
  const alto = G.scrim === 'entrambi'
  const basso = G.scrim === 'entrambi' || G.scrim === 'basso'
  const scrim = Buffer.from(`<svg width="${F.w}" height="${F.h}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="t" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${P.scrim}" stop-opacity="${P.chiaro ? 0.88 : 0.82}"/><stop offset="100%" stop-color="${P.scrim}" stop-opacity="0"/></linearGradient>
      <linearGradient id="b" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${P.scrim}" stop-opacity="0"/><stop offset="100%" stop-color="${P.scrim}" stop-opacity="${P.chiaro ? 0.95 : 0.92}"/></linearGradient>
    </defs>
    ${alto ? `<rect width="${F.w}" height="${F.scrimTop}" fill="url(#t)"/>` : ''}
    ${basso ? `<rect y="${F.h - F.scrimBot}" width="${F.w}" height="${F.scrimBot}" fill="url(#b)"/>` : ''}
    ${G.fascia ? `<rect width="${F.w}" height="${G.fascia.h}" fill="${P.scrim}"/>` : ''}
    ${G.piede ? `<rect y="${G.piede.y}" width="${F.w}" height="${G.piede.h}" fill="${P.scrim}"/>` : ''}
  </svg>`)


  const badge = String(bollini || '100% ITALIANO   •   ESTRATTO A FREDDO   •   DAL 1925')
  // Il bottone si dimensiona sulla larghezza VERA della scritta: prima la
  // stimava dal numero di caratteri, e su parole strette restava sproporzionato.
  const ctaW = Math.round(larghezza(bold, testoCta, F.ctaPt, 1.5)) + 96

  // Il bottone: la x del layout e' il bordo che conta, non sempre il centro.
  const xCta = G.cta.ancora === 'centro' ? Math.round((F.w - ctaW) / 2)
             : G.cta.ancora === 'destra' ? Math.round(G.cta.x - ctaW)
             : Math.round(G.cta.x)
  const svg = Buffer.from(`<svg width="${F.w}" height="${F.h}" xmlns="http://www.w3.org/2000/svg">
    ${righeH.map((r, i) => riga(bold, r, G.head.x, yHead + i * interH, G.head.pt, P.headline, { ancora: anc(G.head.ancora) })).join('')}
    ${G.filetto ? `<rect x="${G.filetto.x}" y="${yHead - G.head.pt}" width="${G.filetto.w}" height="${(righeH.length - 1) * interH + G.head.pt * 1.25}" fill="${P.ctaBg}"/>` : ''}
    ${righeS.map((r, i) => riga(regular, r, G.head.x, yS + i * interS, G.sub.pt, P.bollini, { ancora: anc(G.sub.ancora) })).join('')}
    ${G.badge ? riga(semi, badge, G.badge.x, yBad, F.badPt, P.bollini, { spaziatura: 2, ancora: anc(G.badge.ancora) }) : ''}
    <rect x="${xCta}" y="${yCta}" width="${ctaW}" height="${F.ctaH}" rx="${F.ctaH / 2}" fill="${P.ctaBg}"/>
    ${riga(bold, testoCta, xCta + ctaW / 2, yCta + F.ctaH / 2 + F.ctaPt * 0.36, F.ctaPt, P.ctaTesto, { spaziatura: 1.5, ancora: 'middle' })}
  </svg>`)

  // ---- l'assicurazione deterministica sulle safe zone -------------------
  //
  // Il server MCP ce lo dice guardando l'immagine, ma la geometria la
  // CALCOLIAMO noi: chiedere a un modello una cosa che sappiamo per costruzione
  // e' sostituire un fatto con un'opinione — e infatti la stessa immagine ha
  // dato risposte diverse, perche' lo storage serviva byte in cache. Qui si
  // verifica e si fallisce forte: una regressione su uno dei sei telai si vede
  // al momento di comporre, non fra tre settimane in un punteggio.
  const sz = SICURO[ratio]
  if (sz && (sz.alto || sz.basso)) {
    const yMin = Math.round(F.h * sz.alto), yMax = Math.round(F.h * (1 - sz.basso))
    const fuori = []
    if (logoPronto && G.logo.y < yMin) fuori.push(`logo a ${G.logo.y}px, sopra il minimo di ${yMin}`)
    if (yCta + F.ctaH > yMax) fuori.push(`bottone fino a ${yCta + F.ctaH}px, sotto il massimo di ${yMax}`)
    if (yBad != null && yBad > yMax) fuori.push(`striscia a ${yBad}px, sotto il massimo di ${yMax}`)
    if (fuori.length) throw new Error(`layout "${nomeLayout}" ${ratio} fuori dalle safe zone di Meta: ${fuori.join('; ')}`)
  }

  const strati = [{ input: scrim }, { input: svg }]
  if (logoPronto) strati.splice(1, 0, { input: logoPronto, top: G.logo.y, left: G.logo.x })
  return sharp(sfondo).composite(strati).png().toBuffer()
}
