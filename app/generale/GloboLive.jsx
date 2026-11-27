'use client'

// Il globo dello schermo generale: sfera nera, terre a puntini chiari, un alone intorno.
//  · puntini azzurri  = chi e' sui siti in questo momento (tutti i negozi insieme)
//  · puntini bianchi  = da dove sono partiti gli ordini di oggi
//  · anello + «+€155» = un ordine appena arrivato: il globo ci si gira sopra, poi riprende a girare
// E' un componente a se' (non DashboardGlobe): quello e' il globo pastello della Dashboard di un
// negozio e legge da solo i dati di QUEL negozio; questo e' scuro e riceve i dati gia' sommati.
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'

const COUNTRIES_URL = '/geo/countries-110m.geojson'
const CASA = { lat: 40, lng: 12, altitude: 1.9 }   // l'Italia al centro: e' da li' che parte quasi tutto

export default function GloboLive({ visitatori = [], luoghi = [], impulsi = [] }) {
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

  const sfera = useMemo(() => new THREE.MeshBasicMaterial({ color: '#060607' }), [])

  // Gira sempre; dopo un trascinamento riparte da solo.
  const gira = (acceso = true) => {
    try {
      const c = globeRef.current.controls()
      c.autoRotate = acceso; c.autoRotateSpeed = 0.35; c.enableZoom = false; c.enablePan = false
      if (!c.__riparte) { c.__riparte = true; c.addEventListener('end', () => { c.autoRotate = true }) }
    } catch {}
  }
  const pronto = () => { try { globeRef.current.pointOfView(CASA, 0) } catch {}; gira(true) }

  // Un ordine nuovo: il globo ci si porta sopra e si ferma qualche secondo a guardarlo.
  const ultimo = impulsi.length ? impulsi[impulsi.length - 1] : null
  useEffect(() => {
    if (!ultimo || ultimo.lat == null || !globeRef.current) return
    gira(false)
    try { globeRef.current.pointOfView({ lat: ultimo.lat, lng: ultimo.lng, altitude: 1.75 }, 1100) } catch {}
    const id = setTimeout(() => gira(true), 6000)
    return () => clearTimeout(id)
  }, [ultimo?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  const punti = useMemo(() => [
    ...visitatori.map(p => ({ lat: p.lat, lng: p.lng, r: Math.min(0.5, 0.16 + Math.sqrt(p.count || 1) * 0.07), c: '#6fd3ff', a: 0.008, et: `${p.label || ''} · ${p.count} ora sul sito` })),
    ...luoghi.map(p => ({ lat: p.lat, lng: p.lng, r: Math.min(0.42, 0.14 + Math.sqrt(p.n || 1) * 0.06), c: '#ffffff', a: 0.012, et: `${p.n} ordini oggi` })),
  ], [visitatori, luoghi])

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
        atmosphereColor="#cfd6e4"
        atmosphereAltitude={0.16}
        hexPolygonsData={terre.features}
        hexPolygonResolution={3}
        hexPolygonMargin={0.62}
        hexPolygonUseDots
        hexPolygonColor={() => 'rgba(255,255,255,0.42)'}
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
        ringColor={() => (t) => `rgba(255,255,255,${Math.max(0, 1 - t)})`}
        ringMaxRadius={5}
        ringPropagationSpeed={3}
        ringRepeatPeriod={800}
        htmlElementsData={conPunto}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.02}
        htmlElement={etichetta}
      />
    </div>
  )
}
