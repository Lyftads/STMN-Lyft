'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamicImport from 'next/dynamic'
import { useT } from '../../lib/i18n/I18nProvider'
import { globalPresetToTf, tfToGlobalPreset } from '../../lib/tfQuery'
import LogoMark from '../components/LogoMark'
import Icon from '../components/ui/Icon'
import BmTimeframe from '../components/ui/BmTimeframe'

// ============================================================================
//  DASHBOARD GENERALE, IN DIRETTA (/generale) — lo schermo da parete del titolare.
//  Tutti i negozi dei clienti insieme: il fatturato grande, il globo con chi e' sui siti
//  adesso e da dove arrivano gli ordini, e a destra gli ordini uno dopo l'altro.
//
//  COSA SEGUE IL PERIODO scelto in alto: fatturato, ordini, spesa pubblicitaria, MER.
//  COSA E' SEMPRE «ADESSO»: globo, visitatori, colonna degli ordini, andamento di oggi.
//
//  DA DOVE VENGONO I NUMERI (una riga per fonte, perche' sono tre e non vanno confuse):
//   · oggi           → la lista degli ordini di Shopify (/api/ordini-live): immediata, e il
//                      numero grande sale esattamente dell'importo dell'ordine che compare;
//   · giorni chiusi  → ShopifyQL, total_sales: la cifra della Dashboard di ogni negozio;
//   · spesa          → /api/metrics e /api/google dell'app del negozio (quella dedicata, se ce
//                      l'ha: li' le campagne per i negozi fisici sono gia' fuori), ogni 5 minuti.
//  Qui dentro c'e' TUTTO, marketplace compresi (Koongo): scelta di Marino per questo schermo.
//  Nelle Dashboard di Anna Virgili e Dude il marketplace resta a parte: li' il fatturato e' piu' basso.
//
//  Se un negozio non risponde il totale si mostra lo stesso, ma la riga sotto dice chi manca:
//  mai una somma a meta' spacciata per intera. Spesa e MER, invece, senza tutti i negozi non
//  si mostrano (meta' spesa = MER doppio).
//
//  La vista a schede con tutti i KPI per periodo e per negozio sta su /generale/numeri.
// ============================================================================

const GloboLive = dynamicImport(() => import('./GloboLive'), { ssr: false })

