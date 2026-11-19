import { NextResponse } from 'next/server'
import { squadraDelGettone, configurazionePerServizio } from '../../../../../lib/squadra/creazione'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// Il servizio della squadra di UN cliente chiede: chi sono e con quali chiavi lavoro.
// Si presenta col suo gettone (nato quando la squadra e' stata accesa, salvato solo come impronta):
// il workspace lo decide il gettone, mai un parametro. La risposta contiene chiavi: mai in cache.
export async function GET(req) {
  const squadra = await squadraDelGettone(req).catch(() => null)
  if (!squadra) return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  if (squadra.stato === 'ferma' || squadra.stato === 'bozza') return NextResponse.json({ error: 'squadra spenta' }, { status: 410 })
  const origine = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '')
  const c = await configurazionePerServizio(squadra, origine)
  return NextResponse.json(c, { headers: { 'Cache-Control': 'private, no-store' } })
}
