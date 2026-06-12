'use client'

// ─────────────────────────────────────────────────────────────
//  LogoMark — logo SVG vettoriale animato di LyftAI.
//  Stesso componente usato in landing + sidebar software per
//  coerenza visuale.
// ─────────────────────────────────────────────────────────────

const ACCENT = '#bf5af2'
const BLUE = '#2997ff'
const GREEN = '#22c55e'

export default function LogoMark({ size = 32, withGlow = true }) {
  return (
    <div
      style={{
        width: size, height: size, position: 'relative', flexShrink: 0,
        animation: withGlow ? 'logoMarkGlow 4s ease-in-out infinite' : 'none',
      }}
    >
      <style>{`
        @keyframes logoMarkSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes logoMarkGlow {
          0%, 100% { filter: drop-shadow(0 0 8px ${ACCENT}66) drop-shadow(0 0 20px ${BLUE}33); }
          50%      { filter: drop-shadow(0 0 14px ${ACCENT}88) drop-shadow(0 0 28px ${BLUE}55); }
        }
        .logo-mark-ring {
          animation: logoMarkSpin 20s linear infinite;
          transform-origin: 50% 50%;
          transform-box: fill-box;
        }
      `}</style>
      <svg viewBox="0 0 100 100" width={size} height={size}>
        <defs>
          <linearGradient id={`logoGradMain-${size}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor={ACCENT} />
            <stop offset="100%" stopColor={BLUE} />
          </linearGradient>
          <linearGradient id={`logoGradLight-${size}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--text)" stopOpacity="0.9" />
            <stop offset="100%" stopColor="var(--text)" stopOpacity="0.3" />
          </linearGradient>
        </defs>

        {/* Anello esterno rotante */}
        <g className="logo-mark-ring">
          <circle cx="50" cy="50" r="44" fill="none" stroke={`url(#logoGradMain-${size})`}
                  strokeWidth="2" strokeDasharray="60 8 30 8" opacity="0.7" />
        </g>

        {/* Quadrato principale rotato (rombo) */}
        <g transform="translate(50 50)">
          <rect x="-26" y="-26" width="52" height="52" rx="10" transform="rotate(45)"
                fill={`url(#logoGradMain-${size})`} opacity="0.95" />
          <rect x="-26" y="-26" width="52" height="26" rx="10" transform="rotate(45)"
                fill={`url(#logoGradLight-${size})`} opacity="0.18" />
        </g>

        {/* "L" stilizzata al centro */}
        <g transform="translate(50 50)" fill="var(--text)">
          <rect x="-9" y="-14" width="5" height="28" rx="2" />
          <rect x="-9" y="9" width="18" height="5" rx="2" />
        </g>

        {/* Punto di vita (verde pulsante) */}
        <circle cx="78" cy="22" r="3" fill={GREEN}>
          <animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />
        </circle>
      </svg>
    </div>
  )
}
