'use client'

import { useState } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Anteprima a mockup IG/TikTok del post, in base al tipo:
// - post / carosello (IG) → feed quadrato (carosello con dots + frecce)
// - reel / story / TikTok → verticale 9:16 fullscreen con overlay
const src = (m) => m?.previewUrl || m?.url
const isVid = (m) => (m?.type || '').startsWith('video')

function Media({ m }) {
  if (!m || (!src(m))) return null
  return isVid(m)
    ? <video src={src(m)} muted loop autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
    : <img src={src(m)} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
}

function Avatar({ handle, size = 28 }) {
  return <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#7b5bff,#e1306c)', display: 'grid', placeItems: 'center', color: '#fff', fontSize: size * 0.45, fontWeight: 800, flexShrink: 0 }}>{(handle[0] || '?').toUpperCase()}</div>
}

function Placeholder({ t }) {
  return (
    <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', textAlign: 'center', padding: 16, color: 'rgba(255,255,255,0.55)', background: 'linear-gradient(135deg,#1a1a24,#241a28)' }}>
      <div><Icon name="image" size={26} /><div style={{ fontSize: 11, marginTop: 8, lineHeight: 1.4 }}>{t('social.noMedia')}</div></div>
    </div>
  )
}

export default function SocialMockup({ platform, postType, media = [], caption = '', hashtags = [] }) {
  const { t } = useI18n()
  const handle = t('social.yourBrand', null, 'your_brand')
  const capText = [caption, (hashtags || []).join(' ')].filter(Boolean).join('\n\n')
  const vertical = postType === 'reel' || postType === 'story' || platform === 'tiktok'
  return vertical
    ? <Vertical postType={postType} media={media} capText={capText} handle={handle} t={t} />
    : <Feed postType={postType} media={media} capText={capText} handle={handle} t={t} />
}

function Vertical({ postType, media, capText, handle, t }) {
  const isStory = postType === 'story'
  const first = media[0]
  return (
    <div style={{ width: 270, aspectRatio: '9 / 16', borderRadius: 24, overflow: 'hidden', position: 'relative', background: '#0c0c10', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 44px rgba(0,0,0,0.55)' }}>
      {first ? <Media m={first} /> : <Placeholder t={t} />}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 38%, transparent 72%, rgba(0,0,0,0.35) 100%)', pointerEvents: 'none' }} />
      {isStory && (
        <div style={{ position: 'absolute', top: 10, left: 10, right: 10, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.35)' }}>
          <div style={{ width: '45%', height: '100%', background: '#fff', borderRadius: 2 }} />
        </div>
      )}
      <div style={{ position: 'absolute', top: isStory ? 20 : 12, left: 12, right: 12, display: 'flex', alignItems: 'center', gap: 8, color: '#fff' }}>
        <Avatar handle={handle} size={26} />
        <span style={{ fontSize: 12, fontWeight: 700, textShadow: '0 1px 3px rgba(0,0,0,0.6)' }}>{handle}</span>
        {!isStory && <span style={{ marginLeft: 'auto', fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 999, border: '1px solid #fff' }}>Segui</span>}
      </div>
      {!isStory && (
        <div style={{ position: 'absolute', right: 12, bottom: 86, display: 'flex', flexDirection: 'column', gap: 18, color: '#fff', alignItems: 'center', filter: 'drop-shadow(0 1px 3px rgba(0,0,0,0.6))' }}>
          <Icon name="heart" size={26} /><Icon name="chat" size={25} /><Icon name="send" size={24} /><Icon name="bookmark" size={23} />
        </div>
      )}
      <div style={{ position: 'absolute', left: 12, right: isStory ? 12 : 54, bottom: 16, color: '#fff', fontSize: 11.5, lineHeight: 1.4, whiteSpace: 'pre-wrap', overflow: 'hidden', maxHeight: isStory ? 64 : 130, textShadow: '0 1px 3px rgba(0,0,0,0.75)' }}>
        {capText}
      </div>
    </div>
  )
}

function Feed({ postType, media, capText, handle, t }) {
  const [i, setI] = useState(0)
  const carousel = postType === 'carousel' && media.length > 1
  const idx = Math.min(i, Math.max(0, media.length - 1))
  const cur = media[idx]
  const arrow = (side) => ({ position: 'absolute', top: '50%', [side]: 8, transform: 'translateY(-50%)', width: 28, height: 28, borderRadius: '50%', border: 'none', background: 'rgba(0,0,0,0.55)', color: '#fff', cursor: 'pointer', fontSize: 16, lineHeight: 1 })
  return (
    <div style={{ width: 348, maxWidth: '100%', borderRadius: 14, overflow: 'hidden', background: '#000', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 12px 44px rgba(0,0,0,0.5)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '10px 12px' }}>
        <Avatar handle={handle} size={30} />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#fff' }}>{handle}</span>
        <span style={{ marginLeft: 'auto', color: '#fff', letterSpacing: 1 }}>•••</span>
      </div>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '1 / 1', background: '#111' }}>
        {cur ? <Media m={cur} /> : <Placeholder t={t} />}
        {carousel && (
          <>
            <span style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,0.6)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 999 }}>{idx + 1}/{media.length}</span>
            {idx > 0 && <button onClick={() => setI(idx - 1)} style={arrow('left')}>‹</button>}
            {idx < media.length - 1 && <button onClick={() => setI(idx + 1)} style={arrow('right')}>›</button>}
          </>
        )}
      </div>
      {carousel && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 5, padding: '8px 0 2px' }}>
          {media.map((_, j) => <span key={j} style={{ width: 6, height: 6, borderRadius: 3, background: j === idx ? '#0095f6' : 'rgba(255,255,255,0.3)' }} />)}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 12px 6px', color: '#fff' }}>
        <Icon name="heart" size={23} /><Icon name="chat" size={22} /><Icon name="send" size={21} />
        <span style={{ marginLeft: 'auto' }}><Icon name="bookmark" size={22} /></span>
      </div>
      <div style={{ padding: '0 12px 12px', color: '#fff', fontSize: 12.5, lineHeight: 1.45, whiteSpace: 'pre-wrap', maxHeight: 132, overflow: 'hidden' }}>
        <b>{handle}</b> {capText}
      </div>
    </div>
  )
}
