// I 12 formati statici — stessa tassonomia del cervello di LyftAI
// (lib/agent/staticCreativeSystem.js). Vive qui perché il motore la usa sia per
// classificare l'esistente sia per generare: se le due liste divergono, i
// confronti storici si rompono.
export const FORMATI = [
  ['PRODUCT-HERO',   'BOF',      'prodotto pulito su fondo neutro, zero distrazioni'],
  ['SOCIAL-PROOF',   'MOF/BOF',  'recensioni, stelle, numero clienti, endorsement'],
  ['PRIMA-DOPO',     'MOF',      'stato problema vs risultato, trasformazione visibile'],
  ['FEATURE-CALLOUT','MOF',      'annotazioni sul prodotto che indicano benefici'],
  ['NOI-VS-LORO',    'TOF/MOF',  'confronto con la categoria o col vecchio modo'],
  ['UGC-NATIVE',     'TOF',      'sembra contenuto organico, non pubblicità'],
  ['GRIGLIA',        'TOF/MOF',  'più celle: prodotto, contesto, dettaglio'],
  ['OFFERTA',        'BOF',      "l'offerta è l'eroe, il prodotto è secondario"],
  ['UGLY-LOFI',      'TOF',      'deliberatamente non patinato, rottura del pattern'],
  ['DATA-CALLOUT',   'MOF',      'un solo numero protagonista'],
  ['MEME',           'TOF',      'ironia, riferimento culturale'],
  ['LISTICLE',       'MOF',      '3-5 motivi o benefici in elenco'],
]
export const NOMI_FORMATI = FORMATI.map(f => f[0])
export const FUNNEL = ['TOFU', 'MOFU', 'BOFU']

// Ogni formato NASCE con una fase di funnel: sta già nella tabella qui sopra.
// Il generatore però la scriveva solo per i brief di tipo "copri-funnel", e
// tutto il resto usciva senza fase — cioè invisibile a ogni ragionamento sulla
// copertura del funnel, che è esattamente il lavoro per cui esiste il motore.
//
// Sui formati a cavallo (TOF/MOF, MOF/BOF) vince il PRIMO: è la fase primaria,
// quella per cui il formato è pensato; la seconda è dove regge anche.
const MAPPA = { TOF: 'TOFU', MOF: 'MOFU', BOF: 'BOFU' }
export function funnelDiFormato(nome) {
  const riga = FORMATI.find(f => f[0] === nome)
  if (!riga) return null
  return MAPPA[riga[1].split('/')[0]] || null
}
