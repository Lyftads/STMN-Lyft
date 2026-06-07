'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from '../../../lib/i18n/locales'

// Selettore lingua compatto (bandiera + dropdown). Cambia la lingua di tutta
// l'app via I18nProvider (stato + localStorage + persist best-effort su profilo).
export default function LanguageSwitcher({ compact = false }) {
  const { locale, setLocale } = useI18n()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    if (!open) return
    const onClick = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        aria-label="Language"
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          padding: compact ? '6px 9px' : '7px 11px',
          borderRadius: 9, cursor: 'pointer',
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid var(--border)',
          color: 'var(--text2)', fontSize: 12, fontWeight: 700,
          transition: 'background 0.15s ease, border-color 0.15s ease',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.08)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
      >
        <span style={{ fontSize: 15, lineHeight: 1 }}>{LOCALE_FLAGS[locale]}</span>
        {!compact && <span style={{ textTransform: 'uppercase', letterSpacing: '0.04em' }}>{locale}</span>}
        <span style={{ fontSize: 9, opacity: 0.7, transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>▾</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50,
          minWidth: 168, padding: 6, borderRadius: 12,
          background: 'rgba(10,10,18,0.96)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.10)',
          boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
        }}>
          {LOCALES.map(l => {
            const active = l === locale
            return (
              <button
                key={l}
                type="button"
                onClick={() => { setLocale(l); setOpen(false) }}
                style={{
                  width: '100%', display: 'flex', alignItems: 'center', gap: 10,
                  padding: '8px 10px', borderRadius: 8, cursor: 'pointer',
                  border: 'none', textAlign: 'left',
                  background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                  color: active ? '#fff' : 'var(--text2)',
                  fontSize: 13, fontWeight: active ? 700 : 500,
                }}
                onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.05)' }}
                onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: 16, lineHeight: 1 }}>{LOCALE_FLAGS[l]}</span>
                <span style={{ flex: 1 }}>{LOCALE_LABELS[l]}</span>
                {active && <span style={{ color: '#22c55e', display: 'inline-flex' }}><Icon name="check" size={12} /></span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
