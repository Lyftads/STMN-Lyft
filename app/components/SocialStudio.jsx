'use client'

import { useState } from 'react'
import Icon from './ui/Icon'
import EnqueueButton from './ui/EnqueueButton'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'

// Fase 3 — Social Studio: brief → l'AI scrive un post IG/TikTok nel brand voice
// → lo accodi (create_post) per l'approvazione. Pubblicazione gated (come Meta).
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', color: '#25f4ee' },
]

export default function SocialStudio() {
  const { t } = useI18n()
  const [platform, setPlatform] = useState('instagram')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const [copied, setCopied] = useState(false)

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setErr(null); setDraft(null); setCopied(false)
    try {
      const r = await fetch('/api/social/draft-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, platform, locale: getClientLocale() }),
      })
      const j = await r.json()
      if (j.ok) setDraft(j.draft); else setErr(j.error || 'Errore')
    } catch (e) { setErr(e.message) }
    setLoading(false)
  }

  const copy = () => {
    if (!draft) return
    const text = `${draft.caption}\n\n${(draft.hashtags || []).join(' ')}`.trim()
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const platLabel = PLATFORMS.find(p => p.id === platform)?.label || platform

  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
        <span style={{ width: 40, height: 40, borderRadius: 11, background: 'rgba(225,48,108,0.16)', color: '#e1306c', display: 'grid', placeItems: 'center', flexShrink: 0 }}>
          <Icon name="image" size={20} />
        </span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.01em' }}>{t('tab.social', null, 'Social Studio')}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 2 }}>{t('social.subtitle')}</div>
        </div>
      </div>

      <div className="glass-card-static" style={{ padding: 18, borderRadius: 14 }}>
        {/* Piattaforma */}
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 8 }}>{t('social.platform')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {PLATFORMS.map(p => {
            const on = platform === p.id
            return (
              <button key={p.id} onClick={() => { setPlatform(p.id); setDraft(null) }} style={{
                padding: '7px 14px', borderRadius: 999, cursor: 'pointer', fontSize: 12.5, fontWeight: 800,
                border: on ? `1px solid ${p.color}` : '1px solid var(--border)',
                background: on ? `${p.color}22` : 'transparent', color: on ? '#fff' : 'var(--text3)',
              }}>{p.label}</button>
            )
          })}
        </div>

        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t('social.brief')} rows={3}
          style={{ width: '100%', resize: 'vertical', borderRadius: 10, padding: '10px 12px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
        <div style={{ marginTop: 10 }}>
          <button onClick={generate} disabled={loading || !prompt.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: loading ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#e1306c,#7b5bff)', color: '#fff', fontSize: 12.5, fontWeight: 800 }}>
            <Icon name="sparkle" size={13} /> {loading ? t('social.generating') : t('social.generate')}
          </button>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="warning" size={13} /> {err}</div>}

        {draft && (
          <div className="glass-panel" style={{ marginTop: 14, padding: 16, borderRadius: 12, borderLeft: '3px solid #e1306c' }}>
            <Field label={t('social.format')} value={draft.format} />
            <Field label={t('social.hook')} value={draft.hook} />
            <div style={{ marginTop: 10 }}>
              <div style={lab}>{t('social.caption')}</div>
              <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>{draft.caption}</div>
            </div>
            {draft.hashtags?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={lab}>{t('social.hashtags')}</div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {draft.hashtags.map((h, i) => <span key={i} style={{ fontSize: 11.5, color: '#a78bfa', background: 'rgba(123,91,255,0.12)', padding: '2px 8px', borderRadius: 999 }}>{h}</span>)}
                </div>
              </div>
            )}
            <Field label={t('social.cta')} value={draft.cta} />
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <EnqueueButton build={() => ({
                channel: platform, source: 'social_studio', type: 'create_post',
                target_name: draft.hook || draft.format,
                payload: draft,
                summary: t('aq.sum.createPost', { platform: platLabel, hook: draft.hook || draft.format }),
              })} label={t('aq.launch.enqueue')} />
              <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                <Icon name={copied ? 'check' : 'clipboard'} size={13} /> {copied ? t('social.copied') : t('social.copy')}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const lab = { fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 4 }
function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={lab}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
