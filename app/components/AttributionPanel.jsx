'use client'

import Icon from './ui/Icon'
import { soldi } from '../../lib/client/soldi'
import { useEffect, useId, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts'
import FxCard from './ui/FxCard'
import RecommendationsFeed from './RecommendationsFeed'
// L'agente conversazionale della tab. Vive QUI dentro: se sparisce, la tab si apre
// lo stesso e nessuno se ne accorge — e' il tipo di perdita che non da' errori.
import MetaAdsAgent from './MetaAdsAgent'
import { useI18n } from '../../lib/i18n/I18nProvider'

function DeltaBadge({ d, lowerBetter = false }) {
  if (!d || d.pct == null) return null
  const up = d.pct > 0, good = lowerBetter ? !up : up
  return <span style={{ fontSize: 10, fontWeight: 640, marginLeft: 6, color: good ? 'var(--green)' : 'var(--red)' }}>{up ? '▲' : '▼'} {Math.abs(d.pct).toFixed(1)}%</span>
}

// Mini-grafico sparkline per le card KPI
function Sparkline({ data, dataKey, color: _colore, width = 88, height = 28 }) {
  // L'hook sta PRIMA di qualunque uscita anticipata: piu' sotto c'e' un `return null`
  // e un hook chiamato solo a volte rompe l'ordine con cui React li riconosce.
  //
  // Perche' un id per istanza: l'id di un <linearGradient> e' globale nel documento.
  // Con un id costruito solo dal nome della serie, due sparkline della stessa serie
  // nella stessa pagina finivano per puntare allo stesso <defs> — vinceva il primo
  // montato e, quando quello si smontava, le altre restavano senza sfumatura.
  // Il filtro sui caratteri toglie i due punti che React mette in useId(): dentro un
  // url(#...) non danno errore, ma rendono l'id illeggibile a chi ispeziona il DOM.
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const color = '#8e8e98' // neutro, come tutte le schede
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  const gid = `at-sl-${dataKey}-${String(color).replace(/[^a-zA-Z0-9]/g, '')}-${uid}`
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

const eur = (n) => soldi(n || 0)
const eur2 = (n) => soldi(n, 2)
const nf = (n) => Number(n || 0).toLocaleString('it-IT', { useGrouping: 'always' })

// Palette canali (coerente con il resto)
const CH_COLORS = ['#2997ff', '#bf5af2', '#22c55e', '#f59e0b', '#ef4444', '#64d2ff', '#ff6482', '#5e5ce6', '#ffd60a', '#0866FF']
function chColor(label, i) {
  const l = String(label || '').toLowerCase()
  if (l.includes('facebook')) return '#0866FF'
  if (l.includes('instagram')) return '#ef4444'
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
    { name: tr('attr.pieOrganic', null, 'Organico / diretto'), value: split.organicRevenue || 0, color: '#22c55e' },
  ]
  const chartData = channels.slice(0, 8).map((c, i) => ({ name: (c.label || '').slice(0, 14), revenue: c.revenue, color: chColor(c.label, i) }))
  const maxRev = Math.max(...channels.map(c => c.revenue || 0), 1)

  const Stat = ({ label, value, sub, tone, dd, lowerBetter, dataKey }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 10, marginBottom: 8 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 10 }}>
        <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{value}<DeltaBadge d={dd} lowerBetter={lowerBetter} /></div>
        {dataKey && <Sparkline data={daily} dataKey={dataKey} />}
      </div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard title={tr('attr.title', null, 'Attribuzione · Total Impact')} subtitle={tr('attr.subtitle', null, 'Vista blended del business · paid vs organico · contributo per canale · MER reale vs ROAS dichiarato da Meta')} delay={1.6}>
        {loading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-flex', animation: 'spin 1s linear infinite' }}><Icon name="refresh" size={13} /></span> {tr('attr.loading', null, "Calcolo l'attribuzione del periodo…")}</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && !(t.revenue > 0) && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>{tr('attr.noData', null, 'Nessun dato nel periodo selezionato.')}</div>}

        {/* Google collegato ma non letto: il MER qui sotto conta solo Meta. Si dice,
            invece di lasciare un numero che sembra migliore di com'e'. */}
        {t.revenue > 0 && data?.metaError && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, fontSize: 13, color: 'var(--orange)', background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.3)' }}>
            {tr('attr.metaSpendError', { err: data.metaError }, `Spesa Meta non disponibile (${data.metaError}): la spesa Ads e il MER blended sono incompleti, il MER risulta più alto del reale.`)}
          </div>
        )}

        {t.revenue > 0 && data?.googleError && (
          <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 12, fontSize: 13, color: 'var(--orange)', background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.3)' }}>
            {tr('attr.googleSpendError', { err: data.googleError }, `Spesa Google Ads non disponibile (${data.googleError}): MER blended calcolato solo sulla spesa Meta, quindi più alto del reale.`)}
          </div>
        )}

        {t.revenue > 0 && (
          <>
            {/* KPI Total Impact */}
            <div className="stagger-zoom m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 12, margin: '16px 0 20px' }}>
              <Stat label={tr('attr.totalRevenue', null, 'Fatturato totale')} value={eur(t.revenue)} sub={`${nf(t.orders)} ${tr('kpi.ordersWord', null, 'ordini')}`} dd={d.revenue} dataKey="revenue" />
              <Stat
                label={tr('attr.adSpendTotal', null, 'Spesa Ads (Meta + Google)')}
                value={eur(t.adSpend)}
                sub={tr('attr.spendSplit', { meta: eur(t.metaSpend), google: eur(t.googleSpend) }, `Meta ${eur(t.metaSpend)} · Google ${eur(t.googleSpend)}`)}
                dd={d.adSpend} lowerBetter dataKey="spend" />
              <Stat label={tr('attr.merBlended', null, 'MER blended')} value={`${(t.blendedMer || 0).toFixed(2)}x`} sub={tr('attr.revPerSpend', null, 'Fatturato / Ad Spend')} dd={d.blendedMer} dataKey="mer" />
              <Stat label={tr('attr.roasDeclared', null, 'ROAS Meta (dichiarato)')} value={`${(t.metaRoas || 0).toFixed(2)}x`} sub={tr('attr.attributedPurchases', { n: nf(t.metaPurchases) }, `${nf(t.metaPurchases)} acquisti attribuiti`)} dd={d.metaRoas} dataKey="metaRoas" />
            </div>

            {/* Paid vs Organico */}
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 16, marginBottom: 20 }}>
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
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
                      itemStyle={{ color: 'var(--text)' }}
                      formatter={(v) => eur2(v)}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', justifyContent: 'center', gap: 18, marginTop: 6 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text2)' }}><b style={{ color: '#2997ff' }}>●</b> {tr('attr.paid', null, 'Paid')} {split.paidPct}%</span>
                  <span style={{ fontSize: 11.5, color: 'var(--text2)' }}><b style={{ color: '#22c55e' }}>●</b> {tr('attr.organic', null, 'Organico')} {split.organicPct}%</span>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateRows: '1fr 1fr', gap: 12 }}>
                <div className="glass-card" style={{ padding: '16px 18px' }}>
                  <div className="label" style={{ fontSize: 10, marginBottom: 8 }}>{tr('attr.trackedRevenue', null, 'Fatturato tracciato (marketing)')}</div>
                  <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{eur(split.paidRevenue)}<DeltaBadge d={split.deltaPaid} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{tr('attr.ordersOfTotal', { n: nf(split.paidOrders), pct: split.paidPct }, `${nf(split.paidOrders)} ordini · ${split.paidPct}% del totale`)}</div>
                </div>
                <div className="glass-card" style={{ padding: '16px 18px' }}>
                  <div className="label" style={{ fontSize: 10, marginBottom: 8 }}>{tr('attr.organicRevenue', null, 'Fatturato organico / diretto')}</div>
                  <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{eur(split.organicRevenue)}<DeltaBadge d={split.deltaOrganic} /></div>
                  <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{tr('attr.ordersOfTotal', { n: nf(split.organicOrders), pct: split.organicPct }, `${nf(split.organicOrders)} ordini · ${split.organicPct}% del totale`)}</div>
                </div>
              </div>
            </div>

            {/* Gap di attribuzione Meta */}
            {attr.metaRevenue > 0 && (
              <div className="glass-card-static" style={{ padding: '14px 16px', borderRadius: 12, borderLeft: '3px solid var(--accent)', marginBottom: 20 }}>
                <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600, marginBottom: 4 }}>
                  {tr('attr.metaClaims1', null, 'Meta si attribuisce ')}<b style={{ color: '#0866FF' }}>{eur(attr.metaRevenue)}</b>{tr('attr.metaClaims2', null, ', lato Shopify (last-click) a Facebook/Instagram risultano ')}<b>{eur(attr.metaTrackedRevenue)}</b>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {attr.overAttributionPct != null
                    ? <>{tr('attr.overAttrLabel', null, 'Gap di sovra-attribuzione:')} <strong style={{ color: attr.gap > 0 ? 'var(--orange)' : 'var(--green)' }}>{attr.gap > 0 ? '+' : ''}{eur(attr.gap)} ({attr.overAttributionPct > 0 ? '+' : ''}{attr.overAttributionPct}%)</strong>. {tr('attr.overAttrSuffix', { mer: (t.blendedMer || 0).toFixed(2) }, `Usa il MER blended (${(t.blendedMer || 0).toFixed(2)}x) come bussola reale, non il ROAS in piattaforma.`)}</>
                    : <>{tr('attr.merReal', { mer: (t.blendedMer || 0).toFixed(2) }, `Il MER blended (${(t.blendedMer || 0).toFixed(2)}x) è la metrica reale di efficienza, al netto dell'attribuzione di piattaforma.`)}</>}
                </div>
              </div>
            )}

            {/* Tabella canali */}
            <div className="stagger" style={{ display: 'grid', gap: 8, marginBottom: 8 }}>
              {channels.map((c, i) => (
                <div key={i} className="glass-card-static" style={{ padding: 12, borderRadius: 16, display: 'flex', alignItems: 'center', gap: 14, borderLeft: `3px solid ${chColor(c.label, i)}` }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                      <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.label}</span>
                      <span style={{ fontSize: 10, fontWeight: 640, color: 'var(--text3)' }}>{c.sharePct}%</span>
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
            <div className="stagger-zoom m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0,1fr))', gap: 12, margin: '12px 0 8px' }}>
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
                    <XAxis dataKey="name" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={48} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }} labelStyle={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 4 }} formatter={(v) => eur2(v)} />
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

      {/* Agente verticalizzato sull'attribuzione.
          Sta fuori dalla FxCard e sotto di essa: e' il pezzo che il fork monocliente
          aveva tolto. Riceve `data` gia' calcolato, cosi' risponde sugli stessi numeri
          che l'utente vede sopra invece di rifare le chiamate per conto suo. */}
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
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 640, marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 13, fontWeight: 680, color: tone, fontFamily: 'inherit' }}>{value}</div>
    </div>
  )
}
