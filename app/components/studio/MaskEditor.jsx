'use client'

import { useEffect, useRef, useState } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Inpainting con maschera (a pennello): l'utente dipinge l'area da
// rigenerare; esportiamo una maschera (nero = tieni, bianco = rigenera) alla
// risoluzione naturale dell'immagine e la passiamo a FLUX Fill.
// Le pennellate sono memorizzate in coordinate normalizzate (0–1) così la
// preview a schermo e la maschera esportata restano perfettamente allineate.
export default function MaskEditor({ imageUrl, busy, onApply, onClose }) {
  const { t } = useI18n()
  const [prompt, setPrompt] = useState('')
  const [brush, setBrush] = useState(0.06) // raggio normalizzato sulla larghezza
  const [nat, setNat] = useState(null)     // { w, h }
  const [strokes, setStrokes] = useState([]) // [{x,y,r}] normalizzati
  const wrapRef = useRef(null)
  const drawing = useRef(false)

  useEffect(() => {
    const im = new Image(); im.crossOrigin = 'anonymous'
    im.onload = () => setNat({ w: im.naturalWidth, h: im.naturalHeight })
    im.src = imageUrl
  }, [imageUrl])

  const addPoint = (e) => {
    const el = wrapRef.current; if (!el) return
    const b = el.getBoundingClientRect()
    const x = (e.clientX - b.left) / b.width
    const y = (e.clientY - b.top) / b.height
    if (x < 0 || x > 1 || y < 0 || y > 1) return
    setStrokes(prev => [...prev, { x, y, r: brush }])
  }
  const down = (e) => { drawing.current = true; addPoint(e) }
  const move = (e) => { if (drawing.current) addPoint(e) }
  const up = () => { drawing.current = false }

  const exportMask = () => {
    if (!nat || !strokes.length) return null
    const c = document.createElement('canvas')
    c.width = nat.w; c.height = nat.h
    const ctx = c.getContext('2d')
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, nat.w, nat.h)
    ctx.fillStyle = '#fff'
    strokes.forEach(s => {
      ctx.beginPath(); ctx.arc(s.x * nat.w, s.y * nat.h, s.r * nat.w, 0, Math.PI * 2); ctx.fill()
    })
    return c.toDataURL('image/png')
  }

  const apply = () => {
    const maskUrl = exportMask()
    if (!maskUrl || !prompt.trim()) return
    onApply({ maskUrl, prompt: prompt.trim() })
  }

  const ar = nat ? nat.w / nat.h : 1
  const modalBg = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2200, display: 'grid', placeItems: 'center', padding: 20 }

  return (
    <div onClick={onClose} style={modalBg}>
      <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 16, borderRadius: 16, width: 760, maxWidth: '96vw', maxHeight: '94vh', display: 'flex', flexDirection: 'column', gap: 12, fontFamily: 'Barlow', color: '#fff' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Icon name="edit" size={16} />
          <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{t('cs.inpaintTitle', null, 'Inpainting — dipingi l’area da rigenerare')}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div
          ref={wrapRef}
          onMouseDown={down} onMouseMove={move} onMouseUp={up} onMouseLeave={up}
          style={{ position: 'relative', width: '100%', maxHeight: '58vh', aspectRatio: String(ar), borderRadius: 12, overflow: 'hidden', background: '#000', cursor: 'crosshair', alignSelf: 'center', userSelect: 'none', touchAction: 'none' }}
        >
          <img src={imageUrl} alt="" draggable={false} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }} />
          {strokes.map((s, i) => (
            <span key={i} style={{ position: 'absolute', left: `${s.x * 100}%`, top: `${s.y * 100}%`, width: `${s.r * 200}%`, paddingBottom: `${s.r * 200 * ar}%`, height: 0, transform: 'translate(-50%,-50%)', borderRadius: '50%', background: 'rgba(123,91,255,0.55)', pointerEvents: 'none' }} />
          ))}
          {!strokes.length && (
            <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', pointerEvents: 'none' }}>
              <span style={{ background: 'rgba(0,0,0,0.55)', padding: '6px 12px', borderRadius: 8, fontSize: 12.5, color: 'var(--text2,#9aa)' }}>{t('cs.inpaintHint', null, 'Trascina per dipingere l’area da modificare')}</span>
            </div>
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--text2,#9aa)' }}>{t('cs.inpaintBrush', null, 'Pennello')}</span>
          <input type="range" min={0.02} max={0.18} step={0.01} value={brush} onChange={e => setBrush(parseFloat(e.target.value))} style={{ width: 120 }} />
          <button onClick={() => setStrokes(prev => prev.slice(0, -1))} disabled={!strokes.length} style={{ ...chip, opacity: strokes.length ? 1 : 0.5 }}>{t('cs.inpaintUndo', null, 'Annulla')}</button>
          <button onClick={() => setStrokes([])} disabled={!strokes.length} style={{ ...chip, opacity: strokes.length ? 1 : 0.5 }}>{t('cs.inpaintClear', null, 'Pulisci')}</button>
        </div>

        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={2} placeholder={t('cs.inpaintPh', null, 'Cosa generare nell’area dipinta? Es: una tasca con zip, sfondo nero, un logo…')} style={{ width: '100%', resize: 'none', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, fontFamily: 'Barlow', boxSizing: 'border-box' }} />

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 11.5, color: 'var(--text2,#9aa)' }}>{t('cs.cost', { n: 3 }, '3 cr')}</span>
          <div style={{ flex: 1 }} />
          <button onClick={apply} disabled={busy || !strokes.length || !prompt.trim()} style={{ background: busy || !strokes.length || !prompt.trim() ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: busy || !strokes.length || !prompt.trim() ? 'default' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="sparkles" size={14} /> {busy ? t('cs.editing', null, 'Modifico…') : t('cs.inpaintApply', null, 'Rigenera area')}
          </button>
        </div>
      </div>
    </div>
  )
}

const chip = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', color: 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
