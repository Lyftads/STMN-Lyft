'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { swrFetch, getCached, invalidate } from '../../lib/clientCache'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import FxCard from './ui/FxCard'

const eur = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { maximumFractionDigits: 0 })}`)
const eur2 = (n) => (n == null ? '—' : `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`)
const nf = (n) => Number(n || 0).toLocaleString('it-IT')

const WINDOWS = [
  { value: 6, label: '6 mesi' },
  { value: 12, label: '12 mesi' },
  { value: 18, label: '18 mesi' },
  { value: 24, label: '24 mesi' },
]

function repeatColor(pct) {
  if (pct >= 25) return '#30d158'
  if (pct >= 12) return '#ff9f0a'
  return '#ff453a'
}

const MONTH_FULL = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno', 'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
function sinceLabel(since) {
  if (!since) return ''
  const [y, m] = since.split('-').map(Number)
  return `${MONTH_FULL[(m || 1) - 1]} ${y}`
}

export default function LtvCohortsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [months, setMonths] = useState(12)

  const load = (force = false) => {
    let cancelled = false
    const key = `ltv-cohorts:${months}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) setData(cached.data)
    else setLoading(true)
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/ltv-cohorts?months=${months}`).then(r => r.json()),
      onUpdate: (fresh) => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.summary) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => { const c = load(); return c }, [months]) // eslint-disable-line react-hooks/exhaustive-deps

  const s = data?.summary || {}
  const cohorts = data?.cohorts || []
  const distribution = data?.distribution || []
  // Grafici in ordine cronologico (coorte arriva desc → reverse)
  const chrono = [...cohorts].reverse()
  const ltvChart = chrono.map(c => ({ name: c.label, ltv: c.ltv }))
  const repeatChart = chrono.map(c => ({ name: c.label, repeat: c.repeatRate }))

  const Stat = ({ label, value, sub }) => (
    <div className="glass-card" style={{ padding: '16px 18px' }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: 'var(--text)' }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 5 }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ marginTop: 24 }}>
      <FxCard delay={1.6}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center', marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {WINDOWS.map(w => (
              <button key={w.value} onClick={() => setMonths(w.value)} className="btn-glass"
                style={{ padding: '8px 14px', fontWeight: 700, cursor: 'pointer', fontSize: 12, opacity: months === w.value ? 1 : 0.55, borderColor: months === w.value ? 'var(--accent)' : undefined }}>
                {w.label}
              </button>
            ))}
          </div>
          <button onClick={() => load(true)} disabled={loading} className="btn-glass" style={{ padding: '8px 14px', fontWeight: 700, cursor: loading ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? 'Carico…' : 'Aggiorna'}
          </button>
        </div>

        {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '18px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Calcolo coorti e LTV…</div>}
        {!loading && error && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '12px 0' }}>{error}</div>}
        {!loading && !error && data && !(s.customers > 0) && <div style={{ color: 'var(--text2)', fontSize: 13, padding: '12px 0' }}>Nessun cliente nel periodo selezionato.</div>}

        {s.customers > 0 && (
          <>
            <div className="stagger-zoom" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px,1fr))', gap: 12, margin: '8px 0 20px' }}>
              <Stat label="Clienti acquisiti" value={nf(s.customers)} sub={`${nf(s.ordersTotal)} ordini totali`} />
              <Stat label="Repeat rate" value={`${s.repeatRate}%`} sub={`${nf(s.repeatCustomers)} con ≥2 ordini`} />
              <Stat label="LTV medio" value={eur2(s.avgLtv)} sub="spesa lifetime per cliente" />
              <Stat label="Ordini / cliente" value={s.avgOrders} />
              <Stat label="Clienti monouso" value={`${s.oneTimeRate}%`} sub="1 solo ordine" />
              <Stat label="Fatturato clienti" value={eur(s.revenueTotal)} sub="lifetime delle coorti" />
            </div>

            {/* Tabella coorti per acquisizione */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginBottom: 20, overflowX: 'auto' }}>
              <div className="label" style={{ marginBottom: 12 }}>Coorti per mese di acquisizione</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5, minWidth: 520 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    <th style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>COORTE</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>CLIENTI</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>REPEAT</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>ORDINI/CL.</th>
                    <th style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text3)', fontWeight: 800, fontSize: 10 }}>LTV</th>
                  </tr>
                </thead>
                <tbody>
                  {cohorts.map(c => (
                    <tr key={c.cohort} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ textAlign: 'left', padding: '8px 10px', color: 'var(--text)', fontWeight: 700 }}>{c.label}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text2)', fontWeight: 700 }}>{nf(c.size)}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', fontWeight: 800, color: repeatColor(c.repeatRate) }}>{c.repeatRate}%</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text2)', fontWeight: 700 }}>{c.avgOrders}</td>
                      <td style={{ textAlign: 'right', padding: '8px 10px', color: 'var(--text)', fontWeight: 900 }}>{eur2(c.ltv)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Grafici */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px,1fr))', gap: 16 }}>
              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>LTV medio per coorte</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={ltvChart} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <defs>
                      <linearGradient id="ltvBar" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#30d158" stopOpacity={0.95} /><stop offset="100%" stopColor="#30d158" stopOpacity={0.4} /></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={42} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => eur2(v)} />
                    <Bar dataKey="ltv" fill="url(#ltvBar)" radius={[5, 5, 0, 0]} animationDuration={1400} />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Repeat rate per coorte</div>
                <ResponsiveContainer width="100%" height={230}>
                  <LineChart data={repeatChart} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="name" tick={{ fontSize: 9, fill: 'var(--text3)' }} axisLine={false} tickLine={false} interval={0} angle={-18} textAnchor="end" height={42} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => `${v}%`} />
                    <Line type="monotone" dataKey="repeat" stroke="#2997ff" strokeWidth={2} dot={{ r: 3, fill: '#2997ff' }} animationDuration={1400} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div className="glass-card-static reveal-zoom" style={{ padding: 18, borderRadius: 16 }}>
                <div className="label" style={{ marginBottom: 12 }}>Distribuzione clienti per n° ordini</div>
                <ResponsiveContainer width="100%" height={230}>
                  <BarChart data={distribution} margin={{ top: 6, right: 10, left: -6, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="label" tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} axisLine={false} tickLine={false} />
                    <Tooltip cursor={{ fill: 'rgba(255,255,255,0.04)' }} contentStyle={{ background: 'rgba(0,0,0,0.9)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={(v) => nf(v)} />
                    <Bar dataKey="count" radius={[5, 5, 0, 0]} animationDuration={1400}>
                      {distribution.map((e, i) => <Cell key={i} fill={['#ff453a', '#ff9f0a', '#64d2ff', '#30d158'][i] || '#2997ff'} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {data?.truncated && (
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 14 }}><Icon name="warning" size={12} /> Dataset ampio: analisi sui clienti più recenti del periodo (troncato per performance).</div>
            )}

            {/* Spiegazione dinamica (cambia col timeframe selezionato) */}
            <div className="glass-card-static" style={{ padding: 18, borderRadius: 16, marginTop: 20 }}>
              <div className="label" style={{ marginBottom: 10 }}>Come leggere questi dati</div>
              <div style={{ fontSize: 13, lineHeight: 1.65, color: 'var(--text2)' }}>
                <p style={{ margin: '0 0 10px' }}>
                  Stai analizzando i <strong style={{ color: 'var(--text)' }}>{nf(s.customers)} clienti</strong> acquisiti negli <strong style={{ color: 'var(--text)' }}>ultimi {months} mesi</strong> (da {sinceLabel(data?.since)}). Una <strong style={{ color: 'var(--text)' }}>coorte</strong> raggruppa i clienti in base al <strong style={{ color: 'var(--text)' }}>mese del loro primo acquisto</strong>: così confronti gruppi omogenei e vedi come si comportano nel tempo, al netto della stagionalità.
                </p>
                <ul style={{ margin: '0 0 10px', paddingLeft: 18, display: 'grid', gap: 6 }}>
                  <li><strong style={{ color: 'var(--text)' }}>Repeat rate</strong> — % di clienti della coorte che ha fatto <strong style={{ color: 'var(--text)' }}>almeno 2 ordini</strong>. Misura quanto trattieni i clienti. Nel periodo: <strong style={{ color: repeatColor(s.repeatRate) }}>{s.repeatRate}%</strong>.</li>
                  <li><strong style={{ color: 'var(--text)' }}>LTV medio</strong> — spesa <strong style={{ color: 'var(--text)' }}>lifetime</strong> (totale storico) media per cliente: {eur2(s.avgLtv)}. È il valore reale di un cliente, da confrontare col CAC.</li>
                  <li><strong style={{ color: 'var(--text)' }}>Ordini/cliente</strong> ({s.avgOrders}) e <strong style={{ color: 'var(--text)' }}>clienti monouso</strong> ({s.oneTimeRate}%) — quanto il fatturato dipende da chi compra una volta sola.</li>
                  <li><strong style={{ color: 'var(--text)' }}>Distribuzione per n° ordini</strong> — quanti clienti si fermano a 1, 2, 3 o 4+ ordini: la "scala" della fedeltà.</li>
                </ul>
                <p style={{ margin: 0, paddingTop: 10, borderTop: '1px solid var(--border)', color: 'var(--text3)' }}>
                  <Icon name="warning" size={12} /> <strong style={{ color: 'var(--text2)' }}>Effetto maturità</strong>: le coorti più recenti (in alto) hanno repeat rate e LTV <em>fisiologicamente più bassi</em> perché hanno avuto meno tempo per riacquistare. Per il potenziale reale guarda le coorti più vecchie. {months <= 6
                    ? `Con una finestra di ${months} mesi vedi soprattutto l'acquisizione recente: allarga a 12–24 mesi per valutare la retention matura.`
                    : `Con ${months} mesi includi anche coorti mature: confronta le righe vecchie (LTV/repeat consolidati) con le recenti per stimare dove arriveranno.`}
                  {s.repeatRate < 15
                    ? ` Il repeat rate complessivo (${s.repeatRate}%) è basso: c'è leva su retention — flussi email post-acquisto, bundle, reorder reminder.`
                    : s.repeatRate < 30
                      ? ` Il repeat rate (${s.repeatRate}%) è discreto: spingere su win-back e cross-sell può alzarlo.`
                      : ` Ottimo repeat rate (${s.repeatRate}%): base clienti fedele, conviene investire in acquisizione.`}
                </p>
              </div>
            </div>
          </>
        )}
      </FxCard>
    </div>
  )
}
