'use client'

// Il globo della Dashboard, sul modello della Live View di Shopify — e IDENTICO
// nei due temi (richiesta di Marino, 19 set 2026): sfera pastello con una
// sfumatura dal menta in alto all'azzurro in basso, terre a ESAGONI PIENI color
// acqua che virano all'azzurro verso sud, celle blu dove in questo momento c'e'
// qualcuno sul sito, segnaposto nero sulla sede. Niente archi, niente anelli,
// niente bagliori: e' una mappa, non un effetto speciale.
import { useEffect, useMemo, useRef, useState } from 'react'
import Globe from 'react-globe.gl'
import * as THREE from 'three'
import { swrFetch } from '../../lib/clientCache'

const COUNTRIES_URL = '/geo/countries-110m.geojson'

export default function DashboardGlobe() {
  const wrapRef = useRef(null)
  const globeRef = useRef(null)
  const [size, setSize] = useState({ w: 600, h: 600 })
  const [countries, setCountries] = useState({ features: [] })
  const [points, setPoints] = useState([])
  const [arcs, setArcs] = useState([])
  const [theme, setTheme] = useState('dark')

  useEffect(() => {
    const readTheme = () => setTheme(document.documentElement.dataset.theme === 'light' ? 'light' : 'dark')
    readTheme()
    const onTheme = e => setTheme(e?.detail?.theme === 'light' ? 'light' : 'dark')
    window.addEventListener('lyft-theme-change', onTheme)
    const observer = new MutationObserver(readTheme)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] })
    return () => {
      window.removeEventListener('lyft-theme-change', onTheme)
      observer.disconnect()
    }
  }, [])

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

  useEffect(() => {
    let alive = true
    fetch(COUNTRIES_URL)
      .then(r => r.json())
      .then(d => { if (alive) setCountries(d) })
      .catch(() => {})
    return () => { alive = false }
  }, [])

  useEffect(() => {
    let alive = true
    const load = async () => {
      try {
        const { data } = await swrFetch({
          key: 'realtime',
          fetcher: () => fetch('/api/realtime').then(r => r.ok ? r.json() : Promise.reject()),
        })
        if (!alive) return
        if (data?.sede) setSedeDati(data.sede)
        if (!data?.points) return
        const pts = data.points
        setPoints(pts)
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

  // La macchina del tempo (MissionControl): mentre si rigioca la giornata arrivano qui gli ordini
  // gia' "accaduti" a quell'ora. Gli ultimi 45 minuti pulsano, gli altri restano come punti.
  const [rigioca, setRigioca] = useState(null)
  // La sede del negozio, se i dati in tempo reale la espongono: e' di questo cliente, non una
  // costante. Senza, non si disegna nessun segnaposto.
  const [sedeDati, setSedeDati] = useState(null)
  useEffect(() => {
    const su = (e) => setRigioca(e.detail?.attivo ? e.detail : null)
    window.addEventListener('lyft:rigioca', su)
    return () => window.removeEventListener('lyft:rigioca', su)
  }, [])
  const ordiniVisti = useMemo(() => (rigioca ? rigioca.punti.filter(p => p.lat != null && p.m <= rigioca.minuto) : []), [rigioca])
  const ordiniFreschi = useMemo(() => (rigioca ? ordiniVisti.filter(p => rigioca.minuto - p.m <= 45) : []), [rigioca, ordiniVisti])

  const light = theme === 'light'

  // La sfera: una sfumatura verticale dipinta su una striscia e stesa come
  // mappa. MeshBasicMaterial non risponde alle luci: il colore resta quello,
  // piatto e pastello, identico di giorno e di notte.
  const globeMaterial = useMemo(() => {
    if (typeof document === 'undefined') return new THREE.MeshBasicMaterial({ color: '#dfeef2' })
    const tela = document.createElement('canvas')
    tela.width = 8; tela.height = 512
    const ctx = tela.getContext('2d')
    const g = ctx.createLinearGradient(0, 0, 0, 512)
    g.addColorStop(0, '#eaf6ee')    // polo nord: menta chiarissimo
    g.addColorStop(0.45, '#e2f0f1')
    g.addColorStop(1, '#cbdff7')    // polo sud: azzurro
    ctx.fillStyle = g; ctx.fillRect(0, 0, 8, 512)
    const mappa = new THREE.CanvasTexture(tela)
    mappa.colorSpace = THREE.SRGBColorSpace
    return new THREE.MeshBasicMaterial({ map: mappa })
  }, [])

  // Le terre cambiano tinta con la latitudine, come nell'originale: acqua a
  // nord, azzurro-pervinca a sud. Il colore si decide per paese (dal suo
  // baricentro): e' il livello a cui la libreria lo lascia scegliere.
  const coloreTerre = useMemo(() => {
    const mischia = (a, b, t) => a.map((x, i) => Math.round(x + (b[i] - x) * t))
    const NORD = [132, 219, 198], CENTRO = [127, 208, 203], SUD = [142, 178, 230]
    const perLat = (lat) => {
      const t = Math.min(1, Math.max(0, (70 - lat) / 110)) // 70°N → 0, 40°S → 1
      const c = t < 0.5 ? mischia(NORD, CENTRO, t / 0.5) : mischia(CENTRO, SUD, (t - 0.5) / 0.5)
      return `rgb(${c[0]},${c[1]},${c[2]})`
    }
    const m = new Map()
    for (const f of (countries.features || [])) {
      let somma = 0, n = 0
      const scendi = (c) => { if (typeof c[0] === 'number') { somma += c[1]; n++ } else c.forEach(scendi) }
      try { scendi(f.geometry.coordinates) } catch {}
      m.set(f, perLat(n ? somma / n : 20))
    }
    return m
  }, [countries])

  // La sede del negozio: il segnaposto nero (era viola, e con tutto il resto neutro restava l'unico
  // segno saturo). Qui i clienti sono tanti e ognuno ha la sua sede, quindi la si prende dai dati
  // in tempo reale se ci sono; se non ci sono NON si disegna niente, invece di piantare il
  // segnaposto sulla sede di un altro negozio.
  const sede = useMemo(() => {
    const s = sedeDati
    return (s && Number.isFinite(+s.lat) && Number.isFinite(+s.lng)) ? [{ lat: +s.lat, lng: +s.lng }] : []
  }, [sedeDati])
  const segnaposto = useMemo(() => () => {
    const el = document.createElement('div')
    el.style.cssText = 'width:22px;height:28px;transform:translate(-50%,-100%);pointer-events:none;filter:drop-shadow(0 2px 3px rgba(0,0,0,.3))'
    el.innerHTML = '<svg viewBox="0 0 22 28" width="22" height="28"><path d="M11 0C4.9 0 0 4.9 0 11c0 8 11 17 11 17s11-9 11-17C22 4.9 17.1 0 11 0z" fill="#1d1d1d"/><circle cx="11" cy="10.5" r="4.2" fill="#ffffff"/></svg>'
    return el
  }, [])

  // Il globo GIRA SEMPRE (Marino: "lascialo girare sempre"). Prima la rotazione si accendeva in
  // un effetto legato alla larghezza: se scattava quando il globo non era ancora pronto (arriva a
  // pezzi, dopo i numeri) restava fermo fino al primo ridimensionamento. Ora si accende anche
  // quando il globo dice di essere pronto, e dopo un trascinamento riparte da sola.
  const avviaRotazione = (riposiziona = false) => {
    const g = globeRef.current
    if (!g) return
    try {
      const controls = g.controls()
      controls.autoRotate = true
      controls.autoRotateSpeed = 0.3
      controls.enableZoom = false
      controls.enablePan = false
      if (!controls.__lyftRiparte) { controls.__lyftRiparte = true; controls.addEventListener('end', () => { controls.autoRotate = true }) }
    } catch {}
    if (riposiziona) { try { g.pointOfView({ lat: 27, lng: 12, altitude: 1.55 }, 0) } catch {} }
  }
  useEffect(() => { avviaRotazione(true) }, [size.w])

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
    width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
    background: light ? '#ffffff' : 'var(--surface)',
    backdropFilter: light ? 'none' : 'blur(10px)',
    WebkitBackdropFilter: light ? 'none' : 'blur(10px)',
    border: `1px solid ${light ? '#d6d6d6' : 'var(--border3)'}`,
    color: light ? '#34404c' : 'var(--text)',
    fontSize: 20, fontWeight: 600, lineHeight: 1, display: 'flex',
    alignItems: 'center', justifyContent: 'center',
    boxShadow: light ? '0 1px 3px rgba(20,30,40,.08)' : '0 8px 20px rgba(0,0,0,0.45)',
    transition: 'background 0.15s ease, border-color 0.15s ease, transform 0.15s ease',
  }

  const onZoomEnter = e => {
    e.currentTarget.style.background = light ? '#f5f5f5' : 'rgba(255,255,255,0.12)'
    e.currentTarget.style.borderColor = light ? '#aeb7c1' : 'rgba(255,255,255,0.3)'
    e.currentTarget.style.transform = 'scale(1.04)'
  }
  const onZoomLeave = e => {
    e.currentTarget.style.background = light ? '#ffffff' : 'var(--surface)'
    e.currentTarget.style.borderColor = light ? '#d6d6d6' : 'rgba(255,255,255,0.18)'
    e.currentTarget.style.transform = 'scale(1)'
  }

  return (
    <div ref={wrapRef} className="dashboard-globe" style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div style={{ position: 'absolute', bottom: 150, right: 24, zIndex: 3, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button className="globe-zoom-btn" aria-label="Zoom in" onClick={() => zoom(-1)} onMouseEnter={onZoomEnter} onMouseLeave={onZoomLeave} style={zoomBtn}>+</button>
        <button className="globe-zoom-btn" aria-label="Zoom out" onClick={() => zoom(1)} onMouseEnter={onZoomEnter} onMouseLeave={onZoomLeave} style={zoomBtn}>−</button>
      </div>
      <Globe
        ref={globeRef}
        onGlobeReady={() => avviaRotazione(true)}
        width={size.w}
        height={size.h}
        backgroundColor="rgba(0,0,0,0)"
        globeMaterial={globeMaterial}
        showAtmosphere
        atmosphereColor="#dbe7f6"
        atmosphereAltitude={0.1}
        hexPolygonsData={countries.features}
        hexPolygonResolution={3}
        hexPolygonMargin={0.22}
        hexPolygonUseDots={false}
        hexPolygonColor={f => coloreTerre.get(f) || 'rgb(127,208,203)'}
        hexPolygonAltitude={0.003}
        // Chi e' sul sito adesso: la stessa griglia di esagoni delle terre, ma blu.
        hexBinPointsData={points}
        hexBinPointLat="lat"
        hexBinPointLng="lng"
        hexBinPointWeight="count"
        hexBinResolution={3}
        hexMargin={0.22}
        hexAltitude={0.006}
        hexTopColor={() => '#3d8fe3'}
        hexSideColor={() => '#3d8fe3'}
        hexBinMerge={false}
        hexLabel={d => `${d.points?.[0]?.label || ''} · ${Math.round(d.sumWeight)} live`}
        pointsData={ordiniVisti}
        pointLat="lat"
        pointLng="lng"
        pointAltitude={0.012}
        pointRadius={0.32}
        pointColor={() => '#1d1d1d'}
        pointLabel={d => `${d.citta || ''} · €${d.euro}`}
        ringsData={ordiniFreschi}
        ringLat="lat"
        ringLng="lng"
        ringColor={() => (t) => `rgba(29,29,31,${1 - t})`}
        ringMaxRadius={3.2}
        ringPropagationSpeed={2.2}
        ringRepeatPeriod={900}
        htmlElementsData={sede}
        htmlLat="lat"
        htmlLng="lng"
        htmlAltitude={0.012}
        htmlElement={segnaposto}
      />
    </div>
  )
}
