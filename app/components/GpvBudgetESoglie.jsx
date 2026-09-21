'use client'

import { useEffect, useMemo, useState } from 'react'
import { scaricaCsv } from './ui/Elenco'
import { Bottone } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { avvisa } from '../../lib/client/avviso'
import { localeNumeri } from '../../lib/client/numeri'

// ============================================================================
//  Due pezzi della tab "Performance prodotti Google" nati dal debug del 19 set:
//
//  DoveVaIlBudget — la tab giudicava prodotto per prodotto ma non diceva la cosa piu'
//  grossa: la spesa e' dispersa. In 30 giorni il 62% della spesa Google era andato su
//  1.505 prodotti che non avevano venduto NIENTE, ne' da Google ne' altrove, e solo 29
//  prodotti superavano la soglia per essere giudicati. Qui si vede in tre numeri, con
//  l'elenco di chi spende a vuoto pronto da esportare (con tutti gli ID articolo del
//  feed) per escluderlo dalle campagne.
//
//  EditorSoglie — le soglie dei giudizi sono scelte di Marino, non costanti del codice.
// ============================================================================

const pct = (a, b) => (b > 0 ? Math.round((a / b) * 100) : 0)
// 'it-IT' da solo non mette il punto alle migliaia sotto 10.000: "1820" invece di "1.820".
const IT = (n) => Number(n || 0).toLocaleString(localeNumeri(), { useGrouping: 'always' })

