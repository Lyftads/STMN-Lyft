-- ============================================================================
--  Modulo "Geo-lift" — ciclo di vita degli esperimenti geografici.
--  Salva ogni test lanciato dal designer (/api/geolift) e ne conserva il
--  readout causale quando concluso. Workspace = owner_user_id (companies.user_id).
--  Nessuna RLS: le route usano la service-role key e filtrano per workspace_id
--  (stesso pattern di time_entries / tasks). L'isolamento agency è garantito a
--  monte da getEffectiveTenantId() (anti-leak) che risolve workspace_id.
-- ============================================================================

create table if not exists geo_tests (
  id                uuid primary key default gen_random_uuid(),
  workspace_id      uuid not null,
  created_by        uuid,                             -- auth.users.id di chi l'ha creato
  name              text,                             -- etichetta libera del test
  channel           text not null default 'meta',     -- canale trattato: meta | google
  status            text not null default 'running',  -- running | completed | cancelled
  source            text,                             -- shopify_province | ga4_region
  unit              text,                             -- province | region
  metric            text,                             -- revenue | conversions | sessions
  test_regions      text[] not null default '{}',     -- regioni/province TEST
  control_regions   text[] not null default '{}',     -- regioni/province CONTROL
  trimmed           jsonb,                            -- geo dominanti esclusi dal disegno
  lift_pct          int not null default 50,          -- variazione di spesa applicata (%)
  planned_days      int not null default 28,          -- durata pianificata
  alpha             numeric,                          -- livello di significatività del disegno
  expected_mde      numeric,                          -- MDE atteso dal disegno
  start_date        date not null,                    -- inizio del trattamento
  end_date          date,                             -- fine pianificata (start + planned_days)
  ended_at          timestamptz,                      -- stop effettivo
  design            jsonb,                            -- snapshot completo del disegno al lancio
  readout           jsonb,                            -- risultato causale (lift %, CI, iROAS…)
  readout_at        timestamptz,                      -- quando è stato calcolato il readout
  readout_engine    text,                             -- tbr (JS) | geolift (worker R)
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists idx_geo_tests_workspace on geo_tests(workspace_id, created_at desc);
create index if not exists idx_geo_tests_status    on geo_tests(workspace_id, status);
