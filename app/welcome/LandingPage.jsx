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
import { I18nProvider, useI18n } from '../../lib/i18n/I18nProvider'
import { browserToLocale } from '../../lib/i18n/geoLocale'
import { TESTI, LINGUE } from './testi'
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

// Un'immagine del prodotto. Sono foto della demo a 1920×1200, una serie per lingua.
function Foto({ lang, id, alt, prima = false }) {
  return (
    <div className={s.cornice}>
      <img
        src={`/landing/${lang}/${id}.webp`} alt={alt} width={1920} height={1200}
        loading={prima ? 'eager' : 'lazy'} decoding="async" fetchPriority={prima ? 'high' : 'auto'}
      />
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
          <select className={s.lingua} value={lang} onChange={e => scegli(e.target.value)} aria-label={t.nav.lingua}>
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
        <nav id="menu-landing" className={s.menuAperto} onClick={() => setAperto(false)}>
          {voci.map(([h, l]) => <a key={h} href={h}>{l}</a>)}
          <Link href="/login">{t.nav.accedi}</Link>
          <Link href="/register">{t.nav.prova}</Link>
        </nav>
      )}
    </header>
  )
}

function Apertura({ t, lang }) {
  const a = t.apertura
  return (
    <section id="inizio" className={s.apertura}>
      <div className={`${s.largo} ${s.aperturaGriglia}`}>
        <div className={s.aperturaTesto}>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h1 className={s.h1}>{a.titolo}</h1>
          <p className={s.sotto}>{a.sotto}</p>
          <div className={s.azioni}>
            <Link href="/register" className={s.btn}>{a.prova}</Link>
            <Link href="/demo" className={s.btnVuoto}>{a.demo} <Icon name="play" size={12} /></Link>
          </div>
          <div className={s.promesse}>
            {a.promesse.map(p => <span key={p}><Icon name="check" size={14} /> {p}</span>)}
          </div>
        </div>
        {/* Sotto al testo e spostato a destra: il mondo che gira, con le sessioni e gli ordini. */}
        <div className={s.aperturaGlobo}><Globo testi={a.globo} lingua={INTL[lang]} /></div>
      </div>
      <div className={s.vetrina}>
        <div className={`${s.cornice} ${s.corniceAperta}`} style={{ boxShadow: 'none' }}>
          <img src={`/landing/${lang}/dashboard.webp`} alt={a.alt} width={1920} height={1200} loading="eager" decoding="async" fetchPriority="high" />
        </div>
      </div>
    </section>
  )
}

function Fonti({ t }) {
  return (
    <section className={s.fonti} aria-label={t.fonti.etichetta}>
      <div className={s.largo}>
        <p className={`${s.etichetta} ${s.centro}`}>{t.fonti.etichetta}</p>
        <div className={s.fontiRiga}>
          {FONTI.map(f => <span key={f} className={s.fonte}>{f}</span>)}
        </div>
      </div>
    </section>
  )
}

function Blocchi({ t, lang }) {
  return (
    <section id="prodotto" className={s.sezione}>
      <div className={s.largo} style={{ display: 'grid', gap: 128 }}>
        {t.blocchi.map((b, i) => (
          <div key={b.id} data-compare className={`${s.blocco} ${i % 2 ? s.bloccoRovescio : ''}`}>
            <div className={s.bloccoTesto}>
              <p className={s.etichetta}>{b.etichetta}</p>
              <h2 className={s.h2}>{b.titolo}</h2>
              <p className={s.testo}>{b.testo}</p>
              <ul className={s.punti}>
                {b.punti.map(([forte, resto]) => (
                  <li key={forte}><Icon name="check" size={16} className={s.segno} /><span><strong>{forte}</strong> {resto}</span></li>
                ))}
              </ul>
            </div>
            <Foto lang={lang} id={b.id} alt={b.alt} />
          </div>
        ))}
      </div>
    </section>
  )
}

function Cervello({ t }) {
  const a = t.ai
  return (
    <section className={`${s.sezione} ${s.sezioneGrigia}`}>
      <div className={s.largo}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{a.etichetta}</p>
          <h2 className={s.h2}>{a.titolo}</h2>
          <p className={s.sotto}>{a.sotto}</p>
        </div>
        <div className={s.duo} data-compare>
          {a.voci.map((v, i) => (
            <div key={v.titolo} className={s.area}>
              <div className={s.areaTesta}><Icon name={['chat', 'bulb', 'users'][i]} size={18} /><h3 className={s.h3}>{v.titolo}</h3></div>
              <p className={s.testo} style={{ fontSize: 'var(--t-5)' }}>{v.testo}</p>
            </div>
          ))}
        </div>
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
        <div className={s.griglia} data-compare>
          {a.aree.map(ar => (
            <div key={ar.titolo} className={s.area}>
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
        <div className={s.duo} data-compare>
          {a.voci.map((v, i) => (
            <div key={v.titolo} className={s.area}>
              <div className={s.areaTesta}><Icon name={['lock', 'globe', 'users'][i]} size={18} /><h3 className={s.h3}>{v.titolo}</h3></div>
              <p className={s.testo} style={{ fontSize: 'var(--t-5)' }}>{v.testo}</p>
            </div>
          ))}
        </div>
        <div className={s.azioni}>
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
  const euro = n => '€' + new Intl.NumberFormat(INTL[lang], { maximumFractionDigits: 0 }).format(n)
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
      <div className={s.stretto}>
        <div className={s.testaSezione}>
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
      <div className={s.stretto}>
        <div className={s.testaSezione}>
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
