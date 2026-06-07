import { getMeta } from '../../tenant/credentials'

// Executor Meta (Fase 2). Esegue davvero un'azione della Coda Azioni via
// Meta Marketing API (write). Richiede il permesso `ads_management` approvato
// (Meta App Review) e va abilitato col flag ACTIONS_META_EXECUTOR=true.
// Va SEMPRE chiamato dentro withTenantContext() così getMeta() ha le creds.
//
// Ritorni:
//   { ok: true, result }            → eseguita
//   { ok: false, manual: true, ... } → non auto-eseguibile (l'admin la fa a mano)
//   { ok: false, error }            → tentata ma fallita

const GRAPH = 'v19.0'

async function postNode(id, params, token) {
  const body = new URLSearchParams({ ...params, access_token: token })
  const res = await fetch(`https://graph.facebook.com/${GRAPH}/${id}`, {
    method: 'POST', body, signal: AbortSignal.timeout(15000),
  })
  const j = await res.json().catch(() => ({}))
  if (!res.ok || j?.error) return { ok: false, error: j?.error?.message || `HTTP ${res.status}` }
  return { ok: true, result: j }
}

export async function executeMetaAction(action) {
  const token = getMeta()?.accessToken
  if (!token) return { ok: false, error: 'Meta non collegato (token assente)' }
  const id = action?.target_ref
  const type = action?.type

  if (type === 'pause_campaign') {
    if (!id) return { ok: false, error: 'ID campagna mancante' }
    return postNode(id, { status: 'PAUSED' }, token)
  }
  if (type === 'resume_campaign') {
    if (!id) return { ok: false, error: 'ID campagna mancante' }
    return postNode(id, { status: 'ACTIVE' }, token)
  }
  if (type === 'scale_budget') {
    if (!id) return { ok: false, error: 'ID target mancante' }
    const to = Number(action?.payload?.to_spend)
    if (!Number.isFinite(to) || to <= 0) return { ok: false, error: 'Budget target non valido' }
    // daily_budget in centesimi della valuta dell'account
    return postNode(id, { daily_budget: Math.round(to * 100) }, token)
  }

  // shift_budget (multi-target) e refresh_creative non sono automatizzabili in
  // modo sicuro: vanno applicate a mano e poi marcate come eseguite.
  return { ok: false, manual: true, error: 'Azione non auto-eseguibile su Meta' }
}
