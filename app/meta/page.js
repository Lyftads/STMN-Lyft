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
const RED = '#ff4d4d'
const GREEN = '#22c55e'
const BLUE = '#60a5fa'
const CYAN = '#22d3ee'
const PURPLE = '#818cf8'
const CARD = '#070f22'
const BORDER = '#1e3a8a'

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

const pct2 = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

function n(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function isoDate(date) {
  const d = new Date(date)
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function addDays(date, days) {
  const d = new Date(date)
  d.setDate(d.getDate() + days)
  return d
}

function formatDateLabel(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
  })
}

function formatFullDate(value) {
  if (!value) return '—'
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value

  return d.toLocaleDateString('it-IT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  })
}

function formatMetric(value, type) {
  const v = n(value)

  if (type === 'euro0') return `€${euro0.format(v)}`
  if (type === 'euro2') return `€${euro2.format(v)}`
  if (type === 'pct') return `${pct2.format(v)}%`
  if (type === 'x') return `${num2.format(v)}×`
  if (type === 'dec') return num2.format(v)

  return num0.format(v)
}

function getDelta(current, previous) {
  const curr = n(current)
  const prev = n(previous)

  if (!previous && previous !== 0) {
    return {
      value: null,
      pct: null,
      hasPrevious: false,
    }
  }

  const value = curr - prev
  const pct = prev !== 0 ? (value / Math.abs(prev)) * 100 : null

  return {
    value,
    pct,
    hasPrevious: true,
  }
}

function DeltaBlock({ current, previous, type = 'num' }) {
  const delta = getDelta(current, previous)

  if (!delta.hasPrevious) {
    return (
      <div className="mt-2 text-[13px] leading-tight text-slate-500">
        <div>—</div>
        <div>—</div>
      </div>
    )
  }

  const isNegative = delta.value < 0
  const color = isNegative ? RED : WHITE

  return (
    <div className="mt-2 text-[13px] leading-tight font-bold" style={{ color }}>
      <div>
        {delta.value > 0 ? '+' : ''}
        {formatMetric(delta.value, type)}
      </div>
      <div>
        {delta.pct === null ? '—' : `${delta.pct > 0 ? '+' : ''}${pct2.format(delta.pct)}%`}
      </div>
    </div>
  )
}

function metricPrevious(row, key) {
  if (!row) return null

  if (row.previous && row.previous[key] !== undefined) {
    return row.previous[key]
  }

  const weeks = Array.isArray(row.weeks) ? row.weeks : []

  if (weeks.length >= 2) {
    const sorted = [...weeks].sort((a, b) => String(a.date).localeCompare(String(b.date)))
    return sorted[sorted.length - 2]?.[key] ?? null
  }

  return null
}

function getLatest(row) {
  return row?.latest || row || {}
}

function getWeeks(row) {
  const weeks = Array.isArray(row?.weeks) ? row.weeks : []

  return [...weeks]
    .filter(Boolean)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

function buildChartData(campaigns) {
  const firstCampaign = campaigns?.[0]
  const weeks = getWeeks(firstCampaign)

  return weeks.map((w) => ({
    date: formatDateLabel(w.date || w.dateStart),
    roas: n(w.roas),
    spend: n(w.spend),
    purchases: n(w.purchases),
    ctrLink: n(w.ctrLink),
    cpcLink: n(w.cpcLink),
    cpm: n(w.cpm),
    frequency: n(w.frequency),
  }))
}

function sortByMetric(items, metric, direction = 'desc') {
  const cloned = [...items]
  cloned.sort((a, b) => {
    const av = n(getLatest(a)[metric])
    const bv = n(getLatest(b)[metric])

    return direction === 'desc' ? bv - av : av - bv
  })

  return cloned
}

function flattenRows(campaigns) {
  const rows = []

  campaigns.forEach((campaign) => {
    rows.push({
      ...campaign,
      level: 'campaign',
      depth: 0,
    })

    const adsets = Array.isArray(campaign.adsets) ? campaign.adsets : []

    adsets.forEach((adset) => {
      rows.push({
        ...adset,
        level: 'adset',
        depth: 1,
      })

      const ads = Array.isArray(adset.ads) ? adset.ads : []

      ads.forEach((ad) => {
        rows.push({
          ...ad,
          level: 'ad',
          depth: 2,
        })
      })
    })
  })

  return rows
}

function extractProductName(row) {
  const creative = row.creative || {}
  const possible = [
    creative.productName,
    creative.product_name,
    creative.name,
    row.productName,
    row.product_name,
    row.adName,
    row.name,
  ]

  const found = possible.find((x) => typeof x === 'string' && x.trim())

  if (!found) return null

  return found
    .replace('{{product.name}}', 'Prodotto catalogo')
    .replace(/\s+/g, ' ')
    .trim()
}

function extractAngle(row) {
  const text = [
    row.name,
    row.adName,
    row.adsetName,
    row.campaignName,
    row.creative?.headline,
    row.creative?.body,
    row.creative?.primaryText,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase()

  if (text.includes('tof') || text.includes('broad') || text.includes('cold')) return 'Prospecting / Broad'
  if (text.includes('mofu') || text.includes('middle')) return 'MOFU / Considerazione'
  if (text.includes('bofu') || text.includes('ret') || text.includes('remarketing')) return 'BOFU / Remarketing'
  if (text.includes('upsell')) return 'Upselling'
  if (text.includes('stock')) return 'Disponibilità / In stock'
  if (text.includes('daba') || text.includes('catalog')) return 'Catalogo / Advantage+'
  if (text.includes('ugc')) return 'UGC'
  if (text.includes('fomo')) return 'FOMO'
  if (text.includes('bundle')) return 'Bundle'

  return 'Non classificato'
}

function buildProductInsights(campaigns) {
  const rows = flattenRows(campaigns).filter((row) => row.level === 'ad')

  const grouped = new Map()

  rows.forEach((row) => {
    const latest = getLatest(row)
    const product = extractProductName(row)

    if (!product) return

    const key = product

    if (!grouped.has(key)) {
      grouped.set(key, {
        product,
        spend: 0,
        purchases: 0,
        purchaseValue: 0,
        addToCart: 0,
        linkClicks: 0,
        roas: 0,
        aov: 0,
        rows: [],
      })
    }

    const item = grouped.get(key)

    item.spend += n(latest.spend)
    item.purchases += n(latest.purchases)
    item.purchaseValue += n(latest.purchaseValue)
    item.addToCart += n(latest.addToCart)
    item.linkClicks += n(latest.linkClicks)
    item.rows.push(row)
  })

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      roas: item.spend > 0 ? item.purchaseValue / item.spend : 0,
      aov: item.purchases > 0 ? item.purchaseValue / item.purchases : 0,
      cro: item.linkClicks > 0 ? (item.purchases / item.linkClicks) * 100 : 0,
    }))
    .sort((a, b) => b.purchaseValue - a.purchaseValue)
    .slice(0, 10)
}

