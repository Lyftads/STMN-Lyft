'use client'

import { useState } from 'react'

const ACCENT_GLOW = '#2997ff'

function GlassCard({ children, padding = 22, delay = 0, glow = ACCENT_GLOW, style = {} }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
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
        e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        filter: 'blur(0.3px)',
        opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3,
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%',
        width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}

function ScoreGauge({ score = 0, label }) {
  const v = Math.max(0, Math.min(100, score))
  const color = v >= 80 ? '#22c55e' : v >= 60 ? '#3b82f6' : v >= 40 ? '#f59e0b' : '#ef4444'
  const circumference = 2 * Math.PI * 52
  const offset = circumference - (v / 100) * circumference

  return (
    <div style={{ position: 'relative', width: 140, height: 140 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <defs>
          <linearGradient id="score-grad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={1} />
            <stop offset="100%" stopColor={color} stopOpacity={0.6} />
          </linearGradient>
        </defs>
        <circle cx="70" cy="70" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        <circle
          cx="70" cy="70" r="52" fill="none"
          stroke="url(#score-grad)"
          strokeWidth="10" strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform="rotate(-90 70 70)"
          style={{ transition: 'stroke-dashoffset 1.2s cubic-bezier(0.16,1,0.3,1)', filter: `drop-shadow(0 0 8px ${color}66)` }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: 36, fontWeight: 900, color: '#fff', fontFamily: 'Barlow', lineHeight: 1, letterSpacing: '-0.04em' }}>{v}</div>
        <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginTop: 4 }}>Score CRO</div>
        {label && <div style={{ fontSize: 10, color, fontWeight: 800, marginTop: 4, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{label}</div>}
      </div>
    </div>
  )
}

function PrioPill({ priority }) {
  const colors = {
    critical: { bg: 'rgba(239,68,68,0.18)', text: '#fca5a5', label: 'Critico' },
    high:     { bg: 'rgba(245,158,11,0.18)', text: '#fcd34d', label: 'Alta' },
    medium:   { bg: 'rgba(41,151,255,0.18)', text: '#93c5fd', label: 'Media' },
    low:      { bg: 'rgba(255,255,255,0.06)', text: 'var(--text3)', label: 'Bassa' },
  }
  const c = colors[priority] || colors.medium
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.text,
      fontSize: 9.5, fontWeight: 900, letterSpacing: '0.08em',
      textTransform: 'uppercase',
    }}>{c.label}</span>
  )
}

function ImpactPill({ impact }) {
  const colors = {
    high: { bg: 'rgba(34,197,94,0.18)', text: '#86efac' },
    medium: { bg: 'rgba(41,151,255,0.18)', text: '#93c5fd' },
    low: { bg: 'rgba(255,255,255,0.06)', text: 'var(--text3)' },
  }
  const c = colors[impact] || colors.medium
  return (
    <span style={{
      display: 'inline-block', padding: '2px 8px', borderRadius: 999,
      background: c.bg, color: c.text,
      fontSize: 9.5, fontWeight: 800, letterSpacing: '0.06em',
      textTransform: 'uppercase',
    }}>impact {impact || 'medium'}</span>
  )
}

function Section({ title, subtitle, dotColor, children, delay = 0 }) {
  return (
    <GlassCard padding={26} delay={delay}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 18 }}>
        <div style={{
          width: 10, height: 10, borderRadius: 999,
          background: dotColor,
          boxShadow: `0 0 12px ${dotColor}`,
          marginTop: 7,
        }} />
        <div style={{ flex: 1 }}>
          <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>{title}</h2>
          {subtitle && <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>{subtitle}</p>}
        </div>
      </div>
      {children}
    </GlassCard>
  )
}

function InnerCard({ children, accent }) {
  return (
    <div style={{
      padding: '16px 18px',
      background: 'rgba(0,0,0,0.45)',
      border: '1px solid rgba(255,255,255,0.06)',
      borderTopColor: 'rgba(255,255,255,0.10)',
      borderBottomColor: 'rgba(0,0,0,0.55)',
      borderLeft: accent ? `3px solid ${accent}` : undefined,
      borderRadius: 12,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.2)',
    }}>{children}</div>
  )
}

