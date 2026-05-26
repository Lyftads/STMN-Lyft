'use client'

import { useMemo, useState } from 'react'

const metricCards = [
  {
    group: 'Shopify',
    title: 'Revenue',
    value: '€13.1K',
    change: '-57.63%',
    negative: true,
  },
  {
    group: 'Shopify',
    title: 'Total Orders',
    value: '333',
    change: '-57.69%',
    negative: true,
  },
  {
    group: 'Shopify',
    title: 'Average Order Value',
    value: '€39.4',
    change: '+0.13%',
    negative: false,
  },
  {
    group: 'Shopify',
    title: 'New Customers',
    value: '308',
    change: '-57.81%',
    negative: true,
  },
  {
    group: 'Shopify',
    title: 'Repeat Purchase Rate',
    value: '5.8%',
    change: 'Lifetime',
    neutral: true,
  },
  {
    group: 'Shopify',
    title: 'Average LTV',
    value: '€42.3',
    change: 'Lifetime',
    neutral: true,
  },
  {
    group: 'Meta Ads',
    title: 'Spend',
    value: '€9.2K',
    change: '-42.30%',
    negative: true,
  },
  {
    group: 'Meta Ads',
    title: 'ROAS',
    value: '1.60x',
    change: '+19.43%',
    negative: false,
  },
  {
    group: 'Meta Ads',
    title: 'CTR',
    value: '0.88%',
    change: '-19.79%',
    negative: true,
  },
  {
    group: 'Meta Ads',
    title: 'CPC',
    value: '€0.5',
    change: '+9.18%',
    negative: false,
  },
  {
    group: 'Meta Ads',
    title: 'CPM',
    value: '€4.6',
    change: '-12.43%',
    negative: true,
  },
  {
    group: 'Meta Ads',
    title: 'Impressions',
    value: '2.03M',
    change: '-34.11%',
    negative: true,
  },
  {
    group: 'Meta Ads',
    title: 'Clicks',
    value: '17.9K',
    change: '-47.15%',
    negative: true,
  },
]

const breakdowns = {
  Revenue: {
    product: [
      { label: 'COPPIA ORECCHINI WAVES', value: '€5.2K', percent: 100 },
      { label: 'COPPIA ORECCHINI FLOWER', value: '€1.1K', percent: 22 },
      { label: 'COPPIA ORECCHINI ELLIPSE', value: '€609.2', percent: 12 },
      { label: 'Bracciale Rigido Aurelia', value: '€250.8', percent: 5 },
      { label: 'ANELLO FLUID', value: '€222.7', percent: 4 },
    ],
    source: [
      { label: 'CBO_Waves_BOFu', value: '€4.5K', percent: 100 },
      { label: 'Direct', value: '€4K', percent: 88 },
      { label: 'direct', value: '€3.4K', percent: 76 },
      { label: 'Google', value: '€1.9K', percent: 42 },
      { label: 'CBO_Waves_MOFu', value: '€1.6K', percent: 35 },
    ],
    weekdays: [
      { label: 'Sun', value: '€2.8K', percent: 100 },
      { label: 'Mon', value: '€1.4K', percent: 50 },
      { label: 'Tue', value: '€1.3K', percent: 47 },
      { label: 'Wed', value: '€1.5K', percent: 54 },
      { label: 'Thu', value: '€1.8K', percent: 64 },
      { label: 'Fri', value: '€1.8K', percent: 64 },
      { label: 'Sat', value: '€2.6K', percent: 92 },
    ],
    customers: [
      { label: 'New Customers', value: '€12K', percent: 100 },
      { label: 'Returning Customers', value: '€1.1K', percent: 9 },
    ],
  },
  Spend: {
    product: [
      { label: 'Meta Ads', value: '€9.2K', percent: 100 },
      { label: 'Google Ads', value: '€1.9K', percent: 21 },
      { label: 'Organic', value: '€0', percent: 0 },
    ],
    source: [
      { label: 'Prospecting', value: '€5.1K', percent: 100 },
      { label: 'Retargeting', value: '€2.8K', percent: 55 },
      { label: 'Testing', value: '€1.3K', percent: 25 },
    ],
    weekdays: [
      { label: 'Sun', value: '€1.5K', percent: 90 },
      { label: 'Mon', value: '€1.1K', percent: 66 },
      { label: 'Tue', value: '€1.2K', percent: 72 },
      { label: 'Wed', value: '€1.3K', percent: 78 },
      { label: 'Thu', value: '€1.4K', percent: 84 },
      { label: 'Fri', value: '€1.7K', percent: 100 },
      { label: 'Sat', value: '€1K', percent: 60 },
    ],
    customers: [
      { label: 'Cold Traffic', value: '€6.8K', percent: 100 },
      { label: 'Warm Traffic', value: '€2.4K', percent: 35 },
    ],
  },
  Orders: {
    product: [
      { label: 'COPPIA ORECCHINI WAVES', value: '262', percent: 100 },
      { label: 'COPPIA ORECCHINI FLOWER', value: '45', percent: 17 },
      { label: 'COPPIA ORECCHINI ELLIPSE', value: '28', percent: 11 },
      { label: 'Bracciale Rigido Aurelia', value: '12', percent: 5 },
    ],
    source: [
      { label: 'CBO_Waves_BOFu', value: '121', percent: 100 },
      { label: 'Direct', value: '98', percent: 81 },
      { label: 'Google', value: '52', percent: 43 },
      { label: 'CBO_Waves_MOFu', value: '34', percent: 28 },
    ],
    weekdays: [
      { label: 'Sun', value: '71', percent: 100 },
      { label: 'Mon', value: '36', percent: 51 },
      { label: 'Tue', value: '33', percent: 46 },
      { label: 'Wed', value: '42', percent: 59 },
      { label: 'Thu', value: '48', percent: 68 },
      { label: 'Fri', value: '46', percent: 65 },
      { label: 'Sat', value: '57', percent: 80 },
    ],
    customers: [
      { label: 'New Customers', value: '308', percent: 100 },
      { label: 'Returning Customers', value: '25', percent: 8 },
    ],
  },
}

