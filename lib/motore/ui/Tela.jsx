'use client'
import { useCallback, useEffect, useRef, useState } from 'react'

// ============================================================================
//  Tela infinita in stile Canva: sfondo a pallini, zoom con la rotella,
//  selezione a rettangolo trascinando, spostamento con la barra spaziatrice.
//
//  Il punto delicato è lo ZOOM ANCORATO AL CURSORE: se ci si limita a cambiare
//  la scala, il contenuto scivola via da sotto il puntatore e la navigazione
//  diventa frustrante. Va spostata anche l'origine, così il punto sotto il
//  mouse resta fermo.
//
//  Il secondo punto delicato è il CONFLITTO fra trascinare-per-spostarsi e
//  trascinare-per-selezionare: sono lo stesso gesto. Vince la selezione, come
//  su Canva e Figma; lo spostamento passa alla barra spaziatrice, al tasto
//  centrale e ad Alt. Se vincesse lo spostamento non ci sarebbe modo di
//  selezionare a rettangolo senza inventare una scorciatoia peggiore.
// ============================================================================

// Il minimo scende a 0,08: con alberi da diecimila pixel il vecchio 0,2 non
// bastava a inquadrare il contenuto e "Centra" restituiva sempre la stessa
// vista parziale.
const MIN = 0.08, MAX = 2.5
const SOGLIA = 4   // px sotto i quali il gesto è un clic, non un trascinamento

