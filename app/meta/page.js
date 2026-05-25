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
const AMBER = '#f59e0b'

const euro0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const euro2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num0 = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const num2 = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

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
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

function formatShortDate(dateString) {
  if (!dateString) return '—'
  const d = new Date(`${dateString}T00:00:00`)
  return d.toLocaleDateString('it-IT', { day: '2-digit', month: '2-digit' })
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

  if (!delta.hasDelta) return null

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
    <td className="min-w-[340px] px-4 py-5 align-top">
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

function safeNum(value) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function avg(values) {
  const clean = values.map(safeNum).filter((v) => v > 0)
  if (!clean.length) return 0
  return clean.reduce((a, b) => a + b, 0) / clean.length
}

function flattenAds(campaigns = []) {
  const ads = []

  campaigns.forEach((campaign) => {
    ;(campaign.adsets || []).forEach((adset) => {
      ;(adset.ads || []).forEach((ad) => {
        ads.push({
          ...ad,
          campaignName: campaign.name,
          adsetName: adset.name,
          campaignId: campaign.id,
          adsetId: adset.id,
        })
      })
    })
  })

  return ads
}

function getNameText(item) {
  return `${item?.name || ''} ${item?.campaignName || ''} ${item?.adsetName || ''}`.toLowerCase()
}

function detectProduct(item) {
  const text = getNameText(item)

  const rules = [
    ['shorts', ['short', 'shorts', 'bermuda']],
    ['leggings', ['legging', 'leggings']],
    ['t-shirt', ['tshirt', 't-shirt', 'maglia']],
    ['canotta', ['canotta', 'tank']],
    ['felpa', ['felpa', 'hoodie']],
    ['top', ['top', 'bra', 'reggiseno']],
    ['set', ['set', 'completo', 'bundle']],
  ]

  for (const [label, keys] of rules) {
    if (keys.some((k) => text.includes(k))) return label
  }

  return 'Non rilevato'
}

function detectAngle(item) {
  const text = getNameText(item)

  const rules = [
    ['UGC / creator', ['ugc', 'creator', 'testimonial', 'review']],
    ['Offerta / promo', ['promo', 'sconto', 'sale', 'offerta', 'black', 'deal']],
    ['Comfort / vestibilità', ['comfort', 'fit', 'vestibilità', 'comodo', 'comodità']],
    ['Performance / workout', ['performance', 'workout', 'training', 'gym', 'allenamento']],
    ['Lifestyle', ['lifestyle', 'daily', 'giornata', 'outfit']],
    ['Prova sociale', ['social proof', 'recensione', 'review', 'clienti']],
    ['Problem / solution', ['problema', 'soluzione', 'pain', 'prima', 'dopo']],
    ['Prezzo / convenienza', ['prezzo', 'economico', 'convenienza', 'risparmia']],
  ]

  for (const [label, keys] of rules) {
    if (keys.some((k) => text.includes(k))) return label
  }

  return 'Non classificato'
}

function getBenchmarks(campaigns = []) {
  const ads = flattenAds(campaigns)
  const latestAds = ads.map((ad) => ad.latest || {})

  return {
    avgRoas: avg(latestAds.map((x) => x.roas)),
    avgCtr: avg(latestAds.map((x) => x.ctrLink)),
    avgCpc: avg(latestAds.map((x) => x.cpcLink)),
    avgCpm: avg(latestAds.map((x) => x.cpm)),
    avgCro: avg(latestAds.map((x) => x.cro)),
    avgFreq: avg(latestAds.map((x) => x.frequency)),
    avgAov: avg(latestAds.map((x) => x.aov)),
  }
}

function scoreAd(ad, bench) {
  const l = ad.latest || {}
  const p = ad.previous || {}

  let score = 0

  if (safeNum(l.roas) >= bench.avgRoas && safeNum(l.roas) > 0) score += 3
  if (safeNum(l.cro) >= bench.avgCro && safeNum(l.cro) > 0) score += 2
  if (safeNum(l.ctrLink) >= bench.avgCtr && safeNum(l.ctrLink) > 0) score += 2
  if (safeNum(l.cpcLink) <= bench.avgCpc && safeNum(l.cpcLink) > 0) score += 1
  if (safeNum(l.purchases) > safeNum(p.purchases)) score += 2
  if (safeNum(l.frequency) > 3 && safeNum(l.ctrLink) < safeNum(p.ctrLink)) score -= 2
  if (safeNum(l.spend) > 20 && safeNum(l.purchases) === 0) score -= 4

  return score
}

function buildInsightData(campaigns = []) {
  const bench = getBenchmarks(campaigns)
  const ads = flattenAds(campaigns)

  const enrichedAds = ads.map((ad) => ({
    ...ad,
    product: detectProduct(ad),
    angle: detectAngle(ad),
    score: scoreAd(ad, bench),
  }))

  const topAds = [...enrichedAds]
    .filter((ad) => safeNum(ad.latest?.spend) > 0)
    .sort((a, b) => b.score - a.score || safeNum(b.latest?.roas) - safeNum(a.latest?.roas))
    .slice(0, 5)

  const weakAds = [...enrichedAds]
    .filter((ad) => safeNum(ad.latest?.spend) > 0)
    .sort((a, b) => a.score - b.score || safeNum(b.latest?.spend) - safeNum(a.latest?.spend))
    .slice(0, 5)

  const campaignsSorted = [...campaigns]
    .filter((c) => safeNum(c.latest?.spend) > 0)
    .sort((a, b) => safeNum(b.latest?.roas) - safeNum(a.latest?.roas))

  const topCampaigns = campaignsSorted.slice(0, 3)
  const weakCampaigns = [...campaignsSorted]
    .sort((a, b) => safeNum(a.latest?.roas) - safeNum(b.latest?.roas))
    .slice(0, 3)

  const angleMap = new Map()
  const productMap = new Map()

  enrichedAds.forEach((ad) => {
    const l = ad.latest || {}

    if (!angleMap.has(ad.angle)) {
      angleMap.set(ad.angle, {
        name: ad.angle,
        spend: 0,
        purchases: 0,
        purchaseValue: 0,
        linkClicks: 0,
        impressions: 0,
        count: 0,
      })
    }

    if (!productMap.has(ad.product)) {
      productMap.set(ad.product, {
        name: ad.product,
        spend: 0,
        purchases: 0,
        purchaseValue: 0,
        linkClicks: 0,
        impressions: 0,
        count: 0,
      })
    }

    const angle = angleMap.get(ad.angle)
    const product = productMap.get(ad.product)

    for (const target of [angle, product]) {
      target.spend += safeNum(l.spend)
      target.purchases += safeNum(l.purchases)
      target.purchaseValue += safeNum(l.purchaseValue)
      target.linkClicks += safeNum(l.linkClicks)
      target.impressions += safeNum(l.impressions)
      target.count += 1
    }
  })

  function finalizeGroup(group) {
    return {
      ...group,
      roas: group.spend > 0 ? group.purchaseValue / group.spend : 0,
      cro: group.linkClicks > 0 ? (group.purchases / group.linkClicks) * 100 : 0,
      ctr: group.impressions > 0 ? (group.linkClicks / group.impressions) * 100 : 0,
      aov: group.purchases > 0 ? group.purchaseValue / group.purchases : 0,
    }
  }

  const topAngles = Array.from(angleMap.values())
    .map(finalizeGroup)
    .filter((x) => x.name !== 'Non classificato' && x.spend > 0)
    .sort((a, b) => b.roas - a.roas || b.purchases - a.purchases)
    .slice(0, 4)

  const topProducts = Array.from(productMap.values())
    .map(finalizeGroup)
    .filter((x) => x.name !== 'Non rilevato' && x.spend > 0)
    .sort((a, b) => b.roas - a.roas || b.purchaseValue - a.purchaseValue)
    .slice(0, 4)

  return {
    bench,
    topAds,
    weakAds,
    topCampaigns,
    weakCampaigns,
    topAngles,
    topProducts,
    enrichedAds,
  }
}

function InsightCard({ title, children, accent = GREEN }) {
  return (
    <div className="rounded-2xl border border-blue-950 bg-[#070f22] p-6 shadow-xl">
      <div className="mb-4 flex items-center gap-3">
        <div className="h-3 w-3 rounded-full" style={{ background: accent }} />
        <h2 className="text-[20px] font-black uppercase tracking-[0.18em] text-white">
          {title}
        </h2>
      </div>

      <div className="space-y-3 text-[16px] leading-relaxed text-slate-200">
        {children}
      </div>
    </div>
  )
}

function SmallMetric({ label, value }) {
  return (
    <div className="rounded-xl border border-blue-950 bg-[#020817] p-4">
      <div className="text-xs uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-[22px] font-black text-white">{value}</div>
    </div>
  )
}

function CreativeIntelligence({ campaigns }) {
  const data = useMemo(() => buildInsightData(campaigns), [campaigns])
  const { bench, topAds, weakAds, topCampaigns, weakCampaigns, topAngles, topProducts } = data

  const totalSpend = campaigns.reduce((sum, c) => sum + safeNum(c.latest?.spend), 0)
  const totalPurchases = campaigns.reduce((sum, c) => sum + safeNum(c.latest?.purchases), 0)
  const totalRevenue = campaigns.reduce((sum, c) => sum + safeNum(c.latest?.purchaseValue), 0)
  const accountRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0

  const strategicSummary = (() => {
    if (accountRoas >= 3 && totalPurchases > 0) {
      return 'Le performance complessive sono positive: il rapporto tra valore acquisti e spesa indica che ci sono asset su cui ha senso ragionare in ottica scaling controllato.'
    }

    if (accountRoas >= 2 && totalPurchases > 0) {
      return 'Le performance sono in una zona intermedia: ci sono segnali utili, ma prima di aumentare budget conviene capire quali creatività stanno davvero generando acquisti e CRO.'
    }

    if (totalSpend > 0 && totalPurchases === 0) {
      return 'La spesa sta generando traffico ma non acquisti: la priorità è rivedere creatività, promessa, offerta e coerenza con la landing.'
    }

    return 'Il periodo selezionato ha pochi dati utili per una decisione forte. Conviene ampliare il time frame o leggere i segnali a livello creativo/adset.'
  })()

  return (
    <div className="mb-6 space-y-6">
      <div className="rounded-2xl border border-blue-950 bg-[#070f22] p-6 shadow-xl">
        <div className="mb-5">
          <h2 className="text-[24px] font-black uppercase tracking-[0.18em] text-white">
            Insight & To Do
          </h2>
          <p className="mt-2 text-[16px] text-slate-400">
            Lettura automatica basata sui dati Meta, utile per capire cosa scalare, cosa rifare e quali angoli/prodotti stanno funzionando.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <SmallMetric label="ROAS account" value={`${num2.format(accountRoas)}×`} />
          <SmallMetric label="Spesa" value={`€${euro0.format(totalSpend)}`} />
          <SmallMetric label="Acquisti" value={num0.format(totalPurchases)} />
          <SmallMetric label="Valore acquisti" value={`€${euro0.format(totalRevenue)}`} />
        </div>

        <div className="mt-5 rounded-xl border border-blue-950 bg-[#020817] p-5 text-[17px] font-semibold leading-relaxed text-white">
          {strategicSummary}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
        <InsightCard title="Cosa funziona" accent={GREEN}>
          {topCampaigns.length ? (
            <ul className="space-y-3">
              {topCampaigns.map((c) => (
                <li key={c.id}>
                  <strong className="text-white">{c.name}</strong>: ROAS {formatMetric(c.latest?.roas, 'ratio')}, acquisti {formatMetric(c.latest?.purchases, 'number')}, CRO {formatMetric(c.latest?.cro, 'percent')}. Da monitorare per possibile scaling graduale.
                </li>
              ))}
            </ul>
          ) : (
            <p>Non ci sono abbastanza campagne con spesa per identificare un vincitore chiaro.</p>
          )}
        </InsightCard>

        <InsightCard title="Cosa non funziona" accent={RED}>
          {weakCampaigns.length ? (
            <ul className="space-y-3">
              {weakCampaigns.map((c) => (
                <li key={c.id}>
                  <strong className="text-white">{c.name}</strong>: ROAS {formatMetric(c.latest?.roas, 'ratio')}, spesa {formatMetric(c.latest?.spend, 'currency0')}, acquisti {formatMetric(c.latest?.purchases, 'number')}. Priorità: rivedere creatività, offerta o ridurre budget.
                </li>
              ))}
            </ul>
          ) : (
            <p>Non emergono campagne chiaramente deboli nel periodo selezionato.</p>
          )}
        </InsightCard>

        <InsightCard title="Creatività da scalare / replicare" accent={GREEN}>
          {topAds.length ? (
            <ul className="space-y-3">
              {topAds.map((ad) => (
                <li key={ad.id}>
                  <strong className="text-white">{ad.name}</strong>
                  <div className="text-slate-400">
                    Prodotto: {ad.product} · Angolo: {ad.angle}
                  </div>
                  <div>
                    CTR {formatMetric(ad.latest?.ctrLink, 'percent')}, CPC {formatMetric(ad.latest?.cpcLink, 'currency2')}, CRO {formatMetric(ad.latest?.cro, 'percent')}, ROAS {formatMetric(ad.latest?.roas, 'ratio')}.
                  </div>
                  <div className="text-slate-300">
                    To do: creare 3 nuove varianti mantenendo lo stesso angolo, cambiando hook iniziale, visual e CTA.
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>Non ci sono creatività sufficientemente forti da classificare come replicabili.</p>
          )}
        </InsightCard>

        <InsightCard title="Creatività da rifare" accent={AMBER}>
          {weakAds.length ? (
            <ul className="space-y-3">
              {weakAds.map((ad) => (
                <li key={ad.id}>
                  <strong className="text-white">{ad.name}</strong>
                  <div className="text-slate-400">
                    Prodotto: {ad.product} · Angolo: {ad.angle}
                  </div>
                  <div>
                    Spesa {formatMetric(ad.latest?.spend, 'currency0')}, CTR {formatMetric(ad.latest?.ctrLink, 'percent')}, CRO {formatMetric(ad.latest?.cro, 'percent')}, acquisti {formatMetric(ad.latest?.purchases, 'number')}.
                  </div>
                  <div className="text-slate-300">
                    To do: non duplicare questa creatività uguale. Rifare hook, promessa e primo visual. Se CTR è buono ma CRO basso, rendere la promessa più coerente con prodotto/offerta.
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>Non emergono creatività chiaramente deboli nel periodo selezionato.</p>
          )}
        </InsightCard>

        <InsightCard title="Prodotti più promettenti" accent={CYAN}>
          {topProducts.length ? (
            <ul className="space-y-3">
              {topProducts.map((p) => (
                <li key={p.name}>
                  <strong className="text-white">{p.name}</strong>: ROAS {formatMetric(p.roas, 'ratio')}, AOV {formatMetric(p.aov, 'currency2')}, acquisti {formatMetric(p.purchases, 'number')}.
                  <div className="text-slate-300">
                    To do: produrre più creatività dedicate a questo prodotto con angoli differenti.
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>[Inferenza] I nomi delle creatività/campagne non contengono abbastanza informazioni prodotto per una classificazione affidabile.</p>
          )}
        </InsightCard>

        <InsightCard title="Angoli comunicativi vincenti" accent={PURPLE}>
          {topAngles.length ? (
            <ul className="space-y-3">
              {topAngles.map((a) => (
                <li key={a.name}>
                  <strong className="text-white">{a.name}</strong>: ROAS {formatMetric(a.roas, 'ratio')}, CTR {formatMetric(a.ctr, 'percent')}, CRO {formatMetric(a.cro, 'percent')}.
                  <div className="text-slate-300">
                    To do: alimentare Meta con più varianti creative su questo angolo, senza duplicare lo stesso asset.
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p>[Inferenza] Gli angoli non sono abbastanza riconoscibili dai naming. Per migliorare l’analisi, usa nomi creatività con tag tipo UGC, comfort, offerta, prova sociale, problem solution.</p>
          )}
        </InsightCard>
      </div>

      <InsightCard title="To do operativi prossima settimana" accent={WHITE}>
        <ol className="list-decimal space-y-3 pl-6">
          <li>
            Replicare le migliori creatività creando varianti reali: nuovo hook, nuovo visual, nuova CTA, stesso angolo vincente.
          </li>
          <li>
            Ridurre o mettere in revisione le creatività con spesa significativa, CTR basso e zero acquisti.
          </li>
          <li>
            Se una creatività ha CTR alto ma CRO basso, non spegnerla subito: testare una promessa più coerente con la landing/offerta.
          </li>
          <li>
            Se frequenza sale e CTR cala, produrre nuovi asset per evitare saturazione.
          </li>
          <li>
            In ottica Andromeda, aumentare varietà creativa strutturata: più angoli, più formati, più prodotti, naming più chiaro.
          </li>
        </ol>
      </InsightCard>
    </div>
  )
}

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
              <th className="min-w-[340px] px-4 py-5 text-left text-[17px] font-black uppercase tracking-[0.14em] text-white">
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
              <FragmentRows key={campaign.id} campaign={campaign} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function FragmentRows({ campaign }) {
  return (
    <>
      <DataRow item={campaign} level={0} />

      {(campaign.adsets || []).map((adset) => (
        <FragmentAdset key={adset.id} adset={adset} />
      ))}
    </>
  )
}

function FragmentAdset({ adset }) {
  return (
    <>
      <DataRow item={adset} level={1} />

      {(adset.ads || []).map((ad) => (
        <DataRow key={ad.id} item={ad} level={2} />
      ))}
    </>
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
        { cache: 'no-store' }
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
          <CreativeIntelligence campaigns={campaigns} />

          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <ChartCard title="ROAS, spesa e acquisti">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid stroke="#102044" strokeDasharray="3 3" />
                  <XAxis dataKey="label" stroke={MUTED} />
                  <YAxis stroke={MUTED} />
                  <Tooltip content={<CustomTooltip />} />
                  <Legend />

                  <Line type="monotone" dataKey="roas" name="ROAS" stroke={WHITE} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="spend" name="Spesa" stroke={BLUE} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="purchases" name="Acquisti" stroke={GREEN} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
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

                  <Line type="monotone" dataKey="ctrLink" name="CTR link %" stroke={BLUE} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="cpcLink" name="CPC link" stroke={CYAN} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="cpm" name="CPM" stroke={PURPLE} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <Line type="monotone" dataKey="frequency" name="Frequenza" stroke={WHITE} strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
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
