-- ============================================================================
--  Integration health — stato di salute delle integrazioni per workspace.
--
--  Perche': il 31/7/2026 il token Meta di STMN e' scaduto alle 19:17 e l'app
--  ha mostrato ZERI invece di un errore; ce ne siamo accorti il giorno dopo
--  guardando. Su un cliente pagante quella e' "spesa zero" presa per buona.
--  Il cron /api/cron/integration-health pinga ogni integrazione collegata di
--  ogni workspace e avvisa il cliente via email quando una cade.
--
--  Una riga per (workspace, provider). `failing_since` marca l'inizio
--  dell'EPISODIO di guasto e `notified_at` l'ultima mail: insieme evitano di
--  rimandare la stessa mail ogni giorno (una sola per episodio).
-- ============================================================================

create table if not exists public.integration_health (
  workspace_id   uuid not null references auth.users(id) on delete cascade,
  provider       text not null,               -- meta | google | shopify | klaviyo
  status         text not null,               -- ok | error
  error          text,                        -- messaggio del provider (troncato)
  checked_at     timestamptz not null default now(),
  failing_since  timestamptz,                 -- null quando status = ok
  notified_at    timestamptz,                 -- ultima email inviata per QUESTO episodio
  notified_to    text,                        -- a chi (per audit: cliente o agency)
  primary key (workspace_id, provider)
);

create index if not exists idx_integration_health_status
  on public.integration_health(status) where status = 'error';

-- RLS: il workspace vede solo le proprie righe. Il cron gira con service_role
-- (bypassa RLS) — stesso schema delle altre tabelle operative.
alter table public.integration_health enable row level security;

drop policy if exists "Workspace can view own integration health" on public.integration_health;
create policy "Workspace can view own integration health"
  on public.integration_health for select
  using (auth.uid() = workspace_id);
