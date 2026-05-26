'use client'

import { useEffect, useState, useMemo } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
const fmtP = n => n != null ? `${n.toFixed(1)}%` : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'
const DAYS_OPTIONS = [7, 14, 30, 60, 90]

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0a1020', border: '1px solid #1e2d47', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontWeight: 700 }}>
      <p style={{ color: '#888', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('it-IT') : p.value}</p>)}
    </div>
  )
}

function Card({ label, value, color = '#fff', sub }) {
  return (
    <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 14, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, color: '#776a86', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 950, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#776a86', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function InsightBox({ title, insights }) {
  if (!insights?.length) return null
  return (
    <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '24px 28px', marginTop: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: '#8b5cf6', marginBottom: 16 }}>{title}</div>
      {insights.map((ins, i) => (
        <div key={i} style={{ padding: '10px 0', borderBottom: i < insights.length - 1 ? '1px solid #1e1530' : 'none', color: '#f7f2ff', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{ins}</div>
      ))}
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort, align = 'right' }) {
  const active = sortField === field
  return (
    <th onClick={() => onSort(field)} style={{
      padding: '14px 16px', textAlign: align, color: active ? '#c4b5fd' : '#776a86',
      fontWeight: 800, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap',
    }}>{label} {active ? (sortDir === 'desc' ? '↓' : '↑') : ''}</th>
  )
}

// ── GA4-style Funnel ──
function GA4Funnel({ funnel }) {
  const steps = [
    { name: 'Avvio sessione', value: funnel.sessions, color: '#8b5cf6' },
    { name: 'Visualizza prodotto', value: Math.round(funnel.pageViews * 0.75) || Math.round(funnel.sessions * 0.75), color: '#3b82f6' },
    { name: 'Aggiungi al carrello', value: funnel.addToCart, color: '#06b6d4' },
    { name: 'Inizia pagamento', value: funnel.checkout, color: '#f59e0b' },
    { name: 'Acquista', value: funnel.purchase, color: '#22c55e' },
  ]

  const maxVal = steps[0].value || 1

  return (
    <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>Purchase Journey</div>
        <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: '#22c55e22', color: '#22c55e' }}>{funnel.source}</span>
      </div>

      {/* Step headers */}
      <div style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
        {steps.map((s, i) => {
          const pct = i === 0 ? 100 : steps[0].value > 0 ? (s.value / steps[0].value) * 100 : 0
          const dropPct = i > 0 && steps[i - 1].value > 0 ? ((steps[i - 1].value - s.value) / steps[i - 1].value) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, padding: '0 8px', borderLeft: i > 0 ? '1px solid #292134' : 'none' }}>
              <div style={{ fontSize: 10, color: '#776a86', fontWeight: 700, marginBottom: 2 }}>Passaggio {i + 1}</div>
              <div style={{ fontSize: 13, color: '#f7f2ff', fontWeight: 800 }}>{s.name}</div>
              <div style={{ fontSize: 20, fontWeight: 950, color: '#fff', marginTop: 4 }}>{fmtP(pct)}</div>
            </div>
          )
        })}
      </div>

      {/* Bars */}
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 200, marginBottom: 16 }}>
        {steps.map((s, i) => {
          const pct = maxVal > 0 ? (s.value / maxVal) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 800, marginBottom: 4 }}>{fmtN(s.value)}</div>
              <div style={{ width: '80%', background: s.color, borderRadius: '6px 6px 0 0', height: `${Math.max(pct, 2)}%`, transition: 'height .6s', opacity: 0.85 }} />
            </div>
          )
        })}
      </div>

      {/* Dropoff row */}
      <div style={{ display: 'flex', gap: 12 }}>
        {steps.map((s, i) => {
          if (i === 0) return <div key={i} style={{ flex: 1 }} />
          const drop = steps[i - 1].value - s.value
          const dropPct = steps[i - 1].value > 0 ? (drop / steps[i - 1].value) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#776a86', marginBottom: 2 }}>Tasso di abbandono</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#ef4444' }}>{fmtN(drop)} · {fmtP(dropPct)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── Flow with expandable nodes ──
function FlowDiagram({ nodes, links, expanded, onExpand }) {
  if (!nodes?.length) return <div style={{ color: '#776a86', padding: 20 }}>Dati flusso non disponibili</div>

  const width = 1200
  const height = 700
  const levelX = [50, 220, 580, 820, 1020]
  const nodeW = 160
  const nodeH = 42
  const nodeGap = 8

  const levels = {}
  for (const n of nodes) { const l = n.level ?? 0; if (!levels[l]) levels[l] = []; levels[l].push(n) }
  for (const lvl of Object.values(levels)) lvl.sort((a, b) => b.value - a.value)

  const nodeMap = {}
  for (const [li, ns] of Object.entries(levels)) {
    const x = levelX[parseInt(li)] || parseInt(li) * 220 + 50
    const totalH = ns.length * nodeH + (ns.length - 1) * nodeGap
    let y = Math.max(10, (height - totalH) / 2)
    for (const n of ns) { nodeMap[n.id] = { ...n, x, y, w: nodeW, h: nodeH }; y += nodeH + nodeGap }
  }

  const maxVal = Math.max(...nodes.map(n => n.value), 1)
  const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a78bfa', '#f97316', '#14b8a6', '#e879f9', '#fbbf24']

  const isHighlighted = (nodeId) => {
    if (!expanded) return true
    if (nodeId === expanded) return true
    return links.some(l => (l.source === expanded && l.target === nodeId) || (l.target === expanded && l.source === nodeId))
  }

  const isLinkHighlighted = (link) => {
    if (!expanded) return true
    return link.source === expanded || link.target === expanded
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {links.map((link, i) => {
          const src = nodeMap[link.source], tgt = nodeMap[link.target]
          if (!src || !tgt) return null
          const x1 = src.x + src.w, y1 = src.y + src.h / 2, x2 = tgt.x, y2 = tgt.y + tgt.h / 2
          const cx = (x1 + x2) / 2
          const thickness = Math.max(2, (link.value / maxVal) * 28)
          const color = colors[i % colors.length]
          const highlighted = isLinkHighlighted(link)
          return (
            <g key={i} style={{ opacity: highlighted ? 1 : 0.1, transition: 'opacity .3s' }}>
              <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`} fill="none" stroke={color} strokeWidth={thickness} strokeOpacity={0.35} />
              {highlighted && <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 12} textAnchor="middle" fill={color} fontSize={10} fontWeight={800}>{fmtN(link.value)}</text>}
            </g>
          )
        })}
        {Object.values(nodeMap).map((n) => {
          const isExp = expanded === n.id
          const highlighted = isHighlighted(n.id)
          const isClickable = n.level === 1
          return (
            <g key={n.id} onClick={() => isClickable && onExpand(isExp ? null : n.id)}
               style={{ cursor: isClickable ? 'pointer' : 'default', opacity: highlighted ? 1 : 0.15, transition: 'opacity .3s' }}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10}
                fill={isExp ? '#1a1525' : '#110d1a'} stroke={isExp ? '#8b5cf6' : '#292134'} strokeWidth={isExp ? 2 : 1} />
              <text x={n.x + 14} y={n.y + 18} fill="#f7f2ff" fontSize={11} fontWeight={800}>
                {n.name.length > 18 ? n.name.slice(0, 17) + '…' : n.name}
              </text>
              <text x={n.x + 14} y={n.y + 33} fill="#776a86" fontSize={10} fontWeight={700}>{fmtN(n.value)} views</text>
              {isClickable && <text x={n.x + n.w - 18} y={n.y + 26} fill={isExp ? '#8b5cf6' : '#776a86'} fontSize={14} fontWeight={900}>{isExp ? '−' : '+'}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ── Scanner components ──
function ScoreRing({ score }) {
  const r = 44, circ = 2 * Math.PI * r, offset = circ - (score / 100) * circ
  const color = score >= 70 ? '#22c55e' : score >= 40 ? '#f59e0b' : '#ef4444'
  return (
    <svg width={100} height={100}>
      <circle cx={50} cy={50} r={r} fill="none" stroke="#292134" strokeWidth={8} />
      <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={8} strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round" transform="rotate(-90 50 50)" style={{ transition: 'stroke-dashoffset .8s' }} />
      <text x={50} y={50} textAnchor="middle" dominantBaseline="central" fill="#fff" fontSize={22} fontWeight={950}>{score}</text>
    </svg>
  )
}

function SeverityBadge({ severity }) {
  const c = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#776a86' }[severity] || '#776a86'
  return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6, background: `${c}22`, color: c }}>{severity?.toUpperCase()}</span>
}

function AttentionBar({ sections }) {
  if (!sections?.length) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Stima Attenzione Utente</div>
      {sections.map((s, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
          <span style={{ fontSize: 10, color: '#9b90aa', width: 100, flexShrink: 0 }}>{s.area}</span>
          <div style={{ flex: 1, height: 14, background: '#1a1525', borderRadius: 4, overflow: 'hidden' }}>
            <div style={{ height: '100%', borderRadius: 4, width: `${s.attention}%`, background: s.attention >= 70 ? '#22c55e' : s.attention >= 40 ? '#f59e0b' : '#ef4444', transition: 'width .6s' }} />
          </div>
          <span style={{ fontSize: 10, fontWeight: 800, color: s.attention >= 70 ? '#22c55e' : s.attention >= 40 ? '#f59e0b' : '#ef4444', width: 35 }}>{s.attention}%</span>
        </div>
      ))}
    </div>
  )
}

// ── Main Component ──
export default function CROTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [scanUrl, setScanUrl] = useState('')
  const [scanning, setScanning] = useState(false)
  const [scanResult, setScanResult] = useState(null)
  const [scanError, setScanError] = useState(null)
  const [activeSection, setActiveSection] = useState('funnel')
  const [sortField, setSortField] = useState('sessions')
  const [sortDir, setSortDir] = useState('desc')
  const [expandedNode, setExpandedNode] = useState(null)

  useEffect(() => {
    let active = true; setLoading(true)
    fetch(`/api/cro?days=${days}`, { cache: 'no-store' })
      .then(r => r.json()).then(json => { if (active) setData(json) })
      .catch(() => {}).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortedPages = useMemo(() => {
    const pages = [...(data?.topPages || [])]
    pages.sort((a, b) => sortDir === 'desc' ? (b[sortField] ?? 0) - (a[sortField] ?? 0) : (a[sortField] ?? 0) - (b[sortField] ?? 0))
    return pages
  }, [data?.topPages, sortField, sortDir])

  const runScan = async () => {
    if (!scanUrl.trim() || scanning) return
    setScanning(true); setScanError(null); setScanResult(null)
    try {
      const r = await fetch('/api/cro/scan', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ url: scanUrl.trim() }) })
      const json = await r.json()
      if (!r.ok) { setScanError(json.error || 'Errore'); return }
      setScanResult(json.analysis)
    } catch (e) { setScanError(e.message) }
    finally { setScanning(false) }
  }

  const funnelInsights = useMemo(() => {
    if (!data?.funnel) return []
    const f = data.funnel, ins = []
    if (f.purchaseRate < 1) ins.push(`Conversion rate al ${fmtP(f.purchaseRate)} — sotto il benchmark minimo (1%). Un +1% genererebbe ~${fmtN(Math.round(f.sessions * 0.01))} ordini in più.`)
    else if (f.purchaseRate >= 2) ins.push(`Conversion rate al ${fmtP(f.purchaseRate)} — sopra la media e-commerce. Buon lavoro, Marino.`)
    if (f.cartToCheckout < 50) ins.push(`Solo il ${fmtP(f.cartToCheckout)} passa dal carrello al checkout. Drop di ${fmtN(f.dropoffs?.cartToCheckout)} utenti — possibili cause: spedizione, mancanza urgency, checkout complesso.`)
    if (f.checkoutToPurchase < 60) ins.push(`Completion rate checkout: ${fmtP(f.checkoutToPurchase)}. Perdi ${fmtN(f.dropoffs?.checkoutToPurchase)} utenti — controllare form, metodi pagamento, trust signals.`)
    if (f.addToCartRate < 5) ins.push(`ATC rate al ${fmtP(f.addToCartRate)} — le PDP non convertono. Migliorare foto, copy, social proof, posizione CTA.`)
    ins.push(`Revenue totale: ${fmtE(data.totalRevenue)} da ${fmtN(data.totalOrders)} ordini Shopify (${fmtN(data.shopifyOrders)} confermati).`)
    return ins
  }, [data])

  const tabs = [
    { id: 'funnel', label: 'Funnel' },
    { id: 'pages', label: 'Top Pages' },
    { id: 'flow', label: 'Flusso Traffico' },
    { id: 'scanner', label: 'Page Scanner' },
  ]

  return (
    <div>
      <p style={{ color: '#9f93ad', fontSize: 13, margin: '0 0 20px' }}>Marino, ecco l'analisi CRO del tuo store</p>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveSection(t.id)} style={{
              border: activeSection === t.id ? '1px solid #8b5cf6' : '1px solid #292134',
              background: activeSection === t.id ? '#8b5cf622' : '#110d1a',
              color: activeSection === t.id ? '#c4b5fd' : '#9b90aa',
              borderRadius: 10, padding: '10px 18px', fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {DAYS_OPTIONS.map(d => (
            <button key={d} onClick={() => setDays(d)} style={{
              border: days === d ? '1px solid #8b5cf6' : '1px solid #292134',
              background: days === d ? '#8b5cf622' : '#110d1a',
              color: days === d ? '#c4b5fd' : '#9b90aa',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>{d}g</button>
          ))}
        </div>
      </div>

      {loading && <div style={{ color: '#9b90aa', padding: 40, fontWeight: 700 }}>Carico i dati CRO...</div>}
      {!loading && data?.error && <div style={{ color: '#ef4444', padding: 20 }}>Errore: {data.error}</div>}

      {/* FUNNEL */}
      {!loading && !data?.error && activeSection === 'funnel' && (
        <>
          <GA4Funnel funnel={data.funnel} />

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginTop: 20 }}>
            <Card label="Sessioni" value={fmtN(data.funnel.sessions)} color="#8b5cf6" />
            <Card label="Add to Cart Rate" value={fmtP(data.funnel.addToCartRate)} color="#06b6d4" />
            <Card label="Cart → Checkout" value={fmtP(data.funnel.cartToCheckout)} color="#f59e0b" />
            <Card label="Checkout → Purchase" value={fmtP(data.funnel.checkoutToPurchase)} color="#22c55e" />
            <Card label="Conversion Rate" value={fmtP(data.funnel.purchaseRate)} color={data.funnel.purchaseRate >= 2 ? '#22c55e' : '#ef4444'} />
            <Card label="Revenue" value={fmtE(data.totalRevenue)} color="#22c55e" />
            {data.funnel.bounceRate != null && <Card label="Bounce Rate" value={fmtP(data.funnel.bounceRate * 100)} color={data.funnel.bounceRate > 0.5 ? '#ef4444' : '#f59e0b'} />}
            {data.funnel.avgDuration != null && <Card label="Durata Media" value={`${Math.round(data.funnel.avgDuration)}s`} color="#06b6d4" />}
          </div>

          <InsightBox title="Analisi Funnel" insights={funnelInsights} />
        </>
      )}

      {/* TOP PAGES */}
      {!loading && !data?.error && activeSection === 'pages' && (
        <>
          <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', minWidth: 1000, borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #292134' }}>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>#</th>
                    <th style={{ padding: '14px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Pagina</th>
                    <SortHeader label="Sessioni" field="sessions" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Page Views" field="pageViews" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    {data?.hasGA4 && <SortHeader label="ATC" field="addToCarts" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                    <SortHeader label="Ordini" field="orders" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Revenue" field="revenue" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    <SortHeader label="Conv. Rate" field="conversionRate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                  </tr>
                </thead>
                <tbody>
                  {sortedPages.map((p, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid #1e1530' }}>
                      <td style={{ padding: '12px 16px', color: '#776a86', fontWeight: 700 }}>{i + 1}</td>
                      <td style={{ padding: '12px 16px', color: '#f7f2ff', fontWeight: 700, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title || p.page}</td>
                      <td style={{ padding: '12px 16px', color: '#c4b5fd', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.sessions)}</td>
                      <td style={{ padding: '12px 16px', color: '#9b90aa', fontWeight: 700, textAlign: 'right' }}>{fmtN(p.pageViews)}</td>
                      {data?.hasGA4 && <td style={{ padding: '12px 16px', color: '#06b6d4', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.addToCarts)}</td>}
                      <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.orders)}</td>
                      <td style={{ padding: '12px 16px', color: '#f59e0b', fontWeight: 800, textAlign: 'right' }}>{fmtE(p.revenue)}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 900, textAlign: 'right', color: p.conversionRate >= 2 ? '#22c55e' : p.conversionRate >= 1 ? '#f59e0b' : '#ef4444' }}>{fmtP(p.conversionRate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Sessioni per pagina</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sortedPages.slice(0, 10).map(p => ({ name: (p.title || p.page).slice(0, 25), sessions: p.sessions }))} layout="vertical" margin={{ left: 130 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e1530" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#776a86', fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#c4b5fd', fontSize: 9, fontWeight: 700 }} axisLine={false} width={130} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="sessions" name="Sessioni" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
              <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Ordini e Revenue per pagina</div>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={sortedPages.filter(p => p.orders > 0).slice(0, 10).map(p => ({ name: (p.title || p.page).slice(0, 25), ordini: p.orders, revenue: p.revenue }))} layout="vertical" margin={{ left: 130 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e1530" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#776a86', fontSize: 10 }} axisLine={false} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#c4b5fd', fontSize: 9, fontWeight: 700 }} axisLine={false} width={130} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="ordini" name="Ordini" fill="#22c55e" radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <InsightBox title="Analisi Top Pages" insights={[
            sortedPages[0] ? `Pagina più visitata: "${sortedPages[0].title || sortedPages[0].page}" con ${fmtN(sortedPages[0].sessions)} sessioni e CR ${fmtP(sortedPages[0].conversionRate)}.` : '',
            ...sortedPages.filter(p => p.conversionRate > 3 && p.sessions > 10).slice(0, 2).map(p => `"${p.title || p.page}" ha un CR alto (${fmtP(p.conversionRate)}) — analizza e replica il pattern.`),
            ...sortedPages.filter(p => p.conversionRate < 0.5 && p.sessions > 50).slice(0, 2).map(p => `"${p.title || p.page}": ${fmtN(p.sessions)} sessioni ma CR solo ${fmtP(p.conversionRate)} — priorità CRO alta.`),
          ].filter(Boolean)} />
        </>
      )}

      {/* FLOW */}
      {!loading && !data?.error && activeSection === 'flow' && (
        <>
          <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 950, color: '#fff' }}>Canalizzazione del Traffico</div>
                <div style={{ fontSize: 12, color: '#776a86', marginTop: 4 }}>Clicca su una pagina per evidenziare dove vanno gli utenti</div>
              </div>
              {expandedNode && <button onClick={() => setExpandedNode(null)} style={{ background: '#1a1525', border: '1px solid #8b5cf6', borderRadius: 8, padding: '8px 16px', color: '#c4b5fd', fontSize: 12, fontWeight: 800, cursor: 'pointer' }}>Mostra tutto</button>}
            </div>
            <FlowDiagram nodes={data?.flow?.nodes} links={data?.flow?.links} expanded={expandedNode} onExpand={setExpandedNode} />
          </div>

          <InsightBox title="Analisi Flusso" insights={[
            `${fmtN(data?.flow?.nodes?.find(n => n.id === 'start')?.value)} sessioni totali distribuite su ${data?.flow?.nodes?.filter(n => n.level === 1)?.length || 0} pagine principali.`,
            ...((data?.flow?.nodes || []).filter(n => n.level === 1).sort((a, b) => b.value - a.value).slice(0, 3).map(n => `"${n.name}": ${fmtN(n.value)} visualizzazioni — ${n.isHome ? 'punto d\'ingresso principale.' : 'pagina ad alto traffico.'}`)),
            `Dal flusso al carrello: ${fmtN(data?.funnel?.addToCart)} aggiunte. Dal checkout all'acquisto: ${fmtN(data?.funnel?.purchase)} conversioni (${fmtP(data?.funnel?.checkoutToPurchase)}).`,
          ]} />
        </>
      )}

      {/* SCANNER */}
      {activeSection === 'scanner' && (
        <>
          <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Analizza una pagina</div>
            <div style={{ fontSize: 12, color: '#776a86', marginBottom: 14 }}>L'AI analizzerà UX, CTA, trust signals, copy e struttura</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="url" value={scanUrl} onChange={e => setScanUrl(e.target.value)} placeholder="https://stmnfitness.com/products/..." onKeyDown={e => e.key === 'Enter' && runScan()}
                style={{ flex: 1, background: '#1a1525', border: '1px solid #292134', color: '#fff', borderRadius: 12, padding: '14px 18px', fontSize: 14, outline: 'none' }} />
              <button onClick={runScan} disabled={scanning || !scanUrl.trim()} style={{
                background: scanning ? '#2a1f3f' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: '#fff', border: 'none', borderRadius: 12, padding: '0 28px', fontWeight: 900, fontSize: 14, cursor: scanning ? 'not-allowed' : 'pointer',
              }}>{scanning ? 'Analisi...' : 'Scansiona'}</button>
            </div>
          </div>

          {scanning && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, overflow: 'hidden', height: 420 }}>
                <iframe src={scanUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" sandbox="allow-same-origin allow-scripts" />
              </div>
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 48, height: 48, border: '4px solid #292134', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ color: '#c4b5fd', fontWeight: 800, marginTop: 16, fontSize: 14 }}>Analisi AI in corso...</div>
                <div style={{ color: '#776a86', fontSize: 12, marginTop: 6 }}>UX · Copy · CTA · Trust Signals · Struttura · Mobile</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            </div>
          )}

          {scanError && <div style={{ background: '#ef444415', border: '1px solid #ef444455', borderRadius: 12, padding: '12px 16px', color: '#fecaca', fontSize: 13, marginBottom: 16 }}>{scanError}</div>}

          {scanResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 16 }}>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <ScoreRing score={scanResult.score} />
                  <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 8, fontWeight: 700 }}>CRO Score</div>
                </div>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 16, fontWeight: 900, color: '#fff', marginBottom: 12 }}>{scanResult.verdict}</div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#22c55e', marginBottom: 8 }}>PUNTI DI FORZA</div>
                  {(scanResult.strengths || []).map((s, i) => <div key={i} style={{ color: '#c4b5fd', fontSize: 12, padding: '3px 0', lineHeight: 1.5 }}>✓ {s}</div>)}
                </div>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, overflow: 'hidden' }}>
                  <iframe src={scanUrl} style={{ width: '100%', height: '100%', border: 'none' }} title="Preview" sandbox="allow-same-origin allow-scripts" />
                </div>
              </div>

              {scanResult.attentionMap && (
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <AttentionBar sections={scanResult.attentionMap} />
                </div>
              )}

              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444', marginBottom: 16 }}>Problemi ({(scanResult.issues || []).length})</div>
                {(scanResult.issues || []).map((issue, i) => (
                  <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}><SeverityBadge severity={issue.severity} /><span style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 14 }}>{issue.title}</span></div>
                    <div style={{ color: '#9b90aa', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{issue.description}</div>
                    <div style={{ background: '#110d1a', borderRadius: 8, padding: '10px 14px' }}><span style={{ color: '#22c55e', fontSize: 11, fontWeight: 800 }}>FIX → </span><span style={{ color: '#c4b5fd', fontSize: 12, lineHeight: 1.5 }}>{issue.fix}</span></div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', marginBottom: 16 }}>Colli di Bottiglia</div>
                {(scanResult.bottlenecks || []).map((b, i) => (
                  <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                    <div style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{b.area}</div>
                    <div style={{ color: '#9b90aa', fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{b.problem}</div>
                    <div style={{ fontSize: 12 }}><span style={{ color: '#f59e0b', fontWeight: 800 }}>Impatto: </span><span style={{ color: '#e2dcf0' }}>{b.impact}</span></div>
                    <div style={{ fontSize: 12, marginTop: 2 }}><span style={{ color: '#22c55e', fontWeight: 800 }}>Fix: </span><span style={{ color: '#e2dcf0' }}>{b.solution}</span></div>
                  </div>
                ))}
              </div>

              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e', marginBottom: 16 }}>Quick Wins</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {(scanResult.quickWins || []).map((qw, i) => (
                    <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '16px 20px' }}>
                      <div style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{qw.action}</div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 6 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: qw.impact === 'high' ? '#22c55e22' : '#f59e0b22', color: qw.impact === 'high' ? '#22c55e' : '#f59e0b', fontWeight: 800 }}>Impatto: {qw.impact}</span>
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: qw.effort === 'low' ? '#22c55e22' : '#f59e0b22', color: qw.effort === 'low' ? '#22c55e' : '#f59e0b', fontWeight: 800 }}>Effort: {qw.effort}</span>
                      </div>
                      <div style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>{qw.expectedLift}</div>
                    </div>
                  ))}
                </div>
              </div>

              {scanResult.recommendations?.length > 0 && (
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 14, fontWeight: 900, color: '#8b5cf6', marginBottom: 14 }}>Raccomandazioni Strategiche</div>
                  {scanResult.recommendations.map((r, i) => (
                    <div key={i} style={{ color: '#e2dcf0', fontSize: 13, padding: '8px 0', lineHeight: 1.6, fontWeight: 600, borderBottom: i < scanResult.recommendations.length - 1 ? '1px solid #1e1530' : 'none' }}>
                      <span style={{ color: '#8b5cf6', fontWeight: 900 }}>{i + 1}.</span> {r}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
