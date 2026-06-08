'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'
import { AD_FORMATS, AD_TEMPLATES, renderAd, loadBrandLogo } from '../../../lib/studio/adRender'

// Compositore Ad (ispirato a Mimero): sovrappone headline/sottotitolo/CTA/
// badge/logo all'immagine usando template ad alte performance. Multi-formato +
// batch varianti. Composizione su canvas: zero crediti, istantanea, brand-safe.
export default function AdComposer({ imageUrl, onClose, onSaved }) {
  const { t } = useI18n()
  const [template, setTemplate] = useState('bottom')
  const [format, setFormat] = useState('square')
  const [headline, setHeadline] = useState('')
  const [subhead, setSubhead] = useState('')
  const [cta, setCta] = useState('Scopri di più')
  const [badge, setBadge] = useState('')
  const [showLogo, setShowLogo] = useState(true)
  const [primary, setPrimary] = useState('#7b5bff')
  const [accent, setAccent] = useState('#ff375f')
  const [logoImg, setLogoImg] = useState(null)
  const [brandName, setBrandName] = useState('')
  const [preview, setPreview] = useState(null)
  const [saving, setSaving] = useState(false)
  const [batch, setBatch] = useState(null)
  const tRef = useRef(null)

  // Default dal brand (colori/logo/nome)
  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/brand-identity', { cache: 'no-store' })
        const j = await r.json()
        const id = j.identity || {}
        const assets = j.brand_assets || j.brandAssets || {}
        const name = id.name || id.brandName || j.company_name || ''
        if (name) { setBrandName(name); if (!headline) setHeadline(name) }
        const pc = id.primaryColor || id.colorPrimary || (Array.isArray(id.colors) ? id.colors[0] : id.colors?.primary)
        if (pc && /^#?[0-9a-fA-F]{6}$/.test(pc.replace('#', ''))) setPrimary(pc.startsWith('#') ? pc : '#' + pc)
        const logoUrl = assets.logo || id.logo || (Array.isArray(assets) ? assets.find(a => /logo/i.test(a?.name || a?.url || ''))?.url : null)
        if (logoUrl) setLogoImg(await loadBrandLogo(logoUrl))
      } catch {}
    })()
  }, []) // eslint-disable-line

  const draw = useCallback(async () => {
    try {
      const url = await renderAd({ imageUrl, format, template, fields: { headline, subhead, cta, badge, showLogo }, brand: { primary, accent, onPrimary: '#fff', logoImg, name: brandName } })
      setPreview(url)
    } catch {}
  }, [imageUrl, format, template, headline, subhead, cta, badge, showLogo, primary, accent, logoImg, brandName])

  useEffect(() => { clearTimeout(tRef.current); tRef.current = setTimeout(draw, 200); return () => clearTimeout(tRef.current) }, [draw])

  const saveOne = async (dataUrl, label) => {
    const r = await fetch('/api/studio/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ dataUrl, format, label }) })
    const j = await r.json()
    if (j.image?.url) { onSaved && onSaved({ type: 'image', url: j.image.url, modelName: 'Ad', prompt: label || 'ad', format }); return true }
    return false
  }

  const addCurrent = async () => {
    if (!preview || saving) return
    setSaving(true); try { await saveOne(preview, headline || 'ad') } catch {} setSaving(false)
  }

  const allVariants = async () => {
    if (batch) return
    setBatch({ done: 0, total: AD_TEMPLATES.length })
    let done = 0
    for (const tpl of AD_TEMPLATES) {
      try {
        const url = await renderAd({ imageUrl, format, template: tpl.id, fields: { headline, subhead, cta, badge, showLogo }, brand: { primary, accent, onPrimary: '#fff', logoImg, name: brandName } })
        await saveOne(url, `${headline || 'ad'} · ${tpl.label}`)
      } catch {}
      done++; setBatch({ done, total: AD_TEMPLATES.length })
    }
    setBatch(null)
  }

  const download = () => { if (!preview) return; const a = document.createElement('a'); a.href = preview; a.download = 'ad.jpg'; a.click() }

  const lab = { fontSize: 10.5, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '12px 0 6px' }
  const inp = { width: '100%', background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', color: '#fff', fontSize: 13, fontFamily: 'Barlow' }
  const chip = (on) => ({ background: on ? 'rgba(123,91,255,0.2)' : 'var(--glass2,#1a1a24)', border: on ? '1px solid #7b5bff' : '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', color: on ? '#fff' : 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 2100, display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 16, borderRadius: 16, width: 920, maxWidth: '97vw', maxHeight: '94vh', display: 'flex', gap: 16, flexWrap: 'wrap', overflowY: 'auto' }}>
        {/* Preview */}
        <div style={{ flex: '1 1 320px', minWidth: 280, display: 'grid', placeItems: 'center', background: '#000', borderRadius: 12, overflow: 'hidden', maxHeight: '80vh' }}>
          {preview ? <img src={preview} alt="" style={{ maxWidth: '100%', maxHeight: '80vh', objectFit: 'contain', display: 'block' }} />
            : <div style={{ color: 'var(--text3,#888)', fontSize: 13, padding: 40 }}>{t('cs.loading', null, 'Carico…')}</div>}
        </div>

        {/* Controlli */}
        <div style={{ flex: '1 1 300px', minWidth: 280 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ fontSize: 16, fontWeight: 800, flex: 1 }}>{t('cs.adTitle', null, 'Compositore Ad')}</div>
            <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
          </div>

          <div style={lab}>{t('cs.adTemplate', null, 'Template')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{AD_TEMPLATES.map(tp => <button key={tp.id} onClick={() => setTemplate(tp.id)} style={chip(template === tp.id)}>{tp.label}</button>)}</div>

          <div style={lab}>{t('cs.adFormat', null, 'Formato')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{AD_FORMATS.map(f => <button key={f.id} onClick={() => setFormat(f.id)} style={chip(format === f.id)}>{f.label}</button>)}</div>

          <div style={lab}>{t('cs.adHeadline', null, 'Titolo')}</div>
          <input value={headline} onChange={e => setHeadline(e.target.value)} style={inp} placeholder={t('cs.adHeadline', null, 'Titolo')} />
          <div style={lab}>{t('cs.adSubhead', null, 'Sottotitolo')}</div>
          <input value={subhead} onChange={e => setSubhead(e.target.value)} style={inp} />
          <div style={{ display: 'flex', gap: 10 }}>
            <div style={{ flex: 2 }}><div style={lab}>{t('cs.adCta', null, 'CTA')}</div><input value={cta} onChange={e => setCta(e.target.value)} style={inp} /></div>
            <div style={{ flex: 1 }}><div style={lab}>{t('cs.adBadge', null, 'Badge')}</div><input value={badge} onChange={e => setBadge(e.target.value)} style={inp} placeholder="-20%" /></div>
          </div>

          <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginTop: 12, flexWrap: 'wrap' }}>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontSize: 12.5, cursor: 'pointer' }}>
              <input type="checkbox" checked={showLogo} onChange={e => setShowLogo(e.target.checked)} /> {t('cs.adLogo', null, 'Logo')}
            </label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>{t('cs.adPrimary', null, 'Colore')}<input type="color" value={primary} onChange={e => setPrimary(e.target.value)} style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5 }}>{t('cs.adAccent', null, 'Badge')}<input type="color" value={accent} onChange={e => setAccent(e.target.value)} style={{ width: 30, height: 26, border: 'none', background: 'none', cursor: 'pointer' }} /></label>
          </div>

          <div style={{ display: 'flex', gap: 8, marginTop: 18, flexWrap: 'wrap' }}>
            <button onClick={addCurrent} disabled={saving || !preview} style={{ background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow' }}>{saving ? '…' : t('cs.adAdd', null, 'Aggiungi alla board')}</button>
            <button onClick={allVariants} disabled={!!batch} style={{ background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 16px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow' }}>{batch ? `${batch.done}/${batch.total}` : t('cs.adVariants', null, 'Tutte le varianti')}</button>
            <button onClick={download} disabled={!preview} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', color: '#fff', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="download" size={14} /></button>
          </div>
        </div>
      </div>
    </div>
  )
}
