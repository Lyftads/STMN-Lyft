-- ============================================================================
--  Migrazione 02 — vincolo PIENO su (workspace_id, meta_ad_id).
--
--  Perché: ON CONFLICT aggancia un indice unico PARZIALE solo se la query
--  ripete la stessa clausola WHERE, e supabase-js non lo consente
--  ("there is no unique or exclusion constraint matching the ON CONFLICT
--  specification"). Non serve che sia parziale: in Postgres due NULL sono
--  considerati distinti, quindi un vincolo pieno lascia comunque convivere
--  tutte le creatività generate che un meta_ad_id ancora non ce l'hanno.
-- ============================================================================

drop index if exists ce_creatives_meta_ad_uidx;

alter table ce_creatives
  add constraint ce_creatives_ws_metaad_key unique (workspace_id, meta_ad_id);
