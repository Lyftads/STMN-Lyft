-- ── Skills del Cervello (stile Sidekick): prompt salvati e condivisi ────────
-- Per-workspace: ogni skill è visibile a tutto il team del workspace.
-- Accesso SOLO via service role dalle route API (nessuna policy pubblica),
-- come le altre tabelle di modulo (team_tasks, time_entries…).

create table if not exists brain_skills (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  author_id uuid,
  title text not null,
  prompt text not null,
  uses integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists brain_skills_ws_idx on brain_skills(workspace_id, updated_at desc);

alter table brain_skills enable row level security;
