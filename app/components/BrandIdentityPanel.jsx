'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import AgentMemoryInspector from './AgentMemoryInspector'

// ─────────────────────────────────────────────────────────────
//  BrandIdentityPanel — sezione di SettingsTab.
//  5 blocchi collassabili: Identita', Prodotti&Mercato, Tone of voice,
//  Visual Identity, Competitor. I dati vivono in companies.brand_identity
//  (JSONB) e companies.brand_assets (JSONB array).
//
//  Save: button "Salva modifiche" persistente in basso → POST /api/brand-identity.
//  Upload assets: subito su /api/brand-identity/upload (multipart).
// ─────────────────────────────────────────────────────────────

const ACCENT = '#bf5af2'

const CATEGORIES = [
  'Fitness', 'Beauty', 'Fashion', 'Home & Living', 'Food & Beverage',
  'Tech & Gadgets', 'Health & Wellness', 'Pet', 'Kids & Baby', 'Travel', 'Other'
]

const TONE_TAGS = [
  'Professionale', 'Casual', 'Energico', 'Aspirazionale', 'Diretto',
  'Ironico', 'Empatico', 'Tecnico', 'Educativo', 'Provocatorio',
  'Premium', 'Accessibile', 'Sportivo', 'Lifestyle', 'Storytelling'
]

const DEFAULT_IDENTITY = {
  // Section 1: Identita'
  tagline: '', description: '', mission: '', founded: '', website: '',
  // Section 2: Prodotti & Mercato
  category: '', subcategories: [], products: [], notSelling: '',
  targetAudience: '', markets: [], languages: [],
  // Section 3: Tone of voice
  toneTags: [], languageStyle: '', brandWords: [], forbiddenWords: [],
  copyExamples: [], brandPersona: '',
  // Section 4: Visual identity
  colors: [], primaryFont: '', secondaryFont: '',
  photoStyle: '', adStyle: '',
  // Section 5: Competitor
  competitors: [],
}

