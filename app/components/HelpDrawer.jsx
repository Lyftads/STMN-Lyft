'use client'

import { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { getHelpVideo } from '../../lib/help/videos'

// Pannello laterale (slide-over) con la guida dettagliata di una tab.
// Riusato sia dal Centro Assistenza (click su una card) sia dall'icona guida
// presente nell'header di ogni tab.

export default function HelpDrawer({ article, onClose, onNavigate }) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    // blocca lo scroll della pagina mentre il drawer è aperto
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  if (!article || typeof document === 'undefined') return null

  return createPortal(
    <div onClick={onClose} style={overlay}>
      <div onClick={(e) => e.stopPropagation()} style={panel}>
        {/* Header */}
        <div style={head}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
            <span style={iconBox}><Icon name={article.icon || 'info'} size={18} /></span>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800, color: '#fff' }}>{article.title}</div>
              <div style={{ fontSize: 12, color: 'var(--text2)' }}>{article.group}</div>
            </div>
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="close"><Icon name="close" size={18} /></button>
        </div>

        {/* Body */}
        <div style={body}>
          {article.summary && <p style={{ fontSize: 14.5, color: '#e8e8ef', lineHeight: 1.6, margin: '0 0 18px' }}>{article.summary}</p>}
          {(() => {
            const v = getHelpVideo(article.id)
            if (!v) return null
            return (
              <div style={{ marginBottom: 24, borderRadius: 14, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)', background: '#000' }}>
                <video key={v.src} controls poster={v.poster} crossOrigin="anonymous" preload="metadata" style={{ width: '100%', display: 'block', aspectRatio: '16 / 9', background: '#000' }}>
                  <source src={v.src} type="video/mp4" />
                  {v.captions && <track default kind="subtitles" srcLang="en" label="English" src={v.captions} />}
                </video>
              </div>
            )
          })()}
          {(article.sections || []).map((s, i) => (
            <div key={i} style={{ marginBottom: 22 }}>
              <h3 style={{ fontSize: 14.5, fontWeight: 800, color: '#fff', margin: '0 0 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 5, height: 16, borderRadius: 3, background: 'linear-gradient(#a78bfa,#7b5bff)' }} />
                {s.h}
              </h3>
              {s.p && <p style={{ fontSize: 14, color: '#dcdce6', lineHeight: 1.65, margin: 0 }}>{s.p}</p>}
              {s.list && (
                <ul style={{ margin: 0, padding: 0, listStyle: 'none', display: 'grid', gap: 9 }}>
                  {s.list.map((li, j) => (
                    <li key={j} style={{ display: 'flex', gap: 9, fontSize: 14, color: '#dcdce6', lineHeight: 1.6 }}>
                      <span style={{ flexShrink: 0, marginTop: 8, width: 6, height: 6, borderRadius: 99, background: '#a78bfa' }} />
                      <span>{li}</span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>

        {/* Footer */}
        <div style={footer}>
          {onNavigate && article.tab && (
            <button onClick={() => { onNavigate(article.tab); onClose?.() }} style={primaryBtn}>
              <Icon name="rocket" size={15} /> {t('help.openTab', null, 'Apri questa sezione')}
            </button>
          )}
          <span style={{ fontSize: 12, color: '#b9b9c6' }}>{t('help.needMore', null, 'Serve aiuto? Contatta il supporto.')}</span>
        </div>
      </div>
      <style>{`@keyframes helpSlideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
    </div>,
    document.body
  )
}

const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(3px)', zIndex: 1200, display: 'flex', justifyContent: 'flex-end' }
const panel = { width: 'min(560px,100%)', height: '100%', display: 'flex', flexDirection: 'column', background: '#0f0f15', borderLeft: '1px solid rgba(255,255,255,0.1)', boxShadow: '-20px 0 60px rgba(0,0,0,0.5)', animation: 'helpSlideIn .22s ease-out' }
const head = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 20px', borderBottom: '1px solid rgba(255,255,255,0.08)', flexShrink: 0 }
const iconBox = { width: 38, height: 38, borderRadius: 11, display: 'grid', placeItems: 'center', color: '#a78bfa', background: 'rgba(123,91,255,0.14)', border: '1px solid rgba(123,91,255,0.28)' }
const closeBtn = { display: 'grid', placeItems: 'center', width: 34, height: 34, borderRadius: 9, border: '1px solid rgba(255,255,255,0.12)', background: 'rgba(255,255,255,0.04)', color: '#fff', cursor: 'pointer' }
const body = { flex: 1, overflowY: 'auto', padding: '22px 22px 10px' }
const footer = { display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px', borderTop: '1px solid rgba(255,255,255,0.08)', flexShrink: 0, flexWrap: 'wrap' }
const primaryBtn = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer', background: 'linear-gradient(135deg,#a78bfa,#7b5bff)', color: '#fff' }
