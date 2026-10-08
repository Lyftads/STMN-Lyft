'use client'

// Creative Funnel Graph: le creativita' Meta sospese in un imbuto 3D.
// Altezza = stadio del funnel (scoperta in cima, riattivazione in fondo),
// grandezza = spesa, angolo = campagna (le sorelle stanno vicine). Il bordo
// delle schede e' neutro (scelta di Marino): il colore sta solo sugli anelli
// delle fasi; il ROAS lo si legge al passaggio del mouse.
//
// Due strati con la stessa camera: WebGL per anelli e fili (poca roba, si
// disegna in un passaggio), CSS3D per le schede. Le schede sono veri <img>
// nel DOM: niente texture, niente CORS sulle immagini firmate di Meta, testo
// nitido, hover e clic nativi. Si carica con next/dynamic (ssr:false) dalla
// tab Creative, cosi' three.js resta nel suo pezzo come per il globo.

import { useEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { CSS3DRenderer, CSS3DSprite } from 'three/examples/jsm/renderers/CSS3DRenderer.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { soldi } from '../../lib/client/soldi'
import { num } from '../../lib/client/numeri'
import { STADI, COLORE_FASE } from '../../lib/creative/stadio'
import { usaSchermoIntero, BottoneSchermoIntero } from './ui/SchermoIntero'

// Geometria dell'imbuto: altezza e raggio di ogni anello, dall'alto in basso.
// Le schede sono 64 px a scala 1 e il CSS3D usa i pixel come unita': l'imbuto
// dev'essere largo rispetto a loro, altrimenti si coprono a vicenda.
const ANELLI = {
  top: { y: 300, r: 330 },
  middle: { y: 100, r: 240 },
  lower: { y: -100, r: 160 },
  riattivazione: { y: -300, r: 96 },
}
const APICE = new THREE.Vector3(0, -520, 0)

const MAX_SCHEDE = 150
const LATO = 64 // px della scheda a scala 1

function hash(s) {
  let h = 2166136261
  const str = String(s || '')
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) }
  return (h >>> 0) / 4294967295
}

function immagineDi(row) {
  return row?.thumbnail_url || row?.display_image_url || row?.image_url || row?.creative_image_url || row?.preview_image_url
    || (Array.isArray(row?.products) ? row.products.find(p => p?.image_url)?.image_url : '') || ''
}

// Posizione deterministica: stessa creativita' → stesso posto a ogni apertura.
// Dentro a uno stadio le schede girano TUTTE intorno all'anello, a passo
// uniforme, in ordine di campagna: le sorelle restano vicine e nessun lato
// dell'imbuto resta vuoto. Il raggio alterna col passo aureo e l'altezza
// oscilla un po', cosi' due vicine non si coprono.
function posizioni(rows, stadi) {
  const chiave = r => r.campaign_id || r.campaign_name || ''
  const perStadio = {}
  for (const r of rows) {
    const st = stadi[r.ad_id || r.id]?.stadio || 'top'
    ;(perStadio[st] ||= []).push(r)
  }
  const out = {}
  for (const st of STADI) {
    const lista = (perStadio[st] || []).slice().sort((a, b) => chiave(a).localeCompare(chiave(b)) || String(a.ad_id).localeCompare(String(b.ad_id)))
    const { y, r } = ANELLI[st]
    const n = Math.max(1, lista.length)
    lista.forEach((row, i) => {
      const h = hash(row.ad_id || row.id)
      const ang = (i / n) * Math.PI * 2 + (h - 0.5) * (Math.PI * 2 / n) * 0.5
      const raggio = r * (0.6 + 0.4 * ((i * 0.618034 + h * 0.2) % 1))
      const dy = (hash(row.ad_id + 'y') - 0.5) * 70
      out[row.ad_id || row.id] = new THREE.Vector3(Math.cos(ang) * raggio, y + dy, Math.sin(ang) * raggio)
    })
  }
  return out
}

