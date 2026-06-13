'use client'

import { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from 'react'
import Icon from './ui/Icon'
import AgentMemoryInspector from './AgentMemoryInspector'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Mappe per tradurre valori canonici (memorizzati in IT) → chiave i18n.
const TONE_KEYS = {
  'Professionale': 'bi.tone.professionale', 'Casual': 'bi.tone.casual', 'Energico': 'bi.tone.energico',
  'Aspirazionale': 'bi.tone.aspirazionale', 'Diretto': 'bi.tone.diretto', 'Ironico': 'bi.tone.ironico',
  'Empatico': 'bi.tone.empatico', 'Tecnico': 'bi.tone.tecnico', 'Educativo': 'bi.tone.educativo',
  'Provocatorio': 'bi.tone.provocatorio', 'Premium': 'bi.tone.premium', 'Accessibile': 'bi.tone.accessibile',
  'Sportivo': 'bi.tone.sportivo', 'Lifestyle': 'bi.tone.lifestyle', 'Storytelling': 'bi.tone.storytelling',
}
const LANG_KEYS = {
  'Formale': 'bi.lang.formale', 'Informale': 'bi.lang.informale', 'Misto formale/informale': 'bi.lang.misto',
  'Tecnico/Specialistico': 'bi.lang.tecnico', 'Pop & accessibile': 'bi.lang.pop',
}
const ASSET_LABEL_KEYS = { logo_png: 'bi.logoPng', logo_svg: 'bi.logoSvg', photo_ref: 'bi.photoRef', mood_board: 'bi.moodBoard' }

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

// embedded: usato dentro l'onboarding → nasconde la save bar interna e le
// memorie agent; il salvataggio è guidato dal bottone "Salva e continua"
// dell'onboarding via ref.save(). onSaved: callback dopo salvataggio riuscito.
const BrandIdentityPanel = forwardRef(function BrandIdentityPanel({ embedded = false, onSaved } = {}, ref) {
  const { t } = useI18n()
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
      if (onSaved) onSaved(identity)
      return true
    } catch (e) {
      setError(e?.message || t('bi.saveError', null, 'Errore salvataggio'))
      return false
    } finally {
      setSaving(false)
    }
  }

  // Espone save() all'onboarding (il suo bottone "Salva e continua" lo richiama).
  useImperativeHandle(ref, () => ({ save }))

  if (loading) {
    return (
      <GlassCard>
        <div style={{ color: 'var(--text3)', textAlign: 'center', padding: '40px 0' }}>{t('bi.loading', null, 'Caricamento brand identity…')}</div>
      </GlassCard>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      <GlassCard>
        <SectionHeader
          icon="◉"
          eyebrow="Brand Identity"
          title={companyName ? t('bi.titleWith', { name: companyName }, `Identita' brand di ${companyName}`) : t('bi.titleDefault', null, "Identita' brand")}
          subtitle={t('bi.headerSub', null, "Questi dati alimentano gli AI agent (KPI, CRO, Creative) e il Creative Lab. Piu' dettagli inserisci, piu' i suggerimenti AI saranno verticali sul tuo brand.")}
        />
      </GlassCard>

      <SectionBlock
        open={open.identity}
        onToggle={() => setOpen(o => ({ ...o, identity: !o.identity }))}
        icon="①"
        title={t('bi.s1Title', null, "Identita' & posizionamento")}
        subtitle={t('bi.s1Sub', null, 'Chi sei e cosa rappresenti')}
      >
        <FieldRow>
          <Field label={t('bi.taglineLabel', null, 'Tagline / claim breve')} hint={t('bi.taglineHint', null, '2-7 parole max')}>
            <Input value={identity.tagline} onChange={v => setField('tagline', v)} placeholder={t('bi.taglinePh', null, 'Es: Strumenti per atleti veri')} />
          </Field>
          <Field label={t('bi.foundedLabel', null, 'Anno fondazione')}>
            <Input value={identity.founded} onChange={v => setField('founded', v)} placeholder="2020" maxLength={4} />
          </Field>
        </FieldRow>
        <Field label={t('bi.descLabel', null, 'Descrizione brand')} hint={t('bi.descHint', null, '2-3 frasi: chi sei, cosa fai, per chi')}>
          <Textarea value={identity.description} onChange={v => setField('description', v)} rows={3} placeholder={t('bi.descPh', null, "Es: Stamina Fitness produce accessori CrossFit di alta qualita' per atleti che...")} />
        </Field>
        <Field label={t('bi.missionLabel', null, 'Mission statement')} hint={t('bi.missionHint', null, 'La promessa che fai al cliente')}>
          <Textarea value={identity.mission} onChange={v => setField('mission', v)} rows={2} placeholder={t('bi.missionPh', null, 'Es: Aiutare gli atleti a performare al massimo con strumenti durevoli e progettati per il box')} />
        </Field>
        <Field label={t('bi.websiteLabel', null, 'Sito web ufficiale')}>
          <Input value={identity.website} onChange={v => setField('website', v)} placeholder="https://staminafitness.it" />
        </Field>
      </SectionBlock>

      <SectionBlock
        open={open.products}
        onToggle={() => setOpen(o => ({ ...o, products: !o.products }))}
        icon="②"
        title={t('bi.s2Title', null, 'Prodotti & mercato')}
        subtitle={t('bi.s2Sub', null, 'Cosa vendi, a chi, dove')}
      >
        <FieldRow>
          <Field label={t('bi.categoryLabel', null, 'Categoria principale')}>
            <Select value={identity.category} onChange={v => setField('category', v)} options={CATEGORIES} />
          </Field>
          <Field label={t('bi.subcatLabel', null, 'Sotto-categorie / tag')} hint={t('bi.subcatHint', null, 'Es: CrossFit, Accessori, Functional')}>
            <TagInput tags={identity.subcategories} onChange={v => setField('subcategories', v)} placeholder={t('bi.subcatPh', null, 'Aggiungi tag + Invio')} />
          </Field>
        </FieldRow>
        <Field label={t('bi.productsLabel', null, 'Prodotti principali')} hint={t('bi.productsHint', null, 'Uno per riga')}>
          <Textarea value={(identity.products || []).join('\n')} onChange={v => setField('products', v.split('\n').map(s => s.trim()).filter(Boolean))} rows={4} placeholder="Paracalli (Tape adesivo)\nCorde da salto\nCinturoni" />
        </Field>
        <Field label={t('bi.notSellingLabel', null, 'Cosa NON vendi / brand guard')} hint={t('bi.notSellingHint', null, "Questi prodotti/contenuti NON sono consentiti negli AI agent (es: 'mai integratori', 'no nutrizione')")}>
          <Textarea value={identity.notSelling} onChange={v => setField('notSelling', v)} rows={2} placeholder={t('bi.notSellingPh', null, 'Es: mai supplementi/integratori/nutrizione')} />
        </Field>
        <Field label={t('bi.audienceLabel', null, 'Target audience')} hint={t('bi.audienceHint', null, "Descrizione cliente ideale: eta', genere, livello, dolori, desideri")}>
          <Textarea value={identity.targetAudience} onChange={v => setField('targetAudience', v)} rows={3} placeholder={t('bi.audiencePh', null, "Es: Atleti CrossFit 25-45 anni, intermedio/avanzato, frequentatori di box, alla ricerca di durabilita' e performance")} />
        </Field>
        <FieldRow>
          <Field label={t('bi.marketsLabel', null, 'Mercati principali')} hint={t('bi.marketsHint', null, 'Country codes (IT, EU, US, ...)')}>
            <TagInput tags={identity.markets} onChange={v => setField('markets', v)} placeholder={t('bi.marketsPh', null, 'Es: IT, EU, US')} />
          </Field>
          <Field label={t('bi.langsLabel', null, 'Lingue supportate')} hint={t('bi.langsHint', null, 'Codici lingua (it, en, es, ...)')}>
            <TagInput tags={identity.languages} onChange={v => setField('languages', v)} placeholder={t('bi.langsPh', null, 'Es: it, en')} />
          </Field>
        </FieldRow>
      </SectionBlock>

      <SectionBlock
        open={open.tone}
        onToggle={() => setOpen(o => ({ ...o, tone: !o.tone }))}
        icon="③"
        title={t('bi.s3Title', null, 'Tone of voice & stile')}
        subtitle={t('bi.s3Sub', null, 'Come parla il brand')}
      >
        <Field label={t('bi.toneLabel', null, 'Tono (multi-select)')} hint={t('bi.toneHint', null, 'I 3-5 aggettivi che descrivono la tua voce')}>
          <ToneChips selected={identity.toneTags || []} onToggle={v => toggleArrayValue('toneTags', v)} />
        </Field>
        <Field label={t('bi.languageLabel', null, 'Linguaggio')}>
          <Select value={identity.languageStyle} onChange={v => setField('languageStyle', v)} options={['Formale', 'Informale', 'Misto formale/informale', 'Tecnico/Specialistico', 'Pop & accessibile']} labelKeys={LANG_KEYS} />
        </Field>
        <FieldRow>
          <Field label={t('bi.brandWordsLabel', null, 'Parole brand')} hint={t('bi.brandWordsHint', null, 'Lessico ricorrente')}>
            <TagInput tags={identity.brandWords} onChange={v => setField('brandWords', v)} placeholder={t('bi.brandWordsPh', null, "performance, durabilita', box")} />
          </Field>
          <Field label={t('bi.forbiddenLabel', null, 'Parole vietate')} hint={t('bi.forbiddenHint', null, 'Mai usare')}>
            <TagInput tags={identity.forbiddenWords} onChange={v => setField('forbiddenWords', v)} placeholder={t('bi.forbiddenPh', null, 'cheap, basic')} />
          </Field>
        </FieldRow>
        <Field label={t('bi.copyLabel', null, 'Esempi di copy che ti piacciono')} hint={t('bi.copyHint', null, '3-5 esempi (uno per riga)')}>
          <Textarea value={(identity.copyExamples || []).join('\n')} onChange={v => setField('copyExamples', v.split('\n').map(s => s.trim()).filter(Boolean))} rows={4} placeholder={t('bi.copyPh', null, "Es: 'Costruiti per chi non molla mai'")} />
        </Field>
        <Field label={t('bi.personaLabel', null, 'Brand persona')} hint={t('bi.personaHint', null, 'Se il brand fosse una persona, chi sarebbe?')}>
          <Textarea value={identity.brandPersona} onChange={v => setField('brandPersona', v)} rows={3} placeholder={t('bi.personaPh', null, 'Es: Coach pragmatico, ex-atleta, parla schietto e tecnico, niente fronzoli')} />
        </Field>
      </SectionBlock>

      <SectionBlock
        open={open.visual}
        onToggle={() => setOpen(o => ({ ...o, visual: !o.visual }))}
        icon="④"
        title={t('bi.s4Title', null, 'Visual Identity')}
        subtitle={t('bi.s4Sub', null, 'Aspetto del brand (per Creative Lab + ads)')}
      >
        <FieldRow>
          <Field label={t('bi.fontPrimaryLabel', null, 'Font primario')}>
            <Input value={identity.primaryFont} onChange={v => setField('primaryFont', v)} placeholder={t('bi.fontPrimaryPh', null, 'Es: Inter')} />
          </Field>
          <Field label={t('bi.fontSecondaryLabel', null, 'Font secondario')}>
            <Input value={identity.secondaryFont} onChange={v => setField('secondaryFont', v)} placeholder={t('bi.fontSecondaryPh', null, 'Es: Bebas Neue')} />
          </Field>
        </FieldRow>
        <Field label={t('bi.paletteLabel', null, 'Palette colori')} hint={t('bi.paletteHint', null, 'Hex code, max 6')}>
          <ColorPicker colors={identity.colors || []} onChange={v => setField('colors', v)} />
        </Field>
        <Field label={t('bi.photoLabel', null, 'Stile fotografico')} hint={t('bi.photoHint', null, 'Descrivi come devono apparire le foto')}>
          <Textarea value={identity.photoStyle} onChange={v => setField('photoStyle', v)} rows={3} placeholder={t('bi.photoPh', null, 'Es: Lifestyle outdoor, alto contrasto, persone reali, no models, no studio')} />
        </Field>
        <Field label={t('bi.adStyleLabel', null, 'Stile creative ads')} hint={t('bi.adStyleHint', null, "Tipologia di creativita' che converte per il tuo brand")}>
          <Textarea value={identity.adStyle} onChange={v => setField('adStyle', v)} rows={3} placeholder={t('bi.adStylePh', null, 'Es: UGC raw, dimostrazione prodotto in uso, prima/dopo, framing dinamico')} />
        </Field>

        <AssetsManager assets={assets} onChange={setAssets} />
      </SectionBlock>

      <SectionBlock
        open={open.competitor}
        onToggle={() => setOpen(o => ({ ...o, competitor: !o.competitor }))}
        icon="⑤"
        title={t('bi.s5Title', null, 'Competitor')}
        subtitle={t('bi.s5Sub', null, 'Brand che monitoriamo nella tab Competitor Intel')}
      >
        <CompetitorList
          competitors={identity.competitors || []}
          onChange={v => setField('competitors', v)}
        />
      </SectionBlock>

      {/* Memorie degli agent — separato dal form principale (read+modify, no save) */}
      {!embedded && <AgentMemoryInspector />}

      {/* Save bar — nascosta in onboarding (il salvataggio è guidato dal bottone del wizard) */}
      {!embedded && (
      <div style={{
        position: 'sticky', bottom: 16, zIndex: 5,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14,
        background: 'rgba(10,10,22,0.92)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid var(--border)', borderTopColor: 'rgba(255,255,255,0.14)',
        borderRadius: 16, padding: '14px 18px',
        boxShadow: '0 20px 50px rgba(0,0,0,0.7)',
      }}>
        <div style={{ fontSize: 12, color: 'var(--text3)' }}>
          {error
            ? <span style={{ color: '#f87171' }}><Icon name="warning" size={12} /> {error}</span>
            : savedAt
              ? <span style={{ color: '#86efac' }}>{t('bi.savedAt', { time: savedAt.toLocaleTimeString() }, `Salvato — ${savedAt.toLocaleTimeString()}`)}</span>
              : t('bi.saveHint', null, 'Le modifiche non vengono salvate finche\' non clicchi "Salva".')}
        </div>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          style={{
            padding: '10px 20px', borderRadius: 12, border: 'none', cursor: saving ? 'wait' : 'pointer',
            background: `linear-gradient(135deg, ${ACCENT}, #2997ff)`,
            color: 'var(--text)', fontWeight: 800, fontSize: 13, letterSpacing: '-0.01em',
            opacity: saving ? 0.6 : 1,
          }}
        >
          {saving ? t('bi.saving', null, 'Salvataggio…') : t('bi.saveBtn', null, 'Salva modifiche')}
        </button>
      </div>
      )}
    </div>
  )
})

