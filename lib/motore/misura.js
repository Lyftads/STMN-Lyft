import { chiaveCliente } from './workspace'
import sharp from 'sharp'

// ============================================================================
//  Verifica della SCALA sull'immagine prodotta.
//
//  La scala non si governa con le parole. Sei formulazioni di prompt diverse
//  l'hanno dimostrato: col vincolo ancorato al volto il 9:16 esce accettabile,
//  il 1:1 continua a uscire troppo grande — la cornice quadrata spinge il
//  modello a riempirla, e aggiungere altre righe di prompt peggiora (a un certo
//  punto smette di fotografare e compone collage). L'unica strada che resta e'
//  MISURARE l'immagine prodotta e rigenerare quando e' fuori banda.
//
//  COME SI MISURA — con un righello disegnato sopra l'immagine, non chiedendo
//  coordinate. Chiedere i riquadri di delimitazione "a mente" dava letture che
//  ballavano di venti punti sulla stessa foto (0,80 e 0,59 sulla stessa
//  scatola) e sbagliava di brutto sul 9:16: inutilizzabile per decidere una
//  spesa. Disegnando righe orizzontali numerate da 0 a 100 il compito diventa
//  LEGGERE una tacca invece che stimare una proporzione, e tre letture
//  indipendenti cadono nel giro di un paio di punti.
//
//  Ogni ritentativo costa crediti veri, quindi si interviene solo quando lo
//  sforamento e' netto e le letture concordano. Un falso positivo brucia 3
//  crediti, un falso negativo lascia passare una creativita' mediocre: il primo
//  costa di piu'.
// ============================================================================

// Il criterio principale e' il RAPPORTO COL VOLTO, perche' e' il criterio che
// ha usato il cliente: "2 bag enormi che rispetto alla faccia del signore
// anziano sono giganti". Frazione del quadro e invasione della fascia alta
// sono di contorno, con soglie larghe: servono per le scene senza persone.
//
// `Max` e' quando si interviene, `Obiettivo` e' cosa si chiede al ritentativo.
// Chiedere esattamente la soglia vorrebbe dire restare sul bordo e rigenerare
// all'infinito.
// La banda ha due lati, e per un po' ne ha avuto uno solo.
//
// Il verificatore e' nato quando il problema era il prodotto GIGANTE — le bag
// piu' alte del busto di un uomo — quindi controllava solo il tetto. Con
// gpt-image-2 il modello sbaglia dalla parte opposta: misurate, le scene
// prodotte stavano a 0,6-1,25 volte il volto contro un obiettivo di 1,4, e
// nessun controllo se ne accorgeva. Un prodotto troppo piccolo e' un difetto
// come uno troppo grande: in un feed non si capisce cosa si sta comprando.
export const BANDE = {
  '1x1':  { voltoMin: 1.1, voltoObiettivo: 1.8, voltoMax: 2.4, frazioneMin: 0.20, frazioneObiettivo: 0.36, frazioneMax: 0.72, cimaMin: 0.14, cimaObiettivo: 0.26 },
  '9x16': { voltoMin: 1.1, voltoObiettivo: 1.8, voltoMax: 2.4, frazioneMin: 0.14, frazioneObiettivo: 0.30, frazioneMax: 0.62, cimaMin: 0.20, cimaObiettivo: 0.32 },
}

const SISTEMA = `Sull'immagine sono disegnate delle righe orizzontali numerate da 0 (bordo superiore)
a 100 (bordo inferiore). Servono a te per leggere le posizioni: LEGGI le righe, non stimare
a occhio.

Riporta, usando quella numerazione:
- cima: dove si trova il punto PIU' ALTO della confezione del prodotto in primo piano
- base: dove si trova il punto PIU' BASSO della stessa confezione, dove appoggia
- voltoCima: l'attaccatura dei capelli sulla fronte del volto umano piu' in vista
- voltoBase: la punta del mento dello stesso volto

Se le unita' dello stesso prodotto sono piu' d'una e affiancate, consideralo un blocco unico.
Se non c'e' nessun volto umano, o e' girato o coperto al punto da non poter dire dove sono
fronte e mento, metti voltoCima e voltoBase a null: una misura inventata e' peggio di nessuna
misura. Stessa cosa per il prodotto, se non lo riconosci.

Prima scrivi in "lettura" fra quali due righe numerate cadono la cima e la base
(esempio: "la cima sta fra la 50 e la 55, la base poco sopra la 90").

Rispondi SOLO JSON:
{"lettura":"...","cima":0,"base":0,"voltoCima":0|null,"voltoBase":0|null}`

