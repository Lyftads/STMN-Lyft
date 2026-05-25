'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'

// ── Utils ─────────────────────────────────────────────────────
const hasVal = v => v !== null && v !== undefined && v !== '' && Number.isFinite(Number(v))

const euro0Fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const euro2Fmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const num0Fmt = new Intl.NumberFormat('it-IT', { maximumFractionDigits: 0 })
const dec2Fmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const pct1Fmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 1, maximumFractionDigits: 1 })
const pct2Fmt = new Intl.NumberFormat('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

const f0 = n => hasVal(n) && Number(n) > 0 ? `€${euro0Fmt.format(Number(n))}` : '—'
const f0z = n => hasVal(n) ? `€${euro0Fmt.format(Number(n))}` : '—'
const f2 = n => hasVal(n) && Number(n) > 0 ? `€${euro2Fmt.format(Number(n))}` : '—'
const f2z = n => hasVal(n) ? `€${euro2Fmt.format(Number(n))}` : '—'
const fn = n => hasVal(n) && Number(n) > 0 ? num0Fmt.format(Number(n)) : '—'
const fnz = n => hasVal(n) ? num0Fmt.format(Number(n)) : '—'
const fp = n => hasVal(n) ? `${Number(n).toFixed(1)}x` : '—'
const fr = n => hasVal(n) ? dec2Fmt.format(Number(n)) : '—'
const fp1 = n => hasVal(n) ? `${pct1Fmt.format(Number(n))}%` : '—'
const fp2 = n => hasVal(n) ? `${pct2Fmt.format(Number(n))}%` : '—'

const WHITE = '#f8fafc'
const ALERT_RED = '#ef4444'
const SAME_YELLOW = '#eab308'
const POS_GREEN = '#22c55e'
const NEG_RED = '#ef4444'

const ratioStatus = r => r==null?'nd':r<1?'bad':r<3?'warn':'ok'
const ratioColor  = r => ({nd:'#555',bad:'#ef4444',warn:'#f59e0b',ok:'#22c55e'})[ratioStatus(r)]
const ratioLabel  = r => ({nd:'N/D',bad:'CRITICO',warn:'ATTENZIONE',ok:'OTTIMO'})[ratioStatus(r)]

function getVariation(curr, prev) {
  if (!hasVal(curr) || !hasVal(prev)) return null

  const current = Number(curr)
  const previous = Number(prev)
  const diff = current - previous

  if (Math.abs(diff) < 0.000001) {
    return { diff: 0, pct: 0, positive: false, equal: true, over20: false }
  }

  const pct = previous !== 0 ? (diff / previous) * 100 : null

  return {
    diff,
    pct,
    positive: diff > 0,
    equal: false,
    over20: pct != null ? Math.abs(pct) >= 20 : false,
  }
}

function getDataColor(curr, prev) {
  const v = getVariation(curr, prev)
  if (!v) return WHITE
  if (v.equal) return SAME_YELLOW
  if (v.over20) return ALERT_RED
  return WHITE
}

function formatDeltaValue(value, kind) {
  const abs = Math.abs(Number(value || 0))
  if (kind === 'euro2') return `€${euro2Fmt.format(abs)}`
  if (kind === 'euro0') return `€${euro0Fmt.format(abs)}`
  if (kind === 'percent') return `${pct2Fmt.format(abs)}%`
  if (kind === 'ratio') return `${dec2Fmt.format(abs)}:1`
  if (kind === 'multiplier') return `${dec2Fmt.format(abs)}×`
  return num0Fmt.format(abs)
}

function Delta({ current, previous, kind = 'number', align = 'left' }) {
  const v = getVariation(current, previous)
  if (!v || v.equal) return null

  const sign = v.diff > 0 ? '+' : '−'
  const color = v.positive ? POS_GREEN : NEG_RED

  return (
    <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 2, textAlign: align, fontWeight: 800, whiteSpace: 'nowrap' }}>
      <div style={{ fontSize: 11, lineHeight: 1.15, color }}>{sign}{formatDeltaValue(v.diff, kind)}</div>
      {v.pct != null && (
        <div style={{ fontSize: 11, lineHeight: 1.15, color }}>{sign}{pct1Fmt.format(Math.abs(v.pct))}%</div>
      )}
    </div>
  )
}

