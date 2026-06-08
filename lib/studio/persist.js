// Persistenza Creative Studio: copia i media su Supabase Storage (così le URL
// dei provider, che scadono, diventano permanenti) e salva ogni generazione su
// studio_generations. Gestisce anche lo stato dei video async (pending/done/
// failed) con rimborso idempotente.
import { getAdminSupabase } from '../supabase/server'
import { addCredits } from './credits'

const BUCKET = 'studio-media'

async function ensureBucket(admin) {
  try { await admin.storage.createBucket(BUCKET, { public: true }) } catch {}
}

// Scarica i bytes da una URL http(s) o da un data: URI.
async function fetchBytes(srcUrl) {
  if (srcUrl.startsWith('data:')) {
    const m = srcUrl.match(/^data:([^;]+);base64,(.*)$/)
    if (!m) throw new Error('data uri non valido')
    return { buf: Buffer.from(m[2], 'base64'), contentType: m[1] }
  }
  const r = await fetch(srcUrl, { signal: AbortSignal.timeout(60000) })
  if (!r.ok) throw new Error('download ' + r.status)
  const buf = Buffer.from(await r.arrayBuffer())
  return { buf, contentType: r.headers.get('content-type') || '' }
}

// Copia un media su Storage. Ritorna la public URL; se fallisce, ritorna l'originale.
export async function persistMedia(userId, srcUrl, type) {
  const admin = getAdminSupabase()
  if (!admin || !srcUrl) return srcUrl
  try {
    await ensureBucket(admin)
    const { buf, contentType } = await fetchBytes(srcUrl)
    const ct = contentType || (type === 'video' ? 'video/mp4' : 'image/png')
    const ext = type === 'video' ? 'mp4' : ct.includes('jpeg') ? 'jpg' : ct.includes('webp') ? 'webp' : 'png'
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: ct, upsert: false })
    if (error) return srcUrl
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    return data?.publicUrl || srcUrl
  } catch {
    return srcUrl
  }
}

// Carica un buffer arbitrario (es. lo zip delle immagini di training) su Storage.
export async function uploadBuffer(userId, buf, ext, contentType) {
  const admin = getAdminSupabase()
  if (!admin || !buf) return null
  try {
    await ensureBucket(admin)
    const path = `${userId}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await admin.storage.from(BUCKET).upload(path, buf, { contentType: contentType || 'application/octet-stream', upsert: false })
    if (error) return null
    const { data } = admin.storage.from(BUCKET).getPublicUrl(path)
    return data?.publicUrl || null
  } catch { return null }
}

// Salva una generazione completata (immagine o video già pronto).
export async function saveGeneration(row) {
  const admin = getAdminSupabase()
  if (!admin) return null
  try {
    const { data } = await admin.from('studio_generations').insert(row).select().maybeSingle()
    return data
  } catch { return null }
}

// Crea una riga video in stato pending (coda fal). Ritorna la riga (con id).
export async function createPendingVideo(row) {
  return saveGeneration({ ...row, type: 'video', status: 'pending' })
}

// Recupera una generazione (per il polling). Solo se appartiene all'utente.
export async function getGeneration(id, userId) {
  const admin = getAdminSupabase()
  if (!admin) return null
  const { data } = await admin.from('studio_generations').select('*').eq('id', id).eq('user_id', userId).maybeSingle()
  return data || null
}

export async function completeVideo(id, url) {
  const admin = getAdminSupabase()
  if (!admin) return
  await admin.from('studio_generations').update({ status: 'done', url }).eq('id', id)
}

// Marca come fallito e RIMBORSA una sola volta (guard: update condizionato a
// status='pending' → solo il primo poller che vince refunda).
export async function failVideoAndRefund(id, userId) {
  const admin = getAdminSupabase()
  if (!admin) return
  const { data } = await admin.from('studio_generations')
    .update({ status: 'failed' }).eq('id', id).eq('status', 'pending').select().maybeSingle()
  if (data && data.credits) {
    await addCredits(userId, data.credits, 'refund', data.ref, data.model)
  }
}
