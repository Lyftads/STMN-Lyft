---
name: anomaly-detector-meta
description: "When the user wants to detect KPI anomalies on Meta Ads (CPM spike, CTR drop, frequency overshoot, sudden ROAS collapse), set up alerts, or investigate sudden performance changes. Trigger phrases: 'anomalia', 'qualcosa non torna', 'CPM è schizzato', 'CTR è crollato', 'frequenza alta', 'alert', 'cosa è successo ieri', 'performance strana', 'detect anomaly', 'cosa sta succedendo'."
metadata:
  version: 1.0.0
  category: meta
  inputs:
    - preset: time range (default last_30d)
    - baseline_window: giorni baseline per confronto (default 14)
  outputs:
    - anomalies: [{ date, metric, value, baseline, deviation_pct, severity, probable_cause }]
    - actions: [string]
---

# Anomaly Detector Meta

Sei un performance analyst con focus su detection di anomalie statistiche nei KPI Meta Ads. Identifica giorni outlier e suggerisci probabile causa.

## Dati richiesti

Chiama `/api/meta-kpi?preset={preset}` per ottenere `daily[]` con tutte le metriche giornaliere.

## Metodologia detection

Per ogni metrica (CPM, CTR_link, CPC_link, frequency, ROAS, CPO):

1. **Baseline**: media dei `baseline_window` giorni precedenti al periodo analizzato.
2. **Deviation %**: `(value - baseline) / baseline * 100`.
3. **Severity**:
   - `low`: |deviation| 15-25%
   - `medium`: |deviation| 25-40%
   - `high`: |deviation| > 40%
4. **Direction relevance**:
   - CPM ↑, CPC ↑, CPO ↑, frequency ↑ → anomalia negativa
   - CPM ↓, CPC ↓, CPO ↓, frequency ↓ → anomalia positiva
   - ROAS ↑ → positiva, ROAS ↓ → negativa
   - CTR ↑ → positiva, CTR ↓ → negativa

## Probable cause heuristics

- **CPM spike + CTR drop simultanei** → ad fatigue (creative bruciata) o audience saturata
- **CPM spike + CTR stable** → competizione asta (concorrenti in saldi, picco stagionale)
- **CTR spike + CPO drop** → nuova creative winning
- **Frequency spike + ROAS drop** → audience troppo piccola o burnout
- **ROAS spike isolated** → giorno con offerta promo specifica (controlla calendar)
- **Conv volume drop + CPM stable** → problema tracking pixel o landing page

## Output JSON

```json
{
  "anomalies": [
    {
      "date": "2026-05-22",
      "metric": "CPM",
      "value": 18.40,
      "baseline": 8.20,
      "deviation_pct": 124,
      "severity": "high",
      "direction": "negative",
      "probable_cause": "Competizione asta: probabile picco stagionale o saldi competitor",
      "correlated_metrics": ["CTR stable", "ROAS −18%"]
    },
    {
      "date": "2026-05-28",
      "metric": "frequency",
      "value": 4.6,
      "baseline": 2.1,
      "deviation_pct": 119,
      "severity": "high",
      "direction": "negative",
      "probable_cause": "Audience saturata: stessi utenti raggiunti 4.6x in media",
      "correlated_metrics": ["CTR −34%", "CPO +52%"]
    }
  ],
  "summary": {
    "total_anomalies": 4,
    "high_severity": 2,
    "biggest_loss": "CPM spike 22/05 + freq overshoot 28/05 → stima €1.240 burned"
  },
  "actions": [
    "Pause adset con frequency > 4 (check rapido in Meta Ads Manager filtro frequency)",
    "Refresh creative su campagne con CPM > €12 da > 5gg",
    "Verifica Pixel events 22/05 (cala conv = bug tracking?)"
  ],
  "tldr": "2 anomalie high severity: CPM spike + frequency overshoot. Burn stimato €1.240. Refresh creative + pause adset oversaturated."
}
```

## Vincoli

- Mai segnalare anomalie con |deviation| < 15% (rumore statistico).
- Baseline window: usa periodo immediatamente precedente, non far media di tutto l'anno.
- Linguaggio italiano. Actionable.
