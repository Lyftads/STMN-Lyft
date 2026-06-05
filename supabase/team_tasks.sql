-- ============================================================================
-- Modulo "Team & Progetti/Task" — Fase 1
-- Workspace = owner_user_id (l'utente Supabase proprietario dell'azienda,
-- cioè companies.user_id). I membri invitati appartengono a quel workspace.
-- Nessuna RLS: le route usano la service-role key e filtrano per workspace_id
-- a partire dall'utente loggato (stesso pattern di companies/pnl_config).
-- ============================================================================

-- Membri del team -------------------------------------------------------------
create table if not exists team_members (
  id          uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,                 -- = owner user_id (companies.user_id)
  user_id     uuid,                            -- auth.users id; null finché non accetta l'invito
  email       text not null,
  full_name   text,
  roles       text[] not null default '{}',    -- es: {'cro_specialist','ecommerce_manager'}
  status      text not null default 'invited', -- invited | active | disabled
  invited_at  timestamptz default now(),
  accepted_at timestamptz,
  created_at  timestamptz default now(),
  unique (workspace_id, email)
);

-- Progetti --------------------------------------------------------------------
create table if not exists projects (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name         text not null,
  description  text,
  color        text,
  archived     boolean default false,
  created_by   uuid,
  created_at   timestamptz default now()
);

-- Task ------------------------------------------------------------------------
create table if not exists tasks (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id   uuid references projects(id) on delete set null,
  title        text not null,
  description  text,
  status       text not null default 'todo',   -- todo | in_progress | in_review | approved | done
  priority     text default 'medium',          -- low | medium | high | urgent
  assignee_id  uuid,                            -- team_members.id
  due_date     date,
  links        jsonb default '[]'::jsonb,
  position     int default 0,
  approved_by  uuid,                            -- team_members.id (chi ha approvato)
  approved_at  timestamptz,
  created_by   uuid,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

-- Commenti --------------------------------------------------------------------
create table if not exists task_comments (
  id           uuid primary key default gen_random_uuid(),
  task_id      uuid not null references tasks(id) on delete cascade,
  workspace_id uuid not null,
  author_id    uuid,
  author_name  text,
  body         text not null,
  created_at   timestamptz default now()
);

-- Indici ----------------------------------------------------------------------
create index if not exists idx_tasks_workspace        on tasks(workspace_id);
create index if not exists idx_tasks_project          on tasks(project_id);
create index if not exists idx_projects_workspace     on projects(workspace_id);
create index if not exists idx_team_members_workspace on team_members(workspace_id);
create index if not exists idx_team_members_email     on team_members(email);
create index if not exists idx_task_comments_task     on task_comments(task_id);
