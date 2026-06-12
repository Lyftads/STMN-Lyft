-- ============================================================================
--  Agency / Multi-workspace — Fase 1
--
--  Un'agency/freelance (utente auth) può gestire più "workspace cliente".
--  Ogni workspace cliente è una riga `companies` keyed su un utente auth
--  "shadow" (creato via admin, senza login) → riusa tutto: trigger
--  handle_new_user, RLS per-tenant, resolver creds.
--
--  `agency_clients` mappa agency → workspace cliente. Il resolver
--  (lib/tenant/credentials.js → getEffectiveTenantId) usa il cookie
--  `active_workspace` SOLO se esiste un mapping autorizzato qui (anti-leak).
-- ============================================================================

-- Flag sull'azienda: true = account "agency" (gestisce clienti).
alter table public.companies add column if not exists is_agency boolean not null default false;
-- Flag: true = questa riga è un workspace cliente creato da un'agency (shadow),
-- non un account self-serve. Utile per nascondere billing/onboarding propri.
alter table public.companies add column if not exists is_client_workspace boolean not null default false;

create table if not exists public.agency_clients (
  id              uuid primary key default gen_random_uuid(),
  agency_user_id  uuid not null references auth.users(id) on delete cascade,
  client_user_id  uuid not null references auth.users(id) on delete cascade, -- il workspace (companies.user_id)
  label           text not null default '',
  role            text not null default 'manager', -- manager / viewer (futuro)
  created_at      timestamptz not null default now(),
  unique (agency_user_id, client_user_id)
);

create index if not exists idx_agency_clients_agency on public.agency_clients(agency_user_id);
create index if not exists idx_agency_clients_client on public.agency_clients(client_user_id);

-- RLS: l'agency vede SOLO i propri mapping. Le route che risolvono creds usano
-- la service_role (bypass RLS) e fanno il membership check in codice.
alter table public.agency_clients enable row level security;

drop policy if exists "Agency can view own client mappings" on public.agency_clients;
create policy "Agency can view own client mappings"
  on public.agency_clients for select
  using (auth.uid() = agency_user_id);
