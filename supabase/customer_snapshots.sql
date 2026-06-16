-- ============================================================================
-- Snapshot settimanali dei segmenti clienti (per i grafici "nel tempo" della
-- tab Clienti: Customers over time, Retention, CLV, Customers per segment,
-- Segment changes). UNA riga per (workspace, settimana ISO lunedì).
--
-- Riempita da:
--   - /api/customers           → upsert opportunistico della settimana corrente
--   - /api/cron/customer-snapshots → settimanale, per TUTTI i tenant
--   - /api/customers/backfill  → ricostruzione storica dagli ordini Shopify
--
-- Workspace = owner_user_id (companies.user_id / LYFT_OWNER_USER_ID).
-- Service-role key, no RLS. Multi-tenant: isolamento via workspace_id.
-- ============================================================================

create table if not exists customer_segment_snapshots (
  workspace_id   uuid not null,
  week           date not null,                  -- lunedì ISO della settimana
  total_customers int  not null default 0,
  first_time     int  not null default 0,
  returning_count int not null default 0,        -- 'returning' è keyword riservata in PG
  retention      numeric not null default 0,     -- % repeat (returning/total)
  clv            numeric not null default 0,     -- valore medio per cliente
  aov            numeric not null default 0,
  orders_per_customer numeric not null default 0,
  days_between   numeric,                         -- giorni medi tra ordini (nullable)
  segments       jsonb not null default '{}',    -- { new:{count,...}, loyal:{...}, ... }
  captured_at    timestamptz not null default now(),
  source         text default 'live',            -- 'live' | 'cron' | 'backfill'
  primary key (workspace_id, week)
);

create index if not exists idx_cust_snap_ws_week on customer_segment_snapshots(workspace_id, week desc);
