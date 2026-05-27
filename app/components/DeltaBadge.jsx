'use client'

export default function DeltaBadge({ current, previous }) {
  if (current == null || previous == null || previous === 0) return null

  const c = Number(current)
  const p = Number(previous)
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null

  const pct = ((c - p) / Math.abs(p)) * 100
  if (!Number.isFinite(pct)) return null

  const isDown = pct < 0
  const sign = pct >= 0 ? '+' : ''
  const display = Math.abs(pct) >= 100
    ? `${sign}${Math.round(pct)}%`
    : `${sign}${pct.toFixed(1).replace('.', ',')}%`

  return (
    <span
      className={isDown ? 'delta-down' : 'delta-up'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        fontSize: 13,
        fontWeight: 700,
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      <span style={{ fontSize: 10 }}>{isDown ? '▼' : '▲'}</span>
      {display}
    </span>
  )
}