const OGNI_ORDINI = 20_000, OGNI_VISITE = 30_000, OGNI_SPESA = 5 * 60_000
const IMPULSO_MS = 7_000
const RIGHE = 14

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const cifra = (v, dec = 0) => new Intl.NumberFormat('it-IT', { useGrouping: 'always', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)
const corto = (v) => (v >= 1_000_000 ? `${cifra(v / 1_000_000, 2)} M` : v >= 10_000 ? `${cifra(v / 1000, 1)} K` : cifra(Math.round(v)))

async function leggi(ws, lettura, domanda = '') {
  const r = await fetch(`/api/generale?ws=${ws}&lettura=${lettura}${domanda ? '&' + domanda : ''}`, { cache: 'no-store' })
  if (r.status === 401 || r.status === 403) throw new Error('accesso')
  const j = await r.json().catch(() => null)
  if (!r.ok || !j) throw new Error('lettura')
  return j
}

// Un numero che scorre fino al nuovo valore, e manda un lampo quando sale.
function Numero({ valore, formato, className }) {
  const [mostrato, setMostrato] = useState(valore)
  const [lampo, setLampo] = useState(0)
  const da = useRef(valore)
  useEffect(() => {
    if (valore == null) { da.current = null; setMostrato(null); return }
    const inizio = da.current
    if (inizio == null || inizio === valore) { da.current = valore; setMostrato(valore); return }
    if (valore > inizio) setLampo(l => l + 1)
    const t0 = performance.now(), durata = 900
    let id
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / durata), e = 1 - Math.pow(1 - k, 3)
      const x = inizio + (valore - inizio) * e
      da.current = x; setMostrato(x)
      if (k < 1) id = requestAnimationFrame(passo); else da.current = valore
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [valore])
  return (
    <span className={`gl-numero ${className || ''}`}>
      {lampo > 0 && <span key={lampo} className="gl-lampo" />}
      <span style={{ position: 'relative' }}>{mostrato == null ? '—' : formato(mostrato)}</span>
    </span>
  )
}

function Orologio() {
  const [ora, setOra] = useState('')
  useEffect(() => {
    const batti = () => setOra(new Date().toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit', second: '2-digit' }))
    batti(); const id = setInterval(batti, 1000); return () => clearInterval(id)
  }, [])
  return <span className="gl-orologio">{ora}</span>
}

// L'andamento di oggi contro ieri: fatturato che si accumula lungo la giornata.
function Andamento({ oggi, passoMin, ieri }) {
  const L = 600, A = 170, sopra = 10
  const fine = oggi.length ? oggi[oggi.length - 1] : 0
  const max = Math.max(fine, ieri ? ieri[ieri.length - 1] : 0, 1)
  const x = (minuti) => Math.min(L, (minuti / 1440) * L)
  const y = (v) => A - (v / max) * (A - sopra)
  const lineaOggi = oggi.map((v, i) => `${i ? 'L' : 'M'}${x(i * passoMin).toFixed(1)},${y(v).toFixed(1)}`).join(' ')
  const lineaIeri = ieri ? ieri.map((v, i) => `${i ? 'L' : 'M'}${x(i * 60).toFixed(1)},${y(v).toFixed(1)}`).join(' ') : ''
  const ux = x((oggi.length - 1) * passoMin), uy = y(fine)
  return (
    <svg viewBox={`0 0 ${L} ${A + 4}`} preserveAspectRatio="none" className="gl-andamento" aria-hidden="true">
      <defs>
        <linearGradient id="gl-sotto" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgba(255,255,255,0.22)" /><stop offset="1" stopColor="rgba(255,255,255,0)" /></linearGradient>
      </defs>
      {lineaIeri && <path d={lineaIeri} fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />}
      {oggi.length > 1 && <path d={`${lineaOggi} L${ux.toFixed(1)},${A} L0,${A} Z`} fill="url(#gl-sotto)" />}
      {oggi.length > 1 && <path d={lineaOggi} fill="none" stroke="#fff" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />}
      <line x1="0" y1={A} x2={L} y2={A} stroke="rgba(255,255,255,0.14)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}

export default function GeneraleLive() {
  const t = useT()
  const [negozi, setNegozi] = useState(null)
  const [daCollegare, setDaCollegare] = useState([])
  const [chiuso, setChiuso] = useState(null)     // 'accesso' | 'lettura'
  const [preset, setPreset] = useState('today')
  const [ordini, setOrdini] = useState({})       // «negozio|periodo» → { d, alle, errore }
  const [visite, setVisite] = useState({})       // negozio → { d, alle }
  const [spesa, setSpesa] = useState({})         // «negozio|periodo» → { meta, google, alle, errore }
  const [impulsi, setImpulsi] = useState([])     // ordini appena arrivati: anello sul globo, riga accesa
  const [, setBattito] = useState(0)             // fa rifare i «3 min fa»
  const visti = useRef(new Map())                // negozio → Set(id ordine)
  const pieno = useRef(false)

  // Schermo scuro, sempre: e' un cruscotto da parete. Si rimette il tema di prima uscendo.
  useLayoutEffect(() => {
    const root = document.documentElement
    const prima = root.dataset.theme, primaSchema = root.style.colorScheme
    const scuro = () => { if (root.dataset.theme !== 'dark') { root.dataset.theme = 'dark'; root.style.colorScheme = 'dark' } }
    scuro()
    const occhio = new MutationObserver(scuro)
    occhio.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { occhio.disconnect(); if (prima) root.dataset.theme = prima; else delete root.dataset.theme; root.style.colorScheme = primaSchema }
  }, [])

  useEffect(() => {
    fetch('/api/generale?elenco=1', { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'accesso' : 'lettura'); return r.json() })
      .then(j => { setNegozi(j.negozi || []); setDaCollegare(j.daCollegare || []) })
      .catch(e => setChiuso(e.message))
  }, [])

  // ── gli ordini: ogni 20 secondi, per ogni negozio ───────────────────────────
  const leggiOrdini = useCallback((p) => {
    for (const n of (negozi || [])) {
      const k = `${n.id}|${p}`
      leggi(n.id, 'ordini-live', `preset=${encodeURIComponent(p)}`)
        .then(d => {
          if (!d?.ok) throw new Error(d?.error || 'lettura')
          // gli ordini mai visti prima: alla prima lettura si segnano e basta, dopo fanno l'impulso
          const gia = visti.current.get(n.id)
          const ora = new Set((d.ultimi || []).map(o => o.id))
          if (gia) {
            const nuovi = (d.ultimi || []).filter(o => !gia.has(o.id) && Date.now() - o.t < 15 * 60_000).reverse()
            if (nuovi.length) {
              const scade = Date.now() + IMPULSO_MS
              setImpulsi(v => [...v, ...nuovi.map(o => ({ id: o.id, lat: o.la, lng: o.ln, euro: cifra(Math.round(o.e)), scade }))].slice(-8))
              setTimeout(() => setImpulsi(v => v.filter(x => x.scade > Date.now())), IMPULSO_MS + 200)
            }
            for (const id of ora) gia.add(id)
          } else visti.current.set(n.id, ora)
          setOrdini(s => ({ ...s, [k]: { d, alle: Date.now(), errore: null } }))
        })
        .catch(e => setOrdini(s => ({ ...s, [k]: { ...s[k], errore: e.message || 'lettura' } })))
    }
  }, [negozi])
  useEffect(() => {
    if (!negozi?.length) return
    leggiOrdini(preset)
    const id = setInterval(() => { if (!document.hidden) leggiOrdini(preset) }, OGNI_ORDINI)
    const torna = () => { if (!document.hidden) leggiOrdini(preset) }
    document.addEventListener('visibilitychange', torna)
    return () => { clearInterval(id); document.removeEventListener('visibilitychange', torna) }
  }, [negozi, preset, leggiOrdini])

  // ── chi e' sui siti adesso: ogni 30 secondi ─────────────────────────────────
  useEffect(() => {
    if (!negozi?.length) return
    const giro = () => { for (const n of negozi) leggi(n.id, 'realtime').then(d => setVisite(s => ({ ...s, [n.id]: { d, alle: Date.now() } }))).catch(() => {}) }
    giro()
    const id = setInterval(() => { if (!document.hidden) giro() }, OGNI_VISITE)
    return () => clearInterval(id)
  }, [negozi])

  // ── la spesa pubblicitaria del periodo: ogni 5 minuti ───────────────────────
  useEffect(() => {
    if (!negozi?.length) return
    const giro = () => {
      for (const n of negozi) {
        const k = `${n.id}|${preset}`
        Promise.all([leggi(n.id, 'metrics', `preset=${encodeURIComponent(preset)}`), leggi(n.id, 'google').catch(() => null)])
          .then(([m, g]) => {
            const sr = m?.shopifyRange, mr = m?.metaRange
            if (!sr?.since) throw new Error('vuoto')
            const giorni = (g?.daily || []).filter(d => d.date >= sr.since && d.date <= sr.until)
            setSpesa(s => ({ ...s, [k]: {
              meta: mr ? num(mr.spend) : null,
              // Google non collegato vale zero; Google collegato ma non arrivato NON si somma
              google: g == null ? null : g.configured ? giorni.reduce((a, d) => a + num(d.spend), 0) : 0,
              alle: Date.now(), errore: null,
            } }))
          })
          .catch(e => setSpesa(s => ({ ...s, [k]: { ...s[k], errore: e.message || 'lettura' } })))
      }
    }
    giro()
    const id = setInterval(() => { if (!document.hidden) giro() }, OGNI_SPESA)
    return () => clearInterval(id)
  }, [negozi, preset])

  useEffect(() => { const id = setInterval(() => setBattito(b => b + 1), 15_000); return () => clearInterval(id) }, [])

  // ── la somma ────────────────────────────────────────────────────────────────
  const lista = useMemo(() => negozi || [], [negozi])
  const quadro = useMemo(() => {
    const righe = lista.map(n => ({ n, o: ordini[`${n.id}|${preset}`], s: spesa[`${n.id}|${preset}`], v: visite[n.id] }))
    const arrivati = righe.filter(r => r.o?.d)
    // chi manca: mai arrivato e in errore, fermo da piu' di due minuti, o coi giorni chiusi non letti
    const mancanti = righe.filter(r => (!r.o?.d && r.o?.errore) || (r.o?.d && Date.now() - r.o.alle > 120_000) || r.o?.d?.chiusoErrore).map(r => r.n.nome)
    const tutti = arrivati.length === lista.length && lista.length > 0
    let fatturato = 0, nOrdini = 0, vivoOggi = 0, ieriStessaOra = 0, ieriTotale = 0, prima = 0, primaCe = arrivati.length > 0, ieriCe = arrivati.length > 0
    let passoMin = 10
    const curve = [], curvaIeri = Array.from({ length: 25 }, () => 0)
    const feed = [], luoghi = []
    let periodo = null, conOggi = true
    for (const r of arrivati) {
      const d = r.o.d
      periodo = periodo || d.periodo; conOggi = d.conOggi; passoMin = d.passoMin || 10
      fatturato += num(d.chiuso?.fatturato) + (d.conOggi ? num(d.vivo.fatturato) : 0)
      nOrdini += num(d.chiuso?.ordini) + (d.conOggi ? num(d.vivo.ordini) : 0)
      vivoOggi += num(d.vivo.fatturato)
      if (d.ieriOre) { ieriStessaOra += num(d.ieriOre.allaStessaOra.fatturato); ieriTotale += num(d.ieriOre.totale); d.ieriOre.curva.forEach((v, i) => { curvaIeri[i] += num(v) }) } else ieriCe = false
      if (d.prima) prima += num(d.prima.fatturato); else primaCe = false
      if (d.vivo.curva?.length) curve.push(d.vivo.curva)
      for (const o of (d.ultimi || [])) feed.push({ ...o, negozio: r.n.nome })
      for (const l of (d.luoghi || [])) luoghi.push(l)
    }
    // le curve dei negozi si sommano punto per punto; chi ha un punto in meno (letto un attimo
    // prima) vale il suo ultimo valore
    const lunga = Math.max(0, ...curve.map(c => c.length))
    const curvaOggi = Array.from({ length: lunga }, (_, i) => curve.reduce((a, c) => a + num(c[Math.min(i, c.length - 1)]), 0))
    feed.sort((a, b) => b.t - a.t)
    const soloOggi = !!periodo && periodo.since === periodo.until && conOggi
    // la spesa vale solo se l'hanno data TUTTI i negozi, Meta e Google
    const speseTutte = lista.length > 0 && righe.every(r => r.s && r.s.meta != null && r.s.google != null)
    const sp = speseTutte ? righe.reduce((a, r) => a + r.s.meta + r.s.google, 0) : null
    const spesaAlle = speseTutte ? Math.min(...righe.map(r => r.s.alle)) : null
    const conVisite = righe.filter(r => r.v?.d && r.v.d.configured !== false)
    const visitatori = conVisite.length ? conVisite.reduce((a, r) => a + num(r.v.d.activeUsers), 0) : null
    const punti = conVisite.flatMap(r => r.v.d.points || [])
    const base = soloOggi ? (ieriCe ? ieriStessaOra : null) : (primaCe ? prima : null)
    return {
      arrivati: arrivati.length, tutti, mancanti, fatturato: arrivati.length ? fatturato : null, ordini: arrivati.length ? nOrdini : null,
      spesa: sp, spesaAlle, mer: sp > 0 && tutti ? fatturato / sp : null,
      visitatori, punti, luoghi, feed: feed.slice(0, RIGHE),
      periodo, conOggi, soloOggi,
      delta: base > 0 && tutti ? (fatturato - base) / base * 100 : null,
      passo: ieriCe && ieriStessaOra > 0 ? (vivoOggi - ieriStessaOra) / ieriStessaOra * 100 : null,
      curvaOggi, curvaIeri: ieriCe ? curvaIeri : null, ieriTotale: ieriCe ? ieriTotale : null, passoMin,
    }
  }, [lista, ordini, spesa, visite, preset])

  const accesi = new Set(impulsi.map(i => i.id))
  const fa = (ms) => {
    const s = Math.max(0, (Date.now() - ms) / 1000)
    if (s < 60) return t('gen.lv.now', null, 'adesso')
    if (s < 3600) return t('gen.lv.minAgo', { n: Math.floor(s / 60) }, `${Math.floor(s / 60)} min fa`)
    return t('gen.lv.hAgo', { n: Math.floor(s / 3600) }, `${Math.floor(s / 3600)} h fa`)
  }
  const segno = (v) => `${v >= 0 ? '+' : '−'}${cifra(Math.abs(v), Math.abs(v) < 100 ? 1 : 0)}%`
  const schermo = () => {
    try { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen() } catch {}
    pieno.current = !pieno.current
  }

  return (
    <div className="gl">
      {/* dangerouslySetInnerHTML: gli apici dentro un <style> il server li scrive come entita' e il browser no → errore di idratazione */}
      <style dangerouslySetInnerHTML={{ __html: CSS }} />

      <header className="gl-testa">
        <a href="/" className="gl-marchio" title={t('gen.backToApp', null, 'Torna a LyftAI')}>
          <LogoMark size={30} />
          <span>LyftAI</span>
        </a>
        <div className="gl-azioni">
          <span className="gl-live"><i />Live</span>
          <Orologio />
          <BmTimeframe value={globalPresetToTf(preset)} onChange={(x) => setPreset(tfToGlobalPreset(x))} />
          <a href="/generale/numeri" className="gl-tasto" title={t('gen.lv.numbers', null, 'Tutti i numeri, per periodo e per negozio')}><Icon name="grid" size={16} /></a>
          <button type="button" className="gl-tasto gl-solo-largo" onClick={schermo} title={t('gen.lv.fullscreen', null, 'Schermo intero')}><Icon name="desktop" size={16} /></button>
        </div>
      </header>

      {chiuso ? (
        <p className="gl-avviso gl-centro">{chiuso === 'accesso'
          ? t('gen.closed', null, 'Questa pagina è riservata. Se è la tua, rientra con il tuo account e riaprila.')
          : t('gen.listFailed', null, 'L’elenco dei negozi non è arrivato. Ricarica la pagina fra un minuto.')}</p>
      ) : negozi && lista.length === 0 ? (
        <p className="gl-avviso gl-centro">{t('gen.noShops', null, 'Nessun cliente con Shopify collegato.')}</p>
      ) : (
        <main className="gl-corpo">
          <div className="gl-globo"><GloboLive visitatori={quadro.punti} luoghi={quadro.luoghi} impulsi={impulsi} /></div>

          <section className="gl-sinistra">
            <p className="gl-sopra">
              {/* solo la parola: niente numero di negozi e niente periodo accanto (Marino, 27 nov) — il periodo sta nel selettore */}
              {t('gen.lv.revenue', null, 'Fatturato')}
              {!quadro.soloOggi && quadro.delta != null && <span className="gl-delta">{t('gen.lv.vsPrev', { p: segno(quadro.delta) }, `${segno(quadro.delta)} sul periodo prima`)}</span>}
            </p>
            <div className="gl-eroe"><span className="gl-euro">€</span><Numero valore={quadro.fatturato} formato={(v) => cifra(Math.round(v))} /></div>
            {(quadro.mancanti.length > 0 || (!quadro.tutti && lista.length > 0)) && (
              <p className="gl-avviso">{quadro.mancanti.length > 0
                ? t('gen.lv.missing', { nomi: quadro.mancanti.join(', ') }, `Totale senza ${quadro.mancanti.join(', ')}: i dati non arrivano.`)
                : t('gen.readingN', { a: quadro.arrivati, n: lista.length }, `sto leggendo… ${quadro.arrivati} negozi su ${lista.length}`)}</p>
            )}

            <div className="gl-coppia">
              <div className="gl-dato"><span className="gl-et">{t('gen.lv.orders', null, 'Ordini')}</span><Numero className="gl-medio" valore={quadro.ordini} formato={(v) => cifra(Math.round(v))} /></div>
              <div className="gl-dato"><span className="gl-et" title={t('gen.merSub', null, 'fatturato ÷ spesa totale')}>MER</span><Numero className="gl-medio" valore={quadro.mer} formato={(v) => cifra(v, 2)} /></div>
            </div>
            <div className="gl-dato">
              <span className="gl-et">{t('gen.lv.adSpend', null, 'Spesa pubblicitaria')}</span>
              <span className="gl-medio"><Numero valore={quadro.spesa} formato={(v) => `€${cifra(Math.round(v))}`} /></span>
              <span className="gl-sotto">{quadro.spesaAlle ? t('gen.lv.checked', { q: fa(quadro.spesaAlle) }, `Meta + Google · ultimo controllo ${fa(quadro.spesaAlle)}`) : t('gen.lv.spendWait', null, 'Meta + Google · in arrivo')}</span>
            </div>
            <div className="gl-riga">
              <span className="gl-et"><i className="gl-pallino" />{t('gen.lv.visitors', null, 'Sui siti adesso')} <em>{t('gen.lv.last5', null, 'ultimi 5 minuti')}</em></span>
              <Numero className="gl-piccolo" valore={quadro.visitatori} formato={(v) => cifra(Math.round(v))} />
            </div>

            <div className="gl-passo">
              <p className="gl-passo-testa">
                <b>{t('gen.lv.pace', null, 'Andamento di oggi')}</b>
                {quadro.passo != null && <span>{t('gen.lv.vsYesterday', { p: segno(quadro.passo) }, `${segno(quadro.passo)} su ieri alla stessa ora`)}</span>}
              </p>
              <p className="gl-legenda">
                <span><i className="gl-tratto" />{t('gen.lv.today', null, 'oggi')}</span>
                {quadro.ieriTotale != null && <span><i className="gl-tratto gl-tratteggio" />{t('gen.lv.yesterdayEnded', { v: corto(quadro.ieriTotale) }, `ieri (chiuso a €${corto(quadro.ieriTotale)})`)}</span>}
              </p>
              <Andamento oggi={quadro.curvaOggi} passoMin={quadro.passoMin} ieri={quadro.curvaIeri} />
              <p className="gl-ore"><span>00</span><span>06</span><span>12</span><span>18</span><span>24</span></p>
            </div>
          </section>

          <section className="gl-destra">
            <p className="gl-et gl-titolo-ordini">{t('gen.lv.liveOrders', null, 'Ordini in tempo reale')}</p>
            {quadro.feed.length === 0 && <p className="gl-sotto">{quadro.arrivati ? t('gen.lv.noOrders', null, 'Ancora nessun ordine oggi.') : t('gen.reading', null, 'sto leggendo…')}</p>}
            <ul className="gl-ordini">
              {quadro.feed.map(o => (
                <li key={`${o.negozio}-${o.id}`} className={accesi.has(o.id) ? 'gl-nuovo' : ''}>
                  <span className="gl-borsa"><Icon name="bag" size={13} /></span>
                  <span className="gl-chi">
                    <b>{o.negozio}</b> <span>{o.n}</span>
                    <em>{[o.c || o.p, fa(o.t)].filter(Boolean).join(' · ')}</em>
                  </span>
                  <span className="gl-quanto">€{cifra(Math.round(o.e))}</span>
                </li>
              ))}
            </ul>
            {daCollegare.length > 0 && <p className="gl-sotto">{t('gen.toConnect', { nomi: daCollegare.join(', ') }, `Fuori dal totale perché senza Shopify collegato: ${daCollegare.join(', ')}.`)}</p>}
          </section>
        </main>
      )}
    </div>
  )
}

const CSS = `
.cookie-consent{display:none!important}
.gl{position:fixed;inset:0;background:#000;color:#fff;overflow:hidden;display:flex;flex-direction:column;font-family:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.gl-testa{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(14px,2vh,26px) clamp(16px,2.6vw,48px) 0;position:relative;z-index:30}
.gl-marchio{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-size:clamp(18px,1.5vw,26px);font-weight:640;letter-spacing:-.04em}
.gl-azioni{display:flex;align-items:center;gap:10px}
.gl-live{display:inline-flex;align-items:center;gap:7px;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:5px 12px;font-size:12px;font-weight:600;letter-spacing:.02em}
.gl-live i{width:7px;height:7px;border-radius:50%;background:#fff;animation:gl-batte 1.6s ease-in-out infinite}
.gl-orologio{font-size:13px;color:rgba(255,255,255,.6);min-width:66px}
.gl-tasto{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;transition:background .15s}
.gl-tasto:hover{background:rgba(255,255,255,.12)}
.gl-corpo{flex:1;min-height:0;position:relative;display:grid;grid-template-columns:minmax(320px,36vw) 1fr minmax(290px,25vw);gap:0;padding:clamp(10px,2.2vh,30px) clamp(16px,2.6vw,48px) clamp(14px,2.4vh,32px)}
.gl-globo{position:absolute;left:50%;top:56%;width:min(104vh,58vw);height:min(104vh,58vw);transform:translate(-50%,-50%);z-index:1}
.gl-globo canvas{outline:none}
.gl-sinistra{grid-column:1;position:relative;z-index:5;display:flex;flex-direction:column;min-height:0;pointer-events:none}
.gl-sinistra>*{pointer-events:auto}
.gl-destra{grid-column:3;position:relative;z-index:5;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.gl-sopra{margin:0;font-size:clamp(14px,1.25vw,22px);color:rgba(255,255,255,.72);font-weight:400;white-space:nowrap}
.gl-sopra b{color:#fff;font-weight:600}
.gl-delta{margin-left:14px;font-size:.82em;color:rgba(255,255,255,.72)}
.gl-eroe{display:flex;align-items:flex-start;gap:.12em;font-size:clamp(58px,8.4vw,176px);font-weight:600;letter-spacing:-.045em;line-height:1;margin:clamp(6px,1.2vh,16px) 0 clamp(10px,2.2vh,28px);white-space:nowrap;text-shadow:0 0 40px rgba(0,0,0,.9)}
.gl-euro{font-size:.5em;margin-top:.16em;font-weight:500}
.gl-numero{position:relative;display:inline-block}
.gl-lampo{position:absolute;inset:-18% -8%;border-radius:18px;background:radial-gradient(ellipse at center,rgba(255,236,200,.42),rgba(255,236,200,0) 68%);animation:gl-lampo 1.5s ease-out forwards;pointer-events:none}
.gl-avviso{margin:-6px 0 14px;font-size:13px;color:rgba(255,255,255,.7)}
.gl-centro{margin:auto;text-align:center;max-width:460px;padding:0 20px}
.gl-coppia{display:flex;gap:clamp(22px,3.4vw,64px)}
.gl-dato{display:flex;flex-direction:column;margin-bottom:clamp(10px,2vh,24px)}
.gl-et{font-size:clamp(12px,.95vw,16px);color:rgba(255,255,255,.72);font-weight:500;display:flex;align-items:center;gap:8px}
.gl-et em{font-style:normal;color:rgba(255,255,255,.42)}
.gl-medio{font-size:clamp(28px,3vw,58px);font-weight:600;letter-spacing:-.035em;line-height:1.12}
.gl-piccolo{font-size:clamp(20px,1.9vw,36px);font-weight:600;letter-spacing:-.03em}
.gl-sotto{font-size:12px;color:rgba(255,255,255,.45);margin:2px 0 0}
.gl-riga{display:flex;align-items:center;justify-content:space-between;gap:16px;max-width:min(100%,30vw);margin-bottom:clamp(10px,2vh,22px)}
.gl-pallino{width:7px;height:7px;border-radius:50%;background:#6fd3ff;display:inline-block}
.gl-passo{margin-top:auto;max-width:min(100%,30vw)}
.gl-passo-testa{margin:0 0 4px;font-size:clamp(13px,1.05vw,18px);display:flex;gap:10px;align-items:baseline;flex-wrap:wrap}
.gl-passo-testa b{font-weight:600}
.gl-passo-testa span{font-weight:600}
.gl-legenda{margin:0 0 6px;display:flex;gap:16px;font-size:11.5px;color:rgba(255,255,255,.5)}
.gl-legenda span{display:inline-flex;align-items:center;gap:7px}
.gl-tratto{width:18px;height:0;border-top:2px solid #fff;display:inline-block}
.gl-tratteggio{border-top:2px dashed rgba(255,255,255,.45)}
.gl-andamento{width:100%;height:clamp(84px,15vh,170px);display:block}
.gl-ore{display:flex;justify-content:space-between;margin:4px 0 0;font-size:11px;color:rgba(255,255,255,.4)}
.gl-titolo-ordini{margin:0 0 clamp(8px,1.4vh,16px)}
.gl-ordini{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:clamp(4px,1.05vh,13px);min-height:0;overflow:hidden}
.gl-ordini li{display:flex;align-items:center;gap:12px;padding:5px 8px;margin:0 -8px;border-radius:10px;animation:gl-entra .5s ease-out both;transition:background 1.2s}
.gl-ordini li.gl-nuovo{background:rgba(255,255,255,.12)}
.gl-borsa{width:24px;height:24px;border-radius:7px;background:#fff;color:#000;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.gl-chi{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25;font-size:clamp(12px,.95vw,15px);white-space:nowrap;overflow:hidden}
.gl-chi b{font-weight:600}
.gl-chi>span{color:rgba(255,255,255,.55);font-weight:400;display:none;max-width:7.5em;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.gl-chi b{flex-shrink:0}
.gl-chi em{font-style:normal;font-size:.84em;color:rgba(255,255,255,.48);overflow:hidden;text-overflow:ellipsis}
.gl-quanto{font-size:clamp(13px,1.05vw,17px);font-weight:600;flex-shrink:0}
.gl-impulso{position:relative;transform:translate(-50%,-50%);pointer-events:none}
.gl-impulso-punto{display:block;width:12px;height:12px;border-radius:50%;background:#fff;box-shadow:0 0 18px 6px rgba(255,255,255,.55);margin:0 auto}
.gl-impulso-euro{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);font:600 clamp(15px,1.5vw,26px)/1 'Inter',sans-serif;color:#fff;white-space:nowrap;text-shadow:0 2px 14px #000,0 0 4px #000;animation:gl-sale 7s ease-out forwards}
@keyframes gl-batte{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes gl-lampo{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
@keyframes gl-entra{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes gl-sale{0%{opacity:0;transform:translate(-50%,10px)}8%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px)}}
@media (min-width:1500px){.gl-chi{flex-direction:row;align-items:baseline;gap:10px}.gl-chi>span{display:inline}}
@media (max-width:900px){
  .gl{position:static;min-height:100dvh;overflow:visible}
  .gl-solo-largo,.gl-orologio,.gl-marchio span{display:none}
  .gl-testa{gap:10px}.gl-azioni{gap:8px;min-width:0}
  .gl-corpo{display:flex;flex-direction:column;padding:18px 16px 40px}
  .gl-globo{position:relative;left:auto;top:auto;transform:none;width:100%;height:92vw;order:2;margin:6px 0}
  .gl-sinistra{order:1}.gl-destra{order:3;overflow:visible}
  .gl-sopra{white-space:normal}
  .gl-eroe{font-size:clamp(46px,15vw,84px)}
  .gl-riga,.gl-passo{max-width:100%}
  .gl-passo{margin-top:8px}
  .gl-delta{display:block;margin:4px 0 0}
}
@media (prefers-reduced-motion:reduce){.gl-lampo,.gl-live i,.gl-ordini li,.gl-impulso-euro{animation:none}}
`
