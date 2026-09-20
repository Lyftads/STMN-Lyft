'use client'

import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { inMemoria, leggi } from '../../lib/clientCache'
import Icon from './ui/Icon'
import { miniatura } from '../../lib/client/miniatura'
import { soldi } from '../../lib/client/soldi'

// ============================================================================
//  SALA DI CONTROLLO — il pilota dell'azienda sulla Dashboard.
//
//   · TelemetriaGlobo: sopra il globo, in vetro, come la telemetria di un lancio: lo STATO
//     (nominale / anomalie), la TRAIETTORIA del mese con la sua fascia e il cursore del budget
//     ("se sposto la spesa, dove arrivo?" — la macchina del tempo in avanti).
//   · MossePilota: nella colonna, le mosse che il software propone con l'effetto previsto in
//     euro al mese. Approva → si fa → dopo 14 giorni il software misura se aveva ragione.
//
//  I dati vengono da /api/pilota (lib/pilota/*): niente qui dentro inventa un numero.
//  Stato unico fuori da React: la telemetria e le mosse leggono la stessa risposta, e una
//  decisione presa nella scheda aggiorna subito anche il resto.
// ============================================================================
const URL = '/api/pilota'
const stato = { dati: null, caricato: false }
let foto = { ...stato }
const ascolto = new Set()
const metti = (p) => { Object.assign(stato, p); foto = { ...stato }; ascolto.forEach(f => f()) }
const abbona = (f) => { ascolto.add(f); return () => ascolto.delete(f) }
const leggiFoto = () => foto
let inVolo = null
function carica(forza = false) {
  if (inVolo && !forza) return inVolo
  inVolo = leggi(URL, { forza, onUpdate: (d) => d && !d.error && metti({ dati: d, caricato: true }) })
    .then(d => { if (d && !d.error) metti({ dati: d, caricato: true }); else metti({ caricato: true }) })
    .catch(() => metti({ caricato: true }))
    .finally(() => { inVolo = null })
  return inVolo
}

export function usePilota() {
  const s = useSyncExternalStore(abbona, leggiFoto, leggiFoto)
  useEffect(() => {
    if (!stato.dati) { const m = inMemoria(URL); if (m && !m.error) metti({ dati: m, caricato: true }) }
    carica()
  }, [])
  return s
}

// ── I conteggi degli avvisi, letti UNA volta per tutta la pagina ──────────────────────────────
//  Sul fork questo gancio stava in AlertsBell, esportato. Qui AlertsBell e' un componente solo,
//  senza gancio da riusare, e non si tocca: e' un file condiviso con altri. Quindi il conteggio
//  se lo legge il pilota, con lo stesso indirizzo e lo stesso ritmo (5 minuti) — ma con UNA sola
//  chiamata per tutta la pagina, anche se la telemetria e la capsula in testata lo chiedono
//  insieme. Il giorno in cui AlertsBell esportera' il suo gancio, qui si cancella tutto e si
//  importa quello: i conteggi sono gli stessi.
const AVVISI_URL = '/api/alerts'
const RITMO_AVVISI = 5 * 60_000
const vuoti = { urgent: 0, warning: 0, info: 0, total: 0 }
// La foto "prima di sapere": una sola, sempre la STESSA — useSyncExternalStore confronta per
// identita' e con un oggetto nuovo a ogni giro React si lamenta e rende all'infinito.
const AVVISI_VUOTI = { counts: vuoti, caricato: false }
let avvisi = AVVISI_VUOTI
const ascoltoAvvisi = new Set()
const leggiAvvisi = () => avvisi
const abbonaAvvisi = (f) => {
  ascoltoAvvisi.add(f)
  if (ascoltoAvvisi.size === 1) avviaAvvisi()
  return () => { ascoltoAvvisi.delete(f); if (!ascoltoAvvisi.size) fermaAvvisi() }
}
let battito = null
function caricaAvvisi() {
  fetch(AVVISI_URL)
    .then(r => r.json())
    .then(j => { if (!j?.error) { avvisi = { counts: j.counts || vuoti, caricato: true }; ascoltoAvvisi.forEach(f => f()) } })
    .catch(() => {})
}
function avviaAvvisi() { caricaAvvisi(); if (!battito) battito = setInterval(caricaAvvisi, RITMO_AVVISI) }
function fermaAvvisi() { if (battito) { clearInterval(battito); battito = null } }

export function useAvvisi() {
  return useSyncExternalStore(abbonaAvvisi, leggiAvvisi, () => ({ counts: vuoti, caricato: false }))
}

