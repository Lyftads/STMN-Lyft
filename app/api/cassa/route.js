export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getEffectiveTenantId } from '../../../lib/tenant/credentials'
import { getAdminSupabase } from '../../../lib/supabase/server'
import { callBrain } from '../../../lib/agent/gateway'
import {
  bankingConfigured, listInstitutions, startAuth, exchangeSession,
  getBalance, getTransactions,
} from '../../../lib/cassa/enablebanking'

// ============================================================================
//  Modulo CASSA — controllo di cassa via open banking, multi-tenant.
//
//  GET  ?action=institutions&country=IT → lista banche collegabili
//  POST { action:'connect', institutionId, institutionName, psuType } → { link }
//  GET  [?refresh=1][&code=&state=] → dati: al ritorno dalla banca scambia il
//        code in sessione (state = reference della connessione), poi serve:
//        connessioni, saldi, movimenti categorizzati AI, entrate/uscite per
//        mese, uscite per categoria, proiezione 30/60/90.
//        Sincronizza dal provider al massimo ogni 6h; sempre dal DB altrimenti.
//  DELETE ?id=<connectionId> → scollega banca (rimuove saldi+movimenti)
//
//  Tabelle: supabase/cassa.sql · Env: ENABLEBANKING_APP_ID + PRIVATE_KEY_B64
//  Redirect registrato presso il provider: {origin}/cassa-return
// ============================================================================

const SYNC_TTL_MS = 6 * 3600e3
const CATEGORIES = [
  'Incassi vendite', 'Rimborsi', 'Fornitori', 'Stipendi e collaboratori',
  'Tasse e contributi', 'Affitto e utenze', 'Marketing e advertising',
  'Software e servizi', 'Logistica e spedizioni', 'Bancari e finanziari',
  'Trasferimenti interni', 'Altro',
]

const iso = (d) => d.toISOString().slice(0, 10)

async function ctx() {
  const ws = await getEffectiveTenantId()
  const admin = getAdminSupabase()
  return { ws, admin }
}

// ── Ritorno dalla banca: code+state → sessione → account attivi ─────────────
async function resolveCallback(ws, admin, code, state) {
  const { data: row } = await admin
    .from('bank_connections')
    .select('id, status')
    .eq('workspace_id', ws)
    .eq('requisition_id', state)
    .maybeSingle()
  if (!row || row.status === 'active') return
  try {
    const { accounts } = await exchangeSession(code)
    if (accounts.length) {
      await admin.from('bank_connections').update({ status: 'active', accounts: accounts.map(a => a.uid) }).eq('id', row.id)
      // Pre-popola nome/iban dei conti (il saldo arriva col primo sync).
      for (const a of accounts) {
        await admin.from('bank_balances').upsert({
          account_id: a.uid, workspace_id: ws, connection_id: row.id,
          name: a.name, iban: a.iban, currency: a.currency, updated_at: new Date().toISOString(),
        }, { onConflict: 'account_id' })
      }
    } else {
      await admin.from('bank_connections').update({ status: 'error' }).eq('id', row.id)
    }
  } catch {
    await admin.from('bank_connections').update({ status: 'error' }).eq('id', row.id)
  }
}

// ── Sync dal provider (saldi + movimenti, con guardia rate limit) ───────────
async function syncConnections(ws, admin, { force = false } = {}) {
  const { data: conns } = await admin.from('bank_connections').select('*').eq('workspace_id', ws)
  const out = []
  for (const c of (conns || [])) {
    let conn = c
    // pending vecchie (l'utente non ha completato l'autorizzazione) → error
    if (c.status === 'pending' && Date.now() - new Date(c.created_at).getTime() > 24 * 3600e3) {
      await admin.from('bank_connections').update({ status: 'error' }).eq('id', c.id)
      conn = { ...c, status: 'error' }
    }
    const stale = !conn.last_synced_at || (Date.now() - new Date(conn.last_synced_at).getTime() > SYNC_TTL_MS)
    if (conn.status === 'active' && (force || stale)) {
      const since = iso(new Date(Date.now() - 90 * 86400e3))
      for (const accountId of (conn.accounts || [])) {
        try {
          const [balance, txs] = await Promise.all([
            getBalance(accountId).catch(() => null),
            getTransactions(accountId, since).catch(() => []),
          ])
          if (balance) {
            const { data: existing } = await admin.from('bank_balances').select('name, iban').eq('account_id', accountId).maybeSingle()
            await admin.from('bank_balances').upsert({
              account_id: accountId, workspace_id: ws, connection_id: conn.id,
              name: existing?.name || conn.institution_name, iban: existing?.iban || null,
              balance: balance.amount, currency: balance.currency, updated_at: new Date().toISOString(),
            }, { onConflict: 'account_id' })
          }
          if (txs.length) {
            const rows = txs.map(t => ({
              id: `${t.providerId}|${accountId}`.slice(0, 200),
              workspace_id: ws, account_id: accountId,
              booking_date: t.bookingDate, amount: t.amount, currency: t.currency,
              counterparty: t.counterparty, description: t.description,
            }))
            for (let i = 0; i < rows.length; i += 200) {
              await admin.from('bank_transactions').upsert(rows.slice(i, i + 200), { onConflict: 'id', ignoreDuplicates: true })
            }
          }
        } catch {}
      }
      await admin.from('bank_connections').update({ last_synced_at: new Date().toISOString() }).eq('id', conn.id)
      conn = { ...conn, last_synced_at: new Date().toISOString() }
    }
    out.push(conn)
  }
  return out
}