export default function WebsiteScannerTab() {
  const [url, setUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [screenshotLoaded, setScreenshotLoaded] = useState(false)

  const runScan = async () => {
    setError('')
    if (!url.trim()) {
      setError('Inserisci un URL valido')
      return
    }
    setData(null)
    setScreenshotLoaded(false)
    setScanning(true)

    try {
      const r = await fetch('/api/website-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url }),
      })
      const json = await r.json()
      // Set data anche se c'è un parse-error → cosi' mostra comunque
      // lo screenshot reale (Chromium fra1 IT) al posto del preview US
      if (json?.screenshotDataUrl || json?.screenshotUrl) setData(json)
      if (!r.ok || json.error) {
        setError(json?.error || `Errore ${r.status}`)
      } else {
        setData(json)
      }
    } catch (e) {
      setError(e?.message || 'Errore di rete')
    } finally {
      setScanning(false)
    }
  }

  const analysis = data?.analysis
  // screenshotDataUrl = vero screenshot usato per l'analisi (Browserless EU)
  // screenshotUrl = fallback CDN URL del servizio (ScreenshotOne/Microlink)
  const finalScreenshotUrl = data?.screenshotDataUrl || data?.screenshotUrl

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Input URL + Scan button */}
      <GlassCard padding={26}>
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 360px', minWidth: 280 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginBottom: 8 }}>
              URL della pagina da analizzare
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input
                type="text"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !scanning) runScan() }}
                placeholder="https://stmnfitness.com/products/tape-adesivo-nero"
                disabled={scanning}
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.45)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  color: '#fff',
                  borderRadius: 12,
                  padding: '13px 16px',
                  fontSize: 14,
                  outline: 'none',
                  fontFamily: 'monospace',
                }}
              />
              <button
                onClick={runScan}
                disabled={scanning}
                style={{
                  background: scanning
                    ? 'rgba(255,255,255,0.05)'
                    : `linear-gradient(135deg, ${ACCENT_GLOW}, #1e3a8a)`,
                  color: scanning ? 'var(--text3)' : '#fff',
                  border: 'none',
                  borderRadius: 12,
                  padding: '0 24px',
                  fontSize: 13.5,
                  fontWeight: 800,
                  cursor: scanning ? 'wait' : 'pointer',
                  letterSpacing: '0.04em',
                  boxShadow: scanning ? 'none' : `0 0 24px ${ACCENT_GLOW}44`,
                  textTransform: 'uppercase',
                  whiteSpace: 'nowrap',
                  display: 'flex', alignItems: 'center', gap: 8,
                }}
              >
                {scanning ? (
                  <>
                    <span style={{
                      display: 'inline-block', width: 12, height: 12,
                      border: '2px solid rgba(255,255,255,0.4)',
                      borderTopColor: '#fff', borderRadius: 999,
                      animation: 'spin 1s linear infinite',
                    }} />
                    Analizzando…
                  </>
                ) : (
                  <>▶ Scansiona</>
                )}
              </button>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 10, lineHeight: 1.5 }}>
              Inserisci l'URL di una landing, pagina prodotto, homepage o checkout. L'AI analizzerà lo screenshot secondo i principali framework CRO (Nielsen, ConversionXL, Baymard, Cialdini) e fornirà insight con esempi concreti.
            </div>
          </div>
        </div>
      </GlassCard>

      {error && (
        <div style={{
          padding: 16,
          background: 'rgba(239,68,68,0.08)',
          border: '1px solid rgba(239,68,68,0.4)',
          borderRadius: 14,
          color: '#fca5a5',
          fontSize: 13,
          fontWeight: 600,
        }}>{error}</div>
      )}

      {/* Preview screenshot + Results */}
      {(scanning || data) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.1fr)', gap: 18, alignItems: 'start' }}>
          {/* Screenshot */}
          <GlassCard padding={0} delay={0}>
            <div style={{
              padding: '16px 20px',
              borderBottom: '1px solid rgba(255,255,255,0.06)',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ fontSize: 10.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800 }}>
                  Landing Page Preview
                </div>
                {data?.provider && (
                  <span style={{
                    fontSize: 9, fontWeight: 800,
                    padding: '2px 8px', borderRadius: 999,
                    background: data.provider === 'browserless-eu' ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)',
                    color: data.provider === 'browserless-eu' ? '#86efac' : '#fcd34d',
                    letterSpacing: '0.08em', textTransform: 'uppercase',
                  }}>via {data.provider}</span>
                )}
              </div>
              {finalScreenshotUrl && (
                <a
                  href={data?.url || url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: 11, color: ACCENT_GLOW, fontWeight: 700, textDecoration: 'none' }}
                >
                  Apri ↗
                </a>
              )}
            </div>
            {Array.isArray(data?.fallbackErrors) && data.fallbackErrors.length > 0 && (
              <div style={{
                padding: '8px 16px',
                background: 'rgba(245,158,11,0.08)',
                borderBottom: '1px solid rgba(245,158,11,0.25)',
                fontSize: 10.5,
                color: '#fcd34d',
                fontWeight: 600,
              }}>
                {data.fallbackErrors.map((e, i) => (
                  <div key={i}>⚠ {e.provider}: {e.error}</div>
                ))}
              </div>
            )}
            {data?.debug && (
              <div style={{
                padding: '8px 16px',
                background: 'rgba(99,102,241,0.06)',
                borderBottom: '1px solid rgba(99,102,241,0.2)',
                fontSize: 10,
                color: '#a5b4fc',
                fontFamily: 'ui-monospace, monospace',
                lineHeight: 1.5,
              }}>
                <div>html.lang: <b>{data.debug.htmlLang ?? 'n/a'}</b></div>
                <div>navigator.language: <b>{data.debug.navigatorLang}</b></div>
                <div>weglot: <b>{String(data.debug.hasWeglot)}</b></div>
                <div style={{ wordBreak: 'break-all' }}>final URL: {data.debug.finalUrl}</div>
              </div>
            )}
            <div style={{
              position: 'relative',
              minHeight: 400,
              maxHeight: 800,
              overflow: 'hidden',
              background: 'rgba(0,0,0,0.4)',
            }}>
              {!screenshotLoaded && (
                <div style={{
                  position: 'absolute', inset: 0,
                  display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  gap: 14, color: 'var(--text3)',
                }}>
                  <div style={{
                    width: 32, height: 32,
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTopColor: ACCENT_GLOW,
                    borderRadius: 999,
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                    Cattura screenshot…
                  </div>
                </div>
              )}
              {finalScreenshotUrl && (
                <img
                  src={finalScreenshotUrl}
                  alt="Landing preview"
                  onLoad={() => setScreenshotLoaded(true)}
                  onError={() => setScreenshotLoaded(true)}
                  style={{
                    width: '100%',
                    display: 'block',
                    opacity: screenshotLoaded ? 1 : 0,
                    transition: 'opacity 0.4s ease',
                  }}
                />
              )}
            </div>
          </GlassCard>

          {/* Analysis results panel */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {scanning && !analysis && (
              <GlassCard padding={28} delay={0.3}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 16 }}>
                  <div style={{
                    width: 28, height: 28,
                    border: '3px solid rgba(255,255,255,0.1)',
                    borderTopColor: ACCENT_GLOW,
                    borderRadius: 999,
                    animation: 'spin 1s linear infinite',
                  }} />
                  <div>
                    <div style={{ color: '#fff', fontSize: 15, fontWeight: 900 }}>AI Senior CRO al lavoro…</div>
                    <div style={{ color: 'var(--text3)', fontSize: 12, marginTop: 2 }}>
                      Sto analizzando hero, CTA, trust signals, copy e visual hierarchy
                    </div>
                  </div>
                </div>
                <div style={{ display: 'grid', gap: 8 }}>
                  {[
                    'First impression analysis',
                    'Heuristic evaluation (Nielsen)',
                    'Persuasion principles (Cialdini)',
                    'Trust signals audit',
                    'CTA hierarchy & contrast',
                    'Copy & value proposition',
                    'Friction points & quick wins',
                  ].map((step, i) => (
                    <div key={step} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      fontSize: 12, color: 'var(--text2)',
                      animation: 'fadeUp 0.5s ease',
                      animationDelay: `${i * 0.15}s`,
                      animationFillMode: 'backwards',
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: ACCENT_GLOW,
                        animation: 'pa-pulse 1.4s infinite',
                        animationDelay: `${i * 80}ms`,
                      }} />
                      {step}
                    </div>
                  ))}
                </div>
              </GlassCard>
            )}

            {analysis && (
              <>
                {/* Score + summary card */}
                <GlassCard padding={26} delay={0}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 24, marginBottom: 16 }}>
                    <ScoreGauge score={analysis.overallScore} label={analysis.scoreLabel} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 900, letterSpacing: '-0.01em', marginBottom: 6 }}>
                        Analisi completata
                      </h2>
                      <p style={{ margin: 0, color: 'var(--text2)', fontSize: 13.5, lineHeight: 1.55 }}>
                        {analysis.summary}
                      </p>
                    </div>
                  </div>
                  {analysis.firstImpression && (
                    <InnerCard accent={ACCENT_GLOW}>
                      <div style={{ fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 6 }}>
                        Prima impressione (3 secondi)
                      </div>
                      <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.55 }}>
                        {analysis.firstImpression}
                      </div>
                    </InnerCard>
                  )}
                </GlassCard>

                {/* What works */}
                {Array.isArray(analysis.works) && analysis.works.length > 0 && (
                  <Section
                    title="Cosa funziona"
                    subtitle={`${analysis.works.length} elementi efficaci dal punto di vista CRO`}
                    dotColor="#22c55e"
                    delay={0.3}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {analysis.works.map((w, i) => (
                        <InnerCard key={i} accent="#22c55e">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 6 }}>
                            <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 800 }}>✓ {w.title}</div>
                            <ImpactPill impact={w.impact} />
                          </div>
                          <div style={{ color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.55 }}>{w.details}</div>
                        </InnerCard>
                      ))}
                    </div>
                  </Section>
                )}

                {/* What to improve */}
                {Array.isArray(analysis.improve) && analysis.improve.length > 0 && (
                  <Section
                    title="Da migliorare"
                    subtitle="Modifiche specifiche con copy e azioni concrete"
                    dotColor="#f59e0b"
                    delay={0.5}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                      {analysis.improve.map((it, i) => (
                        <InnerCard key={i} accent="#f59e0b">
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                            <div style={{ color: '#fff', fontSize: 14, fontWeight: 900 }}>{i + 1}. {it.title}</div>
                            <PrioPill priority={it.priority} />
                          </div>
                          {it.current && (
                            <div style={{ marginBottom: 8 }}>
                              <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 4 }}>Stato attuale</div>
                              <div style={{ color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.5 }}>{it.current}</div>
                            </div>
                          )}
                          <div style={{ marginBottom: 8 }}>
                            <div style={{ fontSize: 9, color: ACCENT_GLOW, textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 4 }}>Azione consigliata</div>
                            <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.55 }}>{it.suggestion}</div>
                          </div>
                          {it.example && (
                            <div style={{
                              marginTop: 10,
                              padding: '10px 12px',
                              background: 'rgba(41,151,255,0.08)',
                              border: '1px solid rgba(41,151,255,0.25)',
                              borderRadius: 8,
                              fontFamily: 'monospace',
                              fontSize: 12,
                              color: '#bfdbfe',
                              lineHeight: 1.55,
                            }}>
                              <div style={{ fontSize: 9, color: '#93c5fd', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 4, fontFamily: 'Inter' }}>Esempio</div>
                              {it.example}
                            </div>
                          )}
                          {it.expectedImpact && (
                            <div style={{ marginTop: 10, fontSize: 11.5, color: '#86efac', fontWeight: 700 }}>
                              ⌁ Impatto atteso: {it.expectedImpact}
                            </div>
                          )}
                        </InnerCard>
                      ))}
                    </div>
                  </Section>
                )}

                {/* What to remove */}
                {Array.isArray(analysis.remove) && analysis.remove.length > 0 && (
                  <Section
                    title="Da rimuovere o ridurre"
                    subtitle="Elementi che generano friction o cognitive load"
                    dotColor="#ef4444"
                    delay={0.7}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {analysis.remove.map((r, i) => (
                        <InnerCard key={i} accent="#ef4444">
                          <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 800, marginBottom: 6 }}>✕ {r.title}</div>
                          <div style={{ color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.55, marginBottom: r.alternative ? 8 : 0 }}>{r.reason}</div>
                          {r.alternative && (
                            <div style={{ fontSize: 12, color: '#86efac', fontWeight: 700, marginTop: 6 }}>
                              ↪ Sostituire con: <span style={{ color: 'var(--text)' }}>{r.alternative}</span>
                            </div>
                          )}
                        </InnerCard>
                      ))}
                    </div>
                  </Section>
                )}

                {/* Quick wins */}
                {Array.isArray(analysis.quickWins) && analysis.quickWins.length > 0 && (
                  <Section
                    title="Quick wins"
                    subtitle="Azioni veloci ad alto impatto da implementare oggi"
                    dotColor={ACCENT_GLOW}
                    delay={0.9}
                  >
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {analysis.quickWins.map((q, i) => (
                        <div key={i} style={{
                          display: 'flex', alignItems: 'flex-start', gap: 12,
                          padding: '12px 14px',
                          background: 'rgba(0,0,0,0.45)',
                          border: '1px solid rgba(255,255,255,0.06)',
                          borderTopColor: 'rgba(255,255,255,0.10)',
                          borderBottomColor: 'rgba(0,0,0,0.55)',
                          borderRadius: 10,
                        }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 6,
                            background: `linear-gradient(135deg, ${ACCENT_GLOW}, #1e3a8a)`,
                            color: '#fff', fontSize: 11, fontWeight: 900,
                            display: 'grid', placeItems: 'center',
                            flexShrink: 0,
                            boxShadow: `0 0 10px ${ACCENT_GLOW}66`,
                          }}>{i + 1}</div>
                          <div style={{ color: 'var(--text)', fontSize: 13, lineHeight: 1.55 }}>{q}</div>
                        </div>
                      ))}
                    </div>
                  </Section>
                )}

                {/* CTA + Trust + Copy analysis combined */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14 }}>
                  {analysis.ctaAnalysis && (
                    <GlassCard padding={22} delay={1.1}>
                      <div style={{ fontSize: 10, color: ACCENT_GLOW, textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginBottom: 12 }}>
                        CTA principale
                      </div>
                      <div style={{ color: '#fff', fontSize: 14, fontWeight: 900, marginBottom: 10, fontFamily: 'Barlow', letterSpacing: '-0.01em' }}>
                        "{analysis.ctaAnalysis.primaryCta}"
                      </div>
                      <div style={{ display: 'grid', gap: 6, fontSize: 11.5, marginBottom: 10 }}>
                        <div><span style={{ color: 'var(--text3)' }}>Posizione:</span> <span style={{ color: 'var(--text)' }}>{analysis.ctaAnalysis.position}</span></div>
                        <div><span style={{ color: 'var(--text3)' }}>Contrasto:</span> <span style={{ color: 'var(--text)' }}>{analysis.ctaAnalysis.contrast}</span></div>
                      </div>
                      <div style={{ color: 'var(--text2)', fontSize: 12.5, lineHeight: 1.55 }}>{analysis.ctaAnalysis.verdict}</div>
                    </GlassCard>
                  )}
                  {analysis.trustSignals && (
                    <GlassCard padding={22} delay={1.3}>
                      <div style={{ fontSize: 10, color: '#22c55e', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginBottom: 12 }}>
                        Trust signals
                      </div>
                      {Array.isArray(analysis.trustSignals.present) && analysis.trustSignals.present.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 11, color: '#86efac', fontWeight: 800, marginBottom: 6 }}>Presenti</div>
                          {analysis.trustSignals.present.map((t, i) => (
                            <div key={i} style={{ fontSize: 12, color: 'var(--text)', padding: '3px 0' }}>✓ {t}</div>
                          ))}
                        </div>
                      )}
                      {Array.isArray(analysis.trustSignals.missing) && analysis.trustSignals.missing.length > 0 && (
                        <div>
                          <div style={{ fontSize: 11, color: '#fca5a5', fontWeight: 800, marginBottom: 6 }}>Mancanti</div>
                          {analysis.trustSignals.missing.map((t, i) => (
                            <div key={i} style={{ fontSize: 12, color: 'var(--text2)', padding: '3px 0' }}>✕ {t}</div>
                          ))}
                        </div>
                      )}
                    </GlassCard>
                  )}
                  {analysis.copyAnalysis && (
                    <GlassCard padding={22} delay={1.5}>
                      <div style={{ fontSize: 10, color: '#a78bfa', textTransform: 'uppercase', letterSpacing: '0.14em', fontWeight: 800, marginBottom: 12 }}>
                        Copy & value proposition
                      </div>
                      <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 900, fontFamily: 'Barlow', letterSpacing: '-0.01em', marginBottom: 10 }}>
                        "{analysis.copyAnalysis.headline}"
                      </div>
                      <div style={{ display: 'grid', gap: 6, fontSize: 11.5 }}>
                        <div><span style={{ color: 'var(--text3)' }}>Value prop:</span> <span style={{ color: 'var(--text)' }}>{analysis.copyAnalysis.valueProposition}</span></div>
                        <div><span style={{ color: 'var(--text3)' }}>Tono:</span> <span style={{ color: 'var(--text)' }}>{analysis.copyAnalysis.tone}</span></div>
                      </div>
                    </GlassCard>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {!scanning && !data && (
        <GlassCard padding={48}>
          <div style={{ textAlign: 'center', maxWidth: 540, margin: '0 auto' }}>
            <div style={{
              fontSize: 64, marginBottom: 18,
              filter: `drop-shadow(0 0 24px ${ACCENT_GLOW}55)`,
            }}>🔍</div>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 22, fontWeight: 900, letterSpacing: '-0.02em', marginBottom: 10 }}>
              Analizza qualsiasi landing page
            </h2>
            <p style={{ margin: 0, color: 'var(--text3)', fontSize: 13.5, lineHeight: 1.6 }}>
              Inserisci sopra l'URL della pagina che vuoi analizzare. Un Senior CRO Specialist con expertise in heuristic evaluation, persuasion principles e best practice e-commerce ti darà un report dettagliato con cosa funziona, cosa migliorare con esempi concreti, cosa rimuovere e quick wins da implementare subito.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  )
}
