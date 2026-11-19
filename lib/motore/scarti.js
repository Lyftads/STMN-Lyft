// ============================================================================
//  Memoria di cio' che e' stato buttato.
//
//  Cancellare una creativita' cancellava anche le due cose che servivano a non
//  rifarla: il suo `variante_seme`, che diceva al generatore "questa
//  combinazione l'hai gia' usata", e il voto di qualita', che diceva
//  "quest'ingrediente non funziona". Restava un buco, il generatore lo
//  riempiva, e la creativita' tornava identica il giorno dopo.
//
//  Buttare qualcosa e' un'informazione, la piu' netta che il cliente possa
//  dare: va conservata proprio perche' la riga non c'e' piu'.
//
//  Le funzioni sono tolleranti: se `ce_scarti` non esiste ancora si comportano
//  come prima invece di rompere la produzione. Chi cancella non deve
//  accorgersi di una migrazione in mezzo.
// ============================================================================

const CAMPI = 'creative_id, name, product_id, angle_id, variante_seme, qualita, qualita_motivo, scena_desc'

export async function registraScarti(db, ws, righe) {
  const da = (righe || []).filter(r => r.variante_seme || r.qualita || r.name)
  if (!da.length) return { registrati: 0, tabellaMancante: false }
  const { error } = await db().from('ce_scarti').insert(da.map(r => ({
    workspace_id: ws,
    creative_id: r.id || null,
    name: r.name || null,
    product_id: r.product_id || null,
    angle_id: r.angle_id || null,
    variante_seme: r.variante_seme || null,
    qualita: r.qualita || null,
    qualita_motivo: r.qualita_motivo || null,
    scena_desc: r.scena_desc || null,
  })))
  if (error) {
    if (/ce_scarti/.test(error.message || '')) return { registrati: 0, tabellaMancante: true }
    throw new Error(`scarti: ${error.message}`)
  }
  return { registrati: da.length, tabellaMancante: false }
}

export async function leggiScarti(db, ws) {
  const { data, error } = await db().from('ce_scarti')
    .select(CAMPI).eq('workspace_id', ws)
  if (error) return []            // tabella assente: si lavora come prima
  return data || []
}
