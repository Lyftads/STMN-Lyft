'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import HelpDrawer from './HelpDrawer'
import { HELP_ARTICLES, HELP_CATEGORIES, findArticle } from '../../lib/help/content'

const CAT_COLOR = { gettingStarted: '#22c55e', features: '#7b5bff', advanced: '#f59e0b' }

export default function HelpCenterTab({ onNavigate }) {
  const { t } = useI18n()
  const [q, setQ] = useState('')
  const [cat, setCat] = useState('all')
  const [openId, setOpenId] = useState(null)

  const catLabel = (c) => ({
    all: t('help.cat.all', null, 'Tutti'),
    gettingStarted: t('help.cat.gettingStarted', null, 'Primi passi'),
    features: t('help.cat.features', null, 'Funzionalità'),
    advanced: t('help.cat.advanced', null, 'Avanzato'),
  }[c] || c)

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return HELP_ARTICLES.filter(a => {
      if (cat !== 'all' && a.category !== cat) return false
      if (!s) return true
      return (a.title + ' ' + a.summary + ' ' + a.group).toLowerCase().includes(s)
    })
  }, [q, cat])

  return (
    <div style={{ width: '100%', padding: '8px 4px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <span style={{ width: 46, height: 46, borderRadius: 13, display: 'grid', placeItems: 'center', color: '#a78bfa', background: 'rgba(123,91,255,0.14)', border: '1px solid rgba(123,91,255,0.28)' }}>
          <Icon name="info" size={22} />
        </span>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, margin: 0, background: 'linear-gradient(90deg,#fff,#a78bfa)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>{t('help.title', null, 'Centro Assistenza')}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text2)', fontSize: 14 }}>{t('help.subtitle', null, 'Tutto quello che ti serve per usare LyftAI al massimo')}</p>
        </div>
      </div>

      {/* Ricerca */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }}><Icon name="search" size={16} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('help.search', null, 'Cerca una guida…')}
          style={{ width: '100%', padding: '13px 14px 13px 40px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.03)', color: '#fff', fontSize: 14 }} />
      </div>

      {/* Filtri categoria */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['all', ...HELP_CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding: '8px 16px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.1)', cursor: 'pointer', fontWeight: 700, fontSize: 13,
            background: cat === c ? (c === 'all' ? 'rgba(123,91,255,0.9)' : (CAT_COLOR[c] || '#7b5bff')) : 'rgba(255,255,255,0.03)',
            color: cat === c ? '#fff' : 'var(--text2)',
          }}>{catLabel(c)}</button>
        ))}
      </div>

      {/* Griglia card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, width: '100%' }}>
        {list.map(a => {
          const c = CAT_COLOR[a.category] || '#7b5bff'
          return (
            <div key={a.id} role="button" tabIndex={0}
              onClick={() => setOpenId(a.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(a.id) } }}
              className="help-card"
              style={{
                width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer',
                borderRadius: 16, padding: 18, position: 'relative',
                border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', transition: 'all .15s',
              }}>
              <span style={{ position: 'absolute', top: 16, right: 14, color: 'var(--text2)' }}><Icon name="link" size={15} /></span>
              <span style={{ width: 40, height: 40, borderRadius: 11, display: 'grid', placeItems: 'center', color: c, background: c + '1f', border: `1px solid ${c}3a`, marginBottom: 14 }}>
                <Icon name={a.icon || 'info'} size={19} />
              </span>
              <div style={{ fontSize: 15.5, fontWeight: 800, color: '#fff', marginBottom: 6 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: '#c4c4d0', lineHeight: 1.55, marginBottom: 14, minHeight: 38 }}>{a.summary}</div>
              <span style={{ display: 'inline-block', fontSize: 11, fontWeight: 700, color: c, background: c + '1a', padding: '3px 9px', borderRadius: 7 }}>{catLabel(a.category)}</span>
            </div>
          )
        })}
        {!list.length && <div style={{ color: 'var(--text2)', padding: 30 }}>{t('help.noResults', null, 'Nessuna guida trovata.')}</div>}
      </div>

      <HelpDrawer article={findArticle(openId)} onClose={() => setOpenId(null)} onNavigate={onNavigate} />

      <style>{`.help-card:hover{background:rgba(255,255,255,0.045);border-color:rgba(123,91,255,0.4)}`}</style>
    </div>
  )
}
