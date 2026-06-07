export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { resolveWorkspace } from '../../../../lib/team/workspace'

// Ricerca canzoni per i post social. Usa l'iTunes Search API (Apple Music,
// gratis, no key) come "libreria" per trovare il brano + anteprima 30s. NB:
// non è il catalogo interno di IG/TikTok (licenze, nessuna API) — il brano va
// confermato in-app al momento della pubblicazione. Proxy server-side (CORS).
export async function GET(req) {
  const ws = await resolveWorkspace()
  if (!ws) return NextResponse.json({ ok: false, results: [] }, { status: 401 })
  const q = (new URL(req.url).searchParams.get('q') || '').trim()
  if (!q) return NextResponse.json({ ok: true, results: [] })
  try {
    const url = `https://itunes.apple.com/search?term=${encodeURIComponent(q)}&media=music&entity=song&limit=10`
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const j = await r.json()
    const results = (j.results || []).map(x => ({
      id: x.trackId,
      title: x.trackName,
      artist: x.artistName,
      artwork: (x.artworkUrl100 || '').replace('100x100', '200x200') || x.artworkUrl60 || null,
      preview: x.previewUrl || null,
      duration: x.trackTimeMillis ? Math.round(x.trackTimeMillis / 1000) : null,
    })).filter(x => x.title && x.artist)
    return NextResponse.json({ ok: true, results })
  } catch (e) {
    return NextResponse.json({ ok: false, results: [], error: e.message })
  }
}
