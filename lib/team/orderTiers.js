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

// Fasce selezionabili nello step 1 dell'onboarding. `orders` è il valore
// rappresentativo salvato in companies.declared_monthly_orders: è scelto in modo
// che recommendedTier(orders).plan == plan della fascia (starter→500, growth→2000,
// scale→7000, enterprise→7001).
export const ORDER_BANDS = [
  { plan: 'starter',    orders: 500 },
  { plan: 'growth',     orders: 2000 },
  { plan: 'scale',      orders: 7000 },
  { plan: 'enterprise', orders: 7001 },
]

// Piano minimo (slug) per un dato numero di ordini/mese.
export function minPlanForOrders(orders) {
  return recommendedTier(orders).plan
}

// Piano minimo AUTORITATIVO: il verificato (Shopify) vince sul dichiarato.
// Ritorna { orders, plan, rank, source } — source: 'verified' | 'declared' | null.
export function authoritativeMin({ declared, verified } = {}) {
  const v = (verified != null && Number.isFinite(+verified)) ? +verified : null
  const d = (declared != null && Number.isFinite(+declared)) ? +declared : null
  const orders = v != null ? v : d
  if (orders == null) return { orders: null, plan: null, rank: -1, source: null }
  const plan = minPlanForOrders(orders)
  return { orders, plan, rank: planRank(plan), source: v != null ? 'verified' : 'declared' }
}
