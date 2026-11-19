// ============================================================================
//  Imparare dai giudizi di qualità.
//
//  Ogni creatività generata porta la FIRMA della combinazione che l'ha
//  prodotta — ambiente|soggetto|luce|inquadratura|palette. Quando arriva un
//  giudizio (male / buona / ottima) quel giudizio non riguarda solo quella
//  creatività: riguarda ognuno dei cinque ingredienti. Aggregando per asse si
//  scopre COSA funziona, non solo CHE COSA è piaciuto.
//
//  Perché per asse e non per combinazione intera: le combinazioni sono
//  centinaia e nessuna raccoglierà mai abbastanza giudizi. Gli ingredienti
//  sono otto o nove per asse, e su quelli il segnale si accumula davvero.
//
//  Il punteggio è la media di male=-1, buona=+0.5, ottima=+1. Non è una
//  probabilità e non va presentato come tale: è un ordinamento.
// ============================================================================

export const VALORE = { male: -1, buona: 0.5, ottima: 1 }
export const ETICHETTE = [['ottima', 'Ottima'], ['buona', 'Buona'], ['male', 'Male']]

// Sotto questa soglia un ingrediente non ha abbastanza giudizi per pesare.
// Due voti non sono un'opinione: sono due voti.
export const GIUDIZI_MINIMI = 3

const ASSI = ['ambiente', 'soggetto', 'luce', 'quadro', 'palette']

// Le righe arrivano da ce_creatives: servono `variante_seme` e `qualita`.
export function analizza(creativita) {
  const per = {}
  for (const a of ASSI) per[a] = {}
  let giudicate = 0

  for (const c of creativita) {
    const v = VALORE[c.qualita]
    if (v === undefined || !c.variante_seme) continue
    // Una bocciatura per il PRODOTTO non insegna niente sulla scena. Le prime
    // otto bag in box sono state segnate male perche' il modello disegnava una
    // maniglia che sporge dalla scatola, e da li' il motore aveva dedotto che
    // frantoio, dispensa, tramonto e tre-quarti fossero ambientazioni
    // sbagliate: quattro scene ottime condannate per colpa di un manico. Quel
    // difetto si corregge nella specifica del prodotto, non togliendo peso a
    // un'ambientazione che non c'entra.
    if (c.qualita_motivo === 'prodotto') continue
    giudicate++
    const parti = String(c.variante_seme).split('|')
    parti.forEach((id, i) => {
      const asse = ASSI[i]; if (!asse || !id) return
      const g = per[asse][id] || (per[asse][id] = { id, n: 0, somma: 0, male: 0, buona: 0, ottima: 0 })
      g.n++; g.somma += v; g[c.qualita]++
    })
  }

  for (const a of ASSI) {
    for (const g of Object.values(per[a])) {
      g.punteggio = g.n ? g.somma / g.n : 0
      g.affidabile = g.n >= GIUDIZI_MINIMI
    }
  }
  return { per, giudicate }
}

// Peso moltiplicativo di un ingrediente, da usare quando si scelgono le
// combinazioni. Chi non ha abbastanza giudizi resta a 1: neutro, non escluso —
// scartare ciò che non si è ancora misurato è il modo di non misurarlo mai.
export function pesi(analisi) {
  const out = {}
  for (const [asse, gruppi] of Object.entries(analisi.per)) {
    out[asse] = {}
    for (const g of Object.values(gruppi)) {
      out[asse][g.id] = g.affidabile
        // da 0,25 (sempre male) a 1,75 (sempre ottima)
        ? Math.max(0.25, Math.min(1.75, 1 + g.punteggio * 0.75))
        : 1
    }
  }
  return out
}

// Gli ingredienti bocciati con costanza: vanno detti al generatore di scene
// come cose da NON fare, oltre che pesati di meno. Un peso basso li rende
// rari; dirlo esplicitamente li rende evitabili.
export function daEvitare(analisi, soglia = -0.5) {
  const out = []
  for (const [asse, gruppi] of Object.entries(analisi.per)) {
    for (const g of Object.values(gruppi)) {
      if (g.affidabile && g.punteggio <= soglia) {
        out.push({ asse, id: g.id, punteggio: +g.punteggio.toFixed(2), n: g.n, male: g.male })
      }
    }
  }
  return out.sort((a, b) => a.punteggio - b.punteggio)
}

// Cosa ha imparato il motore, in forma leggibile. Serve a poterlo CONTESTARE:
// un sistema che si autoregola senza mostrare su cosa si regola è una scatola
// nera che nessuno può correggere.
export function riepilogo(analisi) {
  const righe = []
  for (const [asse, gruppi] of Object.entries(analisi.per)) {
    const ordinati = Object.values(gruppi).filter(g => g.affidabile)
      .sort((a, b) => b.punteggio - a.punteggio)
    if (!ordinati.length) continue
    righe.push({
      asse,
      migliore: ordinati[0],
      peggiore: ordinati[ordinati.length - 1],
      tutti: ordinati.map(g => ({ id: g.id, punteggio: +g.punteggio.toFixed(2), n: g.n })),
    })
  }
  return { giudicate: analisi.giudicate, assi: righe }
}

// Legge i giudizi tollerando che la colonna del motivo non ci sia ancora:
// finche' la migrazione non e' stata eseguita si lavora come prima, invece di
// fermare la produzione delle scene su una colonna mancante.
export async function leggiGiudizi(db, ws) {
  // Gli scarti portano i loro voti: chi ha buttato una creativita' bocciata ha
  // dato il giudizio piu' netto che poteva, e perderlo perche' la riga non c'e'
  // piu' vuol dire rifare lo stesso errore.
  const scarti = await db().from('ce_scarti')
    .select('qualita, qualita_motivo, variante_seme')
    .eq('workspace_id', ws).not('variante_seme', 'is', null)
  const daScarti = scarti.error ? [] : (scarti.data || [])

  const con = await db().from('ce_creatives')
    .select('qualita, qualita_motivo, variante_seme')
    .eq('workspace_id', ws).not('variante_seme', 'is', null)
  if (!con.error) return { righe: [...(con.data || []), ...daScarti], conMotivo: true }
  const senza = await db().from('ce_creatives')
    .select('qualita, variante_seme')
    .eq('workspace_id', ws).not('variante_seme', 'is', null)
  return { righe: [...(senza.data || []), ...daScarti], conMotivo: false }
}
