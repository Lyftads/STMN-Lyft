'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Modelli AI addestrati (LoRA, di personaggi custom). Crea un modello da
// 3-20 foto di un prodotto/personaggio/stile; training async; poi selezionabile
// per generare con coerenza totale.
const KINDS = [
  { id: 'product', label: 'Prodotto' },
  { id: 'character', label: 'Personaggio' },
  { id: 'style', label: 'Stile' },
]

function compressImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const img = new Image()
      img.onload = () => {
        const canvas = document.createElement('canvas')
        const max = 1024
        let w = img.width, h = img.height
        if (w > max || h > max) { if (w > h) { h = Math.round(h * max / w); w = max } else { w = Math.round(w * max / h); h = max } }
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', 0.85))
      }
      img.src = e.target.result
    }
    reader.readAsDataURL(file)
  })
}

export default function AiModelsModal({ activeModelId, onSelect, onClose, onCredits }) {
  const { t } = useI18n()
  const [models, setModels] = useState(null)
  const [view, setView] = useState('list')
  const [name, setName] = useState('')
  const [kind, setKind] = useState('product')
  const [trigger, setTrigger] = useState('')
  const [imgs, setImgs] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const fileRef = useRef(null)

  const load = useCallback(async () => {
    try { const r = await fetch('/api/studio/models', { cache: 'no-store' }); const j = await r.json(); setModels(Array.isArray(j.models) ? j.models : []) } catch { setModels([]) }
  }, [])
  useEffect(() => { load() }, [load])

  // Polling dei modelli in training
  useEffect(() => {
    if (!models?.some(m => m.status === 'training')) return
    const iv = setInterval(async () => {
      const training = models.filter(m => m.status === 'training')
      let changed = false
      for (const m of training) {
        try { const r = await fetch(`/api/studio/train-status?id=${m.id}`, { cache: 'no-store' }); const j = await r.json(); if (j.status && j.status !== 'training') changed = true } catch {}
      }
      if (changed) load()
    }, 12000)
    return () => clearInterval(iv)
  }, [models, load])

  const pickFiles = async (e) => {
    const files = Array.from(e.target.files || []); e.target.value = ''
    const room = 20 - imgs.length
    const out = await Promise.all(files.slice(0, room).filter(f => f.type.startsWith('image/')).map(compressImage))
    setImgs(prev => [...prev, ...out].slice(0, 20))
  }

  const create = async () => {
    if (busy) return
    if (!name.trim()) { setError(t('cs.aiNameNeed', null, 'Dai un nome al modello')); return }
    if (imgs.length < 3) { setError(t('cs.aiImgsNeed', null, 'Servono almeno 3 immagini')); return }
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/studio/train', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: name.trim(), kind, triggerWord: trigger.trim() || undefined, images: imgs }) })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') { onCredits && onCredits(j.balance); setError(t('cs.insufficient', null, 'Crediti insufficienti.')); return }
      if (!r.ok || !j.model) { setError(j.error || t('cs.genFail', null, 'Avvio training fallito.')); return }
      if (typeof j.balance === 'number' && onCredits) onCredits(j.balance)
      setName(''); setTrigger(''); setImgs([]); setView('list'); load()
    } catch (e) { setError(e.message) } finally { setBusy(false) }
  }

  const remove = async (m) => {
    if (!window.confirm(t('cs.aiDeleteConfirm', { name: m.name }, `Eliminare il modello "${m.name}"?`))) return
    await fetch('/api/studio/models', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
    if (activeModelId === m.id) onSelect(null)
    load()
  }

  const box = { width: 56, height: 56, borderRadius: 10, overflow: 'hidden', background: '#000', flexShrink: 0, border: '1px solid var(--border)' }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 2150, display: 'grid', placeItems: 'center', padding: 18 }}>
      <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 18, borderRadius: 16, width: 640, maxWidth: '96vw', maxHeight: '92vh', overflowY: 'auto', color: '#fff', fontFamily: 'Barlow' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <Icon name="star" size={17} />
          <div style={{ fontSize: 17, fontWeight: 800, flex: 1 }}>{t('cs.aiModels', null, 'Modelli AI — addestrati')}</div>
          <button onClick={onClose} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
        </div>

        {view === 'list' && (<>
          <div style={{ fontSize: 12.5, color: 'var(--text2,#9aa)', marginBottom: 14, lineHeight: 1.45 }}>{t('cs.aiHint', null, 'Addestra un modello su un prodotto, un volto o uno stile (3-20 foto) per riprodurlo con coerenza in ogni generazione.')}</div>
          <button onClick={() => setView('create')} style={{ width: '100%', padding: '12px', borderRadius: 12, border: '1.5px dashed var(--border)', background: 'var(--glass2,rgba(255,255,255,0.03))', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: 'pointer', fontFamily: 'Barlow', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 14 }}><Icon name="plus" size={16} /> {t('cs.aiTrainNew', null, 'Addestra nuovo modello')} · 40 cr</button>

          {models === null && <div style={{ color: 'var(--text2,#9aa)', fontSize: 13 }}>{t('cs.loading', null, 'Carico…')}</div>}
          {models && models.length === 0 && <div style={{ color: 'var(--text3,#888)', fontSize: 13, textAlign: 'center', padding: 16 }}>{t('cs.aiEmpty', null, 'Nessun modello ancora.')}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {(models || []).map(m => {
              const active = activeModelId === m.id
              const ready = m.status === 'ready'
              return (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 10, borderRadius: 12, border: active ? '1.5px solid #7b5bff' : '1px solid var(--border)', background: active ? 'rgba(123,91,255,0.10)' : 'var(--glass2,rgba(255,255,255,0.04))' }}>
                  <div style={box}>{m.thumb_url && <img src={m.thumb_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3,#888)', display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ textTransform: 'capitalize' }}>{m.kind}</span>
                      {m.status === 'training' && <span style={{ color: '#f0c25a', fontWeight: 700 }}>· {t('cs.aiTraining', null, 'in training…')}</span>}
                      {m.status === 'failed' && <span style={{ color: '#ff8095', fontWeight: 700 }}>· {t('cs.aiFailed', null, 'fallito')}</span>}
                      {ready && m.trigger_word && <span>· {m.trigger_word}</span>}
                    </div>
                  </div>
                  {ready && (active
                    ? <button onClick={() => onSelect(null)} style={{ ...chip, ...chipOn }}>{t('cs.aiActive', null, 'Attivo')} ×</button>
                    : <button onClick={() => onSelect({ id: m.id, name: m.name, triggerWord: m.trigger_word })} style={{ ...chip }}>{t('cs.aiUse', null, 'Usa')}</button>)}
                  <button onClick={() => remove(m)} title={t('cs.delete', null, 'Elimina')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, width: 30, height: 30, color: '#ff8095', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="trash" size={13} /></button>
                </div>
              )
            })}
          </div>
        </>)}

        {view === 'create' && (<>
          <button onClick={() => setView('list')} style={{ ...chip, marginBottom: 12, display: 'inline-flex', alignItems: 'center', gap: 5 }}>← {t('cs.back', null, 'Indietro')}</button>
          <div style={lab}>{t('cs.aiName', null, 'Nome del modello')}</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('cs.aiNamePh', null, 'Es: Tee STMN nero, Modella Giulia…')} style={inp} />
          <div style={lab}>{t('cs.aiKind', null, 'Tipo')}</div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{KINDS.map(k => <button key={k.id} onClick={() => setKind(k.id)} style={{ ...chip, ...(kind === k.id ? chipOn : {}) }}>{t('cs.aiKind.' + k.id, null, k.label)}</button>)}</div>
          <div style={lab}>{t('cs.aiTrigger', null, 'Trigger word (opzionale)')}</div>
          <input value={trigger} onChange={e => setTrigger(e.target.value)} placeholder={t('cs.aiTriggerPh', null, 'Es: stmntee — parola unica per richiamare il modello')} style={inp} />
          <div style={lab}>{t('cs.aiImages', null, 'Immagini (3-20)')} · {imgs.length}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: 8 }}>
            {imgs.map((src, i) => (
              <div key={i} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: 9, overflow: 'hidden', border: '1px solid var(--border)' }}>
                <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                <button onClick={() => setImgs(prev => prev.filter((_, j) => j !== i))} style={{ position: 'absolute', top: 2, right: 2, width: 18, height: 18, borderRadius: 9, border: 'none', background: '#000a', color: '#fff', cursor: 'pointer', fontSize: 11 }}>×</button>
              </div>
            ))}
            {imgs.length < 20 && (
              <button onClick={() => fileRef.current?.click()} style={{ aspectRatio: '1/1', borderRadius: 9, border: '1px dashed var(--border)', background: 'var(--glass2,rgba(255,255,255,0.04))', color: 'var(--text2,#9aa)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={18} /></button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={pickFiles} style={{ display: 'none' }} />

          {error && <div style={{ marginTop: 12, background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.35)', color: '#ff8095', borderRadius: 8, padding: '8px 12px', fontSize: 12.5 }}>{error}</div>}
          <div style={{ marginTop: 16, display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ fontSize: 11.5, color: 'var(--text2,#9aa)' }}>{t('cs.aiTrainTime', null, 'Il training richiede qualche minuto.')}</span>
            <div style={{ flex: 1 }} />
            <button onClick={create} disabled={busy || imgs.length < 3 || !name.trim()} style={{ background: busy || imgs.length < 3 || !name.trim() ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '11px 20px', color: '#fff', fontWeight: 800, fontSize: 13.5, cursor: busy || imgs.length < 3 || !name.trim() ? 'default' : 'pointer', fontFamily: 'Barlow' }}>{busy ? t('cs.generating', null, 'Avvio…') : `${t('cs.aiStartTrain', null, 'Avvia training')} · 40 cr`}</button>
          </div>
        </>)}
      </div>
    </div>
  )
}

const lab = { fontSize: 10.5, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.08em', fontWeight: 800, margin: '14px 0 6px' }
const inp = { width: '100%', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px', color: '#fff', fontSize: 13, fontFamily: 'Barlow', boxSizing: 'border-box' }
const chip = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', color: 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const chipOn = { background: 'rgba(123,91,255,0.18)', borderColor: '#7b5bff', color: '#fff' }
