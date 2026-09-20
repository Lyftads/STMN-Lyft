'use client'

import AzioneBarra from './ui/AzioneBarra'
import { Live, Scheletro, Vuoto } from './ui/Mattoni'
import PeriodoInBarra from './ui/PeriodoInBarra'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useStatoTab } from '../../lib/client/statoTab'
import FasceTabella from './ui/FasceTabella'
import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { PlatformBadges } from './PlatformIcon'
import { useElenco, FiltriElenco, Paginazione } from './ui/Elenco'
import Copia from './ui/Copia'

const isoDay = (d) => d.toISOString().slice(0, 10)

// Cache di modulo: sopravvive al cambio tab → riaprendo la tab non rifà la fetch.
let __gpCache = null // { key, payload }
const urlGP = (s, u, refresh = false) => `/api/google-products?since=${s}&until=${u}${refresh ? '&refresh=1' : ''}`

export default function GoogleProductsTab() {
  const { t, intlLocale } = useI18n()
  const [since, setSince] = useStatoTab('gp.since', () => isoDay(new Date(Date.now() - 7 * 86400000)))
  const [until, setUntil] = useStatoTab('gp.until', () => isoDay(new Date()))
  const [periodo, setPeriodo] = useStatoTab('gp.periodo', 'custom')
  const [data, setData] = useState(() => ((__gpCache?.key === `${since}:${until}` && __gpCache.payload) || inMemoria(urlGP(since, until)) || null))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sortBy, setSortBy] = useState('cost')

  const keyOf = (s, u) => `${s}:${u}`

  const load = async (s = since, u = until, refresh = false) => {
    const key = keyOf(s, u)
    if (!refresh && __gpCache?.key === key) { setData(__gpCache.payload); return } // cache client
    const gia = refresh ? null : inMemoria(urlGP(s, u))
    if (gia) { __gpCache = { key, payload: gia }; setData(gia) } else setLoading(true)
    setError('')
    try {
      const j = await leggi(urlGP(s, u, refresh), { onUpdate: (n) => { __gpCache = { key, payload: n }; setData(n) } })
      if (!j.ok) throw new Error(j.error || 'Errore')
      __gpCache = { key, payload: j }
      setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  // Carica solo se non già in cache di modulo (per la coppia di date corrente)
  useEffect(() => { if (__gpCache?.key === keyOf(since, until)) setData(__gpCache.payload); else load() }, []) // eslint-disable-line

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 2) => soldi(n, d, { valuta: cur })
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
  const cell = { padding: '11px 12px', fontSize: 13, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
  const th = { padding: '10px 12px', fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'right', color: 'var(--text2)', whiteSpace: 'nowrap', position: 'sticky', top: 0, background: 'var(--surface)', cursor: 'pointer' }
  const inputStyle = { background: 'var(--glass,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13, colorScheme: 'dark' }
  const Thumb = ({ url }) => url
    ? <img src={miniatura(url, 34)} loading="lazy" alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover', flexShrink: 0, background: 'var(--glass)' }} />
    : <div style={{ width: 34, height: 34, borderRadius: 8, background: 'var(--glass)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Icon name="box" size={14} /></div>
  // Ricerca (nome o ID articolo), marchi e pagine sull'elenco gia' ordinato.
  const elenco = useElenco(rows, { nome: r => r.title, altriCampi: r => `${r.itemId} ${(r.skus || []).join(' ')}`, marchio: r => r.vendor, chiave: 'prodottiGoogle' })

  const Hd = ({ id, label }) => <th style={{ ...th, color: sortBy === id ? 'var(--accent)' : 'var(--text2)' }} onClick={() => setSortBy(id)}>{label}</th>

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        
        <PlatformBadges sources={['google']} size={24} />
        <Live />
      </div>

      <div className="barra-strumenti" style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        {/* Lo stesso selettore del periodo di tutte le altre tab: calendario e periodi pronti. */}
        <PeriodoInBarra value={{ preset: periodo, since, until }} disabled={loading}
          onChange={(v) => { setPeriodo(v.preset || 'custom'); setSince(v.since); setUntil(v.until); load(v.since, v.until) }} />
        <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => load(since, until, true)} disabled={loading} gira={loading} />
        {data?.cached && <span className="a-tutta-riga" style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('gp.cached', null, 'da cache')}</span>}
      </div>

      {error && <div style={{ ...cardWrap, borderColor: 'rgba(239,68,68,0.35)', color: '#fca5a5', fontSize: 13 }}>{error}</div>}

      {data && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12 }}>
            {[[t('gp.totProducts', null, 'Prodotti'), fmtInt(k.products)], [t('gp.totCost', null, 'Costo'), fmtMoney(k.cost)], [t('gp.totConv', null, 'Conversioni'), fmtNum(k.conversions)], [t('gp.totValue', null, 'Valore conv.'), fmtMoney(k.convValue)], ['ROAS', k.roas != null ? `${k.roas}×` : '—']].map(([lab, val]) => (
              <div key={lab} style={{ ...cardWrap, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text2)' }}>{lab}</div>
                <div style={{ fontSize: 22, fontWeight: 680, color: 'var(--text)', marginTop: 4 }}>{val}</div>
              </div>
            ))}
          </div>

          <FiltriElenco elenco={elenco} tr={t} segnaposto={t('el.searchItem2', null, 'Cerca per nome, SKU o ID articolo…')} />

          <div style={{ ...cardWrap, padding: 0, overflowX: 'auto' }}>
            <table className="tabella-ferma tab-lyft st-3 st-7 st-8" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 1000 }}>
              <thead><FasceTabella gruppi={[{ vuote: 2 }, { fam: 'fam-traffico', n: 4, label: t('tab.famTraffic', null, 'Traffico'), loghi: ['google'] }, { fam: 'fam-pub', n: 1, label: t('tab.famSpend', null, 'Spesa'), loghi: ['google'] }, { fam: 'fam-resa', n: 4, label: t('tab.famResults', null, 'Risultati'), loghi: ['google'] }]} /><tr>
                <th className="gp-prodotto" style={{ ...th, textAlign: 'left', cursor: 'default' }}>{t('gp.colProduct', null, 'Prodotto')}</th>
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
                {elenco.visibili.map(r => (
                  <tr key={r.itemId} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                    <td className="gp-prodotto" style={{ padding: '10px 12px', maxWidth: 280 }}><div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Thumb url={r.image} /><span style={{ color: 'var(--text)', fontWeight: 600, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.title}</span></div></td>
                    <td style={{ padding: '10px 12px', fontSize: 11.5, color: 'var(--text3)', whiteSpace: 'nowrap' }}><Copia testo={r.itemId} /></td>
                    <td style={cell}>{fmtInt(r.clicks)}</td>
                    <td style={cell}>{fmtInt(r.impressions)}</td>
                    <td style={cell}>{fmtPct(r.ctr)}</td>
                    <td style={cell}>{fmtMoney(r.cpc)}</td>
                    <td style={{ ...cell, color: 'var(--text)', fontWeight: 640 }}>{fmtMoney(r.cost)}</td>
                    <td style={cell}>{fmtNum(r.conversions)}</td>
                    <td style={cell}>{r.costPerConv != null ? fmtMoney(r.costPerConv) : '—'}</td>
                    <td style={cell}>{fmtMoney(r.convValue)}</td>
                    <td style={{ ...cell, color: r.roas == null ? 'var(--text3)' : r.roas >= 2 ? '#22c55e' : r.roas >= 1 ? '#fcd34d' : '#ef4444', fontWeight: 640 }}>{r.roas != null ? `${r.roas}×` : '—'}</td>
                  </tr>
                ))}
                {rows.length === 0 && <tr><td colSpan={11}><Vuoto titolo={t('gp.empty', null, 'Nessun dato prodotto nel periodo.')} testo={t('gp.emptyHint', null, 'Google non ha speso su nessun articolo in questi giorni: allarga il periodo.')} /></td></tr>}
              </tbody>
            </table>
          </div>
          <Paginazione elenco={elenco} tr={t} esporta={{ nome: 'prodotti-google', colonne: [['Prodotto', r => r.title], ['Marchio', r => r.vendor], ['ID articolo', r => r.itemId], ['SKU', r => (r.skus || []).join(' ')], ['Clic', r => r.clicks], ['Impression', r => r.impressions], ['CTR %', r => r.ctr], ['CPC', r => r.cpc], ['Costo', r => r.cost], ['Acquisti', r => r.conversions], ['Costo per acquisto', r => r.costPerConv], ['Valore acquisti', r => r.convValue], ['ROAS', r => r.roas]] }} />
        </>
      )}

      {loading && !data && <Scheletro kpi={5} righe={10} />}
    </div>
  )
}
