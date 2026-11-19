-- ============================================================================
--  Migrazione 11 — quando conviene spingere.
--  Ordini e fatturato per giorno della settimana e per fascia oraria, più il
--  tasso di conversione orario da GA4. Serve allo scaling intraday: sapere
--  QUANDO alzare il budget conta quanto sapere SU COSA.
--  Gli orari sono nel FUSO DEL NEGOZIO, non in UTC: due ore di sfasamento
--  sposterebbero il picco serale e porterebbero a decisioni sbagliate.
-- ============================================================================
create table if not exists ce_timing (
  workspace_id uuid not null,
  dimensione   text not null,      -- 'giorno' (0-6, 0=domenica) | 'ora' (0-23)
  valore       int  not null,
  orders       int     default 0,
  revenue      numeric default 0,
  sessions     bigint  default 0,
  conversion_rate numeric,
  aggiornato   timestamptz default now(),
  primary key (workspace_id, dimensione, valore)
);
