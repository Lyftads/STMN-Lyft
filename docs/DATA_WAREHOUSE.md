# Data Warehouse — valutazione & design (Nango → warehouse)

> Stato: **valutazione / non ancora implementato.** Documento decisionale.
> Layer di auth attuale = **Nango + flussi nativi** (resta invariato). Il warehouse
> è un layer **in aggiunta** per la lettura veloce/stabile, NON un rimpiazzo.

## 1. Perché (i dolori che risolve)
- Lag ShopifyQL su giorni recenti → leggi dal warehouse, dato consistente.
- Meta rate limit (error 17) sui drill → niente più chiamate live ripetute.
- PDF/report in 504 perché interrogano API live → query su warehouse in ms.
- Base per analisi cross-cliente / benchmark / ML.

⚠️ Il real-time (globo visitatori, "vendite ora") **resta API live**: il warehouse è
fresco quanto l'ultimo sync (1–15 min). Fivetran/Airbyte NON rendono il dato più
preciso *della fonte*: leggono dalle stesse API; danno **consistenza**, non un dato diverso.

⚠️ Le app OAuth Meta/Google/GA4/Shopify e le relative **approvazioni restano necessarie**
in ogni caso (l'app è "LyftAI", il gate lo impongono le piattaforme). Né Nango né
Fivetran le tolgono. Vedi [META_APP_REVIEW.md](META_APP_REVIEW.md).

## 2. Architettura a 4 layer
```
LAYER 1 · CONNECT   Nango + nativi (Google/GA4) → cliente autorizza "LyftAI"
        │ token per-tenant
LAYER 2 · INGEST    A) Fivetran (gestito $$$)  B) Airbyte self-host (flat)  C) sync custom via Nango
        │ righe grezze
LAYER 3 · STORE     Inizio: Supabase Postgres / ClickHouse → a volume: BigQuery/Snowflake
        │           + trasformazioni (netto resi, NC/RC, ROAS)
LAYER 4 · SERVE     Dashboard/Report/PDF/Agenti leggono dal warehouse
                    Real-time → resta API live
```

## 3. Stima volumi (tenant tipo STMN) e costi
MAR = Monthly Active Rows (righe modificate/mese). Stima per store attivo:

| Fonte | MAR/mese |
|---|---|
| Shopify (ordini, righe, clienti, resi) | ~30k |
| Meta Ads (insights con breakdown) | ~100k |
| Google Ads | ~30k |
| GA4 | ~30k |
| Klaviyo (eventi) | ~100k |
| **Totale ≈** | **~290k MAR/tenant** |

Fivetran ~$0.50 / 1.000 MAR a basso volume (in calo con sconti). Mangia-MAR = Meta + Klaviyo.

| Tenant | Fivetran + BigQuery | Airbyte self-host + wh | Custom/Nango + Supabase |
|---|---|---|---|
| 5  | ~$700–850   | ~$200–400 | ~$0–100 (solo eng) |
| 20 | ~$2.200–3.200 | ~$300–600 | ~$100–200 |
| 50 | ~$4.500–6.500 | ~$500–1.000 | ~$200–400 |

**Fivetran costa 5–10× Airbyte/custom a regime.** Per un SaaS che rivende analisi,
il modello MAR erode il margine. Validare i MAR veri col **free tier Fivetran (500k MAR)**
su STMN per un mese prima di decidere.

### Pricing di riferimento (giu 2026, indicativo)
- **Fivetran**: a MAR. Free 500k. Es. reali: Facebook Ads 34k MAR=$17, GA4 22k MAR=$11. −22% su contratto annuale.
- **Nango**: per-connessione. Free 10 conn., Starter da $50/mo (20 conn., poi $1/conn), Growth da $500/mo (100 conn.).
- **Airbyte**: open-source = software gratis, paghi solo infra (VM ~$100–300/mo flat entro capacità).

## 4. Trigger: quando aggiungere il warehouse
**Ora / pochi tenant → NON conviene** (API live + snapshot bastano). Aggiungilo quando scatta ≥1:
1. Rate limit / lag ricorrenti visibili lato cliente.
2. PDF/report in 504 per API live.
3. Serve analisi cross-cliente / benchmark / ML.
4. >10–20 tenant paganti (rifetch live = spreco).

## 5. Raccomandazione
- **Nango** resta sempre (Layer 1).
- Allo scattare di un trigger, parti **leggero**: **sync custom via Nango → Supabase/ClickHouse**
  (costo ~zero, riusi il pattern Shopify Admin GraphQL già in uso).
- **Fivetran** solo se manca banda eng e il budget regge il 5–10× (compri zero-ops, non dato migliore).
- **Airbyte self-host** = via di mezzo (connettori pronti senza costi MAR).

## 6. Schema warehouse — via "custom → Supabase" (design)
Multi-tenant: ogni tabella ha `workspace_id`. Sync incrementale via cursori in `wh_sync_state`.
Timezone: normalizzare a Europe/Rome come già fatto in `lib/agent/shopifyWeeks.js`.

```sql
-- Stato sync incrementale (cursori per fonte/tenant)
create table if not exists wh_sync_state (
  workspace_id uuid not null,
  source text not null,            -- 'shopify' | 'meta' | 'google_ads' | 'ga4' | 'klaviyo'
  cursor text,                     -- since_id / updated_at / date watermark
  last_synced_at timestamptz,
  primary key (workspace_id, source)
);

-- SHOPIFY ------------------------------------------------------------------
create table if not exists wh_orders (
  workspace_id uuid not null,
  order_id bigint not null,
  created_at timestamptz not null,
  processed_at timestamptz,
  currency text,
  total_price numeric,             -- currentTotalPrice
  total_refunded numeric default 0,
  net_revenue numeric generated always as (greatest(total_price - total_refunded, 0)) stored,
  financial_status text,
  fully_refunded boolean default false,
  customer_id bigint,
  customer_orders_count int,       -- per NC/RC (numberOfOrders al momento dell'ordine)
  is_new_customer boolean,         -- customer_orders_count = 1
  updated_at timestamptz default now(),
  primary key (workspace_id, order_id)
);
create index on wh_orders (workspace_id, created_at);

create table if not exists wh_order_lines (
  workspace_id uuid not null,
  order_id bigint not null,
  line_id bigint not null,
  product_id bigint, variant_id bigint, sku text, title text,
  quantity int, price numeric, total_discount numeric,
  primary key (workspace_id, line_id)
);
create index on wh_order_lines (workspace_id, product_id);

create table if not exists wh_customers (
  workspace_id uuid not null,
  customer_id bigint not null,
  email text, created_at timestamptz, orders_count int, total_spent numeric,
  primary key (workspace_id, customer_id)
);

create table if not exists wh_refunds (
  workspace_id uuid not null,
  refund_id bigint not null,
  order_id bigint, created_at timestamptz, amount numeric,
  primary key (workspace_id, refund_id)
);

-- META / GOOGLE ADS (stessa forma) ----------------------------------------
create table if not exists wh_ad_insights (
  workspace_id uuid not null,
  platform text not null,          -- 'meta' | 'google_ads'
  date date not null,
  level text not null,             -- 'campaign' | 'adset' | 'ad'
  object_id text not null,
  name text,
  spend numeric, impressions bigint, clicks bigint,
  purchases numeric, purchase_value numeric,
  roas numeric generated always as (case when spend > 0 then purchase_value/spend end) stored,
  ctr numeric, cpc numeric, cpm numeric, frequency numeric,
  primary key (workspace_id, platform, level, object_id, date)
);
create index on wh_ad_insights (workspace_id, platform, date);

-- GA4 ----------------------------------------------------------------------
create table if not exists wh_ga4_daily (
  workspace_id uuid not null,
  date date not null,
  channel text, source_medium text, country text, device text,
  sessions bigint, users bigint, new_users bigint,
  engaged_sessions bigint, conversions numeric, revenue numeric,
  primary key (workspace_id, date, channel, source_medium, country, device)
);
create index on wh_ga4_daily (workspace_id, date);

-- KLAVIYO ------------------------------------------------------------------
create table if not exists wh_klaviyo_events (
  workspace_id uuid not null,
  event_id text not null,
  ts timestamptz not null,
  metric text,                     -- 'Opened Email' | 'Clicked Email' | 'Placed Order' ...
  profile_id text, flow_id text, campaign_id text, value numeric,
  primary key (workspace_id, event_id)
);
create index on wh_klaviyo_events (workspace_id, ts, metric);
```

### Trasformazioni / viste (sostituiscono le fetch live nei report)
```sql
-- KPI Shopify per periodo (netto resi + NC/RC), già allineati alla logica attuale
create or replace view wh_shopify_kpis as
select workspace_id,
       date_trunc('day', created_at at time zone 'Europe/Rome')::date as day,
       count(*)                                  as orders,
       sum(net_revenue)                          as net_revenue,
       sum(total_refunded)                       as refunds,
       count(*) filter (where is_new_customer)   as new_customers,
       count(*) filter (where not is_new_customer) as returning_customers,
       case when count(*)>0 then sum(net_revenue)/count(*) end as aov
from wh_orders
where not fully_refunded
group by 1, 2;

-- Meta/Google: spesa & ROAS per periodo
create or replace view wh_ads_kpis as
select workspace_id, platform, date,
       sum(spend) as spend, sum(purchase_value) as revenue,
       case when sum(spend)>0 then sum(purchase_value)/sum(spend) end as roas
from wh_ad_insights where level = 'campaign'
group by 1,2,3;
```

### Integrazione lato app
- Sostituire le sorgenti in `lib/agent/brandSnapshot.js` / `lib/agent/shopifyWeeks.js`
  con query alle viste `wh_*` quando il warehouse è attivo (feature-flag per tenant).
- Tenere il path API live per il real-time e come fallback se il sync è in ritardo.
- Sync job (cron) per tenant: legge `wh_sync_state.cursor`, fetcha incrementale via Nango,
  upsert in `wh_*`, aggiorna il cursore.

## 7. Prossimi passi
1. [ ] Validare MAR reali con free tier Fivetran su STMN (1 mese).
2. [x] **`supabase/warehouse.sql`** creato (tabelle `wh_*` + viste KPI + RLS). Da **eseguire su Supabase** quando si attiva il warehouse.
3. [x] **Primo sync Shopify incrementale**: `lib/warehouse/syncShopify.js` + route `app/api/warehouse/sync/route.js` (watermark su `updated_at`, upsert idempotente). INERTE finché `LYFT_WAREHOUSE !== 'true'`.
4. [ ] Sync per le altre fonti (Meta, Google Ads, GA4, Klaviyo) sullo stesso pattern.
5. [ ] Feature-flag `LYFT_WAREHOUSE` per tenant; `brandSnapshot` legge dalle viste `wh_*` se attivo (tenere API live come fallback/real-time).

### Come attivarlo (quando si decide)
1. Eseguire `supabase/warehouse.sql` sul DB Supabase.
2. Settare env `LYFT_WAREHOUSE=true`.
3. Triggerare il sync (cron o manuale):
   `curl -X POST https://lyftai.io/api/warehouse/sync -H "x-internal-cron: $CRON_SECRET"`
   → fa il backfill 90gg al primo run, poi solo gli ordini modificati (watermark).
4. Verificare `select * from wh_shopify_kpis order by day desc limit 7;` e confrontare con le tab.
