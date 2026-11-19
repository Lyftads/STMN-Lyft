-- Migrazione 04 — spesa Google e sessioni GA4 nel riquadro business.
-- ad_spend_google resta NULL finché il dato non arriva davvero: sommare uno
-- zero finto farebbe sembrare il MER migliore del vero.
alter table ce_business_daily add column if not exists ad_spend_google numeric;
alter table ce_business_daily add column if not exists sessions bigint;
