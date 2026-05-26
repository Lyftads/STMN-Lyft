'use client'

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
  return 'Dashboard'
}

function getPageSubtitle(tab, updated) {
  if (tab === 'kpiBrain') return 'Your business intelligence at a glance'
  if (tab === 'creative') return 'Analisi creative Meta Ads'
  if (tab === 'metaDetail') return `Dettaglio performance Meta · ${updated ? updated.toLocaleString('it-IT') : '—'}`
  if (tab === 'performanceAgent') return 'Consulente AI · Performance · CMO · CRO · Ads'
  if (tab === 'klaviyo') return 'Email Marketing · Campagne · Flussi · Segmenti'
  return `LTV:CAC Dashboard · ${updated ? updated.toLocaleString('it-IT') : '—'}`
}

function StatusPill({ label, active, color }) {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '8px 13px',
        borderRadius: 12,
        border: `1px solid ${active ? color : '#332a41'}`,
        background: active ? `${color}18` : '#171220',
        color: active ? color : '#a89db8',
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1,
      }}
    >
      {label} {active ? '✓' : '—'}
    </span>
  )
}

export default function VendroShell({
  tab = 'dashboard',
  setTab,
  live,
  updated,
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
      title: 'AI',
      color: '#8b5cf6',
      items: [
        { id: 'performanceAgent', label: 'Performance Agent', icon: '✦' },
      ],
    },
  ]

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
            <div
              style={{
                width: 40,
                height: 30,
                borderRadius: 999,
                background:
                  'linear-gradient(135deg, #ff6b4a 0%, #ec4899 48%, #7c3aed 100%)',
                boxShadow: '0 0 26px rgba(236,72,153,.28)',
              }}
            />
            <div
              style={{
                fontSize: 30,
                fontWeight: 950,
                letterSpacing: '-0.05em',
                color: '#ffffff',
                lineHeight: 1,
              }}
            >
              Lyft Ads
            </div>
          </div>

          <button
            type="button"
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
              cursor: 'default',
            }}
          >
            <span
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: '#fff',
                display: 'inline-block',
                flexShrink: 0,
              }}
            />
            <span style={{ flex: 1 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 900 }}>
                STMN Fitness
              </span>
              <span style={{ display: 'block', fontSize: 11, color: '#9b90aa', marginTop: 3 }}>
                Shopify + Meta
              </span>
            </span>
            <span style={{ color: '#9285a4', fontSize: 14 }}>⌄</span>
          </button>
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
                gap: 8,
                flexWrap: 'wrap',
                justifyContent: 'flex-end',
              }}
            >
              <StatusPill label="Shopify" active={Boolean(live?.sources?.shopify)} color="#22c55e" />
              <StatusPill label="Meta" active={Boolean(live?.sources?.meta)} color="#3b82f6" />
              <StatusPill label="Klaviyo" active={Boolean(live?.sources?.klaviyo)} color="#8b5cf6" />
            </div>
          </header>

          {children}
        </div>
      </main>
    </div>
  )
}
