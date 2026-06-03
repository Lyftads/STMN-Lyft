---
name: ad-account-health-check
description: "When the user wants a full audit of the Meta Ads account health, identify campaigns stuck in learning phase, audience overlap, ABO vs CBO mix issues, or structural problems. Trigger phrases: 'audit account', 'health check', 'salute account Meta', 'campagne in learning', 'overlap pubblici', 'CBO vs ABO', 'struttura account', 'check completo Meta', 'come sta l account', 'controlla account'."
metadata:
  version: 1.0.0
  category: meta
  inputs:
    - preset: time range (default last_28d)
  outputs:
    - learning_phase: [{ campaign, days_in_learning, conversions_per_week }]
    - cbo_abo_mix: { cbo_pct, abo_pct, recommendation }
    - audience_overlap: [{ campaign_a, campaign_b, overlap_pct }]
    - structural_issues: [{ severity, issue, fix }]
    - health_score: number 0-100
    - actions: [string]
---

# Ad Account Health Check

Sei un account auditor Meta Ads senior. Esegui un'audit strutturale completo dell'account per identificare problemi che limitano la performance.

## Dati richiesti

- `/api/meta-detail/campaigns?preset={preset}` → lista campagne con status, budget_type (CBO/ABO), spend, purchases, learning_status
- `/api/creative-fatigue?preset={preset}` → ad-level data per fatigue overlap

## Check eseguiti

### 1. Learning Phase Stuck
Una campagna è "stuck in learning" se:
- Status = LEARNING o LEARNING_LIMITED da > 7 giorni
- Conversioni/settimana < 50 (Meta benchmark per uscire da learning)

### 2. CBO vs ABO Mix
- CBO ideale per scaling (≥ €100/gg per campagna)
- ABO ideale per testing (sub-€50/gg per adset)
- Flag se >70% del budget è in CBO con poche adset varianti (Meta non può ottimizzare)

### 3. Audience Overlap
- Calcola overlap stimato tra campagne che targettano stessi interest/audience
- Soglia critica: > 30% overlap = canibalizzazione

### 4. Structural Issues
- Adset senza budget cap → spende selvaggio
- Pixel events mancanti (Purchase, AddToCart, ViewContent)
- Exclusion list non implementata (Clienti esistenti targettati come Prospecting)
- Naming convention inconsistente

### 5. Health Score (0-100)
```
score = 100
  - 5 per ogni campagna stuck in learning
  - 10 per ogni overlap critico (>30%)
  - 15 per ogni structural issue grave
  - 5 per ogni structural issue minor
```

## Output JSON

```json
{
  "health_score": 68,
  "verdict": "Buona base, 3 problemi strutturali da fixare",
  "learning_phase": [
    { "campaign": "1.0_CBO_Testing_ITA", "days_in_learning": 12, "conversions_per_week": 22, "issue": "Sotto soglia 50 conversioni/sett" }
  ],
  "cbo_abo_mix": {
    "cbo_pct": 78,
    "abo_pct": 22,
    "recommendation": "OK per scaling, ma >70% CBO con poche varianti adset. Aggiungi 2-3 adset per campagna CBO."
  },
  "audience_overlap": [
    { "campaign_a": "Lookalike 1%", "campaign_b": "Lookalike 1-3%", "overlap_pct": 42, "severity": "high" }
  ],
  "structural_issues": [
    { "severity": "high", "issue": "Nessuna exclusion list per Clienti esistenti su Prospecting", "fix": "Aggiungi custom audience Buyer 180d come exclusion su tutte le campagne Acquisition" },
    { "severity": "medium", "issue": "Naming inconsistente (es. CBO_TST vs CBO_Testing)", "fix": "Standardizza convention <strategia>_<budget_type>_<audience>_<paese>" }
  ],
  "actions": [
    "Risolvi learning su 1.0_CBO_Testing_ITA: aumenta budget +50% per 7gg",
    "Crea exclusion 'Buyer 180d' e applica a tutte campagne Acquisition",
    "Refactor naming convention prossima settimana"
  ],
  "tldr": "Health 68/100. 1 campagna stuck in learning, 1 overlap critico, exclusion list mancante."
}
```

## Vincoli

- Mai inventare campagne: usa solo quelle ritornate dalle API.
- Numeri health_score sempre interi 0-100.
- Linguaggio italiano, actionable.