// ── Categorizzazione AI dei movimenti nuovi (batch, tassonomia fissa) ───────
async function categorize(ws, admin) {
  const { data: rows } = await admin
    .from('bank_transactions')
    .select('id, amount, counterparty, description')
    .eq('workspace_id', ws)
    .is('category', null)
    .order('booking_date', { ascending: false })
    .limit(80)
  if (!rows?.length) return
  const payload = rows.map(r => ({ id: r.id, amount: r.amount, who: r.counterparty, desc: (r.description || '').slice(0, 120) }))
  try {
    const { parsed } = await callBrain({
      skill: {
        id: 'cassa-categorize', json: true, tier: 'cheap', temperature: 0,
        systemPrompt: `Categorizza movimenti bancari di un e-commerce. Rispondi SOLO JSON {"items":[{"id":"...","category":"..."}]} usando ESCLUSIVAMENTE queste categorie: ${CATEGORIES.join(' | ')}. amount>0 di solito è "Incassi vendite" (o "Rimborsi"/"Trasferimenti interni"); amount<0 scegli dalla descrizione/controparte. Se incerto: "Altro".`,
      },
      query: 'categorizzazione movimenti bancari',
      messages: [{ role: 'user', content: JSON.stringify(payload) }],
      conversation: false,
      liveTools: false,
    })
    const items = Array.isArray(parsed?.items) ? parsed.items : []
    for (const it of items) {
      if (it?.id && CATEGORIES.includes(it.category)) {
        await admin.from('bank_transactions').update({ category: it.category }).eq('id', it.id).eq('workspace_id', ws)
      }
    }
  } catch {}
}

// ── Aggregati + proiezione 30/60/90 dalle medie storiche ────────────────────
function aggregates(txs, balances) {
  const totalBalance = balances.reduce((a, b) => a + (Number(b.balance) || 0), 0)
  const byMonth = {}
  const byCategory = {}
  let inflow90 = 0, outflow90 = 0
  let minDate = null
  for (const t of txs) {
    const m = String(t.booking_date).slice(0, 7)
    byMonth[m] = byMonth[m] || { month: m, in: 0, out: 0 }
    const amt = Number(t.amount) || 0
    if (amt >= 0) { byMonth[m].in += amt; inflow90 += amt } else { byMonth[m].out += -amt; outflow90 += -amt }
    if (amt < 0) {
      const c = t.category || 'Altro'
      byCategory[c] = (byCategory[c] || 0) + -amt
    }
    if (!minDate || t.booking_date < minDate) minDate = t.booking_date
  }
  const days = minDate ? Math.max(7, Math.min(90, Math.round((Date.now() - new Date(minDate).getTime()) / 86400e3))) : 0
  const netPerDay = days ? (inflow90 - outflow90) / days : 0
  const projection = days ? {
    basedOnDays: days,
    netPerDay: +netPerDay.toFixed(2),
    d30: +(totalBalance + netPerDay * 30).toFixed(2),
    d60: +(totalBalance + netPerDay * 60).toFixed(2),
    d90: +(totalBalance + netPerDay * 90).toFixed(2),
  } : null
  return {
    totalBalance: +totalBalance.toFixed(2),
    inflow90: +inflow90.toFixed(2),
    outflow90: +outflow90.toFixed(2),
    byMonth: Object.values(byMonth).sort((a, b) => a.month < b.month ? -1 : 1),
    byCategory: Object.entries(byCategory).map(([category, amount]) => ({ category, amount: +amount.toFixed(2) })).sort((a, b) => b.amount - a.amount),
    projection,
  }
}

