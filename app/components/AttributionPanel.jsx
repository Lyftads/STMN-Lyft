'use client'

import { useEffect, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import FxCard from './ui/FxCard'

function DeltaBadge({ d, lowerBetter = false }) {
  if (!d || d.pct == null) return null
  const up = d.pct > 0, good = lowerBetter ? !up : up
  return <span style={{ fontSize: 10, fontWeight: 800, marginLeft: 6, color: good ? 'var(--green)' : 'var(--red)' }}>{up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%</span>
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

export default function AttributionPanel({ preset = 'last_28d', reloadKey, live }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
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
        const payload = {
          preset,
          range: m?.kpiBrain?.range || null,
          prevRange: m?.kpiBrain?.previousRange || null,
          shopifyRange: m?.shopifyRange || {},
          shopifyPrevRange: m?.shopifyPrevRange || {},
          sources: m?.shopifyMarketingSources || [],
          prevSources: m?.kpiBrain?.previous?.shopifyMarketingSources || [],
        }
        const j = await fetch('/api/attribution', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }).then(r => r.json())
        if (cancelled) return
        if (j.error && !j.totals) setError(j.error)
        else setData(j)
      } catch (e) {
        if (!cancelled) setError(e?.message || 'Errore di rete')
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

  const pieData = [
    { name: 'Tracciato (paid/marketing)', value: split.paidRevenue || 0, color: '#2997ff' },
    { name: 'Organico / diretto', value: split.organicRevenue || 0, color: '#30d158' },
  ]
  const chartData = channels.slice(0, 8).map((c, i) => ({ name: (c.label || '').slice(0, 14), revenue: c.revenue, color: chColor(c.label, i) }))
  const maxRev = Math.max(...channels.map(c => c.revenue || 0), 1)

  const Stat = ({ label, value, sub, tone, dd, lowerBetter }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: tone || 'var(--text)' }}>{value}<DeltaBadge d={dd} lowerBetter={lowerBetter} /></div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard title="Attribuzione · Total Impact" subtitle="Vista blended del business · paid vs organico · contributo per canale · MER reale vs ROAS dichiarato da Meta" delay={1.6}>
        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Calcolo l'attribuzione del periodo…</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && !(t.revenue > 0) && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>Nessun dato nel periodo selezionato.</div>}

        {t.revenue > 0 && (
          <>
            {/* KPI Total Impact */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 20px' }}>
              <Stat label="Fatturato totale" value={eur(t.revenue)} sub={`${nf(t.orders)} ordini`} dd={d.revenue} />
              <Stat label="Spesa Ads (Meta)" value={eur(t.adSpend)} dd={d.adSpend} lowerBetter />
              <Stat label="MER blended" value={`${(t.blendedMer || 0).toFixed(2)}x`} sub="Fatturato / Ad Spend" tone={t.blendedMer >= 3 ? 'var(--green)' : t.blendedMer >= 1.5 ? 'var(--orange)' : 'var(--red)'} dd={d.blendedMer} />
              <Stat label="ROAS Meta (dichiarato)" value={`${(t.metaRoas || 0).toFixed(2)}x`} sub={`${nf(t.metaPurchases)} acquisti attribuiti`} dd={d.metaRoas} />
            </div>

            {/* Paid vs Organico */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 20 }}>
              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Paid/marketing vs Organico</div>
                <ResponsiveContainer width="100%" height={190}>
                  <PieChart>
                    <defs>
                      <filter id="atGlow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="3" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
                    </defs>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" innerRadius={50} outerRadius={78} paddingAngle={3} stroke="none" animationDuration={1200} style={{ filter: 'url(#atGlow)' }}>
                      {pieData.map((e, i) => <Cell key={i} fill={e.color} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => eur2(v)} />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 6 }}>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}><b style={{ color: '#2997ff' }}>●</b> Paid {split.paidPct}%</span>
                  <span style={{ fontSize: 11, color: 'var(--text2)' }}><b style={{ color: '#30d158' }}>●</b> Organico {split.organicPct}%</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 12 }}>
                <div className="glass-card" style={{ padding: '16px 18px' }}>
                  <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>Fatturato tracciato (marketing)</div>
                  <div className="metric-value-sm" style={{ color: '#2997ff' }}>{eur(split.paidRevenue)}<DeltaBadge d={split.deltaPaid} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{nf(split.paidOrders)} ordini · {split.paidPct}% del totale</div>
                </div>
                <div className="glass-card" style={{ padding: '16px 18px' }}>
                  <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>Fatturato organico / diretto</div>
                  <div className="metric-value-sm" style={{ color: '#30d158' }}>{eur(split.organicRevenue)}<DeltaBadge d={split.deltaOrganic} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{nf(split.organicOrders)} ordini · {split.organicPct}% del totale</div>
                </div>
              </div>
            </div>

            {/* Gap di attribuzione Meta */}
            {attr.metaRevenue > 0 && (
              <div className="glass-card-static" style={{ padding: '14px 16px', borderRadius: 12, borderLeft: '3px solid var(--accent)', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700, marginBottom: 4 }}>
                  Meta si attribuisce <b style={{ color: '#0866FF' }}>{eur(attr.metaRevenue)}</b>, lato Shopify (last-click) a Facebook/Instagram risultano <b>{eur(attr.metaTrackedRevenue)}</b>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2)' }}>
                  {attr.overAttributionPct != null
                    ? <>Gap di sovra-attribuzione: <strong style={{ color: attr.gap > 0 ? 'var(--orange)' : 'var(--green)' }}>{attr.gap > 0 ? '+' : ''}{eur(attr.gap)} ({attr.overAttributionPct > 0 ? '+' : ''}{attr.overAttributionPct}%)</strong>. Usa il MER blended ({(t.blendedMer || 0).toFixed(2)}x) come bussola reale, non il ROAS in piattaforma.</>
                    : <>Il MER blended ({(t.blendedMer || 0).toFixed(2)}x) è la metrica reale di efficienza, al netto dell'attribuzione di piattaforma.</>}
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
                    <Metric label="Fatturato" value={eur(c.revenue)} />
                    <Metric label="Ordini" value={nf(c.orders)} />
                    <Metric label="AOV" value={eur2(c.aov)} />
                  </div>
                </div>
              ))}
            </div>

            {/* Nuovi vs ritorno */}
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, margin: '12px 0 8px' }}>
              <Stat label="Fatturato nuovi clienti" value={eur(cust.ncRevenue)} sub={`${nf(cust.nc)} NC · ${cust.ncPct}% del fatturato`} tone="var(--cyan)" />
              <Stat label="Fatturato clienti di ritorno" value={eur(cust.rcRevenue)} sub={`${nf(cust.rc)} RC`} tone="var(--purple)" />
              <Stat label="Quota acquisizione" value={`${cust.ncPct}%`} sub="fatturato da nuovi clienti" />
            </div>

            {/* Grafico contributo per canale */}
            {chartData.length > 0 && (
              <div className="glass-card-static reveal-zoom" style={{ marginTop: 14, padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Contributo per canale (fatturato)</div>
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
          </>
        )}
      </FxCard>
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
