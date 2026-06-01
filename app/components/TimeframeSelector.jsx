'use client'

import { useEffect, useRef, useState } from 'react'

const DATE_RANGE = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'last_7d', label: 'Ultimi 7 giorni' },
  { value: 'ytd', label: 'Da inizio anno (YTD)' },
]

const MONTH_NAMES = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']

function getMonths(count = 12) {
  const out = []
  const now = new Date()
  for (let i = 0; i < count; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const y = d.getFullYear()
    const m = d.getMonth() + 1
    const key = `month_${y}-${String(m).padStart(2, '0')}`
    const label = `${MONTH_NAMES[m - 1]} ${y}`
    out.push({ value: key, label })
  }
  return out
}

function getLabel(value) {
  const inDateRange = DATE_RANGE.find(p => p.value === value)
  if (inDateRange) return inDateRange.label
  if (typeof value === 'string' && value.startsWith('month_')) {
    const [y, m] = value.slice(6).split('-').map(Number)
    if (y && m) return `${MONTH_NAMES[m - 1]} ${y}`
  }
  return value
}

export default function TimeframeSelector({ value, onChange, disabled }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const months = getMonths(12)

  useEffect(() => {
    if (!open) return
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const handleSelect = (v) => {
    onChange?.(v)
    setOpen(false)
  }

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={disabled}
        className="btn-glass"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          minWidth: 160,
          justifyContent: 'space-between',
          cursor: disabled ? 'wait' : 'pointer',
          opacity: disabled ? 0.5 : 1,
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <CalendarIcon />
          {getLabel(value)}
        </span>
        <span style={{
          fontSize: 10,
          color: 'var(--text3)',
          transform: open ? 'rotate(180deg)' : 'none',
          transition: 'transform 0.2s',
        }}>▼</span>
      </button>

      {open && (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            right: 0,
            width: 260,
            maxHeight: 520,
            overflowY: 'auto',
            background: 'rgba(8,8,15,0.95)',
            backdropFilter: 'blur(30px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(30px) saturate(1.8)',
            border: '1.5px solid rgba(255,255,255,0.10)',
            borderTopColor: 'rgba(255,255,255,0.16)',
            borderRadius: 14,
            boxShadow: '0 20px 60px rgba(0,0,0,0.7), 0 6px 16px rgba(0,0,0,0.5)',
            zIndex: 100,
            padding: '14px 0 16px',
          }}
        >
          <SectionLabel>Date range</SectionLabel>
          {DATE_RANGE.map(opt => (
            <Option key={opt.value} label={opt.label} selected={value === opt.value} onClick={() => handleSelect(opt.value)} />
          ))}

          <div style={{ height: 1, background: 'rgba(255,255,255,0.08)', margin: '14px 18px' }} />

          <SectionLabel>By month</SectionLabel>
          {months.map(opt => (
            <Option key={opt.value} label={opt.label} selected={value === opt.value} onClick={() => handleSelect(opt.value)} />
          ))}
        </div>
      )}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div style={{
      padding: '6px 22px 10px',
      fontSize: 11,
      fontWeight: 700,
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      color: 'var(--text3)',
    }}>{children}</div>
  )
}

function Option({ label, selected, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: '100%',
        textAlign: 'left',
        padding: '11px 22px',
        background: 'transparent',
        border: 0,
        color: 'var(--text)',
        fontSize: 14.5,
        fontWeight: 500,
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        transition: 'background 0.12s',
      }}
      onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
    >
      <span>{label}</span>
      {selected && (
        <span style={{
          width: 7, height: 7, borderRadius: '50%',
          background: 'var(--accent)',
          boxShadow: '0 0 8px rgba(41,151,255,0.6)',
        }} />
      )}
    </button>
  )
}

function CalendarIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="5" width="18" height="16" rx="2" stroke="currentColor" strokeWidth="1.8"/>
      <path d="M3 9h18M8 3v4M16 3v4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  )
}
