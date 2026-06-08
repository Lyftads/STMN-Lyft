'use client'

import { useState } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Modello + capo (pipeline 2 step): genera un MODELLO nella scena descritta
// (text->image), poi applica il PRODOTTO reale via Virtual Try-On (FASHN) così
// la stampa/colore/fit del capo restano identici. Ideale quando Kontext perde la
// grafica del capo indossato.
const CATS = [
  { id: 'auto', label: 'Auto' },
  { id: 'tops', label: 'Top' },
  { id: 'bottoms', label: 'Pantaloni' },
  { id: 'one-pieces', label: 'Intero' },
]

export default function ModelTryOnModal({ garmentImages = [], boardId = null, initialPrompt = '', studioPrompt = '', onClose, onSaved, onCredits }) {
  const { t } = useI18n()
  const imgs = (Array.isArray(garmentImages) ? garmentImages : [garmentImages]).filter(Boolean)
  const [garmentIdx, setGarmentIdx] = useState(0)
  const garmentImage = imgs[garmentIdx] || imgs[0]
  const [prompt, setPrompt] = useState(initialPrompt)
  const [category, setCategory] = useState('auto')
  const [step, setStep] = useState('idle') // idle | model | tryon
  const [modelUrl, setModelUrl] = useState(null)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const busy = step !== 'idle'

  const run = async () => {
    if (busy || !prompt.trim()) return
    setError(''); setResult(null); setModelUrl(null)
    // STEP 1 — genera il modello nella scena descritta (no capo specifico)
    setStep('model')
    let mUrl = null
    try {
      const garmentHint = category === 'bottoms' ? 'wearing plain neutral pants' : category === 'one-pieces' ? 'wearing a plain neutral outfit' : 'wearing a plain neutral t-shirt'
      const fullPrompt = [prompt.trim(), studioPrompt, `full-body fashion model, ${garmentHint}, clear front view, natural pose`].filter(Boolean).join('. ')
      const r = await fetch('/api/studio/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: fullPrompt, model: 'seedream-4', format: 'portrait', count: 1, boardId }),
      })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') { onCredits && onCredits(j.balance); setError(t('cs.insufficient', null, 'Crediti insufficienti.')); setStep('idle'); return }
      if (!r.ok || !j.images?.[0]?.url) { setError(j.error || t('cs.genFail', null, 'Generazione modello fallita.')); setStep('idle'); return }
      mUrl = j.images[0].url; setModelUrl(mUrl)
      if (typeof j.balance === 'number' && onCredits) onCredits(j.balance)
    } catch (e) { setError(e.message); setStep('idle'); return }

    // STEP 2 — applica il prodotto reale sul modello generato (FASHN)
    setStep('tryon')
    try {
      const r = await fetch('/api/studio/tryon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelImage: mUrl, garmentImage, category, boardId }),
      })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') { onCredits && onCredits(j.balance); setError(t('cs.insufficient', null, 'Crediti insufficienti.')); setStep('idle'); return }
      if (!r.ok || !j.image?.url) { setError(j.error || t('cs.genFail', null, 'Try-on fallito.')); setStep('idle'); return }
      setResult(j.image.url)
      if (typeof j.balance === 'number' && onCredits) onCredits(j.balance)
      onSaved && onSaved({ type: 'image', url: j.image.url, modelName: 'Modello + capo', prompt: prompt.trim(), format: 'portrait' })
    } catch (e) { setError(e.message) } finally { setStep('idle') }
  }

  const box = { aspectRatio: '4/5', borderRadius: 12, overflow: 'hidden', background: '#000', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }
  const chip = (on) => ({ background: on ? 'rgba(123,91,255,0.2)' : 'var(--glass2,#1a1a24)', border: on ? '1px solid #7b5bff' : '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', color: on ? '#fff' : 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' })
  const stepLabel = step === 'model' ? t('cs.mtoStep1', null, '1/2 · Genero il modello…') : step === 'tryon' ? t('cs.mtoStep2', null, '2/2 · Applico il prodotto…') : ''

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 2100, display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 18, borderRadius: 16, width: 780, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', color: '#fff', fontFamily: 'Barlow' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          <Icon name="shirt" size={17} />
          <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{t('cs.mtoTitle', null, 'Modello + capo — prodotto perfetto')}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>
        <div style={{ fontSize: 12, color: 'var(--text2,#9aa)', marginBottom: 12, lineHeight: 1.45 }}>{t('cs.mtoHint', null, 'Descrivi il modello e la scena: genero la persona e poi le applico il prodotto reale (stampa e colori identici).')}</div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <div style={lab}>{t('cs.tryonGarment', null, 'Prodotto')}</div>
            <div style={box}>{garmentImage ? <img src={garmentImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /> : <span style={{ color: 'var(--text3,#888)', fontSize: 12 }}>—</span>}</div>
            {imgs.length > 1 && (
              <div style={{ display: 'flex', gap: 5, marginTop: 6, flexWrap: 'wrap' }}>
                {imgs.map((u, i) => (
                  <button key={i} onClick={() => setGarmentIdx(i)} title={t('cs.mtoPickFront', null, 'Usa questa foto (scegli il fronte)')} style={{ width: 34, height: 34, borderRadius: 7, overflow: 'hidden', padding: 0, cursor: 'pointer', border: i === garmentIdx ? '2px solid #7b5bff' : '1px solid var(--border)', background: '#000' }}>
                    <img src={u} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <div style={lab}>{t('cs.mtoModel', null, 'Modello generato')}</div>
            <div style={box}>{step === 'model' ? <span style={{ color: 'var(--text2,#9aa)', fontSize: 12 }}>{t('cs.generating', null, 'Genero…')}</span> : modelUrl ? <img src={modelUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--text3,#888)', fontSize: 12 }}>—</span>}</div>
          </div>
          <div>
            <div style={lab}>{t('cs.tryonResult', null, 'Risultato')}</div>
            <div style={box}>{step === 'tryon' ? <span style={{ color: 'var(--text2,#9aa)', fontSize: 12 }}>{t('cs.generating', null, 'Genero…')}</span> : result ? <img src={result} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <span style={{ color: 'var(--text3,#888)', fontSize: 12 }}>—</span>}</div>
          </div>
        </div>

        <div style={lab}>{t('cs.mtoDesc', null, 'Descrizione modello + scena')}</div>
        <textarea value={prompt} onChange={e => setPrompt(e.target.value)} rows={3} placeholder={t('cs.mtoPh', null, 'Es: uomo atletico 30 anni, barba corta, pantaloni cargo beige, in una palestra industriale al tramonto, posa di tre quarti…')} style={{ width: '100%', resize: 'none', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 10, padding: 10, color: '#fff', fontSize: 13, fontFamily: 'Barlow', boxSizing: 'border-box' }} />

        <div style={lab}>{t('cs.tryonCategory', null, 'Categoria capo')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CATS.map(c => <button key={c.id} onClick={() => setCategory(c.id)} style={chip(category === c.id)}>{c.label}</button>)}</div>

        {error && <div style={{ marginTop: 12, background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.35)', color: '#ff8095', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>}

        <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
          {busy && <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7b5bff' }}>{stepLabel}</span>}
          <div style={{ flex: 1 }} />
          <button onClick={run} disabled={busy || !prompt.trim()} style={{ background: busy || !prompt.trim() ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '11px 20px', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: busy || !prompt.trim() ? 'default' : 'pointer', fontFamily: 'Barlow' }}>{busy ? stepLabel : `${t('cs.mtoRun', null, 'Genera modello + capo')} · ~6 cr`}</button>
        </div>
      </div>
    </div>
  )
}

const lab = { fontSize: 10.5, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '14px 0 6px' }
