'use client'

import { useState, useEffect, useRef } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Banner "Stiamo preparando i tuoi dati" mostrato dopo il collegamento Shopify,
// mentre girano in background i calcoli pesanti (storico + bulk clienti). Mostra
// una stima con countdown e sparisce da solo appena i dati sono pronti
// (poll /api/data-ready) o allo scadere del cap.
const KEY = 'lyft_data_warming_start'
const EST_MS = 8 * 60_000   // stima mostrata nel countdown
const CAP_MS = 15 * 60_000  // oltre questo il banner sparisce comunque

export function markDataWarming() {
  try { localStorage.setItem(KEY, String(Date.now())) } catch {}
}

export default function PreparingDataBanner() {
  const { t } = useI18n()
  const [start, setStart] = useState(null)
  const [now, setNow] = useState(() => 0) // 0 = SSR-safe; impostato al mount
  const pollRef = useRef(null)

  // Legge lo start al mount + tick ogni secondo per il countdown.
  useEffect(() => {
    const read = () => { try { return Number(localStorage.getItem(KEY)) || null } catch { return null } }
    setStart(read())
    setNow(Date.now())
    const iv = setInterval(() => {
      setNow(Date.now())
      const s = read()
      setStart(s)
      if (s && Date.now() - s > CAP_MS) { try { localStorage.removeItem(KEY) } catch {}; setStart(null) }
    }, 1000)
    return () => clearInterval(iv)
  }, [])

  // Poll data-ready ogni 15s finché il banner è attivo.
  useEffect(() => {
    if (!start) { if (pollRef.current) { clearInterval(pollRef.current); pollRef.current = null } return }
    const check = () => {
      fetch('/api/data-ready', { cache: 'no-store' })
        .then(r => r.json())
        .then(j => {
          if (j?.ready) {
            try { localStorage.removeItem(KEY) } catch {}
            setStart(null)
            // I dati sono pronti: ricarica la vista corrente per mostrarli.
            try { window.location.reload() } catch {}
          }
        })
        .catch(() => {})
    }
    check()
    pollRef.current = setInterval(check, 15_000)
    return () => { if (pollRef.current) clearInterval(pollRef.current) }
  }, [start])

  if (!start || !now) return null

  const remaining = Math.max(0, EST_MS - (now - start))
  const mm = Math.floor(remaining / 60000)
  const ss = Math.floor((remaining % 60000) / 1000)
  const timeStr = remaining > 0 ? `${mm}:${String(ss).padStart(2, '0')}` : null

  return (
    <div style={{
      position: 'fixed', top: 12, left: '50%', transform: 'translateX(-50%)', zIndex: 9998,
      maxWidth: 'min(680px, calc(100vw - 24px))',
      display: 'flex', alignItems: 'center', gap: 12,
      background: 'rgba(12,12,22,0.97)', backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
      border: '1px solid rgba(123,91,255,0.45)', borderRadius: 14,
      boxShadow: '0 20px 50px rgba(0,0,0,0.6)', padding: '12px 18px',
    }}>
      <span style={{ width: 16, height: 16, flexShrink: 0, borderRadius: '50%', border: '2px solid rgba(123,91,255,0.45)', borderTopColor: '#7b5bff', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} />
      <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 1.45 }}>
        <strong style={{ color: '#fff' }}>{t('pd.title', null, 'Stiamo preparando i tuoi dati')}</strong>
        {' — '}
        {t('pd.body', null, 'importiamo lo storico Shopify e i clienti. Le dashboard si popolano automaticamente.')}
        {timeStr
          ? <> {t('pd.eta', { time: timeStr }, `Stima: ~${timeStr}`)}</>
          : <> {t('pd.almost', null, 'Quasi pronto…')}</>}
      </div>
    </div>
  )
}
