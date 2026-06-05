-- Gruppi: canali privati con membri espliciti.
alter table channels add column if not exists is_private boolean default false;

create table if not exists channel_members (
  id         uuid primary key default gen_random_uuid(),
  channel_id uuid not null references channels(id) on delete cascade,
  member_id  uuid not null,
  created_at timestamptz default now(),
  unique (channel_id, member_id)
);
create index if not exists idx_channel_members_channel on channel_members(channel_id);
create index if not exists idx_channel_members_member on channel_members(member_id);
