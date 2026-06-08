-- =====================================================================
-- Creative Studio — Progetti/Board (stile Luma)
-- Ogni progetto è una board con un titolo; le generazioni
-- (studio_generations) appartengono a una board via board_id.
-- Esegui una volta su Supabase (SQL editor).
-- =====================================================================

create table if not exists public.studio_boards (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null default 'Senza titolo',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists studio_boards_user_idx on public.studio_boards(user_id, updated_at desc);

alter table public.studio_boards enable row level security;

drop policy if exists studio_boards_select_own on public.studio_boards;
create policy studio_boards_select_own on public.studio_boards
  for select using (auth.uid() = user_id);

-- Collega le generazioni a una board (nullable: le vecchie restano senza board).
alter table public.studio_generations
  add column if not exists board_id uuid references public.studio_boards(id) on delete cascade;

create index if not exists studio_gen_board_idx on public.studio_generations(board_id, created_at desc);
