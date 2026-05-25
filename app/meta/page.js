
'use client'

import { useEffect, useMemo, useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts'

const WHITE = '#f8fafc'
const MUTED = '#94a3b8'
const RED = '#ef4444'
const GREEN = '#22c55e'
const BLUE = '#60a5fa'
const CYAN = '#22d3ee'
const PURPLE = '#818cf8'
const CARD = '#070f22'
const BORDER = '#172554'

const euro0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const euro2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const pct2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const dec2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function hasVal(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
}

function fmt(v, kind) {
  if (!hasVal(v)) return '—'
  const n = Number(v)
  if (kind === 'euro0') return `€${euro0.format(n)}`
  if (kind === 'euro2') return `€${euro2.format(n)}`
  if (kind === 'int') return num0.format(n)
  if (kind === 'pct') return `${pct2.format(n)}%`
  if (kind === 'roas') return `${dec2.format(n)}×`
  return dec2.format(n)
}

function delta(curr, prev) {
  if (!hasVal(curr) || !hasVal(prev)) return null
  const c = Number(curr)
  const p = Number(prev)
  const diff = c - p
  if (Math.abs(diff) < 0.000001) return null
  const pct = p !== 0 ? (diff / p) * 100 : null
  return { diff, pct, negative: diff < 0 }
}

function Delta({ current, previous, kind }) {
  const d = delta(current, previous)
  if (!d) return null

  const sign = d.diff > 0 ? '+' : '−'
  const color = d.negative ? RED : WHITE

  return (
    <div style={{ marginTop: 7, display: 'grid', gridTemplateRows: 'auto auto', rowGap: 3, color, fontSize: 12, fontWeight: 900, lineHeight: 1.15 }}>
      <div>{sign}{fmt(Math.abs(d.diff), kind)}</div>
      {d.pct != null && <div>{sign}{pct2.format(Math.abs(d.pct))}%</div>}
    </div>
  )
}

function Metric({ value, previous, kind = 'int' }) {
  return (
    <div>
      <div style={{ color: WHITE, fontSize: 15, fontWeight: 900, lineHeight: 1.1 }}>{fmt(value, kind)}</div>
      <Delta current={value} previous={previous} kind={kind} />
    </div>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div style={{ background: '#020617', border: `1px solid ${BORDER}`, borderRadius: 12, padding: 10, color: WHITE, fontSize: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{label}</div>
      {payload.map(p => (
        <div key={p.dataKey} style={{ display: 'flex', gap: 8, justifyContent: 'space-between' }}>
          <span>{p.name}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

function latestAndPrevious(weeks = []) {
  const valid = [...weeks].sort((a, b) => a.date.localeCompare(b.date))
  return {
    latest: valid[valid.length - 1] || {},
    previous: valid[valid.length - 2] || {},
  }
}

const columns = [
  ['spend', 'Speso', 'euro0'],
  ['roas', 'ROAS', 'roas'],
  ['purchaseValue', 'Valore acquisti', 'euro0'],
  ['aov', 'AOV', 'euro2'],
  ['purchases', 'Acquisti', 'int'],
  ['purchaseConversions', 'Conv. acquisti', 'int'],
  ['addToCart', 'Add to cart', 'int'],
  ['cro', 'CRO campagna', 'pct'],
  ['ctrLink', 'CTR link', 'pct'],
  ['cpcLink', 'CPC link', 'euro2'],
  ['cpm', 'CPM', 'euro2'],
  ['impressions', 'Impression', 'int'],
  ['reach', 'Copertura', 'int'],
  ['frequency', 'Freq.', 'number'],
  ['costPerResult', 'Costo risultato', 'euro2'],
]

function PerformanceRow({ item, depth = 0, children }) {
  const [open, setOpen] = useState(depth === 0)
  const { latest, previous } = latestAndPrevious(item.weeks)

  return (
    <>
      <tr style={{ borderTop: `1px solid ${BORDER}` }}>
        <td style={{ position: 'sticky', left: 0, zIndex: 5, background: CARD, minWidth: depth === 0 ? 280 : 320, padding: '14px 14px' }}>
          <button onClick={() => setOpen(!open)} style={{ background: 'transparent', border: 0, color: WHITE, cursor: 'pointer', fontWeight: 900, textAlign: 'left', fontSize: depth === 0 ? 15 : 14, paddingLeft: depth * 20 }}>
            <span style={{ color: MUTED, marginRight: 8 }}>{open ? '▾' : '▸'}</span>
            {item.name || 'Senza nome'}
          </button>
          <div style={{ color: MUTED, fontSize: 11, marginTop: 5, paddingLeft: depth * 20 + 28 }}>{item.id}</div>
        </td>
        {columns.map(([key, , kind]) => (
          <td key={key} style={{ padding: '14px 14px', verticalAlign: 'top', minWidth: 120 }}>
            <Metric value={latest[key]} previous={previous[key]} kind={kind} />
          </td>
        ))}
      </tr>
      {open && children}
    </>
  )
}

function AdRow({ ad }) {
  const { latest, previous } = latestAndPrevious(ad.weeks)
  const img = ad.creative?.thumbnailUrl || ad.creative?.imageUrl

  return (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
      <td style={{ position: 'sticky', left: 0, zIndex: 4, background: '#050b18', minWidth: 360, padding: '14px 14px' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center', paddingLeft: 42 }}>
          {img ? (
            <img src={img} alt="Creative" style={{ width: 54, height: 54, objectFit: 'cover', borderRadius: 10, border: `1px solid ${BORDER}` }} />
          ) : (
            <div style={{ width: 54, height: 54, borderRadius: 10, border: `1px solid ${BORDER}`, display: 'grid', placeItems: 'center', color: MUTED, fontSize: 10 }}>NO IMG</div>
          )}
          <div>
            <div style={{ color: WHITE, fontWeight: 900, fontSize: 13 }}>{ad.name || 'Creatività senza nome'}</div>
            <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>{ad.creative?.creativeName || ad.creative?.creativeId || ad.id}</div>
          </div>
        </div>
      </td>
      {columns.map(([key, , kind]) => (
        <td key={key} style={{ padding: '14px 14px', verticalAlign: 'top', minWidth: 120 }}>
          <Metric value={latest[key]} previous={previous[key]} kind={kind} />
        </td>
      ))}
    </tr>
  )
}

function SummaryCharts({ campaigns }) {
  const data = useMemo(() => {
    const map = {}
    for (const c of campaigns) {
      for (const w of c.weeks || []) {
        if (!map[w.date]) map[w.date] = { date: w.date, spend: 0, purchases: 0, purchaseValue: 0, roasNumerator: 0, roasDenominator: 0, ctrLink: [], cpcLink: [], cpm: [], frequency: [] }
        map[w.date].spend += Number(w.spend || 0)
        map[w.date].purchases += Number(w.purchases || 0)
        map[w.date].purchaseValue += Number(w.purchaseValue || 0)
        if (w.spend > 0) {
          map[w.date].roasNumerator += Number(w.purchaseValue || 0)
          map[w.date].roasDenominator += Number(w.spend || 0)
        }
        for (const k of ['ctrLink', 'cpcLink', 'cpm', 'frequency']) {
          if (w[k] != null && Number(w[k]) > 0) map[w.date][k].push(Number(w[k]))
        }
      }
    }

    const avg = arr => arr.length ? arr.reduce((a, b) => a + b, 0) / arr.length : null

    return Object.values(map).sort((a, b) => a.date.localeCompare(b.date)).map(w => ({
      date: w.date.slice(5),
      spend: Math.round(w.spend),
      purchases: Math.round(w.purchases),
      purchaseValue: Math.round(w.purchaseValue),
      roas: w.roasDenominator > 0 ? Math.round((w.roasNumerator / w.roasDenominator) * 100) / 100 : null,
      ctrLink: avg(w.ctrLink),
      cpcLink: avg(w.cpcLink),
      cpm: avg(w.cpm),
      frequency: avg(w.frequency),
    }))
  }, [campaigns])

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
      <div style={cardStyle}>
        <h2 style={titleStyle}>ROAS, spesa e acquisti</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
            <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} />
            <Legend />
            <Line dataKey="roas" name="ROAS" stroke={WHITE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line dataKey="spend" name="Spesa" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line dataKey="purchases" name="Acquisti" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>KPI Meta: CTR, CPC, CPM, frequenza</h2>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
            <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: MUTED, fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip content={<ChartTip />} />
            <Legend />
            <Line dataKey="ctrLink" name="CTR link %" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line dataKey="cpcLink" name="CPC link" stroke={CYAN} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line dataKey="cpm" name="CPM" stroke={PURPLE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
            <Line dataKey="frequency" name="Frequenza" stroke={WHITE} strokeWidth={2} dot={{ r: 3 }} connectNulls />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

const cardStyle = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 18,
  padding: 18,
  boxShadow: '0 20px 60px rgba(0,0,0,.24)',
}

const titleStyle = {
  margin: '0 0 16px',
  color: WHITE,
  fontSize: 15,
  letterSpacing: '.12em',
  textTransform: 'uppercase',
  fontWeight: 900,
}

export default function MetaDetailPage() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true

    async function load() {
      try {
        setLoading(true)
        const res = await fetch('/api/meta-detail', { cache: 'no-store' })
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Errore caricamento Meta')
        if (alive) setData(json)
      } catch (e) {
        if (alive) setError(e.message)
      } finally {
        if (alive) setLoading(false)
      }
    }

    load()
    return () => { alive = false }
  }, [])

  const campaigns = data?.campaigns || []

  return (
    <main style={{ minHeight: '100vh', background: '#020617', color: WHITE, padding: 28, fontFamily: 'Barlow, system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, marginBottom: 22 }}>
        <div>
          <a href="/" style={{ color: MUTED, textDecoration: 'none', fontSize: 13 }}>← Torna alla dashboard</a>
          <h1 style={{ margin: '10px 0 0', fontSize: 28, letterSpacing: '.08em', textTransform: 'uppercase' }}>Analisi Meta dettagliata</h1>
          <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 14 }}>Campagne attive → adset → creatività, con variazioni settimanali.</p>
        </div>
        <div style={{ color: GREEN, fontSize: 12 }}>{data?.updatedAt ? `Aggiornato: ${new Date(data.updatedAt).toLocaleString('it-IT')}` : ''}</div>
      </div>

      {loading && <div style={cardStyle}>Caricamento dati Meta...</div>}
      {error && <div style={{ ...cardStyle, color: RED }}>Errore: {error}</div>}

      {!loading && !error && (
        <>
          <SummaryCharts campaigns={campaigns} />

          <div style={cardStyle}>
            <h2 style={titleStyle}>Campagne attive, adset e creatività</h2>
            <div style={{ overflow: 'auto', maxHeight: '76vh', borderRadius: 14, border: `1px solid ${BORDER}` }}>
              <table style={{ borderCollapse: 'collapse', minWidth: 2200, width: '100%' }}>
                <thead>
                  <tr>
                    <th style={{ position: 'sticky', top: 0, left: 0, zIndex: 20, background: '#081226', color: WHITE, textAlign: 'left', padding: '14px', minWidth: 360 }}>Campagna / Adset / Creatività</th>
                    {columns.map(([, label]) => (
                      <th key={label} style={{ position: 'sticky', top: 0, zIndex: 10, background: '#081226', color: WHITE, textAlign: 'left', padding: '14px', minWidth: 120, fontSize: 12, letterSpacing: '.08em', textTransform: 'uppercase' }}>{label}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {campaigns.length === 0 && (
                    <tr><td colSpan={columns.length + 1} style={{ padding: 18, color: MUTED }}>Nessuna campagna attiva trovata.</td></tr>
                  )}

                  {campaigns.map(campaign => (
                    <PerformanceRow key={campaign.id} item={campaign} depth={0}>
                      {campaign.adsets.map(adset => (
                        <PerformanceRow key={adset.id} item={adset} depth={1}>
                          {adset.ads.map(ad => <AdRow key={ad.id} ad={ad} />)}
                        </PerformanceRow>
                      ))}
                    </PerformanceRow>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </main>
  )
}
