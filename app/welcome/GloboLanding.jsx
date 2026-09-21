'use client'

// Il globo dell'apertura della landing (Marino, 21 set 2026: «sotto a quello che hai scritto,
// spostato verso destra, il mondo che gira con le sessioni e gli ordini»).
//
// Lo stesso aspetto del globo della Dashboard (DashboardGlobe.jsx): sfera pastello dal menta
// all'azzurro, terre a esagoni color acqua, celle blu dove c'e' qualcuno sul sito, un punto nero
// con un'onda dove arriva un ordine. Ma NON legge dati: e' pubblico, quindi gira su un negozio
// d'esempio generato qui, e la didascalia lo dice.
//
// E' solo da guardare: niente trascinamenti (sul telefono il dito deve poter scorrere la pagina),
// si ferma quando esce dallo schermo, e non gira per chi ha chiesto meno movimento.
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import st from './landing.module.css'

const COUNTRIES_URL = '/geo/countries-110m.geojson'

// Dove sono i visitatori del negozio d'esempio: soprattutto Italia, poi Europa, qualcuno lontano.
// [citta', lat, lng, peso]
const CITTA = [
  ['Milano', 45.46, 9.19, 9], ['Roma', 41.9, 12.5, 8], ['Napoli', 40.85, 14.27, 5], ['Torino', 45.07, 7.69, 4],
  ['Bologna', 44.49, 11.34, 4], ['Firenze', 43.77, 11.25, 4], ['Bari', 41.12, 16.87, 3], ['Palermo', 38.12, 13.36, 3],
  ['Verona', 45.44, 10.99, 2], ['Padova', 45.41, 11.88, 2], ['Genova', 44.41, 8.93, 2], ['Catania', 37.5, 15.09, 2],
  ['Paris', 48.86, 2.35, 3], ['Madrid', 40.42, -3.7, 2], ['Barcelona', 41.39, 2.17, 2], ['Berlin', 52.52, 13.4, 2],
  ['München', 48.14, 11.58, 2], ['Wien', 48.21, 16.37, 1], ['Zürich', 47.37, 8.54, 2], ['London', 51.51, -0.13, 2],
  ['Amsterdam', 52.37, 4.9, 1], ['Bruxelles', 50.85, 4.35, 1], ['Lisboa', 38.72, -9.14, 1], ['New York', 40.71, -74.0, 1],
  ['Dubai', 25.2, 55.27, 1],
]
const PESO = CITTA.reduce((a, c) => a + c[3], 0)
function unaCitta() {
  let r = Math.random() * PESO
  for (const c of CITTA) { r -= c[3]; if (r <= 0) return c }
  return CITTA[0]
}
// un po' di rumore intorno alla citta', cosi' le celle non cadono sempre nello stesso esagono
const vicino = (c) => ({ lat: c[1] + (Math.random() - 0.5) * 1.2, lng: c[2] + (Math.random() - 0.5) * 1.6, citta: c[0] })

