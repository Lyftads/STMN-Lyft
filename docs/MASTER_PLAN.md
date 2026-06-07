# LyftAI — Master Plan di prodotto

> **Nord stella:** il miglior software al mondo per **analisi, strategia, performance e operatività** di un brand DTC — un unico *cervello operativo* che vede tutto, decide cosa fare, lo fa, e impara dai risultati.

Documento vivo. Ultima revisione: giugno 2026.

---

## 1. La tesi

I quattro pilastri non sono quattro moduli separati: sono **un unico ciclo chiuso**.

```
        ┌──────────── ANALISI ────────────┐
        │  vede TUTTO: Shopify, Meta, GA4, │
        │  Klaviyo, GSC, P&L, LTV, competitor
        ▼                                  │
   STRATEGIA  ──►  PERFORMANCE  ──►  OPERATIVITÀ
   (decide cosa     (agisce sui      (esegue + coordina
    fare e perché)   canali)          il team)
        ▲                                  │
        └──────── MISURA e impara ─────────┘
```

La maggior parte degli strumenti sul mercato copre **un solo lato** del ciclo. Il valore — e il fossato competitivo — sta nel **chiudere il cerchio** in un solo prodotto che conosce il brand.

---

## 2. Stato attuale — mappa moduli → pilastri

LyftAI oggi copre molto bene 3 lati su 4.

### Analisi (forte)
- Dashboard real-time + Live View (globo visitatori da GA4)
- KPI Brain (top prodotti, sorgenti marketing, paesi)
- Attribuzione, LTV & Coorti
- Conto Economico (P&L: COGS, fee, shipping, OPEX → EBIT)
- SEO Audit + Google Search Console, AI Website Scanner (CRO)
- Competitor Intel + Prezzi vs Competitor
- Klaviyo (revenue email, flussi, segmenti)
- Report periodici (Weekly/Monthly/Quarter/Year) + Scheduled + PDF

### Strategia (forte, "advisor")
- Performance Agent (consulente AI sul brand)
- Recommendations proattive, Budget Advisor, Creative Fatigue, Simulatore
- Agenti verticali per modulo (KPI, CRO, SEO, Meta, Competitor, Creative…)

### Performance (parziale — solo lettura)
- Meta: Creative, Meta Detail, Meta KPI, Lighthouse
- Creative Lab (generazione AI di creatività)
- CRO, SEO
- **Gap:** vediamo i canali ma **non li tocchiamo** (nessuna azione di scrittura).

### Operatività (base solida)
- Progetti & Task (Kanban multi-utente, 5 ruoli, accesso per ruolo)
- Lyftimer (time tracking), LyftTalk (chat di team)
- Approvazioni (ore/ferie), inviti reali via email
- **Gap:** l'operatività non è ancora collegata alle azioni sui canali.

### Fondamenta trasversali
- Multi-tenant isolato (Supabase service-role + resolveWorkspace)
- Brand Identity + memorie agente (la "conoscenza del brand")
- Integrazioni: Klaviyo/Meta via Nango, GA4/Google Ads flusso nativo, Shopify custom-token
- Billing usage-based per ordini/mese (Stripe), i18n it/en/es/fr/de

---

## 3. Il gap che ci fa vincere: il layer "AZIONE"

Oggi il ciclo si **interrompe tra strategia e performance/operatività**: diciamo cosa fare, ma non lo facciamo. Chiudere quel tratto trasforma LyftAI da *"ti dice cosa fare"* a *"lo fa"* — la promessa del consulente AI.

L'esempio che nessun concorrente può fare in una sola mossa:

> Il prodotto X ha LTV alto e margine 68% (**analisi**); il ROAS Meta scende ma la SEO sale su quella keyword (**analisi**) → sposto €40/dì dalla campagna stanca (**performance**) e apro un task al copywriter per 3 nuove creative (**operatività**) — con la tua approvazione, **fatto**.

Nessuno collega LTV + P&L + SEO + ads + team in **una sola azione**.

---

## 4. Posizionamento competitivo

| Prodotto | Copre | Cieco su |
|---|---|---|
| **Nexirfy Ads** | Performance (solo gestione ads Meta) | Shopify, P&L, LTV, SEO, organico, team |
| **Bynor.ai** | Operatività (solo social organico + inbox) | Advertising a pagamento, analytics e-comm, P&L |
| **Triple Whale / Northbeam / Polar** | Analisi/attribuzione | Azione (non lanciano/gestiscono), operatività team |
| **LyftAI** | **Tutti e 4 i pilastri** + memoria del brand | — *(il layer azione è in costruzione)* |

