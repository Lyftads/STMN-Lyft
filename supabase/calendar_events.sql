-- ============================================================================
-- Modulo "Calendario" — eventi e promo
--
-- Ferie, permessi e malattia NON stanno qui: vivono già in `time_off`
-- (supabase/lyftimer_timeoff.sql), con il loro flusso di approvazione. Il
-- calendario legge le due tabelle e le unisce in una vista sola: duplicarle
-- avrebbe creato due verità sulle stesse assenze.
--
-- Workspace-scoped, niente RLS: le route usano la service-role key e filtrano
-- per workspace_id a partire dall'utente loggato (stesso pattern di tasks).
-- ============================================================================

create table if not exists calendar_events (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  -- promo_b2c | promo_negozi | evento | meeting
  kind         text not null,
  title        text not null,
  -- a chi si riferisce la voce (opzionali: una promo non ha una persona)
  member_id    uuid,
  person_name  text,
  start_date   date not null,
  end_date     date not null,
  note         text,
  -- confirmed = confermato · draft = da valutare (nel calendario è spento di
  -- default, come le "promo da valutare" del riferimento)
  status       text not null default 'confirmed',
  color        text,
  created_by   uuid,
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists idx_calendar_events_ws    on calendar_events(workspace_id);
create index if not exists idx_calendar_events_dates on calendar_events(workspace_id, start_date, end_date);
create index if not exists idx_calendar_events_kind  on calendar_events(workspace_id, kind);

-- Un intervallo rovesciato (fine prima dell'inizio) romperebbe ogni query per
-- periodo restituendo voci che non compaiono mai: meglio rifiutarlo qui.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'calendar_events_dates_ck') then
    alter table calendar_events
      add constraint calendar_events_dates_ck check (end_date >= start_date);
  end if;
end $$;
