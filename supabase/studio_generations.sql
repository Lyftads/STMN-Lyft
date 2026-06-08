-- =====================================================================
-- Creative Studio — board persistente + stato generazioni (incl. video async)
-- Ogni generazione (immagine o video) è una riga. I media vengono copiati su
-- Supabase Storage (bucket 'studio-media', pubblico) così le URL non scadono.
-- I video async hanno status pending → done|failed (usato per polling +
-- rimborso idempotente). Esegui una volta su Supabase (SQL editor).
-- =====================================================================

create table if not exists public.studio_generations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,                       -- image | video
  status      text not null default 'done',        -- pending | done | failed
  url         text,                                -- URL finale (storage o provider)
  model       text,
  model_name  text,
  prompt      text,
  format      text,
  source      text,                                -- text | image (per i video)
  ref         text,                                -- ref crediti (per rimborso idempotente)
  fal_status_url  text,                            -- polling coda fal (solo video pending)
  fal_response_url text,
  credits     integer,                             -- crediti scalati (per rimborso)
  created_at  timestamptz not null default now()
);

create index if not exists studio_gen_user_idx on public.studio_generations(user_id, created_at desc);

alter table public.studio_generations enable row level security;

-- L'utente vede SOLO le proprie generazioni. Le scritture passano dall'admin
-- client (service role) lato server, mai dal browser.
drop policy if exists studio_gen_select_own on public.studio_generations;
create policy studio_gen_select_own on public.studio_generations
  for select using (auth.uid() = user_id);
