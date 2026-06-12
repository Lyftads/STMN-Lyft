-- ============================================================================
--  Shopify Billing API — abbonamento per i merchant arrivati DA Shopify
--  (App Store): gli addebiti DEVONO passare da Shopify (policy 1.2.1), non
--  Stripe. Stato salvato su companies (parallelo allo stripe_subscription_*).
--  Stripe resta per chi si iscrive direttamente su lyftai.io (non da Shopify).
-- ============================================================================

alter table public.companies
  add column if not exists shopify_subscription_id     text,
  add column if not exists shopify_subscription_status text, -- active / cancelled / declined / pending
  add column if not exists shopify_subscription_plan   text; -- starter / growth / scale
