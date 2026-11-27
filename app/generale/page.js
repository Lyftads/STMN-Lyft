'use client'

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import dynamicImport from 'next/dynamic'
import { useT } from '../../lib/i18n/I18nProvider'
import { globalPresetToTf, tfToGlobalPreset } from '../../lib/tfQuery'
import LogoMark from '../components/LogoMark'
import Icon from '../components/ui/Icon'
import BmTimeframe from '../components/ui/BmTimeframe'
import PlatformIcon from '../components/PlatformIcon'
import Stelle from './Stelle'

// ============================================================================
//  DASHBOARD GENERALE, IN DIRETTA (/generale) — lo schermo da parete del titolare.
//  Tutti i negozi dei clienti insieme: il fatturato grande, il globo con chi e' sui siti
//  adesso e da dove arrivano gli ordini, e a destra gli ordini uno dopo l'altro.
//
//  COSA SEGUE IL PERIODO scelto in alto: fatturato, ordini, spesa pubblicitaria, MER.
//  COSA E' SEMPRE «ADESSO»: globo, visitatori, colonna degli ordini, andamento di oggi.
//
//  I COLORI sono due e dicono due cose: ORO = gli ordini (numeri delle schede, puntini, impulsi e
//  flussi sul globo, da chi compra alla sede del negozio), AZZURRO = chi e' sui siti adesso.
//
//  DA DOVE VENGONO I NUMERI (una riga per fonte, perche' sono tre e non vanno confuse):
//   · oggi           → la lista degli ordini di Shopify (/api/ordini-live): immediata, e il
//                      numero grande sale esattamente dell'importo dell'ordine che compare;
//   · giorni chiusi  → ShopifyQL, total_sales: la cifra della Dashboard di ogni negozio;
//   · spesa          → Meta da /api/spesa-meta (una domanda sola, risponde anche su un anno),
//                      Google da /api/google; per chi ha un'app dedicata si tolgono le campagne
//                      per i negozi fisici e follower, con la cifra chiesta a quell'app: e' la
//                      stessa spesa su cui la sua Dashboard calcola il MER. Ogni 5 minuti.
//                      (Prima veniva da /api/metrics, che sui periodi lunghi non rispondeva.)
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
const FLUSSO_MIN = 30   // per quanti minuti il flusso di un ordine resta sul globo
const RIGHE = 14

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const cifra = (v, dec = 0) => new Intl.NumberFormat('it-IT', { useGrouping: 'always', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(v)
const corto = (v) => (v >= 1_000_000 ? `${cifra(v / 1_000_000, 2)} M` : v >= 10_000 ? `${cifra(v / 1000, 1)} K` : cifra(Math.round(v)))

// La spesa Google di un periodo dalla risposta di /api/google: i giorni (gli ultimi ~100) dove
// ci sono, i mesi interi per la parte piu' vecchia. Un mese a meta' che i giorni non coprono non
// si puo' ricostruire: allora null (spesa non nota), mai una cifra approssimata.
function googleNelPeriodo(g, since, until) {
  if (!g) return null
  if (!g.configured) return 0
  const giorni = g.daily || [], mesi = g.monthly || []
  const sommaGiorni = (da) => giorni.filter(d => d.date >= da && d.date <= until).reduce((a, d) => a + num(d.spend), 0)
  const primo = giorni[0]?.date
  if (!primo) return mesi.length ? null : 0
  if (since >= primo) return sommaGiorni(since)
  if (!since.endsWith('-01')) return null
  // il primo mese che i giorni coprono per intero
  const [y, m] = primo.split('-').map(Number)
  const confine = primo.endsWith('-01') ? primo : `${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, '0')}-01`
  const daiMesi = mesi.filter(x => x.month >= since.slice(0, 7) && x.month < confine.slice(0, 7)).reduce((a, x) => a + num(x.spend), 0)
  return daiMesi + sommaGiorni(confine)
}

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
  // Gli ordini sfocati: per condividere lo schermo o farne una storia senza mostrare negozi, citta'
  // e importi. La scelta si ricorda su questo dispositivo (se il browser non lo permette, pazienza).
  const [sfocati, setSfocati] = useState(false)
  useEffect(() => { try { if (localStorage.getItem('lyft-generale-sfoca') === '1') setSfocati(true) } catch {} }, [])
  const cambiaSfoca = () => setSfocati(v => { try { localStorage.setItem('lyft-generale-sfoca', v ? '0' : '1') } catch {}; return !v })
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
        ;(async () => {
          const meta = await leggi(n.id, 'spesa-meta', `preset=${encodeURIComponent(preset)}`)
          if (!meta?.ok) throw new Error(meta?.error || 'meta')
          const { since, until } = meta.periodo
          const q = `since=${since}&until=${until}`
          // chi ha un'app dedicata: le campagne che la sua Dashboard tiene fuori dal MER si tolgono
          // (una domanda per gruppo di campagne; se una non arriva, la spesa di quel negozio non e' nota)
          const [g, ...tolte] = await Promise.all([
            leggi(n.id, 'google').catch(() => null),
            ...(meta.collegato ? (n.fuori || []) : []).map(x => leggi(n.id, 'drive-to-store', x ? `${q}&${x}` : q)),
          ])
          const fuori = tolte.reduce((a, d) => a + (d && d.attivo !== false ? num(d.spesa) : 0), 0)
          return { meta: Math.max(0, num(meta.spesa) - fuori), google: googleNelPeriodo(g, since, until) }
        })()
          .then(v => setSpesa(s => ({ ...s, [k]: { ...v, alle: Date.now(), errore: null } })))
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
    const feed = [], luoghi = [], flussi = [], sedi = []
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
      // i flussi: da chi ha comprato alla sede del negozio, per gli ordini dell'ultima mezz'ora
      if (d.sede) {
        sedi.push({ lat: d.sede.lat, lng: d.sede.lng, nome: r.n.nome })
        for (const o of (d.ultimi || [])) {
          const minuti = (Date.now() - o.t) / 60_000
          if (o.la == null || o.ln == null || minuti > FLUSSO_MIN) continue
          if (Math.abs(o.la - d.sede.lat) < 0.05 && Math.abs(o.ln - d.sede.lng) < 0.05) continue   // comprato sotto casa: nessun arco da disegnare
          flussi.push({ id: `${r.n.id}-${o.id}`, startLat: o.la, startLng: o.ln, endLat: d.sede.lat, endLng: d.sede.lng, eta: Math.max(0, minuti / FLUSSO_MIN) })
        }
      }
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
      visitatori, punti, luoghi, flussi, sedi, feed: feed.slice(0, RIGHE),
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

      <Stelle />
      <header className="gl-testa">
        <a href="/" className="gl-marchio" title={t('gen.backToApp', null, 'Torna a LyftAI')}>
          <LogoMark size={30} />
          <span>LyftAI</span>
        </a>
        {/* Live e ora insieme, al centro sopra il mondo */}
        <div className="gl-centro-alto"><span className="gl-live"><i />Live</span><Orologio /></div>
        <div className="gl-azioni">
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
          <div className="gl-globo"><GloboLive visitatori={quadro.punti} luoghi={quadro.luoghi} impulsi={impulsi} flussi={quadro.flussi} sedi={quadro.sedi} /></div>

          <section className="gl-sinistra">
            <p className="gl-sopra">
              {/* solo la parola: niente numero di negozi e niente periodo accanto (Marino, 27 nov) — il periodo sta nel selettore */}
              {t('gen.lv.revenue', null, 'Fatturato')}
              <span className="gl-loghi gl-loghi-eroe"><PlatformIcon platform="shopify" size={18} /></span>
              {!quadro.soloOggi && quadro.delta != null && <span className="gl-delta">{t('gen.lv.vsPrev', { p: segno(quadro.delta) }, `${segno(quadro.delta)} sul periodo prima`)}</span>}
            </p>
            <div className="gl-eroe"><span className="gl-euro">€</span><Numero valore={quadro.fatturato} formato={(v) => cifra(Math.round(v))} /></div>
            {(quadro.mancanti.length > 0 || (!quadro.tutti && lista.length > 0)) && (
              <p className="gl-avviso">{quadro.mancanti.length > 0
                ? t('gen.lv.missing', { nomi: quadro.mancanti.join(', ') }, `Totale senza ${quadro.mancanti.join(', ')}: i dati non arrivano.`)
                : t('gen.readingN', { a: quadro.arrivati, n: lista.length }, `sto leggendo… ${quadro.arrivati} negozi su ${lista.length}`)}</p>
            )}

            {/* I quattro dati in schede a vetro (come le schede di KPI Brain, ma traslucide): sopra il
                globo i numeri nudi si perdevano fra i puntini (Marino, 27 nov: «crea piu' contrasto»). */}
            <div className="gl-schede">
              <div className="gl-dato gl-vetro"><span className="gl-et">{t('gen.lv.orders', null, 'Ordini')}<span className="gl-loghi"><PlatformIcon platform="shopify" size={16} /></span></span><Numero className="gl-medio" valore={quadro.ordini} formato={(v) => cifra(Math.round(v))} /></div>
              <div className="gl-dato gl-vetro"><span className="gl-et" title={t('gen.merSub', null, 'fatturato ÷ spesa totale')}>MER</span><Numero className="gl-medio" valore={quadro.mer} formato={(v) => cifra(v, 2)} /></div>
              <div className="gl-dato gl-vetro">
                <span className="gl-et">{t('gen.lv.adSpend', null, 'Spesa pubblicitaria')}</span>
                <Numero className="gl-medio" valore={quadro.spesa} formato={(v) => `€${cifra(Math.round(v))}`} />
                {/* i loghi delle due fonti al posto della scritta «Meta + Google»: nell'etichetta la mandavano a capo */}
                <span className="gl-sotto gl-sotto-loghi"><PlatformIcon platform="meta" size={14} /><PlatformIcon platform="google" size={14} /><span>{quadro.spesaAlle ? fa(quadro.spesaAlle) : t('gen.lv.arriving', null, 'in arrivo')}</span></span>
              </div>
              <div className="gl-dato gl-vetro">
                <span className="gl-et"><i className="gl-pallino" />{t('gen.lv.visitors', null, 'Sui siti adesso')}</span>
                <Numero className="gl-medio" valore={quadro.visitatori} formato={(v) => cifra(Math.round(v))} />
                <span className="gl-sotto">{t('gen.lv.last5', null, 'ultimi 5 minuti')}</span>
              </div>
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
            <p className="gl-et gl-titolo-ordini">
              {t('gen.lv.liveOrders', null, 'Ordini in tempo reale')}
              <button type="button" className="gl-occhio" aria-pressed={sfocati} onClick={cambiaSfoca}
                title={sfocati ? t('gen.lv.unblur', null, 'Mostra gli ordini') : t('gen.lv.blur', null, 'Sfoca gli ordini')}>
                <Icon name="eye" size={15} />
              </button>
            </p>
            {quadro.feed.length === 0 && <p className="gl-sotto">{quadro.arrivati ? t('gen.lv.noOrders', null, 'Ancora nessun ordine oggi.') : t('gen.reading', null, 'sto leggendo…')}</p>}
            <ul className={`gl-ordini${sfocati ? ' gl-sfocato' : ''}`} aria-hidden={sfocati || undefined}>
              {quadro.feed.map(o => (
                <li key={`${o.negozio}-${o.id}`} className={accesi.has(o.id) ? 'gl-nuovo' : ''}>
                  <span className="gl-borsa"><PlatformIcon platform="shopify" size={20} /></span>
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
.gl{position:fixed;inset:0;background:radial-gradient(ellipse 60% 50% at 14% 22%,rgba(58,78,150,.13),transparent 70%),radial-gradient(ellipse 55% 50% at 88% 82%,rgba(104,72,150,.1),transparent 70%),#000;color:#fff;overflow:hidden;display:flex;flex-direction:column;font-family:'Inter',-apple-system,BlinkMacSystemFont,'SF Pro Display',sans-serif;font-variant-numeric:tabular-nums;-webkit-font-smoothing:antialiased}
.gl-stelle{position:fixed;inset:0;width:100%;height:100%;z-index:0;pointer-events:none}
.gl-testa{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:clamp(14px,2vh,26px) clamp(16px,2.6vw,48px) 0;position:relative;z-index:30}
.gl-marchio{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-size:clamp(18px,1.5vw,26px);font-weight:640;letter-spacing:-.04em}
.gl-azioni{display:flex;align-items:center;gap:10px}
.gl-testa{position:relative}
.gl-centro-alto{position:absolute;left:50%;top:calc(clamp(14px,2vh,26px) + 4px);transform:translateX(-50%);display:flex;align-items:center;gap:12px}
.gl-live{display:inline-flex;align-items:center;gap:8px;border:1px solid rgba(255,255,255,.35);border-radius:999px;padding:6px 16px;font-size:13px;font-weight:600;letter-spacing:.03em;background:rgba(0,0,0,.35);-webkit-backdrop-filter:blur(10px);backdrop-filter:blur(10px)}
.gl-live i{width:7px;height:7px;border-radius:50%;background:#ff3b30;box-shadow:0 0 8px rgba(255,59,48,.8);animation:gl-batte 1.6s ease-in-out infinite}
.gl-orologio{font-size:14px;font-weight:500;color:rgba(255,255,255,.82);min-width:66px}
.gl-tasto{width:36px;height:36px;border-radius:10px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.04);color:#fff;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;text-decoration:none;transition:background .15s}
.gl-tasto:hover{background:rgba(255,255,255,.12)}
.gl-corpo{flex:1;min-height:0;position:relative;display:grid;grid-template-columns:minmax(320px,36vw) 1fr minmax(290px,25vw);gap:0;padding:clamp(10px,2.2vh,30px) clamp(16px,2.6vw,48px) clamp(14px,2.4vh,32px)}
.gl-globo{position:absolute;inset:0;z-index:1}
.gl-globo canvas{outline:none}
.gl-zoom{position:absolute;left:50%;bottom:clamp(12px,2.4vh,28px);transform:translateX(-50%);z-index:6;display:flex;gap:8px}
.gl-zoom button{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.22);background:rgba(255,255,255,.1);color:#fff;font-size:22px;font-weight:500;line-height:1;cursor:pointer;display:inline-flex;align-items:center;justify-content:center;-webkit-backdrop-filter:blur(18px) saturate(160%);backdrop-filter:blur(18px) saturate(160%);box-shadow:inset 0 1px 0 rgba(255,255,255,.25),0 8px 22px rgba(0,0,0,.4);transition:background .15s}
.gl-zoom button:hover:not(:disabled){background:rgba(255,255,255,.2)}
.gl-zoom button:disabled{opacity:.35;cursor:default}
.gl-sinistra{grid-column:1;position:relative;z-index:5;display:flex;flex-direction:column;min-height:0;pointer-events:none}
.gl-sinistra>*{pointer-events:auto}
.gl-destra{grid-column:3;position:relative;z-index:5;display:flex;flex-direction:column;min-height:0;overflow:hidden}
.gl-destra::before{content:'';position:absolute;inset:0;z-index:-1;pointer-events:none;background:linear-gradient(90deg,rgba(0,0,0,0) 0,rgba(0,0,0,.6) 20%,rgba(0,0,0,.7) 100%);-webkit-mask-image:linear-gradient(180deg,transparent 0,#000 6%,#000 82%,transparent 100%);mask-image:linear-gradient(180deg,transparent 0,#000 6%,#000 82%,transparent 100%)}
.gl-sopra{margin:0;font-size:clamp(14px,1.25vw,22px);color:rgba(255,255,255,.72);font-weight:400;white-space:nowrap}
.gl-sopra b{color:#fff;font-weight:600}
.gl-delta{margin-left:14px;font-size:.82em;color:rgba(255,255,255,.72)}
.gl-eroe{display:flex;align-items:baseline;gap:.14em;font-size:clamp(44px,5.6vw,116px);font-weight:600;letter-spacing:-.045em;line-height:1.06;margin:clamp(6px,1.2vh,16px) 0 clamp(10px,2.2vh,28px);white-space:nowrap;filter:drop-shadow(0 4px 26px rgba(0,0,0,.75))}
.gl-euro,.gl-eroe .gl-numero>span:last-child{display:inline-block;background:linear-gradient(180deg,#fff2c4 0%,#f4d079 42%,#d9a53c 100%);-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:#f4d079}
.gl-numero{position:relative;display:inline-block}
.gl-lampo{position:absolute;inset:-18% -8%;border-radius:18px;background:radial-gradient(ellipse at center,rgba(255,236,200,.42),rgba(255,236,200,0) 68%);animation:gl-lampo 1.5s ease-out forwards;pointer-events:none}
.gl-avviso{margin:-6px 0 14px;font-size:13px;color:rgba(255,255,255,.7)}
.gl-centro{margin:auto;text-align:center;max-width:460px;padding:0 20px}
.gl-schede{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:clamp(8px,.8vw,14px);width:min(100%,clamp(330px,29vw,560px));margin-bottom:clamp(10px,2vh,24px)}
.gl-dato{display:flex;flex-direction:column;min-width:0}
.gl-vetro{padding:clamp(11px,1.5vh,18px) clamp(13px,1.1vw,20px);border-radius:clamp(16px,1.2vw,22px);background:linear-gradient(160deg,rgba(255,255,255,.16),rgba(255,255,255,.06) 55%,rgba(255,255,255,.09));border:1px solid rgba(255,255,255,.2);box-shadow:inset 0 1px 0 rgba(255,255,255,.3),inset 0 -1px 0 rgba(255,255,255,.05),0 14px 36px rgba(0,0,0,.45);-webkit-backdrop-filter:blur(26px) saturate(170%);backdrop-filter:blur(26px) saturate(170%)}
.gl-vetro .gl-et{color:rgba(255,255,255,.84)}
.gl-vetro .gl-sotto{color:rgba(255,255,255,.62);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.gl-et{font-size:clamp(12px,.95vw,16px);color:rgba(255,255,255,.72);font-weight:500;display:flex;align-items:center;gap:8px}
.gl-et em{font-style:normal;color:rgba(255,255,255,.42)}
.gl-loghi{margin-left:auto;display:inline-flex;align-items:center;gap:6px;flex-shrink:0}
.gl-loghi-eroe{margin-left:10px;vertical-align:-3px}
.gl-sotto-loghi{display:flex;align-items:center;gap:6px;margin-top:5px}
.gl-sopra{display:flex;align-items:center}
.gl-medio{font-size:clamp(26px,2.5vw,50px);font-weight:650;letter-spacing:-.035em;line-height:1.14;color:#fff}
.gl-sotto{font-size:12px;color:rgba(255,255,255,.45);margin:2px 0 0}
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
.gl-titolo-ordini{margin:0 0 clamp(8px,1.4vh,16px);justify-content:space-between}
.gl-occhio{width:30px;height:30px;border-radius:9px;border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.05);color:rgba(255,255,255,.8);display:inline-flex;align-items:center;justify-content:center;cursor:pointer;transition:background .15s,color .15s}
.gl-occhio:hover{background:rgba(255,255,255,.14);color:#fff}
.gl-occhio[aria-pressed=true]{background:#fff;color:#000;border-color:#fff}
.gl-chi,.gl-quanto{transition:filter .25s ease}
.gl-ordini.gl-sfocato{user-select:none;pointer-events:none}
.gl-ordini.gl-sfocato .gl-chi,.gl-ordini.gl-sfocato .gl-quanto{filter:blur(8px)}
.gl-ordini{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:clamp(4px,1.05vh,13px);min-height:0;overflow:hidden}
.gl-ordini li{display:flex;align-items:center;gap:12px;padding:5px 8px;margin:0 -8px;border-radius:10px;animation:gl-entra .5s ease-out both;transition:background 1.2s}
.gl-ordini li.gl-nuovo{background:rgba(255,255,255,.12)}
.gl-borsa{width:22px;height:22px;display:inline-flex;align-items:center;justify-content:center;flex-shrink:0}
.gl-chi{flex:1;min-width:0;display:flex;flex-direction:column;line-height:1.25;font-size:clamp(12px,.95vw,15px);white-space:nowrap;overflow:hidden}
.gl-chi b{font-weight:600}
.gl-chi>span{color:rgba(255,255,255,.55);font-weight:400;display:none;max-width:7.5em;overflow:hidden;text-overflow:ellipsis;flex-shrink:0}
.gl-chi b{flex-shrink:0}
.gl-chi em{font-style:normal;font-size:.84em;color:rgba(255,255,255,.48);overflow:hidden;text-overflow:ellipsis}
.gl-quanto{font-size:clamp(13px,1.05vw,17px);font-weight:600;flex-shrink:0}
.gl-impulso{position:relative;transform:translate(-50%,-50%);pointer-events:none}
.gl-impulso-punto{display:block;width:12px;height:12px;border-radius:50%;background:#ffdf8a;box-shadow:0 0 18px 6px rgba(255,205,96,.6);margin:0 auto}
.gl-impulso-euro{position:absolute;bottom:20px;left:50%;transform:translateX(-50%);font:600 clamp(15px,1.5vw,26px)/1 'Inter',sans-serif;color:#ffdf8a;white-space:nowrap;text-shadow:0 2px 14px #000,0 0 4px #000;animation:gl-sale 7s ease-out forwards}
@keyframes gl-batte{0%,100%{opacity:1}50%{opacity:.25}}
@keyframes gl-lampo{0%{opacity:0}12%{opacity:1}100%{opacity:0}}
@keyframes gl-entra{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
@keyframes gl-sale{0%{opacity:0;transform:translate(-50%,10px)}8%{opacity:1;transform:translate(-50%,0)}80%{opacity:1}100%{opacity:0;transform:translate(-50%,-14px)}}
@media (min-width:1500px){.gl-chi{flex-direction:row;align-items:baseline;gap:10px}.gl-chi>span{display:inline}}
@media (max-width:900px){
  .gl{position:static;min-height:100dvh;overflow:visible;overflow-x:clip}
  .gl-centro-alto{position:static;transform:none;margin-left:auto}
  .gl-schede{width:100%}
  .gl-solo-largo,.gl-orologio,.gl-marchio span{display:none}
  .gl-testa{gap:10px}.gl-azioni{gap:8px;min-width:0}
  .gl-corpo{display:flex;flex-direction:column;padding:18px 16px 40px}
  .gl-globo{position:relative;inset:auto;width:100%;height:100vw;order:2;margin:0}
  .gl-sinistra{order:1}.gl-destra{order:3;overflow:visible}.gl-destra::before{display:none}
  .gl-sopra{white-space:normal}
  .gl-eroe{font-size:clamp(40px,12vw,68px)}
  .gl-passo{max-width:100%}
  .gl-passo{margin-top:8px}
  .gl-delta{display:block;margin:4px 0 0}
}
@media (prefers-reduced-motion:reduce){.gl-lampo,.gl-live i,.gl-ordini li,.gl-impulso-euro{animation:none}}
`
