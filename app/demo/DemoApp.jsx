'use client'

import { useEffect, Component } from 'react'
import App from '../page'
import { demoData } from '../../lib/demo/data'

// Error boundary SOLO per la demo: mostra l'errore invece del white-screen.
class DemoBoundary extends Component {
  constructor(p) { super(p); this.state = { err: null } }
  static getDerivedStateFromError(err) { return { err } }
  componentDidCatch(err, info) { try { console.error('[demo]', err, info) } catch {} }
  render() {
    if (this.state.err) {
      const e = this.state.err
      return (
        <div style={{ padding: '60px 24px', textAlign: 'center', color: '#fff', fontFamily: 'system-ui' }}>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>Errore nella demo</div>
          <div style={{ fontSize: 13, color: '#ff8095', fontFamily: 'monospace', maxWidth: 760, margin: '0 auto 8px', wordBreak: 'break-word' }}>{String(e && (e.message || e))}</div>
          <pre style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', maxWidth: 820, margin: '0 auto', textAlign: 'left', whiteSpace: 'pre-wrap', maxHeight: 220, overflow: 'auto' }}>{String(e && e.stack || '').slice(0, 1200)}</pre>
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
      {/* Nastro DEMO */}
      <div style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 14,
        padding: '7px 16px', fontSize: 12.5, fontWeight: 700,
        background: 'linear-gradient(90deg,#7b5bff,#5b8bff)', color: '#fff',
      }}>
        <span>🔎 Demo interattiva di LyftAI — dati di esempio, account "Acme Store"</span>
        <a href="/register" style={{ color: '#fff', textDecoration: 'underline', fontWeight: 800 }}>Inizia gratis →</a>
        <a href="/welcome" style={{ color: 'rgba(255,255,255,0.85)', textDecoration: 'none' }}>← Torna al sito</a>
      </div>
      <div style={{ paddingTop: 34 }}>
        <DemoBoundary>
          <App />
        </DemoBoundary>
      </div>
    </>
  )
}
