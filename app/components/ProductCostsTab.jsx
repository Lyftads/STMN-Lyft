'use client'

import { Fragment, useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

export default function ProductCostsTab() {
  const { t, intlLocale } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drafts, setDrafts] = useState({})       // variant_id -> string
  const [selected, setSelected] = useState(() => new Set())
  const [pct, setPct] = useState('0')
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const [expanded, setExpanded] = useState(() => new Set())  // variant_id con storico aperto
  const [histCache, setHistCache] = useState({})             // variant_id -> history[]

  const load = async () => {
    setLoading(true); setError('')
    try {
      const r = await fetch('/api/product-costs-landed', { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      setData(j)
      const d = {}
      for (const p of j.products) for (const v of p.variants) if (v.landed != null) d[v.variant_id] = String(v.landed)
      setDrafts(d)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { load() }, [])

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 2) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cur, maximumFractionDigits: d }).format(n))
  const fmtDate = (s) => s ? new Date(s + (s.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric' }) : '—'
  const fmtDateTime = (s) => s ? new Date(s).toLocaleString(intlLocale, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'

  // indice variante → {product, v} per lookup veloce
  const vIndex = useMemo(() => {
    const m = new Map()
    for (const p of (data?.products || [])) for (const v of p.variants) m.set(v.variant_id, { p, v })
    return m
  }, [data])

  const products = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return data?.products || []
    return (data?.products || []).filter(p => p.title.toLowerCase().includes(q) || p.variants.some(v => (v.sku || '').toLowerCase().includes(q)))
  }, [data, search])

  const isChanged = (vid) => {
    const ref = vIndex.get(vid); if (!ref) return false
    const d = drafts[vid]
    if (d == null || d === '') return false
    const n = parseFloat(d); if (!Number.isFinite(n)) return false
    return ref.v.landed == null || Math.abs(n - ref.v.landed) > 0.0001
  }
  const changedIds = useMemo(() => Object.keys(drafts).filter(isChanged), [drafts, vIndex])

  const setDraft = (vid, val) => setDrafts(s => ({ ...s, [vid]: val }))
  const toggleSel = (vid) => setSelected(s => { const n = new Set(s); n.has(vid) ? n.delete(vid) : n.add(vid); return n })

  const applyPct = () => {
    const p = parseFloat(pct); if (!Number.isFinite(p)) return
    setDrafts(s => {
      const next = { ...s }
      for (const vid of selected) {
        const ref = vIndex.get(vid); if (!ref) continue
        const base = parseFloat(next[vid] ?? '') || ref.v.shopifyCost || 0
        next[vid] = String(Math.round(base * (1 + p / 100) * 100) / 100)
      }
      return next
    })
  }

  const saveRows = async (ids) => {
    const entries = ids.map(vid => { const ref = vIndex.get(vid); return { variant_id: vid, product_id: ref?.p.productId, sku: ref?.v.sku, landed_cost: parseFloat(drafts[vid]) } }).filter(e => Number.isFinite(e.landed_cost))
    if (!entries.length) return
    setSaving(true); setError('')
    try {
      const r = await fetch('/api/product-costs-landed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ entries }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore salvataggio')
      // aggiorna lo stato locale: landed corrente + storico +1
      setData(d => ({ ...d, products: d.products.map(p => ({ ...p, variants: p.variants.map(v => entries.find(e => e.variant_id === v.variant_id) ? { ...v, landed: parseFloat(drafts[v.variant_id]), historyCount: (v.historyCount || 0) + 1 } : v) })) }))
      // storico cambiato → invalida cache e ricarica quelli aperti
      const savedIds = entries.map(e => e.variant_id)
      setHistCache(c => { const n = { ...c }; for (const id of savedIds) delete n[id]; return n })
      for (const id of savedIds) if (expanded.has(id)) loadHist(id)
      setToast(t('pc.saved', { n: j.saved }, `${j.saved} costi salvati`)); setTimeout(() => setToast(''), 2500)
    } catch (e) { setError(e.message) } finally { setSaving(false) }
  }

  const loadHist = async (vid) => {
    try {
      const r = await fetch(`/api/product-costs-landed?variant_id=${encodeURIComponent(vid)}`, { cache: 'no-store' })
      const j = await r.json(); setHistCache(c => ({ ...c, [vid]: j.history || [] }))
    } catch { setHistCache(c => ({ ...c, [vid]: [] })) }
  }
  const toggleHistory = (vid) => {
    setExpanded(s => { const n = new Set(s); n.has(vid) ? n.delete(vid) : n.add(vid); return n })
    if (!histCache[vid]) loadHist(vid)
  }

  const cardWrap = { background: 'var(--card,rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
  const th = { padding: '9px 14px', fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', color: 'rgba(255,255,255,0.78)', whiteSpace: 'nowrap' }
  const cell = { padding: '10px 14px', fontSize: 13, color: '#fff', textAlign: 'right', whiteSpace: 'nowrap' }
  const Thumb = ({ url }) => url
    ? <img src={url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flexShrink: 0 }} />
    : <div style={{ width: 36, height: 36, borderRadius: 8, background: 'rgba(255,255,255,0.04)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={15} /></div>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 760 }}>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em' }}>{t('pc.title', null, 'Costi prodotto (landed)')}</h1>
          <p style={{ margin: '6px 0 0', color: 'rgba(255,255,255,0.78)', fontSize: 13 }}>{t('pc.subtitle', null, 'Override del costo unitario reale per variante (incl. spedizione/dazi). Lo storico registra ogni cambio con data di validità ed è usato come COGS in Inventario e Performance prodotti.')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 10, padding: '7px 11px' }}>
            <Icon name="search" size={14} /><input value={search} onChange={e => setSearch(e.target.value)} placeholder={t('pc.search', null, 'Cerca prodotto o SKU…')} style={{ background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, width: 170 }} />
          </div>
          <button onClick={() => saveRows(changedIds)} disabled={saving || !changedIds.length} style={{ background: changedIds.length ? 'linear-gradient(135deg,#8b5cf6,#6d28d9)' : 'rgba(255,255,255,0.06)', border: 'none', borderRadius: 10, padding: '9px 16px', color: '#fff', fontSize: 13, fontWeight: 800, cursor: changedIds.length && !saving ? 'pointer' : 'default', opacity: changedIds.length ? 1 : 0.6 }}>{saving ? t('pc.saving', null, 'Salvo…') : t('pc.saveAll', { n: changedIds.length }, `Salva modifiche (${changedIds.length})`)}</button>
        </div>
      </div>

      {toast && <div style={{ ...cardWrap, padding: '10px 16px', borderColor: 'rgba(52,211,153,0.4)', color: '#86efac', fontSize: 13 }}>✓ {toast}</div>}
      {error && <div style={{ ...cardWrap, padding: '10px 16px', borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {/* Bulk % */}
      <div style={{ ...cardWrap, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'rgba(255,255,255,0.78)' }}>{t('pc.bulkLabel', null, 'Variazione % su selezionate')}</span>
        <input value={pct} onChange={e => setPct(e.target.value)} type="number" style={{ width: 90, background: 'rgba(255,255,255,0.05)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 9px', color: '#fff', fontSize: 13, colorScheme: 'dark' }} />
        <button onClick={applyPct} disabled={!selected.size} style={{ background: selected.size ? 'rgba(123,91,255,0.15)' : 'rgba(255,255,255,0.05)', border: '1px solid var(--accent)', borderRadius: 9, padding: '8px 14px', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: selected.size ? 'pointer' : 'default', opacity: selected.size ? 1 : 0.5 }}>{t('pc.applyPct', null, 'Applica a selezionate')}</button>
        <span style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.55)' }}>{t('pc.bulkHint', { n: selected.size }, `${selected.size} selezionate · moltiplica il valore in bozza (es. 5 = +5%)`)}</span>
      </div>

      {data && products.map(p => (
        <div key={p.productId} style={{ ...cardWrap, padding: 0, overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 18px', borderBottom: '1px solid var(--border)' }}>
            <Thumb url={p.image} />
            <div style={{ color: '#fff', fontWeight: 800, fontSize: 14 }}>{p.title}</div>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead><tr>
                <th style={{ ...th, width: 36 }}></th>
                <th style={{ ...th, textAlign: 'left' }}>{t('pc.colSku', null, 'SKU / Variante')}</th>
                <th style={th}>{t('pc.colShopify', null, 'Costo Shopify')}</th>
                <th style={th}>{t('pc.colLanded', null, 'Landed (edit)')}</th>
                <th style={th}>{t('pc.colHistory', null, 'Storico')}</th>
                <th style={{ ...th, width: 50 }}></th>
              </tr></thead>
              <tbody>
                {p.variants.map(v => {
                  const changed = isChanged(v.variant_id)
                  const open = expanded.has(v.variant_id)
                  const hist = histCache[v.variant_id]
                  return (
                    <Fragment key={v.variant_id}>
                      <tr style={{ borderBottom: open ? 'none' : '1px solid rgba(255,255,255,0.04)', background: changed ? 'rgba(123,91,255,0.06)' : 'transparent' }}>
                        <td style={{ padding: '10px 14px' }}><input type="checkbox" checked={selected.has(v.variant_id)} onChange={() => toggleSel(v.variant_id)} style={{ width: 15, height: 15, accentColor: '#7b5bff', cursor: 'pointer' }} /></td>
                        <td onClick={() => toggleHistory(v.variant_id)} title={t('pc.histOpen', null, 'Mostra storico')} style={{ padding: '10px 14px', cursor: 'pointer' }}><div style={{ color: '#fff', fontSize: 12.5, fontWeight: 600 }}>{v.sku || '—'}</div><div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 10.5 }}>{v.size}</div></td>
                        <td style={cell}>{fmtMoney(v.shopifyCost)}</td>
                        <td style={{ ...cell, padding: '8px 14px' }}>
                          <input value={drafts[v.variant_id] ?? ''} onChange={e => setDraft(v.variant_id, e.target.value)} type="number" placeholder={v.shopifyCost != null ? String(v.shopifyCost) : '0'} style={{ width: 110, textAlign: 'right', background: 'rgba(255,255,255,0.05)', border: `1px solid ${changed ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '7px 9px', color: '#fff', fontSize: 13, colorScheme: 'dark' }} />
                        </td>
                        <td style={cell}>
                          <button onClick={() => toggleHistory(v.variant_id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: open ? 'rgba(123,91,255,0.12)' : 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 9px', color: '#fff', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                            <span style={{ display: 'inline-block', transform: open ? 'rotate(90deg)' : 'none', transition: 'transform .15s', color: 'rgba(255,255,255,0.6)' }}>▸</span>
                            <Icon name="clock" size={12} /> {v.historyCount || 0}
                          </button>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <button onClick={() => saveRows([v.variant_id])} disabled={!changed || saving} title={t('pc.save', null, 'Salva')} style={{ background: changed ? 'rgba(123,91,255,0.18)' : 'transparent', border: `1px solid ${changed ? 'var(--accent)' : 'var(--border)'}`, borderRadius: 8, padding: '6px 8px', color: changed ? '#fff' : 'rgba(255,255,255,0.35)', cursor: changed ? 'pointer' : 'default', display: 'grid', placeItems: 'center' }}><Icon name="download" size={13} /></button>
                        </td>
                      </tr>
                      {open && (
                        <tr style={{ background: 'rgba(255,255,255,0.015)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                          <td colSpan={6} style={{ padding: '2px 18px 14px 48px' }}>
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', margin: '8px 0 6px' }}>{t('pc.histTitle2', null, 'Storico costo di acquisto (valido dalla data indicata)')}</div>
                            {hist == null ? <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, padding: '6px 0' }}>{t('pc.histLoading', null, 'Carico…')}</div>
                            : !hist.length ? <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: 12, padding: '6px 0' }}>{t('pc.histEmpty', null, 'Nessuna modifica registrata.')}</div>
                            : hist.map((h, i) => (
                              <div key={i} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 0', borderTop: i ? '1px solid rgba(255,255,255,0.04)' : 'none' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                                  <span style={{ color: 'rgba(255,255,255,0.75)', fontSize: 12.5 }}>{fmtDate(h.effective_from)}</span>
                                  <span style={{ color: '#fff', fontWeight: 800, fontSize: 13.5 }}>{fmtMoney(Number(h.landed_cost))}</span>
                                  {i === 0 && <span style={{ fontSize: 10, fontWeight: 700, color: '#86efac', background: 'rgba(52,211,153,0.12)', border: '1px solid rgba(52,211,153,0.3)', borderRadius: 999, padding: '2px 8px' }}>{hist.length === 1 ? t('pc.baseline', null, 'Baseline oggi') : t('pc.current', null, 'attuale')}</span>}
                                </div>
                                <span style={{ color: 'rgba(255,255,255,0.45)', fontSize: 11 }}>{t('pc.recorded', null, 'registrato')} {fmtDateTime(h.created_at)}</span>
                              </div>
                            ))}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {loading && !data && <div style={{ ...cardWrap, textAlign: 'center', color: 'rgba(255,255,255,0.78)' }}>{t('pc.loading', null, 'Carico costi da Shopify…')}</div>}
      {data && products.length === 0 && <div style={{ ...cardWrap, textAlign: 'center', color: 'rgba(255,255,255,0.7)' }}>{t('pc.empty', null, 'Nessun prodotto.')}</div>}
    </div>
  )
}
