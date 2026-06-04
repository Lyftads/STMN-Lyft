'use client'

import { useEffect, useState } from 'react'
import { swrFetch, getCached } from '../../lib/clientCache'
import {
  BarChart, Bar, AreaChart, Area, LineChart, Line,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'
const fmtP = n => n != null ? `${n.toFixed(1)}%` : '—'

function greetMarino() {
  const h = new Date().getHours()
  if (h < 12) return 'Buongiorno Marino — ecco come vanno le email'
  if (h < 18) return 'Ciao Marino — il punto su Klaviyo'
  return 'Sera Marino — riepilogo Klaviyo'
}

function kpiComment(kpis) {
  if (!kpis) return ''
  const { openRate, clickRate, revenue } = kpis
  const parts = []
  if (openRate > 50) parts.push(`Open rate al ${openRate.toFixed(1)}% — i subject stanno spaccando 🔥`)
  else if (openRate > 30) parts.push(`Open rate al ${openRate.toFixed(1)}%, nella media. Possiamo testare nuovi subject?`)
  else if (openRate > 0) parts.push(`Open rate al ${openRate.toFixed(1)}%... rivediamo i subject?`)
  if (revenue?.total > 10000) parts.push(`${fmtE(revenue.total)} di revenue — mica male! 💪`)
  else if (revenue?.total > 0) parts.push(`${fmtE(revenue.total)} di revenue, ci stiamo muovendo.`)
  if (clickRate < 2 && clickRate > 0) parts.push('Click rate un po\' basso — le CTA vanno ripensate?')
  return parts.join(' · ') || 'Tutto nella norma!'
}

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(12px)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 11, fontWeight: 700, boxShadow: '0 12px 30px rgba(0,0,0,0.6)' }}>
      <p style={{ color: '#888', marginBottom: 4 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.value > 100 ? fmtN(p.value) : p.value?.toFixed?.(2) ?? p.value}</p>
      ))}
    </div>
  )
}

// ── Shared styles (vetro nero — lo sfondo nero arriva dalle classi
//    .glass-section / .glass-card / .glass-panel, niente background/border inline) ──
const sectionStyle = { borderRadius: 22, padding: 24, marginBottom: 24 }
const cardStyle = { borderRadius: 16, padding: 20, minWidth: 0 }
const panelStyle = { borderRadius: 18, padding: '20px 24px' }

function Section({ title, subtitle, color = '#8b5cf6', children, style }) {
  return (
    <div className="glass-section reveal-zoom" style={{ ...sectionStyle, ...style }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11, marginBottom: subtitle ? 6 : 20 }}>
        <span style={{ width: 4, height: 20, borderRadius: 99, background: color, boxShadow: `0 0 14px ${color}, 0 0 4px ${color}` }} />
        <span style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.01em' }}>{title}</span>
      </div>
      {subtitle && <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>{subtitle}</div>}
      {children}
    </div>
  )
}

