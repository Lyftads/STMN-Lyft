'use client'

import Icon from '../ui/Icon'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Pannello Ambienti (Studios) — usato come sidebar SINISTRA sempre aperta.
// Mostra ricerca, categorie, stili/look e la griglia di anteprime selezionabili.
export default function StudiosPanel({
  studioPresets = [], studioCategories = [], stylePresets = [],
  activeStudio, setActiveStudio, activeStyle, setActiveStyle,
  studioCat, setStudioCat, studioQuery, setStudioQuery, onCollapse,
}) {
  const { t } = useI18n()
  const cats = [{ id: 'all', label: t('cs.studioAll', null, 'Tutti') }, ...studioCategories.map(c => ({ id: c.id, label: t(`cs.cat.${c.id}`, null, c.label) }))]
  const q = (studioQuery || '').trim().toLowerCase()
  const list = studioPresets.filter(s => (studioCat === 'all' || s.category === studioCat) && (!q || s.label.toLowerCase().includes(q)))

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0, color: '#fff', fontFamily: 'Barlow' }}>
      {/* Header */}
      <div style={{ padding: '12px 14px 10px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <Icon name="grid" size={16} />
          <div style={{ fontSize: 14, fontWeight: 800, flex: 1 }}>{t('cs.studiosTitle', null, 'Studios — Ambienti')}</div>
          {onCollapse && <button onClick={onCollapse} title={t('cs.collapse', null, 'Comprimi')} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 7, width: 26, height: 26, color: '#fff', cursor: 'pointer' }}><Icon name="minus" size={14} /></button>}
        </div>
        <input value={studioQuery} onChange={e => setStudioQuery(e.target.value)} placeholder={t('cs.studioSearch', null, 'Cerca ambiente…')} style={{ width: '100%', background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 9, padding: '8px 11px', color: '#fff', fontSize: 12.5, fontFamily: 'Barlow', boxSizing: 'border-box' }} />
        <div style={{ display: 'flex', gap: 5, marginTop: 8, flexWrap: 'wrap' }}>
          {cats.map(c => (
            <button key={c.id} onClick={() => setStudioCat(c.id)} style={{ ...chip, ...(studioCat === c.id ? chipOn : {}), padding: '4px 9px', fontSize: 11 }}>{c.label}</button>
          ))}
        </div>
        {stylePresets.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontSize: 9.5, color: 'var(--text3,#888)', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 5 }}>{t('cs.styleLook', null, 'Stile / Look')}</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {stylePresets.map(s => (
                <button key={s.id} onClick={() => setActiveStyle(activeStyle === s.id ? null : s.id)} style={{ ...chip, ...(activeStyle === s.id ? chipOn : {}), padding: '4px 9px', fontSize: 11 }}>{s.label}</button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Griglia anteprime */}
      <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: 12, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, alignContent: 'start' }}>
        {list.length === 0 && <div style={{ gridColumn: '1/-1', color: 'var(--text2,#9aa)', fontSize: 12.5, textAlign: 'center', padding: 24 }}>{t('cs.studioNone', null, 'Nessun ambiente trovato.')}</div>}
        {list.map(s => {
          const on = activeStudio === s.id
          return (
            <button key={s.id} onClick={() => setActiveStudio(on ? null : s.id)} style={{ background: 'transparent', border: 'none', padding: 0, cursor: 'pointer', textAlign: 'left', fontFamily: 'Barlow' }}>
              <div style={{ position: 'relative', width: '100%', aspectRatio: '3/4', borderRadius: 11, background: s.swatch, border: on ? '2px solid #7b5bff' : '1px solid var(--border)', overflow: 'hidden', boxShadow: 'inset 0 -36px 46px rgba(0,0,0,0.35)' }}>
                {s.preview && <img src={s.preview} alt={s.label} loading="lazy" draggable={false} onError={e => { e.currentTarget.style.display = 'none' }} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
                {on && <span style={{ position: 'absolute', top: 7, right: 7, width: 20, height: 20, borderRadius: '50%', background: '#7b5bff', display: 'grid', placeItems: 'center', zIndex: 2 }}><Icon name="check" size={11} /></span>}
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', marginTop: 6, lineHeight: 1.25 }}>{s.label}</div>
            </button>
          )
        })}
      </div>
    </div>
  )
}

const chip = { background: 'var(--glass2,#1a1a24)', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text2,#9aa)', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow' }
const chipOn = { background: 'rgba(123,91,255,0.18)', borderColor: '#7b5bff', color: '#fff' }
