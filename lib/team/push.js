import webpush from 'web-push'
import { getAdminSupabase } from '../supabase/server'

// Web Push (VAPID). Le chiavi vanno impostate su Vercel:
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY  (genera con: npx web-push generate-vapid-keys)
//   VAPID_SUBJECT (opzionale, default mailto:info@lyftads.agency)

let configured = false
function ensureConfigured() {
  if (configured) return true
  const pub = process.env.VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  if (!pub || !priv) return false
  try {
    webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:info@lyftads.agency', pub, priv)
    configured = true
    return true
  } catch { return false }
}

// Invia una push a tutti i device del membro. Pulisce le sottoscrizioni morte.
export async function sendPushToMember({ memberId, title, body, tab }) {
  if (!memberId || !ensureConfigured()) return
  try {
    const admin = getAdminSupabase()
    if (!admin) return
    const { data } = await admin.from('push_subscriptions').select('id, subscription').eq('member_id', memberId)
    if (!data || data.length === 0) return
    const payload = JSON.stringify({ title, body: body || '', tab: tab || 'tasks' })
    for (const row of data) {
      try {
        await webpush.sendNotification(row.subscription, payload)
      } catch (e) {
        const code = e?.statusCode
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('id', row.id)
        }
      }
    }
  } catch {}
}
