-- =====================================================================
-- Creative Studio — Modelli AI addestrati (LoRA, stile Krea/Kive Characters)
-- L'utente addestra un modello su un prodotto/personaggio/stile (3-20 foto).
-- Training async su fal → lora_url quando pronto. Esegui una volta su Supabase.
-- =====================================================================

create table if not exists public.studio_models (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  name            text not null,
  kind            text not null default 'character',   -- character | product | style
  trigger_word    text,
  status          text not null default 'training',    -- training | ready | failed
  lora_url        text,
  thumb_url       text,
  ref             text,                                 -- ref crediti (rimborso)
  credits         integer,
  fal_status_url  text,
  fal_response_url text,
  created_at      timestamptz not null default now()
);

create index if not exists studio_models_user_idx on public.studio_models(user_id, created_at desc);

alter table public.studio_models enable row level security;

drop policy if exists studio_models_select_own on public.studio_models;
create policy studio_models_select_own on public.studio_models
  for select using (auth.uid() = user_id);
