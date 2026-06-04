'use client'

import { useState, useEffect, useMemo } from 'react'

const LS_KEY = 'lyft_pnl_cfg'
const DEF_CFG = {
  vatRate: 22, cogsPct: null, packagingPerOrder: 0, gatewayPct: 0, gatewayFixed: 0,
  // righe OPEX suggerite (Shopify non espone piano/app via API → vanno qui)
  fixedCosts: [{ name: 'Shopify (piano)', amount: '' }, { name: 'App Shopify', amount: '' }],
}

const eur = (n) => (n == null || !Number.isFinite(n)) ? '—' : `€${Math.round(n).toLocaleString('it-IT')}`
const eur2 = (n) => (n == null || !Number.isFinite(n)) ? '—' : `€${n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const pctv = (n) => (n == null || !Number.isFinite(n)) ? '—' : `${n.toFixed(1)}%`
const MLAB = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const monthLabel = (m) => { const [y, mm] = m.split('-').map(Number); return `${MLAB[(mm || 1) - 1]} ${String(y).slice(2)}` }

function Delta({ cur, prev, lowerBetter = false }) {
  if (prev == null || cur == null || !Number.isFinite(prev) || prev === 0) return null
  const dEur = cur - prev
  const dPct = (dEur / Math.abs(prev)) * 100
  const up = dEur > 0
  const good = lowerBetter ? !up : up
  const col = Math.abs(dPct) < 0.05 ? 'var(--text3)' : good ? '#30d158' : '#ff375f'
  return <span style={{ fontSize: 10, fontWeight: 700, color: col, marginLeft: 6, whiteSpace: 'nowrap' }}>{up ? '▲' : '▼'} {Math.abs(dPct).toFixed(0)}% ({up ? '+' : '−'}{eur(Math.abs(dEur)).replace('€', '€')})</span>
}

export default function PnLTab({ data = [] }) {
  const [months, setMonths] = useState(12)
  const [state, setState] = useState({ loading: true })
  const [cfg, setCfg] = useState(DEF_CFG)
  const [showCfg, setShowCfg] = useState(false)

  useEffect(() => {
    try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s) setCfg({ ...DEF_CFG, ...s }) } catch {}
  }, [])
  const saveCfg = (next) => { setCfg(next); try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {} }

  useEffect(() => {
    let alive = true
    setState({ loading: true })
    fetch(`/api/pnl?months=${months}`).then(r => r.json()).then(j => alive && setState({ loading: false, ...j }))
      .catch(() => alive && setState({ loading: false, configured: false }))
    return () => { alive = false }
  }, [months])

  // spesa ads per mese dal data mensile dell'app
  const adByMonth = useMemo(() => {
    const m = {}
    for (const r of (data || [])) { if (r?.month) m[r.month] = (Number(r.metaSpend) || 0) + (Number(r.googleSpend) || 0) }
    return m
  }, [data])

  const cogsRatio = cfg.cogsPct != null ? cfg.cogsPct / 100 : (state.cogsRatio ?? null)
  const fixedTotal = (cfg.fixedCosts || []).reduce((s, f) => s + (Number(f.amount) || 0), 0)

  // costruisci P&L per mese
  const rows = useMemo(() => {
    const series = state.series || []
    return series.map(s => {
      const net = s.netSales
      const cogs = cogsRatio != null ? net * cogsRatio : null
      const grossMargin = cogs != null ? net - cogs : null
      const ads = adByMonth[s.month] ?? 0
      const fee = (state.feesByMonth && state.feesByMonth[s.month] != null)
        ? state.feesByMonth[s.month]
        : (s.totalSales * (cfg.gatewayPct || 0) / 100 + s.orders * (cfg.gatewayFixed || 0))
      const packaging = s.orders * (cfg.packagingPerOrder || 0)
      const contrib = grossMargin != null ? grossMargin - ads - fee - packaging : null
      const ebit = contrib != null ? contrib - fixedTotal : null
      const ebitPct = ebit != null && net > 0 ? (ebit / net) * 100 : null
      return { ...s, net, cogs, grossMargin, ads, fee, packaging, contrib, fixed: fixedTotal, ebit, ebitPct }
    })
  }, [state.series, state.feesByMonth, cogsRatio, adByMonth, cfg, fixedTotal])

  const annual = useMemo(() => {
    if (!rows.length) return null
    const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
    const net = sum('net'), ebit = sum('ebit')
    return {
      grossSales: sum('grossSales'), taxes: sum('taxes'), net, cogs: sum('cogs'), grossMargin: sum('grossMargin'),
      ads: sum('ads'), fee: sum('fee'), packaging: sum('packaging'), contrib: sum('contrib'),
      fixed: fixedTotal * rows.length, ebit, ebitPct: net > 0 ? (ebit / net) * 100 : null, orders: sum('orders'),
    }
  }, [rows, fixedTotal])

  const desc = [...rows].reverse() // più recente in alto
  const cols = [
    ['Incassato (incl. IVA)', 'totalSales', false], ['IVA', 'taxes', false], ['Ricavi netti', 'net', false],
    ['COGS', 'cogs', true], ['Margine lordo', 'grossMargin', false], ['Advertising', 'ads', true],
    ['Fee gateway', 'fee', true], ['Packaging', 'packaging', true], ['Margine contrib.', 'contrib', false],
    ['Costi fissi', 'fixed', true], ['EBIT', 'ebit', false],
  ]

  return (
    <div style={{ maxWidth: 1280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, opacity: 0.6, flex: 1 }}>Conto economico mensile · ricavi e costi reali (Shopify + Ads) con variazioni mese su mese e totale annuale.</div>
        <select value={months} onChange={e => setMonths(+e.target.value)} style={inp}>
          <option value={6}>6 mesi</option><option value={12}>12 mesi</option><option value={24}>24 mesi</option>
        </select>
        <button onClick={() => setShowCfg(v => !v)} style={{ ...inp, cursor: 'pointer' }}>⚙ Costi & impostazioni</button>
      </div>

      {showCfg && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>
            <Field label="COGS % (se costi Shopify mancanti)" value={cfg.cogsPct ?? ''} ph={state.avgMargin != null ? `auto: ${(100 - state.avgMargin).toFixed(0)}%` : 'es. 40'} onChange={v => saveCfg({ ...cfg, cogsPct: v === '' ? null : Number(v) })} />
            <Field label="Packaging €/ordine" value={cfg.packagingPerOrder} onChange={v => saveCfg({ ...cfg, packagingPerOrder: Number(v) || 0 })} />
            <Field label="Fee gateway %" value={cfg.gatewayPct} ph={state.feesSource === 'shopify-payments' ? 'auto da Shopify Payments' : 'es. 1.5'} onChange={v => saveCfg({ ...cfg, gatewayPct: Number(v) || 0 })} />
            <Field label="Fee gateway € fisso/ordine" value={cfg.gatewayFixed} onChange={v => saveCfg({ ...cfg, gatewayFixed: Number(v) || 0 })} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>Costi fissi mensili (OPEX)</div>
          {(cfg.fixedCosts || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={f.name} placeholder="Voce (es. Affitto)" onChange={e => { const fc = [...cfg.fixedCosts]; fc[i] = { ...fc[i], name: e.target.value }; saveCfg({ ...cfg, fixedCosts: fc }) }} style={{ ...inp, flex: 1 }} />
              <input value={f.amount} type="number" placeholder="€/mese" onChange={e => { const fc = [...cfg.fixedCosts]; fc[i] = { ...fc[i], amount: e.target.value }; saveCfg({ ...cfg, fixedCosts: fc }) }} style={{ ...inp, width: 130 }} />
              <button onClick={() => saveCfg({ ...cfg, fixedCosts: cfg.fixedCosts.filter((_, j) => j !== i) })} style={{ ...inp, cursor: 'pointer', width: 40 }}>×</button>
            </div>
          ))}
          <button onClick={() => saveCfg({ ...cfg, fixedCosts: [...(cfg.fixedCosts || []), { name: '', amount: '' }] })} style={{ ...inp, cursor: 'pointer' }}>+ Aggiungi costo fisso</button>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>
            COGS: {state.cogsRatio != null ? `auto da costi Shopify (margine medio ${state.avgMargin}%)` : 'imposta una % qui'} · Fee: {state.feesSource === 'shopify-payments' ? 'reali da Shopify Payments ✓' : 'stima da % (Shopify Payments non disponibile)'}
          </div>
        </div>
      )}

      {state.loading && <div style={{ opacity: 0.5, fontSize: 13 }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Calcolo il conto economico…</div>}
      {!state.loading && !state.configured && <div className="glass-card" style={{ padding: 20, fontSize: 13, color: '#ff375f' }}>⚠ {state.error || 'Shopify non configurato.'}</div>}
      {!state.loading && state.configured && rows.length === 0 && <div className="glass-card" style={{ padding: 20, fontSize: 13 }}>Nessun dato nel periodo.</div>}

      {!state.loading && rows.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, minWidth: 1100 }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, background: 'var(--surface, #0a0a12)' }}>Mese</th>
                {cols.map(([l]) => <th key={l} style={th}>{l}</th>)}
                <th style={th}>EBIT %</th>
              </tr>
            </thead>
            <tbody>
              {annual && (
                <tr style={{ background: 'rgba(41,151,255,0.06)', fontWeight: 700 }}>
                  <td style={{ ...td, textAlign: 'left', position: 'sticky', left: 0, background: 'rgba(20,24,40,0.95)' }}>Annuale ({rows.length}m)</td>
                  <td style={td}>{eur(annual.totalSales || (annual.net + annual.taxes))}</td>
                  <td style={td}>{eur(annual.taxes)}</td>
                  <td style={td}>{eur(annual.net)}</td>
                  <td style={td}>{eur(annual.cogs)}</td>
                  <td style={td}>{eur(annual.grossMargin)}</td>
                  <td style={td}>{eur(annual.ads)}</td>
                  <td style={td}>{eur(annual.fee)}</td>
                  <td style={td}>{eur(annual.packaging)}</td>
                  <td style={td}>{eur(annual.contrib)}</td>
                  <td style={td}>{eur(annual.fixed)}</td>
                  <td style={{ ...td, color: annual.ebit >= 0 ? '#30d158' : '#ff375f', fontWeight: 800 }}>{eur(annual.ebit)}</td>
                  <td style={td}>{pctv(annual.ebitPct)}</td>
                </tr>
              )}
              {desc.map((r, i) => {
                const prev = desc[i + 1] // mese precedente (più vecchio)
                return (
                  <tr key={r.month}>
                    <td style={{ ...td, textAlign: 'left', fontWeight: 600, position: 'sticky', left: 0, background: 'var(--surface, #0a0a12)' }}>{monthLabel(r.month)}</td>
                    <td style={td}>{eur(r.totalSales)}</td>
                    <td style={td}>{eur(r.taxes)}</td>
                    <td style={td}>{eur(r.net)}<Delta cur={r.net} prev={prev?.net} /></td>
                    <td style={td}>{eur(r.cogs)}</td>
                    <td style={td}>{eur(r.grossMargin)}<Delta cur={r.grossMargin} prev={prev?.grossMargin} /></td>
                    <td style={td}>{eur(r.ads)}</td>
                    <td style={td}>{eur(r.fee)}</td>
                    <td style={td}>{eur(r.packaging)}</td>
                    <td style={td}>{eur(r.contrib)}</td>
                    <td style={td}>{eur(r.fixed)}</td>
                    <td style={{ ...td, color: r.ebit >= 0 ? '#30d158' : '#ff375f', fontWeight: 700 }}>{eur(r.ebit)}<Delta cur={r.ebit} prev={prev?.ebit} /></td>
                    <td style={td}>{pctv(r.ebitPct)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, onChange, ph }) {
  return (
    <div>
      <label style={{ fontSize: 11, opacity: 0.6, display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value} type="number" placeholder={ph} onChange={e => onChange(e.target.value)} style={{ ...inp, width: '100%' }} />
    </div>
  )
}

const inp = { padding: '9px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, outline: 'none' }
const th = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, opacity: 0.6, textAlign: 'right', whiteSpace: 'nowrap' }
const td = { padding: '9px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }
