'use client'

import { useEffect, useState } from 'react'

function greet() {
  const h = new Date().getHours()
  if (h < 12) return 'Marino, ecco le tue integrazioni'
  if (h < 18) return 'Marino, panoramica integrazioni'
  return 'Marino, il punto sulle integrazioni'
}

function CategoryBadge({ category }) {
  const colors = {
    Commerce: '#22c55e',
    Advertising: '#3b82f6',
    'Email Marketing': '#8b5cf6',
    Analytics: '#f59e0b',
    AI: '#ec4899',
  }
  const color = colors[category] || '#9b90aa'
  return (
    <span style={{
      fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6,
      background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '.05em',
    }}>{category}</span>
  )
}

function IntegrationCard({ integration, onConnect }) {
  const { name, icon, category, active } = integration

  return (
    <div style={{
      background: '#110d1a',
      border: active ? '1px solid #22c55e44' : '1px solid #292134',
      borderRadius: 16,
      padding: '22px 24px',
      display: 'flex',
      flexDirection: 'column',
      gap: 14,
      position: 'relative',
      transition: 'border-color .2s',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{
          width: 44, height: 44, borderRadius: 12,
          background: active ? '#22c55e15' : '#1a1525',
          display: 'grid', placeItems: 'center',
          fontSize: 22,
        }}>
          {icon}
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#f7f2ff' }}>{name}</div>
          <div style={{ marginTop: 4 }}>
            <CategoryBadge category={category} />
          </div>
        </div>
        {active ? (
          <div style={{
            width: 32, height: 32, borderRadius: '50%',
            background: '#22c55e22', display: 'grid', placeItems: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 8.5L6.5 12L13 4" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
        ) : (
          <button
            onClick={() => onConnect(integration)}
            style={{
              background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
              border: 'none',
              borderRadius: 10,
              padding: '8px 16px',
              color: '#fff',
              fontSize: 12,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'opacity .15s',
            }}
            onMouseEnter={e => e.currentTarget.style.opacity = '0.85'}
            onMouseLeave={e => e.currentTarget.style.opacity = '1'}
          >
            Collega
          </button>
        )}
      </div>

      {active && (
        <div style={{
          fontSize: 12, color: '#22c55e', fontWeight: 700,
          display: 'flex', alignItems: 'center', gap: 6,
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Connesso
        </div>
      )}
    </div>
  )
}

function SetupModal({ integration, onClose }) {
  if (!integration) return null
  const { name, icon, instructions, setupUrl, envVars } = integration

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,.7)', backdropFilter: 'blur(6px)',
      display: 'grid', placeItems: 'center',
    }} onClick={onClose}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#14111d',
          border: '1px solid #292134',
          borderRadius: 20,
          padding: '32px 36px',
          maxWidth: 560,
          width: '90%',
          maxHeight: '80vh',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <div style={{
            width: 48, height: 48, borderRadius: 14,
            background: '#1a1525', display: 'grid', placeItems: 'center', fontSize: 24,
          }}>
            {icon}
          </div>
          <div>
            <div style={{ fontSize: 20, fontWeight: 950, color: '#fff' }}>Collega {name}</div>
            <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 2 }}>Segui questi passaggi</div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {instructions.map((step, i) => (
            <div key={i} style={{
              display: 'flex', gap: 12, alignItems: 'flex-start',
              background: '#1a1525', borderRadius: 12, padding: '14px 16px',
            }}>
              <div style={{
                width: 24, height: 24, borderRadius: 8, flexShrink: 0,
                background: '#8b5cf622', color: '#c4b5fd',
                display: 'grid', placeItems: 'center',
                fontSize: 12, fontWeight: 900,
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 13, color: '#e2dcf0', lineHeight: 1.5, fontWeight: 600 }}>
                {step}
              </div>
            </div>
          ))}
        </div>

        <div style={{
          background: '#1a1525', borderRadius: 12, padding: '14px 16px', marginBottom: 20,
        }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: '#776a86', textTransform: 'uppercase', marginBottom: 8 }}>
            Variabili da aggiungere su Vercel
          </div>
          {envVars.map(v => (
            <div key={v} style={{
              fontSize: 13, fontWeight: 700, color: '#c4b5fd',
              fontFamily: 'monospace', padding: '4px 0',
            }}>
              {v}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <a
            href={setupUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: 'block', textAlign: 'center',
              background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
              border: 'none', borderRadius: 12,
              padding: '12px 20px', color: '#fff',
              fontSize: 14, fontWeight: 800, textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Apri {name} →
          </a>
          <a
            href="https://vercel.com/lyftads/stmn-lyft/settings/environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              flex: 1, display: 'block', textAlign: 'center',
              background: '#1a1525',
              border: '1px solid #292134', borderRadius: 12,
              padding: '12px 20px', color: '#e2dcf0',
              fontSize: 14, fontWeight: 800, textDecoration: 'none',
              cursor: 'pointer',
            }}
          >
            Vercel Env Vars →
          </a>
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', marginTop: 12,
            background: 'transparent', border: '1px solid #292134',
            borderRadius: 12, padding: '10px', color: '#9b90aa',
            fontSize: 12, fontWeight: 700, cursor: 'pointer',
          }}
        >
          Chiudi
        </button>
      </div>
    </div>
  )
}

export default function IntegrationsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/api/integrations', { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700 }}>Carico le integrazioni...</div>
  }

  if (!data) {
    return <div style={{ color: '#ef4444', padding: 40 }}>Errore nel caricamento</div>
  }

  const { active, available } = data

  return (
    <div>
      <p style={{ color: '#9f93ad', fontSize: 13, margin: '0 0 24px' }}>{greet()}</p>

      <div style={{
        background: '#1a1226', border: '1px solid #292134', borderRadius: 12,
        padding: '12px 18px', marginBottom: 28, color: '#c4b5fd', fontSize: 13, fontWeight: 600,
      }}>
        {active.length} integrazion{active.length === 1 ? 'e' : 'i'} attiv{active.length === 1 ? 'a' : 'e'} su {active.length + available.length} disponibil{active.length + available.length === 1 ? 'e' : 'i'}.
        {available.length > 0 && ` Marino, potresti collegare ${available.length === 1 ? 'ancora' : 'altre'} ${available.length} piattaform${available.length === 1 ? 'a' : 'e'} — vuoi che ti aiuto?`}
      </div>

      {/* Active */}
      <div style={{
        margin: '0 0 18px', padding: '8px 16px', borderRadius: '0 10px 10px 0',
        background: 'linear-gradient(90deg, #22c55e25, transparent)',
        color: '#22c55e', fontSize: 12, fontWeight: 950,
        textTransform: 'uppercase', letterSpacing: '0.17em',
      }}>
        Attive ({active.length})
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14, marginBottom: 32 }}>
        {active.map(i => (
          <IntegrationCard key={i.id} integration={i} onConnect={() => {}} />
        ))}
      </div>

      {/* Available */}
      {available.length > 0 && (
        <>
          <div style={{
            margin: '0 0 18px', padding: '8px 16px', borderRadius: '0 10px 10px 0',
            background: 'linear-gradient(90deg, #8b5cf625, transparent)',
            color: '#8b5cf6', fontSize: 12, fontWeight: 950,
            textTransform: 'uppercase', letterSpacing: '0.17em',
          }}>
            Disponibili ({available.length})
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
            {available.map(i => (
              <IntegrationCard key={i.id} integration={i} onConnect={setSelected} />
            ))}
          </div>
        </>
      )}

      <SetupModal integration={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
