'use client'

let sparkId = 0

export default function Sparkline({ data = [], color = '#22c55e', width = 80, height = 32 }) {
  const values = data.filter(v => v != null && Number.isFinite(v))
  if (values.length < 2) return null

  const id = `sp-${++sparkId}`
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 1
  const padX = 1
  const padY = 3

  const coords = values.map((v, i) => ({
    x: padX + (i / (values.length - 1)) * (width - padX * 2),
    y: padY + (1 - (v - min) / range) * (height - padY * 2),
  }))

  const last = values[values.length - 1]
  const prev = values[values.length - 2]
  const lineColor = last >= prev ? color : '#ef4444'

  const linePoints = coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`).join(' ')

  const areaPoints = [
    `${coords[0].x.toFixed(1)},${height}`,
    ...coords.map(c => `${c.x.toFixed(1)},${c.y.toFixed(1)}`),
    `${coords[coords.length - 1].x.toFixed(1)},${height}`,
  ].join(' ')

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={lineColor} stopOpacity={0.35} />
          <stop offset="100%" stopColor={lineColor} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon
        fill={`url(#${id})`}
        points={areaPoints}
      />
      <polyline
        fill="none"
        stroke={lineColor}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
        points={linePoints}
      />
      <circle
        cx={coords[coords.length - 1].x}
        cy={coords[coords.length - 1].y}
        r={2.2}
        fill={lineColor}
      />
    </svg>
  )
}
