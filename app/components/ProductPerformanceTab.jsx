'use client'

import AzioneBarra from './ui/AzioneBarra'
import Pannello from './ui/Pannello'
import { Scheletro, Vuoto } from './ui/Mattoni'
import PeriodoInBarra from './ui/PeriodoInBarra'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useStatoTab } from '../../lib/client/statoTab'
import FasceTabella, { Fonte } from './ui/FasceTabella'
import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import DownloadReportButton from './DownloadReportButton'
import DriveToStoreCard from './DriveToStoreCard'
import { useElenco, FiltriElenco, Paginazione } from './ui/Elenco'
import { num, perc, volte } from '../../lib/client/numeri'

const isoDay = (d) => d.toISOString().slice(0, 10)

// Cache di modulo: sopravvive al cambio tab → riaprendo non rifà la fetch.
let __ppCache = null // { key, payload }
const urlPP = (s, u, refresh = false) => `/api/product-performance?since=${s}&until=${u}${refresh ? '&refresh=1' : ''}`
let __collCache = {} // collectionId -> [productIds] (per sessione)

export default function ProductPerformanceTab() {
  const { t, intlLocale } = useI18n()
  // Il periodo scelto resta quando si lascia la tab; i dati si cercano prima
  // nella memoria della tab, poi in quella condivisa (dove arriva il precarico).
  const [since, setSince] = useStatoTab('pp.since', () => isoDay(new Date(Date.now() - 30 * 86400000)))
  const [until, setUntil] = useStatoTab('pp.until', () => isoDay(new Date()))
  const [periodo, setPeriodo] = useStatoTab('pp.periodo', 'custom')
  const [data, setData] = useState(() => ((__ppCache?.key === `${since}:${until}` && __ppCache.payload) || inMemoria(urlPP(since, until)) || null))
  const [loading, setLoading] = useState(() => !((__ppCache?.key === `${since}:${until}`) || inMemoria(urlPP(since, until))))
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('margin') // margin | net | units
  const [showAll, setShowAll] = useState(false) // false = solo prodotti venduti nel periodo

  // ── Mappatura campagne → prodotto ──
  const [mapOpen, setMapOpen] = useState(false)
  const [mapData, setMapData] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [mapSel, setMapSel] = useState({}) // `${platform}:${campaign_id}` -> product_id | ''
  const [mapSaving, setMapSaving] = useState(false)
  const [mapErr, setMapErr] = useState('')
  const [pickerFor, setPickerFor] = useState(null) // campaign key con picker aperto
  const [pickerQuery, setPickerQuery] = useState('')
  const [collBusy, setCollBusy] = useState(null) // collection id in caricamento

  // Aggiunge tutti i prodotti attivi di una collezione alla campagna
  const addCollection = async (key, collId) => {
    if (collBusy) return
    setCollBusy(collId)
    try {
      let ids = __collCache[collId]
      if (!ids) {
        const r = await fetch(`/api/campaign-map?collection=${collId}`, { cache: 'no-store' })
        const j = await r.json()
        if (!j.ok) throw new Error(j.error || 'Errore collezione')
        ids = j.ids || []
        __collCache[collId] = ids
      }
      const known = new Set((mapData?.products || []).map(p => p.id))
      const add = ids.filter(id => known.has(id))
      setMapSel(s => ({ ...s, [key]: [...new Set([...(s[key] || []), ...add])] }))
    } catch (e) {
      setMapErr(e.message)
    } finally {
      setCollBusy(null)
    }
  }

  // mapSel[key] = array di product id selezionati per la campagna
  // Si salva SOLO cio' che e' stato corretto a mano. Prima il salvataggio
  // scriveva come "manuale" anche le campagne precompilate dall'automatico e
  // mai toccate: una collezione di 650 prodotti diventava una fotografia
  // congelata, che non seguiva piu' la collezione quando cambiava.
  const [mapToccate, setMapToccate] = useState(() => new Set())
  const [mapReset, setMapReset] = useState(() => new Set())
  const tocca = (key) => { setMapToccate(s => new Set(s).add(key)); setMapReset(s => { const n = new Set(s); n.delete(key); return n }) }
  const tornaAutomatico = (c) => {
    const key = `${c.platform}:${c.campaign_id}`
    setMapReset(s => new Set(s).add(key))
    setMapToccate(s => { const n = new Set(s); n.delete(key); return n })
    setMapSel(s => ({ ...s, [key]: (c.auto || []).map(p => p.id) }))
  }
  const tutteAutomatiche = () => { for (const c of (mapData?.campaigns || [])) if (c.mapped) tornaAutomatico(c) }

  const addProduct = (key, id) => { tocca(key); setMapSel(s => ({ ...s, [key]: (s[key] || []).includes(id) ? s[key] : [...(s[key] || []), id] })) }
  const removeProduct = (key, id) => { tocca(key); setMapSel(s => ({ ...s, [key]: (s[key] || []).filter(x => x !== id) })) }
  const setAllProducts = (key, ids) => { tocca(key); setMapSel(s => ({ ...s, [key]: ids })) }

  const openMap = async () => {
    setMapOpen(true); setMapLoading(true); setMapErr('')
    try {
      const r = await fetch(`/api/campaign-map?since=${since}&until=${until}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      const sel = {}
      for (const c of j.campaigns) {
        const key = `${c.platform}:${c.campaign_id}`
        sel[key] = c.selected?.length ? c.selected.map(p => p.id)
          : c.auto?.length ? c.auto.map(p => p.id)
          : (c.suggestedProductId ? [c.suggestedProductId] : [])
      }
      setMapData(j); setMapSel(sel); setMapToccate(new Set()); setMapReset(new Set())
    } catch (e) { setMapErr(e.message) } finally { setMapLoading(false) }
  }
  const saveMap = async () => {
    if (!mapData) return
    setMapSaving(true); setMapErr('')
    try {
      const prodTitle = new Map(mapData.products.map(p => [p.id, p.title]))
      const mappings = mapData.campaigns
        .filter(c => { const key = `${c.platform}:${c.campaign_id}`; return mapToccate.has(key) || mapReset.has(key) })
        .map(c => {
          const key = `${c.platform}:${c.campaign_id}`
          // Tornare all'automatico = togliere la mappatura manuale: lista vuota.
          const ids = mapReset.has(key) ? [] : (mapSel[key] || [])
          return { platform: c.platform, campaign_id: c.campaign_id, campaign_name: c.campaign_name, products: ids.map(id => ({ id, title: prodTitle.get(id) || '' })) }
        })
      const r = await fetch('/api/campaign-map', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mappings }) })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore salvataggio')
      setMapOpen(false)
      load(since, until, true) // ricalcola la performance con l'attribuzione precisa
    } catch (e) { setMapErr(e.message) } finally { setMapSaving(false) }
  }

  const keyOf = (s, u) => `${s}:${u}`
  const load = async (s = since, u = until, refresh = false) => {
    const key = keyOf(s, u)
    if (!refresh && __ppCache?.key === key) { setData(__ppCache.payload); setLoading(false); return }
    const gia = refresh ? null : inMemoria(urlPP(s, u))
    if (gia) { __ppCache = { key, payload: gia }; setData(gia); setLoading(false) }
    else { setLoading(true) }
    setError('')
    try {
      const j = await leggi(urlPP(s, u, refresh), { onUpdate: (n) => { __ppCache = { key, payload: n }; setData(n) } })
      if (!j.ok) throw new Error(j.error || 'Errore')
      __ppCache = { key, payload: j }
      setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  // Cache di modulo: al cambio tab non rifà la fetch (riapre istantaneo).
  useEffect(() => { if (__ppCache?.key === keyOf(since, until)) { setData(__ppCache.payload); setLoading(false) } else load() }, []) // eslint-disable-line

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 0) => soldi(n, d, { valuta: cur })
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))

  const allProducts = data?.products || []
  const soldCount = useMemo(() => allProducts.filter(p => (p.units || 0) > 0).length, [allProducts])
  const products = useMemo(() => {
    const arr = showAll ? [...allProducts] : allProducts.filter(p => (p.units || 0) > 0)
    const key = sortBy === 'net' ? 'netRevenue' : sortBy === 'units' ? 'units' : 'marginOp'
    return [...arr].sort((a, b) => (b[key] || 0) - (a[key] || 0))
  }, [allProducts, sortBy, showAll])

  // Ricerca, marchi e pagine sull'elenco GIA' ordinato.
  const elenco = useElenco(products, { nome: p => p.title, altriCampi: p => (p.skus || []).join(' '), marchio: p => p.vendor, chiave: 'performanceProdotti' })
  const k = data?.totals
  const mapProdTitle = new Map((mapData?.products || []).map(p => [p.id, p.title]))
  const cardWrap = { background: 'var(--card,rgba(255,255,255,0.02))', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }
  const cell = { padding: '12px 14px', fontSize: 13, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
  const th = { padding: '11px 14px', fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'right', color: 'var(--text2)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', backdropFilter: 'blur(12px)' }
  const Thumb = ({ url }) => url
    ? <img src={miniatura(url, 38)} loading="lazy" alt="" style={{ width: 38, height: 38, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--glass)' }} />
    : <div style={{ width: 38, height: 38, borderRadius: 8, background: 'var(--glass)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={16} /></div>

  const inputStyle = { background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13, colorScheme: 'dark' }
  const sortBtn = (id, label) => (
    <button key={id} onClick={() => setSortBy(id)} style={{ padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: sortBy === id ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: sortBy === id ? 900 : 700, borderBottom: sortBy === id ? '2px solid var(--accent)' : '2px solid transparent' }}>{label}</button>
  )
  const kpi = (label, value, sub) => (
    <div style={{ ...cardWrap, padding: '16px 18px' }}>
      <div style={{ fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text2)' }}>{label}</div>
      <div style={{ fontSize: 22, fontWeight: 680, color: 'var(--text)', margin: '5px 0 2px' }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text2)' }}>{sub}</div>}
    </div>
  )

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 760 }}>
          
        </div>
        <button onClick={openMap} style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'var(--neutro-bg)', border: '1px solid var(--accent)', color: 'var(--accent)', borderRadius: 12, padding: '9px 14px', fontSize: 13, fontWeight: 640, cursor: 'pointer', whiteSpace: 'nowrap' }}>
          <Icon name="link" size={14} /> {t('pp.mapBtn2', null, 'Come è attribuita la spesa ADS')}
        </button>
      </div>

      {/* Controlli */}
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        {/* Lo stesso selettore del periodo di tutte le altre tab: calendario e periodi pronti. */}
        <PeriodoInBarra value={{ preset: periodo, since, until }} disabled={loading}
          onChange={(v) => { setPeriodo(v.preset || 'custom'); setSince(v.since); setUntil(v.until); load(v.since, v.until) }} />
        <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => load(since, until, true)} disabled={loading} gira={loading} />
        <button onClick={() => { const s = isoDay(new Date(Date.now() - 30 * 86400000)), u = isoDay(new Date()); setSince(s); setUntil(u); load(s, u, true) }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('pp.reset', null, 'Reset')}</button>
        <DownloadReportButton tab="Performance Prodotti" custom={{ since, until, label: `${since} → ${until}` }} />
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 13, color: 'var(--text2)', fontWeight: 600, marginRight: 4 }}>{t('pp.sortBy', null, 'Ordina per')}</span>
          {sortBtn('margin', t('pp.sortMargin', null, 'Margine'))}
          {sortBtn('net', t('pp.sortNet', null, 'Netto'))}
          {sortBtn('units', t('pp.sortUnits', null, 'Unità'))}
          <div style={{ width: 1, height: 18, background: 'var(--border)', margin: '0 6px' }} />
          <button
            onClick={() => setShowAll(v => !v)}
            title={t('pp.showAllHint', null, 'Include i prodotti senza vendite nel periodo')}
            style={{ padding: '6px 12px', border: 'none', background: 'transparent', cursor: 'pointer', color: showAll ? 'var(--text)' : 'var(--text2)', fontSize: 13, fontWeight: showAll ? 900 : 700, borderBottom: showAll ? '2px solid var(--accent)' : '2px solid transparent' }}
          >
            {showAll
              ? t('pp.showSold', { n: soldCount }, `Solo venduti (${soldCount})`)
              : t('pp.showAll', { n: allProducts.length }, `Tutto il catalogo (${allProducts.length})`)}
          </button>
        </div>
      </div>

      <DriveToStoreCard since={since} until={until} />
      {error && <div style={{ ...cardWrap, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5' }}>{error}</div>}

      {data && (
        <>
          {/* Totali */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 14 }}>
            {kpi(t('pp.totNet', null, 'Ricavo netto'), fmtMoney(k.netRevenue), k.venduto != null
              ? t('pp.totNetFrom', { v: fmtMoney(k.venduto), i: fmtMoney(k.iva), n: fmtInt(k.units) }, `${fmtMoney(k.venduto)} venduti − ${fmtMoney(k.iva)} di IVA · ${fmtInt(k.units)} unità`)
              : `${fmtInt(k.units)} ${t('pp.unitsLabel', null, 'unità')}`)}
            {kpi(t('pp.totMargin', null, 'Margine operativo'), fmtMoney(k.marginOp), k.netRevenue > 0 ? `${Math.round((k.marginOp / k.netRevenue) * 100)}%` : '—')}
            {kpi(t('pp.totAds', null, 'Spesa ADS'), fmtMoney(k.ads), `Meta ${fmtMoney(k.metaSpend)} · Google ${fmtMoney(k.googleSpend)}`)}
            {kpi('ROAS', k.roas != null ? volte(k.roas) : '—', t('pp.blended', null, 'blended B2C'))}
          </div>

          {/* Cio' che sta FUORI dal conto si dice: il marketplace (non l'ha portato la pubblicita') e i pezzi resi. */}
          {(data.fuori?.marketplace?.ordini > 0 || data.fuori?.resi?.units > 0) && (
            <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }}>
              {t('pp.outside', null, 'Fuori da questo conto')}:
              {data.fuori.marketplace?.ordini > 0 && <> {t('pp.outsideMarket', { v: fmtMoney(data.fuori.marketplace.netRevenue), n: data.fuori.marketplace.ordini }, `marketplace ${fmtMoney(data.fuori.marketplace.netRevenue)} netti in ${data.fuori.marketplace.ordini} ordini (non li ha portati la pubblicità)`)}</>}
              {data.fuori.marketplace?.ordini > 0 && data.fuori.resi?.units > 0 && ' · '}
              {data.fuori.resi?.units > 0 && <> {t('pp.outsideReturns', { n: data.fuori.resi.units, o: data.fuori.resi.ordini }, `${data.fuori.resi.units} pezzi resi in ${data.fuori.resi.ordini} ordini: tolti, il resto dell’ordine conta`)}</>}
            </div>
          )}

          <div style={{ fontSize: 11.5, color: 'var(--text2)', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            {data.clamped && <span style={{ color: '#f59e0b' }}>⚠ {t('pp.clampedNote', { d: data.range.since }, `Shopify limita gli ordini agli ultimi 60 giorni — analisi dal ${data.range.since} (per finestre più lunghe serve lo scope read_all_orders).`)}</span>}
            {k.adsMappedPct >= 100
              ? <span style={{ color: '#22c55e' }}>✓ {t('pp.allMapped', null, 'ADS attribuiti per campagna (dato preciso) su tutta la spesa.')}</span>
              : <span><span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: '#22c55e', marginRight: 5 }} />{t('pp.mappedNote2', { n: num(k.adsMappedPct, 0) }, `${k.adsMappedPct}% della spesa ADS è attribuita in automatico a prodotti o collezioni. Il resto sono campagne che non indicano un prodotto (link alla home, ricerca sul marchio): si ripartisce su tutto il catalogo in proporzione al fatturato.`)}</span>}
            {k.costCoverage < 90 && <span style={{ color: '#f59e0b' }}>⚠ {t('pp.costCovNote', { n: num(k.costCoverage, 0) }, `COGS presente sul ${k.costCoverage}% dei prodotti venduti — il margine è parziale dove manca il costo`)}</span>}
          </div>

          <FiltriElenco elenco={elenco} tr={t} />

          {/* Tabella */}
          <div style={{ ...cardWrap, padding: 0, overflowX: 'auto' }}>
            <table className="tab-lyft st-2 st-6 st-8" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1120 }}>
              <thead><FasceTabella gruppi={[{ vuote: 1 }, { fam: 'fam-vendite', n: 4, label: t('tab.famSales', null, 'Vendite'), loghi: ['shopify'] }, { fam: 'fam-pub', n: 2, label: t('tab.famCosts', null, 'Costi'), loghi: ['shopify', 'meta', 'google'] }, { fam: 'fam-resa', n: 4, label: t('tab.famYield', null, 'Resa') }]} /><tr>
                <th style={{ ...th, textAlign: 'left' }}>{t('pp.colProduct', null, 'Prodotto')}</th>
                <th style={th}>{t('pp.colUnits', null, 'Unità')}</th>
                <th style={th}>{t('pp.colSold', null, 'Venduto')}</th>
                <th style={th}>{t('pp.colVat', null, '− IVA')}</th>
                <th style={th}>{t('pp.colNetEq', null, '= Netto')}</th>
                <th style={th}><Fonte loghi={['shopify']} />{t('pp.colCogs', null, 'COGS')}</th>
                <th style={th}><Fonte loghi={['meta', 'google']} />{t('pp.colAds', null, 'ADS')}</th>
                <th style={th}>{t('pp.colMargin', null, 'Margine op.')}</th>
                <th style={th}>%</th>
                <th style={th}>ROAS</th>
                <th style={th}>{t('pp.colDelta', null, 'Δ Netto')}</th>
              </tr></thead>
              <tbody>
                {elenco.visibili.map(p => (
                  <tr key={p.productId} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 14px', maxWidth: 360 }}><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Thumb url={p.image} /><div style={{ minWidth: 0 }}><span className="gpv-titolo" style={{ display: 'block', color: 'var(--text)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                      {/* Sul telefono il margine sta qui: la sua colonna e' a cinque colonne di distanza. */}
                      <div className="gpv-esito-mobile"><span className={`reg-pillola ${p.marginOp >= 0 ? 'gpv-su' : 'sotto'}`}>{p.marginOp >= 0 ? '+' : ''}{fmtMoney(p.marginOp)}</span></div></div></div></td>
                    <td style={cell}>{fmtInt(p.units)}</td>
                    <td style={cell}>{p.venduto != null ? fmtMoney(p.venduto) : '—'}</td>
                    <td style={{ ...cell, color: 'var(--text3)' }}>{p.iva != null ? `−${fmtMoney(p.iva)}` : '—'}</td>
                    <td style={{ ...cell, fontWeight: 640 }}>{fmtMoney(p.netRevenue)}</td>
                    <td style={{ ...cell, color: p.hasCost ? 'var(--text)' : 'var(--text3)' }}>{p.hasCost ? fmtMoney(p.cogs) : '—'}</td>
                    <td style={cell} title={p.adsExact ? t('pp.adsExact', null, 'Attribuito per campagna (preciso)') : t('pp.adsEstimate', null, 'Stima proporzionale')}>{p.adsExact && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: '#22c55e', marginRight: 5, verticalAlign: 'middle' }} />}{fmtMoney(p.ads)}</td>
                    <td style={{ ...cell, color: p.marginOp >= 0 ? '#22c55e' : '#ef4444', fontWeight: 680 }}>{fmtMoney(p.marginOp)}</td>
                    <td style={{ ...cell, color: p.marginPct >= 40 ? '#22c55e' : p.marginPct >= 0 ? '#fcd34d' : '#ef4444', fontWeight: 600 }}>{perc(p.marginPct, 1)}</td>
                    <td style={{ ...cell, color: p.adsExact ? 'var(--text)' : 'var(--text3)' }} title={p.adsExact ? undefined : t('pp.roasEstimate', null, 'ROAS stimato = ROAS blended, uguale per tutti finché non mappi la campagna su questo prodotto')}>{p.roas != null ? `${p.adsExact ? '' : '~'}${volte(p.roas)}` : '—'}</td>
                    <td style={{ ...cell, color: p.deltaNet == null ? 'var(--text3)' : p.deltaNet >= 0 ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{p.deltaNet == null ? '—' : `${p.deltaNet >= 0 ? '↑ ' : '↓ '}${perc(p.deltaNet, 1, { segno: true })}`}</td>
                  </tr>
                ))}
                {products.length === 0 && <tr><td colSpan={11}><Vuoto titolo={t('pp.empty', null, 'Nessun prodotto venduto nel periodo.')} testo={t('pp.emptyHint', null, 'Allarga il periodo, oppure apri «Tutto il catalogo» per vedere anche i prodotti senza vendite.')} /></td></tr>}
              </tbody>
            </table>
          </div>
          <Paginazione elenco={elenco} tr={t} esporta={{ nome: 'performance-prodotti', colonne: [['Prodotto', r => r.title], ['Marchio', r => r.vendor], ['SKU', r => (r.skus || []).join(' ')], ['Unità', r => r.units], ['Venduto IVA inclusa', r => r.venduto], ['IVA', r => r.iva], ['Netto', r => r.netRevenue], ['COGS', r => r.cogs], ['ADS', r => r.ads], ['Margine operativo', r => r.marginOp], ['Margine %', r => r.marginPct], ['ROAS', r => r.roas], ['Δ netto %', r => r.deltaNet]] }} />
        </>
      )}

      {loading && !data && <Scheletro kpi={4} righe={10} />}

      {mapOpen && (
        <Pannello titolo={t('pp.mapTitle2', null, 'Come è attribuita la spesa ADS')} larghezza={920} onClose={() => setMapOpen(false)}
          sotto={t('pp.mapSub3', null, 'Ogni campagna Meta viene attribuita da sola: dal catalogo dell’adset, dal prodotto o dalla collezione a cui porta il link.')}
          piede={<>
              {mapErr && <span style={{ color: '#fca5a5', fontSize: 13 }}>{mapErr}</span>}
              {(mapData?.campaigns || []).some(c => c.mapped && !mapReset.has(`${c.platform}:${c.campaign_id}`)) && (
                <button onClick={tutteAutomatiche} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 14px', color: 'var(--accent)', fontSize: 13, fontWeight: 640, cursor: 'pointer' }}>
                  {t('pp.allAuto', null, 'Usa l’automatico per tutte')}
                </button>
              )}
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('pp.pendingN', { n: mapToccate.size + mapReset.size }, `${mapToccate.size + mapReset.size} modifiche da salvare`)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={() => setMapOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '9px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{t('pp.mapCancel', null, 'Annulla')}</button>
              <button onClick={saveMap} disabled={mapSaving || mapLoading || (mapToccate.size + mapReset.size === 0)} style={{ background: 'var(--btn-primario)', border: 'none', borderRadius: 8, padding: '9px 18px', color: 'var(--btn-primario-testo)', fontSize: 13, fontWeight: 640, cursor: mapSaving ? 'default' : 'pointer', opacity: (mapSaving || (mapToccate.size + mapReset.size === 0)) ? 0.5 : 1 }}>{mapSaving ? t('pp.mapSaving', null, 'Salvo…') : t('pp.mapSave2', null, 'Salva le modifiche')}</button>
          </>}>
          <div style={{ margin: '-14px -22px' }}>
              {mapLoading ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('pp.mapLoading', null, 'Carico campagne…')}</div>
              : !mapData?.campaigns?.length ? <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>{t('pp.mapEmpty', null, 'Nessuna campagna con spesa nel periodo.')}</div>
              : (
                <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead><tr>
                    <th style={{ ...th, textAlign: 'left', position: 'static' }}><Fonte loghi={['meta', 'google']} />{t('pp.mapCampaign', null, 'Campagna')}</th>
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
                        <tr key={key} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '10px 14px', maxWidth: 280, verticalAlign: 'top' }}>
                            <div style={{ color: 'var(--text)', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.campaign_name}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>{c.platform}</div>
                          </td>
                          <td style={{ ...cell, padding: '10px 14px', verticalAlign: 'top' }}>{fmtMoney(c.spend)}</td>
                          <td style={{ padding: '10px 14px', minWidth: 360 }}>
                            {(() => {
                              const aMano = mapToccate.has(key) || (c.mapped && !mapReset.has(key))
                              if (!aMano) {
                                // AUTOMATICO: si dice su cosa si regge, senza 650 etichette.
                                const n = (c.auto || []).length
                                const base = c.autoKind === 'catalog' ? t('pp.basisCatalog', { n }, `Catalogo dinamico dell’adset · ${n} prodotti`)
                                  : c.autoKind === 'collection' ? t('pp.basisCollection', { c: (c.autoCollections || []).join(', '), n }, `Il link porta alla collezione ${(c.autoCollections || []).join(', ')} · ${n} prodotti`)
                                  : c.autoKind === 'direct' ? t('pp.basisDirect', { n }, `Il link porta a ${n === 1 ? 'un prodotto' : `${n} prodotti`}`)
                                  : c.autoKind === 'home' ? t('pp.basisHome', null, 'Il link porta alla home: nessun prodotto indicato, la spesa si ripartisce su tutto il catalogo in proporzione al fatturato')
                                  : c.suggestedProductId ? t('pp.basisName', { p: c.suggestedTitle || '' }, `Dal nome della campagna: ${c.suggestedTitle || ''}`)
                                  : t('pp.basisNone', null, 'Nessun prodotto riconoscibile: la spesa si ripartisce su tutto il catalogo in proporzione al fatturato')
                                return (
                                  <div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                                      <span style={{ fontSize: 10, fontWeight: 640, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gpv-shopify)', background: 'var(--gpv-shopify-bg)', borderRadius: 999, padding: '2px 9px' }}>{t('pp.autoBadge', null, 'automatico')}</span>
                                      <span style={{ fontSize: 13, color: 'var(--text)' }}>{base}</span>
                                    </div>
                                    <button onClick={() => tocca(key)} style={{ marginTop: 6, background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{t('pp.fixByHand', null, 'Correggi a mano')}</button>
                                    {mapReset.has(key) && <span style={{ marginLeft: 10, fontSize: 11.5, color: 'var(--text3)' }}>{t('pp.willReset', null, 'la mappatura manuale verrà tolta al salvataggio')}</span>}
                                  </div>
                                )
                              }
                              return (
                                <>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                              <span style={{ fontSize: 10, fontWeight: 640, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--gpv-google)', background: 'var(--gpv-google-bg)', borderRadius: 999, padding: '2px 9px' }}>{t('pp.manualBadge', null, 'a mano')}</span>
                              {sel.slice(0, 12).map(id => (
                                <span key={id} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'var(--neutro-bg)', border: '1px solid var(--accent)', color: 'var(--text)', borderRadius: 999, padding: '3px 8px', fontSize: 11.5, fontWeight: 600, maxWidth: 200 }}>
                                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{mapProdTitle.get(id) || id}</span>
                                  <span onClick={() => removeProduct(key, id)} style={{ cursor: 'pointer', opacity: 0.8, fontWeight: 640 }}>×</span>
                                </span>
                              ))}
                              {sel.length > 12 && <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600 }}>{t('pp.moreN', { n: sel.length - 12 }, `+${sel.length - 12} altri`)}</span>}
                              <button onClick={() => { setPickerFor(pickerFor === key ? null : key); setPickerQuery('') }} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: pickerFor === key ? 'var(--neutro-bg)' : 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                                <Icon name="plus" size={11} /> {t('pp.mapAdd2', null, 'Aggiungi prodotti')}
                              </button>
                            </div>
                            {pickerFor === key && (
                              <div style={{ marginTop: 8, border: '1px solid var(--border)', borderRadius: 12, background: 'var(--surface)', overflow: 'hidden', maxWidth: 380 }}>
                                <input value={pickerQuery} onChange={e => setPickerQuery(e.target.value)} autoFocus placeholder={t('pp.mapSearch', null, 'Cerca prodotto…')} style={{ width: '100%', background: 'var(--glass)', border: 'none', borderBottom: '1px solid var(--border)', padding: '9px 11px', color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
                                <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                                  {(mapData.collections || []).filter(cl => cl.title.toLowerCase().includes(pickerQuery.trim().toLowerCase())).length > 0 && (
                                    <>
                                      <div style={{ padding: '6px 11px', fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{t('pp.mapCollections', null, 'Collezioni')}</div>
                                      {(mapData.collections || []).filter(cl => cl.title.toLowerCase().includes(pickerQuery.trim().toLowerCase())).map(cl => (
                                        <div key={`coll-${cl.id}`} onClick={() => addCollection(key, cl.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', cursor: collBusy ? 'wait' : 'pointer', fontSize: 13, color: 'var(--text)', opacity: collBusy && collBusy !== cl.id ? 0.5 : 1 }}>
                                          <span style={{ color: 'var(--accent)', display: 'inline-flex', flexShrink: 0 }}><Icon name="layers" size={13} /></span>
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{cl.title}</span>
                                          <span style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 640, flexShrink: 0 }}>{collBusy === cl.id ? t('pp.mapCollLoading', null, 'Aggiungo…') : `+ ${t('pp.mapCollAll', null, 'tutta')}`}</span>
                                        </div>
                                      ))}
                                      <div style={{ padding: '6px 11px', fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)' }}>{t('pp.mapProducts', null, 'Prodotti')}</div>
                                    </>
                                  )}
                                  {mapData.products.filter(p => p.title.toLowerCase().includes(pickerQuery.trim().toLowerCase())).map(p => {
                                    const on = sel.includes(p.id)
                                    return (
                                      <div key={p.id} onClick={() => on ? removeProduct(key, p.id) : addProduct(key, p.id)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '7px 11px', cursor: 'pointer', background: on ? 'var(--neutro-bg)' : 'transparent', fontSize: 13, color: 'var(--text)' }}>
                                        <span style={{ width: 16, height: 16, borderRadius: 6, border: `1px solid ${on ? 'var(--accent)' : 'var(--border)'}`, background: on ? 'var(--accent)' : 'transparent', display: 'grid', placeItems: 'center', flexShrink: 0, color: '#fff' }}>{on && <Icon name="check" size={11} />}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</span>
                                      </div>
                                    )
                                  })}
                                </div>
                                <div style={{ padding: '7px 11px', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                  <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('pp.mapSelN', { n: sel.length }, `${sel.length} selezionati`)}</span>
                                  <button onClick={() => setPickerFor(null)} style={{ background: 'var(--accent)', border: 'none', borderRadius: 8, padding: '5px 14px', color: '#fff', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}>{t('pp.mapDone', null, 'Fatto')}</button>
                                </div>
                              </div>
                            )}
                            <div style={{ display: 'flex', gap: 12, marginTop: 5, alignItems: 'center' }}>
                              <button onClick={() => setAllProducts(key, allIds)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{t('pp.mapAllCatalog', null, 'Tutto il catalogo')}</button>
                              {sel.length > 0 && <button onClick={() => setAllProducts(key, [])} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', fontSize: 11.5, fontWeight: 600, cursor: 'pointer', padding: 0 }}>{t('pp.mapClear', null, 'Svuota')}</button>}
                              <button onClick={() => tornaAutomatico(c)} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontSize: 11.5, fontWeight: 640, cursor: 'pointer', padding: 0 }}>{t('pp.backToAuto', null, 'Torna all’automatico')}</button>
                              {c.autoKind && <span style={{ fontSize: 10, fontWeight: 600, color: c.autoKind === 'catalog' ? '#60a5fa' : '#86efac', background: c.autoKind === 'catalog' ? 'rgba(96,165,250,0.12)' : 'rgba(134,239,172,0.12)', border: `1px solid ${c.autoKind === 'catalog' ? 'rgba(96,165,250,0.3)' : 'rgba(134,239,172,0.3)'}`, borderRadius: 999, padding: '2px 8px' }}>{c.autoKind === 'catalog' ? t('pp.kindCatalog', null, 'auto · catalogo') : c.autoKind === 'collection' ? t('pp.kindCollection', { n: (c.auto || []).length, c: (c.autoCollections || []).join(', ') }, `auto · collezione ${(c.autoCollections || []).join(', ')} · ${(c.auto || []).length} prodotti`) : c.autoKind === 'home' ? t('pp.kindHome', null, 'auto · link alla home, tutto il catalogo') : t('pp.kindDirect', null, 'auto · diretta')}</span>}
                              {isSuggest && <span style={{ fontSize: 10, color: '#86efac', fontWeight: 600 }}>{t('pp.mapSuggested', null, 'suggerito')} {c.suggestedScore ? perc(c.suggestedScore, 0) : ''}</span>}
                            </div>
                                </>
                              )
                            })()}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
          </div>
        </Pannello>
      )}
    </div>
  )
}
