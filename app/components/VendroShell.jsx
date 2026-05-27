'use client'

import { useEffect, useRef, useState } from 'react'

function getPageTitle(tab) {
  const map = {
    dashboard: 'Dashboard',
    kpiBrain: 'KPI Brain',
    monthly: 'Mensile',
    weekly: 'Weekly',
    simulator: 'Simulatore',
    metaDetail: 'Meta Detail',
    creative: 'Creative',
    performanceAgent: 'Performance Agent',
    klaviyo: 'Klaviyo',
    competitorIntel: 'Competitor Intel',
    priceComparison: 'Prezzi vs Competitor',
    integrations: 'Integrazioni',
    cro: 'CRO',
    creativeLab: 'Creative Lab',
  }
  return map[tab] || 'Dashboard'
}

function getPageSubtitle(tab) {
  const map = {
    kpiBrain: 'Your business intelligence at a glance',
    creative: 'Analisi creative Meta Ads',
    metaDetail: 'Dettaglio performance Meta',
    performanceAgent: 'Consulente AI · Performance · CMO · CRO · Ads',
    klaviyo: 'Email Marketing · Campagne · Flussi · Segmenti',
    competitorIntel: 'Creative attive · Catalogo · Prezzi · Promozioni',
    priceComparison: 'Confronto prezzi per categoria',
    integrations: 'Collega e gestisci tutte le piattaforme',
    cro: 'Funnel · Top Pages · Flusso Traffico',
    creativeLab: 'Genera ad creative con AI',
    dashboard: 'Panoramica completa del business',
  }
  return map[tab] || 'Panoramica completa del business'
}

const PRESETS = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'last_7d', label: '7 giorni' },
  { value: 'last_14d', label: '14 giorni' },
  { value: 'last_28d', label: '28 giorni' },
  { value: 'last_90d', label: '90 giorni' },
  { value: 'current_month', label: 'Mese corrente' },
  { value: 'last_month', label: 'Mese scorso' },
  { value: 'ytd', label: 'YTD' },
]

