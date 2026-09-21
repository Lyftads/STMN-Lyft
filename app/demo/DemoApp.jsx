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
      const e = this.state.err
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#fff', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Errore nella demo</div>
          <div style={{ fontSize: 13, color: '#ff8095', fontFamily: 'monospace', maxWidth: 760, margin: '0 auto 8px', wordBreak: 'break-word' }}>{String(e && (e.message || e))}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', maxWidth: 820, margin: '0 auto', textAlign: 'left' }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>Componente:</div>
            <pre style={{ whiteSpace: 'pre-wrap', maxHeight: 260, overflow: 'auto' }}>{String(this.state.cs || '').slice(0, 1400)}</pre>
          </div>
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
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
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
