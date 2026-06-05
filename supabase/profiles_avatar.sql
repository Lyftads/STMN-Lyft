-- Profilo utente: foto avatar (nome = team_members.full_name già esistente)
-- + presenza online (last_seen_at, aggiornato da un heartbeat del client).
alter table team_members add column if not exists avatar_url text;
alter table team_members add column if not exists last_seen_at timestamptz;
