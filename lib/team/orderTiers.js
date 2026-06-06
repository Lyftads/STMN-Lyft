// Fasce di prezzo per ordini/mese (coerenti con la landing).
export const ORDER_TIERS = [
  { plan: 'starter', label: 'Starter', price: '€69', max: 500 },
  { plan: 'growth', label: 'Growth', price: '€149', max: 2000 },
  { plan: 'scale', label: 'Scale', price: '€299', max: 7000 },
  { plan: 'enterprise', label: 'Enterprise', price: 'su misura', max: Infinity },
]

const RANK = { starter: 0, growth: 1, scale: 2, enterprise: 3 }

export function planRank(plan) {
  return RANK[plan] ?? -1
}

// Fascia consigliata in base agli ordini/mese.
export function recommendedTier(orders) {
  return ORDER_TIERS.find(t => orders <= t.max) || ORDER_TIERS[ORDER_TIERS.length - 1]
}

export function tierOf(plan) {
  return ORDER_TIERS.find(t => t.plan === plan) || null
}
