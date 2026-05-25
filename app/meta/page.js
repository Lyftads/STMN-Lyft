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
const CARD_2 = '#050b18'
const BORDER = '#172554'

const euro0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const euro2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const num0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const pct2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})
const dec2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

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

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function addDaysIso(baseIso, days) {
  const d = new Date(`${baseIso}T00:00:00`)
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

function formatInputDate(iso) {
  if (!iso) return ''
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

function hasVal(v) {
  return v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))
}

function fmt(v, kind) {
  if (!hasVal(v)) return '—'

  const x = Number(v)

  if (kind === 'euro0') return `€${euro0.format(x)}`
  if (kind === 'euro2') return `€${euro2.format(x)}`
  if (kind === 'int') return num0.format(x)
  if (kind === 'pct') return `${pct2.format(x)}%`
  if (kind === 'roas') return `${dec2.format(x)}×`
  if (kind === 'number') return dec2.format(x)

  return dec2.format(x)
}

function delta(curr, prev) {
  if (!hasVal(curr) || !hasVal(prev)) return null

  const c = Number(curr)
  const p = Number(prev)
  const diff = c - p

  if (Math.abs(diff) < 0.000001) return null

  const pct = p !== 0 ? (diff / p) * 100 : null

  return {
    diff,
    pct,
    negative: diff < 0,
  }
}

function Delta({ current, previous, kind }) {
  const d = delta(current, previous)
  if (!d) return null

  const sign = d.diff > 0 ? '+' : '−'
  const color = d.negative ? RED : WHITE

  return (
    <div
      style={{
        marginTop: 7,
        display: 'grid',
        gridTemplateRows: 'auto auto',
        rowGap: 3,
        color,
        fontSize: 12,
        fontWeight: 900,
        lineHeight: 1.15,
      }}
    >
      <div>
        {sign}
        {fmt(Math.abs(d.diff), kind)}
      </div>

      {d.pct !== null && (
        <div>
          {sign}
          {pct2.format(Math.abs(d.pct))}%
        </div>
      )}
    </div>
  )
}

function Metric({ value, previous, kind = 'int' }) {
  return (
    <div>
      <div
        style={{
          color: WHITE,
          fontSize: 15,
          fontWeight: 900,
          lineHeight: 1.1,
        }}
      >
        {fmt(value, kind)}
      </div>

      <Delta current={value} previous={previous} kind={kind} />
    </div>
  )
}

function ChartTip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div
      style={{
        background: '#020617',
        border: `1px solid ${BORDER}`,
        borderRadius: 12,
        padding: 10,
        color: WHITE,
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 900, marginBottom: 6 }}>{label}</div>

      {payload.map(p => (
        <div
          key={p.dataKey}
          style={{
            display: 'flex',
            gap: 8,
            justifyContent: 'space-between',
          }}
        >
          <span>{p.name}</span>
          <strong>{p.value}</strong>
        </div>
      ))}
    </div>
  )
}

function DateInput({ value, onChange }) {
  return (
    <input
      type="date"
      value={value}
      onChange={e => onChange(e.target.value)}
      style={{
        background: '#020617',
        border: `1px solid ${BORDER}`,
        color: WHITE,
        borderRadius: 10,
        padding: '13px 14px',
        fontWeight: 900,
        fontSize: 15,
        minWidth: 170,
      }}
    />
  )
}

