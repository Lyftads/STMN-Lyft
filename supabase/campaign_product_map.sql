-- ============================================================================
-- Mappatura campagna ADS → prodotto (per attribuzione precisa in Performance
-- prodotti). Workspace = owner_user_id (companies.user_id). Nessuna RLS: le
-- route usano la service-role key e filtrano per workspace_id.
-- product_id NULL = campagna esplicitamente "non attribuita" (spesa ripartita
-- in proporzione al ricavo, come fallback).
-- ============================================================================

create table if not exists campaign_product_map (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  platform      text not null,                 -- 'meta' | 'google'
  campaign_id   text not null,
  campaign_name text,
  product_id    text,                          -- Shopify product id (numerico, come stringa)
  product_title text,
  updated_at    timestamptz default now(),
  unique (workspace_id, platform, campaign_id)
);

create index if not exists idx_campmap_workspace on campaign_product_map(workspace_id);
