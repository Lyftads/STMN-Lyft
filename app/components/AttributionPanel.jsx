'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import FxCard from './ui/FxCard'
import RecommendationsFeed from './RecommendationsFeed'
import MetaAdsAgent from './MetaAdsAgent'
import { useI18n } from '../../lib/i18n/I18nProvider'

function DeltaBadge({ d, lowerBetter = false }) {
  if (!d || d.pct == null) return null
  const up = d.pct > 0, good = lowerBetter ? !up : up
  return <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 6, color: good ? 'var(--green)' : 'var(--red)' }}>{up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%</span>
}

// Mini-grafico sparkline per le card KPI
function Sparkline({ data, dataKey, color = '#2997ff', width = 88, height = 28 }) {
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  const gid = `at-sl-${dataKey}-${color.replace('#', '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

const eur = (n) => `€${Number(n || 0).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const nf = (n) => Number(n || 0).toLocaleString('it-IT')

// Palette canali (coerente con il resto)
const CH_COLORS = ['#2997ff', '#bf5af2', '#30d158', '#ff9f0a', '#ff453a', '#64d2ff', '#ff375f', '#5e5ce6', '#ffd60a', '#0866FF']
function chColor(label, i) {
  const l = String(label || '').toLowerCase()
  if (l.includes('facebook')) return '#0866FF'
  if (l.includes('instagram')) return '#ff375f'
  if (l.includes('google')) return '#34a853'
  if (l.includes('klaviyo') || l.includes('email')) return '#bf5af2'
  if (l.includes('tiktok')) return '#64d2ff'
  return CH_COLORS[i % CH_COLORS.length]
}

// Cache client a livello di modulo (sopravvive a cambio tab / remount, come le
// altre tab): { [preset]: { data, reloadKey } }. Così tornando sulla tab i dati
// restano in memoria e non si rifà il caricamento da capo. Il refresh manuale
// (reloadKey) invalida e rifetcha.
let __attrCache = {}

export default function AttributionPanel({ preset = 'last_28d', reloadKey, live }) {
  const { t: tr } = useI18n()
  const [data, setData] = useState(() => __attrCache[preset]?.data || null)
  const [loading, setLoading] = useState(() => !__attrCache[preset])
  const [error, setError] = useState(null)

  useEffect(() => {
    // Cache hit (stesso preset e nessun refresh manuale) → niente ricaricamento.
    const cached = __attrCache[preset]
    if (cached && cached.reloadKey === reloadKey) {
      setData(cached.data)
      setLoading(false)
      setError(null)
      return
    }
    let cancelled = false
    setError(null)
    setLoading(true)
    ;(async () => {
      try {
        // I dati Shopify arrivano da /api/metrics (già in `live` per lo stesso
        // preset). Se mancano, li carico lato client (browser autenticato →
        // funziona anche sui preview deploy protetti, a differenza di una
        // self-fetch server→server).
        let m = live
        if (!m || !m.kpiBrain) {
          m = await fetch(`/api/metrics?preset=${encodeURIComponent(preset)}`).then(r => r.json())
        }
        const range = m?.kpiBrain?.range || null
        // Serie giornaliera Shopify (lato client → robusta anche sui preview protetti)
        let shopifyDaily = []
        if (range?.since) {
          try {
            shopifyDaily = await fetch(`/api/shopify-countries?since=${range.since}&until=${range.until}&breakdown=daily`).then(r => r.json()).then(j => j.daily || [])
          } catch {}
        }
        const payload = {
          preset,
          range,
          prevRange: m?.kpiBrain?.previousRange || null,
          shopifyRange: m?.shopifyRange || {},
          shopifyPrevRange: m?.shopifyPrevRange || {},
          sources: m?.shopifyMarketingSources || [],
          prevSources: m?.kpiBrain?.previous?.shopifyMarketingSources || [],
          shopifyDaily,
        }
        const j = await fetch('/api/attribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(r => r.json())
        if (cancelled) return
        if (j.error && !j.totals) setError(j.error)
        else { __attrCache[preset] = { data: j, reloadKey }; setData(j) }
      } catch (e) {
        if (!cancelled) setError(e?.message || tr('agent.netError', null, 'Errore di rete'))
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [preset, reloadKey, live])

  const t = data?.totals || {}
  const d = data?.delta || {}
  const split = data?.split || {}
  const cust = data?.customers || {}
  const channels = data?.channels || []
  const attr = data?.attribution || {}
  const daily = data?.daily || []

  const pieData = [
    { name: tr('attr.pieTracked', null, 'Tracciato (paid/marketing)'), value: split.paidRevenue || 0, color: '#2997ff' },
    { name: tr('attr.pieOrganic', null, 'Organico / diretto'), value: split.organicRevenue || 0, color: '#30d158' },
  ]
  const chartData = channels.slice(0, 8).map((c, i) => ({ name: (c.label || '').slice(0, 14), revenue: c.revenue, color: chColor(c.label, i) }))
  const maxRev = Math.max(...channels.map(c => c.revenue || 0), 1)

  const Stat = ({ label, value, sub, tone, dd, lowerBetter, dataKey, sparkColor = '#2997ff' }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{value}<DeltaBadge d={dd} lowerBetter={lowerBetter} /></div>
        {dataKey && <Sparkline data={daily} dataKey={dataKey} color={sparkColor} />}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard title={tr('attr.title', null, 'Attribuzione · Total Impact')} subtitle={tr('attr.subtitle', null, 'Vista blended del business · paid vs organico · contributo per canale · MER reale vs ROAS dichiarato da Meta')} delay={1.6}>
        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {tr('attr.loading', null, "Calcolo l'attribuzione del periodo…")}</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && !(t.revenue > 0) && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>{tr('attr.noData', null, 'Nessun dato nel periodo selezionato.')}</div>}

        {t.revenue > 0 && (
          <>
            {/* KPI Total Impact */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 20px' }}>
              <Stat label={tr('attr.totalRevenue', null, 'Fatturato totale')} value={eur(t.revenue)} sub={`${nf(t.orders)} ${tr('kpi.ordersWord', null, 'ordini')}`} dd={d.revenue} dataKey="revenue" sparkColor="#30d158" />
              <Stat label={tr('attr.adSpendMeta', null, 'Spesa Ads (Meta)')} value={eur(t.adSpend)} dd={d.adSpend} lowerBetter dataKey="spend" sparkColor="#2997ff" />
              <Stat label={tr('attr.merBlended', null, 'MER blended')} value={`${(t.blendedMer || 0).toFixed(2)}x`} sub={tr('attr.revPerSpend', null, 'Fatturato / Ad Spend')} dd={d.blendedMer} dataKey="mer" sparkColor="#bf5af2" />
              <Stat label={tr('attr.roasDeclared', null, 'ROAS Meta (dichiarato)')} value={`${(t.metaRoas || 0).toFixed(2)}x`} sub={tr('attr.attributedPurchases', { n: nf(t.metaPurchases) }, `${nf(t.metaPurchases)} acquisti attribuiti`)} dd={d.metaRoas} dataKey="metaRoas" sparkColor="#64d2ff" />
            </div>

            {/* Paid vs Organico */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 20 }}>
              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>{tr('attr.paidVsOrganic', null, 'Paid/marketing vs Organico')}</div>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <defs>
                      <filter id="atGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} stroke="none" animationDuration={1200} style={{ filter: 'url(#atGlow)' }}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip
                      allowEscapeViewBox={{ x: true, y: true }}
                      wrapperStyle={{ zIndex: 50, pointerEvents: 'none' }}
                      contentStyle={{ background: 'rgba(0,0,0,0.92)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12, whiteSpace: 'nowrap' }}
                      itemStyle={{ color: 'var(--text)' }}
                      formatter={(v) => eur2(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}><b style={{ color: '#2997ff' }}>●</b> {tr('attr.paid', null, 'Paid')} {split.paidPct}%</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}><b style={{ color: '#30d158' }}>●</b> {tr('attr.organic', null, 'Organico')} {split.organicPct}%</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 12 }}>
                <div className="glass-card" style={{ padding: '16px 18px' }}>
                  <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{tr('attr.trackedRevenue', null, 'Fatturato tracciato (marketing)')}</div>
                  <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{eur(split.paidRevenue)}<DeltaBadge d={split.deltaPaid} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{tr('attr.ordersOfTotal', { n: nf(split.paidOrders), pct: split.paidPct }, `${nf(split.paidOrders)} ordini · ${split.paidPct}% del totale`)}</div>
                </div>
                <div className="glass-card" style={{ padding: '16px 18px' }}>
                  <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{tr('attr.organicRevenue', null, 'Fatturato organico / diretto')}</div>
                  <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{eur(split.organicRevenue)}<DeltaBadge d={split.deltaOrganic} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{tr('attr.ordersOfTotal', { n: nf(split.organicOrders), pct: split.organicPct }, `${nf(split.organicOrders)} ordini · ${split.organicPct}% del totale`)}</div>
                </div>
              </div>
            </div>

            {/* Gap di attribuzione Meta */}
            {attr.metaRevenue > 0 && (
              <div className="glass-card-static" style={{ padding: '14px 16px', borderRadius: 12, borderLeft: '3px solid var(--accent)', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>
                  {tr('attr.metaClaims1', null, 'Meta si attribuisce ')}<b style={{ color: '#0866FF' }}>{eur(attr.metaRevenue)}</b>{tr('attr.metaClaims2', null, ', lato Shopify (last-click) a Facebook/Instagram risultano ')}<b>{eur(attr.metaTrackedRevenue)}</b>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {attr.overAttributionPct != null
                    ? <>{tr('attr.overAttrLabel', null, 'Gap di sovra-attribuzione:')} <strong style={{ color: attr.gap > 0 ? 'var(--orange)' : 'var(--green)' }}>{attr.gap > 0 ? '+' : ''}{eur(attr.gap)} ({attr.overAttributionPct > 0 ? '+' : ''}{attr.overAttributionPct}%)</strong>. {tr('attr.overAttrSuffix', { mer: (t.blendedMer || 0).toFixed(2) }, `Usa il MER blended (${(t.blendedMer || 0).toFixed(2)}x) come bussola reale, non il ROAS in piattaforma.`)}</>
                    : <>{tr('attr.merReal', { mer: (t.blendedMer || 0).toFixed(2) }, `Il MER blended (${(t.blendedMer || 0).toFixed(2)}x) è la metrica reale di efficienza, al netto dell'attribuzione di piattaforma.`)}</>}
                </div>
              </div>
            )}

            {/* Tabella canali */}
            <div className="stagger" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
              {channels.map((c, i) => (
                <div key={i} className="glass-card-static" style={{ padding: 12, borderRadius: 14, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${chColor(c.label, i)}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text3)' }}>{c.sharePct}%</span>
                    </div>
                    <div style={{ height: 6, borderRadius: 999, background: 'var(--glass2)', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.max(4, (c.revenue / maxRev) * 100)}%`, height: '100%', background: chColor(c.label, i), borderRadius: 999 }} />
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 16, flexShrink: 0, textAlign: 'right' }}>
                    <Metric label={tr('kpi.revenue', null, 'Fatturato')} value={eur(c.revenue)} />
                    <Metric label={tr('kpi.orders', null, 'Ordini')} value={nf(c.orders)} />
                    <Metric label="AOV" value={eur2(c.aov)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Nuovi vs ritorno */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, margin: '12px 0 8px' }}>
              <Stat label={tr('attr.ncRevenue', null, 'Fatturato nuovi clienti')} value={eur(cust.ncRevenue)} sub={tr('attr.ncSub', { nc: nf(cust.nc), pct: cust.ncPct }, `${nf(cust.nc)} NC · ${cust.ncPct}% del fatturato`)} tone="var(--cyan)" />
              <Stat label={tr('attr.rcRevenue', null, 'Fatturato clienti di ritorno')} value={eur(cust.rcRevenue)} sub={tr('attr.rcSub', { rc: nf(cust.rc) }, `${nf(cust.rc)} RC`)} tone="var(--purple)" />
              <Stat label={tr('attr.acqShare', null, 'Quota acquisizione')} value={`${cust.ncPct}%`} sub={tr('attr.acqSub', null, 'fatturato da nuovi clienti')} />
            </div>

            {/* Grafico contributo per canale */}
            {chartData.length > 0 && (
              <div className="glass-card-static reveal-zoom" style={{ marginTop: 14, padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>{tr('attr.channelContrib', null, 'Contributo per canale (fatturato)')}</div>
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={chartData} margin={{ top: 6, right: 8, left: -6, bottom: 0 }}>
                    <defs>
                      <filter id="atBarGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} labelStyle={{ color: 'var(--text2)' }} formatter={(v) => eur2(v)} />
                    <Bar dataKey="revenue" radius={[5, 5, 0, 0]} animationDuration={1400} animationEasing="ease-out" style={{ filter: 'url(#atBarGlow)' }}>
                      {chartData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* Raccomandazioni proattive (come in Dashboard) */}
            <div style={{ marginTop: 22 }}>
              <RecommendationsFeed metrics={live} preset={preset} />
            </div>
          </>
        )}
      </FxCard>

      {/* Agente verticalizzato sull'attribuzione */}
      {data && (
        <MetaAdsAgent
          data={data}
          preset={preset}
          config={{
            endpoint: '/api/attribution-agent',
            title: 'Attribution Agent',
            subtitle: tr('attr.agentSubtitle', null, 'Analista attribuzione & MER blended'),
            accent: '#bf5af2',
            accent2: '#7b3fe4',
            loadingLabel: tr('attr.agentLoading', null, "Analizzo l'attribuzione…"),
            placeholder: tr('attr.agentPlaceholder', null, 'Chiedi del MER, split organico, gap Meta, canali…'),
            suggestions: [
              tr('attr.sugg1', null, 'Sintetizza il Total Impact del periodo in 3 punti'),
              tr('attr.sugg2', null, 'Quanto è reale il ROAS Meta rispetto al MER blended?'),
              tr('attr.sugg3', null, 'Quanto fatturato è organico/diretto e cosa significa?'),
              tr('attr.sugg4', null, 'Dipendo troppo da un canale? Dove sta il rischio?'),
              tr('attr.sugg5', null, 'Dove sposterei budget per migliorare il MER?'),
              tr('attr.sugg6', null, 'Nuovi vs ritorno: sto acquisendo abbastanza?'),
            ],
          }}
        />
      )}
    </div>
  )
}

function Metric({ label, value, tone = 'var(--text)' }) {
  return (
    <div style={{ minWidth: 56 }}>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 900, color: tone, fontFamily: 'Barlow' }}>{value}</div>
    </div>
  )
}
