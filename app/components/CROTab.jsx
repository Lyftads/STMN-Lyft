'use client'

import { useEffect, useState, useRef, useMemo } from 'react'
import {
  BarChart, Bar, LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
  FunnelChart, Funnel, LabelList, Cell,
} from 'recharts'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
const fmtP = n => n != null ? `${n.toFixed(1)}%` : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'

const DAYS_OPTIONS = [7, 14, 30, 60, 90]
const FUNNEL_COLORS = ['#8b5cf6', '#06b6d4', '#f59e0b', '#22c55e']

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: '#0a1020', border: '1px solid #1e2d47', borderRadius: 6, padding: '8px 12px', fontSize: 11, fontWeight: 700 }}>
      <p style={{ color: '#888', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' ? p.value.toLocaleString('it-IT') : p.value}</p>)}
    </div>
  )
}

function SectionTitle({ children, color = '#8b5cf6' }) {
  return (
    <div style={{ margin: '32px 0 18px', padding: '8px 16px', borderRadius: '0 10px 10px 0', background: `linear-gradient(90deg, ${color}25, transparent)`, color, fontSize: 12, fontWeight: 950, textTransform: 'uppercase', letterSpacing: '0.17em' }}>
      {children}
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

function FunnelBar({ label, value, total, color, subLabel }) {
  const pct = total > 0 ? (value / total) * 100 : 0
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 11, color: '#776a86', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 950, color: '#fff', marginBottom: 4 }}>{fmtN(value)}</div>
      <div style={{ fontSize: 13, fontWeight: 800, color, marginBottom: 8 }}>{fmtP(pct)}</div>
      <div style={{ height: 8, background: '#1a1525', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(pct, 100)}%`, background: color, borderRadius: 4, transition: 'width .6s' }} />
      </div>
      {subLabel && <div style={{ fontSize: 10, color: '#776a86', marginTop: 4 }}>{subLabel}</div>}
    </div>
  )
}

function SortHeader({ label, field, sortField, sortDir, onSort, align = 'right' }) {
  const active = sortField === field
  return (
    <th onClick={() => onSort(field)} style={{
      padding: '14px 16px', textAlign: align, color: active ? '#c4b5fd' : '#776a86',
      fontWeight: 800, fontSize: 11, textTransform: 'uppercase', cursor: 'pointer', userSelect: 'none',
      whiteSpace: 'nowrap',
    }}>
      {label} {active ? (sortDir === 'desc' ? '↓' : '↑') : ''}
    </th>
  )
}

function InsightBox({ title, insights }) {
  if (!insights?.length) return null
  return (
    <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '24px 28px', marginTop: 24 }}>
      <div style={{ fontSize: 14, fontWeight: 900, color: '#8b5cf6', marginBottom: 16 }}>{title}</div>
      {insights.map((ins, i) => (
        <div key={i} style={{ padding: '10px 0', borderBottom: i < insights.length - 1 ? '1px solid #1e1530' : 'none' }}>
          <div style={{ color: '#f7f2ff', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{ins}</div>
        </div>
      ))}
    </div>
  )
}

function SankeyFlow({ nodes, links, expanded, onExpand }) {
  if (!nodes?.length || !links?.length) return <div style={{ color: '#776a86', padding: 20 }}>Dati flusso non disponibili</div>

  const width = 1100
  const height = 600
  const levelX = [50, 200, 450, 700, 850, 980]
  const nodeW = 140
  const nodeH = 38
  const nodeGap = 10

  const levels = {}
  for (const n of nodes) {
    const lvl = n.level ?? 0
    if (!levels[lvl]) levels[lvl] = []
    levels[lvl].push(n)
  }
  for (const lvl of Object.values(levels)) lvl.sort((a, b) => b.value - a.value)

  const nodeMap = {}
  for (const [lvlIdx, lvlNodes] of Object.entries(levels)) {
    const x = levelX[parseInt(lvlIdx)] || parseInt(lvlIdx) * 200 + 50
    const totalH = lvlNodes.length * nodeH + (lvlNodes.length - 1) * nodeGap
    let y = Math.max(20, (height - totalH) / 2)
    for (const n of lvlNodes) {
      nodeMap[n.id] = { ...n, x, y, w: nodeW, h: nodeH }
      y += nodeH + nodeGap
    }
  }

  const colors = ['#8b5cf6', '#ec4899', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#3b82f6', '#a78bfa', '#f97316', '#14b8a6', '#e879f9', '#fbbf24']
  const maxVal = nodes.reduce((m, n) => Math.max(m, n.value), 1)

  return (
    <div style={{ overflowX: 'auto' }}>
      <svg width={width} height={height} style={{ fontFamily: 'Inter, system-ui, sans-serif' }}>
        {links.map((link, i) => {
          const src = nodeMap[link.source]
          const tgt = nodeMap[link.target]
          if (!src || !tgt) return null
          const x1 = src.x + src.w, y1 = src.y + src.h / 2
          const x2 = tgt.x, y2 = tgt.y + tgt.h / 2
          const cx = (x1 + x2) / 2
          const thickness = Math.max(2, (link.value / maxVal) * 24)
          const color = colors[i % colors.length]
          return (
            <g key={i}>
              <path d={`M${x1},${y1} C${cx},${y1} ${cx},${y2} ${x2},${y2}`} fill="none" stroke={color} strokeWidth={thickness} strokeOpacity={0.3} />
              <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 10} textAnchor="middle" fill={color} fontSize={9} fontWeight={800}>{fmtN(link.value)}</text>
            </g>
          )
        })}
        {Object.values(nodeMap).map((n) => {
          const isClickable = n.level === 1 || n.level === 2
          const isExpanded = expanded === n.id
          return (
            <g key={n.id} onClick={() => isClickable && onExpand(isExpanded ? null : n.id)} style={{ cursor: isClickable ? 'pointer' : 'default' }}>
              <rect x={n.x} y={n.y} width={n.w} height={n.h} rx={10} fill={isExpanded ? '#1a1525' : '#110d1a'} stroke={isExpanded ? '#8b5cf6' : '#292134'} strokeWidth={isExpanded ? 2 : 1} />
              <text x={n.x + 12} y={n.y + 16} fill="#f7f2ff" fontSize={11} fontWeight={800}>
                {n.name.length > 16 ? n.name.slice(0, 15) + '…' : n.name}
              </text>
              <text x={n.x + 12} y={n.y + 30} fill="#776a86" fontSize={10} fontWeight={700}>{fmtN(n.value)}</text>
              {isClickable && <text x={n.x + n.w - 16} y={n.y + 22} fill="#776a86" fontSize={12}>{isExpanded ? '−' : '+'}</text>}
            </g>
          )
        })}
      </svg>
    </div>
  )
}

function ScoreRing({ score }) {
  const r = 44, circ = 2 * Math.PI * r
  const offset = circ - (score / 100) * circ
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
  const colors = { critical: '#ef4444', high: '#f59e0b', medium: '#3b82f6', low: '#776a86' }
  const labels = { critical: 'CRITICO', high: 'ALTO', medium: 'MEDIO', low: 'BASSO' }
  const c = colors[severity] || '#776a86'
  return <span style={{ fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6, background: `${c}22`, color: c }}>{labels[severity] || severity}</span>
}

function AttentionBar({ sections }) {
  if (!sections?.length) return null
  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', marginBottom: 10 }}>Stima Attenzione Utente (dall'alto al basso)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {sections.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 10, color: '#9b90aa', width: 90, flexShrink: 0 }}>{s.area}</span>
            <div style={{ flex: 1, height: 14, background: '#1a1525', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                height: '100%', borderRadius: 4,
                width: `${s.attention}%`,
                background: s.attention >= 70 ? '#22c55e' : s.attention >= 40 ? '#f59e0b' : '#ef4444',
                transition: 'width .6s',
              }} />
            </div>
            <span style={{ fontSize: 10, fontWeight: 800, color: s.attention >= 70 ? '#22c55e' : s.attention >= 40 ? '#f59e0b' : '#ef4444', width: 35 }}>{s.attention}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

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
    let active = true
    setLoading(true)
    fetch(`/api/cro?days=${days}`, { cache: 'no-store' })
      .then(r => r.json())
      .then(json => { if (active) setData(json) })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [days])

  const handleSort = (field) => {
    if (sortField === field) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortField(field); setSortDir('desc') }
  }

  const sortedPages = useMemo(() => {
    const pages = [...(data?.topPages || [])]
    pages.sort((a, b) => {
      const va = a[sortField] ?? 0, vb = b[sortField] ?? 0
      return sortDir === 'desc' ? vb - va : va - vb
    })
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
    const f = data.funnel
    const ins = []
    if (f.purchaseRate < 1) ins.push(`Il conversion rate è al ${fmtP(f.purchaseRate)} — sotto l'1% che è il benchmark minimo per e-commerce. Ogni punto percentuale in più vale circa ${fmtE((f.visitors * 0.01) * (data.totalRevenue / Math.max(data.totalOrders, 1)))} in più di revenue.`)
    else if (f.purchaseRate >= 2) ins.push(`Conversion rate al ${fmtP(f.purchaseRate)} — sopra la media e-commerce (1.5-2%). Buon lavoro, Marino.`)
    if (f.cartToCheckout < 50) ins.push(`Solo il ${fmtP(f.cartToCheckout)} di chi aggiunge al carrello arriva al checkout. Il drop è significativo — possibili cause: costi di spedizione visibili solo al checkout, mancanza di urgency, processo di checkout troppo lungo.`)
    if (f.checkoutToPurchase < 60) ins.push(`${fmtP(f.checkoutToPurchase)} di completion rate al checkout. Possibili frizioni: troppi campi nel form, metodi di pagamento limitati, o mancanza di trust signals nella pagina di pagamento.`)
    if (f.addToCartRate < 5) ins.push(`Add-to-cart rate al ${fmtP(f.addToCartRate)} — basso. Le PDP (pagine prodotto) probabilmente non convincono abbastanza: controllare qualità foto, copy, social proof, e posizione del pulsante "Aggiungi al carrello".`)
    if (f.bounceRate != null && f.bounceRate > 0.5) ins.push(`Bounce rate al ${fmtP(f.bounceRate * 100)} — più della metà dei visitatori esce senza interagire. Concentrati su: velocità di caricamento, hero section, e match tra ad e landing page.`)
    ins.push(`Con ${fmtN(f.visitors)} visitatori e ${fmtN(data.totalOrders)} ordini, ogni ottimizzazione del funnel ha un impatto diretto. Un +1% di conversion rate genererebbe ~${fmtN(Math.round(f.visitors * 0.01))} ordini in più nel periodo.`)
    return ins
  }, [data])

  const pagesInsights = useMemo(() => {
    if (!sortedPages?.length) return []
    const ins = []
    const topPage = sortedPages[0]
    if (topPage) ins.push(`La pagina più visitata è "${topPage.page}" con ${fmtN(topPage.sessions)} sessioni e conversion rate ${fmtP(topPage.conversionRate)}.`)
    const highCR = sortedPages.filter(p => p.conversionRate > 3 && p.sessions > 10)
    if (highCR.length) ins.push(`Pagine con conversion rate alto (>3%): ${highCR.map(p => `"${p.page}" (${fmtP(p.conversionRate)})`).join(', ')}. Analizza cosa funziona su queste pagine e replica il pattern sulle altre.`)
    const lowCR = sortedPages.filter(p => p.conversionRate < 0.5 && p.sessions > 50)
    if (lowCR.length) ins.push(`Pagine con molto traffico ma conversion bassa (<0.5%): ${lowCR.map(p => `"${p.page}" (${fmtN(p.sessions)} sessioni, ${fmtP(p.conversionRate)})`).join(', ')}. Queste sono le pagine dove un intervento CRO avrebbe il massimo impatto.`)
    return ins
  }, [sortedPages])

  const tabs = [
    { id: 'funnel', label: 'Funnel' },
    { id: 'pages', label: 'Top Pages' },
    { id: 'flow', label: 'Flusso Traffico' },
    { id: 'scanner', label: 'Page Scanner' },
  ]

  return (
    <div>
      <p style={{ color: '#9f93ad', fontSize: 13, margin: '0 0 20px' }}>Marino, ecco l'analisi CRO completa del tuo store</p>

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

      {/* ── FUNNEL ── */}
      {!loading && !data?.error && activeSection === 'funnel' && (() => {
        const f = data?.funnel || {}
        const funnelChartData = [
          { name: 'Visitatori', value: f.visitors, fill: FUNNEL_COLORS[0] },
          { name: 'Add to Cart', value: f.addToCart, fill: FUNNEL_COLORS[1] },
          { name: 'Checkout', value: f.checkout, fill: FUNNEL_COLORS[2] },
          { name: 'Acquisto', value: f.purchase, fill: FUNNEL_COLORS[3] },
        ]
        return (
          <>
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '28px 32px', marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>Funnel di Conversione — ultimi {days} giorni</div>
                <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: data?.hasGA4 ? '#22c55e22' : '#f59e0b22', color: data?.hasGA4 ? '#22c55e' : '#f59e0b' }}>
                  {f.source || 'Shopify'}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 24 }}>
                <FunnelBar label="Visitatori Unici" value={f.visitors} total={f.visitors} color="#8b5cf6" />
                <div style={{ width: 1, background: '#292134', margin: '20px 0' }} />
                <FunnelBar label="Aggiunte al Carrello" value={f.addToCart} total={f.visitors} color="#06b6d4" subLabel={`${fmtP(f.cartToCheckout)} → checkout`} />
                <div style={{ width: 1, background: '#292134', margin: '20px 0' }} />
                <FunnelBar label="Checkout Raggiunto" value={f.checkout} total={f.visitors} color="#f59e0b" subLabel={`${fmtP(f.checkoutToPurchase)} → acquisto`} />
                <div style={{ width: 1, background: '#292134', margin: '20px 0' }} />
                <FunnelBar label="Acquisti" value={f.purchase} total={f.visitors} color="#22c55e" subLabel={`Revenue: ${fmtE(data?.totalRevenue)}`} />
              </div>
            </div>

            {/* Funnel Chart */}
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24, marginBottom: 20 }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: '#fff', textTransform: 'uppercase', marginBottom: 16 }}>Visualizzazione Funnel</div>
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={funnelChartData} layout="vertical" margin={{ left: 100, right: 40 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1e1530" horizontal={false} />
                  <XAxis type="number" tick={{ fill: '#776a86', fontSize: 10 }} axisLine={false} tickFormatter={v => fmtN(v)} />
                  <YAxis type="category" dataKey="name" tick={{ fill: '#c4b5fd', fontSize: 12, fontWeight: 800 }} axisLine={false} width={100} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="value" name="Utenti" radius={[0, 8, 8, 0]}>
                    {funnelChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
              <Card label="Conversion Rate" value={fmtP(f.purchaseRate)} color={f.purchaseRate >= 2 ? '#22c55e' : f.purchaseRate >= 1 ? '#f59e0b' : '#ef4444'} />
              <Card label="Add-to-Cart Rate" value={fmtP(f.addToCartRate)} color="#06b6d4" />
              <Card label="Cart → Checkout" value={fmtP(f.cartToCheckout)} color="#f59e0b" />
              <Card label="Checkout → Purchase" value={fmtP(f.checkoutToPurchase)} color="#22c55e" />
              <Card label="Revenue Totale" value={fmtE(data?.totalRevenue)} color="#22c55e" />
              <Card label="Ordini Totali" value={fmtN(data?.totalOrders)} color="#fff" />
              {f.bounceRate != null && <Card label="Bounce Rate" value={fmtP(f.bounceRate * 100)} color={f.bounceRate > 0.5 ? '#ef4444' : '#f59e0b'} />}
              {f.avgDuration != null && <Card label="Durata Media" value={`${Math.round(f.avgDuration)}s`} color="#06b6d4" />}
            </div>

            <InsightBox title="Analisi e Insight — Funnel" insights={funnelInsights} />
          </>
        )
      })()}

      {/* ── TOP PAGES ── */}
      {!loading && !data?.error && activeSection === 'pages' && (() => {
        const chartPages = sortedPages.slice(0, 10).map(p => ({
          name: p.page.length > 30 ? p.page.slice(0, 29) + '…' : p.page,
          sessions: p.sessions,
          orders: p.orders,
          cr: p.conversionRate,
        }))
        return (
          <>
            <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, overflow: 'hidden', marginBottom: 20 }}>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', minWidth: 900, borderCollapse: 'collapse', fontSize: 13 }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #292134' }}>
                      <th style={{ padding: '14px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>#</th>
                      <th style={{ padding: '14px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Pagina</th>
                      <SortHeader label="Sessioni" field="sessions" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Visitatori" field="visitors" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      {data?.hasGA4 && <SortHeader label="Bounce" field="bounceRate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />}
                      <SortHeader label="Ordini" field="orders" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                      <SortHeader label="Conv. Rate" field="conversionRate" sortField={sortField} sortDir={sortDir} onSort={handleSort} />
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPages.map((p, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #1e1530' }}>
                        <td style={{ padding: '12px 16px', color: '#776a86', fontWeight: 700 }}>{i + 1}</td>
                        <td style={{ padding: '12px 16px', color: '#f7f2ff', fontWeight: 700, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.page}</td>
                        <td style={{ padding: '12px 16px', color: '#c4b5fd', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.sessions)}</td>
                        <td style={{ padding: '12px 16px', color: '#9b90aa', fontWeight: 700, textAlign: 'right' }}>{fmtN(p.visitors)}</td>
                        {data?.hasGA4 && <td style={{ padding: '12px 16px', color: '#9b90aa', fontWeight: 700, textAlign: 'right' }}>{p.bounceRate != null ? fmtP(p.bounceRate * 100) : '—'}</td>}
                        <td style={{ padding: '12px 16px', color: '#22c55e', fontWeight: 800, textAlign: 'right' }}>{fmtN(p.orders)}</td>
                        <td style={{ padding: '12px 16px', fontWeight: 900, textAlign: 'right', color: p.conversionRate >= 2 ? '#22c55e' : p.conversionRate >= 1 ? '#f59e0b' : '#ef4444' }}>{fmtP(p.conversionRate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {chartPages.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Sessioni per pagina</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartPages} layout="vertical" margin={{ left: 130 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e1530" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#776a86', fontSize: 10 }} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#c4b5fd', fontSize: 9, fontWeight: 700 }} axisLine={false} width={130} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="sessions" name="Sessioni" fill="#8b5cf6" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <div style={{ fontSize: 12, color: '#fff', fontWeight: 800, textTransform: 'uppercase', marginBottom: 16 }}>Ordini per pagina</div>
                  <ResponsiveContainer width="100%" height={300}>
                    <BarChart data={chartPages} layout="vertical" margin={{ left: 130 }}>
                      <CartesianGrid strokeDasharray="2 4" stroke="#1e1530" horizontal={false} />
                      <XAxis type="number" tick={{ fill: '#776a86', fontSize: 10 }} axisLine={false} />
                      <YAxis type="category" dataKey="name" tick={{ fill: '#c4b5fd', fontSize: 9, fontWeight: 700 }} axisLine={false} width={130} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="orders" name="Ordini" fill="#22c55e" radius={[0, 6, 6, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            <InsightBox title="Analisi e Insight — Top Pages" insights={pagesInsights} />
          </>
        )
      })()}

      {/* ── FLOW ── */}
      {!loading && !data?.error && activeSection === 'flow' && (
        <>
          <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 28 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <div style={{ fontSize: 16, fontWeight: 950, color: '#fff' }}>Canalizzazione del Traffico</div>
              {expandedNode && <button onClick={() => setExpandedNode(null)} style={{ background: '#1a1525', border: '1px solid #292134', borderRadius: 8, padding: '6px 14px', color: '#c4b5fd', fontSize: 11, fontWeight: 800, cursor: 'pointer' }}>Reset vista</button>}
            </div>
            <div style={{ fontSize: 12, color: '#776a86', marginBottom: 16 }}>Clicca su un nodo per espandere il dettaglio. {data?.hasGA4 ? 'Dati reali da GA4.' : 'Stime basate su Shopify.'}</div>
            <SankeyFlow nodes={data?.flow?.nodes} links={data?.flow?.links} expanded={expandedNode} onExpand={setExpandedNode} />
          </div>

          <InsightBox title="Analisi e Insight — Flusso Traffico" insights={[
            `Il traffico entra da ${data?.flow?.nodes?.filter(n => n.level === 1)?.length || 0} punti di ingresso principali. ${data?.flow?.nodes?.find(n => n.id === 'home')?.value ? `La home page raccoglie ${fmtN(data.flow.nodes.find(n => n.id === 'home').value)} visite.` : ''}`,
            `Dal flusso emerge che le collezioni più visitate sono: ${data?.flow?.nodes?.filter(n => n.id?.startsWith('col_')).sort((a,b) => b.value - a.value).slice(0,3).map(n => `${n.name} (${fmtN(n.value)})`).join(', ') || 'N/D'}.`,
            `I prodotti più visitati direttamente sono: ${data?.flow?.nodes?.filter(n => n.id?.startsWith('prod_')).sort((a,b) => b.value - a.value).slice(0,3).map(n => `${n.name} (${fmtN(n.value)})`).join(', ') || 'N/D'}.`,
            `Il tasso di passaggio dal carrello al checkout è ${fmtP(data?.funnel?.cartToCheckout)} e dal checkout all'acquisto è ${fmtP(data?.funnel?.checkoutToPurchase)}.`,
          ]} />
        </>
      )}

      {/* ── SCANNER ── */}
      {activeSection === 'scanner' && (
        <>
          <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: '24px 28px', marginBottom: 20 }}>
            <div style={{ fontSize: 14, fontWeight: 900, color: '#fff', marginBottom: 6 }}>Analizza una pagina del tuo sito</div>
            <div style={{ fontSize: 12, color: '#776a86', marginBottom: 14 }}>Inserisci l'URL e l'AI analizzerà UX, CTA, trust signals, copy, e struttura della pagina</div>
            <div style={{ display: 'flex', gap: 10 }}>
              <input type="url" value={scanUrl} onChange={e => setScanUrl(e.target.value)} placeholder="https://stmnfitness.com/products/..." onKeyDown={e => e.key === 'Enter' && runScan()}
                style={{ flex: 1, background: '#1a1525', border: '1px solid #292134', color: '#fff', borderRadius: 12, padding: '14px 18px', fontSize: 14, outline: 'none' }} />
              <button onClick={runScan} disabled={scanning || !scanUrl.trim()} style={{
                background: scanning ? '#2a1f3f' : 'linear-gradient(135deg, #8b5cf6, #ec4899)',
                color: '#fff', border: 'none', borderRadius: 12, padding: '0 28px', fontWeight: 900, fontSize: 14, cursor: scanning ? 'not-allowed' : 'pointer',
              }}>{scanning ? 'Analisi in corso...' : 'Scansiona'}</button>
            </div>
          </div>

          {scanning && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, overflow: 'hidden', height: 400 }}>
                <iframe src={scanUrl} style={{ width: '100%', height: '100%', border: 'none', borderRadius: 16 }} title="Page preview" sandbox="allow-same-origin allow-scripts" />
              </div>
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 28, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: 48, height: 48, border: '4px solid #292134', borderTopColor: '#8b5cf6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                <div style={{ color: '#c4b5fd', fontWeight: 800, marginTop: 16, fontSize: 14 }}>Analisi AI in corso...</div>
                <div style={{ color: '#776a86', fontSize: 12, marginTop: 6 }}>Sto analizzando UX, copy, CTA, trust signals e struttura</div>
                <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
              </div>
            </div>
          )}

          {scanError && <div style={{ background: '#ef444415', border: '1px solid #ef444455', borderRadius: 12, padding: '12px 16px', color: '#fecaca', fontSize: 13, marginBottom: 16 }}>{scanError}</div>}

          {scanResult && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Score + Verdict + Preview */}
              <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr 1fr', gap: 16 }}>
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24, textAlign: 'center' }}>
                  <ScoreRing score={scanResult.score} />
                  <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 8, fontWeight: 700 }}>CRO Score</div>
                  <div style={{ fontSize: 10, color: '#776a86', marginTop: 4 }}>{scanResult.score >= 70 ? 'Buona base' : scanResult.score >= 40 ? 'Da migliorare' : 'Intervento urgente'}</div>
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

              {/* Attention Map */}
              {scanResult.attentionMap && (
                <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                  <AttentionBar sections={scanResult.attentionMap} />
                </div>
              )}

              {/* Issues */}
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#ef4444', marginBottom: 16 }}>Problemi Rilevati ({(scanResult.issues || []).length})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {(scanResult.issues || []).map((issue, i) => (
                    <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '16px 20px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                        <SeverityBadge severity={issue.severity} />
                        <span style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 14 }}>{issue.title}</span>
                      </div>
                      <div style={{ color: '#9b90aa', fontSize: 13, lineHeight: 1.6, marginBottom: 8 }}>{issue.description}</div>
                      <div style={{ background: '#110d1a', borderRadius: 8, padding: '10px 14px' }}>
                        <span style={{ color: '#22c55e', fontSize: 11, fontWeight: 800 }}>SOLUZIONE → </span>
                        <span style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 600, lineHeight: 1.5 }}>{issue.fix}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Bottlenecks */}
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#f59e0b', marginBottom: 16 }}>Colli di Bottiglia</div>
                {(scanResult.bottlenecks || []).map((b, i) => (
                  <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '16px 20px', marginBottom: 10 }}>
                    <div style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 14, marginBottom: 6 }}>{b.area}</div>
                    <div style={{ color: '#9b90aa', fontSize: 13, lineHeight: 1.5, marginBottom: 6 }}>{b.problem}</div>
                    <div style={{ display: 'flex', gap: 16, fontSize: 12 }}>
                      <span><span style={{ color: '#f59e0b', fontWeight: 800 }}>Impatto:</span> <span style={{ color: '#e2dcf0' }}>{b.impact}</span></span>
                      <span><span style={{ color: '#22c55e', fontWeight: 800 }}>Soluzione:</span> <span style={{ color: '#e2dcf0' }}>{b.solution}</span></span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Quick Wins */}
              <div style={{ background: '#110d1a', border: '1px solid #292134', borderRadius: 16, padding: 24 }}>
                <div style={{ fontSize: 14, fontWeight: 900, color: '#22c55e', marginBottom: 16 }}>Quick Wins — Azioni Immediate</div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
                  {(scanResult.quickWins || []).map((qw, i) => (
                    <div key={i} style={{ background: '#1a1525', borderRadius: 12, padding: '16px 20px' }}>
                      <div style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 13, marginBottom: 8 }}>{qw.action}</div>
                      <div style={{ display: 'flex', gap: 8, fontSize: 10, marginBottom: 6 }}>
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: qw.impact === 'high' ? '#22c55e22' : qw.impact === 'medium' ? '#f59e0b22' : '#3b82f622', color: qw.impact === 'high' ? '#22c55e' : qw.impact === 'medium' ? '#f59e0b' : '#3b82f6', fontWeight: 800 }}>Impatto: {qw.impact}</span>
                        <span style={{ padding: '3px 8px', borderRadius: 6, background: qw.effort === 'low' ? '#22c55e22' : qw.effort === 'medium' ? '#f59e0b22' : '#ef444422', color: qw.effort === 'low' ? '#22c55e' : qw.effort === 'medium' ? '#f59e0b' : '#ef4444', fontWeight: 800 }}>Effort: {qw.effort}</span>
                      </div>
                      <div style={{ color: '#c4b5fd', fontSize: 12, fontWeight: 700 }}>{qw.expectedLift}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
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
