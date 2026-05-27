'use client'

import { useState } from 'react'
import Sparkline from './Sparkline'
import DeltaBadge from './DeltaBadge'

export default function KPIBrainTab({ data, dataYear, live, cfg, S, preset, kpiRange, swCurrent = [], swPrev = [], mwCurrent = [], mwPrev = [], periodTotals = {}, prevTotals = {} }) {

  const activeLive = live
  const kpiMeta = activeLive?.kpiBrain || {}
  const asNum = v => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const safeDiv = (a, b) => {
    const x = asNum(a)
    const y = asNum(b)
    return y > 0 ? x / y : null
  }

  const current = dataYear?.length ? dataYear : data || []

  const totals = current.reduce(
    (acc, row) => {
      acc.revenue += asNum(row.fatturato)
      acc.orders += asNum(row.ordini)
      acc.newCustomers += asNum(row.nc)
      acc.returningCustomers += asNum(row.rc)
      acc.sessions += asNum(row.sessioni)
      acc.metaSpend += asNum(row.metaSpend)
      acc.googleSpend += asNum(row.googleSpend)
      acc.totalSpend += asNum(row.totalSpend)
      acc.impressions += asNum(row.impressions)
      acc.clicks += asNum(row.linkClicks)
      return acc
    },
    {
      revenue: 0,
      orders: 0,
      newCustomers: 0,
      returningCustomers: 0,
      sessions: 0,
      metaSpend: 0,
      googleSpend: 0,
      totalSpend: 0,
      impressions: 0,
      clicks: 0,
    }
  )

  const aov = safeDiv(totals.revenue, totals.orders)
  const roas = safeDiv(totals.revenue, totals.metaSpend)
  const mer = safeDiv(totals.revenue, totals.totalSpend)
  const ctr =
    totals.impressions > 0
      ? (totals.clicks / totals.impressions) * 100
      : null
  const cpc = safeDiv(totals.metaSpend, totals.clicks)
  const cpm =
    totals.impressions > 0
      ? (totals.metaSpend / totals.impressions) * 1000
      : null

  const repeatRate =
    totals.newCustomers + totals.returningCustomers > 0
      ? (totals.returningCustomers /
          (totals.newCustomers + totals.returningCustomers)) *
        100
      : null

  const ltv =
    aov != null
      ? (aov * cfg.freq * cfg.life * cfg.margin) / 100
      : null

  const money = n =>
    n != null && Number(n) > 0
      ? `€${Math.round(Number(n)).toLocaleString('it-IT')}`
      : '—'

  const money1 = n =>
    n != null && Number(n) > 0
      ? `€${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}`
      : '—'

  const money2 = n =>
    n != null && Number(n) > 0
      ? `€${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—'

  const int0 = n =>
    n != null && Number(n) > 0
      ? Math.round(Number(n)).toLocaleString('it-IT')
      : '—'

  const pct = n =>
    n != null
      ? `${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`
      : '—'

  const ratio = n =>
    n != null
      ? `${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}x`
      : '—'

  const shortMoney = n => {
    const v = Number(n || 0)
    if (v >= 1000000) return `€${(v / 1000000).toFixed(1)}M`
    if (v >= 1000) return `€${(v / 1000).toFixed(1)}K`
    return money(v)
  }

  const shortNumber = n => {
    const v = Number(n || 0)
    if (v >= 1000000) return `${(v / 1000000).toFixed(2)}M`
    if (v >= 1000) return `${(v / 1000).toFixed(1)}K`
    return int0(v)
  }

  const prevAov = prevTotals.orders > 0 ? prevTotals.revenue / prevTotals.orders : null
  const prevRepeatRate = prevTotals.nc + prevTotals.rc > 0 ? (prevTotals.rc / (prevTotals.nc + prevTotals.rc)) * 100 : null
  const prevRoas = prevTotals.metaSpend > 0 ? prevTotals.revenue / prevTotals.metaSpend : null
  const prevMer = (prevTotals.metaSpend) > 0 ? prevTotals.revenue / (prevTotals.metaSpend) : null
  const prevCtr = prevTotals.impressions > 0 ? (prevTotals.clicks / prevTotals.impressions) * 100 : null
  const prevCpc = prevTotals.clicks > 0 ? prevTotals.metaSpend / prevTotals.clicks : null
  const prevCpm = prevTotals.impressions > 0 ? (prevTotals.metaSpend / prevTotals.impressions) * 1000 : null

  const metrics = [
    { group: 'Shopify', title: 'Revenue', value: shortMoney(totals.revenue), badge: 'Live', color: '#22c55e', sparkData: swCurrent.map(w => w.fatturato), current: totals.revenue, previous: prevTotals.revenue },
    { group: 'Shopify', title: 'Total Orders', value: int0(totals.orders), badge: 'Live', color: '#22c55e', sparkData: swCurrent.map(w => w.ordini), current: totals.orders, previous: prevTotals.orders },
    { group: 'Shopify', title: 'Average Order Value', value: money1(aov), badge: 'AOV', color: '#3b82f6', sparkData: swCurrent.map(w => w.ordini > 0 ? w.fatturato / w.ordini : 0), current: aov, previous: prevAov },
    { group: 'Shopify', title: 'New Customers', value: int0(totals.newCustomers), badge: 'Live', color: '#06b6d4', sparkData: swCurrent.map(w => w.nc), current: totals.newCustomers, previous: prevTotals.nc },
    { group: 'Shopify', title: 'Repeat Purchase Rate', value: pct(repeatRate), badge: 'Lifetime', color: '#0ea5e9', current: repeatRate, previous: prevRepeatRate },
    { group: 'Shopify', title: 'Average LTV', value: money1(ltv), badge: 'Lifetime', color: '#0ea5e9' },

    { group: 'Meta Ads', title: 'Spend', value: shortMoney(totals.metaSpend), badge: 'Meta', color: '#3b82f6', sparkData: mwCurrent.map(w => w.spend), current: totals.metaSpend, previous: prevTotals.metaSpend },
    { group: 'Meta Ads', title: 'ROAS', value: ratio(roas), badge: 'Live', color: '#22c55e', sparkData: mwCurrent.map((w, i) => { const sw = swCurrent[i]; return sw && w.spend > 0 ? sw.fatturato / w.spend : 0 }), current: roas, previous: prevRoas },
    { group: 'Meta Ads', title: 'MER', value: ratio(mer), badge: 'Blended', color: '#a855f7', current: mer, previous: prevMer },
    { group: 'Meta Ads', title: 'CTR', value: pct(ctr), badge: 'Meta', color: '#3b82f6', sparkData: mwCurrent.map(w => w.ctr), current: ctr, previous: prevCtr },
    { group: 'Meta Ads', title: 'CPC', value: money2(cpc), badge: 'Meta', color: '#3b82f6', sparkData: mwCurrent.map(w => w.linkClicks > 0 ? w.spend / w.linkClicks : 0), current: cpc, previous: prevCpc },
    { group: 'Meta Ads', title: 'CPM', value: money2(cpm), badge: 'Meta', color: '#3b82f6', sparkData: mwCurrent.map(w => w.impressions > 0 ? (w.spend / w.impressions) * 1000 : 0), current: cpm, previous: prevCpm },
    { group: 'Meta Ads', title: 'Impressions', value: shortNumber(totals.impressions), badge: 'Meta', color: '#3b82f6', sparkData: mwCurrent.map(w => w.impressions), current: totals.impressions, previous: prevTotals.impressions },
    { group: 'Meta Ads', title: 'Clicks', value: shortNumber(totals.clicks), badge: 'Meta', color: '#3b82f6', sparkData: mwCurrent.map(w => w.linkClicks), current: totals.clicks, previous: prevTotals.clicks },
  ]

  const topProducts = Array.isArray(activeLive?.shopifyTopProducts)
    ? activeLive.shopifyTopProducts
        .map(row => ({
          label: row.label || row.name || row.title || row.product_title || 'Prodotto senza nome',
          value: asNum(row.value ?? row.revenue ?? row.total_sales ?? row.sales),
          orders: asNum(row.orders),
          quantity: asNum(row.quantity),
        }))
        .filter(row => row.value > 0)
    : []

const productBreakdown = topProducts

const sourceBreakdown = Array.isArray(activeLive?.shopifyMarketingSources)
  ? live.shopifyMarketingSources.map(row => ({
      label: row.source || 'Marketing',
      value: asNum(row.revenue),
      orders: asNum(row.orders),
    }))
  : []

const fallbackSourceBreakdown = [
  { label: 'Meta Ads', value: totals.metaSpend, orders: 0 },
  { label: 'Google Ads', value: totals.googleSpend, orders: 0 },
].filter(row => row.value > 0)

const marketingSourceBreakdown = sourceBreakdown.length
  ? sourceBreakdown
  : fallbackSourceBreakdown
const dayNameIT = day => {
  const normalized = String(day || '').toLowerCase()

  const map = {
    sun: 'Domenica',
    sunday: 'Domenica',
    domenica: 'Domenica',

    mon: 'Lunedì',
    monday: 'Lunedì',
    lunedi: 'Lunedì',
    lunedì: 'Lunedì',

    tue: 'Martedì',
    tuesday: 'Martedì',
    martedi: 'Martedì',
    martedì: 'Martedì',

    wed: 'Mercoledì',
    wednesday: 'Mercoledì',
    mercoledi: 'Mercoledì',
    mercoledì: 'Mercoledì',

    thu: 'Giovedì',
    thursday: 'Giovedì',
    giovedi: 'Giovedì',
    giovedì: 'Giovedì',

    fri: 'Venerdì',
    friday: 'Venerdì',
    venerdi: 'Venerdì',
    venerdì: 'Venerdì',

    sat: 'Sabato',
    saturday: 'Sabato',
    sabato: 'Sabato',
  }

  return map[normalized] || day
}
   const dayBreakdown = Array.isArray(activeLive?.shopifyDayBreakdown)
    ? activeLive.shopifyDayBreakdown
        .map(row => ({
          label: dayNameIT(row.day || row.label),
          value: asNum(row.value ?? row.revenue ?? row.sales),
          orders: asNum(row.orders),
        }))
        .filter(row => row.value > 0 || row.orders > 0)
    : []

const weekdayBreakdown = dayBreakdown

const customerBreakdown = [
  { label: 'New Customers', value: totals.newCustomers },
  { label: 'Returning Customers', value: totals.returningCustomers },
].filter(row => row.value > 0)

  const attention = [
    totals.revenue <= 0
      ? {
          title: 'Shopify Revenue non disponibile',
          text: 'Non risultano dati revenue nel periodo selezionato.',
        }
      : null,
    roas != null && roas < 2
      ? {
          title: 'ROAS sotto soglia',
          text: `ROAS Meta attuale ${ratio(roas)}. Verifica campagne e creatività.`,
        }
      : null,
    ctr != null && ctr < 1
      ? {
          title: 'CTR Meta basso',
          text: `CTR attuale ${pct(ctr)}. Possibile fatigue creativa o mismatch audience.`,
        }
      : null,
    repeatRate != null && repeatRate < 10
      ? {
          title: 'Returning customers bassi',
          text: `Repeat purchase rate attuale ${pct(repeatRate)}.`,
        }
      : null,
  ].filter(Boolean)

  const card = {
    background: '#171220',
    border: '1px solid #2c2638',
    borderRadius: 16,
    padding: 20,
  }

  const panel = {
    background: '#171220',
    border: '1px solid #2c2638',
    borderRadius: 18,
    padding: 22,
  }

  const ProgressList = ({ title, rows, color = '#22c55e', format = money }) => {
    const max = Math.max(...rows.map(row => Number(row.value || 0)), 1)

    return (
      <div style={panel}>
        <div
          style={{
            fontSize: 14,
            color: '#f8fafc',
            fontWeight: 800,
            marginBottom: 18,
          }}
        >
          {title}
        </div>

        <div style={{ display: 'grid', gap: 14 }}>
          {rows.length ? (
            rows.map(row => (
              <div key={row.label}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    marginBottom: 7,
                    fontSize: 12,
                  }}
                >
                  <span
                    style={{
                      color: '#e2e8f0',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {row.label}
                  </span>

                 <span style={{ color: '#94a3b8', fontWeight: 800 }}>
  {format(row.value)}
  {row.orders ? ` · ${int0(row.orders)} ordini` : ''}
</span>
                </div>

                <div
                  style={{
                    height: 8,
                    background: '#0f0b17',
                    borderRadius: 999,
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: `${Math.max(4, (row.value / max) * 100)}%`,
                      height: '100%',
                      background: color,
                      borderRadius: 999,
                    }}
                  />
                </div>
              </div>
            ))
          ) : (
            <div style={{ color: '#64748b', fontSize: 13 }}>
              Nessun dato disponibile.
            </div>
          )}
        </div>
      </div>
    )
  }

  const MetricCard = ({ item }) => (
    <div style={card}>
      <div style={{ color: '#a5a0b3', fontSize: 13, marginBottom: 10 }}>
        {item.title}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div
          style={{
            color: '#fff',
            fontSize: 28,
            fontWeight: 900,
            letterSpacing: '-0.03em',
          }}
        >
          {item.value}
        </div>
        {item.sparkData && <Sparkline data={item.sparkData} color={item.color} width={72} height={28} />}
      </div>

      <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        <DeltaBadge current={item.current} previous={item.previous} />
        <span
          style={{
            fontSize: 11,
            color: item.color,
            background: `${item.color}22`,
            borderRadius: 999,
            padding: '4px 9px',
            fontWeight: 800,
          }}
        >
          {item.badge}
        </span>
      </div>
    </div>
  )

  return (
    <div>
      <div
        style={{
          background: '#14111d',
          border: '1px solid #2c2638',
          borderRadius: 22,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 18,
              fontWeight: 900,
              color: '#fff',
              marginBottom: 6,
            }}
          >
            Key Metrics
          </div>

          <div style={{ fontSize: 12, color: '#8b829b' }}>
            Shopify + Meta Ads · dati aggregati dal periodo disponibile
          </div>
        </div>

        <div style={{ marginBottom: 24 }}>
          <div
            style={{
              fontSize: 13,
              color: '#fff',
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            Shopify
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            {metrics
              .filter(m => m.group === 'Shopify')
              .map(item => (
                <MetricCard key={item.title} item={item} />
              ))}
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: 13,
              color: '#fff',
              fontWeight: 900,
              marginBottom: 12,
            }}
          >
            Meta Ads
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 14,
            }}
          >
            {metrics
              .filter(m => m.group === 'Meta Ads')
              .map(item => (
                <MetricCard key={item.title} item={item} />
              ))}
          </div>
        </div>
      </div>

      <div
        style={{
          background: '#14111d',
          border: '1px solid #2c2638',
          borderRadius: 22,
          padding: 24,
          marginBottom: 24,
                }}
      >
        <div style={{ marginBottom: 20 }}>
          <h2 style={{fontSize: 22, margin: 0, color: '#fff'}}>
            KPI Brain
          </h2>
          <p style={{margin: '6px 0 0', color: '#8b8aa0', fontSize: 13}}>
            {kpiMeta?.range?.label || 'Periodo selezionato'}
            {kpiMeta?.range?.since && kpiMeta?.range?.until
              ? ` · ${kpiMeta.range.since} – ${kpiMeta.range.until}`
              : ''}
            {kpiMeta?.previousRange?.since && kpiMeta?.previousRange?.until
              ? ` vs ${kpiMeta.previousRange.since} – ${kpiMeta.previousRange.until}`
              : ''}
          </p>
        </div>
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 18,
          }}
        >
          Breakdowns
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
          }}
        >
          <ProgressList
  title="Top 10 prodotti per revenue"
  rows={productBreakdown}
  color="#ec4899"
  format={money}
/>

<ProgressList
  title="Vendite per giorno della settimana"
  rows={weekdayBreakdown}
  color="#14b8a6"
  format={money}
/>

<ProgressList
  title="Vendite attribuite al marketing"
  rows={marketingSourceBreakdown}
  color="#3b82f6"
  format={money}
/>

          <ProgressList
            title="New vs Returning"
            rows={customerBreakdown}
            color="#f97316"
            format={int0}
          />
        </div>
      </div>

      <div
        style={{
          background: '#14111d',
          border: '1px solid #2c2638',
          borderRadius: 22,
          padding: 24,
          marginBottom: 24,
        }}
      >
        <div
          style={{
            fontSize: 18,
            fontWeight: 900,
            color: '#fff',
            marginBottom: 18,
          }}
        >
          Top Performers
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
            gap: 16,
          }}
        >
          {productBreakdown.slice(0, 4).map((item, index) => (
            <div
              key={item.label}
              style={{
                ...card,
                minHeight: 150,
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 999,
                    background: '#ffffff22',
                    color: '#fff',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontWeight: 900,
                    marginBottom: 14,
                  }}
                >
                  {index + 1}
                </div>

                <div
                  style={{
                    color: '#f8fafc',
                    fontWeight: 900,
                    fontSize: 15,
                  }}
                >
                  {item.label}
                </div>
              </div>

              <div>
                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 12,
                    marginBottom: 4,
                  }}
                >
                  Revenue
                </div>

                <div
                  style={{
                    color: '#f8fafc',
                    fontWeight: 900,
                    fontSize: 24,
                  }}
                >
                  {money(item.value)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div
        style={{
          background: '#14111d',
          border: '1px solid #2c2638',
          borderRadius: 22,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 18,
          }}
        >
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: 10,
              background: '#f59e0b22',
              color: '#f59e0b',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 900,
            }}
          >
            !
          </div>

          <div>
            <div
              style={{
                fontSize: 18,
                fontWeight: 900,
                color: '#f8fafc',
              }}
            >
              Needs Attention
            </div>

            <div style={{ color: '#94a3b8', fontSize: 12 }}>
              {attention.length || 0} items require review
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {attention.length ? (
            attention.map(item => (
              <div
                key={item.title}
                style={{
                  border: '1px solid #ef444455',
                  background: '#ef444415',
                  borderRadius: 12,
                  padding: 18,
                }}
              >
                <div
                  style={{
                    color: '#f8fafc',
                    fontWeight: 900,
                    marginBottom: 6,
                  }}
                >
                  {item.title}
                </div>

                <div
                  style={{
                    color: '#94a3b8',
                    fontSize: 13,
                  }}
                >
                  {item.text}
                </div>
              </div>
            ))
          ) : (
            <div
              style={{
                border: '1px solid #22c55e44',
                background: '#22c55e10',
                borderRadius: 12,
                padding: 18,
                color: '#22c55e',
                fontWeight: 800,
              }}
            >
              Nessuna criticità rilevata sui dati disponibili.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
