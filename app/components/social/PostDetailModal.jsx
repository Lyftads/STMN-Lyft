'use client'

import { useState } from 'react'
import Icon from '../ui/Icon'
import SocialMockup from './SocialMockup'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Dettaglio post programmato: anteprima mockup + modifica caption/descrizione/
// hashtag/CTA + cambio data + elimina. Salva via PATCH op=update / DELETE.
const lab = { fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 4 }
const input = { width: '100%', borderRadius: 9, padding: '8px 10px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }

export default function PostDetailModal({ action, onClose, onChanged }) {
  const { t } = useI18n()
  const p = action.payload || {}
  const [hook, setHook] = useState(p.hook || '')
  const [caption, setCaption] = useState(p.caption || '')
  const [cta, setCta] = useState(p.cta || '')
  const [hashtags, setHashtags] = useState((p.hashtags || []).join(' '))
  const [date, setDate] = useState(p.scheduled_for || '')
  const [busy, setBusy] = useState(false)

  const tags = hashtags.split(/\s+/).filter(Boolean).map(x => x.startsWith('#') ? x : '#' + x)

  const save = async () => {
    setBusy(true)
    try {
      await fetch('/api/actions', {
        method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: action.id, op: 'update', summary: hook || action.summary, payload: { hook, caption, cta, hashtags: tags, scheduled_for: date || null } }),
      })
      onChanged && onChanged(); onClose()
    } catch {}
    setBusy(false)
  }
  const del = async () => {
    setBusy(true)
    try { await fetch(`/api/actions?id=${encodeURIComponent(action.id)}`, { method: 'DELETE' }); onChanged && onChanged(); onClose() } catch {}
    setBusy(false)
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20, overflowY: 'auto' }}>
      <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 18, borderRadius: 14, width: 780, maxWidth: '95vw', display: 'flex', gap: 18, flexWrap: 'wrap' }}>
        <div style={{ flexShrink: 0, margin: '0 auto' }}>
          <SocialMockup platform={action.channel} postType={p.postType} media={p.media || []} caption={caption} hashtags={tags} music={p.music} />
        </div>
        <div style={{ flex: 1, minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', flex: 1 }}>{t('social.editPost')}</div>
            <button onClick={onClose} style={{ width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 14 }}>×</button>
          </div>
          <div style={lab}>{t('social.hook')}</div>
          <input value={hook} onChange={e => setHook(e.target.value)} style={input} />
          <div style={{ ...lab, marginTop: 10 }}>{t('social.caption')}</div>
          <textarea value={caption} onChange={e => setCaption(e.target.value)} rows={5} style={{ ...input, resize: 'vertical', lineHeight: 1.5 }} />
          <div style={{ ...lab, marginTop: 10 }}>{t('social.hashtags')}</div>
          <input value={hashtags} onChange={e => setHashtags(e.target.value)} style={input} />
          <div style={{ ...lab, marginTop: 10 }}>{t('social.cta')}</div>
          <input value={cta} onChange={e => setCta(e.target.value)} style={input} />
          <div style={{ ...lab, marginTop: 10 }}>{t('social.schedule')}</div>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ ...input, width: 'auto' }} />
          <div style={{ display: 'flex', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
            <button onClick={save} disabled={busy} style={{ padding: '8px 16px', borderRadius: 9, border: 'none', background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', cursor: busy ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 800 }}>{t('social.save')}</button>
            <button onClick={del} disabled={busy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 9, border: '1px solid rgba(255,69,58,0.4)', background: 'transparent', color: '#ff8095', cursor: busy ? 'wait' : 'pointer', fontSize: 12.5, fontWeight: 800 }}><Icon name="trash" size={13} /> {t('aq.delete')}</button>
          </div>
        </div>
      </div>
    </div>
  )
}
