-- ============================================================================
-- Modulo "Time Tracking" (stile Hubstaff) — registra il tempo che ogni membro
-- impiega sui task/progetti. Workspace = owner_user_id (companies.user_id).
-- Nessuna RLS: le route usano la service-role key e filtrano per workspace_id
-- (stesso pattern di tasks/projects).
-- ============================================================================

create table if not exists time_entries (
  id               uuid primary key default gen_random_uuid(),
  workspace_id     uuid not null,
  member_id        uuid,                              -- team_members.id (chi traccia)
  member_name      text,                              -- snapshot del nome per la UI
  project_id       uuid references projects(id) on delete set null,
  task_id          uuid references tasks(id) on delete set null,
  description      text,
  started_at       timestamptz not null default now(),
  ended_at         timestamptz,                       -- null = timer in corso
  duration_seconds int,                               -- calcolato allo stop
  created_at       timestamptz default now()
);

create index if not exists idx_time_entries_workspace on time_entries(workspace_id);
create index if not exists idx_time_entries_member     on time_entries(member_id);
create index if not exists idx_time_entries_running    on time_entries(workspace_id, member_id) where ended_at is null;
create index if not exists idx_time_entries_started    on time_entries(workspace_id, started_at desc);
