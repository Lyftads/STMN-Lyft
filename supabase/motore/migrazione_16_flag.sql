-- Migrazione 16 — flag manuali sulle creatività + saldo crediti generazione.
--
-- Perché due flag e non uno solo: "lanciata" è un fatto (l'ho caricata su
-- Meta), il giudizio è una decisione presa DOPO averla vista girare. Tenerli
-- separati permette di avere una creatività lanciata e ancora senza verdetto,
-- che è lo stato più comune nei primi giorni.
--
-- Perché manuali e non dedotti da Meta: finché non abbiamo ads_management in
-- scrittura, il caricamento avviene a mano; senza un flag manuale il motore
-- non sa cosa è già stato fatto e ripropone gli stessi brief.

alter table ce_creatives add column if not exists flag_lanciata    boolean not null default false;
alter table ce_creatives add column if not exists flag_lanciata_il timestamptz;
alter table ce_creatives add column if not exists giudizio         text;
alter table ce_creatives add column if not exists giudizio_il      timestamptz;
alter table ce_creatives add column if not exists nota             text;

alter table ce_creatives drop constraint if exists ce_creatives_giudizio_chk;
alter table ce_creatives add  constraint ce_creatives_giudizio_chk
  check (giudizio is null or giudizio in ('kill','good','scale'));

create index if not exists ce_creatives_giudizio_idx on ce_creatives(workspace_id, giudizio);

-- Saldo crediti del generatore di immagini. Sta a DB e non in env perché è un
-- valore che CAMBIA a ogni generazione: se resta fermo il banner mente, e un
-- banner che mente è peggio di nessun banner.
create table if not exists ce_crediti (
  workspace_id  uuid not null,
  provider      text not null default 'higgsfield',
  saldo         numeric not null default 0,
  costo_scena   numeric not null default 3,   -- Seedream 5.0 Pro = 3 crediti/scena
  aggiornato_il timestamptz not null default now(),
  primary key (workspace_id, provider)
);
