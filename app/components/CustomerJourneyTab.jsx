'use client'

import { useEffect, useRef, useState, useCallback } from 'react'

const ACCENT_GLOW = '#06b6d4'
const ACCENT_2 = '#3b82f6'
const PRESET_OPTIONS = [
  { value: 'current_month', label: 'Questo mese' },
  { value: 'last_month', label: 'Mese scorso' },
  { value: 'last_90d', label: '90 giorni' },
  { value: 'last_180d', label: '180 giorni' },
]

function fmtN(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return Math.round(n).toLocaleString('it-IT')
}

function fmtPct(n) {
  if (n == null || !Number.isFinite(n)) return '—'
  return `${n.toFixed(1)}%`
}

function GlassCard({ children, padding = 0, glow = ACCENT_GLOW, style = {} }) {
  return (
    <div
      style={{
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 18,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.65)',
        boxShadow: '0 20px 60px rgba(0,0,0,0.7), inset 0 1.5px 0 rgba(255,255,255,0.06)',
        animation: 'sim-pulse 6s ease-in-out infinite',
        ...style,
      }}
    >
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        opacity: 0.85, zIndex: 3, pointerEvents: 'none',
        animation: 'cr-shine 4s ease-in-out infinite',
      }} />
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%', width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: 'sim-scan 9s ease-in-out infinite',
        pointerEvents: 'none', zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )
}

// Single page row inside a column
function PageNode({ node, parentTotal, isSelected, isHovered, onClick, onHover, delay = 0 }) {
  const pct = parentTotal > 0 ? (node.sessions / parentTotal) * 100 : 0
  const barWidth = Math.max(2, Math.min(100, pct))

  return (
    <button
      type="button"
      onClick={onClick}
      onMouseEnter={onHover}
      style={{
        textAlign: 'left',
        width: '100%',
        background: isSelected
          ? `linear-gradient(135deg, ${ACCENT_GLOW}22, ${ACCENT_2}11)`
          : isHovered
            ? 'rgba(255,255,255,0.04)'
            : 'rgba(255,255,255,0.015)',
        border: isSelected
          ? `1.5px solid ${ACCENT_GLOW}88`
          : '1px solid rgba(255,255,255,0.06)',
        borderRadius: 11,
        padding: '10px 12px',
        cursor: 'pointer',
        color: 'var(--text)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
        transform: isSelected ? 'scale(1.02)' : 'scale(1)',
        boxShadow: isSelected ? `0 0 24px ${ACCENT_GLOW}33, inset 0 1px 0 rgba(255,255,255,0.06)` : 'none',
        animation: `fadeUp 0.4s ease ${delay}s both`,
      }}
    >
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        gap: 8,
        alignItems: 'baseline',
      }}>
        <div style={{
          fontSize: 12.5,
          fontWeight: 700,
          color: '#fff',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          maxWidth: 'calc(100% - 60px)',
        }}>{node.title}</div>
        <div style={{
          fontSize: 11,
          fontWeight: 800,
          color: ACCENT_GLOW,
          letterSpacing: '0.04em',
          whiteSpace: 'nowrap',
        }}>{fmtPct(pct)}</div>
      </div>
      <div style={{
        fontSize: 10,
        color: 'var(--text3)',
        fontFamily: 'ui-monospace, monospace',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
      }}>{node.path}</div>
      <div style={{
        position: 'relative',
        height: 4,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.04)',
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', inset: 0,
          width: `${barWidth}%`,
          background: `linear-gradient(90deg, ${ACCENT_GLOW}, ${ACCENT_2})`,
          borderRadius: 999,
          boxShadow: `0 0 10px ${ACCENT_GLOW}66`,
          transition: 'width 0.6s cubic-bezier(0.16, 1, 0.3, 1)',
        }} />
      </div>
      <div style={{
        fontSize: 13.5,
        fontWeight: 900,
        color: '#fff',
        letterSpacing: '-0.01em',
      }}>{fmtN(node.sessions)}<span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginLeft: 4 }}>sessioni</span></div>
    </button>
  )
}

function ColumnHeader({ label, sublabel, total }) {
  return (
    <div style={{
      padding: '14px 14px 12px',
      borderBottom: '1px solid rgba(255,255,255,0.06)',
      background: 'linear-gradient(180deg, rgba(6,182,212,0.08), transparent)',
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 800, letterSpacing: '0.16em',
        color: ACCENT_GLOW, textTransform: 'uppercase',
      }}>{label}</div>
      {sublabel && (
        <div style={{
          fontSize: 11,
          color: 'var(--text3)',
          marginTop: 4,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          fontFamily: 'ui-monospace, monospace',
        }} title={sublabel}>{sublabel}</div>
      )}
      {total != null && (
        <div style={{
          fontSize: 17,
          fontWeight: 900,
          color: '#fff',
          marginTop: 6,
          letterSpacing: '-0.02em',
        }}>{fmtN(total)}<span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginLeft: 5 }}>sessioni</span></div>
      )}
    </div>
  )
}

