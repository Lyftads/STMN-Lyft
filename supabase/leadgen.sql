-- ── Meta Lead Gen: economia campagne lead per-workspace ─────────────────────
-- Parametri economici (valore medio cliente, tasso chiusura, margine) con
-- override per singola campagna. Accesso SOLO via service role dalle route
-- API (nessuna policy pubblica), come le altre tabelle di modulo.

create table if not exists leadgen_economics (
  workspace_id uuid primary key,
  avg_value numeric not null default 0,          -- valore medio cliente chiuso (€)
  close_rate numeric not null default 0,         -- % lead → cliente (0-100)
  margin_pct numeric not null default 100,       -- % margine sul valore (0-100)
  campaign_overrides jsonb not null default '{}'::jsonb, -- { campaignId: { avgValue, closeRate } }
  updated_at timestamptz not null default now()
);

alter table leadgen_economics enable row level security;
