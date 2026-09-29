'use client'

// Il globo dell'apertura della landing — dal 29 set 2026 IDENTICO a quello di unitedcarriers.com
// (Marino: «il mondo deve essere uguale a quello dell'esempio»): sfera nera, terre a puntini
// bianchi, la luce dell'alba arancio sul bordo in alto a destra, il blu dell'atmosfera sotto,
// spilli arancio con l'etichetta della citta' in mono, archi arancio dal negozio verso chi compra.
// Ma NON legge dati: e' pubblico, quindi gira su un negozio d'esempio generato qui, e la
// didascalia lo dice.
//
// E' solo da guardare: niente trascinamenti (sul telefono il dito deve poter scorrere la pagina),
// si ferma quando esce dallo schermo, e non gira per chi ha chiesto meno movimento.
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import st from './landing.module.css'

const COUNTRIES_URL = '/geo/countries-110m.geojson'
const ARANCIO = '#ff5500'
// Il negozio d'esempio spedisce da qui: gli archi partono da Milano.
const NEGOZIO = { lat: 45.46, lng: 9.19 }

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
      // Gli ultimi ordini restano sul globo (spillo, etichetta, arco) per una ventina di secondi.
      setOrdini(v => [...v.filter(x => Date.now() - x.t < 20000), o].slice(-7))
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
    // Le luci dell'esempio: il sole arancio dell'alba da dietro, in alto a destra (accende il bordo
    // e i puntini vicino al bordo); il blu dell'atmosfera da sotto; un filo di luce ambiente.
    try {
      // (29 set sera: prima il sole stava davanti e il mondo veniva tutto arancio; Marino vuole le
      // terre bianche come nell'esempio. Ora la luce piena e' bianca, il sole arancio sta DIETRO e
      // tocca solo il bordo; l'arancio grande del bordo lo fa .globoSole in CSS.)
      const ambiente = new THREE.AmbientLight(0xffffff, 1.35)
      const sole = new THREE.DirectionalLight(0xff6a2a, 2.4); sole.position.set(180, 160, -220)
      const blu = new THREE.DirectionalLight(0x3a6bff, 1.1); blu.position.set(-40, -180, 60)
      g.lights([ambiente, sole, blu])
    } catch {}
    // Il globo e' largo quasi tutto lo schermo: sui Mac retina (densita' 2) sarebbero 4 volte i
    // pixel da ridisegnare a ogni fotogramma. A 1,25 i puntini restano nitidi e la pagina scorre.
    try { g.renderer().setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1)) } catch {}
    // L'Italia al centro della vista, vicino: il globo e' tagliato dal bordo destro dello schermo.
    try { g.pointOfView({ lat: 34, lng: 14, altitude: 1.55 }, 0) } catch {}
  }

  // La sfera: nera, un filo di blu verso sud. Phong e non Basic: cosi' le luci la scolpiscono.
  const sfera = useMemo(() => {
    if (typeof document === 'undefined') return new THREE.MeshPhongMaterial({ color: '#0b0e15' })
    const tela = document.createElement('canvas')
    tela.width = 8; tela.height = 512
    const ctx = tela.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#171b24'); g.addColorStop(0.55, '#10131a'); g.addColorStop(1, '#0d1a3a')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512)
    const mappa = new THREE.CanvasTexture(tela)
    mappa.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshPhongMaterial({ map: mappa, shininess: 6, specular: new THREE.Color('#1a2033') })
  }, [])

  const intero = (n) => new Intl.NumberFormat(lingua).format(n)
  const freschi = ordini.filter(o => Date.now() - o.t < 4500)

  // L'etichetta della citta' in mono, in un riquadro nero, sopra allo spillo: come i paesi sul loro globo.
  const etichetta = (d) => {
    const el = document.createElement('div')
    el.className = st.globoEtichetta
    el.textContent = d.citta
    return el
  }

  return (
    <div className={st.globo}>
      <div className={st.globoTela}>
        {/* Il sole dell'alba dietro al bordo in alto a destra, come nell'esempio. */}
        <div className={st.globoSole} aria-hidden="true" />
        <div ref={wrapRef} aria-hidden="true" style={{ width: '100%', aspectRatio: '1 / 1', pointerEvents: 'none' }}>
          <Globe
            ref={globeRef}
            onGlobeReady={avvia}
            width={lato}
            height={lato}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={sfera}
            showAtmosphere
            atmosphereColor="#2b6cff"
            atmosphereAltitude={0.19}
            hexPolygonsData={paesi}
            hexPolygonResolution={3}
            hexPolygonMargin={0.4}
            hexPolygonColor={() => 'rgba(236,238,242,.92)'}
            hexPolygonAltitude={0.004}
            hexBinPointsData={sessioni}
            hexBinPointLat="lat"
            hexBinPointLng="lng"
            hexBinPointWeight="count"
            hexBinResolution={3}
            hexMargin={0.18}
            hexAltitude={d => 0.02 + Math.min(4, d.sumWeight) * 0.018}
            hexTopColor={() => '#5aa2ff'}
            hexSideColor={() => 'rgba(41,151,255,.75)'}
            hexTransitionDuration={600}
            pointsData={ordini}
            pointLat="lat"
            pointLng="lng"
            pointAltitude={0.09}
            pointRadius={0.42}
            pointColor={() => ARANCIO}
            ringsData={freschi}
            ringLat="lat"
            ringLng="lng"
            ringColor={() => (t) => `rgba(255,95,20,${1 - t})`}
            ringMaxRadius={5.5}
            ringPropagationSpeed={2.2}
            ringRepeatPeriod={1100}
            arcsData={ordini}
            arcStartLat={() => NEGOZIO.lat}
            arcStartLng={() => NEGOZIO.lng}
            arcEndLat="lat"
            arcEndLng="lng"
            arcColor={() => ['rgba(255,85,0,0)', 'rgba(255,120,40,.95)']}
            arcStroke={0.35}
            arcAltitudeAutoScale={0.32}
            arcDashLength={0.55}
            arcDashGap={0.2}
            arcDashAnimateTime={1900}
            arcsTransitionDuration={0}
            htmlElementsData={ordini}
            htmlLat="lat"
            htmlLng="lng"
            htmlAltitude={0.1}
            htmlElement={etichetta}
            htmlTransitionDuration={0}
          />
        </div>
      </div>
      {/* I due numeri, come nella Dashboard: chi c'e' adesso e quanti hanno comprato oggi. */}
      <div className={st.globoNumeri} data-tappa="inizio">
        <div><span>{testi.sessioni}</span><strong>{intero(sessioni.length)}</strong></div>
        <div><span>{testi.ordini}</span><strong>{intero(ordiniOggi)}</strong></div>
        {ultimo && <p key={ultimo.t} className={st.globoUltimo}>{testi.nuovo} · {ultimo.citta} · €{intero(ultimo.euro)}</p>}
      </div>
      <p className={st.globoNota}>{testi.nota}</p>
    </div>
  )
}
