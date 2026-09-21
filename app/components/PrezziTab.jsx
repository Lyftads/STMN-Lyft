'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { inMemoria, leggi } from '../../lib/clientCache'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'
import { Scheda, Kpi, GrigliaKpi, Filtri, Bottone, Vuoto } from './ui/Mattoni'
import { useElenco, FiltriElenco, Paginazione } from './ui/Elenco'
import Pannello from './ui/Pannello'
import PlatformIcon from './PlatformIcon'
import Icon from './ui/Icon'

// ============================================================================
//  PREZZI — lo stesso articolo: da noi, sul mercato, dalla casa madre.
//
//  Due fonti, entrambe gratuite, lette da sole due volte al giorno:
//   · Google Merchant Center → il PREZZO DI MERCATO di ogni articolo (a quanto lo vendono gli altri
//     negozi che pubblicizzano lo stesso EAN), il prezzo suggerito e i clic degli ultimi 30 giorni;
//   · i siti su Shopify (le case madri che lo usano, o qualunque concorrente si aggiunga) → il loro
//     prezzo, abbinato sul codice del produttore che sta nei nostri SKU.
//  In piu' il COSTO: sapere di essere sopra il mercato non basta, serve il margine che resta
//  scendendo a quel prezzo.
//  Tabella con lo stesso impianto di "Prodotti Google": fasce per fonte, colonne ordinabili, elenco
//  condiviso (ricerca, pagine, CSV), riga che apre la scheda dell'articolo.
// ============================================================================
const URL = '/api/prezzi'

// Poche colonne, ognuna con il numero e una riga sotto: tutto sta nello schermo, niente scorrimento
// laterale (Marino: "la tabella che scorre verso destra e sinistra non mi piace").
const COLONNE = [
  { id: 'prezzo', chiave: 'prz.cPrice', fallback: 'Prezzo', fam: 'fam-vendite', stacco: true, v: r => r.prezzo },
  { id: 'margine', chiave: 'prz.cMargin', fallback: 'Margine', fam: 'fam-vendite', v: r => r.margine },
  { id: 'mercato', chiave: 'prz.cMarket', fallback: 'Prezzo di mercato', fam: 'fam-pub', stacco: true, v: r => r.mercato?.prezzo },
  { id: 'scartoMercato', chiave: 'prz.cGap', fallback: 'Scarto', fam: 'fam-pub', v: r => r.mercato?.scarto },
  { id: 'margineMercato', chiave: 'prz.cMarginThere', fallback: 'Margine lì', fam: 'fam-pub', v: r => r.mercato?.margine },
  { id: 'suggerito', chiave: 'prz.cSuggested', fallback: 'Suggerito', fam: 'fam-resa', stacco: true, v: r => r.mercato?.suggerito, classe: 'prz-n2' },
  { id: 'margineSuggerito', chiave: 'prz.cMarginThere', fallback: 'Margine lì', fam: 'fam-resa', v: r => r.mercato?.margineSuggerito, classe: 'prz-n2' },
  { id: 'clic', chiave: 'prz.cClicksN', fallback: 'Clic', fam: 'fam-traffico', stacco: true, v: (r, g) => r.traffico?.[g]?.clic ?? r.clic, classe: 'prz-n1' },
]

