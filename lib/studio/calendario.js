// ============================================================================
//  Il Google Calendar della persona che parla con Lyft: leggere gli
//  appuntamenti e fissare una call (con il link di Meet).
//
//  Il collegamento e' PER PERSONA (tabella studio_calendari), non per azienda:
//  un collaboratore non deve leggere l'agenda del titolare, e in un'agenzia la
//  stessa persona entra in piu' aziende ma ha un calendario solo.
//  Il permesso chiesto a Google e' quello sugli eventi (calendar.events): non
//  si leggono contatti, posta o altri dati dell'account.
// ============================================================================
import { createClient } from '@supabase/supabase-js'
import { cifra, decifra } from './chiavi'

export const SCOPE_CALENDARIO = 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/userinfo.email'
const API = 'https://www.googleapis.com/calendar/v3/calendars/primary'
const FUSO = 'Europe/Rome'

let _c = null
const db = () => _c || (_c = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } }))

export async function salvaCalendario(userId, { refreshToken, email }) {
  const { error } = await db().from('studio_calendari').upsert({ user_id: userId, dati_cifrati: cifra({ refreshToken }), email: email || null, aggiornato_il: new Date().toISOString() }, { onConflict: 'user_id' })
  if (error) throw new Error(/studio_calendari/.test(error.message || '') ? 'archivio dei calendari non ancora creato (supabase/studio/04_calendari.sql)' : error.message)
}
export async function statoCalendario(userId) {
  const { data, error } = await db().from('studio_calendari').select('email, aggiornato_il').eq('user_id', userId).maybeSingle()
  if (error) return { pronto: false, collegato: false }
  return { pronto: true, collegato: !!data, email: data?.email || null }
}
export async function togliCalendario(userId) { await db().from('studio_calendari').delete().eq('user_id', userId) }

async function accesso(userId) {
  const { data } = await db().from('studio_calendari').select('dati_cifrati').eq('user_id', userId).maybeSingle()
  if (!data) return null
  let rt; try { rt = decifra(data.dati_cifrati).refreshToken } catch { return null }
  const r = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: process.env.GOOGLE_CLIENT_ID || '', client_secret: process.env.GOOGLE_CLIENT_SECRET || '', refresh_token: rt, grant_type: 'refresh_token' }), cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const j = await r.json().catch(() => ({}))
  return j.access_token || null
}

// Mezzanotte di un giorno a Roma, come istante: serve per chiedere a Google "gli eventi di oggi".
function confiniDelGiorno(giorno) {
  const g = /^\d{4}-\d{2}-\d{2}$/.test(giorno || '') ? giorno : new Date().toLocaleDateString('sv-SE', { timeZone: FUSO })
  const scarto = (d) => { const p = new Intl.DateTimeFormat('en-US', { timeZone: FUSO, timeZoneName: 'longOffset' }).formatToParts(d).find(x => x.type === 'timeZoneName')?.value || 'GMT+01:00'; return p.replace('GMT', '') || '+00:00' }
  const o = scarto(new Date(`${g}T12:00:00Z`))
  return { giorno: g, da: `${g}T00:00:00${o}`, a: `${g}T23:59:59${o}`, scarto: o }
}

export async function eventiDelGiorno(userId, giorno) {
  const tk = await accesso(userId)
  if (!tk) return { collegato: false }
  const c = confiniDelGiorno(giorno)
  const q = new URLSearchParams({ timeMin: c.da, timeMax: c.a, singleEvents: 'true', orderBy: 'startTime', maxResults: '40', timeZone: FUSO })
  const r = await fetch(`${API}/events?${q}`, { headers: { Authorization: `Bearer ${tk}` }, cache: 'no-store', signal: AbortSignal.timeout(15000) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return { collegato: true, errore: j?.error?.message || `Google ha risposto ${r.status}` }
  const ora = (x) => (x?.dateTime ? new Date(x.dateTime).toLocaleTimeString('it-IT', { timeZone: FUSO, hour: '2-digit', minute: '2-digit' }) : null)
  return { collegato: true, giorno: c.giorno, eventi: (j.items || []).filter(e => e.status !== 'cancelled').map(e => ({ titolo: e.summary || '(senza titolo)', inizio: ora(e.start), fine: ora(e.end), tutto_il_giorno: !e.start?.dateTime, con: (e.attendees || []).filter(a => !a.self).map(a => a.displayName || a.email).slice(0, 6), call: e.hangoutLink || null, luogo: e.location || null, passato: e.end?.dateTime ? new Date(e.end.dateTime) < new Date() : false })) }
}

export async function creaEvento(userId, { titolo, giorno, ora, durata_minuti = 30, invitati = [], note = '', con_meet = true }) {
  const tk = await accesso(userId)
  if (!tk) return { collegato: false }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(giorno || '') || !/^\d{2}:\d{2}$/.test(ora || '')) return { collegato: true, errore: 'servono il giorno (AAAA-MM-GG) e l\'ora (HH:MM)' }
  const c = confiniDelGiorno(giorno)
  const inizio = new Date(`${giorno}T${ora}:00${c.scarto}`), fine = new Date(inizio.getTime() + Math.min(Math.max(Number(durata_minuti) || 30, 5), 600) * 60000)
  const email = (Array.isArray(invitati) ? invitati : []).map(x => String(x).trim()).filter(x => /^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(x)).slice(0, 20)
  const corpo = { summary: String(titolo || 'Call').slice(0, 200), description: String(note || '').slice(0, 4000), start: { dateTime: inizio.toISOString(), timeZone: FUSO }, end: { dateTime: fine.toISOString(), timeZone: FUSO }, attendees: email.map(e => ({ email: e })),
    ...(con_meet ? { conferenceData: { createRequest: { requestId: `lyft-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}) }
  const r = await fetch(`${API}/events?conferenceDataVersion=1&sendUpdates=${email.length ? 'all' : 'none'}`, { method: 'POST', headers: { Authorization: `Bearer ${tk}`, 'Content-Type': 'application/json' }, body: JSON.stringify(corpo), cache: 'no-store', signal: AbortSignal.timeout(20000) })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) return { collegato: true, errore: j?.error?.message || `Google ha risposto ${r.status}` }
  return { collegato: true, creato: true, titolo: j.summary, giorno, ora, durata_minuti, invitati: email, call: j.hangoutLink || null, link: j.htmlLink || null }
}
