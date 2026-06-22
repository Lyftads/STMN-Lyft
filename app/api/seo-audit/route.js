export const dynamic = 'force-dynamic'
export const maxDuration = 30
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { auditPage } from '../../../lib/seo/audit'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { getCurrentUserId } from '../../../lib/tenant/credentials'
import { aiLangSystemMessage } from '../../../lib/i18n/aiLang'
import { callBrain } from '../../../lib/agent/gateway'
import { assertPublicUrl } from '../../../lib/security/ssrf'

const OPENAI_URL = 'https://api.openai.com/v1/chat/completions'
const MODEL = process.env.OPENAI_MODEL || 'gpt-4o'

async function aiRecommendations(result, locale) {
  if (!process.env.OPENAI_API_KEY) return []
  try {
    const issues = result.checks.filter(c => c.status !== 'pass').map(c => `${c.label}: ${c.detail}`).join('\n')
    // Tool mode: brand+memorie+knowledge nel contesto, schema output invariato.
    const { parsed } = await callBrain({
      skill: {
        id: 'seo',
        json: true,
        systemPrompt: 'Sei un consulente SEO senior per e-commerce. Rispondi in italiano. Dato l\'elenco dei problemi SEO on-page, restituisci JSON {"recommendations":[{"priority":"alta|media|bassa","title":"...","action":"azione concreta in 1 frase"}]}. Max 6, ordinate per impatto. Concrete, niente fuffa.',
      },
      query: `SEO on-page ottimizzazione contenuti e-commerce ${result.meta?.title || result.url}`,
      messages: [{ role: 'user', content: `URL: ${result.url}\nTitle: "${result.meta.title}"\n\nProblemi:\n${issues || 'nessuno'}` }],
      locale,
      conversation: false,
      temperature: 0.4,
    })
    return parsed?.recommendations || []
  } catch { return [] }
}

export async function POST(request) {
  let body = {}
  try { body = await request.json() } catch {}

  // Anti-SSRF: l'URL da auditare è input utente → blocca host interni/privati.
  try { await assertPublicUrl(body.url) } catch {
    return NextResponse.json({ error: 'URL non consentito (host interno o non pubblico).' }, { status: 400 })
  }

  const result = await auditPage(body.url, { targetKeyword: body.targetKeyword })
  if (result.error) return NextResponse.json({ error: result.error }, { status: 200 })

  result.recommendations = await aiRecommendations(result, body.locale)
  result.updatedAt = new Date().toISOString()

  // salvataggio storico (best-effort: se la tabella non esiste o non loggato, ignora)
  if (body.save !== false) {
    try {
      const userId = await getCurrentUserId()
      const admin = getAdminSupabase()
      if (userId && admin) {
        const { data } = await admin.from('seo_audits').insert({
          user_id: userId, url: result.url, mode: 'page', score: result.score, result,
        }).select('id').maybeSingle()
        if (data?.id) result.savedId = data.id
      }
    } catch {}
  }

  return NextResponse.json(result)
}
