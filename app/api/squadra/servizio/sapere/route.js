import { NextResponse } from 'next/server'
import { squadraDelGettone } from '../../../../../lib/squadra/creazione'
import { recall, recallKnowledge, embedQuery } from '../../../../../lib/tenant/agentMemory'
import { AGENT_ID } from '../../../../../lib/agent/cervello'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 30

// ============================================================================
//  Cio' che il cervello di LyftAI sa, a disposizione degli agenti della squadra.
//
//  Un agente chiede («che cosa sappiamo dei resi?», «come si struttura un test
//  creativo?») e riceve, per la SUA azienda: i ricordi del cervello (decisioni,
//  preferenze, fatti emersi nelle conversazioni, nelle call e nei controlli
//  notturni) e le note della base di conoscenza comune (corso, video, documenti).
//
//  Il workspace lo decide il gettone del servizio: un agente non puo' leggere i
//  ricordi di un'altra azienda nemmeno chiedendoli.
// ============================================================================
export async function GET(req) {
  const squadra = await squadraDelGettone(req).catch(() => null)
  if (!squadra || squadra.stato === 'ferma' || squadra.stato === 'bozza') return NextResponse.json({ errore: 'non autorizzato' }, { status: 401 })
  const u = new URL(req.url)
  const domanda = String(u.searchParams.get('q') || '').trim().slice(0, 600)
  const quante = Math.min(Math.max(Number(u.searchParams.get('n')) || 6, 1), 12)
  if (domanda.length < 3) return NextResponse.json({ errore: 'manca la domanda' }, { status: 400 })
  const ws = squadra.workspace_id
  const emb = await embedQuery(domanda).catch(() => null)
  const [suoi, notturni, call, sapere] = await Promise.all([
    recall({ userId: ws, agentId: AGENT_ID, query: domanda, limit: quante, queryEmbedding: emb }),
    recall({ userId: ws, agentId: 'auto-scan', query: domanda, limit: 4, minImportance: 5, queryEmbedding: emb }),
    recall({ userId: ws, agentId: 'team-call', query: domanda, limit: 3, minImportance: 6, queryEmbedding: emb }),
    recallKnowledge({ query: domanda, limit: quante, queryEmbedding: emb }),
  ])
  const riga = (m, da) => ({ da, testo: String(m.content || '').slice(0, 1200), importanza: m.importance ?? null, quando: m.created_at || null })
  return NextResponse.json({
    fonte: 'cervello di LyftAI: ricordi di questa azienda + base di conoscenza comune',
    ricordi_azienda: [...suoi.map(m => riga(m, 'conversazioni')), ...notturni.map(m => riga(m, 'controllo notturno')), ...call.map(m => riga(m, 'call'))],
    note: (sapere || []).map(x => ({ argomento: x.topic || null, fonte: x.source || null, testo: String(x.content || '').slice(0, 1600) })),
  }, { headers: { 'Cache-Control': 'private, no-store' } })
}
