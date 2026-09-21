'use client'

import { useEffect, Component } from 'react'
import Icon from '../components/ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import App from '../page'
import { demoData, demoLocalStorage } from '../../lib/demo/data'

// Shim localStorage SOLO nella demo: fornisce mesi/settimane finti (con la spesa
// Google Ads, che nell'app è "manuale") come se fossero già in automatico, senza
// MAI scrivere nello storage reale e senza esporre i dati reali dell'utente.
let _lsPatched = false
function installLS() {
  if (_lsPatched || typeof window === 'undefined') return
  _lsPatched = true
  try {
    const DEMO = demoLocalStorage()
    const shim = {
      getItem: (k) => (Object.prototype.hasOwnProperty.call(DEMO, k) ? DEMO[k] : null),
      setItem: () => {}, removeItem: () => {}, clear: () => {}, key: () => null, length: 0,
    }
    Object.defineProperty(window, 'localStorage', { configurable: true, value: shim })
  } catch {}
}
installLS()

// Error boundary SOLO per la demo: mostra l'errore invece del white-screen.
class DemoBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null, cs: '' } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { try { console.error('[demo]', err, info) } catch {}; this.setState({ cs: (info && info.componentStack) || '' }) }
  render() {
    if (this.state.err) {
      // Chi guarda la demo e' un visitatore: niente traccia tecnica (resta in console, sopra),
      // un messaggio nella sua lingua e un modo per ripartire. Prima era un titolo BIANCO su
      // fondo chiaro, illeggibile, con lo stack di React sotto.
      const lingua = (typeof document !== 'undefined' && document.documentElement.lang) || 'it'
      const M = {
        it: ['Questa schermata della demo si è interrotta.', 'Ricarica la demo'],
        en: ['This demo screen stopped working.', 'Reload the demo'],
        es: ['Esta pantalla de la demo se ha interrumpido.', 'Recargar la demo'],
        fr: ['Cet écran de la démo s’est interrompu.', 'Recharger la démo'],
        de: ['Diese Demo-Ansicht wurde unterbrochen.', 'Demo neu laden'],
      }[String(lingua).slice(0, 2)] || ['Questa schermata della demo si è interrotta.', 'Ricarica la demo']
      return (
        <div role="alert" style={{ padding: '96px 24px', textAlign: 'center', color: 'var(--text)', fontFamily: 'inherit' }}>
          <div style={{ fontSize: 20, fontWeight: 650, marginBottom: 20 }}>{M[0]}</div>
          <a href="/demo?tab=dashboard" style={{ display: 'inline-flex', alignItems: 'center', height: 40, padding: '0 20px', borderRadius: 999, background: 'var(--btn-primario)', color: 'var(--btn-primario-testo)', fontSize: 15, fontWeight: 600, textDecoration: 'none' }}>{M[1]}</a>
        </div>
      )
    }
    return this.props.children
  }
}

// Monta il SOFTWARE REALE (app/page.js) ma intercetta le chiamate /api/* e
// risponde con dati demo inventati. Non tocca nulla del software reale: la
// patch a window.fetch è attiva SOLO mentre questa pagina è montata.
let _orig = null
function installPatch() {
  if (typeof window === 'undefined' || _orig) return
  _orig = window.fetch.bind(window)
  window.fetch = async (input, init) => {
    let url = ''
    try { url = typeof input === 'string' ? input : (input && input.url) || '' } catch {}
    try {
      const u = new URL(url, window.location.origin)
      if (u.pathname.startsWith('/api/')) {
        const method = ((init && init.method) || 'GET').toUpperCase()
        const data = demoData(u.pathname, u.searchParams, method)
        const body = data === undefined ? { ok: true } : data
        return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
      }
    } catch {}
    return _orig(input, init)
  }
  // I LINK diretti alle API (es. «Esporta XLSX» dei Corrispettivi) non passano da fetch: senza
  // questo, nella demo aprivano la route vera — pagina d'errore per un visitatore, e i dati del
  // proprio negozio per chi e' collegato. Nella demo si fermano e si dice perche'.
  document.addEventListener('click', (e) => {
    const a = e.target?.closest?.('a[href]')
    if (!a) return
    let u = null
    try { u = new URL(a.getAttribute('href'), window.location.origin) } catch { return }
    if (u.origin !== window.location.origin || !u.pathname.startsWith('/api/')) return
    e.preventDefault(); e.stopPropagation()
    const risposta = demoData(u.pathname, u.searchParams, 'GET')
    const lingua = (document.documentElement.lang || 'it').slice(0, 2)
    const ripiego = { it: 'Non disponibile nella demo.', en: 'Not available in the demo.', es: 'No disponible en la demo.', fr: 'Non disponible dans la démo.', de: 'In der Demo nicht verfügbar.' }[lingua] || 'Non disponibile nella demo.'
    window.alert(risposta?.error || ripiego)
  }, true)
}

