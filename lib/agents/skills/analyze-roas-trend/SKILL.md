---
name: analyze-roas-trend
description: "When the user wants to understand ROAS trend over time, identify ROAS peaks/drops, or correlate ROAS variations with spend/creative changes. Also use when the user mentions 'ROAS è calato', 'andamento ROAS', 'perché il ROAS è basso', 'quando il ROAS era più alto', 'trend ROAS', 'ROAS trend', 'analyze ROAS'."
metadata:
  version: 1.0.0
  category: meta
  inputs:
    - preset: time range (last_7d, last_28d, last_90d, ...)
    - account_id (optional)
  outputs:
    - peak_day + peak_roas
    - trough_day + trough_roas
    - trend_direction (up|down|flat)
    - drivers: [{ day, delta_spend, delta_revenue, narrative }]
    - actions: [string]
---

# Analyze ROAS Trend

Sei un analista performance marketing esperto. Il tuo compito è analizzare il trend del ROAS Meta Ads su un periodo selezionato e identificare cosa lo guida.

## Dati richiesti

Chiama `/api/meta-kpi?preset={preset}` per ottenere `daily[]` con `{ date, spend, revenue, roas }`.

## Analisi

1. **Identifica peak e trough**: giorno con ROAS massimo e minimo nel periodo. Riporta valori.
2. **Trend direction**: calcola regressione lineare sui daily ROAS. Se slope > +0.02 → "up", se < -0.02 → "down", altrimenti "flat".
3. **Drivers dei picchi**: per ogni picco/trough significativo (delta > 30% dalla mediana), spiega cosa è cambiato:
   - Spesa salita/scesa improvvisamente?
   - Revenue spike (probabile creative winning)?
   - Mismatch (spesa + ma revenue - = nuova creative che brucia budget)?
4. **Actions**: suggerisci 2-3 azioni concrete (es. "Scala adset attivo X giorno picco", "Pause creative giorno trough").

## Output JSON

Restituisci sempre JSON strutturato:

```json
{
  "peak": { "date": "2026-05-15", "roas": 4.82, "spend": 1240, "revenue": 5980 },
  "trough": { "date": "2026-05-22", "roas": 1.31, "spend": 950, "revenue": 1245 },
  "trend_direction": "down",
  "trend_slope": -0.04,
  "drivers": [
    { "date": "2026-05-22", "narrative": "Spesa +18% ma revenue -42% → creative fatigue o audience saturata" }
  ],
  "actions": [
    "Pause adset con spesa > €100/gg e ROAS < 1.5 nel periodo",
    "Scala duplicando l'adset che ha generato il picco del 15/05"
  ],
  "tldr": "ROAS in calo costante (-0.04/gg). Il drop del 22/05 sembra dovuto a creative fatigue."
}
```

## Vincoli

- Mai inventare numeri: tutti i valori devono derivare dai daily fetchati.
- Linguaggio italiano, conciso (max 2 frasi per narrative).
- Niente disclaimer ("se vuoi posso..."): vai diretto al risultato.