export default function BrandIdentityPanel() {
  const [identity, setIdentity] = useState(DEFAULT_IDENTITY)
  const [assets, setAssets] = useState([])
  const [companyName, setCompanyName] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [savedAt, setSavedAt] = useState(null)
  const [open, setOpen] = useState({ identity: true, products: false, tone: false, visual: false, competitor: false })

  // Mount: carica dati
  useEffect(() => {
    fetch('/api/brand-identity')
      .then(r => r.json())
      .then(j => {
        if (j?.error) { setError(j.error); return }
        setCompanyName(j.companyName || '')
        setIdentity({ ...DEFAULT_IDENTITY, ...(j.identity || {}) })
        setAssets(Array.isArray(j.assets) ? j.assets : [])
      })
      .catch(e => setError(e?.message))
      .finally(() => setLoading(false))
  }, [])

  const setField = useCallback((key, value) => {
    setIdentity(prev => ({ ...prev, [key]: value }))
  }, [])

  const toggleArrayValue = useCallback((key, value) => {
    setIdentity(prev => {
      const arr = Array.isArray(prev[key]) ? prev[key] : []
      const next = arr.includes(value) ? arr.filter(v => v !== value) : [...arr, value]
      return { ...prev, [key]: next }
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/brand-identity', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identity }),
      })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      setSavedAt(new Date())
    } catch (e) {
      setError(e?.message || 'Errore salvataggio')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <GlassCard>
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '40px 0' }}>Caricamento brand identity…</div>
      </GlassCard>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <GlassCard>
        <SectionHeader
          icon="◉"
          eyebrow="Brand Identity"
          title={companyName ? `Identita' brand di ${companyName}` : 'Identita\' brand'}
          subtitle="Questi dati alimentano gli AI agent (KPI, CRO, Creative) e il Creative Lab. Piu' dettagli inserisci, piu' i suggerimenti AI saranno verticali sul tuo brand."
        />
      </GlassCard>

      <SectionBlock
        open={open.identity}
        onToggle={() => setOpen(o => ({ ...o, identity: !o.identity }))}
        icon="①"
        title="Identita' & posizionamento"
        subtitle="Chi sei e cosa rappresenti"
      >
        <FieldRow>
          <Field label="Tagline / claim breve" hint="2-7 parole max">
            <Input value={identity.tagline} onChange={v => setField('tagline', v)} placeholder="Es: Strumenti per atleti veri" />
          </Field>
          <Field label="Anno fondazione">
            <Input value={identity.founded} onChange={v => setField('founded', v)} placeholder="2020" maxLength={4} />
          </Field>
        </FieldRow>
        <Field label="Descrizione brand" hint="2-3 frasi: chi sei, cosa fai, per chi">
          <Textarea value={identity.description} onChange={v => setField('description', v)} rows={3} placeholder="Es: Stamina Fitness produce accessori CrossFit di alta qualita' per atleti che..." />
        </Field>
        <Field label="Mission statement" hint="La promessa che fai al cliente">
          <Textarea value={identity.mission} onChange={v => setField('mission', v)} rows={2} placeholder="Es: Aiutare gli atleti a performare al massimo con strumenti durevoli e progettati per il box" />
        </Field>
        <Field label="Sito web ufficiale">
          <Input value={identity.website} onChange={v => setField('website', v)} placeholder="https://staminafitness.it" />
        </Field>
      </SectionBlock>

      <SectionBlock
        open={open.products}
        onToggle={() => setOpen(o => ({ ...o, products: !o.products }))}
        icon="②"
        title="Prodotti & mercato"
        subtitle="Cosa vendi, a chi, dove"
      >
        <FieldRow>
          <Field label="Categoria principale">
            <Select value={identity.category} onChange={v => setField('category', v)} options={CATEGORIES} />
          </Field>
          <Field label="Sotto-categorie / tag" hint="Es: CrossFit, Accessori, Functional">
            <TagInput tags={identity.subcategories} onChange={v => setField('subcategories', v)} placeholder="Aggiungi tag + Invio" />
          </Field>
        </FieldRow>
        <Field label="Prodotti principali" hint="Uno per riga">
          <Textarea value={(identity.products || []).join('\n')} onChange={v => setField('products', v.split('\n').map(s => s.trim()).filter(Boolean))} rows={4} placeholder="Paracalli (Tape adesivo)\nCorde da salto\nCinturoni" />
        </Field>
        <Field label="Cosa NON vendi / brand guard" hint="Questi prodotti/contenuti NON sono consentiti negli AI agent (es: 'mai integratori', 'no nutrizione')">
          <Textarea value={identity.notSelling} onChange={v => setField('notSelling', v)} rows={2} placeholder="Es: mai supplementi/integratori/nutrizione" />
        </Field>
        <Field label="Target audience" hint="Descrizione cliente ideale: eta', genere, livello, dolori, desideri">
          <Textarea value={identity.targetAudience} onChange={v => setField('targetAudience', v)} rows={3} placeholder="Es: Atleti CrossFit 25-45 anni, intermedio/avanzato, frequentatori di box, alla ricerca di durabilita' e performance" />
        </Field>
        <FieldRow>
          <Field label="Mercati principali" hint="Country codes (IT, EU, US, ...)">
            <TagInput tags={identity.markets} onChange={v => setField('markets', v)} placeholder="Es: IT, EU, US" />
          </Field>
          <Field label="Lingue supportate" hint="Codici lingua (it, en, es, ...)">
            <TagInput tags={identity.languages} onChange={v => setField('languages', v)} placeholder="Es: it, en" />
          </Field>
        </FieldRow>
      </SectionBlock>

      <SectionBlock
        open={open.tone}
        onToggle={() => setOpen(o => ({ ...o, tone: !o.tone }))}
        icon="③"
        title="Tone of voice & stile"
        subtitle="Come parla il brand"
      >
        <Field label="Tono (multi-select)" hint="I 3-5 aggettivi che descrivono la tua voce">
          <ToneChips selected={identity.toneTags || []} onToggle={v => toggleArrayValue('toneTags', v)} />
        </Field>
        <Field label="Linguaggio">
          <Select value={identity.languageStyle} onChange={v => setField('languageStyle', v)} options={['Formale', 'Informale', 'Misto formale/informale', 'Tecnico/Specialistico', 'Pop & accessibile']} />
        </Field>
        <FieldRow>
          <Field label="Parole brand" hint="Lessico ricorrente">
            <TagInput tags={identity.brandWords} onChange={v => setField('brandWords', v)} placeholder="performance, durabilita', box" />
          </Field>
          <Field label="Parole vietate" hint="Mai usare">
            <TagInput tags={identity.forbiddenWords} onChange={v => setField('forbiddenWords', v)} placeholder="cheap, basic" />
          </Field>
        </FieldRow>
        <Field label="Esempi di copy che ti piacciono" hint="3-5 esempi (uno per riga)">
          <Textarea value={(identity.copyExamples || []).join('\n')} onChange={v => setField('copyExamples', v.split('\n').map(s => s.trim()).filter(Boolean))} rows={4} placeholder="Es: 'Costruiti per chi non molla mai'" />
        </Field>
        <Field label="Brand persona" hint="Se il brand fosse una persona, chi sarebbe?">
          <Textarea value={identity.brandPersona} onChange={v => setField('brandPersona', v)} rows={3} placeholder="Es: Coach pragmatico, ex-atleta, parla schietto e tecnico, niente fronzoli" />
        </Field>
      </SectionBlock>

      <SectionBlock
        open={open.visual}
        onToggle={() => setOpen(o => ({ ...o, visual: !o.visual }))}
        icon="④"
        title="Visual Identity"
        subtitle="Aspetto del brand (per Creative Lab + ads)"
      >
        <FieldRow>
          <Field label="Font primario">
            <Input value={identity.primaryFont} onChange={v => setField('primaryFont', v)} placeholder="Es: Inter" />
          </Field>
          <Field label="Font secondario">
            <Input value={identity.secondaryFont} onChange={v => setField('secondaryFont', v)} placeholder="Es: Bebas Neue" />
          </Field>
        </FieldRow>
        <Field label="Palette colori" hint="Hex code, max 6">
          <ColorPicker colors={identity.colors || []} onChange={v => setField('colors', v)} />
        </Field>
        <Field label="Stile fotografico" hint="Descrivi come devono apparire le foto">
          <Textarea value={identity.photoStyle} onChange={v => setField('photoStyle', v)} rows={3} placeholder="Es: Lifestyle outdoor, alto contrasto, persone reali, no models, no studio" />
        </Field>
        <Field label="Stile creative ads" hint="Tipologia di creativita' che converte per il tuo brand">
          <Textarea value={identity.adStyle} onChange={v => setField('adStyle', v)} rows={3} placeholder="Es: UGC raw, dimostrazione prodotto in uso, prima/dopo, framing dinamico" />
        </Field>

        <AssetsManager assets={assets} onChange={setAssets} />
      </SectionBlock>

      <SectionBlock
        open={open.competitor}
        onToggle={() => setOpen(o => ({ ...o, competitor: !o.competitor }))}
        icon="⑤"
        title="Competitor"
        subtitle="Brand che monitoriamo nella tab Competitor Intel"
      >
        <CompetitorList
          competitors={identity.competitors || []}
          onChange={v => setField('competitors', v)}
        />
      </SectionBlock>

      {/* Memorie degli agent — separato dal form principale (read+modify, no save) */}
      <AgentMemoryInspector />

      {/* Save bar */}
      <div style={{
        position: 'sticky', bottom: 16, zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        background: 'rgba(10,10,22,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(255,255,255,0.08)', borderTopColor: 'rgba(255,255,255,0.14)',
        borderRadius: 16, padding: '14px 18px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {error
            ? <span style={{ color: '#f87171' }}>⚠ {error}</span>
            : savedAt
              ? <span style={{ color: '#86efac' }}>✓ Salvato — {savedAt.toLocaleTimeString()}</span>
              : 'Le modifiche non vengono salvate finche\' non clicchi "Salva".'}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer',
            background: `linear-gradient(135deg, ${ACCENT}, #2997ff)`,
            color: '#fff', fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? 'Salvataggio…' : 'Salva modifiche'}
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────

function GlassCard({ children, padding = 22 }) {
  return (
    <div className="glass-card-static" style={{ padding }}>
      {children}
    </div>
  )
}

function SectionHeader({ icon, eyebrow, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{
        width: 42, height: 42, borderRadius: 12,
        background: `${ACCENT}20`, color: ACCENT,
        display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        flexShrink: 0,
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: '#fff', letterSpacing: '-0.02em', marginTop: 4 }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function SectionBlock({ icon, title, subtitle, open, onToggle, children }) {
  return (
    <div className="glass-card-static" style={{ overflow: 'hidden' }}>
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 22, textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <span style={{
          width: 38, height: 38, borderRadius: 11,
          background: `${ACCENT}1a`, color: ACCENT,
          display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800,
          flexShrink: 0,
        }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: '#fff', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{subtitle}</div>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 18, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .25s' }}>›</span>
      </button>
      {open && (
        <div style={{
          padding: '4px 22px 22px',
          borderTop: '1px solid rgba(255,255,255,0.04)',
          display: 'flex', flexDirection: 'column', gap: 14,
        }}>
          {children}
        </div>
      )}
    </div>
  )
}

function FieldRow({ children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
      {children}
    </div>
  )
}

function Field({ label, hint, children }) {
  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 6, letterSpacing: '0.02em' }}>
        {label}
        {hint && <span style={{ color: 'var(--text4, #555)', fontWeight: 500, marginLeft: 8 }}>· {hint}</span>}
      </div>
      {children}
    </div>
  )
}

const inputBase = {
  width: '100%', padding: '10px 12px', borderRadius: 10,
  background: 'rgba(255,255,255,0.04)',
  border: '1px solid rgba(255,255,255,0.08)',
  color: '#fff', fontSize: 13, fontFamily: 'inherit',
  outline: 'none', transition: 'border-color .15s',
}

function Input({ value, onChange, placeholder, maxLength }) {
  return (
    <input
      type="text"
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={maxLength}
      style={inputBase}
      onFocus={e => e.currentTarget.style.borderColor = ACCENT}
      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
    />
  )
}

function Textarea({ value, onChange, placeholder, rows = 3 }) {
  return (
    <textarea
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      placeholder={placeholder}
      rows={rows}
      style={{ ...inputBase, resize: 'vertical', minHeight: 60, lineHeight: 1.5 }}
      onFocus={e => e.currentTarget.style.borderColor = ACCENT}
      onBlur={e => e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'}
    />
  )
}

function Select({ value, onChange, options }) {
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, cursor: 'pointer' }}
    >
      <option value="">— Seleziona —</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
    </select>
  )
}

