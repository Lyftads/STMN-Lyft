'use client'

import { useState } from 'react'
import Icon from './ui/Icon'

// Shell condiviso per login / register / reset-password.
// Stile black glass 3D coerente con la dashboard.

export function AuthShell({ title, subtitle, children }) {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#000',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: '40px 20px',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow ambient */}
      <div style={{
        position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
        width: 500, height: 500, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(191,90,242,0.15), transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute', bottom: '10%', right: '15%',
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(41,151,255,0.10), transparent 70%)',
        filter: 'blur(60px)', pointerEvents: 'none',
      }} />

      <div style={{
        width: '100%', maxWidth: 440,
        position: 'relative',
        background: 'linear-gradient(180deg, rgba(10,10,22,0.92) 0%, rgba(0,0,0,0.96) 100%)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        border: '1.5px solid rgba(255,255,255,0.08)',
        borderTopColor: 'rgba(255,255,255,0.16)',
        borderBottomColor: 'rgba(0,0,0,0.7)',
        boxShadow: '0 40px 100px rgba(0,0,0,0.80), 0 0 80px rgba(191,90,242,0.10), inset 0 1.5px 0 rgba(255,255,255,0.06)',
        animation: 'sim-pulse 6s ease-in-out infinite',
        overflow: 'hidden',
      }}>
        {/* Shine top edge */}
        <div style={{
          position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
          background: 'linear-gradient(90deg, transparent, #bf5af2aa, transparent)',
          animation: 'cr-shine 4s ease-in-out infinite',
          zIndex: 3, pointerEvents: 'none',
        }} />

        <div style={{ padding: '32px 30px 30px', position: 'relative', zIndex: 2 }}>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
            <svg width="28" height="22" viewBox="0 0 36 28" fill="none">
              <rect x="1" y="18" width="6" height="9" rx="2" fill="#2997ff" opacity="0.3" />
              <rect x="10" y="12" width="6" height="15" rx="2" fill="#2997ff" opacity="0.5" />
              <rect x="19" y="6" width="6" height="21" rx="2" fill="#2997ff" opacity="0.7" />
              <rect x="28" y="1" width="6" height="26" rx="2" fill="#2997ff" />
            </svg>
            <span style={{
              fontSize: 22, fontWeight: 800, letterSpacing: '-0.04em', color: '#fff',
            }}>Lyft</span>
          </div>

          <div style={{
            fontSize: 22, fontWeight: 900, color: '#fff',
            letterSpacing: '-0.02em', marginBottom: 8,
          }}>{title}</div>
          {subtitle && (
            <div style={{
              fontSize: 13.5, color: 'var(--text3, #9ca3af)',
              lineHeight: 1.55, marginBottom: 24,
            }}>{subtitle}</div>
          )}
          {!subtitle && <div style={{ marginBottom: 18 }} />}

          {children}
        </div>
      </div>
    </div>
  )
}

export function AuthInput({ label, hint, type, ...props }) {
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (show ? 'text' : 'password') : type
  return (
    <div>
      <label style={{
        display: 'block', fontSize: 10.5, fontWeight: 800,
        color: 'var(--text3, #9ca3af)', letterSpacing: '0.12em',
        textTransform: 'uppercase', marginBottom: 6,
      }}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={inputType} {...props} style={{
          width: '100%',
          padding: isPassword ? '12px 46px 12px 14px' : '12px 14px',
          borderRadius: 10,
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.10)',
          color: '#fff',
          fontSize: 14,
          outline: 'none',
          fontFamily: 'inherit',
          transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
        }}
        onFocus={e => {
          e.currentTarget.style.borderColor = 'rgba(191,90,242,0.50)'
          e.currentTarget.style.boxShadow = '0 0 0 3px rgba(191,90,242,0.12)'
        }}
        onBlur={e => {
          e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)'
          e.currentTarget.style.boxShadow = 'none'
        }}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShow(s => !s)}
            aria-label={show ? 'Nascondi password' : 'Mostra password'}
            title={show ? 'Nascondi password' : 'Mostra password'}
            style={{
              position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)',
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 16, lineHeight: 1, padding: 6, opacity: 0.8,
            }}
          >{show ? <Icon name="eye-off" size={17} /> : <Icon name="eye" size={17} />}</button>
        )}
      </div>
      {hint && (
        <div style={{ fontSize: 11, color: 'var(--text3, #6b7280)', marginTop: 6, lineHeight: 1.4 }}>{hint}</div>
      )}
    </div>
  )
}

export function AuthButton({ loading, children }) {
  return (
    <button type="submit" disabled={loading} style={{
      width: '100%',
      padding: '13px 16px',
      borderRadius: 11,
      border: 'none',
      background: loading
        ? 'rgba(255,255,255,0.06)'
        : 'linear-gradient(135deg, #bf5af2, #8b5cf6)',
      color: loading ? 'var(--text3, #6b7280)' : '#fff',
      fontSize: 14, fontWeight: 800,
      cursor: loading ? 'wait' : 'pointer',
      letterSpacing: '0.02em',
      boxShadow: loading ? 'none' : '0 8px 24px rgba(191,90,242,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
      transition: 'transform 0.2s ease, box-shadow 0.2s ease',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      marginTop: 4,
    }}>
      {loading && (
        <span style={{
          display: 'inline-block', width: 14, height: 14,
          border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff',
          borderRadius: 999, animation: 'spin 1s linear infinite',
        }} />
      )}
      {children}
    </button>
  )
}

export function AuthError({ error }) {
  if (!error) return null
  return (
    <div style={{
      padding: '10px 14px', borderRadius: 9,
      background: 'rgba(239,68,68,0.10)',
      border: '1px solid rgba(239,68,68,0.30)',
      color: '#fca5a5', fontSize: 12.5, lineHeight: 1.5,
    }}>{error}</div>
  )
}
