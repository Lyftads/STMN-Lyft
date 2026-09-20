export const dynamic = 'force-dynamic'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { tipoNegozio } from '../../../lib/team/tipoNegozio'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { withTenantContext, getTenantInfo, getShopify, getCurrentUserId } from '../../../lib/tenant/credentials'
import { quadro, leggiConcorrenti, scriviConcorrenti, puliscDominio, verificaShopify, passata, nostriConCosti, CONCORRENTI_MAX } from '../../../lib/prezzi/motore'
import { getSnapshotStale, setSnapshot } from '../../../lib/cache/snapshot'

// GET  → il quadro: nostri articoli con le offerte dei concorrenti, e lo stato di ogni concorrente.
// POST → { azione: 'aggiungi' | 'togli' | 'rileggi', dominio }. Aggiungere un dominio lo VERIFICA
//        (dev'essere un negozio Shopify col catalogo pubblico) e fa subito la prima lettura.
// Questa funzione serve solo a chi vende marchi di ALTRI. Un negozio che vende i propri prodotti
// non ha nessuno che venda lo stesso articolo: il report di Google e' vuoto per costruzione, e la
// tab direbbe soltanto «nessun concorrente». Prima di chiamare Shopify o Google si controlla il
// tipo di negozio (companies.multimarca, vedi lib/team/tipoNegozio.js) e si risponde in chiaro.
// La guardia sta sul SERVER e non solo nel menu: una chiamata diretta brucerebbe comunque le
// interrogazioni a Shopify, che sono ~30 al minuto per negozio e valgono per tutto il prodotto.
async function soloPerRivenditori() {
  const ws = getTenantInfo().userId
  if (!ws) return null
  try {
    const sb = getAdminSupabase()
    const { data } = await sb.from('companies')
      .select('multimarca, marchi_rilevati, quota_primo_marchio, canali_esclusi, negozi_fisici, etichetta_negozi_fisici')
      .eq('user_id', ws).maybeSingle()
    const t = tipoNegozio(data || {})
    if (t.multimarca) return null
    return NextResponse.json({ ok: false, attivo: false, motivo: 'monomarca',
      spiegazione: 'Questa sezione confronta i tuoi prezzi con quelli di chi vende gli stessi articoli. Il tuo negozio risulta vendere solo il proprio marchio, quindi non c\'e\' nessuno con cui confrontarsi. Se non e\' cosi\', si cambia dalle impostazioni.' })
  } catch { return null }   // se la colonna non c'e' ancora, non si blocca niente
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const vietato = await soloPerRivenditori(); if (vietato) return vietato
    const ws = getTenantInfo().userId
    if (!ws) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    return NextResponse.json({ ok: true, ...(await quadro(ws)) })
  })
}

export async function POST(req) {
  return withTenantContext(req, async () => {
    const vietato = await soloPerRivenditori(); if (vietato) return vietato
    const ws = getTenantInfo().userId
    if (!ws || !(await getCurrentUserId().catch(() => null))) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    const { azione, dominio: grezzo } = await req.json().catch(() => ({}))
    const dominio = puliscDominio(grezzo)
    if (!dominio || !['aggiungi', 'togli', 'rileggi'].includes(azione)) return NextResponse.json({ error: 'Dominio non valido' }, { status: 400 })
    const { domini } = await leggiConcorrenti(ws)
    try {
      if (azione === 'togli') { await scriviConcorrenti(ws, domini.filter(d => d.dominio !== dominio)); return NextResponse.json({ ok: true, ...(await quadro(ws)) }) }
      if (azione === 'aggiungi') {
        if (domini.some(d => d.dominio === dominio)) return NextResponse.json({ error: 'È già in elenco' }, { status: 409 })
        if (domini.length >= CONCORRENTI_MAX) return NextResponse.json({ error: `Al massimo ${CONCORRENTI_MAX} concorrenti` }, { status: 400 })
        await verificaShopify(dominio)
        await scriviConcorrenti(ws, [...domini, { dominio, aggiunto: new Date().toISOString() }])
      } else if (!domini.some(d => d.dominio === dominio)) return NextResponse.json({ error: 'Non è in elenco' }, { status: 404 })
      // i nostri articoli: quelli dell'ultima passata, se recenti; altrimenti si rileggono
      const { storeUrl, adminToken } = getShopify()
      let nostri = (await getSnapshotStale(ws, 'prezzi:nostri'))
      // si rileggono se mancano, se sono vecchi o se sono di PRIMA dell'identificativo di variante
      // (senza quello il prezzo di mercato di Google non si aggancia a nessun articolo)
      if (!nostri?.payload?.articoli?.length || nostri.ageMs > 6 * 3600_000 || !nostri.payload.articoli[0]?.variantId || !('costo' in nostri.payload.articoli[0])) { const articoli = await nostriConCosti(ws, storeUrl, adminToken); await setSnapshot(ws, 'prezzi:nostri', { letto: new Date().toISOString(), articoli }); nostri = { payload: { articoli } } }
      const esito = await passata(ws, dominio, nostri.payload.articoli)
      return NextResponse.json({ ok: true, esito: { ...esito, offerte: undefined }, ...(await quadro(ws)) })
    } catch (e) { return NextResponse.json({ error: String(e?.message || e).slice(0, 160) }, { status: 422 }) }
  })
}
