'use client'

// Card "futuristic" condivisa — stesso stile usato in Meta Detail / CRO /
// Scanner (header con shine, scan-line, hover lift). Usala per ogni nuova
// sezione così l'estetica resta coerente con le altre tab.

const ACCENT_GLOW = '#2997ff'

export default function FxCard({ title, glow = ACCENT_GLOW, subtitle, children, padding = 24, delay = 0, style }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.92) 100%)',
        backdropFilter: 'blur(40px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.4)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
        animation: 'sim-pulse 6s ease-in-out infinite',
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        ...style,
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.008)'
        e.currentTarget.style.boxShadow = `0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 80px ${glow}22, inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)`
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        filter: 'blur(0.3px)', opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3, pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%', width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>
        {title && (
          <div style={{ marginBottom: subtitle ? 4 : 18 }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>{title}</h2>
            {subtitle && <p style={{ margin: '4px 0 18px', color: 'var(--text3)', fontSize: 12.5 }}>{subtitle}</p>}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}
