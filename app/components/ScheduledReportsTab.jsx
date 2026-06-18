'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { PlatformBadges } from './PlatformIcon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ─────────────────────────────────────────────────────────────
//  Scheduled Reports Tab
//  - 2 card report (Weekly / Monthly) con descrizione + next run + test send
//  - Configurazione email destinatario (localStorage)
//  - Bottone "Invia ora" per test
// ─────────────────────────────────────────────────────────────

export default function ScheduledReportsTab() {
  const { t, intlLocale } = useI18n()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState({})
  const [feedback, setFeedback] = useState({})

  useEffect(() => {
    const saved = localStorage.getItem('lyftai:report_recipient') || ''
    if (saved) setEmail(saved)
  }, [])

  const saveEmail = (v) => {
    setEmail(v)
    if (v.includes('@')) localStorage.setItem('lyftai:report_recipient', v)
  }

  const sendNow = async (type) => {
    if (!email.includes('@')) {
      setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: t('sched.invalidEmail', null, 'Enter a valid email') } }))
      return
    }
    setSending(prev => ({ ...prev, [type]: true }))
    setFeedback(prev => ({ ...prev, [type]: null }))
    try {
      const res = await fetch('/api/scheduled-reports/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email }),
      })
      const j = await res.json()
      if (j.ok) {
        setFeedback(prev => ({ ...prev, [type]: { ok: true, msg: t('sched.sentTo', { to: j.sent_to, id: j.message_id?.slice(0, 12) || 'ok' }, 'Sent to {to} (id {id})') } }))
      } else {
        setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: j.error || t('sched.sendError', null, 'Send error') } }))
      }
    } catch (e) {
      setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: e?.message || t('sched.networkError', null, 'Network error') } }))
    } finally {
      setSending(prev => ({ ...prev, [type]: false }))
    }
  }

  const nextWeekly = nextMonday(intlLocale)
  const nextMonthly = nextFirstOfMonth(intlLocale)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{
          width: 42, height: 42, borderRadius: 11,
          background: 'rgba(34,197,94,0.14)', color: '#22c55e',
          display: 'grid', placeItems: 'center', fontSize: 18, fontWeight: 800,
        }}><Icon name="mail" size={16} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ fontSize: 9.5, color: '#22c55e', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>
              Scheduled Reports
            </div>
            <PlatformBadges sources={['shopify', 'meta']} size={14} />
          </div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>
            {t('sched.title', null, 'Automatic email digests · Weekly · Monthly')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
            {t('sched.subtitle', null, 'HTML email with key KPIs (Shopify + Meta) + Top 5 products + comparison vs previous period.')}
          </div>
        </div>
      </div>

      {/* RECIPIENT INPUT */}
      <div className="glass-card-static" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          {t('sched.recipientEmail', null, 'Recipient email')}
        </div>
        <input
          type="email"
          value={email}
          onChange={e => saveEmail(e.target.value)}
          placeholder={t('sched.emailPh', null, 'e.g. yourname@brand.com')}
          style={{
            width: '100%',
            background: 'var(--glass)',
            border: '1px solid var(--border)',
            color: 'var(--text)',
            borderRadius: 10,
            padding: '12px 14px',
            fontSize: 14, fontWeight: 600,
            outline: 'none',
          }}
        />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {t('sched.localNotePre', null, 'Saved locally. For automatic cron jobs, configure on Vercel')} <code style={{ background: 'var(--glass2)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>REPORT_RECIPIENT</code> {t('sched.localNotePost', null, '(or REPORT_RECIPIENTS comma-separated for multiple).')}
        </div>
      </div>

      {/* REPORT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <ReportCard
          title="Weekly Digest"
          subtitle={t('sched.weeklyTime', null, 'Every Monday at 09:00 UTC')}
          description={t('sched.weeklyDesc', null, 'Weekly performance: revenue, orders, new customers, Meta spend, ROAS, blended MER. Comparison vs previous week. Top 5 products.')}
          nextRun={nextWeekly}
          onSend={() => sendNow('weekly')}
          sending={sending.weekly}
          feedback={feedback.weekly}
        />
        <ReportCard
          title="Monthly Digest"
          subtitle={t('sched.monthlyTime', null, 'First of the month at 09:00 UTC')}
          description={t('sched.monthlyDesc', null, 'Monthly performance: same layout as weekly but over the last_30d period. Ideal for stakeholders/management.')}
          nextRun={nextMonthly}
          onSend={() => sendNow('monthly')}
          sending={sending.monthly}
          feedback={feedback.monthly}
        />
      </div>
    </div>
  )
}

function ReportCard({ title, subtitle, description, nextRun, onSend, sending, feedback }) {
  const { t } = useI18n()
  return (
    <div className="glass-card-static" style={{ padding: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
        <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{title}</div>
        <PlatformBadges sources={['shopify', 'meta']} size={14} />
      </div>
      <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, marginBottom: 12 }}>{subtitle}</div>
      <div style={{ fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.5, marginBottom: 14 }}>{description}</div>
      <div style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 10,
        padding: '10px 14px',
        marginBottom: 14,
      }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>
          {t('sched.nextAuto', null, 'Next automatic send')}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{nextRun}</div>
      </div>
      <button
        type="button"
        onClick={onSend}
        disabled={sending}
        style={{
          width: '100%',
          border: '1px solid var(--border)',
          background: sending ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.12)',
          color: sending ? 'var(--text3)' : '#22c55e',
          borderRadius: 10, padding: '11px 14px',
          fontSize: 13, fontWeight: 800,
          cursor: sending ? 'wait' : 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
        }}
      >
        {sending ? t('sched.sending', null, 'Sending…') : t('sched.sendNow', null, 'Send digest now (test)')}
      </button>
      {feedback && (
        <div style={{
          marginTop: 10, padding: '8px 12px', borderRadius: 8,
          background: feedback.ok ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)',
          color: feedback.ok ? '#86efac' : '#fca5a5',
          fontSize: 12, fontWeight: 600,
        }}>
          {feedback.msg}
        </div>
      )}
    </div>
  )
}

function nextMonday(loc = 'it-IT') {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0))
  const day = d.getUTCDay()
  const add = day === 1 && now.getUTCHours() < 9 ? 0 : (day <= 1 ? (1 - day + 7) % 7 || 7 : 8 - day)
  d.setUTCDate(d.getUTCDate() + add)
  return d.toLocaleString(loc, { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
}

function nextFirstOfMonth(loc = 'it-IT') {
  const now = new Date()
  let m = now.getUTCMonth(), y = now.getUTCFullYear()
  if (now.getUTCDate() > 1 || (now.getUTCDate() === 1 && now.getUTCHours() >= 9)) {
    m++
    if (m > 11) { m = 0; y++ }
  }
  const d = new Date(Date.UTC(y, m, 1, 9, 0, 0))
  return d.toLocaleString(loc, { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
}
