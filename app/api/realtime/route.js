export const dynamic = 'force-dynamic'
export const maxDuration = 20

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle, getShopify, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { locateByCountry, siglaDelPaese, attornoA } from '../../../lib/geo/countryCentroids'
import { regioneCanonica, CENTRO_REGIONE } from '../../../lib/geo/regioniItalia'
import { getSnapshot, setSnapshot } from '../../../lib/cache/snapshot'
import { shopifyql } from '../../../lib/shopify/shopifyql'

// Live View stile Shopify: utenti attivi (ultimi 30 min) per Paese/città dalla
// GA4 Realtime API. Tenant-aware via getGoogle() come /api/ga4.
async function getAccessToken(g) {
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: g.clientId || '',
      client_secret: g.clientSecret || '',
      refresh_token: g.refreshToken || '',
      grant_type: 'refresh_token',
    }),
  })
  const data = await res.json().catch(() => ({}))
  // Ritorna anche l'errore OAuth (invalid_grant / invalid_client / ...) per diagnosi
  return { token: data.access_token || null, error: data.error || null, desc: data.error_description || null }
}

async function runRealtime(token, propertyId, body) {
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runRealtimeReport`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }
  )
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { ok: res.ok, status: res.status, json, errText: res.ok ? null : text.slice(0, 500) }
}

// ════════════════════════════════════════════════════════════════════════
//  I visitatori in tempo reale vengono da SHOPIFY (19 set 2026, richiesta di
//  Marino). Prima arrivavano da GA4 Realtime: un contatore diverso da quello
//  che si legge nella Live View di Shopify, e senza la regione.
//
//  Shopify non ha un campo "visitatori live" nell'API, ma ShopifyQL accetta
//  `SINCE -30min UNTIL now` e raggruppa per minuto, paese, regione e citta'.
//  Verificato sul negozio: i dati hanno circa DUE MINUTI di ritardo (alle 08:00
//  l'ultimo minuto presente era 07:58).
//    - "in questo momento" = sessioni negli ultimi ~5 minuti disponibili,
//      lo stesso metro della Live View;
//    - il globo e l'elenco per sede usano gli ultimi 30 minuti.
//  ShopifyQL e' limitato: la dashboard chiede ogni 20 secondi, qui si risponde
//  dalla memoria e si rilegge Shopify al massimo una volta ogni 50 secondi.
//  Se Shopify non risponde si serve l'ultima lettura buona; GA4 resta di riserva.
// ════════════════════════════════════════════════════════════════════════
const MEMORIA_MS = 50 * 1000
const memoria = new Map() // store → { at, dati }

// ── La sede del negozio, per il segnaposto sul globo ────────────────────────
//  Sul fork era una costante: quel prodotto ha un negozio solo, a San Benedetto
//  del Tronto. Qui i clienti sono tanti e ognuno ha la sua sede: una costante
//  pianterebbe il segnaposto di tutti sulla sede di un altro. Se ne accorgerebbe
//  solo chi conosce la geografia del proprio negozio — cioe' il cliente.
//
//  Shopify la sa: shop.json porta latitudine e longitudine dell'indirizzo del
//  negozio. Si chiede UNA volta per negozio (come il fuso in corrispettivi/giorno)
//  e si tiene: non e' un dato che cambia mentre si guarda il globo.
//
//  Se manca — negozio senza indirizzo, o chiamata fallita — si risponde null e
//  il globo NON disegna nessun segnaposto. Meglio nessun punto che un punto
//  sbagliato: un globo senza il pallino di casa si nota e si chiede, un pallino
//  sulla citta' sbagliata si crede.
const sedi = new Map() // storeUrl → { lat, lng } | null
async function sedeNegozio(storeUrl, adminToken) {
  if (sedi.has(storeUrl)) return sedi.get(storeUrl)
  let sede = null
  try {
    const r = await fetch(`https://${storeUrl}/admin/api/2026-04/shop.json?fields=latitude,longitude`, {
      headers: { 'X-Shopify-Access-Token': adminToken }, cache: 'no-store',
    })
    if (r.ok) {
      const s = (await r.json().catch(() => null))?.shop
      const lat = Number(s?.latitude), lng = Number(s?.longitude)
      // 0,0 e' in mezzo all'Atlantico: e' come Shopify risponde quando
      // l'indirizzo non e' geolocalizzato, non una sede vera.
      if (Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0)) sede = { lat, lng }
    }
  } catch {}
  sedi.set(storeUrl, sede)
  return sede
}