function buildAngleInsights(campaigns) {
  const rows = flattenRows(campaigns).filter((row) => row.level === 'ad')

  const grouped = new Map()

  rows.forEach((row) => {
    const latest = getLatest(row)
    const angle = extractAngle(row)

    if (!grouped.has(angle)) {
      grouped.set(angle, {
        angle,
        spend: 0,
        purchases: 0,
        purchaseValue: 0,
        addToCart: 0,
        linkClicks: 0,
        rows: [],
      })
    }

    const item = grouped.get(angle)

    item.spend += n(latest.spend)
    item.purchases += n(latest.purchases)
    item.purchaseValue += n(latest.purchaseValue)
    item.addToCart += n(latest.addToCart)
    item.linkClicks += n(latest.linkClicks)
    item.rows.push(row)
  })

  return [...grouped.values()]
    .map((item) => ({
      ...item,
      roas: item.spend > 0 ? item.purchaseValue / item.spend : 0,
      aov: item.purchases > 0 ? item.purchaseValue / item.purchases : 0,
      cro: item.linkClicks > 0 ? (item.purchases / item.linkClicks) * 100 : 0,
    }))
    .sort((a, b) => b.purchaseValue - a.purchaseValue)
}

function buildDescriptiveInsights(campaigns) {
  const rows = flattenRows(campaigns)
  const campaignRows = rows.filter((row) => row.level === 'campaign')
  const adRows = rows.filter((row) => row.level === 'ad')

  const topCampaigns = sortByMetric(campaignRows, 'purchaseValue', 'desc').slice(0, 3)
  const worstSpend = sortByMetric(
    campaignRows.filter((row) => n(getLatest(row).spend) > 0),
    'roas',
    'asc'
  ).slice(0, 3)

  const bestAds = sortByMetric(adRows, 'purchaseValue', 'desc').slice(0, 5)
  const badAds = adRows
    .filter((row) => n(getLatest(row).spend) > 20 && n(getLatest(row).purchases) === 0)
    .sort((a, b) => n(getLatest(b).spend) - n(getLatest(a).spend))
    .slice(0, 5)

  const totalSpend = campaignRows.reduce((sum, row) => sum + n(getLatest(row).spend), 0)
  const totalPurchaseValue = campaignRows.reduce((sum, row) => sum + n(getLatest(row).purchaseValue), 0)
  const totalPurchases = campaignRows.reduce((sum, row) => sum + n(getLatest(row).purchases), 0)
  const totalClicks = campaignRows.reduce((sum, row) => sum + n(getLatest(row).linkClicks), 0)
  const totalRoas = totalSpend > 0 ? totalPurchaseValue / totalSpend : 0
  const totalCro = totalClicks > 0 ? (totalPurchases / totalClicks) * 100 : 0
  const totalAov = totalPurchases > 0 ? totalPurchaseValue / totalPurchases : 0

  const todos = []

  if (totalRoas < 2) {
    todos.push('ROAS complessivo basso: ridurre budget sugli adset con ROAS sotto media e concentrare spesa su campagne/adset profittevoli.')
  } else if (totalRoas >= 3) {
    todos.push('ROAS complessivo positivo: valutare scaling progressivo sui migliori adset mantenendo sotto controllo frequenza e CPA.')
  }

  if (totalCro < 2) {
    todos.push('CRO campagna basso: il traffico clicca ma converte poco. Migliorare coerenza tra creatività, prodotto, landing e offerta.')
  }

  if (badAds.length > 0) {
    todos.push('Spegnere o rifare le creatività che spendono senza acquisti: stanno consumando budget senza generare output.')
  }

  if (bestAds.length > 0) {
    todos.push('Duplicare gli angoli delle migliori creatività e creare nuove varianti su hook, headline, visual e prodotto.')
  }

  return {
    totalSpend,
    totalPurchaseValue,
    totalPurchases,
    totalClicks,
    totalRoas,
    totalCro,
    totalAov,
    topCampaigns,
    worstSpend,
    bestAds,
    badAds,
    todos,
  }
}

