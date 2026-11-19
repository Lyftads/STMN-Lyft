import { vincoliFisici } from './allocazione'
import { regoleConfezione } from './matrice'

// ============================================================================
//  Costruisce il PROMPT della scena da generare.
//
//  Il prompt non è creativo: è un contratto. Deve contenere la combinazione di
//  varianza (ambiente, soggetto, luce, inquadratura), i vincoli fisici del
//  prodotto e lo spazio da lasciare libero per il layer brandizzato.
//
//  Lo spazio libero è la parte che si dimentica sempre: se la scena riempie
//  tutto il quadro, headline e CTA finiscono sopra il soggetto e la creatività
//  è illeggibile — corretta come immagine e inutile come annuncio.
// ============================================================================
// Il prodotto non va MAI tagliato: una creatività con la confezione mozzata è
// da buttare, per quanto bella sia la scena. Lo si impone nel prompt E si
// genera la scena già nel formato finale, così non c'è un ritaglio che possa
// tagliarla dopo.
export function promptScena({ combo, prodotto, ratio = '9x16' }) {
  const alto = ratio === '9x16' ? 'terzo superiore' : 'quarto superiore'
  // Provato anche a dettare la posizione della CAMERA per formato ("camera
  // arretrata nel quadrato"): ha peggiorato entrambi i formati, sfalsando pure
  // la grafica stampata. Tenuto fuori. Sei tentativi di prompt hanno mostrato
  // che la scala non si governa con le parole in modo affidabile: serve una
  // verifica sull'immagine prodotta, non un'altra regola nel testo.
  return [
    `Fotografia pubblicitaria realistica, ${ratio === '9x16' ? 'verticale 9:16' : 'quadrata 1:1'}.`,
    `Il prodotto è quello dell'immagine di riferimento e deve corrispondere ESATTAMENTE:`,
    `forma, colori, grafica stampata, proporzioni. Non ridisegnarlo.`,
    ``,
    `AMBIENTE: ${combo.ambiente.desc}.`,
    `SOGGETTO: ${combo.soggetto.desc}.`,
    // Il vincolo sta nel prompt e non solo nell'asse dei soggetti: "una signora
    // sui 60 anni" il modello la disegna volentieri di ottanta, e a quel punto
    // l'asse dice una cosa e l'immagine ne mostra un'altra.
    `ETA' DELLE PERSONE — nessuna persona in scena deve dimostrare piu' di 65 anni.`,
    `Niente anziani: nessun volto molto rugoso, nessun capello completamente bianco,`,
    `nessuna postura da persona molto avanti con l'eta'. Se il soggetto e' descritto`,
    `come maturo, resta un adulto in piena attivita'.`,
    `LUCE: ${combo.luce.desc}.`,
    `INQUADRATURA: ${combo.quadro.desc}.`,
    vincoliFisici(prodotto),
    // Come si mostra la bag e com'e' fatto il pacco di spedizione vero: le due
    // cose che il cliente ha corretto il 6 novembre 2026 (lib/matrice.js).
    regoleConfezione({ prodotto, scena: `${combo.ambiente.desc} ${combo.quadro.desc}` }),
    ``,
    `COMPOSIZIONE — REGOLA ASSOLUTA: il prodotto dev'essere INTERAMENTE dentro l'inquadratura,`,
    `mai tagliato dai bordi, con un margine di respiro su tutti e quattro i lati.`,
    `Sta nella metà bassa del quadro, ben visibile.`,
    ``,
    // Una sola frase, FISICA e concreta. Le prime versioni dicevano "in primo
    // piano" e il modello gonfiava la bag finché riempiva il quadro; poi ho
    // aggiunto tre "REGOLA ASSOLUTA" e un oggetto-metro obbligatorio, e il
    // modello ha smesso di fotografare per mettersi a comporre collage — teste
    // duplicate, volti incollati sopra la scatola. Le istruzioni compositive
    // astratte peggiorano il risultato: la scala si ancora a una misura vera.
    // Il riferimento va preso su qualcosa che è DAVVERO nell'inquadratura e
    // che ha una misura nota: il volto. "Alta 24 cm" e "più bassa della testa"
    // non bastavano — la bag usciva ancora due volte troppo grande. Un
    // rapporto numerico esplicito è l'unica formulazione che il modello può
    // verificare mentre compone.
    // Le misure in centimetri stavano qui, cablate sulla bag in box: le latte e le
    // lattine da condimento le ricevevano identiche, cioè sbagliate. Ora i
    // centimetri li porta la specifica del prodotto; qui resta solo il rapporto
    // col volto, che vale per qualunque confezione da tavolo.
    `SCALA — il prodotto è un oggetto da tavolo, ma deve leggersi. Se nella scena`,
    `c'è un volto, il prodotto è alto DUE VOLTE il volto (dal mento all'attaccatura`,
    `dei capelli): sotto una volta e mezza si perde nel quadro e non si capisce`,
    `cosa si sta comprando, sopra due volte e mezza diventa un cartellone.`,
    `Occupa circa un terzo dell'altezza dell'inquadratura.`,
    `Lascia LIBERO e poco affollato il ${alto}: ci andrà del testo sopra.`,
    `Nessun testo, nessun logo, nessuna scritta nell'immagine: verranno aggiunti dopo.`,
    `Niente watermark. Profondità di campo naturale, luce credibile, nessun effetto artificiale.`,
  ].filter(Boolean).join('\n')
}

// Ricostruisce il prompt da una riga già salvata a DB.
//
// `scena_desc` conserva la combinazione come quattro frasi separate da "; ":
// basta a rigenerare la scena senza dover riportare in vita l'oggetto combo,
// che vivrebbe solo in memoria. I vincoli fisici del prodotto vengono
// riletti dalla riga prodotto, perché sono la parte che NON deve mai variare:
// la posizione del rubinetto sulla bag non è uno stile, è un fatto.
export function promptDaRiga({ scenaDesc, prodotto, ratio = '9x16', evitare = [] }) {
  const [ambiente = '', soggetto = '', luce = '', quadro = ''] = String(scenaDesc || '').split(';').map(x => x.trim())
  const base = promptScena({
    combo: {
      ambiente: { desc: ambiente }, soggetto: { desc: soggetto },
      luce: { desc: luce }, quadro: { desc: quadro },
    },
    prodotto, ratio,
  })
  // Ciò che è stato bocciato con costanza si dice esplicitamente, oltre a
  // pesarlo di meno nella scelta delle combinazioni: un peso basso lo rende
  // raro, dirlo lo rende evitabile anche quando capita comunque.
  if (!evitare.length) return base
  return base + `\n\nDA EVITARE — su questo prodotto hanno dato risultati scadenti: `
    + evitare.map(e => `${e.asse} "${e.id}"`).join(', ') + '.'
}

// Salva l'immagine composta su Supabase Storage e ne restituisce l'URL pubblico.
export async function salvaImmagine({ db, bucket = 'creativita', percorso, buffer }) {
  const { error } = await db.storage.from(bucket).upload(percorso, buffer, {
    contentType: 'image/png', upsert: true,
  })
  if (error) throw new Error(`storage: ${error.message}`)
  const { data } = db.storage.from(bucket).getPublicUrl(percorso)
  return data?.publicUrl || null
}
