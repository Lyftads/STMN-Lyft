'use client'

// ════════════════════════════════════════════════════════════════════════════
//  LA LANDING — dal 29 set 2026 e' la pagina di unitedcarriers.com col nostro prodotto dentro.
//
//  Marino: «deve essere identico ma sul nostro di prodotto». Quindi lo stesso impianto, sezione per
//  sezione: nastro in cima · apertura di notte col globo tagliato dal bordo e il titolo maiuscolo
//  gigante che entra riga per riga · l'alba (il blu che sbianca scorrendo) · l'intro a due toni coi
//  numeri grandi · la parola gigante e la scena inchiodata del prodotto · la sezione buia col
//  Cervello · la griglia con le crocette · le righe su nero per le agenzie · i prezzi · F.A.Q ·
//  contatti · chiusura ad anelli · piede col nastro. Stesso carattere largo e maiuscolo (Unbounded)
//  e mono (IBM Plex Mono), stessi colori: nero, bianco, un blu per il lampo dei titoli, l'arancio
//  solo sul globo. Le due differenze volute: il carico che attraversa la loro pagina qui e' un
//  ORDINE, e le foto sono il software vero; niente testimonianze ne' numeri di risultato inventati.
//
//  Stile in landing.module.css (il blocco «COME UNITEDCARRIERS.COM» in fondo vince sul resto);
//  testi in testi.js (cinque lingue, stesse chiavi; le parti nuove sotto t.uc).
// ════════════════════════════════════════════════════════════════════════════

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { Unbounded, IBM_Plex_Mono } from 'next/font/google'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/ui/Icon'
import LogoMark from '../components/LogoMark'
import AgencyPricing from '../components/AgencyPricing'
import { impostaTema } from '../components/AutoTheme'
import { I18nProvider, useI18n } from '../../lib/i18n/I18nProvider'
import { browserToLocale } from '../../lib/i18n/geoLocale'
import { TESTI, LINGUE } from './testi'
import { LOGHI } from './loghi'
import Immagini from './Immagini'
import { Produttivita, TempoReale } from './Squadra'
import s from './landing.module.css'
import Lenis from 'lenis'

// I caratteri dell'esempio: un grottesco largo e bold per i titoli, un mono per le etichette.
const display = Unbounded({ subsets: ['latin'], weight: ['700'], display: 'swap' })
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500'], display: 'swap' })

// Il globo (three.js, ~1,8 MB non compressi) arriva in un pezzo a parte e dopo il testo.
const Globo = dynamic(() => import('./GloboLanding'), { ssr: false, loading: () => <div className={s.globoAttesa} /> })

