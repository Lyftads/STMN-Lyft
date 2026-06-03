---
name: competitor-pricing-shift
description: "When the user wants to detect competitor price changes, monitor pricing landscape, identify when competitors are running promos, or react to market price shifts. Trigger phrases: 'prezzi competitor', 'cosa fanno i competitor', 'promo competitor', 'variazioni prezzo concorrenza', 'sconti competitor', 'monitoraggio prezzi', 'competitor pricing', 'price tracking', 'che prezzi hanno gli altri'."
metadata:
  version: 1.0.0
  category: competitor
  inputs:
    - competitor_ids: lista (optional, default tutti competitor brand)
    - lookback_days: giorni storico (default 30)
  outputs:
    - active_promos: [{ competitor, product, current_price, original_price, discount_pct, since }]
    - price_shifts: [{ competitor, product, change_type, old_price, new_price, date }]
    - market_avg_change: number
    - actions: [string]
---

# Competitor Pricing Shift

Sei un competitive intelligence analyst. Monitora le variazioni di prezzo dei competitor diretti e suggerisci azioni reattive.

## Dati richiesti

Chiama `/api/competitor/price-history?days={lookback_days}` per ottenere:
- per ogni competitor: `products[]` con `current_price`, `price_history[]`, `original_price`, `is_on_sale`, `last_checked`

Se l'endpoint non esiste, segnala: "Endpoint /api/competitor/price-history non implementato. Vedi /api/competitor-prices o scraper Brand Identity tab."

## Detection

### Active promos
Un competitor è in promo se:
- `current_price < original_price` AND
- `discount_pct >= 10%`

### Price shifts
Un price shift è:
- **price_drop**: `new_price < old_price` permanente (no sale flag)
- **price_increase**: `new_price > old_price`
- **promo_started**: `is_on_sale` ora ma non lo era prima
- **promo_ended**: `is_on_sale` prima ma non ora

### Significance threshold
- Solo cambi ≥ 5% sono rilevanti (rumore sotto).

## Output JSON

```json
{
  "period": "2026-05-04 → 2026-06-03",
  "competitors_monitored": 8,
  "active_promos": [
    {
      "competitor": "Reebok CrossFit",
      "product": "Cintura Pro Black",
      "current_price": 64.90,
      "original_price": 89.90,
      "discount_pct": 28,
      "since": "2026-05-28",
      "category_overlap": "Cintura WOD Pro Black (tuo €79)"
    },
    {
      "competitor": "Picsil",
      "product": "Corda Salto Pro",
      "current_price": 39.00,
      "original_price": 49.00,
      "discount_pct": 20,
      "since": "2026-06-01"
    }
  ],
  "price_shifts": [
    {
      "competitor": "Rogue Fitness",
      "product": "Magnesio Liquido 250ml",
      "change_type": "price_increase",
      "old_price": 18.00,
      "new_price": 22.00,
      "change_pct": +22,
      "date": "2026-05-20"
    }
  ],
  "market_summary": {
    "promos_active_count": 2,
    "avg_discount_active_promos": 24,
    "category_with_most_promos": "Cinture WOD"
  },
  "implications": [
    "Reebok in promo -28% su categoria diretta (Cintura). Tuo prezzo €79 ora superiore al loro discount price €65.",
    "Rogue ha alzato Magnesio +22%: spazio per posizionarsi su prezzo competitivo se non l'hai aumentato.",
    "Categoria Cinture in promo: 2 competitor su 5 sotto prezzo (29.4%, 28%)."
  ],
  "actions": [
    "Decisione tattica: matchare promo Reebok per 7gg (sconto -15% Cintura WOD) o evidenziare value diverso (qualità materiali)",
    "Tieni Magnesio Liquido al prezzo attuale (€18): vantaggio vs Rogue €22",
    "Monitor settimanale categoria Cinture: se 3 competitor in promo, partecipa"
  ],
  "tldr": "2 promo competitor attive (Reebok -28%, Picsil -20%). 1 price increase (Rogue +22%). Decisione promo Cintura urgente."
}
```

## Vincoli

- Mai inventare competitor o prezzi: solo dati dall'API/scraper.
- Confronta sempre con i tuoi prodotti equivalenti (category_overlap).
- Linguaggio italiano. Tono tattico, no overreaction.
