'use client'

import { useState, useEffect } from 'react'

function getPageTitle(tab) {
  if (tab === 'kpiBrain') return 'KPI Brain'
  if (tab === 'dashboard') return 'Dashboard'
  if (tab === 'monthly') return 'Mensile'
  if (tab === 'weekly') return 'Weekly'
  if (tab === 'simulator') return 'Simulatore'
  if (tab === 'metaDetail') return 'Meta Detail'
  if (tab === 'creative') return 'Creative'
  if (tab === 'performanceAgent') return 'Performance Agent'
  if (tab === 'klaviyo') return 'Klaviyo'
  if (tab === 'competitorIntel') return 'Competitor Intel'
  if (tab === 'integrations') return 'Integrazioni'
  if (tab === 'cro') return 'CRO'
  if (tab === 'creativeLab') return 'Creative Lab'
  return 'Dashboard'
}

function getPageSubtitle(tab, updated) {
  if (tab === 'kpiBrain') return 'Your business intelligence at a glance'
  if (tab === 'creative') return 'Analisi creative Meta Ads'
  if (tab === 'metaDetail') return `Dettaglio performance Meta · ${updated ? updated.toLocaleString('it-IT') : '—'}`
  if (tab === 'performanceAgent') return 'Consulente AI · Performance · CMO · CRO · Ads'
  if (tab === 'klaviyo') return 'Email Marketing · Campagne · Flussi · Segmenti'
  if (tab === 'competitorIntel') return 'Creative attive · Catalogo prodotti · Prezzi · Promozioni'
  if (tab === 'integrations') return 'Collega e gestisci tutte le piattaforme'
  if (tab === 'cro') return 'Funnel · Top Pages · Flusso Traffico · Page Scanner'
  if (tab === 'creativeLab') return 'Genera ad creative con AI da best seller, performance e competitor'
  return `LTV:CAC Dashboard · ${updated ? updated.toLocaleString('it-IT') : '—'}`
}


function StatusPill({ label, active, color }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '6px 11px',
        borderRadius: 10,
        border: `1px solid ${active ? color : '#332a41'}`,
        background: active ? `${color}18` : '#171220',
        color: active ? color : '#a89db8',
        fontSize: 11,
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      {label} {active ? '✓' : '—'}
    </span>
  )
}

