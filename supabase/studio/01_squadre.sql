-- ============================================================================
--  Lyft Studio — la Squadra agent di ogni cliente (18 novembre 2026).
--
--  La squadra e' un servizio sempre acceso (uno per cliente: suoi agenti, suoi
--  bot, suo disco). Qui si scrive DOVE risponde quello di ogni workspace e con
--  quale chiave il prodotto gli parla. La chiave non arriva mai al browser: la
--  usano solo le rotte /api/squadra/* dal server.
--
--  Accesso solo con la service-role (RLS accesa, nessuna policy): come le ce_*.
-- ============================================================================
create table if not exists studio_squadre (
  workspace_id uuid primary key,          -- companies.user_id
  url          text not null,             -- es. https://squadra-saracino-production.up.railway.app
  chiave       text not null,             -- chiave della pagina del servizio (sha256("squadra|SEGRETO") primi 32 hex)
  attiva       boolean not null default true,
  creata_il    timestamptz not null default now()
);
alter table studio_squadre enable row level security;