export default function PrezziTab() {
  const { t, intlLocale } = useI18n()
  const [dati, setDati] = useState(() => inMemoria(URL) || null)
  const [dominio, setDominio] = useState('')
  const [inCorso, setInCorso] = useState(null)
  const [errore, setErrore] = useState(null)
  const [filtro, setFiltro] = useState('tutti')
  const [marchio, setMarchio] = useState(null)
  const [giorni, setGiorni] = useState(30)   // la finestra di clic e impressioni: 7, 30 o 90 giorni
  const [ordine, setOrdine] = useState({ campo: 'scartoMercato', verso: 'desc' })
  const [scheda, setScheda] = useState(null)
  const [gestione, setGestione] = useState(false)
  // Merchant Center: se e' configurato ma non ha ancora dato dati, si chiede lo stato (dice perche')
  const [gmc, setGmc] = useState(null)
  const [emailGmc, setEmailGmc] = useState('')
  const [gmcInCorso, setGmcInCorso] = useState(false)

  useEffect(() => { let vivo = true; leggi(URL, { onUpdate: (d) => vivo && d?.ok && setDati(d) }).then(d => { if (vivo && d?.ok) setDati(d) }).catch(() => {}); return () => { vivo = false } }, [])
  useEffect(() => { if (dati?.mercato?.configurato && !dati.mercato.articoli) fetch('/api/prezzi/mercato', { cache: 'no-store' }).then(r => r.json()).then(setGmc).catch(() => {}) }, [dati?.mercato?.configurato, dati?.mercato?.articoli])

  const chiedi = async (azione, dom) => {
    setInCorso(`${azione}:${dom}`); setErrore(null)
    try {
      const r = await fetch(URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione, dominio: dom }) })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`)
      setDati(j); if (azione === 'aggiungi') setDominio('')
    } catch (e) { setErrore(e.message) } finally { setInCorso(null) }
  }
  const registraGmc = async () => {
    setGmcInCorso(true)
    try { const r = await fetch('/api/prezzi/mercato', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email: emailGmc }) }); const j = await r.json(); setGmc(j.ok ? { ok: false, registrato: true } : { ok: false, configurato: true, errore: j.errore || j.error }) } finally { setGmcInCorso(false) }
  }
  const leggiGmc = async () => {
    setGmcInCorso(true)
    try { const j = await fetch('/api/prezzi/mercato?leggi=1', { cache: 'no-store' }).then(r => r.json()); if (j.ok) { const d = await leggi(URL, { forza: true }); if (d?.ok) setDati(d); setGmc(null) } else setGmc(j) } finally { setGmcInCorso(false) }
  }

  // lo scarto che conta: quello sul MERCATO (Google) se c'e', altrimenti sulla casa madre
  const rif = (r) => r.mercato?.scarto ?? r.mercato?.scartoSuggerito ?? r.scarto
  const ordinate = useMemo(() => {
    const col = COLONNE.find(c => c.id === ordine.campo) || COLONNE[3]
    const base = (dati?.righe || []).filter(r => (filtro === 'tutti' || (filtro === 'cari' && rif(r) > 1) || (filtro === 'allineati' && rif(r) != null && Math.abs(rif(r)) <= 1) || (filtro === 'economici' && rif(r) < -1) || (filtro === 'casa' && r.minimo)) && (!marchio || r.marchio === marchio))
    // chi non ha il dato va in fondo in entrambi i versi: "non lo so" non e' "zero"
    return [...base].sort((a, b) => { const va = col.v(a, giorni), vb = col.v(b, giorni); if (va == null && vb == null) return 0; if (va == null) return 1; if (vb == null) return -1; return ordine.verso === 'desc' ? vb - va : va - vb })
  }, [dati, filtro, marchio, ordine, giorni])
  const elenco = useElenco(ordinate, { nome: r => r.titolo, altriCampi: r => `${r.sku} ${r.ean || ''} ${r.marchio}`, chiave: 'prezzi' })
  const clicca = (campo) => setOrdine(o => (o.campo === campo ? { campo, verso: o.verso === 'desc' ? 'asc' : 'desc' } : { campo, verso: 'desc' }))

  const s = dati?.sintesi
  const intero = (n) => (n == null ? '—' : Math.round(n).toLocaleString(intlLocale, { useGrouping: 'always' }))
  const quando = (iso) => (iso ? new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso)) : '—')
  const giornoBreve = (iso) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short' }).format(new Date(`${iso}T12:00:00`))
  const pct = (n) => (n == null ? '—' : `${n > 0 ? '+' : n < 0 ? '−' : ''}${Math.abs(n).toLocaleString(intlLocale, { maximumFractionDigits: 1 })}%`)
  const scartoEl = (v) => (v == null ? <span className="prz-vuoto">—</span> : <span className={`prz-pill ${v > 1 ? 'su' : v < -1 ? 'giu' : ''}`}>{pct(v)}</span>)
  const soldiEl = (v, d = 2) => (v == null ? <span className="prz-vuoto">—</span> : <span className="reg-valore">{soldi(v, d)}</span>)
  const margineEl = (v) => (v == null ? <span className="prz-vuoto">—</span> : <span className="reg-valore" style={v < 0 ? { color: 'var(--red, #b3261e)' } : undefined}>{soldi(v, 2)}</span>)
  const colore = (liv) => (liv === 'esatto' ? t('prz.sameColour', null, 'stesso colore') : t('prz.otherColour', null, 'altro colore'))
  const posizione = scheda ? elenco.filtrate.findIndex(r => r.sku === scheda.sku) : -1
  const senza = dati?.senzaConfronto || [], totSenza = senza.reduce((a, x) => a + x.articoli, 0)

  // ── LE DESCRIZIONI AL PASSAGGIO DEL MOUSE (ui/Spiegazioni, attributo data-spiega) ──
  // Sulle intestazioni: che cos'e' quel dato. Sulle celle: il SUO conto, coi numeri di quell'articolo.
  const SP = {
    articolo: t('prz.hItem', null, 'L’articolo del tuo negozio (una riga per variante), col marchio e i pezzi in giacenza. Un clic sulla riga apre il conto completo.'),
    prezzo: t('prz.hPrice', null, 'Il prezzo a cui lo vendi oggi su Shopify, IVA compresa. Sotto, barrato, il prezzo pieno se è in sconto.'),
    margine: t('prz.hMargin', null, 'Quanto ti resta per pezzo al prezzo di oggi: prezzo senza IVA meno il costo del prodotto. L’IVA è quella di ciascun prodotto, letta da Shopify. Non comprende pubblicità, spedizione e commissioni.'),
    mercato: t('prz.hMarket', null, 'Il prezzo di riferimento di Google: a quanto vendono lo stesso articolo (stesso EAN) gli altri negozi che lo pubblicizzano su Google Shopping, pesato sui clic.'),
    scartoMercato: t('prz.hGap', null, 'Di quanto il tuo prezzo è sopra (+) o sotto (−) il prezzo di mercato.'),
    margineMercato: t('prz.hMarginMarket', null, 'Il margine per pezzo che ti resterebbe vendendo al prezzo di mercato. «In perdita» vuol dire che fin lì non puoi scendere.'),
    suggerito: t('prz.hSuggested', null, 'Il prezzo che Google ti suggerisce per avere più clic e conversioni. Sotto: di quanto il tuo prezzo è sopra o sotto.'),
    margineSuggerito: t('prz.hMarginSuggested', null, 'Il margine per pezzo che ti resterebbe vendendo al prezzo suggerito da Google.'),
    clic: t('prz.hClicks', { n: giorni }, `Clic ricevuti su Google (annunci e schede gratuite) negli ultimi ${giorni} giorni. Sotto: quante volte l’articolo è stato mostrato.`),
  }
  const spiegaRiga = (r) => {
    const m = r.mercato || {}, per = dati?.mercato?.periodi?.[giorni]
    const tf = r.traffico?.[giorni] || (r.clic != null ? { clic: r.clic, impressioni: r.impressioni } : null)
    const nienteMercato = r.soloNoi ? t('prz.onlyYouHint', null, 'Nessun altro negozio pubblicizza questo marchio su Google: non esiste un prezzo di mercato') : t('prz.noMarket', null, 'Google non ha ancora un prezzo di mercato per questo articolo')
    const nienteSuggerito = t('prz.noSuggestion', null, 'Google non suggerisce un prezzo diverso per questo articolo')
    // Il netto con l'aliquota DEL PRODOTTO, che il server manda su ogni riga
    // (lib/fiscal/aliquote.js). Prima qui c'era `prezzo / 1.22`: accanto a un
    // margine calcolato dal server all'aliquota giusta, la frase ricalcolava il
    // netto al 22 — e per l'olio di Saracino i due numeri non tornavano fra loro.
    const aIva = Number.isFinite(+r.aliquotaIva) ? +r.aliquotaIva : null
    const netto = (prezzo) => (aIva == null ? null : prezzo / (1 + aIva / 100))
    const aTesto = aIva == null ? '—' : String(aIva).replace('.', ',')
    const margineDi = (prezzo, v) => (r.costo == null || v == null || netto(prezzo) == null ? t('prz.dNoCost', null, 'Costo non inserito: aggiungilo in «Costi prodotto» per vedere il margine.')
      : v < 0 ? t('prz.dMarginLoss', { p: soldi(prezzo, 2), a: aTesto, n: soldi(netto(prezzo), 2), c: soldi(r.costo, 2), v: soldi(Math.abs(v), 2) }, `${soldi(prezzo, 2)} senza IVA (${aTesto}%) fa ${soldi(netto(prezzo), 2)}; meno il costo di ${soldi(r.costo, 2)} perdi ${soldi(Math.abs(v), 2)} a pezzo. A questo prezzo non puoi vendere.`)
      : t('prz.dMargin', { p: soldi(prezzo, 2), a: aTesto, n: soldi(netto(prezzo), 2), c: soldi(r.costo, 2), v: soldi(v, 2) }, `${soldi(prezzo, 2)} senza IVA (${aTesto}%) fa ${soldi(netto(prezzo), 2)}; meno il costo di ${soldi(r.costo, 2)} restano ${soldi(v, 2)} a pezzo.`))
    const previsto = (f) => (f == null ? '—' : pct(f * 100))
    return {
      prezzo: r.pieno > r.prezzo
        ? t('prz.dPriceSale', { p: soldi(r.prezzo, 2), f: soldi(r.pieno, 2), s: Math.round((1 - r.prezzo / r.pieno) * 100) }, `Lo vendi a ${soldi(r.prezzo, 2)}, IVA compresa. Il prezzo pieno è ${soldi(r.pieno, 2)}: sei in sconto del ${Math.round((1 - r.prezzo / r.pieno) * 100)}%.`)
        : t('prz.dPrice', { p: soldi(r.prezzo, 2) }, `Lo vendi a ${soldi(r.prezzo, 2)}, IVA compresa. Nessuno sconto attivo.`),
      margine: margineDi(r.prezzo, r.margine),
      mercato: m.prezzo != null ? t('prz.dMarket', { m: soldi(m.prezzo, 2), p: soldi(r.prezzo, 2) }, `Gli altri negozi che pubblicizzano lo stesso articolo (stesso EAN) su Google lo vendono in media a ${soldi(m.prezzo, 2)}. Tu lo vendi a ${soldi(r.prezzo, 2)}.`) : nienteMercato,
      scarto: m.scarto == null ? nienteMercato
        : m.scarto > 1 ? t('prz.dGapAbove', { x: pct(Math.abs(m.scarto)).replace('+', ''), d: soldi(r.prezzo - m.prezzo, 2) }, `Sei il ${pct(Math.abs(m.scarto)).replace('+', '')} sopra il mercato: ${soldi(r.prezzo - m.prezzo, 2)} in più a pezzo rispetto agli altri negozi.`)
        : m.scarto < -1 ? t('prz.dGapBelow', { x: pct(Math.abs(m.scarto)).replace('+', ''), d: soldi(m.prezzo - r.prezzo, 2) }, `Sei il ${pct(Math.abs(m.scarto)).replace('+', '')} sotto il mercato: ${soldi(m.prezzo - r.prezzo, 2)} in meno a pezzo rispetto agli altri negozi.`)
        : t('prz.dGapAligned', null, 'Sei allineato al mercato (entro ±1%).'),
      margineMercato: m.prezzo != null ? margineDi(m.prezzo, m.margine) : nienteMercato,
      suggerito: m.suggerito != null ? t('prz.dSuggested', { s: soldi(m.suggerito, 2), x: pct(m.scartoSuggerito), c: previsto(m.effettoClic), v: previsto(m.effettoConversioni) }, `Google suggerisce ${soldi(m.suggerito, 2)}: il tuo prezzo è ${pct(m.scartoSuggerito)} rispetto a quello. A quel prezzo prevede clic ${previsto(m.effettoClic)} e conversioni ${previsto(m.effettoConversioni)}. È una stima di Google, non un dato misurato.`) : nienteSuggerito,
      margineSuggerito: m.suggerito != null ? margineDi(m.suggerito, m.margineSuggerito) : nienteSuggerito,
      clic: tf == null ? t('prz.dNoTraffic', null, 'Google non ha dati su questo articolo.')
        : tf.impressioni > 0 ? t('prz.dClicks', { c: intero(tf.clic), i: intero(tf.impressioni), ctr: ((tf.clic / tf.impressioni) * 100).toLocaleString(intlLocale, { maximumFractionDigits: 2 }), a: per ? giornoBreve(per.since) : '', b: per ? giornoBreve(per.until) : '' }, `${intero(tf.clic)} clic su ${intero(tf.impressioni)} volte che Google ha mostrato l’articolo.`)
        : t('prz.dClicksZero', { a: per ? giornoBreve(per.since) : '', b: per ? giornoBreve(per.until) : '' }, 'Nel periodo Google non ha mai mostrato questo articolo: nessuna impressione, nessun clic.'),
    }
  }

  return (
    <div className="prz">
      {!dati ? null : (!dati.concorrenti?.length && !dati.mercato?.articoli) ? (
        <Vuoto titolo={t('prz.emptyTitle', null, 'Nessun confronto ancora')} testo={t('prz.emptyText', null, 'Collega Google Merchant Center o aggiungi il sito Shopify di un concorrente qui sotto.')} />
      ) : (
        <>
          <GrigliaKpi min={170}>
            <Kpi spiega={t('prz.kCompared', null, 'Articoli attivi per cui esiste almeno un confronto: il prezzo di mercato o quello suggerito da Google, oppure il prezzo della casa madre.')} etichetta={t('prz.compared', null, 'Articoli confrontati')} valore={intero(s?.confrontati)} nota={t('prz.ofOurs', { n: intero(dati.articoliNostri) }, `su ${dati.articoliNostri} articoli attivi`)} />
            <Kpi spiega={t('prz.kDearer', null, 'Articoli che vendi oltre l’1% sopra il riferimento: il prezzo di mercato; dove manca, il prezzo suggerito; poi la casa madre.')} etichetta={t('prz.dearer', null, 'Sopra il mercato')} valore={intero(s?.piuCari)} nota={s?.confrontati ? `${Math.round((s.piuCari / s.confrontati) * 100)}%` : undefined} />
            <Kpi spiega={t('prz.kAligned', null, 'Articoli il cui prezzo è entro ±1% dal riferimento.')} etichetta={t('prz.aligned', null, 'Allineati')} valore={intero(s?.allineati)} nota="± 1%" />
            <Kpi spiega={t('prz.kCheaper', null, 'Articoli che vendi oltre l’1% sotto il riferimento.')} etichetta={t('prz.cheaper', null, 'Sotto il mercato')} valore={intero(s?.piuEconomici)} nota={s?.confrontati ? `${Math.round((s.piuEconomici / s.confrontati) * 100)}%` : undefined} />
          </GrigliaKpi>

          <Scheda>
            {/* A QUANDO si riferiscono i numeri: i prezzi sono quelli dell'ultima lettura, il traffico e' una finestra */}
            <div className="prz-quando">
              <p data-spiega={t('prz.hWhen', null, 'I prezzi (tuoi, di mercato e suggeriti) sono quelli dell’ultima lettura, che si ripete da sola due volte al giorno. Il periodo vale solo per clic e impressioni.')}>{t('prz.pricesAsOf', { q: quando(dati.mercato?.letto || dati.letto) }, `Prezzi letti il ${quando(dati.mercato?.letto || dati.letto)}`)} · {t('prz.clicksWindow', null, 'clic e impressioni')}{dati.mercato?.periodi?.[giorni] ? `: ${giornoBreve(dati.mercato.periodi[giorni].since)} – ${giornoBreve(dati.mercato.periodi[giorni].until)}` : ''}</p>
              <Filtri valore={String(giorni)} onChange={(v) => setGiorni(Number(v))} voci={[7, 30, 90].map(n => ({ id: String(n), label: t(`prz.d${n}`, null, `${n} giorni`), spiega: t('prz.fWindow', { n }, `Clic e impressioni degli ultimi ${n} giorni, fino a ieri. I prezzi restano quelli dell’ultima lettura.`) }))} />
            </div>
            {dati.perMarchio?.length > 0 && (
              <div className="prz-marchi2" role="group" aria-label={t('prz.byBrand', null, 'Per marchio')}>
                <button type="button" className={!marchio ? 'attivo' : ''} onClick={() => setMarchio(null)} data-spiega={t('prz.dAllBrands', null, 'Toglie il filtro del marchio.')}>{t('prz.allBrands', null, 'Tutti i marchi')}</button>
                {dati.perMarchio.map(m => <button type="button" key={m.marchio} className={marchio === m.marchio ? 'attivo' : ''} onClick={() => setMarchio(marchio === m.marchio ? null : m.marchio)} data-spiega={t('prz.dBrand', { m: m.marchio, n: intero(m.articoli), g: pct(m.scartoMedio), k: intero(m.piuCari), c: intero(m.clicPer?.[giorni] ?? m.clic) }, `${m.marchio}: ${intero(m.articoli)} articoli confrontati, scarto medio ${pct(m.scartoMedio)}, ${intero(m.piuCari)} sopra il mercato, ${intero(m.clicPer?.[giorni] ?? m.clic)} clic nel periodo. Un clic filtra la tabella.`)}>{m.marchio}<i>{intero(m.articoli)}</i></button>)}
              </div>
            )}
            {marchio && (() => { const m = dati.perMarchio.find(x => x.marchio === marchio); return m ? <p className="prz-marchio-riga"><b>{m.marchio}</b> · {intero(m.articoli)} {t('prz.items', null, 'articoli')} · {t('prz.avgGap', null, 'scarto medio')} {pct(m.scartoMedio)} · {intero(m.piuCari)} {t('prz.aboveShort', null, 'sopra il mercato')} · {intero(m.clicPer?.[giorni] ?? m.clic)} {t('prz.clicks', null, 'clic')}</p> : null })()}
            <div className="prz-barra">
              <Filtri valore={filtro} onChange={setFiltro} voci={[{ id: 'tutti', label: t('prz.all', null, 'Tutti'), n: s?.confrontati, spiega: t('prz.fAll', null, 'Tutti gli articoli che hanno almeno un confronto.') }, { id: 'cari', label: t('prz.dearer', null, 'Sopra il mercato'), n: s?.piuCari, spiega: t('prz.fAbove', null, 'Solo gli articoli che vendi sopra il riferimento di oltre l’1%.') }, { id: 'allineati', label: t('prz.aligned', null, 'Allineati'), n: s?.allineati, spiega: t('prz.fAligned', null, 'Solo gli articoli entro ±1% dal riferimento.') }, { id: 'economici', label: t('prz.cheaper', null, 'Sotto il mercato'), n: s?.piuEconomici, spiega: t('prz.fBelow', null, 'Solo gli articoli che vendi sotto il riferimento di oltre l’1%.') }, { id: 'casa', label: t('prz.withBrandSite', null, 'Con il prezzo della casa madre'), n: (dati.righe || []).filter(r => r.minimo).length, spiega: t('prz.fBrandSite', null, 'Solo gli articoli trovati anche sul sito della casa madre (i marchi che usano Shopify).') }]} />
            </div>
            <FiltriElenco elenco={elenco} tr={t} segnaposto={t('prz.search', null, 'Cerca per nome, marchio, SKU o EAN…')} />
            <div className="m-scrollx prz-avvolge">
              <table className="tabella-ferma reg-tab gpv-tab prz-tab">
                <thead>
                  <tr className="reg-fasce">
                    <th className="reg-vuota reg-primo" />
                    <th colSpan={2} className="fam fam-vendite" data-spiega={t('prz.hBandYou', null, 'Dati del tuo negozio Shopify: prezzo, costo e giacenza.')}><span className="prz-fascia"><PlatformIcon platform="shopify" size={11} />{t('prz.bandYou', null, 'Da te')}</span></th>
                    <th colSpan={3} className="fam fam-pub" data-spiega={t('prz.hBandMarket', null, 'Dal report «Competitività dei prezzi» di Google Merchant Center.')}><span className="prz-fascia"><PlatformIcon platform="google" size={11} />{t('prz.bandMarket', null, 'Il mercato')}</span></th>
                    <th colSpan={2} className="fam fam-resa prz-n2" data-spiega={t('prz.hBandSuggested', null, 'Dal report dei prezzi suggeriti di Google Merchant Center: sono stime di Google.')}><span className="prz-fascia"><PlatformIcon platform="google" size={11} />{t('prz.bandSuggested', null, 'Suggerito da Google')}</span></th>
                    <th className="fam fam-traffico prz-n1" data-spiega={t('prz.hBandTraffic', null, 'Dal report sul rendimento dei prodotti di Google Merchant Center.')}><span className="prz-fascia"><PlatformIcon platform="google" size={11} />{t('prz.bandTraffic', null, 'Traffico')}</span></th>
                  </tr>
                  <tr className="reg-colonne">
                    <th className="reg-primo gp-prodotto gpv-prodotto" data-spiega={SP.articolo}>{t('prz.item', null, 'Articolo')}</th>
                    {COLONNE.map(c => { const attiva = ordine.campo === c.id; return <th key={c.id} onClick={() => clicca(c.id)} data-spiega={SP[c.id]} className={[c.fam, c.stacco ? 'stacco' : '', attiva ? 'attiva' : '', c.classe || ''].filter(Boolean).join(' ')}>{c.id === 'clic' ? t('prz.cClicksN', { n: giorni }, `Clic ${giorni} gg`) : t(c.chiave, null, c.fallback)}{attiva ? (ordine.verso === 'desc' ? ' ▾' : ' ▴') : ''}</th> })}
                  </tr>
                </thead>
                <tbody>
                  {elenco.visibili.length === 0 && <tr><td colSpan={COLONNE.length + 1} style={{ textAlign: 'left', padding: 18, color: 'var(--text3)' }}>{t('prz.noRows', null, 'Nessun articolo con questi filtri.')}</td></tr>}
                  {elenco.visibili.map((r, k) => {
                    const m = r.mercato, d = spiegaRiga(r)
                    const margineCella = (v) => (v == null ? <span className="reg-pillola gpv-manca">{t('prz.noCostShort', null, 'costo mancante')}</span> : v < 0 ? <><span className="reg-valore prz-perdita">{soldi(v, 2)}</span><div className="reg-sotto prz-perdita">{t('prz.loss', null, 'in perdita')}</div></> : <span className="reg-valore">{soldi(v, 2)}</span>)
                    return (
                      <tr key={r.sku} className={scheda?.sku === r.sku ? 'riga-aperta' : undefined} onClick={() => setScheda(r)}>
                        <td className="reg-primo gp-prodotto gpv-prodotto">
                          <div className="reg-riga-nome">
                            <span className="reg-posto">{elenco.da + k + 1}</span>
                            {r.immagine ? <img src={miniatura(r.immagine, 36)} loading="lazy" alt="" className="gpv-foto" /> : <div className="gpv-foto gpv-foto-vuota" />}
                            <div style={{ minWidth: 0 }}><div className="reg-nome gpv-titolo">{r.titolo}</div><div className="reg-sotto">{r.marchio}{r.giacenza != null ? ` · ${intero(r.giacenza)} pz` : ''}</div></div>
                          </div>
                        </td>
                        <td className="fam-vendite stacco" data-spiega={d.prezzo}><span className="reg-valore">{soldi(r.prezzo, 2)}</span>{r.pieno > r.prezzo && <div className="reg-sotto"><s>{soldi(r.pieno, 2)}</s></div>}</td>
                        <td className="fam-vendite" data-spiega={d.margine}>{margineCella(r.margine)}</td>
                        <td className="fam-pub stacco" data-spiega={d.mercato}>{m?.prezzo == null ? (r.soloNoi ? <span className="reg-sotto">{t('prz.onlyYou', null, 'lo vendi solo tu')}</span> : <span className="prz-vuoto">—</span>) : <span className="reg-valore">{soldi(m.prezzo, 2)}</span>}</td>
                        <td className="fam-pub" data-spiega={d.scarto}>{m?.scarto == null ? <span className="prz-vuoto">—</span> : <span className={`reg-pillola ${m.scarto > 1 ? 'sotto' : m.scarto < -1 ? 'sopra' : 'media'}`}>{pct(m.scarto)}</span>}</td>
                        <td className="fam-pub" data-spiega={d.margineMercato}>{m?.prezzo == null ? <span className="prz-vuoto">—</span> : margineCella(m.margine)}</td>
                        <td className="fam-resa stacco prz-n2" data-spiega={d.suggerito}>{m?.suggerito == null ? <span className="prz-vuoto">—</span> : <><span className="reg-valore">{soldi(m.suggerito, 2)}</span><div className="reg-sotto">{pct(m.scartoSuggerito)}</div></>}</td>
                        <td className="fam-resa prz-n2" data-spiega={d.margineSuggerito}>{m?.suggerito == null ? <span className="prz-vuoto">—</span> : margineCella(m.margineSuggerito)}</td>
                        <td className="fam-traffico stacco prz-n1" data-spiega={d.clic}>{(() => { const tf = r.traffico?.[giorni] || (r.clic != null ? { clic: r.clic, impressioni: r.impressioni } : null); return tf == null ? <span className="prz-vuoto">—</span> : <><span className="reg-valore">{intero(tf.clic)}</span><div className="reg-sotto">{intero(tf.impressioni)} {t('prz.impr', null, 'impr.')}</div></> })()}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Paginazione elenco={elenco} tr={t} cosa={t('prz.items', null, 'articoli')} esporta={{ nome: 'prezzi', colonne: [['Articolo', r => r.titolo], ['Marchio', r => r.marchio], ['SKU', r => r.sku], ['EAN', r => r.ean || ''], ['Prezzo', r => r.prezzo], ['Costo', r => r.costo ?? ''], ['Margine', r => r.margine ?? ''], ['Giacenza', r => r.giacenza ?? ''], ['Prezzo di mercato', r => r.mercato?.prezzo ?? ''], ['Scarto sul mercato %', r => r.mercato?.scarto ?? ''], ['Margine al prezzo di mercato', r => r.mercato?.margine ?? ''], ['Suggerito', r => r.mercato?.suggerito ?? ''], ['Scarto sul suggerito %', r => r.mercato?.scartoSuggerito ?? ''], ['Clic previsti %', r => r.mercato?.effettoClic != null ? +(r.mercato.effettoClic * 100).toFixed(1) : ''], ['Conversioni previste %', r => r.mercato?.effettoConversioni != null ? +(r.mercato.effettoConversioni * 100).toFixed(1) : ''], ['Clic 30 gg', r => r.clic ?? ''], ['Casa madre', r => r.minimo?.prezzo ?? ''], ['Scarto casa madre %', r => r.scarto ?? ''], ['Sito', r => r.minimo?.dominio ?? '']] }} />
          </Scheda>

          {totSenza > 0 && (
            <p className="prz-senza">
              <b>{t('prz.withoutTitle', { n: intero(totSenza) }, `${intero(totSenza)} articoli senza confronto.`)}</b> {t('prz.withoutWhy', null, 'Google dà il prezzo di mercato solo dove altri negozi pubblicizzano lo stesso EAN: il marchio proprio non lo vende nessun altro, e gli articoli appena caricati o con poco traffico entrano col tempo.')} {senza.slice(0, 8).map(x => `${x.marchio} ${intero(x.articoli)}`).join(' · ')}
            </p>
          )}
        </>
      )}

      {/* Le fonti: in fondo, richiudibili — la tabella viene prima */}
      <Scheda className="prz-concorrenti">
        <button type="button" className="prz-fonti-testa senza-tocco" onClick={() => setGestione(v => !v)} aria-expanded={gestione}>
          <div>
            <h3>{t('prz.sources', null, 'Da dove arrivano i prezzi')}</h3>
            <p><i className={dati?.mercato?.articoli > 0 ? 'ok' : ''} aria-hidden="true" />{dati?.mercato?.articoli > 0 ? t('prz.marketOn', { n: intero(dati.mercato.articoli), q: quando(dati.mercato.letto) }, `Google Merchant Center: ${dati.mercato.articoli} articoli · ${quando(dati.mercato.letto)}`) : dati?.mercato?.configurato ? t('prz.marketWaiting', null, 'Google Merchant Center: collegato, in attesa della prima lettura.') : t('prz.marketOff', null, 'Google Merchant Center: non collegato.')} · {t('prz.sitesCount', { n: (dati?.concorrenti || []).length }, `${(dati?.concorrenti || []).length} siti Shopify`)} · {t('prz.twiceADay', null, 'si aggiorna da solo due volte al giorno')}</p>
          </div>
          <span className={`prz-freccia${gestione ? ' giu' : ''}`}><Icon name="chevron" size={16} /></span>
        </button>
        {(gestione || (gmc && !gmc.ok && !dati?.mercato?.articoli)) && (
          <>
            {gmc && !gmc.ok && dati?.mercato?.configurato && !dati.mercato.articoli && (
              <div className="prz-gmc">
                {gmc.registrato ? (
                  <><p>{t('prz.gmcRegistered', null, 'Registrato. Google chiede qualche minuto prima di rispondere: poi premi “Leggi adesso”.')}</p><Bottone onClick={leggiGmc} disabled={gmcInCorso}>{gmcInCorso ? '…' : t('prz.gmcRead', null, 'Leggi adesso')}</Bottone></>
                ) : /not registered/i.test(gmc.errore || '') ? (
                  <>
                    <p>{t('prz.gmcNeedsRegister', null, 'Ultimo passo: Google vuole che il progetto sia registrato su questo Merchant Center.')}</p>
                    <form onSubmit={(e) => { e.preventDefault(); if (emailGmc.trim()) registraGmc() }}>
                      <input type="email" value={emailGmc} onChange={e => setEmailGmc(e.target.value)} placeholder="nome@azienda.it" aria-label="Email" autoComplete="email" />
                      <Bottone tipo="primario" type="submit" disabled={gmcInCorso || !emailGmc.trim()}>{gmcInCorso ? '…' : t('prz.gmcRegister', null, 'Registra')}</Bottone>
                      <Bottone onClick={leggiGmc} disabled={gmcInCorso}>{t('prz.gmcRead', null, 'Leggi adesso')}</Bottone>
                    </form>
                  </>
                ) : /API_DEVELOPER/i.test(gmc.errore || '') ? (
                  <><p>{t('prz.gmcNeedsDeveloper', null, 'Il progetto è registrato. Manca solo un utente VERIFICATO col ruolo “Sviluppatore API”.')}</p><Bottone onClick={leggiGmc} disabled={gmcInCorso}>{gmcInCorso ? '…' : t('prz.gmcRead', null, 'Leggi adesso')}</Bottone></>
                ) : (
                  <><p>{t('prz.gmcError', null, 'Google ha risposto così')}: {gmc.errore}</p><Bottone onClick={leggiGmc} disabled={gmcInCorso}>{gmcInCorso ? '…' : t('prz.gmcRead', null, 'Leggi adesso')}</Bottone></>
                )}
              </div>
            )}
            <div className="prz-testa">
              <p>{t('prz.competitorsHint', null, 'Aggiungi il sito di un concorrente o di una casa madre che usa Shopify: lo verifico, leggo il catalogo e abbino gli articoli sul codice del produttore che sta nei tuoi SKU.')}</p>
              <form className="prz-aggiungi" onSubmit={(e) => { e.preventDefault(); if (dominio.trim()) chiedi('aggiungi', dominio) }}>
                <input value={dominio} onChange={e => setDominio(e.target.value)} placeholder="www.esempio.it" aria-label={t('prz.domain', null, 'Dominio del concorrente')} autoComplete="off" spellCheck={false} />
                <Bottone type="submit" disabled={!!inCorso || !dominio.trim()}>{inCorso?.startsWith('aggiungi') ? t('prz.reading', null, 'Leggo il catalogo…') : t('prz.add', null, 'Aggiungi')}</Bottone>
              </form>
            </div>
            {errore && <p className="prz-errore"><Icon name="warning" size={13} /> {errore}</p>}
            {(dati?.concorrenti || []).length > 0 && (
              <ul className="prz-elenco">
                {dati.concorrenti.map(c => (
                  <li key={c.dominio}>
                    <i className={c.ok === false ? 'ko' : c.ok ? 'ok' : ''} aria-hidden="true" />
                    <div><b>{c.dominio}</b><span>{c.ok === false ? `${t('prz.lastFailed', null, 'Ultima lettura non riuscita')}: ${c.errore}` : c.letto ? t('prz.readLine', { p: intero(c.prodotti ?? 0), a: c.abbinati ?? 0, e: c.esatti ?? 0, q: quando(c.letto) }, `${c.prodotti} prodotti · ${c.abbinati} in comune · ${quando(c.letto)}`) : '…'}</span></div>
                    <button type="button" className="senza-tocco" onClick={() => chiedi('rileggi', c.dominio)} disabled={!!inCorso} data-spiega={t('prz.reread', null, 'Rileggi adesso')} aria-label={t('prz.reread', null, 'Rileggi adesso')}><Icon name="refresh" size={14} /></button>
                    <button type="button" className="senza-tocco" onClick={() => chiedi('togli', c.dominio)} disabled={!!inCorso} data-spiega={t('prz.remove', null, 'Togli')} aria-label={t('prz.remove', null, 'Togli')}><Icon name="close" size={14} /></button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Scheda>

      {scheda && (
        <Pannello titolo={scheda.titolo} sotto={`${scheda.marchio} · ${scheda.sku}${scheda.ean ? ` · EAN ${scheda.ean}` : ''}`} immagine={scheda.immagine ? miniatura(scheda.immagine, 46) : null} onClose={() => setScheda(null)}
          posizione={posizione >= 0 ? `${posizione + 1} / ${elenco.filtrate.length}` : undefined}
          onPrecedente={posizione > 0 ? () => setScheda(elenco.filtrate[posizione - 1]) : undefined}
          onSuccessiva={posizione >= 0 && posizione < elenco.filtrate.length - 1 ? () => setScheda(elenco.filtrate[posizione + 1]) : undefined}>
          {/* Stesso impianto del pop-up di "Prodotti Google": il CONTO (una sottrazione che si rifa' a mano) e
              sotto i riquadri dei fatti. Tre colonne: oggi, al prezzo di mercato, al prezzo suggerito. */}
          {(() => {
            const r = scheda, m = r.mercato || {}
            const col = [{ p: r.prezzo, oggi: true }, m.prezzo != null ? { p: m.prezzo } : null, m.suggerito != null ? { p: m.suggerito } : null]
            const cella = (k, f, forte) => (col[k] ? f(col[k].p, k) : <span className="prz-vuoto">—</span>)
            // Stessa aliquota del prodotto anche qui: questi margini si RIFANNO a
            // schermo per le tre colonne (oggi, mercato, suggerito), e al 22 fisso
            // davano all'olio un margine piu' basso del 18% in tutte e tre.
            const aIvaS = Number.isFinite(+r.aliquotaIva) ? +r.aliquotaIva : null
            const nettoS = (p) => (aIvaS == null ? null : p / (1 + aIvaS / 100))
            const iva = (p) => (nettoS(p) == null ? null : p - nettoS(p)), marg = (p) => (r.costo != null && nettoS(p) != null ? nettoS(p) - r.costo : null)
            const aTestoS = aIvaS == null ? '—' : String(aIvaS).replace('.', ',')
            const fTestoS = aIvaS == null ? '—' : String(Math.round((1 + aIvaS / 100) * 1000) / 1000).replace('.', ',')
            const riga = (segno, nome, nota, f, forte, spiega) => (
              <div className={`gpv-voce${forte ? ' forte' : ''}`} data-spiega={spiega || undefined}>
                <b className="gpv-segno">{segno}</b>
                <div style={{ flex: 1, minWidth: 0 }}><div className="gpv-voce-nome">{nome}</div>{nota && <div className="reg-sotto">{nota}</div>}</div>
                {[0, 1, 2].map(k => <span key={k} className={`gpv-voce-ora prz-col${k === 0 ? ' oggi' : ''}`}>{cella(k, f, forte)}</span>)}
              </div>
            )
            const kpi = (et, val, nota, spiega) => <div className="prov-kpi" data-spiega={spiega || undefined}><div className="prov-kpi-et">{et}</div><div className="prov-kpi-val" style={{ fontSize: 15 }}>{val}</div>{nota && <div className="prov-kpi-nota">{nota}</div>}</div>
            const tf = r.traffico?.[giorni] || { clic: r.clic, impressioni: r.impressioni }
            return (
              <>
                <div className="prov-scheda" style={{ marginBottom: 14 }}>
                  <div className="gpv-voce gpv-voce-testa">
                    <span style={{ flex: 1 }} />
                    <span className="gpv-voce-ora prz-col oggi">{t('prz.sToday', null, 'Oggi')}</span>
                    <span className="gpv-voce-ora prz-col">{t('prz.sMarketShort', null, 'Al mercato')}</span>
                    <span className="gpv-voce-ora prz-col">{t('prz.sSuggestedShort', null, 'Al suggerito')}</span>
                  </div>
                  {riga('', t('prz.rowPrice', null, 'Prezzo al cliente'), t('prz.vatIncluded', null, 'IVA compresa'), (p) => soldi(p, 2), false, t('prz.pPrice', null, 'Il prezzo che paga il cliente, IVA compresa, nei tre casi: oggi, al prezzo di mercato, al prezzo suggerito da Google.'))}
                  {riga('−', t('prz.rowVat', { a: aTestoS }, `IVA ${aTestoS}%`), null, (p) => soldi(iva(p), 2), false, t('prz.pVat', { a: aTestoS, f: fTestoS }, `L’IVA al ${aTestoS}% contenuta nel prezzo, letta da Shopify per questo prodotto: prezzo − (prezzo ÷ ${fTestoS}).`))}
                  {riga('−', t('prz.cost', null, 'Costo'), r.costo == null ? t('prz.noCost', null, 'Costo non inserito') : null, () => (r.costo == null ? '?' : soldi(r.costo, 2)), false, t('prz.pCost', null, 'Il costo del prodotto: quello di Shopify, sostituito dal costo che hai inserito in «Costi prodotto» se c’è.'))}
                  {riga('=', t('prz.cMargin', null, 'Margine'), t('prz.perPiece', null, 'per pezzo'), (p) => { const v = marg(p); return v == null ? '?' : <span style={{ color: v < 0 ? '#ef4444' : undefined }}>{soldi(v, 2)}{v < 0 ? ` · ${t('prz.loss', null, 'in perdita')}` : ''}</span> }, true, t('prz.pMargin', null, 'Prezzo senza IVA meno costo, per un pezzo. Non comprende pubblicità, spedizione e commissioni.'))}
                  {r.giacenza > 0 && r.costo != null && riga('×', t('prz.onStockRow', { n: intero(r.giacenza) }, `${intero(r.giacenza)} pezzi in giacenza`), null, (p) => <span style={{ color: marg(p) < 0 ? '#ef4444' : undefined }}>{soldi(marg(p) * r.giacenza, 0)}</span>, false, t('prz.pStock', null, 'Il margine per pezzo moltiplicato per i pezzi in magazzino: quanto rende la giacenza a quel prezzo.'))}
                  {riga('', t('prz.rowGap', null, 'Il tuo prezzo rispetto a questo'), null, (p, k) => (k === 0 ? <span className="prz-vuoto">—</span> : scartoEl(+(((r.prezzo - p) / p) * 100).toFixed(1))), false, t('prz.pGap', null, 'Di quanto il tuo prezzo di oggi è sopra (+) o sotto (−) quel prezzo.'))}
                </div>

                <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0,1fr))', gap: 10 }}>
                  {kpi(t('prz.cStock', null, 'Giacenza'), r.giacenza != null ? intero(r.giacenza) : '—', t('prz.pieces', null, 'pezzi'), t('prz.pkStock', null, 'Pezzi disponibili in Shopify per questa variante.'))}
                  {kpi(t('prz.fullPrice', null, 'Prezzo pieno'), r.pieno > r.prezzo ? soldi(r.pieno, 2) : '—', r.pieno > r.prezzo ? t('prz.discountNow', { p: Math.round((1 - r.prezzo / r.pieno) * 100) }, `oggi sei a −${Math.round((1 - r.prezzo / r.pieno) * 100)}%`) : t('prz.noDiscount', null, 'nessuno sconto attivo'), t('prz.pkFull', null, 'Il prezzo pieno impostato in Shopify e lo sconto che stai applicando oggi.'))}
                  {kpi(t('prz.cClicksN', { n: giorni }, `Clic ${giorni} gg`), intero(tf.clic), `${intero(tf.impressioni)} ${t('prz.impr', null, 'impr.')}`, t('prz.pkClicks', null, 'Clic e impressioni su Google nel periodo scelto (annunci e schede gratuite).'))}
                  {kpi(t('prz.marginPct', null, 'Margine %'), r.marginePct != null ? pct(r.marginePct).replace('+', '') : '—', t('prz.ofNetPrice', null, 'del prezzo senza IVA'), t('prz.pkMarginPct', null, 'Il margine di oggi in percentuale del prezzo senza IVA.'))}
                  {m.suggerito != null && kpi(t('prz.cMoreClicks', null, 'Clic previsti'), m.effettoClic != null ? pct(m.effettoClic * 100) : '—', t('prz.atSuggested', null, 'al prezzo suggerito'), t('prz.pkMoreClicks', null, 'Di quanto Google prevede che aumentino i clic passando al prezzo suggerito. È una stima.'))}
                  {m.suggerito != null && kpi(t('prz.cMoreConv', null, 'Conversioni previste'), m.effettoConversioni != null ? pct(m.effettoConversioni * 100) : '—', t('prz.atSuggested', null, 'al prezzo suggerito'), t('prz.pkMoreConv', null, 'Di quanto Google prevede che aumentino le conversioni passando al prezzo suggerito. È una stima.'))}
                  {m.suggerito != null && kpi(t('prz.effectivenessShort', null, 'Efficacia'), m.efficacia ? String(m.efficacia).toLowerCase() : '—', t('prz.googleEstimate', null, 'stima di Google'), t('prz.pkEffect', null, 'Quanto Google ritiene efficace cambiare il prezzo di questo articolo: low, medium o high.'))}
                  {kpi('EAN', r.ean || '—', r.sku, t('prz.pkEan', null, 'Il codice a barre (EAN) con cui Google riconosce lo stesso articolo negli altri negozi, e sotto il tuo SKU.'))}
                </div>

                {(r.offerte || []).length > 0 && (
                  <div className="prov-scheda" style={{ marginTop: 14 }}>
                    <div className="gpv-voce gpv-voce-testa"><span style={{ flex: 1 }}>{t('prz.bandBrandSite', null, 'Casa madre')}</span><span className="gpv-voce-prima">{t('prz.cGap', null, 'Scarto')}</span><span className="gpv-voce-ora">{t('prz.cPrice', null, 'Prezzo')}</span></div>
                    {r.offerte.map((o, k) => (
                      <div key={k} className="gpv-voce" data-spiega={t('prz.pBrandSite', null, 'Prezzo letto dal catalogo pubblico del sito. «Stesso colore» = stesso modello e stesso colore; «altro colore» = stesso modello, colore diverso.')}>
                        <div style={{ flex: 1, minWidth: 0 }}><div className="gpv-voce-nome"><a href={o.url} target="_blank" rel="noopener noreferrer nofollow" className="prz-link">{o.dominio.replace(/^www\./, '')}<Icon name="external" size={11} /></a></div><div className="reg-sotto">{colore(o.livello)}{o.disponibile === false ? ` · ${t('prz.soldOut', null, 'esaurito')}` : ''}{o.pieno > o.prezzo ? ` · ${t('prz.fullPrice', null, 'Prezzo pieno')} ${soldi(o.pieno, 2)}` : ''}</div></div>
                        <span className="gpv-voce-prima">{pct(+(((r.prezzo - o.prezzo) / o.prezzo) * 100).toFixed(1))}</span>
                        <span className="gpv-voce-ora">{soldi(o.prezzo, 2)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <p className="prz-nota">{t('prz.marginNote', null, 'Il margine è il prezzo senza IVA meno il costo del prodotto, con l’aliquota di ciascun prodotto letta da Shopify: non comprende pubblicità, spedizione e commissioni.')} {t('prz.forecastNote', null, 'Le previsioni di clic e conversioni sono stime di Google, non dati misurati.')}</p>
              </>
            )
          })()}
        </Pannello>
      )}
    </div>
  )
}
