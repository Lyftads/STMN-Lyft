-- Sessioni di call con la Squadra AI: trascrizione + sintesi + azioni eseguite.
-- Le decisioni/insight vengono anche salvati come agent_memories (memoria cross-call).
create table if not exists call_sessions (
  id              uuid primary key default gen_random_uuid(),
  workspace_id    uuid not null,
  agent_id        text,                 -- agente d'ingresso (es. 'ceo')
  conversation_id text,                 -- id conversazione ElevenLabs
  transcript      jsonb,                -- [{role, text}]
  summary         text,
  actions         jsonb,                -- {decisions, tasks, reminders, analyses}
  created_at      timestamptz default now()
);
create index if not exists call_sessions_ws on call_sessions (workspace_id, created_at desc);
create unique index if not exists call_sessions_conv on call_sessions (conversation_id);
