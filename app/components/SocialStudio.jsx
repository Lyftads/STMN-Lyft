'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import EnqueueButton from './ui/EnqueueButton'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { openDrivePicker, drivePickerConfigured } from '../../lib/social/drivePicker'
import SocialMockup from './social/SocialMockup'
import MediaCropper from './social/MediaCropper'
import VideoTrimmer from './social/VideoTrimmer'
import PostDetailModal from './social/PostDetailModal'

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
  const [detail, setDetail] = useState(null)
  const [media, setMedia] = useState([])
  const [uploading, setUploading] = useState(false)
  const [linkInput, setLinkInput] = useState('')
  const fileRef = useRef(null)

  // Handoff da Creative Studio: una creatività generata "mandata" qui arriva
  // via localStorage → la aggiungo ai media come link pubblico.
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const raw = localStorage.getItem('lyft_studio_handoff')
      if (!raw) return
      localStorage.removeItem('lyft_studio_handoff')
      const { url, type } = JSON.parse(raw)
      if (url) setMedia(m => [...m, { url, previewUrl: url, type: type === 'video' ? 'video/link' : 'image/link', name: (url.split('/').pop() || 'studio').split('?')[0].slice(0, 40), kind: 'link' }])
    } catch {}
  }, [])

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

  // Musica (ricerca libreria Apple Music via /api/social/music)
  const [music, setMusic] = useState(null)
  const [musicQ, setMusicQ] = useState('')
  const [musicRes, setMusicRes] = useState([])
  const [musicLoading, setMusicLoading] = useState(false)
  const [playingId, setPlayingId] = useState(null)
  const audioRef = useRef(null)

  const searchMusic = async () => {
    if (!musicQ.trim()) return
    setMusicLoading(true)
    try {
      const r = await fetch(`/api/social/music?q=${encodeURIComponent(musicQ)}`)
      const j = await r.json()
      setMusicRes(j.results || [])
    } catch {}
    setMusicLoading(false)
  }
  const togglePreview = (song) => {
    const a = audioRef.current; if (!a || !song.preview) return
    if (playingId === song.id) { a.pause(); setPlayingId(null); return }
    a.src = song.preview; a.play().catch(() => {}); setPlayingId(song.id)
  }

  // Upload DIRETTO su Supabase Storage (signed URL) → file pesanti, full quality.
  const uploadBlob = async (blob, name) => {
    const sb = getBrowserSupabase()
    const r = await fetch('/api/social/upload-url', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ filename: name || blob.name || 'file.jpg' }) })
    const j = await r.json()
    if (!j.ok) throw new Error(j.error || 'Upload error')
    const { error } = await sb.storage.from(j.bucket).uploadToSignedUrl(j.path, j.token, blob)
    if (error) throw error
    return j.publicUrl
  }
  const uploadFiles = async (files) => {
    if (!files?.length) return
    setUploading(true); setErr(null)
    for (const file of files) {
      try {
        const url = await uploadBlob(file, file.name)
        setMedia(m => [...m, { url, previewUrl: URL.createObjectURL(file), type: file.type || '', name: file.name, kind: 'file', file }])
      } catch (e) { setErr(e.message) }
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  // Crop/ridimensiona immagini
  const [cropIdx, setCropIdx] = useState(null)
  const [cropBusy, setCropBusy] = useState(false)
  const applyCrop = async (blob) => {
    if (cropIdx == null) return
    setCropBusy(true)
    try {
      const name = `crop-${Date.now()}.jpg`
      const url = await uploadBlob(blob, name)
      const previewUrl = URL.createObjectURL(blob)
      setMedia(m => m.map((mm, i) => i === cropIdx ? { url, previewUrl, type: 'image/jpeg', name, kind: 'file', file: blob } : mm))
      setCropIdx(null)
    } catch (e) { setErr(e.message) }
    setCropBusy(false)
  }

  // Trim video (metadati inizio/fine — taglio applicato alla pubblicazione)
  const [trimIdx, setTrimIdx] = useState(null)
  const applyTrim = ({ trimStart, trimEnd }) => {
    setMedia(m => m.map((mm, i) => i === trimIdx ? { ...mm, trimStart, trimEnd } : mm))
    setTrimIdx(null)
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

  const setField = (k, v) => setDraft(d => ({ ...d, [k]: v }))

  const copy = () => {
    if (!draft) return
    const text = `${draft.caption}\n\n${(draft.hashtags || []).join(' ')}`.trim()
    try { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
  }

  const platLabel = PLATFORMS.find(p => p.id === platform)?.label || platform

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {detail && <PostDetailModal action={detail} onClose={() => setDetail(null)} onChanged={loadPlanned} />}
      {trimIdx != null && (media[trimIdx]?.previewUrl || media[trimIdx]?.url) && (
        <VideoTrimmer
          src={media[trimIdx].previewUrl || media[trimIdx].url}
          initial={media[trimIdx]}
          onCancel={() => setTrimIdx(null)}
          onApply={applyTrim}
        />
      )}
      {cropIdx != null && (media[cropIdx]?.file || media[cropIdx]?.previewUrl) && (
        <MediaCropper
          src={media[cropIdx].file ? URL.createObjectURL(media[cropIdx].file) : media[cropIdx].previewUrl}
          initialAspect={(postType === 'reel' || postType === 'story' || platform === 'tiktok') ? 9 / 16 : 1}
          busy={cropBusy}
          onCancel={() => setCropIdx(null)}
          onApply={applyCrop}
        />
      )}
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
              {(m.type || '').startsWith('video') && (m.previewUrl || m.url) && (
                <button onClick={() => setTrimIdx(i)} title={t('social.trimTitle')} style={{ position: 'absolute', bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, border: 'none', background: m.trimStart != null ? '#7b5bff' : 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="scan" size={11} /></button>
              )}
              {!(m.type || '').startsWith('video') && (m.file || m.previewUrl) && (
                <button onClick={() => setCropIdx(i)} title={t('social.edit')} style={{ position: 'absolute', bottom: 3, right: 3, width: 18, height: 18, borderRadius: 9, border: 'none', background: 'rgba(0,0,0,0.65)', color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="edit" size={11} /></button>
              )}
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

        {/* Musica */}
        <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, marginBottom: 8 }}>{t('social.music')}</div>
        <audio ref={audioRef} onEnded={() => setPlayingId(null)} style={{ display: 'none' }} />
        {music ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 8, borderRadius: 10, border: '1px solid var(--border)', marginBottom: 8 }}>
            {music.artwork ? <img src={music.artwork} alt="" style={{ width: 38, height: 38, borderRadius: 6 }} /> : <span style={{ width: 38, height: 38, borderRadius: 6, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.06)' }}><Icon name="headphones" size={16} /></span>}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{music.title}</div>
              <div style={{ fontSize: 11, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{music.artist}</div>
            </div>
            {music.preview && <button onClick={() => togglePreview(music)} style={iconBtn}>{playingId === music.id ? '❚❚' : '▶'}</button>}
            <button onClick={() => { setMusic(null); if (audioRef.current) audioRef.current.pause(); setPlayingId(null) }} style={iconBtn}>×</button>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
              <input value={musicQ} onChange={e => setMusicQ(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') searchMusic() }} placeholder={t('social.musicSearch')} style={{ ...editInput, flex: 1 }} />
              <button onClick={searchMusic} disabled={musicLoading} style={{ padding: '8px 12px', borderRadius: 9, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer' }}><Icon name="search" size={14} /></button>
            </div>
            {musicRes.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 6, maxHeight: 240, overflowY: 'auto' }}>
                {musicRes.map(s => (
                  <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 6, borderRadius: 8, cursor: 'pointer' }} onClick={() => { setMusic(s); setMusicRes([]); if (audioRef.current) audioRef.current.pause(); setPlayingId(null) }}>
                    {s.artwork && <img src={s.artwork} alt="" style={{ width: 34, height: 34, borderRadius: 5 }} />}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.title}</div>
                      <div style={{ fontSize: 10.5, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.artist}</div>
                    </div>
                    {s.preview && <button onClick={(e) => { e.stopPropagation(); togglePreview(s) }} style={iconBtn}>{playingId === s.id ? '❚❚' : '▶'}</button>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
        <div style={{ fontSize: 11, color: 'var(--text4, #666)', marginBottom: 14 }}>{t('social.musicHint')}</div>

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
              <SocialMockup platform={platform} postType={postType} media={media} caption={draft?.caption || ''} hashtags={draft?.hashtags || []} music={music} />
            </div>
          </div>
        )}

        {draft && (
          <div className="glass-panel" style={{ marginTop: 14, padding: 16, borderRadius: 12, borderLeft: '3px solid #e1306c' }}>
            <div><div style={lab}>{t('social.hook')}</div>
              <input value={draft.hook || ''} onChange={e => setField('hook', e.target.value)} style={editInput} /></div>
            <div style={{ marginTop: 10 }}><div style={lab}>{t('social.caption')}</div>
              <textarea value={draft.caption || ''} onChange={e => setField('caption', e.target.value)} rows={5} style={{ ...editInput, resize: 'vertical', lineHeight: 1.5 }} /></div>
            <div style={{ marginTop: 10 }}><div style={lab}>{t('social.hashtags')}</div>
              <input value={(draft.hashtags || []).join(' ')} onChange={e => setField('hashtags', e.target.value.split(/\s+/).filter(Boolean).map(x => x.startsWith('#') ? x : '#' + x))} style={editInput} /></div>
            <div style={{ marginTop: 10 }}><div style={lab}>{t('social.cta')}</div>
              <input value={draft.cta || ''} onChange={e => setField('cta', e.target.value)} style={editInput} /></div>
            <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
              <EnqueueButton onDone={() => { loadPlanned(); setMedia([]); setMusic(null) }} build={() => ({
                channel: platform, source: 'social_studio', type: 'create_post',
                target_name: draft.hook || draft.format,
                payload: { ...draft, scheduled_for: scheduleDate || null, music: music ? { title: music.title, artist: music.artist, artwork: music.artwork || null } : null, media: media.map(m => ({ url: m.url, type: m.type, name: m.name, kind: m.kind, trimStart: m.trimStart ?? null, trimEnd: m.trimEnd ?? null })) },
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
          <CalendarMonth posts={planned} locale={intlLocale} noneText={t('social.noPlanned')} onPick={setDetail} />
        ) : planned.length === 0 ? (
          <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('social.noPlanned')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {planned.map(a => {
              const date = a.payload?.scheduled_for
              const pf = PLATFORMS.find(p => p.id === a.channel)
              return (
                <div key={a.id} onClick={() => setDetail(a)} className="glass-panel" style={{ borderRadius: 10, padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', cursor: 'pointer' }}>
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
function CalendarMonth({ posts, locale, noneText, onPick }) {
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
                  const m0 = (p.payload?.media || [])[0]
                  const imgThumb = m0 && m0.kind === 'file' && !(m0.type || '').startsWith('video') && m0.url
                  const title = p.payload?.hook || p.target_name || ''
                  return imgThumb
                    ? <img key={j} onClick={() => onPick && onPick(p)} src={m0.url} alt="" title={title} style={{ width: '100%', height: 28, objectFit: 'cover', borderRadius: 4, display: 'block', border: `1px solid ${pf?.color || '#888'}`, cursor: 'pointer' }} />
                    : <div key={j} onClick={() => onPick && onPick(p)} title={title} style={{ fontSize: 9, lineHeight: 1.25, padding: '2px 4px', borderRadius: 4, background: `${pf?.color || '#888'}22`, color: pf?.color || '#aaa', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: 'pointer' }}>{((m0 && (m0.type || '').startsWith('video')) ? '▶ ' : '') + title.slice(0, 16)}</div>
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
const editInput = { width: '100%', borderRadius: 9, padding: '8px 10px', background: 'var(--glass2, rgba(255,255,255,0.04))', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, fontFamily: 'inherit' }
const iconBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', cursor: 'pointer', fontSize: 11, flexShrink: 0 }
function Field({ label, value }) {
  if (!value) return null
  return (
    <div style={{ marginTop: 10 }}>
      <div style={lab}>{label}</div>
      <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{value}</div>
    </div>
  )
}
