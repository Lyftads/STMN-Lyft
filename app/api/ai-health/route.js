export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../lib/tenant/credentials'
import * as openai from '../../../lib/agent/providers/openai'
import * as fallback from '../../../lib/agent/providers/fallback'

// Diagnostica provider AI (solo owner o cron). Verifica che OpenAI e il provider
// di fallback (OpenRouter ecc.) siano configurati e — con ?ping=1 — rispondano.
// Il fallback in produzione si attiva solo quando OpenAI fallisce: questo è il
// modo per validarlo SENZA aspettare un down. Vedi docs/AI_PROVIDER.md.
export async function GET(req) {
  const owner = process.env.LYFT_OWNER_USER_ID
  const cronOk = !!process.env.CRON_SECRET && req.headers.get('x-internal-cron') === process.env.CRON_SECRET
  let userId = null
  try { userId = await getCurrentUserId() } catch {}
  if (!cronOk && (!owner || userId !== owner)) return NextResponse.json({ error: 'forbidden' }, { status: 403 })

  const ping = new URL(req.url).searchParams.get('ping') === '1'

  const status = {
    openai: { configured: openai.isConfigured() },
    fallback: {
      configured: fallback.isConfigured(),
      baseUrl: process.env.AI_FALLBACK_BASE_URL || null,
      model: fallback.defaultModel() || null,
    },
  }

  if (ping) {
    const probe = async (prov, model) => {
      const t = Date.now()
      try {
        const r = await prov.chatComplete({
          model,
          messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
          temperature: 0,
          maxTokens: 5,
          signal: AbortSignal.timeout(20000),
        })
        return { ok: true, ms: Date.now() - t, model, sample: (r.content || '').slice(0, 40) }
      } catch (e) {
        return { ok: false, ms: Date.now() - t, model, status: e?.status || null, error: (e?.message || '').slice(0, 200) }
      }
    }
    if (status.openai.configured) status.openai.ping = await probe(openai, process.env.OPENAI_MODEL || 'gpt-4o')
    if (status.fallback.configured) status.fallback.ping = await probe(fallback, fallback.defaultModel())
  }

  return NextResponse.json(status)
}
