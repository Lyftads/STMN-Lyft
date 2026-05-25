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
const RED = '#ff4444'
const GREEN = '#22c55e'
const BLUE = '#60a5fa'
const CYAN = '#22d3ee'
const PURPLE = '#818cf8'
const CARD = '#070f22'
const BORDER = '#172554'

const euro0 = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 0,
})

const euro2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num0 = new Intl.NumberFormat('it-IT', {
  maximumFractionDigits: 0,
})

const num2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function todayISO() {
  return new Date().toISOString().slice(0, 10)
}

function addDays(dateString, days) {
  const date = new Date(`${dateString}T00:00:00`)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatITDate(dateString) {
  if (!dateString) return '—'

  const d = new Date(`${dateString}T00:00:00`)
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatShortDate(dateString) {
  if (!dateString) return '—'

  const d = new Date(`${dateString}T00:00:00`)
  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatMetric(value, type) {
  const v = Number(value || 0)

  if (type === 'currency0') return `€${euro0.format(v)}`
  if (type === 'currency2') return `€${euro2.format(v)}`
  if (type === 'percent') return `${num2.format(v)}%`
  if (type === 'ratio') return `${num2.format(v)}×`
  if (type === 'number2') return num2.format(v)

  return num0.format(v)
}

function calcDelta(current, previous) {
  const c = Number(current || 0)
  const p = Number(previous || 0)

  if (!p && !c) {
    return {
      abs: 0,
      pct: 0,
      hasDelta: false,
      positive: false,
      negative: false,
    }
  }

  const abs = c - p
  const pct = p !== 0 ? (abs / p) * 100 : 100

  return {
    abs,
    pct,
    hasDelta: abs !== 0,
    positive: abs > 0,
    negative: abs < 0,
  }
}

function DeltaRows({ current, previous, type = 'number' }) {
  const delta = calcDelta(current, previous)

  if (!delta.hasDelta) {
    return null
  }

  const color = delta.negative ? RED : WHITE

  return (
    <div className="mt-2 leading-tight">
      <div style={{ color }} className="text-[14px] font-bold">
        {delta.abs > 0 ? '+' : ''}
        {formatMetric(delta.abs, type)}
      </div>

      <div style={{ color }} className="mt-1 text-[14px] font-bold">
        {delta.pct > 0 ? '+' : ''}
        {num2.format(delta.pct)}%
      </div>
    </div>
  )
}

function MetricCell({ current, previous, type = 'number' }) {
  return (
    <td className="min-w-[130px] px-4 py-5 align-top">
      <div className="text-[22px] font-extrabold text-white">
        {formatMetric(current, type)}
      </div>

      <DeltaRows current={current} previous={previous} type={type} />
    </td>
  )
}

function TextCell({ children, sub }) {
  return (
    <td className="min-w-[300px] px-4 py-5 align-top">
      <div className="text-[21px] font-extrabold text-white">{children}</div>
      {sub ? <div className="mt-2 text-[14px] text-slate-400">{sub}</div> : null}
    </td>
  )
}

function ChartCard({ title, children }) {
  return (
    <div className="rounded-2xl border border-blue-950 bg-[#070f22] p-6 shadow-xl">
      <h2 className="mb-5 text-[20px] font-black uppercase tracking-[0.2em] text-white">
        {title}
      </h2>

      <div className="h-[330px]">{children}</div>
    </div>
  )
}

function CustomTooltip({ active, payload, label }) {
  if (!active || !payload?.length) return null

  return (
    <div className="rounded-xl border border-blue-900 bg-[#020817] p-4 shadow-xl">
      <div className="mb-2 text-sm font-bold text-white">{label}</div>

      {payload.map((item) => (
        <div
          key={item.dataKey}
          className="text-sm font-semibold"
          style={{ color: item.color }}
        >
          {item.name}: {num2.format(Number(item.value || 0))}
        </div>
      ))}
    </div>
  )
}

function aggregateTrend(campaigns = []) {
  const map = new Map()

  campaigns.forEach((campaign) => {
    ;(campaign.weeks || campaign.trend || []).forEach((week) => {
      const key = week.date || week.dateStart
      if (!key) return

      if (!map.has(key)) {
        map.set(key, {
          date: key,
          label: formatShortDate(key),
          spend: 0,
          roasWeightedValue: 0,
          roasWeightedSpend: 0,
          purchases: 0,
          ctrLinkWeightedClicks: 0,
          ctrLinkWeightedImpressions: 0,
          cpcSpend: 0,
          cpcClicks: 0,
          cpmSpend: 0,
          cpmImpressions: 0,
          frequencyReach: 0,
          frequencyImpressions: 0,
        })
      }

      const row = map.get(key)

      const spend = Number(week.spend || 0)
      const purchaseValue = Number(week.purchaseValue || 0)
      const purchases = Number(week.purchases || 0)
      const impressions = Number(week.impressions || 0)
      const reach = Number(week.reach || 0)
      const linkClicks = Number(week.linkClicks || 0)

      row.spend += spend
      row.purchases += purchases
      row.roasWeightedValue += purchaseValue
      row.roasWeightedSpend += spend

      row.ctrLinkWeightedClicks += linkClicks
      row.ctrLinkWeightedImpressions += impressions

      row.cpcSpend += spend
      row.cpcClicks += linkClicks

      row.cpmSpend += spend
      row.cpmImpressions += impressions

      row.frequencyImpressions += impressions
      row.frequencyReach += reach
    })
  })

  return Array.from(map.values())
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((row) => ({
      ...row,
      roas: row.roasWeightedSpend > 0 ? row.roasWeightedValue / row.roasWeightedSpend : 0,
      ctrLink: row.ctrLinkWeightedImpressions > 0 ? (row.ctrLinkWeightedClicks / row.ctrLinkWeightedImpressions) * 100 : 0,
      cpcLink: row.cpcClicks > 0 ? row.cpcSpend / row.cpcClicks : 0,
      cpm: row.cpmImpressions > 0 ? (row.cpmSpend / row.cpmImpressions) * 1000 : 0,
      frequency: row.frequencyReach > 0 ? row.frequencyImpressions / row.frequencyReach : 0,
    }))
}

function TimeframeControls({
  preset,
  setPreset,
  since,
  setSince,
  until,
  setUntil,
  onApply,
}) {
  function handlePreset(value) {
    setPreset(value)

    const today = todayISO()

    if (value === 'today') {
      setSince(today)
      setUntil(today)
    }

    if (value === 'yesterday') {
      const y = addDays(today, -1)
      setSince(y)
      setUntil(y)
    }

    if (value === 'last7') {
      setSince(addDays(today, -6))
      setUntil(today)
    }

    if (value === 'last14') {
      setSince(addDays(today, -13))
      setUntil(today)
    }

    if (value === 'last30') {
      setSince(addDays(today, -29))
      setUntil(today)
    }

    if (value === 'thisMonth') {
      const d = new Date()
      const first = new Date(d.getFullYear(), d.getMonth(), 1)
        .toISOString()
        .slice(0, 10)

      setSince(first)
      setUntil(today)
    }

    if (value === 'custom') {
      return
    }
  }

  return (
    <div className="mb-6 rounded-2xl border border-blue-950 bg-[#070f22] p-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <label className="mb-2 block text-sm text-slate-400">Time frame</label>
          <select
            value={preset}
            onChange={(e) => handlePreset(e.target.value)}
            className="h-[58px] min-w-[250px] rounded-xl border border-blue-900 bg-[#020817] px-4 text-[20px] font-black text-white outline-none"
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
          <label className="mb-2 block text-sm text-slate-400">Da</label>
          <input
            type="date"
            value={since}
            onChange={(e) => {
              setPreset('custom')
              setSince(e.target.value)
            }}
            className="h-[58px] rounded-xl border border-blue-900 bg-[#020817] px-4 text-[20px] font-black text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400">A</label>
          <input
            type="date"
            value={until}
            onChange={(e) => {
              setPreset('custom')
              setUntil(e.target.value)
            }}
            className="h-[58px] rounded-xl border border-blue-900 bg-[#020817] px-4 text-[20px] font-black text-white outline-none"
          />
        </div>

        <button
          onClick={onApply}
          className="h-[58px] rounded-xl bg-green-500 px-7 text-[20px] font-black text-black transition hover:bg-green-400"
        >
          Aggiorna
        </button>

        <div className="ml-auto text-sm text-slate-400">
          Periodo: {formatITDate(since)} → {formatITDate(until)}
        </div>
      </div>
    </div>
  )
}

const metrics = [
  { key: 'spend', label: 'Speso', type: 'currency0' },
  { key: 'roas', label: 'ROAS', type: 'ratio' },
  { key: 'purchaseValue', label: 'Valore acquisti', type: 'currency0' },
  { key: 'aov', label: 'AOV', type: 'currency2' },
  { key: 'purchases', label: 'Acquisti', type: 'number' },
  { key: 'purchaseConversions', label: 'Conv. acquisti', type: 'number' },
  { key: 'addToCart', label: 'Add to cart', type: 'number' },
  { key: 'cro', label: 'CRO campagna', type: 'percent' },
  { key: 'ctrLink', label: 'CTR link', type: 'percent' },
  { key: 'cpcLink', label: 'CPC link', type: 'currency2' },
  { key: 'cpm', label: 'CPM', type: 'currency2' },
  { key: 'impressions', label: 'Impression', type: 'number' },
  { key: 'reach', label: 'Copertura', type: 'number' },
  { key: 'frequency', label: 'Frequenza', type: 'number2' },
  { key: 'costPerResult', label: 'Costo risultato', type: 'currency2' },
  { key: 'linkClicks', label: 'Click link', type: 'number' },
]

function DataRow({ item, level = 0 }) {
  const latest = item.latest || {}
  const previous = item.previous || {}

  return (
    <tr className="border-b border-blue-950">
      <TextCell sub={item.id}>
        <span style={{ paddingLeft: `${level * 28}px` }}>
          {level === 0 ? '▾' : '▸'} {item.name}
        </span>
      </TextCell>

      {metrics.map((metric) => (
        <MetricCell
          key={metric.key}
          current={latest[metric.key]}
          previous={previous[metric.key]}
          type={metric.type}
        />
      ))}
    </tr>
  )
}

function MetaTable({ campaigns }) {
  return (
    <div className="rounded-2xl border border-blue-950 bg-[#070f22] p-6">
      <h2 className="mb-5 text-[20px] font-black uppercase tracking-[0.2em] text-white">
        Campagne attive, adset e creatività
      </h2>

      <div className="max-h-[780px] overflow-auto rounded-2xl border border-blue-950">
        <table className="w-full min-w-[2700px] border-collapse">
          <thead className="sticky top-0 z-20 bg-[#071225]">
            <tr>
              <th className="min-w-[330px] px-4 py-5 text-left text-[17px] font-black uppercase tracking-[0.14em] text-white">
                Campagna / Adset / Creatività
              </th>

              {metrics.map((metric) => (
                <th
                  key={metric.key}
                  className="min-w-[130px] px-4 py-5 text-left text-[15px] font-black uppercase tracking-[0.14em] text-white"
                >
                  {metric.label}
                </th>
              ))}
            </tr>
          </thead>

          <tbody>
            {campaigns.map((campaign) => (
              <>
                <DataRow key={campaign.id} item={campaign} level={0} />

                {(campaign.adsets || []).map((adset) => (
                  <>
                    <DataRow key={adset.id} item={adset} level={1} />

                    {(adset.ads || []).map((ad) => (
                      <DataRow key={ad.id} item={ad} level={2} />
                    ))}
                  </>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function MetaDetailPage() {
  const initialUntil = todayISO()
  const initialSince = addDays(initialUntil, -6)

  const [preset, setPreset] = useState('last7')
  const [since, setSince] = useState(initialSince)
  const [until, setUntil] = useState(initialUntil)

  const [appliedSince, setAppliedSince] = useState(initialSince)
  const [appliedUntil, setAppliedUntil] = useState(initialUntil)

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  async function load() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch(
        `/api/meta-detail?since=${appliedSince}&until=${appliedUntil}`,
        {
          cache: 'no-store',
        }
      )

      const json = await res.json()

      if (json.error) {
        setError(json.error)
      }

      setData(json)
    } catch (err) {
      setError(err?.message || 'Errore caricamento dati Meta')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [appliedSince, appliedUntil])

  const campaigns = data?.campaigns || []

  const chartData = useMemo(() => aggregateTrend(campaigns), [campaigns])

  function applyTimeframe() {
    setAppliedSince(since)
    setAppliedUntil(until)
  }

  return (
    <main className="min-h-screen bg-[#020817] p-6 text-white">
      <a href="/" className="text-slate-400 hover:text-white">
        ← Torna alla dashboard
      </a>

      <div className="mt-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[34px] font-light uppercase tracking-[0.18em] text-white">
            Analisi Meta dettagliata
          </h1>

          <p className="mt-3 text-[17px] text-slate-400">
            Campagne attive → adset → creatività, con variazioni rispetto al periodo precedente.
          </p>
        </div>

        {data?.meta?.updatedAt ? (
          <div className="text-green-400">
            Aggiornato: {new Date(data.meta.updatedAt).toLocaleString('it-IT')}
          </div>
        ) : null}
      </div>

      <div className="mt-8">
        <TimeframeControls
          preset={preset}
          setPreset={setPreset}
          since={since}
          setSince={setSince}
          until={until}
          setUntil={setUntil}
          onApply={applyTimeframe}
        />
      </div>

      {loading ? (
        <div className="rounded-2xl border border-blue-950 bg-[#070f22] p-6 text-[20px] text-white">
          Caricamento dati Meta...
        </div>
      ) : null}

      {error ? (
        <div className="rounded-2xl border border-blue-950 bg-[#070f22] p-6 text-[20px] text-red-400">
          Errore: {error}
        </div>
      ) : null}

      {!loading && !error ? (
        <>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="ROAS, spesa e acquisti">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#102044" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={MUTED} />
                  <YAxis stroke={MUTED} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="roas"
                    name="ROAS"
                    stroke={WHITE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="spend"
                    name="Spesa"
                    stroke={BLUE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="purchases"
                    name="Acquisti"
                    stroke={GREEN}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title="KPI Meta: CTR, CPC, CPM, Frequenza">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#102044" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={MUTED} />
                  <YAxis stroke={MUTED} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  <Line
                    type="monotone"
                    dataKey="ctrLink"
                    name="CTR link %"
                    stroke={BLUE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="cpcLink"
                    name="CPC link"
                    stroke={CYAN}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="cpm"
                    name="CPM"
                    stroke={PURPLE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />

                  <Line
                    type="monotone"
                    dataKey="frequency"
                    name="Frequenza"
                    stroke={WHITE}
                    strokeWidth={3}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
          </div>

          <div className="mt-6">
            <MetaTable campaigns={campaigns} />
          </div>
        </>
      ) : null}
    </main>
  )
}
