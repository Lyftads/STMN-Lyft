'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { PlatformBadges } from './PlatformIcon'

const isoDay = (d) => d.toISOString().slice(0, 10)

// Cache di modulo: sopravvive al cambio tab → riaprendo la tab non rifà la fetch.
let __gpCache = null // { key, payload }

export default function GoogleProductsTab() {
  const { t, intlLocale } = useI18n()
  const [since, setSince] = useState(isoDay(new Date(Date.now() - 7 * 86400000)))
  const [until, setUntil] = useState(isoDay(new Date()))
  const [data, setData] = useState(() => (__gpCache?.payload || null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('cost')

  const keyOf = (s, u) => `${s}:${u}`

  const load = async (s = since, u = until, refresh = false) => {
    const key = keyOf(s, u)
    if (!refresh && __gpCache?.key === key) { setData(__gpCache.payload); return } // cache client
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/google-products?since=${s}&until=${u}${refresh ? '&refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      __gpCache = { key, payload: j }
      setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  // Carica solo se non già in cache di modulo (per la coppia di date corrente)
  useEffect(() => { if (__gpCache?.key === keyOf(since, until)) setData(__gpCache.payload); else load() }, []) // eslint-disable-line

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 2) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cur, maximumFractionDigits: d }).format(n))
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))
  const fmtPct = (n) => (n == null ? '—' : `${n}%`)
  const fmtNum = (n, d = 2) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { maximumFractionDigits: d }).format(n))

  const rows = useMemo(() => {
    const arr = [...(data?.rows || [])]
    const k = sortBy
    return arr.sort((a, b) => (b[k] ?? -1) - (a[k] ?? -1))
  }, [data, sortBy])
  const k = data?.totals

  const cardWrap = { background: 'var(--card,rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
  const cell = { padding: '11px 12px', fontSize: 12.5, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
  const th = { padding: '10px 12px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right', color: 'var(--text2)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', cursor: 'pointer' }
  const inputStyle = { background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', color: 'var(--text)', fontSize: 13, colorScheme: 'dark' }
  const Thumb = ({ url }) => url
    ? <img src={url} alt="" style={{ width: 34, height: 34, borderRadius: 7, objectFit: 'cover', flexShrink: 0, background: 'var(--glass)' }} />
    : <div style={{ width: 34, height: 34, borderRadius: 7, background: 'var(--glass)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={14} /></div>
  const Hd = ({ id, label }) => <th style={{ ...th, color: sortBy === id ? 'var(--accent)' : 'var(--text2)' }} onClick={() => setSortBy(id)}>{label}</th>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{t('gp.title', null, 'Prodotti Google')}</h1>
        <PlatformBadges sources={['google']} size={24} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          LIVE
        </span>
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{t('gp.from', null, 'Da')}<input type="date" value={since} onChange={e => setSince(e.target.value)} style={inputStyle} /></label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11, color: 'var(--text2)', fontWeight: 700 }}>{t('gp.to', null, 'A')}<input type="date" value={until} onChange={e => setUntil(e.target.value)} style={inputStyle} /></label>
        <button onClick={() => load(since, until, true)} disabled={loading} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', borderRadius: 9, padding: '9px 18px', color: '#fff', fontSize: 13, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>{loading ? t('gp.loading', null, 'Carico…') : t('gp.update', null, 'Aggiorna')}</button>
        {data?.cached && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('gp.cached', null, 'da cache')}</span>}
      </div>

      {error && <div style={{ ...cardWrap, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {[[t('gp.totProducts', null, 'Prodotti'), fmtInt(k.products)], [t('gp.totCost', null, 'Costo'), fmtMoney(k.cost)], [t('gp.totConv', null, 'Conversioni'), fmtNum(k.conversions)], [t('gp.totValue', null, 'Valore conv.'), fmtMoney(k.convValue)], ['ROAS', k.roas != null ? `${k.roas}×` : '—']].map(([lab, val]) => (
              <div key={lab} style={{ ...cardWrap, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }}>{lab}</div>
                <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          <div style={{ ...cardWrap, padding: 0, overflowX: 'auto', overflowY: 'auto', maxHeight: '70vh' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead><tr>
                <th style={{ ...th, textAlign: 'left', cursor: 'default' }}>{t('gp.colProduct', null, 'Prodotto')}</th>
                <th style={{ ...th, textAlign: 'left', cursor: 'default' }}>{t('gp.colItem', null, 'ID articolo')}</th>
                <Hd id="clicks" label={t('gp.colClicks', null, 'Clic')} />
                <Hd id="impressions" label={t('gp.colImpr', null, 'Impr.')} />
                <Hd id="ctr" label="CTR" />
                <Hd id="cpc" label={t('gp.colCpc', null, 'CPC medio')} />
                <Hd id="cost" label={t('gp.colCost', null, 'Costo')} />
                <Hd id="conversions" label={t('gp.colConv', null, 'Conv.')} />
                <Hd id="costPerConv" label={t('gp.colCostConv', null, 'Costo/conv.')} />
                <Hd id="convValue" label={t('gp.colValue', null, 'Valore conv.')} />
                <Hd id="roas" label="ROAS" />
              </tr></thead>
              <tbody>
                {rows.map(r => (
                  <tr key={r.itemId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td style={{ padding: '10px 12px', maxWidth: 280 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Thumb url={r.image} /><span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 12.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span></div></td>
                    <td style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text3)', whiteSpace: 'nowrap' }}>{r.itemId}</td>
                    <td style={cell}>{fmtInt(r.clicks)}</td>
                    <td style={cell}>{fmtInt(r.impressions)}</td>
                    <td style={cell}>{fmtPct(r.ctr)}</td>
                    <td style={cell}>{fmtMoney(r.cpc)}</td>
                    <td style={{ ...cell, color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(r.cost)}</td>
                    <td style={cell}>{fmtNum(r.conversions)}</td>
                    <td style={cell}>{r.costPerConv != null ? fmtMoney(r.costPerConv) : '—'}</td>
                    <td style={cell}>{fmtMoney(r.convValue)}</td>
                    <td style={{ ...cell, color: r.roas == null ? 'var(--text3)' : r.roas >= 2 ? '#34d399' : r.roas >= 1 ? '#fcd34d' : '#ef4444', fontWeight: 800 }}>{r.roas != null ? `${r.roas}×` : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={11} style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>{t('gp.empty', null, 'Nessun dato prodotto nel periodo (servono campagne Shopping / Performance Max).')}</td></tr>}
              </tbody>
            </table>
          </div>
        </>
      )}

      {loading && !data && <div style={{ ...cardWrap, textAlign: 'center', color: 'var(--text2)' }}>{t('gp.loadingFull', null, 'Carico i dati prodotto da Google Ads…')}</div>}
    </div>
  )
}
