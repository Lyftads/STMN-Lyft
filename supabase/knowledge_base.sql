-- ============================================================================
--  Strato KNOWLEDGE globale (condiviso da TUTTI gli agent di TUTTI i clienti).
--
--  A differenza di agent_memories (per-utente/per-agent), qui vivono note di
--  conoscenza distillate da fonti esterne (video YouTube, corsi) — concetti,
--  framework, regole operative ANONIMIZZATE (nessun nome di persone/canali/corsi).
--
--  Recupero: match_knowledge(query_emb, k) → top-K via cosine similarity.
--  Iniettate da buildAgentContext nel blocco [KNOWLEDGE BASE] del system prompt.
-- ============================================================================

create extension if not exists vector;

create table if not exists public.knowledge_base (
  id          uuid primary key default gen_random_uuid(),
  topic       text,                          -- macro-argomento (es. 'meta-ads-scaling')
  content     text not null,                 -- nota distillata, anonima
  embedding   vector(1536),                  -- text-embedding-3-small
  source      text default 'course',         -- 'course' | 'youtube'
  source_ref  text,                          -- riferimento INTERNO anonimo (es. hash lezione) — NO nomi
  importance  smallint not null default 5,   -- 1..10
  created_at  timestamptz not null default now()
);

create index if not exists idx_knowledge_topic
  on public.knowledge_base (topic, created_at desc);

create index if not exists idx_knowledge_embedding
  on public.knowledge_base using ivfflat (embedding vector_cosine_ops)
  with (lists = 10);

-- RLS: nessun accesso pubblico. Solo il service role (admin server-side) legge/scrive.
alter table public.knowledge_base enable row level security;
-- (nessuna policy = nessun accesso via anon/auth; getAdminSupabase bypassa RLS)

-- RPC recall: top-K per similarità coseno. Niente filtro per-utente: è globale.
drop function if exists public.match_knowledge(vector(1536), integer, real);
create or replace function public.match_knowledge(
  p_query_emb   vector(1536),
  p_limit       int default 5,
  p_min_sim     real default 0.0
)
returns table (
  id          uuid,
  topic       text,
  content     text,
  similarity  real,
  created_at  timestamptz
)
language sql stable as $$
  select
    k.id, k.topic, k.content,
    1 - (k.embedding <=> p_query_emb) as similarity,
    k.created_at
  from public.knowledge_base k
  where k.embedding is not null
    and (1 - (k.embedding <=> p_query_emb)) >= p_min_sim
  order by k.embedding <=> p_query_emb
  limit p_limit;
$$;
