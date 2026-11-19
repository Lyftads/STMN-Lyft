import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { isAuthorizedCron } from '../../../../../lib/tenant/credentials'
import { studioAttivo } from '../../../../../lib/studio/attivo'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================================================
//  Lo smistatore dei cron.
//
//  Con un cliente solo Vercel chiamava direttamente /api/cron/ciclo. Ora ogni
//  passo lavora per UN cliente (?ws=…), e questo e' il punto che li chiama
//  tutti: legge chi ha il Motore acceso (una riga in ce_brand) e lancia lo
//  stesso passo per ognuno, ciascuno nella SUA esecuzione — il ciclo di un
//  cliente dura anche 2-3 minuti e in fila uno dopo l'altro non starebbero
//  nel tetto di tempo. Se un cliente fallisce gli altri vanno avanti.
//
//  GET ?passo=ciclo&fase=misura | ?passo=ciclo&fase=produci | ?passo=ingest&giorni=3&oggi=1 | ?passo=recensioni
// ============================================================================
const PASSI = new Set(['ciclo', 'ingest', 'recensioni'])

export async function GET(req) {
  if (!isAuthorizedCron(req)) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const url = new URL(req.url)
  const passo = url.searchParams.get('passo')
  if (!PASSI.has(passo)) return NextResponse.json({ error: 'passo sconosciuto' }, { status: 400 })
  const db = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
  const { data, error } = await db.from('ce_brand').select('workspace_id')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const clienti = (data || []).map(r => r.workspace_id).filter(ws => ws && studioAttivo(ws))
  const resto = new URLSearchParams(url.searchParams); resto.delete('passo'); resto.delete('ws')
  const esiti = await Promise.all(clienti.map(async (ws) => {
    const q = new URLSearchParams(resto); q.set('ws', ws)
    try {
      const r = await fetch(`${url.origin}/api/motore/cron/${passo}?${q}`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET}`, 'x-internal-cron': process.env.CRON_SECRET || '' }, cache: 'no-store', signal: AbortSignal.timeout(295000) })
      return { ws, ok: r.ok, stato: r.status }
    } catch (e) { return { ws, ok: false, errore: String(e.message || e).slice(0, 160) } }
  }))
  const ok = esiti.every(e => e.ok)
  return NextResponse.json({ ok, passo, clienti: clienti.length, esiti }, { status: ok ? 200 : 207 })
}
