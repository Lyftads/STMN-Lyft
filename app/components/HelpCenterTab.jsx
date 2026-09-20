'use client'

import { useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import HelpDrawer from './HelpDrawer'
import { articlesFor, HELP_CATEGORIES, findArticle } from '../../lib/help/content'

const CAT_COLOR = { gettingStarted: 'var(--text3)', features: 'var(--text3)', advanced: 'var(--text3)' }

export default function HelpCenterTab({ onNavigate }) {
  const { t, locale } = useI18n()
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
    return articlesFor(locale).filter(a => {
      if (cat !== 'all' && a.category !== cat) return false
      if (!s) return true
      return (a.title + ' ' + a.summary + ' ' + a.group).toLowerCase().includes(s)
    })
  }, [q, cat, locale])

  return (
    <div style={{ width: '100%', padding: '8px 4px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <span style={{ width: 46, height: 46, borderRadius: 12, display: 'grid', placeItems: 'center', color: 'var(--text2)', background: 'var(--neutro-bg)', border: '1px solid var(--border)' }}>
          <Icon name="info" size={22} />
        </span>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 680, margin: 0, color: 'var(--text)' }}>{t('help.title', null, 'Centro Assistenza')}</h1>
          <p style={{ margin: '4px 0 0', color: 'var(--text2)', fontSize: 15 }}>{t('help.subtitle', null, 'Tutto quello che ti serve per usare LyftAI al massimo')}</p>
        </div>
      </div>

      {/* Ricerca */}
      <div style={{ position: 'relative', marginBottom: 16 }}>
        <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text2)' }}><Icon name="search" size={16} /></span>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('help.search', null, 'Cerca una guida…')}
          style={{ width: '100%', padding: '13px 14px 13px 40px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', fontSize: 15 }} />
      </div>

      {/* Filtri categoria */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        {['all', ...HELP_CATEGORIES].map(c => (
          <button key={c} onClick={() => setCat(c)} style={{
            padding: '8px 16px', borderRadius: 12, border: '1px solid var(--border)', cursor: 'pointer', fontWeight: 600, fontSize: 13,
            background: cat === c ? 'var(--btn-primario)' : 'rgba(255,255,255,0.03)',
            color: cat === c ? 'var(--btn-primario-testo)' : 'var(--text2)',
          }}>{catLabel(c)}</button>
        ))}
      </div>

      {/* Griglia card */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: 16, width: '100%' }}>
        {list.map(a => {
          const c = CAT_COLOR[a.category] || 'var(--text3)'
          return (
            <div key={a.id} role="button" tabIndex={0}
              onClick={() => setOpenId(a.id)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenId(a.id) } }}
              className="help-card"
              style={{
                width: '100%', boxSizing: 'border-box', textAlign: 'left', cursor: 'pointer',
                borderRadius: 16, padding: 18, position: 'relative',
                border: '1px solid var(--border)', background: 'var(--glass)', transition: 'all .15s',
              }}>
              <span style={{ position: 'absolute', top: 16, right: 14, color: 'var(--text2)' }}><Icon name="link" size={15} /></span>
              <span style={{ width: 40, height: 40, borderRadius: 12, display: 'grid', placeItems: 'center', color: c, background: 'var(--glass2)', border: '1px solid var(--border)', marginBottom: 14 }}>
                <Icon name={a.icon || 'info'} size={19} />
              </span>
              <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', marginBottom: 6 }}>{a.title}</div>
              <div style={{ fontSize: 13, color: '#c5c5c5', lineHeight: 1.55, marginBottom: 14, minHeight: 38 }}>{a.summary}</div>
              <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 600, color: c, background: 'var(--glass2)', padding: '3px 9px', borderRadius: 8 }}>{catLabel(a.category)}</span>
            </div>
          )
        })}
        {!list.length && <div style={{ color: 'var(--text2)', padding: 30 }}>{t('help.noResults', null, 'Nessuna guida trovata.')}</div>}
      </div>

      <HelpDrawer article={findArticle(openId, locale)} onClose={() => setOpenId(null)} onNavigate={onNavigate} />

      <style>{`.help-card:hover{background:rgba(255,255,255,0.045);border-color:rgba(123,91,255,0.4)}`}</style>
    </div>
  )
}