// stesso formato del resto della Dashboard (€ davanti, migliaia col punto)
const euro = (n) => (n == null ? '—' : soldi(n, 0))
const conSegno = (n) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${soldi(Math.abs(n), 0)}`)

// ── Il grafico della traiettoria: vero pieno, previsto tratteggiato, fascia in velatura ──
function Curva({ punti, spostamento = 0, meseScorso, etichettaScorso }) {
  const L = 640, A = 150, m = { s: 6, d: 8, a: 10, b: 18 }
  const n = punti.length
  const iOggi = punti.findIndex(p => p.previsto != null && p.vero != null)
  const quanti = Math.max(1, n - 1 - Math.max(0, iOggi))
  // lo spostamento del budget entra in modo lineare da oggi alla fine del mese
  const sposta = (k) => (k <= iOggi ? 0 : spostamento * ((k - iOggi) / quanti))
  const tetto = Math.max(1, ...punti.map((p, k) => (p.alto ?? p.vero ?? 0) + Math.max(0, sposta(k))), meseScorso || 0) * 1.06
  const x = (k) => m.s + (k / Math.max(1, n - 1)) * (L - m.s - m.d)
  const y = (v) => A - m.b - (v / tetto) * (A - m.a - m.b)
  const linea = (arr) => arr.map(([k, v], j) => `${j ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const veri = punti.map((p, k) => [k, p.vero]).filter(([, v]) => v != null)
  const futuri = punti.map((p, k) => [k, p.previsto == null ? null : p.previsto + sposta(k)]).filter(([k, v]) => v != null && k >= iOggi)
  if (iOggi >= 0) futuri[0] = [iOggi, punti[iOggi].vero]
  const alti = punti.map((p, k) => [k, p.alto == null ? null : p.alto + sposta(k)]).filter(([k, v]) => v != null && k >= iOggi)
  const bassi = punti.map((p, k) => [k, p.basso == null ? null : p.basso + sposta(k)]).filter(([k, v]) => v != null && k >= iOggi)
  const fascia = alti.length > 1 ? `${linea(alti)}${bassi.slice().reverse().map(([k, v]) => `L${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('')}Z` : ''
  const oggi = iOggi >= 0 ? [x(iOggi), y(punti[iOggi].vero)] : null
  const yScorso = meseScorso > 0 ? (y(meseScorso) / A) * 100 : null
  return (
    <div className="mc-grafico">
    {yScorso != null && <span className="mc-rif-et" style={{ top: `${yScorso}%` }}>{etichettaScorso}</span>}
    <svg className="mc-curva" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" role="img" aria-hidden="true">
      {meseScorso > 0 && <line x1={m.s} x2={L - m.d} y1={y(meseScorso)} y2={y(meseScorso)} className="mc-rif" />}
      {fascia && <path d={fascia} className="mc-fascia" />}
      {futuri.length > 1 && <path d={linea(futuri)} className="mc-previsto" />}
      {veri.length > 1 && <path d={linea(veri)} className="mc-vero" />}
      {oggi && <g><circle cx={oggi[0]} cy={oggi[1]} r="9" className="mc-polso" /><circle cx={oggi[0]} cy={oggi[1]} r="3.4" className="mc-oggi" /></g>}
    </svg>
    </div>
  )
}

// ── La macchina del tempo all'indietro: la giornata rigiocata sul globo ──
// 24 ore in una ventina di secondi: gli ordini ricompaiono all'ora in cui sono arrivati (il
// globo li disegna ascoltando `lyft:rigioca`), mentre qui salgono il conto e l'incasso.
function Rigioca() {
  const { t } = useI18n()
  const [punti, setPunti] = useState(null)
  const [minuto, setMinuto] = useState(0)
  const [va, setVa] = useState(false)
  const fine = useMemo(() => { const p = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date()); return Number(p.find(x => x.type === 'hour').value) * 60 + Number(p.find(x => x.type === 'minute').value) }, [punti])

  const apri = async () => {
    const d = await leggi('/api/pilota/rigioca').catch(() => null)
    if (!d?.ok) return
    setPunti(d.punti); setMinuto(0); setVa(true)
  }
  const chiudi = () => { setVa(false); setPunti(null); window.dispatchEvent(new CustomEvent('lyft:rigioca', { detail: { attivo: false } })) }

  useEffect(() => { if (!va || !punti) return; const k = setInterval(() => setMinuto(m => { if (m >= fine) { setVa(false); return fine } return Math.min(fine, m + 4) }), 55); return () => clearInterval(k) }, [va, punti, fine])
  useEffect(() => { if (punti) window.dispatchEvent(new CustomEvent('lyft:rigioca', { detail: { attivo: true, punti, minuto } })) }, [punti, minuto])
  useEffect(() => () => window.dispatchEvent(new CustomEvent('lyft:rigioca', { detail: { attivo: false } })), [])

  if (!punti) return <button type="button" className="mc-stato mc-film" onClick={apri}><Icon name="clock" size={12} />{t('mc.replay', null, 'Rigioca oggi')}</button>
  const visti = punti.filter(p => p.m <= minuto)
  const ora = `${String(Math.floor(minuto / 60)).padStart(2, '0')}:${String(minuto % 60).padStart(2, '0')}`
  return (
    <div className="mc-rigioca">
      <button type="button" className="mc-rigioca-tasto" onClick={() => { if (minuto >= fine) setMinuto(0); setVa(v => !v || minuto >= fine) }} aria-label={va ? t('mc.pause', null, 'Pausa') : t('mc.play', null, 'Riproduci')}>{va ? <span className="mc-pausa" aria-hidden="true" /> : <Icon name="play" size={11} />}</button>
      <b>{ora}</b>
      <input type="range" min="0" max={fine} step="1" value={minuto} onChange={e => { setVa(false); setMinuto(Number(e.target.value)) }} aria-label={t('mc.replay', null, 'Rigioca oggi')} />
      <span>{t('mc.replayCount', { n: visti.length, v: soldi(visti.reduce((a, p) => a + p.euro, 0), 0) }, `${visti.length} ordini · ${soldi(visti.reduce((a, p) => a + p.euro, 0), 0)}`)}</span>
      <button type="button" className="mc-rigioca-tasto" onClick={chiudi} aria-label={t('common.close', null, 'Chiudi')}><Icon name="close" size={12} /></button>
    </div>
  )
}

// ── Sopra il globo: stato + traiettoria + cursore del budget ──
export function TelemetriaGlobo() {
  const { t, intlLocale } = useI18n()
  const { dati } = usePilota()
  const { counts } = useAvvisi()
  const [budget, setBudget] = useState(0)            // −50 … +50 (%) sulla spesa che resta nel mese
  const tr = dati?.traiettoria
  const guai = (counts?.urgent || 0) + (counts?.warning || 0)
  const mese = useMemo(() => (tr ? new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(`${tr.oggi}T12:00:00`)) : ''), [tr, intlLocale])

  // Sul fork il numero delle anomalie era un tasto e apriva il pop-up del profilo. Qui quel
  // pop-up non c'e' ancora (gli avvisi stanno nella campanella in alto), e un tasto che non fa
  // niente e' peggio di nessun tasto: resta l'indicatore, con l'aiuto che dice dove guardare.
  const stato = (
    <span className={`mc-stato${guai ? ' guai' : ''}`} title={guai ? t('mc.anomaliesWhere', null, 'Gli avvisi sono nella campanella in alto a destra.') : undefined}>
      <i aria-hidden="true" />
      {guai ? (guai === 1 ? t('mc.anomalyOne', null, '1 anomalia') : t('mc.anomalies', { n: guai }, `${guai} anomalie`)) : t('mc.nominal', null, 'Nominale')}
    </span>
  )
  // "Il film della settimana" (ReportFilm) non e' ancora in questo repo: il suo tasto tornera' qui
  // insieme al componente, dispatchando `lyft:film`.
  const cima = <div className="mc-cima">{stato}<Rigioca /></div>
  if (!tr) return <div className="mc-telemetria mc-solo-stato">{cima}</div>

  const resa = dati?.resa?.valore
  const deltaSpesa = Math.round((tr.spesaRestante || 0) * (budget / 100))
  const deltaFatt = resa != null ? Math.round(deltaSpesa * resa) : 0
  const previsto = tr.previsto + deltaFatt
  const spesa = tr.spesaPrevista + deltaSpesa
  const mer = spesa > 0 ? previsto / spesa : null
  const scorso = dati?.meseScorso?.totale
  const vsScorso = scorso > 0 ? ((previsto - scorso) / scorso) * 100 : null

  return (
    <div className="mc-telemetria">
      {cima}
      <div className="mc-vetro">
        <div className="mc-testa">
          <div>
            <div className="mc-occhiello">{t('mc.trajectory', { mese }, `Traiettoria di ${mese}`)}</div>
            <div className="mc-numero">{euro(previsto, intlLocale)}</div>
            <div className="mc-sotto">
              {t('mc.band', { a: euro(tr.basso + deltaFatt, intlLocale), b: euro(tr.alto + deltaFatt, intlLocale) }, `fra ${euro(tr.basso + deltaFatt, intlLocale)} e ${euro(tr.alto + deltaFatt, intlLocale)}`)}
              {vsScorso != null && <b className={vsScorso >= 0 ? 'su' : 'giu'}>{vsScorso >= 0 ? '▲' : '▼'} {Math.abs(vsScorso).toLocaleString(intlLocale, { maximumFractionDigits: 0 })}% {t('mc.vsLastMonth', null, 'sul mese scorso')}</b>}
            </div>
          </div>
          <dl className="mc-lati">
            <div><dt>{t('mc.soFar', null, 'Finora')}</dt><dd>{euro(tr.finora, intlLocale)}</dd></div>
            <div><dt>{t('mc.spend', null, 'Spesa a fine mese')}</dt><dd>{euro(spesa, intlLocale)}</dd></div>
            <div><dt>MER</dt><dd>{mer != null ? `${mer.toLocaleString(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}x` : '—'}</dd></div>
          </dl>
        </div>
        <Curva punti={tr.punti} spostamento={deltaFatt} meseScorso={scorso} etichettaScorso={scorso > 0 ? t('mc.lastMonthLine', { v: euro(scorso) }, `mese scorso ${euro(scorso)}`) : null} />
        {resa != null && tr.giorniMancanti > 0 && (
          <label className="mc-cursore">
            <span>{t('mc.ifBudget', null, 'Se cambio il budget')}</span>
            <input type="range" min="-50" max="50" step="5" value={budget} onChange={e => setBudget(Number(e.target.value))} aria-label={t('mc.ifBudget', null, 'Se cambio il budget')} />
            <output>{budget === 0 ? t('mc.asNow', null, 'come adesso') : `${budget > 0 ? '+' : '−'}${Math.abs(budget)}% · ${conSegno(deltaSpesa, intlLocale)} → ${conSegno(deltaFatt, intlLocale)}`}</output>
          </label>
        )}
      </div>
    </div>
  )
}

// ── Nella colonna: le mosse ──
function Mossa({ m, onDecidi, inCorso }) {
  const { t, intlLocale } = useI18n()
  const [aperta, setAperta] = useState(false)
  const [copiato, setCopiato] = useState(false)
  const titolo = m.tipo === 'ferma-prodotti-google'
    ? t('mc.moveStop', { n: m.quanti }, `Ferma ${m.quanti} prodotti in perdita su Google`)
    : t('mc.movePush', { n: m.quanti }, `Spingi ${m.quanti} prodotti che rendono su Google`)
  const perche = m.tipo === 'ferma-prodotti-google'
    ? t('mc.whyStop', { spesa: euro(m.base?.spesa, intlLocale), giorni: m.base?.giorni }, `Negli ultimi ${m.base?.giorni} giorni hanno speso ${euro(m.base?.spesa, intlLocale)} senza ripagarsi.`)
    : t('mc.whyPush', { pct: Math.round((m.previsto?.spinta || 0.2) * 100) }, `Rendono più di quanto costano: +${Math.round((m.previsto?.spinta || 0.2) * 100)}% di spesa, alla resa di oggi.`)
  const copia = async () => { try { await navigator.clipboard.writeText((m.prodotti || []).flatMap(p => p.itemIds || []).join('\n')); setCopiato(true); setTimeout(() => setCopiato(false), 1600) } catch {} }
  const quando = (iso) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'short' }).format(new Date(iso))

  return (
    <li className={`mc-mossa st-${m.stato}`}>
      <div className="mc-mossa-testa">
        <div className="mc-mossa-titolo">{titolo}</div>
        <div className="mc-effetto">{conSegno(m.stato === 'misurata' ? m.misura?.euroMese : m.previsto?.euroMese, intlLocale)}<small>{t('mc.perMonth', null, '/mese')}</small></div>
      </div>
      {m.stato === 'misurata'
        ? <p className="mc-perche">{t('mc.measured', { previsto: conSegno(m.misura?.previsto, intlLocale) }, `Prevedevo ${conSegno(m.misura?.previsto, intlLocale)} al mese.`)} <b className={m.misura?.avevaRagione ? 'su' : 'giu'}>{m.misura?.avevaRagione ? t('mc.wasRight', null, 'Aveva ragione') : t('mc.wasWrong', null, 'Non ha reso come previsto')}</b></p>
        : <p className="mc-perche">{perche}</p>}

      <button type="button" className="mc-elenco-apri senza-tocco" onClick={() => setAperta(v => !v)} aria-expanded={aperta}>
        <span className="mc-pila">{(m.prodotti || []).slice(0, 5).map((p, k) => p.immagine ? <img key={k} src={miniatura(p.immagine, 44)} alt="" loading="lazy" /> : <i key={k} />)}</span>
        {aperta ? t('mc.hideList', null, 'Nascondi l’elenco') : t('mc.showList', { n: m.quanti }, `Vedi i ${m.quanti} prodotti`)}
      </button>
      {aperta && (
        <ul className="mc-prodotti">
          {(m.prodotti || []).map((p, k) => (
            <li key={k}><span>{p.titolo}</span><em>{t('mc.spent', null, 'spesa')} {euro(p.spesa, intlLocale)}</em><b>{conSegno(p.euroMese, intlLocale)}</b></li>
          ))}
          {m.quantiInTutto > m.quanti && <li className="mc-altri">{t('mc.more', { n: m.quantiInTutto - m.quanti }, `e altri ${m.quantiInTutto - m.quanti} in Prodotti Google`)}</li>}
        </ul>
      )}

      {m.stato === 'proposta' && (
        <div className="mc-azioni">
          <button type="button" className="mc-approva" disabled={inCorso} onClick={() => onDecidi(m.id, 'approva')}>{t('mc.approve', null, 'Approva')}</button>
          <button type="button" className="mc-nonora" disabled={inCorso} onClick={() => onDecidi(m.id, 'rifiuta')}>{t('mc.notNow', null, 'Non ora')}</button>
        </div>
      )}
      {m.stato === 'approvata' && (
        <div className="mc-fare">
          <p>{m.tipo === 'ferma-prodotti-google' ? t('mc.todoStop', null, 'In Google Ads escludi questi articoli dai gruppi di prodotti. Quando è fatto, segnalo qui: da quel giorno misuro il risultato.') : t('mc.todoPush', null, 'In Google Ads alza la spesa su questi articoli. Quando è fatto, segnalo qui: da quel giorno misuro il risultato.')}</p>
          <div className="mc-azioni">
            <button type="button" className="mc-approva" disabled={inCorso} onClick={() => onDecidi(m.id, 'fatta')}>{t('mc.done', null, 'Fatta')}</button>
            <button type="button" className="mc-nonora" onClick={copia}>{copiato ? t('mc.copied', null, 'Copiati') : t('mc.copyIds', null, 'Copia gli ID articolo')}</button>
          </div>
        </div>
      )}
      {m.stato === 'eseguita' && <p className="mc-attesa"><Icon name="clock" size={13} /> {t('mc.measuring', { data: quando(m.misuraDal) }, `In misura · il verdetto arriva il ${quando(m.misuraDal)}`)}</p>}
    </li>
  )
}

export function MossePilota() {
  const { t, intlLocale } = useI18n()
  const { dati, caricato } = usePilota()
  const [inCorso, setInCorso] = useState(false)
  const [errore, setErrore] = useState(null)
  const mosse = (dati?.mosse || []).filter(m => m.stato !== 'rifiutata').slice(0, 6)
  const b = dati?.bilancio

  const decidi = async (id, decisione) => {
    setInCorso(true); setErrore(null)
    try {
      const r = await fetch('/api/pilota/mosse', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, decisione }) })
      const j = await r.json()
      if (!r.ok || j.error) throw new Error(j.error || `HTTP ${r.status}`)
      await carica(true)
    } catch (e) { setErrore(e.message) } finally { setInCorso(false) }
  }

  if (!caricato && !dati) return null
  if (!mosse.length) return null
  return (
    <section className="lv-scheda mc-mosse">
      <h3>
        {t('mc.proposes', null, 'Il pilota propone')}
        {b?.inAttesaMese > 0 && <span>{conSegno(b.inAttesaMese, intlLocale)}{t('mc.perMonth', null, '/mese')}</span>}
      </h3>
      {b?.misurate > 0 && <p className="mc-bilancio">{t('mc.track', { giuste: b.giuste, misurate: b.misurate, vero: conSegno(b.veroMese, intlLocale) }, `Finora ${b.giuste} mosse su ${b.misurate} hanno reso come previsto: ${conSegno(b.veroMese, intlLocale)} al mese, misurati.`)}</p>}
      <ul className="mc-elenco">{mosse.map(m => <Mossa key={m.id} m={m} onDecidi={decidi} inCorso={inCorso} />)}</ul>
      {errore && <p className="mc-errore">{errore}</p>}
    </section>
  )
}