const NOMI_LINGUA = { it: 'Italiano', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch' }
const INTL = { it: 'it-IT', en: 'en-IE', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }
const PERCORSO = { it: '/welcome', en: '/en', es: '/es', fr: '/fr', de: '/de' }
// Le piattaforme da cui arrivano i numeri: nomi di marchi, non si traducono.
const FONTI = ['Shopify', 'Meta', 'Google Ads', 'Google Analytics 4', 'Search Console', 'Klaviyo', 'Mailchimp', 'Omnisend']
// L'icona di ogni passo del racconto (loro: le icone a matrice di punti accanto ai servizi).
const ICONE_PASSI = { productPerformance: 'euro', kpiBrain: 'gauge', attribution: 'target', budgetAdvisor: 'scale', incrContribution: 'layers', inventory: 'box', clienti: 'users', cro: 'funnel', pnl: 'file' }

// L'interruttore giorno / notte (Marino, 21 set 2026): la stessa scelta dell'app (impostaTema
// scrive 'lyft-theme' e cambia data-theme su <html>).
function Tema({ t }) {
  const [scuro, setScuro] = useState(false)
  useEffect(() => {
    const leggi = () => setScuro(document.documentElement.dataset.theme === 'dark')
    leggi()
    const mo = new MutationObserver(leggi)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => mo.disconnect()
  }, [])
  return (
    <div className={s.tema} role="group" aria-label={t.nav.tema}>
      <button type="button" aria-pressed={!scuro} aria-label={t.nav.giorno} title={t.nav.giorno} onClick={() => impostaTema('light')}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="4" /><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.5 1.5m11 11L19 19M5 19l1.5-1.5m11-11L19 5" /></svg>
      </button>
      <button type="button" aria-pressed={scuro} aria-label={t.nav.notte} title={t.nav.notte} onClick={() => impostaTema('dark')}>
        <svg aria-hidden="true" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M20.8 14.3A9 9 0 0 1 9.7 3.2 9 9 0 1 0 20.8 14.3Z" /></svg>
      </button>
    </div>
  )
}

// Le sezioni compaiono salendo, una volta sola; senza JavaScript la pagina e' tutta visibile.
function useComparsa(radice) {
  useEffect(() => {
    const el = radice.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const pezzi = [...el.querySelectorAll('[data-compare]')].filter(n => n.getBoundingClientRect().top > window.innerHeight)
    pezzi.forEach(n => n.classList.add(s.compare))
    const io = new IntersectionObserver(voci => {
      for (const v of voci) if (v.isIntersecting) { v.target.classList.add(s.visto); io.unobserve(v.target) }
    }, { rootMargin: '0px 0px -8% 0px' })
    pezzi.forEach(n => io.observe(n))
    return () => io.disconnect()
  }, [radice])
}

// Il nastro in cima (loro: le news a sinistra, due link mono a destra).
function Nastro({ t }) {
  return (
    <div className={s.ticker}>
      <span>{t.uc.ticker}</span>
      <span><Link href="/demo">{t.apertura.demo}</Link> &nbsp;|&nbsp; <Link href="/login">{t.nav.accedi}</Link></span>
    </div>
  )
}

// Le lettere che si mescolano (dalla registrazione di unitedcarriers.com, 29 set): al passaggio del
// mouse la voce si decodifica — lettere a caso che si fissano una alla volta da sinistra. Il font e'
// mono, quindi la larghezza non balla. Solo col mouse, mai per chi ha chiesto meno movimento.
const MESCOLA_SEGNI = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ##$%&'
const MESCOLA_TIMER = new WeakMap()
function mescola(e) {
  const el = e.currentTarget
  if (!window.matchMedia?.('(pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
  // Se una mescolata precedente sta ancora girando, si ferma e si riparte dal testo VERO
  // (senza questo, il testo vero catturato era quello a meta' corsa e restava sbagliato).
  const vecchio = MESCOLA_TIMER.get(el)
  if (vecchio) { clearInterval(vecchio.timer); el.textContent = vecchio.vero }
  const vero = el.textContent
  if (!vero || vero.length > 24) return
  let giro = 0
  const timer = setInterval(() => {
    giro++
    const fissi = Math.max(0, giro - 3)
    if (fissi >= vero.length) { clearInterval(timer); MESCOLA_TIMER.delete(el); el.textContent = vero; return }
    el.textContent = [...vero].map((c, i) => {
      if (c === ' ' || i < fissi) return c
      return MESCOLA_SEGNI[Math.floor(Math.random() * MESCOLA_SEGNI.length)]
    }).join('')
  }, 28)
  MESCOLA_TIMER.set(el, { timer, vero })
}

function Barra({ t, lang, scegli }) {
  const [aperto, setAperto] = useState(false)
  const voci = [['#prodotto', t.nav.prodotto], ['#agenzie', t.nav.agenzie], ['#prezzi', t.nav.prezzi], ['#domande', t.nav.domande], ['#contatti', t.contatti.etichetta]]
  return (
    <header className={s.barra}>
      <div className={`${s.largo} ${s.barraDentro}`}>
        <a href="#inizio" className={s.marchio} aria-label="LyftAI"><LogoMark size={26} withGlow={false} /> LyftAI</a>
        <nav className={s.voci} aria-label={t.nav.prodotto}>
          {voci.map(([h, l]) => <a key={h} href={h} className={s.voce} onMouseEnter={mescola}>{l}</a>)}
        </nav>
        <div className={s.destra}>
          <Tema t={t} />
          <select className={`${s.lingua} ${s.linguaBarra}`} value={lang} onChange={e => scegli(e.target.value)} aria-label={t.nav.lingua}>
            {LINGUE.map(l => <option key={l} value={l}>{NOMI_LINGUA[l]}</option>)}
          </select>
          <Link href="/register" className={`${s.btn} ${s.btnPiccolo} ${s.nascondiPiccolo}`}>{t.nav.prova}</Link>
          <button type="button" className={s.menuBtn} aria-expanded={aperto} aria-controls="menu-landing" aria-label={t.nav.menu} onClick={() => setAperto(a => !a)}>
            {aperto ? <Icon name="close" size={18} /> : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden="true"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
            )}
          </button>
        </div>
      </div>
      {aperto && (
        <nav id="menu-landing" className={s.menuAperto} onClick={e => { if (e.target.tagName !== 'SELECT') setAperto(false) }}>
          <select className={`${s.lingua} ${s.linguaMenu}`} value={lang} onChange={e => { scegli(e.target.value); setAperto(false) }} aria-label={t.nav.lingua}>
            {LINGUE.map(l => <option key={l} value={l}>{NOMI_LINGUA[l]}</option>)}
          </select>
          {voci.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
          <Link href="/login">{t.nav.accedi}</Link>
          <Link href="/register">{t.nav.prova}</Link>
        </nav>
      )}
    </header>
  )
}

// ── L'alba (Marino, 29 set 2026, da unitedcarriers.com: «quell'effetto sul blu mi piace molto»).
// L'apertura e' SEMPRE notte — spazio nero, il globo, gli ordini che si accendono — e scorrendo il
// bagliore del globo si gonfia e sbianca fino al fondo della pagina (bianco di giorno, grigio scuro
// di notte). Un numero solo, --alba da 0 a 1, letto dal CSS; qui si aggiorna una volta per
// fotogramma. Fino a meta' alba la barra in alto e' scura (data-scuro sulla pagina). Con "riduci
// movimento" niente alba: la notte finisce dove finisce la sezione, e la barra segue.
function useAlba(sezione, pagina) {
  useEffect(() => {
    const el = sezione.current, pg = pagina.current
    if (!el || !pg) return
    const calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let raf = 0
    const aggiorna = () => {
      raf = 0
      const h = el.offsetHeight || 1
      const y = window.scrollY || 0
      // L'alba avviene nella CODA della sezione (il padding in fondo, il "cielo"): comincia quando
      // il contenuto sta uscendo e finisce esatta quando il fondo della sezione tocca il fondo
      // dello schermo — cosi' il bordo fra la notte e la pagina non si vede mai.
      const coda = parseFloat(getComputedStyle(el).paddingBottom) || 1
      const inizio = Math.max(0, h - window.innerHeight - coda)
      const p = calmo ? 0 : Math.min(1, Math.max(0, (y - inizio) / coda))
      el.style.setProperty('--alba', p.toFixed(3))
      // La barra resta scura finche' in cima allo schermo c'e' ancora cielo blu.
      const scuro = y < h - window.innerHeight * 0.35
      const era = pg.dataset.scuro === '1'
      if (era !== scuro) pg.dataset.scuro = scuro ? '1' : '0'
    }
    const chiedi = () => { if (!raf) raf = requestAnimationFrame(aggiorna) }
    aggiorna()
    window.addEventListener('scroll', chiedi, { passive: true })
    window.addEventListener('resize', chiedi)
    return () => {
      window.removeEventListener('scroll', chiedi); window.removeEventListener('resize', chiedi)
      if (raf) cancelAnimationFrame(raf)
      delete pg.dataset.scuro
    }
  }, [sezione, pagina])
}


// ── Il cielo dell'apertura (Marino, 29 set: «il nero fuori dal mondo e' troppo scuro, piatto: deve
// sembrare che ci sia una costellazione»). Una tela con le stelle che brillano piano, qualche
// costellazione unita da fili sottili e le stelle piu' vicine che si spostano un poco col mouse.
// Disegna a 30 fotogrammi al secondo e solo quando si vede; per chi chiede meno movimento, una volta.
function Costellazione() {
  const tela = useRef(null)
  useEffect(() => {
    const c = tela.current
    if (!c) return
    const ctx = c.getContext('2d')
    const calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = 0, stelle = [], fili = [], raf = 0, visibile = true, ultimo = 0
    let mx = 0.5, my = 0.5, px = 0, py = 0
    const caso = (a, b) => a + Math.random() * (b - a)
    const prepara = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = c.clientWidth; H = c.clientHeight
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      stelle = Array.from({ length: Math.round(W * H / 2600) }, () => {
        const z = Math.random()
        return { x: caso(0, W), y: caso(0, H), r: z < 0.9 ? caso(0.25, 0.8) : caso(0.9, 1.6), a: caso(0.25, 0.9), f: caso(0.4, 1.6), o: caso(0, 6.28), z }
      })
      // Le costellazioni: 7 gruppi di 4-6 stelle vicine, unite in fila.
      fili = []
      for (let g = 0; g < 7; g++) {
        let x = caso(W * 0.04, W * 0.96), y = caso(H * 0.05, H * 0.9)
        const pezzi = []
        for (let i = 0, n = 4 + Math.floor(Math.random() * 3); i < n; i++) {
          const st = { x, y, r: caso(1, 1.7), a: 0.95, f: caso(0.4, 1), o: caso(0, 6.28), z: 1 }
          stelle.push(st); pezzi.push(st)
          x += caso(-110, 110); y += caso(-70, 70)
        }
        fili.push(pezzi)
      }
    }
    const disegna = (t) => {
      px += (mx - 0.5 - px) * 0.05; py += (my - 0.5 - py) * 0.05
      ctx.clearRect(0, 0, W, H)
      const sposta = st => [st.x - px * 18 * st.z, st.y - py * 12 * st.z]
      ctx.lineWidth = 0.6
      ctx.strokeStyle = 'rgba(170,190,255,.14)'
      for (const pezzi of fili) {
        ctx.beginPath()
        pezzi.forEach((st, i) => { const [x, y] = sposta(st); i ? ctx.lineTo(x, y) : ctx.moveTo(x, y) })
        ctx.stroke()
      }
      for (const st of stelle) {
        const [x, y] = sposta(st)
        const a = calmo ? st.a : st.a * (0.55 + 0.45 * Math.sin(t / 1000 * st.f + st.o))
        ctx.globalAlpha = a
        ctx.fillStyle = st.z > 0.97 ? '#dfe8ff' : '#ffffff'
        ctx.beginPath(); ctx.arc(x, y, st.r, 0, 6.2832); ctx.fill()
      }
      ctx.globalAlpha = 1
    }
    const ciclo = (t) => {
      raf = 0
      if (!visibile) return
      if (t - ultimo > 33) { ultimo = t; disegna(t) }
      raf = requestAnimationFrame(ciclo)
    }
    const muove = e => { mx = e.clientX / window.innerWidth; my = e.clientY / window.innerHeight }
    prepara(); disegna(0)
    const ro = new ResizeObserver(() => { prepara(); disegna(performance.now()) })
    ro.observe(c)
    const io = new IntersectionObserver(([v]) => { visibile = v.isIntersecting; if (visibile && !calmo && !raf) raf = requestAnimationFrame(ciclo) })
    io.observe(c)
    if (!calmo) { window.addEventListener('mousemove', muove, { passive: true }); raf = requestAnimationFrame(ciclo) }
    return () => { ro.disconnect(); io.disconnect(); window.removeEventListener('mousemove', muove); if (raf) cancelAnimationFrame(raf) }
  }, [])
  return <canvas ref={tela} className={s.costellazione} aria-hidden="true" />
}

// ── La scritta a pallini (come il logo nel piede di unitedcarriers.com): la parola e' fatta di
// puntini; passandoci sopra col mouse i puntini si aprono attorno al cursore e poi tornano al loro
// posto. Il colore e' quello del CSS (color) della tela; la parola occupa tutta la larghezza.
function ScrittaPuntini({ testo, className }) {
  const tela = useRef(null)
  useEffect(() => {
    const c = tela.current
    if (!c) return
    const ctx = c.getContext('2d')
    const calmo = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let punti = [], W = 0, H = 0, raf = 0, mx = -9999, my = -9999, colore = '#111', vivo = true, passo = 7
    const prepara = async () => {
      try { await document.fonts.ready } catch {}
      if (!vivo) return
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      W = c.clientWidth
      passo = W < 700 ? 4 : 7
      const famiglia = getComputedStyle(c).fontFamily
      ctx.font = `700 100px ${famiglia}`
      const larga = ctx.measureText(testo).width || 1
      const corpo = Math.floor(100 * W / larga)
      H = Math.round(corpo * 0.78)
      c.style.height = H + 'px'
      c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      colore = getComputedStyle(c).color
      const off = document.createElement('canvas'); off.width = W; off.height = H
      const o = off.getContext('2d')
      o.font = `700 ${corpo}px ${famiglia}`; o.textBaseline = 'alphabetic'; o.fillStyle = '#000'
      o.fillText(testo, 0, Math.round(H * 0.94))
      const dati = o.getImageData(0, 0, W, H).data
      punti = []
      for (let y = Math.floor(passo / 2); y < H; y += passo) for (let x = Math.floor(passo / 2); x < W; x += passo) {
        if (dati[(y * W + x) * 4 + 3] > 128) punti.push({ ox: x, oy: y, x, y, vx: 0, vy: 0 })
      }
      disegna()
    }
    const disegna = () => {
      ctx.clearRect(0, 0, W, H)
      ctx.fillStyle = colore
      const r = passo * 0.34
      ctx.beginPath()
      for (const p of punti) { ctx.moveTo(p.x + r, p.y); ctx.arc(p.x, p.y, r, 0, 6.2832) }
      ctx.fill()
    }
    const passo1 = () => {
      raf = 0
      const R = Math.max(70, W * 0.06), R2 = R * R
      let fermo = true
      for (const p of punti) {
        const dx = p.x - mx, dy = p.y - my, d2 = dx * dx + dy * dy
        if (d2 < R2) { const d = Math.sqrt(d2) || 1, f = (1 - d / R) * 2.6; p.vx += dx / d * f; p.vy += dy / d * f }
        p.vx += (p.ox - p.x) * 0.06; p.vy += (p.oy - p.y) * 0.06
        p.vx *= 0.82; p.vy *= 0.82
        p.x += p.vx; p.y += p.vy
        if (Math.abs(p.vx) + Math.abs(p.vy) > 0.05 || Math.abs(p.x - p.ox) + Math.abs(p.y - p.oy) > 0.3) fermo = false
      }
      disegna()
      if (!fermo) raf = requestAnimationFrame(passo1)
    }
    const muove = e => {
      if (calmo) return
      const b = c.getBoundingClientRect(); mx = e.clientX - b.left; my = e.clientY - b.top
      if (!raf) raf = requestAnimationFrame(passo1)
    }
    const esce = () => { mx = -9999; my = -9999; if (!raf) raf = requestAnimationFrame(passo1) }
    prepara()
    const ro = new ResizeObserver(() => { if (Math.abs(c.clientWidth - W) > 2) prepara() })
    ro.observe(c)
    c.addEventListener('mousemove', muove); c.addEventListener('mouseleave', esce)
    const mo = new MutationObserver(() => { colore = getComputedStyle(c).color; disegna() })
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => { vivo = false; ro.disconnect(); mo.disconnect(); c.removeEventListener('mousemove', muove); c.removeEventListener('mouseleave', esce); if (raf) cancelAnimationFrame(raf) }
  }, [testo])
  return <canvas ref={tela} className={`${s.puntini} ${className || ''}`} role="img" aria-label={testo} />
}

// Il titolo a macchina da scrivere (Marino, 21 set; richiesto di nuovo il 29 set): «Quanto» resta,
// il resto si scrive e si cancella a turno. Tutte le frasi stanno invisibili nella stessa cella,
// cosi' il titolo ha gia' l'altezza della piu' lunga e sotto non salta niente.
function Macchina({ prima, oggetti }) {
  const [n, setN] = useState(0)
  const [lettere, setLettere] = useState(oggetti[0].length)
  const [cancella, setCancella] = useState(false)
  useEffect(() => { setN(0); setLettere(oggetti[0].length); setCancella(false) }, [oggetti])
  useEffect(() => {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const frase = oggetti[n]
    let t
    if (!cancella && lettere < frase.length) t = setTimeout(() => setLettere(l => l + 1), 55)
    else if (!cancella) t = setTimeout(() => setCancella(true), 2600)
    else if (lettere > 0) t = setTimeout(() => setLettere(l => l - 1), 24)
    else t = setTimeout(() => { setCancella(false); setN(x => (x + 1) % oggetti.length) }, 300)
    return () => clearTimeout(t)
  }, [n, lettere, cancella, oggetti])
  return (
    <span className={s.macchina} aria-hidden="true">
      {oggetti.map(o => <span key={o} className={s.macchinaMisura}>{prima}{o}</span>)}
      <span className={s.macchinaViva}>{prima}{oggetti[n].slice(0, lettere)}<span className={s.cursore} /></span>
    </span>
  )
}

// L'apertura, identica alla loro: il nastro, l'etichetta bold, il titolo maiuscolo in tre righe che
// entrano dal basso col lampo blu, la riga di testo, i due bottoni a pillola; il globo grande a
// destra, tagliato dal bordo; sotto, la coda di cielo dove avviene l'alba (useAlba).
function Apertura({ t, lang, pagina }) {
  const a = t.apertura
  const sezione = useRef(null)
  useAlba(sezione, pagina)
  return (
    <section id="inizio" ref={sezione} className={s.apertura}>
      <Costellazione />
      {/* La mezza luna (unitedcarriers.com, 29 set): il bordo del pianeta, enorme e curvo, con
          l'atmosfera blu sotto. Sta ferma nella coda della sezione: scorrendo sale e porta il giorno. */}
      <div className={s.luna} aria-hidden="true" />
      <Nastro t={t} />
      <div className={`${s.largo} ${s.aperturaGriglia}`}>
        <div className={s.aperturaTesto}>
          <p className={s.etichetta}>{t.uc.eyebrow}</p>
          <h1 className={s.h1}><span className={s.soloLettori}>{a.titolo}</span><Macchina prima={a.titoloPrima} oggetti={a.oggetti} /></h1>
          <p className={s.sotto}>{a.sotto}</p>
          <div className={s.azioni}>
            <Link href="/register" className={s.btn}>{a.prova}</Link>
            <Link href="/demo" className={s.btnVuoto}>{a.demo}</Link>
          </div>
        </div>
        <div className={s.aperturaGlobo}><Globo testi={a.globo} lingua={INTL[lang]} /></div>
      </div>
    </section>
  )
}

// L'intro (loro: WE MOVE FREIGHT. / WE OWN THE OUTCOME. con la foto piccola e i tre numeri grandi):
// la foto e' la Dashboard vera; i numeri sono fatti del prodotto, contati dai dizionari, non risultati.
function Intro({ t, lang }) {
  const u = t.uc
  const numeri = [[FONTI.length, u.statFonti, u.statFontiDesc], [LINGUE.length, u.statLingue, u.statLingueDesc], [t.tutto.aree.length, u.statAree, u.statAreeDesc]]
  return (
    <section className={s.intro}>
      <div className={`${s.largo} ${s.introGriglia}`}>
        <div className={s.introSinistra}>
          <div className={s.introVista} data-tappa="dashboard"><Immagini lang={lang} id="dashboard" alt={t.apertura.alt} /></div>
          <h2 className={`${s.titolone}`}><span className={s.grigio}>{u.intro1}</span>{u.intro2}</h2>
        </div>
        <div>
          <p className={s.introTesto} data-compare>{t.apertura.sotto}</p>
          <div className={s.azioni} style={{ justifyContent: 'flex-start', marginTop: 40 }}><a href="#prodotto" className={s.btnVuoto}>{u.introCta}</a></div>
          <p className={s.introNota}>{u.introNota}</p>
          {numeri.map(([n, l, d]) => (
            <div key={l} className={s.stat} data-compare>
              <strong className={s.cifra}>{n}</strong>
              <div><p className={s.statTitolo}>{l}</p><p className={s.statTesto}>{d}</p></div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// Da dove vengono i numeri: la griglia con le crocette agli angoli, come i loro partner.
function Fonti({ t }) {
  return (
    <section className={s.fonti} aria-label={t.fonti.etichetta}>
      <div className={s.largo}>
        <p className={s.etichetta}>{t.fonti.etichetta}</p>
        <div className={s.fontiGriglia}>
          {FONTI.map(f => (
            <span key={f} className={s.fonte}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" fillRule="evenodd"><path d={LOGHI[f]} /></svg>{f}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}


// ── IL FILM (29 set, v3) — «deve sembrare un vero film... si deve avvolgere all'indietro».
// Tre ATTI a tutto schermo, girati con Higgsfield e SCRUBBATI dalla rotella: il video non va in
// play, e' la rotella che lo fa scorrere (currentTime ∝ --vp), avanti e indietro come una moviola.
//   Atto 1 · CIELO: nuvole dall'alto (video), l'aereo (foto ritagliata) attraversa col fascio arancio.
//   Atto 2 · STRADA: il camion viaggia visto dall'alto (video) — l'ordine e' a bordo.
//   Atto 3 · MAGAZZINO: il nastro trasportatore vero (video), il pacco (foto) trascinato sul nastro.
// Le stazioni del software sono un HUD in spazio-schermo (mai coperte, per costruzione): dentro ci
// sono il video-ad Meta VERO che gira e le foto prodotto vere del catalogo PMax. Le etichette dei
// conti si accumulano in una fila in basso. Il contatore del margine scala in corsa.
// Telefono: niente video scrubbati (batteria): gli atti sono le foto, il resto e' identico.
const VIAGGIO_ATTI = [
  { id: 'cielo', da: 0, a: 0.26 },
  { id: 'strada', da: 0.24, a: 0.5 },
  { id: 'magazzino', da: 0.48, a: 1.001 },
]
const VIAGGIO_DOCK = [
  { id: 'ordine', testo: '€96', logo: 'Shopify', at: 0.38 },
  { id: 'margine', testo: null, logo: null, at: 0.5 },
  { id: 'meta', testo: 'ROAS 3,1×', logo: 'Meta', at: 0.62 },
  { id: 'pmax', testo: 'PMax 4,2×', logo: 'Google Ads', at: 0.73 },
  { id: 'ebit', testo: 'EBIT €19k', logo: null, at: 0.83 },
]
const CONTI_ETICHETTA = (t) => (t.blocchi.find(b => b.id === 'pnl') || {}).etichetta || 'P&L'
function Viaggio({ t }) {
  const sez = useRef(null)
  const conta = useRef(null)
  const contaLbl = useRef(null)
  const margineTxt = useRef('')
  const video = useRef([])
  const caricato = useRef(false)
  useEffect(() => {
    const el = sez.current
    if (!el) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const mobile = !window.matchMedia('(min-width: 861px)').matches
    // I video si caricano solo quando il film si avvicina (250% di schermo prima).
    const io = new IntersectionObserver(([v]) => {
      if (!v.isIntersecting || caricato.current) return
      caricato.current = true
      video.current.forEach(vd => { if (vd && vd.dataset.src) { vd.preload = 'auto'; vd.src = vd.dataset.src; vd.load() } })
      io.disconnect()
    }, { rootMargin: '250% 0px' })
    if (!mobile) io.observe(el)
    let raf = 0
    const aggiorna = () => {
      raf = 0
      const r = el.getBoundingClientRect()
      const tot = el.offsetHeight - window.innerHeight
      const p = tot > 0 ? Math.min(1, Math.max(0, -r.top / tot)) : 0
      el.style.setProperty('--vp', p.toFixed(4))
      if (conta.current) {
        // fino alla strada e' il valore dell'ORDINE; nel magazzino diventa il margine e scala
        const q = Math.min(1, Math.max(0, (p - 0.5) / 0.1))
        conta.current.textContent = '€' + Math.round(96 - q * 58)
        if (contaLbl.current) contaLbl.current.textContent = p < 0.5 ? 'ORDINE #4126' : margineTxt.current
      }
      // la moviola: ogni atto scorre il SUO video, avanti e indietro con la rotella
      if (!mobile) VIAGGIO_ATTI.forEach((a, i) => {
        const vd = video.current[i]
        if (!vd || !vd.duration || p < a.da - 0.06 || p > a.a + 0.06) return
        const q = Math.min(1, Math.max(0, (p - a.da) / (a.a - a.da)))
        const tempo = q * (vd.duration - 0.08)
        if (Math.abs((vd.currentTime || 0) - tempo) > 0.02) { try { vd.currentTime = tempo } catch {} }
      })
    }
    const chiedi = () => { if (!raf) raf = requestAnimationFrame(aggiorna) }
    aggiorna()
    window.addEventListener('scroll', chiedi, { passive: true })
    window.addEventListener('resize', chiedi)
    return () => { window.removeEventListener('scroll', chiedi); window.removeEventListener('resize', chiedi); io.disconnect(); if (raf) cancelAnimationFrame(raf) }
  }, [])
  const v = t.viaggio
  margineTxt.current = v.margineP
  return (
    <section ref={sez} className={s.viaggio}>
      <div className={s.viaggioFermo}>
        <div className={s.viaggioParola} aria-hidden="true">{v.parola}</div>
        {/* ── SCENA v5: oggetti VERI ritagliati su BIANCO (dai fotogrammi di UC) ──
            Atto 1: le nuvole si sciolgono nel bianco della pagina, l'aereo GRANDE la attraversa.
            Atto 2: strada DISEGNATA (banda scura con la mezzeria che scorre) + camion vero dall'alto.
            Atto 3: nastro trasportatore vero che CAMMINA (la trama scorre), pacco sopra, scaffali
            veri intorno — niente pavimento: intorno c'e' il bianco del sito. */}
        <div className={s.cieloVelo} aria-hidden="true">
          <video ref={el => { video.current[0] = el }} data-src="/landing/scena/cielo.mp4" poster="/landing/scena/nuvole.webp" muted playsInline preload="none" tabIndex={-1} />
          <img src="/landing/scena/nuvole.webp" alt="" loading="lazy" decoding="async" />
        </div>
        <div className={s.stradaDisegno} aria-hidden="true"><i /></div>
        <img className={s.camionTop} src="/landing/scena/camion.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <div className={s.nastroTop} aria-hidden="true" />
        <img className={`${s.rackProp} ${s.rack1}`} src="/landing/scena/rack-a.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className={`${s.rackProp} ${s.rack2}`} src="/landing/scena/rack-b.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className={`${s.rackProp} ${s.rack3}`} src="/landing/scena/rack-b.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className={`${s.rackProp} ${s.rack4}`} src="/landing/scena/rack-a.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className={s.paccoProp} src="/landing/scena/pacco.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <div className={s.largo}>
          <div className={`${s.viaggioTesta} ${s.testaFilm}`}>
            <p className={s.etichetta}>{t.nav.prodotto}</p>
            <h2 className={s.h2}>{v.titolo}</h2>
            <p className={s.sotto}>{v.sotto}</p>
          </div>
        </div>
        {/* L'aereo grande e le nuvole in primo piano: sopra il titolo, come nel loro fotogramma. */}
        <img className={s.aereoGrande} src="/landing/scena/aereo.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        <img className={s.nuvolaFronte} src="/landing/scena/nuvola-b.webp" alt="" aria-hidden="true" loading="lazy" decoding="async" />
        {/* Le DESCRIZIONI delle funzionalita' accanto alla scena (dallo screen di UC: etichetta,
            titolo grande, testo e punti — non solo i popup): sono i blocchi del racconto, gia'
            tradotti in 5 lingue. Una per il camion, due per il nastro. */}
        {[
          { id: 'productPerformance', da: 0.27, a: 0.51, destra: true },
          { id: 'attribution', da: 0.55, a: 0.72, destra: false },
          { id: 'pnl', da: 0.75, a: 0.95, destra: true },
        ].map(d => {
          const b = t.blocchi.find(x => x.id === d.id)
          if (!b) return null
          return (
            <div key={d.id} className={`${s.descFilm} ${d.destra ? s.descDestra : s.descSinistra}`} style={{ '--da': d.da, '--fine': d.a }}>
              <p className={s.etichetta}>{b.etichetta}</p>
              <h3 className={s.descTitolo}>{b.titolo}</h3>
              <p className={s.descTesto}>{b.testo}</p>
              <ul className={s.descPunti}>
                {(b.punti || []).slice(0, 2).map(([forte, resto]) => <li key={forte}><strong>{forte}</strong> {resto}</li>)}
              </ul>
            </div>
          )
        })}
        {/* L'HUD: contatore, stazioni, etichette. Spazio-schermo: niente puo' coprirlo. */}
        <div className={s.hud} aria-hidden="true">
          <div className={s.viaggioContatore}><span ref={contaLbl}>ORDINE #4126</span><strong ref={conta}>€96</strong></div>
          <div className={`${s.hudScheda} ${s.stazioneScheda}`} style={{ '--at': 0.3, '--lato': 0 }}>
            <p className={s.stazioneTitolo}><svg viewBox="0 0 24 24" width="13" height="13" fill="#95bf47" aria-hidden="true"><path d={LOGHI['Shopify']} /></svg> {t.apertura.globo.nuovo}</p>
            <div className={s.stazioneRiga}><span>ORDINE #4126</span><strong>€96</strong></div>
            <div className={s.stazioneRiga}><span>{t.apertura.globo.ordini}</span><strong>27 → 28</strong></div>
          </div>
          <div className={`${s.hudScheda} ${s.stazioneScheda}`} style={{ '--at': 0.42, '--lato': 1 }}>
            <p className={s.stazioneTitolo}><Icon name="euro" size={13} /> {t.filo.productPerformance}</p>
            <div className={s.stazioneRiga}><span>{v.prezzo}</span><strong>€96</strong></div>
            <div className={s.stazioneRiga}><span>{v.iva}</span><strong>−€17</strong></div>
            <div className={s.stazioneRiga}><span>{v.costo} + Ads</span><strong>−€41</strong></div>
            <div className={s.stazioneRiga + ' ' + s.stazioneTotale}><span>{v.margineP}</span><strong>€38</strong></div>
          </div>
          <div className={`${s.hudScheda} ${s.stazioneScheda} ${s.schedaAnnuncio}`} style={{ '--at': 0.54, '--lato': 1 }}>
            <p className={s.stazioneTitolo}><svg viewBox="0 0 24 24" width="13" height="13" fill="currentColor" aria-hidden="true"><path d={LOGHI['Meta']} /></svg> {t.filo.attribution}</p>
            {/* il video-ad VERO: questo gira da solo, e' un contenuto dentro al film */}
            <div className={s.adVideo}><video src="/landing/scena/meta-ad.mp4" poster="/landing/scena/meta-creative.webp" muted playsInline autoPlay loop preload="metadata" tabIndex={-1} /><span>Prospecting – Video</span></div>
            <div className={s.stazioneRiga}><span>ROAS</span><strong className={s.su}>3,1×</strong></div>
            <div className={s.stazioneRiga}><span>CPC</span><strong>€0,42</strong></div>
          </div>
          <div className={`${s.hudScheda} ${s.stazioneScheda} ${s.schedaAnnuncio}`} style={{ '--at': 0.68, '--lato': 1 }}>
            <p className={s.stazioneTitolo}><svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor" aria-hidden="true"><path d={LOGHI['Google Ads']} /></svg> {v.google}</p>
            <div className={s.adCatalogo}>
              <i style={{ backgroundImage: 'url(/landing/scena/prod-scarpe.webp)' }}><b>€96</b></i>
              <i style={{ backgroundImage: 'url(/landing/scena/prod-borsone.webp)' }}><b>€59</b></i>
              <i style={{ backgroundImage: 'url(/landing/scena/prod-felpa.webp)' }}><b>€120</b></i>
            </div>
            <div className={s.stazioneRiga}><span>ROAS</span><strong className={s.su}>4,2×</strong></div>
          </div>
          <div className={`${s.hudScheda} ${s.stazioneScheda}`} style={{ '--at': 0.76, '--lato': 0 }}>
            <p className={s.stazioneTitolo}><Icon name="file" size={13} /> {CONTI_ETICHETTA(t)}</p>
            <div className={s.stazioneRiga}><span>{v.ricavi}</span><strong>€55.298</strong></div>
            <div className={s.stazioneRiga}><span>COGS + Ads</span><strong>−€35.983</strong></div>
            <div className={s.stazioneRiga + ' ' + s.stazioneTotale}><span>EBIT</span><strong className={s.su}>€19.315</strong></div>
          </div>
          <div className={`${s.hudScheda} ${s.stazioneScheda}`} style={{ '--at': 0.87, '--lato': 1, '--resta': 1 }}>
            <p className={s.stazioneTitolo}><Icon name="chat" size={13} /> {t.filo.ai}</p>
            <div className={s.stazioneChat}>«{v.margineP} €38 · MER 3,6×»</div>
            <div className={s.stazioneRiga}><span>{t.ai.etichetta}</span><strong>online</strong></div>
          </div>
          <div className={s.dock}>
            {VIAGGIO_DOCK.map(c => (
              <em key={c.id} style={{ '--at': c.at }}>
                {c.logo && <svg viewBox="0 0 24 24" width="11" height="11" fill="currentColor" aria-hidden="true"><path d={LOGHI[c.logo]} /></svg>}
                {c.testo || v.margine}
              </em>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

// Il prodotto (loro: la parola SERVICES gigante, poi la scena inchiodata col titolo a sinistra, la
// strada al centro e le schede a destra): qui la parola e' PRODOTTO, al centro c'e' lo schermo del
// software che cambia foto, a destra i nove passi con l'icona, il nome e una riga.
function Prodotto({ t, lang }) {
  const u = t.uc
  const [attivo, setAttivo] = useState(0)
  const passi = useRef([])
  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(voci => {
      for (const v of voci) if (v.isIntersecting) setAttivo(Number(v.target.dataset.i))
    }, { rootMargin: '-45% 0px -45% 0px' })
    passi.current.forEach(el => el && io.observe(el))
    return () => io.disconnect()
  }, [t])
  return (
    <section id="prodotto" className={s.sezione} style={{ paddingTop: 0 }}>
      <div className={`${s.largo} ${s.parola}`}><ScrittaPuntini testo={u.parola.toUpperCase()} /></div>
      <div className={`${s.largo} ${s.racconto3}`}>
        {/* Fermo mentre scorrono i passi a destra (Marino, 29 set): il titolo e lo schermo, che cambia foto a ogni passo. */}
        <div className={s.raccontoFermo}>
          <div className={s.raccontoTesta}>
            <h2 className={s.titoloProdotto}><span className={s.grigio}>{u.prodotto1}</span>{u.prodotto2}</h2>
            <p className={s.testo}>{u.prodottoTesto}</p>
          </div>
          <div className={s.cornice}>
            <div className={s.schermoFoto}>
              {t.blocchi.map((b, i) => (
                <Immagini key={b.id} lang={lang} id={b.id} alt={b.alt} className={i === attivo ? s.fotoAttiva : ''} />
              ))}
            </div>
          </div>
        </div>
        <div className={s.passi}>
          {t.blocchi.map((b, i) => (
            <div key={b.id} ref={el => { passi.current[i] = el }} data-i={i} className={`${s.passo} ${i === attivo ? s.passoAttivo : ''}`}>
              <Icon name={ICONE_PASSI[b.id] || 'grid'} size={34} className={s.passoIcona} />
              <p className={s.etichetta} data-tappa={b.id}>{b.etichetta}</p>
              <p className={s.testo}>{b.testo}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

// La chat che si scrive da sola: la domanda, "sta scrivendo…", la risposta parola per parola.
function ChatDemo({ t }) {
  const c = t.ai.chat
  const radice = useRef(null)
  const [n, setN] = useState(0)
  const [fase, setFase] = useState('fatto')
  const [parole, setParole] = useState(9999)
  const [visibile, setVisibile] = useState(false)
  useEffect(() => {
    const el = radice.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([v]) => setVisibile(v.isIntersecting), { threshold: 0.35 })
    io.observe(el)
    return () => io.disconnect()
  }, [])
  useEffect(() => {
    if (!visibile) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    let vivo = true
    const timer = []
    const dopo = (ms, fn) => timer.push(setTimeout(() => vivo && fn(), ms))
    const risposta = c.scambi[n].r.split(' ')
    setFase('domanda'); setParole(0)
    dopo(700, () => setFase('scrive'))
    dopo(1900, () => {
      setFase('risponde')
      risposta.forEach((_, i) => dopo(i * 45, () => setParole(i + 1)))
      dopo(risposta.length * 45 + 4200, () => setN(x => (x + 1) % c.scambi.length))
    })
    return () => { vivo = false; timer.forEach(clearTimeout) }
  }, [n, visibile, c])
  const sc = c.scambi[n]
  const testo = sc.r.split(' ').slice(0, parole).join(' ')
  return (
    <div ref={radice} className={s.chat} aria-live="off">
      <div className={s.chatTesta} data-tappa="ai"><span className={s.chatPunto} />{t.ai.etichetta} · {c.negozio}</div>
      <div className={s.chatCorpo}>
        <p key={'d' + n} className={s.chatDomanda}>{sc.d}</p>
        {fase === 'scrive' && <p className={s.chatScrive}>{c.scrive}</p>}
        {(fase === 'risponde' || fase === 'fatto') && <p key={'r' + n} className={s.chatRisposta}>{fase === 'fatto' ? sc.r : testo}</p>}
      </div>
    </div>
  )
}

// La sezione buia (loro: la nave sull'oceano coi quattro benefici attorno): il Cervello al centro,
// le sue tre voci attorno, il titolo maiuscolo bianco sopra.
function Cervello({ t }) {
  const a = t.ai
  const icone = ['chat', 'bulb', 'users']
  const Voce = ({ v, i }) => (
    <div className={s.buioVoce} data-compare>
      <Icon name={icone[i]} size={28} />
      <h3 className={s.h3}>{v.titolo}</h3>
      <p className={s.testo}>{v.testo}</p>
    </div>
  )
  return (
    <section className={s.buio}>
      <div className={s.largo}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h2 className={s.h2}>{a.titolo}</h2>
        </div>
        <div className={s.buioGriglia}>
          <div><Voce v={a.voci[0]} i={0} /><div style={{ height: 48 }} /><Voce v={a.voci[1]} i={1} /></div>
          <div data-compare><ChatDemo t={t} /></div>
          <div className={s.buioDestra}><Voce v={a.voci[2]} i={2} /></div>
        </div>
      </div>
    </section>
  )
}

// Tutto quello che c'e': la griglia coi puntini agli angoli, come i loro partner.
function Tutto({ t }) {
  const a = t.tutto
  return (
    <section id="tutto" className={s.sezione}>
      <div className={s.largo}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h2 className={s.h2}>{a.titolo}</h2>
          <p className={s.sotto}>{a.sotto}</p>
        </div>
        <div className={s.crocette}>
          <div className={s.crocetteTesta}><span>{t.uc.tuttoRiga}</span><b>{t.uc.aree}</b></div>
          {a.aree.map(ar => (
            <div key={ar.titolo} className={s.cella}>
              <h3 className={s.h3}><Icon name={ar.icona} size={18} />{ar.titolo}</h3>
              <ul>{ar.voci.map(v => <li key={v}>{v}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className={s.nota} style={{ maxWidth: 720, margin: '28px 0 0' }} data-compare>
          <strong style={{ color: 'var(--testo)', fontWeight: 600 }}>{a.rivenditori.titolo}.</strong> {a.rivenditori.testo}
        </p>
      </div>
    </section>
  )
}

// Per le agenzie: su nero, a righe con l'etichetta mono a destra, come i loro Insights.
function Agenzie({ t, vai }) {
  const a = t.agenzie
  return (
    <section id="agenzie" className={s.nero}>
      <div className={`${s.largo} ${s.neroGriglia}`}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h2 className={s.h2}>{a.titolo}</h2>
          <p className={s.sotto}>{a.sotto}</p>
          <div className={`${s.azioni} ${s.azioniSinistra}`}>
            <a href="#prezzi" className={s.btn} onClick={() => vai('agenzie')}>{a.cta}</a>
          </div>
        </div>
        <div className={s.righe} data-compare>
          {a.voci.map((v, i) => (
            <div key={v.titolo} className={s.rigaNera}>
              <div><h3 className={s.h3}>{v.titolo}</h3><p className={s.testo}>{v.testo}</p></div>
              <span className={s.rigaTag}>{String(i + 1).padStart(2, '0')} · {a.etichetta}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function Prezzi({ t, lang, pubblico, setPubblico }) {
  const p = t.prezzi
  const [cadenza, setCadenza] = useState('annuale')
  const annuale = cadenza === 'annuale'
  // Come nel prodotto: «€149», col simbolo davanti, in ogni lingua.
  const euro = n => '€' + new Intl.NumberFormat(INTL[lang], { maximumFractionDigits: 0, useGrouping: 'always' }).format(n)
  return (
    <section id="prezzi" className={s.sezione}>
      <div className={s.largo}>
        <div className={s.testaSezione}>
          <p className={s.etichetta}>{p.etichetta}</p>
          <h2 className={s.h2}>{p.titolo}</h2>
          <p className={s.sotto}>{pubblico === 'agenzie' ? p.agenzieSotto : p.sotto}</p>
        </div>
        <div className={s.comandi}>
          <div className={s.scelta} role="group" aria-label={p.etichetta}>
            {[['brand', p.pubblico.brand], ['agenzie', p.pubblico.agenzie]].map(([id, l]) => (
              <button key={id} type="button" aria-pressed={pubblico === id} onClick={() => setPubblico(id)}>{l}</button>
            ))}
          </div>
          {pubblico === 'brand' && (
            <div className={s.scelta} role="group" aria-label={`${p.cadenza.mensile} / ${p.cadenza.annuale}`}>
              <button type="button" aria-pressed={!annuale} onClick={() => setCadenza('mensile')}>{p.cadenza.mensile}</button>
              <button type="button" aria-pressed={annuale} onClick={() => setCadenza('annuale')}>{p.cadenza.annuale} <span className={s.sconto}>{p.dueMesi}</span></button>
            </div>
          )}
        </div>
        {pubblico === 'agenzie' ? (
          // Lo stesso listino dell'app, nella lingua scelta QUI (non in quella salvata per l'app).
          <I18nProvider key={lang} initialLocale={lang}><AgencyPricing /></I18nProvider>
        ) : (
          <>
            <p className={s.avviso}>{p.garanzia}<br />{p.founder}</p>
            <div className={s.piani}>
              {p.piani.map(pi => {
                // Annuale = due mesi gratis: dieci mensilita' su dodici. L'Enterprise ha un prezzo fisso.
                const sconta = annuale && pi.id !== 'enterprise'
                const mese = sconta ? Math.round(pi.prezzo * 10 / 12) : pi.prezzo
                return (
                  <div key={pi.id} className={`${s.piano} ${pi.forte ? s.pianoForte : ''}`}>
                    <div className={s.pianoNome}>
                      <h3 className={s.h3}>{pi.nome}</h3>
                      {pi.forte && <span className={s.pianoBadge}>{pi.forte}</span>}
                    </div>
                    <div className={s.prezzo}><span className={s.prezzoCifra}>{euro(mese)}</span><span className={s.nota}>{p.alMese}</span></div>
                    <div className={s.prezzoPrima}>
                      {sconta && <><del>{euro(pi.prezzo)}</del> · {euro(mese * 12)} {p.fatturato}, {p.risparmi} {euro((pi.prezzo - mese) * 12)}</>}
                    </div>
                    <p className={s.pianoRiga}>{pi.riga}</p>
                    <ul>{pi.voci.map(v => <li key={v}><Icon name="check" size={14} /><span>{v}</span></li>)}</ul>
                    <Link href="/register" className={pi.forte ? s.btn : s.btnVuoto}>{pi.cta}</Link>
                  </div>
                )
              })}
            </div>
          </>
        )}
      </div>
    </section>
  )
}


function Domande({ t }) {
  const d = t.domande
  return (
    <section id="domande" className={s.sezione}>
      <div className={`${s.largo} ${s.faqGriglia}`}>
        <div className={s.testaFerma}>
          <h2 className={s.faqTitolo}>{t.uc.faq}</h2>
          <p className={s.sotto} style={{ marginTop: 0, fontSize: 17 }}>{d.titolo}</p>
        </div>
        <div className={s.domande}>
          {d.voci.map((v, i) => (
            <details key={v.q} className={s.domanda}>
              <summary><span className={s.domandaNumero}>{String(i + 1).padStart(2, '0')}</span><span className={s.domandaTesto}>{v.q}</span><Icon name="plus" size={18} /></summary>
              <p>{v.a}</p>
            </details>
          ))}
        </div>
        <div>
          <p className={s.faqAiuto}>{t.uc.faqAiuto}</p>
          <a href="#contatti" className={s.voce} style={{ color: 'var(--testo)' }}>{t.uc.faqCta} →</a>
        </div>
      </div>
    </section>
  )
}

function Chiusura({ t }) {
  const c = t.chiusura
  return (
    <section className={s.chiusura}>
      <div className={s.anelli} aria-hidden="true" />
      <div className={`${s.largo} ${s.chiusuraDentro}`} data-compare>
        <h2 className={s.h2}>{c.titolo}</h2>
        <p className={s.sotto}>{c.sotto}</p>
        <div className={s.azioni}>
          <Link href="/register" className={s.btn}>{c.prova}</Link>
          <Link href="/demo" className={s.btnVuoto}>{c.demo}</Link>
        </div>
      </div>
    </section>
  )
}

// Il piede (loro: colonne, il nastro che scorre con la pillola INDUSTRIES / SERVICES, la sede):
// qui il nastro sono le voci delle aree del prodotto.
function Piede({ t }) {
  const p = t.piede
  const voci = t.tutto.aree.flatMap(a => a.voci)
  return (
    <footer className={s.piede}>
      <div className={s.largo}>
        <div className={s.piedeGriglia}>
          <div>
            <div className={s.marchio}><LogoMark size={24} withGlow={false} /> LyftAI</div>
            <p className={s.nota} style={{ marginTop: 12, maxWidth: 300 }}>{p.tagline}</p>
          </div>
          <div>
            <p className={s.piedeTitolo}>{p.prodotto}</p>
            <ul>
              <li><a href="#prodotto">{t.nav.prodotto}</a></li>
              <li><a href="#prezzi">{t.nav.prezzi}</a></li>
              <li><Link href="/demo">{t.chiusura.demo}</Link></li>
              <li><Link href="/login">{t.nav.accedi}</Link></li>
            </ul>
          </div>
          <div>
            <p className={s.piedeTitolo}>{p.azienda}</p>
            <ul className={s.nota} style={{ gap: 4 }}>
              <li>LYFT SRL</li>
              <li>Via Corso Giuseppe Mazzini 223</li>
              <li>San Benedetto del Tronto (AP) 63074</li>
              <li>P. IVA: 02600730440</li>
            </ul>
          </div>
          <div>
            <p className={s.piedeTitolo}>{p.legale}</p>
            <ul>
              <li><Link href="/privacy">{p.privacy}</Link></li>
              <li><Link href="/terms">{p.termini}</Link></li>
              <li><Link href="/dpa">{p.dpa}</Link></li>
            </ul>
          </div>
        </div>
        <div className={s.piedeNastro} aria-hidden="true">
          <div className={s.piedePillola}><span>{t.uc.nastro}</span><span>{t.uc.aree}</span></div>
          <div className={s.piedeNastroScorre}>{[...voci, ...voci].map((v, i) => <span key={i}>{v}</span>)}</div>
        </div>
        <div className={s.piedeLogo}><ScrittaPuntini testo="LYFTAI" /></div>
        <div className={`${s.piedeSotto} ${s.nota}`}>
          <span>© {new Date().getFullYear()} LYFT SRL. {p.diritti}</span>
        </div>
      </div>
    </footer>
  )
}

function Contatti({ t, lang }) {
  const c = t.contatti
  const [dati, setDati] = useState({ name: '', company: '', email: '', phone: '', website: '', revenue: '', message: '' })
  const [invio, setInvio] = useState(false)
  const [fatto, setFatto] = useState(false)
  const [errore, setErrore] = useState(null)
  const metti = (k, v) => setDati(d => ({ ...d, [k]: v }))

  const invia = async (e) => {
    e.preventDefault()
    setErrore(null)
    if (!dati.name || !dati.email || !dati.company) { setErrore(c.richiesti); return }
    setInvio(true)
    try {
      const r = await fetch('/api/contact', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...dati, lang }) })
      const j = await r.json().catch(() => ({}))
      if (!r.ok || j?.error) throw new Error(j?.error || `HTTP ${r.status}`)
      setFatto(true)
    } catch (err) {
      setErrore(err?.message || 'Error')
    } finally {
      setInvio(false)
    }
  }

  return (
    <section id="contatti" className={s.sezione}>
      <div className={`${s.largo} ${s.divisa}`}>
        <div className={`${s.testaSezione} ${s.testaFerma}`}>
          <p className={s.etichetta}>{c.etichetta}</p>
          <h2 className={`${s.h2} ${s.acceso}`}>{c.titolo}</h2>
          <p className={s.sotto}>{c.sotto}</p>
        </div>
        {fatto ? (
          <div className={s.fatto} role="status">
            <Icon name="check-circle" size={32} />
            <h3 className={s.h3} style={{ marginTop: 12 }}>{c.fattoTitolo}</h3>
            <p className={s.nota} style={{ marginTop: 6 }}>{c.fattoTesto}</p>
          </div>
        ) : (
          <form className={s.modulo} onSubmit={invia} noValidate>
            <div className={s.campo}><label htmlFor="c-nome">{c.nome} *</label><input id="c-nome" autoComplete="name" value={dati.name} onChange={e => metti('name', e.target.value)} placeholder={c.nomeEsempio} required /></div>
            <div className={s.campo}><label htmlFor="c-azienda">{c.azienda} *</label><input id="c-azienda" autoComplete="organization" value={dati.company} onChange={e => metti('company', e.target.value)} placeholder={c.aziendaEsempio} required /></div>
            <div className={s.campo}><label htmlFor="c-email">{c.email} *</label><input id="c-email" type="email" autoComplete="email" value={dati.email} onChange={e => metti('email', e.target.value)} placeholder={c.emailEsempio} required /></div>
            <div className={s.campo}><label htmlFor="c-tel">{c.telefono}</label><input id="c-tel" type="tel" autoComplete="tel" value={dati.phone} onChange={e => metti('phone', e.target.value)} placeholder={c.telefonoEsempio} /></div>
            <div className={s.campo}><label htmlFor="c-sito">{c.sito}</label><input id="c-sito" type="url" autoComplete="url" value={dati.website} onChange={e => metti('website', e.target.value)} placeholder={c.sitoEsempio} /></div>
            <div className={s.campo}>
              <label htmlFor="c-fatt">{c.fatturatoAnnuo}</label>
              <select id="c-fatt" value={dati.revenue} onChange={e => metti('revenue', e.target.value)}>
                <option value="">{c.scegli}</option>
                <option value="<100k">&lt; €100k</option>
                <option value="100k-500k">€100k – €500k</option>
                <option value="500k-1M">€500k – €1M</option>
                <option value="1M-5M">€1M – €5M</option>
                <option value="5M+">€5M+</option>
              </select>
            </div>
            <div className={`${s.campo} ${s.campoLargo}`}><label htmlFor="c-msg">{c.messaggio}</label><textarea id="c-msg" value={dati.message} onChange={e => metti('message', e.target.value)} placeholder={c.messaggioEsempio} /></div>
            <div className={s.moduloPiede}>
              <p className={s.nota} style={{ maxWidth: 440 }}>{c.avvertenza}</p>
              <button type="submit" className={s.btn} disabled={invio} aria-busy={invio}>{invio ? c.invio : c.invia}</button>
            </div>
            {errore && <p className={`${s.errore} ${s.campoLargo}`} role="alert">{errore}</p>}
          </form>
        )}
      </div>
    </section>
  )
}


// ── Il cursore (Marino, 29 set 2026: «voglio anche il cursore custom», come su unitedcarriers.com):
// un punto e un anello che seguono il mouse con un po' di ritardo; l'anello si riempie con
// l'avanzamento della pagina e si allarga sopra a link e bottoni, sui campi di testo diventa un
// trattino. E' in differenza di colore: bianco sul nero e nero sul bianco senza saperlo. Solo con
// il mouse, mai sul tocco, mai per chi ha chiesto meno movimento.
function Cursore({ pagina }) {
  const el = useRef(null)
  const anello = useRef(null)
  useEffect(() => {
    const c = el.current, pg = pagina.current, cerchio = anello.current
    if (!c || !pg || !cerchio) return
    if (!window.matchMedia('(min-width: 861px) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    pg.dataset.cursore = '1'
    const giro = 2 * Math.PI * 20
    cerchio.style.strokeDasharray = String(giro)
    cerchio.style.strokeDashoffset = String(giro)
    let mx = -100, my = -100, x = -100, y = -100, raf = 0, visto = false
    const passo = () => {
      raf = 0
      x += (mx - x) * 0.18; y += (my - y) * 0.18
      c.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`
      const max = document.documentElement.scrollHeight - window.innerHeight
      const p = max > 0 ? Math.min(1, (window.scrollY || 0) / max) : 0
      cerchio.style.strokeDashoffset = String(giro * (1 - p))
      if (Math.abs(mx - x) > 0.1 || Math.abs(my - y) > 0.1) raf = requestAnimationFrame(passo)
    }
    const chiedi = () => { if (!raf) raf = requestAnimationFrame(passo) }
    const muove = e => {
      mx = e.clientX; my = e.clientY
      if (!visto) { visto = true; x = mx; y = my; c.dataset.visto = '1' }
      chiedi()
    }
    const sopra = e => {
      const su = e.target.closest?.('a, button, summary, select, label, [role="button"], input, textarea')
      c.dataset.su = su ? '1' : '0'
      c.dataset.testo = su && su.matches('input, textarea') ? '1' : '0'
    }
    const esce = () => { visto = false; c.dataset.visto = '0' }
    window.addEventListener('mousemove', muove, { passive: true })
    document.addEventListener('mouseover', sopra)
    document.documentElement.addEventListener('mouseleave', esce)
    window.addEventListener('scroll', chiedi, { passive: true })
    return () => {
      window.removeEventListener('mousemove', muove); document.removeEventListener('mouseover', sopra)
      document.documentElement.removeEventListener('mouseleave', esce); window.removeEventListener('scroll', chiedi)
      if (raf) cancelAnimationFrame(raf)
      delete pg.dataset.cursore
    }
  }, [pagina])
  return (
    <div ref={el} className={s.curs} aria-hidden="true">
      <span className={s.cursPunto} />
      <svg className={s.cursAnello} viewBox="0 0 44 44" width="44" height="44">
        <circle cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeOpacity=".3" strokeWidth="1" />
        <circle ref={anello} cx="22" cy="22" r="20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" transform="rotate(-90 22 22)" />
      </svg>
    </div>
  )
}

// ── Lo scorrimento morbido (Lenis, come unitedcarriers.com): solo da desktop con il mouse; sul
// tocco e per chi ha chiesto meno movimento resta quello del sistema, che e' gia' giusto. I link
// #ancora passano da qui e scivolano invece di saltare.
function useLenis() {
  useEffect(() => {
    if (!window.matchMedia('(min-width: 861px) and (pointer: fine) and (prefers-reduced-motion: no-preference)').matches) return
    const lenis = new Lenis({ lerp: 0.1, anchors: true })
    let raf = requestAnimationFrame(function ciclo(t) { lenis.raf(t); raf = requestAnimationFrame(ciclo) })
    return () => { cancelAnimationFrame(raf); lenis.destroy() }
  }, [])
}

// La lingua arriva dalla ROTTA (/welcome = it, /en, /es, /fr, /de). Su /welcome senza scelta si
// rileva: ?lang= → scelta salvata su questo dispositivo → lingua del browser → paese.
export default function LandingPage({ initialLang = null }) {
  const [lang, setLang] = useState(initialLang || 'it')
  const [pubblico, setPubblico] = useState('brand')
  const scelta = useRef(false)
  const radice = useRef(null)
  useComparsa(radice)
  useLenis()

  useEffect(() => {
    if (initialLang) return
    let vivo = true
    try {
      const q = new URLSearchParams(window.location.search).get('lang')
      const ql = q ? String(q).slice(0, 2).toLowerCase() : null
      if (ql && TESTI[ql]) { scelta.current = true; setLang(ql); return }
    } catch {}
    try {
      const salvata = localStorage.getItem('lyftai_lang')
      if (salvata && TESTI[salvata]) { scelta.current = true; setLang(salvata); return }
    } catch {}
    const browser = browserToLocale(navigator.language || navigator.languages?.[0])
    if (browser && TESTI[browser]) { setLang(browser); return }
    fetch('/api/geo').then(r => (r.ok ? r.json() : null)).then(j => {
      if (vivo && !scelta.current && j?.suggested && TESTI[j.suggested]) setLang(j.suggested)
    }).catch(() => {})
    return () => { vivo = false }
  }, [initialLang])

  const { locale: linguaApp, setLocale } = useI18n()
  useEffect(() => {
    try { localStorage.setItem('lyftai_lang', lang) } catch {}
    document.documentElement.lang = lang
    if (linguaApp !== lang) setLocale(lang, { profilo: false })
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  const scegli = (l) => {
    if (!TESTI[l]) return
    scelta.current = true
    setLang(l)
    try { if (window.location.pathname !== PERCORSO[l]) window.history.replaceState(null, '', PERCORSO[l] + window.location.hash) } catch {}
  }

  const t = TESTI[lang] || TESTI.it
  return (
    <div ref={radice} className={`${s.pagina} landing-pagina`} style={{ '--display': display.style.fontFamily, '--mono': mono.style.fontFamily, '--corpo': "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', 'Inter', 'Segoe UI', Roboto, sans-serif" }}>
      <Barra t={t} lang={lang} scegli={scegli} />
      <main>
        <Apertura t={t} lang={lang} pagina={radice} />
        <Intro t={t} lang={lang} />
        <Fonti t={t} />
        <Viaggio t={t} />
        <Prodotto t={t} lang={lang} />
        <Cervello t={t} />
        <Produttivita t={t} lang={lang} />
        <TempoReale t={t} lang={INTL[lang]} />
        <Tutto t={t} />
        <Agenzie t={t} vai={setPubblico} />
        <Prezzi t={t} lang={lang} pubblico={pubblico} setPubblico={setPubblico} />
        <Domande t={t} />
        <Contatti t={t} lang={lang} />
        <Chiusura t={t} />
      </main>
      <Piede t={t} />
      <Cursore pagina={radice} />
    </div>
  )
}
