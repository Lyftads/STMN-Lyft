// ============================================================================
//  Gli insiemi di dati per cliente: segmenti, avatar, matrice, template, regole
//  e riferimenti. Ogni cliente ha la sua cartella; la scheda del cliente
//  (ce_brand.matrice) dice quale insieme usa. Chi non ne ha uno riceve VUOTO.
//
//  Oggi stanno su file perche' il primo (Saracino 1925) e' nato cosi'. Il passo
//  successivo e' portarli in tabella, cosi' un cliente nuovo si crea la sua
//  matrice dall'app senza un rilascio.
// ============================================================================
import saracinoSegmenti from './saracino/segmenti.json'
import saracinoRighe from './saracino/matrice.json'
import saracinoTemplate from './saracino/template.json'
import saracinoRegole from './saracino/regole.json'
import saracinoRiferimenti from './saracino/riferimenti.json'
import * as saracinoConfezione from './saracino/confezione'

const perId = (lista) => new Map(lista.map(x => [x.id, x]))

function prepara({ segmenti, righe, template, regole, riferimenti, confezione }) {
  const SEGMENTI = segmenti.segmenti || [], CLUSTER = segmenti.cluster || [], AVATAR = segmenti.avatar || []
  return {
    aggiornato: segmenti.aggiornato || null, documento: segmenti.documento || null,
    SEGMENTI, CLUSTER, AVATAR, MATRICE: righe || [], TEMPLATE: template || [], REGOLE: regole || {}, RIFERIMENTI: riferimenti || {},
    avatarPerId: perId(AVATAR), clusterPerId: perId(CLUSTER), rigaPerId: perId(righe || []),
    segmentoPerCodice: new Map(SEGMENTI.map(s => [s.codice, s])),
    confezione: confezione || null,
  }
}

const VUOTO = prepara({ segmenti: {}, righe: [], template: [], regole: {}, riferimenti: {} })

const INSIEMI = {
  saracino: prepara({ segmenti: saracinoSegmenti, righe: saracinoRighe, template: saracinoTemplate, regole: saracinoRegole, riferimenti: saracinoRiferimenti, confezione: saracinoConfezione }),
}

export const insiemeDi = (nome) => INSIEMI[nome] || VUOTO
export const INSIEMI_NOTI = Object.keys(INSIEMI)