function CreativePreview({ row }) {
  const creative = row.creative || {}
  const thumb = creative.thumbnailUrl || creative.imageUrl || creative.url || null
  const headline = creative.headline || creative.title || ''
  const body = creative.body || creative.primaryText || creative.message || ''
  const link = creative.linkUrl || creative.objectUrl || creative.url || ''

  if (!thumb && !headline && !body && !link) {
    return null
  }

  return (
    <div className="mt-3 grid grid-cols-[72px_1fr] gap-3 rounded-xl border border-blue-900/50 bg-slate-950/40 p-3">
      <div className="h-[72px] w-[72px] overflow-hidden rounded-lg bg-slate-900">
        {thumb ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumb} alt="" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-slate-500">
            no img
          </div>
        )}
      </div>

      <div className="min-w-0">
        {headline ? (
          <div className="text-sm font-bold text-white">{headline}</div>
        ) : null}

        {body ? (
          <div className="mt-1 line-clamp-3 text-xs leading-relaxed text-slate-400">
            {body}
          </div>
        ) : null}

        {link ? (
          <div className="mt-1 truncate text-xs text-blue-300">
            {link}
          </div>
        ) : null}
      </div>
    </div>
  )
}

function MetricCell({ row, metric, type = 'num' }) {
  const latest = getLatest(row)
  const current = latest[metric]
  const previous = metricPrevious(row, metric)

  return (
    <td className="min-w-[130px] px-4 py-5 align-top text-white">
      <div className="text-[19px] font-black leading-none">
        {formatMetric(current, type)}
      </div>
      <DeltaBlock current={current} previous={previous} type={type} />
    </td>
  )
}

