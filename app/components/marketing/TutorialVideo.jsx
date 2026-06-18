'use client'

import { useState } from 'react'

// Player tutorial per le pagine-soluzione: mostra il poster (screenshot reale del
// SaaS) con un pulsante play; al click carica il <video> con i sottotitoli .vtt.
// Lazy: niente download del video finché l'utente non clicca (performance).
export default function TutorialVideo({ video, title, durationLabel }) {
  const [playing, setPlaying] = useState(false)
  if (!video?.src) return null

  return (
    <div
      style={{
        position: 'relative', width: '100%', aspectRatio: '16 / 10',
        borderRadius: 16, overflow: 'hidden',
        border: '1px solid rgba(255,255,255,0.12)',
        background: '#0a0a14',
        boxShadow: '0 30px 70px rgba(0,0,0,0.55)',
      }}
    >
      {playing ? (
        <video
          src={video.src}
          poster={video.poster || undefined}
          controls
          autoPlay
          playsInline
          crossOrigin="anonymous"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        >
          {video.captions && <track kind="captions" src={video.captions} srcLang="en" label="English" default />}
        </video>
      ) : (
        <button
          type="button"
          onClick={() => setPlaying(true)}
          aria-label={title ? `Riproduci il tutorial: ${title}` : 'Riproduci il tutorial'}
          style={{
            position: 'absolute', inset: 0, width: '100%', height: '100%',
            border: 'none', padding: 0, cursor: 'pointer', background: '#0a0a14',
          }}
        >
          {video.poster && (
            <img
              src={video.poster}
              alt={title ? `Anteprima di ${title} in LyftAI` : 'Anteprima tutorial'}
              loading="lazy"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', opacity: 0.92 }}
            />
          )}
          {/* overlay gradient + play */}
          <span style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(0,0,0,0.05), rgba(0,0,0,0.45))' }} />
          <span
            className="tv-play"
            style={{
              position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
              width: 64, height: 64, borderRadius: '50%',
              background: 'rgba(123,91,255,0.92)', display: 'grid', placeItems: 'center',
              boxShadow: '0 12px 36px rgba(123,91,255,0.5)',
              transition: 'transform 200ms ease, background 200ms ease',
            }}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="#fff" aria-hidden="true" style={{ marginLeft: 3 }}>
              <path d="M6 4l14 8-14 8z" />
            </svg>
          </span>
          {video.duration && (
            <span style={{
              position: 'absolute', bottom: 12, right: 12,
              background: 'rgba(0,0,0,0.7)', color: '#fff', fontSize: 12, fontWeight: 700,
              padding: '3px 9px', borderRadius: 7, fontVariantNumeric: 'tabular-nums',
            }}>{video.duration}</span>
          )}
          {durationLabel && (
            <span style={{
              position: 'absolute', bottom: 12, left: 12,
              background: 'rgba(0,0,0,0.6)', color: '#e7e7ef', fontSize: 11.5, fontWeight: 700,
              padding: '4px 10px', borderRadius: 7, textTransform: 'uppercase', letterSpacing: '0.04em',
            }}>{durationLabel}</span>
          )}
        </button>
      )}
      <style>{`
        .tv-play:hover { transform: translate(-50%,-50%) scale(1.06); background: rgba(123,91,255,1); }
        @media (prefers-reduced-motion: reduce){ .tv-play{ transition: none !important; } }
      `}</style>
    </div>
  )
}
