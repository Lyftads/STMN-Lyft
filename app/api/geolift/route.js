export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getGoogle, getShopify } from '../../../lib/tenant/credentials'
import { swrSnapshot } from '../../../lib/cache/swr'
import { designGeoLift } from '../../../lib/incrementality/geolift'
import { discoverProvinces, discoverRegions, ga4Regions } from '../../../lib/incrementality/geodata'

export async function GET(req) {
  return withTenantContext(req, async () => {
    const g = getGoogle()
    const { storeUrl, adminToken } = getShopify()
    const hasGa4 = !!(g.ga4PropertyId && g.clientId && g.refreshToken)
    const hasShopify = !!(storeUrl && adminToken)
    if (!hasGa4 && !hasShopify) {
      return NextResponse.json({ ok: false, reason: 'no_source' })
    }

    const { searchParams } = new URL(req.url)
    const days = Math.min(180, Math.max(30, parseInt(searchParams.get('days') || '120', 10)))
    const locale = (searchParams.get('locale') || 'it').slice(0, 2)
    // L'unita' del disegno. Di partenza le REGIONI: sono l'unica cosa che Meta sa rileggere
    // (non scende sotto la regione), quindi un test disegnato piu' in basso non si puo' misurare li'.
    // Chi fa un test di solo Google puo' chiedere le province, che Google legge.
    const unita = searchParams.get('unit') === 'province' ? 'province' : 'region'

    return swrSnapshot(req, { tab: `geolift_${days}_${locale}_${unita}`, ttlMs: 6 * 3600 * 1000, compute: async () => {
      // 1) SORGENTE PRIMARIA: vendite vere di Shopify, per regione (o per provincia se richiesto).
      if (hasShopify) {
        const until = new Date().toISOString().slice(0, 10)
        const since = new Date(Date.now() - days * 86400000).toISOString().slice(0, 10)
        if (unita === 'region') {
          const { regions, fuori } = await discoverRegions(storeUrl, adminToken, since, until)
          if (regions.length >= 4) {
            const design = designGeoLift(regions, { metricNote: 'revenue' })
            if (design.ok) {
              // `fuori` = le province che non si sono sapute ricondurre a una regione. Si dichiara
              // quanto fatturato e' rimasto fuori dal pannello invece di farlo sparire in silenzio.
              return { ...design, metric: 'revenue', source: 'shopify_region', unit: 'region', fuori, range: { days }, updatedAt: new Date().toISOString() }
            }
          }
        }
        const regions = await discoverProvinces(storeUrl, adminToken, since, until)
        if (regions.length >= 4) {
          const design = designGeoLift(regions, { metricNote: 'revenue' })
          if (design.ok) {
            return { ...design, metric: 'revenue', source: 'shopify_province', unit: 'province', range: { days }, updatedAt: new Date().toISOString() }
          }
        }
      }

      // 2) FALLBACK / PROXY DENSO: regioni GA4 (geoloc IP; ricavo>conversioni>sessioni).
      if (hasGa4) {
        const { regions, metricKey, error } = await ga4Regions(g, days)
        if (error) return { __noCache: true, ok: false, reason: error }
        const design = designGeoLift(regions, { metricNote: metricKey })
        if (!design.ok) return { __noCache: true, ...design, metric: metricKey, source: 'ga4_region', unit: 'region' }
        return { ...design, metric: metricKey, source: 'ga4_region', unit: 'region', range: { days }, updatedAt: new Date().toISOString() }
      }

      // Shopify c'è ma non ha prodotto abbastanza province, e GA4 non è collegato.
      return { __noCache: true, ok: false, reason: 'not_enough_regions' }
    } })
  })
}
