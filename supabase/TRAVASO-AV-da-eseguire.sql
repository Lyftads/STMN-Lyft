-- ============================================================================
--  TRAVASO DAL FORK lyft-av — le migrazioni da eseguire, tutte insieme.
--
--  Si incolla nell'editor SQL di Supabase e si esegue UNA VOLTA. Sono tutte
--  `add column if not exists`: rieseguirle non fa danno.
--
--  SE NON SI ESEGUONO, il prodotto funziona lo stesso: le colonne mancano, la
--  lettura va in errore, e il codice risponde «tutto spento» — che e' il
--  ripiego giusto (nessun cliente vede funzioni che non gli servono). Ma
--  nemmeno chi le vuole puo' accenderle.
-- ============================================================================

-- ── 1. Che tipo di negozio e' il cliente ────────────────────────────────────
--  Decide quali funzioni vede. Tre domande diverse, non una: un monomarca puo'
--  vendere su Amazon, e un brand che vende solo i suoi prodotti puo' avere
--  negozi fisici.
--    multimarca      -> «Brand piu' venduti» e «Prezzi» (il confronto coi
--                       concorrenti: se nessun altro vende i tuoi articoli non
--                       c'e' niente da confrontare, e Google non ha il dato)
--    canali_esclusi  -> il fatturato dei marketplace a parte, fuori dai conti
--                       di efficienza (non l'ha generato la pubblicita')
--    negozi_fisici   -> le campagne che portano gente in negozio, fuori da
--                       ROAS e MER
--  multimarca resta NULL finche' non si sa: null non e' «no», e' «non deciso».
alter table public.companies add column if not exists multimarca boolean;
alter table public.companies add column if not exists marchi_rilevati integer;
alter table public.companies add column if not exists quota_primo_marchio numeric;
alter table public.companies add column if not exists canali_esclusi jsonb not null default '[]'::jsonb;
alter table public.companies add column if not exists negozi_fisici boolean not null default false;
alter table public.companies add column if not exists etichetta_negozi_fisici text;

-- ── 2. L'account Google Merchant Center del cliente ─────────────────────────
--  Sul fork era una variabile d'ambiente GLOBALE. In un SaaS sarebbe il difetto
--  peggiore possibile: il primo cliente che accende i Prezzi vedrebbe prezzi,
--  concorrenti e margini di un altro negozio. NULL = non configurato: la tab
--  funziona lo stesso con la sola fonte Shopify e lo dichiara.
alter table public.companies add column if not exists merchant_center_id text;

-- ── 3. I ruoli inventati dentro un workspace ────────────────────────────────
--  Serve alle etichette dei ruoli. Il codice regge anche senza (ripiega sui
--  ruoli di serie), ma con questa i nomi personalizzati funzionano.
alter table public.companies add column if not exists team_custom_roles jsonb default '[]'::jsonb;

-- ============================================================================
--  DOPO AVER ESEGUITO: accendere le funzioni per chi le usa gia'.
--
--  Anna Virgili e' un rivenditore, vende sui marketplace tramite Koongo e ha
--  negozi fisici. Senza questa riga, il giorno del rilascio perde Koongo, il
--  Drive to Store, i marchi e i Prezzi.
--  Sostituire <UUID-DI-ANNA-VIRGILI> con il suo user_id (si trova in companies).
--
--  update public.companies set
--    multimarca = true,
--    canali_esclusi = '["Koongo: Sell on Marketplaces"]'::jsonb,
--    negozi_fisici = true,
--    etichetta_negozi_fisici = 'drive to store'
--  where user_id = '<UUID-DI-ANNA-VIRGILI>';
--
--  Per gli altri clienti non serve fare niente: di serie e' tutto spento, e in
--  questo repo quelle funzioni non esistevano, quindi nessuno perde nulla.
--  Il tipo di negozio si puo' anche dedurre dai dati: vedi lib/team/tipoNegozio.js
--  (un marchio solo, o il primo sopra il 90% del fatturato -> monomarca; cinque
--  o piu' marchi col primo sotto il 70% -> rivenditore; in mezzo si chiede).
-- ============================================================================
