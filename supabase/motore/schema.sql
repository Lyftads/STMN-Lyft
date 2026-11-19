-- ============================================================================
--  MOTORE CREATIVO — schema
--  App separata da LyftAI, stesso progetto Supabase, tabelle con prefisso ce_.
--  Accesso solo via service-role key: le route filtrano per workspace_id.
--  workspace_id = companies.user_id, come nel resto dell'ecosistema.
-- ============================================================================

-- ---------------------------------------------------------------- prodotti --
-- Il margine sta QUI e non altrove: da lui escono tutte le soglie economiche.
create table if not exists ce_products (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  name          text not null,                 -- "Fruttato 10L"
  slug          text not null,                 -- "FRU" — entra nella nomenclatura
  shopify_id    text,
  price         numeric,                       -- 119.00
  margin_pct    numeric,                        -- 0.60 → CAC pareggio = price * margin
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ------------------------------------------------------------------ angoli --
-- L'angolo comunicativo è l'unità di misura del sistema: è su di lui che si
-- aggrega la spesa per avere potenza statistica quando le singole creatività
-- sono troppo sottili per dire qualcosa.
create table if not exists ce_angles (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  name          text not null,                 -- "Convenienza"
  slug          text not null,                 -- "CONVENIENZA"
  description   text,
  source        text not null default 'manual', -- manual | scraped
  created_at    timestamptz not null default now(),
  unique (workspace_id, slug)
);

-- ------------------------------------------------------------ creatività --
-- Una riga per file. La nomenclatura non è decorativa: è la chiave che fa
-- tornare indietro gli insights già segmentati per angolo e persona.
create table if not exists ce_creatives (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  product_id    uuid references ce_products(id) on delete set null,
  angle_id      uuid references ce_angles(id)   on delete set null,
  format        text,                          -- PRODUCT-HERO, DATA-CALLOUT, ...
  funnel        text,                          -- TOFU | MOFU | BOFU
  persona       text,
  audience_type text,                          -- prospecting | retargeting | broad
                                                 -- la scala ROAS si applica DENTRO lo stesso
                                                 -- tipo: il retargeting ha ROAS alto per
                                                 -- costruzione, il prospecting basso. Mescolarli
                                                 -- significa spegnere sistematicamente
                                                 -- l'acquisizione mentre i numeri migliorano.
  ratio         text not null,                 -- 1x1 | 9x16
  version       int  not null default 1,
  name          text not null,                 -- CLIENTE_PROD_FORMATO_ANGOLO_PERSONA_RATIO_Vn
  file_path     text,
  storage_url   text,
  origin        text not null default 'generated', -- generated | higgsfield | existing
  -- stato nel ciclo di vita
  status        text not null default 'draft',  -- draft|queued|uploaded|active|paused|killed
  meta_ad_id    text,
  meta_adset_id text,
  uploaded_at   timestamptz,
  created_at    timestamptz not null default now(),
  unique (workspace_id, name)
);
create index if not exists ce_creatives_ws_idx     on ce_creatives(workspace_id, status);
create index if not exists ce_creatives_angle_idx  on ce_creatives(angle_id);
create index if not exists ce_creatives_metaad_idx on ce_creatives(meta_ad_id);

-- ------------------------------------------------------------- KPI per dì --
-- Serie giornaliera per creatività. Il ROAS qui è quello DICHIARATO DA META:
-- serve a confrontare creatività fra loro, non a decidere il budget.
create table if not exists ce_kpi_daily (
  creative_id     uuid not null references ce_creatives(id) on delete cascade,
  day             date not null,
  spend           numeric default 0,
  impressions     bigint default 0,
  link_clicks     bigint default 0,
  ctr             numeric default 0,
  cpm             numeric default 0,
  cpc             numeric default 0,
  frequency       numeric default 0,
  purchases       numeric default 0,
  purchase_value  numeric default 0,
  roas            numeric default 0,
  primary key (creative_id, day)
);

-- --------------------------------------------- riquadro salute business --
-- Il contraltare dei dati di piattaforma: fatturato e spesa reali.
-- MER e aMER decidono se spingere l'account; il CR è il freno.
create table if not exists ce_business_daily (
  workspace_id     uuid not null,
  day              date not null,
  revenue          numeric default 0,
  orders           int    default 0,
  new_customers    int    default 0,
  returning_customers int default 0,
  conversion_rate  numeric default 0,
  ad_spend_total   numeric default 0,
  ad_spend_meta    numeric default 0,
  mer              numeric default 0,   -- revenue / ad_spend_total
  amer             numeric default 0,   -- revenue nuovi clienti / ad_spend
  cac              numeric default 0,
  cpo              numeric default 0,
  -- ROAS Meta aggregato ÷ MER: quanto Meta sta sovra-attribuendo OGGI.
  -- Non è una costante: se si sposta, le soglie vanno rilette.
  attribution_gap  numeric,

  -- ---- economia LTV -------------------------------------------------------
  -- Saracino acquisisce in perdita/pareggio sul primo ordine e rientra sul
  -- secondo. Il CAC di pareggio sul primo ordine (prezzo × margine) è quindi
  -- il PAVIMENTO, non il tetto: il tetto esce da repeat rate e LTV, letti
  -- dalle coorti di acquisizione (LyftAI /api/ltv-cohorts).
  repeat_rate         numeric,   -- quota di clienti con >= 2 ordini
  ltv_90d             numeric,   -- ricavo medio per cliente a 90 giorni
  avg_days_to_2nd     numeric,   -- ritardo medio di recupero
  cac_ceiling         numeric,   -- AOV × margine × (1 + repeat_rate)

  -- ---- cassa --------------------------------------------------------------
  -- Il numero che nessuna soglia di ROAS intercetta. Scalare un modello che
  -- rientra sul secondo ordine allarga il buco PRIMA che il recupero arrivi:
  -- ROAS verde, MER verde, cassa a zero. Terzo freno allo scaling.
  cash_gap            numeric,   -- spesa acquisizione − margine già incassato

  primary key (workspace_id, day)
);

-- ------------------------------------------------------- coda decisioni --
-- Il motore propone e motiva; l'esecuzione è separata (oggi un click,
-- domani automatica entro i limiti). Ogni riga conserva il perché.
create table if not exists ce_decisions (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  creative_id   uuid references ce_creatives(id) on delete cascade,
  kind          text not null,        -- kill | scale | duplicate | iterate | upload
  reason        text not null,        -- leggibile: perché, con i numeri
  evidence      jsonb,                -- i numeri su cui si è deciso
  from_value    numeric,              -- budget attuale
  to_value      numeric,              -- budget proposto
  status        text not null default 'pending', -- pending|approved|applied|skipped|failed
  applied_at    timestamptz,
  error         text,
  created_at    timestamptz not null default now()
);
create index if not exists ce_decisions_ws_idx on ce_decisions(workspace_id, status, created_at desc);

-- ------------------------------------------------- KPI per SEGMENTO reale --
-- Il segmento NON si deduce dal nome della campagna: arriva dal breakdown
-- nativo di Meta `user_segment_key` (prospecting → new, existing → returning,
-- engaged). Una creatività serve quasi sempre più segmenti insieme, quindi
-- `audience_type` su ce_creatives non è un'etichetta ma una MISURA: il
-- segmento dominante per spesa, ricalcolato a ogni ingest.
create table if not exists ce_kpi_segment_daily (
  creative_id     uuid not null references ce_creatives(id) on delete cascade,
  day             date not null,
  segment         text not null,        -- new | returning | engaged | unknown
  spend           numeric default 0,
  impressions     bigint default 0,
  link_clicks     bigint default 0,
  purchases       numeric default 0,
  purchase_value  numeric default 0,
  roas            numeric default 0,
  primary key (creative_id, day, segment)
);
create index if not exists ce_kpi_seg_day_idx on ce_kpi_segment_daily(day, segment);
