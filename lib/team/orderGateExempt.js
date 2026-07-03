// Tenant ESENTI dal gate volume ordini (clienti storici su piani concordati:
// STMN, Saracino, ecc.). Per loro il gate non blocca nulla e non si ricalcola
// verified_monthly_orders.
//
//  - L'owner (LYFT_OWNER_USER_ID = STMN in env-only mode) è SEMPRE esente.
//  - Gli altri vanno elencati in LYFT_ORDER_GATE_EXEMPT (user_id separati da
//    virgola). Es: LYFT_ORDER_GATE_EXEMPT="<user_id_saracino>,<altro_id>".
export function isOrderGateExempt(userId) {
  if (!userId) return false
  const list = new Set()
  if (process.env.LYFT_OWNER_USER_ID) list.add(String(process.env.LYFT_OWNER_USER_ID).trim())
  for (const id of String(process.env.LYFT_ORDER_GATE_EXEMPT || '').split(',')) {
    const v = id.trim()
    if (v) list.add(v)
  }
  return list.has(String(userId).trim())
}
