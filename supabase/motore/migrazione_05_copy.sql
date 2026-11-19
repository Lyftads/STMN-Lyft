-- Migrazione 05 — il testo dell'inserzione, per il pannello di dettaglio.
alter table ce_creatives add column if not exists body        text;
alter table ce_creatives add column if not exists headline    text;
alter table ce_creatives add column if not exists description text;
alter table ce_creatives add column if not exists cta         text;
alter table ce_creatives add column if not exists link_url    text;