function TimeFrameSelector({ preset, setPreset, since, setSince, until, setUntil, onApply, loading }) {
  function applyPreset(value) {
    setPreset(value)

    const t = todayIso()

    if (value === 'today') {
      setSince(t)
      setUntil(t)
    }

    if (value === 'yesterday') {
      const y = addDaysIso(t, -1)
      setSince(y)
      setUntil(y)
    }

    if (value === 'last7') {
      setSince(addDaysIso(t, -6))
      setUntil(t)
    }

    if (value === 'last14') {
      setSince(addDaysIso(t, -13))
      setUntil(t)
    }

    if (value === 'last30') {
      setSince(addDaysIso(t, -29))
      setUntil(t)
    }

    if (value === 'thisMonth') {
      const d = new Date()
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
      setSince(first.toISOString().slice(0, 10))
      setUntil(t)
    }
  }

  return (
    <div
      style={{
        ...cardStyle,
        marginBottom: 18,
        display: 'flex',
        alignItems: 'end',
        gap: 14,
        flexWrap: 'wrap',
      }}
    >
      <div>
        <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Time frame</div>
        <select
          value={preset}
          onChange={e => applyPreset(e.target.value)}
          style={{
            background: '#020617',
            border: `1px solid ${BORDER}`,
            color: WHITE,
            borderRadius: 10,
            padding: '13px 14px',
            fontWeight: 900,
            fontSize: 15,
            minWidth: 210,
          }}
        >
          <option value="today">Oggi</option>
          <option value="yesterday">Ieri</option>
          <option value="last7">Ultimi 7 giorni</option>
          <option value="last14">Ultimi 14 giorni</option>
          <option value="last30">Ultimi 30 giorni</option>
          <option value="thisMonth">Questo mese</option>
          <option value="custom">Personalizzato</option>
        </select>
      </div>

      <div>
        <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>Da</div>
        <DateInput
          value={since}
          onChange={v => {
            setPreset('custom')
            setSince(v)
          }}
        />
      </div>

      <div>
        <div style={{ color: MUTED, fontSize: 12, marginBottom: 8 }}>A</div>
        <DateInput
          value={until}
          onChange={v => {
            setPreset('custom')
            setUntil(v)
          }}
        />
      </div>

      <button
        onClick={onApply}
        disabled={loading}
        style={{
          background: GREEN,
          color: '#020617',
          border: 0,
          borderRadius: 10,
          padding: '14px 20px',
          fontWeight: 950,
          fontSize: 15,
          cursor: loading ? 'not-allowed' : 'pointer',
          opacity: loading ? 0.7 : 1,
        }}
      >
        {loading ? 'Carico...' : 'Aggiorna'}
      </button>

      <div
        style={{
          marginLeft: 'auto',
          color: MUTED,
          fontSize: 13,
        }}
      >
        Periodo: {since} → {until}
      </div>
    </div>
  )
}

function SummaryCharts({ data = [] }) {
  const chartData = useMemo(() => {
    return [...data].sort((a, b) => String(a.date).localeCompare(String(b.date))).map(x => ({
      ...x,
      label: String(x.date || '').slice(5),
    }))
  }, [data])

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 16,
        marginBottom: 20,
      }}
    >
      <div style={cardStyle}>
        <h2 style={titleStyle}>ROAS, spesa e acquisti</h2>

        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
            <XAxis
              dataKey="label"
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTip />} />
            <Legend />

            <Line
              type="monotone"
              dataKey="roas"
              name="ROAS"
              stroke={WHITE}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="spend"
              name="Spesa"
              stroke={BLUE}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="purchases"
              name="Acquisti"
              stroke={GREEN}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div style={cardStyle}>
        <h2 style={titleStyle}>KPI Meta: CTR, CPC, CPM, frequenza</h2>

        <ResponsiveContainer width="100%" height={270}>
          <LineChart data={chartData}>
            <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
            <XAxis
              dataKey="label"
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: MUTED, fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <Tooltip content={<ChartTip />} />
            <Legend />

            <Line
              type="monotone"
              dataKey="ctrLink"
              name="CTR link %"
              stroke={BLUE}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="cpcLink"
              name="CPC link"
              stroke={CYAN}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="cpm"
              name="CPM"
              stroke={PURPLE}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
            <Line
              type="monotone"
              dataKey="frequency"
              name="Frequenza"
              stroke={WHITE}
              strokeWidth={2}
              dot={{ r: 3 }}
              connectNulls
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}

