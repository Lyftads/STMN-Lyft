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

function Stat({ label, value, tone = '#fff' }) {
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
      <div style={{ fontSize: 20, fontWeight: 900, color: tone }}>
        {value}
      </div>
    </div>
  )
}

function CreativeCard({ row, index }) {
  const img = getCreativeImage(row)
  const name = getCreativeName(row)

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

  // Solo creative ATTIVE nel timeframe selezionato (con spesa > 0 nel periodo)
  const rows = useMemo(
    () => rawRows.filter(r => asNum(r.spend) > 0),
    [rawRows]
  )

  const sortedRows = useMemo(() => {
    return [...rows]
      .sort((a, b) => {
        const aRevenue = asNum(a.purchase_value || a.revenue)
        const bRevenue = asNum(b.purchase_value || b.revenue)

        if (bRevenue !== aRevenue) return bRevenue - aRevenue

        return asNum(b.spend) - asNum(a.spend)
      })
      .slice(0, 24)
  }, [rows])

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
  const totalCpc = totals.clicks > 0 ? totals.spend / totals.clicks : 0

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
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <Stat label="Spesa" value={money(totals.spend)} tone="#3b82f6" />
        <Stat label="Revenue" value={money(totals.revenue)} tone="#22c55e" />
        <Stat label="ROAS" value={ratio(totalRoas)} tone="#22c55e" />
        <Stat label="Ordini" value={num(totals.orders)} tone="#f97316" />
        <Stat label="CPC" value={money(totalCpc)} tone="#ec4899" />
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
              Ordinate per revenue attribuita
            </p>
          </div>

          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            {loading ? 'Caricamento…' : `${rows.length} creative`}
          </div>
        </div>

        {sortedRows.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
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
