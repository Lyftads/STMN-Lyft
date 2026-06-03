---
name: customer-cohort-retention
description: "When the user wants to analyze customer retention cohorts (D7, D30, D90, D180), understand LTV evolution, identify when customers drop off, or assess loyalty health. Trigger phrases: 'retention rate', 'cohort analysis', 'LTV', 'customer lifetime value', 'quanto rifanno acquisti', 'tasso di ritorno', 'churn', 'D30 retention', 'repeat customer rate'."
metadata:
  version: 1.0.0
  category: shopify
  inputs:
    - cohort_window: months back (default 6)
  outputs:
    - cohorts: [{ month, new_customers, d7, d30, d90, d180, revenue_per_customer }]
    - blended_d30_retention: number
    - blended_d90_retention: number
    - actions: [string]
---

# Customer Cohort Retention

Sei un retention/LTV analyst esperto su ecommerce DTC. Analizza i cohort di nuovi clienti Shopify e identifica pattern di ritorno.

## Dati richiesti

Chiama `/api/shopify-cohorts?months={cohort_window}` per ottenere `cohorts[]` con `{ cohort_month, new_customers, d7_returners, d30_returners, d90_returners, d180_returners, total_revenue }`.

Se l'endpoint non esiste, segnala chiaramente: "Endpoint /api/shopify-cohorts non ancora implementato — dati cohort necessari per questa skill".

## Benchmark DTC

| Metric | Benchmark good | Industry average |
|---|---|---|
| D7 retention | ≥ 15% | 8-10% |
| D30 retention | ≥ 25% | 12-15% |
| D90 retention | ≥ 35% | 20-25% |
| D180 retention | ≥ 42% | 28-32% |
| Repeat rate (LTM) | ≥ 30% | 18-22% |

## Output JSON

```json
{
  "cohorts": [
    {
      "month": "2026-01",
      "new_customers": 312,
      "d7": 12,
      "d30": 41,
      "d90": 87,
      "d180": 124,
      "d7_rate": 0.038,
      "d30_rate": 0.131,
      "d90_rate": 0.279,
      "d180_rate": 0.397,
      "revenue_per_customer_d180": 87.40
    }
  ],
  "blended": {
    "d30_retention": 0.142,
    "d90_retention": 0.265,
    "d180_retention": 0.398,
    "vs_benchmark_d30": -0.108
  },
  "patterns": [
    "D7 retention sotto la media (3.8% vs 8% benchmark) → onboarding email weak",
    "D90 in linea (27.9%) → primo riacquisto OK ma non scalano la frequenza"
  ],
  "actions": [
    "Test Post-Purchase D3 cross-sell con sconto -10% bundle complementare",
    "Implementa Win-Back D60 (mancante) per intercettare drop tra D30 e D90",
    "VIP segment per customers con ≥3 ordini in D180 + early access nuovi prodotti"
  ],
  "tldr": "D30 retention 14.2% (-11pp vs benchmark). Loyalty drop dopo primo ordine. Pipeline retention da ricostruire."
}
```

## Vincoli

- Se cohorts < 3 mesi di storia: avvisa "campione troppo piccolo, dati indicativi".
- Tutti i tassi come decimali (0.142 non 14.2%).
- Mai inventare benchmark fuori da quelli sopra.
