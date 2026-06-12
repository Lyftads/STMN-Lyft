'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

const isoDay = (d) => d.toISOString().slice(0, 10)

export default function ProductPerformanceTab() {
  const { t, intlLocale } = useI18n()
  const [since, setSince] = useState(isoDay(new Date(Date.now() - 90 * 86400000)))
  const [until, setUntil] = useState(isoDay(new Date()))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('margin') // margin | net | units

  const load = async (s = since, u = until, refresh = false) => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/product-performance?since=${s}&until=${u}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 0) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cur, maximumFractionDigits: d }).format(n))
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))

  const products = useMemo(() => {
    const arr = [...(data?.products || [])]
    const key = sortBy === 'net' ? 'netRevenue' : sortBy === 'units' ? 'units' : 'marginOp'
    return arr.sort((a, b) => b[key] - a[key])
  }, [data, sortBy])

  const k = data?.totals
  const cardWrap = { background: 'var(--card,rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
  const cell = { padding: '12px 14px', fontSize: 13, color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' }
  const th = { padding: '11px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'rgba(8,8,18,0.92)', backdropFilter: 'blur(12px)' }
  const Thumb = ({ url }) => url
    ? <img src={url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} />
    : <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={16} /></div>

  const inputStyle = { background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', color: '#fff', fontSize: 13, colorScheme: 'dark' }
  const sortBtn = (id, label) => (
    <button key={id} onClick={() => setSortBy(id)} style={{ padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: sortBy === id ? '#fff' : 'rgba(255,255,255,0.7)', fontSize: 12.5, fontWeight: sortBy === id ? 900 : 700, borderBottom: sortBy === id ? '2px solid var(--accent)' : '2px solid transparent' }}>{label}</button>
  )
  const kpi = (label, value, sub) => (
    <div style={{ ...cardWrap, padding: '16px 18px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.78)' }}>{label}</div>
      <div style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: '5px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.7)' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{t('pp.title', null, 'Performance prodotti')}</h1>
        <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>
          {t('pp.subtitle', null, 'P&L per prodotto (B2C) · ricavo netto, COGS, ADS allocati in proporzione al ricavo, margine operativo e ROAS.')}
          {data && <> · {data.range.since} → {data.range.until}</>}
        </p>
      </div>

      {/* Controlli */}
      <div style={{ ...cardWrap, display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 700 }}>{t('pp.from', null, 'Da')}<input type="date" value={since} onChange={e => setSince(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'rgba(255,255,255,0.78)', fontWeight: 700 }}>{t('pp.to', null, 'A')}<input type="date" value={until} onChange={e => setUntil(e.target.value)} style={inputStyle} /></label>
        <button onClick={() => load(since, until, true)} disabled={loading} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', borderRadius: 9, padding: '9px 18px', color: '#fff', fontSize: 13, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? t('pp.loading', null, 'Carico…') : t('pp.update', null, 'Aggiorna')}</button>
        <button onClick={() => { const s = isoDay(new Date(Date.now() - 90 * 86400000)), u = isoDay(new Date()); setSince(s); setUntil(u); load(s, u, true) }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('pp.reset', null, 'Reset')}</button>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.7)', fontWeight: 700, marginRight: 4 }}>{t('pp.sortBy', null, 'Ordina per')}</span>
          {sortBtn('margin', t('pp.sortMargin', null, 'Margine'))}
          {sortBtn('net', t('pp.sortNet', null, 'Netto'))}
          {sortBtn('units', t('pp.sortUnits', null, 'Unità'))}
        </div>
      </div>

      {error && <div style={{ ...cardWrap, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>{error}</div>}

      {data && (
        <>
          {/* Totali */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            {kpi(t('pp.totNet', null, 'Ricavo netto'), fmtMoney(k.netRevenue), `${fmtInt(k.units)} ${t('pp.unitsLabel', null, 'unità')}`)}
            {kpi(t('pp.totMargin', null, 'Margine operativo'), fmtMoney(k.marginOp), k.netRevenue > 0 ? `${Math.round((k.marginOp / k.netRevenue) * 100)}%` : '—')}
            {kpi(t('pp.totAds', null, 'Spesa ADS'), fmtMoney(k.ads), `Meta ${fmtMoney(k.metaSpend)} · Google ${fmtMoney(k.googleSpend)}`)}
            {kpi('ROAS', k.roas != null ? `${k.roas}×` : '—', t('pp.blended', null, 'blended B2C'))}
          </div>

          <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.6)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>ℹ {t('pp.allocNote', null, 'ADS allocati per prodotto in proporzione al ricavo (stima): il ROAS per prodotto è indicativo.')}</span>
            {k.costCoverage < 90 && <span style={{ color: '#f59e0b' }}>⚠ {t('pp.costCovNote', { n: k.costCoverage }, `COGS presente sul ${k.costCoverage}% dei prodotti venduti — il margine è parziale dove manca il costo`)}</span>}
          </div>

          {/* Tabella */}
          <div style={{ ...cardWrap, padding: 0, overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 980 }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left' }}>{t('pp.colProduct', null, 'Prodotto')}</th>
                <th style={th}>{t('pp.colUnits', null, 'Unità')}</th>
                <th style={th}>{t('pp.colNet', null, 'Netto')}</th>
                <th style={th}>{t('pp.colCogs', null, 'COGS')}</th>
                <th style={th}>{t('pp.colAds', null, 'ADS')}</th>
                <th style={th}>{t('pp.colMargin', null, 'Margine op.')}</th>
                <th style={th}>%</th>
                <th style={th}>ROAS</th>
                <th style={th}>{t('pp.colDelta', null, 'Δ Netto')}</th>
              </tr></thead>
              <tbody>
                {products.map(p => (
                  <tr key={p.productId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '12px 14px', maxWidth: 360 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Thumb url={p.image} /><span style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span></div></td>
                    <td style={cell}>{fmtInt(p.units)}</td>
                    <td style={{ ...cell, fontWeight: 800 }}>{fmtMoney(p.netRevenue)}</td>
                    <td style={{ ...cell, color: p.hasCost ? '#fff' : 'rgba(255,255,255,0.4)' }}>{p.hasCost ? fmtMoney(p.cogs) : '—'}</td>
                    <td style={cell}>{fmtMoney(p.ads)}</td>
                    <td style={{ ...cell, color: p.marginOp >= 0 ? '#34d399' : '#ef4444', fontWeight: 900 }}>{fmtMoney(p.marginOp)}</td>
                    <td style={{ ...cell, color: p.marginPct >= 40 ? '#34d399' : p.marginPct >= 0 ? '#fcd34d' : '#ef4444', fontWeight: 700 }}>{p.marginPct}%</td>
                    <td style={cell}>{p.roas != null ? `${p.roas}×` : '—'}</td>
                    <td style={{ ...cell, color: p.deltaNet == null ? 'rgba(255,255,255,0.4)' : p.deltaNet >= 0 ? '#34d399' : '#ef4444', fontWeight: 700 }}>{p.deltaNet == null ? '—' : `${p.deltaNet >= 0 ? '↑ +' : '↓ '}${p.deltaNet}%`}</td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={9} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{t('pp.empty', null, 'Nessuna vendita nel periodo.')}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && !data && <div style={{ ...cardWrap, textAlign: 'center', color: 'rgba(255,255,255,0.78)' }}>{t('pp.loadingFull', null, 'Calcolo performance prodotti…')}</div>}
    </div>
  )
}
