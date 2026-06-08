'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Creative Studio — board generativa chat-driven (Fase 1: immagini).
// Descrivi a chat cosa ti serve → l'AI potenzia il prompt col contesto del
// cliente (brand, prodotti, performance) e genera col modello scelto.
// Crediti acquistabili via Stripe; scalo per modello con rimborso se fallisce.
// Estetica Luma: canvas scuro, media-hero, barra chat fluttuante in basso.

const FORMATS = [
  { id: 'square', label: '1:1' },
  { id: 'vertical', label: '9:16' },
  { id: 'landscape', label: '16:9' },
]

export default function CreativeStudio() {
  const { t } = useI18n()
  const [balance, setBalance] = useState(null)
  const [models, setModels] = useState([])
  const [packs, setPacks] = useState([])
  const [history, setHistory] = useState([])
  const [prompt, setPrompt] = useState('')
  const [model, setModel] = useState('flux-pro')
  const [format, setFormat] = useState('square')
  const [count, setCount] = useState(1)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [items, setItems] = useState([]) // { url, model, modelName, prompt, format }
  const [showRecharge, setShowRecharge] = useState(false)
  const [buying, setBuying] = useState('')
  const taRef = useRef(null)

  const loadCredits = useCallback(async () => {
    try {
      const r = await fetch('/api/credits', { cache: 'no-store' })
      if (!r.ok) return
      const j = await r.json()
      setBalance(j.balance ?? 0)
      setModels(j.models || [])
      setPacks(j.packs || [])
      setHistory(j.history || [])
      if (j.models?.length && !j.models.find(m => m.id === model)) setModel(j.models[0].id)
    } catch {}
  }, [model])

  useEffect(() => { loadCredits() }, [loadCredits])

  // Se torno dal checkout Stripe con successo, ricarico il saldo
  useEffect(() => {
    if (typeof window === 'undefined') return
    const p = new URLSearchParams(window.location.search)
    if (p.get('credits') === 'success') {
      setTimeout(loadCredits, 1500) // dà tempo al webhook
      setTimeout(loadCredits, 5000)
    }
  }, [loadCredits])

  const activeModel = models.find(m => m.id === model)
  const cost = (activeModel?.credits || 2) * count

  const generate = async () => {
    const text = prompt.trim()
    if (!text || busy) return
    setBusy(true); setError('')
    try {
      const r = await fetch('/api/studio/generate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: text, model, format, count }),
      })
      const j = await r.json()
      if (r.status === 402 || j.error === 'insufficient_credits') {
        setBalance(j.balance ?? balance)
        setShowRecharge(true)
        setError(t('cs.insufficient', null, 'Crediti insufficienti per questa generazione.'))
        return
      }
      if (!r.ok || !j.images?.length) {
        setError(j.error || t('cs.genFail', null, 'Generazione fallita.'))
        if (typeof j.balance === 'number') setBalance(j.balance)
        return
      }
      const newItems = j.images.map(img => ({ url: img.url, model: j.model, modelName: j.modelName, prompt: text, format: j.format }))
      setItems(prev => [...newItems, ...prev])
      if (typeof j.balance === 'number') setBalance(j.balance)
      if (j.partial) setError(t('cs.partial', null, 'Alcune immagini non sono state generate (crediti rimborsati).'))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); generate() }
  }

  const regenerate = (it) => { setPrompt(it.prompt); setModel(it.model); setFormat(it.format); setTimeout(generate, 50) }

  const buyPack = async (packId) => {
    setBuying(packId)
    try {
      const r = await fetch('/api/credits/checkout', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId }),
      })
      const j = await r.json()
      if (j.url) window.location.href = j.url
      else { setError(j.error || 'Checkout non disponibile'); setBuying('') }
    } catch (e) { setError(e.message); setBuying('') }
  }

  const aspectFor = (f) => f === 'vertical' ? '9 / 16' : f === 'landscape' ? '16 / 9' : '1 / 1'

  return (
    <div style={{ color: '#fff', fontFamily: 'Barlow', display: 'flex', flexDirection: 'column', minHeight: '70vh' }}>
      {/* Top bar: saldo + ricarica */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 13.5, color: 'var(--text2,#9aa)' }}>{t('cs.subtitle', null, 'Descrivi cosa ti serve: l\'AI conosce brand, prodotti e performance e genera la creatività.')}</div>
        </div>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--glass,#14141d)', border: '1px solid var(--border)', borderRadius: 999, padding: '7px 14px' }}>
          <Icon name="sparkles" size={15} />
          <span style={{ fontWeight: 800, fontSize: 14 }}>{balance == null ? '—' : balance}</span>
          <span style={{ fontSize: 12, color: 'var(--text2,#9aa)' }}>{t('cs.credits', null, 'crediti')}</span>
        </div>
        <button onClick={() => setShowRecharge(true)} style={{ background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 999, padding: '8px 16px', color: '#fff', fontWeight: 800, fontSize: 13, cursor: 'pointer', fontFamily: 'Barlow', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Icon name="plus" size={13} /> {t('cs.recharge', null, 'Ricarica')}
        </button>
      </div>

      {error && (
        <div style={{ background: 'rgba(255,69,58,0.12)', border: '1px solid rgba(255,69,58,0.35)', color: '#ff8095', borderRadius: 10, padding: '10px 14px', fontSize: 13, marginBottom: 14 }}>{error}</div>
      )}

      {/* Galleria (media-hero) */}
      <div style={{ flex: 1 }}>
        {items.length === 0 && !busy && (
          <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text3,#777)' }}>
            <div style={{ fontSize: 40, marginBottom: 12, opacity: 0.5 }}><Icon name="image" size={40} /></div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text2,#9aa)' }}>{t('cs.emptyTitle', null, 'La tua board è vuota')}</div>
            <div style={{ fontSize: 13, marginTop: 4 }}>{t('cs.emptyHint', null, 'Scrivi un\'idea qui sotto e premi Genera.')}</div>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
          {busy && Array.from({ length: count }).map((_, i) => (
            <div key={`sk${i}`} style={{ aspectRatio: aspectFor(format), borderRadius: 14, background: 'linear-gradient(110deg,#1a1a24 8%,#22222e 18%,#1a1a24 33%)', backgroundSize: '200% 100%', animation: 'csShimmer 1.2s linear infinite', border: '1px solid var(--border)' }} />
          ))}
          {items.map((it, i) => (
            <div key={i} className="glass-card-static" style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
              <div style={{ position: 'relative', aspectRatio: aspectFor(it.format), background: '#000' }}>
                <img src={it.url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />
                <span style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)', borderRadius: 6, padding: '3px 8px', fontSize: 10.5, fontWeight: 700 }}>{it.modelName}</span>
              </div>
              <div style={{ display: 'flex', gap: 6, padding: 8 }}>
                <a href={it.url} download target="_blank" rel="noreferrer" style={{ flex: 1, textAlign: 'center', textDecoration: 'none', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 0', color: '#fff', fontSize: 12, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Icon name="download" size={12} /> {t('cs.download', null, 'Scarica')}</a>
                <button onClick={() => regenerate(it)} title={t('cs.regenerate', null, 'Rigenera')} style={{ background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 8, padding: '6px 10px', color: '#fff', cursor: 'pointer' }}><Icon name="refresh" size={13} /></button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Barra chat fluttuante */}
      <div style={{ position: 'sticky', bottom: 0, marginTop: 22, paddingTop: 10 }}>
        <div className="glass-card-static" style={{ border: '1px solid var(--border)', borderRadius: 16, padding: 12, boxShadow: '0 8px 30px rgba(0,0,0,0.35)' }}>
          <textarea
            ref={taRef}
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={onKeyDown}
            rows={2}
            placeholder={t('cs.placeholder', null, 'Es: il nostro best-seller su sfondo minimal, luce da studio, mood premium…')}
            style={{ width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 15, fontFamily: 'Barlow', lineHeight: 1.5 }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 8, flexWrap: 'wrap' }}>
            {/* Modello */}
            <select value={model} onChange={e => setModel(e.target.value)} style={selStyle}>
              {models.map(m => <option key={m.id} value={m.id}>{m.name} · {m.credits} cr</option>)}
            </select>
            {/* Formato */}
            <div style={{ display: 'inline-flex', gap: 4 }}>
              {FORMATS.map(f => (
                <button key={f.id} onClick={() => setFormat(f.id)} style={{ ...chip, ...(format === f.id ? chipOn : {}) }}>{f.label}</button>
              ))}
            </div>
            {/* Quantità */}
            <select value={count} onChange={e => setCount(parseInt(e.target.value))} style={selStyle}>
              {[1, 2, 3, 4].map(n => <option key={n} value={n}>{n}×</option>)}
            </select>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 12, color: 'var(--text2,#9aa)' }}>{t('cs.cost', { n: cost }, `${cost} crediti`)}</span>
            <button onClick={generate} disabled={busy || !prompt.trim()} style={{ background: busy || !prompt.trim() ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', border: 'none', borderRadius: 10, padding: '10px 20px', color: '#fff', fontWeight: 800, fontSize: 14, cursor: busy || !prompt.trim() ? 'default' : 'pointer', fontFamily: 'Barlow', display: 'inline-flex', alignItems: 'center', gap: 7 }}>
              <Icon name="sparkles" size={14} /> {busy ? t('cs.generating', null, 'Genero…') : t('cs.generate', null, 'Genera')}
            </button>
          </div>
        </div>
      </div>

      {/* Modale ricarica */}
      {showRecharge && (
        <div onClick={() => setShowRecharge(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.72)', zIndex: 2000, display: 'grid', placeItems: 'center', padding: 20 }}>
          <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ padding: 22, borderRadius: 16, width: 520, maxWidth: '95vw' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: 6 }}>
              <div style={{ fontSize: 18, fontWeight: 800, flex: 1 }}>{t('cs.rechargeTitle', null, 'Ricarica crediti')}</div>
              <button onClick={() => setShowRecharge(false)} style={{ width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 16 }}>×</button>
            </div>
            <div style={{ fontSize: 13, color: 'var(--text2,#9aa)', marginBottom: 16 }}>{t('cs.rechargeHint', null, 'I crediti non scadono. Pagamento sicuro via Stripe.')}</div>
            <div style={{ display: 'grid', gap: 10 }}>
              {packs.map(p => (
                <button key={p.id} onClick={() => buyPack(p.id)} disabled={!!buying} style={{ display: 'flex', alignItems: 'center', gap: 12, textAlign: 'left', padding: '14px 16px', borderRadius: 12, border: p.best ? '1.5px solid #7b5bff' : '1px solid var(--border)', background: p.best ? 'rgba(123,91,255,0.10)' : 'var(--glass2,rgba(255,255,255,0.04))', color: '#fff', cursor: buying ? 'wait' : 'pointer', fontFamily: 'Barlow' }}>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 16, fontWeight: 800 }}>{p.credits} {t('cs.credits', null, 'crediti')} {p.best && <span style={{ fontSize: 10.5, color: '#7b5bff', fontWeight: 800, marginLeft: 6 }}>{t('cs.bestValue', null, 'MIGLIOR PREZZO')}</span>}</div>
                    <div style={{ fontSize: 12, color: 'var(--text2,#9aa)' }}>≈ {Math.floor(p.credits / 2)} {t('cs.images', null, 'immagini')}</div>
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800 }}>{buying === p.id ? '…' : p.priceLabel}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <style jsx>{`@keyframes csShimmer { to { background-position: -200% 0 } }`}</style>
    </div>
  )
}

const selStyle = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 10px', color: '#fff', fontSize: 12.5, fontFamily: 'Barlow', cursor: 'pointer' }
const chip = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 11px', color: 'var(--text2,#9aa)', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const chipOn = { background: 'rgba(123,91,255,0.18)', borderColor: '#7b5bff', color: '#fff' }
