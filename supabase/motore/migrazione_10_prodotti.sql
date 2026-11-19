-- ============================================================================
--  Migrazione 10 — economia e fisica del prodotto.
--
--  ECONOMIA: quanto un prodotto vende e con che margine decide quanta
--  produzione merita. Distribuire creatività in parti uguali fra prodotti che
--  pesano in modo diverso è il modo più semplice per sprecare capacità.
--
--  FISICA: i dettagli che una generazione AI deve rispettare. Vanno scritti
--  per prodotto perché il modello, lasciato libero, sposta rubinetti e tappi
--  sulla faccia più comoda da disegnare — e un cliente riconosce subito la
--  propria confezione sbagliata.
-- ============================================================================
alter table ce_products add column if not exists revenue_30d      numeric;
alter table ce_products add column if not exists orders_30d       int;
alter table ce_products add column if not exists units_30d        int;
alter table ce_products add column if not exists specifica_fisica text;
alter table ce_products add column if not exists packshot_url     text;
alter table ce_products add column if not exists sales_updated_at timestamptz;

-- Quanto budget e quanta produzione spetta a ogni prodotto, ricalcolato.
alter table ce_products add column if not exists quota_margine    numeric;  -- quota del margine totale
alter table ce_products add column if not exists quota_creativita int;      -- quante creatività gli spettano
