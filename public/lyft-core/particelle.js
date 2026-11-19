// Il nucleo di Jarvis: un ologramma dorato come nel film. Una sfera di archi che orbitano
// su piani diversi, frammenti di dati sulla superficie, polvere luminosa e un nucleo
// acceso al centro con una spirale. Reagisce alla voce: quando parla pulsa e si accende,
// quando pensa gira più veloce (e si tinge di viola), da spento è fioco e lento.
window.Particelle = (function () {
  const tela = document.getElementById('particelle')
  const ctx = tela.getContext('2d')
  const fermo = matchMedia('(prefers-reduced-motion: reduce)').matches
  const caso = (a, b) => a + Math.random() * (b - a)

  // rotazione di un punto 3D attorno agli assi X, Y, Z
  function ruota(p, rx, ry, rz) {
    let [x, y, z] = p
    let c = Math.cos(rx), s = Math.sin(rx); [y, z] = [y * c - z * s, y * s + z * c]
    c = Math.cos(ry); s = Math.sin(ry); [x, z] = [x * c + z * s, -x * s + z * c]
    c = Math.cos(rz); s = Math.sin(rz); [x, y] = [x * c - y * s, x * s + y * c]
    return [x, y, z]
  }

  // ——— Archi in orbita: raggio, piano inclinato, ampiezza, velocità, tratteggio ———
  const archi = []
  for (let i = 0; i < 90; i++) {
    const grande = i < 9
    archi.push({
      r: grande ? caso(0.95, 1.12) : caso(0.32, 0.98),
      rx: caso(0, Math.PI), rz: caso(0, Math.PI),
      inizio: caso(0, Math.PI * 2), ampiezza: grande ? caso(1.2, 2.6) : caso(0.25, 2.2),
      vel: caso(0.08, 0.45) * (Math.random() < 0.5 ? -1 : 1),
      spessore: grande ? caso(1.6, 3) : caso(0.6, 1.8),
      tratteggio: Math.random() < 0.45, tacche: Math.random() < 0.25,
      luce: caso(0.35, 1),
    })
  }
  // ——— Frammenti di dati: piccoli segmenti e rettangoli sulla superficie ———
  const frammenti = []
  for (let i = 0; i < 480; i++) {
    const u = caso(-1, 1), t = caso(0, Math.PI * 2), r = caso(0.55, 1.05), k = Math.sqrt(1 - u * u)
    frammenti.push({ p: [Math.cos(t) * k * r, u * r, Math.sin(t) * k * r], lung: caso(0.02, 0.09), ang: caso(0, Math.PI), tipo: Math.random() < 0.3 ? 'rett' : 'linea', luce: caso(0.3, 1), ritmo: caso(0.5, 3) })
  }
  // ——— Polvere luminosa ———
  const polvere = []
  for (let i = 0; i < 1600; i++) {
    const u = caso(-1, 1), t = caso(0, Math.PI * 2), r = Math.pow(Math.random(), 0.5) * 1.15, k = Math.sqrt(1 - u * u)
    polvere.push({ p: [Math.cos(t) * k * r, u * r, Math.sin(t) * k * r], fase: caso(0, 6.28), luce: caso(0.15, 0.8) })
  }

  let energia = 0, giro = 0, volume = () => 0, stato = 'spento', ultimo = 0
  // Dentro il prodotto il nucleo e' piccolo e in tinta neutra del tema: `tinta` (un colore solo, senza
  // aloni) la imposta la pagina; senza, resta l'ologramma dorato di origine.
  let tinta = null

  function adatta() {
    const dpr = window.devicePixelRatio || 1
    const { width, height } = tela.getBoundingClientRect()
    tela.width = Math.max(1, width * dpr)
    tela.height = Math.max(1, height * dpr)
  }
  new ResizeObserver(adatta).observe(tela)

  // oro come nel film; viola quando pensa
  const COLORE = { parla: [255, 196, 92], ascolto: [255, 170, 60], pensa: [190, 140, 255], spento: [150, 100, 40] }

  function disegna(ora) {
    const w = tela.width, h = tela.height
    const dt = Math.min(50, ora - (ultimo || ora)); ultimo = ora
    ctx.clearRect(0, 0, w, h)
    ctx.globalCompositeOperation = tinta ? 'source-over' : 'lighter'
    ctx.lineCap = 'round'
    const v = stato === 'spento' ? 0 : volume()
    energia += (Math.min(v * 4, 1) - energia) * 0.15
    const vel = { spento: 0.25, ascolto: 0.6, parla: 0.9, pensa: 2.2 }[stato] || 0.6
    if (!fermo) giro += dt / 1000 * vel
    const [R, G, B] = tinta || COLORE[stato] || COLORE.ascolto
    const fioco = stato === 'spento' ? 0.45 : 1
    const scala = Math.min(w, h) * 0.40 * (1 + energia * 0.07)
    const cx = w / 2, cy = h / 2
    const ry = giro * 0.35, rxG = 0.25 + Math.sin(giro * 0.2) * 0.1
    const proietta = q => { const k = 3 / (3 - q[2]); return [cx + q[0] * scala * k, cy + q[1] * scala * k, q[2]] }
    const dpr = window.devicePixelRatio || 1
    // in piccolo si disegna meno e piu' sottile, o diventa una macchia
    const rid = tinta ? Math.min(1, scala / (80 * dpr)) : 1, tratto = Math.max(0.5, rid)

    // alone di fondo
    const alone = ctx.createRadialGradient(cx, cy, 0, cx, cy, scala * 1.3)
    alone.addColorStop(0, `rgba(${R},${G},${B},${0.24 * fioco + energia * 0.15})`)
    alone.addColorStop(0.45, `rgba(${R},${G - 40},${B - 20},${0.05 * fioco})`)
    alone.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = alone
    if (!tinta) ctx.fillRect(0, 0, w, h)

    // archi in orbita: una passata larga e tenue (bagliore) e una sottile e viva
    for (const a of archi.slice(0, Math.round(9 + (archi.length - 9) * rid * rid))) {
      const passi = Math.max(8, Math.round(a.ampiezza * 28))
      const partenza = a.inizio + giro * a.vel * 2
      const pts = []
      for (let i = 0; i <= passi; i++) {
        const t = partenza + (i / passi) * a.ampiezza
        pts.push(proietta(ruota(ruota([Math.cos(t) * a.r, 0, Math.sin(t) * a.r], a.rx, 0, a.rz), rxG, ry, 0)))
      }
      for (const [larg, alfa] of tinta ? [[a.spessore, 1]] : [[a.spessore * 5, 0.11], [a.spessore * 2, 0.22], [a.spessore, 1]]) {
        ctx.lineWidth = larg * dpr * tratto * (1 + energia * 0.3)
        if (a.tacche && larg === a.spessore) ctx.setLineDash([1.2 * dpr, 3.5 * dpr]); else if (a.tratteggio && larg === a.spessore) ctx.setLineDash([6 * dpr, 7 * dpr]); else ctx.setLineDash([])
        ctx.beginPath()
        pts.forEach((p, i) => (i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])))
        const prof = (pts[pts.length >> 1][2] + 1.1) / 2.2
        ctx.strokeStyle = `rgba(${R},${G},${B},${alfa * a.luce * (0.35 + prof * 0.65) * fioco * (1 + energia * 0.6)})`
        ctx.stroke()
      }
    }
    ctx.setLineDash([])

    // frammenti di dati che lampeggiano
    for (const f of frammenti.slice(0, Math.round(frammenti.length * rid * rid))) {
      const q = proietta(ruota(f.p, rxG, ry, 0))
      const prof = (q[2] + 1.1) / 2.2
      const luce = f.luce * (0.5 + 0.5 * Math.sin(ora / 1000 * f.ritmo + f.ang * 5)) * (0.3 + prof * 0.7) * fioco
      ctx.strokeStyle = ctx.fillStyle = tinta ? `rgba(${R},${G},${B},${Math.min(1, luce * (1 + energia))})` : `rgba(${R},${G + 20},${B + 40},${Math.min(1, luce * (1 + energia))})`
      const L = f.lung * scala, cA = Math.cos(f.ang + giro * 0.3), sA = Math.sin(f.ang + giro * 0.3)
      if (f.tipo === 'rett') { ctx.lineWidth = 1.2 * dpr; ctx.strokeRect(q[0] - L / 2, q[1] - L / 4, L, L / 2) }
      else { ctx.lineWidth = 1.4 * dpr; ctx.beginPath(); ctx.moveTo(q[0] - cA * L / 2, q[1] - sA * L / 2); ctx.lineTo(q[0] + cA * L / 2, q[1] + sA * L / 2); ctx.stroke() }
    }

    // polvere
    for (const d of polvere.slice(0, Math.round(polvere.length * rid * rid))) {
      const q = proietta(ruota(d.p, rxG, ry * 1.2, 0))
      const prof = (q[2] + 1.2) / 2.4
      const a = Math.min(1, d.luce * 1.3 * (0.4 + 0.6 * Math.sin(ora / 700 + d.fase)) * prof * fioco)
      ctx.fillStyle = tinta ? `rgba(${R},${G},${B},${a})` : `rgba(${R},${G + 30},${B + 60},${a})`
      const s = (0.8 + prof * 1.4) * dpr
      ctx.fillRect(q[0], q[1], s, s)
    }

    // nucleo: spirale luminosa che gira e si gonfia con la voce
    const rn = scala * (0.14 + energia * 0.06)
    for (let k = 0; k < 3; k++) {
      ctx.beginPath()
      for (let i = 0; i <= 60; i++) {
        const t = i / 60, ang = giro * 3 + k * 2.09 + t * Math.PI * 3.2
        const r = rn * (0.15 + t)
        i ? ctx.lineTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.8) : ctx.moveTo(cx + Math.cos(ang) * r, cy + Math.sin(ang) * r * 0.8)
      }
      ctx.lineWidth = 2 * dpr * tratto
      ctx.strokeStyle = tinta ? `rgba(${R},${G},${B},${0.55 * fioco + energia * 0.4})` : `rgba(255,${210 + k * 10},${140 + k * 30},${0.55 * fioco + energia * 0.4})`
      ctx.stroke()
    }
    const cuore = ctx.createRadialGradient(cx, cy, 0, cx, cy, rn * 1.4)
    cuore.addColorStop(0, `rgba(255,245,220,${0.9 * fioco})`)
    cuore.addColorStop(0.3, `rgba(${R},${G},${B},${0.45 * fioco + energia * 0.4})`)
    cuore.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = cuore
    if (!tinta) { ctx.beginPath(); ctx.arc(cx, cy, rn * 1.4, 0, Math.PI * 2); ctx.fill() }

    requestAnimationFrame(disegna)
  }
  requestAnimationFrame(disegna)

  return {
    impostaVolume(fn) { volume = fn },
    impostaStato(s) { stato = s },
    impostaTinta(rgb) { tinta = Array.isArray(rgb) && rgb.length === 3 ? rgb : null },
  }
})()
