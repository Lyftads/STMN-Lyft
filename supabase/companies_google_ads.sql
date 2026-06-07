-- Multi-tenant: Google Ads account per-tenant (customer id + eventuale MCC).
-- Il developer token resta una credenziale APP condivisa (env), questi sono
-- per-tenant. Il resolver legge DB-first con fallback env (vedi credentials.js).
alter table public.companies add column if not exists google_ads_customer_id text;
alter table public.companies add column if not exists google_ads_mcc_id      text;
