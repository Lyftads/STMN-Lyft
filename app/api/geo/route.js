export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { countryToLocale } from '../../../lib/i18n/geoLocale'

// Ritorna il paese (da geo-IP di Vercel) e il locale suggerito di conseguenza.
// Best-effort: in locale/dev gli header non ci sono → country null, suggested null.
export async function GET(req) {
  const h = req.headers
  const country =
    h.get('x-vercel-ip-country') ||
    h.get('cf-ipcountry') ||           // se mai dietro Cloudflare
    null
  const suggested = countryToLocale(country)
  return NextResponse.json({ country: country || null, suggested: suggested || null })
}
