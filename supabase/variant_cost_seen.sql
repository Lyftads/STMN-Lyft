-- ============================================================================
-- Ultimo costo Shopify "visto" per variante, per ogni workspace. Serve a rilevare
-- in automatico i cambi di costo fatti su Shopify: quando il costo attuale ≠ da
-- quello salvato qui, si registra una riga nello storico (product_landed_cost,
-- note='shopify') e si aggiorna il valore qui. La PRIMA volta fa solo da baseline
-- (silenziosa, niente riga nello storico). Service-role key, no RLS.
-- ============================================================================

create table if not exists variant_cost_seen (
  workspace_id uuid not null,
  variant_id   text not null,
  shopify_cost numeric,
  synced_at    timestamptz default now(),
  primary key (workspace_id, variant_id)
);