export default BrandIdentityPanel

// ─────────────────────────────────────────────────────────────
// Building blocks
// ─────────────────────────────────────────────────────────────

function GlassCard({ children, padding = 22, reveal = 'reveal-zoom' }) {
  return (
    <div className={`glass-section ${reveal}`} style={{ padding, borderRadius: 22 }}>
      {children}
    </div>
  )
}

function SectionHeader({ icon, eyebrow, title, subtitle }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
      <span style={{
        width: 42, height: 42, borderRadius: 12,
        background: `linear-gradient(135deg, ${ACCENT}33, ${ACCENT}14)`, color: ACCENT,
        display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        flexShrink: 0,
        border: `1px solid ${ACCENT}44`,
        boxShadow: `0 0 18px ${ACCENT}33, inset 0 1px 0 rgba(255,255,255,0.12)`,
        animation: 'float 4s ease-in-out infinite',
      }}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 9.5, color: ACCENT, fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
          {eyebrow}
        </div>
        <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.02em', marginTop: 4 }}>
          {title}
        </div>
        {subtitle && <div style={{ fontSize: 12.5, color: 'var(--text3)', marginTop: 6, lineHeight: 1.5 }}>{subtitle}</div>}
      </div>
    </div>
  )
}

function SectionBlock({ icon, title, subtitle, open, onToggle, children }) {
  return (
    <div
      className="glass-section reveal-zoom"
      style={{ overflow: 'hidden', borderRadius: 22, transition: 'transform .4s cubic-bezier(0.16,1,0.3,1)' }}
      onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-5px)' }}
      onMouseLeave={e => { e.currentTarget.style.transform = '' }}
    >
      <button
        type="button"
        onClick={onToggle}
        style={{
          width: '100%', background: 'transparent', border: 'none', cursor: 'pointer',
          padding: 22, textAlign: 'left', position: 'relative', zIndex: 2,
          display: 'flex', alignItems: 'center', gap: 14,
        }}
      >
        <span style={{
          width: 38, height: 38, borderRadius: 11,
          background: `linear-gradient(135deg, ${ACCENT}30, ${ACCENT}10)`, color: ACCENT,
          display: 'grid', placeItems: 'center', fontSize: 16, fontWeight: 800,
          flexShrink: 0,
          border: `1px solid ${ACCENT}3a`,
          boxShadow: `0 0 14px ${ACCENT}2e, inset 0 1px 0 rgba(255,255,255,0.10)`,
        }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.01em' }}>{title}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{subtitle}</div>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 18, transform: open ? 'rotate(90deg)' : 'rotate(0deg)', transition: 'transform .25s' }}>›</span>
      </button>
      {open && (
        <div style={{
          padding: '4px 22px 22px',
          borderTop: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column', gap: 14,
          position: 'relative', zIndex: 2,
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
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  color: 'var(--text)', fontSize: 13, fontFamily: 'inherit',
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

function Select({ value, onChange, options, labelKeys }) {
  const { t } = useI18n()
  return (
    <select
      value={value || ''}
      onChange={e => onChange(e.target.value)}
      style={{ ...inputBase, cursor: 'pointer' }}
    >
      <option value="">{t('bi.selectPlaceholder', null, '— Seleziona —')}</option>
      {options.map(opt => <option key={opt} value={opt}>{labelKeys ? t(labelKeys[opt], null, opt) : opt}</option>)}
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
          fontSize: 11.5, color: 'var(--text)', fontWeight: 600,
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
          color: 'var(--text)', fontSize: 13, outline: 'none', padding: '4px 0',
        }}
      />
    </div>
  )
}

function ToneChips({ selected, onToggle }) {
  const { t } = useI18n()
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
              color: isSelected ? 'var(--text)' : 'var(--text3)',
              fontSize: 12, fontWeight: 600, transition: 'all .15s',
            }}
          >{t(TONE_KEYS[tag], null, tag)}</button>
        )
      })}
    </div>
  )
}