export function DoveVaIlBudget({ righe = [], t, periodoGiorni }) {
  const [aperto, setAperto] = useState(false)
  const c = useMemo(() => {
    const conSpesa = righe.filter(r => r.cost > 0)
    const tot = conSpesa.reduce((s, r) => s + r.cost, 0)
    const vuoto = conSpesa.filter(r => !(r.conversions > 0) && !((r.shopifyRevenue || 0) > 0)).sort((a, b) => b.cost - a.cost)
    const venduto = conSpesa.filter(r => r.conversions >= 1 || (r.shopifyRevenue || 0) > 0)
    const giudicabili = conSpesa.filter(r => r.cost >= r.sogliaSpesa)
    const som = (x) => x.reduce((s, r) => s + r.cost, 0)
    return { n: conSpesa.length, tot, vuoto, spVuoto: som(vuoto), venduto, spVenduto: som(venduto), giudicabili, spGiud: som(giudicabili) }
  }, [righe])
  if (!c.n || !(c.tot > 0)) return null

  const numero = (valore, etichetta, nota) => (
    <div className="gpv-bud-numero">
      <div className="gpv-bud-val">{valore}</div>
      <div className="gpv-bud-et">{etichetta}</div>
      {nota && <div className="gpv-bud-nota">{nota}</div>}
    </div>
  )
  const esporta = () => scaricaCsv('google-spesa-senza-vendite', [
    ['Prodotto', r => r.title], ['Marchio', r => r.vendor], ['Spesa', r => r.cost], ['Clic', r => r.clicks],
    ['Giacenza', r => r.giacenza], ['Stato', r => r.stato || 'ACTIVE'], ['ID articolo del feed', r => (r.itemIds || [r.itemId]).join(' ')],
  ], c.vuoto)

  return (
    <section className="gpv-bud">
      <div className="gpv-bud-testa">
        <div>
          <div className="gpv-bud-titolo">{t('gpv.budTitle', null, 'Dove va il budget')}</div>
          <div className="gpv-bud-sotto">{t('gpv.budSub', { n: IT(c.n), v: soldi(c.tot) }, `${IT(c.n)} prodotti hanno ricevuto spesa: ${soldi(c.tot)} in tutto`)}</div>
        </div>
      </div>
      <div className="gpv-bud-barra" role="img" aria-label={t('gpv.budTitle', null, 'Dove va il budget')}>
        <span style={{ width: `${pct(c.spVenduto, c.tot)}%` }} className="venduto" />
        <span style={{ width: `${pct(c.spVuoto, c.tot)}%` }} className="vuoto" />
      </div>
      <div className="gpv-bud-numeri">
        {numero(`${pct(c.spVenduto, c.tot)}%`, t('gpv.budSold', null, 'su prodotti che hanno venduto'), `${soldi(c.spVenduto)} · ${IT(c.venduto.length)} ${t('gpv.budProducts', null, 'prodotti')}`)}
        {numero(`${pct(c.spVuoto, c.tot)}%`, t('gpv.budNoSale', null, 'su prodotti senza nessuna vendita'), `${soldi(c.spVuoto)} · ${IT(c.vuoto.length)} ${t('gpv.budProducts', null, 'prodotti')}`)}
        {numero(IT(c.giudicabili.length), t('gpv.budJudged', null, 'prodotti con abbastanza spesa per essere giudicati'), `${pct(c.spGiud, c.tot)}% ${t('gpv.budOfSpend', null, 'della spesa')}`)}
      </div>
      {c.vuoto.length > 0 && (
        <>
          <p className="gpv-bud-consiglio">
            {t('gpv.budAdvice', null, 'Senza vendita = nessun ordine attribuito da Google E nessun venduto su Shopify nel periodo. Su pochi giorni è normale che molti prodotti non vendano: prima di escluderli dal feed guarda gli stessi numeri sugli ultimi 90 giorni.')}
            {periodoGiorni != null && periodoGiorni < 60 && <b> {t('gpv.budShort', { n: periodoGiorni }, `Ora stai guardando ${periodoGiorni} giorni.`)}</b>}
          </p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <Bottone onClick={() => setAperto(a => !a)}>{aperto ? t('gpv.budHide', null, 'Nascondi l’elenco') : t('gpv.budShow', { n: IT(c.vuoto.length) }, `Vedi i ${IT(c.vuoto.length)} prodotti che spendono senza vendere`)}</Bottone>
            <Bottone onClick={esporta}>{t('gpv.budCsv', null, 'Scarica l’elenco (CSV con gli ID del feed)')}</Bottone>
          </div>
          {aperto && (
            <div className="gpv-bud-elenco">
              <table className="tab-lyft">
                <thead><tr><th>{t('gpv.cProduct', null, 'Prodotto')}</th><th style={{ textAlign: 'right' }}>{t('gpv.cAds', null, 'Pubblicità')}</th><th style={{ textAlign: 'right' }}>{t('gpv.kClicksShort', null, 'Clic')}</th><th style={{ textAlign: 'right' }}>{t('gpv.kStock', null, 'In magazzino')}</th></tr></thead>
                <tbody>
                  {c.vuoto.slice(0, 100).map(r => (
                    <tr key={r.itemId}>
                      <td><b>{r.title}</b> <span style={{ color: 'var(--text3)' }}>{r.vendor}{r.stato ? ` · ${t('gpv.draft', null, 'in bozza')}` : ''}</span></td>
                      <td style={{ textAlign: 'right' }}>{soldi(r.cost, 2)}</td>
                      <td style={{ textAlign: 'right' }}>{IT(Number(r.clicks || 0))}</td>
                      <td style={{ textAlign: 'right' }}>{r.giacenza ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {c.vuoto.length > 100 && <div className="gpv-bud-nota" style={{ padding: '8px 2px' }}>{t('gpv.budMore', { n: (c.vuoto.length - 100).toLocaleString(localeNumeri()) }, `…e altri ${(c.vuoto.length - 100).toLocaleString(localeNumeri())}: nel CSV ci sono tutti.`)}</div>}
            </div>
          )}
        </>
      )}
    </section>
  )
}

export function EditorSoglie({ soglie, t, onSalvate }) {
  const [v, setV] = useState(null)
  const [pre, setPre] = useState(null)
  const [salvo, setSalvo] = useState(false)
  useEffect(() => {
    let vivo = true
    fetch('/api/google-product-verdicts/soglie', { cache: 'no-store' }).then(r => r.json()).then(j => { if (vivo && j?.ok) { setV(j.soglie); setPre(j.predefinite) } }).catch(() => {})
    return () => { vivo = false }
  }, [])
  const s = v || soglie
  if (!s) return null
  const cambia = (k, x) => setV({ ...s, [k]: x })
  // Si scrive come si parla: "il 25% del prezzo", non "rapporto 4".
  const campi = [
    ['quota', t('gpv.sQuota', null, 'Si giudica un prodotto quando ha speso almeno'), '%', t('gpv.sQuotaNote', null, 'del suo prezzo di vendita'), Math.round(100 / (s.rapportoPrezzoSpesa || 4)), (x) => cambia('rapportoPrezzoSpesa', 100 / Math.min(100, Math.max(5, x || 25)))],
    ['scorta', t('gpv.sStock', null, 'Si scala solo con almeno'), '', t('gpv.sStockNote', null, 'pezzi in magazzino'), s.scortaMinima, (x) => cambia('scortaMinima', x)],
    ['roas', t('gpv.sRoas', null, 'Si scala solo con un ROAS di almeno'), '×', '', s.roasMinimo, (x) => cambia('roasMinimo', x)],
    ['banda', t('gpv.sBand', null, 'Sotto il pareggio si tollera fino al'), '%', t('gpv.sBandNote', null, 'prima di fermare il prodotto'), Math.round((s.banda ?? 0.3) * 100), (x) => cambia('banda', (x || 0) / 100)],
    ['scarto', t('gpv.sGap', null, 'Se Google si attribuisce oltre il'), '%', t('gpv.sGapNote', null, 'in più di Shopify, il giudizio si sospende'), Math.round((s.scartoMax ?? 0.45) * 100), (x) => cambia('scartoMax', (x || 0) / 100)],
  ]
  const salva = async (ripristina = false) => {
    setSalvo(true)
    try {
      const r = await fetch('/api/google-product-verdicts/soglie', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(ripristina ? { ripristina: true } : { soglie: s }) }).then(x => x.json())
      if (!r?.ok) { avvisa(r?.error || t('gpv.sError', null, 'Non sono riuscito a salvare le soglie'), 'errore'); return }
      setV(r.soglie); avvisa(t('gpv.sSaved', null, 'Soglie salvate: ricalcolo i giudizi'), 'ok'); onSalvate?.()
    } finally { setSalvo(false) }
  }
  return (
    <div className="gpv-soglie">
      <div className="gpv-soglie-titolo">{t('gpv.sTitle', null, 'Le tue soglie')}</div>
      {campi.map(([k, prima, unita, dopo, valore, su]) => (
        <label key={k} className="gpv-soglia">
          <span>{prima}</span>
          <input type="number" inputMode="decimal" value={valore} step={k === 'roas' ? 0.5 : 1} min={0} onChange={e => su(Number(e.target.value))} />
          {unita && <i>{unita}</i>}
          {dopo && <span>{dopo}</span>}
        </label>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
        <Bottone tipo="primario" disabled={salvo} onClick={() => salva(false)}>{t('common.save', null, 'Salva')}</Bottone>
        {pre && <Bottone tipo="discreto" disabled={salvo} onClick={() => salva(true)}>{t('gpv.sReset', null, 'Torna ai valori di partenza')}</Bottone>}
      </div>
    </div>
  )
}
