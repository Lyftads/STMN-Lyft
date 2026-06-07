import { randomBytes } from 'crypto'

// Helper invito riusabili (account confermato + password temporanea + email).
// Usati dagli inviti chat/guest. (Il modulo Team ha la sua copia, intoccata.)

async function findAuthUserByEmail(admin, email) {
  try {
    const { data } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
    return (data?.users || []).find(u => (u.email || '').toLowerCase() === email) || null
  } catch { return null }
}

// Crea o aggiorna l'utente auth GIÀ confermato con password temporanea.
export async function ensureAuthUser(admin, email) {
  const password = 'Ly' + randomBytes(6).toString('hex')
  const { data: created, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
  if (!error && created?.user?.id) return { userId: created.user.id, password }
  const existing = await findAuthUserByEmail(admin, email)
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, { password, email_confirm: true })
    return { userId: existing.id, password }
  }
  throw new Error(error?.message || 'createUser fallito')
}

export async function sendChatInviteEmail({ to, origin, password, intro }) {
  const key = process.env.RESEND_API_KEY
  if (!key) return { ok: false, reason: 'RESEND_API_KEY mancante' }
  const from = process.env.REPORT_FROM || process.env.CONTACT_FROM || 'LyftAI <onboarding@resend.dev>'
  const link = `${origin || process.env.NEXT_PUBLIC_APP_URL || 'https://lyftai.io'}/chat`
  const html = `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto">
    <h2 style="color:#5b8bff">Sei stato invitato su LyftTalk</h2>
    <p>${intro || 'Sei stato invitato alla chat del team su LyftTalk.'}</p>
    <p>Accedi con queste credenziali:</p>
    <p style="background:#f4f4f8;padding:14px 16px;border-radius:8px;font-size:15px">
      Email: <b>${to}</b><br>Password temporanea: <b style="font-family:monospace">${password}</b>
    </p>
    <p><a href="${link}" style="background:#5b8bff;color:#fff;padding:12px 20px;border-radius:8px;text-decoration:none;display:inline-block">Apri la chat →</a></p>
    <p style="color:#888;font-size:13px">Dopo il primo accesso puoi cambiare la password.</p>
  </div>`
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], reply_to: process.env.REPLY_TO || 'info@lyftads.agency', subject: 'Invito a LyftTalk', html }),
    })
    if (!res.ok) { const t = await res.text(); return { ok: false, reason: `resend_${res.status}: ${t.slice(0, 160)}` } }
    return { ok: true }
  } catch (e) { return { ok: false, reason: e.message } }
}
