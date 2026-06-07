'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import EnqueueButton from './ui/EnqueueButton'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { openDrivePicker, drivePickerConfigured } from '../../lib/social/drivePicker'
import SocialMockup from './social/SocialMockup'

// Fase 3 — Social Studio: brief → l'AI scrive un post IG/TikTok nel brand voice
// → lo accodi (create_post) per l'approvazione. Pubblicazione gated (come Meta).
const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', color: '#e1306c' },
  { id: 'tiktok', label: 'TikTok', color: '#25f4ee' },
]
const POST_TYPES = ['post', 'reel', 'story', 'carousel']

export default function SocialStudio() {
  const { t, intlLocale } = useI18n()
  const [view, setView] = useState('calendar')
  const [platform, setPlatform] = useState('instagram')
  const [postType, setPostType] = useState('post')
  const [prompt, setPrompt] = useState('')
  const [loading, setLoading] = useState(false)
  const [draft, setDraft] = useState(null)
  const [err, setErr] = useState(null)
  const [copied, setCopied] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [planned, setPlanned] = useState([])
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const fileRef = useRef(null)

  const addLink = () => {
    const url = linkInput.trim()
    if (!/^https?:\/\//i.test(url)) return
    const isVid = /\.(mp4|mov|webm|m4v|avi)(\?|$)/i.test(url)
    setMedia(m => [...m, { url, type: isVid ? 'video/link' : '', name: (url.split('/').pop() || 'link').split('?')[0].slice(0, 40), kind: 'link' }])
    setLinkInput('')
  }

  const pickFromDrive = async () => {
    setErr(null)
    try {
      await openDrivePicker(async (files, token) => {
        for (const f of files) {
          const isVideo = (f.mimeType || '').startsWith('video')
          // Scarica il file via token per l'anteprima locale (i link Drive non
          // sono URL pubblici diretti → l'<img>/<video> da solo non li mostra).
          let previewUrl = null
          try {
            const res = await fetch(`https://www.googleapis.com/drive/v3/files/${f.id}?alt=media`, { headers: { Authorization: `Bearer ${token}` } })
            if (res.ok) previewUrl = URL.createObjectURL(await res.blob())
          } catch {}
          setMedia(m => [...m, {
            url: f.url, previewUrl, type: isVideo ? 'video/drive' : 'image/drive',
            name: (f.name || 'Drive').slice(0, 40), kind: 'drive', driveId: f.id,
          }])
        }
      })
    } catch (e) { setErr(e.message) }
  }
  const driveOn = drivePickerConfigured()

  // Upload DIRETTO su Supabase Storage (signed URL) → file pesanti, full quality.
  const uploadFiles = async (files) => {
    if (!files?.length) return
    setUploading(true); setErr(null)
    const sb = getBrowserSupabase()
    for (const file of files) {
      try {
        const r = await fetch('/api/social/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: file.name }) })
        const j = await r.json()
        if (!j.ok) { setErr(j.error || 'Upload error'); continue }
        const { error } = await sb.storage.from(j.bucket).uploadToSignedUrl(j.path, j.token, file)
        if (error) { setErr(error.message); continue }
        setMedia(m => [...m, { url: j.publicUrl, type: file.type || '', name: file.name, kind: 'file' }])
      } catch (e) { setErr(e.message) }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  const loadPlanned = useCallback(async () => {
    try {
      const r = await fetch('/api/actions')
      const j = await r.json()
      const posts = (j.actions || []).filter(a => a.type === 'create_post')
      posts.sort((a, b) => {
        const da = a.payload?.scheduled_for || '', db = b.payload?.scheduled_for || ''
        if (da && db) return da.localeCompare(db)
        if (da) return -1
        if (db) return 1
        return new Date(b.created_at) - new Date(a.created_at)
      })
      setPlanned(posts)
    } catch {}
  }, [])
  useEffect(() => { loadPlanned() }, [loadPlanned])

  const generate = async () => {
    if (!prompt.trim()) return
    setLoading(true); setErr(null); setDraft(null); setCopied(false)
    try {
      const r = await fetch('/api/social/draft-post', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, platform, postType, locale: getClientLocale() }),
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
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

        {/* Tipo: post / reel / story / carosello */}
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 8 }}>{t('social.type')}</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          {POST_TYPES.map(ty => {
            const on = postType === ty
            return (
              <button key={ty} onClick={() => { setPostType(ty); setDraft(null) }} style={{
                padding: '6px 13px', borderRadius: 999, cursor: 'pointer', fontSize: 12, fontWeight: 800,
                border: on ? '1px solid #7b5bff' : '1px solid var(--border)',
                background: on ? 'rgba(123,91,255,0.18)' : 'transparent', color: on ? '#fff' : 'var(--text3)',
              }}>{t('social.type.' + ty)}</button>
            )
          })}
        </div>

        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 8 }}>{t('social.schedule')}</div>
        <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
          style={{ marginBottom: 14, borderRadius: 9, padding: '8px 10px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit' }} />

        {/* Contenuti da pubblicare — upload immagini/video (full quality) */}
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 8 }}>{t('social.media')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 6 }}>
          {media.map((m, i) => (
            <div key={i} style={{ position: 'relative', width: 76, height: 76, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)', background: '#000', display: 'grid', placeItems: 'center' }}>
              {(m.previewUrl || m.kind === 'file')
                ? (m.type.startsWith('video')
                    ? <video src={m.previewUrl || m.url} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <img src={m.previewUrl || m.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
                : <div style={{ textAlign: 'center', padding: 5, color: 'var(--text3)' }}><Icon name={m.kind === 'drive' ? 'image' : 'link'} size={16} /><div style={{ fontSize: 8, marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 64 }}>{m.name}</div></div>}
              <button onClick={() => setMedia(media.filter((_, j) => j !== i))} title="×" style={{ position: 'absolute', top: 3, right: 3, width: 18, height: 18, borderRadius: 9, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', fontSize: 12, lineHeight: 1, display: 'grid', placeItems: 'center' }}>×</button>
              {m.type.startsWith('video') && m.kind === 'file' && <span style={{ position: 'absolute', bottom: 3, left: 3, color: '#fff' }}><Icon name="mic" size={11} /></span>}
            </div>
          ))}
          <button onClick={() => fileRef.current?.click()} disabled={uploading} title={t('social.upload')} style={{ width: 76, height: 76, borderRadius: 8, border: '1px dashed var(--border)', background: 'transparent', color: 'var(--text3)', cursor: uploading ? 'wait' : 'pointer', display: 'grid', placeItems: 'center', fontSize: 22, fontWeight: 300 }}>
            {uploading ? '…' : '+'}
          </button>
          {driveOn && (
            <button onClick={pickFromDrive} title={t('social.fromDrive')} style={{ width: 76, height: 76, borderRadius: 8, border: '1px dashed rgba(66,133,244,0.5)', background: 'rgba(66,133,244,0.06)', color: '#8ab4f8', cursor: 'pointer', display: 'grid', placeItems: 'center', gap: 4, fontSize: 9, fontWeight: 700 }}>
              <Icon name="image" size={16} /> Drive
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*,video/*" multiple style={{ display: 'none' }} onChange={e => uploadFiles(Array.from(e.target.files || []))} />
        </div>
        {/* Incolla link pubblico (Drive/Dropbox/URL) — file pesanti senza limiti */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
          <input value={linkInput} onChange={e => setLinkInput(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') addLink() }} placeholder={t('social.linkPlaceholder')}
            style={{ flex: 1, minWidth: 200, borderRadius: 9, padding: '8px 10px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 12.5, fontFamily: 'inherit' }} />
          <button onClick={addLink} style={{ padding: '8px 14px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{t('social.add')}</button>
        </div>
        <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginBottom: 14 }}>{uploading ? t('social.uploading') : t('social.upload')} · max 50MB · {t('social.linkPlaceholder')}</div>

        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} placeholder={t('social.brief')} rows={3}
          style={{ width: '100%', resize: 'vertical', borderRadius: 10, padding: '10px 12px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }} />
        <div style={{ marginTop: 10 }}>
          <button onClick={generate} disabled={loading || !prompt.trim()} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 9, border: 'none', cursor: loading ? 'wait' : 'pointer', background: 'linear-gradient(135deg,#e1306c,#7b5bff)', color: '#fff', fontSize: 12.5, fontWeight: 800 }}>
            <Icon name="sparkle" size={13} /> {loading ? t('social.generating') : t('social.generate')}
          </button>
        </div>
        {err && <div style={{ marginTop: 10, fontSize: 12, color: '#fca5a5', display: 'flex', alignItems: 'center', gap: 7 }}><Icon name="warning" size={13} /> {err}</div>}

        {/* Anteprima mockup IG/TikTok (media + caption, in base al tipo) */}
        {(media.length > 0 || draft) && (
          <div style={{ marginTop: 18 }}>
            <div style={lab}>{t('social.preview')}</div>
            <div style={{ display: 'flex', justifyContent: 'center', padding: '8px 0' }}>
              <SocialMockup platform={platform} postType={postType} media={media} caption={draft?.caption || ''} hashtags={draft?.hashtags || []} />
            </div>
          </div>
        )}

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
              <EnqueueButton onDone={() => { loadPlanned(); setMedia([]) }} build={() => ({
                channel: platform, source: 'social_studio', type: 'create_post',
                target_name: draft.hook || draft.format,
                payload: { ...draft, scheduled_for: scheduleDate || null, media: media.map(m => ({ url: m.url, type: m.type, name: m.name })) },
                summary: t('aq.sum.createPost', { platform: platLabel, hook: draft.hook || draft.format }),
              })} label={t('aq.launch.enqueue')} />
              <button onClick={copy} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 9, background: 'transparent', border: '1px solid var(--border)', color: 'var(--text3)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
                <Icon name={copied ? 'check' : 'clipboard'} size={13} /> {copied ? t('social.copied') : t('social.copy')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* In programma (calendario editoriale) */}
      <div className="glass-card-static" style={{ padding: 18, borderRadius: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', flex: 1 }}>{t('social.planned')}</div>
          <div style={{ display: 'inline-flex', borderRadius: 8, border: '1px solid var(--border)', overflow: 'hidden' }}>
            {['calendar', 'agenda'].map(v => (
              <button key={v} onClick={() => setView(v)} style={{ padding: '5px 12px', border: 'none', cursor: 'pointer', fontSize: 11.5, fontWeight: 700, background: view === v ? 'rgba(123,91,255,0.2)' : 'transparent', color: view === v ? '#fff' : 'var(--text3)' }}>
                {v === 'calendar' ? t('social.viewCalendar') : t('social.viewAgenda')}
              </button>
            ))}
          </div>
        </div>
        {view === 'calendar' ? (
          <CalendarMonth posts={planned} locale={intlLocale} noneText={t('social.noPlanned')} />
        ) : planned.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('social.noPlanned')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {planned.map(a => {
              const date = a.payload?.scheduled_for
              const pf = PLATFORMS.find(p => p.id === a.channel)
              return (
                <div key={a.id} className="glass-panel" style={{ borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                  <span style={{ minWidth: 88, fontSize: 12, fontWeight: 800, color: date ? 'var(--text)' : 'var(--text3)' }}>
                    {date ? new Date(date + 'T00:00:00').toLocaleDateString(undefined, { day: '2-digit', month: 'short' }) : t('social.noDate')}
                  </span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: pf?.color || '#888', textTransform: 'uppercase', letterSpacing: '.04em', minWidth: 66 }}>{pf?.label || a.channel}</span>
                  {a.payload?.postType && <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--text3)', padding: '1px 7px', borderRadius: 999, background: 'rgba(255,255,255,0.05)' }}>{t('social.type.' + a.payload.postType)}</span>}
                  <span style={{ flex: 1, minWidth: 140, fontSize: 12.5, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.payload?.hook || a.target_name || a.summary}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, color: 'var(--text3)' }}>{t('aq.status.' + a.status)}</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

const pad2 = (n) => String(n).padStart(2, '0')
function CalendarMonth({ posts, locale, noneText }) {
  const [offset, setOffset] = useState(0)
  const today = new Date()
  const base = new Date(today.getFullYear(), today.getMonth() + offset, 1)
  const y = base.getFullYear(), m = base.getMonth()
  const firstW = (base.getDay() + 6) % 7        // 0 = lunedì
  const days = new Date(y, m + 1, 0).getDate()
  const todayKey = `${today.getFullYear()}-${pad2(today.getMonth() + 1)}-${pad2(today.getDate())}`

  const byDate = {}
  for (const p of posts) { const d = p.payload?.scheduled_for; if (d) (byDate[d] = byDate[d] || []).push(p) }

  // intestazioni giorni (lun→dom) dalla locale
  const dow = []
  for (let i = 0; i < 7; i++) { const d = new Date(2024, 0, 1 + i); dow.push(d.toLocaleDateString(locale, { weekday: 'short' })) }

  const cells = []
  for (let i = 0; i < firstW; i++) cells.push(null)
  for (let d = 1; d <= days; d++) cells.push(d)

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
        <button onClick={() => setOffset(o => o - 1)} style={navBtn}>‹</button>
        <div style={{ flex: 1, textAlign: 'center', fontSize: 13.5, fontWeight: 800, color: 'var(--text)', textTransform: 'capitalize' }}>{base.toLocaleDateString(locale, { month: 'long', year: 'numeric' })}</div>
        <button onClick={() => setOffset(o => o + 1)} style={navBtn}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 4 }}>
        {dow.map((w, i) => <div key={'h' + i} style={{ textAlign: 'center', fontSize: 9.5, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.06em', fontWeight: 800, padding: '2px 0' }}>{w}</div>)}
        {cells.map((d, i) => {
          if (d == null) return <div key={'e' + i} />
          const key = `${y}-${pad2(m + 1)}-${pad2(d)}`
          const items = byDate[key] || []
          const isToday = key === todayKey
          return (
            <div key={key} style={{ minHeight: 64, borderRadius: 8, padding: 5, background: isToday ? 'rgba(123,91,255,0.10)' : 'rgba(255,255,255,0.02)', border: isToday ? '1px solid rgba(123,91,255,0.5)' : '1px solid var(--border)' }}>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: isToday ? '#c4b5fd' : 'var(--text3)', marginBottom: 3 }}>{d}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                {items.slice(0, 3).map((p, j) => {
                  const pf = PLATFORMS.find(x => x.id === p.channel)
                  return <div key={j} title={p.payload?.hook || p.target_name} style={{ fontSize: 9, lineHeight: 1.25, padding: '2px 4px', borderRadius: 4, background: `${pf?.color || '#888'}22`, color: pf?.color || '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(p.payload?.hook || p.target_name || '').slice(0, 18)}</div>
                })}
                {items.length > 3 && <div style={{ fontSize: 9, color: 'var(--text3)' }}>+{items.length - 3}</div>}
              </div>
            </div>
          )
        })}
      </div>
      {posts.length === 0 && <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 10 }}>{noneText}</div>}
    </div>
  )
}
const navBtn = { width: 28, height: 28, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 16, lineHeight: 1 }

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
