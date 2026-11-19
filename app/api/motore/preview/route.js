import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { getMetaCreds } from '../../../../lib/motore/meta'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// Anteprima ufficiale Meta dell'inserzione: restituisce un iframe che rende
// l'ad com'è davvero — video inclusi, che altrimenti non si vedrebbero.
// Si chiede a richiesta (all'apertura del pannello), non durante l'ingest:
// sono 134 chiamate in più a notte per un dato che serve solo quando guardi.
async function GET__(req) {
  const adId = new URL(req.url).searchParams.get('adId')
  if (!adId) return NextResponse.json({ error: 'adId mancante' }, { status: 400 })
  try {
    const creds = await getMetaCreds(wsMotore())
    if (!creds.accessToken) return NextResponse.json({ error: 'Meta non collegato' }, { status: 400 })
    const v = process.env.META_GRAPH_VERSION || 'v20.0'
    const qs = new URLSearchParams({ ad_format: 'MOBILE_FEED_STANDARD', access_token: creds.accessToken })
    const res = await fetch(`https://graph.facebook.com/${v}/${adId}/previews?${qs}`, {
      cache: 'no-store', signal: AbortSignal.timeout(20000),
    })
    const j = await res.json().catch(() => ({}))
    if (!res.ok || j?.error) throw new Error(j?.error?.message || `HTTP ${res.status}`)
    const html = j?.data?.[0]?.body || ''
    // Da <iframe src="..."> si estrae il solo src: incorporare l'HTML di Meta
    // dentro la pagina significherebbe iniettare markup di terzi.
    const src = (html.match(/src="([^"]+)"/) || [])[1] || null
    return NextResponse.json({ src: src ? src.replace(/&amp;/g, '&') : null })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'anteprima non disponibile' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
