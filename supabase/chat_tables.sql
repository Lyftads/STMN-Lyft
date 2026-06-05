-- Chat interna del team (canali + messaggi), scoped per workspace (= owner_user_id).
-- Nessuna RLS: le route usano service-role e filtrano per workspace_id.

create table if not exists channels (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  name         text not null,
  created_by   uuid,
  created_at   timestamptz default now(),
  unique (workspace_id, name)
);

create table if not exists channel_messages (
  id           uuid primary key default gen_random_uuid(),
  channel_id   uuid not null references channels(id) on delete cascade,
  workspace_id uuid not null,
  author_id    uuid,
  author_name  text,
  body         text not null,
  created_at   timestamptz default now()
);

create index if not exists idx_channels_workspace on channels(workspace_id);
create index if not exists idx_channel_messages_channel on channel_messages(channel_id, created_at);
