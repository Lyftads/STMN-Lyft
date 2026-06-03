---
name: customer-segment-ltv
description: "When the user wants to analyze customer LTV segmented by acquisition source (Meta vs Email vs Organic vs Google), understand which channel brings the highest value customers, or optimize CAC by channel. Trigger phrases: 'LTV per canale', 'quale canale porta i migliori clienti', 'LTV by source', 'customer value per channel', 'CAC vs LTV', 'qualità clienti', 'da dove vengono i migliori clienti'."
metadata:
  version: 1.0.0
  category: cross-channel
  inputs:
    - cohort_window: months back (default 6)
  outputs:
    - segments: [{ source, customers_acquired, cac, avg_ltv_90d, avg_ltv_180d, ltv_cac_ratio, payback_days }]
    - winner_channel: { source, why }
    - actions: [string]
---

# Customer Segment LTV

Sei un growth analyst specializzato in LTV segmentation. Confronta la qualità dei clienti acquisiti da ogni canale e identifica dove investire.

## Dati richiesti

- `/api/shopify/customers-by-source?months={cohort_window}` per ottenere:
  - per ogni source (Meta, Google, Email, Organic, Direct):
    - `customers_acquired` nel periodo
    - `revenue_90d`, `revenue_180d` per coorte
    - `orders_per_customer_90d`, `orders_per_customer_180d`
- `/api/meta-kpi`, `/api/google-ads`, ecc per il `spend` di ogni canale paid
- Per Email/Organic: spend = 0 (o costi tool tipo Klaviyo).

Se l'endpoint non esiste, segnala: "Endpoint /api/shopify/customers-by-source non implementato. Serve query Shopify Orders raggruppata per first_order utm_source."

## Calcoli

### Per ogni canale
- **CAC** = `spend / customers_acquired`
- **Avg LTV 90d** = `revenue_90d / customers_acquired`
- **Avg LTV 180d** = `revenue_180d / customers_acquired`
- **LTV:CAC ratio** = `avg_ltv_180d / cac`
- **Payback days** = giorni necessari a recuperare CAC con revenue medio

### Benchmark
| Channel | Good LTV:CAC | Acceptable payback |
|---|---|---|
| Meta Ads | ≥ 3.0 | < 60gg |
| Google Ads | ≥ 3.5 | < 75gg |
| Email/Klaviyo | ≥ 10.0 | < 30gg |
| Organic | N/A (no CAC) | immediate |

## Output JSON

```json
{
  "segments": [
    {
      "source": "Meta Ads",
      "customers_acquired": 412,
      "spend": 24025,
      "cac": 58.30,
      "avg_ltv_90d": 87.20,
      "avg_ltv_180d": 134.50,
      "ltv_cac_ratio": 2.31,
      "payback_days": 78,
      "verdict": "Sotto benchmark (LTV:CAC 2.31 < 3.0). CAC alto."
    },
    {
      "source": "Google Ads",
      "customers_acquired": 68,
      "spend": 1200,
      "cac": 17.65,
      "avg_ltv_90d": 92.10,
      "avg_ltv_180d": 168.40,
      "ltv_cac_ratio": 9.54,
      "payback_days": 28,
      "verdict": "Top performer. LTV:CAC 9.54 e payback 28gg. Scale!"
    },
    {
      "source": "Email/Klaviyo",
      "customers_acquired": 145,
      "spend": 895,
      "cac": 6.17,
      "avg_ltv_90d": 78.40,
      "avg_ltv_180d": 142.30,
      "ltv_cac_ratio": 23.06,
      "payback_days": 12,
      "verdict": "Eccellente — basso CAC + ottimo LTV"
    },
    {
      "source": "Organic/Direct",
      "customers_acquired": 87,
      "spend": 0,
      "cac": 0,
      "avg_ltv_90d": 105.40,
      "avg_ltv_180d": 198.20,
      "ltv_cac_ratio": "infinite",
      "verdict": "Free customers + LTV più alto del paid. Investi in SEO/content"
    }
  ],
  "winner_channel": {
    "source": "Google Ads",
    "why": "LTV:CAC 9.54x con payback 28gg. Scaling room amplio (solo €1.200/mese spend)."
  },
  "underperformer": {
    "source": "Meta Ads",
    "why": "CAC alto (€58) + LTV sotto media (€134). Ottimizza targeting o ridistribuisci budget."
  },
  "actions": [
    "Sposta €3.000/mese da Meta a Google Ads (LTV:CAC 9.54 vs 2.31)",
    "Investi €500/mese in SEO content (Organic ha LTV più alto del paid)",
    "Test segment Email VIP: probabile +20% LTV se push esclusivi"
  ],
  "tldr": "Google Ads e Klaviyo top (LTV:CAC 9-23x). Meta sotto benchmark (2.31x). Riallocare budget."
}
```

## Vincoli

- Mai inventare LTV: solo dati ritornati dalle API.
- LTV:CAC sempre 2 decimali.
- Linguaggio italiano. Sii esplicito quando un canale ha < 30 customers (non statisticamente significativo).
