-- ============================================================================
--  Migrazione 01 — l'identità di una creatività dipende da dove nasce.
--
--  Su Meta i NOMI DELLE INSERZIONI NON SONO UNICI: la stessa creatività girata
--  in adset diversi porta lo stesso ad_name. Il vincolo unique(workspace,name)
--  faceva fallire l'ingest con "ON CONFLICT DO UPDATE command cannot affect
--  row a second time" appena due inserzioni condividevano il nome.
--
--  Identità corretta:
--   · creatività IMPORTATE dall'account → meta_ad_id (univoco per costruzione)
--   · creatività GENERATE da noi        → la nomenclatura, che è unica by design
--     ma solo finché non è stata caricata (dopo, vale meta_ad_id)
-- ============================================================================

alter table ce_creatives drop constraint if exists ce_creatives_workspace_id_name_key;

create unique index if not exists ce_creatives_meta_ad_uidx
  on ce_creatives (workspace_id, meta_ad_id)
  where meta_ad_id is not null;

create unique index if not exists ce_creatives_generated_name_uidx
  on ce_creatives (workspace_id, name)
  where origin = 'generated';
