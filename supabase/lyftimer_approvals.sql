-- ============================================================================
-- Lyftimer — Approvazione ore (timesheet approval)
-- L'Admin approva/rifiuta le ore di un membro per settimana (lunedì = week_start).
-- Workspace-scoped, no RLS (service-role + filtro workspace_id).
-- ============================================================================

create table if not exists time_approvals (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  member_id     uuid not null,
  week_start    date not null,                      -- lunedì della settimana
  status        text not null default 'approved',   -- approved | rejected
  note          text,
  total_seconds int,                                -- snapshot ore al momento dell'azione
  approved_by   uuid,
  approved_at   timestamptz default now(),
  unique (workspace_id, member_id, week_start)
);

create index if not exists idx_time_approvals_ws   on time_approvals(workspace_id);
create index if not exists idx_time_approvals_week on time_approvals(workspace_id, week_start);
