'use client'

// Il globo dello schermo generale: sfera nera, terre a puntini chiari, un alone intorno.
//  · puntini azzurri  = chi e' sui siti in questo momento (tutti i negozi insieme)
//  · puntini oro      = da dove sono partiti gli ordini di oggi
//  · archi oro        = i flussi dell'ultima mezz'ora: da chi ha comprato alla sede del negozio,
//                       vivi appena arrivano e via via piu' tenui
//  · anello + «+€155» = un ordine appena arrivato: il globo ci si porta sopra, poi riprende
// NON fa il giro completo: quasi tutto succede in Italia, e con la rotazione intera per due terzi
// del tempo si guardava l'altra faccia del mondo (visto in produzione il 27 nov: Nord America in
// primo piano, Italia sparita). Dondola piano intorno all'Europa: e' sempre in moto, ma cio' che
// conta resta sempre in vista.
// E' un componente a se' (non DashboardGlobe): quello e' il globo pastello della Dashboard di un
// negozio e legge da solo i dati di QUEL negozio; questo e' scuro e riceve i dati gia' sommati.
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'

const COUNTRIES_URL = '/geo/countries-110m.geojson'
// A questa distanza la sfera occupa il 70% del riquadro: intorno resta spazio per l'alone, che
// cosi' non viene MAI tagliato dai bordi del disegno (Marino, 27 nov). La grandezza a schermo la
// decide il riquadro (.gl-globo), non la distanza: avvicinando qui si taglierebbe di nuovo l'alone.
const CASA = { lat: 41, lng: 12, altitude: 2.2 }   // l'Italia al centro: e' da li' che parte quasi tutto

const ORO = '#f6cf6b'

export default function GloboLive({ visitatori = [], luoghi = [], impulsi = [], flussi = [], sedi = [] }) {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [lato, setLato] = useState(600)
  const [terre, setTerre] = useState({ features: [] })

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const misura = () => setLato(Math.max(240, Math.min(el.clientWidth, el.clientHeight) || 600))
    const ro = new ResizeObserver(misura)
    ro.observe(el); misura()
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let vivo = true
    fetch(COUNTRIES_URL).then(r => r.json()).then(d => { if (vivo) setTerre(d) }).catch(() => {})
    return () => { vivo = false }
  }, [])

  const sfera = useMemo(() => new THREE.MeshBasicMaterial({ color: '#1b1e25' }), [])

  // Il dondolio: la longitudine va e viene di ±27° intorno all'Italia (un'andata e ritorno in ~100 s),
  // la latitudine respira appena. Si ferma mentre si guarda un ordine o si trascina, poi riprende
  // da dove sarebbe arrivato, con un passaggio morbido.
  const moto = useRef({ fase: 0, fermoFino: 0, rientroFino: 0, ultimoT: 0 })
  const metaDondolio = (fase) => ({ lat: CASA.lat + 5 * Math.sin(fase * 0.6), lng: CASA.lng + 27 * Math.sin(fase), altitude: CASA.altitude })
  const pronto = () => {
    try {
      globeRef.current.pointOfView(CASA, 0)
      const c = globeRef.current.controls()
      c.autoRotate = false; c.enableZoom = false; c.enablePan = false
      c.addEventListener('start', () => { moto.current.fermoFino = Infinity })
      c.addEventListener('end', () => { moto.current.fermoFino = performance.now() + 3000 })
    } catch {}
  }
  useEffect(() => {
    const calmo = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (calmo) return
    let id
    const passo = (t) => {
      const m = moto.current, g = globeRef.current
      const dt = m.ultimoT ? Math.min(100, t - m.ultimoT) : 0
      m.ultimoT = t
      if (g && t >= m.fermoFino) {
        if (m.fermoFino) { m.fermoFino = 0; m.rientroFino = t + 1400; try { g.pointOfView(metaDondolio(m.fase), 1400) } catch {} }
        else if (t >= m.rientroFino) { m.fase += dt * (2 * Math.PI / 100_000); try { g.pointOfView(metaDondolio(m.fase), 0) } catch {} }
      }
      id = requestAnimationFrame(passo)
    }
    id = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(id)
  }, [])

  // Un ordine nuovo: il globo ci si porta sopra e resta qualche secondo a guardarlo.
  const ultimo = impulsi.length ? impulsi[impulsi.length - 1] : null
  useEffect(() => {
    if (!ultimo || ultimo.lat == null || !globeRef.current) return
    moto.current.fermoFino = performance.now() + 6000
    try { globeRef.current.pointOfView({ lat: ultimo.lat, lng: ultimo.lng, altitude: 2.08 }, 1100) } catch {}
  }, [ultimo?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const punti = useMemo(() => [
    ...visitatori.map(p => ({ lat: p.lat, lng: p.lng, r: Math.min(0.5, 0.16 + Math.sqrt(p.count || 1) * 0.07), c: '#6fd3ff', a: 0.008, et: `${p.label || ''} · ${p.count} ora sul sito` })),
    ...luoghi.map(p => ({ lat: p.lat, lng: p.lng, r: Math.min(0.42, 0.14 + Math.sqrt(p.n || 1) * 0.06), c: ORO, a: 0.012, et: `${p.n} ordini oggi` })),
    ...sedi.map(p => ({ lat: p.lat, lng: p.lng, r: 0.3, c: '#fff3cf', a: 0.016, et: p.nome })),
  ], [visitatori, luoghi, sedi])
  // l'arco parte tenue dal cliente e si accende verso il negozio; piu' l'ordine e' vecchio, meno si vede
  const coloreFlusso = useMemo(() => (d) => { const v = 1 - 0.7 * (d.eta || 0); return [`rgba(246,207,107,${(0.35 * v).toFixed(2)})`, `rgba(255,232,160,${(1 * v).toFixed(2)})`] }, [])

  const conPunto = useMemo(() => impulsi.filter(p => p.lat != null && p.lng != null), [impulsi])
  const etichetta = useMemo(() => (d) => {
    const el = document.createElement('div')
    el.className = 'gl-impulso'
    el.innerHTML = `<span class="gl-impulso-euro">+€${d.euro}</span><span class="gl-impulso-punto"></span>`
    return el
  }, [])

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <Globe
        ref={globeRef}
        onGlobeReady={pronto}
        width={lato}
        height={lato}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={sfera}
        showAtmosphere
        atmosphereColor="#e6ecf7"
        atmosphereAltitude={0.22}
        hexPolygonsData={terre.features}
        hexPolygonResolution={3}
        hexPolygonMargin={0.62}
        hexPolygonUseDots
        hexPolygonColor={() => 'rgba(255,255,255,0.62)'}
        hexPolygonAltitude={0.002}
        pointsData={punti}
        pointLat="lat"
        pointLng="lng"
        pointAltitude="a"
        pointRadius="r"
        pointColor="c"
        pointLabel="et"
        pointsMerge={false}
        ringsData={conPunto}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(255,214,110,${Math.max(0, 1 - t)})`}
        ringMaxRadius={5}
        ringPropagationSpeed={3}
        ringRepeatPeriod={800}
        arcsData={flussi}
        arcColor={coloreFlusso}
        // archi alti e spessi: gli ordini sono quasi tutti dentro l'Italia, e un arco "giusto" su
        // quelle distanze sarebbe un trattino invisibile
        arcAltitudeAutoScale={1.5}
        arcStroke={0.7}
        arcDashLength={0.6}
        arcDashGap={0.25}
        arcDashAnimateTime={2200}
        arcsTransitionDuration={0}
        htmlElementsData={conPunto}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.02}
        htmlElement={etichetta}
      />
    </div>
  )
}