export default function Tela({ children, contaSchede = 0, onSelezione, onMenu, onSfondo }) {
  const box = useRef(null)
  const [z, setZ] = useState(0.7)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spazio, setSpazio] = useState(false)
  const [banda, setBanda] = useState(null)     // rettangolo di selezione, in px schermo
  const trascino = useRef(null)
  const marcatura = useRef(null)

  const rotella = useCallback((e) => {
    e.preventDefault()
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    setZ(prec => {
      const nuovo = Math.min(MAX, Math.max(MIN, prec * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      if (nuovo === prec) return prec
      setPan(p => ({
        x: cx - (cx - p.x) * (nuovo / prec),
        y: cy - (cy - p.y) * (nuovo / prec),
      }))
      return nuovo
    })
  }, [])

  // Il listener va aggiunto a mano con passive:false, altrimenti il browser
  // ignora preventDefault e la pagina scrolla invece di zoomare.
  useEffect(() => {
    const el = box.current; if (!el) return
    el.addEventListener('wheel', rotella, { passive: false })
    return () => el.removeEventListener('wheel', rotella)
  }, [rotella])

  // Barra spaziatrice tenuta premuta = mano per spostarsi. Il preventDefault
  // serve o la pagina scrolla sotto la tela mentre si sposta.
  useEffect(() => {
    const giuT = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      const t = e.target
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return
      e.preventDefault(); setSpazio(true)
    }
    const suT = (e) => { if (e.code === 'Space') setSpazio(false) }
    // Se la finestra perde il fuoco con lo spazio premuto il keyup non arriva
    // mai e la tela resta bloccata in modalità mano.
    const persa = () => setSpazio(false)
    window.addEventListener('keydown', giuT); window.addEventListener('keyup', suT)
    window.addEventListener('blur', persa)
    return () => {
      window.removeEventListener('keydown', giuT); window.removeEventListener('keyup', suT)
      window.removeEventListener('blur', persa)
    }
  }, [])

  // Quali schede tocca il rettangolo. Si lavora sui rettangoli SULLO SCHERMO,
  // non sulle coordinate del contenuto: così zoom e spostamento sono già
  // dentro il calcolo e non vanno rifatti a mano (sbagliandoli).
  const dentro = (r) => {
    const out = []
    for (const el of box.current?.querySelectorAll('.scheda[data-id]') || []) {
      const b = el.getBoundingClientRect()
      if (b.right >= r.x1 && b.left <= r.x2 && b.bottom >= r.y1 && b.top <= r.y2) out.push(el.dataset.id)
    }
    return out
  }

  const norm = (m) => ({
    x1: Math.min(m.x0, m.x), x2: Math.max(m.x0, m.x),
    y1: Math.min(m.y0, m.y), y2: Math.max(m.y0, m.y),
  })

  const giu = (e) => {
    if (e.button === 2) return                       // il destro apre il menu
    // Nulla di INTERATTIVO è tela. Senza questa uscita il pointerdown cattura
    // il puntatore sul contenitore e il clic non arriva mai al comando: è già
    // successo con "Centra", con lo zoom e col bottone per tornare a tutti gli
    // angoli. Meglio una regola sola su tutto ciò che si clicca che una
    // eccezione per ogni bottone nuovo — le eccezioni si dimenticano.
    if (e.target.closest('button, a, input, select, textarea, label')) return
    const suScheda = !!e.target.closest('.scheda')
    const mano = spazio || e.button === 1 || e.altKey
    if (mano) {
      e.preventDefault()
      trascino.current = { x: e.clientX - pan.x, y: e.clientY - pan.y }
      box.current?.setPointerCapture?.(e.pointerId)
      return
    }
    if (e.button !== 0 || suScheda) return           // sulle schede il clic resta un clic
    marcatura.current = { x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, add: e.shiftKey }
    setBanda(norm(marcatura.current))
    box.current?.setPointerCapture?.(e.pointerId)
  }

  const muovi = (e) => {
    if (trascino.current) {
      setPan({ x: e.clientX - trascino.current.x, y: e.clientY - trascino.current.y })
      return
    }
    if (!marcatura.current) return
    marcatura.current.x = e.clientX; marcatura.current.y = e.clientY
    setBanda(norm(marcatura.current))
  }

  const su = () => {
    trascino.current = null
    const m = marcatura.current
    marcatura.current = null; setBanda(null)
    if (!m) return
    const mosso = Math.abs(m.x - m.x0) > SOGLIA || Math.abs(m.y - m.y0) > SOGLIA
    // Un clic secco sul fondo azzera la selezione: è il gesto con cui ci si
    // aspetta di "uscire" da una selezione, e senza di esso resterebbe attiva
    // mentre si lavora su altro.
    if (!mosso) { if (!m.add) onSfondo?.(); return }
    onSelezione?.(dentro(norm(m)), m.add)
  }

  const menu = (e) => {
    if (!onMenu) return
    e.preventDefault()
    const scheda = e.target.closest('.scheda[data-id]')
    onMenu({ x: e.clientX, y: e.clientY, id: scheda?.dataset.id || null })
  }

  // "Centra" INQUADRA il contenuto invece di tornare a uno zoom fisso: con
  // alberi larghi decine di migliaia di pixel, riportare al 70% lasciava fuori
  // tutto tranne il primo ramo.
  // "Centra" inquadra la LARGHEZZA e allinea in alto, non incastra anche
  // l'altezza: una griglia di quaranta schede è alta ottomila pixel, e farci
  // stare tutto voleva dire aprire al 10% — leggibile come un francobollo. Si
  // vede l'inizio a una scala usabile e si scorre.
  const centra = () => {
    const b = box.current, c = b?.querySelector('.tela-contenuto')?.firstElementChild
    if (!b || !c) { setZ(0.7); setPan({ x: 0, y: 0 }); return }
    const m = 48
    const zx = (b.clientWidth - m * 2) / (c.scrollWidth || 1)
    const zy = (b.clientHeight - m * 2) / (c.scrollHeight || 1)
    // Se ci sta tutto si mostra tutto; se è molto alto si privilegia la
    // larghezza, senza però ingrandire oltre la scala naturale.
    const stipato = zy < zx * 0.55
    const nuovo = Math.max(MIN, Math.min(MAX, stipato ? Math.min(zx, 1) : Math.min(zx, zy)))
    setZ(nuovo)
    setPan({ x: m, y: m })
  }
  const passo = (v) => setZ(p => Math.min(MAX, Math.max(MIN, p + v)))

  const rBox = box.current?.getBoundingClientRect()

  return (
    <div className="tela-box" ref={box}
      onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su}
      onContextMenu={menu}
      style={{
        // I pallini si muovono e si scalano con la tela: se restassero fermi
        // lo spostamento non si percepirebbe e sembrerebbe tutto immobile.
        backgroundSize: `${24 * z}px ${24 * z}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: trascino.current ? 'grabbing' : spazio ? 'grab' : 'default',
      }}>
      <div className="tela-contenuto"
        style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})` }}>
        {children}
      </div>

      {banda && rBox && (
        <div className="banda" style={{
          left: banda.x1 - rBox.left, top: banda.y1 - rBox.top,
          width: banda.x2 - banda.x1, height: banda.y2 - banda.y1,
        }} />
      )}

      <div className="tela-comandi">
        <button onClick={() => passo(-0.15)} aria-label="Riduci">−</button>
        <span className="mono">{Math.round(z * 100)}%</span>
        <button onClick={() => passo(0.15)} aria-label="Ingrandisci">+</button>
        <button onClick={centra} className="testo">Centra</button>
        <span className="conta">{contaSchede} creatività</span>
      </div>
      <div className="tela-aiuto">trascina per selezionare · spazio o Alt per spostare · destro per il menu</div>
    </div>
  )
}
