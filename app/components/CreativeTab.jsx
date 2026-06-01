'use client'

import { useEffect, useMemo, useState } from 'react'

const PRESETS = [
  { id: 'today', label: 'Oggi' },
  { id: 'yesterday', label: 'Ieri' },
  { id: 'last_7d', label: 'Ultimi 7 giorni' },
  { id: 'current_month', label: 'Mese corrente' },
  { id: 'last_month', label: 'Mese scorso' },
  { id: 'last_90d', label: 'Ultimi 90 giorni' },
]

function asNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const chipStyle = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  borderRadius: 11,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  outline: 'none',
}

const selectStyle = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  color: '#fff',
  borderRadius: 11,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  outline: 'none',
}

function money(v) {
  return `€${Math.round(asNum(v)).toLocaleString('it-IT')}`
}

function num(v) {
  return Math.round(asNum(v)).toLocaleString('it-IT')
}

function pct(v) {
  return `${asNum(v).toFixed(2)}%`
}

function ratio(v) {
  return asNum(v).toFixed(2)
}

function getCreativeImage(row) {
  return (
    row?.thumbnail_url ||
    row?.display_image_url ||
    row?.image_url ||
    row?.creative_image_url ||
    row?.preview_image_url ||
    ''
  )
}

function getCreativeName(row) {
  return (
    row?.name ||
    row?.creative_name ||
    row?.ad_name ||
    row?.ad_id ||
    'Creative senza nome'
  )
}

function Sparkline({ data, dataKey, color = '#fff', width = 80, height = 26 }) {
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: 0.8 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeltaBadge({ curr, prev, isLowerBetter = false }) {
  if (prev == null || prev === 0 || curr == null) return null
  const pct = ((curr - prev) / prev) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.1) return null
  const up = pct > 0
  const good = isLowerBetter ? !up : up
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
      background: good ? '#22c55e20' : '#ef444420',
      color: good ? '#22c55e' : '#ef4444',
    }}>
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function Stat({ label, value, tone = '#fff', prev, daily, dataKey, isLowerBetter = false, curr }) {
  return (
    <div
      className="glass-card"
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 8,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: tone }}>
          {value}
        </div>
        {daily && dataKey && <Sparkline data={daily} dataKey={dataKey} color={tone} />}
      </div>
      {prev != null && curr != null && (
        <div style={{ marginTop: 8 }}>
          <DeltaBadge curr={curr} prev={prev} isLowerBetter={isLowerBetter} />
        </div>
      )}
    </div>
  )
}

