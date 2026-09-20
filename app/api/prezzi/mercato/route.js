export const dynamic = 'force-dynamic'
export const maxDuration = 120

import { NextResponse } from 'next/server'
import { tipoNegozio } from '../../../../lib/team/tipoNegozio'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { withTenantContext, getTenantInfo, getCurrentUserId, getShopify } from '../../../../lib/tenant/credentials'
import { configurato, cerca, prezziDiMercato, registraProgetto } from '../../../../lib/prezzi/merchant'
import { setSnapshot, getSnapshotStale } from '../../../../lib/cache/snapshot'
import { nostriConCosti } from '../../../../lib/prezzi/motore'

// Lo stato del collegamento a Merchant Center e la lettura "adesso" (solo per chi e' entrato).
//  GET            → { configurato, ... } + prova di lettura (3 righe, per capire subito un errore)
//  GET ?leggi=1   → legge tutto il report e lo salva (la stessa cosa che fa il cron due volte al giorno)
// Non restituisce MAI la chiave ne' il token: solo esiti e messaggi d'errore di Google.
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
    if (!ws || !(await getCurrentUserId().catch(() => null))) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    if (!configurato()) return NextResponse.json({ ok: false, configurato: false, manca: [!process.env.GOOGLE_MERCHANT_SA_KEY && 'GOOGLE_MERCHANT_SA_KEY', !process.env.MERCHANT_CENTER_ID && 'MERCHANT_CENTER_ID'].filter(Boolean) })
    try {
      if (new URL(req.url).searchParams.get('leggi') === '1') {
        const m = await prezziDiMercato()
        await setSnapshot(ws, 'prezzi:mercato', { letto: new Date().toISOString(), periodi: m.periodi, righe: m.righe })
        // i nostri articoli devono avere l'identificativo di variante, altrimenti niente si aggancia
        const nostri = (await getSnapshotStale(ws, 'prezzi:nostri'))?.payload
        if (!nostri?.articoli?.[0]?.variantId || !('costo' in nostri.articoli[0])) { const { storeUrl, adminToken } = getShopify(); const articoli = await nostriConCosti(ws, storeUrl, adminToken); await setSnapshot(ws, 'prezzi:nostri', { letto: new Date().toISOString(), articoli }) }
        return NextResponse.json({ ok: true, configurato: true, righe: m.righe.length, versione: m.versione, suggeritiErrore: m.suggeritiErrore, conSuggerito: m.righe.filter(r => r.suggerito != null).length, conTraffico: m.conTraffico, grezzi: m.grezzi, trafficoErrore: m.trafficoErrore, trafficoRighe: m.trafficoRighe, periodi: m.periodi, esempio: m.righe.slice(0, 3) })
      }
      const p = await cerca('SELECT report_country_code, id, offer_id, title, brand, price, benchmark_price FROM price_competitiveness_product_view LIMIT 3', { pagineMax: 1 })
      return NextResponse.json({ ok: true, configurato: true, versione: p.base, prova: p.righe })
    } catch (e) { return NextResponse.json({ ok: false, configurato: true, errore: String(e?.message || e).slice(0, 400), stato: e?.stato || null }) }
  })
}

// POST { email } → registra il progetto Google Cloud sull'account Merchant Center (una volta sola).
export async function POST(req) {
  return withTenantContext(req, async () => {
    const vietato = await soloPerRivenditori(); if (vietato) return vietato
    const ws = getTenantInfo().userId
    if (!ws || !(await getCurrentUserId().catch(() => null))) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    if (!configurato()) return NextResponse.json({ error: 'Merchant Center non configurato' }, { status: 400 })
    const { email } = await req.json().catch(() => ({}))
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(email || '')) || String(email).length > 200) return NextResponse.json({ error: 'Email non valida' }, { status: 400 })
    try { return NextResponse.json(await registraProgetto(String(email).trim())) }
    catch (e) { return NextResponse.json({ ok: false, errore: String(e?.message || e).slice(0, 400), stato: e?.stato || null }, { status: 422 }) }
  })
}
