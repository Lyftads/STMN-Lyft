'use client'

// Globo "Live View" stile Shopify BFCM: sfera quasi nera, alone luminoso dietro
// (gestito in CSS), continenti a puntini cyan tenui, visitatori live verde-acqua,
// archi viola che collegano le località. Dati da /api/realtime (GA4 Realtime).
//
// NB: questo modulo importa react-globe.gl + three direttamente, quindi DEVE
// essere montato solo client-side. In page.js è caricato via next/dynamic
// con { ssr: false }, così three.js NON entra nel bundle delle altre tab.
import { useEffect, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import { swrFetch } from '../../lib/clientCache'

// GeoJSON bundlato in /public/geo (stesso dominio → niente redirect/CORS)
const COUNTRIES_URL = '/geo/countries-110m.geojson'

const TEAL = '#34e7b0'
const PURPLE = '#bf5af2'

export default function DashboardGlobe() {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [countries, setCountries] = useState({ features: [] })
  const [points, setPoints] = useState([])
  const [arcs, setArcs] = useState([])

  // Dimensione dal container (il layer di sfondo a destra)
  useEffect(() => {
    if (!wrapRef.current) return
    const el = wrapRef.current
    const ro = new ResizeObserver(() => {
      setSize({ w: el.clientWidth || 600, h: el.clientHeight || 600 })
    })
    ro.observe(el)
    setSize({ w: el.clientWidth || 600, h: el.clientHeight || 600 })
    return () => ro.disconnect()
  }, [])

  // Polygons dei Paesi (per i continenti a puntini) — fetch una volta
  useEffect(() => {
    let alive = true
    fetch(COUNTRIES_URL)
      .then(r => r.json())
      .then(d => { if (alive) setCountries(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  // Visitatori live da GA4 Realtime — polling ogni 20s (cache condivisa col pannello)
  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data } = await swrFetch({
          key: 'realtime',
          fetcher: () => fetch('/api/realtime').then(r => r.ok ? r.json() : Promise.reject()),
        })
        if (!alive || !data?.points) return
        const pts = data.points
        setPoints(pts)
        // Archi: dal punto più "caldo" verso gli altri (stile BFCM)
        if (pts.length > 1) {
          const hub = pts.reduce((a, b) => (b.count > a.count ? b : a), pts[0])
          setArcs(
            pts
              .filter(p => p !== hub)
              .map(p => ({ startLat: hub.lat, startLng: hub.lng, endLat: p.lat, endLng: p.lng }))
          )
        } else {
          setArcs([])
        }
      } catch {}
    }
    load()
    const id = setInterval(load, 20_000)
    return () => { alive = false; clearInterval(id) }
  }, [])

  // Materiale sfera quasi nera + controlli (auto-rotate) una volta pronto
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    try {
      const mat = g.globeMaterial()
      mat.color = new THREE.Color('#070710')
      mat.emissive = new THREE.Color('#0b0b1c')
      mat.emissiveIntensity = 0.9
      mat.shininess = 4
    } catch {}
    try {
      const controls = g.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.5
      controls.enableZoom = false          // niente zoom da rotellina → lo scroll pagina resta libero
      controls.enablePan = false
    } catch {}
    // Inquadratura iniziale: Europa/Atlantico, sfera grande (altitude più bassa = più vicina)
    try { g.pointOfView({ lat: 30, lng: 6, altitude: 1.5 }, 0) } catch {}
  }, [size.w])

  // Zoom via pulsanti +/- (altitude più bassa = più vicino)
  const zoom = (dir) => {
    const g = globeRef.current
    if (!g) return
    try {
      const pov = g.pointOfView()
      const next = Math.min(3.2, Math.max(0.6, (pov.altitude || 1.5) + (dir < 0 ? -0.35 : 0.35)))
      g.pointOfView({ ...pov, altitude: next }, 400)
    } catch {}
  }

  const zoomBtn = {
    width: 34, height: 34, borderRadius: 9, cursor: 'pointer',
    background: 'rgba(8,8,15,0.6)', backdropFilter: 'blur(8px)',
    border: '1px solid rgba(255,255,255,0.12)', color: '#fff',
    fontSize: 20, fontWeight: 600, lineHeight: 1, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', bottom: 28, right: 'calc(14vw + 24px)', zIndex: 2, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button aria-label="Zoom in" onClick={() => zoom(-1)} style={zoomBtn}>+</button>
        <button aria-label="Zoom out" onClick={() => zoom(1)} style={zoomBtn}>−</button>
      </div>
      <Globe
        ref={globeRef}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        showAtmosphere
        atmosphereColor={PURPLE}
        atmosphereAltitude={0.28}
        hexPolygonsData={countries.features}
        hexPolygonResolution={3}
        hexPolygonMargin={0.18}
        hexPolygonUseDots
        hexPolygonColor={() => 'rgba(105,212,255,0.6)'}
        pointsData={points}
        pointLat="lat"
        pointLng="lng"
        pointColor={() => TEAL}
        pointAltitude={d => Math.min(0.05 + (d.count || 1) * 0.012, 0.22)}
        pointRadius={0.32}
        pointResolution={6}
        pointLabel={d => `${d.label || ''} · ${d.count} live`}
        ringsData={points}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t => `rgba(52,231,176,${1 - t})`)}
        ringMaxRadius={3}
        ringPropagationSpeed={1.4}
        ringRepeatPeriod={1400}
        arcsData={arcs}
        arcColor={() => [`rgba(191,90,242,0.0)`, `rgba(191,90,242,0.85)`, `rgba(100,210,255,0.0)`]}
        arcStroke={0.4}
        arcDashLength={0.55}
        arcDashGap={0.25}
        arcDashAnimateTime={2600}
        arcAltitudeAutoScale={0.45}
      />
    </div>
  )
}
