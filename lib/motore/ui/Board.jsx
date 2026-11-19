'use client'
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import Tela from './Tela'
import SelettorePeriodo from './Periodo'
import Matrice from './Matrice'
import dynamicImport from 'next/dynamic'
// Il funnel 3D porta three.js: resta nel suo pezzo, scaricato solo quando lo si apre.
const Funnel3D = dynamicImport(() => import('./Funnel3D'), { ssr: false, loading: () => <div className="empty"><p>Carico il funnel 3D…</p></div> })

// Lo spaccato della spesa per pubblico di UNA creativita'.
//
// Sono tre economie diverse: sul returning il ROAS e' alto per costruzione,
// perche' quella gente sarebbe tornata comunque, e letto sommato al nuovo
// nasconde se una creativita' sta acquisendo o sta solo raccogliendo.
//
// Un solo colore in tre intensita', non tre colori: i pubblici hanno un ordine
// naturale (freddo -> caldo) e l'azzurro qui non decide niente, descrive. Verde
// e rosso restano riservati ai verdetti.
const PUBBLICI_ET = { new: 'Nuovo', engaged: 'Engagement', returning: 'Returning', unknown: 'Non attribuito' }
const PUBBLICI_ORD = ['new', 'engaged', 'returning', 'unknown']

function ordinaPubblici(p) {
  return PUBBLICI_ORD.filter(k => p?.[k]).map(k => [k, p[k]])
}

function BarraPubblici({ p, alta = false }) {
  const v = ordinaPubblici(p)
  if (!v.length) return null
  return (
    <div className={'pub-barra' + (alta ? ' alta' : '')}>
      {v.map(([k, x]) => (
        <span key={k} className={'pub-fetta pub-' + k} style={{ width: (x.quota * 100) + '%' }}
          title={`${PUBBLICI_ET[k]}: ${eur(x.spesa, 0)} (${pct(x.quota * 100, 0)})`} />
      ))}
    </div>
  )
}

function SpesaPerPubblico({ p }) {
  const v = ordinaPubblici(p)
  if (!v.length) return null
  return (
    <>
      <h3>Spesa per pubblico</h3>
      <BarraPubblici p={p} alta />
      <table className="pub-tab">
        <thead><tr><th>Pubblico</th><th className="num">Spesa</th><th className="num">Quota</th>
          <th className="num">Ordini</th><th className="num">ROAS</th><th className="num">CPO</th></tr></thead>
        <tbody>
          {v.map(([k, x]) => (
            <tr key={k}>
              <td><span className={'pub-punto pub-' + k} />{PUBBLICI_ET[k]}</td>
              <td className="num mono">{eur(x.spesa, 0)}</td>
              <td className="num mono">{pct(x.quota * 100, 0)}</td>
              <td className="num mono">{Math.round(x.ordini)}</td>
              <td className="num mono">{x.ordini ? num(x.roas) : '—'}</td>
              <td className="num mono">{x.ordini ? eur(x.cpo, 2) : '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}

const eur = (n, d = 0) => '€' + (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const num = (n, d = 2) => (n ?? 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })
const pct = (n, d = 2) => num(n, d) + '%'

// Ordine dei verdetti: prima ciò che richiede una decisione, poi il resto.
// Quante creatività mostra un ramo prima di chiedere di aprirlo.
const VISIBILI_PER_ANGOLO = 6

const ORDINE = ['SCALA', 'ECCEZIONI', 'STAND BY', 'SPEGNI', 'NON SERVITA', 'IN ATTESA', 'POCHI DATI']

// Colore di ogni verdetto, in un posto solo: la barra di distribuzione, la
// pastiglia in tabella e il filtro devono dire la stessa cosa con lo stesso
// colore, o la mappa mentale va rifatta a ogni riquadro.
// I verdetti sono TRE decisioni, non sette: scala, tieni, spegni. ECCEZIONI e
// STAND BY sono entrambi "tieni" e condividono l'ambra a due intensità; le tre
// bande senza verdetto (non servita, in attesa, pochi dati) sono grigie perché
// non chiedono niente. Dare a ognuna un colore proprio faceva sette tinte in
// lotta fra loro, e il colore smetteva di significare urgenza.
const COLORE_BANDA = {
  'SCALA':       'var(--green)',
  'STAND BY':    'var(--yellow)',
  'ECCEZIONI':   'rgba(255,214,10,.5)',
  'SPEGNI':      'var(--red)',
  'IN ATTESA':   'rgba(255,255,255,.24)',
  'NON SERVITA': 'rgba(255,255,255,.13)',
  'POCHI DATI':  'rgba(255,255,255,.08)',
}

// Una metrica che DECIDE: il numero da solo non dice niente se non si sa
// contro cosa va letto. Qui la soglia sta accanto al valore e la barra mostra
// dove cade rispetto ad essa, così il giudizio si legge senza saperla a memoria.
// La variazione contro il periodo precedente.
//
// Il verso non e' sempre lo stesso: sulla spesa e sul costo per ordine
// "in salita" e' cattiva notizia, sul fatturato e sugli ordini e' buona.
// Colorare tutto in verde quando sale sarebbe una bugia gentile.
function Delta({ ora, prima, menoMeglio = false, neutro = false, formato }) {
  if (prima == null || !isFinite(prima) || prima === 0) return null
  const v = (ora - prima) / Math.abs(prima)
  if (!isFinite(v)) return null
  const bene = menoMeglio ? v < 0 : v > 0
  const nullo = Math.abs(v) < 0.005
  return (
    <div className="delta" data-verso={neutro ? 'fermo' : nullo ? 'fermo' : bene ? 'su' : 'giu'}>
      {nullo ? '=' : (v > 0 ? '▲' : '▼')} {pct(Math.abs(v) * 100, 1)}
      <i>prima {formato ? formato(prima) : Math.round(prima)}</i>
    </div>
  )
}

function Metrica({ lab, val, stato, soglia, rif, nota, scala, delta }) {
  const col = stato === 'ok' ? 'var(--green)' : stato === 'warn' ? 'var(--yellow)'
            : stato === 'ko' ? 'var(--red)' : 'var(--text)'
  const pos = scala ? Math.max(2, Math.min(98, scala.v / scala.max * 100)) : null
  const tacca = scala ? Math.max(2, Math.min(98, scala.soglia / scala.max * 100)) : null
  return (
    <div className="metrica" data-stato={stato || 'neutro'}>
      <div className="lab">{lab}</div>
      <div className="val mono" style={{ color: col }}>{val}</div>
      {delta}
      {scala && (
        <div className="scala" title={`soglia ${soglia}`}>
          <span className="scala-tacca" style={{ left: tacca + '%' }} />
          <span className="scala-riemp" style={{ width: pos + '%', background: col }} />
        </div>
      )}
      {rif && <div className="rif">{rif}</div>}
      {nota && <div className="sub">{nota}</div>}
    </div>
  )
}

// Anteprima della creatività. Per i video l'immagine non basta: si chiede a
// Meta l'anteprima ufficiale dell'inserzione, che li rende davvero.
function Anteprima({ c }) {
  const [src, setSrc] = useState(null)
  const [stato, setStato] = useState('carico')
  useEffect(() => {
    setSrc(null); setStato('carico')
    if (!c.metaAdId) { setStato('no'); return }
    let vivo = true
    fetch(`/api/motore/preview?adId=${encodeURIComponent(c.metaAdId)}`)
      .then(r => r.json())
      .then(j => { if (!vivo) return; if (j.src) { setSrc(j.src); setStato('ok') } else setStato('no') })
      .catch(() => vivo && setStato('no'))
    return () => { vivo = false }
  }, [c.metaAdId])

  // L'anteprima ufficiale di Meta rende l'inserzione com'è davvero: video in
  // riproduzione, copy, CTA e link al posto giusto. I campi strutturati sono
  // best-effort — su molte creatività object_story_spec arriva vuoto.
  if (stato === 'ok' && src) {
    return <iframe className="anteprima-video" src={src} title="Anteprima inserzione" />
  }
  return (
    <div className="anteprima-fallback">
      {c.full && <img className="anteprima" src={c.full} alt="" />}
      <div className="nota-media">
        {stato === 'carico' ? 'Carico l\'anteprima…'
          : c.mediaType === 'video' ? 'Anteprima non disponibile: resta il fotogramma.'
          : 'Anteprima non disponibile.'}
      </div>
    </div>
  )
}

const SWATCH = {
  'verde-notte':  ['#0b140e','#ffffff','#c0a062'],
  'oro-su-scuro': ['#0b140e','#ecd08a','#f3ead2'],
  'bruno-caldo':  ['#1a1008','#ffffff','#d9a441'],
  'blu-sera':     ['#0a1018','#ffffff','#c9bfa8'],
  'terra':        ['#170f0c','#f6e7cf','#b8794a'],
  'avorio-chiaro':['#efe6d6','#23301f','#1f3a26'],
  'grigio-pietra':['#141516','#ffffff','#e3d9c6'],
  'verde-oliva':  ['#101a10','#eef3e6','#8fa86a'],
}

// Le creatività prodotte, raggruppate per il BRIEF che le ha generate: così si
// vede il perché prima del cosa, e schede della stessa ragione stanno insieme.

// Quanti crediti restano per generare scene. Serve a non lanciare una tornata
// di produzione che si ferma a metà: una tornata interrotta lascia creatività
// composte a metà e brief già consumati, che è il modo peggiore di finire i
// crediti. La soglia di allarme è due tornate: sotto, conviene ricaricare
// prima di iniziare.
function Crediti() {
  const [c, setC] = useState(null)
  const [modifica, setModifica] = useState(false)
  const [val, setVal] = useState('')

  const leggi = () => fetch('/api/motore/crediti').then(r => r.json()).then(setC).catch(() => setC({ error: 'non leggibile' }))
  useEffect(() => { leggi() }, [])

  async function salva(e) {
    e.preventDefault()
    const n = Number(String(val).replace(',', '.'))
    if (!Number.isFinite(n) || n < 0) return
    await fetch('/api/motore/crediti', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ saldo: n }) })
    setModifica(false); setVal(''); leggi()
  }

  if (!c || c.error) return null

  if (modifica) return (
    <form className="crediti crediti-form" onSubmit={salva}>
      <label>Crediti dopo la ricarica</label>
      <input autoFocus type="text" inputMode="decimal" value={val} onChange={e => setVal(e.target.value)}
        placeholder={c.noto ? String(Math.round(c.saldo)) : '0'} />
      <button type="submit">Salva</button>
      <button type="button" className="annulla" onClick={() => { setModifica(false); setVal('') }}>Annulla</button>
    </form>
  )

  // Con gpt-image-2 non ci sono crediti da esaurire: si paga a consumo, circa
  // 7 centesimi a immagine. Un banner che continua a contare crediti Higgsfield
  // direbbe una cosa che non e' piu' vera.
  if (c.motore !== 'higgsfield') return (
    <span className="crediti" data-liv="ok" title="gpt-image-2, circa $0,07 a immagine: un lotto da 10 creatività (20 immagini) costa circa $1,30. Nessun credito da ricaricare.">
      immagini con <b>gpt-image-2</b> · ~$0,07 a immagine
    </span>
  )

  if (!c.noto) return (
    <button className="crediti" data-liv="ignoto" onClick={() => setModifica(true)}>
      Crediti immagini: mai registrati — impostali
    </button>
  )

  const liv = c.scene <= 10 ? 'critico' : c.scene <= 30 ? 'basso' : 'ok'
  const eta = c.oreFa < 24 ? `${Math.round(c.oreFa)}h fa` : `${Math.round(c.oreFa / 24)}g fa`
  // "stimato" non è un dettaglio: il numero è una sottrazione, non una
  // lettura. L'API di generazione non espone il saldo, quindi il motore scala
  // ciò che spende partendo dall'ultimo valore inserito a mano. Presentarlo
  // come certo sarebbe l'inganno che il banner esiste per evitare.
  return (
    <button className="crediti" data-liv={liv} onClick={() => setModifica(true)}
      title={`${c.stimato ? 'Stima' : 'Valore impostato a mano'}: ${c.costoScena} crediti a scena, ogni scena diventa 1:1 e 9:16.`
        + (c.stimato ? ` Il motore ne ha spesi ${c.spesiDalMotore} dall'ultimo aggiornamento.` : '')
        + ' Clicca per aggiornarlo dopo una ricarica.'}>
      <b className="mono">{Math.round(c.saldo)}</b> crediti{c.stimato ? '*' : ''}
      <span className="crediti-sep">·</span>
      <b className="mono">{c.scene}</b> scene ({c.creativita} creatività)
      <span className="crediti-eta">{eta}</span>
    </button>
  )
}

// Gli archi che collegano il prodotto ai suoi angoli.
//
// Si disegnano in SVG e non con pseudo-elementi CSS perché la distanza fra la
// radice e ogni gruppo dipende da quanto è largo il gruppo precedente: è una
// misura che solo il layout conosce. Si usano offsetLeft/offsetTop e non
// getBoundingClientRect perché la tela è sotto una transform di scala, e i
// rettangoli sullo schermo tornerebbero già moltiplicati per lo zoom.
//
// L'SVG si misura DA SÉ risalendo al genitore, invece di ricevere il ref
// dell'albero: il ref del genitore viene assegnato DOPO che gli effetti dei
// figli sono partiti, quindi arrivava sempre nullo e non si disegnava niente.
function Archi({ quanti }) {
  const svgRef = useRef(null)
  const [archi, setArchi] = useState([])
  const [dim, setDim] = useState({ w: 0, h: 0 })

  useLayoutEffect(() => {
    const el = svgRef.current?.parentElement
    if (!el) return
    const misura = () => {
      const radice = el.querySelector('.radice')
      const gruppi = [...el.querySelectorAll('.gruppo')]
      if (!radice || !gruppi.length) { setArchi([]); return }
      const off = (n) => {
        let x = 0, y = 0
        while (n && n !== el) { x += n.offsetLeft; y += n.offsetTop; n = n.offsetParent }
        return { x, y }
      }
      const r = off(radice)
      const partenza = { x: r.x + radice.offsetWidth, y: r.y + 48 }
      setArchi(gruppi.map((g, i) => {
        const o = off(g)
        const arrivo = { x: o.x + 10, y: o.y + 6 }
        // L'arco di ogni gruppo sale un po' più del precedente: così non si
        // sovrappongono e si legge quale porta dove, come nello schizzo.
        // L'altezza dell'arco cresce con la distanza: fissa, su spanne di
        // migliaia di pixel, dava linee piatte indistinguibili fra loro.
        const dist = Math.abs(arrivo.x - partenza.x)
        const alt = Math.max(50, Math.min(300, dist * 0.13)) + (i % 4) * 16
        const cima = Math.min(partenza.y, arrivo.y) - alt
        const cx = (partenza.x + arrivo.x) / 2
        return `M ${partenza.x} ${partenza.y} C ${partenza.x + dist * 0.3} ${cima}, ${arrivo.x - dist * 0.3} ${cima}, ${arrivo.x} ${arrivo.y}`
      }))
      setDim({ w: el.scrollWidth, h: el.scrollHeight })
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    return () => ro.disconnect()
  }, [quanti])

  return (
    <svg ref={svgRef} className="collegamenti" width={dim.w || 1} height={dim.h || 1} aria-hidden="true">
      <defs>
        <marker id="punta" markerWidth="9" markerHeight="9" refX="7" refY="4.5" orient="auto">
          <path d="M0,0 L9,4.5 L0,9 Z" fill="rgba(41,151,255,.7)" />
        </marker>
      </defs>
      {archi.map((d, i) => <path key={i} d={d} markerEnd="url(#punta)" />)}
    </svg>
  )
}

// Menu contestuale sulla selezione. Si chiude al primo clic fuori, con Escape
// e allo scorrimento: un menu che resta aperto mentre la tela si muove finisce
// per puntare a schede che non sono più lì sotto.
function MenuTendina({ x, y, voci, chiudi }) {
  const rif = useRef(null)
  const [pos, setPos] = useState({ x, y })
  useEffect(() => {
    const fuori = (e) => { if (!rif.current?.contains(e.target)) chiudi() }
    const tasto = (e) => { if (e.key === 'Escape') chiudi() }
    document.addEventListener('pointerdown', fuori)
    document.addEventListener('keydown', tasto)
    window.addEventListener('resize', chiudi)
    return () => {
      document.removeEventListener('pointerdown', fuori)
      document.removeEventListener('keydown', tasto)
      window.removeEventListener('resize', chiudi)
    }
  }, [chiudi])
  // Se il menu sborda dallo schermo si ribalta: aperto vicino al bordo destro
  // o in fondo alla pagina metà voci finirebbero fuori dalla finestra.
  useLayoutEffect(() => {
    const r = rif.current?.getBoundingClientRect(); if (!r) return
    const nx = x + r.width > window.innerWidth - 8 ? Math.max(8, x - r.width) : x
    const ny = y + r.height > window.innerHeight - 8 ? Math.max(8, y - r.height) : y
    if (nx !== pos.x || ny !== pos.y) setPos({ x: nx, y: ny })
  }, [x, y])   // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="menu-tendina" ref={rif} style={{ left: pos.x, top: pos.y }} role="menu">
      {voci.map((v, i) => v.sep
        ? <div className="mt-sep" key={'s' + i} />
        : v.titolo
          ? <div className="mt-titolo" key={'t' + i}>{v.titolo}</div>
          : <button className={'mt-voce' + (v.classe ? ' ' + v.classe : '')} key={v.label} role="menuitem"
              disabled={v.off} onClick={() => { chiudi(); v.fai() }}>
              <span>{v.label}</span>{v.tasto && <i>{v.tasto}</i>}
            </button>
      )}
    </div>
  )
}

// Caricare creatività a mano dalla board.
//
// Angolo e prodotto si scelgono QUI, prima del caricamento: sono i due campi
// senza i quali una creatività entra nella board e non serve a niente — non si
// aggrega per asse, non alimenta l'allocazione, e il classificatore proverebbe
// a indovinarli sbagliando. Se non esistono si creano nello stesso momento:
// costringere a uscire, creare il prodotto altrove e tornare è il modo di far
// caricare le cose senza etichetta.
// I cinque campi del testo di un'inserzione. Uno solo, condiviso fra
// l'importazione e la modifica: due moduli separati sarebbero divergiti al
// primo campo aggiunto, e il copy verrebbe scritto in due formati diversi.
const CTA_NOTE = ['ACQUISTA ORA', 'SCOPRI DI PIU', 'ORDINA ORA', 'ACQUISTA SUBITO', 'SCOPRI L\'OFFERTA']

function CampiTesto({ v, set, idPrefisso = 'ct' }) {
  const c = (k) => ({ value: v[k] ?? '', onChange: (e) => set(k, e.target.value) })
  return (
    <>
      <label className="campo">
        <span>Testo primario <i>il copy sopra l&apos;immagine</i></span>
        <textarea rows={4} {...c('primary_text')} placeholder="Il corpo dell'inserzione, quello che si legge per primo." />
      </label>
      <div className="campo-doppio">
        <label className="campo">
          <span>Titolo <i>headline</i></span>
          <input {...c('headline')} placeholder="es. 10 litri di olio nuovo" />
        </label>
        <label className="campo">
          <span>Descrizione <i>facoltativa</i></span>
          <input {...c('sub')} placeholder="la riga sotto il titolo" />
        </label>
      </div>
      <div className="campo-doppio">
        <label className="campo">
          <span>CTA</span>
          <input list={idPrefisso + '-cta'} {...c('cta')} placeholder="es. ACQUISTA ORA" />
          <datalist id={idPrefisso + '-cta'}>{CTA_NOTE.map(x => <option key={x} value={x} />)}</datalist>
        </label>
        <label className="campo">
          <span>Link di destinazione</span>
          <input {...c('link_url')} placeholder="https://…" />
        </label>
      </div>
    </>
  )
}

function Importa({ elenchi, fatto }) {
  const [aperto, setAperto] = useState(false)
  const [file, setFile] = useState([])
  const [prodottoId, setProdottoId] = useState('')
  const [prodottoNuovo, setProdottoNuovo] = useState('')
  const [prodottoHandle, setProdottoHandle] = useState('')
  const [angolo, setAngolo] = useState('')
  const [angoloNuovo, setAngoloNuovo] = useState('')
  const [funnel, setFunnel] = useState('')
  const [testi, setTesti] = useState({ primary_text: '', headline: '', sub: '', cta: '', link_url: '' })
  const [testiAperti, setTestiAperti] = useState(false)
  const [stato, setStato] = useState(null)
  const setTesto = (k, val) => setTesti(t => ({ ...t, [k]: val }))

  const nuovoProdotto = prodottoId === '__nuovo__'
  const nuovoAngolo = angolo === '__nuovo__'
  const pronto = file.length > 0
    && (nuovoProdotto ? prodottoNuovo.trim() : prodottoId)
    && (nuovoAngolo ? angoloNuovo.trim() : angolo)

  // Misura il file NEL BROWSER: il server non vede più i byte, e chiedere il
  // formato a chi carica darebbe metà creatività col rapporto sbagliato quando
  // nella selezione ci sono quadrate e verticali insieme.
  const misura = (f) => new Promise((ris) => {
    const u = URL.createObjectURL(f)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(u); ris({ larghezza: img.naturalWidth, altezza: img.naturalHeight }) }
    img.onerror = () => { URL.revokeObjectURL(u); ris({ larghezza: 1, altezza: 1 }) }
    img.src = u
  })

  // Una risposta di errore non è sempre JSON: un 413 di Vercel arriva come
  // testo ("Request Entity Too Large") e leggerlo come JSON produceva
  // «Unexpected token 'R'», che nasconde il problema vero invece di dirlo.
  async function leggi(r) {
    const t = await r.text()
    try { return JSON.parse(t) }
    catch {
      if (r.status === 413) return { error: 'I file sono troppo grandi per una richiesta sola.' }
      return { error: `Risposta non valida dal server (HTTP ${r.status}): ${t.slice(0, 120)}` }
    }
  }

  async function carica(e) {
    e.preventDefault()
    if (!pronto) return
    setStato({ lavoro: `Preparo ${file.length} file…` })
    try {
      const dim = await Promise.all(file.map(misura))
      const corpo = {
        file: file.map((f, i) => ({ nome: f.name, ...dim[i] })),
        ...(nuovoProdotto
          ? { prodottoNuovo: prodottoNuovo.trim(), prodottoHandle: prodottoHandle.trim() || undefined }
          : { prodottoId }),
        [nuovoAngolo ? 'angoloNuovo' : 'angolo']: nuovoAngolo ? angoloNuovo.trim() : angolo,
      }
      const rf = await fetch('/api/motore/importa/firma', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo) })
      const jf = await leggi(rf)
      if (!rf.ok) throw new Error(jf.error || `HTTP ${rf.status}`)

      // I file vanno DIRITTI allo storage, uno per volta: quattro caricamenti
      // in parallelo su connessioni lente si ostacolano e falliscono insieme.
      const caricati = []
      const falliti = []
      for (let i = 0; i < jf.permessi.length; i++) {
        const p = jf.permessi[i]
        setStato({ lavoro: `Carico ${i + 1} di ${jf.permessi.length}…` })
        const ru = await fetch(p.url, { method: 'PUT', body: file[i],
          headers: { 'content-type': file[i].type || 'image/png' } })
        if (ru.ok) caricati.push({ nome: p.nome, ratio: p.ratio, percorso: p.percorso })
        else falliti.push(`${file[i].name}: storage HTTP ${ru.status}`)
      }
      if (!caricati.length) throw new Error(falliti[0] || 'nessun file caricato')

      setStato({ lavoro: 'Registro…' })
      const rr = await fetch('/api/motore/importa/registra', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ caricati, prodotto: jf.prodotto, angleId: jf.angleId, angolo: jf.angolo,
          funnel: funnel || undefined, testi }) })
      const j = await leggi(rr)
      if (!rr.ok && !j.caricate) throw new Error(j.error || `HTTP ${rr.status}`)

      setStato({ esito: `${j.caricate} caricate su ${j.prodotto}, angolo ${j.angolo}.`
        + (falliti.length ? ` ${falliti.length} non riuscite.` : '') })
      setFile([])
      await fatto?.(j.caricate)
    } catch (err) { setStato({ errore: String(err.message || err) }) }
  }

  if (!aperto) return (
    <button className="chip forte" onClick={() => setAperto(true)}>+ Importa creatività</button>
  )

  return (
    <form className="importa" onSubmit={carica}>
      <div className="importa-testa">
        <b>Importa creatività</b>
        <button type="button" className="chip" onClick={() => { setAperto(false); setStato(null) }}>Chiudi</button>
      </div>

      <label className="campo">
        <span>File</span>
        <input type="file" multiple accept="image/png,image/jpeg,image/webp"
          onChange={(e) => { setFile([...e.target.files]); setStato(null) }} />
        {file.length > 0 && <i>{file.length} selezionati — il formato 1:1 o 9:16 si legge dal file</i>}
      </label>

      <label className="campo">
        <span>Prodotto</span>
        <select value={prodottoId} onChange={(e) => setProdottoId(e.target.value)}>
          <option value="">Scegli…</option>
          {(elenchi?.prodotti || []).map(p => <option key={p.id} value={p.id}>{p.nome}</option>)}
          <option value="__nuovo__">+ Nuovo prodotto…</option>
        </select>
      </label>
      {nuovoProdotto && (
        <div className="campo-doppio">
          <label className="campo">
            <span>Nome del prodotto</span>
            <input value={prodottoNuovo} onChange={(e) => setProdottoNuovo(e.target.value)}
              placeholder="es. 2 Bag in box da 5 litri ANGELINO" />
          </label>
          <label className="campo">
            <span>Handle Shopify <i>facoltativo</i></span>
            <input value={prodottoHandle} onChange={(e) => setProdottoHandle(e.target.value)}
              placeholder="serve per il link nelle creatività" />
          </label>
        </div>
      )}

      <label className="campo">
        <span>Angolo</span>
        <select value={angolo} onChange={(e) => setAngolo(e.target.value)}>
          <option value="">Scegli…</option>
          {(elenchi?.angoli || []).map(a => <option key={a} value={a}>{a}</option>)}
          <option value="__nuovo__">+ Nuovo angolo…</option>
        </select>
      </label>
      {nuovoAngolo && (
        <label className="campo">
          <span>Nome dell'angolo</span>
          <input value={angoloNuovo} onChange={(e) => setAngoloNuovo(e.target.value)}
            placeholder="es. ORIGINE, PREZZO, GARANZIA" />
        </label>
      )}

      <label className="campo">
        <span>Fase del funnel <i>facoltativa</i></span>
        <select value={funnel} onChange={(e) => setFunnel(e.target.value)}>
          <option value="">Non indicata</option>
          <option value="TOFU">TOFU</option><option value="MOFU">MOFU</option><option value="BOFU">BOFU</option>
        </select>
      </label>

      {/* I testi valgono per TUTTI i file di questa importazione: si importa un
          lotto che condivide il copy, e chiederlo file per file vorrebbe dire
          ricopiare lo stesso testo cinque volte. Chi ha copy diversi importa in
          due volte, o li corregge dopo dal menu. */}
      <button type="button" className="chip" style={{ alignSelf: 'flex-start' }}
        onClick={() => setTestiAperti(a => !a)}>
        {testiAperti ? '− Testi dell\'inserzione' : '+ Testi dell\'inserzione'}
        {!testiAperti && (testi.primary_text || testi.headline || testi.cta || testi.link_url)
          ? ' · compilati' : ''}
      </button>
      {testiAperti && (
        <div className="importa-testi">
          <i className="nota-testi">
            {file.length > 1 ? `Valgono per tutti i ${file.length} file di questa importazione.` : 'Facoltativi: si possono aggiungere anche dopo.'}
            {' '}Se lasci vuoto il link, si usa quello del prodotto.
          </i>
          <CampiTesto v={testi} set={setTesto} idPrefisso="imp" />
        </div>
      )}

      <div className="importa-piede">
        <button type="submit" className="chip forte" disabled={!pronto || !!stato?.lavoro}>
          {stato?.lavoro || `Carica${file.length ? ` ${file.length}` : ''}`}
        </button>
        {stato?.esito && <span className="count">{stato.esito}</span>}
        {stato?.errore && <span className="count allarme">{stato.errore}</span>}
      </div>
    </form>
  )
}

