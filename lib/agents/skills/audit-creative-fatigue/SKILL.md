---
name: audit-creative-fatigue
description: "When the user wants to identify creative ads at risk of fatigue (high frequency, declining CTR, rising CPA), audit underperforming creative, decide which creative to refresh or kill. Trigger phrases: 'creative fatigue', 'creative stanche', 'creative da rinfrescare', 'frequency troppo alta', 'CTR in calo', 'audit creativi', 'quali creative sono morte', 'quali creative funzionano'."
metadata:
  version: 1.0.0
  category: meta
  inputs:
    - preset: time range (default last_28d)
    - account_id (optional)
  outputs:
    - fatigued: [{ ad_id, ad_name, frequency, ctr, cpa, score, reason }]
    - winners: [{ ad_id, ad_name, roas, spend, frequency }]
    - actions: [string]
---

# Audit Creative Fatigue

Sei un creative strategist. Identifica le creative Meta Ads che mostrano segnali di fatigue e quelle che invece sono "winner" da scalare.

## Dati richiesti

Chiama `/api/creative-fatigue?preset={preset}` per ottenere `ads[]` con `{ ad_id, name, frequency, ctr, cpa, score, spend, purchases, roas }`.

## Segnali di fatigue

Una creative è "fatigued" se rispetta almeno 2 di:
- **frequency ≥ 3.0** (utenti che vedono l'ad troppe volte)
- **CTR < 80% della media** del periodo
- **CPA > 130% della media** del periodo
- **score > 60** (calcolato lato API)

## Segnali winner

Una creative è "winner" se:
- ROAS ≥ 3.0 nel periodo
- Frequency ≤ 2.5 (ancora room)
- Spend ≥ €100 (statisticamente significativo)

## Output JSON

```json
{
  "fatigued": [
    {
      "ad_id": "120208...",
      "ad_name": "VID_Atleta_v3",
      "frequency": 4.2,
      "ctr": 0.94,
      "cpa": 38.20,
      "score": 72,
      "reason": "Frequency 4.2x + CTR -45% vs media + CPA +60% vs media"
    }
  ],
  "winners": [
    {
      "ad_id": "120209...",
      "ad_name": "IMG_Statica_Prodotto_Sconto",
      "roas": 4.85,
      "spend": 1240,
      "frequency": 2.1
    }
  ],
  "actions": [
    "Pause i 3 ad in 'fatigued' (cumulativo €850 wasted/mese a CPA corrente)",
    "Duplicate winner IMG_Statica_Prodotto_Sconto in nuova adset Lookalike 1-3%",
    "Brief nuova creative basata su angle vincente: 'sconto fisso + bundle'"
  ],
  "tldr": "3 creative da killare + 1 winner da scalare. Risparmio mensile stimato €850."
}
```

## Vincoli

- Mai inventare ad_id: usa solo quelli che arrivano dall'API.
- Numeri formattati: ROAS 2 decimali, CTR/CPA 2 decimali.
- Linguaggio italiano, action-oriented.
