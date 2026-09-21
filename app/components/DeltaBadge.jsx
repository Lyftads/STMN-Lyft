'use client'

import { sepDecimali } from '../../lib/client/numeri'

export default function DeltaBadge({ current, previous, inverse = false }) {
  // Una percentuale su una base nulla o NEGATIVA non vuol dire niente: il giorno di un reso il
  // fatturato di confronto puo' essere -28 €, e ne usciva "+2637%". Senza base, niente cifra.
  if (current == null || previous == null || !(Number(previous) > 0)) return null

  const c = Number(current)
  const p = Number(previous)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null

  const pct = ((c - p) / Math.abs(p)) * 100
  if (!Number.isFinite(pct)) return null

  const isDown = pct < 0
  // For metrics like CAC/CPC/CPM/CPO lower is better → flip color logic.
  const isGood = inverse ? isDown : !isDown
  const sign = pct >= 0 ? '+' : ''
  const display = Math.abs(pct) >= 100
    ? `${sign}${Math.round(pct)}%`
    : `${sign}${pct.toFixed(1).replace('.', sepDecimali())}%`

  return (
    <span
      className={isGood ? 'delta-up' : 'delta-down'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 13,
        fontWeight: 600,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ fontSize: 10 }}>{isDown ? '▼' : '▲'}</span>
      {display}
    </span>
  )
}
