-- ============================================================================
--  Lyft SaaS — Supabase schema
--  Copia-incolla TUTTO questo file nel SQL Editor di Supabase ed eseguilo.
--  Idempotente: puoi rilanciarlo, non rompe le tabelle esistenti.
-- ============================================================================

-- 1) Tabella `companies` — 1 riga per ogni utente registrato.
-- Salva nome azienda, riferimenti Stripe (customer/subscription), config
-- Shopify (store URL + token) per il multi-tenant.
create table if not exists public.companies (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  name                      text not null default '',
  company_name              text not null default '',
  email                     text not null default '',
  -- Stripe
  stripe_customer_id        text unique,
  stripe_subscription_id    text,
  stripe_subscription_status text, -- active / trialing / past_due / canceled / unpaid
  stripe_current_period_end timestamptz,
  plan                      text, -- starter / growth / scale
  -- Shopify (multi-tenant, per ora opzionale)
  shopify_store_url         text,
  shopify_admin_token       text,
  -- Timestamps
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Indici utili
create index if not exists idx_companies_stripe_customer on public.companies(stripe_customer_id);
create index if not exists idx_companies_plan on public.companies(plan);

-- 2) Row Level Security: ogni utente vede SOLO la propria company.
-- Le route API che hanno bisogno di leggere/scrivere senza contesto utente
-- (es. webhook Stripe) usano la service_role key che bypassa RLS.
alter table public.companies enable row level security;

drop policy if exists "Users can view their own company" on public.companies;
create policy "Users can view their own company"
  on public.companies for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update their own company" on public.companies;
create policy "Users can update their own company"
  on public.companies for update
  using (auth.uid() = user_id);

-- INSERT lo fa SOLO il trigger di registrazione (function below).
-- Niente policy INSERT pubblica per evitare che chiunque crei company arbitrarie.

-- 3) Trigger: auto-create company row quando l'utente si registra.
-- Estrae nome + company_name dai metadata passati a signUp().
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.companies (user_id, name, company_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', ''),
    coalesce(new.raw_user_meta_data->>'company_name', new.raw_user_meta_data->>'companyName', ''),
    coalesce(new.email, '')
  )
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 4) Trigger: aggiorna updated_at automaticamente
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists touch_companies_updated_at on public.companies;
create trigger touch_companies_updated_at
  before update on public.companies
  for each row execute function public.touch_updated_at();

-- ============================================================================
--  Fine. Verifica nel pannello "Table Editor" che `companies` esista.
--  Se gia' hai utenti registrati prima di questo schema, lancia:
--    insert into public.companies (user_id, name, company_name, email)
--    select id, '', '', email from auth.users on conflict do nothing;
-- ============================================================================