export default function GloboLanding({ testi, lingua }) {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [lato, setLato] = useState(0)
  const [paesi, setPaesi] = useState([])
  const [sessioni, setSessioni] = useState(() => Array.from({ length: 34 }, () => ({ ...vicino(unaCitta()), count: 1 })))
  const [ordini, setOrdini] = useState([])
  const [ordiniOggi, setOrdiniOggi] = useState(27)
  const [ultimo, setUltimo] = useState(null)
  const calmo = useMemo(() => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches, [])

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const ro = new ResizeObserver(() => setLato(Math.round(el.clientWidth) || 520))
    ro.observe(el)
    setLato(Math.round(el.clientWidth) || 520)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let vivo = true
    fetch(COUNTRIES_URL).then(r => r.json()).then(d => { if (vivo) setPaesi(d.features || []) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  // Il negozio d'esempio vive: qualcuno arriva, qualcuno se ne va, ogni tanto qualcuno compra.
  useEffect(() => {
    if (calmo) return
    const visite = setInterval(() => {
      setSessioni(s => {
        const resta = s.filter(() => Math.random() > 0.12)
        const nuove = Array.from({ length: 2 + Math.floor(Math.random() * 4) }, () => ({ ...vicino(unaCitta()), count: 1 }))
        return [...resta, ...nuove].slice(-44)
      })
    }, 1600)
    const acquisti = setInterval(() => {
      const c = unaCitta()
      const o = { ...vicino(c), lat: c[1], lng: c[2], euro: 38 + Math.round(Math.random() * 140), t: Date.now() }
      setOrdini(v => [...v.filter(x => Date.now() - x.t < 12000), o])
      setOrdiniOggi(n => n + 1)
      setUltimo(o)
    }, 3800)
    return () => { clearInterval(visite); clearInterval(acquisti) }
  }, [calmo])

  // Fuori dallo schermo non disegna: three.js altrimenti consuma anche dove nessuno guarda.
  useEffect(() => {
    const el = wrapRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([v]) => {
      const g = globeRef.current
      if (!g) return
      try { v.isIntersecting ? g.resumeAnimation() : g.pauseAnimation() } catch {}
    })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  const avvia = () => {
    const g = globeRef.current
    if (!g) return
    try {
      const c = g.controls()
      c.enableZoom = false; c.enablePan = false; c.enableRotate = false
      c.autoRotate = !calmo; c.autoRotateSpeed = 0.35
    } catch {}
    try { g.pointOfView({ lat: 34, lng: 14, altitude: 1.9 }, 0) } catch {}
  }

  const sfera = useMemo(() => {
    if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ color: '#dfeef2' })
    const tela = document.createElement('canvas')
    tela.width = 8; tela.height = 512
    const ctx = tela.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#eaf6ee'); g.addColorStop(0.45, '#e2f0f1'); g.addColorStop(1, '#cbdff7')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512)
    const mappa = new THREE.CanvasTexture(tela)
    mappa.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: mappa })
  }, [])

  const coloreTerre = useMemo(() => {
    const mischia = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t))
    const NORD = [132, 219, 198], CENTRO = [127, 208, 203], SUD = [142, 178, 230]
    const m = new Map()
    for (const f of paesi) {
      let somma = 0, n = 0
      const scendi = (c) => { if (typeof c[0] === 'number') { somma += c[1]; n++ } else c.forEach(scendi) }
      try { scendi(f.geometry.coordinates) } catch {}
      const t = Math.min(1, Math.max(0, (70 - (n ? somma / n : 20)) / 110))
      const c = t < 0.5 ? mischia(NORD, CENTRO, t / 0.5) : mischia(CENTRO, SUD, (t - 0.5) / 0.5)
      m.set(f, `rgb(${c[0]},${c[1]},${c[2]})`)
    }
    return m
  }, [paesi])

  const intero = (n) => new Intl.NumberFormat(lingua).format(n)
  const freschi = ordini.filter(o => Date.now() - o.t < 4500)

  return (
    <div className={st.globo}>
      <div ref={wrapRef} aria-hidden="true" style={{ width: '100%', aspectRatio: '1 / 1', pointerEvents: 'none' }}>
        <Globe
          ref={globeRef}
          onGlobeReady={avvia}
          width={lato}
          height={lato}
          backgroundColor="rgba(0,0,0,0)"
          globeMaterial={sfera}
          showAtmosphere
          atmosphereColor="#dbe7f6"
          atmosphereAltitude={0.1}
          hexPolygonsData={paesi}
          hexPolygonResolution={3}
          hexPolygonMargin={0.22}
          hexPolygonColor={f => coloreTerre.get(f) || 'rgb(127,208,203)'}
          hexPolygonAltitude={0.003}
          hexBinPointsData={sessioni}
          hexBinPointLat="lat"
          hexBinPointLng="lng"
          hexBinPointWeight="count"
          hexBinResolution={3}
          hexMargin={0.22}
          hexAltitude={0.006}
          hexTopColor={() => '#3d8fe3'}
          hexSideColor={() => '#3d8fe3'}
          hexTransitionDuration={600}
          pointsData={ordini}
          pointLat="lat"
          pointLng="lng"
          pointAltitude={0.012}
          pointRadius={0.34}
          pointColor={() => '#1d1d1d'}
          ringsData={freschi}
          ringLat="lat"
          ringLng="lng"
          ringColor={() => (t) => `rgba(29,29,31,${1 - t})`}
          ringMaxRadius={3.4}
          ringPropagationSpeed={2.2}
          ringRepeatPeriod={1100}
        />
      </div>
      {/* I due numeri, come nella Dashboard: chi c'e' adesso e quanti hanno comprato oggi. */}
      <div className={st.globoNumeri}>
        <div><span>{testi.sessioni}</span><strong>{intero(sessioni.length)}</strong></div>
        <div><span>{testi.ordini}</span><strong>{intero(ordiniOggi)}</strong></div>
        {ultimo && <p key={ultimo.t} className={st.globoUltimo}>{testi.nuovo} · {ultimo.citta} · €{intero(ultimo.euro)}</p>}
      </div>
      <p className={st.globoNota}>{testi.nota}</p>
    </div>
  )
}
