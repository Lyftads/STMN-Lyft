-- ============================================================================
-- Costi prodotto (landed) — override del costo unitario reale per variante.
-- Append-only: ogni salvataggio INSERISCE una riga con effective_from, così lo
-- STORICO è preservato (gli ordini prima di quella data possono usare il costo
-- precedente). Il costo "corrente" = riga con effective_from/created_at più recente.
-- Workspace = owner_user_id (companies.user_id). Service-role key, no RLS.
-- ============================================================================

create table if not exists product_landed_cost (
  id             uuid primary key default gen_random_uuid(),
  workspace_id   uuid not null,
  variant_id     text not null,                  -- Shopify variant legacyResourceId
  product_id     text,
  sku            text,
  landed_cost    numeric not null,
  effective_from date not null default current_date,
  note           text,                           -- es. 'manuale' | 'bulk +5%'
  created_at     timestamptz default now()
);

create index if not exists idx_landed_workspace on product_landed_cost(workspace_id);
create index if not exists idx_landed_variant   on product_landed_cost(workspace_id, variant_id, effective_from desc);
