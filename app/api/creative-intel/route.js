export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { searchAds, searchBrands, adsByBrand } from '../../../lib/foreplay/client'

// GET /api/creative-intel?mode=ads|brands|brandAds&query=&platform=&format=&order=&brandId=&cursor=
// Competitor Creative Intel: cerca/scompone le creatività dei competitor (Foreplay).
export async function GET(req) {
  const sp = new URL(req.url).searchParams
  const mode = sp.get('mode') || 'ads'
  const query = sp.get('query') || ''
  const platform = sp.get('platform') || ''
  const format = sp.get('format') || ''
  const order = sp.get('order') || ''
  const cursor = sp.get('cursor') || ''
  const limit = Math.min(60, Math.max(1, parseInt(sp.get('limit') || '40')))

  let out
  if (mode === 'brands') out = await searchBrands({ query, limit })
  else if (mode === 'brandAds') out = await adsByBrand({ brandId: sp.get('brandId') || '', limit, cursor })
  else out = await searchAds({ query, platform, format, order, limit, cursor })

  if (out?.error) return NextResponse.json({ ok: false, error: out.error, credits: out.credits ?? null }, { status: 502 })
  return NextResponse.json({ ok: true, ...out })
}