const topPerformers = [
  {
    name: 'COPPIA ORECCHINI WAVES',
    revenue: '$5.2K',
    orders: 262,
    change: '-40.0%',
    image:
      'https://images.unsplash.com/photo-1617038260897-41a1f14a8ca0?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'COPPIA ORECCHINI FLOWER',
    revenue: '$1.1K',
    orders: 45,
    change: '-67.8%',
    image:
      'https://images.unsplash.com/photo-1605100804763-247f67b3557e?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'COPPIA ORECCHINI ELLIPSE',
    revenue: '$609.2',
    orders: 28,
    change: '-20.8%',
    image:
      'https://images.unsplash.com/photo-1535632787350-4e68ef0ac584?q=80&w=1200&auto=format&fit=crop',
  },
  {
    name: 'Bracciale Rigido Aurelia',
    revenue: '$250.8',
    orders: 12,
    change: '-50.2%',
    image:
      'https://images.unsplash.com/photo-1611591437281-460bfbe1220a?q=80&w=1200&auto=format&fit=crop',
  },
]

const attentionItems = [
  {
    title: 'Shopify Revenue dropped 57.6%',
    description: 'Shopify revenue significantly declined vs previous 90 days',
    change: '-57.6%',
  },
  {
    title: 'Shopify Total Orders dropped 57.7%',
    description: 'Shopify total orders significantly declined vs previous 90 days',
    change: '-57.7%',
  },
  {
    title: 'New Customers dropped 57.8%',
    description: 'Customer acquisition declined vs previous 90 days',
    change: '-57.8%',
  },
  {
    title: 'Meta Clicks dropped 47.1%',
    description: 'Meta traffic volume is down vs previous 90 days',
    change: '-47.1%',
  },
]

function cx(...classes) {
  return classes.filter(Boolean).join(' ')
}

function MiniSparkline() {
  return (
    <div className="flex h-12 w-28 items-end gap-[3px] opacity-80">
      {Array.from({ length: 22 }).map((_, index) => {
        const height = 18 + Math.abs(Math.sin(index * 0.8)) * 28
        return (
          <span
            key={index}
            className="w-[3px] rounded-full bg-gradient-to-t from-fuchsia-500 to-orange-400"
            style={{ height }}
          />
        )
      })}
    </div>
  )
}

