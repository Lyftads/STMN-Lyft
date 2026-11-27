'use client'

// Il cielo dietro lo schermo generale: stelle, qualche costellazione, un velo di nebulosa.
// E' uno sfondo: tutto tenue, niente che competa coi numeri. Un solo <canvas> fisso, ridisegnato
// una dozzina di volte al secondo per far tremolare le stelle (con «meno movimento» resta fermo).
// Le posizioni nascono da un generatore con seme fisso: il cielo e' sempre lo stesso, non cambia
// a ogni apertura ne' quando si ridimensiona la finestra.
import { useEffect, useRef } from 'react'

function generatore(seme) {
  let a = seme >>> 0
  return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296 }
}

function cielo() {
  const r = generatore(20261127)
  const stelle = Array.from({ length: 420 }, () => {
    const grande = r() < 0.07
    return { x: r(), y: r(), raggio: grande ? 1.1 + r() * 0.9 : 0.35 + r() * 0.75, luce: grande ? 0.75 + r() * 0.25 : 0.25 + r() * 0.5, fase: r() * Math.PI * 2, passo: 0.4 + r() * 1.6, calda: r() < 0.12 }
  })
  // Le costellazioni: un pugno di stelle vicine unite da una linea sottile, lontane dal centro
  // (li' c'e' il globo, che le coprirebbe).
  const costellazioni = []
  let prove = 0
  while (costellazioni.length < 8 && prove++ < 200) {
    const cx = 0.04 + r() * 0.92, cy = 0.05 + r() * 0.9
    if (Math.hypot(cx - 0.5, (cy - 0.52) * 0.6) < 0.2) continue
    if (costellazioni.some(c => Math.hypot(c.cx - cx, c.cy - cy) < 0.2)) continue
    const n = 4 + Math.floor(r() * 4)
    const punti = [{ x: cx, y: cy }]
    let ang = r() * Math.PI * 2
    for (let i = 1; i < n; i++) {
      ang += (r() - 0.5) * 1.9
      const ultimo = punti[punti.length - 1], passo = 0.022 + r() * 0.03
      punti.push({ x: ultimo.x + Math.cos(ang) * passo, y: ultimo.y + Math.sin(ang) * passo * 1.5 })
    }
    // a volte un ramo che parte da una stella di mezzo, come nelle costellazioni vere
    const ramo = r() < 0.6 ? { da: 1 + Math.floor(r() * (n - 2)), x: 0, y: 0 } : null
    if (ramo) { const p = punti[ramo.da], a2 = ang + 1.4 + r(); ramo.x = p.x + Math.cos(a2) * 0.03; ramo.y = p.y + Math.sin(a2) * 0.045 }
    costellazioni.push({ cx, cy, punti, ramo, fase: r() * Math.PI * 2 })
  }
  return { stelle, costellazioni }
}

export default function Stelle() {
  const ref = useRef(null)
  useEffect(() => {
    const tela = ref.current
    if (!tela) return
    const ctx = tela.getContext('2d')
    const { stelle, costellazioni } = cielo()
    const fermo = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    let L = 0, A = 0, id = 0, ultimo = 0

    const misura = () => {
      const dpr = Math.min(2, window.devicePixelRatio || 1)
      L = window.innerWidth; A = window.innerHeight
      tela.width = Math.round(L * dpr); tela.height = Math.round(A * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      disegna(performance.now())
    }
    const disegna = (t) => {
      const s = t / 1000
      ctx.clearRect(0, 0, L, A)
      for (const c of costellazioni) {
        const vivo = 0.75 + 0.25 * Math.sin(s * 0.35 + c.fase)
        ctx.strokeStyle = `rgba(190,205,235,${(0.2 * vivo).toFixed(3)})`
        ctx.lineWidth = 0.8
        ctx.beginPath()
        c.punti.forEach((p, i) => { if (i) ctx.lineTo(p.x * L, p.y * A); else ctx.moveTo(p.x * L, p.y * A) })
        if (c.ramo) { const p = c.punti[c.ramo.da]; ctx.moveTo(p.x * L, p.y * A); ctx.lineTo(c.ramo.x * L, c.ramo.y * A) }
        ctx.stroke()
        for (const p of [...c.punti, ...(c.ramo ? [c.ramo] : [])]) {
          ctx.fillStyle = `rgba(255,255,255,${(0.85 * vivo).toFixed(3)})`
          ctx.beginPath(); ctx.arc(p.x * L, p.y * A, 1.5, 0, Math.PI * 2); ctx.fill()
          ctx.fillStyle = `rgba(200,215,255,${(0.1 * vivo).toFixed(3)})`
          ctx.beginPath(); ctx.arc(p.x * L, p.y * A, 4.5, 0, Math.PI * 2); ctx.fill()
        }
      }
      for (const st of stelle) {
        const a = st.luce * (0.62 + 0.38 * Math.sin(s * st.passo + st.fase))
        ctx.fillStyle = st.calda ? `rgba(255,232,196,${a.toFixed(3)})` : `rgba(226,234,255,${a.toFixed(3)})`
        ctx.beginPath(); ctx.arc(st.x * L, st.y * A, st.raggio, 0, Math.PI * 2); ctx.fill()
      }
    }
    const giro = (t) => {
      if (t - ultimo > 80 && !document.hidden) { ultimo = t; disegna(t) }
      id = requestAnimationFrame(giro)
    }
    misura()
    window.addEventListener('resize', misura)
    if (!fermo) id = requestAnimationFrame(giro)
    return () => { window.removeEventListener('resize', misura); cancelAnimationFrame(id) }
  }, [])
  return <canvas ref={ref} className="gl-stelle" aria-hidden="true" />
}
