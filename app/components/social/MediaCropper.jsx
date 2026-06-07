'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Cropper immagini (canvas): taglia/ridimensiona a un rapporto, zoom + trascina.
// La sorgente è SEMPRE un blob/objectURL locale (file caricato o anteprima Drive)
// → il canvas non viene "tainted", il toBlob funziona. Output 1080px lato lungo.
const ASPECTS = [
  { id: '1', label: '1:1', v: 1 },
  { id: '45', label: '4:5', v: 4 / 5 },
  { id: '916', label: '9:16', v: 9 / 16 },
]
const FRAME_W = 300

export default function MediaCropper({ src, initialAspect = 1, busy, onCancel, onApply }) {
  const { t } = useI18n()
  const [aspect, setAspect] = useState(initialAspect)
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const drag = useRef(null)
  const imgRef = useRef(null)

  const frameH = FRAME_W / aspect
  const coverScale = img ? Math.max(FRAME_W / img.w, frameH / img.h) : 1
  const dispScale = coverScale * zoom
  const dispW = img ? img.w * dispScale : 0
  const dispH = img ? img.h * dispScale : 0

  const clamp = useCallback((o) => ({
    x: Math.min(0, Math.max(FRAME_W - dispW, o.x)),
    y: Math.min(0, Math.max(frameH - dispH, o.y)),
  }), [dispW, dispH, frameH])
  useEffect(() => { setOff(o => clamp(o)) }, [zoom, aspect, img, clamp])

  const onImgLoad = (e) => { const el = e.target; setImg({ w: el.naturalWidth, h: el.naturalHeight }); setZoom(1); setOff({ x: 0, y: 0 }) }
  const start = (e) => { const p = e.touches?.[0] || e; drag.current = { x: p.clientX, y: p.clientY, ox: off.x, oy: off.y } }
  const move = (e) => { if (!drag.current) return; const p = e.touches?.[0] || e; setOff(clamp({ x: drag.current.ox + (p.clientX - drag.current.x), y: drag.current.oy + (p.clientY - drag.current.y) })) }
  const end = () => { drag.current = null }

  const apply = () => {
    if (!img || !imgRef.current) return
    const srcX = (-off.x) / dispScale, srcY = (-off.y) / dispScale
    const srcW = FRAME_W / dispScale, srcH = frameH / dispScale
    const outW = 1080, outH = Math.round(1080 / aspect)
    const canvas = document.createElement('canvas'); canvas.width = outW; canvas.height = outH
    const ctx = canvas.getContext('2d')
    ctx.drawImage(imgRef.current, srcX, srcY, srcW, srcH, 0, 0, outW, outH)
    canvas.toBlob((blob) => { if (blob) onApply(blob) }, 'image/jpeg', 0.92)
  }

  return (
    <div onMouseMove={move} onMouseUp={end} onMouseLeave={end} onTouchMove={move} onTouchEnd={end}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="glass-card-static" style={{ padding: 18, borderRadius: 14 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, justifyContent: 'center' }}>
          {ASPECTS.map(a => {
            const on = Math.abs(aspect - a.v) < 0.01
            return <button key={a.id} onClick={() => setAspect(a.v)} style={{ padding: '5px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 700, border: on ? '1px solid #7b5bff' : '1px solid var(--border)', background: on ? 'rgba(123,91,255,0.18)' : 'transparent', color: '#fff' }}>{a.label}</button>
          })}
        </div>
        <div onMouseDown={start} onTouchStart={start} style={{ width: FRAME_W, height: frameH, overflow: 'hidden', position: 'relative', borderRadius: 8, background: '#000', cursor: 'grab', margin: '0 auto', touchAction: 'none' }}>
          <img ref={imgRef} src={src} onLoad={onImgLoad} draggable={false} alt="" style={{ position: 'absolute', left: off.x, top: off.y, width: dispW || 'auto', height: dispH || 'auto', maxWidth: 'none', userSelect: 'none' }} />
        </div>
        <input type="range" min="1" max="3" step="0.01" value={zoom} onChange={e => setZoom(Number(e.target.value))} style={{ width: FRAME_W, display: 'block', margin: '12px auto' }} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} disabled={busy} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>{t('social.cancel')}</button>
          <button onClick={apply} disabled={busy} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 800 }}>{busy ? t('social.cropping') : t('social.applyCrop')}</button>
        </div>
      </div>
    </div>
  )
}
