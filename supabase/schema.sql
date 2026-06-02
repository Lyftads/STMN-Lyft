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
alter table public.companies add column if not exists onboarding_completed_at timestamptz;

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
--  Agent Memory — gli agent AI accumulano knowledge tra le sessioni.
--  Pattern: ad ogni Q&A salva osservazioni, preferenze, fatti, insight; alla
--  prossima domanda recupera le memorie semanticamente piu' rilevanti via
--  vector similarity e le inietta nel system prompt.
--
--  Risultato: piu' l'utente chatta, piu' l'agent diventa verticale sul
--  suo brand (impara: "il MER target di STMN e' 2.5x", "Marino preferisce
--  risposte concise", "Picsil ha lanciato una promo il 15 di ogni mese").
-- ============================================================================

-- pgvector extension (Supabase ce l'ha gia' attivabile via dashboard, ma
-- proviamo a crearla idempotente)
create extension if not exists vector;

create table if not exists public.agent_memories (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  agent_id        text not null,             -- 'kpi' / 'cro' / 'creative' / 'mensile' / ...
  role            text not null default 'observation', -- observation / preference / fact / insight
  content         text not null,
  embedding       vector(1536),              -- OpenAI text-embedding-3-small
  importance      smallint not null default 5, -- 1..10
  source          text default 'auto',       -- auto / manual / extracted
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz,
  use_count       integer not null default 0
);

create index if not exists idx_agent_memories_user_agent
  on public.agent_memories (user_id, agent_id, created_at desc);

-- Indice IVFFlat per vector similarity search (cosine).
-- Va creato dopo aver caricato qualche dato — Postgres consiglia 1k+ righe
-- prima di costruirlo. Per ora lo creiamo con lists=10 (piccolo, va bene
-- finche' abbiamo < 10k memorie totali).
create index if not exists idx_agent_memories_embedding
  on public.agent_memories using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

alter table public.agent_memories enable row level security;

drop policy if exists "agent_memories: select own" on public.agent_memories;
create policy "agent_memories: select own"
  on public.agent_memories for select
  using (auth.uid() = user_id);

drop policy if exists "agent_memories: insert own" on public.agent_memories;
create policy "agent_memories: insert own"
  on public.agent_memories for insert
  with check (auth.uid() = user_id);

drop policy if exists "agent_memories: update own" on public.agent_memories;
create policy "agent_memories: update own"
  on public.agent_memories for update
  using (auth.uid() = user_id);

drop policy if exists "agent_memories: delete own" on public.agent_memories;
create policy "agent_memories: delete own"
  on public.agent_memories for delete
  using (auth.uid() = user_id);

-- RPC per recall semantico: top-K memorie per (user_id, agent_id).
-- Ranking HYBRID: similarity (70%) + importance (20%) + recency (10%).
-- Cosi' memorie usate spesso o recenti emergono naturalmente.
--
-- Filtra: importance >= p_min_imp, embedding non null, role != 'consolidated_into'
-- (memorie consolidate sono escluse — la sintesi compatta le rimpiazza).
--
-- NB: drop esplicito perche' Postgres non permette di cambiare il return
-- type di una function esistente con CREATE OR REPLACE (versione vecchia
-- non aveva use_count nel return).
drop function if exists public.recall_agent_memories(uuid, text, vector(1536), integer, integer);
create or replace function public.recall_agent_memories(
  p_user_id    uuid,
  p_agent_id   text,
  p_query_emb  vector(1536),
  p_limit      int default 5,
  p_min_imp    int default 1
)
returns table (
  id          uuid,
  role        text,
  content     text,
  importance  smallint,
  similarity  real,
  use_count   int,
  created_at  timestamptz
)
language sql stable as $$
  select
    m.id, m.role, m.content, m.importance,
    1 - (m.embedding <=> p_query_emb) as similarity,
    m.use_count,
    m.created_at
  from public.agent_memories m
  where m.user_id = p_user_id
    and m.agent_id = p_agent_id
    and m.importance >= p_min_imp
    and m.embedding is not null
    and m.role <> 'consolidated_into'
  order by
    (1 - (m.embedding <=> p_query_emb)) * 0.70
    + (m.importance::float / 10.0) * 0.20
    + (case
         when m.last_used_at is null then 0.0
         when now() - m.last_used_at < interval '7 days'  then 1.0
         when now() - m.last_used_at < interval '30 days' then 0.5
         else 0.2
       end) * 0.10
    desc
  limit p_limit;
$$;

-- RPC per tracciare l'uso: increment use_count + last_used_at = now()
-- per le memorie che il recall ha effettivamente restituito.
-- Chiamato in fire-and-forget dal codice JS.
create or replace function public.track_memory_use(p_ids uuid[])
returns void
language sql as $$
  update public.agent_memories
    set use_count = use_count + 1,
        last_used_at = now()
    where id = any(p_ids);
$$;

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
