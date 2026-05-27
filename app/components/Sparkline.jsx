'use client'

export default function Sparkline({ data = [], color = '#22c55e', width = 80, height = 32 }) {
  const values = data.filter(v => v != null && Number.isFinite(v))
  if (values.length < 2) return null

  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const pad = 2

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (width - pad * 2)
    const y = pad + (1 - (v - min) / range) * (height - pad * 2)
    return `${x},${y}`
  })

  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const lineColor = last >= prev ? color : '#ef4444'

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0 }}>
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points.join(' ')}
        opacity={0.85}
      />
    </svg>
  )
}
