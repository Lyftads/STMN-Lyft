-- Cache durevole delle creative competitor scrapate dalla Meta Ad Library.
-- Condivisa fra tutte le istanze serverless e tutti gli utenti: la in-memory
-- su Vercel è effimera (cold start = Browserless ogni volta). Qui sopravvive,
-- così la prima richiesta della settimana scrapa e tutte le altre sono istantanee.
-- Refresh: cron del lunedì 06:00 o pulsante "Aggiorna" (force).

create table if not exists public.competitor_ad_cache (
  page_id    text        not null,
  country    text        not null,
  payload    jsonb       not null,
  fetched_at timestamptz not null default now(),
  primary key (page_id, country)
);

create index if not exists competitor_ad_cache_fetched_at_idx
  on public.competitor_ad_cache (fetched_at);

-- Accesso solo via service_role (server-side): niente RLS pubblica.
alter table public.competitor_ad_cache enable row level security;
