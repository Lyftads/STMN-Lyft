'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts'

// ── Formatters ────────────────────────────────────────────────
const euro0Fmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const euro2Fmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const num0Fmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
})

const pct1Fmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 1,
  maximumFractionDigits: 1,
})

const pct2Fmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const dec2Fmt = new Intl.NumberFormat('it-IT', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const toNum = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const hasVal = v => v != null && Number.isFinite(Number(v))

const f0 = n => hasVal(n) && Number(n) > 0 ? `€${euro0Fmt.format(Number(n))}` : '—'
const f0z = n => hasVal(n) ? `€${euro0Fmt.format(Number(n))}` : '—'
const f2 = n => hasVal(n) && Number(n) > 0 ? `€${euro2Fmt.format(Number(n))}` : '—'
const f2z = n => hasVal(n) ? `€${euro2Fmt.format(Number(n))}` : '—'
const fn = n => hasVal(n) && Number(n) > 0 ? num0Fmt.format(Number(n)) : '—'
const fnz = n => hasVal(n) ? num0Fmt.format(Number(n)) : '—'
const fr = n => hasVal(n) ? dec2Fmt.format(Number(n)) : '—'
const fp1 = n => hasVal(n) ? `${pct1Fmt.format(Number(n))}%` : '—'
const fp2 = n => hasVal(n) ? `${pct2Fmt.format(Number(n))}%` : '—'

const ratioStatus = r => (r == null ? 'nd' : r < 1 ? 'bad' : r < 3 ? 'warn' : 'ok')
const ratioColor = r => ({ nd: '#64748b', bad: '#ef4444', warn: '#f59e0b', ok: '#22c55e' })[ratioStatus(r)]
const ratioLabel = r => ({ nd: 'N/D', bad: 'CRITICO', warn: 'ATTENZIONE', ok: 'OTTIMO' })[ratioStatus(r)]

const MONTHS_START = '2026-04'

// ── Date helpers ──────────────────────────────────────────────
function getWeeks() {
  const weeks = []
  let d = new Date('2025-12-29T00:00:00Z')
  const now = new Date()

  while (d <= now) {
    const end = new Date(d)
    end.setUTCDate(end.getUTCDate() + 6)

    const fmt = dt =>
      `${String(dt.getUTCDate()).padStart(2, '0')}/${String(dt.getUTCMonth() + 1).padStart(2, '0')}`

    const key = d.toISOString().slice(0, 10)

    weeks.push({
      key,
      label: `${fmt(d)} → ${fmt(end)}`,
    })

    d = new Date(d)
    d.setUTCDate(d.getUTCDate() + 7)
  }

  return weeks
}

function getMonths() {
  const out = []
  const now = new Date()
  let [y, m] = MONTHS_START.split('-').map(Number)

  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth() + 1)) {
    out.push(`${y}-${String(m).padStart(2, '0')}`)
    m++
    if (m > 12) {
      m = 1
      y++
    }
  }

  return out
}

const EMPTY = {
  fatturato: 0,
  ordini: 0,
  nuoviClienti: 0,
  googleSpend: 0,
}

const WEMPTY = {
  fatturato: 0,
  fatturNC: 0,
  fatturRC: 0,
  meta: 0,
  google: 0,
  ordini: 0,
  nc: 0,
  rc: 0,
  sessioni: 0,
}

const DEF = {
  freq: 1.69,
  life: 1.57,
  margin: 62,
}

function load() {
  try {
    return {
      m: JSON.parse(localStorage.getItem('stmn_m') || '{}'),
      c: JSON.parse(localStorage.getItem('stmn_c') || '{}'),
      w: JSON.parse(localStorage.getItem('stmn_w') || '{}'),
    }
  } catch {
    return { m: {}, c: {}, w: {} }
  }
}

const saveM = m => {
  try {
    localStorage.setItem('stmn_m', JSON.stringify(m))
  } catch {}
}

const saveC = c => {
  try {
    localStorage.setItem('stmn_c', JSON.stringify(c))
  } catch {}
}

const saveW = w => {
  try {
    localStorage.setItem('stmn_w', JSON.stringify(w))
  } catch {}
}

const safeDiv = (a, b) => (b > 0 ? a / b : null)

// ── Tooltip ───────────────────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null

  return (
    <div
      style={{
        background: '#07101f',
        border: '1px solid #1e2d47',
        borderRadius: 8,
        padding: '10px 12px',
        fontSize: 12,
        fontFamily: 'Barlow',
        fontWeight: 700,
      }}
    >
      <p style={{ color: '#94a3b8', marginBottom: 6 }}>{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color, margin: '2px 0' }}>
          {p.name}: {typeof p.value === 'number' ? dec2Fmt.format(p.value) : p.value}
        </p>
      ))}
    </div>
  )
}

// ── Variation helpers ─────────────────────────────────────────
function getVariation(curr, prev) {
  if (!hasVal(curr) || !hasVal(prev)) return null

  const current = Number(curr)
  const previous = Number(prev)
  const diff = current - previous

  if (Math.abs(diff) < 0.000001) return null

  const pct = previous !== 0 ? (diff / previous) * 100 : null

  return {
    diff,
    pct,
    positive: diff > 0,
  }
}

function formatDeltaValue(value, kind = 'number') {
  const abs = Math.abs(Number(value || 0))

  switch (kind) {
    case 'euro0':
      return `€${euro0Fmt.format(abs)}`
    case 'euro2':
      return `€${euro2Fmt.format(abs)}`
    case 'int':
      return num0Fmt.format(abs)
    case 'percent':
      return `${pct2Fmt.format(abs)}%`
    case 'ratio':
      return dec2Fmt.format(abs)
    default:
      return dec2Fmt.format(abs)
  }
}

function Delta({ current, previous, kind = 'number', align = 'left' }) {
  const v = getVariation(current, previous)
  if (!v) return null

  const sign = v.diff > 0 ? '+' : '−'
  const color = v.positive ? '#22c55e' : '#ef4444'

  return (
    <div
      style={{
        marginTop: 4,
        fontSize: 11,
        lineHeight: 1.2,
        color,
        textAlign: align,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {sign}
      {formatDeltaValue(v.diff, kind)}
      {v.pct != null ? ` (${sign}${pct1Fmt.format(Math.abs(v.pct))}%)` : ''}
    </div>
  )
}

// ── Inputs ────────────────────────────────────────────────────
function NumInput({ value, onChange, placeholder, color, isCount }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : '')

  useEffect(() => {
    if (value === 0) setRaw('')
    else if (parseFloat(raw) !== value) setRaw(String(value))
  }, [value])

  const handleChange = e => {
    const v = e.target.value
    setRaw(v)
    const n = parseFloat(v.replace(',', '.')) || 0
    onChange(n)
  }

  const preview =
    value > 0
      ? isCount
        ? num0Fmt.format(value)
        : `€${euro0Fmt.format(value)}`
      : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <input
        type="number"
        placeholder={placeholder}
        value={raw}
        onChange={handleChange}
        style={{
          background: '#091323',
          border: '1px solid #1b2740',
          borderRadius: 6,
          padding: '7px 10px',
          width: 120,
          textAlign: 'right',
          fontSize: 14,
          fontFamily: 'Barlow',
          fontWeight: 700,
          color,
          outline: 'none',
        }}
      />
      {preview && (
        <span
          style={{
            fontSize: 11,
            textAlign: 'right',
            color,
            opacity: 0.8,
            fontFamily: 'Barlow',
            fontWeight: 700,
          }}
        >
          {preview}
        </span>
      )}
    </div>
  )
}

