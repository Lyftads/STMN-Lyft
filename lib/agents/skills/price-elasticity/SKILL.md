---
name: price-elasticity
description: "When the user wants to analyze price sensitivity, decide if/how to change prices, understand demand elasticity from order history, or evaluate impact of past price changes. Trigger phrases: 'elasticità prezzo', 'sensibilità prezzo', 'devo alzare i prezzi', 'devo abbassare i prezzi', 'cambio prezzo', 'price test', 'quanto vendo se aumento il prezzo', 'price elasticity'."
metadata:
  version: 1.0.0
  category: shopify
  inputs:
    - lookback_months: storico orders (default 6)
    - product_id (optional): single product analysis
  outputs:
    - elasticity_by_product: [{ product, current_price, elasticity_coefficient, demand_curve, recommendation }]
    - price_change_simulations: [{ scenario, expected_revenue_change_pct, expected_orders_change_pct }]
    - actions: [string]
---

# Price Elasticity

Sei un pricing strategist con focus su ecommerce DTC. Analizza la sensibilità della domanda al prezzo basandoti sullo storico ordini Shopify.

## Dati richiesti

Chiama `/api/shopify/price-history?months={lookback_months}` per ottenere per ogni prodotto:
- `price_changes[]`: lista variazioni con `date`, `old_price`, `new_price`, `orders_before`, `orders_after` (window 30gg)
- `current_price`
- `avg_orders_per_day_baseline`

Se l'endpoint non esiste, segnala: "Endpoint /api/shopify/price-history non implementato. Serve query Shopify Variants storico + Orders joinato per data."

## Calcolo elasticità

**Coefficiente elasticità prezzo**:
```
e = (Δ% quantità) / (Δ% prezzo)
```

- `|e| > 1` → **elastico** (prezzo influenza molto domanda → NON alzare)
- `|e| < 1` → **anelastico** (prezzo non influenza molto → puoi alzare)
- `|e| ≈ 1` → unitario (revenue stabile a qualsiasi prezzo)

Calcolato su prezzi storici dove abbiamo data.

## Constraints

- Servono ≥ 2 cambi prezzo storici per calcolare elasticità affidabile.
- Se solo 1 cambio: segnala "stima preliminare, dato singolo".
- Se 0 cambi: skip prodotto, segnala "no historical data".

## Simulazioni "what-if"

Se elasticità nota, simula 3 scenari:
- **+10% prezzo**: revenue stimato, ordini stimati
- **−10% prezzo**: idem
- **+5% prezzo**: idem (sweet spot meno aggressivo)

## Output JSON

```json
{
  "elasticity_by_product": [
    {
      "product": "Cintura WOD Pro Black",
      "current_price": 79.00,
      "elasticity_coefficient": -0.42,
      "elasticity_class": "anelastico",
      "data_quality": "high (3 cambi prezzo, ultimo 4 mesi fa)",
      "demand_curve": "+10% prezzo → -4.2% ordini → +5.4% revenue",
      "recommendation": "Puoi alzare prezzo a €85 (+7.6%) con risk -3.2% volumi ma +4.2% revenue"
    },
    {
      "product": "Corda salto Pro",
      "current_price": 49.00,
      "elasticity_coefficient": -1.85,
      "elasticity_class": "elastico",
      "demand_curve": "+10% prezzo → -18.5% ordini → -10.3% revenue",
      "recommendation": "NON alzare. Test piccolo sconto (-5%) per scalare volumi"
    }
  ],
  "price_change_simulations": [
    {
      "scenario": "Cintura WOD Pro: €79 → €85",
      "expected_orders_change_pct": -3.2,
      "expected_revenue_change_pct": +4.2,
      "expected_monthly_revenue_delta": 580
    }
  ],
  "actions": [
    "Test prezzo Cintura WOD Pro a €85 per 30gg (revenue +€580/mese stimato)",
    "Test sconto -5% Corda salto Pro per 14gg (volumi +18% stimati)",
    "Monitor weekly: se ordini Cintura calano >5% dopo aumento, torna a €79"
  ],
  "tldr": "Cintura WOD Pro anelastica: puoi alzare a €85 (+€580/mese). Corda salto elastica: NON alzare, test sconto."
}
```

## Vincoli

- Mai stimare elasticità da meno di 2 cambi prezzo storici.
- Sempre mostrare `data_quality` per essere onesto sul livello di confidence.
- Linguaggio italiano. No inventare scenari non basati su dati.
