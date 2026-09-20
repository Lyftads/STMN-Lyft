export const dynamic = 'force-dynamic'
export const maxDuration = 30

import { NextResponse } from 'next/server'
import { withTenantContext, getShopify } from '../../../../lib/tenant/credentials'

// ============================================================================
//  Ordini di UN giorno del registro — il drill per controllare a mano.
//
//  Fonte diversa dal registro (Admin API invece di Analytics), e la differenza
//  va detta invece di nasconderla: qui gli ordini sono quelli CREATI quel
//  giorno, mentre il registro segue la data di competenza del report, dove
//  resi e rimborsi cadono nel giorno del movimento. I due totali quindi non
//  devono per forza coincidere: questo elenco serve a vedere QUALI ordini
//  hanno fatto la giornata, non a rifare la somma.
//
//  Limite di Shopify: senza lo scope read_all_orders l'API restituisce solo
//  gli ultimi 60 giorni, e lo fa in silenzio (HTTP 200 con meno ordini). Per
//  questo la copertura si misura sui dati e viene dichiarata.
//
//  GET ?giorno=YYYY-MM-DD
// ============================================================================

const soldi = (v) => { const n = parseFloat(String(v ?? '').replace(/[^0-9.-]/g, '')); return Number.isFinite(n) ? Math.round(n * 100) / 100 : 0 }

// Il giorno di un ordine e' quello del NEGOZIO, non quello di chi guarda: a cavallo
// della mezzanotte lo stesso ordine cade in due date diverse a seconda del fuso. Nel
// fork l'orario era scritto a mano (+02:00, l'ora legale italiana): con UN negozio
// bastava, qui sposterebbe di un giorno gli ordini di chiunque stia in un altro fuso —
// e anche i suoi, d'inverno. Il fuso si chiede a Shopify UNA volta per negozio.
const fusi = new Map()   // storeUrl → fuso IANA, es. 'Europe/Rome'

async function fusoNegozio(storeUrl, adminToken) {
  if (fusi.has(storeUrl)) return fusi.get(storeUrl)
  let iana = null
  try {
    const r = await fetch(`https://${storeUrl}/admin/api/2026-04/shop.json?fields=iana_timezone`, {
      headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store',
    })
    if (r.ok) iana = (await r.json().catch(() => null))?.shop?.iana_timezone || null
  } catch {}
  fusi.set(storeUrl, iana)
  return iana
}