function InsightsPanel({ insights, catalogProducts, catalogProductsError }) {
  if (!insights) return null

  return (
    <div style={{ ...cardStyle, marginBottom: 20 }}>
      <h2 style={titleStyle}>Insight descrittivi e to do</h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <MiniStat label="Speso" value={fmt(insights.totals?.spend, 'euro0')} />
        <MiniStat label="ROAS" value={fmt(insights.totals?.roas, 'roas')} />
        <MiniStat label="AOV" value={fmt(insights.totals?.aov, 'euro2')} />
        <MiniStat label="CRO" value={fmt(insights.totals?.cro, 'pct')} />
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr 1fr',
          gap: 16,
        }}
      >
        <div>
          <h3 style={subTitle}>Analisi performance</h3>

          <div style={{ display: 'grid', gap: 10 }}>
            {(insights.notes || []).map((note, i) => (
              <div
                key={i}
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 14,
                  padding: 14,
                  background: CARD_2,
                }}
              >
                <div style={{ color: WHITE, fontWeight: 950, marginBottom: 6 }}>
                  {note.title}
                </div>
                <div style={{ color: MUTED, fontSize: 13, lineHeight: 1.5 }}>
                  {note.text}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h3 style={subTitle}>To do operativi</h3>

          <ol
            style={{
              margin: 0,
              paddingLeft: 18,
              color: WHITE,
              display: 'grid',
              gap: 10,
              fontSize: 13,
              lineHeight: 1.45,
              fontWeight: 800,
            }}
          >
            {(insights.todos || []).map((todo, i) => (
              <li key={i}>{todo}</li>
            ))}
          </ol>
        </div>

        <div>
          <h3 style={subTitle}>Prodotti catalogo venduti</h3>

          {catalogProductsError && (
            <div style={{ color: RED, fontSize: 12, lineHeight: 1.4, marginBottom: 10 }}>
              {catalogProductsError}
            </div>
          )}

          {!catalogProducts?.length && !catalogProductsError && (
            <div style={{ color: MUTED, fontSize: 13 }}>
              Nessun prodotto catalogo recuperato per questo periodo.
            </div>
          )}

          <div style={{ display: 'grid', gap: 8 }}>
            {(catalogProducts || []).slice(0, 8).map((p, i) => (
              <div
                key={`${p.productId}-${i}`}
                style={{
                  border: `1px solid ${BORDER}`,
                  borderRadius: 12,
                  padding: 10,
                  background: CARD_2,
                }}
              >
                <div style={{ color: WHITE, fontWeight: 950, fontSize: 13 }}>
                  {p.productId || 'Prodotto senza ID'}
                </div>
                <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                  Valore: {fmt(p.purchaseValue, 'euro0')} · Acquisti: {fmt(p.purchases, 'int')} · ROAS:{' '}
                  {fmt(p.roas, 'roas')}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginTop: 18 }}>
        <h3 style={subTitle}>Creatività e angoli comunicativi</h3>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}
        >
          <CreativeList
            title="Creatività da scalare"
            items={insights.bestCreatives || []}
          />
          <CreativeList
            title="Creatività da rivedere"
            items={insights.weakCreatives || []}
          />
        </div>
      </div>
    </div>
  )
}

const subTitle = {
  margin: '0 0 10px',
  color: WHITE,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '.1em',
  fontWeight: 950,
}

function MiniStat({ label, value }) {
  return (
    <div
      style={{
        background: CARD_2,
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 14,
      }}
    >
      <div style={{ color: MUTED, fontSize: 12, marginBottom: 6 }}>{label}</div>
      <div style={{ color: WHITE, fontSize: 21, fontWeight: 950 }}>{value}</div>
    </div>
  )
}

function CreativeList({ title, items }) {
  return (
    <div
      style={{
        border: `1px solid ${BORDER}`,
        borderRadius: 14,
        padding: 14,
        background: CARD_2,
      }}
    >
      <div style={{ color: WHITE, fontWeight: 950, marginBottom: 12 }}>{title}</div>

      <div style={{ display: 'grid', gap: 12 }}>
        {items.slice(0, 5).map((x, i) => (
          <div key={`${x.adName}-${i}`} style={{ display: 'flex', gap: 10 }}>
            {x.creative?.thumbnailUrl || x.creative?.imageUrl ? (
              <img
                src={x.creative.thumbnailUrl || x.creative.imageUrl}
                alt=""
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  objectFit: 'cover',
                  border: `1px solid ${BORDER}`,
                }}
              />
            ) : (
              <div
                style={{
                  width: 52,
                  height: 52,
                  borderRadius: 10,
                  border: `1px solid ${BORDER}`,
                  display: 'grid',
                  placeItems: 'center',
                  color: MUTED,
                  fontSize: 10,
                }}
              >
                NO IMG
              </div>
            )}

            <div>
              <div style={{ color: WHITE, fontWeight: 950, fontSize: 13 }}>
                {x.adName}
              </div>
              <div style={{ color: MUTED, fontSize: 12, marginTop: 4 }}>
                ROAS {fmt(x.roas, 'roas')} · Speso {fmt(x.spend, 'euro0')} · Acquisti{' '}
                {fmt(x.purchases, 'int')}
              </div>
              {x.creative?.headline && (
                <div style={{ color: WHITE, fontSize: 12, marginTop: 5 }}>
                  Headline: {x.creative.headline}
                </div>
              )}
              {x.creative?.copy && (
                <div
                  style={{
                    color: MUTED,
                    fontSize: 12,
                    marginTop: 4,
                    lineHeight: 1.35,
                  }}
                >
                  Copy: {x.creative.copy.slice(0, 160)}
                  {x.creative.copy.length > 160 ? '...' : ''}
                </div>
              )}
            </div>
          </div>
        ))}

        {!items.length && (
          <div style={{ color: MUTED, fontSize: 13 }}>Nessun dato sufficiente.</div>
        )}
      </div>
    </div>
  )
}

