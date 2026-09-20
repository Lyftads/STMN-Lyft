export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getEffectiveTenantId } from '../../../../lib/tenant/credentials'
import { resolveWorkspace, isCollaborator } from '../../../../lib/team/workspace'
import { leggiImpostazioni, scriviImpostazioni } from '../../../../lib/impostazioni'
import { soglieValide, SOGLIE_PREDEFINITE, LIMITI_SOGLIE } from '../../../../lib/ads/soglieVerdetti'

// ============================================================================
//  Le soglie dei giudizi, PER WORKSPACE. GET le legge, POST le salva (solo chi
//  puo' scrivere).
//
//  Il workspace esce dalla risoluzione normale del tenant: getEffectiveTenantId
//  rispetta lo switch dell'agency ma solo verso i clienti autorizzati, e
//  resolveWorkspace dice che RUOLO ha chi sta scrivendo dentro quel workspace.
//  Le due domande sono diverse — "di chi sono questi dati" e "costui puo'
//  cambiarli" — e servono tutte e due: un ospite invitato in chat non deve
//  poter spostare le soglie su cui un altro decide quanto spendere.
// ============================================================================
export async function GET() {
  const ws = await getEffectiveTenantId().catch(() => null)
  if (!ws) return NextResponse.json({ ok: false }, { status: 401 })
  return NextResponse.json({ ok: true, soglie: soglieValide(await leggiImpostazioni(ws, 'googleVerdetti', {})), predefinite: SOGLIE_PREDEFINITE, limiti: LIMITI_SOGLIE })
}

export async function POST(req) {
  const ws = await getEffectiveTenantId().catch(() => null)
  const chi = await resolveWorkspace().catch(() => null)
  if (!ws || !chi) return NextResponse.json({ ok: false }, { status: 401 })
  if (!(chi.isAdmin || isCollaborator(chi))) return NextResponse.json({ ok: false, error: 'Non autorizzato' }, { status: 403 })
  let b = {}
  try { b = await req.json() } catch {}
  const soglie = b?.ripristina ? { ...SOGLIE_PREDEFINITE } : soglieValide(b?.soglie || {})
  // Nello stesso foglio vivono impostazioni che NON sono soglie (il metafield da
  // cui nascono le macro categorie): soglieValide tiene solo le chiavi note, e
  // salvare dalla tab le cancellerebbe. Si riscrive sopra a quelle di adesso —
  // anche con "torna ai valori di partenza", che riguarda le soglie e basta.
  const attuali = await leggiImpostazioni(ws, 'googleVerdetti', {})
  try { await scriviImpostazioni(ws, 'googleVerdetti', { ...attuali, ...soglie }) } catch (e) { return NextResponse.json({ ok: false, error: e.message }, { status: 200 }) }
  return NextResponse.json({ ok: true, soglie })
}
