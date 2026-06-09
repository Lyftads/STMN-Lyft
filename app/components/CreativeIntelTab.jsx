'use client'

import { useState, useCallback } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Competitor Creative Intel — modulo originale LyftAI: cerca e scompone le
// creatività dei competitor (via Foreplay). Estetica dark coerente col resto app.

const FORMATS = [
  { id: '', label: 'Tutti' },
  { id: 'VIDEO', label: 'Video' },
  { id: 'IMAGE', label: 'Image' },
]
const COUNTRIES = [
  { id: 'IT', label: 'Italia' },
  { id: 'ES', label: 'Spagna' },
  { id: 'FR', label: 'Francia' },
  { id: 'DE', label: 'Germania' },
  { id: 'GB', label: 'UK' },
  { id: 'US', label: 'USA' },
  { id: 'ALL', label: 'Tutti' },
]

function funnelOf(text) {
  const s = (text || '').toLowerCase()
  if (/\b(shop|buy|order|acquista|compra|sconto|% off|spedizione gratis|codice|checkout|abbonati|saldi|offerta|get yours)\b/.test(s)) return 'bofu'
  if (/\b(come funziona|how it works|recensione|review|guida|guide|perché|why|risultati|results|confronta|compare)\b/.test(s)) return 'mofu'
  return 'tofu'
}
function daysSince(d) {
  if (!d) return null
  const t = Date.parse(d)
  if (!Number.isFinite(t)) return null
  const n = Math.floor((Date.now() - t) / 86400000)
  return n >= 0 ? n : null
}
// Mappa un ad di /api/adlibrary-search nella forma usata dalle card.
function mapAd(a) {
  const headline = (a.titles && a.titles[0]) || ''
  const body = (a.bodies && a.bodies[0]) || (a.descriptions && a.descriptions[0]) || ''
  return {
    id: a.id || Math.random().toString(36).slice(2),
    brand: a.pageName || 'Pagina',
    headline,
    body,
    format: a.isVideo ? 'VIDEO' : a.imageUrl ? 'IMAGE' : 'AD',
    thumbnail: a.imageUrl || null,
    image: a.imageUrl || null,
    video: a.videoUrl || null,
    videoDuration: 0,
    linkUrl: (a.captions && a.captions[0]) || '',
    snapshotUrl: a.snapshotUrl || '',
    cta: '',
    platforms: a.platforms || [],
    live: true,
    runningDays: daysSince(a.startDate),
    funnel: funnelOf(`${headline} ${body}`),
  }
}

const FUNNEL = {
  tofu: { label: 'TOFU', color: '#22c55e' },
  mofu: { label: 'MOFU', color: '#f59e0b' },
  bofu: { label: 'BOFU', color: '#ef4444' },
}

function fmtDur(s) {
  if (!s) return ''
  const m = Math.floor(s / 60), sec = Math.round(s % 60)
  return m > 0 ? `${m}:${String(sec).padStart(2, '0')}` : `${sec}s`
}

function Badge({ children, color = '#8b8aa0', bg }) {
  return (
    <span style={{ fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6, color, background: bg || `${color}1f`, border: `1px solid ${color}33`, letterSpacing: '0.04em', textTransform: 'uppercase' }}>{children}</span>
  )
}