function PerformanceRow({ item, depth = 0, children }) {
  const [open, setOpen] = useState(depth === 0)

  return (
    <>
      <tr style={{ borderTop: `1px solid ${BORDER}` }}>
        <td
          style={{
            position: 'sticky',
            left: 0,
            zIndex: 5,
            background: CARD,
            minWidth: 380,
            padding: '14px 14px',
          }}
        >
          <button
            onClick={() => setOpen(!open)}
            style={{
              background: 'transparent',
              border: 0,
              color: WHITE,
              cursor: 'pointer',
              fontWeight: 900,
              textAlign: 'left',
              fontSize: depth === 0 ? 15 : 14,
              paddingLeft: depth * 22,
            }}
          >
            <span style={{ color: MUTED, marginRight: 8 }}>{open ? '▾' : '▸'}</span>
            {item.name || 'Senza nome'}
          </button>

          <div
            style={{
              color: MUTED,
              fontSize: 11,
              marginTop: 5,
              paddingLeft: depth * 22 + 28,
            }}
          >
            {item.id}
          </div>
        </td>

        {columns.map(([key, , kind]) => (
          <td
            key={key}
            style={{
              padding: '14px 14px',
              verticalAlign: 'top',
              minWidth: 130,
            }}
          >
            <Metric
              value={item.latest?.[key]}
              previous={item.previous?.[key]}
              kind={kind}
            />
          </td>
        ))}
      </tr>

      {open && children}
    </>
  )
}

function AdRow({ ad }) {
  const img = ad.creative?.thumbnailUrl || ad.creative?.imageUrl

  return (
    <tr style={{ borderTop: `1px solid ${BORDER}` }}>
      <td
        style={{
          position: 'sticky',
          left: 0,
          zIndex: 4,
          background: CARD_2,
          minWidth: 420,
          padding: '14px',
        }}
      >
        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'flex-start',
            paddingLeft: 44,
          }}
        >
          {img ? (
            <img
              src={img}
              alt=""
              style={{
                width: 64,
                height: 64,
                objectFit: 'cover',
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
              }}
            />
          ) : (
            <div
              style={{
                width: 64,
                height: 64,
                borderRadius: 10,
                border: `1px solid ${BORDER}`,
                display: 'grid',
                placeItems: 'center',
                color: MUTED,
                fontSize: 10,
              }}
            >
              NO IMG
            </div>
          )}

          <div>
            <div style={{ color: WHITE, fontWeight: 950, fontSize: 13 }}>
              {ad.name || 'Creatività senza nome'}
            </div>

            <div style={{ color: MUTED, fontSize: 11, marginTop: 4 }}>
              {ad.creative?.creativeName || ad.creative?.creativeId || ad.id}
            </div>

            {ad.creative?.headline && (
              <div style={{ color: WHITE, fontSize: 12, marginTop: 8 }}>
                {ad.creative.headline}
              </div>
            )}

            {ad.creative?.copy && (
              <div style={{ color: MUTED, fontSize: 12, marginTop: 5, lineHeight: 1.35 }}>
                {ad.creative.copy.slice(0, 180)}
                {ad.creative.copy.length > 180 ? '...' : ''}
              </div>
            )}
          </div>
        </div>
      </td>

      {columns.map(([key, , kind]) => (
        <td
          key={key}
          style={{
            padding: '14px 14px',
            verticalAlign: 'top',
            minWidth: 130,
          }}
        >
          <Metric
            value={ad.latest?.[key]}
            previous={ad.previous?.[key]}
            kind={kind}
          />
        </td>
      ))}
    </tr>
  )
}

