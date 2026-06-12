'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'

const RISK = {
  le7:      { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '≤ 7 GG' },
  le30:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: '≤ 30 GG' },
  oos_sales:{ color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'OOS' },
  oos:      { color: 'rgba(255,255,255,0.78)', bg: 'rgba(255,255,255,0.06)', label: 'OOS' },
  ok:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'OK' },
}

export default function InventoryTab() {
  const { t, intlLocale } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [view, setView] = useState('urgent') // urgent | product | catalog
  const [chip, setChip] = useState('all')    // all | le7 | le30 | oos_sales | low
  const [search, setSearch] = useState('')

  const load = async (refresh = false) => {
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/inventory${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 0) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cur, maximumFractionDigits: d }).format(n))
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))
  const fmtDate = (iso) => iso ? new Date(iso + 'T00:00:00').toLocaleDateString(intlLocale, { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const items = data?.items || []

  // Taglie critiche: top per priorità commerciale (€ a rischio, non solo giorni)
  const critical = useMemo(() =>
    items.filter(i => i.priorityScore > 0).sort((a, b) => b.priorityScore - a.priorityScore).slice(0, 9)
  , [items])

  const urgentAll = useMemo(() =>
    items.filter(i => i.risk !== 'ok').sort((a, b) => (b.priorityScore - a.priorityScore) || ((a.daysToStockout ?? 1e9) - (b.daysToStockout ?? 1e9)))
  , [items])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    let list = view === 'catalog' ? items : urgentAll
    if (view === 'urgent') {
      if (chip === 'le7') list = list.filter(i => i.risk === 'le7')
      else if (chip === 'le30') list = list.filter(i => i.risk === 'le7' || i.risk === 'le30')
      else if (chip === 'oos_sales') list = list.filter(i => i.brokenSize)
      else if (chip === 'low') list = list.filter(i => i.stock >= 1 && i.stock <= 5)
    }
    if (q) list = list.filter(i => (i.productTitle || '').toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.size || '').toLowerCase().includes(q))
    return list
  }, [items, urgentAll, view, chip, search])

  // Vista "Per prodotto": raggruppa le varianti sotto il prodotto
  const byProduct = useMemo(() => {
    const m = new Map()
    for (const i of items) {
      if (!m.has(i.productId)) m.set(i.productId, { productId: i.productId, productTitle: i.productTitle, image: i.image, rows: [] })
      m.get(i.productId).rows.push(i)
    }
    const q = search.trim().toLowerCase()
    let arr = [...m.values()].map(p => {
      const crit = p.rows.filter(r => r.risk !== 'ok' && r.risk !== 'oos')
      const broken = p.rows.filter(r => r.brokenSize)
      const worst = p.rows.reduce((acc, r) => Math.min(acc, r.daysToStockout ?? 1e9), 1e9)
      return { ...p, totalStock: p.rows.reduce((s, r) => s + Math.max(r.stock, 0), 0), value: p.rows.reduce((s, r) => s + (r.value || 0), 0), critCount: crit.length, brokenCount: broken.length, worst }
    })
    if (q) arr = arr.filter(p => (p.productTitle || '').toLowerCase().includes(q))
    return arr.sort((a, b) => (b.critCount + b.brokenCount) - (a.critCount + a.brokenCount) || a.worst - b.worst)
  }, [items, search])

  const k = data?.kpis

  // ── UI helpers ──
  const cardWrap = { background: 'var(--card,rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
  const cell = { padding: '12px 14px', fontSize: 13, color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' }
  const th = { padding: '11px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'rgba(8,8,18,0.92)', backdropFilter: 'blur(12px)' }

  const Badge = ({ risk }) => {
    const r = RISK[risk] || RISK.ok
    return <span style={{ fontSize: 10, fontWeight: 800, color: r.color, background: r.bg, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{r.label}</span>
  }
  const Thumb = ({ url }) => url
    ? <img src={url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'rgba(255,255,255,0.04)' }} />
    : <div style={{ width: 38, height: 38, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={16} /></div>

  const kpiCard = (accent, label, value, sub) => (
    <div style={{ ...cardWrap, borderLeft: `3px solid ${accent}`, padding: '18px 20px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(255,255,255,0.78)' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: '#fff', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.78)' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{t('inv.title', null, 'Inventario')}</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 13, lineHeight: 1.5 }}>{t('inv.subtitle', null, 'Unità operativa = taglia/SKU. Un prodotto può avere stock alto e una sola taglia in esaurimento — guarda sempre la taglia critica. Quantità da Shopify; valore su COGS (cost per item).')}</p>
        </div>
        <button onClick={() => load(true)} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(123,91,255,0.12)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          <Icon name="refresh" size={14} /> {loading ? t('inv.loading', null, 'Aggiorno…') : t('inv.refresh', null, 'Aggiorna (live)')}
        </button>
      </div>

      {error && <div style={{ ...cardWrap, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>{error}</div>}

      {data && (
        <>
          {/* Info bar */}
          <div style={{ ...cardWrap, padding: '12px 18px', fontSize: 12, color: 'rgba(255,255,255,0.78)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>{t('inv.updated', null, 'Aggiornato')}: <b style={{ color: '#fff' }}>{new Date(data.updatedAt).toLocaleString(intlLocale)}</b></span>
            <span>{t('inv.catalog', null, 'Catalogo')}: <b style={{ color: '#fff' }}>{fmtInt(k.productCount)}</b> {t('inv.products', null, 'prodotti')} · <b style={{ color: '#fff' }}>{fmtInt(k.variantCount)}</b> {t('inv.variants', null, 'varianti')}</span>
            <span>{t('inv.window', null, 'Finestra vendite')}: <b style={{ color: '#fff' }}>{data.periodDays}gg</b></span>
            {k.costCoverage < 90 && <span style={{ color: '#f59e0b' }}>⚠ {t('inv.costCov', { n: k.costCoverage }, `Costo presente solo sul ${k.costCoverage}% delle varianti — il valore COGS è parziale`)}</span>}
          </div>

          {/* KPI */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: 14 }}>
            {kpiCard('#7b5bff', t('inv.kpiValue', null, 'Valore inventario (COGS)'), fmtMoney(k.inventoryValueCogs), `${t('inv.qtyOnHand', null, 'Qty on hand')}: ${fmtInt(k.qtyOnHand)}`)}
            {kpiCard('#ef4444', t('inv.kpiLe7', null, 'Taglie a rischio ≤ 7 GG'), fmtInt(k.countLe7), t('inv.kpiLe7Sub', null, 'SKU con stock e stockout critico'))}
            {kpiCard('#f59e0b', t('inv.kpiLe30', null, 'Taglie a rischio ≤ 30 GG'), fmtInt(k.countLe30), t('inv.kpiLe30Sub', null, 'In esaurimento nel periodo'))}
            {kpiCard('#ef4444', t('inv.kpiBroken', null, 'Broken sizes (OOS con vendite)'), fmtInt(k.brokenCount), `${t('inv.lostWeek', null, 'Vendite perse stimate')}: ${fmtMoney(k.lostRevenueWeek)}/${t('inv.week', null, 'sett')}`)}
          </div>

          {/* Taglie critiche */}
          {critical.length > 0 && (
            <FxCard title={t('inv.criticalTitle', null, 'Taglie critiche')} subtitle={t('inv.criticalSub', null, 'Ordinate per € a rischio (velocità × valore / urgenza), non solo per giorni.')}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(300px,1fr))', gap: 12 }}>
                {critical.map(i => (
                  <div key={i.variantId} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', gap: 11, background: 'rgba(255,255,255,0.015)' }}>
                    <Thumb url={i.image} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, color: '#fff', fontSize: 12.5 }}>{i.size}</span>
                        <Badge risk={i.risk} />
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'rgba(255,255,255,0.78)' }}>{fmtInt(i.stock)} {t('inv.stock', null, 'stock')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.productTitle}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'rgba(255,255,255,0.78)' }}>
                        <span>{t('inv.perDay', null, 'Vendite/g')} <b style={{ color: '#fff' }}>{i.velocity}</b></span>
                        {i.brokenSize
                          ? <span style={{ color: '#fca5a5' }}>{t('inv.lost', null, 'Persi')} <b>{fmtMoney(i.lostRevPerDay * 7)}/{t('inv.week', null, 'sett')}</b></span>
                          : <span>{t('inv.days', null, 'Giorni')} <b style={{ color: i.risk === 'le7' ? '#ef4444' : '#f59e0b' }}>{i.daysToStockout} gg</b></span>}
                        <span style={{ marginLeft: 'auto' }}>{fmtMoney(i.value)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </FxCard>
          )}

          {/* Tabs + lista */}
          <FxCard padding={0}>
            <div style={{ padding: '16px 20px 0', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 4 }}>
                {[['urgent', t('inv.tabUrgent', null, 'Urgenze'), urgentAll.length], ['product', t('inv.tabProduct', null, 'Per prodotto'), k.productCount], ['catalog', t('inv.tabCatalog', null, 'Catalogo'), k.variantCount]].map(([id, label, n]) => (
                  <button key={id} onClick={() => setView(id)} style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', color: view === id ? '#fff' : 'rgba(255,255,255,0.78)', fontSize: 13.5, fontWeight: view === id ? 900 : 700, borderBottom: view === id ? '2px solid var(--accent)' : '2px solid transparent' }}>{label} <span style={{ opacity: 0.6, fontWeight: 700 }}>({n})</span></button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px' }}>
                <Icon name="search" size={14} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('inv.searchPh', null, 'Cerca prodotto o SKU…')} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, width: 200 }} />
              </div>
            </div>

            {view === 'urgent' && (
              <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['all', t('inv.fAll', null, 'Tutte urgenti')], ['le7', '≤ 7 gg'], ['le30', '≤ 30 gg'], ['oos_sales', t('inv.fBroken', null, 'OOS con vendite')], ['low', t('inv.fLow', null, 'Low stock (1-5)')]].map(([id, label]) => (
                  <button key={id} onClick={() => setChip(id)} style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${chip === id ? 'var(--accent)' : 'var(--border)'}`, background: chip === id ? 'rgba(123,91,255,0.15)' : 'transparent', color: chip === id ? '#fff' : '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            )}

            <div style={{ padding: '14px 20px 20px', overflowX: 'auto', maxHeight: '70vh' }}>
              {view === 'product' ? (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left' }}>{t('inv.colProduct', null, 'Prodotto')}</th>
                    <th style={th}>{t('inv.colSizes', null, 'Taglie crit.')}</th>
                    <th style={th}>{t('inv.colBroken', null, 'OOS vend.')}</th>
                    <th style={th}>{t('inv.colWorst', null, 'Peggiore')}</th>
                    <th style={th}>{t('inv.colStock', null, 'Stock')}</th>
                    <th style={th}>{t('inv.colValue', null, 'Valore')}</th>
                  </tr></thead>
                  <tbody>
                    {byProduct.map(p => (
                      <tr key={p.productId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Thumb url={p.image} /><span style={{ color: '#fff', fontWeight: 700, fontSize: 13 }}>{p.productTitle}</span></div></td>
                        <td style={{ ...cell, color: p.critCount ? '#f59e0b' : 'rgba(255,255,255,0.78)', fontWeight: 800 }}>{p.critCount || '—'}</td>
                        <td style={{ ...cell, color: p.brokenCount ? '#ef4444' : 'rgba(255,255,255,0.78)', fontWeight: 800 }}>{p.brokenCount || '—'}</td>
                        <td style={cell}>{p.worst < 1e9 ? `${p.worst} gg` : '—'}</td>
                        <td style={cell}>{fmtInt(p.totalStock)}</td>
                        <td style={{ ...cell, color: '#fff', fontWeight: 800 }}>{fmtMoney(p.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left' }}>{t('inv.colProduct', null, 'Prodotto')}</th>
                    <th style={{ ...th, textAlign: 'left' }}>{t('inv.colSku', null, 'Taglia / SKU')}</th>
                    <th style={th}>{t('inv.colStock', null, 'Stock')}</th>
                    <th style={th}>{t('inv.perDay', null, 'Vendite/g')}</th>
                    <th style={th}>{t('inv.days', null, 'Giorni')}</th>
                    <th style={th}>{t('inv.colDate', null, 'Data')}</th>
                    <th style={th}>{t('inv.colValue', null, 'Valore')}</th>
                  </tr></thead>
                  <tbody>
                    {filtered.map(i => (
                      <tr key={i.variantId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: 320 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Thumb url={i.image} /><span style={{ color: '#fff', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.productTitle}</span></div></td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: '#fff', fontWeight: 700, fontSize: 12.5 }}>{i.size}</span><Badge risk={i.risk} /></div><div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.78)' }}>{i.sku || '—'}</div></td>
                        <td style={{ ...cell, color: i.oos ? '#ef4444' : '#fff', fontWeight: 800 }}>{fmtInt(i.stock)}</td>
                        <td style={cell}>{i.velocity || '—'}</td>
                        <td style={{ ...cell, color: i.risk === 'le7' ? '#ef4444' : i.risk === 'le30' ? '#f59e0b' : 'rgba(255,255,255,0.78)', fontWeight: 700 }}>{i.oos ? t('inv.oos', null, 'Esaurito') : i.daysToStockout != null ? `${i.daysToStockout} gg` : '∞'}</td>
                        <td style={cell}>{fmtDate(i.stockoutDate)}</td>
                        <td style={{ ...cell, color: '#fff', fontWeight: 700 }}>{i.brokenSize ? <span style={{ color: '#fca5a5' }}>-{fmtMoney(i.lostRevPerDay * 7)}</span> : fmtMoney(i.value)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'rgba(255,255,255,0.78)' }}>{t('inv.empty', null, 'Nessun elemento.')}</td></tr>}
                  </tbody>
                </table>
              )}
            </div>
          </FxCard>
        </>
      )}

      {loading && !data && <div style={{ ...cardWrap, textAlign: 'center', color: 'rgba(255,255,255,0.78)' }}>{t('inv.loadingFull', null, 'Carico inventario da Shopify…')}</div>}
    </div>
  )
}
