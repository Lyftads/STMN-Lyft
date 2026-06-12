-- ============================================================================
-- Cache L2 condivisa delle tab (snapshot per-workspace). La prima richiesta
-- calcola e salva qui lo snapshot; tutte le altre lo leggono in pochi ms anche
-- da un'altra istanza serverless. Usata da lib/cache/snapshot.js + lib/cache/swr.js
-- (stale-while-revalidate). Workspace = owner_user_id. Service-role key, no RLS.
--
-- `tab` = chiave logica della vista, es. 'metaKpi:preset=last_7d',
-- 'pnl:months=12', 'inventory', 'productCosts'. `payload` = JSON della risposta.
-- Upsert su (workspace_id, tab) → una riga per vista, sempre aggiornata.
-- ============================================================================

create table if not exists tab_snapshots (
  workspace_id  uuid not null,
  tab           text not null,
  payload       jsonb not null,
  updated_at    timestamptz not null default now(),
  primary key (workspace_id, tab)
);

create index if not exists idx_tab_snapshots_updated on tab_snapshots(workspace_id, updated_at desc);
