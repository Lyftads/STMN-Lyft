'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

// ── Clienti: layer d'azione AI sopra l'anagrafica Shopify ───────────────────
// 4 segmenti automatici + "Crea campagna" in 1 click (copy AI → da incollare in
// Klaviyo). Self-fetch, cache di modulo, isolato e multi-tenant come le altre tab.

let __cliCache = null

const SEGS = [
  { key: 'vip',     color: '#f5b301', icon: 'star',  emoji: '★' },
  { key: 'atRisk',  color: '#ff7849', icon: 'clock', emoji: '!' },
  { key: 'winback', color: '#ef4444', icon: 'undo',  emoji: '↺' },
  { key: 'convert', color: '#22c55e', icon: 'bolt',  emoji: '→' },
]

export default function ClientiTab({ onNavigate }) {
  const { t, locale, intlLocale } = useI18n()
  const [data, setData] = useState(() => __cliCache)
  const [loading, setLoading] = useState(!__cliCache)
  const [error, setError] = useState('')
  const [active, setActive] = useState('vip')

  // Modale campagna
  const [campSeg, setCampSeg] = useState(null)
  const [camp, setCamp] = useState(null)
  const [campLoading, setCampLoading] = useState(false)
  const [campError, setCampError] = useState('')
  const [copied, setCopied] = useState('')

  const load = async (refresh = false) => {
    if (!refresh && __cliCache) { setData(__cliCache); setLoading(false); return }
    setLoading(true); setError('')
    try {
      const r = await fetch(`/api/customers${refresh ? '?refresh=1' : ''}`, { cache: 'no-store' })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore')
      __cliCache = j; setData(j)
    } catch (e) { setError(e.message) } finally { setLoading(false) }
  }
  useEffect(() => { if (__cliCache) { setData(__cliCache); setLoading(false) } else load() }, []) // eslint-disable-line

  const cur = data?.currency || 'EUR'
  const fmtMoney = (n, d = 0) => (n == null ? '—' : new Intl.NumberFormat(intlLocale, { style: 'currency', currency: cur, maximumFractionDigits: d }).format(n))
  const fmtInt = (n) => (n == null ? '—' : new Intl.NumberFormat(intlLocale).format(Math.round(n)))

  const segs = data?.segments || {}
  const meta = (k) => SEGS.find(s => s.key === k)
  const segLabel = (k) => ({
    vip: t('cli.seg.vip', null, 'VIP'),
    atRisk: t('cli.seg.atRisk', null, 'A rischio churn'),
    winback: t('cli.seg.winback', null, 'Win-back (persi)'),
    convert: t('cli.seg.convert', null, 'Da convertire'),
  }[k] || k)
  const segDesc = (k) => ({
    vip: t('cli.desc.vip', null, 'Top spender ancora attivi. Premiali per farli tornare e spendere di più.'),
    atRisk: t('cli.desc.atRisk', null, 'Clienti abituali che hanno rallentato (60–180 giorni). Riattivali ora.'),
    winback: t('cli.desc.winback', null, 'Persi da oltre 180 giorni. Un\'offerta forte per recuperarli.'),
    convert: t('cli.desc.convert', null, 'Hanno comprato una volta. Spingili al secondo acquisto.'),
  }[k] || '')

  const totalValueAtRisk = (segs.atRisk?.value || 0) + (segs.winback?.value || 0)
  const activeSeg = segs[active]

  // ── Azione: crea campagna ──────────────────────────────────────────────
  const openCampaign = async (key) => {
    setCampSeg(key); setCamp(null); setCampError(''); setCampLoading(true); setCopied('')
    try {
      const s = segs[key] || {}
      const r = await fetch('/api/customers/campaign', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ segment: key, locale, stats: { count: s.count, value: s.value, currency: cur } }),
      })
      const j = await r.json()
      if (!j.ok) throw new Error(j.error || 'Errore generazione')
      setCamp(j)
    } catch (e) { setCampError(e.message) } finally { setCampLoading(false) }
  }
  const closeCampaign = () => { setCampSeg(null); setCamp(null); setCampError(''); setCopied('') }

  const copy = async (what, text) => {
    try { await navigator.clipboard.writeText(text || ''); setCopied(what); setTimeout(() => setCopied(''), 1600) } catch {}
  }
  const segEmails = (key) => (segs[key]?.customers || []).map(c => c.email).filter(Boolean)

  // ── Render ──────────────────────────────────────────────────────────────
  if (loading) return <div style={{ padding: 40, color: 'var(--text2)' }}>{t('cli.loading', null, 'Carico i clienti da Shopify…')}</div>
  if (error) return (
    <div style={{ padding: 24 }}>
      <div style={{ color: '#fca5a5', marginBottom: 12 }}>{error}</div>
      <button onClick={() => load(true)} style={btnGhost}>{t('common.retry', null, 'Riprova')}</button>
    </div>
  )

  return (
    <div style={{ padding: '8px 4px 60px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: '#fff', margin: 0 }}>{t('cli.title', null, 'Clienti')}</h1>
          <p style={{ color: 'var(--text2)', margin: '6px 0 0', fontSize: 14, maxWidth: 640 }}>
            {t('cli.subtitle', null, 'I tuoi clienti, già divisi in segmenti pronti all\'azione. Scegli un segmento e lancia la campagna giusta in un click.')}
          </p>
        </div>
        <button onClick={() => load(true)} style={btnGhost}>
          <Icon name="refresh" /> {t('common.refresh', null, 'Aggiorna')}
        </button>
      </div>

      {/* KPI riepilogo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 14, marginBottom: 26 }}>
        {kpi(t('cli.kpi.buyers', null, 'Clienti acquirenti'), fmtInt(data?.buyers), '#7b5bff')}
        {kpi(t('cli.kpi.aov', null, 'Scontrino medio (AOV)'), fmtMoney(data?.globalAov, 2), '#0ea5e9')}
        {kpi(t('cli.kpi.vip', null, 'VIP'), fmtInt(segs.vip?.count), '#f5b301')}
        {kpi(t('cli.kpi.atRisk', null, 'Valore a rischio'), fmtMoney(totalValueAtRisk), '#ef4444')}
      </div>

      {/* Card segmenti */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(250px,1fr))', gap: 16, marginBottom: 28 }}>
        {SEGS.map(s => {
          const seg = segs[s.key] || {}
          const isActive = active === s.key
          return (
            <div key={s.key} onClick={() => setActive(s.key)} style={{
              position: 'relative', cursor: 'pointer', borderRadius: 18, padding: '18px 18px 16px',
              background: isActive ? `linear-gradient(160deg, ${s.color}22, rgba(255,255,255,0.02))` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isActive ? s.color + '88' : 'rgba(255,255,255,0.08)'}`,
              transition: 'all .18s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ width: 30, height: 30, borderRadius: 9, background: s.color + '22', color: s.color, display: 'grid', placeItems: 'center', fontWeight: 900 }}>{s.emoji}</span>
                <span style={{ fontWeight: 800, color: '#fff', fontSize: 15 }}>{segLabel(s.key)}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 6 }}>
                <span style={{ fontSize: 28, fontWeight: 900, color: '#fff' }}>{fmtInt(seg.count)}</span>
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('cli.customers', null, 'clienti')}</span>
              </div>
              <div style={{ fontSize: 13, color: s.color, fontWeight: 700, marginBottom: 10 }}>
                {s.key === 'convert'
                  ? `${fmtMoney(seg.potential)} ${t('cli.potential', null, 'potenziale')}`
                  : `${fmtMoney(seg.value)} ${t('cli.lifetime', null, 'valore lifetime')}`}
              </div>
              <p style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.45, margin: '0 0 14px', minHeight: 54 }}>{segDesc(s.key)}</p>
              <button onClick={(e) => { e.stopPropagation(); openCampaign(s.key) }} disabled={!seg.count} style={{
                ...btnPrimary, width: '100%', justifyContent: 'center',
                background: seg.count ? s.color : 'rgba(255,255,255,0.06)', color: seg.count ? '#0b0b0f' : 'var(--text2)',
                cursor: seg.count ? 'pointer' : 'not-allowed',
              }}>
                <Icon name="sparkle" /> {t('cli.createCampaign', null, 'Crea campagna')}
              </button>
            </div>
          )
        })}
      </div>

      {/* Tabella segmento attivo */}
      {activeSeg && (
        <div style={{ borderRadius: 18, border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.02)', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: meta(active)?.color }} />
              <span style={{ fontWeight: 800, color: '#fff' }}>{segLabel(active)}</span>
              <span style={{ color: 'var(--text2)', fontSize: 13 }}>· {fmtInt(activeSeg.count)} {t('cli.customers', null, 'clienti')}</span>
            </div>
            <button onClick={() => openCampaign(active)} disabled={!activeSeg.count} style={btnGhost}>
              <Icon name="sparkle" /> {t('cli.createCampaign', null, 'Crea campagna')}
            </button>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13.5 }}>
              <thead>
                <tr style={{ color: 'var(--text2)', textAlign: 'left' }}>
                  <th style={th}>{t('cli.col.name', null, 'Cliente')}</th>
                  <th style={th}>{t('cli.col.email', null, 'Email')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.orders', null, 'Ordini')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.spent', null, 'Speso')}</th>
                  <th style={{ ...th, textAlign: 'right' }}>{t('cli.col.last', null, 'Ultimo ordine')}</th>
                </tr>
              </thead>
              <tbody>
                {(activeSeg.customers || []).map((c, i) => (
                  <tr key={i} style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                    <td style={{ ...td, color: '#fff', fontWeight: 600 }}>{c.name}</td>
                    <td style={{ ...td, color: 'var(--text2)' }}>{c.email || '—'}</td>
                    <td style={{ ...td, textAlign: 'right' }}>{fmtInt(c.orders)}</td>
                    <td style={{ ...td, textAlign: 'right', color: '#fff', fontWeight: 700 }}>{fmtMoney(c.spent)}</td>
                    <td style={{ ...td, textAlign: 'right', color: 'var(--text2)' }}>{c.lastDays >= 9999 ? '—' : t('cli.daysAgo', { d: c.lastDays }, `${c.lastDays} gg fa`)}</td>
                  </tr>
                ))}
                {!activeSeg.customers?.length && (
                  <tr><td colSpan={5} style={{ ...td, color: 'var(--text2)', textAlign: 'center', padding: 26 }}>{t('cli.empty', null, 'Nessun cliente in questo segmento.')}</td></tr>
                )}
              </tbody>
            </table>
          </div>
          {activeSeg.customers?.length >= 200 && (
            <div style={{ padding: '8px 18px', fontSize: 12, color: 'var(--text2)' }}>{t('cli.capped', null, 'Mostrati i primi 200 per spesa.')}</div>
          )}
        </div>
      )}

      {/* Modale campagna */}
      {campSeg && (
        <div onClick={closeCampaign} style={overlay}>
          <div onClick={(e) => e.stopPropagation()} style={modal}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 10, height: 10, borderRadius: 99, background: meta(campSeg)?.color }} />
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#fff', margin: 0 }}>
                  {t('cli.campaignFor', null, 'Campagna per')} · {segLabel(campSeg)}
                </h2>
              </div>
              <button onClick={closeCampaign} style={{ ...btnGhost, padding: '6px 10px' }}>✕</button>
            </div>
            <p style={{ color: 'var(--text2)', fontSize: 13, margin: '0 0 16px' }}>
              {fmtInt(segs[campSeg]?.count)} {t('cli.customers', null, 'clienti')} · {segEmails(campSeg).length} {t('cli.withEmail', null, 'con email')}
            </p>

            {campLoading && <div style={{ padding: 30, textAlign: 'center', color: 'var(--text2)' }}>{t('cli.generating', null, 'La Squadra AI sta scrivendo l\'email…')}</div>}
            {campError && <div style={{ color: '#fca5a5', padding: '6px 0' }}>{campError}</div>}

            {camp && (
              <div style={{ display: 'grid', gap: 14 }}>
                {camp.angle && (
                  <div style={{ fontSize: 13, color: meta(campSeg)?.color, background: (meta(campSeg)?.color || '#fff') + '14', borderRadius: 10, padding: '10px 12px' }}>
                    <strong>{t('cli.strategy', null, 'Strategia')}:</strong> {camp.angle}
                  </div>
                )}
                <Field label={t('cli.field.subject', null, 'Oggetto')} value={camp.subject} onCopy={() => copy('subject', camp.subject)} copied={copied === 'subject'} t={t} />
                <Field label={t('cli.field.preview', null, 'Anteprima')} value={camp.preview} onCopy={() => copy('preview', camp.preview)} copied={copied === 'preview'} t={t} />
                <div>
                  <div style={fieldHead}>
                    <span>{t('cli.field.body', null, 'Corpo email')}</span>
                    <button onClick={() => copy('body', camp.body)} style={copyBtn}>{copied === 'body' ? t('cli.copied', null, 'Copiato') : t('cli.copy', null, 'Copia')}</button>
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', background: 'rgba(0,0,0,0.25)', borderRadius: 12, padding: '14px 16px', color: '#e8e8ef', fontSize: 14, lineHeight: 1.6, border: '1px solid rgba(255,255,255,0.07)' }}>{camp.body}</div>
                </div>
                {camp.cta && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 13, color: 'var(--text2)' }}>{t('cli.field.cta', null, 'Bottone')}:</span>
                    <span style={{ padding: '7px 16px', borderRadius: 99, background: meta(campSeg)?.color, color: '#0b0b0f', fontWeight: 800, fontSize: 13 }}>{camp.cta}</span>
                  </div>
                )}

                {/* Azioni: porta in Klaviyo */}
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 4, paddingTop: 14, borderTop: '1px solid rgba(255,255,255,0.08)' }}>
                  <button onClick={() => copy('emails', segEmails(campSeg).join(', '))} style={btnGhost}>
                    <Icon name="users" /> {copied === 'emails' ? t('cli.copied', null, 'Copiato') : t('cli.copyEmails', { n: segEmails(campSeg).length }, `Copia ${segEmails(campSeg).length} email`)}
                  </button>
                  <button onClick={() => onNavigate && onNavigate('klaviyo')} style={{ ...btnPrimary, background: meta(campSeg)?.color, color: '#0b0b0f' }}>
                    <Icon name="mail" /> {t('cli.openKlaviyo', null, 'Apri Klaviyo')}
                  </button>
                  <button onClick={() => openCampaign(campSeg)} style={btnGhost}>
                    <Icon name="refresh" /> {t('cli.regenerate', null, 'Rigenera')}
                  </button>
                </div>
                <p style={{ fontSize: 11.5, color: 'var(--text2)', margin: 0 }}>{t('cli.klaviyoHint', null, 'Incolla le email come segmento/lista in Klaviyo e usa oggetto e corpo qui sopra. L\'invio resta sempre una tua scelta.')}</p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )

  function kpi(label, value, color) {
    return (
      <div style={{ borderRadius: 16, padding: '16px 18px', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 8 }}>{label}</div>
        <div style={{ fontSize: 24, fontWeight: 900, color: '#fff' }}>{value}</div>
        <div style={{ height: 3, borderRadius: 99, marginTop: 10, background: color, opacity: 0.85 }} />
      </div>
    )
  }
}

function Field({ label, value, onCopy, copied, t }) {
  return (
    <div>
      <div style={fieldHead}>
        <span>{label}</span>
        <button onClick={onCopy} style={copyBtn}>{copied ? t('cli.copied', null, 'Copiato') : t('cli.copy', null, 'Copia')}</button>
      </div>
      <div style={{ background: 'rgba(0,0,0,0.25)', borderRadius: 10, padding: '10px 14px', color: '#fff', fontSize: 14, border: '1px solid rgba(255,255,255,0.07)' }}>{value || '—'}</div>
    </div>
  )
}

const th = { padding: '11px 18px', fontWeight: 700, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.4 }
const td = { padding: '11px 18px' }
const btnGhost = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, border: '1px solid rgba(255,255,255,0.14)', background: 'rgba(255,255,255,0.04)', color: '#fff', fontWeight: 700, fontSize: 13, cursor: 'pointer' }
const btnPrimary = { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, border: 'none', fontWeight: 800, fontSize: 13, cursor: 'pointer' }
const overlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)', display: 'grid', placeItems: 'center', zIndex: 1000, padding: 20 }
const modal = { width: 'min(680px,100%)', maxHeight: '88vh', overflowY: 'auto', background: '#14141b', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 20, padding: 22 }
const fieldHead = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: 12.5, color: 'var(--text2)', marginBottom: 6, fontWeight: 700 }
const copyBtn = { background: 'transparent', border: 'none', color: '#7b9bff', fontWeight: 700, fontSize: 12.5, cursor: 'pointer' }
