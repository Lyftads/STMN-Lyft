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
      g.lights([new THREE.AmbientLight(0xffffff, 1.6)])
    } catch {}
    // La luce come su unitedcarriers.com (Marino, 29 set: «l'arancione e' impostato diversamente,
    // deve essere identico»): non una lampada, ma un BORDO acceso — arancio in cima, che scende nel
    // blu verso il basso — e sotto un bagliore blu che bagna la parte bassa della sfera. E' calcolato
    // rispetto a chi guarda, quindi resta fermo mentre il mondo gira.
    try {
      const scena = g.scene()
      const R = g.getGlobeRadius ? g.getGlobeRadius() : 100
      const vert = `varying vec3 vN; varying vec3 vV;
        void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); vN = normalize(normalMatrix * normal); vV = normalize(-mv.xyz); gl_Position = projectionMatrix * mv; }`
      const tinta = `vec3 tinta(vec3 n){ float t = smoothstep(-0.15, 0.75, n.y * 0.9 - n.x * 0.25); return mix(vec3(0.2, 0.33, 0.78), vec3(0.85, 0.42, 0.2), t); }`
      // il bordo sulla sfera: fresnel stretto, piu' la luce blu che sale dal basso
      const bordo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.004, 96, 96), new THREE.ShaderMaterial({
        vertexShader: vert, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        fragmentShader: `varying vec3 vN; varying vec3 vV; ${tinta}
          void main(){ float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.6);
            float basso = smoothstep(-0.1, -0.95, vN.y) * pow(1.0 - max(dot(vN, vV), 0.0), 1.6) * 0.5;
            vec3 c = tinta(vN) * f * 0.75 + vec3(0.1, 0.2, 0.6) * basso * 0.6;
            gl_FragColor = vec4(c, 1.0); }`,
      }))
      // l'alone fuori dal bordo, dello stesso colore, che sfuma nel cielo
      const alone = new THREE.Mesh(new THREE.SphereGeometry(R * 1.16, 96, 96), new THREE.ShaderMaterial({
        vertexShader: vert, side: THREE.BackSide, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
        fragmentShader: `varying vec3 vN; varying vec3 vV; ${tinta}
          // d = 0 sul contorno dell'alone, 0.51 sul bordo del mondo (1/1.16): piu' luce attaccata al
          // mondo, niente verso fuori — cosi' l'alone parte dal bordo e sfuma, senza stacchi.
          void main(){ float d = max(0.0, dot(-vN, vV)); float f = pow(clamp(d / 0.51, 0.0, 1.0), 2.2) * 0.32; gl_FragColor = vec4(tinta(vN) * f, 1.0); }`,
      }))
      scena.add(bordo); scena.add(alone)
    } catch {}
    // Il globo e' largo quasi tutto lo schermo: sui Mac retina (densita' 2) sarebbero 4 volte i
    // pixel da ridisegnare a ogni fotogramma. A 1,25 i puntini restano nitidi e la pagina scorre.
    try { g.renderer().setPixelRatio(Math.min(1.25, window.devicePixelRatio || 1)) } catch {}
    // L'Italia al centro della vista, vicino: il globo e' tagliato dal bordo destro dello schermo.
    // La sfera occupa il 72% della tela: il resto e' spazio per l'alone, che cosi' non viene tagliato.
    try { g.pointOfView({ lat: 34, lng: 14, altitude: 2.14 }, 0) } catch {}
  }

  // La sfera: nera, un filo di blu verso sud. Phong e non Basic: cosi' le luci la scolpiscono.
  const sfera = useMemo(() => {
    if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ color: '#07080d' })
    const tela = document.createElement('canvas')
    tela.width = 8; tela.height = 512
    const ctx = tela.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#08090e'); g.addColorStop(0.6, '#07080d'); g.addColorStop(1, '#0a1230')
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512)
    const mappa = new THREE.CanvasTexture(tela)
    mappa.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: mappa })
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
        <div ref={wrapRef} aria-hidden="true" style={{ width: '100%', aspectRatio: '1 / 1', pointerEvents: 'none' }}>
          <Globe
            ref={globeRef}
            onGlobeReady={avvia}
            width={lato}
            height={lato}
            backgroundColor="rgba(0,0,0,0)"
            globeMaterial={sfera}
            showAtmosphere={false}
            hexPolygonsData={paesi}
            hexPolygonResolution={3}
            hexPolygonMargin={0.66}
            hexPolygonColor={() => 'rgba(236,238,242,.92)'}
            hexPolygonAltitude={0.004}
            hexBinPointsData={sessioni}
            hexBinPointLat="lat"
            hexBinPointLng="lng"
            hexBinPointWeight="count"
            hexBinResolution={4}
            hexMargin={0.2}
            hexAltitude={d => 0.012 + Math.min(4, d.sumWeight) * 0.01}
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
