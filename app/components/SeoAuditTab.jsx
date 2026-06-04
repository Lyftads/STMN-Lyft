'use client'

import { useState } from 'react'

const STATUS = {
  pass: { color: '#30d158', icon: '✓' },
  warn: { color: '#ff9f0a', icon: '!' },
  fail: { color: '#ff375f', icon: '×' },
}
const GROUPS = ['Essenziali', 'Social/Sharing', 'Strutturati', 'Contenuto', 'Tecnici']
const PRIO = { alta: '#ff375f', media: '#ff9f0a', bassa: '#64d2ff' }

export default function SeoAuditTab() {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [res, setRes] = useState(null)

  const run = async () => {
    if (!url.trim() || loading) return
    setLoading(true); setError(null); setRes(null)
    try {
      const r = await fetch('/api/seo-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const data = await r.json()
      if (data.error) setError(data.error)
      else setRes(data)
    } catch {
      setError('Errore durante l\'analisi.')
    } finally {
      setLoading(false)
    }
  }

  const scoreColor = res ? (res.score >= 85 ? '#30d158' : res.score >= 70 ? '#64d2ff' : res.score >= 50 ? '#ff9f0a' : '#ff375f') : '#64d2ff'

  return (
    <div style={{ maxWidth: 1100 }}>
      <div style={{ marginBottom: 8, fontSize: 13, opacity: 0.55 }}>
        Audit SEO on-page: title, meta, heading, dati strutturati, social, hreflang, sitemap e consigli AI prioritizzati.
      </div>

      {/* Input */}
      <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
        <input
          value={url}
          onChange={e => setUrl(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && run()}
          placeholder="https://tuosito.com  (o una pagina prodotto/collezione)"
          style={{
            flex: 1, padding: '14px 16px', borderRadius: 12,
            background: 'var(--glass)', border: '1px solid var(--border)',
            color: 'var(--text)', fontSize: 15, outline: 'none',
          }}
        />
        <button
          onClick={run}
          disabled={loading || !url.trim()}
          style={{
            padding: '14px 28px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
            background: loading ? 'rgba(41,151,255,0.4)' : 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 15,
          }}
        >
          {loading ? 'Analizzo…' : 'Analizza SEO'}
        </button>
      </div>

      {error && (
        <div className="glass-card" style={{ padding: 18, color: '#ff375f', marginBottom: 20 }}>⚠ {error}</div>
      )}

      {res && (
        <>
          {/* Score + summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 24 }}>
            <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
              <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: scoreColor }}>{res.score}</div>
              <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>/ 100 · {res.scoreLabel}</div>
            </div>
            <div className="glass-card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 28 }}>
              <Summary n={res.summary.pass} label="Ok" color="#30d158" />
              <Summary n={res.summary.warn} label="Da migliorare" color="#ff9f0a" />
              <Summary n={res.summary.fail} label="Critici" color="#ff375f" />
              <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.5, textAlign: 'right' }}>
                <div style={{ wordBreak: 'break-all' }}>{res.url}</div>
                <div>{res.meta.words} parole · {(res.meta.loadMs / 1000).toFixed(1)}s</div>
              </div>
            </div>
          </div>

          {/* Recommendations AI */}
          {res.recommendations?.length > 0 && (
            <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
              <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>✦ Azioni consigliate (AI)</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {res.recommendations.map((r, i) => (
                  <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5,
                      padding: '3px 8px', borderRadius: 6, color: PRIO[r.priority] || '#64d2ff',
                      border: `1px solid ${PRIO[r.priority] || '#64d2ff'}`, flexShrink: 0, marginTop: 2,
                    }}>{r.priority}</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div>
                      <div style={{ fontSize: 13, opacity: 0.7 }}>{r.action}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Checks per gruppo */}
          {GROUPS.map(group => {
            const items = res.checks.filter(c => c.group === group)
            if (!items.length) return null
            return (
              <div key={group} className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
                <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14, opacity: 0.85 }}>{group}</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {items.map(c => {
                    const s = STATUS[c.status]
                    return (
                      <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                        <span style={{
                          width: 20, height: 20, borderRadius: '50%', flexShrink: 0,
                          background: s.color + '22', color: s.color, fontSize: 12, fontWeight: 700,
                          display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1,
                        }}>{s.icon}</span>
                        <div style={{ flex: 1 }}>
                          <span style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</span>
                          <span style={{ fontSize: 13, opacity: 0.6, marginLeft: 8 }}>{c.detail}</span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </>
      )}
    </div>
  )
}

function Summary({ n, label, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{n}</div>
      <div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div>
    </div>
  )
}