// Installa SUBITO (durante il modulo/primo render) così le fetch dei componenti
// figli vengono già intercettate al mount.
installPatch()

// Sostituzioni testuali ATTIVE SOLO NELLA DEMO (non tocca il software reale):
// nasconde nome personale, STMN e competitor reali dal DOM renderizzato.
const REPL = [
  [/Marino Catasta/g, 'il titolare'],
  [/Ehi Marino,/g, 'Ehi,'],
  [/Guarda Marino/g, 'Guarda'],
  [/ Marino\./g, '!'],
  [/ Marino,/g, ','],
  [/ Marino —/g, ' —'],
  [/ Marino /g, ' '],
  [/Marino/g, 'Acme'],
  [/STMN Fitness/g, 'Acme Store'],
  [/stmnfitness\.com/g, 'acme.store'],
  [/stmn-?fitness\d*/gi, 'acme-store'],
  [/tape-adesivo-nero/g, 'best-seller'],
  [/es\. grips, jump rope, knee sleeves…?/g, 'es. scarpe running, integratori, leggings…'],
  [/STMN/g, 'Acme Store'],
  [/Velites/g, 'Competitor A'],
  [/Picsil/g, 'Competitor B'],
  [/Frog Grips/g, 'Competitor C'],
]
function scrub(root) {
  if (!root) return
  try {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const nodes = []
    let n; while ((n = walker.nextNode())) nodes.push(n)
    for (const node of nodes) {
      let v = node.nodeValue
      if (!v) continue
      let nv = v
      for (const [re, rep] of REPL) nv = nv.replace(re, rep)
      if (nv !== v) node.nodeValue = nv
    }
    root.querySelectorAll && root.querySelectorAll('input[placeholder], textarea[placeholder]').forEach(el => {
      let v = el.getAttribute('placeholder'); if (!v) return
      let nv = v; for (const [re, rep] of REPL) nv = nv.replace(re, rep)
      if (nv !== v) el.setAttribute('placeholder', nv)
    })
  } catch {}
}

export default function DemoApp() {
  const { t } = useI18n()
  useEffect(() => {
    installPatch()
    return () => { if (_orig) { window.fetch = _orig; _orig = null } }
  }, [])

  // Pulizia nomi: SOLO nella demo. Passata iniziale + osserva i render async.
  useEffect(() => {
    let raf = 0
    const run = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => scrub(document.body)) }
    run()
    const obs = new MutationObserver(run)
    obs.observe(document.body, { childList: true, subtree: true, characterData: true })
    const iv = setInterval(run, 1500)
    setTimeout(() => clearInterval(iv), 12000)
    return () => { obs.disconnect(); clearInterval(iv); cancelAnimationFrame(raf) }
  }, [])

  return (
    <>
      {/* Nastro DEMO. Era un gradiente viola-blu, l'unica tinta della pagina, e diceva le sue tre
          frasi solo in italiano anche a chi guardava la demo in tedesco. Ora ha i colori del
          prodotto (fondo, bordo, testo) e parla la lingua di chi guarda. */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 800, // sotto pannelli (1100) e lavagna dei flussi (900): prima ne copriva la testata, titolo e chiusura compresi
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, flexWrap: 'wrap',
        minHeight: 34, padding: '6px 16px', fontSize: 13, fontWeight: 500,
        background: 'var(--surface)', color: 'var(--text2)', borderBottom: '1px solid var(--border)',
      }}>
        <span>{t('demo.banner', null, 'Demo con dati di esempio · account «Acme Store»')}</span>
        <a href="/register" target="_top" style={{ color: 'var(--text)', fontWeight: 600, textDecoration: 'none' }}>{t('demo.start', null, 'Prova gratis →')}</a>
        {/* "Torna al sito" solo se a schermo intero (NON nell'iframe della landing) */}
        {typeof window !== 'undefined' && window.self === window.top && (
          <a href="/welcome" style={{ color: 'var(--text3)', textDecoration: 'none' }}>{t('demo.back', null, '← Torna al sito')}</a>
        )}
      </div>
      <div style={{ paddingTop: 34 }}>
        <DemoBoundary>
          <App />
        </DemoBoundary>
      </div>
    </>
  )
}
