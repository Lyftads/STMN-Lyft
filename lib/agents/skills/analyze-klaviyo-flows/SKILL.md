---
name: analyze-klaviyo-flows
description: "When the user wants to analyze Klaviyo email/SMS flows performance, identify underperforming flows, suggest flow optimizations. Trigger phrases: 'flussi Klaviyo', 'welcome series', 'abandoned cart', 'browse abandonment', 'flow performance', 'email automation', 'come va Klaviyo', 'flussi che convertono'."
metadata:
  version: 1.0.0
  category: klaviyo
  inputs:
    - preset: time range (default last_30d)
  outputs:
    - top_flows: [{ name, revenue, open_rate, click_rate, conversion_rate }]
    - weak_flows: [{ name, issue, suggested_action }]
    - flow_revenue_share: percentage
    - actions: [string]
---

# Analyze Klaviyo Flows

Sei un email marketing specialist con expertise su Klaviyo. Analizza performance dei flussi email/SMS e identifica opportunità di ottimizzazione.

## Dati richiesti

Chiama `/api/klaviyo/flows?preset={preset}` per ottenere `flows[]` con `{ id, name, type, recipients, opens, clicks, revenue, conversions, open_rate, click_rate, conversion_rate }`.

## Benchmark ecommerce DTC

| Flow type | Open rate good | Click rate good | Conv rate good |
|---|---|---|---|
| Welcome | ≥ 45% | ≥ 8% | ≥ 4% |
| Abandoned Cart | ≥ 40% | ≥ 6% | ≥ 8% |
| Browse Abandonment | ≥ 35% | ≥ 4% | ≥ 2% |
| Post-Purchase | ≥ 50% | ≥ 5% | ≥ 3% |
| Win-Back | ≥ 25% | ≥ 3% | ≥ 1.5% |

## Output JSON

```json
{
  "total_flow_revenue": 28500,
  "flow_revenue_share_of_email_total": 62,
  "top_flows": [
    { "name": "Abandoned Cart", "revenue": 14200, "open_rate": 0.48, "click_rate": 0.09, "conversion_rate": 0.12, "verdict": "Top performer" },
    { "name": "Welcome Series", "revenue": 8900, "open_rate": 0.52, "click_rate": 0.11, "conversion_rate": 0.05, "verdict": "Healthy" }
  ],
  "weak_flows": [
    {
      "name": "Browse Abandonment",
      "issue": "Click rate 2.1% (benchmark 4%) + conv rate 0.8%",
      "suggested_action": "Test subject line con prodotto specifico + ridurre delay invio da 4h a 1h"
    }
  ],
  "actions": [
    "A/B test Browse Abandonment subject line (prodotto vs benefit)",
    "Aggiungi Post-Purchase Cross-sell se manca (potenziale +€2-4K/mese)",
    "Segmenta Welcome Series per source (paid vs organic)"
  ],
  "tldr": "Flussi generano 62% del revenue email. Browse Abandonment underperform: -€1.500/mese potenziale."
}
```

## Vincoli

- Mai inventare nomi flussi: usa solo quelli dall'API.
- Confronta sempre con benchmark sopra (espliciti, non ipotetici).
- Azioni concrete: dare numeri (es. "ridurre delay da 4h a 1h"), non vaghe ("ottimizzare flow").
