// ============================================================================
//  Le soglie dei giudizi di "Performance prodotti Google".
//
//  Sono SCELTE commerciali, non verita': quanta spesa serve prima di giudicare un
//  prodotto, sotto quale ROAS non si scala, con quanti pezzi in magazzino. Prima erano
//  costanti nel codice e per cambiarle serviva uno sviluppatore; il 19 set 2026 il
//  debug della tab ha mostrato che con 10 pezzi minimi e una giacenza mediana di 3
//  "Da scalare" restava sempre a zero. Ora si regolano dalla tab, per workspace.
//
//  MULTI-CLIENTE. `iva` sta qui dentro per lo stesso motivo: 22 e' l'aliquota
//  italiana, e il valore che Google riporta e' lordo mentre il costo prodotto no.
//  Cablata nel codice avrebbe scorporato il 22% anche a un cliente tedesco (19) o
//  svizzero, cioe' avrebbe sbagliato OGNI margine di quel cliente senza dirlo.
//  A 0 lo scorporo non si fa: e' il caso di chi passa a Google valori gia' netti.
// ============================================================================
export const SOGLIE_PREDEFINITE = { banda: 0.30, rapportoPrezzoSpesa: 4, sogliaRipiego: 25, scortaMinima: 10, roasMinimo: 4, scartoMax: 0.45, iva: 22 }
export const LIMITI_SOGLIE = { banda: [0, 0.9], rapportoPrezzoSpesa: [1, 20], sogliaRipiego: [1, 500], scortaMinima: [0, 200], roasMinimo: [0, 30], scartoMax: [0.05, 1], iva: [0, 50] }

export function soglieValide(v = {}) {
  const out = { ...SOGLIE_PREDEFINITE }
  for (const [k, [min, max]] of Object.entries(LIMITI_SOGLIE)) { const n = Number(v?.[k]); if (v?.[k] != null && v[k] !== '' && Number.isFinite(n)) out[k] = Math.min(max, Math.max(min, n)) }
  out.scortaMinima = Math.round(out.scortaMinima)
  return out
}

// Breve e stabile: entra nella chiave della cache, cosi' cambiare una soglia cambia i giudizi subito.
export const improntaSoglie = (S) => Object.keys(SOGLIE_PREDEFINITE).map(k => S[k]).join('_')
