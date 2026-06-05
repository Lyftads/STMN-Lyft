'use client'

// Globo decorativo per l'hero della landing (stile Live View del software):
// sfera quasi nera, continenti a puntini, sessioni live verde-acqua, e archi
// VIOLA/BLU/ARANCIO che partono dalle piattaforme (Meta, Google, GA4) e
// "atterrano" sul globo. Nessun dato reale: è una vetrina animata.
//
// Caricato via next/dynamic { ssr:false } dalla landing → three.js non blocca
// il primo paint e resta in un chunk a parte.
import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'

const COUNTRIES_URL = '/geo/countries-110m.geojson'

// destinazioni "sessioni" sparse (lat/lng) — atterraggi sul globo
const DEST = [
  [41.9, 12.5], [48.8, 2.3], [40.4, -3.7], [51.5, -0.1], [52.5, 13.4],
  [45.5, 9.2], [40.7, -74], [34, -118], [25.3, 55.3], [35.7, 139.7],
  [1.35, 103.8], [-33.9, 151.2], [19.4, -99.1], [-23.5, -46.6], [55.7, 37.6],
]
// "sorgenti" piattaforme
const SRC = {
  meta: { lat: 37, lng: -95, color: '#2997ff' },   // US
  google: { lat: 50, lng: 8, color: '#ff6d4d' },    // EU
  ga4: { lat: 22, lng: 78, color: '#ff9f0a' },       // Asia
}

export default function LandingGlobe() {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [countries, setCountries] = useState({ features: [] })

  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth || 600, h: el.clientHeight || 600 }))
    ro.observe(el); setSize({ w: el.clientWidth || 600, h: el.clientHeight || 600 })
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    let alive = true
    fetch(COUNTRIES_URL).then(r => r.json()).then(d => { if (alive) setCountries(d) }).catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    try {
      const mat = g.globeMaterial()
      mat.color = new THREE.Color('#070710'); mat.emissive = new THREE.Color('#0b0b1c')
      mat.emissiveIntensity = 0.9; mat.shininess = 4
    } catch {}
    try {
      const c = g.controls()
      c.autoRotate = true; c.autoRotateSpeed = 0.6; c.enableZoom = false; c.enablePan = false
    } catch {}
    try { g.pointOfView({ lat: 25, lng: 6, altitude: 2.1 }, 0) } catch {}
  }, [size.w])

  // punti (sessioni live) + archi dalle piattaforme alle destinazioni
  const points = DEST.map(([lat, lng]) => ({ lat, lng }))
  const arcs = []
  const keys = Object.keys(SRC)
  DEST.forEach(([lat, lng], i) => {
    const s = SRC[keys[i % keys.length]]
    arcs.push({ startLat: s.lat, startLng: s.lng, endLat: lat, endLng: lng, color: s.color })
  })

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%' }}>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor="#bf5af2"
        atmosphereAltitude={0.3}
        hexPolygonsData={countries.features}
        hexPolygonResolution={3}
        hexPolygonMargin={0.22}
        hexPolygonUseDots
        hexPolygonColor={() => 'rgba(105,212,255,0.5)'}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => '#34e7b0'}
        pointAltitude={0.02}
        pointRadius={0.32}
        pointResolution={6}
        ringsData={points}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t => `rgba(52,231,176,${1 - t})`)}
        ringMaxRadius={3.2}
        ringPropagationSpeed={1.3}
        ringRepeatPeriod={1600}
        arcsData={arcs}
        arcColor={d => [`${d.color}00`, `${d.color}dd`, `${d.color}00`]}
        arcStroke={0.5}
        arcDashLength={0.5}
        arcDashGap={0.25}
        arcDashAnimateTime={2200}
        arcAltitudeAutoScale={0.5}
      />
    </div>
  )
}
