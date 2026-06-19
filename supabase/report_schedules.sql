-- Schedulazioni report personalizzate (tab scheduledReports).
-- Ogni riga = un report (o set di report PDF) inviato via email su una cadenza.
-- Eseguire a mano in Supabase (come gli altri .sql del progetto).

create table if not exists report_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  name text not null,
  sections text[] not null default '{}',     -- es. {completo} oppure {meta,google,inventory}
  frequency text not null default 'weekly',  -- daily | weekly | monthly
  weekday int,                                -- 0..6 (0=dom, 1=lun) per frequency=weekly
  monthday int,                               -- 1..28 per frequency=monthly
  timeframe text not null default 'last_7d',  -- preset periodo dei report
  recipients text[] not null default '{}',
  target_url text,                            -- URL per le sezioni SEO Audit / Website Scanner
  enabled boolean not null default true,
  last_sent_at timestamptz,
  created_at timestamptz not null default now()
);

-- Se la tabella esisteva gia' (creata prima dell'aggiunta SEO/Scanner):
alter table report_schedules add column if not exists target_url text;

create index if not exists report_schedules_user_idx
  on report_schedules (user_id, created_at desc);
