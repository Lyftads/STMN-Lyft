'use client'

import { useEffect, useState } from 'react'

const SECTION_ICONS = {
  overview: '◆',
  shopify: '⌁',
  meta: '◉',
  creative: '▧',
  products: '▦',
}

const SECTION_COLORS = {
  overview: 'var(--accent)',
  shopify: '#22c55e',
  meta: '#3b82f6',
  creative: '#bf5af2',
  products: '#ff9f0a',
}

const ORDER = ['overview', 'shopify', 'meta', 'creative', 'products']

export default function DashboardInsights({ preset }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)

    fetch('/api/insights', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ preset }),
    })
      .then(r => r.json())
      .then(json => {
        if (!active) return
        if (json.error) setError(json.error)
        else setData(json.sections)
      })
      .catch(e => active && setError(e.message))
      .finally(() => active && setLoading(false))

    return () => { active = false }
  }, [preset])

  if (loading && !data) {
    return (
      <div className="reveal-zoom glass-section" style={{ padding: 32, marginTop: 28 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            width: 18, height: 18, borderRadius: '50%',
            border: '2px solid var(--border)', borderTopColor: 'var(--accent)',
            animation: 'spin 0.8s linear infinite',
          }} />
          <span style={{ color: 'var(--text2)', fontSize: 14 }}>
            Genero insight per il periodo selezionato…
          </span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="reveal-zoom glass-section" style={{ padding: 32, marginTop: 28 }}>
        <div style={{ color: 'var(--red)', fontSize: 14 }}>
          ⚠️ {error}
        </div>
      </div>
    )
  }

  if (!data) return null

  const sections = ORDER.filter(k => data[k]).map(k => ({ key: k, ...data[k] }))

  return (
    <div className="reveal-zoom" style={{ marginTop: 32 }}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
        <h2 className="heading-md">Insight e To-do</h2>
        <span style={{ fontSize: 12, color: 'var(--text3)' }}>
          Aggiornati per il periodo selezionato {loading && '· aggiorno…'}
        </span>
      </div>

      <div className="stagger-zoom" style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
        gap: 14,
      }}>
        {sections.map(s => (
          <SectionCard key={s.key} section={s} />
        ))}
      </div>
    </div>
  )
}

function SectionCard({ section }) {
  const color = SECTION_COLORS[section.key] || 'var(--accent)'
  const icon = SECTION_ICONS[section.key] || '◆'

  return (
    <div className="glass-card" style={{ padding: 22, display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{
          width: 30, height: 30, borderRadius: 8,
          background: `${color}22`, color,
          display: 'grid', placeItems: 'center',
          fontSize: 14, fontWeight: 900,
        }}>{icon}</span>
        <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{section.title}</span>
      </div>

      {section.insights?.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 10, fontSize: 10 }}>Insight</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {section.insights.map((ins, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text)', lineHeight: 1.5 }}>
                <span style={{ color, flexShrink: 0, marginTop: 1 }}>·</span>
                <span>{ins}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {section.todos?.length > 0 && (
        <div>
          <div className="label" style={{ marginBottom: 10, fontSize: 10 }}>To-do</div>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 8 }}>
            {section.todos.map((td, i) => (
              <li key={i} style={{ display: 'flex', gap: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.5 }}>
                <span style={{
                  flexShrink: 0,
                  width: 14, height: 14, borderRadius: 4,
                  border: `1.5px solid ${color}66`,
                  marginTop: 2,
                }} />
                <span>{td}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
