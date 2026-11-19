-- ============================================================================
--  Lyft Studio — la squadra si crea dal prodotto (18 novembre 2026).
--
--  Finora studio_squadre diceva solo DOVE risponde un servizio acceso a mano.
--  Ora contiene anche la richiesta del cliente: la scheda del brand, quali
--  agenti vuole e con che nome (configurazione), a che punto e' (stato) e
--  l'impronta del gettone con cui il SUO servizio chiede configurazione e
--  chiavi al prodotto (token_hash: il gettone vero non si salva).
--
--  Solo aggiunte: la riga di Saracino resta valida com'e' (stato 'attiva').
-- ============================================================================
alter table studio_squadre alter column url drop not null;
alter table studio_squadre alter column chiave drop not null;
alter table studio_squadre add column if not exists stato text not null default 'attiva';
alter table studio_squadre add column if not exists configurazione jsonb not null default '{}'::jsonb;
alter table studio_squadre add column if not exists token_hash text;
alter table studio_squadre add column if not exists richiesta_il timestamptz;
alter table studio_squadre add column if not exists richiesta_da uuid;
alter table studio_squadre add column if not exists aggiornata_il timestamptz not null default now();

do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'studio_squadre_stato_check') then
    alter table studio_squadre add constraint studio_squadre_stato_check check (stato in ('bozza', 'richiesta', 'attiva', 'ferma'));
  end if;
end $$;

create unique index if not exists studio_squadre_token_idx on studio_squadre(token_hash) where token_hash is not null;