function TagInput({ tags = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('')
  const addTag = () => {
    const v = draft.trim()
    if (!v || tags.includes(v)) { setDraft(''); return }
    onChange([...tags, v])
    setDraft('')
  }
  const removeTag = t => onChange(tags.filter(x => x !== t))

  return (
    <div style={{
      ...inputBase, display: 'flex', flexWrap: 'wrap', gap: 6, padding: '8px 10px',
      minHeight: 40, alignItems: 'center',
    }}>
      {tags.map(t => (
        <span key={t} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '4px 10px', borderRadius: 999,
          background: `${ACCENT}1f`, border: `1px solid ${ACCENT}55`,
          fontSize: 11.5, color: '#fff', fontWeight: 600,
        }}>
          {t}
          <button type="button" onClick={() => removeTag(t)} style={{
            background: 'transparent', border: 'none', color: ACCENT, cursor: 'pointer',
            fontSize: 12, padding: 0, lineHeight: 1,
          }}>×</button>
        </span>
      ))}
      <input
        type="text" value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() }
          else if (e.key === 'Backspace' && !draft && tags.length) removeTag(tags[tags.length - 1])
        }}
        placeholder={placeholder}
        style={{
          flex: 1, minWidth: 100, background: 'transparent', border: 'none',
          color: '#fff', fontSize: 13, outline: 'none', padding: '4px 0',
        }}
      />
    </div>
  )
}

