'use client'

import { useState, useRef } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Virtual Try-On (FASHN): il PRODOTTO indossato da un modello reale.
// garmentImage = prodotto/capo (passato). L'utente carica la foto della persona.
const CATS = [
  { id: 'auto', label: 'Auto' },
  { id: 'tops', label: 'Top' },
  { id: 'bottoms', label: 'Pantaloni' },
  { id: 'one-pieces', label: 'Intero' },
]

export default function TryOnModal({ garmentImage, onClose, onSaved, onCredits }) {
  const { t } = useI18n()
  const [modelImage, setModelImage] = useState(null) // dataURL persona
  const [category, setCategory] = useState('auto')
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const pickModel = (e) => {
    const f = e.target.files?.[0]; e.target.value = ''
    if (!f || !f.type.startsWith('image/')) return
    const r = new FileReader(); r.onload = () => setModelImage(r.result); r.readAsDataURL(f)
  }

  const run = async () => {
    if (!modelImage || busy) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/studio/tryon', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelImage, garmentImage, category }),
      })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') { onCredits && onCredits(j.balance); setError(t('cs.insufficient', null, 'Crediti insufficienti.')); return }
      if (!r.ok || !j.image?.url) { setError(j.error || t('cs.genFail', null, 'Generazione fallita.')); return }
      setResult(j.image.url)
      if (typeof j.balance === 'number' && onCredits) onCredits(j.balance)
      onSaved && onSaved({ type: 'image', url: j.image.url, modelName: 'Try-On', prompt: 'try-on', format: 'portrait' })
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const box = { aspectRatio: '4/5', borderRadius: 12, overflow: 'hidden', background: '#000', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }
  const chip = (on) => ({ background: on ? 'rgba(123,91,255,0.2)' : 'var(--glass2,#1a1a24)', border: on ? '1px solid #7b5bff' : '1px solid var(--border)', borderRadius: 8, padding: '6px 11px', color: on ? '#fff' : 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' })

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 2100, display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 18, borderRadius: 16, width: 760, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', color: '#fff', fontFamily: 'Barlow' }}>
        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
          <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{t('cs.tryonTitle', null, 'Prova indosso (Virtual Try-On)')}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
          <div>
            <div style={lab}>{t('cs.tryonGarment', null, 'Prodotto')}</div>
            <div style={box}><img src={garmentImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain' }} /></div>
          </div>
          <div>
            <div style={lab}>{t('cs.tryonModel', null, 'Modello / persona')}</div>
            <div style={{ ...box, cursor: 'pointer' }} onClick={() => fileRef.current?.click()}>
              {modelImage ? <img src={modelImage} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <div style={{ textAlign: 'center', color: 'var(--text3,#888)', fontSize: 12, padding: 12 }}><Icon name="plus" size={20} /><div style={{ marginTop: 6 }}>{t('cs.tryonUpload', null, 'Carica foto')}</div></div>}
            </div>
            <input ref={fileRef} type="file" accept="image/*" onChange={pickModel} style={{ display: 'none' }} />
          </div>
          <div>
            <div style={lab}>{t('cs.tryonResult', null, 'Risultato')}</div>
            <div style={box}>
              {busy ? <span style={{ color: 'var(--text2,#9aa)', fontSize: 12 }}>{t('cs.generating', null, 'Genero…')}</span>
                : result ? <img src={result} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span style={{ color: 'var(--text3,#888)', fontSize: 12 }}>—</span>}
            </div>
          </div>
        </div>

        <div style={lab}>{t('cs.tryonCategory', null, 'Categoria capo')}</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{CATS.map(c => <button key={c.id} onClick={() => setCategory(c.id)} style={chip(category === c.id)}>{c.label}</button>)}</div>

        {error && <div style={{ marginTop: 12, background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.35)', color: '#ff8095', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>}

        <div style={{ marginTop: 16 }}>
          <button onClick={run} disabled={busy || !modelImage} style={{ background: busy || !modelImage ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '11px 20px', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: busy || !modelImage ? 'default' : 'pointer', fontFamily: 'Barlow' }}>{busy ? t('cs.generating', null, 'Genero…') : `${t('cs.tryonRun', null, 'Genera indossato')} · 4 cr`}</button>
        </div>
      </div>
    </div>
  )
}

const lab = { fontSize: 10.5, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '14px 0 6px' }
