'use client'

// ════════════════════════════════════════════════════════════════════════════
//  LA LANDING — rifatta il 21 set 2026 nello stile del prodotto.
//
//  Prima era vetro nero, titolo in tre colori, particelle, un iframe della demo e
//  sezioni che promettevano cose tolte dal prodotto (Lighthouse, Performance Agent,
//  Creative Intel, white-label) o numeri non verificabili (+34% ROAS, testimonianze).
//  Ora: pagina chiara, SEI misure di testo, un solo bottone nero, e il colore solo
//  dentro le immagini del prodotto vero (dalla demo, nella lingua del visitatore).
//
//  Stile in landing.module.css; testi in testi.js (cinque lingue, stesse chiavi).
//  Comportamento tenuto dalla versione di prima: lingua dalla rotta o rilevata,
//  URL che cambia con la lingua, prezzi (aziende/agenzie, mensile/annuale),
//  modulo contatti su /api/contact.
// ════════════════════════════════════════════════════════════════════════════

import Link from 'next/link'
import dynamic from 'next/dynamic'
import { useEffect, useRef, useState } from 'react'
import Icon from '../components/ui/Icon'
import LogoMark from '../components/LogoMark'
import AgencyPricing from '../components/AgencyPricing'
import { impostaTema } from '../components/AutoTheme'
import { I18nProvider, useI18n } from '../../lib/i18n/I18nProvider'
import { browserToLocale } from '../../lib/i18n/geoLocale'
import { TESTI, LINGUE } from './testi'
import { LOGHI } from './loghi'
import s from './landing.module.css'

// Il globo (three.js, ~1,8 MB non compressi) arriva in un pezzo a parte e dopo il testo: la pagina
// si legge subito, il mondo compare appena pronto. Al suo posto, intanto, un riquadro vuoto della
// stessa misura, cosi' niente salta.
const Globo = dynamic(() => import('./GloboLanding'), { ssr: false, loading: () => <div className={s.globoAttesa} /> })

const NOMI_LINGUA = { it: 'Italiano', en: 'English', es: 'Español', fr: 'Français', de: 'Deutsch' }
const INTL = { it: 'it-IT', en: 'en-IE', es: 'es-ES', fr: 'fr-FR', de: 'de-DE' }
const PERCORSO = { it: '/welcome', en: '/en', es: '/es', fr: '/fr', de: '/de' }
// Le piattaforme da cui arrivano i numeri: nomi di marchi, non si traducono.
const FONTI = ['Shopify', 'Meta', 'Google Ads', 'Google Analytics 4', 'Search Console', 'Klaviyo', 'Mailchimp', 'Omnisend']

// Un'immagine del prodotto, nei due temi: foto della demo a 1920×1200, una serie per lingua e
// per tema (<id>.webp di giorno, <id>-scuro.webp di notte). Si vede quella del tema scelto; sono
// tutte pigre, e quella nascosta non si scarica.
function Immagini({ lang, id, alt, className }) {
  return (
    <>
      <img src={`/landing/${lang}/${id}.webp`} alt={alt} width={1920} height={1200} loading="lazy" decoding="async" className={`${s.soloChiaro} ${className || ''}`} />
      <img src={`/landing/${lang}/${id}-scuro.webp`} alt={alt} width={1920} height={1200} loading="lazy" decoding="async" className={`${s.soloScuro} ${className || ''}`} />
    </>
  )
}
function Foto({ lang, id, alt }) {
  return <div className={s.cornice}><Immagini lang={lang} id={id} alt={alt} /></div>
}

// L'interruttore giorno / notte (Marino, 21 set 2026). E' la stessa scelta dell'app: impostaTema
// scrive 'lyft-theme' e cambia data-theme su <html>, con la dissolvenza dell'app.
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

// Le sezioni compaiono salendo, una volta sola. Il testo c'e' gia' nell'HTML: la classe che le
// nasconde arriva solo DOPO il caricamento e solo per cio' che sta sotto lo schermo, cosi' senza
// JavaScript (o per chi indicizza) la pagina e' tutta visibile.
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