function MetricCard({ item }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5 shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="max-w-[180px] truncate text-sm font-medium text-zinc-400">
            {item.title}
          </p>
          <p className="mt-2 text-3xl font-bold tracking-tight text-white">
            {item.value}
          </p>
        </div>

        <MiniSparkline />
      </div>

      <div
        className={cx(
          'mt-3 inline-flex rounded-full px-3 py-1 text-xs font-bold',
          item.neutral
            ? 'bg-sky-500/20 text-sky-300'
            : item.negative
              ? 'bg-rose-500/20 text-rose-300'
              : 'bg-emerald-500/20 text-emerald-300'
        )}
      >
        {item.change}
      </div>
    </div>
  )
}

function SectionShell({ children, className = '' }) {
  return (
    <section
      className={cx(
        'rounded-3xl border border-white/10 bg-[#14111d] p-6 shadow-2xl shadow-black/20',
        className
      )}
    >
      {children}
    </section>
  )
}

function ProgressList({ title, items, accent = 'from-fuchsia-500 to-orange-400' }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 p-5">
      <h3 className="mb-5 text-base font-semibold text-white">{title}</h3>

      <div className="space-y-4">
        {items.map(item => (
          <div key={item.label}>
            <div className="mb-2 flex items-center justify-between gap-4 text-sm">
              <span className="truncate text-zinc-200">{item.label}</span>
              <span className="shrink-0 text-zinc-400">{item.value}</span>
            </div>

            <div className="h-2 overflow-hidden rounded-full bg-white/10">
              <div
                className={cx('h-full rounded-full bg-gradient-to-r', accent)}
                style={{ width: `${Math.max(4, item.percent)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TopPerformerCard({ item, index }) {
  return (
    <div className="overflow-hidden rounded-2xl border border-white/10 bg-white/[0.035]">
      <div className="relative aspect-[1/1] w-full overflow-hidden bg-zinc-900">
        <img
          src={item.image}
          alt={item.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />

        <div className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-black/45 text-sm font-bold text-white backdrop-blur">
          {index + 1}
        </div>
      </div>

      <div className="p-4">
        <h3 className="line-clamp-1 text-sm font-bold text-white">{item.name}</h3>

        <p className="mt-3 text-xs text-zinc-400">Revenue</p>

        <div className="flex items-center justify-between gap-3">
          <p className="text-2xl font-bold text-white">{item.revenue}</p>
          <span className="rounded-md bg-rose-500/25 px-2 py-1 text-xs font-bold text-rose-300">
            {item.change}
          </span>
        </div>

        <div className="mt-4 border-t border-white/10 pt-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-zinc-400">Orders</span>
            <span className="font-medium text-zinc-100">{item.orders}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function AttentionItem({ item }) {
  return (
    <div className="rounded-2xl border border-rose-500/50 bg-rose-950/35 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="font-semibold text-white">{item.title}</h3>
          <p className="mt-2 text-sm text-zinc-400">{item.description}</p>

          <button className="mt-4 rounded-lg bg-violet-500/25 px-4 py-2 text-sm font-medium text-violet-300 hover:bg-violet-500/35">
            Investigate
          </button>
        </div>

        <span className="rounded-md bg-rose-500/25 px-2 py-1 text-xs font-bold text-rose-300">
          {item.change}
        </span>
      </div>
    </div>
  )
}

export default function KPIBrainPage() {
  const [selectedWindow, setSelectedWindow] = useState('Last 90 days')
  const [breakdownMetric, setBreakdownMetric] = useState('Revenue')
  const [performerView, setPerformerView] = useState('Products')

  const shopifyMetrics = useMemo(
    () => metricCards.filter(item => item.group === 'Shopify'),
    []
  )

  const metaMetrics = useMemo(
    () => metricCards.filter(item => item.group === 'Meta Ads'),
    []
  )

  const selectedBreakdowns = breakdowns[breakdownMetric]

  return (
    <main className="min-h-screen bg-[#0f0b17] px-6 py-8 text-white lg:px-10">
      <div className="mx-auto max-w-7xl space-y-8">
        <header className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <h1 className="bg-gradient-to-r from-orange-400 to-rose-500 bg-clip-text text-4xl font-extrabold tracking-tight text-transparent">
              KPI Brain
            </h1>
            <p className="mt-2 text-zinc-400">
              Your business intelligence at a glance
            </p>
          </div>

          <div className="flex items-center gap-3">
            <select
              value={selectedWindow}
              onChange={event => setSelectedWindow(event.target.value)}
              className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm text-white outline-none"
            >
              <option>Last 30 days</option>
              <option>Last 60 days</option>
              <option>Last 90 days</option>
              <option>Year to date</option>
            </select>

            <button className="rounded-xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white hover:bg-white/[0.09]">
              KPI Chat
            </button>
          </div>
        </header>

        <SectionShell>
          <div className="mb-7">
            <h2 className="text-xl font-bold text-white">Key Metrics</h2>

            <div className="mt-3 flex items-center gap-5 text-sm text-zinc-400">
              <span className="flex items-center gap-2">
                <span className="h-[2px] w-4 bg-gradient-to-r from-fuchsia-500 to-orange-400" />
                Selected window
              </span>
              <span className="flex items-center gap-2">
                <span className="h-[2px] w-4 border-t border-dashed border-zinc-500" />
                Previous period
              </span>
            </div>
          </div>

          <div className="mb-7">
            <h3 className="mb-1 text-sm font-bold text-white">Shopify</h3>
            <p className="mb-4 text-sm text-zinc-500">
              Feb 26–May 26, 2026 vs previous 90 days
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {shopifyMetrics.map(item => (
                <MetricCard key={item.title} item={item} />
              ))}
            </div>
          </div>

          <div>
            <h3 className="mb-1 text-sm font-bold text-white">Meta Ads</h3>
            <p className="mb-4 text-sm text-zinc-500">
              Feb 26–May 26, 2026 vs previous 90 days
            </p>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metaMetrics.map(item => (
                <MetricCard key={item.title} item={item} />
              ))}
            </div>
          </div>
        </SectionShell>

        <SectionShell>
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">Breakdowns by</h2>

              <select
                value={breakdownMetric}
                onChange={event => setBreakdownMetric(event.target.value)}
                className="rounded-xl border border-white/10 bg-white/[0.08] px-4 py-2 text-sm text-white outline-none"
              >
                <option>Revenue</option>
                <option>Spend</option>
                <option>Orders</option>
              </select>
            </div>

            <p className="text-sm text-zinc-500">2026-02-26 – 2026-05-26</p>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <ProgressList title="By Product" items={selectedBreakdowns.product} />
            <ProgressList
              title="By Day of Week"
              items={selectedBreakdowns.weekdays}
              accent="from-emerald-500 to-teal-400"
            />
            <ProgressList
              title="By Source"
              items={selectedBreakdowns.source}
              accent="from-cyan-500 to-blue-500"
            />
            <ProgressList
              title="New vs Returning"
              items={selectedBreakdowns.customers}
              accent="from-rose-500 to-fuchsia-500"
            />
          </div>
        </SectionShell>

        <SectionShell>
          <div className="mb-6 flex flex-col justify-between gap-4 md:flex-row md:items-center">
            <h2 className="text-xl font-bold text-white">Top Performers</h2>

            <div className="flex rounded-xl bg-white/[0.07] p-1">
              {['Products', 'Campaigns', 'Ads'].map(item => (
                <button
                  key={item}
                  onClick={() => setPerformerView(item)}
                  className={cx(
                    'rounded-lg px-4 py-2 text-sm font-medium transition',
                    performerView === item
                      ? 'bg-white/10 text-white'
                      : 'text-zinc-400 hover:text-white'
                  )}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-4">
            {topPerformers.map((item, index) => (
              <TopPerformerCard key={item.name} item={item} index={index} />
            ))}
          </div>
        </SectionShell>

        <SectionShell>
          <div className="mb-6 flex items-start gap-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-500/20 text-amber-300">
              ⚠
            </div>

            <div>
              <h2 className="text-xl font-bold text-white">Needs Attention</h2>
              <p className="text-sm text-zinc-400">
                {attentionItems.length} items require review
              </p>
            </div>
          </div>

          <div className="space-y-4">
            {attentionItems.map(item => (
              <AttentionItem key={item.title} item={item} />
            ))}
          </div>
        </SectionShell>
      </div>
    </main>
  )
}
