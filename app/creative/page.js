'use client'

import { useEffect, useMemo, useState } from 'react'

const PRESETS = [
  { key: 'today', label: 'Oggi' },
  { key: 'yesterday', label: 'Ieri' },
  { key: 'last_7d', label: 'Ultimi 7g' },
  { key: 'last_14d', label: 'Ultimi 14g' },
  { key: 'last_28d', label: 'Ultimi 28g' },
  { key: 'this_month', label: 'Mese corrente' },
  { key: 'last_month', label: 'Mese scorso' },
]

const QUICK_FILTERS = [
  { key: 'all', label: 'Tutte' },
  { key: 'top', label: 'Top Performers' },
  { key: 'efficient', label: 'Efficient Spenders' },
  { key: 'volume', label: 'High Volume' },
  { key: 'winners', label: 'Winners 4x+' },
  { key: 'ctr', label: 'Link CTR Champions' },
]

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(v) {
  return Math.round(n(v)).toLocaleString('it-IT')
}

function fmtEuro(v) {
  return `€${Math.round(n(v)).toLocaleString('it-IT')}`
}

function fmtEuroDec(v) {
  return `€${n(v).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtPct(v) {
  return `${n(v).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function fmtRoas(v) {
  return `${n(v).toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}x`
}

function getThumb(row) {
  return (
    row.thumbnail_url ||
    row.thumbnail ||
    row.image_url ||
    row.creative_thumbnail_url ||
    row.preview_url ||
    ''
  )
}

function getName(row) {
  return row.ad_name || row.name || row.creative_name || row.ad_id || 'Creative senza nome'
}

export default function CreativePage() {
  const [preset, setPreset] = useState('last_28d')
  const [rows, setRows] = useState([])
  const [summary, setSummary] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('roas')
  const [sortDir, setSortDir] = useState('desc')
  const [quick, setQuick] = useState('all')
  const [activeOnly, setActiveOnly] = useState(true)

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/creative?preset=${preset}`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Errore caricamento creative')
      }

      setRows(Array.isArray(json.rows) ? json.rows : [])
      setSummary(json.summary || null)
    } catch (e) {
      setRows([])
      setSummary(null)
      setError(e.message || 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [preset])

  const filteredRows = useMemo(() => {
    let out = [...rows]

    if (activeOnly) {
      out = out.filter((r) => {
        const status = String(r.status || r.effective_status || '').toUpperCase()
        return !status || status === 'ACTIVE'
      })
    }

    const q = search.trim().toLowerCase()

    if (q) {
      out = out.filter((r) => {
        const haystack = [
          r.ad_name,
          r.name,
          r.creative_name,
          r.campaign_name,
          r.adset_name,
          r.ad_id,
          r.campaign_id,
          r.adset_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()

        return haystack.includes(q)
      })
    }

    if (quick === 'top') {
      out = out.filter((r) => n(r.roas) >= 3)
    }

    if (quick === 'efficient') {
      out = out.filter((r) => n(r.spend) > 0 && n(r.cost_per_result) > 0 && n(r.roas) >= 2)
    }

    if (quick === 'volume') {
      out = out.filter((r) => n(r.spend) >= 100 || n(r.link_clicks) >= 1000)
    }

    if (quick === 'winners') {
      out = out.filter((r) => n(r.roas) >= 4)
    }

    if (quick === 'ctr') {
      out = out.filter((r) => n(r.ctr_link) >= 1)
    }

    out.sort((a, b) => {
      const av = n(a[sortBy])
      const bv = n(b[sortBy])
      return sortDir === 'desc' ? bv - av : av - bv
    })

    return out
  }, [rows, search, sortBy, sortDir, quick, activeOnly])

  const computedSummary = useMemo(() => {
    const totalSpend = filteredRows.reduce((s, r) => s + n(r.spend), 0)
    const totalRevenue = filteredRows.reduce((s, r) => s + n(r.purchase_value), 0)
    const totalOrders = filteredRows.reduce((s, r) => s + n(r.purchases), 0)
    const totalClicks = filteredRows.reduce((s, r) => s + n(r.link_clicks), 0)
    const totalImpressions = filteredRows.reduce((s, r) => s + n(r.impressions), 0)

    return {
      count: filteredRows.length,
      spend: totalSpend,
      roas: totalSpend > 0 ? totalRevenue / totalSpend : 0,
      ctr:
        totalImpressions > 0
          ? (totalClicks / totalImpressions) * 100
          : 0,
      orders: totalOrders,
    }
  }, [filteredRows])

  return (
    <main className="min-h-screen bg-[#050a14] text-white px-6 py-10">
      <div className="max-w-[1680px] mx-auto">
        <header className="flex items-start justify-between gap-6 mb-9">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Creative Library</h1>
            <p className="mt-3 text-slate-400">
              Solo creative Meta · CTR, spesa, ROAS e ordini
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-full bg-emerald-500 text-black font-bold px-8 py-4 hover:bg-emerald-400 transition"
          >
            ↻ Aggiorna
          </button>
        </header>

        <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5 mb-6">
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={[
                  'px-5 py-3 rounded-full border font-semibold transition',
                  preset === p.key
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10'
                    : 'border-slate-700 text-slate-400 hover:text-white hover:border-slate-500',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500 bg-red-500/10 text-red-400 px-5 py-4 font-bold">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <StatCard label="Creative" value={loading ? '—' : fmtInt(computedSummary.count)} />
          <StatCard label="Spesa" value={loading ? '—' : fmtEuro(computedSummary.spend)} />
          <StatCard label="ROAS medio" value={loading ? '—' : fmtRoas(computedSummary.roas)} />
          <StatCard label="CTR link medio" value={loading ? '—' : fmtPct(computedSummary.ctr)} />
          <StatCard label="Ordini" value={loading ? '—' : fmtInt(computedSummary.orders)} />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5 mb-6">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca creative per nome, campagna o ad set..."
            className="w-full rounded-xl border border-slate-700 bg-[#0f1726] px-5 py-4 text-white outline-none placeholder:text-slate-500 focus:border-emerald-400"
          />

          <div className="mt-4 flex flex-wrap gap-3">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0f1726] px-4 py-3 text-white outline-none"
            >
              <option value="roas">Sort: ROAS</option>
              <option value="spend">Sort: Spesa</option>
              <option value="ctr_link">Sort: CTR Link</option>
              <option value="purchases">Sort: Ordini</option>
              <option value="link_clicks">Sort: Click link</option>
            </select>

            <select
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#0f1726] px-4 py-3 text-white outline-none"
            >
              <option value="desc">High → Low</option>
              <option value="asc">Low → High</option>
            </select>

            <button
              onClick={() => setActiveOnly((v) => !v)}
              className={[
                'rounded-xl border px-5 py-3 font-bold transition',
                activeOnly
                  ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10'
                  : 'border-slate-700 text-slate-400',
              ].join(' ')}
            >
              Active only
            </button>
          </div>

          <div className="mt-5">
            <div className="text-xs tracking-[0.35em] uppercase text-slate-500 mb-3">
              Quick filters
            </div>

            <div className="flex flex-wrap gap-3">
              {QUICK_FILTERS.map((f) => (
                <button
                  key={f.key}
                  onClick={() => setQuick(f.key)}
                  className={[
                    'px-5 py-3 rounded-lg border transition',
                    quick === f.key
                      ? 'border-emerald-400 text-emerald-400 bg-emerald-400/10'
                      : 'border-slate-700 text-slate-300 hover:border-slate-500',
                  ].join(' ')}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        {loading ? (
          <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-400">
            Caricamento creative...
          </section>
        ) : filteredRows.length === 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-[#0b1220] p-8 text-slate-400">
            Nessuna creative trovata per i filtri selezionati.
          </section>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {filteredRows.map((row, index) => (
              <CreativeCard key={row.ad_id || row.id || index} row={row} />
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1220] p-5">
      <div className="text-xs uppercase tracking-[0.35em] text-slate-500 font-bold">
        {label}
      </div>
      <div className="mt-5 text-3xl font-black">{value}</div>
    </div>
  )
}

function CreativeCard({ row }) {
  const thumb = getThumb(row)
  const name = getName(row)

  return (
    <article className="rounded-2xl overflow-hidden border border-slate-800 bg-[#0b1220]">
      <div className="relative aspect-[4/3] bg-[#2b2b2b]">
        {thumb ? (
          <img
            src={thumb}
            alt={name}
            className="w-full h-full object-cover"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-slate-500 font-bold">
            Ad Image
          </div>
        )}

        <div className="absolute top-3 left-3 rounded-full bg-black/80 px-3 py-1 text-xs font-bold">
          Meta
        </div>

        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black via-black/70 to-transparent p-4">
          <div className="grid grid-cols-4 gap-2 text-center">
            <Metric label="CTR" value={fmtPct(row.ctr_link)} green />
            <Metric label="ROAS" value={fmtRoas(row.roas)} purple />
            <Metric label="Spend" value={fmtEuro(row.spend)} red />
            <Metric label="Ordini" value={fmtInt(row.purchases)} />
          </div>
        </div>
      </div>

      <div className="p-4">
        <h3 className="font-bold text-white leading-snug line-clamp-2">
          {name}
        </h3>

        <div className="mt-2 text-sm text-slate-500 line-clamp-1">
          {row.campaign_name || 'Campagna non disponibile'}
        </div>

        <div className="mt-1 text-sm text-slate-500 line-clamp-1">
          {row.adset_name || 'Ad set non disponibile'}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
          <Small label="Click link" value={fmtInt(row.link_clicks)} />
          <Small label="CPC link" value={fmtEuroDec(row.cpc_link)} />
          <Small label="CPA" value={n(row.cost_per_result) ? fmtEuroDec(row.cost_per_result) : '—'} />
          <Small label="Revenue" value={fmtEuro(row.purchase_value)} />
        </div>
      </div>
    </article>
  )
}

function Metric({ label, value, green, purple, red }) {
  let cls = 'text-white'

  if (green) cls = 'text-emerald-400'
  if (purple) cls = 'text-violet-400'
  if (red) cls = 'text-rose-400'

  return (
    <div>
      <div className="text-[10px] uppercase text-slate-400">{label}</div>
      <div className={`font-black ${cls}`}>{value}</div>
    </div>
  )
}

function Small({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-[#070d18] p-3">
      <div className="text-[10px] uppercase tracking-widest text-slate-500">
        {label}
      </div>
      <div className="mt-1 font-bold">{value}</div>
    </div>
  )
}
