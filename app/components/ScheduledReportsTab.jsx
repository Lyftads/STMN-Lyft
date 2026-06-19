'use client'

import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import { PlatformBadges } from './PlatformIcon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import { REPORT_SECTIONS, REPORT_TIMEFRAMES, REPORT_FREQUENCIES, sectionsNeedUrl } from '../../lib/reports/sections'

// ─────────────────────────────────────────────────────────────
//  Scheduled Reports Tab
//  - Digest email rapidi (Weekly / Monthly) — test "Invia ora"
//  - Builder report PDF personalizzati: scegli le tab, periodo, cadenza,
//    destinatari → salva schedulazione + "Invia ora" di test
//  - Lista schedulazioni salvate (attiva/disattiva, invia, elimina)
// ─────────────────────────────────────────────────────────────

const WEEKDAYS = [[1, 'Lun'], [2, 'Mar'], [3, 'Mer'], [4, 'Gio'], [5, 'Ven'], [6, 'Sab'], [0, 'Dom']]

export default function ScheduledReportsTab() {
  const { t, intlLocale } = useI18n()
  const [email, setEmail] = useState('')
  const [sending, setSending] = useState({})
  const [feedback, setFeedback] = useState({})

  useEffect(() => {
    const saved = localStorage.getItem('lyftai:report_recipient') || ''
    if (saved) { setEmail(saved); setRecip(saved) }
  }, [])

  const saveEmail = (v) => {
    setEmail(v)
    if (v.includes('@')) localStorage.setItem('lyftai:report_recipient', v)
  }

  const sendNow = async (type) => {
    if (!email.includes('@')) {
      setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: t('sched.invalidEmail', null, 'Inserisci una email valida') } }))
      return
    }
    setSending(prev => ({ ...prev, [type]: true }))
    setFeedback(prev => ({ ...prev, [type]: null }))
    try {
      const res = await fetch('/api/scheduled-reports/send', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, email }),
      })
      const j = await res.json()
      if (j.ok) setFeedback(prev => ({ ...prev, [type]: { ok: true, msg: t('sched.sentTo', { to: j.sent_to, id: j.message_id?.slice(0, 12) || 'ok' }, 'Inviato a {to}') } }))
      else setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: j.error || t('sched.sendError', null, 'Errore invio') } }))
    } catch (e) {
      setFeedback(prev => ({ ...prev, [type]: { ok: false, msg: e?.message || t('sched.networkError', null, 'Errore di rete') } }))
    } finally {
      setSending(prev => ({ ...prev, [type]: false }))
    }
  }

  // ── Builder report personalizzati ──
  const [schedules, setSchedules] = useState([])
  const [name, setName] = useState('')
  const [sel, setSel] = useState(['completo'])
  const [timeframe, setTimeframe] = useState('last_7d')
  const [frequency, setFrequency] = useState('weekly')
  const [weekday, setWeekday] = useState(1)
  const [monthday, setMonthday] = useState(1)
  const [recip, setRecip] = useState('')
  const [targetUrl, setTargetUrl] = useState('')
  const [busy, setBusy] = useState(false)
  const [bMsg, setBMsg] = useState(null)
  const needsUrl = sectionsNeedUrl(sel)

  const loadSchedules = async () => {
    try {
      const r = await fetch('/api/scheduled-reports/schedules', { cache: 'no-store' })
      const j = await r.json()
      if (Array.isArray(j.items)) setSchedules(j.items)
    } catch {}
  }
  useEffect(() => { loadSchedules() }, [])

  const toggleSection = (id) => setSel(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const buildPayload = () => ({
    name: name.trim() || t('sched.defaultName', null, 'Report personalizzato'),
    sections: sel,
    timeframe,
    frequency,
    weekday: frequency === 'weekly' ? weekday : null,
    monthday: frequency === 'monthly' ? monthday : null,
    recipients: recip.split(',').map(s => s.trim()).filter(Boolean),
    target_url: targetUrl.trim() || null,
  })

  const saveSchedule = async () => {
    setBMsg(null)
    if (!sel.length) return setBMsg({ ok: false, msg: t('sched.pickOne', null, 'Seleziona almeno un report') })
    if (!recip.split(',').some(s => s.includes('@'))) return setBMsg({ ok: false, msg: t('sched.invalidEmail', null, 'Inserisci una email valida') })
    if (needsUrl && !targetUrl.trim()) return setBMsg({ ok: false, msg: t('sched.urlRequired', null, 'SEO Audit / Website Scanner richiedono un URL') })
    setBusy(true)
    try {
      const r = await fetch('/api/scheduled-reports/schedules', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      })
      const j = await r.json()
      if (j.ok) { setBMsg({ ok: true, msg: t('sched.scheduleSaved', null, 'Schedulazione salvata') }); setName(''); loadSchedules() }
      else setBMsg({ ok: false, msg: j.error || t('sched.sendError', null, 'Errore') })
    } catch (e) { setBMsg({ ok: false, msg: e?.message }) } finally { setBusy(false) }
  }

  const sendCustomNow = async () => {
    setBMsg(null)
    if (!sel.length) return setBMsg({ ok: false, msg: t('sched.pickOne', null, 'Seleziona almeno un report') })
    if (!recip.split(',').some(s => s.includes('@'))) return setBMsg({ ok: false, msg: t('sched.invalidEmail', null, 'Inserisci una email valida') })
    if (needsUrl && !targetUrl.trim()) return setBMsg({ ok: false, msg: t('sched.urlRequired', null, 'SEO Audit / Website Scanner richiedono un URL') })
    setBusy(true)
    try {
      const r = await fetch('/api/scheduled-reports/send-custom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...buildPayload(), locale: getClientLocale() }),
      })
      const j = await r.json()
      if (j.ok) setBMsg({ ok: true, msg: t('sched.customSent', { n: j.attachments, to: (j.sent_to || []).join(', ') }, '{n} PDF inviati a {to}') })
      else setBMsg({ ok: false, msg: j.error || t('sched.sendError', null, 'Errore') })
    } catch (e) { setBMsg({ ok: false, msg: e?.message }) } finally { setBusy(false) }
  }

  const [rowBusy, setRowBusy] = useState({})
  const sendScheduleNow = async (id) => {
    setRowBusy(p => ({ ...p, [id]: true }))
    try {
      const r = await fetch('/api/scheduled-reports/send-custom', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scheduleId: id, locale: getClientLocale() }),
      })
      const j = await r.json()
      setRowBusy(p => ({ ...p, [id]: j.ok ? 'ok' : 'err' }))
      setTimeout(() => setRowBusy(p => ({ ...p, [id]: false })), 3000)
    } catch { setRowBusy(p => ({ ...p, [id]: 'err' })) }
  }

  const toggleEnabled = async (s) => {
    setSchedules(list => list.map(x => x.id === s.id ? { ...x, enabled: !x.enabled } : x))
    try { await fetch('/api/scheduled-reports/schedules', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: s.id, enabled: !s.enabled }) }) } catch {}
  }

  const delSchedule = async (id) => {
    setSchedules(list => list.filter(x => x.id !== id))
    try { await fetch(`/api/scheduled-reports/schedules?id=${id}`, { method: 'DELETE' }) } catch {}
  }

  const cadenceLabel = (s) => {
    if (s.frequency === 'daily') return t('sched.everyDay', null, 'Ogni giorno')
    if (s.frequency === 'weekly') return `${t('sched.every', null, 'Ogni')} ${(WEEKDAYS.find(w => w[0] === s.weekday) || [1, 'Lun'])[1]}`
    return `${t('sched.dayOfMonth', null, 'Giorno')} ${s.monthday || 1}`
  }

  const inputStyle = {
    width: '100%', background: 'var(--glass)', border: '1px solid var(--border)',
    color: 'var(--text)', borderRadius: 10, padding: '11px 13px', fontSize: 14, fontWeight: 600, outline: 'none',
  }
  const labelStyle = { fontSize: 11, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* HEADER */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <span style={{ width: 42, height: 42, borderRadius: 11, background: 'rgba(34,197,94,0.14)', color: '#22c55e', display: 'grid', placeItems: 'center' }}><Icon name="mail" size={16} /></span>
        <div style={{ flex: 1, minWidth: 200 }}>
          <div style={{ fontSize: 9.5, color: '#22c55e', fontWeight: 800, letterSpacing: '0.16em', textTransform: 'uppercase' }}>Scheduled Reports</div>
          <div style={{ fontSize: 18, fontWeight: 900, color: 'var(--text)', marginTop: 4, letterSpacing: '-0.02em' }}>
            {t('sched.title2', null, 'Report PDF automatici di ogni tab + report personalizzati')}
          </div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4 }}>
            {t('sched.subtitle2', null, 'Scegli quali report includere, il periodo e la cadenza: arrivano via email in PDF, in automatico.')}
          </div>
        </div>
      </div>

      {/* RECIPIENT */}
      <div className="glass-card-static" style={{ padding: 22 }}>
        <div style={labelStyle}>{t('sched.recipientEmail', null, 'Email destinatario (default)')}</div>
        <input type="email" value={email} onChange={e => saveEmail(e.target.value)} placeholder={t('sched.emailPh', null, 'es. tuonome@brand.com')} style={inputStyle} />
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>
          {t('sched.localNote', null, 'Salvata localmente e usata come destinatario di default per i nuovi report.')}
        </div>
      </div>

      {/* QUICK DIGEST TEST */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 14 }}>
        <ReportCard title={t('sched.weeklyDigest', null, 'Weekly Digest (email)')} subtitle={t('sched.weeklyTime', null, 'Ogni lunedì 09:00 UTC')}
          description={t('sched.weeklyDesc', null, 'Email HTML con KPI chiave (Shopify + Meta), Top 5 prodotti e confronto vs settimana precedente.')}
          nextRun={nextMonday(intlLocale)} onSend={() => sendNow('weekly')} sending={sending.weekly} feedback={feedback.weekly} />
        <ReportCard title={t('sched.monthlyDigest', null, 'Monthly Digest (email)')} subtitle={t('sched.monthlyTime', null, 'Il 1° del mese 09:00 UTC')}
          description={t('sched.monthlyDesc', null, 'Stesso layout del weekly ma sul periodo last_30d. Ideale per stakeholder.')}
          nextRun={nextFirstOfMonth(intlLocale)} onSend={() => sendNow('monthly')} sending={sending.monthly} feedback={feedback.monthly} />
      </div>

      {/* BUILDER */}
      <div className="glass-card-static" style={{ padding: 22 }}>
        <div style={{ fontSize: 16, fontWeight: 900, color: 'var(--text)', marginBottom: 4 }}>{t('sched.builderTitle', null, 'Crea un report personalizzato')}</div>
        <div style={{ fontSize: 12.5, color: 'var(--text2)', marginBottom: 18 }}>{t('sched.builderDesc', null, 'Seleziona i report (uno o più), il periodo e la cadenza. Ogni report viene allegato in PDF.')}</div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>{t('sched.name', null, 'Nome report')}</div>
          <input value={name} onChange={e => setName(e.target.value)} placeholder={t('sched.namePh', null, 'es. Report settimanale management')} style={inputStyle} />
        </div>

        <div style={{ marginBottom: 16 }}>
          <div style={labelStyle}>{t('sched.chooseReports', null, 'Report da includere')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 8 }}>
            {REPORT_SECTIONS.map(s => {
              const on = sel.includes(s.id)
              return (
                <button key={s.id} onClick={() => toggleSection(s.id)} style={{
                  display: 'flex', alignItems: 'center', gap: 9, textAlign: 'left',
                  padding: '11px 13px', borderRadius: 10, cursor: 'pointer',
                  background: on ? 'rgba(34,197,94,0.12)' : 'var(--glass)',
                  border: `1px solid ${on ? 'rgba(34,197,94,0.45)' : 'var(--border)'}`,
                  color: on ? '#86efac' : 'var(--text2)', fontWeight: 700, fontSize: 13,
                }}>
                  <span style={{ width: 16, height: 16, borderRadius: 5, flexShrink: 0, display: 'grid', placeItems: 'center', border: `1px solid ${on ? '#22c55e' : 'var(--border3)'}`, background: on ? '#22c55e' : 'transparent', color: '#04240f', fontSize: 11, fontWeight: 900 }}>{on ? '✓' : ''}</span>
                  {t(`sched.sec_${s.id}`, null, s.label)}
                </button>
              )
            })}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 16 }}>
          <div>
            <div style={labelStyle}>{t('sched.period', null, 'Periodo dati')}</div>
            <select value={timeframe} onChange={e => setTimeframe(e.target.value)} style={inputStyle}>
              {REPORT_TIMEFRAMES.map(tf => <option key={tf} value={tf} style={{ background: 'var(--surface)' }}>{t(`sched.tf_${tf}`, null, tf)}</option>)}
            </select>
          </div>
          <div>
            <div style={labelStyle}>{t('sched.frequency', null, 'Cadenza')}</div>
            <select value={frequency} onChange={e => setFrequency(e.target.value)} style={inputStyle}>
              {REPORT_FREQUENCIES.map(f => <option key={f} value={f} style={{ background: 'var(--surface)' }}>{t(`sched.freq_${f}`, null, f)}</option>)}
            </select>
          </div>
          {frequency === 'weekly' && (
            <div>
              <div style={labelStyle}>{t('sched.weekday', null, 'Giorno settimana')}</div>
              <select value={weekday} onChange={e => setWeekday(+e.target.value)} style={inputStyle}>
                {WEEKDAYS.map(([v, l]) => <option key={v} value={v} style={{ background: 'var(--surface)' }}>{l}</option>)}
              </select>
            </div>
          )}
          {frequency === 'monthly' && (
            <div>
              <div style={labelStyle}>{t('sched.monthday', null, 'Giorno del mese')}</div>
              <select value={monthday} onChange={e => setMonthday(+e.target.value)} style={inputStyle}>
                {Array.from({ length: 28 }, (_, i) => i + 1).map(d => <option key={d} value={d} style={{ background: 'var(--surface)' }}>{d}</option>)}
              </select>
            </div>
          )}
        </div>

        {needsUrl && (
          <div style={{ marginBottom: 18 }}>
            <div style={labelStyle}>{t('sched.targetUrl', null, 'URL da analizzare (SEO Audit / Website Scanner)')}</div>
            <input value={targetUrl} onChange={e => setTargetUrl(e.target.value)} placeholder="https://stmnfitness.com/products/..." style={{ ...inputStyle, fontFamily: 'monospace' }} />
            <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 8 }}>{t('sched.urlHint', null, 'La pagina viene analizzata di nuovo a ogni invio, così il report è sempre aggiornato.')}</div>
          </div>
        )}

        <div style={{ marginBottom: 18 }}>
          <div style={labelStyle}>{t('sched.recipients', null, 'Destinatari (separati da virgola)')}</div>
          <input value={recip} onChange={e => setRecip(e.target.value)} placeholder="mario@brand.com, team@brand.com" style={inputStyle} />
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button onClick={saveSchedule} disabled={busy} style={primaryBtn(busy)}>
            <Icon name="clock" size={15} /> {busy ? t('sched.saving', null, 'Salvo…') : t('sched.saveSchedule', null, 'Salva schedulazione')}
          </button>
          <button onClick={sendCustomNow} disabled={busy} style={ghostBtn(busy)}>
            <Icon name="mail" size={15} /> {busy ? t('sched.sending', null, 'Invio…') : t('sched.sendTest', null, 'Invia ora (test)')}
          </button>
        </div>
        {bMsg && (
          <div style={{ marginTop: 12, padding: '9px 13px', borderRadius: 8, background: bMsg.ok ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', color: bMsg.ok ? '#86efac' : '#fca5a5', fontSize: 12.5, fontWeight: 600 }}>{bMsg.msg}</div>
        )}
      </div>

      {/* SCHEDULES LIST */}
      {schedules.length > 0 && (
        <div className="glass-card-static" style={{ padding: 22 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)', marginBottom: 14 }}>{t('sched.savedSchedules', null, 'Schedulazioni attive')} ({schedules.length})</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {schedules.map(s => (
              <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', flexWrap: 'wrap', opacity: s.enabled ? 1 : 0.55 }}>
                <div style={{ flex: 1, minWidth: 200 }}>
                  <div style={{ fontSize: 14, fontWeight: 800, color: 'var(--text)' }}>{s.name}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3, display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
                    <span>{cadenceLabel(s)}</span><span>·</span>
                    <span>{t(`sched.tf_${s.timeframe}`, null, s.timeframe)}</span><span>·</span>
                    <span>{(s.sections || []).map(id => (REPORT_SECTIONS.find(x => x.id === id)?.label) || id).join(', ')}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{(s.recipients || []).join(', ')}</div>
                </div>
                <button onClick={() => sendScheduleNow(s.id)} disabled={!!rowBusy[s.id] && rowBusy[s.id] !== 'ok' && rowBusy[s.id] !== 'err'} title={t('sched.sendNowTitle', null, 'Invia adesso')} style={iconBtn}>
                  {rowBusy[s.id] === 'ok' ? '✓' : rowBusy[s.id] === 'err' ? '⚠' : rowBusy[s.id] ? '…' : <Icon name="mail" size={15} />}
                </button>
                <button onClick={() => toggleEnabled(s)} title={s.enabled ? t('sched.pause', null, 'Sospendi') : t('sched.resume', null, 'Riattiva')} style={{ ...iconBtn, color: s.enabled ? '#86efac' : 'var(--text3)' }}>
                  {s.enabled ? '⏸' : '▶'}
                </button>
                <button onClick={() => delSchedule(s.id)} title={t('sched.delete', null, 'Elimina')} style={{ ...iconBtn, color: 'var(--text3)' }}>×</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const primaryBtn = (busy) => ({ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid rgba(34,197,94,0.4)', background: busy ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.14)', color: busy ? 'var(--text3)' : '#86efac', borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' })
const ghostBtn = (busy) => ({ display: 'flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text2)', borderRadius: 10, padding: '11px 18px', fontSize: 13, fontWeight: 800, cursor: busy ? 'wait' : 'pointer' })
const iconBtn = { display: 'grid', placeItems: 'center', width: 38, height: 38, borderRadius: 9, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text2)', cursor: 'pointer', fontSize: 16 }

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
      <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', marginBottom: 14 }}>
        <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, letterSpacing: '0.10em', textTransform: 'uppercase', marginBottom: 4 }}>{t('sched.nextAuto', null, 'Prossimo invio automatico')}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{nextRun}</div>
      </div>
      <button type="button" onClick={onSend} disabled={sending} style={{ width: '100%', border: '1px solid var(--border)', background: sending ? 'rgba(255,255,255,0.04)' : 'rgba(34,197,94,0.12)', color: sending ? 'var(--text3)' : '#22c55e', borderRadius: 10, padding: '11px 14px', fontSize: 13, fontWeight: 800, cursor: sending ? 'wait' : 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {sending ? t('sched.sending', null, 'Invio…') : t('sched.sendNow', null, 'Invia digest ora (test)')}
      </button>
      {feedback && (
        <div style={{ marginTop: 10, padding: '8px 12px', borderRadius: 8, background: feedback.ok ? 'rgba(34,197,94,0.10)' : 'rgba(239,68,68,0.10)', color: feedback.ok ? '#86efac' : '#fca5a5', fontSize: 12, fontWeight: 600 }}>{feedback.msg}</div>
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
