-- Migrazione 18 — nome breve del prodotto, per la nomenclatura delle creatività.
--
-- Lo slug generato dal titolo Shopify produceva sigle ambigue e troncate
-- ("10-LITRI-OLIO", "OLIO-EXTRAVERGINE-ITALIANO"): due prodotti diversi
-- finivano con la stessa sigla, e dal nome del file non si capiva quale fosse.
-- Il nome breve lo detta il cliente, non un troncamento automatico.
alter table ce_products add column if not exists nome_breve text;
