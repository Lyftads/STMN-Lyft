'use client'

import { useEffect, useRef, useState } from 'react'

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

const SECTION_TITLES = {
  overview: 'Quadro generale',
  shopify: 'Shopify',
  meta: 'Meta Ads',
  creative: 'Creative',
  products: 'Prodotti più venduti',
}

const ORDER = ['overview', 'shopify', 'meta', 'creative', 'products']

// Normalize whatever the model returns into our expected shape
function normalizeSections(raw) {
  if (!raw || typeof raw !== 'object') return null

  // If the model wrapped sections under a parent key, unwrap
  let src = raw
  if (raw.sections && typeof raw.sections === 'object') src = raw.sections

  const out = {}
  for (const key of ORDER) {
    let s = src[key]
    // Try common aliases
    if (!s) {
      if (key === 'meta') s = src.meta_ads || src.metaAds
      if (key === 'creative') s = src.creatives || src.creativi
      if (key === 'products') s = src.top_products || src.topProducts || src.prodotti
      if (key === 'overview') s = src.general || src.generale
    }
    if (!s || typeof s !== 'object') continue

    const insights = Array.isArray(s.insights) ? s.insights.filter(x => typeof x === 'string' && x.length > 0) : []
    const todos = Array.isArray(s.todos) ? s.todos.filter(x => typeof x === 'string' && x.length > 0) :
                  Array.isArray(s.todo) ? s.todo.filter(x => typeof x === 'string' && x.length > 0) : []

    if (insights.length === 0 && todos.length === 0) continue

    out[key] = {
      title: typeof s.title === 'string' ? s.title : SECTION_TITLES[key],
      insights,
      todos,
    }
  }
  return Object.keys(out).length > 0 ? out : null
}

export default function DashboardInsights({ preset }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [retryKey, setRetryKey] = useState(0)
  const abortRef = useRef(null)

  useEffect(() => {
    let active = true
    if (abortRef.current) abortRef.current.abort()
    const ac = new AbortController()
    abortRef.current = ac

    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        // 1. Fetch live data client-side (avoids broken internal fetches on Vercel)
        const [mRes, dRes] = await Promise.all([
          fetch(`/api/metrics?preset=${encodeURIComponent(preset)}`, { cache: 'no-store', signal: ac.signal }),
          fetch(`/api/meta-detail?preset=${encodeURIComponent(preset)}&level=campaigns`, { cache: 'no-store', signal: ac.signal }).catch(() => null),
        ])

        const metrics = mRes.ok ? await mRes.json() : null
        const metaDetail = dRes && dRes.ok ? await dRes.json() : null

        if (!active) return
        if (!metrics) {
          setError('Impossibile recuperare i dati metrics')
          return
        }

        // 2. Send to insights endpoint with full payload
        const r = await fetch('/api/insights', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ preset, metrics, metaDetail }),
          signal: ac.signal,
        })

        const json = await r.json()
        if (!active) return

        if (!r.ok || json.error) {
          setError(json?.error || `HTTP ${r.status}`)
          return
        }

        const normalized = normalizeSections(json.sections)
        if (!normalized) {
          setError('La risposta AI non contiene insight validi. Riprova.')
          return
        }
        setData(normalized)
      } catch (e) {
        if (!active || e.name === 'AbortError') return
        setError(e?.message || 'Errore di rete')
      } finally {
        if (active) setLoading(false)
      }
    })()

    return () => { active = false; ac.abort() }
  }, [preset, retryKey])

  const containerStyle = { marginTop: 32 }

  // Always render the container so the user sees something happening
  return (
    <div className="reveal-zoom" style={containerStyle}>
      <div style={{ marginBottom: 20, display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <h2 className="heading-md">Insight e To-do</h2>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {loading && (
            <span style={{ fontSize: 12, color: 'var(--text3)', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                width: 12, height: 12, borderRadius: '50%',
                border: '1.5px solid var(--border)', borderTopColor: 'var(--accent)',
                animation: 'spin 0.8s linear infinite', display: 'inline-block',
              }} />
              Genero…
            </span>
          )}
          <button
            type="button"
            onClick={() => setRetryKey(k => k + 1)}
            disabled={loading}
            className="btn-glass"
            style={{ fontSize: 12, padding: '6px 12px', cursor: loading ? 'wait' : 'pointer' }}
          >
            ↻ Rigenera
          </button>
        </div>
      </div>

      {error && !data && (
        <div className="glass-card" style={{ padding: 20, color: 'var(--red)', fontSize: 13 }}>
          ⚠️ {error}
        </div>
      )}

      {!error && !data && loading && (
        <div className="glass-card" style={{ padding: 32, color: 'var(--text2)', fontSize: 14, textAlign: 'center' }}>
          Sto analizzando i dati del periodo selezionato…
        </div>
      )}

      {!error && !data && !loading && (
        <div className="glass-card" style={{ padding: 20, color: 'var(--text2)', fontSize: 13 }}>
          Nessun insight disponibile. Clicca "Rigenera".
        </div>
      )}

      {data && (
        <div className="stagger-zoom" style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          gap: 14,
        }}>
          {ORDER.filter(k => data[k]).map(k => (
            <SectionCard key={k} sectionKey={k} section={data[k]} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionCard({ sectionKey, section }) {
  const color = SECTION_COLORS[sectionKey] || 'var(--accent)'
  const icon = SECTION_ICONS[sectionKey] || '◆'

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