function AdCard({ ad, onOpen }) {
  const f = FUNNEL[ad.funnel]
  return (
    <button onClick={() => onOpen(ad)} style={{ textAlign: 'left', background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden', cursor: 'pointer', display: 'flex', flexDirection: 'column', padding: 0, fontFamily: 'inherit' }}>
      <div style={{ position: 'relative', aspectRatio: '4/3', background: 'var(--surface)', overflow: 'hidden' }}>
        {ad.thumbnail || ad.image ? (
          <img src={ad.thumbnail || ad.image} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: '#4a4060', fontSize: 12, fontWeight: 700 }}>{ad.format}</div>
        )}
        <div style={{ position: 'absolute', top: 8, left: 8, right: 8, display: 'flex', justifyContent: 'space-between', gap: 6 }}>
          <Badge color="#c4b5fd">{ad.format}</Badge>
          <div style={{ display: 'flex', gap: 5 }}>
            {ad.live && <Badge color="#22c55e">LIVE</Badge>}
            {f && <Badge color={f.color}>{f.label}</Badge>}
          </div>
        </div>
        {ad.format === 'VIDEO' && ad.videoDuration > 0 && (
          <span style={{ position: 'absolute', bottom: 8, right: 8, background: '#000a', color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 5, fontFamily: 'Barlow' }}>{fmtDur(ad.videoDuration)}</span>
        )}
      </div>
      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 7 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#8b8aa0' }}>
          <span style={{ fontWeight: 800, color: '#c8c0d6', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.brand}</span>
          {ad.platforms[0] && <><span style={{ color: '#4a4060' }}>·</span><span>{ad.platforms[0]}</span></>}
        </div>
        {ad.headline && <div style={{ fontSize: 13, fontWeight: 800, color: '#fff', lineHeight: 1.3, maxHeight: 34, overflow: 'hidden' }}>{ad.headline}</div>}
        {ad.body && <div style={{ fontSize: 11.5, color: '#8b8aa0', lineHeight: 1.45, maxHeight: 50, overflow: 'hidden' }}>{ad.body}</div>}
        <div style={{ display: 'flex', gap: 12, fontSize: 10.5, color: '#6b6580', marginTop: 2, fontFamily: 'Barlow' }}>
          {ad.runningDays != null && <span><span style={{ color: '#22c55e', fontWeight: 800 }}>{ad.runningDays}g</span> attiva</span>}
          {ad.cta && <span>{ad.cta}</span>}
        </div>
      </div>
    </button>
  )
}

function DetailModal({ ad, onClose }) {
  const f = FUNNEL[ad.funnel]
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, width: 860, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', display: 'grid', gridTemplateColumns: 'minmax(0,1fr) minmax(0,1fr)', gap: 0 }}>
        <div style={{ background: '#000', display: 'grid', placeItems: 'center', minHeight: 320 }}>
          {ad.video ? <video src={ad.video} poster={ad.thumbnail} controls style={{ width: '100%', maxHeight: '92vh', objectFit: 'contain' }} />
            : (ad.thumbnail || ad.image) ? <img src={ad.thumbnail || ad.image} alt="" style={{ width: '100%', maxHeight: '92vh', objectFit: 'contain' }} />
            : <span style={{ color: '#4a4060' }}>{ad.format}</span>}
        </div>
        <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <Badge color="#c4b5fd">{ad.format}</Badge>
            {ad.live && <Badge color="#22c55e">LIVE</Badge>}
            {f && <Badge color={f.color}>{f.label}</Badge>}
            <div style={{ flex: 1 }} />
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>
          <div>
            <div style={{ fontSize: 12, color: '#8b8aa0', fontWeight: 700 }}>{ad.brand}</div>
            {ad.headline && <div style={{ fontSize: 18, fontWeight: 950, color: '#fff', lineHeight: 1.25, marginTop: 4 }}>{ad.headline}</div>}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            {[['Attiva da', ad.runningDays != null ? `${ad.runningDays} giorni` : '—'], ['Formato', ad.format], ['CTA', ad.cta || '—'], ['Piattaforme', ad.platforms.join(', ') || '—']].map(([k, v]) => (
              <div key={k} style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 11px' }}>
                <div style={{ fontSize: 10, color: '#6b6580', textTransform: 'uppercase', letterSpacing: '0.06em', fontWeight: 800 }}>{k}</div>
                <div style={{ fontSize: 13, color: '#fff', fontWeight: 700, marginTop: 2 }}>{v}</div>
              </div>
            ))}
          </div>
          {ad.body && (
            <div>
              <div style={{ fontSize: 10, color: '#6b6580', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, marginBottom: 6 }}>Copy</div>
              <div style={{ fontSize: 13, color: '#c8c0d6', lineHeight: 1.6, whiteSpace: 'pre-wrap', maxHeight: 240, overflowY: 'auto' }}>{ad.body}</div>
            </div>
          )}
          {ad.linkUrl && (
            <a href={ad.linkUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#c4b5fd', textDecoration: 'underline', wordBreak: 'break-all' }}>{ad.linkUrl}</a>
          )}
          {ad.snapshotUrl && (
            <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, fontWeight: 800, color: '#fff', background: '#0866FF', padding: '8px 14px', borderRadius: 10, textDecoration: 'none', alignSelf: 'flex-start' }}>↗ Apri nella Ad Library</a>
          )}
        </div>
      </div>
    </div>
  )
}

