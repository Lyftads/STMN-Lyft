'use client'

// La festa del traguardo: quando il fatturato tocca l'obiettivo lo schermo lo dice forte.
// Fuochi d'artificio d'oro su tutto lo schermo e un cartello a vetro al centro con la cifra;
// dura una decina di secondi, poi si toglie da sola e chiama onFine. Sta SOPRA a tutto ma non
// prende i clic: mentre va, lo schermo sotto continua a vivere (ordini, globo, numeri).
// Con «meno movimento» niente fuochi: resta il cartello, che compare e scompare in dissolvenza.
import { useEffect, useRef } from 'react'

const DURATA = 10_500          // tutta la festa
const FUOCHI_FINO = 7_600      // l'ultimo fuoco parte qui: gli ultimi secondi sono la coda che cade
const ORI = ['255,242,196', '246,207,107', '217,165,60', '255,224,138']   // solo oro: il bianco e' qualche scintilla dentro lo scoppio

export default function Festa({ titolo, cifra, onFine }) {
  const tela = useRef(null)
  const fine = useRef(onFine)
  fine.current = onFine

  useEffect(() => {
    const chiudi = setTimeout(() => fine.current?.(), DURATA)
    const c = tela.current
    const fermo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (!c || fermo) return () => clearTimeout(chiudi)

    const ctx = c.getContext('2d')
    let L = 0, A = 0, id = 0, prima = 0
    const misura = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      L = window.innerWidth; A = window.innerHeight
      c.width = Math.round(L * dpr); c.height = Math.round(A * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }
    misura()
    window.addEventListener('resize', misura)

    const scintille = []   // { x, y, vx, vy, vita, eta, colore, r }
    const razzi = []       // { x, y, vy, meta, colore }
    const t0 = performance.now()
    let prossimo = 0       // quando parte il prossimo razzo (ms dall'inizio)
    let salva = 0

    const scoppia = (x, y, forza = 1) => {
      const n = Math.round((95 + Math.random() * 55) * forza)
      const colore = ORI[Math.floor(Math.random() * ORI.length)]
      const spinta = (Math.min(L, A) / 115) * (0.8 + Math.random() * 0.5) * forza
      for (let i = 0; i < n; i++) {
        const ang = Math.random() * Math.PI * 2, v = spinta * (0.25 + Math.random() * 0.85)
        scintille.push({ x, y, vx: Math.cos(ang) * v, vy: Math.sin(ang) * v, eta: 0, vita: 1100 + Math.random() * 1100, colore: Math.random() < 0.22 ? '255,255,255' : colore, r: 1 + Math.random() * 1.6 })
      }
    }

    // l'apertura: tre scoppi grandi subito, intorno al cartello, senza aspettare che salga un razzo
    for (const [fx, fy] of [[0.24, 0.3], [0.76, 0.26], [0.5, 0.16]]) scoppia(L * fx, A * fy, 1.25)

    const giro = (t) => {
      const dt = Math.min(40, prima ? t - prima : 16); prima = t
      const k = dt / 16.67, ora = t - t0
      // i razzi partono a raffica all'inizio (l'apertura), poi uno ogni mezzo secondo circa
      if (ora >= prossimo && ora < FUOCHI_FINO) {
        const quanti = salva === 0 ? 5 : 1 + (Math.random() < 0.35 ? 1 : 0)
        for (let i = 0; i < quanti; i++) razzi.push({ x: L * (0.08 + Math.random() * 0.84), y: A + 10, vy: -(A / 52) * (0.85 + Math.random() * 0.3), meta: A * (0.12 + Math.random() * 0.4), colore: ORI[Math.floor(Math.random() * ORI.length)] })
        salva++
        prossimo = ora + 380 + Math.random() * 420
      }
      ctx.clearRect(0, 0, L, A)
      ctx.globalCompositeOperation = 'lighter'
      ctx.lineCap = 'round'
      for (let i = razzi.length - 1; i >= 0; i--) {
        const r = razzi[i]
        const y0 = r.y
        r.y += r.vy * k; r.vy *= Math.pow(0.985, k)
        const coda = ctx.createLinearGradient(0, r.y, 0, y0 + 26)
        coda.addColorStop(0, `rgba(${r.colore},.9)`); coda.addColorStop(1, `rgba(${r.colore},0)`)
        ctx.strokeStyle = coda; ctx.lineWidth = 1.6
        ctx.beginPath(); ctx.moveTo(r.x, y0 + 26); ctx.lineTo(r.x, r.y); ctx.stroke()
        if (r.y <= r.meta || r.vy > -1.2) { scoppia(r.x, r.y); razzi.splice(i, 1) }
      }
      for (let i = scintille.length - 1; i >= 0; i--) {
        const s = scintille[i]
        s.eta += dt
        if (s.eta >= s.vita) { scintille.splice(i, 1); continue }
        const x0 = s.x, y0 = s.y
        s.vx *= Math.pow(0.972, k); s.vy = s.vy * Math.pow(0.972, k) + 0.055 * k
        s.x += s.vx * k; s.y += s.vy * k
        const resta = 1 - s.eta / s.vita
        // verso la fine la scintilla tremola, come la brace di un fuoco vero
        const a = resta * (resta < 0.45 ? 0.55 + 0.45 * Math.sin(s.eta / 28 + i) : 1)
        ctx.strokeStyle = `rgba(${s.colore},${Math.max(0, a).toFixed(3)})`
        ctx.lineWidth = s.r * (0.6 + 0.4 * resta)
        ctx.beginPath(); ctx.moveTo(x0 - s.vx * 2.2, y0 - s.vy * 2.2); ctx.lineTo(s.x, s.y); ctx.stroke()
        if (s.r > 1.9) { ctx.fillStyle = `rgba(255,250,225,${Math.max(0, a).toFixed(3)})`; ctx.beginPath(); ctx.arc(s.x, s.y, s.r * 0.9, 0, Math.PI * 2); ctx.fill() }
      }
      ctx.globalCompositeOperation = 'source-over'
      id = requestAnimationFrame(giro)
    }
    id = requestAnimationFrame(giro)
    return () => { clearTimeout(chiudi); cancelAnimationFrame(id); window.removeEventListener('resize', misura) }
  }, [])

  return (
    <div className="gl-festa" role="status" aria-live="polite">
      <canvas ref={tela} className="gl-festa-tela" aria-hidden="true" />
      <div className="gl-festa-cartello">
        <span className="gl-festa-titolo">{titolo}</span>
        <span className="gl-festa-cifra">{cifra}</span>
      </div>
    </div>
  )
}
