-- Notifiche in-app del team (centro notifiche / campanella). Per destinatario
-- (team_members.id), scoped per workspace.

create table if not exists notifications (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  recipient_id uuid not null,          -- team_members.id
  type         text,                   -- assignment | status | comment | deadline
  title        text not null,
  body         text,
  tab          text default 'tasks',
  task_id      uuid,
  read         boolean default false,
  created_at   timestamptz default now()
);

create index if not exists idx_notifications_recipient on notifications(recipient_id, read, created_at desc);