export default function CreativeIntelTab() {
  const { t } = useI18n()
  const [query, setQuery] = useState('')
  const [country, setCountry] = useState('IT')
  const [format, setFormat] = useState('')
  const [ads, setAds] = useState([])
  const [srcUsed, setSrcUsed] = useState(null)
  const [libraryUrl, setLibraryUrl] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [selected, setSelected] = useState(null)
  const [searched, setSearched] = useState(false)

  const run = useCallback(async () => {
    if (!query.trim()) return
    setLoading(true); setError(''); setSearched(true); setSrcUsed(null)
    try {
      const r = await fetch(`/api/adlibrary-search?q=${encodeURIComponent(query.trim())}&country=${encodeURIComponent(country)}`, { cache: 'no-store' })
      const j = await r.json()
      let list = (j.ads || []).map(mapAd)
      if (format) list = list.filter(a => a.format === format)
      setAds(list)
      setSrcUsed(j.source || null)
      setLibraryUrl(j.libraryUrl || '')
      if (!list.length) setError(j.error && j.error !== 'no_results' ? j.error : '')
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }, [query, country, format])

  const chip = (active) => ({ padding: '7px 13px', borderRadius: 10, border: `1px solid ${active ? '#8b5cf6' : 'var(--border)'}`, background: active ? '#8b5cf620' : 'var(--glass)', color: active ? '#c4b5fd' : '#8b8aa0', fontSize: 12, fontWeight: 800, cursor: 'pointer' })

  return (
    <div>
      {/* Barra ricerca */}
      <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 18, padding: 18, marginBottom: 18 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: 240, display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px' }}>
            <Icon name="search" size={16} />
            <input value={query} onChange={e => setQuery(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder={t('ci.searchPh', null, 'Cerca brand o keyword (es. supplement, nike, longevity)…')} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 14, fontWeight: 600 }} />
          </div>
          <button onClick={() => run()} disabled={loading || !query.trim()} style={{ padding: '11px 24px', borderRadius: 12, border: 'none', background: loading || !query.trim() ? 'var(--glass)' : 'linear-gradient(135deg,#8b5cf6,#6d28d9)', color: loading || !query.trim() ? '#6b6580' : '#fff', fontSize: 14, fontWeight: 900, cursor: loading || !query.trim() ? 'default' : 'pointer' }}>{loading ? t('ci.searching', null, 'Cerco…') : t('ci.search', null, 'Cerca')}</button>
        </div>
        <div style={{ display: 'flex', gap: 16, marginTop: 14, flexWrap: 'wrap', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{COUNTRIES.map(c => <button key={c.id} onClick={() => setCountry(c.id)} style={chip(country === c.id)}>{c.label}</button>)}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{FORMATS.map(f => <button key={f.id} onClick={() => setFormat(f.id)} style={chip(format === f.id)}>{f.label}</button>)}</div>
          <div style={{ marginLeft: 'auto', fontSize: 11, color: '#6b6580' }}>{srcUsed ? t('ci.via', { src: srcUsed }, `via ${srcUsed}`) : t('ci.sourceNote', null, 'Fonte: Meta Ad Library (gratis)')}</div>
        </div>
      </div>

      {error && <div style={{ padding: 16, borderRadius: 14, background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', fontSize: 13, marginBottom: 18 }}>{error}</div>}

      {!searched && !error && (
        <div style={{ textAlign: 'center', padding: 70, color: '#6b6580' }}>
          <div style={{ marginBottom: 12, opacity: 0.5 }}><Icon name="search" size={36} /></div>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#8b8aa0' }}>{t('ci.emptyTitle', null, 'Spia le creatività dei competitor')}</div>
          <div style={{ fontSize: 13, marginTop: 4 }}>{t('ci.emptyHint', null, 'Cerca un brand o una keyword per vedere copy, hook, formato e da quanto girano.')}</div>
        </div>
      )}

      {ads.length > 0 && (
        <>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 900 }}>{t('ci.results', null, 'Creatività trovate')}</h2>
            <span style={{ marginLeft: 10, color: '#6b6580', fontSize: 12, fontFamily: 'Barlow' }}>{ads.length}</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 16 }}>
            {ads.map(ad => <AdCard key={ad.id} ad={ad} onOpen={setSelected} />)}
          </div>
          {libraryUrl && (
            <div style={{ textAlign: 'center', marginTop: 22 }}>
              <a href={libraryUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', padding: '11px 26px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--glass)', color: '#c8c0d6', fontSize: 13, fontWeight: 800, textDecoration: 'none' }}>{t('ci.openLibrary', null, 'Apri tutte nella Ad Library ↗')}</a>
            </div>
          )}
        </>
      )}

      {searched && !loading && ads.length === 0 && !error && (
        <div style={{ textAlign: 'center', padding: 60, color: '#6b6580', fontSize: 14 }}>{t('ci.noResults', null, 'Nessuna creatività trovata. Prova un\'altra keyword.')}</div>
      )}

      {selected && <DetailModal ad={selected} onClose={() => setSelected(null)} />}
    </div>
  )
}
