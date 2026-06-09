-- Snapshot dati reali per le call: il browser (owner autenticato) lo "innesca"
-- prima della call; il cervello della call (server, senza sessione) lo legge qui.
create table if not exists call_context (
  workspace_id uuid primary key,
  data         jsonb,
  updated_at   timestamptz default now()
);