// ── Small UI blocks ───────────────────────────────────────────
function Stat({ label, value, sub, color = '#e8e8e8', dim }) {
  return (
    <div
      style={{
        background: '#0a1020',
        border: '1px solid #111827',
        borderRadius: 10,
        padding: '16px 18px',
      }}
    >
      <div
        style={{
          fontSize: 11,
          color: '#94a3b8',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 8,
          fontFamily: 'Barlow Condensed',
          fontWeight: 700,
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontSize: dim ? 23 : 31,
          fontWeight: 800,
          color,
          fontFamily: 'Barlow',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#64748b', marginTop: 5 }}>{sub}</div>}
    </div>
  )
}

function RatioWidget({ ratio, mer }) {
  const col = ratioColor(ratio)
  const lbl = ratioLabel(ratio)

  return (
    <div
      style={{
        border: `1px solid ${col}33`,
        borderRadius: 12,
        padding: '28px 24px',
        background: `${col}08`,
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 24,
        alignItems: 'center',
      }}
    >
      <div>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 8 }}>
          Ratio LTV : CAC
        </div>
        <div style={{ fontSize: 64, fontWeight: 800, color: col, fontFamily: 'Barlow', lineHeight: 1, letterSpacing: '-0.04em' }}>
          {ratio != null ? `${fr(ratio)}:1` : '—'}
        </div>
        <div
          style={{
            display: 'inline-block',
            marginTop: 10,
            padding: '4px 10px',
            borderRadius: 20,
            background: `${col}20`,
            color: col,
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.06em',
          }}
        >
          {lbl}
        </div>
      </div>

      <div style={{ borderLeft: '1px solid #1a1a1a', paddingLeft: 24 }}>
        <div style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
          MER
        </div>
        <div style={{ fontSize: 36, fontWeight: 700, color: '#e8e8e8', fontFamily: 'Barlow', letterSpacing: '-0.03em' }}>
          {mer != null ? `${fr(mer)}x` : '—'}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 6 }}>Fatturato ÷ Spesa Ads</div>
      </div>
    </div>
  )
}

