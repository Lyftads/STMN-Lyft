-- Migrazione 12 — funnel Shopify nel riquadro business.
alter table ce_business_daily add column if not exists add_to_cart bigint;
alter table ce_business_daily add column if not exists checkout    bigint;