const MONTHS_START = '2026-04'

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
const WEMPTY = { fatturato:0, fatturNC:0, fatturRC:0, meta:0, google:0, ordini:0, nc:0, rc:0, sessioni:0, uniqueSessions:0 }
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
          fontSize:14,
          fontFamily:'Barlow',fontWeight:900,
          color: color,
          outline:'none',
        }}
        onFocus={e => e.target.style.borderColor='#333'}
        onBlur={e => e.target.style.borderColor='#1a1a1a'}
      />
      {preview && <span style={{fontSize:12,textAlign:'right',color,opacity:0.85,fontFamily:'Barlow',fontWeight:800}}>{preview}</span>}
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
        <div style={{fontSize:64,fontWeight:800,color:col,fontFamily:'Barlow',fontWeight:700,lineHeight:1,letterSpacing:'-0.04em'}}>
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
        <div style={{fontSize:36,fontWeight:700,color:'#e8e8e8',fontFamily:'Barlow',fontWeight:700,letterSpacing:'-0.03em'}}>
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
              <div style={{fontSize:18,fontWeight:700,fontFamily:'Barlow',fontWeight:700,color:'#22c55e'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── WeeklyTab ─────────────────────────────────────────────────
function WeeklyTab({ weeks, data, shopifyWeekly, metaWeekly, onUpdate, cfg, S }) {
  const metaMap = {}
  for (const m of (metaWeekly || [])) metaMap[m.date] = m

  const shopifyMap = {}
  for (const row of (shopifyWeekly || [])) shopifyMap[row.date] = row

  const allWeeks = weeks.map(({ key, label }) => {
    const manual = data[key] || WEMPTY
    const sw = shopifyMap[key] || {}
    const mw = metaMap[key] || {}

    const metaSpend = mw.spend > 0 ? mw.spend : (manual.meta || 0)
    const google = manual.google || 0
    const adv = metaSpend + google

    const fat = sw.fatturato > 0 ? sw.fatturato : (manual.fatturato || manual.fat || 0)
    const fatNC = sw.fatturNC > 0 ? sw.fatturNC : (manual.fatturNC || manual.fatNC || 0)
    const fatRC = sw.fatturRC > 0 ? sw.fatturRC : (manual.fatturRC || manual.fatRC || 0)
    const ord = sw.ordini > 0 ? sw.ordini : (manual.ordini || manual.ord || 0)
    const nc = sw.nc > 0 ? sw.nc : (manual.nc || 0)
    const rc = sw.rc > 0 ? sw.rc : (manual.rc || 0)
    const ses = sw.uniqueSessions > 0 ? sw.uniqueSessions : (manual.uniqueSessions || manual.sessioni || 0)

    const mer       = adv > 0 && fat > 0   ? fat / adv : null
    const aMer      = adv > 0 && fatNC > 0 ? fatNC / adv : null
    const cac       = adv > 0 && nc > 0    ? adv / nc : null
    const cpo       = adv > 0 && ord > 0   ? adv / ord : null
    const aov       = ord > 0 && fat > 0   ? fat / ord : null
    const aovNC     = nc > 0 && fatNC > 0  ? fatNC / nc : null
    const aovRC     = rc > 0 && fatRC > 0  ? fatRC / rc : null
    const retention = (nc + rc) > 0 ? rc / (nc + rc) * 100 : null
    const cro       = ses > 0 && ord > 0 ? ord / ses * 100 : null
    const ltv       = aov ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
    const ratio     = ltv && cac ? ltv / cac : null

    return {
      key, label,
      fat, fatNC, fatRC,
      meta: metaSpend, google, adv,
      ord, nc, rc, ses,
      mer, aMer, cac, cpo, aov, aovNC, aovRC,
      retention, cro, ltv, ratio,
      shopifyAuto: Boolean(sw.date),
      metaAuto: mw.spend > 0,
      ctr: mw.ctr,
      cpc: mw.cpcLink,
      cpm: mw.cpm,
      freq: mw.frequency,
      impressions: mw.impressions,
      reach: mw.reach,
      linkClicks: mw.linkClicks,
    }
  })

  const filled = allWeeks.filter(w => w.fat > 0 || w.adv > 0 || w.shopifyAuto || w.metaAuto)
  const visibleWeeks = allWeeks

  const totFat   = filled.reduce((s,w)=>s+w.fat,0)
  const totFatNC = filled.reduce((s,w)=>s+w.fatNC,0)
  const totFatRC = filled.reduce((s,w)=>s+w.fatRC,0)
  const totAdv   = filled.reduce((s,w)=>s+w.adv,0)
  const totMeta  = filled.reduce((s,w)=>s+w.meta,0)
  const totGoog  = filled.reduce((s,w)=>s+w.google,0)
  const totOrd   = filled.reduce((s,w)=>s+w.ord,0)
  const totNC    = filled.reduce((s,w)=>s+w.nc,0)
  const totRC    = filled.reduce((s,w)=>s+w.rc,0)
  const totSes   = filled.reduce((s,w)=>s+w.ses,0)

  const avgMER   = totAdv > 0 && totFat > 0   ? totFat / totAdv : null
  const avgAMER  = totAdv > 0 && totFatNC > 0 ? totFatNC / totAdv : null
  const avgCAC   = totAdv > 0 && totNC > 0    ? totAdv / totNC : null
  const avgCPO   = totAdv > 0 && totOrd > 0   ? totAdv / totOrd : null
  const avgAOV   = totOrd > 0 && totFat > 0   ? totFat / totOrd : null
  const avgAOVNC = totNC > 0 && totFatNC > 0  ? totFatNC / totNC : null
  const avgAOVRC = totRC > 0 && totFatRC > 0  ? totFatRC / totRC : null
  const avgRet   = (totNC + totRC) > 0 ? totRC / (totNC + totRC) * 100 : null
  const avgCRO   = totSes > 0 && totOrd > 0 ? totOrd / totSes * 100 : null
  const avgLTV   = avgAOV ? avgAOV * cfg.freq * cfg.life * cfg.margin / 100 : null
  const avgRatio = avgLTV && avgCAC ? avgLTV / avgCAC : null

  const fw = filled.filter(w => w.ctr != null)
  const avgCTR = fw.length > 0 ? fw.reduce((s,w)=>s+(w.ctr||0),0)/fw.length : null
  const avgCPC = fw.length > 0 ? fw.reduce((s,w)=>s+(w.cpc||0),0)/fw.length : null
  const avgCPM = fw.length > 0 ? fw.reduce((s,w)=>s+(w.cpm||0),0)/fw.length : null
  const avgFreq= fw.length > 0 ? fw.reduce((s,w)=>s+(w.freq||0),0)/fw.length : null

  const TH = {
    ...S.th,
    fontSize: 12,
    padding: '12px 12px',
    position: 'sticky',
    top: 0,
    zIndex: 15,
    background: '#04112a',
    boxShadow: '0 1px 0 #1e2d47',
  }

  const TD = { ...S.td, fontSize: 13, padding: '10px 12px', verticalAlign: 'top' }
  const valueLineStyle = { fontSize: 16, fontWeight: 900, lineHeight: 1.15 }

  const autoValue = ({ value, prevValue, kind = 'euro0', isCount = false, fallback = '—' }) => (
    <div>
      <div style={{ ...valueLineStyle, color: getDataColor(value, prevValue) }}>
        {!hasVal(value) || Number(value) === 0
          ? fallback
          : isCount
            ? fnz(value)
            : kind === 'euro2'
              ? f2z(value)
              : kind === 'percent'
                ? fp2(value)
                : kind === 'multiplier'
                  ? `${fr(value)}×`
                  : kind === 'ratio'
                    ? `${fr(value)}:1`
                    : f0z(value)}
      </div>
      <Delta current={value} previous={prevValue} kind={isCount ? 'int' : kind} />
    </div>
  )

  const InputOrAuto = ({ row, prev, field, updateField = field, value, kind = 'euro0', isCount = false, auto, disabled }) => {
    if (auto || disabled) {
      return autoValue({ value, prevValue: prev?.[field], kind, isCount })
    }

    return (
      <NumInput
        value={value}
        onChange={val => onUpdate(row.key, updateField, val)}
        placeholder="0"
        color={getDataColor(value, prev?.[field])}
        isCount={isCount}
      />
    )
  }

  return (
    <>
      <div style={{...S.card, marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontSize:16,color:'#fff',fontWeight:800,fontFamily:'Barlow Condensed',letterSpacing:'0.1em',textTransform:'uppercase'}}>Inserimento dati settimanali</span>
          <span style={{fontSize:12,color:'#22c55e'}}>Shopify + Meta automatici · Google manuale</span>
        </div>

        <div style={{overflowX:'auto', position:'relative', maxHeight:'72vh'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['Settimana','Fatturato €','Fatt. NC €','Fatt. RC €','Meta ADS €','Google ADS €','Tot Ordini','NC #','RC #','Sessioni uniche'].map(h=>(
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {visibleWeeks.map((w, i) => {
                const prev = i > 0 ? visibleWeeks[i - 1] : null
                return (
                  <tr key={w.key} style={{background:i%2===0?'transparent':'#080f1e'}}>
                    <td style={{...TD,color:'#94a3b8',fontWeight:800,whiteSpace:'nowrap',fontSize:12}}>{w.label}</td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="fat" updateField="fatturato" value={w.fat} auto={w.shopifyAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="fatNC" updateField="fatturNC" value={w.fatNC} auto={w.shopifyAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="fatRC" updateField="fatturRC" value={w.fatRC} auto={w.shopifyAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="meta" value={w.meta} auto={w.metaAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="google" value={w.google} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="ord" updateField="ordini" value={w.ord} isCount auto={w.shopifyAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="nc" value={w.nc} isCount auto={w.shopifyAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="rc" value={w.rc} isCount auto={w.shopifyAuto} /></td>
                    <td style={TD}><InputOrAuto row={w} prev={prev} field="ses" updateField="uniqueSessions" value={w.ses} isCount auto={w.shopifyAuto} /></td>
                  </tr>
                )
              })}

              <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                <td style={{...TD,color:'#94a3b8',fontWeight:900,fontSize:11,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>TOTALE</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{f0(totFat)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{f0(totFatNC)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{f0(totFatRC)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{f0(totMeta)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{totGoog>0?f0(totGoog):'—'}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{fn(totOrd)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{fn(totNC)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{fn(totRC)}</td>
                <td style={{...TD,color:WHITE,fontWeight:900}}>{fn(totSes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {filled.length > 0 && (
        <div style={{...S.card, marginBottom:20}}>
          <p style={{fontSize:16,color:'#fff',fontWeight:800,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:16}}>KPI calcolati</p>
          <div style={{overflowX:'auto', position:'relative', maxHeight:'72vh'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['Sett.','Fatturato','Fatt. NC','Fatt. RC','ADV','MER','aMER','CAC','CPO','AOV','AOV NC','AOV RC','Ret%','CRO%','CTR%','CPC','CPM','Freq.','LTV','Ratio'].map(h=>(
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filled.map((w,i) => {
                  const prev = i > 0 ? filled[i - 1] : null
                  return (
                    <tr key={w.key} style={{background:i%2===0?'transparent':'#080f1e'}}>
                      <td style={{...TD,color:'#94a3b8',fontSize:12,fontWeight:800,whiteSpace:'nowrap'}}>{w.label}</td>
                      <td style={TD}>{autoValue({ value:w.fat,   prevValue:prev?.fat })}</td>
                      <td style={TD}>{autoValue({ value:w.fatNC, prevValue:prev?.fatNC })}</td>
                      <td style={TD}>{autoValue({ value:w.fatRC, prevValue:prev?.fatRC })}</td>
                      <td style={TD}>{autoValue({ value:w.adv,   prevValue:prev?.adv })}</td>
                      <td style={TD}>{autoValue({ value:w.mer,   prevValue:prev?.mer, kind:'multiplier' })}</td>
                      <td style={TD}>{autoValue({ value:w.aMer,  prevValue:prev?.aMer, kind:'multiplier' })}</td>
                      <td style={TD}>{autoValue({ value:w.cac,   prevValue:prev?.cac, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.cpo,   prevValue:prev?.cpo, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.aov,   prevValue:prev?.aov, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.aovNC, prevValue:prev?.aovNC, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.aovRC, prevValue:prev?.aovRC, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.retention, prevValue:prev?.retention, kind:'percent' })}</td>
                      <td style={TD}>{autoValue({ value:w.cro, prevValue:prev?.cro, kind:'percent' })}</td>
                      <td style={TD}>{autoValue({ value:w.ctr, prevValue:prev?.ctr, kind:'percent' })}</td>
                      <td style={TD}>{autoValue({ value:w.cpc, prevValue:prev?.cpc, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.cpm, prevValue:prev?.cpm, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.freq, prevValue:prev?.freq, kind:'number' })}</td>
                      <td style={TD}>{autoValue({ value:w.ltv, prevValue:prev?.ltv, kind:'euro2' })}</td>
                      <td style={TD}>{autoValue({ value:w.ratio, prevValue:prev?.ratio, kind:'ratio' })}</td>
                    </tr>
                  )
                })}

                <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                  <td style={{...TD,color:'#94a3b8',fontWeight:900,fontSize:11,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>MEDIA</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{filled.length ? f0(totFat/filled.length) : '—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{filled.length ? f0(totFatNC/filled.length) : '—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{filled.length ? f0(totFatRC/filled.length) : '—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{filled.length ? f0(totAdv/filled.length) : '—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgMER!=null?`${fr(avgMER)}×`:'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgAMER!=null?`${fr(avgAMER)}×`:'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgCAC?f2(avgCAC):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgCPO?f2(avgCPO):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgAOV?f2(avgAOV):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgAOVNC?f2(avgAOVNC):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgAOVRC?f2(avgAOVRC):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgRet!=null?fp1(avgRet):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgCRO!=null?fp2(avgCRO):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgCTR!=null?fp2(avgCTR):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgCPC!=null?f2(avgCPC):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgCPM!=null?f2(avgCPM):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgFreq!=null?fr(avgFreq):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgLTV?f2(avgLTV):'—'}</td>
                  <td style={{...TD,color:WHITE,fontWeight:900}}>{avgRatio?`${fr(avgRatio)}:1`:'—'}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filled.length > 0 && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:14}}>Fatturato vs Investimento ADV</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={filled} margin={{top:0,right:8,left:0,bottom:0}} barGap={2}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'#555',fontSize:8,fontFamily:'Barlow'}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(0,5)} />
                  <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="fat" name="Fatturato" fill="#22c55e" radius={[2,2,0,0]} />
                  <Bar dataKey="meta" name="Meta ADS" fill="#3b82f6" radius={[2,2,0,0]} />
                  <Bar dataKey="google" name="Google ADS" fill="#eab308" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:14}}>MER settimanale</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={filled} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{fill:'#555',fontSize:8}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(0,5)} />
                  <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(1)}×`} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="mer" name="MER" stroke="#22c55e" strokeWidth={2} dot={{r:3,fill:'#22c55e'}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:14}}>CAC settimanale</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={filled} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{fill:'#555',fontSize:8}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(0,5)} />
                  <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="cac" name="CAC €" stroke="#e8e8e8" strokeWidth={2} dot={{r:3}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:14}}>CRO % + Retention %</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={filled} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="label" tick={{fill:'#555',fontSize:8}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(0,5)} />
                  <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(1)}%`} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="cro" name="CRO %" stroke="#3b82f6" strokeWidth={2} dot={{r:3}} connectNulls />
                  <Line dataKey="retention" name="Retention %" stroke="#818cf8" strokeWidth={2} dot={{r:3}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div style={S.card}>
            <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:14}}>Nuovi Clienti (NC) vs Clienti Ritorno (RC) settimanali</p>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={filled} margin={{top:0,right:8,left:0,bottom:0}} barGap={2}>
                <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                <XAxis dataKey="label" tick={{fill:'#555',fontSize:8}} axisLine={false} tickLine={false} tickFormatter={v=>v.slice(0,5)} />
                <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTip />} />
                <Bar dataKey="nc" name="NC" fill="#06b6d4" radius={[2,2,0,0]} />
                <Bar dataKey="rc" name="RC" fill="#818cf8" radius={[2,2,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const [tab,    setTab]    = useState('dashboard')
  const [live,   setLive]   = useState(null)
  const [loading,setLoading]= useState(true)
  const [cfg,    setCfg]    = useState(DEF)
  const [showCfg,setShowCfg]= useState(false)
  const [months, setMonths] = useState({})
  const [weeks,  setWeeks]  = useState({})
  const [updated,setUpdated]= useState(null)

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

  useEffect(() => { fetchLive() }, [])

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

  // ── Calcola dati per ogni mese ────────────────────────────
  const data = avail.map(month => {
    const d        = months[month] || EMPTY
    const metaSpend = (live?.metaMonthly||[]).find(x=>x.month===month)?.spend || 0
    const totalSpend = metaSpend + (d.googleSpend||0)
    const fatturato  = d.fatturato || 0
    const ordini     = d.ordini    || 0
    const nc         = d.nuoviClienti || 0
    const aov        = ordini > 0 ? fatturato/ordini : 0
    const ltv        = aov > 0   ? aov * cfg.freq * cfg.life * cfg.margin/100 : null
    const cac        = totalSpend > 0 && nc > 0 ? totalSpend/nc : null
    const ratio      = ltv && cac ? ltv/cac : null
    const mer        = fatturato > 0 && totalSpend > 0 ? fatturato/totalSpend : null
    return {
      month, fatturato, ordini, nc,
      metaSpend, googleSpend: d.googleSpend||0,
      totalSpend, aov, ltv, cac, ratio, mer,
    }
  })

  // ── Totali periodo ────────────────────────────────────────
  const totFat   = data.reduce((s,m)=>s+m.fatturato,0)
  const totOrd   = data.reduce((s,m)=>s+m.ordini,0)
  const totNC    = data.reduce((s,m)=>s+m.nc,0)
  const totMeta  = data.reduce((s,m)=>s+m.metaSpend,0)
  const totGoog  = data.reduce((s,m)=>s+m.googleSpend,0)
  const totSpend = data.reduce((s,m)=>s+m.totalSpend,0)
  const avgAOV   = totOrd > 0 ? totFat/totOrd : 0
  const ltvG     = avgAOV > 0 ? avgAOV * cfg.freq * cfg.life * cfg.margin/100 : null
  const cacG     = totSpend > 0 && totNC > 0 ? totSpend/totNC : null
  const ratioG   = ltvG && cacG ? ltvG/cacG : null
  const merG     = totFat > 0 && totSpend > 0 ? totFat/totSpend : null

  const TABS = [
    {id:'dashboard', l:'Dashboard'},
    {id:'monthly',   l:'Mensile'},
    {id:'weekly',    l:'Weekly'},
    {id:'simulator', l:'Simulatore'},
  ]

  const S = { // shared styles
    card: { background:'#0a1020', border:'1px solid #111827', borderRadius:10, padding:24 },
    th:   { padding:'10px 14px', fontSize:11, color:'#ffffff', textTransform:'uppercase', letterSpacing:'0.1em', textAlign:'left', fontWeight:700, fontFamily:'Barlow Condensed', borderBottom:'1px solid #1e2d47', whiteSpace:'nowrap' },
    td:   { padding:'10px 14px', fontSize:14, borderBottom:'1px solid #0d1628', fontFamily:'Barlow', fontWeight:700 },
  }

  return (
    <div style={{minHeight:'100vh',background:'transparent',padding:'20px 24px',maxWidth:1400,margin:'0 auto'}}>
      {showCfg && <Settings cfg={cfg} onSave={c=>setCfg(c)} onClose={()=>setShowCfg(false)} />}

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,letterSpacing:'-0.02em',color:'#e8e8e8'}}>STMN Fitness</div>
          <div style={{fontSize:11,color:'#444',marginTop:2,fontFamily:'Barlow',fontWeight:700}}>
            LTV:CAC • Dal 2026-04 • {updated ? updated.toLocaleString('it-IT') : '—'}
          </div>
        </div>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          <span style={{fontSize:10,padding:'3px 8px',borderRadius:20,background: live?.sources?.shopify?'#052e16':'#111', color: live?.sources?.shopify?'#22c55e':'#555', border:`1px solid ${live?.sources?.shopify?'#166534':'#1a1a1a'}`}}>
            Shopify {live?.sources?.shopify?'✓':'○'}
          </span>
          <span style={{fontSize:10,padding:'3px 8px',borderRadius:20,background: live?.sources?.meta?'#172554':'#111', color: live?.sources?.meta?'#3b82f6':'#555', border:`1px solid ${live?.sources?.meta?'#1e40af':'#1a1a1a'}`}}>
            Meta {live?.sources?.meta?'✓':'○'}
          </span>
          <button onClick={()=>setShowCfg(true)} style={{padding:'4px 10px',fontSize:11,background:'none',border:'1px solid #1e2d47',borderRadius:6,color:'#888',cursor:'pointer'}}>⚙ LTV</button>
          <button onClick={fetchLive} disabled={loading} style={{padding:'4px 12px',fontSize:11,background:'#22c55e',color:'#000',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',opacity: loading ? 0.5 : 1}}>
            {loading ? '...' : '↻ Aggiorna'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:2,marginBottom:24,borderBottom:'1px solid #111827',paddingBottom:0}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'10px 20px', fontSize:13, background:'none', border:'none', cursor:'pointer',
            color: tab===t.id ? '#e8e8e8' : '#555',
            fontWeight: tab===t.id ? 600 : 400,
            borderBottom: tab===t.id ? '2px solid #22c55e' : '2px solid transparent',
            marginBottom:-1, transition:'all .15s',
          }}>{t.l}</button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab==='dashboard' && (
        <div className="fade-up">
          {/* Ratio + MER */}
          <div style={{marginBottom:24}}>
            <RatioWidget ratio={ratioG} mer={merG} />
          </div>

          {/* KPI grid */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:12,marginBottom:24}}>
            <Stat label="LTV Netto" value={ltvG?f2(ltvG):'—'} sub={`${cfg.freq}× • ${cfg.life}a • ${cfg.margin}%`} color="#22c55e" mono />
            <Stat label="CAC" value={cacG?f2(cacG):'—'} sub={`${fn(totNC)} nuovi clienti`} mono />
            <Stat label="AOV Medio" value={avgAOV>0?f2(avgAOV):'—'} sub={`${fn(totOrd)} ordini`} color="#3b82f6" mono />
            <Stat label="Fatturato Totale" value={f0(totFat)} sub="dal 01/04/2026" color="#22c55e" mono />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:12,marginBottom:28}}>
            <Stat label="Spesa Meta" value={f0(totMeta)} color="#3b82f6" mono dim />
            <Stat label="Spesa Google" value={totGoog>0?f0(totGoog):'—'} color="#eab308" mono dim />
            <Stat label="Spesa Totale" value={f0(totSpend)} sub="Meta + Google" mono dim />
          </div>

          {/* Grafico Ratio mensile */}
          {data.some(m=>m.ratio!=null) && (
            <div style={{...S.card, marginBottom:16}}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:16,fontWeight:700,fontFamily:'Barlow Condensed'}}>Ratio LTV:CAC mensile</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{top:4,right:16,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:10,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:10,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.5} label={{value:'3:1',fill:'#22c55e',fontSize:10}} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="ratio" name="Ratio" stroke="#e8e8e8" strokeWidth={2} dot={{r:4,fill:'#e8e8e8'}} connectNulls />
                  <Line dataKey="mer"   name="MER"   stroke="#22c55e" strokeWidth={2} dot={{r:4,fill:'#22c55e'}} strokeDasharray="4 2" connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Grafico Fatturato vs Spesa */}
          {data.some(m=>m.fatturato>0) && (
            <div style={S.card}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:16,fontWeight:700,fontFamily:'Barlow Condensed'}}>Fatturato vs Spesa Ads</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{top:4,right:16,left:0,bottom:4}} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:10,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:10,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="fatturato"  name="Fatturato €"    fill="#22c55e" radius={[3,3,0,0]} opacity={0.85} />
                  <Bar dataKey="metaSpend"  name="Meta Ads €"     fill="#3b82f6" radius={[3,3,0,0]} opacity={0.85} />
                  <Bar dataKey="googleSpend" name="Google Ads €"  fill="#eab308" radius={[3,3,0,0]} opacity={0.85} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* ── MENSILE ── */}
      {tab==='monthly' && (
        <div className="fade-up">
          {/* Tabella input */}
          <div style={{...S.card, marginBottom:24}}>
            <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
              <span style={{fontSize:13,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.08em',textTransform:'uppercase'}}>Inserimento dati mensili</span>
              <span style={{fontSize:10,color:'#22c55e'}}>📘 Meta automatica · ⌨ Manuale</span>
            </div>
            <div style={{overflowX:'auto'}}>
              <table style={{width:'100%',borderCollapse:'collapse'}}>
                <thead>
                  <tr>
                    {['Mese','Fatturato Netto €','Ordini','Nuovi Clienti','Google Ads €','✓ Totale','📘 Meta Auto'].map(h=>(
                      <th key={h} style={S.th}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {avail.map(month => {
                    const d = months[month] || EMPTY
                    const metaSpend = (live?.metaMonthly||[]).find(x=>x.month===month)?.spend || 0
                    return (
                      <tr key={month} style={{borderBottom:'1px solid #0d1628'}}>
                        <td style={{...S.td,color:'#fff',fontWeight:800}}>{month}</td>
                        <td style={{...S.td,padding:'6px 8px'}}>
                          <NumInput value={d.fatturato||0} onChange={v=>updateMonth(month,'fatturato',v)} placeholder="es. 149473" color="#22c55e" />
                        </td>
                        <td style={{...S.td,padding:'6px 8px'}}>
                          <NumInput value={d.ordini||0} onChange={v=>updateMonth(month,'ordini',v)} placeholder="es. 1856" color="#3b82f6" isCount />
                        </td>
                        <td style={{...S.td,padding:'6px 8px'}}>
                          <NumInput value={d.nuoviClienti||0} onChange={v=>updateMonth(month,'nuoviClienti',v)} placeholder="es. 768" color="#06b6d4" isCount />
                        </td>
                        <td style={{...S.td,padding:'6px 8px'}}>
                          <NumInput value={d.googleSpend||0} onChange={v=>updateMonth(month,'googleSpend',v)} placeholder="es. 4383" color="#eab308" />
                        </td>
                        <td style={{...S.td,color:'#22c55e',fontWeight:700}}>{d.fatturato>0?f0(d.fatturato):'—'}</td>
                        <td style={{...S.td,color:'#3b82f6'}}>{metaSpend>0?f0(metaSpend):'—'}</td>
                      </tr>
                    )
                  })}
                  {/* TOTALE */}
                  <tr style={{background:'#070e1c',borderTop:'1px solid #1e2d47'}}>
                    <td style={{...S.td,color:'#888',fontWeight:700,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>TOTALE</td>
                    <td style={{...S.td,color:'#22c55e',fontWeight:700}}>{f0(totFat)}</td>
                    <td style={{...S.td,color:'#3b82f6',fontWeight:700}}>{fn(totOrd)}</td>
                    <td style={{...S.td,color:'#06b6d4',fontWeight:700}}>{fn(totNC)}</td>
                    <td style={{...S.td,color:'#eab308',fontWeight:700}}>{totGoog>0?f0(totGoog):'—'}</td>
                    <td style={{...S.td,color:'#22c55e',fontWeight:700}}>{f0(totFat)}</td>
                    <td style={{...S.td,color:'#3b82f6',fontWeight:700}}>{f0(totMeta)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Tabella KPI calcolati */}
          {data.some(m=>m.ratio!=null||m.mer!=null) && (
            <div style={{...S.card, marginBottom:24}}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:16,fontWeight:700,fontFamily:'Barlow Condensed'}}>KPI calcolati</p>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Mese','AOV','Spesa Totale','CAC','LTV','Ratio','MER'].map(h=>(
                        <th key={h} style={{...S.th,color:'#ffffff',fontWeight:700}}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((m,i) => (
                      <tr key={m.month} style={{background:i%2===0?'transparent':'#0a0a0a'}}>
                        <td style={{...S.td,color:'#fff',fontWeight:800}}>{m.month}</td>
                        <td style={{...S.td,color:'#e8e8e8'}}>{m.aov>0?f2(m.aov):'—'}</td>
                        <td style={{...S.td,color:'#888'}}>{m.totalSpend>0?f0(m.totalSpend):'—'}</td>
                        <td style={{...S.td,color:'#e8e8e8'}}>{m.cac?f2(m.cac):'—'}</td>
                        <td style={{...S.td,color:'#e8e8e8'}}>{m.ltv?f2(m.ltv):'—'}</td>
                        <td style={{...S.td,fontWeight:700,fontFamily:'Barlow',fontWeight:700,color:ratioColor(m.ratio)}}>{m.ratio?`${fr(m.ratio)}:1`:'—'}</td>
                        <td style={{...S.td,color:'#22c55e',fontWeight:600}}>{m.mer?`${fr(m.mer)}×`:'—'}</td>
                      </tr>
                    ))}
                    <tr style={{background:'#070e1c',borderTop:'1px solid #1e2d47'}}>
                      <td style={{...S.td,color:'#888',fontWeight:700,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>MEDIA</td>
                      <td style={{...S.td,color:'#e8e8e8',fontWeight:700}}>{avgAOV>0?f2(avgAOV):'—'}</td>
                      <td style={{...S.td,color:'#888',fontWeight:700}}>{totSpend>0?f0(Math.round(totSpend/avail.length)):'—'}</td>
                      <td style={{...S.td,fontWeight:700}}>{cacG?f2(cacG):'—'}</td>
                      <td style={{...S.td,fontWeight:700}}>{ltvG?f2(ltvG):'—'}</td>
                      <td style={{...S.td,fontWeight:800,fontFamily:'Barlow',fontWeight:700,fontSize:16,color:ratioColor(ratioG)}}>{ratioG?`${fr(ratioG)}:1`:'—'}</td>
                      <td style={{...S.td,color:'#22c55e',fontWeight:700}}>{merG?`${fr(merG)}×`:'—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Grafici dinamici */}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <div style={S.card}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>Fatturato vs Spesa Ads</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} barGap={3} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" vertical={false} />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="fatturato"  name="Fatturato" fill="#22c55e" radius={[2,2,0,0]} />
                  <Bar dataKey="metaSpend"  name="Meta"      fill="#3b82f6" radius={[2,2,0,0]} />
                  <Bar dataKey="googleSpend" name="Google"   fill="#eab308" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>CAC mensile</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="cac" name="CAC €" stroke="#e8e8e8" strokeWidth={2} dot={{r:4,fill:'#e8e8e8'}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={S.card}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>MER mensile</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(1)}×`} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="mer" name="MER" stroke="#22c55e" strokeWidth={2} dot={{r:4,fill:'#22c55e'}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <p style={{fontSize:12,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>Ratio LTV:CAC mensile</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9,fontFamily:'Barlow',fontWeight:700}} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} label={{value:'3:1',fill:'#22c55e',fontSize:9}} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="ratio" name="Ratio" stroke="#e8e8e8" strokeWidth={2} dot={{r:4}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── WEEKLY ── */}
      {tab==='weekly' && (
        <div className="fade-up">
          <WeeklyTab
            weeks={getWeeks()}
            data={weeks}
            onUpdate={updateWeek}
            cfg={cfg}
            S={S}
            metaWeekly={live?.metaWeekly||[]}
            shopifyWeekly={live?.shopifyWeekly||[]}
          />
        </div>
      )}

      {/* ── SIMULATORE ── */}
      {tab==='simulator' && (
        <div className="fade-up">
          <Simulator cfg={cfg} />
        </div>
      )}

      <div style={{textAlign:'center',fontSize:10,color:'#2a2a2a',marginTop:40,fontFamily:'Barlow',fontWeight:700}}>
        STMN FITNESS · LTV:CAC DASHBOARD · {new Date().getFullYear()}
      </div>
    </div>
  )
}
