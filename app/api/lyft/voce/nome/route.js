import { NextResponse } from 'next/server'
import { getCurrentUserId } from '../../../../../lib/tenant/credentials'
import { chiaveOpenAI, conChiaveDelCliente, MANCA_CHIAVE } from '../../../../../lib/studio/chiaveAI'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// ============================================================================
//  «Hey Lyft»: il nome riconosciuto senza dipendere dal browser.
//
//  Il riconoscimento vocale del browser funziona solo dove il suo servizio e'
//  raggiungibile (su molti Chrome parte ma non restituisce mai una parola).
//  Quando succede, la pagina manda qui i pochi secondi in cui qualcuno ha
//  parlato e riceve il testo: e' la pagina a cercarci il nome.
//
//  Qui passa voce catturata da un microfono: non si salva niente, non si
//  scrive niente nei registri, e la frase torna solo a chi l'ha mandata.
// ============================================================================
const MAX_BYTE = 600 * 1024

async function POST__(req) {
  if (!(await getCurrentUserId().catch(() => null))) return NextResponse.json({ errore: 'Non autenticato' }, { status: 401 })
  const chiave = chiaveOpenAI()
  if (!chiave) return NextResponse.json({ errore: MANCA_CHIAVE }, { status: 400 })
  const lingua = ['it', 'en', 'es', 'fr', 'de'].includes(new URL(req.url).searchParams.get('l')) ? new URL(req.url).searchParams.get('l') : 'it'
  const audio = Buffer.from(await req.arrayBuffer())
  if (audio.length < 2000 || audio.length > MAX_BYTE) return NextResponse.json({ testo: '' })
  const tipo = (req.headers.get('content-type') || 'audio/webm').split(';')[0]
  const est = tipo.includes('mp4') ? 'mp4' : tipo.includes('ogg') ? 'ogg' : tipo.includes('wav') ? 'wav' : 'webm'
  const modulo = new FormData()
  modulo.append('file', new Blob([audio], { type: tipo }), `voce.${est}`)
  modulo.append('model', 'gpt-4o-mini-transcribe')
  modulo.append('language', lingua)
  // Aiuta a scrivere il nome com'e', invece di «lift» o «left».
  modulo.append('prompt', 'Lyft. Hey Lyft. Ehi Lyft.')
  const r = await fetch('https://api.openai.com/v1/audio/transcriptions', { method: 'POST', headers: { Authorization: `Bearer ${chiave}` }, body: modulo, cache: 'no-store', signal: AbortSignal.timeout(20000) }).catch(() => null)
  const j = r ? await r.json().catch(() => ({})) : {}
  if (!r || !r.ok) return NextResponse.json({ testo: '', errore: j?.error?.message || 'trascrizione non riuscita' }, { status: 502 })
  return NextResponse.json({ testo: String(j.text || '').trim().slice(0, 400) }, { headers: { 'Cache-Control': 'private, no-store' } })
}

export const POST = (req) => conChiaveDelCliente(() => POST__(req), { stretta: true, soloStudio: true })
