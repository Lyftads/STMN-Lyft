-- Migrazione 14 — tutto ciò che serve perché una creatività sia PRONTA.
-- Non basta l'immagine: senza copy, CTA e link di destinazione va comunque
-- rifinita a mano prima di poterla caricare, e il motore non serve a niente.
alter table ce_creatives add column if not exists sub          text;
alter table ce_creatives add column if not exists primary_text text;
alter table ce_creatives add column if not exists palette      text;
alter table ce_creatives add column if not exists scena_desc   text;
alter table ce_creatives add column if not exists brief_tipo   text;
alter table ce_creatives add column if not exists brief_motivo text;
alter table ce_creatives add column if not exists variante_seme text;
