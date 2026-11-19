-- Migrazione 08 — esito della classificazione visiva.
-- confidenza e base servono a NON trattare allo stesso modo un'etichetta letta
-- da un'immagine intera e una dedotta da un fotogramma di video.
alter table ce_creatives add column if not exists angle_confidence numeric;
alter table ce_creatives add column if not exists visual_desc text;
alter table ce_creatives add column if not exists classify_base text;   -- immagine | fotogramma
alter table ce_creatives add column if not exists classified_at timestamptz;
