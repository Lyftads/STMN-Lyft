-- Migrazione 07 — media e identità del creative.
alter table ce_business_daily add column if not exists ga4_provvisorio boolean;
alter table ce_creatives add column if not exists meta_creative_id text;
alter table ce_creatives add column if not exists media_type text;   -- image | video | catalog
alter table ce_creatives add column if not exists video_id   text;
alter table ce_creatives add column if not exists thumb_url  text;   -- piccola, per la tabella
