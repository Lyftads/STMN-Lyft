'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { ResponsiveContainer, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend } from 'recharts'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

const LS_KEY = 'lyft_pnl_cfg'
const DEF_CFG = {
  vatRate: 22, cogsPct: null, packagingPerOrder: 0, shippingPerOrder: 0, gatewayPct: 0, gatewayFixed: 0,
  // righe OPEX suggerite (Shopify non espone piano/app via API → vanno qui)
  fixedCosts: [{ name: 'Shopify (piano)', amount: '' }, { name: 'App Shopify', amount: '' }],
}

const eur = (n) => (n == null || !Number.isFinite(n)) ? '—' : `€${Math.round(n).toLocaleString('it-IT')}`
const eur2 = (n) => (n == null || !Number.isFinite(n)) ? '—' : `€${n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`
const pctv = (n) => (n == null || !Number.isFinite(n)) ? '—' : `${n.toFixed(1)}%`
const MLAB = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MFULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const monthLabel = (m) => { const [y, mm] = m.split('-').map(Number); return `${MLAB[(mm || 1) - 1]} ${String(y).slice(2)}` }
const monthFull = (m) => { const [y, mm] = m.split('-').map(Number); return `${MFULL[(mm || 1) - 1]} ${y}` }

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
  const { t, intlLocale } = useI18n()
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const monthLabelL = (m) => { const [y, mm] = m.split('-').map(Number); return `${cap(new Date(y, (mm || 1) - 1, 1).toLocaleDateString(intlLocale, { month: 'short' }))} ${String(y).slice(2)}` }
  const monthFullL = (m) => { const [y, mm] = m.split('-').map(Number); return `${cap(new Date(y, (mm || 1) - 1, 1).toLocaleDateString(intlLocale, { month: 'long' }))} ${y}` }
  const [view, setView] = useState('12')   // 'last' | 'prev' | '6' | '12' | '24'
  const fetchMonths = (view === 'last' || view === 'prev') ? 3 : Number(view)
  const [state, setState] = useState({ loading: true })
  const [cfg, setCfg] = useState(DEF_CFG)
  const [showCfg, setShowCfg] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let alive = true
    // 1) localStorage subito (istantaneo) → 2) account sul server (sovrascrive se presente)
    try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s) setCfg({ ...DEF_CFG, ...s }) } catch {}
    fetch('/api/pnl/config').then(r => r.json()).then(j => {
      if (alive && j?.config && Object.keys(j.config).length) {
        setCfg({ ...DEF_CFG, ...j.config })
        try { localStorage.setItem(LS_KEY, JSON.stringify(j.config)) } catch {}
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const saveCfg = (next) => {
    setCfg(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/pnl/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: next }) })
        .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }).catch(() => {})
    }, 700)
  }

  const cacheRef = useRef({})  // memoria per fetchMonths → niente reload cambiando timeframe
  useEffect(() => {
    let alive = true
    const cached = cacheRef.current[fetchMonths]
    if (cached) { setState({ loading: false, ...cached }); return () => { alive = false } }
    setState({ loading: true })
    fetch(`/api/pnl?months=${fetchMonths}`, { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (!alive) return
      cacheRef.current[fetchMonths] = j
      setState({ loading: false, ...j })
    }).catch(() => alive && setState({ loading: false, configured: false }))
    return () => { alive = false }
  }, [fetchMonths, refreshKey])

  // spesa ads per mese dal data mensile dell'app
  const adByMonth = useMemo(() => {
    const m = {}
    for (const r of (data || [])) { if (r?.month) m[r.month] = (Number(r.metaSpend) || 0) + (Number(r.googleSpend) || 0) }
    return m
  }, [data])

  // Fatturato (incl. IVA) dal monthly dell'app — stesso "Fatturato" delle altre tab
  const fattByMonth = useMemo(() => {
    const m = {}
    for (const r of (data || [])) { if (r?.month) m[r.month] = Number(r.fatturato) || 0 }
    return m
  }, [data])

  const cogsRatio = cfg.cogsPct != null ? cfg.cogsPct / 100 : (state.cogsRatio ?? null)
  const fixedTotal = (cfg.fixedCosts || []).reduce((s, f) => s + (Number(f.amount) || 0), 0)

  // costruisci P&L per mese
  const rows = useMemo(() => {
    const series = state.series || []
    return series.map(s => {
      const net = s.netSales
      // priorità: override manuale % → COGS reale mensile da Shopify → ratio margine medio
      const realCogs = (state.cogsByMonth && state.cogsByMonth[s.month] != null) ? state.cogsByMonth[s.month] : null
      const cogs = cfg.cogsPct != null
        ? net * (cfg.cogsPct / 100)
        : (realCogs != null ? realCogs : (state.cogsRatio != null ? net * state.cogsRatio : null))
      const grossMargin = cogs != null ? net - cogs : null
      const ads = adByMonth[s.month] ?? 0
      const fee = (state.feesByMonth && state.feesByMonth[s.month] != null)
        ? state.feesByMonth[s.month]
        : (s.totalSales * (cfg.gatewayPct || 0) / 100 + s.orders * (cfg.gatewayFixed || 0))
      const packaging = s.orders * (cfg.packagingPerOrder || 0)
      const shipCost = s.orders * (cfg.shippingPerOrder || 0)
      const contrib = grossMargin != null ? grossMargin - ads - fee - packaging - shipCost : null
      const ebit = contrib != null ? contrib - fixedTotal : null
      const ebitPct = ebit != null && net > 0 ? (ebit / net) * 100 : null
      // Fatturato (incl. IVA): dal monthly app (come le altre tab); fallback a total_sales ShopifyQL
      const fatturato = (fattByMonth[s.month] != null && fattByMonth[s.month] > 0) ? fattByMonth[s.month] : s.totalSales
      return { ...s, fatturato, net, cogs, grossMargin, ads, fee, packaging, shipCost, contrib, fixed: fixedTotal, ebit, ebitPct }
    })
  }, [state.series, state.feesByMonth, state.cogsByMonth, state.cogsRatio, cogsRatio, adByMonth, fattByMonth, cfg, fixedTotal])

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
  // Voci del conto economico (righe); i mesi sono le colonne
  const lines = [
    { label: t('pnl.lineFatturato', null, 'Fatturato (incl. IVA)'), key: 'fatturato' },
    { label: t('pnl.lineVat', null, 'IVA'), key: 'taxes' },
    { label: t('pnl.lineNet', null, 'Ricavi netti (ex-IVA)'), key: 'net', strong: true },
    { label: t('pnl.lineCogs', null, 'COGS (costo prodotti)'), key: 'cogs', neg: true },
    { label: t('pnl.lineGrossMargin', null, 'Margine lordo'), key: 'grossMargin', strong: true },
    { label: t('pnl.lineAds', null, 'Advertising'), key: 'ads', neg: true },
    { label: t('pnl.lineFee', null, 'Fee gateway'), key: 'fee', neg: true },
    { label: t('pnl.linePackaging', null, 'Packaging'), key: 'packaging', neg: true },
    { label: t('pnl.lineShipping', null, 'Spedizione (corriere)'), key: 'shipCost', neg: true },
    { label: t('pnl.lineFixed', null, 'Costi fissi (OPEX)'), key: 'fixed', neg: true },
    { label: t('pnl.lineContrib', null, 'Margine contribuzione'), key: 'contrib', strong: true },
    { label: t('pnl.lineEbit', null, 'EBIT (utile)'), key: 'ebit', ebit: true },
    { label: t('pnl.lineEbitPct', null, 'EBIT %'), key: 'ebitPct', pct: true },
    { label: t('pnl.lineOrders', null, 'Ordini'), key: 'orders', int: true },
  ]
  // mese precedente per ogni mese (per la variazione MoM, indipendente da cosa mostro)
  const prevOf = {}
  rows.forEach((r, i) => { prevOf[r.month] = i > 0 ? rows[i - 1] : null })
  // mesi mostrati: tutti (finestra) oppure solo ultimo / precedente
  const asc = view === 'last' ? rows.slice(-1) : view === 'prev' ? rows.slice(-2, -1) : rows
  const totSum = (key) => asc.reduce((a, r) => a + (Number(r[key]) || 0), 0)
  const totalOf = (key) => key === 'ebitPct' ? (totSum('net') > 0 ? totSum('ebit') / totSum('net') * 100 : null) : totSum(key)
  const showTotal = asc.length > 1
  const fmtCell = (line, v) => line.pct ? pctv(v) : line.int ? (v == null ? '—' : Math.round(v).toLocaleString('it-IT')) : eur(v)

  return (
    <div style={{ maxWidth: 1280 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 13, opacity: 0.6, flex: 1 }}>{t('pnl.desc', null, 'Conto economico mensile · ricavi e costi reali (Shopify + Ads) con variazioni mese su mese e totale annuale.')}</div>
        <select value={view} onChange={e => setView(e.target.value)} style={inp}>
          <option value="last">{t('pnl.viewLast', null, 'Mese attuale')}</option>
          <option value="prev">{t('pnl.viewPrev', null, 'Mese precedente')}</option>
          <option value="6">{t('pnl.view6', null, '6 mesi')}</option>
          <option value="12">{t('pnl.view12', null, '12 mesi')}</option>
          <option value="24">{t('pnl.view24', null, '24 mesi')}</option>
        </select>
        <button onClick={() => setShowCfg(v => !v)} style={{ ...inp, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="gear" size={13} /> {t('pnl.costsSettings', null, 'Costi & impostazioni')}</button>
        <button onClick={() => { cacheRef.current = {}; setRefreshKey(k => k + 1) }} disabled={state.loading} style={{ ...inp, cursor: state.loading ? 'wait' : 'pointer', background: 'var(--accent)', color: 'var(--text)', border: 'none', fontWeight: 600 }}>↻ {state.loading ? t('shell.updating', null, 'Aggiorno…') : t('shell.refresh', null, 'Aggiorna')}</button>
      </div>

      {showCfg && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>
            <Field label={t('pnl.cogsField', null, 'COGS % (se costi Shopify mancanti)')} value={cfg.cogsPct ?? ''} ph={state.avgMargin != null ? t('pnl.cogsAutoPh', { n: (100 - state.avgMargin).toFixed(0) }, `auto: ${(100 - state.avgMargin).toFixed(0)}%`) : t('pnl.eg40', null, 'es. 40')} onChange={v => saveCfg({ ...cfg, cogsPct: v === '' ? null : Number(v) })} />
            <Field label={t('pnl.packagingField', null, 'Packaging €/ordine')} value={cfg.packagingPerOrder} onChange={v => saveCfg({ ...cfg, packagingPerOrder: Number(v) || 0 })} />
            <Field label={t('pnl.shippingField', null, 'Spedizione corriere €/ordine')} value={cfg.shippingPerOrder} ph={t('pnl.eg550', null, 'es. 5.50 (tariffa media)')} onChange={v => saveCfg({ ...cfg, shippingPerOrder: Number(v) || 0 })} />
            <Field label={t('pnl.gatewayPctField', null, 'Fee gateway %')} value={cfg.gatewayPct} ph={state.feesSource === 'shopify-payments' ? t('pnl.autoShopifyPay', null, 'auto da Shopify Payments') : t('pnl.eg15', null, 'es. 1.5')} onChange={v => saveCfg({ ...cfg, gatewayPct: Number(v) || 0 })} />
            <Field label={t('pnl.gatewayFixedField', null, 'Fee gateway € fisso/ordine')} value={cfg.gatewayFixed} onChange={v => saveCfg({ ...cfg, gatewayFixed: Number(v) || 0 })} />
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginBottom: 8 }}>{t('pnl.opex', null, 'Costi fissi mensili (OPEX)')}</div>
          {(cfg.fixedCosts || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={f.name} placeholder={t('pnl.itemPh', null, 'Voce (es. Affitto)')} onChange={e => { const fc = [...cfg.fixedCosts]; fc[i] = { ...fc[i], name: e.target.value }; saveCfg({ ...cfg, fixedCosts: fc }) }} style={{ ...inp, flex: 1 }} />
              <input value={f.amount} type="number" placeholder={t('pnl.perMonthPh', null, '€/mese')} onChange={e => { const fc = [...cfg.fixedCosts]; fc[i] = { ...fc[i], amount: e.target.value }; saveCfg({ ...cfg, fixedCosts: fc }) }} style={{ ...inp, width: 130 }} />
              <button onClick={() => saveCfg({ ...cfg, fixedCosts: cfg.fixedCosts.filter((_, j) => j !== i) })} style={{ ...inp, cursor: 'pointer', width: 40 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => saveCfg({ ...cfg, fixedCosts: [...(cfg.fixedCosts || []), { name: '', amount: '' }] })} style={{ ...inp, cursor: 'pointer' }}>{t('pnl.addFixed', null, '+ Aggiungi costo fisso')}</button>
            <span style={{ fontSize: 11, color: saved ? '#30d158' : 'var(--text3)' }}>{saved ? t('pnl.savedAccount', null, '✓ Salvato sul tuo account') : t('pnl.autoSaveAccount', null, 'Si salva automaticamente sul tuo account')}</span>
          </div>
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 12 }}>
            {t('pnl.cogsLabel', null, 'COGS:')} {cfg.cogsPct != null ? t('pnl.cogsOverride', { n: cfg.cogsPct }, `override manuale ${cfg.cogsPct}%`) : state.cogsSource === 'shopify' ? t('pnl.cogsReal', null, 'reale dalle analitiche Shopify ✓ (cost_of_goods_sold)') : state.cogsRatio != null ? t('pnl.cogsEstimate', { n: state.avgMargin }, `stima da margine medio catalogo ${state.avgMargin}%`) : t('pnl.cogsSetHere', null, 'imposta una % qui')} · {t('pnl.feeLabel', null, 'Fee:')} {state.feesSource === 'shopify-payments' ? t('pnl.feeReal', null, 'reali da Shopify Payments ✓') : t('pnl.feeEstimate', null, 'stima da % (Shopify Payments non disponibile)')}
          </div>
        </div>
      )}

      {state.loading && <div style={{ opacity: 0.5, fontSize: 13 }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('pnl.computing', null, 'Calcolo il conto economico…')}</div>}
      {!state.loading && !state.configured && <div className="glass-card" style={{ padding: 20, fontSize: 13, color: '#ff375f' }}><Icon name="warning" size={13} /> {state.error || t('pnl.notConfigured', null, 'Shopify non configurato.')}</div>}
      {!state.loading && state.configured && rows.length === 0 && <div className="glass-card" style={{ padding: 20, fontSize: 13 }}>{t('pnl.noDataPeriod', null, 'Nessun dato nel periodo.')}</div>}

      {!state.loading && asc.length > 1 && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 12, opacity: 0.85 }}>{t('pnl.chartTitle', null, 'Andamento · Ricavi netti · Costi totali · EBIT')}</div>
          <div style={{ width: '100%', height: 290 }}>
            <ResponsiveContainer>
              <ComposedChart data={asc.map(r => ({ name: monthLabelL(r.month), Ricavi: r.net, Costi: (r.net != null && r.ebit != null) ? Math.round(r.net - r.ebit) : null, EBIT: r.ebit }))} margin={{ top: 6, right: 8, left: -4, bottom: 0 }}>
                <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 10 }} width={52} tickFormatter={v => `€${Math.round(v / 1000)}k`} />
                <Tooltip contentStyle={{ background: 'rgba(8,8,15,0.95)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} formatter={v => eur(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="Ricavi" name={t('pnl.seriesRevenue', null, 'Ricavi')} fill="#2997ff" radius={[3, 3, 0, 0]} />
                <Bar dataKey="Costi" name={t('pnl.seriesCosts', null, 'Costi')} fill="#ff453a" radius={[3, 3, 0, 0]} />
                <Line dataKey="EBIT" stroke="#30d158" strokeWidth={2.5} dot={{ r: 2 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {!state.loading && rows.length > 0 && (
        <div className="glass-card" style={{ padding: 0, overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
            <thead>
              <tr>
                <th style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, background: '#0c0c16', minWidth: 200 }}>{t('pnl.colItem', null, 'Voce')}</th>
                {asc.map(r => <th key={r.month} style={{ ...th, minWidth: 110 }}>{monthFullL(r.month)}</th>)}
                {showTotal && <th style={{ ...th, minWidth: 120, color: 'var(--accent)' }}>{t('pnl.colTotal', null, 'Totale')}</th>}
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const total = totalOf(line.key)
                const baseTd = { ...td, ...(line.strong ? { fontWeight: 700 } : {}) }
                const colorOf = (v) => line.ebit ? (v >= 0 ? '#30d158' : '#ff375f') : undefined
                return (
                  <tr key={line.key} style={line.ebit ? { background: 'rgba(48,209,88,0.05)' } : line.strong ? { background: 'var(--glass)' } : undefined}>
                    <td style={{ ...baseTd, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: '#0c0c16', fontWeight: line.strong || line.ebit ? 700 : 500 }}>{line.label}</td>
                    {asc.map((r) => {
                      const cur = r[line.key]
                      const prevRow = prevOf[r.month]
                      const prev = prevRow ? prevRow[line.key] : null
                      return (
                        <td key={r.month} style={{ ...baseTd, color: colorOf(cur), fontWeight: line.ebit ? 700 : baseTd.fontWeight }}>
                          <div>{fmtCell(line, cur)}</div>
                          {!line.pct && !line.int && prev != null && <MoM cur={cur} prev={prev} lowerBetter={line.neg} />}
                        </td>
                      )
                    })}
                    {showTotal && <td style={{ ...baseTd, fontWeight: 800, color: line.ebit ? colorOf(total) : 'var(--text)', background: 'rgba(41,151,255,0.05)' }}>{fmtCell(line, total)}</td>}
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

// Variazione mese-su-mese (% e €) per cella della matrice
function MoM({ cur, prev, lowerBetter = false }) {
  if (prev == null || cur == null || !Number.isFinite(prev) || prev === 0) return null
  const d = cur - prev
  const pct = (d / Math.abs(prev)) * 100
  const up = d > 0
  const good = lowerBetter ? !up : up
  const col = Math.abs(pct) < 0.05 ? 'var(--text3)' : good ? '#30d158' : '#ff375f'
  return <div style={{ fontSize: 9.5, fontWeight: 600, color: col, marginTop: 2, whiteSpace: 'nowrap' }}>{up ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}% · {up ? '+' : '−'}{eur(Math.abs(d))}</div>
}

function Field({ label, value, onChange, ph }) {
  return (
    <div>
      <label style={{ fontSize: 11, opacity: 0.6, display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value === 0 || value == null ? '' : value} type="number" placeholder={ph || '0'} onChange={e => onChange(e.target.value)} style={{ ...inp, width: '100%' }} />
    </div>
  )
}

const inp = { padding: '9px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, outline: 'none' }
const th = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11, opacity: 0.6, textAlign: 'right', whiteSpace: 'nowrap' }
const td = { padding: '9px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }
