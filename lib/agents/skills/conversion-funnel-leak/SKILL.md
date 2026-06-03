---
name: conversion-funnel-leak
description: "When the user wants to identify where users drop off in the Shopify checkout funnel, find the weakest step, or improve conversion rate. Trigger phrases: 'funnel leak', 'dove perdo utenti', 'drop off checkout', 'conversion rate basso', 'tasso conversione', 'step più debole', 'abbandono carrello', 'pagamento non completato', 'conversion funnel analysis'."
metadata:
  version: 1.0.0
  category: shopify
  inputs:
    - preset: time range (default last_30d)
  outputs:
    - funnel_steps: [{ step, sessions, conversion_rate, drop_off_pct }]
    - weakest_step: { step, drop_off_pct, benchmark_drop }
    - estimated_lost_revenue: number
    - actions: [string]
---

# Conversion Funnel Leak

Sei un CRO analyst con focus su ecommerce Shopify. Identifica dove gli utenti abbandonano il funnel e quanto revenue stai lasciando sul tavolo.

## Dati richiesti

Chiama `/api/shopify-funnel?preset={preset}` (o `/api/cro/funnel`) per ottenere:
- `sessions` (totale traffico)
- `product_views`
- `add_to_cart`
- `checkout_started`
- `payment_started`
- `purchases`
- `revenue`

Se l'endpoint non esiste, segnala: "Endpoint funnel non disponibile, serve implementare /api/shopify-funnel".

## Funnel standard DTC

```
Session → Product View → ATC → Checkout → Payment → Purchase
```

## Benchmark drop-off DTC

| Step | Acceptable drop | Bad drop |
|---|---|---|
| Session → PV | <40% | >55% |
| PV → ATC | <85% | >92% |
| ATC → Checkout | <55% | >70% |
| Checkout → Payment | <35% | >50% |
| Payment → Purchase | <15% | >25% |

## Calcolo lost revenue

Per ogni step weakest:
```
lost_users = current_drop_users - benchmark_drop_users
lost_revenue = lost_users * conversion_rate_downstream * AOV
```

## Output JSON

```json
{
  "funnel_steps": [
    { "step": "Session → PV", "sessions": 24500, "conv": 0.61, "drop_off_pct": 39 },
    { "step": "PV → ATC", "sessions": 14945, "conv": 0.11, "drop_off_pct": 89 },
    { "step": "ATC → Checkout", "sessions": 1644, "conv": 0.42, "drop_off_pct": 58 },
    { "step": "Checkout → Payment", "sessions": 690, "conv": 0.59, "drop_off_pct": 41, "issue": "DROP OFF SOPRA BENCHMARK" },
    { "step": "Payment → Purchase", "sessions": 407, "conv": 0.91, "drop_off_pct": 9 }
  ],
  "weakest_step": {
    "step": "Checkout → Payment",
    "drop_off_pct": 41,
    "benchmark_drop": 35,
    "deviation_pp": 6
  },
  "estimated_lost_revenue": 4250,
  "hypothesis": [
    "Costi spedizione mostrati solo allo step Payment (sorpresa negativa)",
    "Pochi payment methods (manca Klarna/Apple Pay)",
    "Trust badges mancanti sopra il form Payment"
  ],
  "actions": [
    "Test mostrare spedizione gratuita threshold nel Checkout step (sopra €X)",
    "Aggiungi Apple Pay e Google Pay (Shopify Payments → Manage)",
    "Aggiungi trust badges (visa, mastercard, paypal, ssl) sopra form Payment"
  ],
  "tldr": "Funnel weak su Checkout→Payment (drop 41% vs benchmark 35%). Lost revenue stimato €4.250/mese. 3 fix prioritari."
}
```

## Vincoli

- Mai inventare numeri funnel: se mancano alcuni step, ometti quel pezzo invece di stimare.
- Benchmark drop sopra hardcoded — non usarne altri.
- Linguaggio italiano. Actionable.
