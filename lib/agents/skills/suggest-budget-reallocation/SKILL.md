---
name: suggest-budget-reallocation
description: "When the user wants to reallocate budget between active Meta campaigns, decide what to scale and what to cut, optimize spend without changing total budget. Trigger phrases: 'come riallocare il budget', 'dove spostare la spesa', 'quali campagne scalare', 'quali campagne tagliare', 'budget shift', 'riallocazione budget', 'optimize budget'."
metadata:
  version: 1.0.0
  category: meta
  inputs:
    - preset: time range (default last_28d)
    - account_id (optional)
  outputs:
    - scale: [{ campaign, current_spend, suggested_spend, reason }]
    - reduce: [{ campaign, current_spend, suggested_spend, reason }]
    - cut: [{ campaign, current_spend, suggested_spend: 0, reason }]
    - delta_neutral: boolean (somma scaled = somma reduced + cut)
    - expected_roas_uplift: number
---

# Suggest Budget Reallocation

Sei un media buyer senior con focus su iterazione iso-budget. Il tuo obiettivo è migliorare la performance complessiva senza richiedere budget extra.

## Dati richiesti

Chiama `/api/budget-advisor?preset={preset}` per ottenere campagne attive con `{ campaign_name, spend, revenue, roas, purchases, cpa, status }`.

## Regole di riallocazione

### Scalare (+30% spend)
- ROAS attuale ≥ 150% della media account
- Spend trend stabile o crescente
- Campagna ACTIVE da almeno 14 giorni

### Ridurre (-50% spend)
- ROAS attuale tra 50% e 100% della media
- ROAS in calo nelle ultime 2 settimane
- Spend giornaliera ≥ €30 (sub-€30 ignora rumore statistico)

### Tagliare (spend → 0)
- ROAS attuale < 50% della media
- Almeno 14 giorni di data con ROAS < target
- Spend cumulativa ≥ €200 (statisticamente significativa)

## Vincoli iso-budget

La somma delle riduzioni (reduce + cut) DEVE essere ≥ alla somma degli incrementi (scale). Se non lo è, riduci proporzionalmente gli incrementi.

## Output JSON

```json
{
  "media_account_roas": 2.65,
  "scale": [
    {
      "campaign": "1.0_CBO_Testing_ITA",
      "current_spend": 3372,
      "suggested_spend": 4384,
      "delta_spend": 1012,
      "current_roas": 3.61,
      "reason": "ROAS 136% della media + spend stabile da 21gg"
    }
  ],
  "reduce": [
    {
      "campaign": "B2B_Typeform_ITA_CBO",
      "current_spend": 405,
      "suggested_spend": 200,
      "delta_spend": -205,
      "current_roas": 1.30,
      "reason": "ROAS 49% della media + trend negativo"
    }
  ],
  "cut": [
    {
      "campaign": "ITA-XYZ_OLD",
      "current_spend": 850,
      "suggested_spend": 0,
      "delta_spend": -850,
      "current_roas": 0.85,
      "reason": "ROAS 32% della media, 30gg consecutivi sotto target"
    }
  ],
  "delta_neutral": true,
  "net_change": 0,
  "expected_roas_uplift": 0.42,
  "tldr": "Riallocazione iso-budget. ROAS atteso +0.42x se 1.0_CBO scala e ITA-XYZ_OLD è tagliata."
}
```

## Vincoli

- Mai suggerire incrementi > 50% in single step (Meta learning phase risk).
- Mai tagliare una campagna che ha generato > 20% del revenue account.
- Tutti i numeri devono derivare dall'API.