const PRESETS = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'last_7d', label: 'Ultimi 7 giorni' },
  { value: 'last_14d', label: 'Ultimi 14 giorni' },
  { value: 'last_28d', label: 'Ultimi 28 giorni' },
  { value: 'last_90d', label: 'Ultimi 90 giorni' },
  { value: 'current_month', label: 'Mese corrente' },
  { value: 'last_month', label: 'Mese scorso' },
  { value: 'ytd', label: 'Anno corrente (YTD)' },
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
      color: '#ff4d7d',
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
      color: '#f6b73c',
      items: [
        { id: 'simulator', label: 'Simulatore', icon: '⚡' },
        { id: 'metaDetail', label: 'Meta Detail', icon: '◉' },
      ],
    },
    {
      title: 'Intelligence',
      color: '#06b6d4',
      items: [
        { id: 'competitorIntel', label: 'Competitor Intel', icon: '◈' },
      ],
    },
    {
      title: 'AI',
      color: '#8b5cf6',
      items: [
        { id: 'performanceAgent', label: 'Performance Agent', icon: '✦' },
        { id: 'creativeLab', label: 'Creative Lab', icon: '✧' },
      ],
    },
    {
      title: 'System',
      color: '#9f93ad',
      items: [
        { id: 'integrations', label: 'Integrazioni', icon: '⚙' },
      ],
    },
  ]

  const [storeOpen, setStoreOpen] = useState(false)
  const [integrations, setIntegrations] = useState(null)

  useEffect(() => {
    fetch('/api/integrations', { cache: 'no-store' })
      .then(r => r.json()).then(setIntegrations).catch(() => {})
  }, [])

  const goTo = (id) => {
    if (typeof setTab === 'function') setTab(id)
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at 18% 0%, rgba(139,92,246,.13), transparent 30%), #0f0b16',
        color: '#f7f2ff',
        display: 'flex',
        fontFamily:
          'Inter, Barlow, Barlow Condensed, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, Segoe UI, sans-serif',
      }}
    >
      <aside
        style={{
          width: 264,
          minWidth: 264,
          height: '100vh',
          position: 'sticky',
          top: 0,
          borderRight: '1px solid #292134',
          background: 'rgba(16, 12, 24, .92)',
          backdropFilter: 'blur(18px)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 20,
        }}
      >
        <div style={{ padding: '22px 16px 14px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 22,
            }}
          >
            <svg width="36" height="28" viewBox="0 0 36 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1" y="18" width="6" height="9" rx="2" fill="#8b5cf6" opacity="0.35" />
              <rect x="10" y="12" width="6" height="15" rx="2" fill="#8b5cf6" opacity="0.55" />
              <rect x="19" y="6" width="6" height="21" rx="2" fill="#8b5cf6" opacity="0.75" />
              <rect x="28" y="1" width="6" height="26" rx="2" fill="#8b5cf6" />
              <path d="M4 16 Q12 9, 22 5 T34 1" stroke="url(#lyft_grad)" strokeWidth="2" strokeLinecap="round" fill="none" />
              <circle cx="34" cy="1" r="2" fill="#c4b5fd" />
              <defs>
                <linearGradient id="lyft_grad" x1="4" y1="16" x2="34" y2="1" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#8b5cf6" stopOpacity="0.4" />
                  <stop offset="1" stopColor="#c4b5fd" />
                </linearGradient>
              </defs>
            </svg>
            <div
              style={{
                fontSize: 30,
                fontWeight: 950,
                letterSpacing: '-0.05em',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              Lyft
            </div>
          </div>

          <div style={{ position: 'relative' }}>
            <button
              type="button"
              onClick={() => setStoreOpen(!storeOpen)}
              style={{
                width: '100%',
                border: '1px solid #332a41',
                background: '#211a2b',
                color: '#ffffff',
                borderRadius: 13,
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textAlign: 'left',
                cursor: 'pointer',
              }}
            >
              <span style={{ width: 34, height: 34, borderRadius: 8, background: '#fff', display: 'inline-block', flexShrink: 0 }} />
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 14, fontWeight: 900 }}>STMN Fitness</span>
                <span style={{ display: 'block', fontSize: 11, color: '#9b90aa', marginTop: 3 }}>
                  {integrations ? `${integrations.active?.length || 0} integrazion${(integrations.active?.length || 0) === 1 ? 'e' : 'i'} attiv${(integrations.active?.length || 0) === 1 ? 'a' : 'e'}` : 'Shopify + Meta'}
                </span>
              </span>
              <span style={{ color: '#9285a4', fontSize: 14, transition: 'transform .2s', transform: storeOpen ? 'rotate(180deg)' : 'none' }}>⌄</span>
            </button>

            {storeOpen && (
              <div style={{
                marginTop: 8, background: '#1a1525', border: '1px solid #332a41', borderRadius: 12,
                padding: '10px 0', maxHeight: 320, overflowY: 'auto',
              }}>
                {integrations?.active?.map(int => (
                  <div key={int.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px' }}>
                    <span style={{ fontSize: 16 }}>{int.icon}</span>
                    <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#f7f2ff' }}>{int.name}</span>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e' }} />
                  </div>
                ))}

                {integrations?.available?.length > 0 && (
                  <>
                    <div style={{ height: 1, background: '#292134', margin: '6px 0' }} />
                    <div style={{ padding: '4px 14px', fontSize: 9, fontWeight: 800, color: '#776a86', textTransform: 'uppercase', letterSpacing: '.1em' }}>Disponibili</div>
                    {integrations.available.slice(0, 4).map(int => (
                      <div key={int.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 14px' }}>
                        <span style={{ fontSize: 16, opacity: 0.5 }}>{int.icon}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 700, color: '#776a86' }}>{int.name}</span>
                      </div>
                    ))}
                  </>
                )}

                <div style={{ height: 1, background: '#292134', margin: '6px 0' }} />
                <button
                  type="button"
                  onClick={() => { goTo('integrations'); setStoreOpen(false) }}
                  style={{
                    width: '100%', border: 'none', background: 'none', padding: '8px 14px',
                    display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer',
                    color: '#8b5cf6', fontSize: 12, fontWeight: 800, textAlign: 'left',
                  }}
                >
                  <span>⚙</span> Gestisci integrazioni
                </button>
              </div>
            )}
          </div>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '10px 4px 16px',
          }}
        >
          {navGroups.map((group) => (
            <div key={group.title} style={{ marginBottom: 26 }}>
              <div
                style={{
                  margin: '0 0 10px',
                  padding: '8px 16px',
                  borderRadius: '0 10px 10px 0',
                  background: `linear-gradient(90deg, ${group.color}25, transparent)`,
                  color: group.color,
                  fontSize: 12,
                  fontWeight: 950,
                  textTransform: 'uppercase',
                  letterSpacing: '0.17em',
                }}
              >
                {group.title}
              </div>

              <div style={{ display: 'grid', gap: 6, paddingRight: 10 }}>
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
                        borderRadius: '0 10px 10px 0',
                        padding: '14px 16px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: active ? '#ffffff' : '#a99db7',
                        background: active
                          ? 'linear-gradient(90deg, #6d28d9, #2a1746)'
                          : 'transparent',
                        fontSize: 15,
                        fontWeight: 900,
                        boxShadow: active ? 'inset 4px 0 0 #8b5cf6' : 'none',
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          color: active ? '#c4b5fd' : '#776a86',
                          fontSize: 18,
                          display: 'inline-flex',
                          justifyContent: 'center',
                        }}
                      >
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

        <div
          style={{
            borderTop: '1px solid #292134',
            padding: 16,
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(135deg, #ff7a45, #ec4899, #8b5cf6)',
                color: '#fff',
                fontSize: 12,
                fontWeight: 900,
              }}
            >
              MC
            </div>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ fontSize: 13, color: '#fff', fontWeight: 900 }}>
                Marino Catasta
              </div>
              <div style={{ fontSize: 11, color: '#91849f', marginTop: 2 }}>
                Admin
              </div>
            </div>
            <div style={{ color: '#9487a2' }}>⌄</div>
          </div>
        </div>
      </aside>

      <main
        style={{
          flex: 1,
          minWidth: 0,
          padding: '34px 44px 70px',
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
          }}
        >
          <header
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              gap: 20,
              marginBottom: 30,
            }}
          >
            <div>
              <h1
                style={{
                  margin: 0,
                  color: '#ffffff',
                  fontSize: 30,
                  fontWeight: 950,
                  letterSpacing: '-0.045em',
                  lineHeight: 1.05,
                }}
              >
                {getPageTitle(tab)}
              </h1>

              <p
                style={{
                  margin: '12px 0 0',
                  color: '#9f93ad',
                  fontSize: 13,
                  lineHeight: 1.45,
                }}
              >
                {getPageSubtitle(tab, updated)}
              </p>
            </div>

            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 10,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              {setPreset && (
                <select
                  value={preset}
                  onChange={e => setPreset(e.target.value)}
                  disabled={loading}
                  style={{
                    background: '#201b2b',
                    border: '1px solid #3b324a',
                    color: '#fff',
                    borderRadius: 10,
                    padding: '8px 14px',
                    fontSize: 13,
                    fontWeight: 700,
                    outline: 'none',
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.6 : 1,
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
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 10,
                    border: '1px solid #3b324a',
                    background: loading ? '#201b2b' : '#201b2b',
                    color: loading ? '#6b5f7d' : '#f7f2ff',
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.6 : 1,
                    transition: 'all .15s',
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    fontSize: 15,
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                  }}>↻</span>
                  {loading ? 'Caricamento…' : 'Aggiorna'}
                </button>
              )}
            </div>
          </header>

          {children}
        </div>
      </main>
    </div>
  )
}
