-- ============================================================================
-- Lyftimer — Ferie & permessi (time-off)
-- Le PRESENZE si ricavano dalle voci timer (primo start / ultimo stop del giorno),
-- quindi qui serve solo la tabella delle richieste di assenza.
-- Workspace-scoped, no RLS (service-role + filtro workspace_id).
-- ============================================================================

create table if not exists time_off (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  member_id    uuid not null,
  member_name  text,
  type         text not null default 'ferie',     -- ferie | permesso | malattia
  start_date   date not null,
  end_date     date not null,
  note         text,
  status       text not null default 'pending',   -- pending | approved | rejected
  approved_by  uuid,
  approved_at  timestamptz,
  created_at   timestamptz default now()
);

create index if not exists idx_time_off_ws     on time_off(workspace_id);
create index if not exists idx_time_off_member on time_off(member_id);
create index if not exists idx_time_off_dates  on time_off(workspace_id, start_date);