// Lo scarto da UTC di quel fuso IN QUEL GIORNO: cosi' l'ora legale la decide il
// calendario e non una costante (a Roma +01:00 d'inverno, +02:00 d'estate).
function scartoUtc(iana, giorno) {
  try {
    const parti = new Intl.DateTimeFormat('en-US', { timeZone: iana, timeZoneName: 'longOffset' })
      .formatToParts(new Date(`${giorno}T12:00:00Z`))
    const nome = parti.find(p => p.type === 'timeZoneName')?.value || ''
    const m = /GMT([+-])(\d{2}):?(\d{2})?/.exec(nome)
    return m ? `${m[1]}${m[2]}:${m[3] || '00'}` : '+00:00'
  } catch { return '+00:00' }
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const giorno = String(new URL(req.url).searchParams.get('giorno') || '').slice(0, 10)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno)) {
      return NextResponse.json({ ok: false, error: 'Giorno non valido' }, { status: 400 })
    }
    const { storeUrl, adminToken } = getShopify()
    if (!storeUrl || !adminToken) {
      return NextResponse.json({ ok: false, error: 'Shopify non configurato' }, { status: 200 })
    }

    // Il limite dei 60 giorni dipende dal PERMESSO, non dalla data: con
    // read_all_orders lo storico e' completo, e continuare ad avvisare
    // sarebbe un allarme falso. Verificato: con lo scope attivo si leggono
    // ordini di dieci mesi prima.
    const eta = Math.floor((Date.now() - Date.parse(`${giorno}T12:00:00Z`)) / 86400000)
    let storicoCompleto = false
    try {
      const rp = await fetch(`https://${storeUrl}/admin/oauth/access_scopes.json`, {
        headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store',
      })
      if (rp.ok) {
        const jp = await rp.json().catch(() => null)
        storicoCompleto = (jp?.access_scopes || []).some(x => x.handle === 'read_all_orders')
      }
    } catch { storicoCompleto = false }
    const oltreLaFinestra = eta > 59 && !storicoCompleto

    // Se Shopify non dice il fuso si ripiega su Roma: questo registro nasce per
    // l'IVA italiana, quindi e' il ripiego meno sbagliato — ma calcolato, non
    // scritto a mano, cosi' d'inverno non sposta comunque le giornate.
    const iana = (await fusoNegozio(storeUrl, adminToken)) || 'Europe/Rome'
    const scarto = scartoUtc(iana, giorno)

    const url = `https://${storeUrl}/admin/api/2024-01/orders.json?status=any` +
      `&created_at_min=${encodeURIComponent(`${giorno}T00:00:00${scarto}`)}` +
      `&created_at_max=${encodeURIComponent(`${giorno}T23:59:59${scarto}`)}` +
      `&limit=250&fields=id,name,created_at,current_subtotal_price,current_total_tax,current_total_price,` +
      `total_discounts,shipping_lines,currency,financial_status,shipping_address,billing_address,refunds,cancelled_at`

    const res = await fetch(url, { headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store' })
    if (!res.ok) {
      return NextResponse.json({ ok: false, error: `Shopify HTTP ${res.status}`, oltreLaFinestra }, { status: 200 })
    }
    const dati = await res.json().catch(() => null)

    const ordini = (dati?.orders || []).map(o => {
      const paese = o.shipping_address?.country_code || o.billing_address?.country_code || null
      const rimborsato = (o.refunds || []).reduce((s, r) => s + (r.transactions || [])
        .reduce((t, x) => t + (x.kind === 'refund' ? soldi(x.amount) : 0), 0), 0)
      // Verificato sugli ordini veri: i prezzi sono IVA inclusa, quindi
      // `current_total_tax` e' l'imposta CONTENUTA nel totale e l'imponibile
      // si ottiene per differenza. Sommare l'IVA al totale la conterebbe due
      // volte (AV#4788: totale 114,40 con 20,63 di IVA dentro).
      const totale = soldi(o.current_total_price ?? o.total_price)
      const iva = soldi(o.current_total_tax)
      const spedizione = (o.shipping_lines || []).reduce((s, l) => s + soldi(l.price), 0)
      return {
        id: String(o.id),
        numero: o.name,
        ora: String(o.created_at || '').slice(11, 16),
        paese,
        // Non e' un errore da correggere: diversi clienti scrivono i dati di
        // spedizione nel campo della fatturazione. Serve solo a dire da dove
        // arriva il paese, perche' e' lui a decidere il perimetro fiscale.
        paeseDaSpedizione: !!o.shipping_address?.country_code,
        lordo: totale,
        totale,
        iva,
        imponibile: Math.round((totale - iva) * 100) / 100,
        spedizione: Math.round(spedizione * 100) / 100,
        sconti: soldi(o.total_discounts),
        rimborsato: Math.round(rimborsato * 100) / 100,
        stato: o.cancelled_at ? 'annullato' : (o.financial_status || ''),
        link: `https://${storeUrl.replace('.myshopify.com', '')}.myshopify.com/admin/orders/${o.id}`,
      }
    }).sort((a, b) => a.ora.localeCompare(b.ora))

    return NextResponse.json({
      ok: true,
      giorno,
      ordini,
      totale: Math.round(ordini.reduce((s, o) => s + o.totale, 0) * 100) / 100,
      imponibile: Math.round(ordini.reduce((s, o) => s + o.imponibile, 0) * 100) / 100,
      iva: Math.round(ordini.reduce((s, o) => s + o.iva, 0) * 100) / 100,
      rimborsato: Math.round(ordini.reduce((s, o) => s + o.rimborsato, 0) * 100) / 100,
      senzaPaeseSpedizione: ordini.filter(o => !o.paeseDaSpedizione).length,
      oltreLaFinestra,
      // Detto, non dedotto: su quale fuso e' stata tagliata la giornata.
      fuso: iana,
      // Detto in chiaro: e' un elenco, non una riconciliazione.
      nota: 'Ordini creati in questa data. Il registro segue la data di competenza del report, quindi i totali possono non coincidere.',
    })
  })
}