function ToneChips({ selected, onToggle }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {TONE_TAGS.map(tag => {
        const isSelected = selected.includes(tag)
        return (
          <button
            type="button" key={tag}
            onClick={() => onToggle(tag)}
            style={{
              padding: '8px 14px', borderRadius: 999, cursor: 'pointer',
              background: isSelected ? `${ACCENT}33` : 'rgba(255,255,255,0.04)',
              border: `1px solid ${isSelected ? ACCENT : 'rgba(255,255,255,0.10)'}`,
              color: isSelected ? '#fff' : 'var(--text3)',
              fontSize: 12, fontWeight: 600, transition: 'all .15s',
            }}
          >{tag}</button>
        )
      })}
    </div>
  )
}

function ColorPicker({ colors = [], onChange }) {
  const [draft, setDraft] = useState('#000000')
  const addColor = () => {
    if (!/^#[0-9a-fA-F]{6}$/.test(draft)) return
    if (colors.includes(draft.toLowerCase())) return
    if (colors.length >= 6) return
    onChange([...colors, draft.toLowerCase()])
  }
  const removeColor = c => onChange(colors.filter(x => x !== c))

  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      {colors.map(c => (
        <div key={c} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.10)', borderRadius: 10,
          padding: '6px 10px',
        }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: c, border: '1px solid rgba(255,255,255,0.15)' }} />
          <span style={{ fontSize: 12, color: '#fff', fontFamily: 'monospace' }}>{c}</span>
          <button type="button" onClick={() => removeColor(c)} style={{
            background: 'transparent', border: 'none', color: ACCENT, cursor: 'pointer',
            fontSize: 14, padding: 0,
          }}>×</button>
        </div>
      ))}
      {colors.length < 6 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <input
            type="color" value={draft} onChange={e => setDraft(e.target.value)}
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid rgba(255,255,255,0.10)', background: 'transparent', cursor: 'pointer' }}
          />
          <button type="button" onClick={addColor} style={{
            padding: '8px 12px', borderRadius: 10, background: `${ACCENT}33`,
            border: `1px solid ${ACCENT}`, color: '#fff', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}>+ Aggiungi</button>
        </div>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Assets manager (upload + lista + delete)
// ─────────────────────────────────────────────────────────────

const ASSET_TYPES = [
  { id: 'logo_png', label: 'Logo PNG', accept: 'image/png' },
  { id: 'logo_svg', label: 'Logo SVG', accept: 'image/svg+xml' },
  { id: 'photo_ref', label: 'Foto reference', accept: 'image/*' },
  { id: 'mood_board', label: 'Mood board', accept: 'image/*' },
]

function AssetsManager({ assets, onChange }) {
  const [uploadingType, setUploadingType] = useState(null)
  const [error, setError] = useState(null)
  const inputRefs = useRef({})

  const uploadFile = async (file, type) => {
    setUploadingType(type)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('type', type)
      const res = await fetch('/api/brand-identity/upload', { method: 'POST', body: fd })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      onChange(j.assets || [])
    } catch (e) {
      setError(e?.message || 'Upload fallito')
    } finally {
      setUploadingType(null)
    }
  }

  const deleteAsset = async (path) => {
    if (!confirm('Eliminare questo file?')) return
    try {
      const res = await fetch(`/api/brand-identity/upload?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      onChange(j.assets || [])
    } catch (e) {
      setError(e?.message || 'Eliminazione fallita')
    }
  }

  const assetsByType = {}
  for (const a of assets) {
    if (!assetsByType[a.type]) assetsByType[a.type] = []
    assetsByType[a.type].push(a)
  }

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, marginBottom: 10, letterSpacing: '0.02em' }}>
        Asset upload <span style={{ color: 'var(--text4, #555)', fontWeight: 500, marginLeft: 8 }}>· Max 10MB/file</span>
      </div>

      {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}>⚠ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {ASSET_TYPES.map(at => {
          const list = assetsByType[at.id] || []
          const isUploading = uploadingType === at.id
          return (
            <div key={at.id} className="glass-panel" style={{ borderRadius: 14, padding: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{at.label}</span>
                <button
                  type="button"
                  onClick={() => inputRefs.current[at.id]?.click()}
                  disabled={isUploading}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: `${ACCENT}33`, border: `1px solid ${ACCENT}66`,
                    color: '#fff', cursor: isUploading ? 'wait' : 'pointer',
                  }}
                >
                  {isUploading ? '…' : '+ Carica'}
                </button>
                <input
                  ref={el => { inputRefs.current[at.id] = el }}
                  type="file" accept={at.accept}
                  style={{ display: 'none' }}
                  onChange={e => {
                    const f = e.target.files?.[0]
                    if (f) uploadFile(f, at.id)
                    e.target.value = ''
                  }}
                />
              </div>

              {list.length === 0 ? (
                <div style={{ fontSize: 11, color: 'var(--text4, #555)', textAlign: 'center', padding: '12px 0' }}>
                  Nessun file
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map(a => (
                    <div key={a.path} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(255,255,255,0.08)',
                      borderRadius: 10, padding: 8,
                    }}>
                      <img src={a.url} alt={a.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, background: '#000' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: '#fff', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
                        <div style={{ fontSize: 10, color: 'var(--text4, #555)' }}>{(a.size / 1024).toFixed(1)} KB</div>
                      </div>
                      <a href={a.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11, color: ACCENT, textDecoration: 'none' }}>↗</a>
                      <button type="button" onClick={() => deleteAsset(a.path)} style={{
                        background: 'transparent', border: 'none', color: '#f87171',
                        cursor: 'pointer', fontSize: 13, padding: 0,
                      }}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
// Competitor list (name, IG, FB, website)
// ─────────────────────────────────────────────────────────────

function CompetitorList({ competitors, onChange }) {
  const addCompetitor = () => {
    onChange([...competitors, { name: '', website: '', instagram: '', facebook: '', pageId: '' }])
  }
  const updateAt = (idx, patch) => {
    onChange(competitors.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }
  const removeAt = (idx) => {
    if (!confirm('Eliminare questo competitor?')) return
    onChange(competitors.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: -4 }}>
        Aggiungi competitor con nome brand, sito ufficiale e link ai loro profili Instagram/Facebook.
        Verranno usati automaticamente dalla tab Competitor Intel per scrape ads e prodotti.
      </div>

      {competitors.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text4, #555)', textAlign: 'center', padding: '20px 0' }}>
          Nessun competitor configurato
        </div>
      )}

      {competitors.map((c, idx) => (
        <div key={idx} className="glass-panel" style={{
          borderRadius: 14, padding: 14,
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>#{idx + 1}</span>
            <input
              type="text" value={c.name || ''}
              onChange={e => updateAt(idx, { name: e.target.value })}
              placeholder="Nome brand (es: Velites)"
              style={{ ...inputBase, flex: 1, fontWeight: 700 }}
            />
            <button type="button" onClick={() => removeAt(idx)} style={{
              background: 'transparent', border: '1px solid rgba(248,113,113,0.4)',
              color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              borderRadius: 8, padding: '6px 10px',
            }}>Rimuovi</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            <input
              type="text" value={c.website || ''}
              onChange={e => updateAt(idx, { website: e.target.value })}
              placeholder="https://example.com"
              style={inputBase}
            />
            <input
              type="text" value={c.instagram || ''}
              onChange={e => updateAt(idx, { instagram: e.target.value })}
              placeholder="@username o URL Instagram"
              style={inputBase}
            />
            <input
              type="text" value={c.facebook || ''}
              onChange={e => updateAt(idx, { facebook: e.target.value })}
              placeholder="URL pagina Facebook"
              style={inputBase}
            />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text4, #666)', marginBottom: 4 }}>
              ID pagina Facebook (per fetch automatico ads — opzionale)
            </div>
            <input
              type="text" value={c.pageId || ''}
              onChange={e => updateAt(idx, { pageId: e.target.value })}
              placeholder="Es: 234280280078173 (lascia vuoto se non lo conosci)"
              style={{ ...inputBase, fontFamily: 'monospace', fontSize: 12 }}
            />
          </div>
        </div>
      ))}

      <button
        type="button"
        onClick={addCompetitor}
        style={{
          padding: '12px 16px', borderRadius: 12, cursor: 'pointer',
          background: `${ACCENT}22`, border: `1px dashed ${ACCENT}66`,
          color: '#fff', fontSize: 13, fontWeight: 700,
        }}
      >
        + Aggiungi competitor
      </button>
    </div>
  )
}
