-- ============================================================================
--  Migrazione 28 — la matrice: a chi parla ogni creatività.
--
--  Dal 6 novembre 2026 ogni creatività generata nasce da una riga della
--  matrice (data/saracino/matrice.json): un segmento, un cluster, un avatar con
--  nome ed età, e un template di impaginazione proposto.
--
--  Finora quel legame vive solo dentro il testo di brief_motivo, come
--  "[matrice 4A-03] [template FB-173]": basta al motore per non rifare la
--  stessa riga, ma non si può filtrare né aggregare. Con queste colonne la
--  board e le analitiche possono rispondere a "quale cluster rende di più" e
--  "quale avatar non è mai stato provato".
--
--  Il codice funziona anche senza: scrive le colonne se ci sono, altrimenti
--  le salta (app/api/genera/route.js).
-- ============================================================================
alter table ce_creatives add column if not exists matrice_id  text;  -- 4A-03
alter table ce_creatives add column if not exists segmento    text;  -- CUSTODE | FUORISEDE | SALUTISTA | PREZZO | REGALO | CURIOSA
alter table ce_creatives add column if not exists cluster     text;  -- 4A
alter table ce_creatives add column if not exists avatar      text;  -- 4A-1
alter table ce_creatives add column if not exists template_id text;  -- FB-173

create index if not exists ce_creatives_cluster_idx on ce_creatives(workspace_id, cluster);

-- Le righe gia' scritte col solo segno nel motivo si riallineano da sole.
update ce_creatives
   set matrice_id = substring(brief_motivo from '\[matrice (\d[ABC]-\d\d)\]'),
       cluster    = substring(brief_motivo from '\[matrice (\d[ABC])-\d\d\]'),
       template_id = substring(brief_motivo from '\[template ([^\]]+)\]')
 where matrice_id is null and brief_motivo ~ '\[matrice \d[ABC]-\d\d\]';
