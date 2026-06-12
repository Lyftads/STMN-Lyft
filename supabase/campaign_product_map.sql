-- ============================================================================
-- Mappatura campagna ADS → prodotti (per attribuzione precisa in Performance
-- prodotti). Workspace = owner_user_id (companies.user_id). Nessuna RLS: le
-- route usano la service-role key e filtrano per workspace_id.
-- Una campagna può mappare un MIX di prodotti (DPA / Advantage+ catalogo): la
-- spesa viene distribuita tra i prodotti selezionati in proporzione al ricavo.
-- `products` jsonb = array di {id, title}. product_id/product_title legacy.
-- ============================================================================

create table if not exists campaign_product_map (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  platform      text not null,                 -- 'meta' | 'google'
  campaign_id   text not null,
  campaign_name text,
  product_id    text,                          -- legacy (singolo)
  product_title text,                          -- legacy
  products      jsonb not null default '[]'::jsonb,  -- [{id, title}, ...]
  updated_at    timestamptz default now(),
  unique (workspace_id, platform, campaign_id)
);

alter table campaign_product_map add column if not exists products jsonb not null default '[]'::jsonb;

create index if not exists idx_campmap_workspace on campaign_product_map(workspace_id);