function MetaTable({ campaigns }) {
  return (
    <div style={cardStyle}>
      <h2 style={titleStyle}>Campagne attive, adset e creatività</h2>

      <div
        style={{
          overflow: 'auto',
          maxHeight: '76vh',
          borderRadius: 14,
          border: `1px solid ${BORDER}`,
        }}
      >
        <table style={{ borderCollapse: 'collapse', minWidth: 2450, width: '100%' }}>
          <thead>
            <tr>
              <th
                style={{
                  position: 'sticky',
                  top: 0,
                  left: 0,
                  zIndex: 20,
                  background: '#081226',
                  color: WHITE,
                  textAlign: 'left',
                  padding: '14px',
                  minWidth: 420,
                }}
              >
                Campagna / Adset / Creatività
              </th>

              {columns.map(([, label]) => (
                <th
                  key={label}
                  style={{
                    position: 'sticky',
                    top: 0,
                    zIndex: 10,
                    background: '#081226',
                    color: WHITE,
                    textAlign: 'left',
                    padding: '14px',
                    minWidth: 130,
                    fontSize: 12,
                    letterSpacing: '.08em',
                    textTransform: 'uppercase',
                  }}
                >
                  {label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {campaigns.length === 0 && (
              <tr>
                <td
                  colSpan={columns.length + 1}
                  style={{ padding: 18, color: MUTED }}
                >
                  Nessuna campagna attiva trovata.
                </td>
              </tr>
            )}

            {campaigns.map(campaign => (
              <PerformanceRow key={campaign.id} item={campaign} depth={0}>
                {campaign.adsets.map(adset => (
                  <PerformanceRow key={adset.id} item={adset} depth={1}>
                    {adset.ads.map(ad => (
                      <AdRow key={ad.id} ad={ad} />
                    ))}
                  </PerformanceRow>
                ))}
              </PerformanceRow>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function MetaDetailPage() {
  const initialUntil = todayIso()
  const initialSince = addDaysIso(initialUntil, -6)

  const [preset, setPreset] = useState('last7')
  const [since, setSince] = useState(initialSince)
  const [until, setUntil] = useState(initialUntil)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  async function load() {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams({
        since,
        until,
      })

      const res = await fetch(`/api/meta-detail?${params.toString()}`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!res.ok) {
        throw new Error(json.error || 'Errore caricamento Meta')
      }

      if (json.error) {
        throw new Error(json.error)
      }

      setData(json)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const campaigns = data?.campaigns || []
  const chartDaily = data?.chartDaily || []

  return (
    <main
      style={{
        minHeight: '100vh',
        background: '#020617',
        color: WHITE,
        padding: 28,
        fontFamily: 'Barlow, system-ui, sans-serif',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-end',
          gap: 16,
          marginBottom: 22,
        }}
      >
        <div>
          <a
            href="/"
            style={{
              color: MUTED,
              textDecoration: 'none',
              fontSize: 13,
            }}
          >
            ← Torna alla dashboard
          </a>

          <h1
            style={{
              margin: '10px 0 0',
              fontSize: 28,
              letterSpacing: '.08em',
              textTransform: 'uppercase',
            }}
          >
            Analisi Meta dettagliata
          </h1>

          <p style={{ margin: '8px 0 0', color: MUTED, fontSize: 14 }}>
            Campagne attive → adset → creatività, con confronto sul periodo precedente.
          </p>
        </div>

        <div style={{ color: GREEN, fontSize: 12 }}>
          {data?.updatedAt
            ? `Aggiornato: ${new Date(data.updatedAt).toLocaleString('it-IT')}`
            : ''}
        </div>
      </div>

      <TimeFrameSelector
        preset={preset}
        setPreset={setPreset}
        since={since}
        setSince={setSince}
        until={until}
        setUntil={setUntil}
        onApply={load}
        loading={loading}
      />

      {loading && <div style={cardStyle}>Caricamento dati Meta...</div>}

      {error && (
        <div style={{ ...cardStyle, color: RED, marginBottom: 20 }}>
          Errore: {error}
        </div>
      )}

      {!loading && !error && (
        <>
          <SummaryCharts data={chartDaily} />

          <InsightsPanel
            insights={data?.insights}
            catalogProducts={data?.catalogProducts}
            catalogProductsError={data?.catalogProductsError}
          />

          <MetaTable campaigns={campaigns} />
        </>
      )}
    </main>
  )
}
