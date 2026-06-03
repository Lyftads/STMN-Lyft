---
name: first-purchase-affinity
description: "When the user wants to identify gateway products (first-purchase products that lead to repeat customers), analyze product affinity for retention, or decide which products to push for acquisition. Trigger phrases: 'prodotti gateway', 'primo acquisto', 'product affinity', 'quale prodotto vendere per primo', 'prodotti che generano repeat', 'prodotti acquisition', 'first purchase products', 'cosa spingere in pubblicità'."
metadata:
  version: 1.0.0
  category: shopify
  inputs:
    - cohort_window: months back (default 6)
  outputs:
    - gateway_products: [{ product, first_purchase_count, repeat_rate, avg_ltv, recommendation }]
    - dead_end_products: [{ product, first_purchase_count, repeat_rate, why_avoid }]
    - actions: [string]
---

# First Purchase Affinity

Sei un retention/product analyst. Identifica quali prodotti, quando comprati come primo acquisto, generano i clienti più fedeli (alto repeat rate + LTV).

## Dati richiesti

Chiama `/api/shopify/first-purchase-cohorts?months={cohort_window}` per ottenere:
- per ogni `product_id`/`title`: `first_purchase_count`, `repeated_within_90d`, `repeated_within_180d`, `avg_ltv_180d`, `total_revenue`

Se l'endpoint non esiste, segnala: "Endpoint /api/shopify/first-purchase-cohorts non implementato. Serve query Shopify Orders raggruppata per customer first order product."

## Classificazione prodotti

### Gateway products (push in advertising)
- Repeat rate 90d ≥ 25%
- Avg LTV 180d ≥ €100
- First purchase volume ≥ 30 ordini (statisticamente significativo)

### Dead-end products (evita come acquisition)
- Repeat rate 90d < 10%
- Avg LTV 180d < AOV stesso prodotto (= customer compra una volta e mai più)
- First purchase volume ≥ 30 ordini

### Volume bassi
Se < 30 ordini: skip e segnala "campione troppo piccolo".

## Output JSON

```json
{
  "gateway_products": [
    {
      "product": "Cintura WOD Pro Black",
      "product_id": "gid://shopify/Product/123",
      "first_purchase_count": 142,
      "repeat_rate_90d": 0.34,
      "repeat_rate_180d": 0.48,
      "avg_ltv_180d": 184.50,
      "recommendation": "Push aggressivamente in Acquisition Meta (gateway #1)",
      "next_purchase_top": ["Corda salto Pro", "Magnesio liquido 250ml"]
    },
    {
      "product": "Pack Allenamento Starter",
      "first_purchase_count": 89,
      "repeat_rate_90d": 0.28,
      "avg_ltv_180d": 156.20,
      "recommendation": "Push come gateway secondario + bundle in checkout"
    }
  ],
  "dead_end_products": [
    {
      "product": "Maglietta Logo Standard",
      "first_purchase_count": 71,
      "repeat_rate_90d": 0.07,
      "avg_ltv_180d": 28.40,
      "why_avoid": "Repeat 7% (sotto media account 22%) + LTV € = AOV → no scaling"
    }
  ],
  "implications": [
    "Cintura WOD Pro è gateway #1: sposta budget creative su quel prodotto",
    "Maglietta Logo NON è acquisition product: usala solo cross-sell post-purchase",
    "Pack Starter bundle: prova promo 'free shipping' per push primo acquisto"
  ],
  "actions": [
    "Brief 3 creative Meta dedicate a Cintura WOD Pro per Acquisition campaign",
    "Move Maglietta Logo da campagne Acquisition a Klaviyo Post-Purchase Cross-Sell",
    "Test bundle Pack Starter + Free Shipping > €50 per ridurre attrito primo acquisto"
  ],
  "tldr": "Cintura WOD Pro è gateway #1 (repeat 34%, LTV €184). Maglietta Logo è dead-end. Riallocare creative budget."
}
```

## Vincoli

- Mai inventare prodotti: usa solo quelli ritornati dall'API.
- Repeat rate sempre come decimale (0.34 = 34%).
- Linguaggio italiano, action-oriented.