function Card({ title, value, badge, color = '#8b5cf6' }) {
  return (
    <div className="glass-card" style={cardStyle}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <span style={{ fontSize: 11, color: '#9b90aa', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.08em' }}>{title}</span>
        {badge && (
          <span style={{
            fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6,
            background: `${color}22`, color, textTransform: 'uppercase', letterSpacing: '.05em',
          }}>{badge}</span>
        )}
      </div>
      <div style={{ fontSize: 26, fontWeight: 950, color: '#fff', letterSpacing: '-0.03em' }}>{value}</div>
    </div>
  )
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
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [days, setDays] = useState(30)
  const [chartTab, setChartTab] = useState('received')
  const [campTab, setCampTab] = useState('sent')

  useEffect(() => {
    let active = true
    const key = `klaviyo:${days}`
    const cached = getCached(key)
    if (cached) {
      setData(cached.data)
      // no setLoading: dati gia' visibili
    } else {
      setLoading(true)
    }
    swrFetch({
      key,
      fetcher: () => fetch(`/api/klaviyo?days=${days}`, { cache: 'no-store' })
        .then(r => r.json()),
      onUpdate: (fresh) => { if (active) setData(fresh) },
    })
      .then(({ data, fromCache }) => {
        if (!active) return
        if (!cached) setData(data)
      })
      .catch(() => {})
      .finally(() => { if (active && !cached) setLoading(false) })
    return () => { active = false }
  }, [days])

  if (loading) {
    return <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700 }}>Un attimo, sto tirando su i dati da Klaviyo...</div>
  }

  if (!data || data.error) {
    return <div style={{ color: '#ef4444', padding: 40 }}>Errore: {data?.error || 'Connessione Klaviyo fallita'}</div>
  }

  const { account, kpis, campaigns, flows, segments, lists } = data

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
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
        <p style={{ color: '#9f93ad', fontSize: 13, margin: 0 }}>{greetMarino()}</p>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{ d: 0, label: 'Oggi' }, { d: 7, label: '7g' }, { d: 14, label: '14g' }, { d: 30, label: '30g' }, { d: 60, label: '60g' }, { d: 90, label: '90g' }].map(o => (
            <button key={o.d} onClick={() => setDays(o.d)} className="btn-glass" style={{
              border: days === o.d ? '1px solid #8b5cf6' : '1px solid var(--border)',
              background: days === o.d ? '#8b5cf622' : 'var(--glass)',
              color: days === o.d ? '#c4b5fd' : '#9b90aa',
              borderRadius: 8, padding: '6px 12px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>{o.label}</button>
          ))}
        </div>
      </div>

      {/* Panoramica Email */}
      <Section title="Panoramica Email" subtitle={`Klaviyo · ${days === 0 ? 'oggi' : `ultimi ${days} giorni`}`} color="#8b5cf6">
        <div className="reveal" style={{
          background: 'linear-gradient(90deg, rgba(139,92,246,0.12), transparent)',
          border: '1px solid var(--border)', borderRadius: 12,
          padding: '12px 18px', marginBottom: 20, color: '#c4b5fd', fontSize: 13, fontWeight: 600,
        }}>
          {kpiComment(kpis)}
        </div>

        <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14, marginBottom: 14 }}>
          <Card title="Email Ricevute" value={fmtN(kpis?.received?.total)} badge="Klaviyo" color="#8b5cf6" />
          <Card title="Aperte" value={fmtN(kpis?.opened?.total)} badge="Open" color="#3b82f6" />
          <Card title="Cliccate" value={fmtN(kpis?.clicked?.total)} badge="Click" color="#06b6d4" />
          <Card title="Open Rate" value={fmtP(kpis?.openRate)} badge="Rate" color="#22c55e" />
          <Card title="Click Rate" value={fmtP(kpis?.clickRate)} badge="Rate" color="#22c55e" />
          <Card title="CTOR" value={fmtP(kpis?.ctor)} badge="Rate" color="#f59e0b" />
        </div>
        <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
          <Card title="Bounce" value={fmtN(kpis?.bounced?.total)} badge="Health" color="#ef4444" />
          <Card title="Unsub" value={fmtN(kpis?.unsubscribed?.total)} badge="Health" color="#ef4444" />
          <Card title="Revenue" value={fmtE(kpis?.revenue?.total)} badge="€" color="#22c55e" />
        </div>
      </Section>

      {/* Revenue Breakdown */}
      {data.revenueBreakdown && (
        <Section title="Revenue Breakdown — Campagne vs Flussi" color="#22c55e">
          <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="glass-panel" style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#ec4899' }}>Campagne</span>
                <span style={{ fontSize: 22, fontWeight: 950, color: '#fff' }}>{fmtE(data.revenueBreakdown.campaigns?.total)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9b90aa', marginBottom: 14 }}>{fmtN(data.revenueBreakdown.campaigns?.totalConversions)} conversioni</div>
              {(data.revenueBreakdown.campaigns?.rows || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12, gap: 10 }}>
                  <span style={{ color: '#e2dcf0', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ color: '#776a86', fontSize: 10, flexShrink: 0 }}>OR {fmtP(r.openRate)}</span>
                  <span style={{ color: '#776a86', fontSize: 10, flexShrink: 0 }}>CR {fmtP(r.clickRate)}</span>
                  <span style={{ color: '#9b90aa', fontSize: 10, flexShrink: 0 }}>{fmtN(r.conversions)} conv</span>
                  <span style={{ color: '#22c55e', fontWeight: 800, flexShrink: 0 }}>{fmtE(r.revenue)}</span>
                </div>
              ))}
            </div>

            <div className="glass-panel" style={panelStyle}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                <span style={{ fontSize: 13, fontWeight: 900, color: '#f6b73c' }}>Flussi</span>
                <span style={{ fontSize: 22, fontWeight: 950, color: '#fff' }}>{fmtE(data.revenueBreakdown.flows?.total)}</span>
              </div>
              <div style={{ fontSize: 12, color: '#9b90aa', marginBottom: 14 }}>{fmtN(data.revenueBreakdown.flows?.totalConversions)} conversioni</div>
              {(data.revenueBreakdown.flows?.rows || []).map((r, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)', fontSize: 12, gap: 10 }}>
                  <span style={{ color: '#e2dcf0', fontWeight: 700, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}</span>
                  <span style={{ color: '#776a86', fontSize: 10, flexShrink: 0 }}>OR {fmtP(r.openRate)}</span>
                  <span style={{ color: '#776a86', fontSize: 10, flexShrink: 0 }}>CR {fmtP(r.clickRate)}</span>
                  <span style={{ color: '#9b90aa', fontSize: 10, flexShrink: 0 }}>{fmtN(r.conversions)} conv</span>
                  <span style={{ color: '#22c55e', fontWeight: 800, flexShrink: 0 }}>{fmtE(r.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </Section>
      )}

      {/* Trend Giornaliero */}
      <Section title="Trend Giornaliero" color="#8b5cf6">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { id: 'received', label: 'Ricevute' },
            { id: 'opened', label: 'Aperte' },
            { id: 'clicked', label: 'Cliccate' },
            { id: 'revenue', label: 'Revenue' },
          ].map(t => (
            <button key={t.id} onClick={() => setChartTab(t.id)} className="btn-glass" style={{
              border: chartTab === t.id ? '1px solid #8b5cf6' : '1px solid var(--border)',
              background: chartTab === t.id ? '#8b5cf622' : 'var(--glass)',
              color: chartTab === t.id ? '#c4b5fd' : '#9b90aa',
              borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        <div className="glass-panel" style={{ ...panelStyle, padding: 20 }}>
          <ResponsiveContainer width="100%" height={260}>
            {chartTab === 'revenue' ? (
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: '#776a86', fontSize: 10 }} />
                <YAxis tick={{ fill: '#776a86', fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Line type="monotone" dataKey="revenue" stroke="#22c55e" strokeWidth={2} dot={false} />
              </LineChart>
            ) : chartTab === 'opened' || chartTab === 'clicked' ? (
              <AreaChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: '#776a86', fontSize: 10 }} />
                <YAxis tick={{ fill: '#776a86', fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Area type="monotone" dataKey={chartTab} stroke={chartTab === 'opened' ? '#3b82f6' : '#06b6d4'} fill={chartTab === 'opened' ? '#3b82f622' : '#06b6d422'} strokeWidth={2} />
              </AreaChart>
            ) : (
              <BarChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="date" tick={{ fill: '#776a86', fontSize: 10 }} />
                <YAxis tick={{ fill: '#776a86', fontSize: 10 }} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="received" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ResponsiveContainer>
        </div>
      </Section>

      {/* Campagne */}
      <Section title="Campagne" color="#ec4899">
        <div style={{ display: 'flex', gap: 6, marginBottom: 16, flexWrap: 'wrap' }}>
          {[
            { id: 'sent', label: `Inviate (${campaigns?.sent?.length || 0})` },
            { id: 'draft', label: `Bozze (${campaigns?.draft?.length || 0})` },
            { id: 'scheduled', label: `Programmate (${campaigns?.scheduled?.length || 0})` },
          ].map(t => (
            <button key={t.id} onClick={() => setCampTab(t.id)} className="btn-glass" style={{
              border: campTab === t.id ? '1px solid #ec4899' : '1px solid var(--border)',
              background: campTab === t.id ? '#ec489922' : 'var(--glass)',
              color: campTab === t.id ? '#f9a8d4' : '#9b90aa',
              borderRadius: 8, padding: '8px 16px', fontSize: 12, fontWeight: 800, cursor: 'pointer',
            }}>{t.label}</button>
          ))}
        </div>

        <div className="glass-panel" style={{ ...panelStyle, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)' }}>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Campagna</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Status</th>
                <th style={{ padding: '12px 16px', textAlign: 'left', color: '#776a86', fontWeight: 800, fontSize: 11, textTransform: 'uppercase' }}>Data Invio</th>
              </tr>
            </thead>
            <tbody>
              {(campaigns?.[campTab] || []).slice(0, 20).map((c, i) => (
                <tr key={c.id || i} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td style={{ padding: '10px 16px', color: '#f7f2ff', fontWeight: 700 }}>{c.name}</td>
                  <td style={{ padding: '10px 16px' }}>
                    <span style={{
                      fontSize: 10, fontWeight: 900, padding: '3px 8px', borderRadius: 6,
                      background: c.status === 'Sent' ? '#22c55e22' : c.status === 'Draft' ? '#f59e0b22' : '#3b82f622',
                      color: c.status === 'Sent' ? '#22c55e' : c.status === 'Draft' ? '#f59e0b' : '#3b82f6',
                    }}>{c.status}</span>
                  </td>
                  <td style={{ padding: '10px 16px', color: '#9b90aa', fontSize: 12 }}>{c.sendTime ? new Date(c.sendTime).toLocaleString('it-IT') : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* Flussi */}
      <Section title="Flussi" color="#f6b73c">
        <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 14 }}>
          {(flows || []).map((f, i) => (
            <div key={f.id || i} className="glass-card" style={{ ...cardStyle, padding: '16px 20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ color: '#f7f2ff', fontWeight: 800, fontSize: 14 }}>{f.name}</span>
                <span style={{
                  fontSize: 9, fontWeight: 900, padding: '3px 8px', borderRadius: 6,
                  background: f.status === 'live' ? '#22c55e22' : '#55555522',
                  color: f.status === 'live' ? '#22c55e' : '#888',
                  textTransform: 'uppercase',
                }}>{f.status}</span>
              </div>
              <span style={{ color: '#776a86', fontSize: 11, fontWeight: 700 }}>Trigger: {f.triggerType || '—'}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Segmenti & Liste */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
        <Section title="Segmenti" color="#06b6d4" style={{ marginBottom: 0 }}>
          <div className="glass-panel" style={{ ...panelStyle, padding: 16 }}>
            {(segments || []).map((s, i) => (
              <div key={s.id || i} style={{ padding: '8px 0', borderBottom: i < segments.length - 1 ? '1px solid var(--border)' : 'none', display: 'flex', alignItems: 'center' }}>
                <StatusDot active={s.isActive} />
                <span style={{ color: '#f7f2ff', fontWeight: 700, fontSize: 13 }}>{s.name}</span>
              </div>
            ))}
          </div>
        </Section>
        <Section title="Liste" color="#a855f7" style={{ marginBottom: 0 }}>
          <div className="glass-panel" style={{ ...panelStyle, padding: 16 }}>
            {(lists || []).map((l, i) => (
              <div key={l.id || i} style={{ padding: '8px 0', borderBottom: i < lists.length - 1 ? '1px solid var(--border)' : 'none' }}>
                <span style={{ color: '#f7f2ff', fontWeight: 700, fontSize: 13 }}>{l.name}</span>
              </div>
            ))}
          </div>
        </Section>
      </div>
    </div>
  )
}
