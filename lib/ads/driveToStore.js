// ============================================================================
//  Drive to Store — la spesa dei negozi fisici sta fuori dalle metriche online
//
//  Le campagne Drive to Store non portano traffico al sito: il loro link e'
//  un indirizzo di Google Maps che dice dov'e' il negozio. Sono un costo vero
//  dell'azienda, ma non lo ha "speso" l'e-commerce: lasciarle dentro abbassa
//  ROAS e MER e alza CAC e CPO, cioe' proprio i numeri su cui si decide quanto
//  investire online, per una spesa che online non puo' rendere nulla.
//
//  REGOLA (decisa da Marino il 18 set 2026, vale per sempre): ogni campagna che
//  ha "drivetostore" nel nome — comunque scritto: DriveToStore, Drive_to_Store,
//  "drive to store" — e' esclusa da TUTTI i calcoli del SaaS e mostrata a
//  parte. Resta solo nel conto economico, perche' e' un costo. Vale anche per
//  le campagne future: basta chiamarle cosi'.
//
//  Il discriminatore e' il NOME, non l'obiettivo della campagna: e' la
//  convenzione che il team controlla, ed e' quella chiesta.
// ============================================================================

const pulisci = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]/g, '')

// Una campagna (o un gruppo, o un'inserzione: si passa il nome della CAMPAGNA).
export const isDriveToStore = (nomeCampagna) => pulisci(nomeCampagna).includes('drivetostore')

// Le scritture che il filtro di Meta deve riconoscere. Meta confronta testo con
// testo, quindi servono le varianti con i separatori: il confronto in codice
// (isDriveToStore) resta la rete sotto, per qualunque altra grafia.
const GRAFIE = ['drivetostore', 'drive to store', 'drive_to_store', 'drive-to-store']

// Filtro da aggiungere alle richieste insights di Meta per ESCLUDERE quelle campagne.
export const metaEscludiDriveToStore = () => GRAFIE.map(v => ({ field: 'campaign.name', operator: 'NOT_CONTAIN', value: v }))
// ...e per prendere SOLO quelle (la card che le mostra a parte).
export const metaSoloDriveToStore = () => [{ field: 'campaign.name', operator: 'CONTAIN', value: 'drive' }]

// Unisce il filtro a uno gia' presente nella richiesta.
export const conEsclusione = (filtriEsistenti) => [...(Array.isArray(filtriEsistenti) ? filtriEsistenti : []), ...metaEscludiDriveToStore()]

// Lo stesso filtro, gia' pronto da accodare a un URL costruito a mano.
export const metaFiltroQuery = () => `&filtering=${encodeURIComponent(JSON.stringify(metaEscludiDriveToStore()))}`

// Per gli helper che ricevono i parametri come oggetto: se la richiesta e' a
// `/insights`, aggiunge l'esclusione unendola a un filtro gia' presente.
export const conFiltroInsights = (path, params = {}) => {
  if (!/\/insights$/.test(String(path || ''))) return params
  let esistenti = []
  try { esistenti = params?.filtering ? (typeof params.filtering === 'string' ? JSON.parse(params.filtering) : params.filtering) : [] } catch {}
  return { ...(params || {}), filtering: JSON.stringify(conEsclusione(esistenti)) }
}
