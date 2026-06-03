'use client'

// ─────────────────────────────────────────────────────────────
//  MetaBadge — micro pill con logo Meta (infinity loop gradient)
//  Inseribile in cima alle card delle tab Meta per chiarire
//  la sorgente dati.
// ─────────────────────────────────────────────────────────────

export default function MetaBadge({ size = 'sm', variant = 'pill' }) {
  const dims = size === 'lg' ? { h: 22, w: 28, fs: 11, padH: 8 } :
               size === 'md' ? { h: 18, w: 24, fs: 10, padH: 7 } :
                               { h: 14, w: 20, fs: 9.5, padH: 6 }

  // SVG infinity loop con gradient ufficiale Meta blue→purple
  const logo = (
    <svg
      viewBox="0 0 24 16"
      width={dims.w}
      height={dims.h}
      aria-label="Meta"
      style={{ display: 'block' }}
    >
      <defs>
        <linearGradient id="meta-grad" x1="0" y1="0" x2="1" y2="0.4">
          <stop offset="0%"  stopColor="#0064E1" />
          <stop offset="50%" stopColor="#0081FB" />
          <stop offset="100%" stopColor="#7950F2" />
        </linearGradient>
      </defs>
      <path
        fill="url(#meta-grad)"
        d="M6.5 2C3.46 2 1 5.13 1 9s2.46 7 5.5 7c2.34 0 3.85-1.5 5.5-4.5C13.65 14.5 15.16 16 17.5 16c3.04 0 5.5-3.13 5.5-7s-2.46-7-5.5-7c-2.34 0-3.85 1.5-5.5 4.5C10.35 3.5 8.84 2 6.5 2zm0 3c1.1 0 2 2 2 4s-.9 4-2 4-2-2-2-4 .9-4 2-4zm11 0c1.1 0 2 2 2 4s-.9 4-2 4-2-2-2-4 .9-4 2-4z"
      />
    </svg>
  )

  if (variant === 'icon') return logo

  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 5,
      background: 'rgba(0,129,251,0.10)',
      border: '1px solid rgba(0,129,251,0.30)',
      borderRadius: 999,
      padding: `2px ${dims.padH}px`,
      fontSize: dims.fs, fontWeight: 800, color: '#7dd3fc',
      letterSpacing: '0.04em',
      verticalAlign: 'middle',
    }}>
      {logo}
      Meta
    </span>
  )
}
