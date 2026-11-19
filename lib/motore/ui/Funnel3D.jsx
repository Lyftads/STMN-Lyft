'use client'

// Il funnel 3D: tutte le creativita' del periodo sospese in un imbuto.
// Altezza = fase (Scoperta in cima, Conversione in fondo), grandezza = spesa,
// posizione sull'anello = angolo (le sorelle dello stesso angolo stanno
// vicine). Il bordo delle schede e' neutro: il colore sta solo sugli anelli
// delle fasi; spesa, ROAS e verdetto si leggono al passaggio del mouse, il
// clic apre il cassetto della creativita'.
//
// Portato dalla tab Creative di LyftAI (CreativeFunnel3D). Qui la fase e' gia'
// scritta su ogni creativita' (TOFU/MOFU/BOFU, l'asse su cui il motore
// decide): niente classificatore.
//
// Due strati con la stessa camera: WebGL per anelli e fili (poca roba, si
// disegna in un passaggio), CSS3D per le schede. Le schede sono veri <img>
// nel DOM: niente texture, niente CORS sulle immagini firmate di Meta, testo
// nitido, hover e clic nativi. Si carica con next/dynamic (ssr:false).

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DSprite } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { usaSchermoIntero, BottoneSchermoIntero } from './SchermoIntero'

export const FASI = ['TOFU', 'MOFU', 'BOFU']
const NOMI = { TOFU: 'Scoperta', MOFU: 'Considerazione', BOFU: 'Conversione' }
// Colore della fase, da freddo a caldo: la temperatura del pubblico lungo
// l'imbuto (gli stessi di LyftAI, chiesti da Marino). Esadecimale perche'
// finisce nel WebGL, dove var(--…) non vale.
export const COLORE_FASE = { TOFU: '#38bdf8', MOFU: '#a78bfa', BOFU: '#f97316' }

// Geometria dell'imbuto: altezza e raggio di ogni anello, dall'alto in basso.
// Le schede sono 64 px a scala 1 e il CSS3D usa i pixel come unita': l'imbuto
// dev'essere largo rispetto a loro, altrimenti si coprono a vicenda.
const ANELLI = {
  TOFU: { y: 260, r: 330 },
  MOFU: { y: 0, r: 225 },
  BOFU: { y: -260, r: 130 },
}
// Fondo PIATTO: l'imbuto finisce su un disco largo quanto l'ultimo anello.
const Y_FONDO = -380
const R_FONDO = 130

const MAX_SCHEDE = 300
const LATO = 64 // px della scheda a scala 1

const eur = (n) => '€' + Math.round(n || 0).toLocaleString('it-IT')
const num = (n, d = 2) => (n || 0).toLocaleString('it-IT', { minimumFractionDigits: d, maximumFractionDigits: d })

function hash(s) {
  let h = 2166136261
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}

// Posizione deterministica: stessa creativita' → stesso posto a ogni apertura.
// Dentro a una fase le schede girano TUTTE intorno all'anello, a passo
// uniforme, in ordine di angolo: le sorelle restano vicine e nessun lato
// dell'imbuto resta vuoto. Il raggio alterna col passo aureo e l'altezza
// oscilla un po', cosi' due vicine non si coprono.
function posizioni(rows) {
  const perFase = {}
  for (const r of rows) (perFase[r.funnel] ||= []).push(r)
  const out = {}
  for (const f of FASI) {
    const lista = (perFase[f] || []).slice().sort((a, b) => String(a.angolo || '').localeCompare(String(b.angolo || '')) || String(a.name).localeCompare(String(b.name)))
    const { y, r } = ANELLI[f]
    const n = Math.max(1, lista.length)
    lista.forEach((row, i) => {
      const h = hash(row.id)
      const ang = (i / n) * Math.PI * 2 + (h - 0.5) * (Math.PI * 2 / n) * 0.5
      const raggio = r * (0.6 + 0.4 * ((i * 0.618034 + h * 0.2) % 1))
      const dy = (hash(row.id + 'y') - 0.5) * 70
      out[row.id] = new THREE.Vector3(Math.cos(ang) * raggio, y + dy, Math.sin(ang) * raggio)
    })
  }
  return out
}