// ── Settings ──────────────────────────────────────────────────
function Settings({ cfg, onSave, onClose }) {
  const [f, setF] = useState({ ...cfg })

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(3,5,15,0.92)',
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div style={{ background: '#0a1020', border: '1px solid #1e2d47', borderRadius: 10, padding: 28, width: 340 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>Parametri LTV</span>
          <button onClick={onClose} style={{ color: '#94a3b8', background: 'none', border: 'none', fontSize: 18, cursor: 'pointer' }}>✕</button>
        </div>

        {[
          { k: 'freq', l: 'Frequenza acquisti / anno', s: '0.01', u: '×/anno' },
          { k: 'life', l: 'Vita media cliente', s: '0.01', u: 'anni' },
          { k: 'margin', l: 'Margine lordo', s: '1', u: '%' },
        ].map(({ k, l, s, u }) => (
          <div key={k} style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.07em', display: 'block', marginBottom: 6 }}>
              {l}
            </label>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="number"
                step={s}
                value={f[k]}
                onChange={e => setF(x => ({ ...x, [k]: parseFloat(e.target.value) || 0 }))}
                style={{
                  flex: 1,
                  background: 'transparent',
                  border: '1px solid #1e2d47',
                  borderRadius: 4,
                  padding: '6px 10px',
                  color: '#e8e8e8',
                  fontSize: 14,
                  fontFamily: 'Barlow',
                  fontWeight: 700,
                  textAlign: 'right',
                  outline: 'none',
                }}
              />
              <span style={{ fontSize: 12, color: '#64748b', width: 52 }}>{u}</span>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
          <button
            onClick={onClose}
            style={{
              flex: 1,
              padding: '8px',
              border: '1px solid #1e2d47',
              borderRadius: 6,
              background: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Annulla
          </button>

          <button
            onClick={() => {
              saveC(f)
              onSave(f)
              onClose()
            }}
            style={{
              flex: 1,
              padding: '8px',
              border: 'none',
              borderRadius: 6,
              background: '#22c55e',
              color: '#000',
              fontWeight: 800,
              cursor: 'pointer',
              fontSize: 13,
            }}
          >
            Salva
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Simulator ─────────────────────────────────────────────────
function Simulator({ cfg }) {
  const [s, setS] = useState({
    aov: 85,
    freq: cfg.freq || 1.69,
    life: cfg.life || 1.57,
    margin: cfg.margin || 30,
    cac: 35,
  })

  const set = (k, v) => setS(x => ({ ...x, [k]: v }))

  const ltv = s.aov * s.freq * s.life * s.margin / 100
  const ratio = s.cac > 0 ? ltv / s.cac : 0
  const cacFor3 = ltv / 3
  const aovFor3 = s.cac > 0 ? (s.cac * 3) / (s.freq * s.life * s.margin / 100) : 0

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }}>
      <div style={{ background: '#0a1020', border: '1px solid #111827', borderRadius: 8, padding: 24 }}>
        <p style={{ fontSize: 12, color: '#cbd5e1', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 20, fontWeight: 700 }}>
          Muovi i cursori
        </p>

        {[
          { k: 'aov', l: 'AOV', min: 20, max: 250, step: 1, fmt: v => `€${v}` },
          { k: 'freq', l: 'Frequenza / anno', min: 1, max: 6, step: 0.01, fmt: v => `${v.toFixed(2)}×` },
          { k: 'life', l: 'Vita media (anni)', min: 0.5, max: 6, step: 0.01, fmt: v => `${v.toFixed(2)}` },
          { k: 'margin', l: 'Margine %', min: 5, max: 80, step: 1, fmt: v => `${v}%` },
          { k: 'cac', l: 'CAC', min: 5, max: 300, step: 1, fmt: v => `€${v}` },
        ].map(({ k, l, min, max, step, fmt }) => (
          <div key={k} style={{ marginBottom: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
              <span style={{ fontSize: 11, color: '#94a3b8' }}>{l}</span>
              <span style={{ fontSize: 12, fontFamily: 'Barlow', fontWeight: 700, color: '#e8e8e8' }}>{fmt(s[k])}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={s[k]} onChange={e => set(k, parseFloat(e.target.value))} style={{ width: '100%' }} />
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <RatioWidget ratio={ratio} mer={s.cac > 0 && s.aov > 0 ? ltv / s.cac : null} />

        <div style={{ background: '#0a1020', border: '1px solid #111827', borderRadius: 8, padding: 20 }}>
          <p style={{ fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 14, fontWeight: 700, fontFamily: 'Barlow Condensed' }}>
            Per raggiungere 3:1
          </p>

          {[
            {
              l: 'CAC target',
              v: `€${euro0Fmt.format(cacFor3)}`,
              sub: `attuale €${euro0Fmt.format(s.cac)} (${cacFor3 < s.cac ? '−' : '+'} ${Math.abs(Math.round((s.cac - cacFor3) / s.cac * 100))}%)`,
            },
            {
              l: 'AOV necessario',
              v: `€${euro0Fmt.format(aovFor3)}`,
              sub: `attuale €${euro0Fmt.format(s.aov)} (+${Math.round((aovFor3 - s.aov) / s.aov * 100)}%)`,
            },
          ].map(({ l, v, sub }) => (
            <div key={l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 0', borderBottom: '1px solid #111827' }}>
              <div>
                <div style={{ fontSize: 13, color: '#e8e8e8' }}>{l}</div>
                <div style={{ fontSize: 11, color: '#64748b', marginTop: 2 }}>{sub}</div>
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, fontFamily: 'Barlow', color: '#22c55e' }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── WeeklyTab ────────────────────────────────────────────────
function WeeklyTab({ weeks, data, metaWeekly, shopifyWeekly, onUpdate, cfg, S }) {
  const metaMap = {}
  for (const m of metaWeekly || []) metaMap[m.date] = m

  const shopifyMap = {}
  for (const s of shopifyWeekly || []) shopifyMap[s.date] = s

  const allWeeks = weeks.map(({ key, label }) => {
    const d = data[key] || WEMPTY
    const mw = metaMap[key] || {}
    const sw = shopifyMap[key] || {}

    const fat = sw.fatturato > 0 ? toNum(sw.fatturato) : toNum(d.fatturato || 0)
    const fatNC = sw.fatturNC > 0 ? toNum(sw.fatturNC) : toNum(d.fatturNC || 0)

    const fallbackFatRC = Math.max(fat - fatNC, 0)
    const fatRC = sw.fatturRC > 0 ? toNum(sw.fatturRC) : toNum(d.fatturRC || fallbackFatRC)

    const ord = sw.ordini > 0 ? toNum(sw.ordini) : toNum(d.ordini || 0)
    const nc = sw.nc > 0 ? toNum(sw.nc) : toNum(d.nc || 0)
    const rc = sw.rc > 0 ? toNum(sw.rc) : toNum(d.rc || 0)

    const uniqueSessions =
      sw.uniqueSessions > 0 ? toNum(sw.uniqueSessions) : toNum(d.sessioni || 0)

    const metaSpend = mw.spend > 0 ? toNum(mw.spend) : toNum(d.meta || 0)
    const google = toNum(d.google || 0)
    const adv = metaSpend + google

    const mer = safeDiv(fat, adv)
    const aMer = safeDiv(fatNC, adv)
    const cac = safeDiv(adv, nc)
    const cpo = safeDiv(adv, ord)
    const aov = safeDiv(fat, ord)
    const aovNC = safeDiv(fatNC, nc)
    const aovRC = safeDiv(fatRC, rc)
    const retention = (nc + rc) > 0 ? (rc / (nc + rc)) * 100 : null
    const cro = safeDiv(ord, uniqueSessions) != null ? safeDiv(ord, uniqueSessions) * 100 : null
    const ltv = aov ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
    const ratio = ltv && cac ? ltv / cac : null

    return {
      key,
      label,

      fat,
      fatNC,
      fatRC,

      meta: metaSpend,
      google,
      adv,

      ord,
      nc,
      rc,
      uniqueSessions,

      mer,
      aMer,
      cac,
      cpo,
      aov,
      aovNC,
      aovRC,
      retention,
      cro,
      ltv,
      ratio,

      metaAuto: mw.spend > 0,
      shopifyAuto:
        sw.fatturato > 0 ||
        sw.fatturNC > 0 ||
        sw.fatturRC > 0 ||
        sw.ordini > 0 ||
        sw.nc > 0 ||
        sw.rc > 0 ||
        sw.uniqueSessions > 0,

      ctr: mw.ctr,
      cpcLink: mw.cpcLink,
      cpc: mw.cpcLink,
      cpm: mw.cpm,
      frequency: mw.frequency,
      freq: mw.frequency,
      impressions: mw.impressions,
      reach: mw.reach,
      linkClicks: mw.linkClicks,
    }
  })

  const filled = allWeeks.filter(
    w =>
      w.fat > 0 ||
      w.adv > 0 ||
      w.metaAuto ||
      w.shopifyAuto ||
      w.google > 0
  )

  const sum = (arr, key) => arr.reduce((s, x) => s + toNum(x[key]), 0)

  const totFat = sum(filled, 'fat')
  const totFatNC = sum(filled, 'fatNC')
  const totFatRC = sum(filled, 'fatRC')
  const totAdv = sum(filled, 'adv')
  const totMeta = sum(filled, 'meta')
  const totGoog = sum(filled, 'google')
  const totOrd = sum(filled, 'ord')
  const totNC = sum(filled, 'nc')
  const totRC = sum(filled, 'rc')
  const totSes = sum(filled, 'uniqueSessions')

  const avgMER = safeDiv(totFat, totAdv)
  const avgAMER = safeDiv(totFatNC, totAdv)
  const avgCAC = safeDiv(totAdv, totNC)
  const avgCPO = safeDiv(totAdv, totOrd)
  const avgAOV = safeDiv(totFat, totOrd)
  const avgAOVNC = safeDiv(totFatNC, totNC)
  const avgAOVRC = safeDiv(totFatRC, totRC)
  const avgRet = (totNC + totRC) > 0 ? (totRC / (totNC + totRC)) * 100 : null
  const avgCRO = safeDiv(totOrd, totSes) != null ? safeDiv(totOrd, totSes) * 100 : null
  const avgLTV = avgAOV ? avgAOV * cfg.freq * cfg.life * cfg.margin / 100 : null
  const avgRatio = avgLTV && avgCAC ? avgLTV / avgCAC : null

  const fwMeta = filled.filter(w => w.metaAuto)
  const avg = (arr, fn) => (arr.length > 0 ? arr.reduce((s, x) => s + fn(x), 0) / arr.length : null)
  const avgCTR = avg(fwMeta, w => toNum(w.ctr))
  const avgCPC = avg(fwMeta, w => toNum(w.cpc))
  const avgCPM = avg(fwMeta, w => toNum(w.cpm))
  const avgFreq = avg(fwMeta, w => toNum(w.freq))

  const TH = {
    ...S.th,
    fontSize: 12,
    padding: '12px 12px',
  }

  const TD = {
    ...S.td,
    fontSize: 15,
    padding: '11px 12px',
    verticalAlign: 'top',
  }

  const valueLineStyle = {
    fontSize: 15,
    fontWeight: 800,
    lineHeight: 1.15,
  }

  const renderAutoCell = ({ value, prevValue, color, kind = 'euro0', isCount = false }) => (
    <div>
      <div style={{ ...valueLineStyle, color }}>
        {isCount
          ? fnz(value)
          : kind === 'euro2'
            ? f2z(value)
            : f0z(value)}
      </div>
      <Delta current={value} previous={prevValue} kind={isCount ? 'int' : kind} />
    </div>
  )

  return (
    <>
      {/* INPUT TABLE */}
      <div style={{ ...S.card, marginBottom: 24 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <span style={{ fontSize: 14, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Inserimento dati settimanali
          </span>
          <span style={{ fontSize: 11, color: '#22c55e' }}>
            Shopify + Meta automatici · Google manuale
          </span>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                {[
                  'Settimana',
                  'Fatturato €',
                  'Fatt. NC €',
                  'Fatt. RC €',
                  'Meta ADS €',
                  'Google ADS €',
                  'Tot Ordini',
                  'NC #',
                  'RC #',
                  'Sessioni Uniche',
                ].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {allWeeks.map((w, i) => {
                const prev = i > 0 ? allWeeks[i - 1] : null

                return (
                  <tr key={w.key} style={{ background: i % 2 === 0 ? 'transparent' : '#07101d' }}>
                    <td style={{ ...TD, color: '#cbd5e1', fontWeight: 700, whiteSpace: 'nowrap', fontSize: 13 }}>
                      {w.label}
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto
                        ? renderAutoCell({ value: w.fat, prevValue: prev?.fat, color: '#22c55e', kind: 'euro0' })
                        : (
                          <>
                            <NumInput value={w.fat} onChange={val => onUpdate(w.key, 'fatturato', val)} placeholder="0" color="#22c55e" />
                            <Delta current={w.fat} previous={prev?.fat} kind="euro0" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto
                        ? renderAutoCell({ value: w.fatNC, prevValue: prev?.fatNC, color: '#16a34a', kind: 'euro0' })
                        : (
                          <>
                            <NumInput value={w.fatNC} onChange={val => onUpdate(w.key, 'fatturNC', val)} placeholder="0" color="#16a34a" />
                            <Delta current={w.fatNC} previous={prev?.fatNC} kind="euro0" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto
                        ? renderAutoCell({ value: w.fatRC, prevValue: prev?.fatRC, color: '#22c55e', kind: 'euro0' })
                        : (
                          <>
                            <NumInput value={w.fatRC} onChange={val => onUpdate(w.key, 'fatturRC', val)} placeholder="0" color="#22c55e" />
                            <Delta current={w.fatRC} previous={prev?.fatRC} kind="euro0" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      {w.metaAuto
                        ? renderAutoCell({ value: w.meta, prevValue: prev?.meta, color: '#3b82f6', kind: 'euro0' })
                        : (
                          <>
                            <NumInput value={w.meta} onChange={val => onUpdate(w.key, 'meta', val)} placeholder="0" color="#3b82f6" />
                            <Delta current={w.meta} previous={prev?.meta} kind="euro0" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      <NumInput value={w.google} onChange={val => onUpdate(w.key, 'google', val)} placeholder="0" color="#eab308" />
                      <Delta current={w.google} previous={prev?.google} kind="euro0" />
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto
                        ? renderAutoCell({ value: w.ord, prevValue: prev?.ord, color: '#e8e8e8', isCount: true })
                        : (
                          <>
                            <NumInput value={w.ord} onChange={val => onUpdate(w.key, 'ordini', val)} placeholder="0" color="#e8e8e8" isCount />
                            <Delta current={w.ord} previous={prev?.ord} kind="int" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto
                        ? renderAutoCell({ value: w.nc, prevValue: prev?.nc, color: '#06b6d4', isCount: true })
                        : (
                          <>
                            <NumInput value={w.nc} onChange={val => onUpdate(w.key, 'nc', val)} placeholder="0" color="#06b6d4" isCount />
                            <Delta current={w.nc} previous={prev?.nc} kind="int" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto
                        ? renderAutoCell({ value: w.rc, prevValue: prev?.rc, color: '#818cf8', isCount: true })
                        : (
                          <>
                            <NumInput value={w.rc} onChange={val => onUpdate(w.key, 'rc', val)} placeholder="0" color="#818cf8" isCount />
                            <Delta current={w.rc} previous={prev?.rc} kind="int" />
                          </>
                        )}
                    </td>

                    <td style={TD}>
                      {w.shopifyAuto && w.uniqueSessions > 0
                        ? renderAutoCell({ value: w.uniqueSessions, prevValue: prev?.uniqueSessions, color: '#f8fafc', isCount: true })
                        : (
                          <>
                            <NumInput value={w.uniqueSessions} onChange={val => onUpdate(w.key, 'sessioni', val)} placeholder="0" color="#f8fafc" isCount />
                            <Delta current={w.uniqueSessions} previous={prev?.uniqueSessions} kind="int" />
                          </>
                        )}
                    </td>
                  </tr>
                )
              })}

              <tr style={{ background: '#0a1020', borderTop: '1px solid #1e2d47' }}>
                <td style={{ ...TD, color: '#94a3b8', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Barlow Condensed' }}>
                  TOTALE
                </td>
                <td style={{ ...TD, color: '#22c55e', fontWeight: 800 }}>{f0z(totFat)}</td>
                <td style={{ ...TD, color: '#16a34a', fontWeight: 800 }}>{f0z(totFatNC)}</td>
                <td style={{ ...TD, color: '#22c55e', fontWeight: 800 }}>{f0z(totFatRC)}</td>
                <td style={{ ...TD, color: '#3b82f6', fontWeight: 800 }}>{f0z(totMeta)}</td>
                <td style={{ ...TD, color: '#eab308', fontWeight: 800 }}>{totGoog > 0 ? f0z(totGoog) : '—'}</td>
                <td style={{ ...TD, color: '#e8e8e8', fontWeight: 800 }}>{fnz(totOrd)}</td>
                <td style={{ ...TD, color: '#06b6d4', fontWeight: 800 }}>{fnz(totNC)}</td>
                <td style={{ ...TD, color: '#818cf8', fontWeight: 800 }}>{fnz(totRC)}</td>
                <td style={{ ...TD, color: '#f8fafc', fontWeight: 800 }}>{fnz(totSes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI CALCOLATI */}
      {filled.length > 0 && (
        <div style={{ ...S.card, marginBottom: 24 }}>
          <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 16 }}>
            KPI calcolati
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Sett.',
                    'Fatt.',
                    'Fatt. NC',
                    'Fatt. RC',
                    'ADV',
                    'MER',
                    'aMER',
                    'CAC',
                    'CPO',
                    'AOV',
                    'AOV NC',
                    'AOV RC',
                    'Ret%',
                    'CRO%',
                    'CTR%',
                    'CPC',
                    'CPM',
                    'Freq.',
                    'LTV',
                    'Ratio',
                  ].map(h => (
                    <th key={h} style={{ ...TH, fontSize: 11 }}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filled.map((w, i) => {
                  const prev = i > 0 ? filled[i - 1] : null

                  return (
                    <tr key={w.key} style={{ background: i % 2 === 0 ? 'transparent' : '#07101d' }}>
                      <td style={{ ...TD, color: '#cbd5e1', fontSize: 12, fontWeight: 700, whiteSpace: 'nowrap' }}>{w.label}</td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#22c55e' }}>{f0z(w.fat)}</div>
                        <Delta current={w.fat} previous={prev?.fat} kind="euro0" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#16a34a' }}>{f0z(w.fatNC)}</div>
                        <Delta current={w.fatNC} previous={prev?.fatNC} kind="euro0" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#22c55e' }}>{f0z(w.fatRC)}</div>
                        <Delta current={w.fatRC} previous={prev?.fatRC} kind="euro0" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#94a3b8' }}>{w.adv > 0 ? f0z(w.adv) : '—'}</div>
                        <Delta current={w.adv} previous={prev?.adv} kind="euro0" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: w.mer != null ? (w.mer >= 3 ? '#22c55e' : w.mer >= 2 ? '#f59e0b' : '#ef4444') : '#64748b' }}>
                          {w.mer != null ? `${fr(w.mer)}×` : '—'}
                        </div>
                        <Delta current={w.mer} previous={prev?.mer} kind="ratio" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: w.aMer != null ? (w.aMer >= 2 ? '#22c55e' : w.aMer >= 1.5 ? '#f59e0b' : '#ef4444') : '#64748b' }}>
                          {w.aMer != null ? `${fr(w.aMer)}×` : '—'}
                        </div>
                        <Delta current={w.aMer} previous={prev?.aMer} kind="ratio" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#f8fafc' }}>{w.cac ? f2z(w.cac) : '—'}</div>
                        <Delta current={w.cac} previous={prev?.cac} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#f8fafc' }}>{w.cpo ? f2z(w.cpo) : '—'}</div>
                        <Delta current={w.cpo} previous={prev?.cpo} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#3b82f6' }}>{w.aov ? f2z(w.aov) : '—'}</div>
                        <Delta current={w.aov} previous={prev?.aov} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#16a34a' }}>{w.aovNC ? f2z(w.aovNC) : '—'}</div>
                        <Delta current={w.aovNC} previous={prev?.aovNC} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#22c55e' }}>{w.aovRC ? f2z(w.aovRC) : '—'}</div>
                        <Delta current={w.aovRC} previous={prev?.aovRC} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#818cf8' }}>{w.retention != null ? fp1(w.retention) : '—'}</div>
                        <Delta current={w.retention} previous={prev?.retention} kind="percent" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#94a3b8' }}>{w.cro != null ? fp2(w.cro) : '—'}</div>
                        <Delta current={w.cro} previous={prev?.cro} kind="percent" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#60a5fa' }}>{w.ctr != null ? fp2(w.ctr) : '—'}</div>
                        <Delta current={w.ctr} previous={prev?.ctr} kind="percent" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#93c5fd' }}>{w.cpc != null ? f2z(w.cpc) : '—'}</div>
                        <Delta current={w.cpc} previous={prev?.cpc} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#7dd3fc' }}>{w.cpm != null ? f2z(w.cpm) : '—'}</div>
                        <Delta current={w.cpm} previous={prev?.cpm} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#bae6fd' }}>{w.freq != null ? fr(w.freq) : '—'}</div>
                        <Delta current={w.freq} previous={prev?.freq} kind="ratio" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: '#f8fafc' }}>{w.ltv ? f2z(w.ltv) : '—'}</div>
                        <Delta current={w.ltv} previous={prev?.ltv} kind="euro2" />
                      </td>

                      <td style={TD}>
                        <div style={{ ...valueLineStyle, color: ratioColor(w.ratio), fontSize: 17 }}>
                          {w.ratio ? `${fr(w.ratio)}:1` : '—'}
                        </div>
                        <Delta current={w.ratio} previous={prev?.ratio} kind="ratio" />
                      </td>
                    </tr>
                  )
                })}

                <tr style={{ background: '#0a1020', borderTop: '1px solid #1e2d47' }}>
                  <td style={{ ...TD, color: '#94a3b8', fontWeight: 800, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Barlow Condensed' }}>
                    MEDIA
                  </td>
                  <td style={{ ...TD, color: '#22c55e', fontWeight: 800 }}>{filled.length ? f0z(totFat / filled.length) : '—'}</td>
                  <td style={{ ...TD, color: '#16a34a', fontWeight: 800 }}>{filled.length ? f0z(totFatNC / filled.length) : '—'}</td>
                  <td style={{ ...TD, color: '#22c55e', fontWeight: 800 }}>{filled.length ? f0z(totFatRC / filled.length) : '—'}</td>
                  <td style={{ ...TD, color: '#94a3b8', fontWeight: 800 }}>{totAdv > 0 ? f0z(totAdv / filled.length) : '—'}</td>
                  <td style={{ ...TD, color: avgMER != null ? (avgMER >= 3 ? '#22c55e' : avgMER >= 2 ? '#f59e0b' : '#ef4444') : '#64748b', fontWeight: 800 }}>
                    {avgMER != null ? `${fr(avgMER)}×` : '—'}
                  </td>
                  <td style={{ ...TD, color: avgAMER != null ? (avgAMER >= 2 ? '#22c55e' : avgAMER >= 1.5 ? '#f59e0b' : '#ef4444') : '#64748b', fontWeight: 800 }}>
                    {avgAMER != null ? `${fr(avgAMER)}×` : '—'}
                  </td>
                  <td style={{ ...TD, fontWeight: 800 }}>{avgCAC ? f2z(avgCAC) : '—'}</td>
                  <td style={{ ...TD, fontWeight: 800 }}>{avgCPO ? f2z(avgCPO) : '—'}</td>
                  <td style={{ ...TD, color: '#3b82f6', fontWeight: 800 }}>{avgAOV ? f2z(avgAOV) : '—'}</td>
                  <td style={{ ...TD, color: '#16a34a', fontWeight: 800 }}>{avgAOVNC ? f2z(avgAOVNC) : '—'}</td>
                  <td style={{ ...TD, color: '#22c55e', fontWeight: 800 }}>{avgAOVRC ? f2z(avgAOVRC) : '—'}</td>
                  <td style={{ ...TD, color: '#818cf8', fontWeight: 800 }}>{avgRet != null ? fp1(avgRet) : '—'}</td>
                  <td style={{ ...TD, color: '#94a3b8', fontWeight: 800 }}>{avgCRO != null ? fp2(avgCRO) : '—'}</td>
                  <td style={{ ...TD, color: '#60a5fa', fontWeight: 800 }}>{avgCTR != null ? fp2(avgCTR) : '—'}</td>
                  <td style={{ ...TD, color: '#93c5fd', fontWeight: 800 }}>{avgCPC != null ? f2z(avgCPC) : '—'}</td>
                  <td style={{ ...TD, color: '#7dd3fc', fontWeight: 800 }}>{avgCPM != null ? f2z(avgCPM) : '—'}</td>
                  <td style={{ ...TD, color: '#bae6fd', fontWeight: 800 }}>{avgFreq != null ? fr(avgFreq) : '—'}</td>
                  <td style={{ ...TD, fontWeight: 800 }}>{avgLTV ? f2z(avgLTV) : '—'}</td>
                  <td style={{ ...TD, fontWeight: 900, fontFamily: 'Barlow', fontSize: 17, color: ratioColor(avgRatio) }}>
                    {avgRatio ? `${fr(avgRatio)}:1` : '—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* WEEKLY CHARTS */}
      {filled.length > 0 && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Fatturato vs Investimento ADV
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={filled} margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Barlow' }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="fat" name="Fatturato" fill="#22c55e" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="meta" name="Meta ADS" fill="#3b82f6" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="google" name="Google ADS" fill="#eab308" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                MER settimanale
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filled} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}×`} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="mer" name="MER" stroke="#22c55e" strokeWidth={2} dot={{ r: 3, fill: '#22c55e' }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 16 }}>
            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                CAC settimanale
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filled} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="cac" name="CAC €" stroke="#e8e8e8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                CRO % + Retention %
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={filled} margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v.toFixed(1)}%`} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="cro" name="CRO %" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line dataKey="retention" name="Retention %" stroke="#818cf8" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Nuovi Clienti vs Clienti di Ritorno
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={filled} margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="nc" name="NC" fill="#06b6d4" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="rc" name="RC" fill="#818cf8" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 14 }}>
                Sessioni uniche settimanali
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={filled} margin={{ top: 0, right: 8, left: 0, bottom: 0 }} barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => v.slice(0, 5)} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="uniqueSessions" name="Sessioni uniche" fill="#f8fafc" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Main App ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('dashboard')
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cfg, setCfg] = useState(DEF)
  const [showCfg, setShowCfg] = useState(false)
  const [months, setMonths] = useState({})
  const [weeks, setWeeks] = useState({})
  const [updated, setUpdated] = useState(null)

  const avail = getMonths()

  useEffect(() => {
    const s = load()
    if (s.c && Object.keys(s.c).length) setCfg({ ...DEF, ...s.c })
    if (s.m) setMonths(s.m)
    if (s.w) setWeeks(s.w)
  }, [])

  const fetchLive = useCallback(async () => {
    setLoading(true)
    try {
      const r = await fetch('/api/metrics')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setLive(await r.json())
      setUpdated(new Date())
    } catch (e) {
      console.log(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchLive()
  }, [fetchLive])

  const updateWeek = (week, key, value) => {
    setWeeks(prev => {
      const next = {
        ...prev,
        [week]: {
          ...(prev[week] || WEMPTY),
          [key]: value,
        },
      }
      saveW(next)
      return next
    })
  }

  const updateMonth = (month, key, value) => {
    setMonths(prev => {
      const next = {
        ...prev,
        [month]: {
          ...(prev[month] || EMPTY),
          [key]: value,
        },
      }
      saveM(next)
      return next
    })
  }

  const data = avail.map(month => {
    const d = months[month] || EMPTY
    const metaSpend = (live?.metaMonthly || []).find(x => x.month === month)?.spend || 0
    const totalSpend = metaSpend + (d.googleSpend || 0)
    const fatturato = d.fatturato || 0
    const ordini = d.ordini || 0
    const nc = d.nuoviClienti || 0
    const aov = ordini > 0 ? fatturato / ordini : 0
    const ltv = aov > 0 ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
    const cac = totalSpend > 0 && nc > 0 ? totalSpend / nc : null
    const ratio = ltv && cac ? ltv / cac : null
    const mer = fatturato > 0 && totalSpend > 0 ? fatturato / totalSpend : null

    return {
      month,
      fatturato,
      ordini,
      nc,
      metaSpend,
      googleSpend: d.googleSpend || 0,
      totalSpend,
      aov,
      ltv,
      cac,
      ratio,
      mer,
    }
  })

  const totFat = data.reduce((s, m) => s + m.fatturato, 0)
  const totOrd = data.reduce((s, m) => s + m.ordini, 0)
  const totNC = data.reduce((s, m) => s + m.nc, 0)
  const totMeta = data.reduce((s, m) => s + m.metaSpend, 0)
  const totGoog = data.reduce((s, m) => s + m.googleSpend, 0)
  const totSpend = data.reduce((s, m) => s + m.totalSpend, 0)

  const avgAOV = totOrd > 0 ? totFat / totOrd : 0
  const ltvG = avgAOV > 0 ? avgAOV * cfg.freq * cfg.life * cfg.margin / 100 : null
  const cacG = totSpend > 0 && totNC > 0 ? totSpend / totNC : null
  const ratioG = ltvG && cacG ? ltvG / cacG : null
  const merG = totFat > 0 && totSpend > 0 ? totFat / totSpend : null

  const TABS = [
    { id: 'dashboard', l: 'Dashboard' },
    { id: 'monthly', l: 'Mensile' },
    { id: 'weekly', l: 'Weekly' },
    { id: 'simulator', l: 'Simulatore' },
  ]

  const S = {
    card: {
      background: '#0a1020',
      border: '1px solid #111827',
      borderRadius: 12,
      padding: 24,
    },
    th: {
      padding: '10px 14px',
      fontSize: 11,
      color: '#ffffff',
      textTransform: 'uppercase',
      letterSpacing: '0.1em',
      textAlign: 'left',
      fontWeight: 700,
      fontFamily: 'Barlow Condensed',
      borderBottom: '1px solid #1e2d47',
      whiteSpace: 'nowrap',
    },
    td: {
      padding: '10px 14px',
      fontSize: 14,
      borderBottom: '1px solid #0d1628',
      fontFamily: 'Barlow',
      fontWeight: 600,
    },
  }

  return (
    <div style={{ minHeight: '100vh', background: 'transparent', padding: '20px 24px', maxWidth: 1600, margin: '0 auto' }}>
      {showCfg && <Settings cfg={cfg} onSave={c => setCfg(c)} onClose={() => setShowCfg(false)} />}

      {/* HEADER */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.02em', color: '#e8e8e8' }}>STMN Fitness</div>
          <div style={{ fontSize: 11, color: '#64748b', marginTop: 2, fontFamily: 'Barlow', fontWeight: 700 }}>
            LTV:CAC • Dal 2026-04 • {updated ? updated.toLocaleString('it-IT') : '—'}
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 20,
              background: live?.sources?.shopify ? '#052e16' : '#111',
              color: live?.sources?.shopify ? '#22c55e' : '#64748b',
              border: `1px solid ${live?.sources?.shopify ? '#166534' : '#1a1a1a'}`,
            }}
          >
            Shopify {live?.sources?.shopify ? '✓' : '○'}
          </span>

          <span
            style={{
              fontSize: 10,
              padding: '3px 8px',
              borderRadius: 20,
              background: live?.sources?.meta ? '#172554' : '#111',
              color: live?.sources?.meta ? '#3b82f6' : '#64748b',
              border: `1px solid ${live?.sources?.meta ? '#1e40af' : '#1a1a1a'}`,
            }}
          >
            Meta {live?.sources?.meta ? '✓' : '○'}
          </span>

          <button
            onClick={() => setShowCfg(true)}
            style={{
              padding: '4px 10px',
              fontSize: 11,
              background: 'none',
              border: '1px solid #1e2d47',
              borderRadius: 6,
              color: '#cbd5e1',
              cursor: 'pointer',
            }}
          >
            ⚙ LTV
          </button>

          <button
            onClick={fetchLive}
            disabled={loading}
            style={{
              padding: '4px 12px',
              fontSize: 11,
              background: '#22c55e',
              color: '#000',
              border: 'none',
              borderRadius: 6,
              fontWeight: 800,
              cursor: 'pointer',
              opacity: loading ? 0.5 : 1,
            }}
          >
            {loading ? '...' : '↻ Aggiorna'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{ display: 'flex', gap: 2, marginBottom: 24, borderBottom: '1px solid #111827', paddingBottom: 0 }}>
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '10px 20px',
              fontSize: 13,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tab === t.id ? '#e8e8e8' : '#64748b',
              fontWeight: tab === t.id ? 700 : 500,
              borderBottom: tab === t.id ? '2px solid #22c55e' : '2px solid transparent',
              marginBottom: -1,
              transition: 'all .15s',
            }}
          >
            {t.l}
          </button>
        ))}
      </div>

      {/* DASHBOARD */}
      {tab === 'dashboard' && (
        <div className="fade-up">
          <div style={{ marginBottom: 24 }}>
            <RatioWidget ratio={ratioG} mer={merG} />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12, marginBottom: 24 }}>
            <Stat label="LTV Netto" value={ltvG ? f2z(ltvG) : '—'} sub={`${cfg.freq}× • ${cfg.life}a • ${cfg.margin}%`} color="#22c55e" />
            <Stat label="CAC" value={cacG ? f2z(cacG) : '—'} sub={`${fnz(totNC)} nuovi clienti`} />
            <Stat label="AOV Medio" value={avgAOV > 0 ? f2z(avgAOV) : '—'} sub={`${fnz(totOrd)} ordini`} color="#3b82f6" />
            <Stat label="Fatturato Totale" value={f0z(totFat)} sub="dal 01/04/2026" color="#22c55e" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 28 }}>
            <Stat label="Spesa Meta" value={f0z(totMeta)} color="#3b82f6" dim />
            <Stat label="Spesa Google" value={totGoog > 0 ? f0z(totGoog) : '—'} color="#eab308" dim />
            <Stat label="Spesa Totale" value={f0z(totSpend)} sub="Meta + Google" dim />
          </div>

          {data.some(m => m.ratio != null) && (
            <div style={{ ...S.card, marginBottom: 16 }}>
              <p style={{ fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, fontWeight: 700, fontFamily: 'Barlow Condensed' }}>
                Ratio LTV:CAC mensile
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '3:1', fill: '#22c55e', fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="ratio" name="Ratio" stroke="#e8e8e8" strokeWidth={2} dot={{ r: 4, fill: '#e8e8e8' }} connectNulls />
                  <Line dataKey="mer" name="MER" stroke="#22c55e" strokeWidth={2} dot={{ r: 4, fill: '#22c55e' }} strokeDasharray="4 2" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {data.some(m => m.fatturato > 0) && (
            <div style={S.card}>
              <p style={{ fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, fontWeight: 700, fontFamily: 'Barlow Condensed' }}>
                Fatturato vs Spesa Ads
              </p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data} margin={{ top: 4, right: 16, left: 0, bottom: 4 }} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="month" tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="fatturato" name="Fatturato €" fill="#22c55e" radius={[3, 3, 0, 0]} opacity={0.85} />
                  <Bar dataKey="metaSpend" name="Meta Ads €" fill="#3b82f6" radius={[3, 3, 0, 0]} opacity={0.85} />
                  <Bar dataKey="googleSpend" name="Google Ads €" fill="#eab308" radius={[3, 3, 0, 0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* MONTHLY */}
      {tab === 'monthly' && (
        <div className="fade-up">
          <div style={{ ...S.card, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
              <span style={{ fontSize: 13, color: '#fff', fontWeight: 700, fontFamily: 'Barlow Condensed', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Inserimento dati mensili
              </span>
              <span style={{ fontSize: 10, color: '#22c55e' }}>📘 Meta automatica · ⌨ Manuale</span>
            </div>

            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Mese', 'Fatturato Netto €', 'Ordini', 'Nuovi Clienti', 'Google Ads €', '✓ Totale', '📘 Meta Auto'].map(h => (
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {avail.map(month => {
                    const d = months[month] || EMPTY
                    const metaSpend = (live?.metaMonthly || []).find(x => x.month === month)?.spend || 0

                    return (
                      <tr key={month} style={{ borderBottom: '1px solid #0d1628' }}>
                        <td style={{ ...S.td, color: '#fff', fontWeight: 800 }}>{month}</td>
                        <td style={{ ...S.td, padding: '6px 8px' }}>
                          <NumInput value={d.fatturato || 0} onChange={v => updateMonth(month, 'fatturato', v)} placeholder="es. 149473" color="#22c55e" />
                        </td>
                        <td style={{ ...S.td, padding: '6px 8px' }}>
                          <NumInput value={d.ordini || 0} onChange={v => updateMonth(month, 'ordini', v)} placeholder="es. 1856" color="#3b82f6" isCount />
                        </td>
                        <td style={{ ...S.td, padding: '6px 8px' }}>
                          <NumInput value={d.nuoviClienti || 0} onChange={v => updateMonth(month, 'nuoviClienti', v)} placeholder="es. 768" color="#06b6d4" isCount />
                        </td>
                        <td style={{ ...S.td, padding: '6px 8px' }}>
                          <NumInput value={d.googleSpend || 0} onChange={v => updateMonth(month, 'googleSpend', v)} placeholder="es. 4383" color="#eab308" />
                        </td>
                        <td style={{ ...S.td, color: '#22c55e', fontWeight: 700 }}>{d.fatturato > 0 ? f0z(d.fatturato) : '—'}</td>
                        <td style={{ ...S.td, color: '#3b82f6' }}>{metaSpend > 0 ? f0z(metaSpend) : '—'}</td>
                      </tr>
                    )
                  })}

                  <tr style={{ background: '#070e1c', borderTop: '1px solid #1e2d47' }}>
                    <td style={{ ...S.td, color: '#94a3b8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Barlow Condensed' }}>
                      TOTALE
                    </td>
                    <td style={{ ...S.td, color: '#22c55e', fontWeight: 700 }}>{f0z(totFat)}</td>
                    <td style={{ ...S.td, color: '#3b82f6', fontWeight: 700 }}>{fnz(totOrd)}</td>
                    <td style={{ ...S.td, color: '#06b6d4', fontWeight: 700 }}>{fnz(totNC)}</td>
                    <td style={{ ...S.td, color: '#eab308', fontWeight: 700 }}>{totGoog > 0 ? f0z(totGoog) : '—'}</td>
                    <td style={{ ...S.td, color: '#22c55e', fontWeight: 700 }}>{f0z(totFat)}</td>
                    <td style={{ ...S.td, color: '#3b82f6', fontWeight: 700 }}>{f0z(totMeta)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {data.some(m => m.ratio != null || m.mer != null) && (
            <div style={{ ...S.card, marginBottom: 24 }}>
              <p style={{ fontSize: 12, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.12em', marginBottom: 16, fontWeight: 700, fontFamily: 'Barlow Condensed' }}>
                KPI calcolati
              </p>

              <div style={{ overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr>
                      {['Mese', 'AOV', 'Spesa Totale', 'CAC', 'LTV', 'Ratio', 'MER'].map(h => (
                        <th key={h} style={{ ...S.th, color: '#ffffff', fontWeight: 700 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((m, i) => (
                      <tr key={m.month} style={{ background: i % 2 === 0 ? 'transparent' : '#0a0a0a' }}>
                        <td style={{ ...S.td, color: '#fff', fontWeight: 800 }}>{m.month}</td>
                        <td style={{ ...S.td, color: '#e8e8e8' }}>{m.aov > 0 ? f2z(m.aov) : '—'}</td>
                        <td style={{ ...S.td, color: '#94a3b8' }}>{m.totalSpend > 0 ? f0z(m.totalSpend) : '—'}</td>
                        <td style={{ ...S.td, color: '#e8e8e8' }}>{m.cac ? f2z(m.cac) : '—'}</td>
                        <td style={{ ...S.td, color: '#e8e8e8' }}>{m.ltv ? f2z(m.ltv) : '—'}</td>
                        <td style={{ ...S.td, fontWeight: 700, fontFamily: 'Barlow', color: ratioColor(m.ratio) }}>{m.ratio ? `${fr(m.ratio)}:1` : '—'}</td>
                        <td style={{ ...S.td, color: '#22c55e', fontWeight: 700 }}>{m.mer ? `${fr(m.mer)}×` : '—'}</td>
                      </tr>
                    ))}

                    <tr style={{ background: '#070e1c', borderTop: '1px solid #1e2d47' }}>
                      <td style={{ ...S.td, color: '#94a3b8', fontWeight: 700, fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Barlow Condensed' }}>
                        MEDIA
                      </td>
                      <td style={{ ...S.td, color: '#e8e8e8', fontWeight: 700 }}>{avgAOV > 0 ? f2z(avgAOV) : '—'}</td>
                      <td style={{ ...S.td, color: '#94a3b8', fontWeight: 700 }}>{totSpend > 0 ? f0z(Math.round(totSpend / avail.length)) : '—'}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{cacG ? f2z(cacG) : '—'}</td>
                      <td style={{ ...S.td, fontWeight: 700 }}>{ltvG ? f2z(ltvG) : '—'}</td>
                      <td style={{ ...S.td, fontWeight: 800, fontFamily: 'Barlow', fontSize: 16, color: ratioColor(ratioG) }}>{ratioG ? `${fr(ratioG)}:1` : '—'}</td>
                      <td style={{ ...S.td, color: '#22c55e', fontWeight: 700 }}>{merG ? `${fr(merG)}×` : '—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* WEEKLY */}
      {tab === 'weekly' && (
        <div className="fade-up">
          <WeeklyTab
            weeks={getWeeks()}
            data={weeks}
            onUpdate={updateWeek}
            cfg={cfg}
            S={S}
            metaWeekly={live?.metaWeekly || []}
            shopifyWeekly={live?.shopifyWeekly || []}
          />
        </div>
      )}

      {/* SIMULATOR */}
      {tab === 'simulator' && (
        <div className="fade-up">
          <Simulator cfg={cfg} />
        </div>
      )}

      <div style={{ textAlign: 'center', fontSize: 10, color: '#334155', marginTop: 40, fontFamily: 'Barlow', fontWeight: 700 }}>
        STMN FITNESS · LTV:CAC DASHBOARD · {new Date().getFullYear()}
      </div>
    </div>
  )
}