export default function CreativeFunnel3D({ rows, stadi, onSelect, fonteAI }) {
  const { t } = useI18n()
  const telaRef = useRef(null)
  const riquadroRef = useRef(null)
  const { pieno, cambia: cambiaPieno, stile: stilePieno } = usaSchermoIntero(riquadroRef)
  const glRef = useRef(null)
  const cssRef = useRef(null)
  const [hover, setHover] = useState(null) // { row, x, y }
  const [fuoco, setFuoco] = useState(null) // stadio evidenziato
  const sceneRef = useRef(null)
  const candidatoRef = useRef(null)
  const onSelectRef = useRef(onSelect)
  useEffect(() => { onSelectRef.current = onSelect }, [onSelect])

  const NOMI = {
    top: t('cr.funnel.top', null, 'Scoperta'),
    middle: t('cr.funnel.middle', null, 'Considerazione'),
    lower: t('cr.funnel.lower', null, 'Conversione'),
    riattivazione: t('cr.funnel.riattivazione', null, 'Riattivazione'),
  }
  const FONTI = {
    nomi: t('cr.funnel.fonteNomi', null, 'dal nome di campagna o adset'),
    pubblico: t('cr.funnel.fontePubblico', null, 'dalla spesa per pubblico'),
    testo: t('cr.funnel.fonteTesto', null, 'dal testo della creatività'),
    ai: t('cr.funnel.fonteAI', null, 'stimato dall\'AI'),
    null: t('cr.funnel.fonteIpotesi', null, 'ipotesi: nessun segnale'),
  }

  // Le N con piu' spesa: oltre, su telefono, la scena arranca.
  const visibili = useMemo(
    () => [...rows].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)).slice(0, MAX_SCHEDE),
    [rows]
  )
  const spesaMax = useMemo(() => Math.max(1, ...visibili.map(r => Number(r.spend) || 0)), [visibili])
  const spesaTot = useMemo(() => visibili.reduce((s, r) => s + (Number(r.spend) || 0), 0), [visibili])

  // Lettura immediata: quante creative e quanta spesa per stadio.
  const riepilogo = useMemo(() => {
    const o = {}
    for (const st of STADI) o[st] = { n: 0, spesa: 0 }
    for (const r of visibili) {
      const st = stadi[r.ad_id || r.id]?.stadio || 'top'
      o[st].n += 1; o[st].spesa += Number(r.spend) || 0
    }
    return o
  }, [visibili, stadi])

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
    controls.target.set(0, -60, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 500
    controls.maxDistance = 2200
    controls.maxPolarAngle = Math.PI * 0.72
    controls.autoRotate = true
    controls.autoRotateSpeed = 0.45
    controls.enablePan = false
    // Il giro si ferma quando si tocca e riparte da solo dopo 4 s di quiete:
    // prima si fermava per sempre al primo tocco (anche dopo un clic su una
    // scheda), e sembrava bloccato.
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
      if (Math.hypot(e.clientX - c.x, e.clientY - c.y) < 6) { setHover(null); onSelectRef.current?.(c.row) }
    }
    css.domElement.addEventListener('pointerup', alzato)

    // Anelli (uno per stadio) e fili verso l'apice: grigio neutro, regge
    // su fondo chiaro e scuro. Esadecimale: nel WebGL var(--…) non vale.
    // Ogni fase e' un anello spesso (un toro, non una linea da 1 px) con un
    // disco velato sotto: si vede il piano, non solo il bordo.
    const gruppoFisso = new THREE.Group()
    const materiali = []
    for (const st of STADI) {
      const { y, r } = ANELLI[st]
      const colore = new THREE.Color(COLORE_FASE[st])
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
  }, [])

  // Schede e fili
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    const { gruppoDati } = s
    while (gruppoDati.children.length) {
      const o = gruppoDati.children[0]
      o.geometry?.dispose?.(); o.material?.dispose?.()
      gruppoDati.remove(o)
    }

    const pos = posizioni(visibili, stadi)
    const fili = []
    for (const row of visibili) {
      const id = row.ad_id || row.id
      const p = pos[id]
      if (!p) continue
      const st = stadi[id]?.stadio || 'top'
      const spesa = Number(row.spend) || 0
      const scala = 0.65 + 0.75 * Math.sqrt(spesa / spesaMax)

      const el = document.createElement('div')
      el.className = 'cf3-scheda'
      el.dataset.stadio = st
      el.style.cssText = `width:${LATO}px;height:${LATO}px;border:1px solid var(--border3, var(--border));border-radius:10px;overflow:hidden;background:var(--surface);box-shadow:0 6px 18px rgba(0,0,0,.35);cursor:pointer;`
      const img = immagineDi(row)
      if (img) {
        const im = document.createElement('img')
        im.src = img; im.alt = ''; im.loading = 'lazy'; im.draggable = false
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
      sprite.userData.stadio = st
      gruppoDati.add(sprite)

      fili.push(p.x, p.y, p.z, APICE.x, APICE.y, APICE.z)
    }
    // Etichetta della fase sull'anello: nome, creative e quota. Sprite CSS3D
    // (guarda sempre la camera), appoggiata sul bordo davanti.
    for (const st of STADI) {
      const { y, r } = ANELLI[st]
      const rr = riepilogo[st]
      const quota = spesaTot ? (rr.spesa / spesaTot) * 100 : 0
      const el = document.createElement('div')
      el.className = 'cf3-fase'
      el.style.cssText = 'pointer-events:none;white-space:nowrap;text-align:left;color:var(--text);'
      el.innerHTML = `<div style="font-size:15px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:${COLORE_FASE[st]}">${NOMI[st]}</div><div style="font-size:13px;color:var(--text3);font-variant-numeric:tabular-nums">${t('cr.funnel.etichetta', { n: rr.n, pct: num(quota, 0) }, `${rr.n} creative · ${num(quota, 0)}%`)}</div>`
      const sprite = new CSS3DSprite(el)
      sprite.position.set(r + 150, y + 6, 0)
      sprite.scale.setScalar(1.6)
      sprite.userData.stadio = st
      gruppoDati.add(sprite)
    }

    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.Float32BufferAttribute(fili, 3))
    gruppoDati.add(new THREE.LineSegments(geo, new THREE.LineBasicMaterial({ color: new THREE.Color('#8e8e98'), transparent: true, opacity: 0.18 })))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibili, stadi, spesaMax, riepilogo, spesaTot])

  // Stadio a fuoco: le altre schede si spengono.
  useEffect(() => {
    const s = sceneRef.current
    if (!s) return
    s.gruppoDati.children.forEach(o => {
      if (!o.element) return
      o.element.style.opacity = !fuoco || o.userData.stadio === fuoco ? '1' : (o.element.classList.contains('cf3-fase') ? '0.35' : '0.12')
    })
  }, [fuoco, visibili, stadi])

  const h = hover?.row
  const hs = h ? stadi[h.ad_id || h.id] : null

  return (
    <div ref={riquadroRef} style={{ position: 'relative', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--surface)', overflow: 'hidden', ...(stilePieno || {}) }}>
      {/* Stesso fondo a pallini della board, cosi' le due viste sono sorelle. */}
      <div ref={telaRef} style={{ position: 'relative', height: pieno ? '100vh' : 'min(78vh, 820px)', minHeight: pieno ? 0 : 480, backgroundColor: 'var(--surface)', backgroundImage: 'radial-gradient(var(--border2, rgba(128,128,128,.25)) 1px, transparent 1.2px)', backgroundSize: '24px 24px' }}>
        <div ref={glRef} style={{ position: 'absolute', inset: 0 }} />
        <div ref={cssRef} style={{ position: 'absolute', inset: 0 }} />

        {/* Legenda: la lettura immediata. Click = metti a fuoco uno stadio. */}
        <div className="cf3-legenda" style={{
          position: 'absolute', top: 14, left: 14, zIndex: 3,
          background: 'var(--glass2)', border: '1px solid var(--border)', borderRadius: 12,
          padding: '10px 12px', minWidth: 210, backdropFilter: 'blur(10px)',
        }}>
          {STADI.map(st => {
            const r = riepilogo[st]
            const quota = spesaTot ? (r.spesa / spesaTot) * 100 : 0
            const attivo = fuoco === st
            return (
              <button key={st} type="button" onClick={() => setFuoco(f => f === st ? null : st)} style={{
                display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, width: '100%', textAlign: 'left',
                background: attivo ? 'var(--glass)' : 'transparent', border: 'none', borderRadius: 8,
                padding: '6px 8px', cursor: 'pointer', color: 'var(--text)', opacity: fuoco && !attivo ? 0.45 : 1,
              }}>
                <span style={{ fontSize: 13, fontWeight: 640 }}><span style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 6, background: COLORE_FASE[st], marginRight: 7, verticalAlign: 'middle' }} />{NOMI[st]}</span>
                <span style={{ fontSize: 13, color: 'var(--text3)', fontVariantNumeric: 'tabular-nums' }}>
                  {r.n} · {num(quota, 0)}%
                </span>
              </button>
            )
          })}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.35 }}>
            {t('cr.funnel.legendaHint', null, 'creative · quota di spesa. Clic per mettere a fuoco.')}
          </div>
        </div>

        <div style={{ position: 'absolute', top: 14, right: 14, zIndex: 3 }}>
          <BottoneSchermoIntero pieno={pieno} onClick={cambiaPieno}
            titolo={pieno ? t('cr.board.esciPieno', null, 'Esci da schermo intero') : t('cr.board.pieno', null, 'Schermo intero')} />
        </div>

        <div style={{ position: 'absolute', bottom: 12, left: 14, right: 14, zIndex: 3, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, color: 'var(--text3)', pointerEvents: 'none' }}>
          <span>{t('cr.funnel.trascina', null, 'Trascina per ruotare, rotella per avvicinare')}</span>
          {rows.length > MAX_SCHEDE && (
            <span>{t('cr.funnel.tetto', { n: MAX_SCHEDE }, `Mostrate le ${MAX_SCHEDE} creative con più spesa`)}</span>
          )}
          {fonteAI === 'loading' && <span>{t('cr.funnel.aiInCorso', null, 'L\'AI sta classificando le creative senza segnali…')}</span>}
        </div>

        {h && (
          <div style={{
            position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 50, pointerEvents: 'none',
            background: 'var(--surface)', border: '1px solid var(--border2, var(--border))', borderRadius: 12,
            padding: '10px 12px', maxWidth: 280, boxShadow: '0 10px 30px rgba(0,0,0,.35)',
          }}>
            <div style={{ fontSize: 13, fontWeight: 680, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.name || h.ad_id}</div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.campaign_name || ''}</div>
            <div style={{ display: 'flex', gap: 12, marginTop: 6, fontSize: 13, color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              <span>{t('cr.spend', null, 'Spesa')} {soldi(Number(h.spend) || 0)}</span>
              <span>ROAS {num(Number(h.roas) || 0, 2)}</span>
            </div>
            <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
              {NOMI[hs?.stadio || 'top']} · {FONTI[hs?.fonte ?? 'null']}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
