'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import FxCard from './ui/FxCard'

const RISK = {
  le7:      { color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: '≤ 7 GG' },
  le30:     { color: '#f59e0b', bg: 'rgba(245,158,11,0.15)', label: '≤ 30 GG' },
  oos_sales:{ color: '#ef4444', bg: 'rgba(239,68,68,0.15)', label: 'OOS' },
  oos:      { color: 'var(--text2)', bg: 'rgba(255,255,255,0.06)', label: 'OOS' },
  ok:       { color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'OK' },
}

const SIZE_ORDER = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL', '2XL', '3XL', '4XL']
const sizeRank = (s) => { const i = SIZE_ORDER.indexOf(String(s || '').toUpperCase().trim()); return i === -1 ? 99 : i }
// Tono cella matrice in base al rischio della variante
const cellTone = (r) => {
  if (r.oos || r.risk === 'le7') return { bg: 'rgba(239,68,68,0.16)', color: '#fca5a5' }
  if (r.risk === 'le30') return { bg: 'rgba(245,158,11,0.16)', color: '#fcd34d' }
  return { bg: 'rgba(34,197,94,0.14)', color: '#86efac' }
}

// Cache di modulo: al cambio tab non rifà la fetch.
let __invCache = null

export default function InventoryTab() {
  const { t, intlLocale } = useI18n()
  const [data, setData] = useState(() => __invCache)
  const [loading, setLoading] = useState(!__invCache)
  const [error, setError] = useState('')
  const [view, setView] = useState('urgent') // urgent | product | catalog
  const [chip, setChip] = useState('all')    // all | le7 | le30 | oos_sales | low
  const [catChip, setCatChip] = useState('problems') // problems | instock | nocogs | all
  const [expanded, setExpanded] = useState(() => new Set())
  const [search, setSearch] = useState('')
  const toggleExpand = (id) => setExpanded(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  const load = async (refresh = false) => {
    if (!refresh && __invCache) { setData(__invCache); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/inventory${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      __invCache = j
      setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (__invCache) { setData(__invCache); setLoading(false) } else load() }, []) // eslint-disable-line

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

  // Raggruppa le varianti sotto il prodotto, con sintesi taglie/rischio.
  const productGroups = useMemo(() => {
    const m = new Map()
    for (const i of items) {
      if (!m.has(i.productId)) m.set(i.productId, { productId: i.productId, productTitle: i.productTitle, image: i.image, rows: [] })
      m.get(i.productId).rows.push(i)
    }
    const q = search.trim().toLowerCase()
    let arr = [...m.values()].map(p => {
      const rows = [...p.rows].sort((a, b) => sizeRank(a.size) - sizeRank(b.size) || (a.size || '').localeCompare(b.size || ''))
      const atRisk = rows.filter(r => r.risk === 'le7' || r.risk === 'le30').sort((a, b) => (a.daysToStockout ?? 1e9) - (b.daysToStockout ?? 1e9))
      const oosCount = rows.filter(r => r.stock <= 0).length
      const lowCount = rows.filter(r => r.stock >= 1 && r.stock <= 5).length
      const broken = rows.filter(r => r.brokenSize)
      return {
        ...p, rows,
        sizeTotal: rows.length,
        inStock: rows.filter(r => r.stock > 0).length,
        oosCount, lowCount, atRiskCount: atRisk.length, brokenCount: broken.length,
        totalStock: rows.reduce((s, r) => s + Math.max(r.stock, 0), 0),
        vendite: Math.round(rows.reduce((s, r) => s + r.velocity, 0) * 100) / 100,
        value: rows.reduce((s, r) => s + (r.value || 0), 0),
        hasCogs: rows.some(r => r.cost != null),
        critica: atRisk[0]?.size || null,
        worstDays: atRisk[0]?.daysToStockout ?? null,
        worstDate: atRisk[0]?.stockoutDate ?? null,
        oosState: oosCount === 0 ? null : oosCount === rows.length ? 'totale' : 'parziale',
        hasProblem: oosCount > 0 || atRisk.length > 0 || broken.length > 0,
      }
    })
    if (q) arr = arr.filter(p => p.productTitle.toLowerCase().includes(q) || p.rows.some(r => (r.sku || '').toLowerCase().includes(q)))
    return arr.sort((a, b) => (b.atRiskCount + b.oosCount + b.brokenCount) - (a.atRiskCount + a.oosCount + a.brokenCount) || (a.worstDays ?? 1e9) - (b.worstDays ?? 1e9))
  }, [items, search])

  // Per prodotto (matrice taglie): solo prodotti con ≥2 varianti (apparel/accessori)
  const matrixProducts = useMemo(() => productGroups.filter(p => p.rows.length >= 2), [productGroups])

  const catalogList = useMemo(() => {
    if (catChip === 'problems') return productGroups.filter(p => p.hasProblem)
    if (catChip === 'instock') return productGroups.filter(p => p.totalStock > 0)
    if (catChip === 'nocogs') return productGroups.filter(p => !p.hasCogs)
    return productGroups
  }, [productGroups, catChip])
  const catCounts = useMemo(() => ({
    problems: productGroups.filter(p => p.hasProblem).length,
    instock: productGroups.filter(p => p.totalStock > 0).length,
    nocogs: productGroups.filter(p => !p.hasCogs).length,
    all: productGroups.length,
  }), [productGroups])
  const allExpanded = catalogList.length > 0 && catalogList.every(p => expanded.has(p.productId))
  const expandToggleAll = () => setExpanded(allExpanded ? new Set() : new Set(catalogList.map(p => p.productId)))

  const k = data?.kpis

  // ── UI helpers ──
  const cardWrap = { background: 'var(--card,rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
  const cell = { padding: '12px 14px', fontSize: 13, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
  const th = { padding: '11px 14px', fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', color: 'var(--text2)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', backdropFilter: 'blur(12px)' }

  const Badge = ({ risk }) => {
    const r = RISK[risk] || RISK.ok
    return <span style={{ fontSize: 10, fontWeight: 800, color: r.color, background: r.bg, padding: '2px 7px', borderRadius: 6, whiteSpace: 'nowrap' }}>{r.label}</span>
  }
  const Thumb = ({ url }) => url
    ? <img src={url} alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--glass)' }} />
    : <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--glass)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={16} /></div>

  const kpiCard = (accent, label, value, sub) => (
    <div style={{ ...cardWrap, borderLeft: `3px solid ${accent}`, padding: '18px 20px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text2)' }}>{label}</div>
      <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)', margin: '6px 0 2px', letterSpacing: '-0.02em' }}>{value}</div>
      <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{sub}</div>
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 720 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em' }}>{t('inv.title', null, 'Inventario')}</h1>
          <p style={{ margin: '6px 0 0', color: 'var(--text2)', fontSize: 13, lineHeight: 1.5 }}>{t('inv.subtitle', null, 'Unità operativa = taglia/SKU. Un prodotto può avere stock alto e una sola taglia in esaurimento — guarda sempre la taglia critica. Quantità da Shopify; valore su COGS (cost per item).')}</p>
        </div>
        <button onClick={() => load(true)} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(123,91,255,0.12)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 10, padding: '9px 14px', fontSize: 12.5, fontWeight: 800, cursor: loading ? 'default' : 'pointer', opacity: loading ? 0.6 : 1 }}>
          <Icon name="refresh" size={14} /> {loading ? t('inv.loading', null, 'Aggiorno…') : t('inv.refresh', null, 'Aggiorna (live)')}
        </button>
      </div>

      {error && <div style={{ ...cardWrap, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>{error}</div>}

      {data && (
        <>
          {/* Info bar */}
          <div style={{ ...cardWrap, padding: '12px 18px', fontSize: 12, color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <span>{t('inv.updated', null, 'Aggiornato')}: <b style={{ color: 'var(--text)' }}>{new Date(data.updatedAt).toLocaleString(intlLocale)}</b></span>
            <span>{t('inv.catalog', null, 'Catalogo')}: <b style={{ color: 'var(--text)' }}>{fmtInt(k.productCount)}</b> {t('inv.products', null, 'prodotti')} · <b style={{ color: 'var(--text)' }}>{fmtInt(k.variantCount)}</b> {t('inv.variants', null, 'varianti')}</span>
            <span>{t('inv.window', null, 'Finestra vendite')}: <b style={{ color: 'var(--text)' }}>{data.periodDays}gg</b></span>
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
                  <div key={i.variantId} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, display: 'flex', gap: 11, background: 'var(--glass)' }}>
                    <Thumb url={i.image} />
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        <span style={{ fontWeight: 800, color: 'var(--text)', fontSize: 12.5 }}>{i.size}</span>
                        <Badge risk={i.risk} />
                        <span style={{ marginLeft: 'auto', fontSize: 11, color: 'var(--text2)' }}>{fmtInt(i.stock)} {t('inv.stock', null, 'stock')}</span>
                      </div>
                      <div style={{ fontSize: 12, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.productTitle}</div>
                      <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 11, color: 'var(--text2)' }}>
                        <span>{t('inv.perDay', null, 'Vendite/g')} <b style={{ color: 'var(--text)' }}>{i.velocity}</b></span>
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
                {[['urgent', t('inv.tabUrgent', null, 'Urgenze'), urgentAll.length], ['product', t('inv.tabProduct', null, 'Per prodotto'), matrixProducts.length], ['catalog', t('inv.tabCatalog', null, 'Catalogo'), productGroups.length]].map(([id, label, n]) => (
                  <button key={id} onClick={() => setView(id)} style={{ padding: '9px 14px', border: 'none', background: 'transparent', cursor: 'pointer', color: view === id ? 'var(--text)' : 'var(--text2)', fontSize: 13.5, fontWeight: view === id ? 900 : 700, borderBottom: view === id ? '2px solid var(--accent)' : '2px solid transparent' }}>{label} <span style={{ opacity: 0.6, fontWeight: 700 }}>({n})</span></button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px' }}>
                <Icon name="search" size={14} />
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('inv.searchPh', null, 'Cerca prodotto o SKU…')} style={{ background: 'transparent', border: 'none', outline: 'none', color: 'var(--text)', fontSize: 13, width: 200 }} />
              </div>
            </div>

            {/* Filtri (Urgenze) */}
            {view === 'urgent' && (
              <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                {[['all', t('inv.fAll', null, 'Tutte urgenti')], ['le7', '≤ 7 gg'], ['le30', '≤ 30 gg'], ['oos_sales', t('inv.fBroken', null, 'OOS con vendite')], ['low', t('inv.fLow', null, 'Low stock (1-5)')]].map(([id, label]) => (
                  <button key={id} onClick={() => setChip(id)} style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${chip === id ? 'var(--accent)' : 'var(--border)'}`, background: chip === id ? 'rgba(123,91,255,0.15)' : 'transparent', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label}</button>
                ))}
              </div>
            )}

            {/* Filtri (Catalogo) */}
            {view === 'catalog' && (
              <div style={{ padding: '12px 20px 0', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                {[['problems', t('inv.cWithProblems', null, 'Con problemi'), catCounts.problems], ['instock', t('inv.cWithStock', null, 'Con stock'), catCounts.instock], ['nocogs', t('inv.cNoCogs', null, 'Senza COGS'), catCounts.nocogs], ['all', t('inv.cAll', null, 'Tutti'), catCounts.all]].map(([id, label, n]) => (
                  <button key={id} onClick={() => setCatChip(id)} style={{ padding: '6px 12px', borderRadius: 999, border: `1px solid ${catChip === id ? 'var(--accent)' : 'var(--border)'}`, background: catChip === id ? 'rgba(123,91,255,0.15)' : 'transparent', color: 'var(--text)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{label} ({n})</button>
                ))}
                <button onClick={expandToggleAll} style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 12.5, fontWeight: 800, cursor: 'pointer' }}>{allExpanded ? t('inv.collapseAll', null, 'Comprimi tutti') : t('inv.expandAll', null, 'Espandi tutti')}</button>
              </div>
            )}

            {/* ── Urgenze: lista piatta per variante ── */}
            {view === 'urgent' && (
              <div style={{ padding: '14px 20px 20px', overflowX: 'auto', maxHeight: '70vh' }}>
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
                      <tr key={i.variantId} style={{ borderBottom: '1px solid var(--border)' }}>
                        <td style={{ padding: '12px 14px', maxWidth: 320 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Thumb url={i.image} /><span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.productTitle}</span></div></td>
                        <td style={{ padding: '12px 14px', whiteSpace: 'nowrap' }}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12.5 }}>{i.size}</span><Badge risk={i.risk} /></div><div style={{ fontSize: 10.5, color: 'var(--text2)' }}>{i.sku || '—'}</div></td>
                        <td style={{ ...cell, color: i.oos ? '#ef4444' : 'var(--text)', fontWeight: 800 }}>{fmtInt(i.stock)}</td>
                        <td style={cell}>{i.velocity || '—'}</td>
                        <td style={{ ...cell, color: i.risk === 'le7' ? '#ef4444' : i.risk === 'le30' ? '#f59e0b' : 'var(--text2)', fontWeight: 700 }}>{i.oos ? t('inv.oos', null, 'Esaurito') : i.daysToStockout != null ? `${i.daysToStockout} gg` : '∞'}</td>
                        <td style={cell}>{fmtDate(i.stockoutDate)}</td>
                        <td style={{ ...cell, color: 'var(--text)', fontWeight: 700 }}>{i.brokenSize ? <span style={{ color: '#fca5a5' }}>-{fmtMoney(i.lostRevPerDay * 7)}</span> : fmtMoney(i.value)}</td>
                      </tr>
                    ))}
                    {filtered.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('inv.empty', null, 'Nessun elemento.')}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Per prodotto: matrice taglie ── */}
            {view === 'product' && (
              <div style={{ padding: '12px 20px 20px', maxHeight: '70vh', overflowY: 'auto' }}>
                <p style={{ margin: '0 0 12px', color: 'var(--text2)', fontSize: 12.5 }}>{t('inv.matrixSub', null, 'Matrice taglie per prodotto — ideale per apparel e accessori.')}</p>
                {matrixProducts.map(p => {
                  const open = expanded.has(p.productId)
                  return (
                    <div key={p.productId} style={{ border: '1px solid var(--border)', borderRadius: 12, marginBottom: 8, overflow: 'hidden' }}>
                      <button onClick={() => toggleExpand(p.productId)} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
                        <span style={{ transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'var(--text2)', width: 12 }}>▸</span>
                        <Thumb url={p.image} />
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13.5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.productTitle}</div>
                          <div style={{ color: 'var(--text2)', fontSize: 11.5, marginTop: 2 }}>
                            {p.inStock}/{p.sizeTotal} {t('inv.sizesInStock', null, 'taglie in stock')}
                            {p.oosState && <> · <span style={{ color: '#ef4444' }}>OOS {p.oosState}</span></>}
                            {p.atRiskCount > 0 && <> · <span style={{ color: '#f59e0b' }}>{p.atRiskCount} {t('inv.atRisk', null, 'a rischio')}</span></>}
                            {p.critica && <> · {t('inv.criticalLabel', null, 'critica')}: <b style={{ color: 'var(--text)' }}>{p.critica}</b></>}
                          </div>
                        </div>
                        <span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap' }}>{fmtInt(p.totalStock)} {t('inv.pcs', null, 'pz')}</span>
                      </button>
                      {open && (
                        <div style={{ padding: '4px 14px 16px 38px', overflowX: 'auto', background: 'var(--glass)' }}>
                          <table style={{ borderCollapse: 'separate', borderSpacing: 6 }}>
                            <thead><tr>
                              <th></th>
                              {p.rows.map(r => <th key={r.variantId} style={{ fontSize: 11, fontWeight: 800, color: 'var(--text)', textAlign: 'center', padding: '2px 8px', whiteSpace: 'nowrap' }}>{r.size}</th>)}
                            </tr></thead>
                            <tbody>
                              <tr>
                                <td style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', paddingRight: 8 }}>{t('inv.stockRow', null, 'Stock')}</td>
                                {p.rows.map(r => { const tn = cellTone(r); return <td key={r.variantId} style={{ textAlign: 'center', minWidth: 50, background: tn.bg, color: tn.color, fontWeight: 800, fontSize: 13, borderRadius: 8, padding: '7px 6px' }}>{fmtInt(r.stock)}</td> })}
                              </tr>
                              <tr>
                                <td style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text2)', textTransform: 'uppercase', paddingRight: 8 }}>{t('inv.days', null, 'Giorni')}</td>
                                {p.rows.map(r => { const tn = cellTone(r); return <td key={r.variantId} style={{ textAlign: 'center', background: tn.bg, color: tn.color, fontWeight: 700, fontSize: 11.5, borderRadius: 8, padding: '7px 6px' }}>{r.oos ? 'OOS' : r.daysToStockout != null ? `${r.daysToStockout}g` : 'OK'}</td> })}
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )
                })}
                {matrixProducts.length === 0 && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>{t('inv.empty', null, 'Nessun elemento.')}</div>}
              </div>
            )}

            {/* ── Catalogo: prodotto espandibile → tabella SKU ── */}
            {view === 'catalog' && (
              <div style={{ padding: '12px 20px 20px', overflowX: 'auto', maxHeight: '70vh' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left' }}>{t('inv.colProduct', null, 'Prodotto')}</th>
                    <th style={th}>{t('inv.colStock', null, 'Stock')}</th>
                    <th style={th}>{t('inv.perDay', null, 'Vendite/g')}</th>
                    <th style={th}>{t('inv.colStockout', null, 'Stockout')}</th>
                    <th style={th}>OOS</th>
                    <th style={th}>{t('inv.colLow', null, 'Low')}</th>
                    <th style={th}>{t('inv.colValueCogs', null, 'Valore COGS')}</th>
                  </tr></thead>
                  <tbody>
                    {catalogList.map(p => {
                      const open = expanded.has(p.productId)
                      return (
                        <Fragment key={p.productId}>
                          <tr onClick={() => toggleExpand(p.productId)} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer' }}>
                            <td style={{ padding: '12px 14px' }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><span style={{ color: 'var(--text2)', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', width: 12, display: 'inline-block' }}>▸</span><Thumb url={p.image} /><span style={{ color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>{p.productTitle}</span></div></td>
                            <td style={{ ...cell, color: p.totalStock > 0 ? 'var(--text)' : '#ef4444', fontWeight: 800 }}>{fmtInt(p.totalStock)}</td>
                            <td style={cell}>{p.vendite || '—'}</td>
                            <td style={{ ...cell, color: p.worstDate ? (p.worstDays <= 7 ? '#ef4444' : '#f59e0b') : 'var(--text2)' }}>{p.worstDate ? fmtDate(p.worstDate) : t('inv.na', null, 'N/D')}</td>
                            <td style={{ ...cell, color: p.oosCount ? '#ef4444' : 'var(--text2)', fontWeight: 800 }}>{p.oosCount || '—'}</td>
                            <td style={{ ...cell, color: p.lowCount ? '#f59e0b' : 'var(--text2)', fontWeight: 800 }}>{p.lowCount || '—'}</td>
                            <td style={{ ...cell, color: 'var(--text)', fontWeight: 800 }}>{fmtMoney(p.value)}</td>
                          </tr>
                          {open && (
                            <tr><td colSpan={7} style={{ padding: 0, background: 'var(--glass)' }}>
                              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead><tr>
                                  <th style={{ ...th, textAlign: 'left', paddingLeft: 48, position: 'static' }}>{t('inv.colSku', null, 'SKU / Variante')}</th>
                                  <th style={{ ...th, position: 'static' }}>{t('inv.colQty', null, 'Qty')}</th>
                                  <th style={{ ...th, position: 'static' }}>{t('inv.colSold30', null, 'Vendite/g (30g)')}</th>
                                  <th style={{ ...th, position: 'static' }}>{t('inv.colStockoutEst', null, 'Stockout stim.')}</th>
                                  <th style={{ ...th, position: 'static' }}>{t('inv.colCogsUnit', null, 'COGS unit.')}</th>
                                  <th style={{ ...th, position: 'static' }}>{t('inv.colStockValue', null, 'Valore stock')}</th>
                                </tr></thead>
                                <tbody>
                                  {p.rows.map(r => (
                                    <tr key={r.variantId} style={{ borderBottom: '1px solid var(--border)' }}>
                                      <td style={{ padding: '10px 14px 10px 48px' }}><div style={{ color: 'var(--text)', fontWeight: 700, fontSize: 12 }}>{r.sku || '—'}</div><div style={{ color: 'var(--text2)', fontSize: 10.5 }}>{r.size}</div></td>
                                      <td style={{ ...cell, color: r.oos ? '#ef4444' : 'var(--text)', fontWeight: 800 }}>{fmtInt(r.stock)}</td>
                                      <td style={cell}>{r.velocity || 0}</td>
                                      <td style={{ ...cell, color: r.oos ? '#ef4444' : r.risk === 'le7' ? '#ef4444' : r.risk === 'le30' ? '#f59e0b' : 'var(--text2)' }}>{r.oos ? t('inv.oos', null, 'Esaurito') : r.stockoutDate ? fmtDate(r.stockoutDate) : t('inv.na', null, 'N/D')}</td>
                                      <td style={cell}>{r.cost != null ? fmtMoney(r.cost, 2) : '—'}</td>
                                      <td style={{ ...cell, color: 'var(--text)', fontWeight: 700 }}>{r.value ? fmtMoney(r.value) : '—'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </td></tr>
                          )}
                        </Fragment>
                      )
                    })}
                    {catalogList.length === 0 && <tr><td colSpan={7} style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('inv.empty', null, 'Nessun elemento.')}</td></tr>}
                  </tbody>
                </table>
              </div>
            )}
          </FxCard>
        </>
      )}

      {loading && !data && <div style={{ ...cardWrap, textAlign: 'center', color: 'var(--text2)' }}>{t('inv.loadingFull', null, 'Carico inventario da Shopify…')}</div>}
    </div>
  )
}
