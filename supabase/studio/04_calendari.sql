-- ============================================================================
--  Lyft Studio — il Google Calendar di ogni PERSONA (18 novembre 2026).
--
--  Lyft legge gli appuntamenti e fissa le call sul calendario di chi gli parla,
--  non su quello dell'azienda: per questo il collegamento e' per utente e non
--  per workspace. Il gettone di Google e' cifrato dall'app (stessa chiave delle
--  altre chiavi dei clienti); in chiaro resta solo l'indirizzo del calendario.
--
--  Accesso solo con la service-role (RLS accesa, nessuna policy).
-- ============================================================================
create table if not exists studio_calendari (
  user_id        uuid primary key,              -- auth.users.id della persona
  dati_cifrati   text not null,
  email          text,
  aggiornato_il  timestamptz not null default now()
);
alter table studio_calendari enable row level security;