async function visitatoriShopify() {
  const { storeUrl, adminToken } = getShopify()
  if (!storeUrl || !adminToken) return null
  const gia = memoria.get(storeUrl)
  if (gia && Date.now() - gia.at < MEMORIA_MS) return gia.dati
  let wsId = null
  try { wsId = await getEffectiveTenantId() } catch {}
  if (wsId) {
    const snap = await getSnapshot(wsId, 'realtimeShopify', MEMORIA_MS).catch(() => null)
    if (snap?.points) { memoria.set(storeUrl, { at: Date.now(), dati: snap }); return snap }
  }

  const q = 'FROM sessions SHOW sessions GROUP BY minute, session_country, session_region, session_city SINCE -30min UNTIL now LIMIT 1000'
  // Dalla porta unica, con 50 s di vita CONDIVISA: dieci persone con la Dashboard aperta
  // fanno una interrogazione al minuto in tutto, non dieci. E' un contorno, non un conto:
  // va come lavoro di sottofondo, cosi' non toglie mai il posto ai numeri veri.
  let righe
  try { righe = await shopifyql(q, { ttlMs: 50_000, sfondo: true, attesaMaxMs: 8_000 }) }
  catch {
    // Limite o errore: meglio l'ultima lettura buona (anche di qualche minuto fa) che un globo vuoto.
    if (gia && Date.now() - gia.at < 6 * 60 * 1000) return gia.dati
    return null
  }

  const vuoto = (v) => v == null || v === '' || v === 'null'
  const ultimo = righe.reduce((m, r) => (r.minute > m ? r.minute : m), '')
  const sogliaAdesso = ultimo ? new Date(new Date(ultimo).getTime() - 4 * 60000).toISOString().slice(0, 16) : ''
  let ultimi30 = 0, adesso = 0
  const perSede = new Map()
  for (const r of righe) {
    const n = parseInt(r.sessions, 10) || 0
    if (!n) continue
    ultimi30 += n
    if (String(r.minute).slice(0, 16) >= sogliaAdesso) adesso += n
    const paese = vuoto(r.session_country) ? '' : String(r.session_country)
    const regione = vuoto(r.session_region) ? '' : String(r.session_region)
    const citta = vuoto(r.session_city) ? '' : String(r.session_city)
    const k = `${paese}|${regione}|${citta}`
    const s = perSede.get(k) || { paese, regione, citta, n: 0 }
    s.n += n; perSede.set(k, s)
  }

  const byLocation = [], points = []
  for (const s of [...perSede.values()].sort((a, b) => b.n - a.n)) {
    const sigla = siglaDelPaese(s.paese)
    byLocation.push({ countryId: sigla || '', country: s.paese || '—', city: s.citta, activeUsers: s.n })
    // Italia: la regione ha un posto preciso. Altrove: il centro del paese, con uno scarto per citta'.
    const reg = sigla === 'IT' ? regioneCanonica(s.regione) : null
    const centro = reg && CENTRO_REGIONE[reg]
    const dove = centro ? attornoA(centro[0], centro[1], s.citta) : (sigla ? locateByCountry(sigla, s.citta || s.regione) : null)
    if (dove) points.push({ lat: dove.lat, lng: dove.lng, count: s.n, label: [s.citta || reg || null, s.paese].filter(Boolean).join(', ') })
  }
  const dati = {
    configured: true, fonte: 'shopify',
    activeUsers: adesso, ultimi30,
    ultimoMinuto: ultimo || null,
    byLocation: byLocation.slice(0, 12), points,
    // Il segnaposto di casa sul globo. Non blocca il resto: se Shopify non
    // risponde, i puntini delle sessioni si disegnano lo stesso.
    sede: await sedeNegozio(storeUrl, adminToken).catch(() => null),
    updatedAt: new Date().toISOString(),
  }
  memoria.set(storeUrl, { at: Date.now(), dati })
  if (wsId) setSnapshot(wsId, 'realtimeShopify', dati).catch(() => {})
  return dati
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    // Prima Shopify. `?fonte=ga4` forza la vecchia lettura, per confronto.
    const soloGa4 = new URL(request.url).searchParams.get('fonte') === 'ga4'
    if (!soloGa4) {
      try { const dati = await visitatoriShopify(); if (dati) return NextResponse.json(dati) } catch {}
    }
    const g = getGoogle()
    const propertyId = g.ga4PropertyId
    if (!propertyId || !g.clientId || !g.refreshToken) {
      return NextResponse.json({ configured: false })
    }

    const { searchParams } = new URL(request.url)
    const debug = searchParams.get('debug') === '1'

    try {
      const auth = await getAccessToken(g)
      if (!auth.token) {
        // Token refresh fallito: in debug mostra l'errore OAuth esatto
        if (debug) {
          return NextResponse.json({
            configured: true, propertyId,
            oauthError: auth.error, oauthDesc: auth.desc,
            hint: auth.error === 'invalid_grant'
              ? 'Refresh token scaduto/revocato (probabile consent screen in Test mode → scade ogni 7gg). Ricollega Google o pubblica il consent screen.'
              : 'Verifica GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN.',
          })
        }
        throw new Error('Google OAuth failed')
      }
      const token = auth.token

      const res = await runRealtime(token, propertyId, {
        dimensions: [{ name: 'countryId' }, { name: 'country' }, { name: 'city' }],
        metrics: [{ name: 'activeUsers' }],
        orderBys: [{ metric: { metricName: 'activeUsers' }, desc: true }],
        limit: 100,
      })

      if (debug) {
        return NextResponse.json({
          configured: true,
          propertyId,
          apiOk: res.ok,
          apiStatus: res.status,
          apiError: res.errText,
          rowCount: res.json?.rows?.length || 0,
          sampleRows: (res.json?.rows || []).slice(0, 5),
        })
      }

      const rows = res.json?.rows || []
      let activeUsers = 0
      const byLocation = []
      const points = []

      for (const r of rows) {
        const countryId = r.dimensionValues?.[0]?.value || ''
        const country = r.dimensionValues?.[1]?.value || ''
        const city = r.dimensionValues?.[2]?.value || ''
        const count = parseInt(r.metricValues?.[0]?.value || '0', 10)
        if (!count) continue
        activeUsers += count

        const loc = locateByCountry(countryId, city)
        byLocation.push({
          countryId,
          country: country || loc?.countryName || countryId,
          city: city && city !== '(not set)' ? city : '',
          activeUsers: count,
        })
        if (loc) {
          points.push({
            lat: loc.lat,
            lng: loc.lng,
            count,
            label: [city && city !== '(not set)' ? city : null, country || loc.countryName]
              .filter(Boolean)
              .join(', '),
          })
        }
      }

      return NextResponse.json({
        configured: true,
        fonte: 'ga4',
        activeUsers,
        byLocation: byLocation.slice(0, 12),
        points,
        updatedAt: new Date().toISOString(),
      })
    } catch (e) {
      return NextResponse.json({ configured: false, error: e.message }, { status: 200 })
    }
  })
}