function ColorPicker({ colors = [], onChange }) {
  const { t } = useI18n()
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
          background: 'var(--glass)',
          border: '1px solid var(--border2)', borderRadius: 10,
          padding: '6px 10px',
        }}>
          <span style={{ width: 22, height: 22, borderRadius: 6, background: c, border: '1px solid var(--border2)' }} />
          <span style={{ fontSize: 12, color: 'var(--text)', fontFamily: 'monospace' }}>{c}</span>
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
            style={{ width: 36, height: 36, borderRadius: 8, border: '1px solid var(--border2)', background: 'transparent', cursor: 'pointer' }}
          />
          <button type="button" onClick={addColor} style={{
            padding: '8px 12px', borderRadius: 10, background: `${ACCENT}33`,
            border: `1px solid ${ACCENT}`, color: 'var(--text)', cursor: 'pointer',
            fontSize: 12, fontWeight: 700,
          }}>{t('bi.colorAdd', null, '+ Aggiungi')}</button>
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
  const { t } = useI18n()
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
      setError(e?.message || t('bi.uploadFailed', null, 'Upload fallito'))
    } finally {
      setUploadingType(null)
    }
  }

  const deleteAsset = async (path) => {
    if (!confirm(t('bi.deleteFileConfirm', null, 'Eliminare questo file?'))) return
    try {
      const res = await fetch(`/api/brand-identity/upload?path=${encodeURIComponent(path)}`, { method: 'DELETE' })
      const j = await res.json()
      if (!res.ok || j?.error) throw new Error(j?.error || `HTTP ${res.status}`)
      onChange(j.assets || [])
    } catch (e) {
      setError(e?.message || t('bi.deleteFailed', null, 'Eliminazione fallita'))
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
        {t('bi.assetUpload', null, 'Asset upload')} <span style={{ color: 'var(--text4, #555)', fontWeight: 500, marginLeft: 8 }}>{t('bi.assetMax', null, '· Max 10MB/file')}</span>
      </div>

      {error && <div style={{ fontSize: 12, color: '#f87171', marginBottom: 10 }}><Icon name="warning" size={12} /> {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
        {ASSET_TYPES.map(at => {
          const list = assetsByType[at.id] || []
          const isUploading = uploadingType === at.id
          return (
            <div
              key={at.id}
              className="glass-panel"
              style={{ borderRadius: 14, padding: 14, transition: 'transform .35s cubic-bezier(0.16,1,0.3,1), box-shadow .35s ease' }}
              onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 24px 50px rgba(0,0,0,0.6), 0 0 40px ${ACCENT}22` }}
              onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{t(ASSET_LABEL_KEYS[at.id], null, at.label)}</span>
                <button
                  type="button"
                  onClick={() => inputRefs.current[at.id]?.click()}
                  disabled={isUploading}
                  style={{
                    padding: '6px 12px', borderRadius: 8, fontSize: 11, fontWeight: 700,
                    background: `${ACCENT}33`, border: `1px solid ${ACCENT}66`,
                    color: 'var(--text)', cursor: isUploading ? 'wait' : 'pointer',
                  }}
                >
                  {isUploading ? '…' : t('bi.assetAdd', null, '+ Carica')}
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
                  {t('bi.noFile', null, 'Nessun file')}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {list.map(a => (
                    <div key={a.path} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      background: 'var(--glass)',
                      border: '1px solid var(--border)',
                      borderRadius: 10, padding: 8,
                    }}>
                      <img src={a.url} alt={a.name} style={{ width: 36, height: 36, objectFit: 'cover', borderRadius: 6, background: '#000' }} onError={e => { e.currentTarget.style.display = 'none' }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 11, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{a.name}</div>
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
  const { t } = useI18n()
  const addCompetitor = () => {
    onChange([...competitors, { name: '', website: '', instagram: '', facebook: '', pageId: '' }])
  }
  const updateAt = (idx, patch) => {
    onChange(competitors.map((c, i) => i === idx ? { ...c, ...patch } : c))
  }
  const removeAt = (idx) => {
    if (!confirm(t('bi.deleteCompConfirm', null, 'Eliminare questo competitor?'))) return
    onChange(competitors.filter((_, i) => i !== idx))
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: -4 }}>
        {t('bi.compIntro', null, 'Aggiungi competitor con nome brand, sito ufficiale e link ai loro profili Instagram/Facebook. Verranno usati automaticamente dalla tab Competitor Intel per scrape ads e prodotti.')}
      </div>

      {competitors.length === 0 && (
        <div style={{ fontSize: 12, color: 'var(--text4, #555)', textAlign: 'center', padding: '20px 0' }}>
          {t('bi.noComp', null, 'Nessun competitor configurato')}
        </div>
      )}

      {competitors.map((c, idx) => (
        <div
          key={idx}
          className="glass-panel"
          style={{
            borderRadius: 14, padding: 14,
            display: 'flex', flexDirection: 'column', gap: 10,
            transition: 'transform .35s cubic-bezier(0.16,1,0.3,1), box-shadow .35s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = `0 24px 50px rgba(0,0,0,0.6), 0 0 40px ${ACCENT}22` }}
          onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700 }}>#{idx + 1}</span>
            <input
              type="text" value={c.name || ''}
              onChange={e => updateAt(idx, { name: e.target.value })}
              placeholder={t('bi.compNamePh', null, 'Nome brand (es: Velites)')}
              style={{ ...inputBase, flex: 1, fontWeight: 700 }}
            />
            <button type="button" onClick={() => removeAt(idx)} style={{
              background: 'transparent', border: '1px solid rgba(248,113,113,0.4)',
              color: '#f87171', cursor: 'pointer', fontSize: 11, fontWeight: 700,
              borderRadius: 8, padding: '6px 10px',
            }}>{t('bi.compRemove', null, 'Rimuovi')}</button>
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
              placeholder={t('bi.compIgPh', null, '@username o URL Instagram')}
              style={inputBase}
            />
            <input
              type="text" value={c.facebook || ''}
              onChange={e => updateAt(idx, { facebook: e.target.value })}
              placeholder={t('bi.compFbPh', null, 'URL pagina Facebook')}
              style={inputBase}
            />
          </div>
          <div>
            <div style={{ fontSize: 10.5, color: 'var(--text4, #666)', marginBottom: 4 }}>
              {t('bi.compPageIdLabel', null, 'ID pagina Facebook (per fetch automatico ads — opzionale)')}
            </div>
            <input
              type="text" value={c.pageId || ''}
              onChange={e => updateAt(idx, { pageId: e.target.value })}
              placeholder={t('bi.compPageIdPh', null, 'Es: 234280280078173 (lascia vuoto se non lo conosci)')}
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
          color: 'var(--text)', fontSize: 13, fontWeight: 700,
        }}
      >
        {t('bi.compAdd', null, '+ Aggiungi competitor')}
      </button>
    </div>
  )
}
