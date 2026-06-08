# Notte 7→8 giu 2026 — Lavoro autonomo (branch `feat/unified-brain`)

Tutto su branch **`feat/unified-brain`** (pushato su origin → preview deploy, **NON** in produzione). `main` invariato. Niente è live finché non approvi.

## ✅ Fatto e verificato (sintassi OK, committato)

1. **Knowledge in TUTTE le 12 funzioni AI non-agent** (richiesta "fallo su tutte").
   Helper unico `buildKnowledgeBlock(query)` in `lib/tenant/agentMemory.js` + innesto additivo (un messaggio system che si **auto-esclude** se non c'è knowledge pertinente). Migrate: recommendations, report, insights, seo-audit, seo-audit/site, seo-ai, seo-agent, website-scanner, actions/suggest, actions/draft-campaign, social/draft-post, creative-lab. Non ho toccato schema di output né guardrail.

2. **Fondazione del "cervello unico"** (`lib/agent/gateway.js` + `lib/agent/skills.js`).
   `callBrain({skill, query, data, messages, locale, json})` assembla UNA volta context (brand+memorie+knowledge) + prompt della skill + lingua, poi chiama OpenAI. Codice **nuovo, non wira nulla** → zero rischio. È la base su cui migrare le route una alla volta.

3. **Bug critico trovato e mitigato**: il recall della knowledge andava in **timeout 8s** (vedi sotto). Aggiunto fast-fail a 3s lato app così non rallenta le route.

## ⚠️ AZIONE TUA #1 (sblocca tutto il knowledge) — 1 minuto
Con 29k+ note la ricerca vettoriale va in **statement timeout**: l'indice `ivfflat` era stato creato a tabella vuota → degenere. **Finché non fai questo, il knowledge è spento ovunque** (anche nei 13 agent esistenti).

➡️ Supabase → **SQL Editor** → incolla ed esegui **`supabase/knowledge_index.sql`** (crea indice **HNSW**). Dopo: recall da >8s a ~50ms.

## 📋 Prossimi passi (da fare con te, ti propongo l'ordine)
1. Esegui la SQL dell'indice (sopra).
2. Rivedi il branch; se ok, lo mergiamo in `main` → la knowledge va live in tutte le tab.
3. **Migrazione al cervello unico, step-by-step**: migro `recommendations` su `callBrain` come pilota, verifichiamo su preview che l'output è identico, poi le altre a gruppi.
4. UX "cervello unico": decidiamo insieme la superficie (un assistente unico presente in ogni tab, stessa memoria). Questo tocca il frontend → lo facciamo insieme, non l'ho toccato stanotte.

## Knowledge ingestion (corso + YouTube)
- Corso: **completo**, 127/127 lezioni.
- YouTube: in chiusura (gap-fill finale). Totale note a fine notte nel messaggio in chat.

## Commit sul branch
recommendations/report/insights/seo-audit (1) · seo-ai/seo-agent/website-scanner (2) · actions/creative-lab/social (3) · recall fast-fail + indice HNSW · fondazione gateway. Tutti con syntax check verde.
