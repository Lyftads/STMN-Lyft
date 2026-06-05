-- Sottoscrizioni Web Push per membro (browser/device). Una riga per endpoint.
create table if not exists push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  member_id    uuid,
  endpoint     text not null unique,
  subscription jsonb not null,
  created_at   timestamptz default now()
);
create index if not exists idx_push_member on push_subscriptions(member_id);
