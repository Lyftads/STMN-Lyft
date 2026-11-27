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
// IL DISEGNO OCCUPA TUTTA L'AREA, non un quadrato intorno alla sfera: cosi' l'alone non viene mai
// tagliato da un bordo squadrato e lo zoom puo' ingrandire il mondo quanto si vuole (lo tagliano
// solo i bordi dello schermo). La grandezza della sfera si decide qui, in pixel, e da quella si
// ricava la distanza della telecamera (campo visivo verticale di 50°, raggio del globo = 1).
const CASA = { lat: 41, lng: 12 }   // l'Italia al centro: e' da li' che parte quasi tutto
const META_CAMPO = Math.tan(25 * Math.PI / 180)
const ZOOM_MIN = 0.7, ZOOM_MAX = 3.2, ZOOM_PASSO = 1.3

const ORO = '#f6cf6b'

export default function GloboLive({ visitatori = [], luoghi = [], impulsi = [], flussi = [], sedi = [] }) {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [area, setArea] = useState({ w: 800, h: 800 })
  const [zoom, setZoom] = useState(1)
  const [terre, setTerre] = useState({ features: [] })

  // Il diametro della sfera a zoom 1: quanto sta fra le due colonne senza toccarle (su telefono,
  // dove il globo ha un riquadro tutto suo, quasi tutto il riquadro).
  const diametro = area.w < 900 ? 0.78 * Math.min(area.w, area.h) : Math.min(0.84 * area.h, 0.46 * area.w)
  const quota = (z) => { const parte = Math.min(3, (diametro * z) / Math.max(1, area.h)); return Math.max(0.12, 1 / Math.sin(Math.atan(parte * META_CAMPO)) - 1) }
  const quotaRef = useRef(2.2)
  quotaRef.current = quota(zoom)

  useEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const misura = () => setArea({ w: Math.max(240, el.clientWidth || 800), h: Math.max(240, el.clientHeight || 800) })
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
  const metaDondolio = (fase) => ({ lat: CASA.lat + 5 * Math.sin(fase * 0.6), lng: CASA.lng + 27 * Math.sin(fase), altitude: quotaRef.current })
  const pronto = () => {
    try {
      globeRef.current.pointOfView({ ...CASA, altitude: quotaRef.current }, 0)
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
    try { globeRef.current.pointOfView({ lat: ultimo.lat, lng: ultimo.lng, altitude: quotaRef.current * 0.95 }, 1100) } catch {}
  }, [ultimo?.id])   // eslint-disable-line react-hooks/exhaustive-deps

  // Zoom (i due pulsanti) o finestra ridimensionata: la telecamera si porta alla nuova distanza
  // con un passaggio breve, poi il dondolio riprende da li'.
  useEffect(() => {
    const g = globeRef.current
    if (!g) return
    try { const ora = g.pointOfView(); g.pointOfView({ lat: ora.lat, lng: ora.lng, altitude: quotaRef.current }, 450) } catch {}
    const m = moto.current
    if (m.fermoFino !== Infinity) { m.fermoFino = 0; m.rientroFino = performance.now() + 500 }
  }, [zoom, area.w, area.h])   // eslint-disable-line react-hooks/exhaustive-deps
  const piu = () => setZoom(z => Math.min(ZOOM_MAX, +(z * ZOOM_PASSO).toFixed(3)))
  const meno = () => setZoom(z => Math.max(ZOOM_MIN, +(z / ZOOM_PASSO).toFixed(3)))
  const alone = diametro * zoom * 1.42

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
    <div ref={wrapRef} style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}>
      {/* il chiarore dietro la sfera: segue la sua grandezza, zoom compreso */}
      <div aria-hidden="true" style={{ position: 'absolute', left: '50%', top: '50%', width: alone, height: alone, transform: 'translate(-50%,-50%)', borderRadius: '50%', pointerEvents: 'none', transition: 'width .45s ease, height .45s ease',
        background: 'radial-gradient(circle closest-side,rgba(205,216,240,.34) 0,rgba(205,216,240,.3) 64%,rgba(205,216,240,.2) 71%,rgba(205,216,240,.09) 80%,rgba(205,216,240,0) 93%)' }} />
      <div className="gl-zoom">
        <button type="button" aria-label="Zoom −" onClick={meno} disabled={zoom <= ZOOM_MIN}>−</button>
        <button type="button" aria-label="Zoom +" onClick={piu} disabled={zoom >= ZOOM_MAX}>+</button>
      </div>
      <Globe
        ref={globeRef}
        onGlobeReady={pronto}
        width={area.w}
        height={area.h}
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
