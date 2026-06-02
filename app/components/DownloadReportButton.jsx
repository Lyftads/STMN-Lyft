'use client'

import { useState } from 'react'
import { presetToRange } from '../lib/reportRange'

// Bottone "Scarica report PDF" — genera il report del periodo selezionato.
// Props:
//  - tab: etichetta (es. "Weekly", "Meta Detail", "KPI Brain")
//  - preset / custom: timeframe (preset string oppure {since,until,label})
//  - campaigns: opzionale [{id,name}] → mostra un selettore campagna (Meta Detail)
export default function DownloadReportButton({ tab, preset, custom, campaigns = null, style }) {
  const [loading, setLoading] = useState(false)
  const [campaignId, setCampaignId] = useState('')

  const download = async () => {
    if (loading) return
    setLoading(true)
    try {
      const { since, until, prevSince, prevUntil, label } = presetToRange(preset, custom)
      const qs = new URLSearchParams({ tab, label, since, until, prevSince, prevUntil })
      if (preset && !custom) qs.set('preset', preset)
      if (campaignId) qs.set('campaignId', campaignId)
      const res = await fetch(`/api/report?${qs.toString()}`)
      const ct = res.headers.get('content-type') || ''
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (ct.includes('pdf')) {
        const a = document.createElement('a')
        a.href = url
        a.download = `LyftAI_${String(tab).replace(/\s+/g, '_')}_${since}_${until}.pdf`
        document.body.appendChild(a); a.click(); a.remove()
      } else {
        window.open(url, '_blank') // fallback HTML (Browserless non configurato)
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch (e) {
      alert('Errore nella generazione del report: ' + (e?.message || 'sconosciuto'))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}>
      {campaigns && (
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="btn-glass"
          style={{ padding: '9px 12px', fontWeight: 600, cursor: 'pointer', maxWidth: 240 }}
          title="Scegli una campagna per il report gerarchico"
        >
          <option value="" style={{ background: 'var(--surface)' }}>Account intero</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id} style={{ background: 'var(--surface)' }}>{c.name}</option>
          ))}
        </select>
      )}
      <button
        onClick={download}
        disabled={loading}
        className="btn-glass"
        style={{ display: 'inline-flex', alignItems: 'center', gap: 7, cursor: loading ? 'wait' : 'pointer', opacity: loading ? 0.7 : 1 }}
        title="Genera e scarica il report PDF del periodo selezionato"
      >
        <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>{loading ? '◌' : '⬇'}</span>
        {loading ? 'Genero PDF…' : 'Scarica report PDF'}
      </button>
    </div>
  )
}
