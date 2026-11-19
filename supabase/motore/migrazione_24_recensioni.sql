-- Migrazione 24 — recensioni dei clienti e temi ricorrenti.
--
-- Perché stanno nel motore creativo e non in un foglio a parte: gli angoli si
-- decidono su quello che le persone dicono davvero, non su quello che sembra
-- buono a noi. Una recensione ripetuta 90 volte è un angolo comunicativo già
-- validato dal mercato — e se non esiste una creatività che lo dice, è un buco
-- che il motore deve vedere e riempire.
--
-- I temi NEGATIVI si conservano apposta: dicono cosa NON promettere.
create table if not exists ce_recensioni (
  id            text primary key,
  workspace_id  uuid not null,
  fonte         text not null default 'trustpilot',
  stelle        int,
  titolo        text,
  testo         text,
  pubblicata_il timestamptz,
  temi          text[],
  letta_il      timestamptz not null default now()
);
create index if not exists ce_recensioni_ws_idx on ce_recensioni(workspace_id, stelle);

create table if not exists ce_temi (
  workspace_id uuid not null,
  slug         text not null,
  nome         text,
  descrizione  text,
  sentiment    text,          -- positivo | negativo | misto
  citazione    text,
  angolo       text,          -- l'angolo comunicativo che ne deriva
  n            int  default 0,
  quota        numeric,       -- su quante recensioni pesa
  aggiornato_il timestamptz not null default now(),
  primary key (workspace_id, slug)
);
