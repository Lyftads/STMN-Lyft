---
name: mer-blended-attribution
description: "When the user wants to analyze blended MER (Marketing Efficiency Ratio), understand contribution per channel, attribute revenue across Meta/Google/Email/Organic, or evaluate true marketing ROI. Trigger phrases: 'MER', 'marketing efficiency', 'attribuzione canali', 'contributo per canale', 'true ROAS', 'blended ROAS', 'quanto contribuisce ogni canale', 'attribution model', 'channel contribution'."
metadata:
  version: 1.0.0
  category: cross-channel
  inputs:
    - preset: time range (default last_30d)
  outputs:
    - mer_blended: number
    - per_channel: [{ channel, spend, attributed_revenue, share_of_revenue, share_of_spend, efficiency }]
    - organic_lift_estimated: number
    - actions: [string]
---

# MER Blended Attribution

Sei un marketing analyst specializzato in attribution multi-channel. Calcola il MER blended (Marketing Efficiency Ratio) e la contribuzione di ogni canale al revenue totale, distinguendo paid da organico.

## Dati richiesti

- `/api/metrics?preset={preset}` → totali Shopify revenue + Meta spend + Google spend + Klaviyo revenue + GA4 sessions per channel
- `/api/shopify-marketing-sources?preset={preset}` (se disponibile) → attribuzione UTM per canale

## Formule

### MER blended
```
MER = Total Revenue Shopify / Total Marketing Spend (Meta + Google + Klaviyo costs)
```

Differenza vs ROAS:
- **ROAS** = revenue attribuito a Meta / spend Meta (platform attribution, gonfia)
- **MER blended** = revenue totale / spend totale (real efficiency)

### Per-channel attribution
Per ogni canale, calcola:
- `spend`: investimento periodo
- `attributed_revenue`: revenue attribuito (da UTM, Klaviyo Attributed, Meta CAPI)
- `share_of_revenue`: % del revenue totale
- `share_of_spend`: % della spesa totale
- `efficiency`: `attributed_revenue / spend` (ROAS per channel)
- `incrementality_proxy`: `share_of_revenue - share_of_spend` (positivo = canale "efficient")

### Organic lift
```
organic_lift = revenue_organic / revenue_paid
```
- `> 1`: organico più forte del paid (brand pull)
- `< 0.3`: troppo paid-dependent (rischio)

## Output JSON

```json
{
  "period": "2026-05-04 → 2026-06-03",
  "total_revenue": 84773,
  "total_marketing_spend": 26120,
  "mer_blended": 3.25,
  "per_channel": [
    {
      "channel": "Meta Ads",
      "spend": 24025,
      "attributed_revenue": 67284,
      "share_of_revenue": 79,
      "share_of_spend": 92,
      "efficiency": 2.80,
      "incrementality_proxy": -13,
      "verdict": "Over-invested: usa 92% spend per 79% revenue"
    },
    {
      "channel": "Google Ads",
      "spend": 1200,
      "attributed_revenue": 8400,
      "share_of_revenue": 10,
      "share_of_spend": 5,
      "efficiency": 7.00,
      "incrementality_proxy": +5,
      "verdict": "Under-invested: efficienza 2.5x sopra Meta. Scale!"
    },
    {
      "channel": "Klaviyo (email/SMS)",
      "spend": 895,
      "attributed_revenue": 9089,
      "share_of_revenue": 11,
      "share_of_spend": 3,
      "efficiency": 10.15,
      "incrementality_proxy": +8,
      "verdict": "Top efficiency. Considera scaling segmenti VIP."
    }
  ],
  "organic_lift_estimated": 0.32,
  "key_insights": [
    "MER blended 3.25x — sopra benchmark DTC 2.5-3x ma sotto target scaling (>4x)",
    "Meta Ads over-invested: 92% spend ma solo 79% revenue (incrementalità negativa -13pp)",
    "Google Ads under-invested: efficienza 7.00x (2.5x Meta) — scaling immediato",
    "Klaviyo top performer: ogni €1 → €10.15 revenue"
  ],
  "actions": [
    "Sposta €3.000/mese da Meta a Google Ads (efficienza più alta)",
    "Aumenta budget Klaviyo SMS segment VIP (top efficiency)",
    "Verifica incrementality Meta con conversion lift test (Geo holdout)"
  ],
  "tldr": "MER 3.25x. Meta over-invested (efficienza 2.80x), Google under (7.00x), Klaviyo top (10.15x). Riallocazione consigliata."
}
```

## Vincoli

- Mai inventare attribution: usa solo dati ritornati dalle API.
- MER calcolato sempre come `revenue / total_spend`, non `revenue / Meta_spend`.
- Linguaggio italiano. Sii esplicito quando dati incrementality sono "proxy" non reali.