export default function VendroShell({
  tab = 'dashboard',
  setTab,
  live,
  updated,
  preset = 'last_90d',
  setPreset,
  loading,
  onRefresh,
  children,
}) {
  const navGroups = [
    {
      title: 'Commerce',
      color: '#ff375f',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '⌁' },
        { id: 'kpiBrain', label: 'KPI Brain', icon: '↗' },
        { id: 'monthly', label: 'Mensile', icon: '▦' },
        { id: 'weekly', label: 'Weekly', icon: '⟳' },
        { id: 'creative', label: 'Creative', icon: '▧' },
        { id: 'klaviyo', label: 'Klaviyo', icon: '✉' },
        { id: 'cro', label: 'CRO', icon: '⊘' },
      ],
    },
    {
      title: 'Operations',
      color: '#ffd60a',
      items: [
        { id: 'simulator', label: 'Simulatore', icon: '⚡' },
        { id: 'metaDetail', label: 'Meta Detail', icon: '◉' },
      ],
    },
    {
      title: 'Intelligence',
      color: '#64d2ff',
      items: [
        { id: 'competitorIntel', label: 'Competitor Intel', icon: '◈' },
        { id: 'priceComparison', label: 'Prezzi vs Competitor', icon: '⚖' },
      ],
    },
    {
      title: 'AI',
      color: '#bf5af2',
      items: [
        { id: 'performanceAgent', label: 'Performance Agent', icon: '✦' },
        { id: 'creativeLab', label: 'Creative Lab', icon: '✧' },
      ],
    },
    {
      title: 'System',
      color: '#86868b',
      items: [
        { id: 'integrations', label: 'Integrazioni', icon: '⚙' },
      ],
    },
  ]

  const goTo = (id) => {
    if (typeof setTab === 'function') setTab(id)
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      color: 'var(--text)',
      display: 'flex',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      position: 'relative',
    }}>
      {/* Background gradient blobs */}
      <div style={{
        position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none',
        background: `
          radial-gradient(ellipse 70% 50% at 15% 0%, rgba(20,80,180,0.15), transparent 55%),
          radial-gradient(ellipse 50% 50% at 85% 15%, rgba(41,151,255,0.08), transparent 50%),
          radial-gradient(ellipse 60% 40% at 50% 50%, rgba(30,60,160,0.06), transparent 55%),
          radial-gradient(ellipse 50% 60% at 80% 85%, rgba(99,102,241,0.10), transparent 50%),
          radial-gradient(ellipse 40% 40% at 10% 90%, rgba(41,151,255,0.07), transparent 45%),
          radial-gradient(ellipse 30% 30% at 60% 30%, rgba(191,90,242,0.04), transparent 40%)
        `,
      }} />

      {/* Sidebar */}
      <aside style={{
        width: 240,
        minWidth: 240,
        height: '100vh',
        position: 'sticky',
        top: 0,
        borderRight: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <svg width="28" height="22" viewBox="0 0 36 28" fill="none">
              <rect x="1" y="18" width="6" height="9" rx="2" fill="#2997ff" opacity="0.3" />
              <rect x="10" y="12" width="6" height="15" rx="2" fill="#2997ff" opacity="0.5" />
              <rect x="19" y="6" width="6" height="21" rx="2" fill="#2997ff" opacity="0.7" />
              <rect x="28" y="1" width="6" height="26" rx="2" fill="#2997ff" />
            </svg>
            <span style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: '#fff',
            }}>
              Lyft
            </span>
          </div>

          {/* Workspace pill */}
          <div style={{
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '10px 14px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <span style={{
              width: 28, height: 28, borderRadius: 7,
              background: 'linear-gradient(135deg, #2997ff, #bf5af2)',
              display: 'inline-block', flexShrink: 0,
            }} />
            <span style={{ flex: 1, minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#fff' }}>STMN Fitness</span>
              <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>Shopify + Meta</span>
            </span>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
          {navGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 20 }}>
              <div style={{
                padding: '6px 20px',
                color: 'var(--text3)',
                fontSize: 10,
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
              }}>
                {group.title}
              </div>

              <div style={{ display: 'grid', gap: 1, padding: '4px 8px 0' }}>
                {group.items.map((item) => {
                  const active = tab === item.id
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => goTo(item.id)}
                      style={{
                        width: '100%',
                        border: 0,
                        borderRadius: 8,
                        padding: '9px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: active ? '#fff' : 'var(--text2)',
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        transition: 'all 0.15s ease',
                        outline: 'none',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{
                        width: 20,
                        color: active ? '#fff' : group.color,
                        fontSize: 14,
                        display: 'inline-flex',
                        justifyContent: 'center',
                        opacity: active ? 1 : 0.6,
                        transition: 'opacity 0.15s',
                      }}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </nav>

        {/* User */}
        <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              display: 'grid', placeItems: 'center',
              background: 'linear-gradient(135deg, #2997ff, #bf5af2)',
              color: '#fff', fontSize: 11, fontWeight: 700,
            }}>
              MC
            </div>
            <div>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>Marino Catasta</div>
              <div style={{ fontSize: 10, color: 'var(--text3)' }}>Admin</div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        minWidth: 0,
        padding: '40px 48px 80px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
            marginBottom: 40,
          }}>
            <div>
              <h1 className="heading-lg" style={{ marginBottom: 6 }}>
                {getPageTitle(tab)}
              </h1>
              <p style={{
                margin: 0,
                color: 'var(--text3)',
                fontSize: 14,
                fontWeight: 400,
              }}>
                {getPageSubtitle(tab)}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              {setPreset && (
                <select
                  value={preset}
                  onChange={e => setPreset(e.target.value)}
                  disabled={loading}
                  className="btn-glass"
                  style={{
                    appearance: 'none',
                    WebkitAppearance: 'none',
                    paddingRight: 32,
                    backgroundImage: `url("data:image/svg+xml,%3Csvg width='10' height='6' viewBox='0 0 10 6' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%2386868b' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 12px center',
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  {PRESETS.map(p => (
                    <option key={p.value} value={p.value}>{p.label}</option>
                  ))}
                </select>
              )}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="btn-glass"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                  }}>↻</span>
                  {loading ? 'Carico…' : 'Aggiorna'}
                </button>
              )}
            </div>
          </header>

          <TabContent key={tab}>
            {children}
          </TabContent>
        </div>
      </main>
    </div>
  )
}

function TabContent({ children }) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    setVisible(false)
    const t = requestAnimationFrame(() => setVisible(true))
    return () => cancelAnimationFrame(t)
  }, [])

  useEffect(() => {
    if (!ref.current) return
    const els = ref.current.querySelectorAll('.reveal, .reveal-scale, .stagger')
    const observer = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            observer.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px 0px' }
    )
    els.forEach(el => observer.observe(el))
    return () => observer.disconnect()
  }, [visible])

  return (
    <div
      ref={ref}
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        transition: 'opacity 0.5s cubic-bezier(0.16,1,0.3,1), transform 0.5s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {children}
    </div>
  )
}
