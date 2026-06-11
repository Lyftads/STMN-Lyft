-- ============================================================================
--  DATA WAREHOUSE LyftAI — tabelle wh_* (lettura veloce/stabile, no rate-limit).
--  Layer IN AGGIUNTA all'API live (vedi docs/DATA_WAREHOUSE.md). Popolate dai
--  sync job incrementali (Shopify per primo). tenant_id = company user_id.
--  Accesso solo via service role (RLS on, nessuna policy pubblica).
--  NB: eseguire solo quando si attiva il warehouse (flag LYFT_WAREHOUSE).
-- ============================================================================

-- Stato sync incrementale (cursore per fonte/tenant) -------------------------
create table if not exists wh_sync_state (
  tenant_id uuid not null,
  source text not null,            -- 'shopify' | 'meta' | 'google_ads' | 'ga4' | 'klaviyo'
  cursor text,                     -- watermark (es. updated_at ISO) per il prossimo sync
  last_synced_at timestamptz,
  last_rows int default 0,
  primary key (tenant_id, source)
);

-- SHOPIFY --------------------------------------------------------------------
create table if not exists wh_orders (
  tenant_id uuid not null,
  order_id bigint not null,
  created_at timestamptz not null,
  processed_at timestamptz,
  updated_at_src timestamptz,      -- updated_at lato Shopify (per il watermark)
  currency text,
  total_price numeric,             -- currentTotalPrice (al lordo dei resi)
  total_refunded numeric default 0,
  net_revenue numeric generated always as (greatest(total_price - total_refunded, 0)) stored,
  financial_status text,
  fully_refunded boolean default false,
  customer_id bigint,
  customer_orders_count int,       -- numberOfOrders del cliente (per NC/RC)
  is_new_customer boolean,         -- customer_orders_count <= 1
  synced_at timestamptz default now(),
  primary key (tenant_id, order_id)
);
create index if not exists wh_orders_tenant_created on wh_orders (tenant_id, created_at);

create table if not exists wh_order_lines (
  tenant_id uuid not null,
  order_id bigint not null,
  line_id bigint not null,
  product_id bigint, variant_id bigint, sku text, title text,
  quantity int, price numeric, total_discount numeric,
  primary key (tenant_id, line_id)
);
create index if not exists wh_order_lines_tenant_product on wh_order_lines (tenant_id, product_id);

create table if not exists wh_customers (
  tenant_id uuid not null,
  customer_id bigint not null,
  email text, created_at timestamptz, orders_count int, total_spent numeric,
  primary key (tenant_id, customer_id)
);

create table if not exists wh_refunds (
  tenant_id uuid not null,
  refund_id bigint not null,
  order_id bigint, created_at timestamptz, amount numeric,
  primary key (tenant_id, refund_id)
);

-- META / GOOGLE ADS (stessa forma) ------------------------------------------
create table if not exists wh_ad_insights (
  tenant_id uuid not null,
  platform text not null,          -- 'meta' | 'google_ads'
  date date not null,
  level text not null,             -- 'campaign' | 'adset' | 'ad'
  object_id text not null,
  name text,
  spend numeric, impressions bigint, clicks bigint,
  purchases numeric, purchase_value numeric,
  roas numeric generated always as (case when spend > 0 then purchase_value / spend end) stored,
  ctr numeric, cpc numeric, cpm numeric, frequency numeric,
  synced_at timestamptz default now(),
  primary key (tenant_id, platform, level, object_id, date)
);
create index if not exists wh_ad_insights_tenant_date on wh_ad_insights (tenant_id, platform, date);

-- GA4 -----------------------------------------------------------------------
create table if not exists wh_ga4_daily (
  tenant_id uuid not null,
  date date not null,
  channel text, source_medium text, country text, device text,
  sessions bigint, users bigint, new_users bigint,
  engaged_sessions bigint, conversions numeric, revenue numeric,
  primary key (tenant_id, date, channel, source_medium, country, device)
);
create index if not exists wh_ga4_daily_tenant_date on wh_ga4_daily (tenant_id, date);

-- KLAVIYO -------------------------------------------------------------------
create table if not exists wh_klaviyo_events (
  tenant_id uuid not null,
  event_id text not null,
  ts timestamptz not null,
  metric text,                     -- 'Opened Email' | 'Clicked Email' | 'Placed Order' ...
  profile_id text, flow_id text, campaign_id text, value numeric,
  primary key (tenant_id, event_id)
);
create index if not exists wh_klaviyo_events_tenant_ts on wh_klaviyo_events (tenant_id, ts, metric);

-- VISTE KPI (sostituiscono le fetch live nei report) ------------------------
-- Shopify per giorno (netto resi + NC/RC), fuso negozio Europe/Rome.
create or replace view wh_shopify_kpis as
select tenant_id,
       (date_trunc('day', created_at at time zone 'Europe/Rome'))::date as day,
       count(*)                                     as orders,
       sum(net_revenue)                             as net_revenue,
       sum(total_refunded)                          as refunds,
       count(*) filter (where is_new_customer)      as new_customers,
       count(*) filter (where not is_new_customer)  as returning_customers,
       case when count(*) > 0 then sum(net_revenue) / count(*) end as aov
from wh_orders
where not fully_refunded
group by 1, 2;

-- Meta/Google: spesa & ROAS per giorno (livello campagna).
create or replace view wh_ads_kpis as
select tenant_id, platform, date,
       sum(spend) as spend, sum(purchase_value) as revenue,
       case when sum(spend) > 0 then sum(purchase_value) / sum(spend) end as roas
from wh_ad_insights where level = 'campaign'
group by 1, 2, 3;

-- RLS: accesso solo service role (l'app legge i wh_* col client admin). --------
do $$
declare t text;
begin
  foreach t in array array['wh_sync_state','wh_orders','wh_order_lines','wh_customers',
                           'wh_refunds','wh_ad_insights','wh_ga4_daily','wh_klaviyo_events']
  loop
    execute format('alter table %I enable row level security', t);
  end loop;
end $$;