export default function Funnel3D({ righe, apri }) {
  const telaRef = useRef(null)
  const { pieno, cambia: cambiaPieno, stile: stilePieno, Portale } = usaSchermoIntero()
  const glRef = useRef(null)
  const cssRef = useRef(null)
  const [hover, setHover] = useState(null) // { row, x, y }
  const [fuoco, setFuoco] = useState(null) // fase evidenziata
  const sceneRef = useRef(null)
  const candidatoRef = useRef(null)
  const apriRef = useRef(apri)
  useEffect(() => { apriRef.current = apri }, [apri])

  // Solo chi ha una fase sta nell'imbuto; le altre si contano nella legenda,
  // perche' metterle in cima «per ipotesi» le farebbe leggere come Scoperta.
  const conFase = useMemo(() => (righe || []).filter(r => FASI.includes(r.funnel)), [righe])
  const senzaFase = (righe || []).length - conFase.length
  // Le N con piu' spesa: oltre, la scena arranca.
  const visibili = useMemo(
    () => [...conFase].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)).slice(0, MAX_SCHEDE),
    [conFase]
  )
  const spesaMax = useMemo(() => Math.max(1, ...visibili.map(r => Number(r.spend) || 0)), [visibili])
  const spesaTot = useMemo(() => visibili.reduce((s, r) => s + (Number(r.spend) || 0), 0), [visibili])

  // Lettura immediata: quante creativita' e quanta spesa per fase.
  const riepilogo = useMemo(() => {
    const o = {}
    for (const f of FASI) o[f] = { n: 0, spesa: 0 }
    for (const r of visibili) { o[r.funnel].n += 1; o[r.funnel].spesa += Number(r.spend) || 0 }
    return o
  }, [visibili])

  // Scena: si monta una volta; schede e fili si rifanno quando cambiano i dati.
  useEffect(() => {
    const tela = telaRef.current
    if (!tela) return
    const w = tela.clientWidth, h = tela.clientHeight

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(42, w / h, 1, 3000)
    camera.position.set(0, 140, 1260)

    const gl = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    gl.setPixelRatio(Math.min(2, window.devicePixelRatio || 1))
    gl.setSize(w, h)
    gl.domElement.style.position = 'absolute'
    gl.domElement.style.inset = '0'
    glRef.current.appendChild(gl.domElement)

    const css = new CSS3DRenderer()
    css.setSize(w, h)
    css.domElement.style.position = 'absolute'
    css.domElement.style.inset = '0'
    cssRef.current.appendChild(css.domElement)

    const controls = new OrbitControls(camera, css.domElement)
    controls.target.set(0, -40, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 500
    controls.maxDistance = 2200
    controls.maxPolarAngle = Math.PI * 0.72
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.enablePan = false
    // Il giro si ferma quando si tocca e riparte da solo dopo 4 s di quiete.
    let ripresa = 0
    controls.addEventListener('start', () => { controls.autoRotate = false; clearTimeout(ripresa) })
    controls.addEventListener('end', () => { clearTimeout(ripresa); ripresa = setTimeout(() => { controls.autoRotate = true }, 4000) })
    // Il clic su una scheda: OrbitControls cattura il puntatore al pointerdown,
    // quindi il pointerup NON arriva mai alla scheda. Si ascolta qui, sul
    // livello CSS3D, e si confronta col pointerdown partito dalla scheda:
    // se il dito non si e' mosso, e' un clic.
    const alzato = e => {
      const c = candidatoRef.current
      candidatoRef.current = null
      if (!c) return
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) { setHover(null); apriRef.current?.(c.row) }
    }
    css.domElement.addEventListener('pointerup', alzato)

    // Anelli (uno per fase) e fondo: ogni fase e' un toro spesso con un disco
    // velato sotto, cosi' si vede il piano e non solo il bordo.
    const gruppoFisso = new THREE.Group()
    const materiali = []
    const grigio = new THREE.Color('#8e8e98')
    const matFondo = new THREE.MeshBasicMaterial({ color: grigio, transparent: true, opacity: 0.08, side: THREE.DoubleSide, depthWrite: false })
    materiali.push(matFondo)
    const fondo = new THREE.Mesh(new THREE.CircleGeometry(R_FONDO, 96), matFondo)
    fondo.rotation.x = -Math.PI / 2; fondo.position.y = Y_FONDO
    gruppoFisso.add(fondo)
    const matBordoFondo = new THREE.MeshBasicMaterial({ color: grigio, transparent: true, opacity: 0.6 })
    materiali.push(matBordoFondo)
    const bordoFondo = new THREE.Mesh(new THREE.TorusGeometry(R_FONDO, 2.2, 8, 128), matBordoFondo)
    bordoFondo.rotation.x = Math.PI / 2; bordoFondo.position.y = Y_FONDO
    gruppoFisso.add(bordoFondo)
    for (const f of FASI) {
      const { y, r } = ANELLI[f]
      const colore = new THREE.Color(COLORE_FASE[f])
      const matAnello = new THREE.MeshBasicMaterial({ color: colore, transparent: true, opacity: 0.85 })
      const matDisco = new THREE.MeshBasicMaterial({ color: colore, transparent: true, opacity: 0.07, side: THREE.DoubleSide, depthWrite: false })
      materiali.push(matAnello, matDisco)
      const toro = new THREE.Mesh(new THREE.TorusGeometry(r, 2.2, 8, 128), matAnello)
      toro.rotation.x = Math.PI / 2; toro.position.y = y
      const disco = new THREE.Mesh(new THREE.CircleGeometry(r, 96), matDisco)
      disco.rotation.x = -Math.PI / 2; disco.position.y = y
      gruppoFisso.add(toro, disco)
    }
    scene.add(gruppoFisso)

    const gruppoDati = new THREE.Group()
    scene.add(gruppoDati)
    sceneRef.current = { scene, camera, gl, css, controls, gruppoDati }

    let vivo = true
    let raf = 0
    const disegna = () => {
      if (!vivo) return
      controls.update()
      gl.render(scene, camera)
      css.render(scene, camera)
      raf = requestAnimationFrame(disegna)
    }
    raf = requestAnimationFrame(disegna)

    const ro = new ResizeObserver(() => {
      const W = tela.clientWidth, H = tela.clientHeight
      if (!W || !H) return
      camera.aspect = W / H; camera.updateProjectionMatrix()
      gl.setSize(W, H); css.setSize(W, H)
    })
    ro.observe(tela)

    return () => {
      vivo = false
      cancelAnimationFrame(raf)
      ro.disconnect()
      css.domElement.removeEventListener('pointerup', alzato)
      clearTimeout(ripresa)
      controls.dispose()
      gruppoFisso.traverse(o => { o.geometry?.dispose?.() })
      materiali.forEach(m => m.dispose())
      gl.dispose()
      gl.domElement.remove()
      css.domElement.remove()
      sceneRef.current = null
    }
  // A schermo intero il DOM sotto al portale e' nuovo ma il componente e' lo
  // stesso: la scena va ricreata sui nuovi nodi, o il canvas sparisce.
  }, [pieno])

  // Schede, etichette delle fasi e fili.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    const { gruppoDati } = s
    while (gruppoDati.children.length) {
      const o = gruppoDati.children[0]
      o.geometry?.dispose?.(); o.material?.dispose?.()
      gruppoDati.remove(o)
    }

    const pos = posizioni(visibili)
    const fili = []
    for (const row of visibili) {
      const p = pos[row.id]
      if (!p) continue
      const spesa = Number(row.spend) || 0
      const scala = 0.65 + 0.75 * Math.sqrt(spesa / spesaMax)

      const el = document.createElement('div')
      el.className = 'cf3-scheda'
      el.dataset.fase = row.funnel
      el.style.cssText = `width:${LATO}px;height:${LATO}px;border:1px solid var(--border3);border-radius:10px;overflow:hidden;background:var(--surface);box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;`
      const img = row.thumb || row.full || ''
      if (img) {
        const im = document.createElement('img')
        // Caricamento subito, non pigro: in uno spazio 3D trasformato il browser
        // tiene «fuori schermo» meta' delle schede e non le carica mai.
        im.src = img; im.alt = ''; im.loading = 'eager'; im.draggable = false
        im.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;'
        el.appendChild(im)
      } else {
        el.style.display = 'grid'; el.style.placeItems = 'center'
        el.style.color = 'var(--text3)'; el.style.fontSize = '10px'; el.style.fontWeight = '640'
        el.textContent = (row.name || '?').slice(0, 10)
      }
      el.addEventListener('pointerdown', e => { candidatoRef.current = { row, x: e.clientX, y: e.clientY } })
      el.addEventListener('pointerenter', e => setHover({ row, x: e.clientX, y: e.clientY }))
      el.addEventListener('pointermove', e => setHover(h => h && h.row === row ? { row, x: e.clientX, y: e.clientY } : h))
      el.addEventListener('pointerleave', () => setHover(h => (h && h.row === row ? null : h)))

      const sprite = new CSS3DSprite(el)
      sprite.position.copy(p)
      sprite.scale.setScalar(scala)
      sprite.userData.fase = row.funnel
      gruppoDati.add(sprite)

      const ang = Math.atan2(p.z, p.x)
      fili.push(p.x, p.y, p.z, Math.cos(ang) * R_FONDO * 0.85, Y_FONDO, Math.sin(ang) * R_FONDO * 0.85)
    }
    // Etichetta della fase FUORI dall'anello (dentro ci stanno le schede e la
    // coprirebbero): nome, creativita' e quota. Sprite CSS3D, guarda la camera.
    for (const f of FASI) {
      const { y, r } = ANELLI[f]
      const rr = riepilogo[f]
      const quota = spesaTot ? (rr.spesa / spesaTot) * 100 : 0
      const el = document.createElement('div')
      el.className = 'cf3-fase'
      el.style.cssText = 'pointer-events:none;white-space:nowrap;text-align:left;color:var(--text);'
      el.innerHTML = `<div style="font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${COLORE_FASE[f]}">${NOMI[f]}</div><div style="font-size:13px;color:var(--text3);font-variant-numeric:tabular-nums">${rr.n} creatività · ${num(quota, 0)}%</div>`
      const sprite = new CSS3DSprite(el)
      sprite.position.set(r + 150, y + 6, 0)
      sprite.scale.setScalar(1.6)
      sprite.userData.fase = f
      gruppoDati.add(sprite)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fili, 3))
    gruppoDati.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color('#8e8e98'), transparent: true, opacity: 0.18 })))
  // `pieno` ci sta apposta: a schermo intero la scena rinasce vuota.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibili, spesaMax, riepilogo, spesaTot, pieno])

  // Fase a fuoco: le altre schede si spengono.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.gruppoDati.children.forEach(o => {
      if (!o.element) return
      o.element.style.opacity = !fuoco || o.userData.fase === fuoco ? '1' : (o.element.classList.contains('cf3-fase') ? '0.35' : '0.12')
    })
  }, [fuoco, visibili, pieno])

  const h = hover?.row

  return (
    <Portale>
    <div style={{ position: 'relative', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden', ...(stilePieno || {}) }}>
      {/* Stesso fondo a pallini della board di Produzione: le viste sono sorelle. */}
      <div ref={telaRef} style={{ position: 'relative', height: pieno ? '100vh' : 'min(78vh, 820px)', minHeight: pieno ? 0 : 480, backgroundColor: 'var(--surface)', backgroundImage: 'radial-gradient(var(--border2) 1px, transparent 1.2px)', backgroundSize: '24px 24px' }}>
        <div ref={glRef} style={{ position: 'absolute', inset: 0 }} />
        <div ref={cssRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Legenda: la lettura immediata. Clic = metti a fuoco una fase. */}
        <div className="cf3-legenda" style={{
          position: 'absolute', top: 14, left: 14, zIndex: 3,
          background: 'var(--glass2)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '10px 12px', minWidth: 230, backdropFilter: 'blur(10px)',
        }}>
          {FASI.map(f => {
            const r = riepilogo[f]
            const quota = spesaTot ? (r.spesa / spesaTot) * 100 : 0
            const attivo = fuoco === f
            return (
              <button key={f} type="button" onClick={() => setFuoco(x => x === f ? null : f)} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, width: '100%', textAlign: 'left',
                background: attivo ? 'var(--glass)' : 'transparent', border: 'none', borderRadius: 8,
                padding: '6px 8px', cursor: 'pointer', color: 'var(--text)', opacity: fuoco && !attivo ? 0.45 : 1, font: 'inherit',
              }}>
                <span style={{ fontSize: 13, fontWeight: 640 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 6, background: COLORE_FASE[f], marginRight: 7, verticalAlign: 'middle' }} />{NOMI[f]}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>{r.n} · {num(quota, 0)}%</span>
              </button>
            )
          })}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.35 }}>
            creatività · quota di spesa. Clic per mettere a fuoco.
            {senzaFase > 0 && <><br />{senzaFase} senza fase, non in figura.</>}
          </div>
        </div>

        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 3 }}>
          <BottoneSchermoIntero pieno={pieno} onClick={cambiaPieno} titolo={pieno ? 'Esci da schermo intero' : 'Schermo intero'} />
        </div>

        <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, zIndex: 3, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, color: 'var(--text3)', pointerEvents: 'none' }}>
          <span>Trascina per ruotare, rotella per avvicinare, clic sulla scheda per aprirla</span>
          {conFase.length > MAX_SCHEDE && <span>Mostrate le {MAX_SCHEDE} creatività con più spesa su {conFase.length}</span>}
        </div>

        {h && (
          <div style={{
            position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 60, pointerEvents: 'none',
            background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 12,
            padding: '10px 12px', maxWidth: 300, boxShadow: '0 10px 30px rgba(0,0,0,.35)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 680, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {[h.angolo, h.formato, h.persona].filter(Boolean).join(' · ')}
            </div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              <span>Spesa {eur(h.spend)}</span>
              <span>ROAS {num(h.roas)}</span>
              <span>{Math.round(h.purchases || 0)} ordini</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
              <span style={{ color: COLORE_FASE[h.funnel] }}>{NOMI[h.funnel]}</span>{h.bandaLabel ? <> · {h.bandaLabel}</> : null}
            </div>
          </div>
        )}
      </div>
    </div>
    </Portale>
  )
}