function RowNameCell({ row }) {
  const latest = getLatest(row)
  const depth = row.depth || 0
  const isAd = row.level === 'ad'

  const name =
    row.name ||
    latest.adName ||
    latest.adsetName ||
    latest.campaignName ||
    row.adName ||
    row.adsetName ||
    row.campaignName ||
    'Senza nome'

  const id = row.id || latest.adId || latest.adsetId || latest.campaignId || ''

  return (
    <td className="sticky left-0 z-10 min-w-[470px] bg-[#071225] px-4 py-5 align-top text-white">
      <div
        className="flex items-start gap-2"
        style={{ paddingLeft: depth * 26 }}
      >
        <span className="mt-[2px] text-xs text-slate-400">
          {row.level === 'campaign' ? '▾' : row.level === 'adset' ? '▸' : '•'}
        </span>

        <div className="min-w-0">
          <div className="text-[18px] font-black leading-snug">
            {name}
          </div>

          {id ? (
            <div className="mt-2 text-xs text-slate-500">
              {id}
            </div>
          ) : null}

          {isAd ? <CreativePreview row={row} /> : null}
        </div>
      </div>
    </td>
  )
}

function InsightsPanel({ campaigns }) {
  const insights = useMemo(() => buildDescriptiveInsights(campaigns), [campaigns])
  const products = useMemo(() => buildProductInsights(campaigns), [campaigns])
  const angles = useMemo(() => buildAngleInsights(campaigns), [campaigns])

  return (
    <section className="rounded-2xl border border-blue-900/70 bg-[#070f22] p-6">
      <h2 className="mb-5 text-[20px] font-black uppercase tracking-[0.18em] text-white">
        Insight performance e azioni consigliate
      </h2>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">Speso</div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatMetric(insights.totalSpend, 'euro0')}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">ROAS</div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatMetric(insights.totalRoas, 'x')}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">CRO campagna</div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatMetric(insights.totalCro, 'pct')}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-4">
          <div className="text-xs uppercase tracking-[0.16em] text-slate-400">AOV</div>
          <div className="mt-2 text-2xl font-black text-white">
            {formatMetric(insights.totalAov, 'euro2')}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">
            Cosa sta funzionando
          </h3>

          <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
            {insights.topCampaigns.length ? (
              insights.topCampaigns.map((row) => {
                const latest = getLatest(row)

                return (
                  <li key={row.id || latest.campaignId}>
                    <strong className="text-white">{row.name || latest.campaignName}</strong>
                    {' '}sta generando {formatMetric(latest.purchaseValue, 'euro0')} di valore acquisti,
                    con ROAS {formatMetric(latest.roas, 'x')} e {formatMetric(latest.purchases)} acquisti.
                  </li>
                )
              })
            ) : (
              <li>Nessuna campagna con dati sufficienti.</li>
            )}
          </ul>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-5">
          <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">
            Cosa non sta funzionando
          </h3>

          <ul className="space-y-3 text-sm leading-relaxed text-slate-300">
            {insights.worstSpend.length ? (
              insights.worstSpend.map((row) => {
                const latest = getLatest(row)

                return (
                  <li key={row.id || latest.campaignId}>
                    <strong className="text-white">{row.name || latest.campaignName}</strong>
                    {' '}ha ROAS {formatMetric(latest.roas, 'x')} con spesa {formatMetric(latest.spend, 'euro0')}.
                    Da verificare budget, pubblico, creatività e prodotto spinto.
                  </li>
                )
              })
            ) : (
              <li>Nessuna criticità evidente dai dati disponibili.</li>
            )}
          </ul>
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-blue-900/50 bg-slate-950/30 p-5">
        <h3 className="mb-3 text-sm font-black uppercase tracking-[0.16em] text-white">
          To do operativi
        </h3>

        <ul className="space-y-2 text-sm leading-relaxed text-slate-300">
          {insights.todos.length ? (
            insights.todos.map((todo, index) => (
              <li key={index}>• {todo}</li>
            ))
          ) : (
            <li>Continuare a monitorare scaling, frequenza e CPA. I dati non mostrano ancora azioni prioritarie evidenti.</li>
          )}

          <li>
            • [Inferenza] Con campagne catalogo, Meta può mostrare prodotti dinamici. Questa dashboard può leggere creatività,
            nomi, thumbnail e performance, ma per sapere con certezza quale SKU/prodotto ha venduto serve collegare anche il dato prodotto da Shopify oppure un breakdown Meta compatibile.
          </li>
        </ul>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-2">
        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-white">
            Prodotti / creatività catalogo più forti
          </h3>

          <div className="space-y-3">
            {products.length ? (
              products.map((item) => (
                <div key={item.product} className="rounded-lg border border-blue-900/40 p-3">
                  <div className="font-bold text-white">{item.product}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Valore {formatMetric(item.purchaseValue, 'euro0')} · ROAS {formatMetric(item.roas, 'x')} ·
                    Acquisti {formatMetric(item.purchases)} · AOV {formatMetric(item.aov, 'euro2')}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">
                Non vedo ancora nomi prodotto leggibili nei dati creatività. [Non verificato]
              </div>
            )}
          </div>
        </div>

        <div className="rounded-xl border border-blue-900/50 bg-slate-950/30 p-5">
          <h3 className="mb-4 text-sm font-black uppercase tracking-[0.16em] text-white">
            Angoli comunicativi
          </h3>

          <div className="space-y-3">
            {angles.length ? (
              angles.map((item) => (
                <div key={item.angle} className="rounded-lg border border-blue-900/40 p-3">
                  <div className="font-bold text-white">{item.angle}</div>
                  <div className="mt-1 text-xs text-slate-400">
                    Valore {formatMetric(item.purchaseValue, 'euro0')} · ROAS {formatMetric(item.roas, 'x')} ·
                    CRO {formatMetric(item.cro, 'pct')} · Spesa {formatMetric(item.spend, 'euro0')}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-400">
                Nessun angolo classificabile dai naming attuali. [Inferenza]
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  )
}

function TimeFrameSelector({
  preset,
  setPreset,
  since,
  setSince,
  until,
  setUntil,
  onApply,
}) {
  function applyPreset(value) {
    setPreset(value)

    const today = new Date()

    if (value === 'today') {
      setSince(isoDate(today))
      setUntil(isoDate(today))
      return
    }

    if (value === 'yesterday') {
      const yesterday = addDays(today, -1)
      setSince(isoDate(yesterday))
      setUntil(isoDate(yesterday))
      return
    }

    if (value === 'last_7d') {
      setSince(isoDate(addDays(today, -6)))
      setUntil(isoDate(today))
      return
    }

    if (value === 'last_14d') {
      setSince(isoDate(addDays(today, -13)))
      setUntil(isoDate(today))
      return
    }

    if (value === 'last_30d') {
      setSince(isoDate(addDays(today, -29)))
      setUntil(isoDate(today))
      return
    }

    if (value === 'this_month') {
      const start = new Date(today.getFullYear(), today.getMonth(), 1)
      setSince(isoDate(start))
      setUntil(isoDate(today))
      return
    }

    if (value === 'last_month') {
      const start = new Date(today.getFullYear(), today.getMonth() - 1, 1)
      const end = new Date(today.getFullYear(), today.getMonth(), 0)
      setSince(isoDate(start))
      setUntil(isoDate(end))
      return
    }
  }

  return (
    <section className="rounded-2xl border border-blue-900/70 bg-[#070f22] p-5">
      <div className="grid gap-4 lg:grid-cols-[260px_210px_210px_140px_1fr] lg:items-end">
        <div>
          <label className="mb-2 block text-sm text-slate-400">
            Time frame
          </label>

          <select
            value={preset}
            onChange={(event) => applyPreset(event.target.value)}
            className="h-[54px] w-full rounded-xl border border-blue-900/70 bg-[#020817] px-4 text-lg font-black text-white outline-none"
          >
            <option value="today">Oggi</option>
            <option value="yesterday">Ieri</option>
            <option value="last_7d">Ultimi 7 giorni</option>
            <option value="last_14d">Ultimi 14 giorni</option>
            <option value="last_30d">Ultimi 30 giorni</option>
            <option value="this_month">Questo mese</option>
            <option value="last_month">Mese scorso</option>
            <option value="custom">Personalizzato</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400">
            Da
          </label>

          <input
            type="date"
            value={since}
            onChange={(event) => {
              setPreset('custom')
              setSince(event.target.value)
            }}
            className="h-[54px] w-full rounded-xl border border-blue-900/70 bg-[#020817] px-4 text-lg font-black text-white outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm text-slate-400">
            A
          </label>

          <input
            type="date"
            value={until}
            onChange={(event) => {
              setPreset('custom')
              setUntil(event.target.value)
            }}
            className="h-[54px] w-full rounded-xl border border-blue-900/70 bg-[#020817] px-4 text-lg font-black text-white outline-none"
          />
        </div>

        <button
          type="button"
          onClick={onApply}
          className="h-[54px] rounded-xl bg-green-500 px-5 text-lg font-black text-slate-950"
        >
          Aggiorna
        </button>

        <div className="text-right text-sm text-slate-400">
          Periodo: {since} → {until}
        </div>
      </div>
    </section>
  )
}

export default function MetaPage() {
  const [preset, setPreset] = useState('last_7d')
  const [since, setSince] = useState(() => isoDate(addDays(new Date(), -6)))
  const [until, setUntil] = useState(() => isoDate(new Date()))

  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [updatedAt, setUpdatedAt] = useState('')

  async function loadData() {
    try {
      setLoading(true)
      setError('')

      const res = await fetch(`/api/meta-detail?since=${since}&until=${until}`, {
        cache: 'no-store',
      })

      const text = await res.text()

      let json = null

      try {
        json = JSON.parse(text)
      } catch (err) {
        throw new Error(`Risposta API non valida: ${text.slice(0, 300)}`)
      }

      if (!res.ok || json?.error) {
        throw new Error(json?.error || `Errore API ${res.status}`)
      }

      setData(json)
      setUpdatedAt(new Date().toLocaleString('it-IT'))
    } catch (err) {
      setError(err?.message || 'Errore sconosciuto')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const campaigns = Array.isArray(data?.campaigns) ? data.campaigns : []
  const chartData = useMemo(() => buildChartData(campaigns), [campaigns])
  const rows = useMemo(() => flattenRows(campaigns), [campaigns])

  return (
    <main className="min-h-screen bg-[#020817] px-5 py-8 text-white">
      <div className="mx-auto max-w-[1800px]">
        <a href="/" className="text-sm text-slate-400 hover:text-white">
          ← Torna alla dashboard
        </a>

        <div className="mt-8 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-[34px] uppercase tracking-[0.18em] text-white">
              Analisi Meta dettagliata
            </h1>

            <p className="mt-3 text-slate-400">
              Campagne attive → adset → creatività, con variazioni rispetto al periodo precedente.
            </p>
          </div>

          {updatedAt ? (
            <div className="text-sm text-green-400">
              Aggiornato: {updatedAt}
            </div>
          ) : null}
        </div>

        <div className="mt-8">
          <TimeFrameSelector
            preset={preset}
            setPreset={setPreset}
            since={since}
            setSince={setSince}
            until={until}
            setUntil={setUntil}
            onApply={loadData}
          />
        </div>

        {loading ? (
          <div className="mt-6 rounded-2xl border border-blue-900/70 bg-[#070f22] p-6 text-white">
            Caricamento dati Meta...
          </div>
        ) : null}

        {error ? (
          <div className="mt-6 rounded-2xl border border-blue-900/70 bg-[#070f22] p-6 text-red-400">
            Errore: {error}
          </div>
        ) : null}

        {!loading && !error ? (
          <>
            <div className="mt-6 grid gap-5 lg:grid-cols-2">
              <section className="rounded-2xl border border-blue-900/70 bg-[#070f22] p-5">
                <h2 className="mb-4 text-[20px] font-black uppercase tracking-[0.18em] text-white">
                  ROAS, spesa e acquisti
                </h2>

                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#102040" />
                      <XAxis dataKey="date" stroke={MUTED} />
                      <YAxis stroke={MUTED} />
                      <Tooltip
                        contentStyle={{
                          background: CARD,
                          border: `1px solid ${BORDER}`,
                          color: WHITE,
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="roas" name="ROAS" stroke={WHITE} strokeWidth={2} dot />
                      <Line type="monotone" dataKey="spend" name="Spesa" stroke={BLUE} strokeWidth={2} dot />
                      <Line type="monotone" dataKey="purchases" name="Acquisti" stroke={GREEN} strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>

              <section className="rounded-2xl border border-blue-900/70 bg-[#070f22] p-5">
                <h2 className="mb-4 text-[20px] font-black uppercase tracking-[0.18em] text-white">
                  KPI Meta: CTR, CPC, CPM, frequenza
                </h2>

                <div className="h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#102040" />
                      <XAxis dataKey="date" stroke={MUTED} />
                      <YAxis stroke={MUTED} />
                      <Tooltip
                        contentStyle={{
                          background: CARD,
                          border: `1px solid ${BORDER}`,
                          color: WHITE,
                        }}
                      />
                      <Legend />
                      <Line type="monotone" dataKey="ctrLink" name="CTR link %" stroke={BLUE} strokeWidth={2} dot />
                      <Line type="monotone" dataKey="cpcLink" name="CPC link" stroke={CYAN} strokeWidth={2} dot />
                      <Line type="monotone" dataKey="cpm" name="CPM" stroke={PURPLE} strokeWidth={2} dot />
                      <Line type="monotone" dataKey="frequency" name="Frequenza" stroke={WHITE} strokeWidth={2} dot />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </section>
            </div>

            <div className="mt-6">
              <InsightsPanel campaigns={campaigns} />
            </div>

            <section className="mt-6 rounded-2xl border border-blue-900/70 bg-[#070f22] p-6">
              <h2 className="mb-5 text-[20px] font-black uppercase tracking-[0.18em] text-white">
                Campagne attive, adset e creatività
              </h2>

              <div className="overflow-auto rounded-2xl border border-blue-900/70">
                <table className="w-full min-w-[2100px] border-collapse bg-[#071225]">
                  <thead className="sticky top-0 z-20 bg-[#071225]">
                    <tr className="border-b border-blue-900/70 text-left text-sm uppercase tracking-[0.16em] text-white">
                      <th className="sticky left-0 z-30 min-w-[470px] bg-[#071225] px-4 py-4">
                        Campagna / Adset / Creatività
                      </th>
                      <th className="px-4 py-4">Speso</th>
                      <th className="px-4 py-4">ROAS</th>
                      <th className="px-4 py-4">Valore acquisti</th>
                      <th className="px-4 py-4">AOV</th>
                      <th className="px-4 py-4">Acquisti</th>
                      <th className="px-4 py-4">Conv. acquisti</th>
                      <th className="px-4 py-4">Add to cart</th>
                      <th className="px-4 py-4">CRO campagna</th>
                      <th className="px-4 py-4">CTR link</th>
                      <th className="px-4 py-4">CPC link</th>
                      <th className="px-4 py-4">CPM</th>
                      <th className="px-4 py-4">Impression</th>
                      <th className="px-4 py-4">Copertura</th>
                      <th className="px-4 py-4">Frequenza</th>
                      <th className="px-4 py-4">Costo risultato</th>
                    </tr>
                  </thead>

                  <tbody>
                    {rows.map((row, index) => {
                      const key =
                        `${row.level}-${row.id || row.adId || row.adsetId || row.campaignId || index}`

                      return (
                        <tr key={key} className="border-b border-blue-900/50">
                          <RowNameCell row={row} />
                          <MetricCell row={row} metric="spend" type="euro0" />
                          <MetricCell row={row} metric="roas" type="x" />
                          <MetricCell row={row} metric="purchaseValue" type="euro0" />
                          <MetricCell row={row} metric="aov" type="euro2" />
                          <MetricCell row={row} metric="purchases" />
                          <MetricCell row={row} metric="purchaseConversions" />
                          <MetricCell row={row} metric="addToCart" />
                          <MetricCell row={row} metric="cro" type="pct" />
                          <MetricCell row={row} metric="ctrLink" type="pct" />
                          <MetricCell row={row} metric="cpcLink" type="euro2" />
                          <MetricCell row={row} metric="cpm" type="euro2" />
                          <MetricCell row={row} metric="impressions" />
                          <MetricCell row={row} metric="reach" />
                          <MetricCell row={row} metric="frequency" type="dec" />
                          <MetricCell row={row} metric="costPerResult" type="euro2" />
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  )
}
