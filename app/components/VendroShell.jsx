'use client'

function getPageTitle(tab) {
  if (tab === 'kpiBrain') return 'KPI Brain'
  if (tab === 'dashboard') return 'Dashboard'
  if (tab === 'monthly') return 'Mensile'
  if (tab === 'weekly') return 'Weekly'
  if (tab === 'simulator') return 'Simulatore'
  if (tab === 'metaDetail') return 'Meta Detail'
  return 'Dashboard'
}

function getPageSubtitle(tab, updated) {
  if (tab === 'kpiBrain') return 'Your business intelligence at a glance'
  return `LTV:CAC Dashboard · ${updated ? updated.toLocaleString('it-IT') : '—'}`
}

export default function VendroShell({
  tab,
  setTab,
  live,
  updated,
  children,
}) {
  const navGroups = [
    {
      label: 'COMMERCE',
      tone: 'pink',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '⌁' },
        { id: 'kpiBrain', label: 'KPI Brain', icon: '↗' },
        { id: 'monthly', label: 'Mensile', icon: '▦' },
        { id: 'weekly', label: 'Weekly', icon: '↻' },
      ],
    },
    {
      label: 'OPERATIONS',
      tone: 'amber',
      items: [
        { id: 'simulator', label: 'Simulatore', icon: '⚡' },
        { id: 'metaDetail', label: 'Meta Detail', icon: '◉' },
      ],
    },
  ]

  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0f0b17',
        color: '#f8fafc',
        display: 'grid',
        gridTemplateColumns: '276px minmax(0, 1fr)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
      }}
    >
      <aside
        style={{
          position: 'sticky',
          top: 0,
          height: '100vh',
          background: '#100d18',
          borderRight: '1px solid #272033',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ padding: '22px 16px 18px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              marginBottom: 20,
            }}
          >
            <div
              style={{
                width: 40,
                height: 30,
                borderRadius: 999,
                background:
                  'linear-gradient(135deg,#ff7a18 0%,#ff3d77 45%,#7c3aed 100%)',
              }}
            />

            <div
              style={{
                fontSize: 34,
                fontWeight: 900,
                letterSpacing: '-0.06em',
                lineHeight: 1,
                color: '#fff',
              }}
            >
              LyftADS
            </div>
          </div>

          <div
            style={{
              border: '1px solid #2c2638',
              background: '#1d1828',
              borderRadius: 12,
              padding: 10,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
            }}
          >
            <div
              style={{
                width: 34,
                height: 34,
                borderRadius: 8,
                background: '#fff',
              }}
            />

            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  color: '#fff',
                  fontSize: 14,
                  fontWeight: 800,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                STMN Fitness
              </div>

              <div
                style={{
                  marginTop: 2,
                  fontSize: 11,
                  color: '#8b829b',
                }}
              >
                Shopify + Meta
              </div>
            </div>

            <div style={{ color: '#8b829b', fontSize: 16 }}>⌄</div>
          </div>
        </div>

        <nav
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '8px 12px 20px',
          }}
        >
          {navGroups.map(group => (
            <div key={group.label} style={{ marginBottom: 24 }}>
              <div
                style={{
                  height: 30,
                  display: 'flex',
                  alignItems: 'center',
                  padding: '0 14px',
                  borderRadius: 8,
                  background:
                    group.tone === 'pink'
                      ? 'linear-gradient(90deg,#3b1020 0%, transparent 100%)'
                      : 'linear-gradient(90deg,#3a250b 0%, transparent 100%)',
                  color: group.tone === 'pink' ? '#fb4778' : '#f6b73c',
                  fontSize: 12,
                  fontWeight: 900,
                  letterSpacing: '0.14em',
                }}
              >
                {group.label}
              </div>

              <div style={{ marginTop: 10, display: 'grid', gap: 4 }}>
                {group.items.map(item => {
                  const active = tab === item.id

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setTab(item.id)}
                      style={{
                        width: '100%',
                        border: 'none',
                        cursor: 'pointer',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 12,
                        padding: '12px 12px',
                        borderRadius: 10,
                        background: active
                          ? 'linear-gradient(90deg,#4b22a8 0%,#201633 100%)'
                          : 'transparent',
                        color: active ? '#fff' : '#9b92aa',
                        fontSize: 15,
                        fontWeight: active ? 900 : 700,
                      }}
                    >
                      <span
                        style={{
                          width: 24,
                          color: active ? '#8b5cf6' : '#6f6680',
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
            borderTop: '1px solid #272033',
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
                borderRadius: 999,
                background:
                  'linear-gradient(135deg,#fb7185 0%,#f97316 50%,#8b5cf6 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: 13,
                fontWeight: 900,
              }}
            >
              MC
            </div>

            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  color: '#fff',
                  fontSize: 13,
                  fontWeight: 900,
                }}
              >
                Marino Catasta
              </div>

              <div
                style={{
                  color: '#8b829b',
                  fontSize: 12,
                  marginTop: 2,
                }}
              >
                Admin
              </div>
            </div>
          </div>
        </div>
      </aside>

      <main
        style={{
          minWidth: 0,
          background: '#0f0b17',
          padding: '28px 36px 56px',
        }}
      >
        <div
          style={{
            maxWidth: 1180,
            margin: '0 auto',
          }}
        >
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'flex-start',
              marginBottom: 28,
            }}
          >
            <div>
              <div
                style={{
                  fontSize: 30,
                  fontWeight: 900,
                  letterSpacing: '-0.04em',
                  color: tab === 'kpiBrain' ? '#f97316' : '#fff',
                }}
              >
                {getPageTitle(tab)}
              </div>

              <div
                style={{
                  fontSize: 13,
                  color: '#8b829b',
                  marginTop: 6,
                }}
              >
                {getPageSubtitle(tab, updated)}
              </div>
            </div>

            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
              }}
            >
              <span
                style={{
                  fontSize: 11,
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: `1px solid ${
                    live?.sources?.shopify ? '#22c55e55' : '#3a3347'
                  }`,
                  color: live?.sources?.shopify ? '#22c55e' : '#8b829b',
                  background: live?.sources?.shopify ? '#22c55e10' : '#171220',
                  fontWeight: 800,
                }}
              >
                Shopify {live?.sources?.shopify ? '✓' : '—'}
              </span>

              <span
                style={{
                  fontSize: 11,
                  padding: '7px 12px',
                  borderRadius: 10,
                  border: `1px solid ${
                    live?.sources?.meta ? '#3b82f655' : '#3a3347'
                  }`,
                  color: live?.sources?.meta ? '#3b82f6' : '#8b829b',
                  background: live?.sources?.meta ? '#3b82f610' : '#171220',
                  fontWeight: 800,
                }}
              >
                Meta {live?.sources?.meta ? '✓' : '—'}
              </span>
            </div>
          </div>

          {children}
        </div>
      </main>
    </div>
  )
}
