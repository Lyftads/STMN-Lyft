'use client'

import Pannello from './ui/Pannello'
import { Kpi } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { useStatoTab } from '../../lib/client/statoTab'
import { Fonte } from './ui/FasceTabella'
import { useEffect, useState } from 'react'
import { getCached, inMemoria, leggi, swrFetch } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'
import PeriodoInBarra from './ui/PeriodoInBarra'
import Icon from './ui/Icon'
import FlussoLavagna from './FlussoLavagna'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { num, perc } from '../../lib/client/numeri'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' }) : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' })}` : '—'
const fmtP = n => perc(n, 1)

function greetMarino(t) {
  const h = new Date().getHours()
  if (h < 12) return t('klaviyo.greetMorning', null, 'Buongiorno Marino — ecco come vanno le email')
  if (h < 18) return t('klaviyo.greetAfternoon', null, 'Ciao Marino — il punto su Klaviyo')
  return t('klaviyo.greetEvening', null, 'Sera Marino — riepilogo Klaviyo')
}

function kpiComment(kpis, t) {
  if (!kpis) return ''
  const { openRate, clickRate, revenue } = kpis
  const parts = []
  const x = openRate == null ? null : num(openRate, 1)
  if (openRate > 50) parts.push(t('klaviyo.openHigh', { x }, `Open rate al ${x}% — i subject stanno spaccando 🔥`))
  else if (openRate > 30) parts.push(t('klaviyo.openMid', { x }, `Open rate al ${x}%, nella media. Possiamo testare nuovi subject?`))
  else if (openRate > 0) parts.push(t('klaviyo.openLow', { x }, `Open rate al ${x}%... rivediamo i subject?`))
  if (revenue?.total > 10000) parts.push(t('klaviyo.revHigh', { e: fmtE(revenue.total) }, `${fmtE(revenue.total)} di revenue — mica male! 💪`))
  else if (revenue?.total > 0) parts.push(t('klaviyo.revOk', { e: fmtE(revenue.total) }, `${fmtE(revenue.total)} di revenue, ci stiamo muovendo.`))
  if (clickRate < 2 && clickRate > 0) parts.push(t('klaviyo.clickLow', null, "Click rate un po' basso — le CTA vanno ripensate?"))
  return parts.join(' · ') || t('klaviyo.allNormal', null, 'Tutto nella norma!')
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 11.5, fontWeight: 600, boxShadow: '0 12px 30px rgba(0,0,0,0.6)' }}>
      <p style={{ color: 'var(--text3)', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.value > 100 ? fmtN(p.value) : (typeof p.value === 'number' ? num(p.value, 2) : p.value)}</p>
      ))}
    </div>
  )
}

// ── Shared styles (vetro nero — lo sfondo nero arriva dalle classi
//    .glass-section / .glass-card / .glass-panel, niente background/border inline) ──
const sectionStyle = { borderRadius: 16, padding: 24, marginBottom: 24 }
const cardStyle = { borderRadius: 16, padding: 20, minWidth: 0 }
const panelStyle = { borderRadius: 16, padding: '20px 24px' }
const thR = { padding: '12px 16px', textAlign: 'right', color: 'var(--text3)', fontWeight: 640, fontSize: 11.5, textTransform: 'uppercase', whiteSpace: 'nowrap' }
const tdR = { padding: '10px 16px', textAlign: 'right', color: 'var(--text3)', fontSize: 13, whiteSpace: 'nowrap' }

// La barretta colorata davanti al titolo era l'unico viola del prodotto: via, e il titolo prende la
// voce di tutti gli altri (.titolo-sezione).
function Section({ title, subtitle, color, children, style }) {
  return (
    <div className="glass-section reveal-zoom" style={{ ...sectionStyle, ...style }}>
      <div style={{ marginBottom: subtitle ? 6 : 20 }}>
        <span className="titolo-sezione">{title}</span>
      </div>
      {subtitle && <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

// La scheda KPI di tutto il prodotto. I badge colorati (KLAVIYO, OPEN, RATE,
// HEALTH) erano pura decorazione: l'etichetta dice gia' cosa misura il numero.
function Card({ title, value, hint }) {
  return <Kpi etichetta={title} valore={value} nota={hint} fonti={['klaviyo']} title={hint || undefined} />
}

function StatusDot({ active }) {
  return (
    <span style={{
      display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
      background: active ? '#22c55e' : '#555', marginRight: 8,
      boxShadow: active ? '0 0 8px #22c55e' : 'none',
    }} />
  )
}

export default function KlaviyoTab() {
  const { t: tr } = useI18n()
  const [data, setData] = useState(null)
  const [preview, setPreview] = useState(null)     // campagna aperta in anteprima
  const [flussoAperto, setFlussoAperto] = useState(null) // flusso aperto sulla lavagna
  const [pubblico, setPubblico] = useState(null)   // segmento o lista aperti in dettaglio
  const [breakdown, setBreakdown] = useState(null)  // revenue/OR/CR per campagna+flusso (caricato a parte)
  const [loading, setLoading] = useState(true)
  const [mostraFermi, setMostraFermi] = useStatoTab('klaviyo.flussiFermi', false)
  const [tf, setTf] = useStatoTab('klaviyo.tf', { preset: 'last_30d' })
  // I dati Klaviyo sono "ultimi N giorni": mappiamo lo span del range a N giorni.
  const days = (tf.since && tf.until) ? Math.max(0, Math.round((new Date(tf.until) - new Date(tf.since)) / 86400000)) : 30
  const [chartTab, setChartTab] = useState('received')
  const [campTab, setCampTab] = useState('sent')

  useEffect(() => {
    let active = true
    const key = `klaviyo:${days}`
    const cached = getCached(key)
    if (cached) {
      setData(cached.data)
      setLoading(false)   // FIX: con cache i dati ci sono → spegni subito il loading
    } else {
      setLoading(true)
    }
    swrFetch({
      key,
      fetcher: () => fetch(`/api/klaviyo?days=${days}`, { cache: 'no-store', signal: AbortSignal.timeout(40000) }).then(r => r.json()),
      onUpdate: (fresh) => { if (active) setData(fresh) },
    })
      .then(({ data, fromCache }) => {
        if (!active) return
        if (!cached) setData(data)
      })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false) })   // FIX: spegni sempre il loading
    return () => { active = false }
  }, [days])

  // Revenue breakdown (lento) caricato a parte: la tab è già visibile, le stat
  // (OR/CR/conv/entrate) si popolano nelle tabelle quando arrivano.
  useEffect(() => {
    let active = true
    setBreakdown(null)
    leggi(`/api/klaviyo?part=breakdown&days=${days}`)
      .then(j => { if (active && j?.revenueBreakdown) setBreakdown(j.revenueBreakdown) })
      .catch(() => {})
    return () => { active = false }
  }, [days])

  if (loading) {
    return <div style={{ color: 'var(--text3)', padding: 40, fontSize: 15, fontWeight: 600 }}>{tr('klaviyo.loading', null, 'Un attimo, sto tirando su i dati da Klaviyo...')}</div>
  }

  if (data?.error === 'not_connected') {
    return (
      <div style={{ padding: 40, color: 'var(--text3)', fontSize: 13, lineHeight: 1.6, maxWidth: 560 }}>
        {tr('klaviyo.notConnected', null, 'Klaviyo non è collegato a questo spazio di lavoro. Collegalo dalle Integrazioni: se l’hai appena fatto, ricarica fra qualche secondo.')}
      </div>
    )
  }

  if (!data || data.error) {
    return <div style={{ color: '#ef4444', padding: 40 }}>{tr('klaviyo.errorPrefix', null, 'Errore:')} {data?.error || tr('klaviyo.connFailed', null, 'Connessione Klaviyo fallita')}</div>
  }

  const { account, kpis, campaigns, flows, segments, lists } = data

  // Stat (revenue/OR/CR/conv) per id → fuse nelle sezioni Campagne e Flussi
  // (da `breakdown`, caricato separatamente; "—" finché non arriva)
  const campStatsMap = {}
  ;(breakdown?.campaigns?.rows || []).forEach(r => { if (r.campaignId) campStatsMap[r.campaignId] = r })
  const flowStatsMap = {}
  ;(breakdown?.flows?.rows || []).forEach(r => { if (r.flowId) flowStatsMap[r.flowId] = r })
  // Flussi ordinati per revenue (quelli con dati in cima)
  const flowsSorted = [...(flows || [])].sort((a, b) => (flowStatsMap[b.id]?.revenue || 0) - (flowStatsMap[a.id]?.revenue || 0))
  // Venti righe di soli trattini non dicono niente: i flussi che nel periodo non
  // hanno spedito si vedono a richiesta. Se NESSUNO ha spedito si mostrano tutti.
  const flussiConInvii = flowsSorted.filter(f => flowStatsMap[f.id])
  const flussiFermi = flowsSorted.length - flussiConInvii.length
  const flussiFermiVisibili = mostraFermi || flussiConInvii.length === 0

  const chartData = (kpis?.received?.dates || []).map((d, i) => ({
    date: d?.slice(5, 10) || '',
    received: kpis?.received?.values?.[i] || 0,
    opened: kpis?.opened?.values?.[i] || 0,
    clicked: kpis?.clicked?.values?.[i] || 0,
    revenue: kpis?.revenue?.values?.[i] || 0,
  }))

  return (
    <div>
      {/* Header: saluto + selettore giorni */}
      <div className="barra-strumenti" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <p className="a-tutta-riga" style={{ color: 'var(--text3)', fontSize: 13, margin: 0 }}>{greetMarino(tr)}</p>
        <PeriodoInBarra value={tf} onChange={setTf} disabled={loading} />
      </div>

      {/* Panoramica Email */}
      <Section title={tr('klaviyo.overview', null, 'Panoramica Email')} subtitle={`Klaviyo · ${days === 0 ? tr('klaviyo.todayLower', null, 'oggi') : tr('klaviyo.lastDays', { n: days }, `ultimi ${days} giorni`)}`} color="#8b5cf6">
        <div className="reveal" style={{
          background: 'var(--neutro-bg)',
          border: '1px solid var(--border)', borderRadius: 12,
          padding: '12px 18px', marginBottom: 20, color: 'var(--text2)', fontSize: 13, fontWeight: 600,
        }}>
          {kpiComment(kpis, tr)}
        </div>

        <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Card title={tr('klaviyo.received', null, 'Email Ricevute')} value={fmtN(kpis?.received?.total)} badge="Klaviyo" color="#8b5cf6" />
          <Card title={tr('klaviyo.opened', null, 'Aperte')} value={fmtN(kpis?.opened?.total)} badge="Open" color="#3b82f6" />
          <Card title={tr('klaviyo.clicked', null, 'Cliccate')} value={fmtN(kpis?.clicked?.total)} badge="Click" color="#06b6d4" />
          <Card title="Open Rate" value={fmtP(kpis?.openRate)} badge="Rate" color="#22c55e" />
          <Card title="Click Rate" value={fmtP(kpis?.clickRate)} badge="Rate" color="#22c55e" />
          <Card title="CTOR" value={fmtP(kpis?.ctor)} badge="Rate" color="#f59e0b" />
        </div>
        <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <Card title="Bounce" value={fmtN(kpis?.bounced?.total)} badge="Health" color="#ef4444" />
          <Card title="Unsub" value={fmtN(kpis?.unsubscribed?.total)} badge="Health" color="#ef4444" />
          <Card title={tr('klaviyo.revenueEmail', null, 'Entrate email')} value={fmtE(kpis?.revenue?.total)} badge="€" color="#22c55e"
            hint={tr('klaviyo.revenueEmailHint', null, 'Ordini attribuiti da Klaviyo al canale email (campagne e flussi), non il fatturato del negozio.')} />
        </div>
      </Section>

      {/* Revenue Breakdown */}

      {/* Trend Giornaliero */}
      <Section title={tr('klaviyo.dailyTrend', null, 'Trend Giornaliero')} color="#8b5cf6">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { id: 'received', label: tr('klaviyo.chartReceived', null, 'Ricevute') },
            { id: 'opened', label: tr('klaviyo.opened', null, 'Aperte') },
            { id: 'clicked', label: tr('klaviyo.clicked', null, 'Cliccate') },
            { id: 'revenue', label: 'Revenue' },
          ].map(t => (
            <button key={t.id} onClick={() => setChartTab(t.id)} className="btn-glass" style={{
              border: chartTab === t.id ? '1px solid #8b5cf6' : '1px solid var(--border)',
              background: chartTab === t.id ? '#8b5cf622' : 'var(--glass)',
              color: chartTab === t.id ? 'var(--text2)' : 'var(--text3)',
              borderRadius: 8, padding: '8px 16px', fontSize: 13, fontWeight: 640, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        <div className="glass-panel" style={{ ...panelStyle, padding: 20 }}>
          <ResponsiveContainer width="100%" height={260}>
            {chartTab === 'revenue' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            ) : chartTab === 'opened' || chartTab === 'clicked' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey={chartTab} stroke={chartTab === 'opened' ? '#3b82f6' : '#06b6d4'} fill={chartTab === 'opened' ? '#3b82f622' : '#06b6d422'} strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                <YAxis tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="received" fill="#8e8e8e" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Campagne */}
      <Section title={tr('klaviyo.campaigns', null, 'Campagne')} color="#ec4899">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { id: 'sent', label: `${tr('klaviyo.sent', null, 'Inviate')} (${campaigns?.sent?.length || 0})` },
            { id: 'draft', label: `${tr('klaviyo.draft', null, 'Bozze')} (${campaigns?.draft?.length || 0})` },
            { id: 'scheduled', label: `${tr('klaviyo.scheduled', null, 'Programmate')} (${campaigns?.scheduled?.length || 0})` },
          ].map(t => (
            <button key={t.id} onClick={() => setCampTab(t.id)} className={`ly-linguetta senza-tocco${campTab === t.id ? ' aperta' : ''}`}>{t.label}</button>
          ))}
        </div>

        <div className="glass-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 640, fontSize: 11.5, textTransform: 'uppercase' }}><Fonte loghi={['klaviyo']} />{tr('klaviyo.campaign', null, 'Campagna')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 640, fontSize: 11.5, textTransform: 'uppercase' }}>{tr('klaviyo.colStatus', null, 'Stato')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 640, fontSize: 11.5, textTransform: 'uppercase' }}>{tr('klaviyo.sendDate', null, 'Data Invio')}</th>
                <th style={thR}>OR</th>
                <th style={thR}>CR</th>
                <th style={thR}>Conv</th>
                <th style={thR}>{tr('klaviyo.revenueCol', null, 'Entrate')}</th>
              </tr>
            </thead>
            <tbody>
              {(campaigns?.[campTab] || []).slice(0, 20).map((c, i) => {
                const st = campStatsMap[c.id]
                return (
                <tr key={c.id || i}
                  onClick={() => c.id && setPreview(c)}
                  title={tr('klaviyo.openPreview', null, 'Apri l’anteprima dell’email')}
                  style={{ borderBottom: '1px solid var(--border)', cursor: c.id ? 'pointer' : 'default' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.035)' }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                  <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 600 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                      <span>{c.name}</span>
                      <Icon name="eye" size={12} style={{ color: 'var(--text3)' }} />
                    </div>
                  </td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 680, padding: '3px 8px', borderRadius: 8,
                      background: c.status === 'Sent' ? '#22c55e22' : c.status === 'Draft' ? '#f59e0b22' : '#3b82f622',
                      color: c.status === 'Sent' ? '#22c55e' : c.status === 'Draft' ? '#f59e0b' : '#3b82f6',
                    }}>{({ Sent: tr('klaviyo.stSent', null, 'Inviata'), Draft: tr('klaviyo.stDraft', null, 'Bozza'), Scheduled: tr('klaviyo.stScheduled', null, 'Programmata') })[c.status] || c.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: 'var(--text3)', fontSize: 13 }}>{c.sendTime ? new Date(c.sendTime).toLocaleString('it-IT', { useGrouping: 'always' }) : '—'}</td>
                  <td style={tdR}>{st ? fmtP(st.openRate) : '—'}</td>
                  <td style={tdR}>{st ? fmtP(st.clickRate) : '—'}</td>
                  <td style={tdR}>{st ? fmtN(st.conversions) : '—'}</td>
                  <td style={{ ...tdR, color: '#22c55e', fontWeight: 640 }}>{st ? fmtE(st.revenue) : '—'}</td>
                </tr>
              )})}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Flussi */}
      <Section title={tr('klaviyo.flows', null, 'Flussi')} color="#f6b73c">
        <div className="glass-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 640, fontSize: 11.5, textTransform: 'uppercase' }}><Fonte loghi={['klaviyo']} />{tr('klaviyo.flow', null, 'Flusso')}</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: 'var(--text3)', fontWeight: 640, fontSize: 11.5, textTransform: 'uppercase' }}>{tr('klaviyo.colStatus', null, 'Stato')}</th>
                <th style={thR}>OR</th>
                <th style={thR}>CR</th>
                <th style={thR}>Conv</th>
                <th style={thR}>€/dest</th>
                <th style={thR}>{tr('klaviyo.revenueCol', null, 'Entrate')}</th>
              </tr>
            </thead>
            <tbody>
              {(flussiFermiVisibili ? flowsSorted : flussiConInvii).slice(0, 60).map((f, i) => {
                const st = flowStatsMap[f.id]
                return (
                  <tr key={f.id || i}
                    onClick={() => f.id && setFlussoAperto(f)}
                    title={tr('klaviyo.flowOpen', null, 'Apri la mappa del flusso')}
                    style={{ borderBottom: '1px solid var(--border)', cursor: f.id ? 'pointer' : 'default' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'rgba(127,127,127,0.07)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <td style={{ padding: '10px 16px', color: 'var(--text)', fontWeight: 600 }}>{f.name}{f.id && <span style={{ marginLeft: 8, color: 'var(--text3)', fontSize: 15 }}>›</span>}</td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        fontSize: 10, fontWeight: 680, padding: '3px 8px', borderRadius: 8,
                        background: f.status === 'live' ? '#22c55e22' : '#55555522',
                        color: f.status === 'live' ? '#22c55e' : 'var(--text3)', textTransform: 'uppercase',
                      }}>{({ live: tr('klaviyo.stLive', null, 'Attivo'), draft: tr('klaviyo.stDraft', null, 'Bozza'), manual: tr('klaviyo.stManual', null, 'Manuale'), stopped: tr('klaviyo.stStopped', null, 'Fermo') })[String(f.status || '').toLowerCase()] || f.status}</span>
                    </td>
                    <td style={tdR}>{st ? fmtP(st.openRate) : '—'}</td>
                    <td style={tdR}>{st ? fmtP(st.clickRate) : '—'}</td>
                    <td style={tdR}>{st ? fmtN(st.conversions) : '—'}</td>
                    <td style={{ ...tdR, color: 'var(--text)' }}>{st ? soldi(st.revenuePerRecipient || 0, 2) : '—'}</td>
                    <td style={{ ...tdR, color: '#22c55e', fontWeight: 640 }}>{st ? fmtE(st.revenue) : '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          {flussiFermi > 0 && flussiConInvii.length > 0 && (
            <button className="senza-tocco" onClick={() => setMostraFermi(v => !v)}
              style={{ display: 'block', width: '100%', padding: '11px 16px', background: 'none', border: 'none', borderTop: '1px solid var(--border)', color: 'var(--accent)', fontSize: 13, fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              {mostraFermi ? tr('klaviyo.flowsIdleHide', null, 'Nascondi i flussi senza invii') : tr('klaviyo.flowsIdle', { n: flussiFermi }, `Mostra anche i ${flussiFermi} flussi senza invii nel periodo`)}
            </button>
          )}
        </div>
      </Section>

      {/* Segmenti & Liste */}
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Section title={tr('klaviyo.segments', null, 'Segmenti')} color="#06b6d4" style={{ marginBottom: 0 }}>
          <div className="glass-panel" style={{ ...panelStyle, padding: 16 }}>
            {(segments || []).slice(0, 40).map((s, i) => (
              <div key={s.id || i} className="riga-tocco" onClick={() => s.id && setPubblico({ id: s.id, tipo: 'segment', nome: s.name })}
                style={{ padding: '8px 0', borderBottom: i < segments.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', cursor: s.id ? 'pointer' : 'default' }}>
                <StatusDot active={s.isActive} />
                <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{s.name}</span>
                {s.id && <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 15 }}>›</span>}
              </div>
            ))}
          </div>
        </Section>
        <Section title={tr('klaviyo.lists', null, 'Liste')} color="#a855f7" style={{ marginBottom: 0 }}>
          <div className="glass-panel" style={{ ...panelStyle, padding: 16 }}>
            {(lists || []).slice(0, 40).map((l, i) => (
              <div key={l.id || i} className="riga-tocco" onClick={() => l.id && setPubblico({ id: l.id, tipo: 'list', nome: l.name })}
                style={{ padding: '8px 0', borderBottom: i < lists.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center', cursor: l.id ? 'pointer' : 'default' }}>
                <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13 }}>{l.name}</span>
                {l.id && <span style={{ marginLeft: 'auto', color: 'var(--text3)', fontSize: 15 }}>›</span>}
              </div>
            ))}
          </div>
        </Section>
      </div>

      {flussoAperto && <FlussoLavagna flusso={flussoAperto} giorni={days} tr={tr} onClose={() => setFlussoAperto(null)} onApriEmail={(m) => setPreview(m)} />}
      {preview && <CampaignPreview campaign={preview} tr={tr} onClose={() => setPreview(null)} />}
      {pubblico && <DettaglioPubblico pubblico={pubblico} tr={tr} onClose={() => setPubblico(null)} />}
    </div>
  )
}

// I clic che Klaviyo riporta sono per URL di DESTINAZIONE, mentre nell'email
// lo stesso indirizzo puo' avere lo slash finale, i parametri di tracciamento
// o il protocollo diverso: senza normalizzare, nessun link verrebbe agganciato.
const normalizzaUrl = (u) => String(u || '')
  .trim().toLowerCase()
  .replace(/^https?:\/\//, '')
  .split('?')[0]
  .replace(/\/$/, '')

// Mappa di calore: ogni link cliccato riceve un contorno la cui intensita'
// dipende dai clic, piu' un'etichetta col numero. Si lavora sull'HTML prima
// di darlo alla cornice, perche' dentro non possono girare script.
function conMappaDiCalore(html, link) {
  if (!html || !link?.length) return html
  const perUrl = new Map(link.map(l => [normalizzaUrl(l.url), l]))
  const massimo = Math.max(...link.map(l => l.clic), 1)
  return String(html).replace(/<a\s([^>]*?)href=(["'])(.*?)\2([^>]*)>/gi, (tutto, prima, q, href, dopo) => {
    const l = perUrl.get(normalizzaUrl(href))
    if (!l) return tutto
    const intensita = Math.max(0.18, l.clic / massimo)
    const stile = `outline:3px solid rgba(239,68,68,${(0.3 + intensita * 0.6).toFixed(2)});outline-offset:2px;background-color:rgba(239,68,68,${(intensita * 0.22).toFixed(2)});`
    const etichetta = `<span style="display:inline-block;background:#ef4444;color:#fff;font:700 10px/1.4 system-ui,sans-serif;padding:1px 5px;border-radius:99px;margin-right:4px;vertical-align:middle;">${l.clic}</span>`
    return `<a ${prima}href=${q}${href}${q}${dopo} style="${stile}" title="${l.clic} clic">${etichetta}`
  })
}

// ── Anteprima di una campagna ──────────────────────────────────────────────
// Nell'ordine in cui la si guarda: a chi va, che oggetto ha, cosa si legge in
// casella prima di aprirla, da chi arriva, e infine l'email intera.
function CampaignPreview({ campaign, tr, onClose }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [consegna, setConsegna] = useState(null)   // clic, aperture, spam, link
  const [mappa, setMappa] = useState(false)        // mappa di calore sull'email

  useEffect(() => {
    let vivo = true
    setD(null); setErr(null)
    leggi(`/api/klaviyo/campaign?${campaign.flowMessageId ? 'flowMessage' : 'id'}=${encodeURIComponent(campaign.flowMessageId || campaign.id)}`, { opzioni: { cache: 'no-store', signal: AbortSignal.timeout(30000) } })
      .then(j => { if (!vivo) return; j?.ok ? setD(j) : setErr(j?.error || 'errore') })
      .catch(() => { if (vivo) setErr('rete') })
    return () => { vivo = false }
  }, [campaign.id])

  // In parallelo all'anteprima: e' una chiamata indipendente e in fila
  // costerebbe il doppio dell'attesa.
  useEffect(() => {
    let vivo = true
    setConsegna(null); setMappa(false)
    // Se Klaviyo ha chiesto di aspettare (inRitardo), si riprova da soli dopo i secondi che
    // dichiara, fino a quattro volte: chi guarda vede "in arrivo", non un errore.
    let timer = null, giri = 0
    const carica = () => leggi(`/api/klaviyo/campagna-clic?${campaign.flowMessageId ? 'flowMessage' : 'id'}=${encodeURIComponent(campaign.flowMessageId || campaign.id)}`, { forza: giri > 0, opzioni: { cache: 'no-store', signal: AbortSignal.timeout(40000) } })
      .then(j => {
        if (!vivo || !j?.ok) return
        setConsegna(j)
        if (j.inRitardo?.length && giri++ < 4) timer = setTimeout(carica, Math.min(30, Math.max(5, j.riprovaTraS || 15)) * 1000 + 500)
      })
      .catch(() => {})
    carica()
    return () => { vivo = false; clearTimeout(timer) }
  }, [campaign.id])

  useEffect(() => {
    const esc = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', esc)
    return () => window.removeEventListener('keydown', esc)
  }, [onClose])

  const pubblico = [
    ...(d?.audiences?.included || []).map(a => ({ ...a, incluso: true })),
    ...(d?.audiences?.excluded || []).map(a => ({ ...a, incluso: false })),
  ]

  return (
    <Pannello titolo={campaign.name} sotto={<>{campaign.status}{campaign.sendTime ? ` · ${new Date(campaign.sendTime).toLocaleString('it-IT')}` : ''}</>} larghezza={780} onClose={onClose}>
      <div style={{ margin: -22 }}>
          {!d && !err && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{tr('klaviyo.loadingPreview', null, 'Carico l’anteprima…')}</div>}
          {err && <div style={{ padding: 30, color: '#fca5a5', fontSize: 13 }}>{tr('klaviyo.previewError', null, 'Non riesco a leggere questa campagna da Klaviyo.')}</div>}

          {d && (
            <>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 12, borderBottom: '1px solid var(--border)' }}>
                {pubblico.length > 0 && (
                  <Riga label={tr('klaviyo.audience', null, 'A chi va')}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {pubblico.map(a => (
                        <span key={`${a.incluso}-${a.id}`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, fontWeight: 600,
                          padding: '4px 10px', borderRadius: 999,
                          background: a.incluso ? '#06b6d422' : '#ef444422',
                          color: a.incluso ? '#67e8f9' : '#fca5a5',
                          border: `1px solid ${a.incluso ? '#06b6d444' : '#ef444444'}`,
                        }}>
                          <Icon name={a.type === 'list' ? 'list' : 'funnel'} size={11} />
                          {a.name}
                          <span style={{ opacity: 0.7, fontWeight: 600 }}>
                            {a.incluso ? '' : tr('klaviyo.excluded', null, 'esclusi')}
                          </span>
                        </span>
                      ))}
                    </div>
                  </Riga>
                )}
                <Riga label={tr('klaviyo.subject', null, 'Oggetto')}>
                  <span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 15 }}>{d.message.subject || '—'}</span>
                </Riga>
                <Riga label={tr('klaviyo.previewText', null, 'Testo di anteprima')}>
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>{d.message.previewText || '—'}</span>
                </Riga>
                <Riga label={tr('klaviyo.sender', null, 'Mittente')}>
                  <span style={{ color: 'var(--text2)', fontSize: 13 }}>
                    {d.message.fromLabel || '—'}{d.message.fromEmail ? ` · ${d.message.fromEmail}` : ''}
                    {d.message.replyTo ? ` · ${tr('klaviyo.replyTo', null, 'risposte a')} ${d.message.replyTo}` : ''}
                  </span>
                </Riga>
              </div>

              {consegna && (
                <div style={{ padding: '14px 20px', borderBottom: '1px solid var(--border)' }}>
                  {/* Come e' andata: prima quante ne sono partite e arrivate,
                      poi quante persone hanno fatto qualcosa, poi il danno. */}
                  <div className="kl-misure">
                    <MisuraInvio etichetta={tr('klaviyo.destinatari', null, 'Destinatari')} valore={consegna.consegna.destinatari} />
                    <MisuraInvio etichetta={tr('klaviyo.consegnate', null, 'Consegnate')} valore={consegna.consegna.consegnate} />
                    <MisuraInvio etichetta={tr('klaviyo.rimbalzi', null, 'Rimbalzi')} valore={consegna.consegna.rimbalzi}
                      />
                    <MisuraInvio etichetta={tr('klaviyo.aperte', null, 'Hanno aperto')} valore={consegna.consegna.aperturePersone}
                      quota={consegna.consegna.aperturePct} nota={consegna.consegna.apertureTotali ? tr('klaviyo.apertureTot', { n: consegna.consegna.apertureTotali }, `${consegna.consegna.apertureTotali} aperture totali`) : null} />
                    <MisuraInvio etichetta={tr('klaviyo.hannoCliccato', null, 'Hanno cliccato')} valore={consegna.consegna.clicPersone}
                      quota={consegna.consegna.clicPct} nota={consegna.consegna.clicPerPersona ? tr('klaviyo.clicPerPersona', { n: consegna.consegna.clicPerPersona }, `${consegna.consegna.clicPerPersona} clic a testa`) : null} />
                    <MisuraInvio etichetta={tr('klaviyo.ctor', null, 'Click su aperture')} valore={null} quota={consegna.consegna.clicSuAperture} />
                    <MisuraInvio etichetta={tr('klaviyo.ordini', null, 'Ordini')} valore={consegna.consegna.ordini} />
                    <MisuraInvio prefisso="€" etichetta={tr('klaviyo.entrate', null, 'Entrate')} valore={consegna.consegna.entrate != null ? Math.round(consegna.consegna.entrate) : null}
                      nota={consegna.consegna.entratePerDestinatario != null ? tr('klaviyo.perDestBreve', { n: consegna.consegna.entratePerDestinatario }, `€${consegna.consegna.entratePerDestinatario} a destinatario`) : null} />
                    <MisuraInvio etichetta={tr('klaviyo.disiscritti', null, 'Disiscritti')} valore={consegna.consegna.disiscritti}
                      quota={consegna.consegna.disiscrittiPct} />
                    <MisuraInvio etichetta={tr('klaviyo.spam', null, 'Spam')} valore={consegna.consegna.spam}
                      quota={consegna.consegna.spamPct} colore={consegna.consegna.spam > 0 ? '#ef4444' : undefined} />
                  </div>
                  {consegna.inRitardo?.length > 0 && (
                    <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text3)' }}>
                      {tr('klaviyo.numeriInArrivo', null, 'Numeri in arrivo: Klaviyo ha chiesto qualche secondo di attesa, li ricarico da solo.')}
                    </div>
                  )}
                  {consegna.avviso && !consegna.inRitardo?.length && (
                    <div style={{ marginTop: 10, fontSize: 11.5, color: '#f59e0b', fontWeight: 600 }}>
                      {tr('klaviyo.avvisoConsegna', { e: consegna.avviso }, `Numeri non disponibili: ${consegna.avviso}.`)}
                    </div>
                  )}
                  {consegna.link.length > 0 && (
                    <button onClick={() => setMappa(v => !v)}
                      style={{ marginTop: 12, background: mappa ? '#ef4444' : 'rgba(255,255,255,0.06)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 13px', color: mappa ? '#fff' : 'var(--text2)', fontSize: 13, fontWeight: 640, cursor: 'pointer' }}>
                      {mappa ? tr('klaviyo.mappaOff', null, 'Nascondi la mappa dei clic') : tr('klaviyo.mappaOn', null, 'Mostra dove hanno cliccato')}
                    </button>
                  )}
                </div>
              )}

              {d.body.html ? (
                // L'email gira in una cornice isolata e SENZA script: e' HTML
                // scritto da terzi, e non deve poter toccare la pagina.
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <iframe title={d.message.subject || campaign.name}
                    srcDoc={mappa && consegna?.link?.length ? conMappaDiCalore(d.body.html, consegna.link) : d.body.html}
                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                    style={{ width: '100%', height: '58vh', border: 'none', background: '#fff', display: 'block' }} />
                  {d.body.dinamici && (
                    <div style={{ padding: '10px 20px', fontSize: 11.5, lineHeight: 1.6, order: -1, color: d.body.dinamici.permessoFeed === false ? '#f59e0b' : 'var(--text3)' }}>
                      {d.body.dinamici.permessoFeed === false
                        ? tr(d.body.dinamici.feeds.length === 1 ? 'klaviyo.feedScope1' : 'klaviyo.feedScope', { n: d.body.dinamici.feeds.length },
                            d.body.dinamici.feeds.length === 1
                              ? "Lo spazio vuoto qui sotto è un blocco di prodotti dinamici: Klaviyo lo riempie all'invio leggendo un feed, e per mostrartelo serve il permesso «web-feeds:read». Aggiungilo agli scope dell'app Klaviyo, poi su Nango, infine ricollega dalle Integrazioni. Il resto dell'email è già quello vero."
                              : `Gli spazi vuoti sono ${d.body.dinamici.feeds.length} blocchi di prodotti dinamici: Klaviyo li riempie all'invio leggendo i feed, e per mostrarteli serve il permesso «web-feeds:read». Aggiungilo agli scope dell'app Klaviyo, poi su Nango, infine ricollega dalle Integrazioni.`)
                        : d.body.dinamici.ricostruiti?.length > 0
                          ? tr('klaviyo.feedRicostruito', { n: d.body.dinamici.ricostruiti.length }, `I prodotti nei blocchi dinamici sono RICOSTRUITI dal tuo catalogo: i più venduti del marchio e della categoria indicati dal blocco, negli ultimi 90 giorni. Klaviyo sceglie i suoi al momento dell'invio e non li espone, quindi questi non sono necessariamente quelli che ha visto il destinatario.`)
                        : d.body.dinamici.risolti > 0
                          ? tr('klaviyo.feedNow', null, 'I prodotti nei blocchi dinamici sono quelli del feed OGGI: al momento dell\'invio potevano essere altri.')
                          : tr('klaviyo.feedNoApi', null, 'Gli spazi vuoti sono blocchi di prodotti dinamici. Klaviyo li calcola solo al momento dell\'invio e non li espone da nessuna API: nemmeno la sua anteprima è ricostruibile da fuori. Oggetto, testi e struttura qui sopra sono invece quelli veri.')}
                    </div>
                  )}
                </div>
              ) : d.body.text ? (
                <pre style={{ margin: 0, padding: 20, whiteSpace: 'pre-wrap', color: 'var(--text2)', fontSize: 13, lineHeight: 1.6 }}>{d.body.text}</pre>
              ) : (
                <div style={{ padding: 20, fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                  {d.body.error === 'scope'
                    ? tr('klaviyo.bodyScope', null, 'Il corpo dell’email richiede il permesso «templates:read». Klaviyo lo concede solo se è abilitato nell’app OAuth: aprilo su Klaviyo in Impostazioni → App → la tua app → Scopes, spunta templates:read, poi ricollega Klaviyo dalle Integrazioni. Oggetto, testo di anteprima e destinatari si vedono già adesso.')
                    : tr('klaviyo.bodyMissing', null, 'Klaviyo non restituisce il corpo di questa campagna.')}
                </div>
              )}

              {consegna && (consegna.link.length > 0 || consegna.clientClic.length > 0) && (
                <div style={{ padding: '16px 20px', borderTop: '1px solid var(--border)', display: 'grid', gap: 18 }}>
                  {consegna.link.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)', marginBottom: 8 }}>
                        {tr('klaviyo.doveCliccano', { n: consegna.link.length }, `Dove hanno cliccato (${consegna.link.length} link)`)}
                      </div>
                      {consegna.link.slice(0, 15).map((l, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '5px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={l.url}>{l.url}</span>
                          <div style={{ width: 90, height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999, overflow: 'hidden', flexShrink: 0 }}>
                            <div style={{ width: `${l.quota}%`, height: '100%', background: '#ef4444' }} />
                          </div>
                          <span style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)', width: 46, textAlign: 'right' }}>{l.clic}</span>
                          <span style={{ fontSize: 10, color: 'var(--text3)', width: 44, textAlign: 'right' }}>{l.quota}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {consegna.clientClic.length > 0 && (
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)', marginBottom: 8 }}>
                        {tr('klaviyo.provider', null, 'Con quale posta la leggono')}
                      </div>
                      {consegna.clientClic.slice(0, 8).map((c, i) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '4px 0', fontSize: 11.5, color: 'var(--text2)' }}>
                          <span style={{ flex: 1 }}>{c.client || tr('klaviyo.nonRilevato', null, 'non rilevato')}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text)' }}>{c.valore}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  <div style={{ fontSize: 10, color: 'var(--text3)', lineHeight: 1.5 }}>
                    {tr('klaviyo.nonDisponibile', null, 'Non disponibili da Klaviyo: il paese di chi apre (non e una dimensione di queste metriche) e il dettaglio per singolo destinatario (richiede il permesso events:read).')}
                  </div>
                </div>
              )}
            </>
          )}
      </div>
    </Pannello>
  )
}