// Connettore SVG con gradient + shimmer animato tra due colonne
function FlowConnector({ visible }) {
  return (
    <div style={{
      width: 48,
      flexShrink: 0,
      display: 'flex',
      alignItems: 'stretch',
      justifyContent: 'center',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>
      <svg viewBox="0 0 48 200" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
        <defs>
          <linearGradient id="connGrad" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor={ACCENT_GLOW} stopOpacity="0.0" />
            <stop offset="50%" stopColor={ACCENT_GLOW} stopOpacity="0.8" />
            <stop offset="100%" stopColor={ACCENT_2} stopOpacity="0.0" />
          </linearGradient>
        </defs>
        <path d="M 0 100 Q 24 100 48 100" stroke="url(#connGrad)" strokeWidth="2" fill="none" />
        <circle r="2.5" fill={ACCENT_GLOW}>
          <animateMotion dur="2.6s" repeatCount="indefinite" path="M 0 100 Q 24 100 48 100" />
        </circle>
        <circle r="1.8" fill={ACCENT_2} opacity="0.7">
          <animateMotion dur="2.6s" begin="1.3s" repeatCount="indefinite" path="M 0 100 Q 24 100 48 100" />
        </circle>
      </svg>
    </div>
  )
}

function Column({ column, columnIndex, parentSessions, onSelectNode, selectedPath }) {
  const [hoveredPath, setHoveredPath] = useState(null)

  if (column.loading) {
    return (
      <GlassCard style={{ width: 280, flexShrink: 0, minHeight: 360 }}>
        <ColumnHeader label={`Passaggio +${columnIndex}`} sublabel="caricamento…" />
        <div style={{
          padding: 28,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 200,
        }}>
          <div style={{
            width: 30, height: 30,
            border: '3px solid rgba(255,255,255,0.1)',
            borderTopColor: ACCENT_GLOW,
            borderRadius: 999,
            animation: 'spin 1s linear infinite',
          }} />
        </div>
      </GlassCard>
    )
  }

  if (column.error) {
    return (
      <GlassCard style={{ width: 280, flexShrink: 0 }}>
        <ColumnHeader label={`Passaggio +${columnIndex}`} sublabel="errore" />
        <div style={{
          padding: 18,
          color: '#fca5a5',
          fontSize: 12,
          lineHeight: 1.5,
        }}>{column.error}</div>
      </GlassCard>
    )
  }

  const nodes = column.nodes || []
  const headerLabel = columnIndex === 0 ? 'Punto di partenza' : `Passaggio +${columnIndex}`
  const headerSublabel = column.fromPath || (columnIndex === 0 ? 'session_start' : null)

  return (
    <GlassCard style={{ width: 290, flexShrink: 0, display: 'flex', flexDirection: 'column' }}>
      <ColumnHeader
        label={headerLabel}
        sublabel={headerSublabel}
        total={parentSessions}
      />
      <div style={{
        padding: 14,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        overflowY: 'auto',
        maxHeight: 640,
      }}>
        {nodes.length === 0 && (
          <div style={{
            padding: '24px 8px',
            color: 'var(--text3)',
            fontSize: 12,
            textAlign: 'center',
            lineHeight: 1.5,
          }}>Nessuna pagina visitata oltre questa.</div>
        )}
        {nodes.map((node, i) => (
          <PageNode
            key={node.path}
            node={node}
            parentTotal={parentSessions}
            isSelected={selectedPath === node.path}
            isHovered={hoveredPath === node.path}
            onHover={() => setHoveredPath(node.path)}
            onClick={() => onSelectNode(columnIndex, node)}
            delay={i * 0.04}
          />
        ))}
      </div>
    </GlassCard>
  )
}

export default function CustomerJourneyTab() {
  const [preset, setPreset] = useState('current_month')
  const [columns, setColumns] = useState([{ loading: true, nodes: [] }])
  // selectedAt[i] = path stringa cliccato nella colonna i (per evidenziarlo)
  const [selectedAt, setSelectedAt] = useState({})
  const containerRef = useRef(null)
  const [configured, setConfigured] = useState(true)
  const [configReason, setConfigReason] = useState(null)
  const [configDebug, setConfigDebug] = useState(null)
  const [globalError, setGlobalError] = useState(null)

  const loadColumn = useCallback(async (pathArray, columnIndex, fromPath) => {
    const query = new URLSearchParams({
      preset,
      ...(pathArray.length ? { path: pathArray.join('|') } : {}),
    })
    try {
      const r = await fetch(`/api/customer-journey?${query.toString()}`)
      const json = await r.json()
      if (!json?.configured) {
        setConfigured(false)
        setConfigReason(json?.reason || null)
        setConfigDebug(json?.debug || null)
        return null
      }
      if (json?.error) {
        return { error: json.error, nodes: [], fromPath }
      }
      return {
        nodes: json.nodes || [],
        parentSessions: json.parentSessions || 0,
        rootSessions: json.rootSessions ?? null,
        approximated: !!json.approximated,
        provider: json.provider || null,
        ga4PropertyIdUsed: json.ga4PropertyIdUsed || null,
        fromPath,
      }
    } catch (e) {
      return { error: e?.message || 'Errore di rete', nodes: [], fromPath }
    }
  }, [preset])

  // Bootstrap: prima colonna (entry pages)
  useEffect(() => {
    let cancelled = false
    setColumns([{ loading: true, nodes: [] }])
    setSelectedAt({})
    setGlobalError(null)
    ;(async () => {
      const col = await loadColumn([], 0, 'session_start')
      if (cancelled) return
      if (!col) return // not configured
      setColumns([col])
    })()
    return () => { cancelled = true }
  }, [loadColumn])

  // Auto-scroll quando una nuova colonna appare
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTo({
        left: containerRef.current.scrollWidth,
        behavior: 'smooth',
      })
    }
  }, [columns.length])

  const onSelectNode = useCallback(async (columnIndex, node) => {
    // Aggiorna il path selezionato in questa colonna
    setSelectedAt(prev => {
      const next = { ...prev }
      // Pulisce le selezioni a destra
      Object.keys(next).forEach(k => { if (Number(k) > columnIndex) delete next[k] })
      next[columnIndex] = node.path
      return next
    })

    // Costruisci il path cumulativo fino a qui (escludendo session_start)
    const breadcrumbPaths = []
    for (let i = 0; i <= columnIndex; i++) {
      if (i === columnIndex) breadcrumbPaths.push(node.path)
      else if (selectedAt[i]) breadcrumbPaths.push(selectedAt[i])
    }
    // Per il livello 0 (entry) il path[0] e' la landing scelta;
    // per livello 1+ aggiungiamo le pagine successive cliccate.

    // Rimuovi tutte le colonne a destra di questa, aggiungi quella nuova (loading)
    setColumns(prev => {
      const trimmed = prev.slice(0, columnIndex + 1)
      return [...trimmed, { loading: true, nodes: [], fromPath: node.path }]
    })

    const newCol = await loadColumn(breadcrumbPaths, columnIndex + 1, node.path)
    if (!newCol) {
      setConfigured(false)
      return
    }
    setColumns(prev => {
      const next = [...prev]
      next[columnIndex + 1] = newCol
      return next
    })
  }, [loadColumn, selectedAt])

  if (!configured) {
    const codeBg = { background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: 4 }
    return (
      <GlassCard padding={32} style={{ animation: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14, alignItems: 'flex-start' }}>
          <div style={{ fontSize: 22, fontWeight: 900, color: '#fff' }}>BigQuery non configurato</div>
          {configReason && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.3)',
              color: '#fca5a5',
              fontSize: 12.5,
              fontFamily: 'ui-monospace, monospace',
              lineHeight: 1.5,
              wordBreak: 'break-word',
            }}>{configReason}</div>
          )}
          {configDebug && (
            <div style={{
              padding: '10px 14px',
              borderRadius: 10,
              background: 'rgba(99,102,241,0.06)',
              border: '1px solid rgba(99,102,241,0.2)',
              color: '#a5b4fc',
              fontSize: 11,
              fontFamily: 'ui-monospace, monospace',
              lineHeight: 1.6,
            }}>
              <div>BIGQUERY_PROJECT_ID: <b>{configDebug.hasProjectId ? `"${configDebug.projectId}"` : '—'}</b></div>
              <div>BIGQUERY_DATASET: <b>{configDebug.hasDataset ? `"${configDebug.dataset}"` : '—'}</b></div>
              <div>GOOGLE_SERVICE_ACCOUNT_JSON: <b>{configDebug.hasJson ? `${configDebug.jsonLength} chars` : '—'}</b></div>
            </div>
          )}
          <div style={{ color: 'var(--text2)', fontSize: 13.5, lineHeight: 1.6 }}>
            Customer Journey usa BigQuery export GA4. Servono su Vercel: <code style={codeBg}>BIGQUERY_PROJECT_ID</code>, <code style={codeBg}>BIGQUERY_DATASET</code>, <code style={codeBg}>GOOGLE_SERVICE_ACCOUNT_JSON</code> (il contenuto INTERO del JSON key del Service Account). Dopo le env vars serve un Redeploy da Vercel → Deployments.
          </div>
        </div>
      </GlassCard>
    )
  }

  const isApproximated = columns.some(c => c?.approximated)
  const provider = columns.find(c => c?.provider)?.provider || null
  const ga4PropertyIdUsed = columns.find(c => c?.ga4PropertyIdUsed)?.ga4PropertyIdUsed || null
  const rootSessions = columns[0]?.rootSessions ?? columns[0]?.parentSessions ?? null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header: titolo + selettore giorni */}
      <GlassCard padding="18px 22px">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ fontSize: 9.5, color: ACCENT_GLOW, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
                Customer Journey
              </div>
              {provider && (
                <span style={{
                  fontSize: 9, fontWeight: 800,
                  padding: '2px 8px', borderRadius: 999,
                  background: provider === 'bigquery' ? 'rgba(34,197,94,0.18)' : 'rgba(245,158,11,0.18)',
                  color: provider === 'bigquery' ? '#86efac' : '#fcd34d',
                  letterSpacing: '0.08em', textTransform: 'uppercase',
                }}>via {provider}</span>
              )}
              {ga4PropertyIdUsed && (
                <span style={{
                  fontSize: 9, fontWeight: 700,
                  color: 'var(--text3)',
                  fontFamily: 'ui-monospace, monospace',
                }}>property {ga4PropertyIdUsed}</span>
              )}
            </div>
            <div style={{ fontSize: 22, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: 4 }}>
              Esplora il percorso di navigazione
            </div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>
              Clicca su una pagina per espandere il passaggio successivo. {rootSessions != null && <>Totale sessioni periodo: <b style={{ color: '#fff' }}>{fmtN(rootSessions)}</b>.</>}
            </div>
          </div>

          <div style={{
            display: 'inline-flex',
            background: 'rgba(0,0,0,0.45)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 999,
            padding: 3,
            gap: 2,
          }}>
            {PRESET_OPTIONS.map(opt => {
              const active = preset === opt.value
              return (
                <button
                  key={opt.value}
                  onClick={() => setPreset(opt.value)}
                  style={{
                    background: active ? `linear-gradient(135deg, ${ACCENT_GLOW}, ${ACCENT_2})` : 'transparent',
                    color: active ? '#fff' : 'var(--text3)',
                    border: 'none',
                    borderRadius: 999,
                    padding: '7px 14px',
                    fontSize: 11.5,
                    fontWeight: 700,
                    cursor: 'pointer',
                    letterSpacing: '0.04em',
                    boxShadow: active ? `0 0 16px ${ACCENT_GLOW}55` : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >{opt.label}</button>
              )
            })}
          </div>
        </div>

        {isApproximated && (
          <div style={{
            marginTop: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'rgba(245,158,11,0.08)',
            border: '1px solid rgba(245,158,11,0.25)',
            color: '#fcd34d',
            fontSize: 11.5,
            lineHeight: 1.5,
          }}>
            ⓘ Fallback GA4 Data API attivo: BigQuery export non ancora popolato. Oltre il primo passaggio i dati sono approssimati ("sessioni partite da {selectedAt[0]} che hanno visitato questa pagina", non vera sequenza). Appena BigQuery riceve le tabelle events_*, il backend switcha automaticamente al vero sankey sequenziale.
          </div>
        )}
      </GlassCard>

      {/* Flow container — colonne + connettori */}
      <div
        ref={containerRef}
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          gap: 0,
          overflowX: 'auto',
          overflowY: 'visible',
          padding: '4px 4px 16px',
          scrollbarWidth: 'thin',
          scrollbarColor: 'rgba(255,255,255,0.18) transparent',
        }}
      >
        {columns.map((col, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'stretch' }}>
            <Column
              column={col}
              columnIndex={i}
              parentSessions={col.parentSessions ?? rootSessions ?? 0}
              onSelectNode={onSelectNode}
              selectedPath={selectedAt[i]}
            />
            {i < columns.length - 1 && <FlowConnector visible={true} />}
          </div>
        ))}
      </div>
    </div>
  )
}
