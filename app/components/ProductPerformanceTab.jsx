'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
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

  // ── Mappatura campagne → prodotto ──
  const [mapOpen, setMapOpen] = useState(false)
  const [mapData, setMapData] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapSel, setMapSel] = useState({}) // `${platform}:${campaign_id}` -> product_id | ''
  const [mapSaving, setMapSaving] = useState(false)
  const [mapErr, setMapErr] = useState('')

  // mapSel[key] = array di product id selezionati per la campagna
  const addProduct = (key, id) => setMapSel(s => ({ ...s, [key]: (s[key] || []).includes(id) ? s[key] : [...(s[key] || []), id] }))
  const removeProduct = (key, id) => setMapSel(s => ({ ...s, [key]: (s[key] || []).filter(x => x !== id) }))
  const setAllProducts = (key, ids) => setMapSel(s => ({ ...s, [key]: ids }))

  const openMap = async () => {
    setMapOpen(true); setMapLoading(true); setMapErr('')
    try {
      const r = await fetch(`/api/campaign-map?since=${since}&until=${until}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      const sel = {}
      for (const c of j.campaigns) {
        const key = `${c.platform}:${c.campaign_id}`
        sel[key] = c.selected?.length ? c.selected.map(p => p.id) : (c.suggestedProductId ? [c.suggestedProductId] : [])
      }
      setMapData(j); setMapSel(sel)
    } catch (e) { setMapErr(e.message) } finally { setMapLoading(false) }
  }
  const saveMap = async () => {
    if (!mapData) return
    setMapSaving(true); setMapErr('')
    try {
      const prodTitle = new Map(mapData.products.map(p => [p.id, p.title]))
      const mappings = mapData.campaigns.map(c => {
        const key = `${c.platform}:${c.campaign_id}`
        const ids = mapSel[key] || []
        return { platform: c.platform, campaign_id: c.campaign_id, campaign_name: c.campaign_name, products: ids.map(id => ({ id, title: prodTitle.get(id) || '' })) }
      })
      const r = await fetch('/api/campaign-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore salvataggio')
      setMapOpen(false)
      load(since, until, true) // ricalcola la performance con l'attribuzione precisa
    } catch (e) { setMapErr(e.message) } finally { setMapSaving(false) }
  }

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
  const mapProdTitle = new Map((mapData?.products || []).map(p => [p.id, p.title]))
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
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 760 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{t('pp.title', null, 'Performance prodotti')}</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>
            {t('pp.subtitle', null, 'P&L per prodotto (B2C) · ricavo netto, COGS, ADS allocati in proporzione al ricavo, margine operativo e ROAS.')}
            {data && <> · {data.range.since} → {data.range.until}</>}
          </p>
        </div>
        <button onClick={openMap} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(123,91,255,0.12)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Icon name="link" size={14} /> {t('pp.mapBtn', null, 'Mappa campagne ADS')}
        </button>
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
            {k.adsMappedPct >= 100
              ? <span style={{ color: '#34d399' }}>✓ {t('pp.allMapped', null, 'ADS attribuiti per campagna (dato preciso) su tutta la spesa.')}</span>
              : <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#34d399', marginRight: 5 }} />{t('pp.mappedNote', { n: k.adsMappedPct }, `${k.adsMappedPct}% della spesa ADS è mappata per campagna (preciso); il resto è ripartito in proporzione al ricavo. Mappa le campagne per il dato esatto.`)}</span>}
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
                    <td style={cell} title={p.adsExact ? t('pp.adsExact', null, 'Attribuito per campagna (preciso)') : t('pp.adsEstimate', null, 'Stima proporzionale')}>{p.adsExact && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#34d399', marginRight: 5, verticalAlign: 'middle' }} />}{fmtMoney(p.ads)}</td>
                    <td style={{ ...cell, color: p.marginOp >= 0 ? '#34d399' : '#ef4444', fontWeight: 900 }}>{fmtMoney(p.marginOp)}</td>
                    <td style={{ ...cell, color: p.marginPct >= 40 ? '#34d399' : p.marginPct >= 0 ? '#fcd34d' : '#ef4444', fontWeight: 700 }}>{p.marginPct}%</td>
                    <td style={{ ...cell, color: p.adsExact ? '#fff' : 'rgba(255,255,255,0.45)' }} title={p.adsExact ? undefined : t('pp.roasEstimate', null, 'ROAS stimato = ROAS blended, uguale per tutti finché non mappi la campagna su questo prodotto')}>{p.roas != null ? `${p.adsExact ? '' : '~'}${p.roas}×` : '—'}</td>
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

      {mapOpen && typeof document !== 'undefined' && createPortal(
        <div onClick={() => setMapOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#0d0d16', border: '1px solid var(--border)', borderRadius: 16, width: 'min(900px,100%)', maxHeight: '86vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ padding: '18px 22px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ color: '#fff', fontWeight: 900, fontSize: 16 }}>{t('pp.mapTitle', null, 'Mappatura campagne → prodotto')}</div>
                <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, marginTop: 2 }}>{t('pp.mapSub', null, 'Associa ogni campagna al prodotto che promuove: la sua spesa andrà su quel prodotto (dato preciso). Le non mappate restano in proporzionale.')}</div>
              </div>
              <button onClick={() => setMapOpen(false)} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer' }}><Icon name="close" size={18} /></button>
            </div>
            <div style={{ overflowY: 'auto', padding: '8px 0' }}>
              {mapLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{t('pp.mapLoading', null, 'Carico campagne…')}</div>
              : !mapData?.campaigns?.length ? <div style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{t('pp.mapEmpty', null, 'Nessuna campagna con spesa nel periodo.')}</div>
              : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left', position: 'static' }}>{t('pp.mapCampaign', null, 'Campagna')}</th>
                    <th style={{ ...th, position: 'static' }}>{t('pp.mapSpend', null, 'Spesa')}</th>
                    <th style={{ ...th, textAlign: 'left', position: 'static' }}>{t('pp.mapProduct', null, 'Prodotto')}</th>
                  </tr></thead>
                  <tbody>
                    {mapData.campaigns.map(c => {
                      const key = `${c.platform}:${c.campaign_id}`
                      const sel = mapSel[key] || []
                      const isSuggest = !c.mapped && c.suggestedProductId && sel.length === 1 && sel[0] === c.suggestedProductId
                      const allIds = mapData.products.map(p => p.id)
                      return (
                        <tr key={key} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td style={{ padding: '10px 14px', maxWidth: 280, verticalAlign: 'top' }}>
                            <div style={{ color: '#fff', fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name}</div>
                            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.platform}</div>
                          </td>
                          <td style={{ ...cell, padding: '10px 14px', verticalAlign: 'top' }}>{fmtMoney(c.spend)}</td>
                          <td style={{ padding: '10px 14px', minWidth: 360 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              {sel.map(id => (
                                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(123,91,255,0.18)', border: '1px solid var(--accent)', color: '#fff', borderRadius: 999, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, maxWidth: 200 }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mapProdTitle.get(id) || id}</span>
                                  <span onClick={() => removeProduct(key, id)} style={{ cursor: 'pointer', opacity: 0.8, fontWeight: 800 }}>×</span>
                                </span>
                              ))}
                              <select value="" onChange={e => { if (e.target.value) addProduct(key, e.target.value) }} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 8px', color: '#fff', fontSize: 12, colorScheme: 'dark', maxWidth: 220 }}>
                                <option value="">{t('pp.mapAdd', null, '+ Aggiungi prodotto')}</option>
                                {mapData.products.filter(p => !sel.includes(p.id)).map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                              </select>
                            </div>
                            <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'center' }}>
                              <button onClick={() => setAllProducts(key, allIds)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{t('pp.mapAllCatalog', null, 'Tutto il catalogo')}</button>
                              {sel.length > 0 && <button onClick={() => setAllProducts(key, [])} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.55)', fontSize: 11, fontWeight: 700, cursor: 'pointer', padding: 0 }}>{t('pp.mapClear', null, 'Svuota')}</button>}
                              {isSuggest && <span style={{ fontSize: 10, color: '#86efac', fontWeight: 700 }}>{t('pp.mapSuggested', null, 'suggerito')} {c.suggestedScore ? `${c.suggestedScore}%` : ''}</span>}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>
            <div style={{ padding: '14px 22px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 12 }}>
              {mapErr && <span style={{ color: '#fca5a5', fontSize: 12 }}>{mapErr}</span>}
              <div style={{ flex: 1 }} />
              <button onClick={() => setMapOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 16px', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{t('pp.mapCancel', null, 'Annulla')}</button>
              <button onClick={saveMap} disabled={mapSaving || mapLoading} style={{ background: 'linear-gradient(135deg,#8b5cf6,#6d28d9)', border: 'none', borderRadius: 9, padding: '9px 18px', color: '#fff', fontSize: 13, fontWeight: 800, cursor: mapSaving ? 'default' : 'pointer', opacity: mapSaving ? 0.6 : 1 }}>{mapSaving ? t('pp.mapSaving', null, 'Salvo…') : t('pp.mapSave', null, 'Salva mappatura')}</button>
            </div>
          </div>
        </div>, document.body)}
    </div>
  )
}
