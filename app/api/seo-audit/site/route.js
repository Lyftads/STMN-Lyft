export const dynamic = 'force-dynamic'
export const maxDuration = 60
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auditPage, discoverUrls } from '../../../../lib/seo/audit'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { getCurrentUserId } from '../../../../lib/tenant/credentials'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

// esegue thunks con concorrenza limitata
async function pool(items, fn, concurrency = 4) {
  const out = []
  let i = 0
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (i < items.length) {
      const idx = i++
      out[idx] = await fn(items[idx])
    }
  })
  await Promise.all(workers)
  return out
}

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  const limit = Math.min(Math.max(parseInt(body.limit || 10, 10), 2), 20)
  const urls = await discoverUrls(body.url, limit)
  if (!urls.length) return NextResponse.json({ error: 'Nessuna URL trovata (sitemap/link non raggiungibili).' }, { status: 200 })

  const pages = (await pool(urls, u => auditPage(u, { targetKeyword: body.targetKeyword }), 4))
    .filter(p => p && !p.error)
  if (!pages.length) return NextResponse.json({ error: 'Impossibile analizzare le pagine.' }, { status: 200 })

  // aggregati
  const avgScore = Math.round(pages.reduce((s, p) => s + p.score, 0) / pages.length)
  const scoreLabel = avgScore >= 85 ? 'Eccellente' : avgScore >= 70 ? 'Buono' : avgScore >= 50 ? 'Da migliorare' : 'Critico'
  // problemi più comuni (per checkId)
  const issueMap = new Map()
  for (const p of pages) for (const c of p.checks) {
    if (c.status === 'pass') continue
    const e = issueMap.get(c.id) || { id: c.id, label: c.label, fail: 0, warn: 0 }
    e[c.status]++
    issueMap.set(c.id, e)
  }
  const commonIssues = [...issueMap.values()]
    .map(e => ({ ...e, affected: e.fail + e.warn }))
    .sort((a, b) => b.fail * 2 + b.warn - (a.fail * 2 + a.warn))
    .slice(0, 8)

  const pageRows = pages.map(p => ({
    url: p.url, score: p.score,
    issues: p.checks.filter(c => c.status !== 'pass').map(c => c.label),
  })).sort((a, b) => a.score - b.score)

  // AI summary unica (best-effort)
  let recommendations = []
  if (process.env.OPENAI_API_KEY) {
    try {
      const top = commonIssues.map(i => `${i.label}: ${i.affected}/${pages.length} pagine`).join('\n')
      const r = await fetch(OPENAI_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: JSON.stringify({
          model: MODEL, temperature: 0.4, response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: 'Sei un consulente SEO senior e-commerce. Italiano. Dati i problemi SEO ricorrenti su un sito (con n. pagine colpite), restituisci JSON {"recommendations":[{"priority":"alta|media|bassa","title":"...","action":"..."}]}. Max 6, per impatto sul sito intero.' },
            { role: 'user', content: `Sito: ${new URL(pages[0].url).origin}\nPagine analizzate: ${pages.length}\nScore medio: ${avgScore}\n\nProblemi ricorrenti:\n${top}` },
          ],
        }),
      })
      if (r.ok) recommendations = JSON.parse((await r.json()).choices?.[0]?.message?.content || '{}').recommendations || []
    } catch {}
  }

  const result = {
    mode: 'site', url: new URL(pages[0].url).origin,
    pagesAnalyzed: pages.length, avgScore, scoreLabel,
    commonIssues, pages: pageRows, recommendations,
    updatedAt: new Date().toISOString(),
  }

  if (body.save !== false) {
    try {
      const userId = await getCurrentUserId()
      const admin = getAdminSupabase()
      if (userId && admin) {
        const { data } = await admin.from('seo_audits').insert({
          user_id: userId, url: result.url, mode: 'site', score: avgScore, result,
        }).select('id').maybeSingle()
        if (data?.id) result.savedId = data.id
      }
    } catch {}
  }

  return NextResponse.json(result)
}