// ============================================================================
//  Analitiche del periodo.
//
//  I grafici qui rispondono a una domanda ciascuno e nessuno usa due assi. Le
//  quote (funnel, prodotti) sono composizioni di un intero: una barra sola,
//  con le etichette scritte sopra ogni fetta — il colore non basta mai da solo
//  a dire quale fetta è quale.
// ============================================================================

// Tavolozza dei grafici, verificata sul fondo scuro dell'app (lightness band,
// chroma, separazione per daltonismo, contrasto). NON sono i colori delle
// pastiglie della board: quelli sono più accesi perché su testo piccolo
// funzionano, su campiture larghe no.
const C = { scala: '#2f9e63', tieni: '#b8891c', spegni: '#d4483c', neutro: '#3d82d8' }
// Le fasi del funnel restano una scala di luminosità, come sulla board: sono
// una sequenza, non quattro identità in gara.
const LUCE = { TOFU: 'rgba(255,255,255,.30)', MOFU: 'rgba(255,255,255,.58)', BOFU: 'rgba(255,255,255,.92)' }

// `pct` esiste già e prende un numero GIÀ in percentuale. Qui le quote sono
// frazioni fra 0 e 1, quindi serve un nome suo: chiamarli uguale sarebbe la
// premessa perfetta per moltiplicare per cento due volte.
const quotaPc = (n, d = 0) => num((n || 0) * 100, d) + '%'

// Il cervello: consigli operativi su QUESTI numeri.
//
// Il contesto viene ricalcolato a ogni domanda dalle analitiche vere invece di
// restare in sessione: una conversazione lunga su dati vecchi produce consigli
// sicuri di sé e scaduti, che è il modo più silenzioso di sbagliare.
const DOMANDE = [
  'Cosa killo e cosa scalo, con che budget?',
  'Come struttureresti le campagne da domani?',
  'Quanto budget metto in test e quante creatività reggo?',
  'Dove sto sprecando soldi?',
  'Quali angoli devo produrre e perché?',
]

function Cervello({ q }) {
  const [storia, setStoria] = useState([])
  const [testo, setTesto] = useState('')
  const [attesa, setAttesa] = useState(false)
  const [errore, setErrore] = useState(null)
  const fondo = useRef(null)

  useEffect(() => { fondo.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }) }, [storia, attesa])

  async function chiedi(domanda) {
    const d = (domanda ?? testo).trim()
    if (!d || attesa) return
    setTesto(''); setErrore(null)
    const prima = [...storia, { ruolo: 'io', testo: d }]
    setStoria(prima); setAttesa(true)
    try {
      const r = await fetch('/api/motore/cervello', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ domanda: d, storia, q }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setStoria([...prima, { ruolo: 'lui', testo: j.testo }])
    } catch (e) {
      setErrore(String(e.message || e))
      setStoria(prima)
    } finally { setAttesa(false) }
  }

  return (
    <section className="blocco cervello">
      <div className="et">Chiedi al motore — risponde sui numeri qui sopra</div>

      {storia.length === 0 && !attesa && (
        <div className="cv-vuoto">
          <p>Legge la spesa, gli angoli, il funnel, i verdetti, le recensioni e le regole
             di test che hai dato tu — e risponde su quelli. Se un dato non c'è te lo dice
             invece di inventarlo.</p>
          <div className="cv-spunti">
            {DOMANDE.map(q => <button key={q} className="chip" onClick={() => chiedi(q)}>{q}</button>)}
          </div>
        </div>
      )}

      {storia.length > 0 && (
        <div className="cv-storia">
          {storia.map((m, i) => (
            <div key={i} className={'cv-msg cv-' + m.ruolo}>
              {m.ruolo === 'lui' && <span className="cv-chi">motore</span>}
              <div className="cv-testo">{formatta(m.testo)}</div>
            </div>
          ))}
          {attesa && <div className="cv-msg cv-lui"><span className="cv-chi">motore</span>
            <div className="cv-testo cv-attesa">sto guardando i numeri…</div></div>}
          <div ref={fondo} />
        </div>
      )}

      {errore && <p className="count allarme" style={{ margin: '10px 0 0' }}>{errore}</p>}

      <form className="cv-riga" onSubmit={(e) => { e.preventDefault(); chiedi() }}>
        <input value={testo} onChange={(e) => setTesto(e.target.value)} disabled={attesa}
          placeholder="Chiedi cosa fare, cosa spegnere, che budget, come strutturare le campagne…" />
        <button type="submit" className="chip forte" disabled={attesa || !testo.trim()}>
          {attesa ? '…' : 'Chiedi'}
        </button>
        {storia.length > 0 && (
          <button type="button" className="chip" onClick={() => { setStoria([]); setErrore(null) }}>Ricomincia</button>
        )}
      </form>
    </section>
  )
}

// Formattazione minima: grassetto, elenchi e paragrafi. Non serve un motore
// markdown completo per quattro segni, e uno intero porterebbe dentro il
// rischio di iniettare HTML da una risposta del modello.
function formatta(t) {
  const grassetto = (riga, k) => {
    const pezzi = String(riga).split(/\*\*(.+?)\*\*/g)
    return pezzi.map((p, i) => i % 2 ? <b key={i}>{p}</b> : <span key={i}>{p}</span>)
  }
  const righe = String(t || '').split('\n')
  const out = []
  let elenco = []
  const chiudi = () => { if (elenco.length) { out.push(<ul key={'u' + out.length}>{elenco}</ul>); elenco = [] } }
  righe.forEach((r, i) => {
    const v = r.trim()
    if (!v) { chiudi(); return }
    const m = v.match(/^(?:[-*•]|\d+\.)\s+(.*)$/)
    if (m) { elenco.push(<li key={i}>{grassetto(m[1])}</li>); return }
    chiudi()
    out.push(<p key={'p' + i}>{grassetto(v)}</p>)
  })
  chiudi()
  return out
}

