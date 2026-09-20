'use client'

import AzioneBarra from './ui/AzioneBarra'
import Pannello from './ui/Pannello'
import { Live, Scheletro, Vuoto } from './ui/Mattoni'
import PeriodoInBarra from './ui/PeriodoInBarra'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'
import { useEffect, useMemo, useRef, useState } from 'react'
import Icon from './ui/Icon'
import PlatformIcon, { PlatformBadges } from './PlatformIcon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useElenco, FiltriElenco, Paginazione } from './ui/Elenco'
import { DoveVaIlBudget, EditorSoglie } from './GpvBudgetESoglie'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useStatoTab } from '../../lib/client/statoTab'

// ============================================================================
//  Prodotti Google → verdetti SCALA / STAND-BY / FERMA, riconciliati con le
//  vendite vere di Shopify.
//
//  Regola di questa tab: un verdetto si mostra solo quando e' fondato. Le
//  bandiere in alto non sono decorazione — dicono se i numeri sotto si possono
//  usare per decidere. Periodo governato come nella tab sorella Prodotti
//  Google: due campi data propri, non il selettore globale.
// ============================================================================

const isoDay = (d) => d.toISOString().slice(0, 10)

const GRUPPI = [
  { id: 'scala',         chiave: 'gpv.scala',         colore: '#22c55e', icona: 'trending-up' },
  { id: 'standby',       chiave: 'gpv.standby',       colore: '#f59e0b', icona: 'pause' },
  { id: 'uccidi',        chiave: 'gpv.uccidi',        colore: '#ef4444', icona: 'x' },
  { id: 'daVerificare',  chiave: 'gpv.daVerificare',  colore: 'var(--text3)', icona: 'alert' },
  { id: 'insufficiente', chiave: 'gpv.insufficiente', colore: 'var(--text3)', icona: 'info' },
]

