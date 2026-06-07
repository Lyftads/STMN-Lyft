'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Trim "leggero": salva solo i punti di inizio/fine (metadati). Nessuna
// transcodifica: il taglio vero si applica al momento della pubblicazione.
const fmt = (s) => `${Math.floor((s || 0) / 60)}:${String(Math.floor((s || 0) % 60)).padStart(2, '0')}`

export default function VideoTrimmer({ src, initial, onCancel, onApply }) {
  const { t } = useI18n()
  const vref = useRef(null)
  const [dur, setDur] = useState(0)
  const [start, setStart] = useState(initial?.trimStart || 0)
  const [end, setEnd] = useState(initial?.trimEnd || 0)
  const [cur, setCur] = useState(0)

  const onMeta = (e) => {
    const d = e.target.duration || 0
    setDur(d)
    setEnd((prev) => (prev && prev <= d ? prev : d))
    setStart((prev) => Math.min(prev, d))
  }

  // Durante il play, ferma/ricomincia ai bordi della clip selezionata.
  useEffect(() => {
    const v = vref.current; if (!v) return
    const onT = () => { setCur(v.currentTime); if (v.currentTime >= end) { v.pause(); v.currentTime = start } }
    v.addEventListener('timeupdate', onT)
    return () => v.removeEventListener('timeupdate', onT)
  }, [start, end])

  const playClip = useCallback(() => { const v = vref.current; if (!v) return; v.currentTime = start; v.play().catch(() => {}) }, [start])

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div className="glass-card-static" style={{ padding: 18, borderRadius: 14, width: 340, maxWidth: '95vw' }} onClick={e => e.stopPropagation()}>
        <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)', marginBottom: 10 }}>{t('social.trimTitle')}</div>
        <video ref={vref} src={src} onLoadedMetadata={onMeta} controls muted playsInline style={{ width: '100%', borderRadius: 8, background: '#000', maxHeight: 360 }} />

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', margin: '10px 0 2px' }}>
          <span>{t('social.trimStart')}: <b style={{ color: 'var(--text)' }}>{fmt(start)}</b></span>
          <span>{fmt(cur)} / {fmt(dur)}</span>
          <span>{t('social.trimEnd')}: <b style={{ color: 'var(--text)' }}>{fmt(end)}</b></span>
        </div>
        <input type="range" min={0} max={dur || 0} step={0.1} value={start} onChange={e => setStart(Math.min(Number(e.target.value), end - 0.1))} style={{ width: '100%' }} />
        <input type="range" min={0} max={dur || 0} step={0.1} value={end} onChange={e => setEnd(Math.max(Number(e.target.value), start + 0.1))} style={{ width: '100%' }} />

        <button onClick={playClip} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 8, padding: '6px 12px', borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 12, fontWeight: 700 }}>▶ {t('social.previewClip')}</button>

        <div style={{ fontSize: 11, color: 'var(--text4, #666)', margin: '12px 0' }}><Icon name="info" size={11} /> {t('social.trimNote')}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
          <button onClick={onCancel} style={{ padding: '8px 16px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 12.5, fontWeight: 700 }}>{t('social.cancel')}</button>
          <button onClick={() => onApply({ trimStart: Math.round(start * 10) / 10, trimEnd: Math.round(end * 10) / 10 })} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', cursor: 'pointer', fontSize: 12.5, fontWeight: 800 }}>{t('social.applyCrop')}</button>
        </div>
      </div>
    </div>
  )
}