// Serie temporale: area per la spesa, linea per il ROAS.
//
// DUE grafici affiancati che condividono l'asse dei giorni, non uno con due
// assi: spesa e ROAS hanno scale incompatibili e sovrapporle fa leggere
// incroci che non significano niente. È l'errore più comune nei cruscotti.
//
// Il puntatore si muove su entrambi insieme: si legge una data sola su due
// misure, che è la domanda vera ("quel giorno cos'è successo?").
function Serie({ serie }) {
  const [i, setI] = useState(null)
  const box = useRef(null)
  if (!serie?.length) return null
  const W = 1000, H = 130, P = 8
  const n = serie.length
  const x = (k) => P + (k / Math.max(1, n - 1)) * (W - P * 2)

  const grafico = (chiave, colore, riempi) => {
    const vals = serie.map(g => +g[chiave] || 0)
    const max = Math.max(...vals) || 1
    const y = (v) => H - P - (v / max) * (H - P * 2)
    const punti = vals.map((v, k) => `${x(k)},${y(v)}`).join(' ')
    return { max, y, linea: `M${punti.replaceAll(' ', 'L')}`,
      area: `M${x(0)},${H} L${punti.replaceAll(' ', 'L')} L${x(n - 1)},${H} Z`, colore, riempi }
  }
  const gSpesa = grafico('spesa', '#3d82d8', true)
  const gRoas  = grafico('roas',  '#2f9e63', false)
  const attivo = i == null ? null : serie[i]

  const muovi = (e) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return
    const rel = (e.clientX - r.left) / r.width * W
    const k = Math.round((rel - P) / (W - P * 2) * (n - 1))
    setI(Math.max(0, Math.min(n - 1, k)))
  }

  // L'id del gradiente non può contenere spazi: url(#g-Spesa al giorno) non
  // risolve e l'area resta invisibile — la linea si vede, il riempimento no.
  const uno = (g, chiave, titolo, formato) => (
    <div className="serie-uno">
      <div className="serie-testa">
        <span className="et">{titolo}</span>
        <span className="serie-ora mono">
          {attivo ? formato(attivo) : formato(serie[n - 1])}
          <i>{attivo ? attivo.giorno : serie[n - 1].giorno}</i>
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="serie-svg">
        <defs>
          <linearGradient id={`grad-${chiave}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={g.colore} stopOpacity="0.42" />
            <stop offset="100%" stopColor={g.colore} stopOpacity="0" />
          </linearGradient>
        </defs>
        {g.riempi && <path d={g.area} fill={`url(#grad-${chiave})`} className="serie-area" />}
        <path d={g.linea} fill="none" stroke={g.colore} strokeWidth="2"
          strokeLinecap="round" strokeLinejoin="round" className="serie-linea" />
        {i != null && <>
          <line x1={x(i)} y1={P} x2={x(i)} y2={H - P} stroke="rgba(255,255,255,.28)" strokeWidth="1" />
          <circle cx={x(i)} cy={g.y(+serie[i][chiave] || 0)}
            r="4.5" fill={g.colore} stroke="#0a0a14" strokeWidth="2" />
        </>}
      </svg>
    </div>
  )

  return (
    <section className="blocco serie" ref={box}
      onMouseMove={muovi} onMouseLeave={() => setI(null)}>
      {uno(gSpesa, 'spesa', 'Spesa al giorno', (g) => eur(g.spesa))}
      {uno(gRoas, 'roas', 'ROAS al giorno', (g) => num(g.roas))}
    </section>
  )
}

// Una barra di composizione: un intero diviso in fette, ognuna etichettata.
function Composizione({ voci, colore, titolo }) {
  const tot = voci.reduce((s, v) => s + v.spesa, 0) || 1
  return (
    <section className="blocco">
      <div className="et">{titolo}</div>
      <div className="comp-barra">
        {voci.map(v => (
          <div key={v.chiave} className="comp-fetta"
            style={{ width: (v.spesa / tot * 100) + '%', background: colore(v.chiave) }}
            title={`${v.chiave} — ${eur(v.spesa)} · ${quotaPc(v.spesa / tot)} · ${Math.round(v.acquisti)} ordini · ROAS ${num(v.roas)}`} />
        ))}
      </div>
      <div className="comp-legenda">
        {voci.map(v => (
          <span key={v.chiave} className="comp-voce">
            <i style={{ background: colore(v.chiave) }} />
            <b>{v.chiave}</b>
            <span className="mono">{quotaPc(v.spesa / tot)}</span>
            <em>{eur(v.spesa)}</em>
          </span>
        ))}
      </div>
    </section>
  )
}

// Classifica a barre: magnitudine, quindi lunghezza. Una sola tinta — sono la
// stessa cosa misurata su soggetti diversi, non categorie in competizione.
function Classifica({ voci, titolo, valore, etichetta, max }) {
  const M = max ?? Math.max(1, ...voci.map(valore))
  return (
    <section className="blocco">
      <div className="et">{titolo}</div>
      <div className="classifica">
        {voci.map(v => (
          <div key={v.chiave} className="cl-riga" title={etichetta(v)}>
            <span className="cl-nome">{v.chiave}</span>
            <span className="cl-barra"><i style={{ width: (valore(v) / M * 100) + '%' }} /></span>
            <span className="cl-val mono">{etichetta(v)}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

const METRICHE = [
  ['roas',      'ROAS',     (r) => num(r.roas)],
  ['purchases', 'Ordini',   (r) => Math.round(r.purchases)],
  ['cpa',       'CPA',      (r) => r.cpa ? eur(r.cpa, 2) : '—'],
  ['spend',     'Spesa',    (r) => eur(r.spend)],
  ['ctr',       'CTR',      (r) => num(r.ctr) + '%'],
  ['cpc',       'CPC',      (r) => r.cpc ? eur(r.cpc, 2) : '—'],
  ['value',     'Fatturato',(r) => eur(r.value)],
]

function Analitiche({ q }) {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [metrica, setMetrica] = useState('roas')

  useEffect(() => {
    setD(null); setErr(null)
    fetch(`/api/motore/analitiche?${q}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => j.error ? setErr(j.error) : setD(j)).catch(e => setErr(String(e)))
  }, [q])

  if (err) return <div className="empty" style={{ marginTop: 30 }}><b>Non riesco a leggere le analitiche</b><p>{err}</p></div>
  if (!d) return <div className="empty" style={{ marginTop: 30 }}><p>Calcolo…</p></div>

  const a = d.account, c = d.ciclo
  const quota = (x, su) => su ? x / su : 0
  const M = METRICHE.find(m => m[0] === metrica)
  const migliori = d.migliori[metrica === 'purchases' ? 'acquisti' : metrica === 'spend' ? 'spesa'
    : metrica === 'value' ? 'valore' : metrica] || []

  return (
    <>
      {/* I quattro chip del periodo stavano qui. Ora il periodo e' uno solo e
          sta nell'intestazione: due selettori nella stessa app portano a
          confrontare intervalli diversi credendo di confrontare le stesse cose. */}
      <div className="bar" style={{ marginTop: 0 }}>
        <span className="et">{d.periodo.since} → {d.periodo.until}</span>
        <span className="count">{d.periodo.giorni} giorni</span>
      </div>

      <div className="strip">
        <div className="kpi"><div className="lab">Spesa</div><div className="val mono">{eur(a.spesa)}</div></div>
        <div className="kpi"><div className="lab">Fatturato generato</div><div className="val mono">{eur(a.valore)}</div></div>
        <div className="kpi"><div className="lab">ROAS</div><div className="val mono">{num(a.roas)}</div></div>
        <div className="kpi"><div className="lab">Ordini</div><div className="val mono">{Math.round(a.acquisti)}</div></div>
        <div className="kpi"><div className="lab">CPA</div><div className="val mono">{eur(a.cpo, 2)}</div></div>
        <div className="kpi"><div className="lab">CTR</div><div className="val mono">{num(a.ctr)}%</div></div>
        <div className="kpi"><div className="lab">CPC</div><div className="val mono">{a.cpc ? eur(a.cpc, 2) : '—'}</div></div>
      </div>

      {/* --- cosa fare: prima le cose da fare, poi i numeri che le spiegano --- */}
      {d.insight.length > 0 && (
        <section className="blocco">
          <div className="et">Da fare e da sistemare</div>
          <div className="insight">
            {d.insight.map((i, k) => (
              <article key={k} className="carta" data-tipo={i.tipo}>
                <span className="carta-tipo">{i.tipo}</span>
                <h4>{i.titolo}</h4>
                <p>{i.testo}</p>
              </article>
            ))}
          </div>
        </section>
      )}

      {/* --- ciclo di vita ------------------------------------------------- */}
      <section className="blocco">
        <div className="et">Creatività: cosa ne è stato</div>
        <div className="conteggi">
          {[
            ['Prodotte', c.prodotte, null, `${c.prodotteNelPeriodo} nel periodo`],
            ['Con file pronto', c.conFile, quota(c.conFile, c.prodotte), 'sulle prodotte'],
            ['Lanciate', c.lanciate, quota(c.lanciate, c.prodotte), 'sulle prodotte'],
            ['Da lanciare', c.daLanciare, quota(c.daLanciare, c.prodotte), 'sulle prodotte'],
            ['Da scalare', c.daScalare, quota(c.daScalare, c.totali), 'su tutte le attive'],
            ['Da spegnere', c.daSpegnere, quota(c.daSpegnere, c.totali), 'su tutte le attive'],
            ['Giudicate a mano', c.totali - c.senzaVerdetto, quota(c.totali - c.senzaVerdetto, c.totali), 'su tutte'],
          ].map(([lab, n, q, nota]) => (
            <div className="conta" key={lab}>
              <div className="lab">{lab}</div>
              <div className="val mono">{n}{q != null && <span className="q"> · {quotaPc(q)}</span>}</div>
              <div className="sub">{nota}</div>
            </div>
          ))}
        </div>
      </section>

      <Cervello q={q} />

      <Serie serie={d.serie} />

      <div className="due">
        <Composizione titolo="Spesa per fase del funnel" voci={d.funnel}
          colore={(k) => LUCE[k] || 'rgba(255,255,255,.16)'} />
        <Composizione titolo="Spesa per prodotto" voci={d.prodotti.slice(0, 6)}
          colore={() => C.neutro} />
      </div>

      <Classifica titolo="Angoli per spesa" voci={d.angoli} valore={(v) => v.spesa}
        etichetta={(v) => `${eur(v.spesa)} · ${quotaPc(v.quota)}`} />

      {/* --- angoli, tutto insieme ------------------------------------------ */}
      <section className="blocco">
        <div className="et">Angoli — tutte le metriche</div>
        <div className="tw">
          <table>
            <thead><tr>
              <th>Angolo</th><th className="num">Spesa</th><th className="num">Quota</th>
              <th>Pubblico</th><th className="num">ROAS</th><th className="num">ROAS nuovo</th>
              <th className="num">Ordini</th><th className="num">CPA</th>
              <th className="num">CTR</th><th className="num">CPC</th><th className="num">Fatturato</th>
              <th className="num">Creatività</th>
            </tr></thead>
            <tbody>
              {d.angoli.map(x => (
                <tr key={x.chiave}>
                  <td className="nm">{x.chiave}</td>
                  <td className="num mono">{eur(x.spesa)}</td>
                  <td className="num mono">{quotaPc(x.quota)}</td>
                  {/* La quota di pubblico nuovo cambia il senso del ROAS
                      accanto: un angolo che gira sul returning ha sempre
                      numeri belli, perche' quella gente sarebbe tornata
                      comunque. */}
                  <td style={{ minWidth: 76 }}>
                    <BarraPubblici p={x.pubblici} />
                    {x.pubblici?.new && <span className="pub-quota">{quotaPc(x.pubblici.new.quota)} nuovo</span>}
                  </td>
                  <td className="num mono" style={{ color: x.roas >= a.roas ? C.scala : C.spegni }}>{num(x.roas)}</td>
                  {/* Il metro e' il ROAS dell'account SUL NUOVO, non quello
                      complessivo: quest'ultimo e' gonfiato dal returning e
                      farebbe sembrare sotto media anche gli angoli che
                      acquisiscono meglio di tutti. */}
                  <td className="num mono" title={d.pubblici?.new?.roas ? `media dell'account sul nuovo: ${num(d.pubblici.new.roas)}` : undefined}
                    style={{ color: x.pubblici?.new && d.pubblici?.new?.roas
                      ? (x.pubblici.new.roas >= d.pubblici.new.roas ? C.scala : C.spegni) : undefined }}>
                    {x.pubblici?.new?.ordini ? num(x.pubblici.new.roas) : '—'}
                  </td>
                  <td className="num mono">{Math.round(x.acquisti)}</td>
                  <td className="num mono">{x.cpa ? eur(x.cpa, 2) : '—'}</td>
                  <td className="num mono">{num(x.ctr)}%</td>
                  <td className="num mono">{x.cpc ? eur(x.cpc, 2) : '—'}</td>
                  <td className="num mono">{eur(x.valore)}</td>
                  <td className="num mono">{x.n}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* --- il calendario dei test ----------------------------------------- */}
      {d.cadenza && (
        <section className="blocco">
          <div className="et">Calendario dei test</div>
          <p className="perche" style={{ margin: '0 0 16px' }}>
            Quante creatività nuove per volta e ogni quanto. Non è una scelta: si calcola dal budget
            degli ultimi 7 giorni e dal costo per ordine. Lanciare più spesso vuol dire avere due lotti
            indecisi sullo stesso pubblico, e nessuno dei due leggibile.
          </p>
          <div className="cal">
            <div className="calbox">
              <span>Lotto</span>
              <b>{d.cadenza.lotto}</b>
              <i>creatività nuove per volta · {d.cadenza.immaginiPerLotto} immagini</i>
            </div>
            <div className="calbox">
              <span>Ogni</span>
              <b>{d.cadenza.cadenzaGiorni} giorni</b>
              <i>un lotto quando il precedente è giudicabile</i>
            </div>
            <div className="calbox">
              <span>Budget per creatività</span>
              <b>{eur(d.cadenza.perCreativita)}</b>
              <i>al giorno · regime {d.cadenza.regime.nome}</i>
            </div>
            <div className="calbox">
              <span>In test</span>
              <b>{eur(d.cadenza.budgetTest)}</b>
              <i>al giorno, il {Math.round(d.cadenza.quotaTest * 100)}% della spesa</i>
            </div>
          </div>
          <div className="calriga">
            {/* A budget alto i due momenti coincidono, perché comanda il minimo
                dei 7 giorni: mostrarli due volte sembrerebbe una svista. */}
            {d.cadenza.giorniPerSpegnere === d.cadenza.giorniPerLeggere ? (
              <span><b>Giorno {d.cadenza.giorniPerSpegnere}</b> — si spengono i perdenti, il loro budget si libera
                e il costo per ordine della cella diventa leggibile</span>
            ) : (
              <>
                <span><b>Giorno {d.cadenza.giorniPerSpegnere}</b> — si spengono i perdenti e il loro budget si libera</span>
                <span><b>Giorno {d.cadenza.giorniPerLeggere}</b> — il costo per ordine della cella significa qualcosa</span>
              </>
            )}
            {!d.cadenza.sostenibile && <span className="calallarme">Il budget di test non regge il minimo di tre creatività in parallelo.</span>}
          </div>
        </section>
      )}

      {/* --- effetto degli spegnimenti -------------------------------------- */}
      {d.spegnimenti && (d.spegnimenti.letture.length > 0 || d.spegnimenti.scartate.length > 0) && (
        <section className="blocco">
          <div className="et">Effetto degli spegnimenti</div>
          <p className="perche" style={{ margin: '0 0 16px' }}>
            Una creatività con il costo per ordine alto può essere quella che fa convertire le altre.
            Con dati a ultimo clic non si vede: l&apos;unico modo di saperlo è spegnerla e guardare il
            <b> conto</b>, non lei. Qui sotto, cosa è successo dopo ogni spegnimento — e quando non si
            può dire niente, il perché.
          </p>
          {d.spegnimenti.letture.length > 0 ? (
            <div className="tw">
              <table>
                <thead><tr><th>Spenta il</th><th>Creatività</th><th className="num">CPA del conto</th>
                  <th className="num">ROAS del conto</th><th>Lettura</th></tr></thead>
                <tbody>
                  {d.spegnimenti.letture.map(l => (
                    <tr key={l.data + l.nome}>
                      <td className="nm">{l.data}</td>
                      <td className="nm">{l.nome}</td>
                      <td className="num mono">{eur(l.prima.cpa, 2)} → {eur(l.dopo.cpa, 2)}
                        <i style={{ display: 'block', fontStyle: 'normal', fontSize: 11,
                          color: l.variazioneCpa > 0 ? C.spegni : C.scala }}>
                          {l.variazioneCpa > 0 ? '+' : ''}{pct(l.variazioneCpa * 100, 1)}</i></td>
                      <td className="num mono">{num(l.prima.roas)} → {num(l.dopo.roas)}</td>
                      <td>{l.variazioneCpa > 0.05
                        ? 'il conto è peggiorato: probabilmente reggeva le altre'
                        : l.variazioneCpa < -0.05 ? 'il conto è migliorato: spegnerla è stato giusto'
                        : 'il conto non si è mosso: spegnerla non è costato niente'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty" style={{ marginTop: 0 }}>
              <b>Nessuno spegnimento ancora leggibile</b>
              <p>Serve che sia spenta una creatività per volta, che avesse speso davvero, e che il conto
              non abbia cambiato ritmo nel frattempo.</p>
            </div>
          )}

          {d.spegnimenti.scartate.length > 0 && (
            <>
              <div className="et" style={{ marginTop: 22 }}>Non leggibili, e perché</div>
              <ul className="scartate">
                {d.spegnimenti.scartate.map((s, i) => (
                  <li key={i}><b>{s.data}</b> {s.nome ? s.nome.slice(0, 46) : `${s.quante} insieme`} — {s.motivo}</li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {/* --- le migliori dieci ---------------------------------------------- */}
      <section className="blocco">
        <div className="et">Le 10 creatività migliori</div>
        <div className="bar" style={{ margin: '0 0 10px' }}>
          {METRICHE.map(([k, l]) => (
            <button key={k} className="chip" data-on={metrica === k ? 1 : 0} onClick={() => setMetrica(k)}>{l}</button>
          ))}
          <span className="count">
            {metrica === 'cpa' || metrica === 'cpc' ? 'dal più basso' : 'dal più alto'}
            {' · '}solo con almeno {eur(d.soglia.spesaMinima)} di spesa e {d.soglia.acquistiMinimi} ordini
            {' ('}{d.soglia.candidate} su {d.soglia.su}{')'}
          </span>
        </div>
        <div className="tw">
          <table>
            <thead><tr>
              <th>Creatività</th><th>Angolo</th><th>Verdetto</th>
              <th className="num">{M[1]}</th><th className="num">Spesa</th><th className="num">Ordini</th>
              {metrica !== 'roas' && <th className="num">ROAS</th>}
              {metrica !== 'cpa' && <th className="num">CPA</th>}
              {metrica !== 'ctr' && <th className="num">CTR</th>}
              <th className="num">Fatturato</th>
            </tr></thead>
            <tbody>
              {migliori.map(r => (
                <tr key={r.id}>
                  <td className="nm"><div className="cellname">
                    {r.thumb ? <img className="thumb" src={r.thumb} alt="" loading="lazy" />
                      : <div className="thumb" />}
                    <span>{r.name}</span>
                  </div></td>
                  <td><span className="seg">{r.angolo || '—'}</span></td>
                  <td><span className={'band ' + r.bandaCls}>{r.bandaLabel}</span></td>
                  <td className="num mono" style={{ color: 'var(--text)' }}><b>{M[2](r)}</b></td>
                  <td className="num mono">{eur(r.spend)}</td>
                  <td className="num mono">{Math.round(r.purchases)}</td>
                  {metrica !== 'roas' && <td className="num mono">{num(r.roas)}</td>}
                  {metrica !== 'cpa' && <td className="num mono">{r.cpa ? eur(r.cpa, 2) : '—'}</td>}
                  {metrica !== 'ctr' && <td className="num mono">{num(r.ctr)}%</td>}
                  <td className="num mono">{eur(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </>
  )
}

function Produzione({ prodotte, elenchi, ricarica }) {
  const [periodo, setPeriodo] = useState('tutto')
  // Si apre su "da lanciare": è la coda di lavoro vera. Aprire su "tutte"
  // mostrava duecento creatività di cui centonovantatré già viste, e la cosa da
  // fare — caricarle — restava sepolta in mezzo.
  const [stato, setStato] = useState('da-lanciare')
  const [verdetto, setVerdetto] = useState('tutti')
  const [fase, setFase] = useState('tutte')
  const [scelto, setScelto] = useState(null)
  // L'angolo scelto restringe la tela a un ramo solo. Undici rami aperti
  // insieme sono leggibili come mappa e inutilizzabili come area di lavoro:
  // per confrontare due formati dello stesso angolo servono due schede
  // affiancate, non undici gruppi da scorrere.
  const [angoloScelto, setAngoloScelto] = useState(null)
  const [sel, setSel] = useState(() => new Set())
  const [flag, setFlag] = useState({})        // scritture locali, applicate subito
  const [lavoro, setLavoro] = useState(null)  // messaggio di attesa
  const [avviso, setAvviso] = useState(null)
  const [menu, setMenu] = useState(null)      // {x,y,ids}
  const [testi, setTesti] = useState(null)    // {ids, iniziali, valori}
  const alberoRef = useRef(null)
  // Angoli aperti per intero. Di base ogni ramo ne mostra una manciata: con
  // trenta creatività su un solo angolo l'albero diventava alto tredicimila
  // pixel e la struttura — che è la ragione per cui esiste questa vista — non
  // si vedeva più.
  const [aperti, setAperti] = useState(() => new Set())
  // Cosa si sta trascinando, e dove si sta per lasciarlo cadere.
  const [trascinati, setTrascinati] = useState(null)
  const [bersaglio, setBersaglio] = useState(null)

  // I flag salvati si sovrappongono ai dati del server: l'interfaccia risponde
  // al clic senza aspettare il giro completo, e se la scrittura fallisce lo
  // dice invece di lasciare un flag che sembra salvato e non lo è.
  const conFlag = useMemo(
    () => prodotte.map(p => (flag[p.id] ? { ...p, ...flag[p.id] } : p)),
    [prodotte, flag])

  const filtrate = useMemo(() => {
    const ora = Date.now()
    const giorni = { oggi: 1, '7g': 7, '30g': 30 }[periodo]
    return conFlag.filter(p => {
      if (stato === 'lanciate' && !p.lanciata) return false
      if (stato === 'da-lanciare' && p.lanciata) return false
      if (fase !== 'tutte' && p.funnel !== fase) return false
      if (verdetto === 'senza' && p.giudizio) return false
      if (verdetto !== 'tutti' && verdetto !== 'senza' && p.giudizio !== verdetto) return false
      if (!giorni) return true
      // Il filtro guarda la data di LANCIO se c'è, altrimenti quella di
      // creazione: "cosa ho lanciato" e "cosa ho prodotto" sono due domande
      // diverse, e la seconda è il ripiego.
      const d = p.lanciataIl || p.creataIl
      return d ? (ora - new Date(d).getTime()) <= giorni * 86400000 : false
    })
  }, [conFlag, periodo, stato, verdetto, fase])

  // Una board PER PRODOTTO: mescolarli sulla stessa tela rendeva impossibile
  // capire per cosa si stesse producendo.
  const perProdotto = useMemo(() => {
    const m = {}
    for (const p of filtrate) {
      const k = p.prodotto || 'Prodotto da assegnare'
      const v = m[k] || (m[k] = { nome: k, id: p.prodottoId || null, img: p.prodottoImg, items: [], angoli: new Set() })
      v.items.push(p); if (p.angolo) v.angoli.add(p.angolo)
      if (!v.img && p.prodottoImg) v.img = p.prodottoImg
      if (!v.id && p.prodottoId) v.id = p.prodottoId
    }
    return Object.values(m).sort((a, b) => b.items.length - a.items.length)
  }, [filtrate])

  const attivo = perProdotto.find(p => p.nome === scelto) || perProdotto[0] || null

  // Gli angoli del prodotto attivo, ordinati per quantità: si lavora prima
  // dove c'è più materiale.
  const angoliDelProdotto = useMemo(() => {
    const m = {}
    for (const c of (attivo?.items || [])) {
      const k = c.angolo || 'Angolo libero'
      m[k] = (m[k] || 0) + 1
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1])
  }, [attivo])

  async function salva(ids, patch) {
    setAvviso(null)
    setFlag(f => {
      const n = { ...f }
      for (const id of ids) n[id] = { ...(n[id] || {}), ...patch }
      return n
    })
    try {
      const r = await fetch('/api/motore/flag', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...patch }),
      })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
    } catch (e) {
      // Si toglie l'ottimismo: meglio vedere il flag tornare indietro che
      // credere di aver segnato qualcosa che il database non ha.
      setFlag(f => { const n = { ...f }; for (const id of ids) delete n[id]; return n })
      setAvviso('Flag non salvato: ' + String(e.message || e))
    }
  }

  // Il copy pronto da incollare su Meta, con le etichette dei campi: senza
  // etichette, tre blocchi di testo incollati di fila non si sa più quale
  // vada nel titolo e quale nel testo primario.
  function copyTesto(c, soloPrimario) {
    if (soloPrimario) return c.primary_text || ''
    return [
      c.primary_text && `TESTO PRIMARIO\n${c.primary_text}`,
      c.headline && `TITOLO\n${c.headline}`,
      c.sub && `DESCRIZIONE\n${c.sub}`,
      c.cta && `CTA\n${c.cta}`,
      c.link_url && `LINK\n${c.link_url}`,
    ].filter(Boolean).join('\n\n')
  }

  async function copia(testo, cosa) {
    if (!testo) { setAvviso('Niente da copiare: questa creatività non ha ancora il copy.'); return }
    try {
      await navigator.clipboard.writeText(testo)
      setAvviso(`${cosa} copiato negli appunti.`)
      setTimeout(() => setAvviso(a => a && a.endsWith('copiato negli appunti.') ? null : a), 2500)
    } catch {
      // Su http non-locale la clipboard è negata: si ripiega sulla selezione,
      // così resta comunque un Cmd+C di distanza invece di un vicolo cieco.
      setAvviso('Appunti non disponibili: il testo è stato selezionato, premi Cmd+C.')
    }
  }

  // Clic sul copy: lo seleziona tutto, così si copia con Cmd+C senza doverlo
  // trascinare a mano dentro una scheda che può essere zoomata.
  const selezionaTesto = (e) => {
    const s = window.getSelection(); if (!s) return
    const r = document.createRange(); r.selectNodeContents(e.currentTarget)
    s.removeAllRanges(); s.addRange(r)
  }

  function apriMenu({ x, y, id }) {
    // Destro su una scheda fuori selezione: si seleziona quella e basta.
    // È il comportamento di ogni gestore di file, e l'alternativa (agire sulla
    // vecchia selezione invisibile) fa danni silenziosi.
    let ids = [...sel]
    if (id && !sel.has(id)) { ids = [id]; setSel(new Set([id])) }
    else if (!id && !ids.length) ids = []
    setMenu({ x, y, ids })
  }

  // I testi dell'inserzione, modificabili anche dopo l'importazione.
  //
  // Su piu' creativita' insieme si precompila SOLO cio' su cui vanno d'accordo:
  // un campo che differisce resta vuoto, e vuoto significa "non lo tocco". Cosi'
  // salvare un lotto per correggere la sola CTA non cancella cinque copy
  // diversi — che e' il modo piu' facile di perdere del lavoro senza accorgersene.
  const CAMPI_TESTO = ['primary_text', 'headline', 'sub', 'cta', 'link_url']

  function apriTesti(ids, scelte) {
    const iniziali = {}
    for (const k of CAMPI_TESTO) {
      const valori = new Set(scelte.map(c => c[k] || ''))
      iniziali[k] = valori.size === 1 ? [...valori][0] : ''
    }
    setTesti({ ids, iniziali, valori: { ...iniziali }, misti: CAMPI_TESTO.filter(k => new Set(scelte.map(c => c[k] || '')).size > 1) })
  }

  async function salvaTesti() {
    const { ids, iniziali, valori } = testi
    // Si spedisce solo cio' che e' stato toccato: il resto non deve nemmeno
    // comparire nella richiesta, altrimenti un campo lasciato vuoto perche'
    // discorde azzererebbe quello che c'era.
    const patch = {}
    for (const k of CAMPI_TESTO) if ((valori[k] || '') !== (iniziali[k] || '')) patch[k] = valori[k] || ''
    if (!Object.keys(patch).length) { setTesti(null); setAvviso('Nessuna modifica da salvare.'); return }
    setLavoro('Salvo i testi…')
    try {
      const r = await fetch('/api/motore/flag', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...patch }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setTesti(null)
      setAvviso(`Testi aggiornati su ${j.aggiornate} creativit\u00e0.`)
      await ricarica?.()
    } catch (e) { setAvviso(String(e.message || e)) } finally { setLavoro(null) }
  }

  // Spostare a mano: di angolo, di prodotto, o entrambi. Il classificatore
  // sbaglia e la cartella d'origine non copre tutto — deve esserci un modo di
  // correggerlo senza aprire il database.
  async function sposta(ids, patch, descrizione) {
    setAvviso(null); setLavoro(`Sposto ${ids.length}…`)
    try {
      const r = await fetch('/api/motore/sposta', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, ...patch }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setSel(new Set())
      // Si azzerano anche le scritture locali: dopo il giro sul server la
      // verità è quella che torna, e tenerle sopra mostrerebbe lo stato
      // vecchio su righe appena cambiate.
      setFlag({})
      await ricarica?.()
      setLavoro(null)
      setAvviso(`${j.spostate} spostate ${descrizione}${j.rinominate ? ` · ${j.rinominate} rinominate` : ''}.`)
    } catch (e) { setLavoro(null); setAvviso('Spostamento fallito: ' + String(e.message || e)) }
  }

  // Se si trascina una scheda che fa parte della selezione si trascina TUTTA
  // la selezione: altrimenti selezionarne venti e spostarne una sarebbe un
  // tranello. Se è fuori selezione, si trascina solo quella.
  const iniziaTrascino = (e, id) => {
    const ids = sel.has(id) ? [...sel] : [id]
    setTrascinati(ids)
    // 'all' e non 'move': lo stesso trascinamento può finire in uno SPOSTAMENTO
    // (su un ramo o su un prodotto) o in un ACCOPPIAMENTO (su un'altra scheda),
    // e i due chiedono effetti diversi. Dichiarando solo 'move' e poi chiedendo
    // 'link' sulla scheda la combinazione è invalida: il browser rifiuta il
    // rilascio OVUNQUE, mostra il cursore di divieto e la scheda torna al suo
    // posto — sembra che il trascinamento non funzioni, e invece è il contratto
    // fra i due effetti che non torna.
    e.dataTransfer.effectAllowed = 'all'
    e.dataTransfer.setData('text/plain', ids.join(','))
  }
  const sopra = (e, chiave) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; setBersaglio(chiave) }
  const lascia = () => setBersaglio(null)

  // Accoppiare i due formati della stessa creatività.
  // Nascondere o eliminare un prodotto.
  //
  // "Elimina" spesso NON è la risposta giusta e il server lo dice: i prodotti
  // arrivano dalle vendite Shopify e uno cancellato torna al primo giro
  // dell'ingest. Qui si riporta il rifiuto invece di insistere.
  async function prodottoAzione(prod, azione, extra = {}) {
    if (azione === 'elimina' && !window.confirm(
      `Eliminare "${prod.nome}"?\n\nSe arriva dalle vendite Shopify non si può: tornerebbe al prossimo aggiornamento. In quel caso ti propongo di nasconderlo.`)) return
    setAvviso(null); setLavoro('…')
    try {
      const r = await fetch('/api/motore/prodotti', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: prod.id, azione, ...extra }) })
      const j = await r.json()
      if (!r.ok) {
        setLavoro(null)
        // Il server propone di nascondere: si chiede, non si decide al posto suo.
        if (j.suggerimento === 'nascondi' && window.confirm(j.error + '\n\nVuoi nasconderlo?')) {
          return prodottoAzione(prod, 'nascondi')
        }
        if (j.creativita && azione === 'elimina') {
          const scelta = window.prompt(
            `${j.error}\n\nScrivi:\n  sposta  → le riassegno a un altro prodotto\n  elimina → le cancello con i file\n  stacca  → restano senza prodotto`, 'stacca')
          if (!scelta) return
          return prodottoAzione(prod, 'elimina', { creativita: scelta.trim().toLowerCase() })
        }
        setAvviso(j.error || `HTTP ${r.status}`)
        return
      }
      setScelto(null)
      await ricarica?.()
      setLavoro(null)
      setAvviso(j.azione === 'nascondi'
        ? `"${j.nome}" nascosto. ${j.nota || ''}`
        : `"${j.nome}" eliminato.` + (j.creativitaEliminate ? ` ${j.creativitaEliminate} creatività cancellate.` : '')
          + (j.creativitaSpostate ? ` ${j.creativitaSpostate} creatività staccate o spostate.` : ''))
    } catch (e) { setLavoro(null); setAvviso('Non riuscito: ' + String(e.message || e)) }
  }

  async function accoppia(corpo, descrizione) {
    setAvviso(null); setLavoro('Accoppio…')
    try {
      const r = await fetch('/api/motore/accoppia', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(corpo) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setSel(new Set()); setFlag({})
      await ricarica?.()
      setLavoro(null)
      setAvviso(j.nota ? `${descrizione}. ${j.nota}` : descrizione)
    } catch (e) { setLavoro(null); setAvviso('Accoppiamento fallito: ' + String(e.message || e)) }
  }

  async function elimina(ids) {
    const scelte = filtrate.filter(c => ids.includes(c.id))
    const nomi = scelte.slice(0, 3).map(c => c.name).join('\n')
    // Si chiede conferma: è l'unica azione della board che non si può annullare.
    if (!window.confirm(
      `Eliminare ${ids.length} creatività?\n\n${nomi}${ids.length > 3 ? `\n…e altre ${ids.length - 3}` : ''}` +
      `\n\nVengono rimossi anche i file. L'operazione non si annulla.`)) return
    setAvviso(null); setLavoro(`Elimino ${ids.length} creatività…`)
    try {
      const r = await fetch('/api/motore/elimina', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }) })
      const j = await r.json()
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`)
      setSel(new Set()); setFlag({})
      await ricarica?.()
      setLavoro(null)
      setAvviso(`Eliminate ${j.cancellate}${j.nota ? ' — ' + j.nota : ''}.`)
    } catch (e) { setLavoro(null); setAvviso('Eliminazione fallita: ' + String(e.message || e)) }
  }

  async function scaricaZip(ids) {
    setAvviso(null); setLavoro(`Preparo lo zip di ${ids.length} creatività…`)
    try {
      const r = await fetch('/api/motore/scarica', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      })
      if (!r.ok) { const j = await r.json().catch(() => ({})); throw new Error(j.error || `HTTP ${r.status}`) }
      const saltate = Number(r.headers.get('X-Saltate') || 0)
      const nome = (r.headers.get('Content-Disposition') || '').match(/filename="([^"]+)"/)?.[1] || 'creativita.zip'
      const url = URL.createObjectURL(await r.blob())
      const a = document.createElement('a'); a.href = url; a.download = nome
      document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
      setLavoro(null)
      if (saltate) setAvviso(`${saltate} creatività saltate: non hanno ancora un file composto.`)
    } catch (e) {
      setLavoro(null); setAvviso('Download fallito: ' + String(e.message || e))
    }
  }

  if (!prodotte.length) return (
    <div className="empty" style={{ marginTop: 30 }}>
      <b>Nessuna creatività prodotta ancora</b>
      <p>Qui finiscono le creatività che il motore genera dai brief, con copy, CTA e link già pronti.</p>
    </div>
  )

  // Si raggruppa per ANGOLO e basta. Spezzare anche per formato e tipo di
  // brief produceva 32 gruppi per un solo prodotto e un albero largo 51.000
  // pixel: nessuno lo scorre. L'angolo è l'unità con cui si ragiona quando si
  // guarda cosa produrre — il formato è una variante dentro l'angolo, non un
  // ramo suo.
  const gruppi = {}
  for (const p of (attivo?.items || [])) {
    const g = p.angolo || 'Angolo libero'
    if (angoloScelto && g !== angoloScelto) continue
    ;(gruppi[g] = gruppi[g] || { angolo: g, tipo: p.briefTipo, motivo: p.briefMotivo, items: [] }).items.push(p)
  }
  // Dentro un angolo le due versioni della stessa creatività stanno ATTACCATE.
  // Ordinare per nome le separava quando i nomi non combaciano — ed è proprio
  // il confronto fra i due formati che serve per decidere quale tenere.
  for (const g of Object.values(gruppi)) {
    g.items.sort((a, b) => {
      const ca = a.coppia || 'zzz~' + a.name, cb = b.coppia || 'zzz~' + b.name
      if (ca !== cb) return ca < cb ? -1 : 1
      return a.ratio === b.ratio ? 0 : (a.ratio === '1x1' ? -1 : 1)   // prima il quadrato
    })
  }
  // Prima gli angoli con più materiale: sono quelli su cui si sta lavorando.
  const gruppiOrdinati = Object.entries(gruppi).sort((a, b) => b[1].items.length - a[1].items.length)

  const idsAttivi = (attivo?.items || []).map(c => c.id)
  const selAttive = idsAttivi.filter(id => sel.has(id))
  const tutteSel = idsAttivi.length > 0 && selAttive.length === idsAttivi.length
  const cambiaSel = (id) => setSel(s => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n })
  const selTutte = () => setSel(s => {
    const n = new Set(s); tutteSel ? idsAttivi.forEach(i => n.delete(i)) : idsAttivi.forEach(i => n.add(i)); return n
  })

  // La scheda: la usano sia l'albero sia la griglia a un angolo solo.
  const scheda = (c) => (
    <article className="scheda" key={c.id} data-id={c.id}
                      draggable
                      onDragStart={(e) => iniziaTrascino(e, c.id)}
                      onDragEnd={() => { setTrascinati(null); setBersaglio(null) }}
                      data-sel={sel.has(c.id) ? 1 : 0} data-giudizio={c.giudizio || ''}
                      data-funnel={c.funnel || ''} data-coppia={c.coppia ? 1 : 0}
                      data-bersaglio={bersaglio === 'card:' + c.id ? 1 : 0}
                      onDragOver={(e) => {
                        // Si accoppia solo con l'ALTRO formato: due 9:16
                        // non sono una coppia, e proporlo sarebbe un invito
                        // a sbagliare.
                        if (!trascinati || trascinati.length !== 1 || trascinati[0] === c.id) return
                        const alt = filtrate.find(x => x.id === trascinati[0])
                        if (!alt || alt.ratio === c.ratio) return
                        e.preventDefault(); e.stopPropagation()
                        // 'link' dice "lego", non "sposto": il cursore lo
                        // distingue dallo spostamento su un ramo.
                        e.dataTransfer.dropEffect = 'link'
                        setBersaglio('card:' + c.id)
                      }}
                      onDragLeave={lascia}
                      onDrop={(e) => {
                        // Gli id si leggono dal dataTransfer e non solo
                        // dallo stato: il dataTransfer è ciò che il
                        // browser trasporta davvero col trascinamento,
                        // mentre lo stato dipende da un aggiornamento di
                        // React che potrebbe non essere ancora arrivato.
                        const dal = (e.dataTransfer?.getData('text/plain') || '').split(',').filter(Boolean)
                        const presi = trascinati?.length ? trascinati : dal
                        if (!presi.length) return
                        // Il rilascio su una scheda si ferma QUI, sempre.
                        // Lasciandolo passare al ramo, un trascinamento
                        // finito sulla scheda sbagliata — o su sé stessa —
                        // cambiava l'angolo invece di non fare niente:
                        // un gesto che fallisce deve non fare nulla, non
                        // fare un'altra cosa.
                        e.preventDefault(); e.stopPropagation(); lascia()
                        const a = presi[0]
                        setTrascinati(null)
                        if (a === c.id) return
                        // Trascinando PIÙ schede insieme il gesto è uno
                        // spostamento, non un accoppiamento. Dirlo: prima non
                        // succedeva niente e sembrava che il trascinamento
                        // fosse rotto.
                        if (presi.length !== 1) {
                          setAvviso(`Stai trascinando ${presi.length} creatività: per accoppiare i formati trascinane una sola. Azzera la selezione e riprova.`)
                          return
                        }
                        const alt = filtrate.find(x => x.id === a)
                        if (!alt) return
                        if (alt.ratio === c.ratio) {
                          // Stesso formato: non si possono accoppiare. Ma il
                          // gesto ha comunque un senso — la scheda è stata
                          // lasciata su QUEL ramo — quindi la si sposta lì.
                          // Prima non succedeva niente, e siccome le schede
                          // coprono tutto il gruppo era di fatto impossibile
                          // rilasciare su un ramo.
                          if ((alt.angolo || null) !== (c.angolo || null)) {
                            sposta([a], { angolo: c.angolo || null }, `nell'angolo ${c.angolo || 'libero'}`)
                          } else {
                            setAvviso(`Sono entrambe ${c.ratio === '1x1' ? '1:1' : '9:16'} e già nello stesso angolo: per accoppiare i formati servono un quadrato e un verticale.`)
                          }
                          return
                        }
                        accoppia({ a, b: c.id }, 'Formati accoppiati')
                      }}>
                      <div className={'tela' + (c.ratio === '9x16' ? ' v' : '')}>
                        {/* draggable={false}: le immagini sono trascinabili di natura, quindi
            partendo col mouse da sopra la foto il browser trascinava LEI e non
            la scheda, e l'accoppiamento non si innescava mai. Il trascinamento
            deve appartenere alla scheda, sempre. */}
        {c.anteprima ? <img src={c.anteprima} alt="" draggable={false} />
                          : <div className="attesa">Immagine da generare</div>}
                        <span className="tag-ratio">{c.ratio === '9x16' ? '9:16 · 1080×1920' : '1:1 · 1080×1080'}</span>
                        <label className="spunta" title="Seleziona per il download in blocco">
                          <input type="checkbox" checked={sel.has(c.id)} onChange={() => cambiaSel(c.id)} />
                          <span />
                        </label>
                        {c.anteprima && (
                          <a className="scarica-uno" href={`/api/motore/scarica?id=${c.id}`}
                            title="Scarica questa creatività">↓</a>
                        )}
                      </div>
                      <div className="corpo">
                        <div className="pillole">
                          {c.funnel && <span className="pillola funnel" data-f={c.funnel}>{c.funnel}</span>}
                          {c.persona && <span className="pillola">{c.persona}</span>}
                          <span className="pillola">{c.palette}</span>
                        </div>
                        {/* Ogni blocco di copy si seleziona tutto con un clic:
                            a tela zoomata trascinare il testo a mano è un incubo. */}
                        <h4 className="copiabile" onClick={selezionaTesto} title="Clicca per selezionare">{c.headline || '—'}</h4>
                        {c.sub && <p className="sub copiabile" onClick={selezionaTesto} title="Clicca per selezionare">{c.sub}</p>}
                        {c.primary_text && (
                          <div className="blocco-copy">
                            <p className="primario copiabile" onClick={selezionaTesto} title="Clicca per selezionare">{c.primary_text}</p>
                            <button className="azione copia" title="Copia tutto il copy negli appunti"
                              onClick={() => copia(copyTesto(c), 'Copy')}>Copia copy</button>
                          </div>
                        )}
                        <div className="piede">
                          <span className="cta-pill">{c.cta || 'CTA da definire'}</span>
                          {c.link_url
                            ? <a className="link-dest" href={c.link_url} target="_blank" rel="noreferrer">{c.link_url.replace(/^https?:\/\/(www\.)?/, '')}</a>
                            : <span className="link-dest">link da assegnare</span>}
                        </div>
                        {/* Due flag distinti: il lancio è un fatto, il verdetto è una
                            decisione presa dopo. Si può essere lanciati e senza verdetto. */}
                        <div className="azioni">
                          <button className="azione lancio" data-on={c.lanciata ? 1 : 0}
                            onClick={() => salva([c.id], { lanciata: !c.lanciata })}
                            title={c.lanciataIl ? 'Lanciata il ' + new Date(c.lanciataIl).toLocaleDateString('it-IT') : 'Segna come lanciata'}>
                            {c.lanciata ? '● Lanciata' : '○ Da lanciare'}
                          </button>
                          <span className="verdetti">
                            {VERDETTI.map(([kk, ll]) => (
                              <button key={kk} className={'azione v-' + kk} data-on={c.giudizio === kk ? 1 : 0}
                                onClick={() => salva([c.id], { giudizio: c.giudizio === kk ? null : kk })}
                                title={c.giudizio === kk ? 'Togli il verdetto' : 'Segna ' + ll}>{ll}</button>
                            ))}
                          </span>
                          {/* La QUALITÀ è un giudizio sul motore, non sulla resa: dice
                              se l'ha prodotta bene. Da qui il motore impara quali
                              ambienti, luci e inquadrature gli riescono. */}
                          <span className="verdetti qualita-riga" title="Com'è venuta? Da qui il motore impara">
                            {QUALITA.map(([kk, ll]) => (
                              <button key={kk} className={'azione q-' + kk} data-on={c.qualita === kk ? 1 : 0}
                                onClick={() => salva([c.id], { qualita: c.qualita === kk ? null : kk })}
                                title={c.qualita === kk ? 'Togli il giudizio' : 'Generazione ' + ll}>{ll}</button>
                            ))}
                          </span>
                        </div>
                        <div className="nome-file">{c.name}</div>
                      </div>
                    </article>
  )

  const VERDETTI = [['scale', 'Scale'], ['good', 'Good'], ['kill', 'Kill']]
  const QUALITA = [['ottima', 'Ottima'], ['buona', 'Buona'], ['male', 'Male']]

  return (
    <>
      <div className="bar" style={{ marginTop: 0 }}>
        {[['tutto','Sempre'],['30g','30 giorni'],['7g','7 giorni'],['oggi','Oggi']].map(([k,l]) => (
          <button key={k} className="chip" data-on={periodo===k?1:0} onClick={() => setPeriodo(k)}>{l}</button>
        ))}
        <span style={{ width: 14 }} />
        {[['tutte','Tutte'],['lanciate','Lanciate'],['da-lanciare','Da lanciare']].map(([k,l]) => (
          <button key={k} className="chip" data-on={stato===k?1:0} onClick={() => setStato(k)}>{l}</button>
        ))}
        <span style={{ width: 14 }} />
        {[['tutti','Ogni verdetto'],['scale','Scale'],['good','Good'],['kill','Kill'],['senza','Senza verdetto']].map(([k,l]) => (
          <button key={k} className={'chip v-' + k} data-on={verdetto===k?1:0} onClick={() => setVerdetto(k)}>{l}</button>
        ))}
        <span className="count">{filtrate.length} di {prodotte.length}</span>
      </div>

      <div className="bar">
        {[['tutte','Tutto il funnel'],['TOFU','TOFU'],['MOFU','MOFU'],['BOFU','BOFU']].map(([k,l]) => (
          <button key={k} className={'chip f-' + k} data-on={fase===k?1:0} onClick={() => setFase(k)}>{l}</button>
        ))}
        <span className="count">
          {['TOFU','MOFU','BOFU'].map(f => `${f} ${conFlag.filter(c => c.funnel === f).length}`).join(' · ')}
        </span>
      </div>

      <div className="bar bar-sel">
        <Importa elenchi={elenchi} fatto={async (n) => {
          await ricarica?.()
          setAvviso(`${n} creatività importate.`)
        }} />
        <button className="chip" onClick={selTutte} disabled={!idsAttivi.length}>
          {tutteSel ? 'Deseleziona tutte' : `Seleziona tutte (${idsAttivi.length})`}
        </button>
        <button className="chip forte" disabled={!sel.size || !!lavoro} onClick={() => scaricaZip([...sel])}>
          {lavoro ? 'Preparo…' : `Scarica ${sel.size || ''} selezionate`.replace('  ', ' ')}
        </button>
        {sel.size > 0 && <>
          <button className="chip" onClick={() => salva([...sel], { lanciata: true })}>Segna lanciate</button>
          {VERDETTI.map(([k, l]) => (
            <button key={k} className={'chip v-' + k} onClick={() => salva([...sel], { giudizio: k })}>Segna {l}</button>
          ))}
          <button className="chip" onClick={() => setSel(new Set())}>Azzera selezione</button>
        </>}
        {(lavoro || avviso) && <span className={'count ' + (avviso ? 'allarme' : '')}>{avviso || lavoro}</span>}
      </div>

      <div className="conBarra">
        <aside className="menu-prodotti">
          <div className="menu-titolo">Prodotti</div>
          {perProdotto.map(p => (
            <div key={p.nome} className="gruppo-prodotto">
            <button className="voce" data-on={attivo?.nome === p.nome ? 1 : 0}
              data-bersaglio={bersaglio === 'prod:' + p.nome ? 1 : 0}
              onDragOver={(e) => trascinati && p.id && sopra(e, 'prod:' + p.nome)}
              onDragLeave={lascia}
              onDrop={(e) => {
                e.preventDefault(); lascia()
                const dal = (e.dataTransfer?.getData('text/plain') || '').split(',').filter(Boolean)
                const ids = trascinati?.length ? trascinati : dal
                if (!ids.length || !p.id) return
                setTrascinati(null)
                sposta(ids, { prodottoId: p.id }, `su ${p.nome}`)
              }}
              onContextMenu={(e) => {
                e.preventDefault(); e.stopPropagation()
                if (p.id) setMenu({ x: e.clientX, y: e.clientY, livello: 'prodotto-azioni', prodotto: p })
              }}
              onClick={() => { setScelto(p.nome); setAngoloScelto(null) }}>
              <span className="voce-foto">{p.img ? <img src={p.img} alt="" /> : null}</span>
              <span className="voce-testo">
                <b>{p.nome}</b>
                <i>{p.items.length} creatività · {p.angoli.size} angoli</i>
              </span>
            </button>
            {attivo?.nome === p.nome && angoliDelProdotto.length > 1 && (
              <div className="angoli-elenco">
                <button className="voce-angolo" data-on={!angoloScelto ? 1 : 0}
                  onClick={() => setAngoloScelto(null)}>
                  Tutti gli angoli <span className="mono">{p.items.length}</span>
                </button>
                {angoliDelProdotto.map(([nome, n]) => (
                  <button key={nome} className="voce-angolo" data-on={angoloScelto === nome ? 1 : 0}
                    onClick={() => setAngoloScelto(angoloScelto === nome ? null : nome)}>
                    {nome} <span className="mono">{n}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          ))}
          {!perProdotto.length && <p className="voce-vuota">Nessun prodotto nel periodo scelto.</p>}
          {/* I nascosti restano raggiungibili: nascondere senza poter tornare
              indietro è un cassetto che non si riapre. */}
          {(elenchi?.nascosti || []).length > 0 && (
            <div className="nascosti">
              <div className="menu-titolo">Nascosti</div>
              {elenchi.nascosti.map(n => (
                <button key={n.id} className="voce-nascosta"
                  onClick={() => prodottoAzione({ id: n.id, nome: n.nome, items: [] }, 'mostra')}>
                  {n.nome} <i>rimetti</i>
                </button>
              ))}
            </div>
          )}
        </aside>

        <div className="area-tela">
          {attivo ? (
            <Tela contaSchede={attivo.items.length}
              onSelezione={(ids, add) => setSel(s => add ? new Set([...s, ...ids]) : new Set(ids))}
              onSfondo={() => setSel(new Set())}
              onMenu={apriMenu}>
              {angoloScelto ? (
                // Un angolo solo non è un albero: radice e ramo unico sono
                // ingombro, e le schede finivano incolonnate a quattro in una
                // striscia altissima. Qui la griglia prende tutta la tela.
                <div className="griglia-piena">
                  <div className="griglia-testa">
                    <h3>{angoloScelto}</h3>
                    <span className="meta">{attivo.nome} · {gruppiOrdinati[0]?.[1].items.length || 0} creatività</span>
                    <button className="chip" onClick={() => setAngoloScelto(null)}>Torna a tutti gli angoli</button>
                  </div>
                  <div className="griglia griglia-larga">
                    {(gruppiOrdinati[0]?.[1].items || []).map(c => scheda(c))}
                  </div>
                </div>
              ) : (
              <div className="albero" ref={alberoRef}>
                <Archi quanti={Object.keys(gruppi).length + attivo.items.length} />
                <div className="radice">
                  <div className="radice-foto">
                    {attivo.img ? <img src={attivo.img} alt="" />
                      : <span className="attesa">packshot<br/>non disponibile</span>}
                  </div>
                  <div className="radice-nome">{attivo.nome}</div>
                  <div className="radice-meta">{attivo.angoli.size} angoli · {attivo.items.length} creatività</div>
                </div>
                <div className="rami">
                  {gruppiOrdinati.map(([k, g]) => (
                    <section className="gruppo ramo" key={k}
                      data-bersaglio={bersaglio === 'angolo:' + k ? 1 : 0}
                      onDragOver={(e) => trascinati && sopra(e, 'angolo:' + k)}
                      onDragLeave={lascia}
                      onDrop={(e) => {
                        e.preventDefault(); lascia()
                        const dal = (e.dataTransfer?.getData('text/plain') || '').split(',').filter(Boolean)
                        const presi = trascinati?.length ? trascinati : dal
                        if (!presi.length) return
                        const dest = k === 'Angolo libero' ? null : k
                        // Chi è già in questo angolo non si sposta: un'azione
                        // che non cambia niente ma dice di averlo fatto è
                        // peggio di nessuna azione.
                        const ids = presi.filter(id => (filtrate.find(x => x.id === id)?.angolo || null) !== dest)
                        setTrascinati(null)
                        if (!ids.length) { setAvviso(`Sono già nell'angolo ${k}.`); return }
                        sposta(ids, { angolo: dest }, `nell'angolo ${k}`)
                      }}>
                      <div className="gruppo-testa">
                        <h3>{g.angolo}</h3>
                        <span className="meta">{g.items.length} creatività</span>
                      </div>
                      {g.motivo && <p className="perche">{g.motivo}</p>}
                      <div className="griglia">
                        {(angoloScelto || aperti.has(k) ? g.items : g.items.slice(0, VISIBILI_PER_ANGOLO)).map(c => scheda(c))}
                      </div>
                      {!angoloScelto && g.items.length > VISIBILI_PER_ANGOLO && (
                        <button className="chip espandi" onClick={() => setAperti(s => {
                          const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n
                        })}>
                          {aperti.has(k)
                            ? `Mostra solo le prime ${VISIBILI_PER_ANGOLO}`
                            : `+${g.items.length - VISIBILI_PER_ANGOLO} altre in questo angolo`}
                        </button>
                      )}
                    </section>
                  ))}
                </div>
              </div>
            )}
            </Tela>
          ) : <div className="empty"><p>Nessuna creatività nel periodo scelto.</p></div>}
        </div>
      </div>

      {menu?.livello === 'prodotto-azioni' && (
        <MenuTendina x={menu.x} y={menu.y} chiudi={() => setMenu(null)} voci={[
          { titolo: menu.prodotto.nome },
          { label: `Nascondi dalla board (${menu.prodotto.items.length} creatività)`,
            fai: () => prodottoAzione(menu.prodotto, 'nascondi') },
          { sep: true },
          { label: 'Elimina il prodotto', classe: 'v-kill',
            fai: () => prodottoAzione(menu.prodotto, 'elimina') },
        ]} />
      )}

      {menu?.livello === 'angolo' && (
        <MenuTendina x={menu.x} y={menu.y} chiudi={() => setMenu(null)} voci={[
          { titolo: `Sposta ${menu.ids.length} in…` },
          ...(elenchi?.angoli || []).map(a => ({ label: a, fai: () => sposta(menu.ids, { angolo: a }, `nell'angolo ${a}`) })),
          { sep: true },
          // Un angolo nuovo si crea da qui: la tassonomia la fa chi lavora,
          // non un elenco deciso a tavolino.
          { label: '+ Nuovo angolo…', classe: 'forte', fai: () => {
            const n = window.prompt('Nome del nuovo angolo (es. ORIGINE, PREZZO):')
            const slug = (n || '').trim().toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-+|-+$/g, '')
            if (slug) sposta(menu.ids, { angolo: slug }, `nell'angolo ${slug}`)
          } },
          { label: 'Togli l\'angolo', fai: () => sposta(menu.ids, { angolo: null }, 'senza angolo') },
        ]} />
      )}

      {testi && (
        <div className="drawer-bg" onClick={() => setTesti(null)}>
          <aside className="drawer stretto" onClick={e => e.stopPropagation()}>
            <button className="chiudi" onClick={() => setTesti(null)} aria-label="Chiudi">✕</button>
            <h2>Testi dell&apos;inserzione</h2>
            <p className="perche" style={{ margin: '10px 0 18px' }}>
              {testi.ids.length === 1
                ? 'Copy, CTA e link di questa creatività.'
                : `Valgono per le ${testi.ids.length} selezionate.`}
              {testi.misti.length > 0 && ' I campi su cui non vanno d\'accordo sono vuoti: lasciandoli vuoti restano com\'erano.'}
            </p>
            <div className="importa-testi">
              <CampiTesto v={testi.valori} set={(k, val) => setTesti(t => ({ ...t, valori: { ...t.valori, [k]: val } }))} idPrefisso="mod" />
            </div>
            {/* Non `.azioni`: quella e' la colonna di bottoni della scheda
                prodotto, e qui impilava Salva e Annulla a tutta larghezza. */}
            <div className="azioni-riga">
              <button className="chip forte" onClick={salvaTesti} disabled={!!lavoro}>Salva</button>
              <button className="chip" onClick={() => setTesti(null)}>Annulla</button>
            </div>
          </aside>
        </div>
      )}

      {menu?.livello === 'prodotto' && (
        <MenuTendina x={menu.x} y={menu.y} chiudi={() => setMenu(null)} voci={[
          { titolo: `Sposta ${menu.ids.length} su…` },
          ...(elenchi?.prodotti || []).slice(0, 14).map(p => ({
            label: p.nome, fai: () => sposta(menu.ids, { prodottoId: p.id }, `su ${p.nome}`),
          })),
        ]} />
      )}

      {menu && !menu.livello && (() => {
        const ids = menu.ids
        const n = ids.length
        const scelte = filtrate.filter(c => ids.includes(c.id))
        const una = n === 1 ? scelte[0] : null
        const conFile = scelte.filter(c => c.anteprima).length
        const vuoto = n === 0
        return <MenuTendina x={menu.x} y={menu.y} chiudi={() => setMenu(null)} voci={vuoto ? [
          { titolo: 'Nessuna creatività selezionata' },
          { label: `Seleziona tutte (${idsAttivi.length})`, fai: () => setSel(new Set(idsAttivi)) },
        ] : [
          { titolo: n === 1 ? una.name : `${n} creatività selezionate` },
          { label: conFile === n ? (n === 1 ? 'Scarica il file' : `Scarica tutte (${n})`)
                                 : `Scarica le ${conFile} con file`,
            off: !conFile, classe: 'forte',
            fai: () => n === 1 && conFile ? (window.location.href = `/api/motore/scarica?id=${una.id}`) : scaricaZip(ids) },
          { sep: true },
          { label: una ? 'Copia tutto il copy' : `Copia il copy delle ${n}`,
            fai: () => copia(scelte.map(c => copyTesto(c)).join('\n\n———\n\n'), 'Copy') },
          { label: una ? 'Copia solo il testo primario' : `Copia i ${n} testi primari`,
            fai: () => copia(scelte.map(c => copyTesto(c, true)).filter(Boolean).join('\n\n———\n\n'), 'Testo primario') },
          { label: una ? 'Copia il nome del file' : `Copia i ${n} nomi file`,
            fai: () => copia(scelte.map(c => c.name).join('\n'), 'Nome') },
          ...(una?.link_url ? [{ label: 'Copia il link di destinazione', fai: () => copia(una.link_url, 'Link') }] : []),
          { sep: true },
          { label: n === 1 ? 'Modifica i testi…' : `Modifica i testi delle ${n}…`,
            fai: () => apriTesti(ids, scelte) },
          { sep: true },
          { label: 'Segna lanciate', fai: () => salva(ids, { lanciata: true }) },
          { label: 'Segna da lanciare', fai: () => salva(ids, { lanciata: false }) },
          { sep: true },
          { label: 'Verdetto: Scale', classe: 'v-scale', fai: () => salva(ids, { giudizio: 'scale' }) },
          { label: 'Verdetto: Good', classe: 'v-good', fai: () => salva(ids, { giudizio: 'good' }) },
          { label: 'Verdetto: Kill', classe: 'v-kill', fai: () => salva(ids, { giudizio: 'kill' }) },
          { label: 'Togli il verdetto', fai: () => salva(ids, { giudizio: null }) },
          { sep: true },
          { label: 'Accoppia i formati per nome',
            fai: () => accoppia({ auto: true }, 'Accoppiamento automatico eseguito') },
          ...(scelte.some(c => c.coppia)
            ? [{ label: 'Sciogli la coppia', fai: () => accoppia({ scoppia: ids }, 'Coppia sciolta') }]
            : []),
          { sep: true },
          { label: 'Sposta in un altro angolo…',
            fai: () => setMenu({ ...menu, livello: 'angolo', ids }) },
          { label: 'Sposta su un altro prodotto…',
            fai: () => setMenu({ ...menu, livello: 'prodotto', ids }) },
          { sep: true },
          { titolo: 'Com\'è venuta — il motore impara da qui' },
          { label: 'Generazione: Ottima', classe: 'q-ottima', fai: () => salva(ids, { qualita: 'ottima' }) },
          { label: 'Generazione: Buona',  classe: 'q-buona',  fai: () => salva(ids, { qualita: 'buona' }) },
          // Due modi di dire male, perche' insegnano cose diverse. Il difetto
          // del prodotto si corregge nella specifica e NON deve togliere peso
          // all'ambientazione: e' cosi' che il motore aveva imparato a evitare
          // frantoio, dispensa, tramonto e tre-quarti per colpa di una maniglia.
          { label: 'Male — il prodotto è sbagliato', classe: 'q-male',
            fai: () => salva(ids, { qualita: 'male', qualitaMotivo: 'prodotto' }) },
          { label: 'Male — la scena non funziona', classe: 'q-male',
            fai: () => salva(ids, { qualita: 'male', qualitaMotivo: 'scena' }) },
          { sep: true },
          { label: `Seleziona tutte (${idsAttivi.length})`, fai: () => setSel(new Set(idsAttivi)) },
          { label: 'Azzera la selezione', fai: () => setSel(new Set()) },
          { sep: true },
          { label: n === 1 ? 'Elimina questa creatività' : `Elimina le ${n} selezionate`,
            classe: 'v-kill', fai: () => elimina(ids) },
        ]} />
      })()}
    </>
  )
}

// ============================================================================
//  La tab Griglia: due assi a scelta, un pubblico alla volta, una metrica.
//
//  Le regole (cosa e' "fai di piu'", cosa e' "prova", la soglia di lettura)
//  stanno in lib/incrocio.js e si calcolano sul server; qui si disegna e
//  basta. Le liste in cima dicono cosa fare, la tabella sotto mostra da dove
//  viene; un clic sulla cella apre le creativita' che ci stanno dietro.
// ============================================================================
const ASSI_ET = { angolo: 'Angolo', formato: 'Formato', persona: 'Persona', funnel: 'Fase', prodotto: 'Prodotto' }
const PUBBLICI_GRIGLIA = [['tutti', 'Tutti'], ['new', 'Nuovo'], ['engaged', 'Engagement'], ['returning', 'Returning']]
const METRICHE_GRIGLIA = [
  // `null` = ha speso senza vendere: si scrive in piccolo, non come un numero.
  ['roas',   'ROAS',             (c) => c.ordini ? num(c.roas) : null],
  ['cpa',    'Costo per ordine', (c) => c.ordini ? eur(c.cpa, 2) : null],
  ['spesa',  'Spesa',            (c) => eur(c.spesa)],
  ['quota',  'Quota di spesa',   (c) => quotaPc(c.quota)],
  ['ordini', 'Ordini',           (c) => Math.round(c.ordini)],
  ['valore', 'Fatturato',        (c) => eur(c.valore)],
  ['ctr',    'CTR',              (c) => pct(c.ctr)],
  ['cpc',    'CPC',              (c) => c.cpc ? eur(c.cpc, 2) : '—'],
  ['cpm',    'CPM',              (c) => c.impressioni ? eur(c.cpm, 2) : '—'],
]
const nomeCella = (x) => `${x.riga} × ${x.colonna}`
// Il valore di una cella o di un totale: un numero, un trattino se non ha
// speso, "senza vendite" in piccolo se ha speso senza un ordine.
function Valore({ v }) {
  if (v === null) return <b className="gparola">senza vendite</b>
  return <b>{v}</b>
}
const vicini = (p) => `${p.accanto[0].riga} × ${p.accanto[0].colonna} e ${p.accanto[1].riga} × ${p.accanto[1].colonna}`

function Griglia({ q, creativita, apriCreativita }) {
  const [righe, setRighe] = useState('angolo')
  const [colonne, setColonne] = useState('formato')
  const [pubblico, setPubblico] = useState('tutti')
  const [metrica, setMetrica] = useState('roas')
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  const [caricando, setCaricando] = useState(false)
  const [aperta, setAperta] = useState(null)
  // La vista sta nell'URL come la tab: la tabella degli incroci o il funnel 3D
  // con tutte le creativita' del periodo.
  const [vista, setVistaRaw] = useState('griglia')
  useEffect(() => {
    if (typeof window === 'undefined') return
    if (new URL(window.location.href).searchParams.get('vista') === '3d') setVistaRaw('3d')
  }, [])
  const setVista = (v) => {
    setVistaRaw(v)
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      if (v === '3d') u.searchParams.set('vista', '3d'); else u.searchParams.delete('vista')
      window.history.replaceState({}, '', u)
    }
  }
  // Ogni combinazione letta resta in memoria: cambiare asse o pubblico avanti
  // e indietro non deve rifare la stessa lettura. La chiave porta anche il
  // periodo, cosi' un intervallo nuovo non puo' pescare numeri di quello vecchio.
  const cache = useRef(new Map())

  const chiave = `${q}&righe=${righe}&colonne=${colonne}&pubblico=${pubblico}`
  useEffect(() => {
    setErr(null)
    const c = cache.current.get(chiave)
    if (c) { setD(c); return }
    let vivo = true
    setCaricando(true)
    fetch(`/api/motore/griglia?${chiave}`, { cache: 'no-store' }).then(r => r.json())
      .then(j => { if (!vivo) return; if (j.error) setErr(j.error); else { cache.current.set(chiave, j); setD(j) } })
      .catch(e => { if (vivo) setErr(String(e)) })
      .finally(() => { if (vivo) setCaricando(false) })
    return () => { vivo = false }
  }, [chiave])

  // Lo stesso asse su entrambi i lati non e' una griglia: scegliendolo, l'altro
  // lato prende quello che c'era qui.
  const cambiaRighe = (v) => { if (v === colonne) setColonne(righe); setRighe(v) }
  const cambiaColonne = (v) => { if (v === righe) setRighe(colonne); setColonne(v) }
  const scambia = () => { setRighe(colonne); setColonne(righe) }

  const interruttore = (
    <div className="bar" style={{ marginTop: 0 }}>
      {[['griglia', 'Griglia'], ['3d', 'Funnel 3D']].map(([k, l]) => (
        <button key={k} type="button" className="chip" data-on={vista === k ? 1 : 0} onClick={() => setVista(k)}>{l}</button>
      ))}
      {vista === '3d' && <span className="count">{(creativita || []).length} creatività nel periodo · altezza = fase, grandezza = spesa, vicinanza = angolo</span>}
    </div>
  )
  if (vista === '3d') return <>{interruttore}<Funnel3D righe={creativita} apri={apriCreativita} /></>
  if (err) return <>{interruttore}<div className="empty" style={{ marginTop: 30 }}><b>Non riesco a leggere la griglia</b><p>{err}</p></div></>
  if (!d) return <>{interruttore}<div className="empty" style={{ marginTop: 30 }}><p>Calcolo…</p></div></>

  const g = d.griglia
  const M = METRICHE_GRIGLIA.find(m => m[0] === metrica)
  const fmt = (c) => c.spesa > 0 ? M[2](c) : '—'
  const quote = g.righe.flatMap(r => g.colonne.map(c => g.celle[r.chiave][c.chiave].quota))
  const maxQuota = Math.max(0.0001, ...quote)
  // Tinta di fondo: bianco neutro, piu' intensa dove si e' speso di piu'. Dice
  // "qui ci sono soldi", non "qui va bene": il giudizio lo danno le etichette.
  const tinta = (c) => c.spesa > 0
    ? { background: `rgba(255,255,255,${(0.02 + 0.09 * Math.sqrt(c.quota / maxQuota)).toFixed(3)})` } : undefined
  const apri = (c) => { if (c.n > 0) setAperta(c) }
  const pubEt = PUBBLICI_GRIGLIA.find(p => p[0] === pubblico)[1]
  const nAssi = d.conto.assi
  const fai = g.liste.faiDiPiu, prova = g.liste.provaPoi

  return (
    <>
      {interruttore}
      <div className="bar">
        <span className="et">{d.periodo.since} → {d.periodo.until}</span>
        <span className="count">
          {d.periodo.giorni} giorni · {d.conto.creativita} creatività · {eur(d.conto.spesa)} ·{' '}
          {nAssi.persone} persone, {nAssi.angoli} angoli, {nAssi.formati} formati
          {caricando ? ' · aggiorno…' : ''}
        </span>
      </div>
      <p className="gfrase">{d.frase}</p>

      <div className="gliste">
        <section className="gcarta">
          <div className="gcarta-testa">
            <span className="gpunto" style={{ background: C.scala }} />Fai di più di questi
            {fai.length > 0 && <span className="count">{Math.min(5, fai.length)} su {fai.length}</span>}
          </div>
          {fai.length === 0 && <p className="gvuoto">
            Nessun incrocio ha abbastanza spesa per dire qualcosa: servono {eur(g.soglia.spesa)} e {g.soglia.ordini} ordini per cella.
          </p>}
          {fai.slice(0, 5).map(x => (
            <button key={nomeCella(x)} type="button" className="gvoce" onClick={() => apri(g.celle[x.riga][x.colonna])}>
              <b>{nomeCella(x)}</b>
              <span>{quotaPc(x.quota)} della spesa, ROAS {num(x.roas)}, {eur(x.cpa, 2)} a ordine</span>
            </button>
          ))}
        </section>
        <section className="gcarta">
          <div className="gcarta-testa">
            <span className="gpunto tratteggio" style={{ borderColor: C.tieni }} />Prova poi
            {prova.length > 0 && <span className="count">{g.conto.prova} buchi accanto ai vincitori</span>}
          </div>
          {prova.length === 0 && <p className="gvuoto">Nessun buco accanto ai vincitori.</p>}
          {prova.map(x => (
            <div key={nomeCella(x)} className="gvoce">
              <b>{nomeCella(x)}</b>
              <span>accanto a {vicini(x)}{x.pronte > 0 ? ` · ${x.pronte} già pronte, mai lanciate` : ''}</span>
            </div>
          ))}
        </section>
      </div>

      <div className="gcontrolli">
        <label>Righe
          <select value={righe} onChange={e => cambiaRighe(e.target.value)}>
            {Object.entries(ASSI_ET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <button type="button" className="azione" onClick={scambia} title="Scambia righe e colonne">Scambia</button>
        <label>Colonne
          <select value={colonne} onChange={e => cambiaColonne(e.target.value)}>
            {Object.entries(ASSI_ET).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
        <label>Metrica
          <select value={metrica} onChange={e => setMetrica(e.target.value)}>
            {METRICHE_GRIGLIA.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <div className="bar" style={{ margin: 0, marginLeft: 'auto' }}>
          {PUBBLICI_GRIGLIA.map(([k, l]) => (
            <button key={k} type="button" className="chip" data-on={pubblico === k ? 1 : 0} onClick={() => setPubblico(k)}>{l}</button>
          ))}
        </div>
      </div>

      {g.righe.length === 0 || g.colonne.length === 0 ? (
        <div className="empty"><b>Niente da incrociare</b><p>Nessuna creatività ha sia {g.assi.etRighe.toLowerCase()} sia {g.assi.etColonne.toLowerCase()} in questo periodo.</p></div>
      ) : (
        <div className="tw">
          <table className="matrice incrocio">
            <thead>
              <tr>
                <th className="grow"><span className="gnome">{g.assi.etRighe} ↓ · {g.assi.etColonne} →</span></th>
                {g.colonne.map(c => (
                  <th key={c.chiave} className="gcol">
                    <span className="gnome">{c.chiave}</span>
                    <span className="gsub">{quotaPc(c.quota)} · {fmt(c) ?? 'senza vendite'}</span>
                  </th>
                ))}
                <th className="gcol gtot"><span className="gnome">Totale</span></th>
              </tr>
            </thead>
            <tbody>
              {g.righe.map(r => (
                <tr key={r.chiave}>
                  <th className="grow">
                    <span className="gnome">{r.chiave}</span>
                    <span className="gsub">{quotaPc(r.quota)} · {r.n} creatività</span>
                  </th>
                  {g.colonne.map(c => <Cella key={c.chiave} c={g.celle[r.chiave][c.chiave]} fmt={fmt} tinta={tinta} apri={apri} />)}
                  <td className="gcell gtot"><Valore v={fmt(r)} /></td>
                </tr>
              ))}
              <tr className="gtotali">
                <th className="grow"><span className="gnome">Totale</span></th>
                {g.colonne.map(c => <td key={c.chiave} className="gcell gtot"><Valore v={fmt(c)} /></td>)}
                <td className="gcell gtot"><Valore v={fmt(g.totale)} /></td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      <div className="glegenda">
        <span><b style={{ color: C.scala }}>Fai di più</b> spesa leggibile ({eur(g.soglia.spesa)} e {g.soglia.ordini} ordini) e costo per ordine vicino o sotto quello del conto su questo pubblico ({g.rif.cpa ? eur(g.rif.cpa, 2) : '—'})</span>
        <span><b style={{ color: C.tieni }}>Prova</b> mai andata in onda, con un vincitore nella riga e uno nella colonna</span>
        <span><b className="gm">in grigio</b> ha speso, non abbastanza per giudicare</span>
        <span><b className="gm">·</b> mai provata</span>
        {(g.minori.righe.length > 0 || g.minori.colonne.length > 0) && (
          <span>Fuori tabella: {g.minori.righe.length} {g.assi.pluraleRighe} e {g.minori.colonne.length} {g.assi.pluraleColonne} senza spesa nel periodo e con meno di 3 creatività</span>
        )}
        {(g.senza.righe > 0 || g.senza.colonne > 0) && (
          <span>{g.senza.righe} creatività senza {g.assi.etRighe.toLowerCase()} e {g.senza.colonne} senza {g.assi.etColonne.toLowerCase()} non compaiono</span>
        )}
      </div>

      {aperta && <CassettoCella c={aperta} d={d} pubblico={pubEt} chiudi={() => setAperta(null)} />}
    </>
  )
}

function Cella({ c, fmt, tinta, apri }) {
  if (c.stato === 'vuota') {
    if (c.prova) return <td className="gcell gprova" title={`mai provata · accanto a ${vicini(c.prova)}`}><b>Prova</b></td>
    return <td className="gcell gvuota" title="mai provata">·</td>
  }
  if (c.stato === 'magazzino') return (
    <td className={'gcell gprovata' + (c.prova ? ' gprova' : '')} onClick={() => apri(c)}
      title={`${c.n} creatività, nessuna spesa nel periodo${c.pronte ? ` · ${c.pronte} pronte, mai lanciate` : ''}${c.prova ? ` · accanto a ${vicini(c.prova)}` : ''}`}>
      <b>{c.prova ? 'Prova' : c.n}</b><i>{c.pronte ? `${c.pronte} pronte` : 'nessuna spesa'}</i>
    </td>
  )
  if (c.stato === 'provata') return (
    <td className="gcell gprovata" style={tinta(c)} onClick={() => apri(c)}
      title={`${c.n} creatività · ${eur(c.spesa)} · ${Math.round(c.ordini)} ordini — non basta per giudicare`}>
      <Valore v={fmt(c)} /><i>{c.n} · {eur(c.spesa)}</i>
    </td>
  )
  return (
    <td className={'gcell gletta' + (c.faiDiPiu ? ' gfai' : '')} style={tinta(c)} onClick={() => apri(c)}
      title={`${c.n} creatività · ${eur(c.spesa)} · ${Math.round(c.ordini)} ordini · ROAS ${num(c.roas)} · ${eur(c.cpa, 2)} a ordine`}>
      {c.faiDiPiu && <em>Fai di più</em>}
      <Valore v={fmt(c)} /><i>{c.n} · {eur(c.spesa)}</i>
    </td>
  )
}

// Il cassetto di una cella: il suo conto e le creativita' che ci stanno dietro,
// con il link per aprirle tutte insieme in Gestione inserzioni.
function CassettoCella({ c, d, pubblico, chiudi }) {
  const cre = c.creativita.map(id => ({ id, ...d.creativita[id] })).filter(x => x.nome)
    .sort((a, b) => b.spesa - a.spesa || a.nome.localeCompare(b.nome))
  const adIds = cre.filter(x => x.adId).map(x => x.adId)
  const link = d.account.actId && adIds.length
    ? `https://adsmanager.facebook.com/adsmanager/manage/ads?act=${d.account.actId}&selected_ad_ids=${adIds.join(',')}`
    : null
  const giudizio = c.faiDiPiu ? ['Fai di più', C.scala] : c.prova ? ['Prova', C.tieni]
    : c.leggibile ? ['Leggibile', null] : c.stato === 'magazzino' ? ['Nessuna spesa nel periodo', null] : ['Pochi dati', null]
  const stile = giudizio[1] ? { color: giudizio[1], borderColor: giudizio[1], background: 'none', border: '1px solid' } : undefined
  return (
    <div className="drawer-bg" onClick={chiudi}>
      <aside className="drawer gcassetto" onClick={e => e.stopPropagation()}>
        <button className="chiudi" onClick={chiudi} aria-label="Chiudi">✕</button>
        <h2>{c.riga} × {c.colonna}</h2>
        <div className="riga-band">
          <span className="band" style={stile}>{giudizio[0]}</span>
          <span className="seg">{pubblico}</span>
          <span className="seg">{c.n} creatività · {quotaPc(c.quota)} della spesa</span>
        </div>
        <div className="mini">
          <div><span>Spesa</span><b className="mono">{eur(c.spesa)}</b></div>
          <div><span>Ordini</span><b className="mono">{Math.round(c.ordini)}</b></div>
          <div><span>Fatturato</span><b className="mono">{eur(c.valore)}</b></div>
          <div><span>ROAS</span><b className="mono">{c.spesa ? num(c.roas) : '—'}</b></div>
          <div><span>CPO</span><b className="mono">{c.ordini ? eur(c.cpa, 2) : '—'}</b></div>
          <div><span>CTR</span><b className="mono">{c.impressioni ? pct(c.ctr) : '—'}</b></div>
          <div><span>CPC</span><b className="mono">{c.cpc ? eur(c.cpc, 2) : '—'}</b></div>
          <div><span>CPM</span><b className="mono">{c.impressioni ? eur(c.cpm, 2) : '—'}</b></div>
        </div>
        {c.spesa > 0 && !c.leggibile && (
          <p className="perche" style={{ margin: '14px 0 0' }}>
            Non basta per giudicare: servono {eur(d.griglia.soglia.spesa)} di spesa e {d.griglia.soglia.ordini} ordini perché il costo per ordine di una cella significhi qualcosa.
          </p>
        )}
        {c.prova && (
          <p className="perche" style={{ margin: '14px 0 0' }}>
            Mai andata in onda. Accanto ha <b>{c.prova.accanto[0].riga} × {c.prova.accanto[0].colonna}</b> (ROAS {num(c.prova.accanto[0].roas)}) e <b>{c.prova.accanto[1].riga} × {c.prova.accanto[1].colonna}</b> (ROAS {num(c.prova.accanto[1].roas)}): messaggio e formato convertono già, qui manca solo l&apos;incrocio.
          </p>
        )}

        <h3>Le creatività dietro la cella</h3>
        {cre.length === 0 && <p className="copy vuoto">Nessuna creatività.</p>}
        {cre.length > 0 && (
          <table className="gdentro">
            <thead><tr><th>Creatività</th><th>Stato</th><th className="num">Spesa</th><th className="num">Ordini</th><th className="num">ROAS</th></tr></thead>
            <tbody>
              {cre.map(x => (
                <tr key={x.id}>
                  <td className="nm" title={x.nome}>{x.nome}</td>
                  <td><span className="seg">{x.stato}</span></td>
                  <td className="num mono">{eur(x.spesa)}</td>
                  <td className="num mono">{Math.round(x.ordini)}</td>
                  <td className="num mono">{x.spesa ? num(x.roas) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {link && <a className="azione gapri" href={link} target="_blank" rel="noreferrer">Apri queste {adIds.length} inserzioni in Gestione inserzioni</a>}
      </aside>
    </div>
  )
}

export default function Board() {
  const [d, setD] = useState(null)
  const [err, setErr] = useState(null)
  // La tab sta nell'URL: si può linkare direttamente una vista.
  const [tab, setTabRaw] = useState('performance')
  const setTab = (t) => {
    setTabRaw(t)
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href); u.searchParams.set('tab', t)
      window.history.replaceState({}, '', u)
    }
  }
  useEffect(() => {
    if (typeof window === 'undefined') return
    const t = new URL(window.location.href).searchParams.get('tab')
    if (t === 'produzione' || t === 'performance' || t === 'analitiche' || t === 'griglia' || t === 'matrice') setTabRaw(t)
  }, [])
  // Il periodo sta nell'URL come la tab: una vista si linka intera, periodo
  // compreso, altrimenti chi apre il link vede altri numeri.
  // Il periodo e' un oggetto, non piu' un solo preset: puo' essere un
  // intervallo scelto a mano, e puo' portarsi dietro il confronto. Sta
  // nell'URL come la tab, cosi' una vista si linka intera.
  const [periodo, setPeriodoRaw] = useState({ preset: 'ultimi-30', confronta: false })
  const setPeriodo = (v) => {
    setPeriodoRaw(v)
    if (typeof window !== 'undefined') {
      const u = new URL(window.location.href)
      u.searchParams.set('periodo', v.preset)
      if (v.preset === 'personalizzato') { u.searchParams.set('da', v.since); u.searchParams.set('a', v.until) }
      else { u.searchParams.delete('da'); u.searchParams.delete('a') }
      if (v.confronta) u.searchParams.set('confronta', '1'); else u.searchParams.delete('confronta')
      window.history.replaceState({}, '', u)
    }
  }
  useEffect(() => {
    if (typeof window === 'undefined') return
    const q = new URL(window.location.href).searchParams
    const p = q.get('periodo')
    if (!p) return
    setPeriodoRaw({ preset: p, since: q.get('da') || undefined, until: q.get('a') || undefined,
      confronta: q.get('confronta') === '1' })
  }, [])
  // La stringa da appendere alle chiamate: una sola, cosi' board, analitiche e
  // cervello non possono chiedere intervalli diversi.
  const qPeriodo = useMemo(() => {
    const u = new URLSearchParams({ preset: periodo.preset })
    if (periodo.preset === 'personalizzato') { u.set('since', periodo.since || ''); u.set('until', periodo.until || '') }
    if (periodo.confronta) u.set('confronta', '1')
    return u.toString()
  }, [periodo])
  const [filtro, setFiltro] = useState('tutte')
  const [ord, setOrd] = useState({ campo: 'spend', desc: true })
  const [aperta, setAperta] = useState(null)   // creatività aperta nel pannello

  // La lettura della board diventa richiamabile: dopo uno spostamento o una
  // cancellazione i dati sono cambiati, e dire "ricarica la pagina" scarica
  // sull'utente un lavoro che il software sa fare da solo.
  const ricarica = useCallback(async () => {
    try {
      const j = await (await fetch(`/api/motore/board?${qPeriodo}`, { cache: 'no-store' })).json()
      if (j.error) setErr(j.error); else setD(j)
    } catch (e) { setErr(String(e)) }
  }, [qPeriodo])
  useEffect(() => { ricarica() }, [ricarica])

  const righe = useMemo(() => {
    if (!d) return []
    const r = filtro === 'tutte' ? d.righe : d.righe.filter(x => x.bandaLabel === filtro)
    return [...r].sort((a, b) => {
      const va = a[ord.campo] ?? 0, vb = b[ord.campo] ?? 0
      if (typeof va === 'string') return ord.desc ? vb.localeCompare(va) : va.localeCompare(vb)
      return ord.desc ? vb - va : va - vb
    })
  }, [d, filtro, ord])

  const maxSpesa = useMemo(() => Math.max(1, ...(d?.righe || []).map(r => r.spend || 0)), [d])

  const conteggi = useMemo(() => {
    if (!d) return {}
    return d.righe.reduce((a, r) => (a[r.bandaLabel] = (a[r.bandaLabel] || 0) + 1, a), {})
  }, [d])

  if (err) return <div className="shell"><div className="empty" style={{ marginTop: 60 }}><b>Non riesco a leggere i dati</b><p>{err}</p></div></div>
  if (!d) return <div className="shell"><div className="empty" style={{ marginTop: 60 }}><p>Carico…</p></div></div>

  const a = d.account
  const c = d.confronto
  const th = (campo, label, right) => (
    <th onClick={() => setOrd(o => ({ campo, desc: o.campo === campo ? !o.desc : true }))}
        style={right ? { textAlign: 'right' } : undefined}
        title="Ordina">{label}{ord.campo === campo ? (ord.desc ? ' ↓' : ' ↑') : ''}</th>
  )

  return (
    <div className="shell">
      <header className="top">
        <div className="brand">Motore Creativo{d?.cliente?.nome ? <span> · {d.cliente.nome}</span> : null}</div>
        <Crediti />
        <nav className="menu">
          <button data-on={tab === 'performance' ? 1 : 0} onClick={() => setTab('performance')}>Performance</button>
          <button data-on={tab === 'produzione' ? 1 : 0} onClick={() => setTab('produzione')}>Produzione</button>
          <button data-on={tab === 'analitiche' ? 1 : 0} onClick={() => setTab('analitiche')}>Analitiche</button>
          <button data-on={tab === 'griglia' ? 1 : 0} onClick={() => setTab('griglia')}>Griglia</button>
          <button data-on={tab === 'matrice' ? 1 : 0} onClick={() => setTab('matrice')}>Matrice</button>
        </nav>
        {/* Il periodo sta nell'intestazione e non dentro una tab: vale per tutte,
            e cambiarlo in un posto solo evita di confrontare intervalli diversi
            credendo di confrontare le stesse cose. La Produzione non guarda i
            KPI, quindi li' non serve. */}
        {tab !== 'produzione' && tab !== 'matrice' && <SelettorePeriodo valore={periodo} cambia={setPeriodo} />}
      </header>

      {tab === 'performance' && (
        <>
          {/* --- le tre metriche che decidono --------------------------------
              Non sono le più grandi dell'account: sono le uniche che fanno
              cambiare idea. Spesa e impression descrivono, MER/CPO/CAC
              decidono, e stanno sopra tutto il resto con la loro soglia. */}
          <div className="decisioni">
            {(() => {
              const b = d.business
              if (!b) return <div className="empty" style={{ gridColumn: '1 / -1' }}>
                <b>Shopify non collegato</b>
                <p>Senza fatturato e ordini reali si può solo confrontare le creatività fra loro: MER, CAC e CPO di pareggio restano fuori portata.</p>
              </div>
              const mer = b.merSoloMeta
              const cpoPar = 71, cpoBuono = 59
              return <>
                <Metrica lab="MER · solo Meta" val={num(mer)}
                  stato={mer >= 4.5 ? 'ok' : mer >= 3.5 ? 'warn' : 'ko'}
                  soglia="4,5" rif="soglia 4,5 — sotto si erode il margine"
                  nota="manca la spesa Google Ads: il MER vero è più basso"
                  scala={{ v: mer, soglia: 4.5, max: Math.max(mer * 1.25, 9) }} />
                <Metrica lab="CPO account" val={eur(a.cpo, 2)}
              delta={c ? <Delta ora={a.cpo} prima={c.cpo} menoMeglio formato={(x) => eur(x, 2)} /> : null}
                  stato={a.cpo <= cpoBuono ? 'ok' : a.cpo <= cpoPar ? 'warn' : 'ko'}
                  soglia="€59–71" rif="pareggio €59–71 sul primo ordine"
                  nota={`${Math.round(a.acquisti)} acquisti su ${eur(a.spesa)} di spesa`}
                  scala={{ v: a.cpo, soglia: cpoPar, max: Math.max(a.cpo * 1.25, cpoPar * 1.4) }} />
                <Metrica lab="CAC blended" val={eur(b.cac, 2)}
                  stato={b.cac <= b.cacPareggioPrimoOrdine ? 'ok' : b.cac <= b.cacTetto ? 'warn' : 'ko'}
                  soglia={eur(b.cacTetto, 0)}
                  rif={`pareggio ${eur(b.cacPareggioPrimoOrdine, 0)} · tetto ${eur(b.cacTetto, 0)} col ritorno`}
                  nota={`${b.new_customers} nuovi clienti · ${pct(b.repeatRate * 100, 0)} di ritorno`}
                  scala={{ v: b.cac, soglia: b.cacTetto, max: Math.max(b.cac * 1.25, b.cacTetto * 1.3) }} />
              </>
            })()}
          </div>

          {/* --- il contesto: descrive, non decide ---------------------------- */}
          <div className="strip">
            <div className="kpi"><div className="lab">Spesa</div><div className="val mono">{eur(a.spesa)}</div>
              {/* La spesa non ha un verso giusto: su un conto che sta scalando
                  un +57% e' il piano, non un problema. Segnarla in rosso perche'
                  sale direbbe una cosa falsa con molta sicurezza. */}
              {c && <Delta ora={a.spesa} prima={c.spesa} neutro formato={(x) => eur(x)} />}</div>
            <div className="kpi"><div className="lab">Valore conv.</div><div className="val mono">{eur(a.valore)}</div>
              {c && <Delta ora={a.valore} prima={c.valore} formato={(x) => eur(x)} />}</div>
            <div className="kpi"><div className="lab">ROAS Meta</div><div className="val mono">{num(a.roas)}</div>
              {c ? <Delta ora={a.roas} prima={c.roas} formato={(x) => num(x)} />
                 : <div className="sub">confronta creatività, non decide il budget</div>}</div>
            <div className="kpi"><div className="lab">Acquisti</div><div className="val mono">{Math.round(a.acquisti)}</div>
              {c && <Delta ora={a.acquisti} prima={c.acquisti} formato={(x) => Math.round(x)} />}</div>
            <div className={'kpi' + (d.business ? '' : ' void')}>
              <div className="lab">Fatturato</div>
              <div className="val mono">{d.business ? eur(d.business.revenue) : '—'}</div>
              {d.business && <div className="sub">{d.business.orders} ordini</div>}
            </div>
            <div className={'kpi' + (d.business ? '' : ' void')}>
              <div className="lab">AOV</div>
              <div className="val mono">{d.business ? eur(d.business.aov, 0) : '—'}</div>
              {d.business && <div className="sub">valore medio dell'ordine</div>}
            </div>
          </div>

          {/* --- dove sta la spesa, per verdetto ------------------------------
              A contare le creatività si sbaglia bersaglio: venti creatività da
              spegnere che pesano il 3% della spesa non sono un problema, una
              sola che ne pesa il 30% lo è. La barra mostra la SPESA. */}
          {(() => {
            const perBanda = {}
            for (const r of d.righe) {
              const k = r.bandaLabel
              const v = perBanda[k] || (perBanda[k] = { n: 0, spesa: 0 })
              v.n++; v.spesa += r.spend || 0
            }
            const tot = Object.values(perBanda).reduce((s, v) => s + v.spesa, 0) || 1
            const ordinati = ORDINE.filter(k => perBanda[k])
            return (
              <section className="distribuzione">
                <div className="et">Distribuzione della spesa per verdetto</div>
                <div className="dist-barra">
                  {ordinati.map(k => (
                    <button key={k} className="dist-fetta" title={`${k} — ${eur(perBanda[k].spesa)} · ${perBanda[k].n} creatività`}
                      data-on={filtro === k ? 1 : 0}
                      onClick={() => setFiltro(filtro === k ? 'tutte' : k)}
                      style={{ width: (perBanda[k].spesa / tot * 100) + '%', background: COLORE_BANDA[k] }} />
                  ))}
                </div>
                <div className="dist-legenda">
                  {ordinati.map(k => (
                    <button key={k} className="voce-leg" data-on={filtro === k ? 1 : 0}
                      onClick={() => setFiltro(filtro === k ? 'tutte' : k)}>
                      <i style={{ background: COLORE_BANDA[k] }} />
                      <b>{k}</b>
                      <span className="mono">{pct(perBanda[k].spesa / tot * 100, 0)}</span>
                      <em>{perBanda[k].n}</em>
                    </button>
                  ))}
                  <button className="voce-leg" data-on={filtro === 'tutte' ? 1 : 0} onClick={() => setFiltro('tutte')}>
                    <b>Tutte</b><em>{d.righe.length}</em>
                  </button>
                </div>
              </section>
            )
          })()}

          <div className="note">
            <b>Soglie ancorate al segmento.</b>{' '}
            pubblico nuovo — scala {d.soglie.new.scala} · stand by {d.soglie.new.standby} · eccezioni {d.soglie.new.eccezioni}
            {'  ·  '}
            pubblico caldo — scala {d.soglie.caldi.scala} · stand by {d.soglie.caldi.standby} · eccezioni {d.soglie.caldi.eccezioni}.
            {a.coperturaSegmenti < 0.98
              ? <> Il {pct((1 - a.coperturaSegmenti) * 100, 0)} della spesa non ha segmento: usa la soglia del pubblico caldo, la più severa.</>
              : <> Copertura dei segmenti completa: ogni creatività è giudicata sul suo pubblico.</>}
          </div>

          <div className="bar">
            <span className="et">{filtro === 'tutte' ? 'Tutte le creatività' : filtro}</span>
            <span className="count">{righe.length} creatività · {eur(righe.reduce((t, r) => t + (r.spend || 0), 0))} di spesa</span>
          </div>

          <div className="tw">
            <table>
              <thead><tr>
                {th('name', 'Creatività')}<th>Verdetto</th><th>Pubblico</th>
                {th('eta', 'Età', true)}{th('spend', 'Spesa', true)}{th('impressions', 'Impr.', true)}
                {th('ctr', 'CTR', true)}{th('cpm', 'CPM', true)}{th('cpc', 'CPC', true)}
                {th('frequency', 'Freq.', true)}{th('purchases', 'Acquisti', true)}
                {th('value', 'Valore', true)}{th('roas', 'ROAS', true)}{th('cpo', 'CPO', true)}
              </tr></thead>
              <tbody>
                {righe.map(r => (
                  <tr key={r.id} onClick={() => setAperta(r)} style={{ cursor: 'pointer' }}>
                    <td className="nm"><div className="cellname">
                      {r.thumb ? <img className="thumb" src={r.thumb} alt="" /> : <div className="thumb" />}
                      <span>{r.name}</span>
                    </div></td>
                    <td><span className={'band ' + r.bandaCls} title={r.perche || undefined}
                      data-perche={r.perche ? 1 : 0}>{r.bandaLabel}</span></td>
                    <td><span className="seg">{r.audience || '—'}</span>
                      <BarraPubblici p={r.pubblici} /></td>
                    <td className="num mono">{r.eta != null ? r.eta + 'g' : '—'}</td>
                    <td className="num mono spesa-cella">
                      {/* La barra sta DIETRO alla cifra: la concentrazione della
                          spesa è la prima cosa da vedere in una tabella lunga. */}
                      <span className="spesa-barra" style={{ width: (maxSpesa ? (r.spend || 0) / maxSpesa * 100 : 0) + '%' }} />
                      <span className="spesa-num">{eur(r.spend, 0)}</span>
                    </td>
                    <td className="num mono">{(r.impressions || 0).toLocaleString('it-IT')}</td>
                    <td className="num mono">{pct(r.ctr)}</td>
                    <td className="num mono">{eur(r.cpm, 2)}</td>
                    <td className="num mono">{eur(r.cpc, 2)}</td>
                    <td className="num mono">{num(r.frequency, 1)}</td>
                    <td className="num mono">{Math.round(r.purchases)}</td>
                    <td className="num mono">{eur(r.value, 0)}</td>
                    <td className="num mono" style={{ color: COLORE_BANDA[r.bandaLabel] || 'var(--text3)' }}>{num(r.roas)}</td>
                    <td className="num mono">{r.purchases ? eur(r.cpo, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {aperta && (
        <div className="drawer-bg" onClick={() => setAperta(null)}>
          <aside className="drawer" onClick={e => e.stopPropagation()}>
            <button className="chiudi" onClick={() => setAperta(null)} aria-label="Chiudi">✕</button>
            <Anteprima c={aperta} />
            <h2>{aperta.name}</h2>
            {aperta.perche && <p className="perche" style={{ margin: '12px 0 0' }}>
              <b>Perché {aperta.bandaLabel}:</b> {aperta.perche}
            </p>}
            <div className="riga-band">
              <span className={'band ' + aperta.bandaCls}>{aperta.bandaLabel}</span>
              <span className="seg">{aperta.audience || '—'}</span>
              <span className="seg">{aperta.eta != null ? aperta.eta + ' giorni' : ''}</span>
            </div>

            <div className="mini">
              <div><span>Spesa</span><b className="mono">{eur(aperta.spend, 0)}</b></div>
              <div><span>ROAS</span><b className="mono">{num(aperta.roas)}</b></div>
              <div><span>Acquisti</span><b className="mono">{Math.round(aperta.purchases)}</b></div>
              <div><span>CTR</span><b className="mono">{pct(aperta.ctr)}</b></div>
              <div><span>CPM</span><b className="mono">{eur(aperta.cpm, 2)}</b></div>
              <div><span>CPC</span><b className="mono">{eur(aperta.cpc, 2)}</b></div>
              <div><span>Freq.</span><b className="mono">{num(aperta.frequency, 1)}</b></div>
              <div><span>CPO</span><b className="mono">{aperta.purchases ? eur(aperta.cpo, 2) : '—'}</b></div>
            </div>

            <SpesaPerPubblico p={aperta.pubblici} />

            <h3>Testo dell'inserzione</h3>
            {aperta.headline && <><div className="et">Titolo</div><p className="copy">{aperta.headline}</p></>}
            {aperta.body && <><div className="et">Copy</div><p className="copy">{aperta.body}</p></>}
            {aperta.description && <><div className="et">Descrizione</div><p className="copy">{aperta.description}</p></>}
            {aperta.cta && <><div className="et">CTA</div><p className="copy"><span className="ctapill">{aperta.cta}</span></p></>}
            {aperta.link_url && <><div className="et">Link</div>
              <p className="copy"><a href={aperta.link_url} target="_blank" rel="noreferrer">{aperta.link_url}</a></p></>}
            {!aperta.headline && !aperta.body && !aperta.cta && !aperta.link_url &&
              <p className="copy vuoto">Testo non ancora importato: rilancia l'ingest.</p>}

            {aperta.metaAdId && <><div className="et">ID inserzione</div>
              <p className="copy mono">{aperta.metaAdId}</p></>}
          </aside>
        </div>
      )}

      {tab === 'produzione' && <Produzione prodotte={d.prodotte} elenchi={d.elenchi} ricarica={ricarica} />}
      {tab === 'analitiche' && <Analitiche q={qPeriodo} />}
      {tab === 'griglia' && <Griglia q={qPeriodo} creativita={d.righe} apriCreativita={setAperta} />}
      {/* La matrice non dipende dal periodo ne' dai KPI: e' il documento su cui
          il generatore sceglie a chi parlare (lib/matrice.js). */}
      {tab === 'matrice' && <Matrice />}
    </div>
  )
}
