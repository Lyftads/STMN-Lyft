export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

import { NextResponse } from 'next/server'
import { getAuthUser, getBalance, getHistory } from '../../../lib/studio/credits'
import { IMAGE_MODELS, CREDIT_PACKS } from '../../../lib/studio/models'

// GET /api/credits → saldo + storico + listino modelli/pacchetti per la UI.
export async function GET() {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const [balance, history] = await Promise.all([getBalance(user.id), getHistory(user.id)])
  return NextResponse.json({
    balance,
    history,
    models: IMAGE_MODELS.map(m => ({ id: m.id, name: m.name, credits: m.credits, badge: m.badge })),
    packs: CREDIT_PACKS.map(p => ({ id: p.id, credits: p.credits, priceLabel: p.priceLabel, best: !!p.best })),
  })
}