function Riga({ label, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'baseline', flexWrap: 'wrap' }}>
      <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 640, textTransform: 'uppercase', letterSpacing: '.07em', minWidth: 118 }}>{label}</span>
      <div style={{ flex: 1, minWidth: 200 }}>{children}</div>
    </div>
  )
}

// ── Dettaglio di un segmento o di una lista ─────────────────────────────────
// Quello che serve per decidere se usarlo: quante persone contiene, come si
// muove, dove e' stato usato e quanto ha reso. La differenza fra lista e
// segmento e' dichiarata invece che nascosta: una lista registra iscrizioni e
// cancellazioni, un segmento e' una query viva e quei passaggi non esistono.
function DettaglioPubblico({ pubblico, tr, onClose }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    let vivo = true
    setD(null); setErr('')
    leggi(`/api/klaviyo/pubblico?id=${encodeURIComponent(pubblico.id)}&tipo=${pubblico.tipo}`)
      .then(j => { if (!vivo) return; if (j?.ok) setD(j); else setErr(j?.error || 'Errore') })
      .catch(e => { if (vivo) setErr(e?.message || 'Errore di rete') })
    return () => { vivo = false }
  }, [pubblico.id, pubblico.tipo])

  const euro = v => soldi(v, 'auto')
  const pct = v => v == null ? '—' : `${Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`
  const intero = v => v == null ? '—' : Number(v).toLocaleString('it-IT', { useGrouping: 'always' })
  const giorno = g => {
    const x = new Date(`${g}T12:00:00Z`)
    return `${String(x.getUTCDate()).padStart(2, '0')}/${String(x.getUTCMonth() + 1).padStart(2, '0')}`
  }

  const Dato = ({ etichetta, valore, colore }) => (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 12, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, fontWeight: 640, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--text3)' }}>{etichetta}</div>
      <div style={{ fontSize: 15, fontWeight: 680, color: colore || 'var(--text)', marginTop: 3 }}>{valore}</div>
    </div>
  )

  const th = { padding: '8px 10px', fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '.07em', color: 'var(--text3)', whiteSpace: 'nowrap' }
  const td = { padding: '8px 10px', fontSize: 13, color: 'var(--text2)', textAlign: 'right', whiteSpace: 'nowrap' }

  return (
    <Pannello titolo={pubblico.nome} sotto={<>{pubblico.tipo === 'list' ? tr('klaviyo.tipoLista', null, 'Lista') : tr('klaviyo.tipoSegmento', null, 'Segmento')}{d?.pubblico?.profili != null ? ` · ${intero(d.pubblico.profili)} ${tr('klaviyo.profili', null, 'profili')}` : ''}{d?.pubblico?.creato ? ` · ${tr('klaviyo.creato', null, 'creato')} ${new Date(d.pubblico.creato).toLocaleDateString('it-IT')}` : ''}</>} larghezza={880} onClose={onClose}>
      <div style={{ margin: -22 }}>
          {!d && !err && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>{tr('klaviyo.loadingPub', null, 'Carico il dettaglio…')}</div>}
          {err && <div style={{ padding: 30, color: '#fca5a5', fontSize: 13 }}>{err}</div>}

          {d && (
            <>
              <div style={{ padding: '16px 20px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(128px, 1fr))', gap: 10 }}>
                <Dato etichetta={tr('klaviyo.profili', null, 'Profili')} valore={intero(d.pubblico.profili)} />
                <Dato etichetta={tr('klaviyo.campagne', null, 'Campagne')} valore={intero(d.totali.campagne)} />
                <Dato etichetta={tr('klaviyo.destinatari', null, 'Destinatari')} valore={intero(d.totali.destinatari || null)} />
                <Dato etichetta={tr('klaviyo.openRate', null, 'Aperture')} valore={pct(d.totali.aperturePct)} />
                <Dato etichetta={tr('klaviyo.clickRate', null, 'Click')} valore={pct(d.totali.clickPct)} />
                <Dato etichetta={tr('klaviyo.ordini', null, 'Ordini')} valore={intero(d.totali.ordini || null)} />
                <Dato etichetta={tr('klaviyo.entrate', null, 'Entrate')} valore={euro(d.totali.entrate)} />
                <Dato etichetta={tr('klaviyo.perDest', null, 'Per destinatario')} valore={euro(d.totali.entratePerDestinatario)} />
              </div>

              {d.statisticheErrore && (
                <div style={{ padding: '0 20px 12px', fontSize: 11.5, color: '#f59e0b' }}>
                  {tr('klaviyo.statsErr', { e: d.statisticheErrore }, `Statistiche non disponibili: ${d.statisticheErrore}. Le campagne sotto restano elencate.`)}
                </div>
              )}

              {/* Crescita: solo le liste hanno eventi di entrata e uscita */}
              <div style={{ padding: '0 20px 16px' }}>
                <div style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)', marginBottom: 8 }}>
                  {tr('klaviyo.crescita', { n: d.periodoCrescita }, `Movimenti degli ultimi ${d.periodoCrescita} giorni`)}
                </div>
                {d.pubblico.tipo === 'segment' ? (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.6 }}>
                    {tr('klaviyo.segmentoNoCrescita', null, 'Un segmento è una query viva: le persone entrano ed escono quando cambiano i loro dati, e Klaviyo non registra quei passaggi. Il numero di profili qui sopra è quello di adesso; entrate e uscite esistono come dato solo per le liste.')}
                  </div>
                ) : (d.crescita || []).length === 0 || d.crescitaNota ? (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                    {tr('klaviyo.nessunMovimento', null, 'Nessun movimento registrato nel periodo.')}
                  </div>
                ) : (
                  <ResponsiveContainer width="100%" height={170}>
                    <BarChart data={d.crescita.map(x => ({ ...x, giorno: giorno(x.giorno), uscite: -(x.disiscritti + x.rimossi) }))}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                      <XAxis dataKey="giorno" tick={{ fill: '#6f6f6f', fontSize: 10 }} interval="preserveStartEnd" />
                      <YAxis tick={{ fill: '#6f6f6f', fontSize: 10 }} />
                      <Tooltip content={<ChartTip />} />
                      <Bar dataKey="iscritti" name={tr('klaviyo.iscritti', null, 'Iscritti')} fill="#22c55e" radius={[2, 2, 0, 0]} />
                      <Bar dataKey="uscite" name={tr('klaviyo.uscite', null, 'Uscite')} fill="#ef4444" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>

              {/* Campagne che lo hanno usato */}
              <div style={{ padding: '0 20px 20px' }}>
                <div style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)', marginBottom: 8 }}>
                  {tr('klaviyo.campagneUsate', { n: d.campagne.length }, `Campagne che lo hanno usato (${d.campagne.length})`)}
                </div>
                {d.campagne.length === 0 ? (
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                    {tr('klaviyo.mai', null, 'Non è mai stato usato in una campagna email.')}
                  </div>
                ) : (
                  <div className="m-scrollx" style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
                    <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                      <thead>
                        <tr>
                          <th style={{ ...th, textAlign: 'left' }}><Fonte loghi={['klaviyo']} />{tr('klaviyo.campagna', null, 'Campagna')}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{tr('klaviyo.destinatari', null, 'Destinatari')}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{tr('klaviyo.openRate', null, 'Aperture')}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{tr('klaviyo.clickRate', null, 'Click')}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{tr('klaviyo.ordini', null, 'Ordini')}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{tr('klaviyo.entrate', null, 'Entrate')}</th>
                          <th style={{ ...th, textAlign: 'right' }}>{tr('klaviyo.perDest', null, 'Per dest.')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {d.campagne.map((c, i) => (
                          <tr key={c.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'rgba(255,255,255,0.02)' : 'transparent' }}>
                            <td style={{ padding: '8px 10px', fontSize: 13 }}>
                              <div style={{ color: 'var(--text)', fontWeight: 600 }}>{c.nome}</div>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>
                                {c.inviata ? new Date(c.inviata).toLocaleDateString('it-IT') : '—'}
                                {!c.incluso && ` · ${tr('klaviyo.escluso', null, 'escluso')}`}
                              </div>
                            </td>
                            <td style={td}>{intero(c.destinatari)}</td>
                            <td style={{ ...td, color: '#22c55e' }}>{pct(c.aperturePct)}</td>
                            <td style={{ ...td, color: '#3b82f6' }}>{pct(c.clickPct)}</td>
                            <td style={td}>{intero(c.ordini)}</td>
                            <td style={{ ...td, fontWeight: 600, color: 'var(--text)' }}>{euro(c.entrate)}</td>
                            <td style={td}>{euro(c.entratePerDestinatario)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 8, lineHeight: 1.5 }}>
                  {tr('klaviyo.notaPubblico', { n: d.periodoCampagne }, `Le statistiche coprono gli ultimi ${d.periodoCampagne} giorni. Una campagna può aver usato più pubblici insieme: i numeri sono della campagna intera, non della sola parte arrivata a questo gruppo.`)}
                </div>
              </div>
            </>
          )}
      </div>
    </Pannello>
  )
}

// Una misura dell'invio: il numero e, quando ha senso, la sua percentuale.
function MisuraInvio({ etichetta, valore, quota, colore, nota, prefisso = '' }) {
  return (
    <div style={{ background: 'rgba(255,255,255,0.03)', borderRadius: 8, padding: '8px 10px' }}>
      <div className="kl-misura-et" title={etichetta}>{etichetta}</div>
      <div style={{ fontSize: 15, fontWeight: 680, color: colore || 'var(--text)', marginTop: 2 }}>
        {valore != null ? `${prefisso}${Number(valore).toLocaleString('it-IT', { useGrouping: 'always' })}` : (quota != null ? `${quota}%` : '—')}
      </div>
      {valore != null && quota != null && (
        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{quota}%</div>
      )}
      {nota && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{nota}</div>}
    </div>
  )
}