// Il righello si disegna in magenta: e' il colore che su queste scene — legno,
// cartone avorio, olio, incarnati — non compare mai, quindi non si confonde
// con l'immagine sotto.
async function conRighello(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(30000) })
  if (!res.ok) throw new Error(`immagine HTTP ${res.status}`)
  const base = await sharp(Buffer.from(await res.arrayBuffer()))
    .resize(768, 768, { fit: 'inside', withoutEnlargement: true }).toBuffer()
  const { width: W, height: H } = await sharp(base).metadata()
  const t = []
  for (let p = 0; p <= 100; p += 5) {
    const y = Math.round(H * p / 100), grosso = p % 10 === 0
    t.push(`<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="#ff00ff" stroke-width="${grosso ? 2 : 1}" opacity="${grosso ? 0.85 : 0.45}"/>`)
    if (grosso && p > 0 && p < 100) {
      t.push(`<text x="6" y="${y - 4}" font-family="sans-serif" font-size="20" font-weight="bold" fill="#ff00ff" stroke="#ffffff" stroke-width="0.6">${p}</text>`)
    }
  }
  return sharp(base)
    .composite([{ input: Buffer.from(`<svg width="${W}" height="${H}">${t.join('')}</svg>`), top: 0, left: 0 }])
    .jpeg({ quality: 85 }).toBuffer()
}

const numero = (v) => (Number.isFinite(v) && v >= 0 && v <= 100 ? v : null)

