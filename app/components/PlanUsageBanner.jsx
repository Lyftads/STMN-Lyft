'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'

// Banner di upgrade: se gli ordini/mese superano la fascia del piano corrente,
// invita a passare alla fascia consigliata. Dismissibile per mese (localStorage).
export default function PlanUsageBanner({ onGoSettings }) {
  const [data, setData] = useState(null)
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    fetch('/api/plan-usage', { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [])

  if (!data || !data.over || hidden) return null
  const monthKey = `lyft_planbanner_${new Date().getFullYear()}_${new Date().getMonth()}`
  if (typeof window !== 'undefined' && localStorage.getItem(monthKey) === '1') return null

  const dismiss = () => { try { localStorage.setItem(monthKey, '1') } catch {}; setHidden(true) }

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
      padding: '12px 18px', marginBottom: 18, borderRadius: 12,
      background: 'linear-gradient(135deg, rgba(255,159,10,0.12), rgba(255,55,95,0.12))',
      border: '1px solid rgba(255,159,10,0.4)',
    }}>
      <span style={{ color: '#ff9f0a', display: 'inline-flex' }}><Icon name="chart-line" size={20} /></span>
      <div style={{ flex: 1, minWidth: 240, fontSize: 13.5, lineHeight: 1.5 }}>
        <b>Sei sopra la tua fascia.</b> Hai registrato <b>{data.orders.toLocaleString('it-IT')} ordini</b> negli ultimi 30 giorni
        {data.current ? <> — oltre il limite del piano <b>{data.current.label}</b>{data.current.max ? ` (${data.current.max.toLocaleString('it-IT')} ordini/mese)` : ''}</> : ''}.
        Passa al piano <b style={{ color: '#ffd60a' }}>{data.recommended.label}</b> {data.recommended.price !== 'su misura' ? `(${data.recommended.price}/mese)` : '(su misura)'} per restare in regola.
      </div>
      <button onClick={() => (onGoSettings ? onGoSettings() : null)} style={{
        background: 'linear-gradient(135deg,#ff9f0a,#ff375f)', border: 'none', borderRadius: 9,
        padding: '9px 16px', color: 'var(--text)', fontSize: 13, fontWeight: 800, cursor: 'pointer', fontFamily: 'Barlow', whiteSpace: 'nowrap',
      }}>Passa a {data.recommended.label}</button>
      <button onClick={dismiss} title="Nascondi per questo mese" style={{ background: 'none', border: 'none', color: '#b0b0bd', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>×</button>
    </div>
  )
}
