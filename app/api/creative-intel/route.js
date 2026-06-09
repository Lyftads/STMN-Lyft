export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import * as scrape from '../../../lib/adlibrary/scrape'
import * as metaApi from '../../../lib/adlibrary/meta'

// GET /api/creative-intel — Competitor Creative Intel (solo Meta Ad Library, gratis).
//   source=scrape (default, nessuna app/token) | api (API ufficiale, token Meta)
//   query · country · format · limit · cursor
export async function GET(req) {
  const sp = new URL(req.url).searchParams
  const source = sp.get('source') === 'api' ? 'api' : 'scrape'
  const query = sp.get('query') || ''
  const country = sp.get('country') || 'IT'
  const limit = Math.min(50, Math.max(1, parseInt(sp.get('limit') || '40')))
  const cursor = sp.get('cursor') || ''
  const fmt = (sp.get('format') || '').toUpperCase()

  let out
  if (source === 'api') {
    const media = fmt === 'VIDEO' ? 'VIDEO' : fmt === 'IMAGE' ? 'IMAGE' : ''
    out = await metaApi.searchAds({ query, country, media, limit, after: cursor })
  } else {
    out = await scrape.searchAds({ query, country, limit, cursor })
    // Se lo scraping viene bloccato e c'è il token Meta, ripiega sull'API ufficiale.
    if (out?.error && process.env.META_ACCESS_TOKEN) {
      const media = fmt === 'VIDEO' ? 'VIDEO' : fmt === 'IMAGE' ? 'IMAGE' : ''
      const alt = await metaApi.searchAds({ query, country, media, limit })
      if (!alt.error) out = { ...alt, fellBack: true }
    }
  }

  if (out?.error) return NextResponse.json({ ok: false, error: out.error }, { status: 502 })
  // filtro formato lato server (lo scraping non lo applica a monte)
  let ads = out.ads || []
  if (fmt && source === 'scrape') ads = ads.filter(a => a.format === fmt)
  return NextResponse.json({ ok: true, source, ads, cursor: out.cursor || null, fellBack: !!out.fellBack })
}
