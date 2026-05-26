
'use client'

import { useEffect, useMemo, useState } from 'react'

const PRESETS = [
  { id: 'today', label: 'Oggi' },
  { id: 'yesterday', label: 'Ieri' },
  { id: 'last_7d', label: 'Ultimi 7g' },
  { id: 'last_14d', label: 'Ultimi 14g' },
  { id: 'last_28d', label: 'Ultimi 28g' },
  { id: 'this_month', label: 'Mese corrente' },
  { id: 'last_month', label: 'Mese scorso' },
]

const fmtEuro = n => {
  const v = Number(n || 0)
  if (!Number.isFinite(v) || v === 0) return '€0'
  return `€${Math.round(v).toLocaleString('it-IT')}`
}

const fmtPct = n => {
  const v = Number(n || 0)
  if (!Number.isFinite(v) || v === 0) return '0,00%'
  return `${v.toFixed(2).replace('.', ',')}%`
}

const fmtRoas = n => {
  const v = Number(n || 0)
  if (!Number.isFinite(v) || v === 0) return '0,00x'
  return `${v.toFixed(2).replace('.', ',')}x`
}

const fmtNum = n => {
  const v = Number(n || 0)
  if (!Number.isFinite(v) || v === 0) return '0'
  return Math.round(v).toLocaleString('it-IT')
}