function CreativeCard({ row, index }) {
  const img = getCreativeImage(row)
  const name = getCreativeName(row)
  const products = Array.isArray(row.products) ? row.products.filter(p => p.image_url) : []
  const isCatalog = products.length > 0

  const spend = asNum(row.spend)
  const purchases = asNum(row.purchases || row.orders)
  const purchaseValue = asNum(row.purchase_value || row.revenue)
  const roas = asNum(row.roas)
  const ctr = asNum(row.ctr_link || row.ctr)
  const cpc = asNum(row.cpc_link || row.cpc)
  const impressions = asNum(row.impressions)
  const clicks = asNum(row.link_clicks || row.clicks)

  return (
    <div
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        overflow: 'hidden',
      }}
    >
      {isCatalog ? (
        <div
          style={{
            aspectRatio: '1 / 1',
            background: 'var(--glass)',
            borderBottom: '1px solid var(--border)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 2,
            padding: '4px 9px', borderRadius: 999,
            background: 'rgba(91,44,255,0.85)', color: '#fff',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            Catalogo · {products.length}
          </div>
          <div style={{
            display: 'flex', gap: 8, height: '100%',
            overflowX: 'auto', scrollSnapType: 'x mandatory',
            padding: 12, scrollbarWidth: 'thin',
          }}>
            {products.map(p => (
              <div key={p.id} style={{
                flex: '0 0 70%', aspectRatio: '1 / 1',
                background: '#0a0a14', borderRadius: 14,
                border: '1px solid var(--border)',
                overflow: 'hidden', scrollSnapAlign: 'start',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a14' }}>
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{
                  padding: '8px 10px',
                  borderTop: '1px solid var(--border)',
                  background: 'rgba(0,0,0,0.4)',
                }}>
                  <div style={{
                    color: '#fff', fontSize: 11, fontWeight: 800,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.name || 'Prodotto'}</div>
                  {p.price && (
                    <div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 2 }}>{p.price}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--glass)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {img ? (
          <img
            src={img}
            alt={name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>Nessuna immagine</div>
        )}
      </div>
      )}

      <div style={{ padding: 18 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 28,
              height: 28,
              borderRadius: 999,
              background: '#5b2cff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: 12,
              fontWeight: 900,
              flex: '0 0 auto',
            }}
          >
            {index + 1}
          </div>

          <div style={{ minWidth: 0 }}>
            <div
              style={{
                color: '#fff',
                fontWeight: 900,
                fontSize: 14,
                lineHeight: 1.35,
                marginBottom: 5,
              }}
            >
              {name}
            </div>

            <div style={{ color: 'var(--text3)', fontSize: 11 }}>
              {row.campaign_name || 'Campagna non disponibile'}
            </div>
          </div>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <Mini label="Spesa" value={money(spend)} />
          <Mini label="Revenue" value={money(purchaseValue)} />
          <Mini label="ROAS" value={ratio(roas)} />
          <Mini label="Ordini" value={num(purchases)} />
          <Mini label="CTR" value={pct(ctr)} />
          <Mini label="CPC" value={money(cpc)} />
          <Mini label="Impression" value={num(impressions)} />
          <Mini label="Click" value={num(clicks)} />
        </div>
      </div>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 12,
        padding: '10px 12px',
      }}
    >
      <div
        style={{
          color: 'var(--text3)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 5,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div style={{ color: '#fff', fontSize: 13, fontWeight: 800 }}>
        {value}
      </div>
    </div>
  )
}

export default function CreativeTab() {
  const [preset, setPreset] = useState('last_7d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    let active = true

    async function loadCreative() {
      try {
        setLoading(true)

        const res = await fetch(`/api/creative?preset=${encodeURIComponent(preset)}`, {
          cache: 'no-store',
        })

        const json = await res.json()

        if (active) {
          setData(json)
        }
      } catch (e) {
        console.log('Creative fetch error:', e.message)

        if (active) {
          setData(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadCreative()

    return () => {
      active = false
    }
  }, [preset])

  const rawRows = Array.isArray(data?.rows) ? data.rows : []

  // Filtri UI
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('roas')
  const [sortDir, setSortDir] = useState('desc')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('')

  // Solo creative ATTIVE nel timeframe selezionato (con spesa > 0 nel periodo)
  const rows = useMemo(
    () => rawRows.filter(r => asNum(r.spend) > 0),
    [rawRows]
  )

  const campaigns = useMemo(() => {
    const set = new Map()
    for (const r of rows) {
      const id = r.campaign_id || ''
      const name = r.campaign_name || 'Senza campagna'
      if (id && !set.has(id)) set.set(id, name)
    }
    return Array.from(set, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.campaign_name || '').toLowerCase().includes(q) ||
        (r.adset_name || '').toLowerCase().includes(q)
      )
    }
    if (campaignFilter) {
      out = out.filter(r => r.campaign_id === campaignFilter)
    }
    if (quickFilter === 'top') {
      out = out.filter(r => asNum(r.roas) >= 3)
    } else if (quickFilter === 'winners') {
      out = out.filter(r => asNum(r.roas) >= 4)
    } else if (quickFilter === 'efficient') {
      const cpcVals = out.map(r => asNum(r.cpc_link)).filter(v => v > 0).sort((a, b) => a - b)
      const median = cpcVals[Math.floor(cpcVals.length / 2)] || 0
      out = out.filter(r => asNum(r.cpc_link) > 0 && asNum(r.cpc_link) <= median && asNum(r.orders || r.purchases) > 0)
    } else if (quickFilter === 'volume') {
      const sorted = [...out].sort((a, b) => asNum(b.spend) - asNum(a.spend))
      const topN = Math.max(1, Math.ceil(sorted.length * 0.2))
      const cutoff = asNum(sorted[topN - 1]?.spend)
      out = out.filter(r => asNum(r.spend) >= cutoff)
    } else if (quickFilter === 'ctr') {
      const sorted = [...out].sort((a, b) => asNum(b.ctr_link) - asNum(a.ctr_link))
      const topN = Math.max(1, Math.ceil(sorted.length * 0.2))
      const cutoff = asNum(sorted[topN - 1]?.ctr_link)
      out = out.filter(r => asNum(r.ctr_link) >= cutoff && asNum(r.ctr_link) > 0)
    }
    return out
  }, [rows, search, campaignFilter, quickFilter])

  const sortedRows = useMemo(() => {
    const getVal = (r) => {
      switch (sortBy) {
        case 'roas': return asNum(r.roas)
        case 'spend': return asNum(r.spend)
        case 'revenue': return asNum(r.purchase_value || r.revenue)
        case 'orders': return asNum(r.purchases || r.orders)
        case 'cpc': return asNum(r.cpc_link)
        case 'ctr': return asNum(r.ctr_link)
        case 'impressions': return asNum(r.impressions)
        default: return asNum(r.purchase_value || r.revenue)
      }
    }
    const mult = sortDir === 'asc' ? 1 : -1
    return [...filteredRows].sort((a, b) => (getVal(a) - getVal(b)) * mult)
  }, [filteredRows, sortBy, sortDir])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.spend += asNum(row.spend)
        acc.revenue += asNum(row.purchase_value || row.revenue)
        acc.orders += asNum(row.purchases || row.orders)
        acc.impressions += asNum(row.impressions)
        acc.clicks += asNum(row.link_clicks || row.clicks)
        return acc
      },
      {
        spend: 0,
        revenue: 0,
        orders: 0,
        impressions: 0,
        clicks: 0,
      }
    )
  }, [rows])

  const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  // Usa cpc_link/ctr_link dalla API summary (calcolati con fallback chain
  // più solido che il calcolo client-side da totals.clicks).
  const apiSummary = data?.summary || null
  const totalCpc =
    asNum(apiSummary?.cpc_link) ||
    (totals.clicks > 0 ? totals.spend / totals.clicks : 0)
  const totalCtr =
    asNum(apiSummary?.ctr_link) ||
    (totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)

  const prevSummary = data?.prevSummary || null
  const daily = Array.isArray(data?.dailySeries) ? data.dailySeries : []

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          gap: 16,
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: '#fff',
              fontSize: 32,
              fontWeight: 900,
              letterSpacing: '-0.04em',
            }}
          >
            Creative
          </h1>

          <p
            style={{
              margin: '8px 0 0',
              color: 'var(--text3)',
              fontSize: 14,
            }}
          >
            Analisi creative Meta Ads
            {data?.range?.since && data?.range?.until
              ? ` · ${data.range.since} – ${data.range.until}`
              : ''}
          </p>
        </div>

        <select
          value={preset}
          onChange={(e) => setPreset(e.target.value)}
          style={{
            background: 'var(--glass)',
            color: '#fff',
            border: '1px solid var(--border)',
            borderRadius: 12,
            padding: '12px 16px',
            fontSize: 14,
            outline: 'none',
          }}
        >
          {PRESETS.map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <Stat label="Spesa" value={money(totals.spend)} tone="#3b82f6"
          curr={totals.spend} prev={prevSummary?.spend} daily={daily} dataKey="spend" />
        <Stat label="Revenue" value={money(totals.revenue)} tone="#22c55e"
          curr={totals.revenue} prev={prevSummary?.revenue} daily={daily} dataKey="revenue" />
        <Stat label="ROAS" value={ratio(totalRoas)} tone="#22c55e"
          curr={totalRoas} prev={prevSummary?.roas} daily={daily} dataKey="roas" />
        <Stat label="Ordini" value={num(totals.orders)} tone="#f97316"
          curr={totals.orders} prev={prevSummary?.orders} daily={daily} dataKey="orders" />
        <Stat label="CPC" value={money(totalCpc)} tone="#ec4899"
          curr={totalCpc} prev={prevSummary?.cpc_link} daily={daily} dataKey="cpc_link" isLowerBetter />
        <Stat label="CTR Link" value={pct(totalCtr)} tone="#a78bfa"
          curr={totalCtr} prev={prevSummary?.ctr_link} daily={daily} dataKey="ctr_link" />
      </div>

      <div
        className="glass-section"
        style={{
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: '#fff',
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              Top Creative
            </h2>

            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--text3)',
                fontSize: 13,
              }}
            >
              {sortedRows.length} di {rows.length} creative attive
            </p>
          </div>

          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            {loading ? 'Caricamento…' : `${campaigns.length} campagne`}
          </div>
        </div>

        {/* Search + filtri sopra la griglia */}
        <div style={{ marginBottom: 18 }}>
          <input
            type="text"
            placeholder="Cerca creative per nome, campagna o adset…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '13px 16px',
              color: '#fff',
              fontSize: 14,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={selectStyle}
            >
              <option value="roas">Sort: ROAS</option>
              <option value="spend">Sort: Spesa</option>
              <option value="revenue">Sort: Revenue</option>
              <option value="orders">Sort: Ordini</option>
              <option value="cpc">Sort: CPC</option>
              <option value="ctr">Sort: CTR</option>
              <option value="impressions">Sort: Impression</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              style={chipStyle}
            >
              {sortDir === 'desc' ? 'High → Low' : 'Low → High'}
            </button>

            <select
              value={campaignFilter}
              onChange={e => setCampaignFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">Tutte le campagne</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {(search || campaignFilter || quickFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCampaignFilter(''); setQuickFilter('') }}
                style={{ ...chipStyle, borderColor: '#ef444477', color: '#fca5a5' }}
              >
                Reset filtri
              </button>
            )}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 8 }}>
              Quick Filters
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'top', label: 'Top Performers' },
                { id: 'efficient', label: 'Efficient Spenders' },
                { id: 'volume', label: 'High Volume' },
                { id: 'winners', label: 'Winners (4x+)' },
                { id: 'ctr', label: 'Link CTR Champions' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === f.id ? '' : f.id)}
                  style={{
                    ...chipStyle,
                    borderColor: quickFilter === f.id ? '#5b2cff' : 'var(--border)',
                    background: quickFilter === f.id ? 'rgba(91,44,255,0.15)' : 'var(--glass)',
                    color: quickFilter === f.id ? '#c4b5fd' : 'var(--text2)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sortedRows.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 18,
            }}
          >
            {sortedRows.map((row, index) => (
              <CreativeCard
                key={`${row.id || row.ad_id || index}-${index}`}
                row={row}
                index={index}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px dashed var(--border)',
              borderRadius: 18,
              padding: 40,
              textAlign: 'center',
              color: 'var(--text3)',
            }}
          >
            {loading
              ? 'Sto caricando le creative…'
              : 'Nessun dato creative disponibile per il periodo selezionato.'}
          </div>
        )}
      </div>
    </div>
  )
}
