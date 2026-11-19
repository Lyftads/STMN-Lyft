import { NextResponse } from 'next/server'
import { squadraDelGettone } from '../../../../../../lib/squadra/creazione'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 120

// I numeri del cliente per i suoi agenti. Il servizio della squadra chiama qui con lo stesso
// contratto che usava verso LyftAI (x-internal-cron = il SUO gettone); questa rotta riconosce di
// quale cliente e' il gettone e gira la richiesta alle API interne col segreto vero del prodotto e
// il workspace legato al gettone. L'intestazione x-lyft-workspace mandata dal servizio viene ignorata:
// un servizio non puo' chiedere i dati di un altro cliente nemmeno sbagliando.
const PERMESSE = new Set(['api/agent-context', 'api/google-kpi'])

export async function GET(req, { params }) {
  const squadra = await squadraDelGettone(req).catch(() => null)
  if (!squadra || squadra.stato === 'ferma' || squadra.stato === 'bozza') return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  const percorso = (params?.percorso || []).join('/')
  if (!PERMESSE.has(percorso)) return NextResponse.json({ error: 'non previsto' }, { status: 404 })
  if (!process.env.CRON_SECRET) return NextResponse.json({ error: 'prodotto non configurato' }, { status: 500 })
  const u = new URL(req.url)
  const r = await fetch(`${u.origin}/${percorso}${u.search}`, { headers: { 'x-internal-cron': process.env.CRON_SECRET, 'x-lyft-workspace': squadra.workspace_id, 'x-lyft-fresco': '1' }, cache: 'no-store' })
  return new NextResponse(r.body, { status: r.status, headers: { 'Content-Type': r.headers.get('content-type') || 'application/json', 'Cache-Control': 'private, no-store' } })
}