export default function CreativePage() {
  const [preset, setPreset] = useState('last_28d')
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('roas')
  const [sortDir, setSortDir] = useState('desc')
  const [activeOnly, setActiveOnly] = useState(true)
  const [quickFilter, setQuickFilter] = useState('all')

  async function loadData() {
    setLoading(true)
    setError('')

    try {
      const res = await fetch(`/api/meta-detail?preset=${preset}&level=ads`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Errore caricamento creative')
      }

      const rawRows = Array.isArray(json.rows) ? json.rows : []

      const ads = rawRows
        .filter(r => r.level === 'ad' || r.ad_id || r.ad_name)
        .map(r => ({
          id: r.ad_id || r.id || `${r.campaign_id || ''}-${r.adset_id || ''}-${r.name || r.ad_name || Math.random()}`,
          name: r.ad_name || r.name || 'Creative senza nome',
          campaign_name: r.campaign_name || 'Campagna non disponibile',
          adset_name: r.adset_name || 'Ad set non disponibile',
          status: r.status || r.effective_status || '',
          thumbnail_url: r.thumbnail_url || r.image_url || r.creative_thumbnail_url || '',
          ctr_link: Number(r.ctr_link || 0),
          spend: Number(r.spend || 0),
          roas: Number(r.roas || 0),
          purchases: Number(r.purchases || 0),
          impressions: Number(r.impressions || 0),
          link_clicks: Number(r.link_clicks || 0),
          cpc_link: Number(r.cpc_link || 0),
          cost_per_result: Number(r.cost_per_result || 0),
        }))

      setRows(ads)
    } catch (e) {
      setError(e.message || 'Errore caricamento creative')
      setRows([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [preset])

  const stats = useMemo(() => {
    const spend = rows.reduce((s, r) => s + Number(r.spend || 0), 0)
    const purchases = rows.reduce((s, r) => s + Number(r.purchases || 0), 0)
    const revenue = rows.reduce((s, r) => s + Number(r.purchase_value || 0), 0)
    const clicks = rows.reduce((s, r) => s + Number(r.link_clicks || 0), 0)
    const impressions = rows.reduce((s, r) => s + Number(r.impressions || 0), 0)

    return {
      totalAds: rows.length,
      spend,
      purchases,
      avgCtr: impressions > 0 ? (clicks / impressions) * 100 : 0,
      avgRoas: spend > 0 ? revenue / spend : rows.length ? rows.reduce((s, r) => s + Number(r.roas || 0), 0) / rows.length : 0,
    }
  }, [rows])

  const filteredRows = useMemo(() => {
    let data = [...rows]

    if (activeOnly) {
      data = data.filter(r => {
        const st = String(r.status || '').toUpperCase()
        return !st || st === 'ACTIVE'
      })
    }

    if (search.trim()) {
      const q = search.toLowerCase()
      data = data.filter(r =>
        String(r.name || '').toLowerCase().includes(q) ||
        String(r.campaign_name || '').toLowerCase().includes(q) ||
        String(r.adset_name || '').toLowerCase().includes(q)
      )
    }

    if (quickFilter === 'top') {
      data = data.filter(r => r.roas >= 4 || r.purchases >= 10)
    }

    if (quickFilter === 'efficient') {
      data = data.filter(r => r.spend > 0 && r.roas >= 2)
    }

    if (quickFilter === 'volume') {
      data = data.filter(r => r.spend >= 100 || r.link_clicks >= 1000)
    }

    if (quickFilter === 'winners') {
      data = data.filter(r => r.roas >= 4)
    }

    if (quickFilter === 'ctr') {
      data = data.filter(r => r.ctr_link >= 1)
    }

    data.sort((a, b) => {
      const av = Number(a[sortBy] || 0)
      const bv = Number(b[sortBy] || 0)
      return sortDir === 'desc' ? bv - av : av - bv
    })

    return data
  }, [rows, search, sortBy, sortDir, activeOnly, quickFilter])

  return (
    <main className="min-h-screen bg-[#050b18] text-white px-6 py-8">
      <div className="max-w-[1680px] mx-auto">
        <div className="flex items-start justify-between gap-6 mb-8">
          <div>
            <h1 className="text-3xl font-black tracking-tight">Creative Library</h1>
            <p className="text-slate-500 mt-2">
              Solo creative Meta · CTR, spesa, ROAS e ordini
            </p>
          </div>

          <button
            onClick={loadData}
            className="rounded-full bg-emerald-500 text-black font-black px-6 py-3 hover:bg-emerald-400 transition"
          >
            ↻ Aggiorna
          </button>
        </div>

        <section className="rounded-2xl border border-slate-800 bg-[#0b1222] p-5 mb-6">
          <div className="flex flex-wrap gap-3">
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={
                  preset === p.id
                    ? 'rounded-full border border-emerald-500 bg-emerald-500/10 text-emerald-400 px-4 py-2 font-bold'
                    : 'rounded-full border border-slate-700 text-slate-400 px-4 py-2 font-bold hover:text-white'
                }
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        {error ? (
          <div className="rounded-xl border border-red-500 bg-red-500/10 text-red-400 p-4 mb-6 font-bold">
            {error}
          </div>
        ) : null}

        <section className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
          <Card label="Creative" value={fmtNum(stats.totalAds)} />
          <Card label="Spesa" value={fmtEuro(stats.spend)} />
          <Card label="ROAS medio" value={fmtRoas(stats.avgRoas)} />
          <Card label="CTR link medio" value={fmtPct(stats.avgCtr)} />
          <Card label="Ordini" value={fmtNum(stats.purchases)} />
        </section>

        <section className="rounded-2xl border border-slate-800 bg-[#0b1222] p-5 mb-6">
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Cerca creative per nome, campagna o ad set..."
            className="w-full rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 outline-none text-white placeholder:text-slate-500 mb-4"
          />

          <div className="flex flex-wrap gap-3">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-white"
            >
              <option value="roas">Sort: ROAS</option>
              <option value="ctr_link">Sort: CTR link</option>
              <option value="spend">Sort: Spesa</option>
              <option value="purchases">Sort: Ordini</option>
              <option value="link_clicks">Sort: Click link</option>
            </select>

            <select
              value={sortDir}
              onChange={e => setSortDir(e.target.value)}
              className="rounded-xl border border-slate-700 bg-[#111827] px-4 py-3 text-white"
            >
              <option value="desc">High → Low</option>
              <option value="asc">Low → High</option>
            </select>

            <button
              onClick={() => setActiveOnly(v => !v)}
              className={
                activeOnly
                  ? 'rounded-xl border border-emerald-500 bg-emerald-500/10 text-emerald-400 px-4 py-3 font-bold'
                  : 'rounded-xl border border-slate-700 text-slate-400 px-4 py-3 font-bold'
              }
            >
              Active only
            </button>
          </div>

          <div className="mt-5">
            <p className="text-xs uppercase tracking-[0.25em] text-slate-500 mb-3">
              Quick filters
            </p>

            <div className="flex flex-wrap gap-3">
              <Quick id="all" label="Tutte" value={quickFilter} setValue={setQuickFilter} />
              <Quick id="top" label="Top Performers" value={quickFilter} setValue={setQuickFilter} />
              <Quick id="efficient" label="Efficient Spenders" value={quickFilter} setValue={setQuickFilter} />
              <Quick id="volume" label="High Volume" value={quickFilter} setValue={setQuickFilter} />
              <Quick id="winners" label="Winners 4x+" value={quickFilter} setValue={setQuickFilter} />
              <Quick id="ctr" label="Link CTR Champions" value={quickFilter} setValue={setQuickFilter} />
            </div>
          </div>
        </section>

        {loading ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-8 text-slate-400">
            Caricamento creative...
          </div>
        ) : filteredRows.length === 0 ? (
          <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-8 text-slate-400">
            Nessuna creative trovata per i filtri selezionati.
          </div>
        ) : (
          <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
            {filteredRows.map(ad => (
              <article
                key={ad.id}
                className="overflow-hidden rounded-2xl border border-slate-800 bg-[#0b1222] hover:border-emerald-500/70 transition"
              >
                <div className="relative h-64 bg-[#2c2c2c] flex items-center justify-center">
                  {ad.thumbnail_url ? (
                    <img
                      src={ad.thumbnail_url}
                      alt={ad.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-slate-500 font-black">Ad Image</span>
                  )}

                  <span className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-black">
                    Meta
                  </span>
                </div>

                <div className="p-4">
                  <h3 className="font-black leading-snug line-clamp-2">
                    {ad.name}
                  </h3>

                  <p className="text-xs text-slate-500 mt-2 line-clamp-1">
                    {ad.campaign_name}
                  </p>

                  <p className="text-xs text-slate-600 mt-1 line-clamp-1">
                    {ad.adset_name}
                  </p>

                  <div className="grid grid-cols-4 gap-3 mt-5 text-center">
                    <Metric label="CTR" value={fmtPct(ad.ctr_link)} green />
                    <Metric label="ROAS" value={fmtRoas(ad.roas)} purple />
                    <Metric label="SPEND" value={fmtEuro(ad.spend)} red />
                    <Metric label="ORDINI" value={fmtNum(ad.purchases)} />
                  </div>
                </div>
              </article>
            ))}
          </section>
        )}
      </div>
    </main>
  )
}

function Card({ label, value }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-[#0b1222] p-5">
      <p className="text-xs uppercase tracking-[0.25em] text-slate-500 font-black">
        {label}
      </p>
      <div className="text-3xl font-black mt-4">{value}</div>
    </div>
  )
}

function Quick({ id, label, value, setValue }) {
  return (
    <button
      onClick={() => setValue(id)}
      className={
        value === id
          ? 'rounded-lg border border-emerald-500 bg-emerald-500/10 text-emerald-400 px-4 py-2 font-bold'
          : 'rounded-lg border border-slate-700 text-slate-300 px-4 py-2 hover:text-white'
      }
    >
      {label}
    </button>
  )
}

function Metric({ label, value, green, purple, red }) {
  let color = 'text-white'
  if (green) color = 'text-emerald-400'
  if (purple) color = 'text-violet-400'
  if (red) color = 'text-rose-400'

  return (
    <div>
      <div className="text-[10px] text-slate-500 uppercase tracking-widest">
        {label}
      </div>
      <div className={`font-black mt-1 ${color}`}>
        {value}
      </div>
    </div>
  )
}
