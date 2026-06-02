-- ============================================================================
--  LyftAI — Supabase schema
--  Copia-incolla TUTTO questo file nel SQL Editor di Supabase ed eseguilo.
--  Idempotente: puoi rilanciarlo, non rompe le tabelle esistenti.
-- ============================================================================

-- 1) Tabella `companies` — 1 riga per ogni utente registrato.
-- Salva nome azienda, riferimenti Stripe, credenziali integrazioni per
-- isolamento multi-tenant (ogni azienda vede solo i propri dati).
create table if not exists public.companies (
  user_id                   uuid primary key references auth.users(id) on delete cascade,
  -- Profile
  name                      text not null default '',
  company_name              text not null default '',
  email                     text not null default '',
  -- Stripe billing
  stripe_customer_id        text unique,
  stripe_subscription_id    text,
  stripe_subscription_status text, -- active / trialing / past_due / canceled / unpaid
  stripe_current_period_end timestamptz,
  plan                      text, -- starter / growth / scale
  -- Integrations (popolate via onboarding wizard in Fase 3)
  shopify_store_url         text,
  shopify_admin_token       text,
  meta_account_id           text,
  meta_access_token         text,
  ga4_property_id           text,
  google_client_id          text,
  google_client_secret      text,
  google_refresh_token      text,
  klaviyo_api_key           text,
  -- Beta flag — true = vede feature non ancora released (test interno)
  is_beta                   boolean not null default false,
  -- Timestamps
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

-- Aggiungi colonne se la tabella esisteva gia' (idempotenza per upgrade)
alter table public.companies add column if not exists meta_account_id        text;
alter table public.companies add column if not exists meta_access_token      text;
alter table public.companies add column if not exists ga4_property_id        text;
alter table public.companies add column if not exists google_client_id       text;
alter table public.companies add column if not exists google_client_secret   text;
alter table public.companies add column if not exists google_refresh_token   text;
alter table public.companies add column if not exists klaviyo_api_key        text;
alter table public.companies add column if not exists is_beta                boolean not null default false;

-- Brand Identity (Fase 3): JSONB unico per flessibilita' — aggiungiamo/
-- rimuoviamo campi senza migrazioni schema. Struttura tipica:
-- {
--   "tagline": "", "description": "", "mission": "", "founded": "2020",
--   "website": "", "category": "Fitness", "subcategories": ["CrossFit"],
--   "products": ["Paracalli", "Corde"], "notSelling": "no integratori",
--   "targetAudience": "...", "markets": ["IT","EU"], "languages": ["it","en"],
--   "toneTags": ["Professionale","Energico"], "language": "informale",
--   "brandWords": ["performance","durabilita"], "forbiddenWords": ["cheap"],
--   "copyExamples": ["..."], "brandPersona": "...",
--   "colors": ["#000000","#FF6900"], "primaryFont": "Inter",
--   "secondaryFont": "...", "photoStyle": "...", "adStyle": "..."
-- }
alter table public.companies add column if not exists brand_identity         jsonb not null default '{}'::jsonb;

-- Brand assets (logo, mood board, foto reference): array di asset metadata.
-- I file binari vivono nel bucket Storage 'brand-assets', qui salviamo solo
-- url + metadata. Esempio struttura:
-- [
--   { "type": "logo_png", "url": "https://.../logo.png", "name": "logo.png", "size": 12345, "uploadedAt": "..." },
--   { "type": "logo_svg", "url": "...", ... },
--   { "type": "photo_ref", "url": "...", ... },
--   { "type": "mood_board", "url": "...", ... }
-- ]
alter table public.companies add column if not exists brand_assets           jsonb not null default '[]'::jsonb;

-- Indici utili
create index if not exists idx_companies_stripe_customer on public.companies(stripe_customer_id);
create index if not exists idx_companies_plan on public.companies(plan);
create index if not exists idx_companies_is_beta on public.companies(is_beta) where is_beta = true;

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

-- 3) Trigger: auto-create company row quando l'utente si registra.
-- Estrae nome + company_name dai metadata passati a signUp().
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public
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
returns trigger language plpgsql as $$
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
--  Storage bucket per Brand Assets (logo, mood board, foto reference).
--  Bucket pubblico (lettura senza auth) ma scrittura solo per l'owner via RLS.
-- ============================================================================
insert into storage.buckets (id, name, public)
  values ('brand-assets', 'brand-assets', true)
  on conflict (id) do nothing;

-- RLS policies su storage.objects per bucket brand-assets.
-- Path convention: '{user_id}/{filename}' — RLS check sul primo segment del path.
drop policy if exists "brand-assets: read public" on storage.objects;
create policy "brand-assets: read public"
  on storage.objects for select
  using (bucket_id = 'brand-assets');

drop policy if exists "brand-assets: insert own" on storage.objects;
create policy "brand-assets: insert own"
  on storage.objects for insert
  with check (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "brand-assets: update own" on storage.objects;
create policy "brand-assets: update own"
  on storage.objects for update
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "brand-assets: delete own" on storage.objects;
create policy "brand-assets: delete own"
  on storage.objects for delete
  using (
    bucket_id = 'brand-assets'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- ============================================================================
--  Marca il tuo account (STMN, Marino) come beta tenant.
--  Esegui DOPO aver fatto login almeno una volta cosi' la riga companies
--  esiste. Sostituisci 'tua-email@gmail.com' con la tua email di registrazione.
-- ============================================================================
-- update public.companies
--   set is_beta = true
--   where user_id = (select id from auth.users where email = 'tua-email@gmail.com');
