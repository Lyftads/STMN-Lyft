-- ============================================================================
--  Migrazione 09 — vincoli di brand.
--  Il motore sa cosa RENDE, non cosa il brand PUÒ DIRE.
--
--  Distinzione importante fra due cose diverse:
--   · formati_esclusi      = vietati davvero, non si producono mai
--   · formati_sperimentali = sospetti ma NON dimostrati: si testano con una
--                            quota piccola. Escluderli a priori sarebbe un
--                            giudizio di gusto travestito da regola.
-- ============================================================================
create table if not exists ce_brand (
  workspace_id        uuid primary key,
  nome                text,
  tono                text,
  formati_esclusi     text[] default '{}',
  formati_sperimentali text[] default '{}',
  quota_sperimentale  numeric default 0.05,   -- quota massima di produzione e budget
  termini_vietati     text[] default '{}',
  termini_obbligati   text[] default '{}',
  note                text
);

alter table ce_brand add column if not exists formati_sperimentali text[] default '{}';
alter table ce_brand add column if not exists quota_sperimentale numeric default 0.05;