async function unaLettura(dati, { chiave, modello }) {
  const r = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${chiave}` },
    body: JSON.stringify({
      model: modello,
      // A zero le letture sarebbero la stessa lettura ripetuta e il loro
      // accordo non direbbe niente: devono essere davvero indipendenti.
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SISTEMA },
        { role: 'user', content: [{ type: 'image_url', image_url: { url: dati, detail: 'high' } }] },
      ],
    }),
    signal: AbortSignal.timeout(60000),
  })
  const testo = await r.text()
  if (!r.ok) throw new Error(`OpenAI ${r.status}: ${testo.slice(0, 180)}`)
  const c = JSON.parse(JSON.parse(testo).choices?.[0]?.message?.content || '{}')
  const cima = numero(c.cima), base = numero(c.base)
  if (cima == null || base == null || base <= cima) return null
  const vc = numero(c.voltoCima), vb = numero(c.voltoBase)
  const volto = vc != null && vb != null && vb > vc ? (vb - vc) / 100 : null
  return {
    frazione: (base - cima) / 100,
    cima: cima / 100,
    rapportoVolto: volto ? ((base - cima) / 100) / volto : null,
  }
}

const mediana = (v) => { const o = [...v].sort((a, b) => a - b); return o[(o.length - 1) >> 1] }

export async function misuraScala(url, {
  chiave = chiaveCliente('openai')?.chiave,
  modello = process.env.OPENAI_VISION_MODEL || 'gpt-4o',
  letture = 3,
} = {}) {
  if (!chiave) throw new Error("ChatGPT non collegato (tab Integrazioni): la verifica di scala non puo' girare")
  const dati = `data:image/jpeg;base64,${(await conRighello(url)).toString('base64')}`
  const grezze = await Promise.all(Array.from({ length: letture }, () =>
    unaLettura(dati, { chiave, modello }).catch(e => ({ errore: String(e.message || e) }))))
  const buone = grezze.filter(g => g && !g.errore)
  if (buone.length < 2) {
    return { affidabile: false, motivo: buone.length ? 'una sola lettura riuscita: non verificabile' : 'nessuna lettura utilizzabile' }
  }

  // Discordi restano solo le misure in cui NESSUNA coppia si avvicina: con tre
  // letture basta che due si diano ragione perche' la mediana valga.
  const f = buone.map(b => b.frazione).sort((a, b) => a - b)
  if (!f.slice(1).some((v, i) => v - f[i] <= 0.12)) {
    return { affidabile: false, motivo: `letture discordi (${f.map(x => x.toFixed(2)).join(' / ')})`, letture: buone }
  }

  const conVolto = buone.filter(b => b.rapportoVolto != null)
  return {
    affidabile: true,
    frazione: mediana(buone.map(b => b.frazione)),
    cima: mediana(buone.map(b => b.cima)),
    // Il volto vale solo se lo hanno visto TUTTE le letture: se una non lo
    // trova e le altre si', il riquadro e' incerto e il rapporto non regge il
    // peso di una decisione di spesa.
    rapportoVolto: conVolto.length === buone.length ? mediana(conVolto.map(b => b.rapportoVolto)) : null,
    letture: buone,
  }
}

// Il giudizio sta separato dalla misura: cosi' le soglie si ritarano senza
// rispedire una sola immagine, e si possono provare su misure gia' prese.
export function giudicaScala(m, ratio = '1x1') {
  const b = BANDE[ratio] || BANDE['1x1']
  if (!m?.affidabile) return { ok: true, misurato: false, nota: m?.motivo || 'non misurato' }

  const motivi = []
  let verso = null      // 'grande' o 'piccolo': i due difetti si correggono in modi opposti
  if (m.rapportoVolto != null && m.rapportoVolto > b.voltoMax) {
    motivi.push(`e' alto ${m.rapportoVolto.toFixed(1)} volte il volto in scena (limite ${b.voltoMax})`); verso = 'grande'
  }
  if (m.frazione > b.frazioneMax) {
    motivi.push(`occupa il ${Math.round(m.frazione * 100)}% dell'altezza del quadro (limite ${Math.round(b.frazioneMax * 100)}%)`); verso = 'grande'
  }
  if (m.cima < b.cimaMin) {
    motivi.push(`arriva fino al ${Math.round(m.cima * 100)}% dall'alto e invade la fascia riservata al testo`); verso = verso || 'grande'
  }
  // Il lato basso della banda. Si guarda solo se il prodotto non e' gia' stato
  // giudicato troppo grande: le due cose non possono essere vere insieme.
  if (!verso) {
    if (m.rapportoVolto != null && m.rapportoVolto < b.voltoMin) {
      motivi.push(`e' alto solo ${m.rapportoVolto.toFixed(1)} volte il volto in scena (minimo ${b.voltoMin})`); verso = 'piccolo'
    } else if (m.frazione < b.frazioneMin) {
      motivi.push(`occupa solo il ${Math.round(m.frazione * 100)}% dell'altezza del quadro (minimo ${Math.round(b.frazioneMin * 100)}%)`); verso = 'piccolo'
    }
  }
  if (!motivi.length) return { ok: true, misurato: true, frazione: m.frazione, rapportoVolto: m.rapportoVolto }

  // La correzione chiede un'azione FISICA — arretrare, allargare il campo —
  // non un aggettivo: "piu' piccolo" il modello lo ignora, "arretra la camera"
  // e' qualcosa che sa fare.
  const correzione = [
    `CORREZIONE DI SCALA — il tentativo precedente ha sbagliato le proporzioni: ${motivi.join('; ')}.`,
    verso === 'piccolo'
      ? `Avvicina la camera: il prodotto deve occupare piu' spazio nel quadro e leggersi bene anche in piccolo.`
      : `Arretra la camera e allarga il campo: attorno al prodotto si deve vedere molto piu' ambiente.`,
    m.rapportoVolto != null
      ? `Il prodotto deve risultare alto circa ${b.voltoObiettivo} volte il volto della persona in scena.`
      : `Il prodotto deve occupare circa il ${Math.round(b.frazioneObiettivo * 100)}% dell'altezza del quadro.`,
    verso === 'piccolo'
      ? `La sua cima puo' arrivare fino al ${Math.round(b.cimaObiettivo * 100)}% dal bordo superiore, non piu' in alto.`
      : `La sua cima non deve salire oltre il ${Math.round(b.cimaObiettivo * 100)}% dal bordo superiore.`,
    `Resta un oggetto da tavolo dentro una scena, non il soggetto di un catalogo.`,
  ].join('\n')

  return { ok: false, misurato: true, verso, frazione: m.frazione, cima: m.cima, rapportoVolto: m.rapportoVolto, motivi, correzione }
}
