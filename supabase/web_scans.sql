-- Storico delle scansioni AI Website Scanner (tab webScanner).
-- Ogni scan CRO viene salvato qui (best-effort) così il cliente può
-- riaprire le analisi passate ed esportarle in PDF.
-- Eseguire a mano in Supabase (come gli altri .sql del progetto).

create table if not exists web_scans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  url text not null,
  viewport text,
  score int,
  score_label text,
  result jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists web_scans_user_created_idx
  on web_scans (user_id, created_at desc);
