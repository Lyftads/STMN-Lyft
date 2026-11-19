-- Migrazione 15 — handle Shopify sul prodotto.
-- Serve a costruire il link di destinazione della creatività senza deduzioni:
-- una creatività senza link non è pronta, e rifinirla a mano è ciò che il
-- motore deve evitare.
alter table ce_products add column if not exists handle text;
