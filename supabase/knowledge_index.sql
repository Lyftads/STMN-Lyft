-- ============================================================================
--  FIX PERFORMANCE KNOWLEDGE RECALL — eseguire UNA volta in Supabase SQL Editor
--
--  PROBLEMA: con ~29.000+ note in knowledge_base, la ricerca vettoriale va in
--  statement timeout (8s) perché l'indice ivfflat era stato creato a tabella
--  vuota → degenere → il planner fa seq-scan su tutti i vettori. Risultato:
--  il recall della knowledge (corso + video) ritorna VUOTO in tutti gli agent
--  e in tutte le funzioni AI.
--
--  SOLUZIONE: indice HNSW (gestisce bene gli insert incrementali e non ha il
--  problema "va costruito a dati presenti" dell'ivfflat). Dopo questo, il
--  recall passa da >8s (timeout) a ~50ms.
--
--  COME: Supabase → SQL Editor → incolla tutto → Run. Richiede ~1 minuto.
-- ============================================================================

-- 1) Rimuovi il vecchio indice ivfflat degenere
drop index if exists public.idx_knowledge_embedding;

-- 2) Crea l'indice HNSW per cosine similarity (pgvector >= 0.5, presente su Supabase)
--    m=16, ef_construction=64 = default robusti per questa scala.
create index if not exists idx_knowledge_embedding_hnsw
  on public.knowledge_base
  using hnsw (embedding vector_cosine_ops)
  with (m = 16, ef_construction = 64);

-- 3) Aggiorna le statistiche del planner
analyze public.knowledge_base;

-- 4) (Opzionale) qualità di ricerca a runtime. Default 40 va bene; alza a 100
--    se vuoi recall più ampio a costo di un filo di latenza.
-- set hnsw.ef_search = 64;

-- ── VERIFICA (deve tornare righe in pochi ms, non andare in timeout) ──────────
-- Sostituisci con un embedding reale per testare, oppure verifica solo l'uso indice:
--   explain analyze
--   select id, topic from public.knowledge_base
--   order by embedding <=> (select embedding from public.knowledge_base limit 1)
--   limit 4;
-- Nel piano deve comparire "Index Scan using idx_knowledge_embedding_hnsw".
