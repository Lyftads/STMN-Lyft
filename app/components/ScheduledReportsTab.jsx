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
  const { t } = useI18n()
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
      setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: 'Inserisci una email valida' } }))
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
        setFeedback(prev => ({ ...prev, [type]: { ok: true, msg: `Inviato a ${j.sent_to} (id ${j.message_id?.slice(0, 12) || 'ok'})` } }))
      } else {
        setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: j.error || 'Errore invio' } }))
      }
    } catch (e) {
      setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: e?.message || 'Errore network' } }))
    } finally {
      setSending(prev => ({ ...prev, [type]: false }))
    }
  }

  const nextWeekly = nextMonday()
  const nextMonthly = nextFirstOfMonth()

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
            Digest automatici via email · Weekly · Monthly
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
            HTML email con KPI principali (Shopify + Meta) + Top 5 prodotti + confronto vs periodo precedente.
          </div>
        </div>
      </div>

      {/* RECIPIENT INPUT */}
      <div className="glass-card-static" style={{ padding: 22 }}>
        <div style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 10 }}>
          Email destinatario
        </div>
        <input
          type="email"
          value={email}
          onChange={e => saveEmail(e.target.value)}
          placeholder="es. tuonome@brand.com"
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
          Salvato in locale. Per i cron job automatici, configura su Vercel <code style={{ background: 'var(--glass2)', padding: '1px 6px', borderRadius: 4, fontSize: 11 }}>REPORT_RECIPIENT</code> (o REPORT_RECIPIENTS comma-separated per multipli).
        </div>
      </div>

      {/* REPORT CARDS */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <ReportCard
          title="Weekly Digest"
          subtitle={t('sched.weeklyTime', null, 'Every Monday at 09:00 UTC')}
          description="Performance settimanale: revenue, ordini, nuovi clienti, Meta spend, ROAS, MER blended. Confronto vs settimana precedente. Top 5 prodotti."
          nextRun={nextWeekly}
          onSend={() => sendNow('weekly')}
          sending={sending.weekly}
          feedback={feedback.weekly}
        />
        <ReportCard
          title="Monthly Digest"
          subtitle={t('sched.monthlyTime', null, 'First of the month at 09:00 UTC')}
          description="Performance del mese: stesso layout del weekly ma su periodo last_30d. Ideale per stakeholder/management."
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
          Prossimo invio automatico
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
        {sending ? 'Invio…' : 'Invia digest ora (test)'}
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

function nextMonday() {
  const now = new Date()
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 9, 0, 0))
  const day = d.getUTCDay()
  const add = day === 1 && now.getUTCHours() < 9 ? 0 : (day <= 1 ? (1 - day + 7) % 7 || 7 : 8 - day)
  d.setUTCDate(d.getUTCDate() + add)
  return d.toLocaleString('it-IT', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
}

function nextFirstOfMonth() {
  const now = new Date()
  let m = now.getUTCMonth(), y = now.getUTCFullYear()
  if (now.getUTCDate() > 1 || (now.getUTCDate() === 1 && now.getUTCHours() >= 9)) {
    m++
    if (m > 11) { m = 0; y++ }
  }
  const d = new Date(Date.UTC(y, m, 1, 9, 0, 0))
  return d.toLocaleString('it-IT', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) + ' UTC'
}
