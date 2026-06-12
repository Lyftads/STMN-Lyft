-- ============================================================================
--  Cache cross-istanza della serie storica Shopify (weekly + monthly) per la
--  dashboard. PRESET-INDIPENDENTE → una riga per tenant, riusata da tutti i
--  preset e da tutte le istanze serverless (anche cold start) → primo load
--  veloce senza rifare ~40 query ShopifyQL. Multi-tenant: tenant_id = company
--  user_id (o 'env' per STMN env-only). Accesso solo via service role.
--  Read-through in app/api/metrics/route.js (fallback alla fetch live se manca).
-- ============================================================================

create table if not exists metrics_history (
  tenant_id  text primary key,
  weekly     jsonb,
  monthly    jsonb,
  updated_at timestamptz default now()
);

alter table metrics_history enable row level security;
