export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 45

import { NextResponse } from 'next/server'
import { auditPage } from '../../../lib/seo/audit'

// Confronto on-page affiancato di più URL (la tua + competitor).
export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}
  const urls = (Array.isArray(body.urls) ? body.urls : []).map(u => String(u || '').trim()).filter(Boolean).slice(0, 5)
  if (urls.length < 2) return NextResponse.json({ error: 'Servono almeno 2 URL.' }, { status: 400 })

  const audits = await Promise.all(urls.map(u => auditPage(u, { targetKeyword: body.targetKeyword })))

  // segnali da confrontare (estratti dai checks/meta)
  const val = (a, id) => a.checks?.find(c => c.id === id)
  const rows = audits.map(a => {
    if (a.error) return { url: a.url, error: a.error }
    return {
      url: a.url,
      score: a.score,
      title: a.meta?.title || '',
      titleLen: (a.meta?.title || '').length,
      descLen: (a.meta?.description || '').length,
      words: a.meta?.words || 0,
      h1: val(a, 'h1')?.value || '',
      jsonld: val(a, 'jsonld')?.status === 'pass',
      hreflang: val(a, 'hreflang')?.status === 'pass',
      og: val(a, 'ogImage')?.status === 'pass',
      altCoverage: val(a, 'alt')?.value ?? null,
      speedMs: a.meta?.loadMs ?? null,
      https: val(a, 'https')?.status === 'pass',
    }
  })

  return NextResponse.json({ rows, updatedAt: new Date().toISOString() })
}
