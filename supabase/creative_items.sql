-- ============================================================================
-- Creatività a tre formati
--
-- Una creatività non è un file: è la stessa idea declinata in tre formati
-- (quadrato 1080×1080, verticale 1080×1920, orizzontale 1920×1080). Prima
-- ogni file viveva per conto suo e non c'era modo di dire "questi tre sono la
-- stessa cosa": ora i file appartengono a una creatività, uno per formato.
--
-- Lo stato sta sulla CREATIVITÀ, non sul singolo file: si approva o si boccia
-- l'idea, non il ritaglio.
-- ============================================================================

create table if not exists creative_items (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id  uuid references creative_campaigns(id) on delete set null,
  -- Per cosa serve: un progetto (Progetti & Task) OPPURE una promo del
  -- calendario. Le creatività si organizzano per iniziativa, non per prodotto:
  -- un prodotto compare in dieci promo, e cercare "la creatività della promo
  -- di settembre" è la domanda che ci si fa davvero.
  project_id   uuid references projects(id) on delete set null,
  promo_id     uuid references calendar_events(id) on delete set null,
  name         text not null,
  -- da_rivisionare | accettata | bocciata | utilizzata
  status       text not null default 'da_rivisionare',
  product      text,
  author       text,
  notes        text,
  created_by   uuid,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_creative_items_ws       on creative_items(workspace_id);
create index if not exists idx_creative_items_campaign on creative_items(campaign_id);
create index if not exists idx_creative_items_project  on creative_items(project_id);
create index if not exists idx_creative_items_promo    on creative_items(promo_id);
create index if not exists idx_creative_items_status   on creative_items(workspace_id, status);

-- I file appartengono a una creatività, uno per formato -----------------------
alter table creative_assets add column if not exists item_id uuid references creative_items(id) on delete cascade;
create index if not exists idx_creative_assets_item on creative_assets(item_id);

-- Un solo file per formato dentro la stessa creatività: due "verticali" nella
-- stessa scheda vorrebbe dire non sapere quale va in campagna.
create unique index if not exists idx_creative_assets_item_format
  on creative_assets(item_id, format) where item_id is not null;
