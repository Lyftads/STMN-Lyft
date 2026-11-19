import { createClient } from '@supabase/supabase-js'
import { wsMotore } from './workspace'

let _c = null
export function db() {
  if (_c) return _c
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) throw new Error('Supabase non configurato (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)')
  _c = createClient(url, key, { auth: { persistSession: false } })
  return _c
}

// Le due tabelle dei KPI per creativita' (ce_kpi_daily, ce_kpi_segment_daily)
// NON hanno la colonna del cliente: appartengono a una creativita', e il
// cliente e' quello della creativita'. Con un cliente solo si leggevano per
// intero; con piu' clienti la spesa di uno entrerebbe nei totali dell'altro.
// Qui la lettura passa SEMPRE dall'aggancio a ce_creatives filtrato sul
// cliente della richiesta. Ogni riga porta in piu' il campo `ce_creatives`,
// che nessuno usa.
export function kpiDi(tabella, colonne = '*') {
  if (tabella !== 'ce_kpi_daily' && tabella !== 'ce_kpi_segment_daily') throw new Error('kpiDi: tabella non prevista')
  return db().from(tabella).select(`${colonne}, ce_creatives!inner(workspace_id)`).eq('ce_creatives.workspace_id', wsMotore())
}
