'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import VendroShell from './components/VendroShell'
import KPIBrainTab from './components/KPIBrainTab'
import CreativeTab from './components/CreativeTab'
import MetaDetailTab from './components/MetaDetailTab'
import PerformanceAgentTab from './components/PerformanceAgentTab'
import KlaviyoTab from './components/KlaviyoTab'
import CompetitorIntelTab from './components/CompetitorIntelTab'
import IntegrationsTab from './components/IntegrationsTab'
import CROTab from './components/CROTab'

// ── Utils ─────────────────────────────────────────────────────
const f0 = n => n>0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'
const f2 = n => n>0 ? `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
const fn = n => n>0 ? Number(n).toLocaleString('it-IT') : '—'
const fp = n => n!=null ? `${Number(n).toFixed(1)}x` : '—'
const fr = n => n!=null ? `${Number(n).toFixed(2).replace('.',',')}` : '—'

const ratioStatus = r => r==null?'nd':r<1?'bad':r<3?'warn':'ok'
const ratioColor  = r => ({nd:'#555',bad:'#ef4444',warn:'#f59e0b',ok:'#22c55e'})[ratioStatus(r)]
const ratioLabel  = r => ({nd:'N/D',bad:'CRITICO',warn:'ATTENZIONE',ok:'OTTIMO'})[ratioStatus(r)]

const MONTHS_START = '2026-01'

// Genera settimane dal 29/12/2025 a oggi (lunedì → domenica)
function getWeeks() {
  const weeks = []
  let d = new Date('2025-12-29T00:00:00Z')
  const now = new Date()
  while (d <= now) {
    const end = new Date(d); end.setUTCDate(end.getUTCDate() + 6)
    const fmt = dt => `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}`
    // key = data lunedì in YYYY-MM-DD (compatibile con Meta date_start)
    const key = d.toISOString().slice(0,10)
    weeks.push({ key, label: `${fmt(d)} → ${fmt(end)}` })
    d = new Date(d); d.setUTCDate(d.getUTCDate() + 7)
  }
  return weeks
}
function getMonths() {
  const out = [], now = new Date()
  let [y,m] = MONTHS_START.split('-').map(Number)
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth()+1)) {
    out.push(`${y}-${String(m).padStart(2,'0')}`)
    m++; if(m>12){m=1;y++}
  }
  return out
}

const EMPTY  = { fatturato:0, ordini:0, nuoviClienti:0, googleSpend:0 }
const WEMPTY = { fatturato:0, fatturNC:0, fatturRC:0, meta:0, google:0, ordini:0, nc:0, rc:0, sessioni:0 }
const DEF   = { freq:1.69, life:1.57, margin:62 }

function load() {
  try { return {
    m: JSON.parse(localStorage.getItem('stmn_m')||'{}'),
    c: JSON.parse(localStorage.getItem('stmn_c')||'{}'),
    w: JSON.parse(localStorage.getItem('stmn_w')||'{}'),
  } } catch { return { m:{}, c:{}, w:{} } }
}
const saveM = m => { try { localStorage.setItem('stmn_m', JSON.stringify(m)) } catch{} }
const saveC = c => { try { localStorage.setItem('stmn_c', JSON.stringify(c)) } catch{} }
const saveW = w => { try { localStorage.setItem('stmn_w', JSON.stringify(w)) } catch{} }

// ── Tooltip personalizzato ────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'#0a1020',border:'1px solid #1e2d47',borderRadius:6,padding:'8px 12px',fontSize:11,fontFamily:'Barlow',fontWeight:700}}>
      <p style={{color:'#888',marginBottom:4}}>{label}</p>
      {payload.map((p,i) => (
        <p key={i} style={{color:p.color}}>
          {p.name}: {typeof p.value==='number'&&p.value>100 ? f0(p.value) : p.value?.toFixed?.(2)??p.value}
        </p>
      ))}
    </div>
  )
}

// ── Numero formattato in anteprima ────────────────────────────
function NumInput({ value, onChange, placeholder, color, isCount }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : '')

  useEffect(() => {
    if (value === 0) setRaw('')
    else if (parseFloat(raw) !== value) setRaw(String(value))
  }, [value])

  const handleChange = e => {
    const v = e.target.value
    setRaw(v)
    const n = parseFloat(v.replace(',','.')) || 0
    onChange(n)
  }

  const preview = value > 0
    ? (isCount ? Number(value).toLocaleString('it-IT') : `€${Math.round(value).toLocaleString('it-IT')}`)
    : null

  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <input
        type="number"
        placeholder={placeholder}
        value={raw}
        onChange={handleChange}
        style={{
          background:'#0a1020',
          border:'1px solid #111827',
          borderRadius:4,
          padding:'4px 8px',
          width:110,
          textAlign:'right',
          fontSize:12,
          fontFamily:'Barlow',fontWeight:700,
          color: color,
          outline:'none',
        }}
        onFocus={e => e.target.style.borderColor='#333'}
        onBlur={e => e.target.style.borderColor='#1a1a1a'}
      />
      {preview && <span style={{fontSize:11,textAlign:'right',color,opacity:0.7,fontFamily:'Barlow',fontWeight:600}}>{preview}</span>}
    </div>
  )
}

// ── Stat box ──────────────────────────────────────────────────
function Stat({ label, value, sub, color='#e8e8e8', mono, dim }) {
  return (
    <div style={{
      background:'#0a1020',
      border:'1px solid #111827',
      borderRadius:8,
      padding:'14px 16px',
    }}>
      <div style={{fontSize:11,color:'#94a3b8',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8,fontFamily:'Barlow Condensed',fontWeight:700}}>{label}</div>
      <div style={{fontSize:dim?22:30,fontWeight:800,color,fontFamily:'Barlow',letterSpacing:'-0.02em'}}>{value}</div>
      {sub && <div style={{fontSize:12,color:'#64748b',marginTop:5}}>{sub}</div>}
    </div>
  )
}

// ── Ratio widget ──────────────────────────────────────────────
function RatioWidget({ ratio, mer }) {
  const col  = ratioColor(ratio)
  const lbl  = ratioLabel(ratio)
  return (
    <div style={{
      border:`1px solid ${col}33`,
      borderRadius:10,
      padding:'28px 24px',
      background:`${col}08`,
      display:'grid',
      gridTemplateColumns:'1fr 1fr',
      gap:24,
      alignItems:'center',
    }}>
      <div>
        <div style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>Ratio LTV : CAC</div>
        <div style={{fontSize:64,fontWeight:800,color:col,fontFamily:'Barlow',lineHeight:1,letterSpacing:'-0.04em'}}>
          {ratio!=null ? `${fr(ratio)}:1` : '—'}
        </div>
        <div style={{
          display:'inline-block',
          marginTop:10,
          padding:'3px 10px',
          borderRadius:20,
          background:`${col}20`,
          color:col,
          fontSize:11,
          fontWeight:600,
          letterSpacing:'0.06em',
        }}>{lbl}</div>
      </div>
      <div style={{borderLeft:'1px solid #1a1a1a',paddingLeft:24}}>
        <div style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:8}}>MER</div>
        <div style={{fontSize:36,fontWeight:700,color:'#e8e8e8',fontFamily:'Barlow',letterSpacing:'-0.03em'}}>
          {mer!=null ? `${fr(mer)}x` : '—'}
        </div>
        <div style={{fontSize:11,color:'#444',marginTop:6}}>Fatturato ÷ Spesa Ads</div>
      </div>
    </div>
  )
}

// ── Settings modal ────────────────────────────────────────────
function Settings({ cfg, onSave, onClose }) {
  const [f, setF] = useState({...cfg})
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(3,5,15,0.92)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#0a1020',border:'1px solid #1e2d47',borderRadius:10,padding:28,width:340}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontWeight:600,fontSize:15}}>Parametri LTV</span>
          <button onClick={onClose} style={{color:'#555',background:'none',border:'none',fontSize:18,cursor:'pointer'}}>✕</button>
        </div>
        {[
          {k:'freq',  l:'Frequenza acquisti / anno', s:'0.01', u:'×/anno'},
          {k:'life',  l:'Vita media cliente',         s:'0.01', u:'anni'},
          {k:'margin',l:'Margine lordo',               s:'1',    u:'%'},
        ].map(({k,l,s,u}) => (
          <div key={k} style={{marginBottom:16}}>
            <label style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6}}>{l}</label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="number" step={s} value={f[k]}
                onChange={e=>setF(x=>({...x,[k]:parseFloat(e.target.value)||0}))}
                style={{flex:1,background:'transparent',border:'1px solid #1e2d47',borderRadius:4,padding:'6px 10px',color:'#e8e8e8',fontSize:14,fontFamily:'Barlow',fontWeight:700,textAlign:'right',outline:'none'}} />
              <span style={{fontSize:12,color:'#444',width:48}}>{u}</span>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:24}}>
          <button onClick={onClose} style={{flex:1,padding:'8px',border:'1px solid #1e2d47',borderRadius:6,background:'none',color:'#888',cursor:'pointer',fontSize:13}}>Annulla</button>
          <button onClick={()=>{saveC(f);onSave(f);onClose()}} style={{flex:1,padding:'8px',border:'none',borderRadius:6,background:'#22c55e',color:'#000',fontWeight:700,cursor:'pointer',fontSize:13}}>Salva</button>
        </div>
      </div>
    </div>
  )
}

// ── Simulatore ────────────────────────────────────────────────
function Simulator({ cfg }) {
  const [s, setS] = useState({aov:85, freq:cfg.freq||1.69, life:cfg.life||1.57, margin:cfg.margin||30, cac:35})
  const set = (k,v) => setS(x=>({...x,[k]:v}))
  const ltv   = s.aov * s.freq * s.life * s.margin/100
  const ratio = s.cac > 0 ? ltv/s.cac : 0
  const col   = ratioColor(ratio)
  const cacFor3  = ltv/3
  const aovFor3  = s.cac>0 ? (s.cac*3)/(s.freq*s.life*s.margin/100) : 0

  return (
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24}}>
      <div style={{background:'#0a1020',border:'1px solid #111827',borderRadius:8,padding:24}}>
        <p style={{fontSize:12,color:'#ccc',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:20,fontWeight:700}}>Muovi i cursori</p>
        {[
          {k:'aov',   l:'AOV',                  min:20, max:250, step:1,    fmt:v=>`€${v}`},
          {k:'freq',  l:'Frequenza / anno',      min:1,  max:6,   step:0.01, fmt:v=>`${v.toFixed(2)}×`},
          {k:'life',  l:'Vita media (anni)',      min:0.5,max:6,   step:0.01, fmt:v=>`${v.toFixed(2)}`},
          {k:'margin',l:'Margine %',              min:5,  max:80,  step:1,    fmt:v=>`${v}%`},
          {k:'cac',   l:'CAC',                   min:5,  max:300, step:1,    fmt:v=>`€${v}`},
        ].map(({k,l,min,max,step,fmt}) => (
          <div key={k} style={{marginBottom:16}}>
            <div style={{display:'flex',justifyContent:'space-between',marginBottom:4}}>
              <span style={{fontSize:11,color:'#555'}}>{l}</span>
              <span style={{fontSize:12,fontFamily:'Barlow',fontWeight:700,color:'#e8e8e8'}}>{fmt(s[k])}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={s[k]}
              onChange={e=>set(k,parseFloat(e.target.value))} style={{width:'100%'}} />
          </div>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <RatioWidget ratio={ratio} mer={s.cac>0&&s.aov>0?ltv/s.cac:null} />
        <div style={{background:'#0a1020',border:'1px solid #111827',borderRadius:8,padding:20}}>
          <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>Per raggiungere 3:1</p>
          {[
            {l:'CAC target',    v:`€${Math.round(cacFor3)}`,  sub:`attuale €${s.cac} (${cacFor3<s.cac?'−':'+'} ${Math.abs(Math.round((s.cac-cacFor3)/s.cac*100))}%)`},
            {l:'AOV necessario', v:`€${Math.round(aovFor3)}`, sub:`attuale €${s.aov} (+${Math.round((aovFor3-s.aov)/s.aov*100)}%)`},
          ].map(({l,v,sub}) => (
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #111827'}}>
              <div>
                <div style={{fontSize:13,color:'#e8e8e8'}}>{l}</div>
                <div style={{fontSize:11,color:'#444',marginTop:2}}>{sub}</div>
              </div>
              <div style={{fontSize:18,fontWeight:700,fontFamily:'Barlow',color:'#22c55e'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
// ── Delta + celle KPI riutilizzabili ───────────────────────────
function DeltaMini({ current, previous, kind = 'number' }) {
  const RED = '#ef4444'
  const WHITE = '#f8fafc'

  const c = Number(current)
  const p = Number(previous)

  if (!Number.isFinite(c) || !Number.isFinite(p)) return null

  const diff = c - p
  if (Math.abs(diff) < 0.000001) return null

  const pct = p !== 0 ? diff / p * 100 : null
  const sign = diff > 0 ? '+' : '−'
  const color = diff < 0 ? RED : WHITE
  const abs = Math.abs(diff)

  const formatAbs = () => {
    if (kind === 'euro0') return `€${Math.round(abs).toLocaleString('it-IT')}`
    if (kind === 'euro2') {
      return `€${abs.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }
    if (kind === 'int') return Math.round(abs).toLocaleString('it-IT')
    if (kind === 'percent') {
      return `${abs.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
    }
    return abs.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div
      style={{
        marginTop: 8,
        display: 'grid',
        rowGap: 3,
        color,
        fontSize: 12,
        lineHeight: 1.2,
        fontWeight: 900,
        whiteSpace: 'nowrap',
      }}
    >
      <div>{sign}{formatAbs()}</div>

      {pct != null && (
        <div>
          {sign}{Math.abs(pct).toLocaleString('it-IT', {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}%
        </div>
      )}
    </div>
  )
}

function MonthlyValue({ value, previous, kind = 'euro0', suffix = '' }) {
  const WHITE = '#f8fafc'

  const money0 = n =>
    n != null && Number(n) > 0
      ? `€${Math.round(Number(n)).toLocaleString('it-IT')}`
      : '—'

  const money2 = n =>
    n != null && Number(n) > 0
      ? `€${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—'

  const int0 = n =>
    n != null && Number(n) > 0
      ? Math.round(Number(n)).toLocaleString('it-IT')
      : '—'

  const pct1 = n =>
    n != null
      ? `${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : '—'

  const pct2 = n =>
    n != null
      ? `${Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`
      : '—'

  const dec2 = n =>
    n != null
      ? Number(n).toLocaleString('it-IT', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '—'

  let shown = '—'

  if (kind === 'euro0') shown = money0(value)
  else if (kind === 'euro2') shown = money2(value)
  else if (kind === 'int') shown = int0(value)
  else if (kind === 'percent1') shown = pct1(value)
  else if (kind === 'percent2') shown = pct2(value)
  else if (kind === 'ratio') shown = value != null ? `${dec2(value)}${suffix}` : '—'
  else shown = value != null ? String(value) : '—'

  return (
    <div>
      <div
        style={{
          fontFamily: 'Barlow',
          fontWeight: 900,
          fontSize: 16,
          lineHeight: 1.15,
          color: WHITE,
          whiteSpace: 'nowrap',
        }}
      >
        {shown}
      </div>

      <DeltaMini
        current={value}
        previous={previous}
        kind={
          kind === 'percent1' || kind === 'percent2'
            ? 'percent'
            : kind
        }
      />
    </div>
  )
}

// ── WeeklyTab ─────────────────────────────────────────────────
function WeeklyTab({ weeks, data, metaWeekly, shopifyWeekly, onUpdate, cfg, S }) {
  const WHITE = '#f8fafc'
  const RED = '#ef4444'

  const money0 = n => n != null && Number(n) > 0 ? `€${Math.round(Number(n)).toLocaleString('it-IT')}` : '—'
  const money2 = n => n != null && Number(n) > 0 ? `€${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
  const int0 = n => n != null && Number(n) > 0 ? Math.round(Number(n)).toLocaleString('it-IT') : '—'
  const pct1 = n => n != null ? `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'
  const pct2 = n => n != null ? `${Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'
  const dec2 = n => n != null ? Number(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  const asNum = v => Number.isFinite(Number(v)) ? Number(v) : 0
  const div = (a, b) => b > 0 ? a / b : null

  const delta = (curr, prev) => {
    if (curr == null || prev == null) return null
    const c = Number(curr)
    const p = Number(prev)
    if (!Number.isFinite(c) || !Number.isFinite(p)) return null

    const diff = c - p
    const pct = p !== 0 ? diff / p * 100 : null
    const equal = Math.abs(diff) < 0.000001

    return { diff, pct, equal }
  }

  const formatDelta = (v, kind) => {
    const abs = Math.abs(Number(v || 0))

    if (kind === 'euro0') {
      return `€${Math.round(abs).toLocaleString('it-IT')}`
    }

    if (kind === 'euro2') {
      return `€${abs.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    if (kind === 'int') {
      return Math.round(abs).toLocaleString('it-IT')
    }

    if (kind === 'percent') {
      return `${abs.toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
    }

    return abs.toLocaleString('it-IT', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const Delta = ({ current, previous, kind = 'number' }) => {
    const d = delta(current, previous)
    if (!d || d.equal) return null

    const sign = d.diff > 0 ? '+' : '−'
    const color = d.diff < 0 ? RED : WHITE

    return (
      <div
        style={{
          marginTop: 8,
          display: 'grid',
          rowGap: 3,
          color,
          fontSize: 12,
          lineHeight: 1.2,
          fontWeight: 900,
          whiteSpace: 'nowrap',
        }}
      >
        <div>{sign}{formatDelta(d.diff, kind)}</div>

        {d.pct != null && (
          <div>
            {sign}{Math.abs(d.pct).toLocaleString('it-IT', {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}%
          </div>
        )}
      </div>
    )
  }

  const metaMap = {}
  for (const m of metaWeekly || []) {
    metaMap[m.date] = m
  }

  const shopifyMap = {}
  for (const s of shopifyWeekly || []) {
    shopifyMap[s.date] = s
  }

  const allWeeks = weeks.map(({ key, label }) => {
    const d = data[key] || WEMPTY
    const mw = metaMap[key] || {}
    const sw = shopifyMap[key] || {}

    const fat = sw.fatturato > 0 ? asNum(sw.fatturato) : asNum(d.fatturato)
    const fatNC = sw.fatturNC > 0 ? asNum(sw.fatturNC) : asNum(d.fatturNC)
    const fatRC = sw.fatturRC > 0 ? asNum(sw.fatturRC) : asNum(d.fatturRC || Math.max(fat - fatNC, 0))

    const meta = mw.spend > 0 ? asNum(mw.spend) : asNum(d.meta)
    const google = asNum(d.google)
    const adv = meta + google

    const ord = sw.ordini > 0 ? asNum(sw.ordini) : asNum(d.ordini)
    const nc = sw.nc > 0 ? asNum(sw.nc) : asNum(d.nc)
    const rc = sw.rc > 0 ? asNum(sw.rc) : asNum(d.rc)

    const ses =
      sw.uniqueSessions > 0
        ? asNum(sw.uniqueSessions)
        : sw.online_store_visitors > 0
          ? asNum(sw.online_store_visitors)
          : asNum(d.sessioni)

    const mer = div(fat, adv)
    const aMer = div(fatNC, adv)
    const cac = div(adv, nc)
    const cpo = div(adv, ord)

    const aov = div(fat, ord)
    const aovNC = div(fatNC, nc)
    const aovRC = div(fatRC, rc)

    const retention = nc + rc > 0 ? rc / (nc + rc) * 100 : null
    const cro = ses > 0 && ord > 0 ? ord / ses * 100 : null

    const ltv = aov ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
    const ratio = ltv && cac ? ltv / cac : null

    return {
      key,
      label,
      fat,
      fatNC,
      fatRC,
      meta,
      google,
      adv,
      ord,
      nc,
      rc,
      ses,
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
        sw.uniqueSessions > 0 ||
        sw.online_store_visitors > 0,
    }
  })

  const filled = allWeeks.filter(w => w.fat > 0 || w.adv > 0 || w.metaAuto || w.shopifyAuto)
  const sum = key => filled.reduce((s, w) => s + asNum(w[key]), 0)

  const totFat = sum('fat')
  const totFatNC = sum('fatNC')
  const totFatRC = sum('fatRC')
  const totAdv = sum('adv')
  const totMeta = sum('meta')
  const totGoog = sum('google')
  const totOrd = sum('ord')
  const totNC = sum('nc')
  const totRC = sum('rc')
  const totSes = sum('ses')

  const avgMER = div(totFat, totAdv)
  const avgAMER = div(totFatNC, totAdv)
  const avgCAC = div(totAdv, totNC)
  const avgCPO = div(totAdv, totOrd)

  const avgAOV = div(totFat, totOrd)
  const avgAOVNC = div(totFatNC, totNC)
  const avgAOVRC = div(totFatRC, totRC)

  const avgRet = totNC + totRC > 0 ? totRC / (totNC + totRC) * 100 : null
  const avgCRO = totSes > 0 && totOrd > 0 ? totOrd / totSes * 100 : null

  const avgLTV = avgAOV ? avgAOV * cfg.freq * cfg.life * cfg.margin / 100 : null
  const avgRatio = avgLTV && avgCAC ? avgLTV / avgCAC : null

  const chartData = filled.map(w => ({
    label: w.label,
    fatturato: w.fat,
    spesa: w.adv,
    nc: w.nc,
    rc: w.rc,
    mer: w.mer,
    aov: w.aov,
    cro: w.cro,
    ratio: w.ratio,
  }))

  const tableWrap = {
    overflow: 'auto',
    maxHeight: '72vh',
    position: 'relative',
  }

  const TH = {
    ...S.th,
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: '#081226',
    boxShadow: '0 1px 0 #1e2d47',
    fontSize: 12,
    padding: '12px 14px',
  }

  const TD = {
    ...S.td,
    fontSize: 15,
    padding: '10px 14px',
    verticalAlign: 'top',
  }

  const valueStyle = {
    fontFamily: 'Barlow',
    fontWeight: 900,
    fontSize: 16,
    lineHeight: 1.15,
  }

  const Value = ({ value, prev, kind = 'euro0', suffix = '' }) => {
    let shown = '—'

    if (kind === 'euro0') shown = money0(value)
    else if (kind === 'euro2') shown = money2(value)
    else if (kind === 'int') shown = int0(value)
    else if (kind === 'percent1') shown = pct1(value)
    else if (kind === 'percent2') shown = pct2(value)
    else if (kind === 'ratio') shown = value != null ? `${dec2(value)}${suffix}` : '—'
    else shown = value != null ? String(value) : '—'

    return (
      <div>
        <div style={{ ...valueStyle, color: WHITE }}>{shown}</div>
        <Delta
          current={value}
          previous={prev}
          kind={kind === 'percent1' || kind === 'percent2' ? 'percent' : kind}
        />
      </div>
    )
  }

  const InputOrValue = ({ week, field, value, prev, disabled, isCount = false }) => (
    disabled ? (
      <Value value={value} prev={prev} kind={isCount ? 'int' : 'euro0'} />
    ) : (
      <div>
        <NumInput
          value={value}
          onChange={val => onUpdate(week, field, val)}
          placeholder="0"
          color={WHITE}
          isCount={isCount}
        />
        <Delta current={value} previous={prev} kind={isCount ? 'int' : 'euro0'} />
      </div>
    )
  )

  return (
    <>
      <div style={{ ...S.card, marginBottom: 20 }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 16,
        }}>
          <span style={{
            fontSize: 13,
            color: '#fff',
            fontWeight: 700,
            fontFamily: 'Barlow Condensed',
            letterSpacing: '0.08em',
            textTransform: 'uppercase',
          }}>
            Inserimento dati settimanali
          </span>

          <span style={{ fontSize: 10, color: '#22c55e' }}>
            Shopify + Meta automatici · Google manuale
          </span>
        </div>

        <div style={tableWrap}>
          <table style={{ width: '100%', minWidth: 1450, borderCollapse: 'collapse' }}>
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
                  'Visitatori online',
                ].map(h => (
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>

            <tbody>
              {allWeeks.map((w, i) => {
                const p = i > 0 ? allWeeks[i - 1] : null

                return (
                  <tr key={w.key} style={{ background: i % 2 === 0 ? 'transparent' : '#080f1e' }}>
                    <td style={{
                      ...TD,
                      color: WHITE,
                      fontWeight: 900,
                      whiteSpace: 'nowrap',
                      fontSize: 16,
                    }}>
                      {w.label}
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="fatturato" value={w.fat} prev={p?.fat} disabled={w.shopifyAuto} />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="fatturNC" value={w.fatNC} prev={p?.fatNC} disabled={w.shopifyAuto} />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="fatturRC" value={w.fatRC} prev={p?.fatRC} disabled={w.shopifyAuto} />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="meta" value={w.meta} prev={p?.meta} disabled={w.metaAuto} />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="google" value={w.google} prev={p?.google} disabled={false} />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="ordini" value={w.ord} prev={p?.ord} disabled={w.shopifyAuto} isCount />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="nc" value={w.nc} prev={p?.nc} disabled={w.shopifyAuto} isCount />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="rc" value={w.rc} prev={p?.rc} disabled={w.shopifyAuto} isCount />
                    </td>

                    <td style={TD}>
                      <InputOrValue week={w.key} field="sessioni" value={w.ses} prev={p?.ses} disabled={w.shopifyAuto && w.ses > 0} isCount />
                    </td>
                  </tr>
                )
              })}

              <tr style={{ background: '#0a1020', borderTop: '1px solid #1e2d47' }}>
                <td style={{
                  ...TD,
                  color: '#94a3b8',
                  fontWeight: 900,
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  fontFamily: 'Barlow Condensed',
                }}>
                  Totale
                </td>

                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totFat)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totFatNC)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totFatRC)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totMeta)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{totGoog > 0 ? money0(totGoog) : '—'}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(totOrd)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(totNC)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(totRC)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(totSes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {filled.length > 0 && (
        <div style={{ ...S.card, marginBottom: 20 }}>
          <p style={{
            fontSize: 11,
            color: '#fff',
            fontWeight: 700,
            fontFamily: 'Barlow Condensed',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            marginBottom: 16,
          }}>
            KPI calcolati
          </p>

          <div style={tableWrap}>
            <table style={{ width: '100%', minWidth: 1600, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {[
                    'Sett.',
                    'Fatturato',
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
                    'LTV',
                    'Ratio',
                  ].map(h => (
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {filled.map((w, i) => {
                  const p = i > 0 ? filled[i - 1] : null

                  return (
                    <tr key={w.key} style={{ background: i % 2 === 0 ? 'transparent' : '#080f1e' }}>
                      <td style={{
                        ...TD,
                        color: WHITE,
                        fontSize: 16,
                        fontWeight: 900,
                        whiteSpace: 'nowrap',
                      }}>
                        {w.label}
                      </td>

                      <td style={TD}><Value value={w.fat} prev={p?.fat} kind="euro0" /></td>
                      <td style={TD}><Value value={w.fatNC} prev={p?.fatNC} kind="euro0" /></td>
                      <td style={TD}><Value value={w.fatRC} prev={p?.fatRC} kind="euro0" /></td>
                      <td style={TD}><Value value={w.adv} prev={p?.adv} kind="euro0" /></td>
                      <td style={TD}><Value value={w.mer} prev={p?.mer} kind="ratio" suffix="×" /></td>
                      <td style={TD}><Value value={w.aMer} prev={p?.aMer} kind="ratio" suffix="×" /></td>
                      <td style={TD}><Value value={w.cac} prev={p?.cac} kind="euro2" /></td>
                      <td style={TD}><Value value={w.cpo} prev={p?.cpo} kind="euro2" /></td>
                      <td style={TD}><Value value={w.aov} prev={p?.aov} kind="euro2" /></td>
                      <td style={TD}><Value value={w.aovNC} prev={p?.aovNC} kind="euro2" /></td>
                      <td style={TD}><Value value={w.aovRC} prev={p?.aovRC} kind="euro2" /></td>
                      <td style={TD}><Value value={w.retention} prev={p?.retention} kind="percent1" /></td>
                      <td style={TD}><Value value={w.cro} prev={p?.cro} kind="percent2" /></td>
                      <td style={TD}><Value value={w.ltv} prev={p?.ltv} kind="euro2" /></td>
                      <td style={TD}><Value value={w.ratio} prev={p?.ratio} kind="ratio" suffix=":1" /></td>
                    </tr>
                  )
                })}

                <tr style={{ background: '#0a1020', borderTop: '1px solid #1e2d47' }}>
                  <td style={{
                    ...TD,
                    color: '#94a3b8',
                    fontWeight: 900,
                    fontSize: 10,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                    fontFamily: 'Barlow Condensed',
                  }}>
                    Media / Totale
                  </td>

                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totFat)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totFatNC)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totFatRC)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(totAdv)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{avgMER != null ? `${dec2(avgMER)}×` : '—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{avgAMER != null ? `${dec2(avgAMER)}×` : '—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money2(avgCAC)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money2(avgCPO)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money2(avgAOV)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money2(avgAOVNC)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money2(avgAOVRC)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{avgRet != null ? pct1(avgRet) : '—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{avgCRO != null ? pct2(avgCRO) : '—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money2(avgLTV)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{avgRatio != null ? `${dec2(avgRatio)}:1` : '—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filled.length > 0 && (
        <>
          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}>
            <div style={S.card}>
              <p style={{
                fontSize: 12,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 14,
                fontWeight: 700,
                fontFamily: 'Barlow Condensed',
              }}>
                Fatturato, Spesa e MER
              </p>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${Math.round(v / 1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Legend />
                  <Line yAxisId="left" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="left" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="right" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <p style={{
                fontSize: 12,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 14,
                fontWeight: 700,
                fontFamily: 'Barlow Condensed',
              }}>
                Nuovi clienti e clienti di ritorno
              </p>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} />
                  <Legend />
                  <Line dataKey="nc" name="Nuovi clienti" stroke="#06b6d4" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line dataKey="rc" name="Clienti ritorno" stroke="#a78bfa" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 16,
            marginBottom: 16,
          }}>
            <div style={S.card}>
              <p style={{
                fontSize: 12,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 14,
                fontWeight: 700,
                fontFamily: 'Barlow Condensed',
              }}>
                AOV e CRO
              </p>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
                  <Tooltip content={<ChartTip />} />
                  <Legend />
                  <Line yAxisId="left" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                  <Line yAxisId="right" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={S.card}>
              <p style={{
                fontSize: 12,
                color: '#fff',
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                marginBottom: 14,
                fontWeight: 700,
                fontFamily: 'Barlow Condensed',
              }}>
                Ratio LTV:CAC
              </p>

              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={chartData} margin={{ top: 4, right: 16, left: 0, bottom: 4 }}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{ fill: '#94a3b8', fontSize: 9, fontFamily: 'Barlow', fontWeight: 700 }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fill: '#94a3b8', fontSize: 9 }} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} label={{ value: '3:1', fill: '#22c55e', fontSize: 10 }} />
                  <Tooltip content={<ChartTip />} />
                  <Legend />
                  <Line dataKey="ratio" name="Ratio" stroke="#f8fafc" strokeWidth={2} dot={{ r: 3 }} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────
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
    if (s.c && Object.keys(s.c).length) setCfg({...DEF,...s.c})
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
    } catch(e) { console.log(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchLive() }, [fetchLive])

  const updateWeek = (week, key, value) => {
    setWeeks(prev => {
      const next = { ...prev, [week]: { ...(prev[week]||WEMPTY), [key]: value } }
      saveW(next)
      return next
    })
  }

  const updateMonth = (month, key, value) => {
    setMonths(prev => {
      const next = { ...prev, [month]: { ...(prev[month]||EMPTY), [key]: value } }
      saveM(next)
      return next
    })
  }

  // ── Calcola dati automatici mensili da Shopify monthly + Meta + manuale Google ─────
  const asNum = v => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const safeDiv = (a, b) => {
    const x = asNum(a)
    const y = asNum(b)
    return y > 0 ? x / y : null
  }

  const monthKeyFromDate = date => {
    if (!date || typeof date !== 'string') return null
    return date.slice(0, 7)
  }

  const emptyMonth = month => ({
    month,
    fatturato: 0,
    fatturNC: 0,
    fatturRC: 0,
    resi: 0,
    resiNC: 0,
    resiRC: 0,
    ordini: 0,
    nc: 0,
    rc: 0,
    sessioni: 0,
    metaSpend: 0,
    googleSpend: 0,
    impressions: 0,
    reach: 0,
    linkClicks: 0,
    metaRows: 0,
  })

  const monthlyAutoMap = {}

  // Crea sempre i mesi disponibili, così ogni mese nuovo appare automaticamente.
  for (const month of avail) {
    monthlyAutoMap[month] = emptyMonth(month)
  }

  // Shopify monthly (mese di calendario, dal backend - NIENTE aggregazione da weekly)
  for (const row of live?.shopifyMonthly || []) {
    const month = row?.month
    if (!month) continue

    if (!monthlyAutoMap[month]) {
      monthlyAutoMap[month] = emptyMonth(month)
    }

    // Assegnazione diretta (no +=): il backend ritorna già il totale del mese
    monthlyAutoMap[month].fatturato = asNum(row.fatturato)
    monthlyAutoMap[month].fatturNC = asNum(row.fatturNC)
    monthlyAutoMap[month].fatturRC = asNum(row.fatturRC)
    monthlyAutoMap[month].resi = asNum(row.resi)
    monthlyAutoMap[month].resiNC = asNum(row.resiNC)
    monthlyAutoMap[month].resiRC = asNum(row.resiRC)
    monthlyAutoMap[month].ordini = asNum(row.ordini)
    monthlyAutoMap[month].nc = asNum(row.nc)
    monthlyAutoMap[month].rc = asNum(row.rc)
    monthlyAutoMap[month].sessioni = asNum(row.uniqueSessions || row.sessioni)
  }

  // Meta monthly (mese di calendario, dal backend)
  for (const row of live?.metaMonthly || []) {
    const month = row?.month
    if (!month) continue

    if (!monthlyAutoMap[month]) {
      monthlyAutoMap[month] = emptyMonth(month)
    }

    monthlyAutoMap[month].metaSpend = asNum(row.spend)
  }

  // Meta weekly → aggregazione mensile SOLO come fallback per metriche aux
  // (impressions, reach, linkClicks) che non arrivano in metaMonthly.
  // Non riassegna metaSpend se è già arrivato dal monthly.
  for (const row of live?.metaWeekly || []) {
    const month = monthKeyFromDate(row?.date)
    if (!month) continue

    if (!monthlyAutoMap[month]) {
      monthlyAutoMap[month] = emptyMonth(month)
    }

    monthlyAutoMap[month].impressions += asNum(row.impressions)
    monthlyAutoMap[month].reach += asNum(row.reach)
    monthlyAutoMap[month].linkClicks += asNum(row.linkClicks)
    monthlyAutoMap[month].metaRows += 1

    if (monthlyAutoMap[month].metaSpend <= 0) {
      monthlyAutoMap[month].metaSpend += asNum(row.spend)
    }
  }

  // Unione dati automatici + dati manuali salvati in localStorage
  const data = Object.values(monthlyAutoMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(row => {
      const manual = months[row.month] || EMPTY

      const fatturato = row.fatturato > 0 ? row.fatturato : asNum(manual.fatturato)
      const fatturNC = row.fatturNC > 0 ? row.fatturNC : 0
      const fatturRC = row.fatturRC > 0 ? row.fatturRC : Math.max(fatturato - fatturNC, 0)

      const resi = asNum(row.resi)
      const resiNC = asNum(row.resiNC)
      const resiRC = asNum(row.resiRC)

      const ordini = row.ordini > 0 ? row.ordini : asNum(manual.ordini)
      const nc = row.nc > 0 ? row.nc : asNum(manual.nuoviClienti)
      const rc = row.rc > 0 ? row.rc : Math.max(ordini - nc, 0)

      const sessioni = asNum(row.sessioni)
      const metaSpend = asNum(row.metaSpend)
      const googleSpend = asNum(manual.googleSpend)
      const totalSpend = metaSpend + googleSpend

      const aov = safeDiv(fatturato, ordini)
      const aovNC = safeDiv(fatturNC, nc)
      const aovRC = safeDiv(fatturRC, rc)

      const cac = safeDiv(totalSpend, nc)
      const cpo = safeDiv(totalSpend, ordini)

      const mer = safeDiv(fatturato, totalSpend)
      const aMer = safeDiv(fatturNC, totalSpend)

      const retention = nc + rc > 0 ? rc / (nc + rc) * 100 : null
      const cro = sessioni > 0 && ordini > 0 ? ordini / sessioni * 100 : null

      const ltv = aov ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
      const ratio = ltv && cac ? ltv / cac : null

      return {
        month: row.month,

        fatturato,
        fatturNC,
        fatturRC,

        resi,
        resiNC,
        resiRC,

        ordini,
        nc,
        rc,
        sessioni,

        metaSpend,
        googleSpend,
        totalSpend,

        aov,
        aovNC,
        aovRC,

        cac,
        cpo,

        mer,
        aMer,

        retention,
        cro,

        ltv,
        ratio,

        impressions: asNum(row.impressions),
        reach: asNum(row.reach),
        linkClicks: asNum(row.linkClicks),
      }
    })

  // ── Subset per dashboard: solo anno corrente ───────────────
  const currentYear = String(new Date().getFullYear())
  const dataYear = data.filter(m => m.month?.startsWith(currentYear))

  // ── Totali periodo (anno corrente, usati dalla Dashboard) ──
  const totFat   = dataYear.reduce((s,m)=>s + Number(m.fatturato || 0), 0)
  const totFatNC = dataYear.reduce((s,m)=>s + Number(m.fatturNC  || 0), 0)
  const totFatRC = dataYear.reduce((s,m)=>s + Number(m.fatturRC  || 0), 0)

  const totResi   = dataYear.reduce((s,m)=>s + Number(m.resi   || 0), 0)
  const totResiNC = dataYear.reduce((s,m)=>s + Number(m.resiNC || 0), 0)
  const totResiRC = dataYear.reduce((s,m)=>s + Number(m.resiRC || 0), 0)

  const totOrd   = dataYear.reduce((s,m)=>s + Number(m.ordini   || 0), 0)
  const totNC    = dataYear.reduce((s,m)=>s + Number(m.nc       || 0), 0)
  const totRC    = dataYear.reduce((s,m)=>s + Number(m.rc       || 0), 0)
  const totSes   = dataYear.reduce((s,m)=>s + Number(m.sessioni || 0), 0)

  const totMeta  = dataYear.reduce((s,m)=>s + Number(m.metaSpend   || 0), 0)
  const totGoog  = dataYear.reduce((s,m)=>s + Number(m.googleSpend || 0), 0)
  const totSpend = dataYear.reduce((s,m)=>s + Number(m.totalSpend  || 0), 0)

  const avgAOV   = totOrd > 0 ? totFat   / totOrd : 0
  const avgAOVNC = totNC  > 0 ? totFatNC / totNC  : 0
  const avgAOVRC = totRC  > 0 ? totFatRC / totRC  : 0

  const avgLTV   = avgAOV > 0 ? avgAOV * cfg.freq * cfg.life * cfg.margin / 100 : null
  const avgCAC   = totSpend > 0 && totNC  > 0 ? totSpend / totNC  : null
  const avgCPO   = totSpend > 0 && totOrd > 0 ? totSpend / totOrd : null
  const avgRatio = avgLTV && avgCAC ? avgLTV / avgCAC : null
  const avgMER   = totFat   > 0 && totSpend > 0 ? totFat   / totSpend : null
  const avgAMER  = totFatNC > 0 && totSpend > 0 ? totFatNC / totSpend : null
  const avgRet   = totNC + totRC > 0 ? totRC / (totNC + totRC) * 100 : null
  const avgCRO   = totSes > 0 && totOrd > 0 ? totOrd / totSes * 100 : null

  // Alias retro-compatibili: alcuni componenti più sotto usano ancora i nomi *G
  const ltvG   = avgLTV
  const cacG   = avgCAC
  const cpoG   = avgCPO
  const ratioG = avgRatio
  const merG   = avgMER
  const aMerG  = avgAMER
  const retG   = avgRet
  const croG   = avgCRO

  const TABS = [
  { id: 'dashboard', l: 'Dashboard' },
  { id: 'kpiBrain', l: 'KPI Brain' },
  { id: 'monthly', l: 'Mensile' },
  { id: 'weekly', l: 'Weekly' },
  { id: 'creative', l: 'Creative' },
  { id: 'simulator', l: 'Simulatore' },
  { id: 'metaDetail', l: 'Meta Detail' },
]

  const S = { // shared styles
    card: { background:'#0a1020', border:'1px solid #111827', borderRadius:10, padding:24 },
    th:   { padding:'10px 14px', fontSize:11, color:'#ffffff', textTransform:'uppercase', letterSpacing:'0.1em', textAlign:'left', fontWeight:700, fontFamily:'Barlow Condensed', borderBottom:'1px solid #1e2d47', whiteSpace:'nowrap' },
    td:   { padding:'10px 14px', fontSize:14, borderBottom:'1px solid #0d1628', fontFamily:'Barlow', fontWeight:500 },
  }

  // Meta Detail: variabili sicure per evitare errori client-side
  const metaSpend = live?.metaSpend ?? totMeta ?? 0
  const metaMonthly = Array.isArray(live?.metaMonthly) ? live.metaMonthly : []
  const metaWeekly = Array.isArray(live?.metaWeekly) ? live.metaWeekly : []
  const metaDetailRows = metaMonthly.length ? metaMonthly : metaWeekly

  return (
  <VendroShell
    tab={tab}
    setTab={setTab}
    live={live}
    updated={updated}
  >
    {showCfg && <Settings cfg={cfg} onSave={c=>setCfg(c)} onClose={()=>setShowCfg(false)} />}

      {/* ⬇⬇⬇ DA QUI IN GIÙ: lascia il tuo JSX ORIGINALE invariato (header, tabs, dashboard cards, grafici, tab Mensile/Weekly/Simulatore/MetaDetail, chiusura return e chiusura componente) ⬇⬇⬇ */}

  

      {/* DASHBOARD TAB */}
      {tab==='dashboard' && (
        <>
          <div style={{marginBottom:20}}>
            <RatioWidget ratio={avgRatio} mer={avgMER} />
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:16,marginBottom:16}}>
            <Stat label="LTV netto" value={avgLTV ? f2(avgLTV) : '—'} sub={`${cfg.freq}× · ${cfg.life}a · ${cfg.margin}%`} color="#22c55e" />
            <Stat label="CAC" value={avgCAC ? f2(avgCAC) : '—'} sub={`${fn(totNC)} nuovi clienti`} />
            <Stat label="AOV medio" value={avgAOV ? f2(avgAOV) : '—'} sub={`${fn(totOrd)} ordini`} color="#3b82f6" />
            <Stat label="Fatturato totale" value={f0(totFat)} sub={`Anno ${currentYear}`} color="#22c55e" />
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:16}}>
            <Stat label="Spesa Meta" value={totMeta>0?f0(totMeta):'—'} color="#3b82f6" />
            <Stat label="Spesa Google" value={totGoog>0?f0(totGoog):'—'} color="#eab308" />
            <Stat label="Spesa totale" value={totSpend>0?f0(totSpend):'—'} sub="Meta + Google" />
          </div>

          {totResi > 0 && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:16}}>
              <Stat label="Resi totali" value={f0(totResi)} color="#ef4444" />
              <Stat label="Resi nuovi clienti" value={totResiNC>0?f0(totResiNC):'—'} color="#ef4444" dim />
              <Stat label="Resi clienti ritorno" value={totResiRC>0?f0(totResiRC):'—'} color="#ef4444" dim />
            </div>
          )}

          {/* Ratio LTV:CAC storico — usa `data` (tutti i mesi, non filtrato anno corrente) */}
          <div style={S.card}>
            <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>
              Ratio LTV:CAC mensile
            </p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data} margin={{top:4,right:16,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                <XAxis dataKey="month" tick={{fill:'#94a3b8',fontSize:10,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:'#94a3b8',fontSize:10}} axisLine={false} tickLine={false} />
                <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} label={{value:'3:1',fill:'#22c55e',fontSize:10}} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Line dataKey="ratio" name="Ratio" stroke="#22c55e" strokeWidth={2} dot={{r:4}} strokeDasharray="6 4" connectNulls />
                <Line dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} dot={{r:4}} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
{/* KPI BRAIN TAB */}
{tab === 'kpiBrain' && (
  <KPIBrainTab
    data={data}
    dataYear={dataYear}
    live={live}
    cfg={cfg}
    S={S}
  />
)}
      {/* MENSILE TAB */}
      {tab==='monthly' && (() => {
        const filled = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
        const mTH = { ...S.th, position:'sticky', top:0, zIndex:20, background:'#081226', boxShadow:'0 1px 0 #1e2d47', fontSize:12, padding:'12px 14px' }
        const mTD = { ...S.td, fontSize:15, padding:'10px 14px', verticalAlign:'top' }
        const mVal = { fontFamily:'Barlow', fontWeight:900, fontSize:16, lineHeight:1.15, color:'#f8fafc' }

        const mDelta = (curr, prev, kind='euro0') => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff / p * 100 : null
          const sign = diff > 0 ? '+' : '−'
          const color = diff < 0 ? '#ef4444' : '#f8fafc'
          const abs = Math.abs(diff)
          let fmtAbs = '—'
          if (kind === 'euro0') fmtAbs = `€${Math.round(abs).toLocaleString('it-IT')}`
          else if (kind === 'euro2') fmtAbs = `€${abs.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}`
          else if (kind === 'int') fmtAbs = Math.round(abs).toLocaleString('it-IT')
          else if (kind === 'percent') fmtAbs = `${abs.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`
          else fmtAbs = abs.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})
          return (
            <div style={{marginTop:8,color,fontSize:12,lineHeight:1.2,fontWeight:900,whiteSpace:'nowrap'}}>
              <div>{sign}{fmtAbs}</div>
              {pctV != null && <div>{sign}{Math.abs(pctV).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%</div>}
            </div>
          )
        }

        const MV = ({value, prev, kind='euro0', suffix=''}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={mVal}>{shown}</div>{mDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind)}</div>)
        }

        const chartData = filled.map(m => ({
          label: m.month, fatturato: m.fatturato, spesa: m.totalSpend,
          nc: m.nc, rc: m.rc, mer: m.mer, aov: m.aov, cro: m.cro, ratio: m.ratio,
        }))

        return (
        <>
          {/* Summary KPI Cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit, minmax(140px, 1fr))',gap:12,marginBottom:20}}>
            {[
              {label:'Fatturato', value:f0(totFat), color:'#22c55e'},
              {label:'Ordini', value:fn(totOrd), color:'#f8fafc'},
              {label:'Nuovi Clienti', value:fn(totNC), color:'#06b6d4'},
              {label:'Clienti Ritorno', value:fn(totRC), color:'#a78bfa'},
              {label:'Meta Spend', value:totMeta>0?f0(totMeta):'—', color:'#3b82f6'},
              {label:'Google Spend', value:totGoog>0?f0(totGoog):'—', color:'#eab308'},
              {label:'AOV', value:avgAOV>0?f2(avgAOV):'—', color:'#f59e0b'},
              {label:'MER', value:avgMER!=null?`${fr(avgMER)}×`:'—', color:avgMER!=null?(avgMER>=3?'#22c55e':avgMER>=2?'#f59e0b':'#ef4444'):'#555'},
              {label:'CAC', value:avgCAC?f2(avgCAC):'—', color:'#f8fafc'},
              {label:'Ratio', value:avgRatio?`${fr(avgRatio)}:1`:'—', color:ratioColor(avgRatio)},
            ].map(kpi => (
              <div key={kpi.label} style={{background:'#0a1020',border:'1px solid #111827',borderRadius:10,padding:'16px 18px'}}>
                <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:6,fontFamily:'Barlow Condensed'}}>{kpi.label}</div>
                <div style={{fontSize:22,fontWeight:950,color:kpi.color,fontFamily:'Barlow',letterSpacing:'-0.02em'}}>{kpi.value}</div>
              </div>
            ))}
          </div>

          {/* Data Entry Table */}
          <div style={{...S.card, marginBottom:20}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontSize:13,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.08em',textTransform:'uppercase'}}>
                Dati mensili
              </span>
              <span style={{fontSize:10,color:'#22c55e'}}>Shopify + Meta automatici · Google manuale</span>
            </div>

            <div style={{overflow:'auto',maxHeight:'72vh',position:'relative'}}>
              <table style={{width:'100%',minWidth:1450,borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    {['Mese','Fatturato €','Fatt. NC €','Fatt. RC €','Resi €','Meta ADS €','Google ADS €','Tot Ordini','NC #','RC #','Sessioni'].map(h=>(
                      <th key={h} style={mTH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.map((m,i)=>{
                    const p = i > 0 ? data[i-1] : null
                    return (
                    <tr key={m.month} style={{background:i%2===0?'transparent':'#080f1e'}}>
                      <td style={{...mTD,color:'#f8fafc',fontWeight:900,whiteSpace:'nowrap',fontSize:16}}>{m.month}</td>
                      <td style={mTD}><MV value={m.fatturato} prev={p?.fatturato} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.fatturNC} prev={p?.fatturNC} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.fatturRC} prev={p?.fatturRC} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.resi||null} prev={p?.resi||null} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.metaSpend||null} prev={p?.metaSpend||null} kind="euro0"/></td>
                      <td style={mTD}>
                        <NumInput value={m.googleSpend} onChange={v=>updateMonth(m.month,'googleSpend',v)} placeholder="0" color="#eab308" />
                      </td>
                      <td style={mTD}><MV value={m.ordini} prev={p?.ordini} kind="int"/></td>
                      <td style={mTD}><MV value={m.nc} prev={p?.nc} kind="int"/></td>
                      <td style={mTD}><MV value={m.rc} prev={p?.rc} kind="int"/></td>
                      <td style={mTD}><MV value={m.sessioni||null} prev={p?.sessioni||null} kind="int"/></td>
                    </tr>
                  )})}
                  <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                    <td style={{...mTD,color:'#94a3b8',fontWeight:900,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>Totale</td>
                    <td style={{...mTD,...mVal}}>{f0(totFat)}</td>
                    <td style={{...mTD,...mVal}}>{f0(totFatNC)}</td>
                    <td style={{...mTD,...mVal}}>{f0(totFatRC)}</td>
                    <td style={{...mTD,...mVal}}>{totResi>0?f0(totResi):'—'}</td>
                    <td style={{...mTD,...mVal}}>{totMeta>0?f0(totMeta):'—'}</td>
                    <td style={{...mTD,...mVal}}>{totGoog>0?f0(totGoog):'—'}</td>
                    <td style={{...mTD,...mVal}}>{fn(totOrd)}</td>
                    <td style={{...mTD,...mVal}}>{fn(totNC)}</td>
                    <td style={{...mTD,...mVal}}>{fn(totRC)}</td>
                    <td style={{...mTD,...mVal}}>{totSes>0?fn(totSes):'—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI Calcolati Table */}
          {filled.length > 0 && (
          <div style={{...S.card, marginBottom:20}}>
            <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:16}}>
              KPI calcolati
            </p>
            <div style={{overflow:'auto',maxHeight:'72vh',position:'relative'}}>
              <table style={{width:'100%',minWidth:1600,borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    {['Mese','Fatturato','Fatt. NC','Fatt. RC','ADV','MER','aMER','CAC','CPO','AOV','AOV NC','AOV RC','Ret%','CRO%','LTV','Ratio'].map(h=>(
                      <th key={h} style={mTH}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filled.map((m,i)=>{
                    const p = i > 0 ? filled[i-1] : null
                    return (
                    <tr key={m.month} style={{background:i%2===0?'transparent':'#080f1e'}}>
                      <td style={{...mTD,color:'#f8fafc',fontSize:16,fontWeight:900,whiteSpace:'nowrap'}}>{m.month}</td>
                      <td style={mTD}><MV value={m.fatturato} prev={p?.fatturato} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.fatturNC} prev={p?.fatturNC} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.fatturRC} prev={p?.fatturRC} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.totalSpend} prev={p?.totalSpend} kind="euro0"/></td>
                      <td style={mTD}><MV value={m.mer} prev={p?.mer} kind="ratio" suffix="×"/></td>
                      <td style={mTD}><MV value={m.aMer} prev={p?.aMer} kind="ratio" suffix="×"/></td>
                      <td style={mTD}><MV value={m.cac} prev={p?.cac} kind="euro2"/></td>
                      <td style={mTD}><MV value={m.cpo} prev={p?.cpo} kind="euro2"/></td>
                      <td style={mTD}><MV value={m.aov} prev={p?.aov} kind="euro2"/></td>
                      <td style={mTD}><MV value={m.aovNC} prev={p?.aovNC} kind="euro2"/></td>
                      <td style={mTD}><MV value={m.aovRC} prev={p?.aovRC} kind="euro2"/></td>
                      <td style={mTD}><MV value={m.retention} prev={p?.retention} kind="percent1"/></td>
                      <td style={mTD}><MV value={m.cro} prev={p?.cro} kind="percent2"/></td>
                      <td style={mTD}><MV value={m.ltv} prev={p?.ltv} kind="euro2"/></td>
                      <td style={mTD}><MV value={m.ratio} prev={p?.ratio} kind="ratio" suffix=":1"/></td>
                    </tr>
                  )})}
                  <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                    <td style={{...mTD,color:'#94a3b8',fontWeight:900,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>Media / Totale</td>
                    <td style={{...mTD,...mVal}}>{f0(totFat)}</td>
                    <td style={{...mTD,...mVal}}>{f0(totFatNC)}</td>
                    <td style={{...mTD,...mVal}}>{f0(totFatRC)}</td>
                    <td style={{...mTD,...mVal}}>{f0(totSpend)}</td>
                    <td style={{...mTD,...mVal}}>{avgMER!=null?`${fr(avgMER)}×`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgAMER!=null?`${fr(avgAMER)}×`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgCAC?f2(avgCAC):'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgCPO?f2(avgCPO):'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgAOV>0?f2(avgAOV):'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgAOVNC>0?f2(avgAOVNC):'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgAOVRC>0?f2(avgAOVRC):'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgRet!=null?`${Number(avgRet).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgCRO!=null?`${Number(avgCRO).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgLTV?f2(avgLTV):'—'}</td>
                    <td style={{...mTD,...mVal}}>{avgRatio?`${fr(avgRatio)}:1`:'—'}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
          )}

          {/* Charts */}
          {filled.length > 0 && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <div style={S.card}>
                <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>
                  Fatturato, Spesa e MER
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                    <XAxis dataKey="label" tick={{fill:'#94a3b8',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Legend />
                    <Line yAxisId="left" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2} dot={{r:3}} connectNulls />
                    <Line yAxisId="left" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} connectNulls />
                    <Line yAxisId="right" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} dot={{r:3}} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={S.card}>
                <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>
                  Nuovi clienti e clienti di ritorno
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                    <XAxis dataKey="label" tick={{fill:'#94a3b8',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} />
                    <Legend />
                    <Bar dataKey="nc" name="Nuovi clienti" fill="#06b6d4" radius={[4,4,0,0]} />
                    <Bar dataKey="rc" name="Clienti ritorno" fill="#a78bfa" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <div style={S.card}>
                <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>
                  AOV e CRO
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                    <XAxis dataKey="label" tick={{fill:'#94a3b8',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                    <Tooltip content={<ChartTip />} />
                    <Legend />
                    <Line yAxisId="left" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2} dot={{r:3}} connectNulls />
                    <Line yAxisId="right" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2} dot={{r:3}} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              <div style={S.card}>
                <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>
                  Ratio LTV:CAC
                </p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{top:4,right:16,left:0,bottom:4}}>
                    <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                    <XAxis dataKey="label" tick={{fill:'#94a3b8',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} />
                    <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} label={{value:'3:1',fill:'#22c55e',fontSize:10}} />
                    <Tooltip content={<ChartTip />} />
                    <Legend />
                    <Line dataKey="ratio" name="Ratio" stroke="#f8fafc" strokeWidth={2} dot={{r:3}} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
          )}
        </>
      )})()}

      {/* WEEKLY TAB */}
      {tab==='weekly' && (
        <WeeklyTab
          weeks={getWeeks()}
          data={weeks}
          metaWeekly={live?.metaWeekly || []}
          shopifyWeekly={live?.shopifyWeekly || []}
          onUpdate={updateWeek}
          cfg={cfg}
          S={S}
        />
      )}

      {/* SIMULATORE TAB */}
      {tab==='simulator' && <Simulator cfg={cfg} />}
{tab === 'creative' && (
  <CreativeTab />
)}

{/* META DETAIL TAB */}
{tab === 'metaDetail' && (
  <MetaDetailTab />
)}

{/* PERFORMANCE AGENT TAB */}
{tab === 'performanceAgent' && (
  <PerformanceAgentTab cfg={cfg} />
)}

{/* KLAVIYO TAB */}
{tab === 'klaviyo' && (
  <KlaviyoTab />
)}

{/* COMPETITOR INTEL TAB */}
{tab === 'competitorIntel' && (
  <CompetitorIntelTab />
)}

{/* INTEGRATIONS TAB */}
{tab === 'integrations' && (
  <IntegrationsTab />
)}

{/* CRO TAB */}
{tab === 'cro' && (
  <CROTab />
)}
      </VendroShell>
    )
  }