export default function GoogleVerdictsTab() {
  const { t } = useI18n()
  // Periodo, gruppo e categoria restano quando si lascia la tab e ci si torna;
  // i dati anche: al ritorno si vede subito l'ultima lettura, senza attesa.
  const [since, setSince] = useStatoTab('gpv.since', () => isoDay(new Date(Date.now() - 30 * 86400000)))
  const [until, setUntil] = useStatoTab('gpv.until', () => isoDay(new Date()))
  const [periodo, setPeriodo] = useStatoTab('gpv.periodo', 'custom')
  const [data, setData] = useState(() => inMemoria(urlVerdetti(since, until)))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [aperto, setAperto] = useStatoTab('gpv.aperto', 'scala')
  const [categoriaAperta, setCategoriaAperta] = useStatoTab('gpv.categoria', 'tutte')
  const [aggiornando, setAggiornando] = useState(false)
  const [ordine, setOrdine] = useStatoTab('gpv.ordine', { campo: 'margineNetto', verso: 'desc' })
  const [conto, setConto] = useState(null)

  // Barra di scorrimento anche IN ALTO, come nelle tabelle del report: con la
  // tabella piu' alta dello schermo, per spostarsi di lato bisognerebbe
  // scendere in fondo, scorrere e risalire. Le due barre si inseguono.
  const tabRef = useRef(null)
  const topRef = useRef(null)
  const [larghezza, setLarghezza] = useState(0)
  const [serveScroll, setServeScroll] = useState(false)
  useEffect(() => {
    const el = tabRef.current
    if (!el) return
    const misura = () => {
      setLarghezza(el.scrollWidth)
      setServeScroll(el.scrollWidth > el.clientWidth + 1)
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [data, aperto, ordine])
  const ultimoFetch = useRef(0)

  // Ogni quanto la tab si ri-controlla da sola mentre e' aperta, e distanza
  // minima fra due richieste: senza, tornare sulla scheda dopo dieci secondi
  // ne farebbe partire un'altra.
  const RITMO = 3 * 60 * 1000
  const PAUSA_MINIMA = 90 * 1000

  // `sfondo` distingue i due caricamenti. In primo piano si mostra l'attesa e
  // un errore sostituisce la tabella. Di sfondo non si mostra nulla e un
  // errore NON tocca i dati a schermo: un controllo automatico che fallisce
  // non deve cancellare numeri validi che stai guardando.
  const load = async (s = since, u = until, forza = false, sfondo = false) => {
    ultimoFetch.current = Date.now()
    const url = urlVerdetti(s, u, forza)
    // Gia' in memoria: si mostra subito, senza attesa. Se e' vecchio di piu' di
    // cinque minuti `leggi` lo aggiorna in background e avvisa con onUpdate.
    const gia = forza ? null : inMemoria(url)
    if (gia) { setData(gia); setError('') }
    if (sfondo) setAggiornando(true)
    else if (!gia) { setLoading(true); setError('') }
    try {
      const j = await leggi(url, { onUpdate: setData })
      if (!j || j.ok === false) {
        if (!sfondo) { setError(j?.error || 'Errore'); setData(null) }
        return
      }
      setData(j)
    } catch (e) {
      if (!sfondo) { setError(e?.message || 'Errore di rete'); setData(null) }
    } finally {
      if (sfondo) setAggiornando(false); else setLoading(false)
    }
  }

  // Le date si applicano da sole. Il ritardo evita una richiesta a ogni
  // colpo di tastiera nei campi data, il controllo sull'ordine evita di
  // chiedere un periodo rovesciato mentre lo stai ancora scrivendo.
  useEffect(() => {
    if (!since || !until || since > until) return
    const id = setTimeout(() => load(since, until), 400)
    return () => clearTimeout(id)
  }, [since, until]) // eslint-disable-line

  // Mentre la tab resta aperta i numeri si rinfrescano da soli, e si
  // ricontrollano quando torni sulla scheda dopo esserne uscito.
  useEffect(() => {
    const tocca = () => {
      if (document.visibilityState !== 'visible') return
      if (Date.now() - ultimoFetch.current < PAUSA_MINIMA) return
      load(since, until, false, true)
    }
    const id = setInterval(tocca, RITMO)
    document.addEventListener('visibilitychange', tocca)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', tocca) }
  }, [since, until]) // eslint-disable-line

  const money = (v) => soldi(v)
  const num1 = (v) => v == null ? '—' : Number(v).toLocaleString('it-IT', { maximumFractionDigits: 1 })
  const pct = (v) => v == null ? '—' : `${(v * 100).toLocaleString('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })}%`

  const s = data?.soglie
  const q = data?.qualita

  // Le macro categorie nascono dai DATI (metafield pdp.categoria): se domani
  // il negozio ne aggiunge una, compare da sola. Ordinate per numerosita'.
  const tutteLeRighe = data?.righe || []
  const categorie = useMemo(() => {
    const m = new Map()
    for (const r of tutteLeRighe) {
      const k = r.categoria || '__nessuna'
      m.set(k, (m.get(k) || 0) + 1)
    }
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([id, n]) => ({ id, n }))
  }, [tutteLeRighe])

  // Il filtro per categoria viene PRIMA: i conteggi sulle bandiere dei
  // verdetti si calcolano su questo sottoinsieme, altrimenti selezionando
  // "Borse" mostrerebbero ancora i numeri dell'intero catalogo.
  const righeCategoria = categoriaAperta === 'tutte'
    ? tutteLeRighe
    : tutteLeRighe.filter(r => (r.categoria || '__nessuna') === categoriaAperta)
  const contaVerdetto = (v) => righeCategoria.filter(r => r.verdetto === v).length

  // Se il gruppo aperto e' vuoto quando arrivano i dati, si apre il primo che
  // ha prodotti: "Da scalare" a zero faceva sembrare vuota tutta la tab. Vale
  // solo all'arrivo dei dati: un gruppo vuoto scelto a mano resta aperto.
  useEffect(() => {
    if (!data?.righe?.length) return
    if (data.righe.some(r => r.verdetto === aperto)) return
    const primo = GRUPPI.find(g => data.righe.some(r => r.verdetto === g.id))
    if (primo) setAperto(primo.id)
  }, [data]) // eslint-disable-line react-hooks/exhaustive-deps

  // Le righe del gruppo aperto, GIA' ordinate. Chi non ha il dato finisce in
  // fondo in entrambi i versi: trattare un valore assente come zero lo farebbe
  // sembrare il peggiore, che e' un'affermazione diversa da "non lo so".
  const righeOrdinate = useMemo(() => {
    const base = righeCategoria.filter(r => r.verdetto === aperto)
    return [...base].sort((a, b) => {
      const va = valoreDi(a, ordine.campo), vb = valoreDi(b, ordine.campo)
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return ordine.verso === 'desc' ? vb - va : va - vb
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tutteLeRighe, categoriaAperta, aperto, ordine])
  // Ricerca per nome, marchi e pagine, sull'elenco ordinato.
  const elenco = useElenco(righeOrdinate, { nome: r => r.title, altriCampi: r => `${r.itemId} ${(r.skus || []).join(' ')}`, marchio: r => r.vendor, chiave: 'performanceGoogle' })
  const panel = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 16, padding: 18 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 760 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            
            <PlatformBadges sources={['google', 'shopify']} size={24} />
            <Live />
          </div>
        </div>
        <div className="barra-strumenti" style={{ display: 'flex', alignItems: 'flex-end', gap: 10, flexWrap: 'wrap' }}>
          {/* Lo stesso selettore del periodo di tutte le altre tab: calendario e periodi pronti. */}
          <PeriodoInBarra value={{ preset: periodo, since, until }} disabled={loading}
            onChange={(v) => { setPeriodo(v.preset || 'custom'); setSince(v.since); setUntil(v.until) }} />
          <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => load(since, until, true)} disabled={loading} gira={loading} />
        </div>
      </div>

      {error && <div style={{ ...panel, color: 'var(--negativo)' }}>{error}</div>}
      {loading && !data && <Scheletro kpi={0} righe={10} />}

      {/* Sopra la tabella restano solo gli AVVISI: cio' che rende un numero
          meno affidabile. Le regole del giudizio si aprono a richiesta — la
          tabella deve farsi capire da sola, senza un foglio di istruzioni. */}
      {data && (() => {
        const avvisi = []
        if (q?.catalogoErrore) avvisi.push({ grave: true, testo: t('gpv.catalogError', { e: q.catalogoErrore }, `Lettura catalogo Shopify fallita: ${q.catalogoErrore}. Costi, giacenze e categorie non sono disponibili.`) })
        if (q?.venditeErrore) avvisi.push({ grave: true, testo: t('gpv.salesError', { e: q.venditeErrore }, `Lettura vendite Shopify fallita: ${q.venditeErrore}. Fatturato reale e scarto non sono calcolabili.`) })
        if (q?.conCosto != null && q.conCosto < q.prodottiGoogle) avvisi.push({ testo: t('gpv.costCoverage', { n: q.conCosto, tot: q.prodottiGoogle }, `Con costo a catalogo: ${q.conCosto} su ${q.prodottiGoogle} prodotti`) })
        if (q?.coperturaAbbinamentoPct != null && q.coperturaAbbinamentoPct < 70) avvisi.push({ testo: `${t('gpv.coverage', { n: q.abbinati, tot: q.prodottiGoogle, pct: q.coperturaAbbinamentoPct }, `Abbinati a un prodotto Shopify: ${q.abbinati} su ${q.prodottiGoogle} (${q.coperturaAbbinamentoPct}%)`)} · ${t('gpv.coverageLow', null, 'Copertura bassa: i prodotti non abbinati restano senza verdetto.')}` })
        if (q && !q.ordiniShopifyCompleti) avvisi.push({ testo: t('gpv.ordersPartial', null, 'Shopify limita gli ordini agli ultimi 60 giorni: gli ordini reali non coprono tutto il periodo.') })
        if (q?.senzaVenditeReali > 0) avvisi.push({ testo: t('gpv.noRealSales', { n: q.senzaVenditeReali }, `Google attribuisce vendite a ${q.senzaVenditeReali} prodotti che su Shopify non hanno fatturato nulla nel periodo: per loro il verdetto resta sospeso.`) })
        if (q?.venditeTroncate) avvisi.push({ testo: t('gpv.salesTruncated', null, 'Elenco vendite Shopify al limite: per i prodotti fuori elenco il fatturato resta non misurabile.') })
        return (
          <div style={{ ...panel, padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 7 }}>
            {avvisi.map((a, k) => (
              <div key={k} style={{ fontSize: 13, fontWeight: a.grave ? 700 : 600, color: a.grave ? '#ef4444' : '#f59e0b' }}>{a.testo}</div>
            ))}
            <details className="gpv-regole">
              <summary>
                {t('gpv.howJudged', null, 'Come nasce il giudizio')}
                {data?.updatedAt && (
                  <span>
                    {t('gpv.updatedAt', { at: new Date(data.updatedAt).toLocaleString('it-IT', { useGrouping: 'always' }) }, `Calcolato il ${new Date(data.updatedAt).toLocaleString('it-IT', { useGrouping: 'always' })}`)}
                    {aggiornando ? ` · ${t('gpv.refreshing', null, 'aggiornamento in corso')}` : ''}
                  </span>
                )}
              </summary>
              <ul>
                <li>{t('gpv.ruleBill', { x: s?.iva ?? 22 }, `Il conto di ogni riga: venduto da Google, meno l'IVA al ${s?.iva ?? 22}%, meno la merce, meno la pubblicità. Quel che resta è il guadagno.`)}</li>
                <li>{t('gpv.rulePieces', null, 'La merce si conta solo sui pezzi venduti da Google (venduto ÷ prezzo medio di vendita), non su tutti quelli usciti dal negozio.')}</li>
                {s?.rapportoPrezzoSpesa > 0 && <li>{t('gpv.minSpend', { x: money(50), y: money(50 / s.rapportoPrezzoSpesa) }, `Si giudica quando la spesa supera un quarto del prezzo di vendita del prodotto: ${money(50)} di prezzo significa soglia a ${money(50 / s.rapportoPrezzoSpesa)}.`)}</li>}
                <li>{t('gpv.scaleRules', { n: s?.scortaMinima ?? 10, r: s?.roasMinimo ?? 4 }, `Per scalare servono almeno ${s?.scortaMinima ?? 10} pezzi in giacenza, scorte che coprano un altro periodo come questo, e ROAS almeno ${s?.roasMinimo ?? 4}. Altrimenti il prodotto passa in stand-by.`)}</li>
                <li>{t('gpv.gapNote', { x: Math.round((s?.scartoMax || 0) * 100) }, `Scarto fra valore attribuito da Google e fatturato Shopify. Oltre il ${Math.round((s?.scartoMax || 0) * 100)}% il verdetto si sospende.`)}</li>
                <li>{t('gpv.legend', null, 'Uno 0 e\' un fatto: nel periodo non ha venduto. n/d vuol dire che il dato non e\' misurabile, non che sia zero.')}</li>
                {q && !q.ordiniGoogleReali && <li>{t('gpv.ordersProxy', null, 'Google non espone gli ordini su questo account: la colonna mostra le conversioni.')}</li>}
                {q?.confrontoOrdiniReali === false && <li>{t('gpv.deltaOrdiniAssente', null, 'Ordini reali senza confronto: la lettura del periodo precedente e\' stata saltata per non superare il tempo massimo della pagina.')}</li>}
              </ul>
              <EditorSoglie soglie={s} t={t} onSalvate={() => load(since, until, true)} />
            </details>
          </div>
        )
      })()}

      {!loading && tutteLeRighe.length > 0 && (
        <DoveVaIlBudget righe={tutteLeRighe} t={t}
          periodoGiorni={since && until ? Math.round((Date.parse(until) - Date.parse(since)) / 86400000) + 1 : null} />
      )}

      {/* Macro categorie dal metafield pdp.categoria. Compaiono solo se il
          catalogo ne ha davvero piu' di una: una fascia con un solo bottone
          sarebbe un comando che non comanda niente. */}
      {data && categorie.length > 1 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {[{ id: 'tutte', n: tutteLeRighe.length }, ...categorie].map(c => {
            const attivo = categoriaAperta === c.id
            const nome = c.id === 'tutte' ? t('gpv.allCategories', null, 'Tutte le categorie')
              : c.id === '__nessuna' ? t('gpv.noCategory', null, 'Senza categoria')
              : c.id
            return (
              <button key={c.id} type="button" onClick={() => setCategoriaAperta(c.id)}
                className={`ly-filtro senza-tocco${attivo ? ' acceso' : ''}`} style={{ textTransform: 'capitalize' }}>
                {nome.toLowerCase()}
                <span style={{ fontSize: 11.5, fontWeight: 640, color: 'var(--text3)' }}>{c.n}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Filtri orizzontali: una categoria per volta, sempre una selezionata.
          Come pannelli impilati costringevano a scorrere e, richiudendoli,
          restava una pagina vuota. */}
      {data && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {GRUPPI.map(g => {
            const n = contaVerdetto(g.id)
            const attivo = aperto === g.id
            return (
              <button key={g.id} type="button" onClick={() => setAperto(g.id)}
                className={`ly-filtro senza-tocco${attivo ? ' acceso' : ''}`}>
                <span style={{ width: 9, height: 9, borderRadius: 6, background: g.colore, flexShrink: 0 }} />
                {t(g.chiave, null, g.id)}
                <span style={{
                  fontSize: 13, fontWeight: 640, color: attivo ? g.colore : 'var(--text3)',
                  background: 'var(--glass2)', borderRadius: 999, padding: '1px 8px',
                }}>{n}</span>
              </button>
            )
          })}
        </div>
      )}

      {/* Tabella della categoria selezionata.
          La riga E' il conto: venduto, meno IVA, meno merce, meno pubblicita',
          uguale guadagno. Prima c'erano tredici colonne, ognuna col suo numero
          e nessuna che dicesse da dove veniva: qui ogni cifra nasce da quelle
          alla sua sinistra, con il segno scritto davanti. */}
      {data && (() => {
        const base = righeCategoria.filter(r => r.verdetto === aperto)
        if (base.length === 0) {
          return <div style={panel}><Vuoto titolo={t('gpv.empty', null, 'Nessun prodotto in questo gruppo.')} testo={t('gpv.emptyHint', null, 'Scegli un altro gruppo qui sopra, oppure allarga il periodo: con pochi giorni la maggior parte dei prodotti non ha speso abbastanza per essere giudicata.')} /></div>
        }
        const righe = elenco.visibili
        const clicca = (campo) => setOrdine(o => o.campo === campo
          ? { campo, verso: o.verso === 'desc' ? 'asc' : 'desc' }
          : { campo, verso: 'desc' })
        const conCosto = elenco.filtrate.filter(r => r.cogs != null)
        const senzaCosto = elenco.filtrate.length - conCosto.length
        const tot = contoDi({
          convValue: somma(conCosto, 'convValue'), iva: somma(conCosto.map(r => ({ iva: ivaDi(r) })), 'iva'),
          cogs: somma(conCosto, 'cogs'), cost: somma(conCosto, 'cost'), margineNetto: somma(conCosto, 'margineNetto'),
        })
        const totShopify = somma(elenco.filtrate.filter(r => !statoDi(r, 'shopifyRevenue')), 'shopifyRevenue')

        return (
          <div style={{ ...panel, minWidth: 0 }}>
            <FiltriElenco elenco={elenco} tr={t} segnaposto={t('el.searchItem2', null, 'Cerca per nome, SKU o ID articolo…')} />
            {/* minWidth:0 e' cio' che mancava: senza, il contenitore si allarga
                oltre la pagina invece di scorrere e l'ultima colonna finisce
                tagliata sotto il bordo. */}
            {serveScroll && (
              <div ref={topRef} className="gpv-scroll-sopra"
                onScroll={() => { if (tabRef.current && topRef.current) tabRef.current.scrollLeft = topRef.current.scrollLeft }}
                style={{ width: '100%', overflowX: 'auto', overflowY: 'hidden', height: 12, marginBottom: 6 }}>
                <div style={{ width: larghezza, height: 1 }} />
              </div>
            )}
            <div ref={tabRef} className="m-scrollx"
              onScroll={() => { if (topRef.current && tabRef.current) topRef.current.scrollLeft = tabRef.current.scrollLeft }}
              style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
              <table className="tabella-ferma reg-tab gpv-tab" style={{ minWidth: 1040 }}>
                <thead>
                  <tr className="reg-fasce">
                    <th className="reg-vuota reg-primo" />
                    <th className="fam fam-pub">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PlatformIcon platform="google" size={11} />{t('gpv.bandSold', null, 'Incassato')}</span>
                    </th>
                    <th colSpan={3} className="fam fam-traffico">{t('gpv.bandMinus', null, 'Cosa togliamo')}</th>
                    <th colSpan={2} className="fam fam-resa">{t('gpv.bandLeft', null, 'Cosa resta')}</th>
                    <th className="fam fam-vendite">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><PlatformIcon platform="shopify" size={11} />{t('gpv.bandCheck', null, 'Controllo')}</span>
                    </th>
                  </tr>
                  <tr className="reg-colonne">
                    <th className="reg-primo gp-prodotto gpv-prodotto">{t('gpv.colProduct', null, 'Prodotto')}</th>
                    {COLONNE.map(c => {
                      const attiva = ordine.campo === c.id
                      return (
                        <th key={c.id} onClick={c.ferma ? undefined : () => clicca(c.id)}
                          className={[c.fam, c.stacco ? 'stacco' : '', attiva ? 'attiva' : ''].filter(Boolean).join(' ')}
                          style={c.ferma ? { cursor: 'default' } : undefined}>
                          {c.segno && <b className="gpv-segno">{c.segno}</b>}
                          {c.punto && <i className="gpv-punto" style={{ background: c.punto }} />}
                          {t(c.chiave, null, c.fallback)}{attiva ? (ordine.verso === 'desc' ? ' ▾' : ' ▴') : ''}
                        </th>
                      )
                    })}
                  </tr>
                </thead>
                <tbody>
                  {righe.map((r, k) => {
                    const c = contoDi(r)
                    const statoShop = statoDi(r, 'shopifyRevenue')
                    const nonTorna = r.scarto != null && s?.scartoMax != null && Math.abs(r.scarto) > s.scartoMax
                    return (
                      <tr key={r.itemId} className={conto?.itemId === r.itemId ? 'riga-aperta' : undefined} onClick={() => setConto(r)} title={t('gpv.openBill', null, 'Apri il conto del prodotto')}>
                        <td className="reg-primo gp-prodotto gpv-prodotto">
                          <div className="reg-riga-nome">
                            <span className="reg-posto">{elenco.da + k + 1}</span>
                            {r.image
                              ? <img src={miniatura(r.image, 36)} loading="lazy" alt="" className="gpv-foto" />
                              : <div className="gpv-foto gpv-foto-vuota" />}
                            <div style={{ minWidth: 0 }}>
                              <div className="reg-nome gpv-titolo">{r.title}</div>
                              {(r.vendor || r.stato) && (
                                <div className="reg-sotto">
                                  {r.vendor}
                                  {r.stato && <span className="gpv-stato">{r.stato === 'DRAFT' ? t('gpv.stDraft', null, 'in bozza') : r.stato === 'ARCHIVED' ? t('gpv.stArchived', null, 'archiviato') : String(r.stato).toLowerCase()}</span>}
                                </div>
                              )}
                              {/* Sul telefono il risultato sta qui: la colonna del
                                  guadagno e' a quattro colonne di distanza. */}
                              <div className="gpv-esito-mobile"><Risultato v={c.M.guadagno} money={money} /></div>
                            </div>
                          </div>
                        </td>
                        <td className="fam-pub stacco"><span className="reg-valore">{money(c.M.venduto)}</span></td>
                        <td className="fam-traffico stacco"><Meno v={c.M.iva} money={money} /></td>
                        <td className="fam-traffico">
                          {c.merce == null
                            ? <span className="reg-pillola gpv-manca">{t('gpv.noCost', null, 'costo mancante')}</span>
                            : <><Meno v={c.M.merce} money={money} /><div className="reg-sotto">{num1(r.pezzi)} × {money(r.costoUnitario)}</div></>}
                        </td>
                        <td className="fam-traffico"><Meno v={c.M.pub} money={money} /></td>
                        <td className="fam-resa stacco">
                          <Risultato v={c.M.guadagno} money={money} />
                          {c.guadagno != null && c.venduto >= 1 && Math.abs(c.guadagno) <= c.venduto && (
                            <div className="reg-sotto">{t('gpv.ofSold', { x: Math.round(c.guadagno / c.venduto * 100) }, `${Math.round(c.guadagno / c.venduto * 100)}% del venduto`)}</div>
                          )}
                        </td>
                        <td className="fam-resa"><BarraEuro c={c} /></td>
                        <td className="fam-vendite stacco">
                          {statoShop
                            ? <span style={{ color: 'var(--text3)' }} title={t('gpv.nd' + statoShop.charAt(0).toUpperCase() + statoShop.slice(1), null, statoShop)}>n/d</span>
                            : <>
                                <span className="reg-valore">{r.scarto != null && <b className={`gpv-esito ${nonTorna ? 'no' : 'si'}`}>{nonTorna ? '≠' : '✓'}</b>}{money(r.shopifyRevenue)}</span>
                                {r.shopifyOrders != null && (
                                  <div className="reg-sotto">{r.shopifyOrders === 1 ? t('gpv.orderOne', null, '1 ordine') : t('gpv.ordersN', { n: r.shopifyOrders }, `${r.shopifyOrders} ordini`)}</div>
                                )}
                              </>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                {conCosto.length > 0 && (
                  <tfoot>
                    <tr>
                      <td className="reg-primo gp-prodotto gpv-prodotto">
                        {t('gpv.total', { n: conCosto.length }, `Totale · ${conCosto.length} prodotti`)}
                        {senzaCosto > 0 && <div className="reg-sotto">{t('gpv.totalNoCost', { n: senzaCosto }, `${senzaCosto} senza costo: fuori dal totale`)}</div>}
                      </td>
                      <td className="stacco">{money(tot.M.venduto)}</td>
                      <td className="stacco"><Meno v={tot.M.iva} money={money} /></td>
                      <td><Meno v={tot.M.merce} money={money} /></td>
                      <td><Meno v={tot.M.pub} money={money} /></td>
                      <td className="stacco"><Risultato v={tot.M.guadagno} money={money} /></td>
                      <td><BarraEuro c={tot} /></td>
                      <td className="stacco">{money(totShopify)}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
            <Paginazione elenco={elenco} tr={t} esporta={{ nome: `performance-google-${aperto}`, colonne: [['Prodotto', r => r.title], ['Marchio', r => r.vendor], ['ID articolo', r => (r.itemIds || [r.itemId]).join(' ')], ['Stato', r => r.stato || 'ACTIVE'], ['Giudizio', r => r.verdetto], ['Venduto da Google', r => r.convValue], ['IVA', r => r.iva], ['Pezzi', r => r.pezzi], ['Costo unitario', r => r.costoUnitario], ['Merce', r => r.cogs], ['Pubblicità', r => r.cost], ['Guadagno', r => r.margineNetto], ['ROAS', r => r.roas], ['POAS', r => r.poas], ['Venduto su Shopify', r => r.shopifyRevenue], ['Ordini Shopify', r => r.shopifyOrders], ['Giacenza', r => r.giacenza]] }} />
            <style>{`
              .gpv-scroll-sopra::-webkit-scrollbar { height: 10px }
              .gpv-scroll-sopra::-webkit-scrollbar-track { background: var(--glass2); border-radius: 999px }
              .gpv-scroll-sopra::-webkit-scrollbar-thumb { background: var(--border); border-radius: 999px }
              .gpv-scroll-sopra::-webkit-scrollbar-thumb:hover { background: var(--text3) }
              .gpv-scroll-sopra { scrollbar-width: thin }
            `}</style>
          </div>
        )
      })()}

      {conto && (
        (() => {
          // Le frecce scorrono l'elenco cosi' come lo si vede: filtrato e ordinato, tutte le pagine.
          const lista = elenco.filtrate
          const i = lista.findIndex(x => x.itemId === conto.itemId)
          return (
            <ContoProdotto r={conto} onClose={() => setConto(null)}
              onPrecedente={i > 0 ? () => setConto(lista[i - 1]) : undefined}
              onSuccessiva={i >= 0 && i < lista.length - 1 ? () => setConto(lista[i + 1]) : undefined}
              posizione={i >= 0 ? `${i + 1} / ${lista.length}` : undefined}
              t={t} money={money} num1={num1} pct={pct} soglie={s} rangePrec={data?.rangePrec} />
          )
        })()
      )}

    </div>
  )
}

const urlVerdetti = (s, u, forza = false) => `/api/google-product-verdicts?since=${s}&until=${u}${forza ? '&refresh=1' : ''}`

// ── Colonne: la riga si legge come una sottrazione ─────────────────────────
// `segno` e' l'operazione scritta davanti al nome, `punto` il colore che la
// stessa voce ha nella barra "dove va ogni euro": intestazione e barra si
// spiegano a vicenda, senza una legenda da andare a cercare.
const COLORE = { iva: '#94a3b8', merce: '#a78bfa', pub: '#eab308', guadagno: '#22c55e', perdita: '#ef4444' }
const COLONNE = [
  { id: 'convValue',      fam: 'fam-pub',      stacco: true, chiave: 'gpv.cSold',  fallback: 'Venduto' },
  { id: 'iva',            fam: 'fam-traffico', stacco: true, chiave: 'gpv.cVat',   fallback: 'IVA',        segno: '−', punto: COLORE.iva },
  { id: 'cogs',           fam: 'fam-traffico',               chiave: 'gpv.cGoods', fallback: 'Merce',      segno: '−', punto: COLORE.merce },
  { id: 'cost',           fam: 'fam-traffico',               chiave: 'gpv.cAds',   fallback: 'Pubblicità', segno: '−', punto: COLORE.pub },
  { id: 'margineNetto',   fam: 'fam-resa',     stacco: true, chiave: 'gpv.cGain',  fallback: 'Guadagno',   segno: '=', punto: COLORE.guadagno },
  { id: 'barra',          fam: 'fam-resa',     ferma: true,  chiave: 'gpv.cEuro',  fallback: 'Dove va ogni euro' },
  { id: 'shopifyRevenue', fam: 'fam-vendite',  stacco: true, chiave: 'gpv.cShop',  fallback: 'Venduto vero' },
]

const ivaDi = (r) => r.iva != null ? r.iva : (r.ricavoNetto != null && r.convValue != null ? r.convValue - r.ricavoNetto : null)
const somma = (righe, campo) => righe.reduce((a, r) => a + (Number(r[campo]) || 0), 0)

const valoreDi = (r, campo) => {
  if (campo === 'iva') return ivaDi(r)
  const v = r[campo]
  return v == null ? null : v
}

// Perche' una cella e' vuota. Vale solo per i numeri che dipendono da Shopify:
// altrove un valore assente e' semplicemente non calcolabile.
const statoDi = (r, campo) => {
  if (campo === 'shopifyRevenue' && r.venditeStato && r.venditeStato !== 'ok' && r.venditeStato !== 'zero') return r.venditeStato
  if (campo === 'shopifyOrders' && r.ordiniStato && r.ordiniStato !== 'ok' && r.ordiniStato !== 'zero') return r.ordiniStato
  return null
}

// Il conto di una riga. `M` sono le cifre MOSTRATE, in euro interi: chi rifa'
// la sottrazione a mano deve ritrovare il guadagno al centesimo... dell'euro.
// Arrotondando ogni voce per conto suo capita che 174 − 31 − 97 − 70 faccia
// −24 mentre il guadagno vero, arrotondato, e' −25. L'euro di scarto lo
// assorbe l'IVA, la voce meno guardata; i centesimi esatti stanno nel
// dettaglio del prodotto.
const contoDi = (r) => {
  const venduto = Number(r.convValue) || 0
  const iva = ivaDi(r)
  const merce = r.cogs != null ? Number(r.cogs) : null
  const pub = Number(r.cost) || 0
  const guadagno = merce != null && r.margineNetto != null ? Number(r.margineNetto) : null
  const M = {
    venduto: Math.round(venduto), merce: merce == null ? null : Math.round(merce),
    pub: Math.round(pub), guadagno: guadagno == null ? null : Math.round(guadagno),
  }
  M.iva = Math.round(iva || 0)
  if (M.guadagno != null) {
    const assorbita = M.venduto - M.merce - M.pub - M.guadagno
    // Con cifre piccolissime l'euro di scarto non ci sta nell'IVA (verrebbe
    // negativa): li' lo prende il risultato, e la riga torna lo stesso.
    if (assorbita >= 0 && Math.abs(assorbita - M.iva) <= 1) M.iva = assorbita
    else M.guadagno = M.venduto - M.iva - M.merce - M.pub
  }
  return { venduto, iva: iva || 0, merce, pub, guadagno, M }
}

// Una voce che si toglie: il segno meno sta davanti, piu' chiaro della cifra.
function Meno({ v, money }) {
  if (v == null) return <span style={{ color: 'var(--text3)' }}>—</span>
  return <span className="gpv-meno"><b className="gpv-segno">−</b>{money(v)}</span>
}

// Quel che resta: verde se e' un guadagno, rosso se e' una perdita.
function Risultato({ v, money, grande = false }) {
  if (v == null) return <span className="reg-pillola gpv-manca">?</span>
  // Pochi centesimi arrotondati a zero non sono ne' un guadagno ne' una perdita.
  if (v === 0) return <span className="reg-pillola media">{money(0)}</span>
  return (
    <span className={`reg-pillola ${v > 0 ? 'gpv-su' : 'sotto'}`} style={grande ? { fontSize: 15, padding: '5px 14px' } : undefined}>
      {v > 0 ? '+' : '−'}{money(Math.abs(v))}
    </span>
  )
}

// Dove va ogni euro incassato. La barra e' lunga quanto il venduto: i pezzi
// colorati sono IVA, merce e pubblicita', quel che avanza e' verde. Se le
// spese superano il venduto la barra si allunga e la parte che sfora e'
// tratteggiata in rosso: la perdita si VEDE, non si legge.
function BarraEuro({ c, larga = false }) {
  const merce = c.merce || 0
  const spese = c.iva + merce + c.pub
  const scala = Math.max(c.venduto, spese)
  if (!(scala > 0)) return <div className="gpv-euro" style={larga ? { width: '100%' } : undefined} />
  const w = (x) => `${Math.max(0, x / scala * 100)}%`
  const avanzo = c.venduto - spese
  return (
    <div className="gpv-euro" style={larga ? { width: '100%', height: 14 } : undefined}>
      <span style={{ width: w(c.iva), background: COLORE.iva }} />
      <span style={{ width: w(merce), background: COLORE.merce }} />
      <span style={{ width: w(c.pub), background: COLORE.pub }} />
      {avanzo > 0 && <span className={c.merce == null ? 'gpv-euro-ignoto' : ''} style={{ width: w(avanzo), background: c.merce == null ? undefined : COLORE.guadagno }} />}
      {avanzo < 0 && <em className="gpv-euro-sforo" style={{ left: w(c.venduto) }} />}
    </div>
  )
}

// ── Il conto di un prodotto, per esteso ────────────────────────────────────
// Lo scontrino con i centesimi, il confronto col periodo prima e gli indici
// che nella tabella non ci sono piu' (ROAS, POAS, CPA, giacenza): servono a
// chi vuole approfondire, non a chi deve capire se il prodotto guadagna.
function ContoProdotto({ r, onClose, onPrecedente, onSuccessiva, posizione, t, money, num1, pct, soglie, rangePrec }) {

  const euro = (v) => soldi(v, 2)
  const c = contoDi(r)
  const p = r.prec ? contoDi({ ...r.prec, iva: r.prec.convValue != null ? r.prec.convValue - r.prec.convValue / (1 + (soglie?.iva ?? 22) / 100) : null }) : null
  const motivo = r.motivo
    ? t('gpv.motivo' + r.motivo.charAt(0).toUpperCase() + r.motivo.slice(1), { x: money(r.sogliaSpesa ?? soglie?.sogliaRipiego ?? 25), n: soglie?.scortaMinima ?? 10, r: soglie?.roasMinimo ?? 4 }, r.motivo)
    : ''
  const voce = (segno, punto, nome, nota, ora, prima, forte) => (
    <div className={`gpv-voce${forte ? ' forte' : ''}`}>
      <b className="gpv-segno">{segno}</b>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="gpv-voce-nome">{punto && <i className="gpv-punto" style={{ background: punto }} />}{nome}</div>
        {nota && <div className="reg-sotto">{nota}</div>}
      </div>
      {p && <span className="gpv-voce-prima">{prima}</span>}
      <span className="gpv-voce-ora">{ora}</span>
    </div>
  )
  const segnato = (v) => v == null ? '?' : `${v >= 0 ? '+' : '−'}${euro(Math.abs(v))}`
  const kpi = (etichetta, valore, nota) => (
    <div className="prov-kpi">
      <div className="prov-kpi-et">{etichetta}</div>
      <div className="prov-kpi-val" style={{ fontSize: 15 }}>{valore}</div>
      {nota && <div className="prov-kpi-nota">{nota}</div>}
    </div>
  )
  // Senza i dati di carrello Google risponde 0 ordini anche dove ha venduto:
  // in quel caso valgono le conversioni.
  const ordiniGoogle = r.orders > 0 ? r.orders : r.conversions

  return (
    <Pannello titolo={r.title} sotto={[r.vendor, r.itemIds?.length > 1 ? t('gpv.variants', { n: r.itemIds.length }, `${r.itemIds.length} varianti pubblicizzate, contate insieme`) : null, motivo].filter(Boolean).join(' · ')} immagine={r.image ? miniatura(r.image, 46) : null}
      onClose={onClose} onPrecedente={onPrecedente} onSuccessiva={onSuccessiva} posizione={posizione}>
          <div className="prov-scheda" style={{ marginBottom: 14 }}>
            {p && (
              <div className="gpv-voce gpv-voce-testa">
                <span style={{ flex: 1 }} />
                <span className="gpv-voce-prima" title={rangePrec ? `${rangePrec.since} – ${rangePrec.until}` : undefined}>{t('gpv.billBefore', null, 'Periodo prima')}</span>
                <span className="gpv-voce-ora">{t('gpv.billNow', null, 'Adesso')}</span>
              </div>
            )}
            {voce('', null, t('gpv.billSold', null, 'Venduto da Google'), null, euro(c.venduto), p ? euro(p.venduto) : null)}
            {voce('−', COLORE.iva, t('gpv.billVat', { x: soglie?.iva ?? 22 }, `IVA ${soglie?.iva ?? 22}%`), null, euro(c.iva), p ? euro(p.iva) : null)}
            {voce('−', COLORE.merce, t('gpv.cGoods', null, 'Merce'),
              c.merce == null ? t('gpv.noCost', null, 'costo mancante') : t('gpv.billPieces', { n: num1(r.pezzi), c: euro(r.costoUnitario) }, `${num1(r.pezzi)} pezzi × ${euro(r.costoUnitario)}`),
              c.merce == null ? '?' : euro(c.merce), p ? (p.merce == null ? '?' : euro(p.merce)) : null)}
            {voce('−', COLORE.pub, t('gpv.billAds', null, 'Pubblicità su Google'), null, euro(c.pub), p ? euro(p.pub) : null)}
            {voce('=', c.guadagno != null && c.guadagno < 0 ? COLORE.perdita : COLORE.guadagno,
              c.guadagno != null && c.guadagno < 0 ? t('gpv.billLoss', null, 'Perdita') : t('gpv.cGain', null, 'Guadagno'), null,
              <span style={{ color: c.guadagno == null ? 'var(--text3)' : c.guadagno < 0 ? COLORE.perdita : 'var(--gpv-shopify)' }}>{segnato(c.guadagno)}</span>,
              p ? segnato(p.guadagno) : null, true)}
            <div style={{ marginTop: 14 }}><BarraEuro c={c} larga /></div>
          </div>

          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
            {kpi('ROAS', num1(r.roas), t('gpv.kRoasNote', null, 'venduto ÷ pubblicità'))}
            {kpi('POAS', num1(r.poas), t('gpv.kPoasNote', null, 'guadagno prima della pubblicità ÷ pubblicità'))}
            {kpi('CPA', r.cpa == null ? '—' : money(r.cpa), r.cpa == null
              ? t('gpv.kCpaNone', null, 'si calcola da un ordine intero in su')
              : t('gpv.kCpaNote', null, 'pubblicità ÷ ordini'))}
            {kpi(t('gpv.kOrders', null, 'Ordini Google'), ordiniGoogle == null ? '—' : (ordiniGoogle > 0 && ordiniGoogle < 1 ? Number(ordiniGoogle).toLocaleString('it-IT', { maximumFractionDigits: 2 }) : num1(ordiniGoogle)), ordiniGoogle > 0 && ordiniGoogle < 1 ? t('gpv.kOrdersFraction', null, 'una parte di ordine: Google lo divide fra più prodotti') : r.clicks != null ? t('gpv.kClicks', { n: Number(r.clicks).toLocaleString('it-IT', { useGrouping: 'always' }) }, `${Number(r.clicks).toLocaleString('it-IT', { useGrouping: 'always' })} clic`) : null)}
            {kpi(t('gpv.kAvgPrice', null, 'Prezzo medio'), money(r.prezzoMedio), t('gpv.kAvgPriceNote', null, 'pezzi di Google = venduto ÷ prezzo medio'))}
            {kpi(t('gpv.kShopSold', null, 'Venduto su Shopify'), statoDi(r, 'shopifyRevenue') ? 'n/d' : money(r.shopifyRevenue),
              r.shopifyUnits != null ? t('gpv.kShopUnits', { n: r.shopifyUnits }, `${r.shopifyUnits} pezzi, da tutti i canali`) : null)}
            {kpi(t('gpv.kGap', null, 'Google contro Shopify'), r.scarto === 0 ? t('gpv.kGapOk', null, 'nella norma') : pct(r.scarto),
              soglie?.scartoMax != null ? t('gpv.kGapNote', { x: Math.round(soglie.scartoMax * 100) }, `oltre il ${Math.round(soglie.scartoMax * 100)}% il giudizio si sospende`) : null)}
            {kpi(t('gpv.kStock', null, 'In magazzino'), r.giacenza == null ? '—' : Number(r.giacenza).toLocaleString('it-IT', { useGrouping: 'always' }), null)}
          </div>
    </Pannello>
  )
}
