'use client'

// Card "futuristic" condivisa — stesso stile usato in Meta Detail / CRO /
// Scanner (header con shine, scan-line, hover lift). Usala per ogni nuova
// sezione così l'estetica resta coerente con le altre tab.

const ACCENT_GLOW = '#2997ff'

export default function FxCard({ title, glow = ACCENT_GLOW, subtitle, children, padding = 24, delay = 0, style }) {
  return (
    <div
      className="fx-card-shared"
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 100%)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: 'none',
        animation: 'sim-pulse 6s ease-in-out infinite',
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      <div className="fx-card-accent" style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: 'none',
        filter: 'blur(0.3px)', opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3, pointerEvents: 'none',
      }} />
      <div className="fx-card-scan" style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%', width: '40%',
        background: 'none',
        animation: 'sim-scan 9s ease-in-out infinite',
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>
        {title && (
          <div style={{ marginBottom: subtitle ? 4 : 18 }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 15, fontWeight: 680, letterSpacing: '-0.01em' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 18px', color: 'var(--text3)', fontSize: 13 }}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