Strategia: **non copiare i monoprodotto** — aggiungere il layer "azione" sopra l'analisi che già abbiamo, dove loro non vedono.

---

## 5. Architettura del "cervello operativo"

Tre componenti nuovi, costruiti **sopra** l'esistente (non riscriviamo):

1. **Orchestratore AI** — il Performance Agent evolve da chatbot-per-tab a *direttore d'orchestra*: legge ogni modulo (analisi) e propone/esegue azioni **cross-canale** coerenti con la strategia.
2. **Coda Azioni** (`action queue`) — ogni raccomandazione diventa un'azione tipizzata `{tipo, payload, stato, modulo, requested_by, approved_by}` che:
   - parte in **modalità coda** (pronta, eseguibile a mano) finché le write-API non sono approvate;
   - diventa **live** appena il permesso esterno è attivo, con un solo executor per canale.
3. **Memoria del brand** — Brand Identity + memorie agente già esistono: rendono le decisioni *tue*, non generiche. Ogni azione eseguita torna in memoria → il sistema impara.

**Principio non negoziabile: human-in-the-loop.** Ogni azione che tocca soldi o pubblico passa da **approvazione** (riusa ruoli + approvazioni che già esistono). L'operatività diventa il sistema di controllo del layer azione.

---

## 6. Roadmap a fasi

### Fase 1 — costruibile ORA (nessuna dipendenza esterna)
- **Approvazioni multi-cliente generiche**: tabella `approvals` (tipo, payload, stato, approver), estende ruoli/Team. Oggetto "approva post/ad/azione".
- **Coda Azioni Meta — UI**: bottoni *"Applica"* in Budget Advisor e Creative Fatigue (pausa / scala ±% / sposta budget) → finiscono nella coda "Azioni in attesa" con stato. UX pronta prima ancora della write-API.
- *Esito:* il prodotto "agisce" in modo tangibile (anche se l'esecuzione live arriva in Fase 2).

### Fase 2 — sblocca con Meta App Review (`ads_management`)
- Executor Meta Marketing API (write): la coda azioni diventa live (pausa/scala/budget).
- **Lancio campagne in linguaggio naturale** dentro l'orchestratore: "descrivi → struttura campagna → coda → API".
- **Creative Lab → Ad**: pubblica come annuncio le creatività generate.

### Fase 3 — layer organico (IG/TikTok API + permessi)
- **Publishing/calendario** IG-TikTok con piani editoriali generati da AI + Brand Identity.
- **Inbox unificata** DM/commenti con risposte AI nel brand voice.
- **Approvazioni contenuti** collegate alla Fase 1.

### Fase 4 — orchestrazione completa
- L'orchestratore propone **piani d'azione cross-canale** (es. sposta budget + apri task + schedula post) come un'unica proposta approvabile.
- Loop di apprendimento: misura l'impatto delle azioni e calibra le raccomandazioni.

---

## 7. Metriche di successo (cosa vuol dire "il migliore")
- **Time-to-action**: dal segnale all'azione eseguita (oggi: ∞, manuale altrove → minuti in-app).
- **% raccomandazioni applicate** (adozione del layer strategia→azione).
- **Azioni cross-canale per utente/settimana** (prova che il cerchio è chiuso).
- Copertura dei 4 pilastri attiva per tenant (nessun concorrente la raggiunge).

---

## 8. Dipendenze lato utente (non bloccano la Fase 1)
- **Meta App Review** per `ads_management` (prerequisito Fase 2) — gate già aperto per l'analytics.
- App/permessi **IG Content Publishing** + **TikTok Content Posting** (Fase 3).
- SQL Supabase per le nuove tabelle (`approvals`, `action_queue`) — da eseguire al rilascio di ogni fase.

---

## 9. Principi di costruzione
- **Non toccare ciò che funziona** senza richiesta esplicita; aggiungere, non riscrivere.
- **Multi-tenant isolation** su ogni nuova tabella/endpoint (resolveWorkspace).
- **Human-in-the-loop** su ogni azione verso soldi/pubblico.
- **Commit per blocco**, validati, deployabili singolarmente.
- Icone UI sempre SVG (`components/ui/Icon`), mai emoji.