export async function GET(request) {
  return withTenantContext(request, async () => {
    const { searchParams } = new URL(request.url)
    const { ws, admin } = await ctx()
    if (!ws || !admin) return NextResponse.json({ configured: false, reason: 'auth' })

    if (searchParams.get('action') === 'institutions') {
      if (!bankingConfigured()) return NextResponse.json({ configured: false, reason: 'env' })
      try {
        const list = await listInstitutions((searchParams.get('country') || 'IT').toUpperCase())
        return NextResponse.json({ configured: true, institutions: list })
      } catch (e) {
        return NextResponse.json({ configured: true, institutions: [], error: String(e?.message || e) })
      }
    }

    if (!bankingConfigured()) return NextResponse.json({ configured: false, reason: 'env' })

    // Ritorno dalla banca: scambia il code in sessione PRIMA del sync.
    const code = searchParams.get('code')
    const state = searchParams.get('state')
    if (code && state) { try { await resolveCallback(ws, admin, code, state) } catch {} }

    const force = searchParams.get('refresh') === '1'
    let connections = []
    try { connections = await syncConnections(ws, admin, { force }) } catch {}
    if (connections.some(c => c.status === 'active')) await categorize(ws, admin)

    const [{ data: balances }, { data: txs }] = await Promise.all([
      admin.from('bank_balances').select('account_id, name, iban, balance, currency, updated_at').eq('workspace_id', ws),
      admin.from('bank_transactions').select('booking_date, amount, currency, counterparty, description, category').eq('workspace_id', ws).order('booking_date', { ascending: false }).limit(1500),
    ])

    return NextResponse.json({
      configured: true,
      connections: (connections || []).map(c => ({ id: c.id, institution: c.institution_name, status: c.status, lastSyncedAt: c.last_synced_at, accounts: (c.accounts || []).length })),
      balances: balances || [],
      recent: (txs || []).slice(0, 60),
      ...aggregates(txs || [], balances || []),
      updatedAt: new Date().toISOString(),
    })
  })
}

export async function POST(request) {
  return withTenantContext(request, async () => {
    const { ws, admin } = await ctx()
    if (!ws || !admin) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
    if (!bankingConfigured()) return NextResponse.json({ error: 'Open banking non configurato' }, { status: 400 })
    let body; try { body = await request.json() } catch { return NextResponse.json({ error: 'Body non valido' }, { status: 400 }) }

    if (body?.action === 'connect') {
      const institutionId = String(body.institutionId || '')
      const institutionName = String(body.institutionName || institutionId).slice(0, 80)
      const country = String(body.country || 'IT').toUpperCase()
      const psuType = ['business', 'personal'].includes(body.psuType) ? body.psuType : 'business'
      if (!institutionId) return NextResponse.json({ error: 'institutionId mancante' }, { status: 400 })
      const origin = new URL(request.url).origin
      const reference = `${ws}_${Date.now()}`
      try {
        const { link } = await startAuth({
          aspspName: institutionId,
          country,
          psuType,
          redirect: `${origin}/cassa-return`,
          state: reference,
        })
        await admin.from('bank_connections').insert({
          workspace_id: ws, requisition_id: reference,
          institution_id: institutionId, institution_name: institutionName,
          status: 'pending',
        })
        return NextResponse.json({ link })
      } catch (e) {
        return NextResponse.json({ error: String(e?.message || e) }, { status: 502 })
      }
    }
    return NextResponse.json({ error: 'action non valida' }, { status: 400 })
  })
}

export async function DELETE(request) {
  return withTenantContext(request, async () => {
    const { ws, admin } = await ctx()
    if (!ws || !admin) return NextResponse.json({ ok: false }, { status: 401 })
    const id = new URL(request.url).searchParams.get('id')
    if (!id) return NextResponse.json({ ok: false }, { status: 400 })
    const { data: conn } = await admin.from('bank_connections').select('id, accounts').eq('id', id).eq('workspace_id', ws).maybeSingle()
    if (!conn) return NextResponse.json({ ok: false }, { status: 404 })
    const accounts = conn.accounts || []
    if (accounts.length) {
      await admin.from('bank_transactions').delete().eq('workspace_id', ws).in('account_id', accounts)
      await admin.from('bank_balances').delete().eq('workspace_id', ws).in('account_id', accounts)
    }
    await admin.from('bank_connections').delete().eq('id', id).eq('workspace_id', ws)
    return NextResponse.json({ ok: true })
  })
}
