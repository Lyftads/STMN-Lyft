'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import CreativeStudioLogo from './ui/CreativeStudioLogo'
import AdComposer from './studio/AdComposer'
import TryOnModal from './studio/TryOnModal'
import MaskEditor from './studio/MaskEditor'
import { UPSCALE_OPTIONS as UPSCALES, RELIGHT_CREDITS as RELIGHT_COST, CAMERA_ANGLES, RECIPES } from '../../lib/studio/models'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Creative Studio — web app generativa (apribile a tutto schermo).
// Lavagna INFINITA (pan + zoom rotella/pulsanti) a sinistra con toolbar
// fluttuante stile Luma; chat laterale a destra (Creative Agent) con vocali e
// upload immagini di riferimento. Immagini (text->image, reference) + Video
// (text->video, image->video). Crediti via Stripe con rimborso se fallisce.

const FORMATS = [
  { id: 'square', label: '1:1' },
  { id: 'portrait', label: '4:5' },
  { id: 'vertical', label: '9:16' },
  { id: 'landscape', label: '16:9' },
]
let _mid = 0
const nextId = () => `m${Date.now()}_${_mid++}`
const clampZoom = (z) => Math.min(3, Math.max(0.2, z))

export default function CreativeStudio({ standalone = false, onNavigate }) {
  const { t, intlLocale } = useI18n()
  const [balance, setBalance] = useState(null)
  const [models, setModels] = useState([])
  const [videoModels, setVideoModels] = useState([])
  const [packs, setPacks] = useState([])
  const [txHistory, setTxHistory] = useState([])

  const [input, setInput] = useState('')
  const [kind, setKind] = useState('image')
  const [model, setModel] = useState('flux2-pro')
  const [videoModel, setVideoModel] = useState('luma-ray2-flash')
  const [format, setFormat] = useState('square')
  const [count, setCount] = useState(1)
  const [sourceImage, setSourceImage] = useState(null)
  const [refImages, setRefImages] = useState([])
  const [stylePresets, setStylePresets] = useState([])
  const [activeStyle, setActiveStyle] = useState(null) // preset id
  const [studioPresets, setStudioPresets] = useState([])
  const [studioCategories, setStudioCategories] = useState([])
  const [activeStudio, setActiveStudio] = useState(null) // studio id (ambiente Kive)
  const [showStudios, setShowStudios] = useState(false)
  const [studioCat, setStudioCat] = useState('all')
  const [studioQuery, setStudioQuery] = useState('')
  const [products, setProducts] = useState(null)        // null = non caricati
  const [showProducts, setShowProducts] = useState(false)
  const [productQuery, setProductQuery] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([])
  const [messages, setMessages] = useState([])
  const [recording, setRecording] = useState(false)
  const [showRecharge, setShowRecharge] = useState(false)
  const [showHistory, setShowHistory] = useState(false)
  const [buying, setBuying] = useState('')

  // Editing / selezione
  const [lightbox, setLightbox] = useState(null)     // item aperto
  const [adComposer, setAdComposer] = useState(null) // url immagine base per il compositore
  const [tryOn, setTryOn] = useState(null)           // url prodotto per il try-on
  const [editInstr, setEditInstr] = useState('')
  const [editing, setEditing] = useState(false)
  const [relightInstr, setRelightInstr] = useState('')
  const [maskEdit, setMaskEdit] = useState(null)   // url immagine in inpainting
  const [recipe, setRecipe] = useState(null)        // { label, done, total } | null
  const [selectMode, setSelectMode] = useState(false)
  const [selected, setSelected] = useState(() => new Set())
  const [batchInstr, setBatchInstr] = useState('')
  const [batchFmt, setBatchFmt] = useState('square')
  const [batch, setBatch] = useState(null)           // { done, total } | null
  const [marquee, setMarquee] = useState(null)       // rettangolo selezione (client coords)
  const marqueeRef = useRef({ active: false, x0: 0, y0: 0, x1: 0, y1: 0 })

  // Lavagna infinita
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 28, y: 24 })
  const viewportRef = useRef(null)
  const panRef = useRef({ dragging: false, sx: 0, sy: 0, moved: false })

  const taRef = useRef(null)
  const fileRef = useRef(null)
  const msgEndRef = useRef(null)
  const recRef = useRef(null)
  const chunksRef = useRef([])

  const loadCredits = useCallback(async () => {
    try {
      const r = await fetch('/api/credits', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setBalance(j.balance ?? 0); setModels(j.models || []); setVideoModels(j.videoModels || [])
      setPacks(j.packs || []); setTxHistory(j.history || []); setStylePresets(j.stylePresets || [])
      setStudioPresets(j.studioPresets || []); setStudioCategories(j.studioCategories || [])
      if (j.models?.length && !j.models.find(m => m.id === model)) setModel(j.models[0].id)
      if (j.videoModels?.length && !j.videoModels.find(m => m.id === videoModel)) setVideoModel(j.videoModels[0].id)
    } catch {}
  }, [model, videoModel])

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/studio/history', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      if (Array.isArray(j.items)) setItems(j.items)
    } catch {}
  }, [])

  useEffect(() => { loadCredits(); loadHistory() }, [loadCredits, loadHistory])
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    if (p.get('credits') === 'success') { setTimeout(loadCredits, 1500); setTimeout(loadCredits, 5000) }
  }, [loadCredits])
  useEffect(() => { msgEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [messages])

  // Zoom con la rotella (verso il cursore). Listener non-passive per preventDefault.
  useEffect(() => {
    const el = viewportRef.current
    if (!el) return
    const onWheel = (e) => {
      e.preventDefault()
      const rect = el.getBoundingClientRect()
      const mx = e.clientX - rect.left, my = e.clientY - rect.top
      setZoom(z => {
        const nz = clampZoom(z * (e.deltaY < 0 ? 1.12 : 1 / 1.12))
        setPan(p => ({ x: mx - (mx - p.x) * (nz / z), y: my - (my - p.y) * (nz / z) }))
        return nz
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  // Esci dalla modalità selezione: deseleziona tutto + torna in "sposta".
  const exitSelect = useCallback(() => { setSelectMode(false); setSelected(new Set()); marqueeRef.current.active = false; setMarquee(null) }, [])

  // ESC mentre sei in selezione → deseleziona tutto ed esci dal comando.
  useEffect(() => {
    if (!selectMode) return
    const onKey = (e) => { if (e.key === 'Escape') { e.preventDefault(); exitSelect() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [selectMode, exitSelect])

  // Tasto destro mentre sei in selezione → deseleziona tutto ed esci dal comando.
  const onCanvasContext = (e) => {
    if (!selectMode) return
    e.preventDefault()
    exitSelect()
  }

  const onCanvasDown = (e) => {
    if (e.button !== 0) return
    if (selectMode) { // marquee: trascina per selezionare
      marqueeRef.current = { active: true, x0: e.clientX, y0: e.clientY, x1: e.clientX, y1: e.clientY }
      setMarquee({ ...marqueeRef.current }); return
    }
    panRef.current = { dragging: true, sx: e.clientX - pan.x, sy: e.clientY - pan.y, moved: false }
  }
  const onCanvasMove = (e) => {
    if (marqueeRef.current.active) { marqueeRef.current.x1 = e.clientX; marqueeRef.current.y1 = e.clientY; setMarquee({ ...marqueeRef.current }); return }
    if (!panRef.current.dragging) return
    panRef.current.moved = true
    setPan({ x: e.clientX - panRef.current.sx, y: e.clientY - panRef.current.sy })
  }
  const commitMarquee = () => {
    const m = marqueeRef.current
    const r = { left: Math.min(m.x0, m.x1), top: Math.min(m.y0, m.y1), right: Math.max(m.x0, m.x1), bottom: Math.max(m.y0, m.y1) }
    const els = viewportRef.current?.querySelectorAll('[data-card-url]') || []
    setSelected(prev => {
      const n = new Set(prev)
      els.forEach(el => {
        const b = el.getBoundingClientRect()
        const hit = !(b.right < r.left || b.left > r.right || b.bottom < r.top || b.top > r.bottom)
        if (hit && n.size < 100) n.add(el.getAttribute('data-card-url'))
      })
      return n
    })
  }
  const endPan = () => {
    if (marqueeRef.current.active) { commitMarquee(); marqueeRef.current.active = false; setMarquee(null); return }
    panRef.current.dragging = false
  }
  const zoomBy = (f) => {
    const el = viewportRef.current
    const cx = el ? el.clientWidth / 2 : 0, cy = el ? el.clientHeight / 2 : 0
    setZoom(z => {
      const nz = clampZoom(z * f)
      setPan(p => ({ x: cx - (cx - p.x) * (nz / z), y: cy - (cy - p.y) * (nz / z) }))
      return nz
    })
  }
  const resetView = () => { setZoom(1); setPan({ x: 28, y: 24 }) }

  const activeImageModel = models.find(m => m.id === model)
  const activeVideoModel = videoModels.find(m => m.id === videoModel)
  const cost = kind === 'video' ? (activeVideoModel?.credits || 20) : (activeImageModel?.credits || 2) * count
  const isKontext = kind === 'image' && model === 'flux-kontext'
  const canGenerate = kind === 'video'
    ? (!!sourceImage || !!input.trim())
    : (isKontext ? refImages.length > 0 : (!!input.trim() || !!activeStudio))

  const patchMsg = (id, patch) => setMessages(prev => prev.map(m => m.id === id ? { ...m, ...patch } : m))

  const pollVideo = useCallback((genId, msgId, meta) => {
    let tries = 0
    const tick = async () => {
      tries++
      try {
        const r = await fetch(`/api/studio/video-status?id=${encodeURIComponent(genId)}`, { cache: 'no-store' })
        const j = await r.json()
        if (j.status === 'done' && j.url) {
          setItems(prev => [{ type: 'video', url: j.url, ...meta }, ...prev])
          patchMsg(msgId, { pending: false, text: t('cs.replyVideo', null, 'Ecco il tuo video.'), media: [{ type: 'video', url: j.url }] })
          return
        }
        if (j.status === 'failed') {
          if (typeof j.balance === 'number') setBalance(j.balance)
          patchMsg(msgId, { pending: false, error: true, text: t('cs.videoFailed', null, 'Generazione video fallita (crediti rimborsati).') })
          return
        }
      } catch {}
      if (tries < 100) setTimeout(tick, 5000)
      else patchMsg(msgId, { pending: false, error: true, text: t('cs.videoTimeout', null, 'Il video ci sta mettendo troppo, riprova.') })
    }
    setTimeout(tick, 4000)
  }, [t])

  const generate = async () => {
    if (!canGenerate || busy) return
    const text = input.trim()
    const refs = refImages.map(r => r.dataUrl || r.url).filter(Boolean)
    const styleRefs = refImages.filter(r => r.role === 'style').map(r => r.dataUrl || r.url).filter(Boolean)
    const studioStr = studioPresets.find(s => s.id === activeStudio)?.prompt
    const presetStr = stylePresets.find(s => s.id === activeStyle)?.prompt
    // L'ambiente Studio guida la scena (ha priorità), lo stile rifinisce il mood.
    const styleStr = [studioStr, presetStr].filter(Boolean).join('. ') || undefined
    setBusy(true); setError('')
    const studioLabel = studioPresets.find(s => s.id === activeStudio)?.label
    const userMsgText = text || (sourceImage ? t('cs.animateReq', null, 'Anima questa immagine') : studioLabel ? t('cs.studioGenReq', { name: studioLabel }, `Genera nell'ambiente "${studioLabel}"`) : '')
    setMessages(prev => [...prev, { id: nextId(), role: 'user', text: userMsgText, media: refImages.map(r => ({ type: 'image', url: r.dataUrl })) }])
    setInput(''); setRefImages([])
    const aId = nextId()
    setMessages(prev => [...prev, { id: aId, role: 'assistant', pending: true, text: kind === 'video' ? t('cs.videoBusy', null, 'Genero il video… 1-3 minuti') : t('cs.generating', null, 'Genero…') }])

    try {
      if (kind === 'video') {
        const r = await fetch('/api/studio/generate-video', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mode: sourceImage ? 'image' : 'text', prompt: text, imageUrl: sourceImage || '', model: videoModel, format, style: styleStr }),
        })
        const j = await r.json()
        if (r.status === 402 || j.error === 'insufficient_credits') {
          setBalance(j.balance ?? balance); setShowRecharge(true)
          patchMsg(aId, { pending: false, error: true, text: t('cs.insufficient', null, 'Crediti insufficienti.') }); return
        }
        if (!r.ok || !j.generationId) {
          patchMsg(aId, { pending: false, error: true, text: j.error || t('cs.genFail', null, 'Generazione fallita.') })
          if (typeof j.balance === 'number') setBalance(j.balance); return
        }
        if (typeof j.balance === 'number') setBalance(j.balance)
        pollVideo(j.generationId, aId, { modelName: j.modelName, prompt: text, format: j.format, fromImage: j.mode === 'image' })
      } else {
        const r = await fetch('/api/studio/generate', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: text, model, format, count, refImages: refs, styleRefImages: styleRefs, style: styleStr }),
        })
        const j = await r.json()
        if (r.status === 402 || j.error === 'insufficient_credits') {
          setBalance(j.balance ?? balance); setShowRecharge(true)
          patchMsg(aId, { pending: false, error: true, text: t('cs.insufficient', null, 'Crediti insufficienti.') }); return
        }
        if (!r.ok || !j.images?.length) {
          patchMsg(aId, { pending: false, error: true, text: j.error || t('cs.genFail', null, 'Generazione fallita.') })
          if (typeof j.balance === 'number') setBalance(j.balance); return
        }
        const newItems = j.images.map(img => ({ type: 'image', url: img.url, modelName: j.modelName, prompt: text, format: j.format }))
        setItems(prev => [...newItems, ...prev])
        if (typeof j.balance === 'number') setBalance(j.balance)
        patchMsg(aId, { pending: false, text: t('cs.replyImage', { n: newItems.length }, `Ecco ${newItems.length} immagine/i con ${j.modelName}.`), media: newItems.map(it => ({ type: 'image', url: it.url })) })
      }
    } catch (e) {
      patchMsg(aId, { pending: false, error: true, text: e.message })
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); generate() } }
  const animate = (it) => { setKind('video'); setSourceImage(it.url); setFormat(it.format || 'square'); setError(''); setTimeout(() => taRef.current?.focus(), 100) }
  const sendToSocial = (it) => {
    try { localStorage.setItem('lyft_studio_handoff', JSON.stringify({ url: it.url, type: it.type })) } catch {}
    if (onNavigate) onNavigate('social')
    else { try { window.open('/?tab=social', '_blank') } catch {} }
  }

  const onPickFiles = (e) => {
    const files = Array.from(e.target.files || []).slice(0, 3)
    files.forEach(f => {
      if (!f.type.startsWith('image/')) return
      const reader = new FileReader()
      reader.onload = () => setRefImages(prev => [...prev, { dataUrl: reader.result, name: f.name }].slice(0, 3))
      reader.readAsDataURL(f)
    })
    e.target.value = ''
  }

  // Selettore prodotto (da Shopify): il prodotto reale come reference + nel prompt
  const openProducts = async () => {
    setShowProducts(true)
    if (products === null) {
      try {
        const r = await fetch('/api/studio/products', { cache: 'no-store' })
        const j = await r.json()
        setProducts(j.products || [])
      } catch { setProducts([]) }
    }
  }
  const pickProduct = (p) => {
    // Prende TUTTE le foto del prodotto (più angoli = più fedeltà col multi-Kontext)
    const imgs = (p.images && p.images.length ? p.images : [p.image]).filter(Boolean).slice(0, 4)
    setRefImages(imgs.map((u, i) => ({ url: u, name: p.title, product: true })))
    setKind('image'); setModel('flux-kontext') // fedeltà prodotto (Kontext)
    if (!input.trim()) setInput(t('cs.productPrompt', { name: p.title }, `Scatto prodotto di ${p.title}`))
    setShowProducts(false)
  }

  const toggleRec = async () => {
    if (recording) { try { recRef.current?.stop() } catch {}; return }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = e => { if (e.data?.size) chunksRef.current.push(e.data) }
      mr.onstop = async () => {
        stream.getTracks().forEach(t => t.stop()); setRecording(false)
        const blob = new Blob(chunksRef.current, { type: mr.mimeType || 'audio/webm' })
        const fd = new FormData(); fd.append('file', blob, 'audio.webm')
        try {
          const r = await fetch('/api/studio/transcribe', { method: 'POST', body: fd })
          const j = await r.json()
          if (j.text) setInput(prev => (prev ? prev + ' ' : '') + j.text)
          else setError(j.error || t('cs.voiceFail', null, 'Trascrizione fallita.'))
        } catch (e) { setError(e.message) }
      }
      recRef.current = mr; mr.start(); setRecording(true)
    } catch { setError(t('cs.micFail', null, 'Microfono non disponibile o permesso negato.')) }
  }

  // Applica una modifica (edit testuale o reframe) a una singola immagine.
  // Ritorna { ok, item, error }. Aggiunge il risultato alla board.
  const applyEdit = async ({ imageUrl, mode, instruction, format, srcFormat }) => {
    try {
      const r = await fetch('/api/studio/edit', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, mode, instruction, format, srcFormat }),
      })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') { setBalance(j.balance ?? balance); setShowRecharge(true); return { ok: false, error: 'insufficient' } }
      if (!r.ok || !j.image?.url) { if (typeof j.balance === 'number') setBalance(j.balance); return { ok: false, error: j.error } }
      const it = { type: 'image', url: j.image.url, modelName: mode === 'reframe' ? 'Reframe' : 'Edit', prompt: instruction || '', format: j.format }
      setItems(prev => [it, ...prev])
      if (typeof j.balance === 'number') setBalance(j.balance)
      return { ok: true, item: it }
    } catch (e) { return { ok: false, error: e.message } }
  }

  // Upscaler creativo + Relight (Magnific-style). Ritorna { ok, item, error }.
  const applyEnhance = async ({ imageUrl, mode, scale, prompt, srcFormat }) => {
    try {
      const r = await fetch('/api/studio/enhance', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl, mode, scale, prompt, srcFormat }),
      })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') { setBalance(j.balance ?? balance); setShowRecharge(true); return { ok: false, error: 'insufficient' } }
      if (!r.ok || !j.image?.url) { if (typeof j.balance === 'number') setBalance(j.balance); return { ok: false, error: j.error } }
      const it = { type: 'image', url: j.image.url, modelName: mode === 'upscale' ? `Upscale ${scale || '2x'}` : 'Relight', prompt: prompt || '', format: j.format }
      setItems(prev => [it, ...prev])
      if (typeof j.balance === 'number') setBalance(j.balance)
      return { ok: true, item: it }
    } catch (e) { return { ok: false, error: e.message } }
  }

  const doLightboxUpscale = async (scale) => {
    if (!lightbox || editing) return
    setEditing(true); setError('')
    const res = await applyEnhance({ imageUrl: lightbox.url, mode: 'upscale', scale, srcFormat: lightbox.format })
    setEditing(false)
    if (res.ok) setLightbox(res.item)
    else if (res.error && res.error !== 'insufficient') setError(res.error)
  }

  const doLightboxRelight = async () => {
    if (!lightbox || editing) return
    const studioStr = studioPresets.find(s => s.id === activeStudio)?.prompt
    const light = relightInstr.trim() || studioStr
    if (!light) { setError(t('cs.relightNeed', null, 'Scrivi la luce o seleziona uno Studio.')); return }
    setEditing(true); setError('')
    const res = await applyEnhance({ imageUrl: lightbox.url, mode: 'relight', prompt: light, srcFormat: lightbox.format })
    setEditing(false)
    if (res.ok) { setRelightInstr(''); setLightbox(res.item) }
    else if (res.error && res.error !== 'insufficient') setError(res.error)
  }

  // Inpainting con maschera (Weave-style) — chiamato dal MaskEditor.
  const doInpaint = async ({ maskUrl, prompt }) => {
    if (!maskEdit || editing) return
    setEditing(true); setError('')
    const res = await applyEnhance({ imageUrl: maskEdit, mode: 'inpaint', prompt, maskUrl, srcFormat: lightbox?.format })
    setEditing(false)
    if (res.ok) { setMaskEdit(null); setLightbox(res.item) }
    else if (res.error && res.error !== 'insufficient') setError(res.error)
  }

  // Camera angle: stessa scena, nuovo angolo (via edit Kontext).
  const doLightboxCamera = async (angle) => {
    if (!lightbox || editing) return
    setEditing(true); setError('')
    const instr = `${angle.instr}; keep the exact same subject, product, materials, colors and scene identical, only change the camera angle`
    const res = await applyEdit({ imageUrl: lightbox.url, mode: 'edit', instruction: instr, srcFormat: lightbox.format })
    setEditing(false)
    if (res.ok) setLightbox(res.item)
    else if (res.error && res.error !== 'insufficient') setError(res.error)
  }

  // Recipe (Weave-style): incatena operazioni su un'immagine, passando il
  // risultato di ogni step al successivo.
  const runRecipe = async (rec) => {
    if (!lightbox || recipe || editing) return
    const studioStr = studioPresets.find(s => s.id === activeStudio)?.prompt
    setError(''); setRecipe({ label: rec.label, done: 0, total: rec.steps.length })
    let cur = lightbox
    for (let i = 0; i < rec.steps.length; i++) {
      const st = rec.steps[i]
      let res
      if (st.op === 'upscale') res = await applyEnhance({ imageUrl: cur.url, mode: 'upscale', scale: st.scale, srcFormat: cur.format })
      else if (st.op === 'relight') res = await applyEnhance({ imageUrl: cur.url, mode: 'relight', prompt: (st.useStudio && studioStr) || st.prompt, srcFormat: cur.format })
      else if (st.op === 'reframe') res = await applyEdit({ imageUrl: cur.url, mode: 'reframe', format: st.format, srcFormat: cur.format })
      if (!res?.ok) { if (res?.error && res.error !== 'insufficient') setError(res.error); setRecipe(null); return }
      cur = res.item
      setRecipe({ label: rec.label, done: i + 1, total: rec.steps.length })
      setLightbox(cur)
    }
    setRecipe(null)
  }

  const doLightboxEdit = async (mode, format) => {
    if (!lightbox || editing) return
    if (mode === 'edit' && !editInstr.trim()) return
    setEditing(true); setError('')
    const res = await applyEdit({ imageUrl: lightbox.url, mode, instruction: editInstr.trim(), format, srcFormat: lightbox.format })
    setEditing(false)
    if (res.ok) { setEditInstr(''); setLightbox(res.item) }
    else if (res.error && res.error !== 'insufficient') setError(res.error)
  }

  // Selezione multipla
  const toggleSel = (url) => setSelected(prev => { const n = new Set(prev); n.has(url) ? n.delete(url) : (n.size < 100 && n.add(url)); return n })
  const selectAll = () => setSelected(new Set(items.filter(it => it.type === 'image').slice(0, 100).map(it => it.url)))
  const clearSel = () => setSelected(new Set())

  // Batch: applica edit/reframe a tutte le selezionate (pool di concorrenza)
  const runBatch = async (mode, scale) => {
    const urls = [...selected]
    if (!urls.length || batch) return
    if (mode === 'edit' && !batchInstr.trim()) return
    setError(''); setBatch({ done: 0, total: urls.length })
    let idx = 0, done = 0
    const worker = async () => {
      while (idx < urls.length) {
        const u = urls[idx++]
        const res = mode === 'upscale'
          ? await applyEnhance({ imageUrl: u, mode: 'upscale', scale, srcFormat: 'square' })
          : await applyEdit({ imageUrl: u, mode, instruction: batchInstr.trim(), format: batchFmt, srcFormat: 'square' })
        done++; setBatch({ done, total: urls.length })
        if (!res.ok && res.error === 'insufficient') { idx = urls.length; break }
      }
    }
    await Promise.all([worker(), worker(), worker()]) // 3 in parallelo
    setBatch(null); setBatchInstr('')
  }

  const buyPack = async (packId) => {
    setBuying(packId)
    try {
      const r = await fetch('/api/credits/checkout', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ packId }) })
      const j = await r.json()
      if (j.url) window.location.href = j.url
      else { setError(j.error || 'Checkout non disponibile'); setBuying('') }
    } catch (e) { setError(e.message); setBuying('') }
  }

  const aspectFor = (f) => f === 'vertical' ? '9 / 16' : f === 'landscape' ? '16 / 9' : f === 'portrait' ? '4 / 5' : '1 / 1'
  const cycleFormat = () => setFormat(f => f === 'square' ? 'vertical' : f === 'vertical' ? 'landscape' : 'square')
  const placeholder = kind === 'video'
    ? (sourceImage ? t('cs.animPlaceholder', null, 'Come animarla? Es: lento dolly in, il prodotto che ruota…') : t('cs.videoPlaceholder', null, 'Descrivi il video: soggetto, movimento, camera, mood…'))
    : t('cs.placeholder', null, 'Es: il nostro best-seller su sfondo minimal, luce da studio…')
  const txLabel = (reason) => ({ purchase: t('cs.txPurchase', null, 'Acquisto'), spend: t('cs.txSpend', null, 'Generazione'), refund: t('cs.txRefund', null, 'Rimborso'), grant: t('cs.txGrant', null, 'Omaggio') }[reason] || reason)

  const tool = (active) => ({ background: active ? 'rgba(123,91,255,0.22)' : 'transparent', border: 'none', borderRadius: 9, width: 34, height: 34, color: active ? '#fff' : 'var(--text2,#9aa)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' })

  return (
    <div style={{ color: '#fff', fontFamily: 'Barlow', height: standalone ? '100dvh' : '78vh', display: 'flex', flexDirection: 'column' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: standalone ? '12px 18px' : '0 0 12px', flexWrap: 'wrap', flexShrink: 0 }}>
        <CreativeStudioLogo size={26} />
        <div style={{ flex: 1 }} />
        {!standalone && (
          <a href="/creative-studio" target="_blank" rel="noopener" style={{ background: 'var(--glass,#14141d)', border: '1px solid var(--border)', borderRadius: 999, padding: '7px 14px', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6 }}>↗ {t('cs.openApp', null, 'Apri come app')}</a>
        )}
        <button onClick={() => setShowHistory(true)} title={t('cs.historyTitle', null, 'Storico crediti')} style={{ background: 'var(--glass,#14141d)', border: '1px solid var(--border)', borderRadius: 999, width: 34, height: 34, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="list" size={15} /></button>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--glass,#14141d)', border: '1px solid var(--border)', borderRadius: 999, padding: '6px 13px' }}>
          <Icon name="sparkles" size={14} /><span style={{ fontWeight: 800, fontSize: 14 }}>{balance == null ? '—' : balance}</span>
          <span style={{ fontSize: 12, color: 'var(--text2,#9aa)' }}>{t('cs.credits', null, 'crediti')}</span>
        </div>
        <button onClick={() => setShowRecharge(true)} style={{ background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 999, padding: '7px 15px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="plus" size={12} /> {t('cs.recharge', null, 'Ricarica')}</button>
      </div>

      {/* Body: lavagna + chat */}
      <div style={{ flex: 1, minHeight: 0, display: 'flex' }}>
        {/* LAVAGNA INFINITA */}
        <div
          ref={viewportRef}
          onMouseDown={onCanvasDown} onMouseMove={onCanvasMove} onMouseUp={endPan} onMouseLeave={endPan} onContextMenu={onCanvasContext}
          style={{
            flex: 1, minWidth: 0, position: 'relative', overflow: 'hidden',
            cursor: selectMode ? 'crosshair' : (panRef.current.dragging ? 'grabbing' : 'grab'),
            backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.06) 1px, transparent 1px)',
            backgroundSize: `${24 * zoom}px ${24 * zoom}px`,
            backgroundPosition: `${pan.x}px ${pan.y}px`,
          }}
        >
          {items.length === 0 && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none', color: 'var(--text3,#777)' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ marginBottom: 12, opacity: 0.5 }}><Icon name="image" size={40} /></div>
                <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text2,#9aa)' }}>{t('cs.emptyTitle', null, 'La tua board è vuota')}</div>
                <div style={{ fontSize: 13, marginTop: 4 }}>{t('cs.emptyHintChat', null, 'Usa la chat a destra per creare.')}</div>
              </div>
            </div>
          )}

          {/* Contenuto trasformato (pan + zoom) */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: 1180, transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`, transformOrigin: '0 0' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
              {items.map((it, i) => (
                <div key={i} {...(it.type === 'image' ? { 'data-card-url': it.url } : {})} onMouseDown={e => e.stopPropagation()} className="glass-card-static" style={{ borderRadius: 14, overflow: 'hidden', border: selected.has(it.url) ? '2px solid #7b5bff' : '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                  <div
                    onClick={() => { if (selectMode) toggleSel(it.url); else if (it.type === 'image') { setLightbox(it); setEditInstr('') } }}
                    style={{ position: 'relative', aspectRatio: aspectFor(it.format), background: '#000', cursor: it.type === 'image' || selectMode ? 'pointer' : 'default' }}>
                    {it.type === 'video'
                      ? <video src={it.url} controls loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                      : <img src={it.url} alt="" draggable={false} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                    <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', fontSize: 10.5, fontWeight: 700 }}>{it.modelName}</span>
                    {selectMode && (
                      <span style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', border: '2px solid #fff', background: selected.has(it.url) ? '#7b5bff' : 'rgba(0,0,0,0.4)', display: 'grid', placeItems: 'center' }}>{selected.has(it.url) && <Icon name="check" size={12} />}</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, padding: 8, flexWrap: 'wrap' }}>
                    <a href={it.url} download target="_blank" rel="noreferrer" style={{ flex: 1, minWidth: 50, textAlign: 'center', textDecoration: 'none', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Icon name="download" size={12} /></a>
                    {it.type === 'image' && <button onClick={() => animate(it)} title={t('cs.animate', null, 'Anima')} style={{ background: 'rgba(123,91,255,0.18)', border: '1px solid #7b5bff', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="sparkles" size={12} /> {t('cs.animate', null, 'Anima')}</button>}
                    <button onClick={() => sendToSocial(it)} title={t('cs.sendSocial', null, 'Manda a Social Studio')} style={{ background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer' }}><Icon name="send" size={13} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rettangolo di selezione (marquee) */}
          {marquee && (() => {
            const vr = viewportRef.current?.getBoundingClientRect(); if (!vr) return null
            const left = Math.min(marquee.x0, marquee.x1) - vr.left, top = Math.min(marquee.y0, marquee.y1) - vr.top
            const w = Math.abs(marquee.x1 - marquee.x0), h = Math.abs(marquee.y1 - marquee.y0)
            return <div style={{ position: 'absolute', left, top, width: w, height: h, border: '1.5px solid #7b5bff', background: 'rgba(123,91,255,0.12)', borderRadius: 4, pointerEvents: 'none', zIndex: 5 }} />
          })()}

          {/* Barra selezione/batch (in alto, in modalità selezione) */}
          {selectMode && (
            <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', top: 14, left: 0, right: 0, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
              <div className="glass-card-static" style={{ pointerEvents: 'auto', display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 14, border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', flexWrap: 'wrap', maxWidth: '94%' }}>
                <span style={{ fontSize: 13, fontWeight: 800 }}>{selected.size} {t('cs.selected', null, 'selezionate')}</span>
                <button onClick={selectAll} style={{ ...chip }}>{t('cs.selectAll', null, 'Tutte')}</button>
                <button onClick={clearSel} style={{ ...chip }}>{t('cs.clear', null, 'Pulisci')}</button>
                <span style={sep} />
                {/* Reframe */}
                <div style={{ display: 'inline-flex', gap: 4 }}>{FORMATS.map(f => <button key={f.id} onClick={() => setBatchFmt(f.id)} style={{ ...chip, ...(batchFmt === f.id ? chipOn : {}) }}>{f.label}</button>)}</div>
                <button onClick={() => runBatch('reframe')} disabled={!selected.size || !!batch} style={{ ...miniBtn, opacity: !selected.size || batch ? 0.5 : 1 }}>{t('cs.reframe', null, 'Riformatta')}</button>
                <span style={sep} />
                <button onClick={() => runBatch('upscale', '2x')} disabled={!selected.size || !!batch} style={{ ...miniBtn, opacity: !selected.size || batch ? 0.5 : 1 }}><Icon name="scan" size={12} /> {t('cs.upscale2x', null, 'Upscale 2×')}</button>
                <span style={sep} />
                {/* Edit */}
                <input value={batchInstr} onChange={e => setBatchInstr(e.target.value)} placeholder={t('cs.editPlaceholder', null, 'Modifica… es: sfondo nero')} style={{ background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 8, padding: '7px 10px', color: '#fff', fontSize: 12.5, fontFamily: 'Barlow', width: 180 }} />
                <button onClick={() => runBatch('edit')} disabled={!selected.size || !batchInstr.trim() || !!batch} style={{ ...miniBtn, opacity: !selected.size || !batchInstr.trim() || batch ? 0.5 : 1 }}>{t('cs.applyAll', null, 'Applica a tutte')}</button>
                {batch && <span style={{ fontSize: 12.5, fontWeight: 800, color: '#7b5bff' }}>{batch.done}/{batch.total}</span>}
                {selected.size > 0 && !batch && <span style={{ fontSize: 11.5, color: 'var(--text2,#9aa)' }}>{t('cs.cost', { n: selected.size * 2 }, `${selected.size * 2} cr`)}</span>}
              </div>
            </div>
          )}

          {/* Controllo zoom (basso-sinistra) */}
          <div onMouseDown={e => e.stopPropagation()} className="glass-card-static" style={{ position: 'absolute', left: 16, bottom: 16, display: 'inline-flex', alignItems: 'center', gap: 4, padding: 5, borderRadius: 999, border: '1px solid var(--border)' }}>
            <button onClick={() => zoomBy(1 / 1.2)} style={tool(false)} title="Zoom -"><Icon name="minus" size={15} /></button>
            <button onClick={resetView} style={{ background: 'transparent', border: 'none', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 700, minWidth: 44 }}>{Math.round(zoom * 100)}%</button>
            <button onClick={() => zoomBy(1.2)} style={tool(false)} title="Zoom +"><Icon name="plus" size={15} /></button>
          </div>

          {/* TOOLBAR Luma-style (basso-centro) */}
          <div onMouseDown={e => e.stopPropagation()} style={{ position: 'absolute', left: 0, right: 0, bottom: 16, display: 'flex', justifyContent: 'center', pointerEvents: 'none' }}>
            <div className="glass-card-static" style={{ pointerEvents: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, padding: '6px 8px', borderRadius: 999, border: '1px solid var(--border)', boxShadow: '0 8px 30px rgba(0,0,0,0.4)', flexWrap: 'wrap', maxWidth: '95%' }}>
              <button onClick={exitSelect} title={t('cs.toolMove', null, 'Sposta (pan)')} style={tool(!selectMode)}><Icon name="cursor" size={16} /></button>
              <button onClick={() => setSelectMode(true)} title={t('cs.toolSelect', null, 'Seleziona (trascina)')} style={tool(selectMode)}><Icon name="check-circle" size={16} /></button>
              {selectMode && selected.size > 0 && <span style={{ fontSize: 12, fontWeight: 800, color: '#7b5bff', padding: '0 4px' }}>{selected.size}</span>}
              <span style={sep} />
              <button onClick={() => { setKind('image'); setError('') }} title={t('cs.modeImage', null, 'Immagine')} style={tool(kind === 'image')}><Icon name="image" size={16} /></button>
              <button onClick={() => { setKind('video'); setError('') }} title={t('cs.modeVideo', null, 'Video')} style={tool(kind === 'video')}><Icon name="video" size={16} /></button>
              <button onClick={toggleRec} title={t('cs.voice', null, 'Vocale')} style={{ ...tool(recording), color: recording ? '#ff453a' : 'var(--text2,#9aa)' }}><Icon name="wave" size={16} /></button>
              <button onClick={() => fileRef.current?.click()} title={t('cs.attach', null, 'Allega riferimento')} style={tool(false)}><Icon name="image" size={15} filled /></button>
              <button onClick={openProducts} title={t('cs.product', null, 'Prodotto dal negozio')} style={tool(refImages.some(r => r.product))}><Icon name="bag" size={16} /></button>
              <button onClick={() => setShowStudios(true)} title={t('cs.studios', null, 'Studios — ambienti')} style={tool(!!activeStudio || showStudios)}><Icon name="grid" size={16} /></button>
              <button onClick={cycleFormat} title={t('cs.format', null, 'Formato')} style={tool(false)}><Icon name="crop" size={16} /></button>
              <span style={sep} />
              {kind === 'video'
                ? <select value={videoModel} onChange={e => setVideoModel(e.target.value)} style={selStyle}>{videoModels.map(m => <option key={m.id} value={m.id}>{m.name} · {m.credits}cr</option>)}</select>
                : <select value={model} onChange={e => setModel(e.target.value)} style={selStyle}>{models.map(m => <option key={m.id} value={m.id}>{m.name} · {m.credits}cr</option>)}</select>}
              <button onClick={cycleFormat} style={{ ...chip, ...chipOn }} title={t('cs.format', null, 'Formato')}>{FORMATS.find(f => f.id === format)?.label}</button>
              {kind === 'image' && <select value={count} onChange={e => setCount(parseInt(e.target.value))} style={selStyle}>{[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}×</option>)}</select>}
            </div>
          </div>
        </div>

        {/* CHAT laterale */}
        <div style={{ width: 360, maxWidth: '42vw', flexShrink: 0, borderLeft: '1px solid var(--border)', background: 'rgba(10,10,18,0.45)', display: 'flex', flexDirection: 'column' }}>
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', fontSize: 13, fontWeight: 800, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="sparkles" size={15} /> {t('cs.agentTitle', null, 'Creative Agent')}
          </div>
          <div style={{ flex: 1, overflowY: 'auto', padding: 14, display: 'flex', flexDirection: 'column', gap: 12 }}>
            {messages.length === 0 && <div style={{ fontSize: 13, color: 'var(--text2,#9aa)', lineHeight: 1.6 }}>{t('cs.agentHello', null, 'Descrivimi cosa creare. Conosco brand, prodotti e performance. Puoi anche parlare o allegare immagini di riferimento.')}</div>}
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.role === 'user' ? 'flex-end' : 'flex-start', maxWidth: '92%' }}>
                <div style={{ borderRadius: 12, padding: '9px 12px', fontSize: 13, lineHeight: 1.45, background: m.role === 'user' ? 'linear-gradient(135deg,#7b5bff,#5b8bff)' : (m.error ? 'rgba(255,69,58,0.14)' : 'var(--glass2,rgba(255,255,255,0.05))'), border: m.role === 'user' ? 'none' : '1px solid var(--border)', color: m.error ? '#ff8095' : '#fff' }}>
                  {m.pending ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><span className="csDot" />{m.text}</span> : m.text}
                  {m.media?.length > 0 && (
                    <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
                      {m.media.map((md, k) => md.type === 'video'
                        ? <video key={k} src={md.url} muted loop playsInline style={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 8 }} />
                        : <img key={k} src={md.url} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 8 }} />)}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={msgEndRef} />
          </div>

          {error && <div style={{ margin: '0 14px', background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.35)', color: '#ff8095', borderRadius: 8, padding: '7px 10px', fontSize: 12 }}>{error}</div>}

          <div style={{ padding: 12, borderTop: '1px solid var(--border)' }}>
            {kind === 'video' && sourceImage && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8, padding: 6, borderRadius: 9, background: 'var(--glass2,rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}>
                <img src={sourceImage} alt="" style={{ width: 34, height: 34, borderRadius: 6, objectFit: 'cover' }} />
                <span style={{ flex: 1, fontSize: 11.5, color: 'var(--text2,#9aa)' }}>{t('cs.sourceImage', null, 'Immagine di partenza')}</span>
                <button onClick={() => setSourceImage(null)} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '3px 8px', color: '#fff', cursor: 'pointer', fontSize: 11 }}>×</button>
              </div>
            )}
            {refImages.length > 0 && (
              <div style={{ display: 'flex', gap: 8, marginBottom: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
                {refImages.map((r, i) => {
                  const isStyle = r.role === 'style'
                  const toggleRole = () => setRefImages(refImages.map((x, j) => j === i ? { ...x, role: isStyle ? 'subject' : 'style' } : x))
                  return (
                    <div key={i} style={{ position: 'relative', width: 40 }}>
                      <img src={r.dataUrl || r.url} alt="" style={{ width: 40, height: 40, borderRadius: 7, objectFit: 'cover', border: isStyle ? '1.5px solid #7b5bff' : '1px solid var(--border)' }} />
                      <button onClick={() => setRefImages(refImages.filter((_, j) => j !== i))} style={{ position: 'absolute', top: -6, right: -6, width: 16, height: 16, borderRadius: 8, border: 'none', background: '#000', color: '#fff', cursor: 'pointer', fontSize: 10, lineHeight: 1 }}>×</button>
                      <button onClick={toggleRole} title={t('cs.refRoleToggle', null, 'Soggetto / Stile')} style={{ marginTop: 3, width: '100%', padding: '2px 0', borderRadius: 6, border: isStyle ? '1px solid #7b5bff' : '1px solid var(--border)', background: isStyle ? 'rgba(123,91,255,0.18)' : 'var(--glass2,rgba(255,255,255,0.05))', color: isStyle ? '#c4b5fd' : 'var(--text2,#9aa)', fontSize: 9, fontWeight: 800, cursor: 'pointer', fontFamily: 'Barlow' }}>{isStyle ? t('cs.refStyle', null, 'STILE') : t('cs.refSubject', null, 'SOGG.')}</button>
                    </div>
                  )
                })}
              </div>
            )}
            {(() => {
              const st = studioPresets.find(s => s.id === activeStudio)
              if (!st) return null
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 8, padding: '6px 8px', borderRadius: 10, background: 'rgba(123,91,255,0.10)', border: '1px solid #7b5bff' }}>
                  <span style={{ width: 30, height: 30, borderRadius: 7, flexShrink: 0, background: st.swatch, border: '1px solid rgba(255,255,255,0.18)', overflow: 'hidden', display: 'inline-block' }}>
                    {st.preview && <img src={st.preview} alt="" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 10, color: '#b9a8ff', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.06em' }}>{t('cs.studioApplied', null, 'Ambiente applicato')}</div>
                    <div style={{ fontSize: 12.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{st.label}</div>
                  </div>
                  <button onClick={() => setShowStudios(true)} title={t('cs.studioChange', null, 'Cambia ambiente')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, padding: '4px 9px', color: '#fff', cursor: 'pointer', fontSize: 11, fontWeight: 700 }}>{t('cs.studioChangeBtn', null, 'Cambia')}</button>
                  <button onClick={() => setActiveStudio(null)} title={t('cs.studioRemove', null, 'Rimuovi ambiente')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, width: 26, height: 26, color: '#fff', cursor: 'pointer', fontSize: 13 }}>×</button>
                </div>
              )
            })()}
            {activeStyle && (() => {
              const sp = stylePresets.find(s => s.id === activeStyle)
              if (!sp) return null
              return (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                  <button onClick={() => setActiveStyle(null)} style={{ ...chip, ...chipOn, padding: '5px 10px', fontSize: 11.5, display: 'inline-flex', alignItems: 'center', gap: 6 }}>{sp.label} <span style={{ opacity: 0.8 }}>×</span></button>
                </div>
              )
            })()}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 12, padding: 8 }}>
              <textarea ref={taRef} value={input} onChange={e => setInput(e.target.value)} onKeyDown={onKeyDown} rows={2} placeholder={placeholder} style={{ flex: 1, resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13.5, fontFamily: 'Barlow', lineHeight: 1.4 }} />
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8 }}>
              <button onClick={() => fileRef.current?.click()} title={t('cs.attach', null, 'Allega riferimento')} style={iconBtn}><Icon name="paperclip" size={16} /></button>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={onPickFiles} style={{ display: 'none' }} />
              <button onClick={toggleRec} title={t('cs.voice', null, 'Vocale')} style={{ ...iconBtn, color: recording ? '#ff453a' : '#fff', borderColor: recording ? '#ff453a' : 'var(--border)' }}><Icon name="mic" size={16} /></button>
              <span style={{ fontSize: 11.5, color: 'var(--text2,#9aa)' }}>{t('cs.cost', { n: cost }, `${cost} cr`)}</span>
              <div style={{ flex: 1 }} />
              <button onClick={generate} disabled={busy || !canGenerate} style={{ background: busy || !canGenerate ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, width: 40, height: 38, color: '#fff', cursor: busy || !canGenerate ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon name="send" size={16} /></button>
            </div>
          </div>
        </div>
      </div>

      {/* Compositore Ad */}
      {adComposer && (
        <AdComposer imageUrl={adComposer} onClose={() => setAdComposer(null)} onSaved={(it) => setItems(prev => [it, ...prev])} />
      )}

      {/* Virtual Try-On */}
      {tryOn && (
        <TryOnModal garmentImage={tryOn} onClose={() => setTryOn(null)} onSaved={(it) => setItems(prev => [it, ...prev])} onCredits={(b) => typeof b === 'number' && setBalance(b)} />
      )}

      {/* Inpainting con maschera (Weave-style) */}
      {maskEdit && (
        <MaskEditor imageUrl={maskEdit} busy={editing} onApply={doInpaint} onClose={() => setMaskEdit(null)} />
      )}

      {/* Lightbox: apri immagine + edit testuale + reframe */}
      {lightbox && (
        <div onClick={() => setLightbox(null)} style={modalBg}>
          <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 16, borderRadius: 16, width: 880, maxWidth: '96vw', maxHeight: '92vh', display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 340px', minWidth: 280, display: 'grid', placeItems: 'center', background: '#000', borderRadius: 12, overflow: 'hidden', maxHeight: '80vh' }}>
              <img src={lightbox.url} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
            </div>
            <div style={{ flex: '1 1 280px', minWidth: 260, display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
                <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{t('cs.editTitle', null, 'Modifica immagine')}</div>
                <button onClick={() => setLightbox(null)} style={xBtn}>×</button>
              </div>

              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 6 }}>{t('cs.reframe', null, 'Riformatta')}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
                {FORMATS.map(f => <button key={f.id} onClick={() => doLightboxEdit('reframe', f.id)} disabled={editing} style={{ ...chip }}>{f.label}</button>)}
              </div>

              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 6 }}>{t('cs.editByText', null, 'Modifica a parole')}</div>
              <textarea value={editInstr} onChange={e => setEditInstr(e.target.value)} rows={3} placeholder={t('cs.editPlaceholder', null, 'Es: sfondo nero, togli la persona, luce più calda…')} style={{ width: '100%', resize: 'none', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, fontFamily: 'Barlow', marginBottom: 8 }} />
              <button onClick={() => doLightboxEdit('edit')} disabled={editing || !editInstr.trim()} style={{ ...miniBtn, opacity: editing || !editInstr.trim() ? 0.5 : 1, justifyContent: 'center', padding: '10px 0' }}>{editing ? t('cs.editing', null, 'Modifico…') : `${t('cs.apply', null, 'Applica')} · 2 cr`}</button>

              {/* Upscaler creativo (Magnific-style) */}
              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '16px 0 6px' }}>{t('cs.upscale', null, 'Upscale creativo')}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                {UPSCALES.map(u => <button key={u.id} onClick={() => doLightboxUpscale(u.id)} disabled={editing} style={{ ...miniBtn, opacity: editing ? 0.5 : 1 }}><Icon name="scan" size={12} /> {u.label} · {u.credits} cr</button>)}
              </div>
              <div style={{ fontSize: 10.5, color: 'var(--text3,#888)', marginBottom: 8 }}>{t('cs.upscaleHint', null, 'Alza risoluzione e rigenera micro-dettaglio (pelle, tessuti).')}</div>

              {/* Relight (Magnific Relight) */}
              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '8px 0 6px' }}>{t('cs.relight', null, 'Relight — illuminazione')}</div>
              <textarea value={relightInstr} onChange={e => setRelightInstr(e.target.value)} rows={2} placeholder={activeStudio ? t('cs.relightStudioPh', { name: studioPresets.find(s => s.id === activeStudio)?.label }, `Vuoto = usa la luce dello Studio "${studioPresets.find(s => s.id === activeStudio)?.label}"`) : t('cs.relightPh', null, 'Es: luce calda da sinistra al tramonto, ombre morbide…')} style={{ width: '100%', resize: 'none', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, fontFamily: 'Barlow', marginBottom: 8 }} />
              <button onClick={doLightboxRelight} disabled={editing || (!relightInstr.trim() && !activeStudio)} style={{ ...miniBtn, opacity: editing || (!relightInstr.trim() && !activeStudio) ? 0.5 : 1, justifyContent: 'center', padding: '10px 0' }}><Icon name="bulb" size={13} /> {editing ? t('cs.editing', null, 'Modifico…') : `${t('cs.relightApply', null, 'Riaccendi')} · ${RELIGHT_COST} cr`}</button>

              {/* Inpainting con maschera (Weave-style) */}
              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '16px 0 6px' }}>{t('cs.inpaint', null, 'Inpainting — maschera')}</div>
              <button onClick={() => setMaskEdit(lightbox.url)} disabled={editing} style={{ ...miniBtn, opacity: editing ? 0.5 : 1, justifyContent: 'center', padding: '10px 0' }}><Icon name="edit" size={13} /> {t('cs.inpaintOpen', null, 'Dipingi e rigenera area')} · 3 cr</button>

              {/* Camera angle (Weave-style) */}
              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '16px 0 6px' }}>{t('cs.cameraAngle', null, 'Angolo camera')}</div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 4, flexWrap: 'wrap' }}>
                {CAMERA_ANGLES.map(a => <button key={a.id} onClick={() => doLightboxCamera(a)} disabled={editing} style={{ ...chip, opacity: editing ? 0.5 : 1 }}>{a.label}</button>)}
              </div>

              {/* Recipes (Weave-style workflow 1-click) */}
              <div style={{ fontSize: 11, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '16px 0 6px' }}>{t('cs.recipes', null, 'Recipe — 1 click')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {RECIPES.map(r => (
                  <button key={r.id} onClick={() => runRecipe(r)} disabled={!!recipe || editing} style={{ ...chip, opacity: recipe || editing ? 0.6 : 1, display: 'flex', alignItems: 'center', gap: 8, textAlign: 'left' }}>
                    <Icon name="bolt" size={12} />
                    <span style={{ fontWeight: 800, color: '#fff' }}>{r.label}</span>
                    <span style={{ fontSize: 10.5, color: 'var(--text2,#9aa)' }}>{r.desc}</span>
                    {recipe?.label === r.label && <span style={{ marginLeft: 'auto', color: '#7b5bff', fontWeight: 800 }}>{recipe.done}/{recipe.total}</span>}
                  </button>
                ))}
              </div>

              <div style={{ flex: 1 }} />
              <div style={{ display: 'flex', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
                <a href={lightbox.url} download target="_blank" rel="noreferrer" style={{ ...chip, textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="download" size={12} /> {t('cs.download', null, 'Scarica')}</a>
                <button onClick={() => { setAdComposer(lightbox.url); setLightbox(null) }} style={{ ...miniBtn }}><Icon name="layers" size={12} /> {t('cs.makeAd', null, 'Crea ad')}</button>
                <button onClick={() => { setTryOn(lightbox.url); setLightbox(null) }} style={{ ...chip, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="shirt" size={12} /> {t('cs.tryon', null, 'Indossa')}</button>
                <button onClick={() => { animate(lightbox); setLightbox(null) }} style={{ ...chip, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="sparkles" size={12} /> {t('cs.animate', null, 'Anima')}</button>
                <button onClick={() => sendToSocial(lightbox)} style={{ ...chip, display: 'inline-flex', alignItems: 'center', gap: 5 }}><Icon name="send" size={12} /> Social</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modale selettore prodotto */}
      {showProducts && (
        <div onClick={() => setShowProducts(false)} style={modalBg}>
          <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 20, borderRadius: 16, width: 560, maxWidth: '95vw', maxHeight: '82vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 10 }}>
              <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{t('cs.productTitle', null, 'Scegli un prodotto')}</div>
              <button onClick={() => setShowProducts(false)} style={xBtn}>×</button>
            </div>
            <input value={productQuery} onChange={e => setProductQuery(e.target.value)} placeholder={t('cs.productSearch', null, 'Cerca prodotto…')} style={{ width: '100%', marginBottom: 12, background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', color: '#fff', fontSize: 13, fontFamily: 'Barlow' }} />
            <div style={{ overflowY: 'auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: 10 }}>
              {products === null && <div style={{ color: 'var(--text2,#9aa)', fontSize: 13, gridColumn: '1/-1' }}>{t('cs.loading', null, 'Carico…')}</div>}
              {products && products.length === 0 && <div style={{ color: 'var(--text2,#9aa)', fontSize: 13, gridColumn: '1/-1' }}>{t('cs.noProducts', null, 'Nessun prodotto trovato (collega Shopify).')}</div>}
              {(products || []).filter(p => !productQuery || p.title.toLowerCase().includes(productQuery.toLowerCase())).map(p => (
                <button key={p.id} onClick={() => pickProduct(p)} style={{ background: 'var(--glass2,rgba(255,255,255,0.04))', border: '1px solid var(--border)', borderRadius: 10, padding: 8, cursor: 'pointer', textAlign: 'left', color: '#fff', fontFamily: 'Barlow' }}>
                  <img src={p.image} alt="" style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: 7, marginBottom: 6 }} />
                  <div style={{ fontSize: 11.5, fontWeight: 700, lineHeight: 1.3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.title}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Pannello STUDIOS (ambienti stile Kive) — drawer da destra */}
      {showStudios && (() => {
        const cats = [{ id: 'all', label: t('cs.studioAll', null, 'Tutti') }, ...studioCategories.map(c => ({ id: c.id, label: t(`cs.cat.${c.id}`, null, c.label) }))]
        const q = studioQuery.trim().toLowerCase()
        const list = studioPresets.filter(s =>
          (studioCat === 'all' || s.category === studioCat) &&
          (!q || s.label.toLowerCase().includes(q))
        )
        return (
          <div onClick={() => setShowStudios(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 2100, display: 'flex', justifyContent: 'flex-end' }}>
            <div onClick={e => e.stopPropagation()} style={{ width: 460, maxWidth: '94vw', height: '100%', background: 'rgba(14,14,22,0.98)', borderLeft: '1px solid var(--border)', display: 'flex', flexDirection: 'column', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)' }}>
              {/* Header */}
              <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--border)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                  <Icon name="grid" size={18} />
                  <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{t('cs.studiosTitle', null, 'Studios — Ambienti')}</div>
                  <button onClick={() => setShowStudios(false)} style={xBtn}>×</button>
                </div>
                <div style={{ fontSize: 12, color: 'var(--text2,#9aa)', lineHeight: 1.45 }}>{t('cs.studiosHint', null, 'Scegli un ambiente: scena, set e luce vengono applicati al prodotto e al prompt.')}</div>
                <input value={studioQuery} onChange={e => setStudioQuery(e.target.value)} placeholder={t('cs.studioSearch', null, 'Cerca ambiente…')} style={{ width: '100%', marginTop: 12, background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 9, padding: '9px 12px', color: '#fff', fontSize: 13, fontFamily: 'Barlow', boxSizing: 'border-box' }} />
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  {cats.map(c => (
                    <button key={c.id} onClick={() => setStudioCat(c.id)} style={{ ...chip, ...(studioCat === c.id ? chipOn : {}), padding: '5px 11px', fontSize: 11.5 }}>{c.label}</button>
                  ))}
                </div>
                {stylePresets.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 6 }}>{t('cs.styleLook', null, 'Stile / Look')}</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {stylePresets.map(s => (
                        <button key={s.id} onClick={() => setActiveStyle(activeStyle === s.id ? null : s.id)} style={{ ...chip, ...(activeStyle === s.id ? chipOn : {}), padding: '5px 11px', fontSize: 11.5 }}>{s.label}</button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
              {/* Griglia preview */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, alignContent: 'start' }}>
                {list.length === 0 && <div style={{ gridColumn: '1/-1', color: 'var(--text2,#9aa)', fontSize: 13, textAlign: 'center', padding: 30 }}>{t('cs.studioNone', null, 'Nessun ambiente trovato.')}</div>}
                {list.map(s => {
                  const on = activeStudio === s.id
                  return (
                    <button key={s.id} onClick={() => { setActiveStudio(s.id); setShowStudios(false) }} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow' }}>
                      <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 12, background: s.swatch, border: on ? '2px solid #7b5bff' : '1px solid var(--border)', overflow: 'hidden', boxShadow: 'inset 0 -40px 50px rgba(0,0,0,0.35)' }}>
                        {s.preview && <img src={s.preview} alt={s.label} loading="lazy" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                        {on && <span style={{ position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: '50%', background: '#7b5bff', display: 'grid', placeItems: 'center', zIndex: 2 }}><Icon name="check" size={12} /></span>}
                      </div>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#fff', marginTop: 7, lineHeight: 1.3 }}>{s.label}</div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )
      })()}

      {/* Modale ricarica */}
      {showRecharge && (
        <div onClick={() => setShowRecharge(false)} style={modalBg}>
          <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 22, borderRadius: 16, width: 520, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{t('cs.rechargeTitle', null, 'Ricarica crediti')}</div>
              <button onClick={() => setShowRecharge(false)} style={xBtn}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2,#9aa)', marginBottom: 16 }}>{t('cs.rechargeHint', null, 'I crediti non scadono. Pagamento sicuro via Stripe.')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {packs.map(p => (
                <button key={p.id} onClick={() => buyPack(p.id)} disabled={!!buying} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: p.best ? '1.5px solid #7b5bff' : '1px solid var(--border)', background: p.best ? 'rgba(123,91,255,0.10)' : 'var(--glass2,rgba(255,255,255,0.04))', color: '#fff', cursor: buying ? 'wait' : 'pointer', fontFamily: 'Barlow' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{p.credits} {t('cs.credits', null, 'crediti')} {p.best && <span style={{ fontSize: 10.5, color: '#7b5bff', fontWeight: 800, marginLeft: 6 }}>{t('cs.bestValue', null, 'MIGLIOR PREZZO')}</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2,#9aa)' }}>≈ {Math.floor(p.credits / 2)} {t('cs.images', null, 'immagini')}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{buying === p.id ? '…' : p.priceLabel}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Modale storico */}
      {showHistory && (
        <div onClick={() => setShowHistory(false)} style={modalBg}>
          <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 22, borderRadius: 16, width: 480, maxWidth: '95vw', maxHeight: '80vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
              <div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{t('cs.historyTitle', null, 'Storico crediti')}</div>
              <button onClick={() => setShowHistory(false)} style={xBtn}>×</button>
            </div>
            {txHistory.length === 0 && <div style={{ fontSize: 13, color: 'var(--text2,#9aa)' }}>{t('cs.noHistory', null, 'Nessun movimento ancora.')}</div>}
            <div style={{ display: 'grid', gap: 8 }}>
              {txHistory.map(tx => (
                <div key={tx.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 10, background: 'var(--glass2,rgba(255,255,255,0.04))', border: '1px solid var(--border)' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, fontWeight: 700 }}>{txLabel(tx.reason)}{tx.model ? ` · ${tx.model}` : ''}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3,#888)' }}>{tx.created_at ? new Date(tx.created_at).toLocaleString(intlLocale || undefined) : ''}</div>
                  </div>
                  <div style={{ fontSize: 14, fontWeight: 800, color: tx.delta >= 0 ? '#30d158' : '#ff8095' }}>{tx.delta >= 0 ? '+' : ''}{tx.delta}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .csDot { width: 8px; height: 8px; border-radius: 50%; background: #7b5bff; display: inline-block; animation: csPulse 1s infinite; }
        @keyframes csPulse { 0%,100% { opacity: .3 } 50% { opacity: 1 } }
      `}</style>
    </div>
  )
}

const selStyle = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 9, padding: '6px 8px', color: '#fff', fontSize: 12, fontFamily: 'Barlow', cursor: 'pointer', maxWidth: 150 }
const chip = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', color: 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const chipOn = { background: 'rgba(123,91,255,0.18)', borderColor: '#7b5bff', color: '#fff' }
const sep = { width: 1, height: 22, background: 'var(--border)', margin: '0 2px' }
const miniBtn = { background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 9, padding: '7px 14px', color: '#fff', fontSize: 12.5, fontWeight: 800, cursor: 'pointer', fontFamily: 'Barlow', display: 'inline-flex', alignItems: 'center', gap: 5 }
const iconBtn = { background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 9, width: 38, height: 38, color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }
const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20 }
const xBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }
