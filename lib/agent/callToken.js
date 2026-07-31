import { createHmac, timingSafeEqual } from 'crypto'

// ============================================================================
//  Token di call per-tenant.
//  Il browser non può dichiarare da solo il proprio workspace (lo falsificherebbe):
//  il server firma { workspaceId, exp } con HMAC e il webhook LLM della call
//  verifica la firma prima di usare quel workspace. Così la voce può servire
//  qualunque cliente restando isolata per tenant.
// ============================================================================

const secret = () => process.env.CALL_SECRET || process.env.CRON_SECRET || ''

export function mintCallToken(workspaceId, ttlMs = 2 * 60 * 60_000) {
  const key = secret()
  if (!key || !workspaceId) return null
  const payload = `${workspaceId}.${Date.now() + ttlMs}`
  const sig = createHmac('sha256', key).update(payload).digest('base64url')
  return `${Buffer.from(payload).toString('base64url')}.${sig}`
}

export function verifyCallToken(token) {
  const key = secret()
  if (!key || typeof token !== 'string' || !token.includes('.')) return null
  try {
    const [b64, sig] = token.split('.')
    const payload = Buffer.from(b64, 'base64url').toString()
    const expected = createHmac('sha256', key).update(payload).digest('base64url')
    const a = Buffer.from(sig), b = Buffer.from(expected)
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null
    const [workspaceId, exp] = payload.split('.')
    if (!workspaceId || !exp || Date.now() > Number(exp)) return null
    return workspaceId
  } catch { return null }
}
