-- ============================================================================
--  FIX PERFORMANCE KNOWLEDGE RECALL — eseguire UNA volta in Supabase SQL Editor
--
--  PROBLEMA: con ~29.000+ note in knowledge_base, la ricerca vettoriale va in
--  statement timeout (8s) perché l'indice ivfflat era stato creato a tabella
--  VUOTA → degenere → il planner fa seq-scan su tutti i vettori. Risultato:
--  il recall della knowledge (corso + video) ritorna VUOTO in tutti gli agent
--  e in tutte le funzioni AI.
--
--  SOLUZIONE: ricostruire l'indice ivfflat ORA che i dati ci sono (con ANALYZE).
--  NB: NON usare HNSW qui — il build HNSW su 29k vettori supera il timeout
--  "upstream" dell'editor SQL. IVFFlat invece si costruisce in pochi secondi.
--
--  COME: Supabase → SQL Editor → incolla tutto → Run.
-- ============================================================================

set statement_timeout = '5min';
set maintenance_work_mem = '128MB';  -- il build ivfflat richiede ~65MB (default 32MB è troppo poco)

-- 1) Rimuovi eventuali indici precedenti (degenere ivfflat + tentativo hnsw)
drop index if exists public.idx_knowledge_embedding;
drop index if exists public.idx_knowledge_embedding_hnsw;

-- 2) Ricrea l'indice ivfflat con i dati presenti.
--    lists = ~ rows/300 (qui 100 è un buon valore per ~30k righe).
create index idx_knowledge_embedding
  on public.knowledge_base
  using ivfflat (embedding vector_cosine_ops)
  with (lists = 100);

-- 3) Aggiorna le statistiche del planner (fa usare l'indice)
analyze public.knowledge_base;

-- 4) Riscrivi match_knowledge in modo INDEX-FRIENDLY.
--    Il vecchio filtro "where (1 - distanza) >= soglia" obbligava a calcolare la
--    distanza su TUTTE le righe (seq-scan → timeout), annullando l'indice.
--    Ora: il sotto-select prende i top-K via indice (ORDER BY ... LIMIT), e la
--    soglia di similarità si applica SOLO su quei pochi risultati.
drop function if exists public.match_knowledge(vector(1536), integer, real);
create or replace function public.match_knowledge(
  p_query_emb vector(1536),
  p_limit     int default 5,
  p_min_sim   real default 0.0
)
returns table (id uuid, topic text, content text, similarity real, created_at timestamptz)
language sql stable as $$
  select * from (
    select k.id, k.topic, k.content,
           1 - (k.embedding <=> p_query_emb) as similarity,
           k.created_at
    from public.knowledge_base k
    where k.embedding is not null
    order by k.embedding <=> p_query_emb
    limit greatest(p_limit, 1)
  ) sub
  where sub.similarity >= p_min_sim
  order by sub.similarity desc;
$$;

-- ── VERIFICA (deve tornare righe in ms, non andare in timeout) ───────────────
--   explain analyze
--   select id, topic from public.knowledge_base
--   order by embedding <=> (select embedding from public.knowledge_base
--                           where embedding is not null limit 1)
--   limit 4;
-- Nel piano deve comparire "Index Scan using idx_knowledge_embedding".
--
-- (Opzionale, recall più ampio a costo di un filo di latenza):
--   set ivfflat.probes = 10;
