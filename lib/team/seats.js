// Limite di utenti del team per piano (coerente con la landing).
// Il conteggio include l'owner e gli inviti pendenti.
// Piano sconosciuto/null (es. owner senza Stripe, o trial) → nessun limite.
const SEAT_LIMITS = {
  starter: 2,
  growth: 5,
  scale: Infinity,
  enterprise: Infinity,
}

export function seatLimit(plan) {
  if (!plan) return Infinity
  const v = SEAT_LIMITS[plan]
  return v == null ? Infinity : v
}
