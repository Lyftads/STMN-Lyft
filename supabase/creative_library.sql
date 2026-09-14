-- ============================================================================
-- Sezione Creatività: campagne e file caricati
--
-- Dove finiscono i file: bucket Supabase `creativita` (già esistente). Il
-- caricamento va dal BROWSER direttamente allo storage con un permesso
-- firmato: passando dalle nostre route si sbatterebbe contro il limite di
-- 4,5 MB per richiesta di Vercel, e un video non ci passa.
--
-- Qui si tiene solo l'anagrafica: chi è il file, a quale campagna appartiene,
-- in che stato è. Il file vero sta nello storage.
-- ============================================================================

-- Campagne creative -----------------------------------------------------------
create table if not exists creative_campaigns (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name         text not null,
  description  text,
  color        text,
  archived     boolean not null default false,
  created_by   uuid,
  created_at   timestamptz default now()
);

create index if not exists idx_creative_campaigns_ws on creative_campaigns(workspace_id);

-- File caricati ---------------------------------------------------------------
create table if not exists creative_assets (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  campaign_id  uuid references creative_campaigns(id) on delete set null,
  name         text not null,
  -- video | statica: il resto (formato, lingua) è descrittivo e filtrabile
  kind         text not null default 'video',
  format       text,                         -- 9:16 | 4:5 | 1:1 | 16:9
  language     text,
  product      text,
  author       text,                         -- creator/autore dello scatto
  -- da_completare | in_approvazione | approvata | scartata
  status       text not null default 'da_completare',
  file_path    text not null,                -- percorso nel bucket `creativita`
  file_url     text,                         -- URL pubblico (comodità)
  mime         text,
  size_bytes   bigint,
  notes        text,
  created_by   uuid,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_creative_assets_ws       on creative_assets(workspace_id);
create index if not exists idx_creative_assets_campaign on creative_assets(campaign_id);
create index if not exists idx_creative_assets_status   on creative_assets(workspace_id, status);