function Barra({ t, lang, scegli }) {
  const [aperto, setAperto] = useState(false)
  const voci = [['#prodotto', t.nav.prodotto], ['#agenzie', t.nav.agenzie], ['#prezzi', t.nav.prezzi], ['#domande', t.nav.domande]]
  return (
    <header className={s.barra}>
      <div className={`${s.largo} ${s.barraDentro}`}>
        <a href="#inizio" className={s.marchio} aria-label="LyftAI"><LogoMark size={26} withGlow={false} /> LyftAI</a>
        <nav className={s.voci} aria-label={t.nav.prodotto}>
          {voci.map(([h, l]) => <a key={h} href={h} className={s.voce}>{l}</a>)}
        </nav>
        <div className={s.destra}>
          <Tema t={t} />
          <select className={`${s.lingua} ${s.linguaBarra}`} value={lang} onChange={e => scegli(e.target.value)} aria-label={t.nav.lingua}>
            {LINGUE.map(l => <option key={l} value={l}>{NOMI_LINGUA[l]}</option>)}
          </select>
          <Link href="/login" className={`${s.voce} ${s.nascondiPiccolo}`}>{t.nav.accedi}</Link>
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
          {/* Sui telefoni piccoli la lingua sta qui: nella barra non c'e' posto per tutto. */}
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

// Il titolo a macchina da scrivere (Marino, 21 set 2026): «Quanto» resta, il resto si scrive e si
// cancella a turno — vendi, spendi, ti resta. La pagina nasce con la prima frase INTERA (chi la
// indicizza e chi non ha JavaScript la legge tutta); il titolo vero per i lettori di schermo e'
// quello nascosto accanto, e questa parte e' aria-hidden. Tutte le frasi stanno invisibili nella
// stessa cella: il titolo occupa gia' l'altezza della piu' lunga e sotto non salta niente.
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

function Apertura({ t, lang }) {
  const a = t.apertura
  return (
    <section id="inizio" className={s.apertura}>
      <div className={`${s.largo} ${s.aperturaGriglia}`}>
        <div className={s.aperturaTesto}>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h1 className={s.h1}><span className={s.soloLettori}>{a.titolo}</span><Macchina prima={a.titoloPrima} oggetti={a.oggetti} /></h1>
          <p className={s.sotto}>{a.sotto}</p>
          <div className={s.azioni}>
            <Link href="/register" className={s.btn}>{a.prova}</Link>
            <Link href="/demo" className={s.btnVuoto}>{a.demo} <Icon name="play" size={12} /></Link>
          </div>
          <div className={s.promesse}>
            {a.promesse.map(p => <span key={p}><Icon name="check" size={14} /> {p}</span>)}
          </div>
        </div>
        {/* A destra, grande e alla stessa altezza della scritta: il mondo che gira, con le sessioni e gli ordini. */}
        <div className={s.aperturaGlobo}><Globo testi={a.globo} lingua={INTL[lang]} /></div>
      </div>
    </section>
  )
}

// La Dashboard vera, subito sotto l'apertura: si apre mentre arriva.
function Vetrina({ t, lang }) {
  return (
    <section className={s.vetrina}>
      <div className={`${s.cornice} ${s.siApre}`}>
        <Immagini lang={lang} id="dashboard" alt={t.apertura.alt} />
      </div>
    </section>
  )
}

function Fonti({ t }) {
  // Il nastro che scorre (come i marchi su shopify.com): la fila e' scritta due volte e si sposta
  // di mezza lunghezza, cosi' il giro non ha stacchi. Si ferma sotto il puntatore; con "riduci
  // movimento" resta ferma e la copia sparisce.
  return (
    <section className={s.fonti} aria-label={t.fonti.etichetta}>
      <p className={`${s.etichetta} ${s.centro}`}>{t.fonti.etichetta}</p>
      <div className={s.nastro}>
        <div className={s.nastroScorre}>
          {[...FONTI, ...FONTI].map((f, i) => (
            <span key={i} className={`${s.fonte} ${i >= FONTI.length ? s.copia : ''}`} aria-hidden={i >= FONTI.length || undefined}>
              <svg aria-hidden="true" viewBox="0 0 24 24" width="22" height="22" fill="currentColor" fillRule="evenodd"><path d={LOGHI[f]} /></svg>{f}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}

// Il prodotto raccontato scorrendo (come «Crea rapidamente» e le schede di shopify.com): il testo
// scorre a sinistra, lo schermo resta fermo a destra e cambia immagine quando il passo arriva a meta'
// schermo; sotto, l'avanzamento 01-05. Sul telefono niente schermo fermo: ogni passo ha la sua
// immagine sotto il testo, come prima.
function Blocchi({ t, lang }) {
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
    <section id="prodotto" className={s.sezione}>
      <div className={`${s.largo} ${s.racconto}`}>
        <div>
          {t.blocchi.map((b, i) => (
            <div key={b.id} ref={el => { passi.current[i] = el }} data-i={i} className={`${s.passo} ${i === attivo ? s.passoAttivo : ''}`}>
              <p className={s.etichetta}><span className={s.numero}>{String(i + 1).padStart(2, '0')}</span>{b.etichetta}</p>
              <h2 className={s.h2}>{b.titolo}</h2>
              <p className={s.testo}>{b.testo}</p>
              <ul className={s.punti}>
                {b.punti.map(([forte, resto]) => (
                  <li key={forte}><Icon name="check" size={16} className={s.segno} /><span><strong>{forte}</strong> {resto}</span></li>
                ))}
              </ul>
              <div className={s.fotoPasso}><Foto lang={lang} id={b.id} alt={b.alt} /></div>
            </div>
          ))}
        </div>
        <div className={s.schermo}>
          <div className={s.schermoFermo}>
            <div className={s.cornice}>
              <div className={s.schermoFoto}>
                {t.blocchi.map((b, i) => (
                  <Immagini key={b.id} lang={lang} id={b.id} alt={b.alt} className={i === attivo ? s.fotoAttiva : ''} />
                ))}
              </div>
            </div>
            <div className={s.avanzamento} aria-hidden="true">
              {t.blocchi.map((b, i) => (
                <span key={b.id} className={i === attivo ? s.tappaAttiva : i < attivo ? s.tappaFatta : ''}><i />{String(i + 1).padStart(2, '0')}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// La chat che si scrive da sola (come «Il tuo brand è entrato in chat» di shopify.com): la
// domanda, "sta scrivendo…", la risposta parola per parola, poi la domanda dopo. Parte solo quando
// si vede. Con "riduci movimento" resta ferma sulla prima risposta, intera.
function ChatDemo({ t }) {
  const c = t.ai.chat
  const radice = useRef(null)
  const [n, setN] = useState(0)          // quale scambio
  const [fase, setFase] = useState('fatto') // domanda | scrive | risponde | fatto
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
      <div className={s.chatTesta}><span className={s.chatPunto} />{t.ai.etichetta} · {c.negozio}</div>
      <div className={s.chatCorpo}>
        <p key={'d' + n} className={s.chatDomanda}>{sc.d}</p>
        {fase === 'scrive' && <p className={s.chatScrive}>{c.scrive}</p>}
        {(fase === 'risponde' || fase === 'fatto') && <p key={'r' + n} className={s.chatRisposta}>{fase === 'fatto' ? sc.r : testo}</p>}
      </div>
    </div>
  )
}

function Cervello({ t }) {
  const a = t.ai
  return (
    <section className={`${s.sezione} ${s.sezioneGrigia}`}>
      <div className={`${s.largo} ${s.divisa}`}>
        <div data-compare>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h2 className={s.h2}>{a.titolo}</h2>
          <p className={s.sotto}>{a.sotto}</p>
          <ul className={`${s.voceElenco} ${s.cascata}`} data-compare>
            {a.voci.map((v, i) => (
              <li key={v.titolo} style={{ '--i': i }}>
                <Icon name={['chat', 'bulb', 'users'][i]} size={18} />
                <div><h3 className={s.h3}>{v.titolo}</h3><p className={s.testo} style={{ fontSize: 'var(--t-5)', marginTop: 4 }}>{v.testo}</p></div>
              </li>
            ))}
          </ul>
        </div>
        <div data-compare><ChatDemo t={t} /></div>
      </div>
    </section>
  )
}

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
        <div className={`${s.griglia} ${s.cascata}`} data-compare>
          {a.aree.map((ar, i) => (
            <div key={ar.titolo} className={s.area} style={{ '--i': i }}>
              <div className={s.areaTesta}><Icon name={ar.icona} size={18} /><h3 className={s.h3}>{ar.titolo}</h3></div>
              <ul>{ar.voci.map(v => <li key={v}>{v}</li>)}</ul>
            </div>
          ))}
        </div>
        <p className={`${s.nota} ${s.centro}`} style={{ maxWidth: 720, margin: '28px auto 0' }} data-compare>
          <strong style={{ color: 'var(--testo)', fontWeight: 600 }}>{a.rivenditori.titolo}.</strong> {a.rivenditori.testo}
        </p>
      </div>
    </section>
  )
}

function Agenzie({ t, vai }) {
  const a = t.agenzie
  return (
    <section id="agenzie" className={`${s.sezione} ${s.sezioneGrigia}`}>
      <div className={s.largo}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h2 className={s.h2}>{a.titolo}</h2>
          <p className={s.sotto}>{a.sotto}</p>
        </div>
        <div className={`${s.duo} ${s.cascata}`} data-compare>
          {a.voci.map((v, i) => (
            <div key={v.titolo} className={s.area} style={{ '--i': i }}>
              <div className={s.areaTesta}><Icon name={['lock', 'globe', 'users'][i]} size={18} /><h3 className={s.h3}>{v.titolo}</h3></div>
              <p className={s.testo} style={{ fontSize: 'var(--t-5)' }}>{v.testo}</p>
            </div>
          ))}
        </div>
        <div className={`${s.azioni} ${s.azioniSinistra}`}>
          <a href="#prezzi" className={s.btnVuoto} onClick={() => vai('agenzie')}>{a.cta}</a>
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
    <section id="domande" className={`${s.sezione} ${s.sezioneGrigia}`}>
      <div className={`${s.largo} ${s.divisa}`}>
        <div className={`${s.testaSezione} ${s.testaFerma}`}>
          <p className={s.etichetta}>{d.etichetta}</p>
          <h2 className={s.h2}>{d.titolo}</h2>
        </div>
        <div className={s.domande}>
          {d.voci.map(v => (
            <details key={v.q} className={s.domanda}>
              <summary>{v.q}<Icon name="plus" size={18} /></summary>
              <p>{v.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
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
          <h2 className={s.h2}>{c.titolo}</h2>
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

function Chiusura({ t }) {
  const c = t.chiusura
  return (
    <section className={s.chiusura}>
      <div className={s.largo} data-compare>
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

function Piede({ t }) {
  const p = t.piede
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
        <div className={`${s.piedeSotto} ${s.nota}`}>
          <span>© {new Date().getFullYear()} LYFT SRL. {p.diritti}</span>
        </div>
      </div>
    </footer>
  )
}

// La lingua arriva dalla ROTTA (/welcome = it, /en, /es, /fr, /de): cosi' l'HTML servito a chi
// indicizza e' gia' nella lingua giusta. Su /welcome senza scelta si rileva: ?lang= → scelta
// salvata su questo dispositivo → lingua del browser → paese.
export default function LandingPage({ initialLang = null }) {
  const [lang, setLang] = useState(initialLang || 'it')
  const [pubblico, setPubblico] = useState('brand')
  const scelta = useRef(false)
  const radice = useRef(null)
  useComparsa(radice)

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

  // Anche il resto della pagina che non e' la landing (il banner dei cookie) parla la sua lingua.
  const { locale: linguaApp, setLocale } = useI18n()
  useEffect(() => {
    try { localStorage.setItem('lyftai_lang', lang) } catch {}
    document.documentElement.lang = lang
    if (linguaApp !== lang) setLocale(lang, { profilo: false })
  }, [lang]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cambiare lingua cambia anche l'indirizzo: ogni lingua ha la sua pagina da condividere e indicizzare.
  const scegli = (l) => {
    if (!TESTI[l]) return
    scelta.current = true
    setLang(l)
    try { if (window.location.pathname !== PERCORSO[l]) window.history.replaceState(null, '', PERCORSO[l] + window.location.hash) } catch {}
  }

  const t = TESTI[lang] || TESTI.it
  return (
    <div ref={radice} className={`${s.pagina} landing-pagina`}>
      <Barra t={t} lang={lang} scegli={scegli} />
      <main>
        <Apertura t={t} lang={lang} />
        <Fonti t={t} />
        <Vetrina t={t} lang={lang} />
        <Blocchi t={t} lang={lang} />
        <Cervello t={t} />
        <Tutto t={t} />
        <Agenzie t={t} vai={setPubblico} />
        <Prezzi t={t} lang={lang} pubblico={pubblico} setPubblico={setPubblico} />
        <Domande t={t} />
        <Contatti t={t} lang={lang} />
        <Chiusura t={t} />
      </main>
      <Piede t={t} />
    </div>
  )
}
