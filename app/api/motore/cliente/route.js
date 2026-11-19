import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'
import { dimenticaCliente } from '../../../../lib/motore/cliente'
import { resolveWorkspace } from '../../../../lib/team/workspace'

export const dynamic = 'force-dynamic'

// La scheda del cliente per l'interfaccia: nome, se il Motore e' acceso, se ha una matrice.
async function GET__() {
  const c = clienteMotore() || {}
  return NextResponse.json({ nome: c.nome || null, attivo: !!c.attivo, sito: c.sito || null, matrice: !!c.matrice, logo: !!c.logo })
}

// Accende il Motore per questo cliente: crea la sua riga in ce_brand col nome dell'azienda.
// Solo un amministratore del workspace: da qui in poi il ciclo notturno lavora (e spende) per lui.
async function POST__() {
  const chi = await resolveWorkspace().catch(() => null)
  if (!chi?.isAdmin || chi.workspaceId !== wsMotore()) return NextResponse.json({ error: 'solo un amministratore puo\' accendere il Motore Creativo' }, { status: 403 })
  const c = clienteMotore() || {}
  if (!c.attivo) {
    const { error } = await db().from('ce_brand').insert({ workspace_id: wsMotore(), nome: c.nome || null })
    if (error && !/duplicate/i.test(error.message || '')) return NextResponse.json({ error: error.message }, { status: 500 })
    dimenticaCliente(wsMotore())
  }
  return NextResponse.json({ ok: true })
}

export const GET = conMotore(GET__)
export const POST = conMotore(POST__)
