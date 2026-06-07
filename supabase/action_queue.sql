-- ============================================================================
-- LyftAI — Coda Azioni (action queue) + approvazione
-- Fase 1 del "layer azione": raccomandazioni (Budget Advisor, Creative Fatigue,
-- agente…) diventano azioni tipizzate con workflow di approvazione umana.
--   pending → approved → executed   (oppure → rejected / failed)
-- In Fase 1 l'esecuzione è MANUALE ("segna come eseguita"); in Fase 2 un
-- executor (es. Meta Marketing API write) chiuderà il cerchio in automatico.
-- Workspace-scoped, no RLS (service-role + filtro workspace_id), come gli altri.
-- ============================================================================

create table if not exists action_queue (
  id            uuid primary key default gen_random_uuid(),
  workspace_id  uuid not null,
  channel       text not null,                       -- 'meta' (futuri: 'klaviyo','tiktok','instagram'…)
  type          text not null,                       -- 'pause_campaign','scale_budget','shift_budget','refresh_creative'…
  target_ref    text,                                -- id campagna/adset/ad
  target_name   text,                                -- nome leggibile del target
  payload       jsonb not null default '{}'::jsonb,  -- es. { "delta_pct": 20, "from": "...", "to": "...", "amount": 40 }
  summary       text not null,                       -- descrizione human-readable dell'azione
  source        text,                                -- 'budget_advisor','creative_fatigue','agent','manual'
  status        text not null default 'pending',     -- pending | approved | executed | rejected | failed
  note          text,                                -- nota di approvazione/rifiuto
  requested_by  uuid,                                -- team_members.id (o owner user_id)
  approved_by   uuid,
  executed_at   timestamptz,
  result        jsonb,                               -- esito executor (Fase 2)
  error         text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_action_queue_ws     on action_queue(workspace_id);
create index if not exists idx_action_queue_status on action_queue(workspace_id, status);
create index if not exists idx_action_queue_created on action_queue(workspace_id, created_at desc);
