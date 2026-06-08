export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { getAuthUser } from '../../../../lib/studio/credits'

const OPENAI_KEY = process.env.OPENAI_API_KEY

// POST (multipart, campo 'file') → trascrizione vocale via Whisper.
// Usata dal microfono della chat di Creative Studio: voce → testo nel prompt.
export async function POST(req) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!OPENAI_KEY) return NextResponse.json({ error: 'OPENAI_API_KEY non configurata' }, { status: 500 })

  let inForm
  try { inForm = await req.formData() } catch { return NextResponse.json({ error: 'Form non valido' }, { status: 400 }) }
  const file = inForm.get('file')
  if (!file) return NextResponse.json({ error: 'Audio mancante' }, { status: 400 })

  try {
    const fd = new FormData()
    fd.append('file', file, 'audio.webm')
    fd.append('model', 'whisper-1')
    const res = await fetch('https://api.openai.com/v1/audio/transcriptions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${OPENAI_KEY}` },
      body: fd,
      signal: AbortSignal.timeout(50000),
    })
    if (!res.ok) {
      const t = await res.text()
      return NextResponse.json({ error: `Whisper ${res.status}: ${t.slice(0, 160)}` }, { status: 502 })
    }
    const d = await res.json()
    return NextResponse.json({ text: d.text || '' })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
