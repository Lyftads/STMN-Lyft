-- ── Modulo Cassa: open banking per-workspace ────────────────────────────────
-- Connessioni bancarie (una riga per requisition/banca collegata), saldi per
-- conto e movimenti sincronizzati. Accesso SOLO via service role dalle route
-- API (nessuna policy pubblica), come le altre tabelle di modulo.

create table if not exists bank_connections (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  requisition_id text not null,
  institution_id text,
  institution_name text,
  status text not null default 'pending',      -- pending | active | expired | error
  accounts jsonb not null default '[]'::jsonb, -- account id del provider
  last_synced_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists bank_connections_ws_idx on bank_connections(workspace_id);
create unique index if not exists bank_connections_req_idx on bank_connections(requisition_id);

create table if not exists bank_balances (
  account_id text primary key,
  workspace_id uuid not null,
  connection_id uuid,
  name text,
  iban text,
  balance numeric,
  currency text default 'EUR',
  updated_at timestamptz not null default now()
);
create index if not exists bank_balances_ws_idx on bank_balances(workspace_id);

create table if not exists bank_transactions (
  id text primary key,                          -- providerTxId|accountId
  workspace_id uuid not null,
  account_id text not null,
  booking_date date not null,
  amount numeric not null,                      -- negativo = uscita
  currency text default 'EUR',
  counterparty text,
  description text,
  category text,                                -- categoria AI (tassonomia fissa)
  raw jsonb,
  created_at timestamptz not null default now()
);
create index if not exists bank_tx_ws_date_idx on bank_transactions(workspace_id, booking_date desc);
create index if not exists bank_tx_ws_cat_idx on bank_transactions(workspace_id, category);

alter table bank_connections enable row level security;
alter table bank_balances enable row level security;
alter table bank_transactions enable row level security;
