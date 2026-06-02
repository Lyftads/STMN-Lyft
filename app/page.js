'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import VendroShell from './components/VendroShell'
import KPIBrainTab from './components/KPIBrainTab'
import CreativeTab from './components/CreativeTab'
import MetaDetailTab from './components/MetaDetailTab'
import PerformanceAgentTab from './components/PerformanceAgentTab'
import KlaviyoTab from './components/KlaviyoTab'
import CompetitorIntelTab from './components/CompetitorIntelTab'
import PriceComparisonTab from './components/PriceComparisonTab'
import IntegrationsTab from './components/IntegrationsTab'
import CROTab from './components/CROTab'
import WebsiteScannerTab from './components/WebsiteScannerTab'
import CreativeLabTab from './components/CreativeLabTab'
import Sparkline from './components/Sparkline'
import DeltaBadge from './components/DeltaBadge'
import DashboardInsights from './components/DashboardInsights'
import TimeframeSelector from './components/TimeframeSelector'
import MensileAgent from './components/MensileAgent'
import WeeklyAgent from './components/WeeklyAgent'
import QuarterAgent from './components/QuarterAgent'
import YearAgent from './components/YearAgent'
import SimulatorAgent from './components/SimulatorAgent'
import { PlatformBadges } from './components/PlatformIcon'

// ── Utils ─────────────────────────────────────────────────────
const f0 = n => n>0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'
const f2 = n => n>0 ? `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
const fn = n => n>0 ? Number(n).toLocaleString('it-IT') : '—'
const fp = n => n!=null ? `${Number(n).toFixed(1)}x` : '—'
const fr = n => n!=null ? `${Number(n).toFixed(2).replace('.',',')}` : '—'

const ratioStatus = r => r==null?'nd':r<1?'bad':r<3?'warn':'ok'
const ratioColor  = r => ({nd:'#555',bad:'#ef4444',warn:'#f59e0b',ok:'#22c55e'})[ratioStatus(r)]
const ratioLabel  = r => ({nd:'N/D',bad:'CRITICO',warn:'ATTENZIONE',ok:'OTTIMO'})[ratioStatus(r)]

const MONTHS_START = '2025-01'

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
    <div style={{
      background: 'rgba(8,8,15,0.92)',
      backdropFilter: 'blur(24px) saturate(1.8)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.8)',
      border: '1px solid rgba(255,255,255,0.12)',
      borderTopColor: 'rgba(255,255,255,0.20)',
      borderRadius: 12,
      padding: '10px 14px',
      fontSize: 12,
      fontWeight: 600,
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 24px rgba(41,151,255,0.18)',
      minWidth: 140,
    }}>
      <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 8, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 700 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 4, alignItems: 'baseline' }}>
          <span style={{ color: p.color, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, boxShadow: `0 0 10px ${p.color}, 0 0 4px ${p.color}` }} />
            {p.name}
          </span>
          <span style={{ color: '#fff', fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value==='number' && p.value>100 ? f0(p.value) : p.value?.toFixed?.(2) ?? p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Futuristic glowing dot with pulse
const FxDot = ({ cx, cy, color = '#fff' }) => {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={color} opacity={0.15}>
        <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#0a0a14" strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </g>
  )
}

function FxChartCard({ title, glowColor = '#2997ff', subtitle, children }) {
  return (
    <div className="fx-chart-card" style={{ '--fx-chart-glow': glowColor, marginBottom: 20 }}>
      <div className="fx-chart-header">
        <span className="fx-chart-dot" style={{ background: glowColor, boxShadow: `0 0 12px ${glowColor}, 0 0 4px ${glowColor}` }} />
        <span className="fx-chart-title">{title}</span>
        {subtitle && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto', marginRight: 10 }}>{subtitle}</span>}
        <span className="fx-chart-spark">
          <span /><span /><span />
        </span>
      </div>
      <div className="fx-chart-body">{children}</div>
    </div>
  )
}

const FxActiveDot = ({ cx, cy, color = '#fff' }) => {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill={color} opacity={0.18} />
      <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.35} />
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="#fff" strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
    </g>
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
          background:'var(--glass)',
          border:'1px solid var(--border)',
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
function Stat({ label, value, sub, color='var(--text)', mono, dim, sparkData, sparkColor, current, previous, sources, inverse }) {
  return (
    <div className="glass-card" style={{padding:'20px 22px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
        <div className="label">{label}</div>
        {sources && <PlatformBadges sources={sources} size={16} />}
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
        <div className={dim?'metric-value-sm':'metric-value'}>{value}</div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor || 'var(--accent)'} width={80} height={32} />}
      </div>
      <div style={{display:'flex',alignItems:'center',gap:8,marginTop:10}}>
        <DeltaBadge current={current} previous={previous} inverse={inverse} />
        {sub && <span style={{fontSize:12,color:'var(--text3)'}}>{sub}</span>}
      </div>
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
      <div style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:10,padding:28,width:340}}>
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
                style={{flex:1,background:'transparent',border:'1px solid var(--border)',borderRadius:4,padding:'6px 10px',color:'#e8e8e8',fontSize:14,fontFamily:'Barlow',fontWeight:700,textAlign:'right',outline:'none'}} />
              <span style={{fontSize:12,color:'#444',width:48}}>{u}</span>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:24}}>
          <button onClick={onClose} style={{flex:1,padding:'8px',border:'1px solid var(--border)',borderRadius:6,background:'none',color:'#888',cursor:'pointer',fontSize:13}}>Annulla</button>
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

  const defaultScenario = { name:'', spend:3000, roas:3, aov:75, cogs:38 }
  const [scenarios, setScenarios] = useState([
    { ...defaultScenario, name:'Conservativo', spend:2000, roas:2.5, cogs:38 },
    { ...defaultScenario, name:'Base', spend:4000, roas:3.5, cogs:38 },
    { ...defaultScenario, name:'Aggressivo', spend:8000, roas:4, cogs:38 },
  ])
  const setSc = (i,k,v) => setScenarios(prev => { const n=[...prev]; n[i]={...n[i],[k]:v}; return n })

  const IVA = 22

  const calcScenario = (sc) => {
    const revenueIvaInclusa = sc.spend * sc.roas
    const iva = revenueIvaInclusa * (IVA / (100 + IVA))
    const revenue = revenueIvaInclusa - iva
    const orders = sc.aov > 0 ? revenueIvaInclusa / sc.aov : 0
    const aovNetto = sc.aov / (1 + IVA / 100)
    const cogsAmount = revenue * (sc.cogs / 100)
    const marginePerOrdine = orders > 0 ? (revenue - cogsAmount) / orders : 0
    const marginePct = revenue > 0 ? ((revenue - cogsAmount) / revenue) * 100 : 0
    const profittoLordo = revenue - cogsAmount
    const profittoNetto = profittoLordo - sc.spend
    const netMarginPct = revenueIvaInclusa > 0 ? (profittoNetto / revenueIvaInclusa) * 100 : 0
    const mer = sc.spend > 0 ? revenueIvaInclusa / sc.spend : 0
    const cpo = orders > 0 ? sc.spend / orders : 0
    const breakEvenRoas = marginePct > 0 ? 100 / marginePct * (1 + IVA / 100) : 0
    return { revenueIvaInclusa, iva, revenue, orders, aovNetto, cogsAmount, marginePerOrdine, marginePct, profittoLordo, profittoNetto, netMarginPct, mer, cpo, breakEvenRoas }
  }

  // Palette minimale coerente con le altre tab:
  // slate (neutro), accent blu Apple, viola — niente verde/giallo accesi
  const scenarioColors = ['#64748b', '#2997ff', '#bf5af2']

  // Dati esposti al SimulatorAgent (CMO+CFO)
  const ltvInputs = { aov: s.aov, freq: s.freq, life: s.life, marginPct: s.margin, cac: s.cac }
  const ltvOutputs = {
    ltv: Math.round(ltv * 100) / 100,
    ratioLtvCac: Math.round(ratio * 100) / 100,
    cacForRatio3: Math.round(cacFor3),
    aovForRatio3: Math.round(aovFor3),
  }
  const cashFlowAnalysisFull = scenarios.map(sc => {
    const c = calcScenario(sc)
    const name = sc.name || ''
    const cashOut = sc.spend + c.cogsAmount
    const cashIn = c.revenueIvaInclusa
    const cashRatio = cashOut > 0 ? cashIn / cashOut : 0
    const monthsToRecover = c.profittoNetto > 0 ? sc.spend / c.profittoNetto : null
    const annualProfit = c.profittoNetto * 12
    const advAsRevenueShare = c.revenueIvaInclusa > 0 ? (sc.spend / c.revenueIvaInclusa) * 100 : 0
    return {
      name,
      input: { spend: sc.spend, roasTarget: sc.roas, aovIvaInclusa: sc.aov, cogsPct: sc.cogs },
      revenueIvaInclusa: Math.round(c.revenueIvaInclusa),
      iva: Math.round(c.iva),
      revenueNetto: Math.round(c.revenue),
      orders: Math.round(c.orders),
      aovNetto: Math.round(c.aovNetto * 100) / 100,
      cpo: Math.round(c.cpo * 100) / 100,
      cogsAmount: Math.round(c.cogsAmount),
      marginePerOrdine: Math.round(c.marginePerOrdine * 100) / 100,
      marginePct: Math.round(c.marginePct * 100) / 100,
      profittoLordo: Math.round(c.profittoLordo),
      profittoNetto: Math.round(c.profittoNetto),
      netMarginPct: Math.round(c.netMarginPct * 100) / 100,
      breakEvenRoas: Math.round(c.breakEvenRoas * 100) / 100,
      mer: Math.round(c.mer * 100) / 100,
      cashRatio: Math.round(cashRatio * 100) / 100,
      monthsToRecover: monthsToRecover != null ? Math.round(monthsToRecover * 10) / 10 : null,
      annualProfit: Math.round(annualProfit),
      advAsRevenueShare: Math.round(advAsRevenueShare * 10) / 10,
    }
  })
  const sm0 = n => n>0 ? `€${Math.round(n).toLocaleString('it-IT')}` : n<0 ? `-€${Math.round(Math.abs(n)).toLocaleString('it-IT')}` : '€0'
  const sm2 = n => `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const sp1 = n => `${Number(n).toFixed(1)}%`
  const si0 = n => n>0 ? Math.round(n).toLocaleString('it-IT') : '0'

  // Stile slider futuristico riutilizzabile
  const sliderStyle = {
    width: '100%',
    accentColor: '#22c55e',
    height: 6,
  }

  // Palette blu notte coerente con le altre tab
  const NIGHT_BLUE = '#1e3a8a'   // navy profondo (sliders fill base)
  const NIGHT_BLUE_LIGHT = '#3b82f6' // hue intermedio
  const ACCENT_GLOW = '#2997ff'  // accent Apple per glow/highlight

  // Glass card 3D futuristica: backdrop blur reale + border 3D +
  // sim-pulse (floating motion gentle) + sim-scan (horizontal sweep) +
  // top accent bar cr-shine + hover lift. Replica del look delle
  // glass-card di Monthly/Weekly/Quarter/Year.
  const fxBlock = (children, { glow = ACCENT_GLOW, padding = 24, delay = 0, dark = false } = {}) => (
    <div
      style={{
        position: 'relative',
        background: dark
          ? 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'blur(40px) saturate(2.2)',
        WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
        borderRadius: 22,
        overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.06)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.55)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
        animation: `sim-pulse 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = 'translateY(-8px) scale(1.012)'
        e.currentTarget.style.boxShadow = `0 60px 120px rgba(0,0,0,0.85), 0 30px 60px rgba(0,0,0,0.6), 0 0 80px ${glow}22, inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)`
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      {/* Top accent bar animata */}
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: `linear-gradient(90deg, transparent, ${glow}aa, transparent)`,
        filter: 'blur(0.3px)',
        opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3,
        pointerEvents: 'none',
      }} />
      {/* Scan-line orizzontale (gradient bianco) */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%',
        width: '40%',
        background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
        animation: `sim-scan 9s ease-in-out infinite`,
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      {/* LTV:CAC + Target 3:1 */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        {fxBlock((
          <>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 17, fontWeight: 900, letterSpacing: '-0.01em' }}>
                Simulatore LTV:CAC
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>
                Trascina gli slider per simulare lo scenario unit economics
              </p>
            </div>

            {[
              {k:'aov',   l:'AOV',                  min:20, max:250, step:1,    fmt:v=>`€${v}`},
              {k:'freq',  l:'Frequenza / anno',     min:1,  max:6,   step:0.01, fmt:v=>`${v.toFixed(2)}×`},
              {k:'life',  l:'Vita media (anni)',    min:0.5,max:6,   step:0.01, fmt:v=>`${v.toFixed(2)}`},
              {k:'margin',l:'Margine %',            min:5,  max:80,  step:1,    fmt:v=>`${v}%`},
              {k:'cac',   l:'CAC',                  min:5,  max:300, step:1,    fmt:v=>`€${v}`},
            ].map(({k,l,min,max,step,fmt}) => {
              const pct = ((s[k] - min) / (max - min)) * 100
              return (
                <div key={k} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</span>
                    <span style={{ fontSize: 14, fontFamily: 'Barlow', fontWeight: 900, color: '#fff' }}>{fmt(s[k])}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 999, overflow: 'hidden', marginBottom: 4, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0,
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${NIGHT_BLUE} 0%, ${NIGHT_BLUE_LIGHT} 100%)`,
                      borderRadius: 999,
                      boxShadow: `0 0 8px ${ACCENT_GLOW}40`,
                      transition: 'width 0.12s',
                    }} />
                  </div>
                  <input type="range" min={min} max={max} step={step} value={s[k]}
                    onChange={e=>set(k,parseFloat(e.target.value))}
                    style={{ ...sliderStyle, accentColor: NIGHT_BLUE_LIGHT, marginTop: -10, position: 'relative', zIndex: 1, opacity: 0.6 }} />
                </div>
              )
            })}
          </>
        ), { glow: '#2997ff', delay: 0 })}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RatioWidget ratio={ratio} mer={s.cac>0&&s.aov>0?ltv/s.cac:null} />

          {fxBlock((
            <>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 16, fontWeight: 900 }}>
                  Per raggiungere 3:1
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12 }}>
                  Cosa devi cambiare per arrivare al ratio target
                </p>
              </div>

              {[
                {l:'CAC target',    v:`€${Math.round(cacFor3)}`,  sub:`attuale €${s.cac} (${cacFor3<s.cac?'−':'+'} ${Math.abs(Math.round((s.cac-cacFor3)/s.cac*100))}%)`},
                {l:'AOV necessario', v:`€${Math.round(aovFor3)}`, sub:`attuale €${s.aov} (+${Math.round((aovFor3-s.aov)/s.aov*100)}%)`},
              ].map(({l,v,sub}) => (
                <div key={l} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.03)',
                  border: '1px solid rgba(255,255,255,0.06)',
                  borderTopColor: 'rgba(255,255,255,0.10)',
                  borderBottomColor: 'rgba(0,0,0,0.4)',
                  borderRadius: 12,
                  marginBottom: 10,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 700 }}>{l}</div>
                    <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 900, fontFamily: 'Barlow', color: ACCENT_GLOW }}>{v}</div>
                </div>
              ))}
            </>
          ), { glow: '#2997ff', padding: 22, delay: 0.7 })}
        </div>
      </div>

    {/* ── Scenari Advertising Simulator ── */}
    {fxBlock((
      <>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 900, letterSpacing: '-0.01em' }}>
          Scenari Advertising
        </h2>
        <p style={{ margin: '6px 0 0', color: 'var(--text3)', fontSize: 13 }}>
          Confronta 3 scenari · IVA 22% scorporata · COGS in % (prodotti + spedizione + packaging)
        </p>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:24}}>
        {scenarios.map((sc,i) => {
          const color = scenarioColors[i]
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                background: `linear-gradient(180deg, ${color}1f 0%, rgba(8,8,18,0.65) 38%, rgba(0,0,0,0.95) 100%)`,
                backdropFilter: 'blur(40px) saturate(2.2)',
                WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
                border: '1.5px solid rgba(255,255,255,0.06)',
                borderTopColor: `${color}55`,
                borderBottomColor: 'rgba(0,0,0,0.65)',
                borderRadius: 18,
                padding: 22,
                overflow: 'hidden',
                boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.5), 0 0 40px ${color}14, inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)`,
                animation: 'sim-pulse 6s ease-in-out infinite',
                animationDelay: `${i * 0.6}s`,
                transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.animationPlayState = 'paused'
                e.currentTarget.style.transform = 'translateY(-10px) scale(1.018)'
                e.currentTarget.style.boxShadow = `0 50px 100px rgba(0,0,0,0.8), 0 20px 40px rgba(0,0,0,0.55), 0 0 80px ${color}3a, inset 0 1.5px 0 rgba(255,255,255,0.1), inset 0 -1.5px 0 rgba(0,0,0,0.3)`
                e.currentTarget.style.borderTopColor = `${color}99`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.animationPlayState = 'running'
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = `0 24px 60px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.5), 0 0 40px ${color}14, inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)`
                e.currentTarget.style.borderTopColor = `${color}55`
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
                background: `linear-gradient(90deg, transparent, ${color}aa, transparent)`,
                filter: 'blur(0.3px)',
                animation: 'cr-shine 3.5s ease-in-out infinite',
                animationDelay: `${i * 0.3}s`,
                zIndex: 3,
                pointerEvents: 'none',
              }} />
              {/* Scan-line sweep */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: '-50%',
                width: '40%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)',
                animation: 'sim-scan 9s ease-in-out infinite',
                animationDelay: `${i * 0.8 + 1}s`,
                pointerEvents: 'none',
                zIndex: 1,
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 8,
                  background: `linear-gradient(135deg, ${color}, ${color}99)`,
                  color: '#fff', fontSize: 11, fontWeight: 900,
                  display: 'grid', placeItems: 'center',
                  boxShadow: `0 0 12px ${color}66`,
                }}>{i+1}</div>
                <input value={sc.name} onChange={e=>setSc(i,'name',e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color, fontSize: 15, fontWeight: 900,
                    outline: 'none', fontFamily: 'Inter',
                    letterSpacing: '-0.01em',
                  }}
                  placeholder={`Scenario ${i+1}`} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 6 }}>
                  Spesa ADV mensile
                </div>
                <input type="number" value={sc.spend} min={0} step={100}
                  onChange={e=>setSc(i,'spend',Math.max(0,parseFloat(e.target.value)||0))}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.35)',
                    border: `1px solid ${color}33`,
                    borderRadius: 10,
                    padding: '11px 14px',
                    color: '#fff',
                    fontSize: 16,
                    fontWeight: 900,
                    fontFamily: 'Barlow',
                    outline: 'none',
                    textAlign: 'right',
                  }}
                  placeholder="€" />
              </div>

              {[
                {k:'roas',l:'ROAS target',min:0.5,max:10,step:0.1,fmt:v=>`${v.toFixed(1)}×`},
                {k:'aov',l:'AOV medio (IVA inclusa)',min:20,max:300,step:1,fmt:v=>`€${v}`},
                {k:'cogs',l:'COGS %',min:5,max:80,step:1,fmt:v=>`${v}%`},
              ].map(({k,l,min,max,step,fmt})=>{
                const pct = ((sc[k] - min) / (max - min)) * 100
                return (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800 }}>{l}</span>
                      <span style={{ fontSize: 13, fontFamily: 'Barlow', fontWeight: 900, color: '#fff' }}>{fmt(sc[k])}</span>
                    </div>
                    <div style={{
                      position: 'relative', height: 5,
                      background: 'rgba(0,0,0,0.45)',
                      borderRadius: 999,
                      marginBottom: 4,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${NIGHT_BLUE}, ${color})`,
                        borderRadius: 999,
                        boxShadow: `0 0 6px ${color}55`,
                      }} />
                    </div>
                    <input type="range" min={min} max={max} step={step} value={sc[k]}
                      onChange={e=>setSc(i,k,parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: color, marginTop: -8, opacity: 0.4, height: 5 }} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'relative',
          background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
          backdropFilter: 'blur(40px) saturate(2.2)',
          WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
          borderRadius: 22,
          overflow: 'hidden',
          border: '1.5px solid rgba(255,255,255,0.06)',
          borderTopColor: 'rgba(255,255,255,0.12)',
          borderBottomColor: 'rgba(0,0,0,0.65)',
          boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
          animation: 'sim-pulse 6s ease-in-out infinite',
          animationDelay: '2.1s',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.animationPlayState = 'paused'
          e.currentTarget.style.transform = 'translateY(-6px) scale(1.008)'
          e.currentTarget.style.boxShadow = '0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 80px rgba(41,151,255,0.18), inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
          e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.animationPlayState = 'running'
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
          e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
        }}
      >
        {/* Top accent bar cr-shine */}
        <div style={{
          position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
          background: `linear-gradient(90deg, transparent, ${ACCENT_GLOW}88, transparent)`,
          filter: 'blur(0.3px)',
          opacity: 0.85,
          animation: 'cr-shine 4s ease-in-out infinite',
          zIndex: 3,
          pointerEvents: 'none',
        }} />
        {/* Scan-line sweep */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '-50%',
          width: '40%',
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
          animation: 'sim-scan 9s ease-in-out infinite',
          animationDelay: '3s',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
        <div style={{ overflowX: 'auto', position: 'relative', zIndex: 2 }}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr>
              <th style={{padding:'14px 18px',textAlign:'left',color:'var(--text3)',fontWeight:800,fontSize:10.5,textTransform:'uppercase',letterSpacing:'0.12em',borderBottom:'1.5px solid rgba(255,255,255,0.08)'}}>Metrica</th>
              {scenarios.map((sc,i)=>(
                <th key={i} style={{padding:'14px 18px',textAlign:'right',color:scenarioColors[i],fontWeight:900,fontSize:13,borderBottom:'1.5px solid rgba(255,255,255,0.08)',fontFamily:'Inter',letterSpacing:'-0.01em'}}>{sc.name||`Scenario ${i+1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {l:'Fatturato IVA inclusa', f:c=>sm0(c.revenueIvaInclusa), bold:true},
              {l:'IVA 22% (da scorporare)', f:c=>`-${sm0(c.iva)}`, muted:true},
              {l:'Fatturato netto (senza IVA)', f:c=>sm0(c.revenue), bold:true},
              {l:'Spesa ADV', f:(c,sc)=>sm0(sc.spend), muted:true},
              {l:'Ordini', f:c=>si0(c.orders)},
              {l:'AOV netto', f:c=>sm2(c.aovNetto)},
              {l:'ROAS', f:(c,sc)=>`${sc.roas.toFixed(1)}×`, bold:true},
              {l:'CPO', f:c=>sm2(c.cpo)},
              {l:'', sep:true},
              {l:'COGS', f:(c,sc)=>`${sc.cogs}%`, muted:true},
              {l:'COGS totale', f:c=>sm0(c.cogsAmount), bold:true, muted:true},
              {l:'Margine per ordine', f:c=>sm2(c.marginePerOrdine)},
              {l:'Margine %', f:c=>sp1(c.marginePct)},
              {l:'', sep:true},
              {l:'Profitto lordo (post COGS)', f:c=>sm0(c.profittoLordo), bold:true},
              {l:'Profitto netto (post ADV)', f:c=>sm0(c.profittoNetto), bold:true, color:c=>c.profittoNetto>=0?'#30d158':'#ff453a'},
              {l:'Net margin % (su lordo)', f:c=>sp1(c.netMarginPct), bold:true, color:c=>c.netMarginPct>=0?'#30d158':'#ff453a'},
              {l:'Break-even ROAS', f:c=>`${c.breakEvenRoas.toFixed(2)}×`, muted:true},
            ].map((row,ri) => {
              if (row.sep) return <tr key={ri}><td colSpan={4} style={{height:12,borderBottom:'1px solid rgba(255,255,255,0.04)'}} /></tr>
              return (
              <tr key={ri} style={{background:ri%2===0?'transparent':'rgba(255,255,255,0.015)',transition:'background 0.15s'}}>
                <td style={{padding:'11px 18px',color:'var(--text2)',fontWeight:row.bold?800:500,fontSize:row.bold?13:12.5,fontFamily:'Inter'}}>{row.l}</td>
                {scenarios.map((sc,i) => {
                  const calc = calcScenario(sc)
                  const cellColor = typeof row.color === 'function'
                    ? row.color(calc)
                    : row.color
                      ? row.color
                      : row.muted
                        ? 'var(--text3)'
                        : '#f5f5f7'
                  return <td key={i} style={{padding:'11px 18px',textAlign:'right',fontFamily:'Barlow',fontWeight:row.bold?900:700,fontSize:row.bold?16:13.5,color:cellColor}}>{row.f(calc,sc)}</td>
                })}
              </tr>
            )})}
          </tbody>
        </table>
        </div>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:20}}>
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
            backdropFilter: 'blur(40px) saturate(2.2)',
            WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
            border: '1.5px solid rgba(255,255,255,0.06)',
            borderTopColor: 'rgba(255,255,255,0.12)',
            borderBottomColor: 'rgba(0,0,0,0.65)',
            borderRadius: 22,
            padding: 22,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
            animation: 'sim-pulse 6s ease-in-out infinite',
            transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.animationPlayState = 'paused'
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.012)'
            e.currentTarget.style.boxShadow = '0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 60px rgba(41,151,255,0.18), inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.animationPlayState = 'running'
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
            background: `linear-gradient(90deg, transparent, #2997ff88, transparent)`,
            filter: 'blur(0.3px)',
            opacity: 0.85,
            animation: 'cr-shine 4s ease-in-out infinite',
            zIndex: 3,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '-50%',
            width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
            animation: 'sim-scan 9s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{fontSize:10.5,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.14em',margin:0,fontWeight:800}}>Fatturato vs Profitto netto</p>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'#30d158', boxShadow:'0 0 10px #30d158', animation:'card-pulse 2s ease-in-out infinite' }} />
              Live
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scenarios.map((sc,i)=>{const c=calcScenario(sc);return{name:sc.name||`Sc.${i+1}`,netto:c.revenue,profitto:c.profittoNetto}})} margin={{top:12,right:8,left:0,bottom:4}} barGap={6}>
              <defs>
                <linearGradient id="sim-bar-netto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="sim-bar-profitto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#30d158" stopOpacity={1} />
                  <stop offset="100%" stopColor="#15803d" stopOpacity={0.7} />
                </linearGradient>
                <filter id="sim-bar-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'var(--text3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`€${Math.round(v/1000)}k`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" />
              <Bar
                dataKey="netto"
                name="Fatt. netto"
                fill="url(#sim-bar-netto)"
                radius={[10,10,0,0]}
                animationDuration={1400}
                animationEasing="ease-out"
                style={{ filter: 'url(#sim-bar-glow)' }}
              />
              <Bar
                dataKey="profitto"
                name="Profitto netto"
                fill="url(#sim-bar-profitto)"
                radius={[10,10,0,0]}
                animationDuration={1400}
                animationBegin={180}
                animationEasing="ease-out"
                style={{ filter: 'url(#sim-bar-glow)' }}
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
            backdropFilter: 'blur(40px) saturate(2.2)',
            WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
            border: '1.5px solid rgba(255,255,255,0.06)',
            borderTopColor: 'rgba(255,255,255,0.12)',
            borderBottomColor: 'rgba(0,0,0,0.65)',
            borderRadius: 22,
            padding: 22,
            overflow: 'hidden',
            boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
            animation: 'sim-pulse 6s ease-in-out infinite',
            transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.animationPlayState = 'paused'
            e.currentTarget.style.transform = 'translateY(-8px) scale(1.012)'
            e.currentTarget.style.boxShadow = '0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 60px rgba(41,151,255,0.18), inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.animationPlayState = 'running'
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
            background: `linear-gradient(90deg, transparent, #2997ff88, transparent)`,
            filter: 'blur(0.3px)',
            opacity: 0.85,
            animation: 'cr-shine 4s ease-in-out infinite',
            zIndex: 3,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '-50%',
            width: '40%',
            background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
            animation: 'sim-scan 9s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{fontSize:10.5,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.14em',margin:0,fontWeight:800}}>Breakdown costi</p>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'#2997ff', boxShadow:'0 0 10px #2997ff', animation:'card-pulse 2s ease-in-out infinite' }} />
              Live
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scenarios.map((sc,i)=>{const c=calcScenario(sc);return{name:sc.name||`Sc.${i+1}`,iva:c.iva,cogs:c.cogsAmount,adv:sc.spend}})} margin={{top:12,right:8,left:0,bottom:4}} barGap={6}>
              <defs>
                <linearGradient id="sim-bar-iva" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.32)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.08)" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="sim-bar-cogs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="rgba(255,255,255,0.52)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.18)" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="sim-bar-adv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.8} />
                </linearGradient>
                <filter id="sim-bar-glow-2" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'var(--text3)',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`€${Math.round(v/1000)}k`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11, paddingTop: 10 }} iconType="circle" />
              <Bar
                dataKey="iva"
                name="IVA 22%"
                fill="url(#sim-bar-iva)"
                stackId="c"
                radius={[10,10,0,0]}
                animationDuration={1400}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="cogs"
                name="COGS"
                fill="url(#sim-bar-cogs)"
                stackId="c"
                animationDuration={1400}
                animationBegin={180}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="adv"
                name="Spesa ADV"
                fill="url(#sim-bar-adv)"
                stackId="c"
                radius={[0,0,10,10]}
                animationDuration={1400}
                animationBegin={360}
                animationEasing="ease-out"
                style={{ filter: 'url(#sim-bar-glow-2)' }}
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {(() => {
        const results = scenarios.map((sc,i)=>({...calcScenario(sc), name:sc.name||`Scenario ${i+1}`, spend:sc.spend, roas:sc.roas, cogs:sc.cogs, aov:sc.aov}))
        const best = results.reduce((a,b)=>b.profittoNetto>a.profittoNetto?b:a)
        const mostEfficient = results.reduce((a,b)=>b.netMarginPct>a.netMarginPct?b:a)
        const safest = results.reduce((a,b)=>b.marginePct>a.marginePct?b:a)

        const cashFlowAnalysis = results.map(r => {
          const cashOut = r.spend + r.cogsAmount
          const cashIn = r.revenueIvaInclusa
          const cashRatio = cashOut > 0 ? cashIn / cashOut : 0
          const monthsToRecover = r.profittoNetto > 0 ? r.spend / r.profittoNetto : null
          const annualProfit = r.profittoNetto * 12
          const advAsRevenueShare = r.revenueIvaInclusa > 0 ? (r.spend / r.revenueIvaInclusa) * 100 : 0
          const runway = r.profittoNetto < 0 ? Math.abs(r.profittoNetto) : 0
          return { ...r, cashOut, cashIn, cashRatio, monthsToRecover, annualProfit, advAsRevenueShare, runway }
        })

        const scalable = cashFlowAnalysis.filter(r => r.profittoNetto > 0 && r.netMarginPct >= 5)
        const risky = cashFlowAnalysis.filter(r => r.profittoNetto > 0 && r.netMarginPct < 5 && r.netMarginPct >= 0)
        const losing = cashFlowAnalysis.filter(r => r.profittoNetto < 0)

        return (
          <div
            style={{
              marginTop: 22,
              background: 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
              backdropFilter: 'blur(40px) saturate(2.2)',
              WebkitBackdropFilter: 'blur(40px) saturate(2.2)',
              border: '1.5px solid rgba(255,255,255,0.06)',
              borderTopColor: 'rgba(255,255,255,0.12)',
              borderBottomColor: 'rgba(0,0,0,0.65)',
              borderRadius: 22,
              padding: 28,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)',
              animation: 'sim-pulse 6s ease-in-out infinite',
              animationDelay: '2.8s',
              transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.animationPlayState = 'paused'
              e.currentTarget.style.transform = 'translateY(-6px) scale(1.008)'
              e.currentTarget.style.boxShadow = '0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 80px rgba(41,151,255,0.18), inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
              e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.animationPlayState = 'running'
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.85), 0 12px 24px rgba(0,0,0,0.6), 0 4px 8px rgba(0,0,0,0.45), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
              e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
              background: `linear-gradient(90deg, transparent, ${ACCENT_GLOW}88, transparent)`,
              filter: 'blur(0.3px)',
              animation: 'cr-shine 4s ease-in-out infinite',
              zIndex: 3,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: '-50%',
              width: '40%',
              background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',
              animation: 'sim-scan 9s ease-in-out infinite',
              animationDelay: '4s',
              pointerEvents: 'none',
              zIndex: 1,
            }} />

            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 900, letterSpacing: '-0.01em' }}>
                Analisi strategica CMO + CFO
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 12.5 }}>
                Lettura combinata marketing + finanza per ogni scenario
              </p>
            </div>

            {/* P&L Summary */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
                P&L mensile per scenario
              </p>
              {cashFlowAnalysis.map((r,i) => (
                <div key={i} style={{
                  background: 'rgba(255,255,255,0.03)',
                  border: '1.5px solid rgba(255,255,255,0.06)',
                  borderTopColor: 'rgba(255,255,255,0.10)',
                  borderBottomColor: 'rgba(0,0,0,0.4)',
                  borderLeftColor: scenarioColors[i],
                  borderLeftWidth: 3,
                  borderRadius: 12,
                  padding: '16px 18px',
                  marginBottom: 10,
                  boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{color:scenarioColors[i],fontWeight:900,fontSize:14.5}}>{r.name}</span>
                    <span style={{
                      color:r.profittoNetto>=0?'#22c55e':'#ef4444',
                      fontWeight:900, fontSize:19, fontFamily:'Barlow',
                    }}>{sm0(r.profittoNetto)}<span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginLeft: 4 }}>/mese</span></span>
                  </div>
                  <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:11.5,color:'var(--text3)',fontWeight:600}}>
                    <span>Fatt. lordo: <span style={{ color: 'var(--text2)' }}>{sm0(r.revenueIvaInclusa)}</span></span>
                    <span>IVA: <span style={{ color: 'var(--text2)' }}>-{sm0(r.iva)}</span></span>
                    <span>Fatt. netto: <span style={{ color: 'var(--text2)' }}>{sm0(r.revenue)}</span></span>
                    <span>COGS ({r.cogs}%): <span style={{ color: 'var(--text2)' }}>-{sm0(r.cogsAmount)}</span></span>
                    <span>ADV: <span style={{ color: 'var(--text2)' }}>-{sm0(r.spend)}</span></span>
                    <span>ADV/Revenue: <span style={{ color: 'var(--text2)' }}>{sp1(r.advAsRevenueShare)}</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cash Flow */}
            <div style={{marginBottom:22}}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:12}}>Flusso di cassa e sostenibilità</p>
              <div style={{
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.7,
                fontWeight: 500,
                background: 'rgba(255,255,255,0.03)',
                border: '1.5px solid rgba(255,255,255,0.06)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.4)',
                borderRadius: 12,
                padding: '16px 18px',
                boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
              }}>
                {cashFlowAnalysis.map((r,i) => {
                  const isSafe = r.profittoNetto > 0 && r.netMarginPct >= 10
                  const isOk = r.profittoNetto > 0 && r.netMarginPct >= 5
                  const isTight = r.profittoNetto > 0 && r.netMarginPct < 5
                  const isLosing = r.profittoNetto < 0
                  return (
                    <div key={i} style={{marginBottom:12,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
                      <span style={{color:scenarioColors[i],fontWeight:900}}>{r.name}:</span>{' '}
                      {isLosing && <span style={{color:'#ef4444'}}>In perdita di <strong>{sm0(Math.abs(r.profittoNetto))}/mese</strong>. Servono {sm0(r.runway)} di cassa extra ogni mese per sostenerlo. Non scalabile — stai finanziando la crescita di tasca tua. </span>}
                      {isTight && <span style={{color:'#f59e0b'}}>Margine netto solo al <strong>{sp1(r.netMarginPct)}</strong> — tecnicamente in profitto ma senza cuscinetto. Un calo del ROAS del 10% ti manda in perdita. Troppo rischioso per scalare. </span>}
                      {isOk && !isSafe && <span>Margine netto al <strong style={{color:'#22c55e'}}>{sp1(r.netMarginPct)}</strong> — sufficiente per scalare con cautela. Cash flow positivo di {sm0(r.profittoNetto)}/mese ({sm0(r.annualProfit)}/anno). </span>}
                      {isSafe && <span>Margine netto solido al <strong style={{color:'#22c55e'}}>{sp1(r.netMarginPct)}</strong>. Cash flow di {sm0(r.profittoNetto)}/mese = <strong>{sm0(r.annualProfit)}/anno</strong>. Puoi reinvestire il profitto per scalare senza rischio. </span>}
                      <span style={{color:'var(--text3)'}}>Cash in/out ratio: {r.cashRatio.toFixed(2)}× — per ogni €1 che esci, ne entrano €{r.cashRatio.toFixed(2)}. {r.cashRatio < 1.1 ? 'Troppo tirato.' : r.cashRatio < 1.3 ? 'Margine sottile.' : 'Sano.'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Strategia di scaling */}
            <div style={{marginBottom:22}}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:12}}>Strategia di scaling raccomandata</p>
              <div style={{
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.7,
                fontWeight: 500,
                background: 'rgba(255,255,255,0.03)',
                border: '1.5px solid rgba(255,255,255,0.06)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.4)',
                borderRadius: 12,
                padding: '16px 18px',
                boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
              }}>
                {scalable.length > 0 ? (
                  <>
                    <p style={{marginBottom:8}}>Lo scenario migliore per scalare è <strong style={{color:'#fff'}}>"{scalable.sort((a,b)=>b.annualProfit-a.annualProfit)[0].name}"</strong> — genera {sm0(scalable[0].annualProfit)} di profitto annuo con un margine netto del {sp1(scalable[0].netMarginPct)} che lascia spazio per imprevisti (calo ROAS stagionale, aumento CPM, resi).</p>
                    <p style={{marginBottom:8}}>Con COGS al {scalable[0].cogs}% e ADV che pesa il {sp1(scalable[0].advAsRevenueShare)} del fatturato lordo, la struttura dei costi è {scalable[0].advAsRevenueShare < 25 ? 'sana — c\'è margine per aumentare la spesa ADV se il ROAS tiene' : scalable[0].advAsRevenueShare < 35 ? 'nella media — monitora attentamente il ROAS, non c\'è molto margine di errore' : 'alta — l\'ADV pesa troppo sul fatturato, prima di scalare devi migliorare il ROAS o l\'AOV'}.</p>
                    {scalable[0].monthsToRecover && <p style={{marginBottom:8}}>Ogni mese di ADV si ripaga in <strong>{scalable[0].monthsToRecover < 1 ? 'meno di un mese' : `${scalable[0].monthsToRecover.toFixed(1)} mesi`}</strong> — {scalable[0].monthsToRecover < 1 ? 'ciclo di cassa velocissimo, ideale per scalare' : scalable[0].monthsToRecover < 3 ? 'ciclo ragionevole' : 'ciclo lungo, attenzione alla liquidità'}.</p>}
                  </>
                ) : risky.length > 0 ? (
                  <p style={{color:'var(--text2)'}}>Nessuno scenario ha margini sufficienti per scalare in sicurezza. <strong style={{color:'#fff'}}>"{risky[0].name}"</strong> è in profitto ma con margini troppo sottili ({sp1(risky[0].netMarginPct)}). Prima di scalare: lavora sull'AOV (bundle, upsell), riduci i COGS (negozia fornitori, packaging), o migliora il ROAS (creative testing, audience optimization).</p>
                ) : (
                  <p style={{color:'var(--text2)'}}>Tutti gli scenari sono in perdita. Non scalare la spesa ADV finché non raggiungi almeno il break-even. Concentrati su: migliorare il ROAS (creative, targeting), alzare l'AOV (bundle, cross-sell), ridurre i COGS, o valutare se il canale paid è sostenibile per il tuo modello di business.</p>
                )}
              </div>
            </div>

            {/* Visione a 12 mesi */}
            <div style={{marginBottom:18}}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:12}}>Proiezione 12 mesi</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {cashFlowAnalysis.map((r,i) => (
                  <div key={i} style={{
                    background: 'rgba(255,255,255,0.03)',
                    border: '1.5px solid rgba(255,255,255,0.06)',
                    borderTopColor: scenarioColors[i],
                    borderTopWidth: 2,
                    borderBottomColor: 'rgba(0,0,0,0.4)',
                    borderRadius: 12,
                    padding: '16px 18px',
                    boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
                  }}>
                    <div style={{color:scenarioColors[i],fontWeight:900,fontSize:12.5,marginBottom:10}}>{r.name} — 12 mesi</div>
                    <div style={{fontSize:11,color:'var(--text3)',lineHeight:1.8}}>
                      <div>Fatturato annuo: <strong style={{color:'var(--text)'}}>{sm0(r.revenueIvaInclusa * 12)}</strong></div>
                      <div>Spesa ADV annua: <strong style={{color:'var(--text)'}}>{sm0(r.spend * 12)}</strong></div>
                      <div>COGS annuo: <strong style={{color:'var(--text)'}}>{sm0(r.cogsAmount * 12)}</strong></div>
                      <div>IVA annua: <strong style={{color:'var(--text)'}}>{sm0(r.iva * 12)}</strong></div>
                      <div style={{borderTop:'1px solid rgba(255,255,255,0.06)',marginTop:8,paddingTop:8}}>
                        Profitto netto annuo: <strong style={{color:r.annualProfit>=0?'#30d158':'#ff453a',fontSize:15,fontFamily:'Barlow'}}>{sm0(r.annualProfit)}</strong>
                      </div>
                      <div>Ordini annui: <strong style={{color:'var(--text)'}}>{si0(r.orders * 12)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom line */}
            <div style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1.5px solid rgba(255,255,255,0.06)',
              borderTopColor: 'rgba(255,255,255,0.10)',
              borderBottomColor: 'rgba(0,0,0,0.4)',
              borderLeftColor: ACCENT_GLOW,
              borderLeftWidth: 3,
              borderRadius: 12,
              padding: '18px 22px',
              boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
            }}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:800,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:10}}>Bottom line</p>
              <div style={{fontSize:13,color:'var(--text)',lineHeight:1.65,fontWeight:500}}>
                Break-even ROAS: {cashFlowAnalysis.map(r=><span key={r.name}><strong style={{color:scenarioColors[results.indexOf(r)]}}>{r.name}</strong> = {r.breakEvenRoas.toFixed(2)}× · </span>)}
                <br/>Sotto questi valori perdi soldi. Sopra, ogni punto di ROAS in più è margine puro.
                {cashFlowAnalysis.some(r=>r.advAsRevenueShare>30) && <><br/><span style={{color:'var(--text2)'}}>La spesa ADV supera il 30% del fatturato in alcuni scenari — valuta di diversificare i canali (email, organic, referral) per ridurre la dipendenza dal paid.</span></>}
              </div>
            </div>
          </div>
        )
      })()}
      </>
    ), { glow: '#2997ff', padding: 28, delay: 1.4 })}

    <SimulatorAgent
      ltvInputs={ltvInputs}
      ltvOutputs={ltvOutputs}
      scenarios={scenarios}
      cashFlowAnalysis={cashFlowAnalysisFull}
    />
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
function WeeklyTab({ weeks, data, metaWeekly, shopifyWeekly, onUpdate, cfg, S, preset: presetProp, weeklyTF, setWeeklyTF, weeklyCustom, setWeeklyCustom, onRefresh, loading: loadingProp }) {
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
    background: 'var(--surface)',
    boxShadow: '0 1px 0 var(--border)',
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

  // ── Weekly timeframe filter ──
  const getMonday = (d) => { const dt = new Date(d); dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); return dt.toISOString().slice(0,10) }
  const today = new Date()
  const thisMonday = getMonday(today)
  const lastMonday = (() => { const d = new Date(thisMonday); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0,10) })()
  const lastSunday = (() => { const d = new Date(thisMonday); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10) })()
  const prevPrevMonday = (() => { const d = new Date(lastMonday); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0,10) })()

  const week3ago = (() => { const d = new Date(prevPrevMonday); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0,10) })()

  let tfWeeks = [], tfPrevWeeks = [], tfLabel = ''
  if (weeklyTF === 'this_week') {
    // Solo settimana corrente, delta vs settimana precedente
    tfWeeks = allWeeks.filter(w => w.key === thisMonday)
    tfPrevWeeks = allWeeks.filter(w => w.key === lastMonday)
    tfLabel = `Settimana corrente vs precedente`
  } else if (weeklyTF === 'last_week') {
    // Solo settimana precedente, delta vs quella prima
    tfWeeks = allWeeks.filter(w => w.key === lastMonday)
    tfPrevWeeks = allWeeks.filter(w => w.key === prevPrevMonday)
    tfLabel = `Settimana precedente vs quella prima`
  } else if (weeklyTF === 'custom' && weeklyCustom.since && weeklyCustom.until) {
    // Custom: solo la settimana selezionata (range), delta vs periodo precedente
    tfWeeks = allWeeks.filter(w => w.key >= weeklyCustom.since && w.key <= weeklyCustom.until)
    const span = tfWeeks.length || 1
    const firstKey = tfWeeks[0]?.key || weeklyCustom.since
    const prevEnd = (() => { const d = new Date(firstKey); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10) })()
    const prevStart = (() => { const d = new Date(firstKey); d.setUTCDate(d.getUTCDate() - span * 7); return d.toISOString().slice(0,10) })()
    tfPrevWeeks = allWeeks.filter(w => w.key >= prevStart && w.key <= prevEnd)
    tfLabel = `${weeklyCustom.since} → ${weeklyCustom.until} vs periodo prec.`
  } else {
    tfWeeks = allWeeks.filter(w => w.key === thisMonday)
    tfPrevWeeks = allWeeks.filter(w => w.key === lastMonday)
    tfLabel = `Settimana corrente vs precedente`
  }

  // Righe tabella: settimana selezionata + precedente (più recente in alto)
  const tableWeeks = [...tfWeeks, ...tfPrevWeeks].sort((a, b) => b.key.localeCompare(a.key))

  // Available weeks for custom selector (all Monday dates with data)
  const availableWeeks = allWeeks.filter(w => w.fat > 0 || w.adv > 0 || w.metaAuto || w.shopifyAuto)

  const sumW = (arr, key) => arr.reduce((s, w) => s + asNum(w[key]), 0)
  const divW = (a, b) => b > 0 ? a / b : null

  const tf = { fat: sumW(tfWeeks,'fat'), ord: sumW(tfWeeks,'ord'), nc: sumW(tfWeeks,'nc'), rc: sumW(tfWeeks,'rc'), meta: sumW(tfWeeks,'meta'), google: sumW(tfWeeks,'google'), ses: sumW(tfWeeks,'ses') }
  tf.adv = tf.meta + tf.google; tf.aov = divW(tf.fat, tf.ord); tf.mer = divW(tf.fat, tf.adv); tf.cac = divW(tf.adv, tf.nc)
  tf.ratio = tf.aov && tf.cac ? (tf.aov * cfg.freq * cfg.life * cfg.margin / 100) / tf.cac : null

  const tfP = { fat: sumW(tfPrevWeeks,'fat'), ord: sumW(tfPrevWeeks,'ord'), nc: sumW(tfPrevWeeks,'nc'), rc: sumW(tfPrevWeeks,'rc'), meta: sumW(tfPrevWeeks,'meta'), google: sumW(tfPrevWeeks,'google'), ses: sumW(tfPrevWeeks,'ses') }
  tfP.adv = tfP.meta + tfP.google; tfP.aov = divW(tfP.fat, tfP.ord); tfP.mer = divW(tfP.fat, tfP.adv); tfP.cac = divW(tfP.adv, tfP.nc)
  tfP.ratio = tfP.aov && tfP.cac ? (tfP.aov * cfg.freq * cfg.life * cfg.margin / 100) / tfP.cac : null

  const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 30 }) => {
    const vals = dataArr.map(d => Number(d[dataKey] || 0))
    if (vals.length < 2 || vals.every(v => v === 0)) return null
    const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1
    const points = vals.map((v, i) => `${(i/(vals.length-1))*width},${height-((v-min)/range)*(height-4)-2}`).join(' ')
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }

  const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
    if (prev == null || prev === 0 || curr == null) return null
    const pctV = ((curr - prev) / prev) * 100
    if (Math.abs(pctV) < 0.1) return null
    const up = pctV > 0, good = isLowerBetter ? !up : up
    return <span style={{ fontSize:11, fontWeight:800, padding:'3px 8px', borderRadius:6, background:good?'#22c55e20':'#ef444420', color:good?'#22c55e':'#ef4444' }}>{up?'+':''}{pctV.toFixed(2)}%</span>
  }

  const ratioColor2 = r => r==null?'#555':r<1?'#ef4444':r<3?'#f59e0b':'#22c55e'
  const fr2 = n => n!=null ? `${Number(n).toFixed(2).replace('.',',')}` : '—'
  const kpiCards = [
    { label:'Fatturato', val:tf.fat, prev:tfP.fat, fmt:money0, color:'var(--green)', key:'fat', sources:['shopify'] },
    { label:'Ordini', val:tf.ord, prev:tfP.ord, fmt:int0, color:'var(--accent)', key:'ord', sources:['shopify'] },
    { label:'AOV', val:tf.aov, prev:tfP.aov, fmt:money2, color:'var(--orange)', key:'aov', sources:['shopify'] },
    { label:'Nuovi Clienti', val:tf.nc, prev:tfP.nc, fmt:int0, color:'var(--cyan)', key:'nc', sources:['shopify'] },
    { label:'Clienti Ritorno', val:tf.rc, prev:tfP.rc, fmt:int0, color:'var(--purple)', key:'rc', sources:['shopify'] },
    { label:'MER', val:tf.mer, prev:tfP.mer, fmt:v=>v!=null?`${fr2(v)}×`:'—', color:tf.mer!=null?(tf.mer>=3?'var(--green)':tf.mer>=2?'var(--orange)':'var(--red)'):'var(--text3)', key:'mer', sources:['shopify','meta'] },
    { label:'CAC', val:tf.cac, prev:tfP.cac, fmt:money2, color:'var(--text)', key:'cac', lower:true, sources:['shopify','meta','google'] },
    { label:'Ratio LTV:CAC', val:tf.ratio, prev:tfP.ratio, fmt:v=>v!=null?`${fr2(v)}:1`:'—', color:ratioColor2(tf.ratio), key:'ratio', sources:['shopify','meta'] },
    { label:'Meta Spend', val:tf.meta, prev:tfP.meta, fmt:money0, color:'var(--accent)', key:'meta', sources:['meta'] },
    { label:'Google Spend', val:tf.google, prev:tfP.google, fmt:v=>v>0?money0(v):'—', color:'var(--yellow)', key:'google', sources:['google'] },
  ]

  return (
    <>
      {/* Timeframe selector */}
      <div style={{...S.card, marginBottom:16, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        {[
          { id:'this_week', l:'Questa settimana' },
          { id:'last_week', l:'Settimana precedente' },
          { id:'custom', l:'Custom' },
        ].map(b => (
          <button key={b.id} onClick={()=>setWeeklyTF(b.id)} style={{
            fontSize:12, padding:'6px 14px', borderRadius:6, cursor:'pointer',
            border: weeklyTF===b.id?'1px solid #22c55e':'1px solid var(--border)',
            background: weeklyTF===b.id?'#22c55e20':'transparent',
            color: weeklyTF===b.id?'#22c55e':'#94a3b8',
            fontWeight: weeklyTF===b.id?700:500,
          }}>{b.l}</button>
        ))}
        {weeklyTF==='custom' && (
          <>
            <span style={{fontSize:11,color:'var(--text3)'}}>Da:</span>
            <select value={weeklyCustom.since} onChange={e=>setWeeklyCustom(p=>({...p,since:e.target.value}))}
              style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'#e8e8e8',fontSize:12}}>
              <option value="">Seleziona settimana</option>
              {availableWeeks.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
            <span style={{color:'#555'}}>→</span>
            <span style={{fontSize:11,color:'var(--text3)'}}>A:</span>
            <select value={weeklyCustom.until} onChange={e=>setWeeklyCustom(p=>({...p,until:e.target.value}))}
              style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'#e8e8e8',fontSize:12}}>
              <option value="">Seleziona settimana</option>
              {availableWeeks.filter(w => !weeklyCustom.since || w.key >= weeklyCustom.since).map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
          </>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={loadingProp} style={{
            marginLeft:'auto', fontSize:12, padding:'6px 14px', borderRadius:6,
            border:'1px solid var(--border)', background:loadingProp?'var(--glass)':'transparent',
            color:loadingProp?'#555':'#94a3b8', fontWeight:700, cursor:loadingProp?'wait':'pointer',
            display:'flex', alignItems:'center', gap:6,
          }}>
            <span style={{animation:loadingProp?'spin 1s linear infinite':'none'}}>↻</span>
            {loadingProp?'Aggiorno…':'Aggiorna'}
          </button>
        )}
        <span style={{fontSize:11,color:'var(--text3)'}}>{tfLabel}</span>
      </div>

      {/* KPI summary cards */}
      <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
              <div className="label">{kpi.label}</div>
              <PlatformBadges sources={kpi.sources} size={16} />
            </div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
              <div className="metric-value">{kpi.fmt(kpi.val)}</div>
              <Sparkline dataArr={filled} dataKey={kpi.key} color={kpi.color} />
            </div>
            <div style={{marginTop:10}}><DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} /></div>
          </div>
        ))}
      </div>

      {/* Data entry table */}
      <FxChartCard title="Dati settimanali" glowColor="#22c55e" subtitle="Shopify + Meta automatici · Google manuale">
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
              {tableWeeks.map((w, i) => {
                const p = tableWeeks[i + 1]

                return (
                  <tr key={w.key} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
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

              {tfWeeks.length > 1 && (
              <tr style={{ background: 'var(--glass)', borderTop: '1px solid var(--border)' }}>
                <td style={{
                  ...TD, color: '#94a3b8', fontWeight: 900, fontSize: 10,
                  textTransform: 'uppercase', letterSpacing: '0.1em', fontFamily: 'Barlow Condensed',
                }}>Totale</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(tf.fat)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(sumW(tfWeeks,'fatNC'))}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(sumW(tfWeeks,'fatRC'))}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(tf.meta)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.google>0?money0(tf.google):'—'}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(tf.ord)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(tf.nc)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(tf.rc)}</td>
                <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{int0(tf.ses)}</td>
              </tr>
              )}
            </tbody>
          </table>
        </div>
      </FxChartCard>

      {tfWeeks.filter(w => w.fat > 0 || w.adv > 0).length > 0 && (
        <FxChartCard title="KPI calcolati" glowColor="#a78bfa">
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
                {tableWeeks.map((w, i, arr) => {
                  const p = arr[i + 1]

                  return (
                    <tr key={w.key} style={{ background: i % 2 === 0 ? 'transparent' : 'var(--surface)' }}>
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

                {tfWeeks.filter(w => w.fat > 0 || w.adv > 0).length > 1 && (
                <tr style={{ background: 'var(--glass)', borderTop: '1px solid var(--border)' }}>
                  <td style={{ ...TD, color:'var(--text2)', fontWeight:900, fontSize:10, textTransform:'uppercase', letterSpacing:'0.1em', fontFamily:'Barlow Condensed' }}>Media / Totale</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(tf.fat)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(sumW(tfWeeks,'fatNC'))}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(sumW(tfWeeks,'fatRC'))}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{money0(tf.adv)}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.mer!=null?`${dec2(tf.mer)}×`:'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{divW(sumW(tfWeeks,'fatNC'),tf.adv)!=null?`${dec2(divW(sumW(tfWeeks,'fatNC'),tf.adv))}×`:'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.cac?money2(tf.cac):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{divW(tf.adv,tf.ord)?money2(divW(tf.adv,tf.ord)):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.aov?money2(tf.aov):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{divW(sumW(tfWeeks,'fatNC'),tf.nc)?money2(divW(sumW(tfWeeks,'fatNC'),tf.nc)):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{divW(sumW(tfWeeks,'fatRC'),tf.rc)?money2(divW(sumW(tfWeeks,'fatRC'),tf.rc)):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.nc+tf.rc>0?pct1(tf.rc/(tf.nc+tf.rc)*100):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.ses>0&&tf.ord>0?pct2(tf.ord/tf.ses*100):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.aov?money2(tf.aov*cfg.freq*cfg.life*cfg.margin/100):'—'}</td>
                  <td style={{ ...TD, color: WHITE, fontWeight: 900 }}>{tf.ratio?`${dec2(tf.ratio)}:1`:'—'}</td>
                </tr>
                )}
              </tbody>
            </table>
          </div>
        </FxChartCard>
      )}

      {filled.length > 0 && (
        <>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <FxChartCard title="Fatturato, Spesa e MER" glowColor="#22c55e">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="wkfx-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="wkfx-spend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="wkfx-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="blur"/>
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                  <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                  <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#wkfx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#wkfx-glow)'}} />
                  <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#wkfx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationBegin={200} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </FxChartCard>

            <FxChartCard title="Nuovi clienti e clienti di ritorno" glowColor="#06b6d4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                  <defs>
                    <linearGradient id="wkfx-nc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                    </linearGradient>
                    <linearGradient id="wkfx-rc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                  <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                  <Bar dataKey="nc" name="Nuovi clienti" fill="url(#wkfx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                  <Bar dataKey="rc" name="Clienti ritorno" fill="url(#wkfx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </FxChartCard>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="wkfx-aov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="wkfx-cro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                  <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                  <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#wkfx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                  <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#wkfx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </FxChartCard>

            <FxChartCard title="Ratio LTV:CAC" glowColor="#a78bfa">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="wkfx-ratio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                      <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:700,position:'right'}} />
                  <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                  <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                  <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#wkfx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </FxChartCard>
          </div>
        </>
      )}

      {/* AI Insights & To-do */}
      <DashboardInsights preset={presetProp} />

      {/* Floating Weekly Agent */}
      <WeeklyAgent weeks={filled} preset={presetProp} />
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
  const [preset, setPreset] = useState('today')
  const [monthlyTF, setMonthlyTF] = useState('this_month')
  const [monthlyCustom, setMonthlyCustom] = useState({ since: '', until: '' })
  const [weeklyTF, setWeeklyTF] = useState('this_week')
  const [weeklyCustom, setWeeklyCustom] = useState({ since: '', until: '' })

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
      const r = await fetch(`/api/metrics?preset=${encodeURIComponent(preset)}`)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      setLive(await r.json())
      setUpdated(new Date())
    } catch(e) { console.log(e.message) }
    finally { setLoading(false) }
  }, [preset])

  useEffect(() => { fetchLive() }, [fetchLive])

  // Auto-allinea il preset al tipo di tab quando l'utente entra nella tab Quarter/Year/Monthly
  // (altrimenti shopifyRange continua a portare i dati del preset precedente, es. last_7d)
  useEffect(() => {
    const now = new Date()
    if (tab === 'year' && !(typeof preset === 'string' && preset.startsWith('year_'))) {
      setPreset(`year_${now.getFullYear()}`)
    } else if (tab === 'quarter' && !(typeof preset === 'string' && preset.startsWith('quarter_'))) {
      const q = Math.floor(now.getMonth() / 3) + 1
      setPreset(`quarter_${now.getFullYear()}-Q${q}`)
    } else if (tab === 'monthly' && !(typeof preset === 'string' && preset.startsWith('month_'))) {
      setPreset(`month_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Range helpers for sparklines + deltas ──
  const kpiRange = live?.kpiBrain?.range || null
  const kpiPrevRange = live?.kpiBrain?.previousRange || null

  const filterByRange = (rows, range, dateField) => {
    if (!range?.since || !range?.until || !Array.isArray(rows)) return []
    return rows.filter(r => {
      const d = r[dateField || 'date'] || r.month
      return d && d >= range.since && d <= range.until
    })
  }

  const shopifyWeeklyAll = live?.shopifyWeekly || []
  const metaWeeklyAll = live?.metaWeekly || []

  const swCurrent = filterByRange(shopifyWeeklyAll, kpiRange)
  const swPrev = filterByRange(shopifyWeeklyAll, kpiPrevRange)
  const mwCurrent = filterByRange(metaWeeklyAll, kpiRange)
  const mwPrev = filterByRange(metaWeeklyAll, kpiPrevRange)

  const sumField = (rows, field) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0)

  const periodTotals = {
    revenue: sumField(swCurrent, 'fatturato'),
    orders: sumField(swCurrent, 'ordini'),
    nc: sumField(swCurrent, 'nc'),
    rc: sumField(swCurrent, 'rc'),
    sessions: sumField(swCurrent, 'uniqueSessions'),
    resi: sumField(swCurrent, 'resi'),
    metaSpend: sumField(mwCurrent, 'spend'),
    impressions: sumField(mwCurrent, 'impressions'),
    clicks: sumField(mwCurrent, 'linkClicks'),
  }

  const spr = live?.shopifyPrevRange || {}
  const mpr = live?.metaPrevRange || {}
  const prevTotals = {
    revenue: Number(spr.revenue)  || sumField(swPrev, 'fatturato'),
    orders:  Number(spr.orders)   || sumField(swPrev, 'ordini'),
    nc:      Number(spr.nc)       || sumField(swPrev, 'nc'),
    rc:      Number(spr.rc)       || sumField(swPrev, 'rc'),
    sessions:Number(spr.sessions) || sumField(swPrev, 'uniqueSessions'),
    resi:    Number(spr.resi)     || sumField(swPrev, 'resi'),
    metaSpend:   Number(mpr.spend)       || sumField(mwPrev, 'spend'),
    impressions: Number(mpr.impressions) || sumField(mwPrev, 'impressions'),
    clicks:      Number(mpr.clicks)      || sumField(mwPrev, 'linkClicks'),
  }

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

  // ── Subset filtrato per periodo selezionato ───────────────
  const currentYear = String(new Date().getFullYear())
  const rangeStart = kpiRange?.since?.slice(0, 7) || `${currentYear}-01`
  const rangeEnd = kpiRange?.until?.slice(0, 7) || `${currentYear}-12`
  const dataYear = data.filter(m => m.month >= rangeStart && m.month <= rangeEnd)

  // ── Totali periodo selezionato ──
  // Se shopifyRange/metaRange è presente (live API ok), TRUST quei valori
  // anche se 0 — sono i dati esatti del range. Solo se l'API è fallita
  // (oggetto null) cascade su periodTotals settimanali → dataYear mensile.
  const sr = live?.shopifyRange
  const mr = live?.metaRange
  const hasSr = sr != null
  const hasMr = mr != null

  const sumMonthly = (k) => dataYear.reduce((s,m)=>s + Number(m[k] || 0), 0)

  const totFat   = hasSr ? Number(sr.revenue || 0)   : (periodTotals.revenue || sumMonthly('fatturato'))
  const totFatNC = hasSr ? Number(sr.fatturNC || 0)  : sumMonthly('fatturNC')
  const totFatRC = hasSr ? Number(sr.fatturRC || 0)  : sumMonthly('fatturRC')

  const totResi   = hasSr ? Number(sr.resi || 0)   : sumMonthly('resi')
  const totResiNC = hasSr ? Number(sr.resiNC || 0) : sumMonthly('resiNC')
  const totResiRC = hasSr ? Number(sr.resiRC || 0) : sumMonthly('resiRC')

  const totOrd = hasSr ? Number(sr.orders || 0)   : (periodTotals.orders || sumMonthly('ordini'))
  const totNC  = hasSr ? Number(sr.nc || 0)       : (periodTotals.nc     || sumMonthly('nc'))
  const totRC  = hasSr ? Number(sr.rc || 0)       : (periodTotals.rc     || sumMonthly('rc'))
  const totSes = hasSr ? Number(sr.sessions || 0) : sumMonthly('sessioni')

  const totMeta  = hasMr ? Number(mr.spend || 0) : (periodTotals.metaSpend || sumMonthly('metaSpend'))
  const totGoog  = sumMonthly('googleSpend')
  const totSpend = totMeta + totGoog

  const avgAOV   = totOrd > 0 ? totFat   / totOrd : 0
  const avgAOVNC = totNC  > 0 ? totFatNC / totNC  : 0
  const avgAOVRC = totRC  > 0 ? totFatRC / totRC  : 0

  const avgLTVGross = avgAOV > 0 ? avgAOV * cfg.freq * cfg.life : null
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
    card: { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:10, padding:24 },
    th:   { padding:'10px 14px', fontSize:11, color:'#ffffff', textTransform:'uppercase', letterSpacing:'0.1em', textAlign:'left', fontWeight:700, fontFamily:'Barlow Condensed', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
    td:   { padding:'10px 14px', fontSize:14, borderBottom:'1px solid var(--surface)', fontFamily:'Barlow', fontWeight:500 },
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
    preset={preset}
    setPreset={setPreset}
    loading={loading}
    onRefresh={fetchLive}
  >
    {showCfg && <Settings cfg={cfg} onSave={c=>setCfg(c)} onClose={()=>setShowCfg(false)} />}

      {/* ⬇⬇⬇ DA QUI IN GIÙ: lascia il tuo JSX ORIGINALE invariato (header, tabs, dashboard cards, grafici, tab Mensile/Weekly/Simulatore/MetaDetail, chiusura return e chiusura componente) ⬇⬇⬇ */}

  

      {/* DASHBOARD TAB */}
      {tab==='dashboard' && (
        <>
          <div className="reveal-zoom" style={{marginBottom:24}}>
            <RatioWidget ratio={avgRatio} mer={avgMER} />
          </div>

          <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:14,marginBottom:20}}>
            <Stat label="Fatturato" value={totFat>0?f0(totFat):'—'} sources={['shopify']}
              sparkData={swCurrent.map(w=>w.fatturato)} sparkColor="var(--green)"
              current={totFat} previous={prevTotals.revenue} />
            <Stat label="Ordini" value={totOrd>0?fn(totOrd):'—'} sources={['shopify']}
              sparkData={swCurrent.map(w=>w.ordini)} sparkColor="var(--accent)"
              current={totOrd} previous={prevTotals.orders} />
            <Stat label="AOV medio" value={avgAOV ? f2(avgAOV) : '—'} sources={['shopify']}
              sparkData={swCurrent.map(w=> w.ordini > 0 ? w.fatturato/w.ordini : 0)}
              current={avgAOV} previous={prevTotals.orders > 0 ? prevTotals.revenue/prevTotals.orders : null} />
            <Stat label="Nuovi clienti" value={totNC>0?fn(totNC):'—'} sources={['shopify']}
              sparkData={swCurrent.map(w=>w.nc)} sparkColor="var(--cyan)"
              current={totNC} previous={prevTotals.nc} />
          </div>

          <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:14,marginBottom:20}}>
            <Stat label="LTV lordo" value={avgLTVGross ? f2(avgLTVGross) : '—'} sources={['shopify']} sub={`${cfg.freq}× · ${cfg.life}a`} />
            <Stat label="LTV netto" value={avgLTV ? f2(avgLTV) : '—'} sources={['shopify']} sub={`${cfg.freq}× · ${cfg.life}a · ${cfg.margin}%`} />
            <Stat label="CAC" value={avgCAC ? f2(avgCAC) : '—'} sources={['shopify','meta','google']} sub={`${fn(totNC)} NC`}
              current={avgCAC} previous={prevTotals.nc > 0 ? (Number(mr?.spend || prevTotals.metaSpend))/prevTotals.nc : null} inverse />
            <Stat label="Spesa Meta" value={totMeta>0?f0(totMeta):'—'} sources={['meta']}
              sparkData={mwCurrent.map(w=>w.spend)} sparkColor="var(--accent)"
              current={periodTotals.metaSpend} previous={prevTotals.metaSpend} />
            <Stat label="Spesa totale" value={totSpend>0?f0(totSpend):'—'} sources={['meta','google']} sub="Meta + Google" />
          </div>

          {totResi > 0 && (
            <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
              <Stat label="Resi totali" value={f0(totResi)} sources={['shopify']} />
              <Stat label="Resi nuovi clienti" value={totResiNC>0?f0(totResiNC):'—'} sources={['shopify']} dim />
              <Stat label="Resi clienti ritorno" value={totResiRC>0?f0(totResiRC):'—'} sources={['shopify']} dim />
            </div>
          )}

          <div className="reveal-zoom glass-section" style={{padding:28}}>
            <p className="label" style={{marginBottom:18}}>
              Ratio LTV:CAC mensile
            </p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={data} margin={{top:4,right:16,left:0,bottom:4}}>
                <CartesianGrid strokeDasharray="2 4" stroke="var(--border)" />
                <XAxis dataKey="month" tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} />
                <YAxis tick={{fill:'var(--text3)',fontSize:11}} axisLine={false} tickLine={false} />
                <ReferenceLine y={3} stroke="var(--green)" strokeDasharray="4 4" strokeOpacity={0.4} label={{value:'3:1',fill:'var(--green)',fontSize:10}} />
                <Tooltip content={<ChartTip />} />
                <Legend />
                <Line dataKey="ratio" name="Ratio" stroke="var(--green)" strokeWidth={2} dot={{r:3,fill:'var(--green)'}} strokeDasharray="6 4" connectNulls />
                <Line dataKey="mer" name="MER" stroke="var(--text)" strokeWidth={2} dot={{r:3,fill:'var(--text)'}} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>

          <DashboardInsights preset={preset} />
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
    shopifyWeeklyAll={shopifyWeeklyAll}
    metaWeeklyAll={metaWeeklyAll}
    onRefresh={fetchLive}
    loading={loading}
    preset={preset}
    setPreset={setPreset}
  />
)}
      {/* MENSILE TAB */}
      {tab==='monthly' && (() => {
        const filled = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
        const MONTH_NAMES_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
        const monthName = (s) => {
          if (!s) return ''
          const [y, m] = s.split('-').map(Number)
          return `${MONTH_NAMES_IT[m-1]} ${y}`
        }
        const mTH = {
          position:'sticky', top:0, zIndex:20,
          padding:'18px 20px', fontSize:11, fontWeight:800,
          textTransform:'uppercase', letterSpacing:'0.10em',
          textAlign:'left', whiteSpace:'nowrap',
          color:'var(--text2)',
          background:'rgba(255,255,255,0.025)',
          backdropFilter:'blur(20px)',
          borderBottom:'1.5px solid rgba(255,255,255,0.08)',
        }
        const mTHmonth = {
          ...mTH, color:'var(--text)', fontSize:13, letterSpacing:'-0.01em', textTransform:'none', fontWeight:700,
        }
        const mTD = {
          padding:'14px 20px', fontSize:15, fontWeight:500,
          verticalAlign:'top', borderBottom:'1px solid rgba(255,255,255,0.04)',
          color:'var(--text)',
        }
        const mVal = { fontWeight:800, fontSize:18, lineHeight:1.15, color:'var(--text)', letterSpacing:'-0.01em', fontVariantNumeric:'tabular-nums' }

        const mDelta = (curr, prev, kind='euro0', inverse=false) => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff / p * 100 : null
          const isDown = diff < 0
          // Inverse = lower is better (CAC/CPO/CPC/CPM)
          const isGood = inverse ? isDown : !isDown
          const color = isGood ? 'var(--green)' : 'var(--red)'
          const sign = diff > 0 ? '+' : '−'
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

        const MV = ({value, prev, kind='euro0', suffix='', inverse=false}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={mVal}>{shown}</div>{mDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind, inverse)}</div>)
        }

        // ── Timeframe Mensile: SEMPRE mese selezionato vs mese precedente ──
        const fmtM2 = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        const monthMinus = (m, n) => {
          const [y, mm] = m.split('-').map(Number)
          const d = new Date(y, mm - 1, 1)
          d.setMonth(d.getMonth() - n)
          return fmtM2(d)
        }

        // Mese base: dal preset month_X se valido, altrimenti mese corrente
        const baseMonth = (typeof preset === 'string' && preset.startsWith('month_'))
          ? preset.slice(6)
          : fmtM2(new Date())

        const m0 = baseMonth                  // mese selezionato (corrente)
        const m1 = monthMinus(baseMonth, 1)   // mese precedente
        const currentCalendarMonth = fmtM2(new Date())

        // Se il mese selezionato è quello in corso, sovrapponi i dati live
        // (live.shopifyRange contiene il parziale fino ad oggi)
        const overlayLive = (m) => {
          if (m.month !== m0 || m0 !== currentCalendarMonth) return m
          const sr = live?.shopifyRange
          if (!sr) return m
          // Assicuro un row anche se data non aveva il mese
          return {
            ...m,
            fatturato: Number(sr.revenue) || m.fatturato || 0,
            fatturNC:  Number(sr.fatturNC) || m.fatturNC || 0,
            fatturRC:  Number(sr.fatturRC) || m.fatturRC || 0,
            resi:      Number(sr.resi) || m.resi || 0,
            resiNC:    Number(sr.resiNC) || m.resiNC || 0,
            resiRC:    Number(sr.resiRC) || m.resiRC || 0,
            ordini:    Number(sr.orders) || m.ordini || 0,
            nc:        Number(sr.nc) || m.nc || 0,
            rc:        Number(sr.rc) || m.rc || 0,
            sessioni:  Number(sr.sessions) || m.sessioni || 0,
            metaSpend: Number(live?.metaRange?.spend) || m.metaSpend || 0,
          }
        }

        // Se il mese non esiste in data (filtrato out perché vuoto), lo ricreo
        const ensureMonthRow = (label) => {
          const existing = data.find(m => m.month === label)
          if (existing) return existing
          return { month: label, fatturato:0, fatturNC:0, fatturRC:0, resi:0, resiNC:0, resiRC:0, ordini:0, nc:0, rc:0, sessioni:0, metaSpend:0, googleSpend:0, totalSpend:0 }
        }

        // KPI cards summary: solo mese selezionato (delta vs precedente)
        const tfMonths = [overlayLive(ensureMonthRow(m0))]
        const tfPrevMonths = [ensureMonthRow(m1)]

        // Righe tabella: entrambi i mesi (più recente in alto)
        const tableMonths = [overlayLive(ensureMonthRow(m0)), ensureMonthRow(m1)]

        const tfLabel = `${m0} vs ${m1}`

        const sumField = (arr, key) => arr.reduce((s,m) => s + Number(m[key] || 0), 0)
        const divSafe = (a, b) => b > 0 ? a / b : null

        const tf = {
          fat: sumField(tfMonths, 'fatturato'),
          ord: sumField(tfMonths, 'ordini'),
          nc: sumField(tfMonths, 'nc'),
          rc: sumField(tfMonths, 'rc'),
          meta: sumField(tfMonths, 'metaSpend'),
          goog: sumField(tfMonths, 'googleSpend'),
          spend: sumField(tfMonths, 'totalSpend'),
          ses: sumField(tfMonths, 'sessioni'),
        }
        tf.aov = divSafe(tf.fat, tf.ord)
        tf.mer = divSafe(tf.fat, tf.spend)
        tf.cac = divSafe(tf.spend, tf.nc)
        tf.ratio = tf.aov && tf.cac ? (tf.aov * cfg.freq * cfg.life * cfg.margin / 100) / tf.cac : null

        const tfP = {
          fat: sumField(tfPrevMonths, 'fatturato'),
          ord: sumField(tfPrevMonths, 'ordini'),
          nc: sumField(tfPrevMonths, 'nc'),
          rc: sumField(tfPrevMonths, 'rc'),
          meta: sumField(tfPrevMonths, 'metaSpend'),
          goog: sumField(tfPrevMonths, 'googleSpend'),
          spend: sumField(tfPrevMonths, 'totalSpend'),
          ses: sumField(tfPrevMonths, 'sessioni'),
        }
        tfP.aov = divSafe(tfP.fat, tfP.ord)
        tfP.mer = divSafe(tfP.fat, tfP.spend)
        tfP.cac = divSafe(tfP.spend, tfP.nc)
        tfP.ratio = tfP.aov && tfP.cac ? (tfP.aov * cfg.freq * cfg.life * cfg.margin / 100) / tfP.cac : null

        // ── Sparkline SVG builder ──
        const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 32 }) => {
          const vals = dataArr.map(d => Number(d[dataKey] || 0))
          if (vals.length < 2 || vals.every(v => v === 0)) return null
          const max = Math.max(...vals), min = Math.min(...vals)
          const range = max - min || 1
          const points = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 4) - 2
            return `${x},${y}`
          }).join(' ')
          return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }

        // ── Delta badge (%) ──
        const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
          if (prev == null || prev === 0 || curr == null) return null
          const pct = ((curr - prev) / prev) * 100
          if (Math.abs(pct) < 0.1) return null
          const up = pct > 0
          const good = isLowerBetter ? !up : up
          return (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
              background: good ? '#22c55e20' : '#ef444420',
              color: good ? '#22c55e' : '#ef4444',
            }}>
              {up ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )
        }

        const chartData = filled.map(m => ({
          label: m.month, fatturato: m.fatturato, spesa: m.totalSpend,
          nc: m.nc, rc: m.rc, mer: m.mer, aov: m.aov, cro: m.cro, ratio: m.ratio,
        }))

        const kpiCards = [
          { label: 'Fatturato', val: tf.fat, prev: tfP.fat, fmt: f0, color: 'var(--green)', key: 'fatturato', sources: ['shopify'] },
          { label: 'Ordini', val: tf.ord, prev: tfP.ord, fmt: fn, color: 'var(--accent)', key: 'ordini', sources: ['shopify'] },
          { label: 'AOV', val: tf.aov, prev: tfP.aov, fmt: f2, color: 'var(--orange)', key: 'aov', sources: ['shopify'] },
          { label: 'Nuovi Clienti', val: tf.nc, prev: tfP.nc, fmt: fn, color: 'var(--cyan)', key: 'nc', sources: ['shopify'] },
          { label: 'Clienti Ritorno', val: tf.rc, prev: tfP.rc, fmt: fn, color: 'var(--purple)', key: 'rc', sources: ['shopify'] },
          { label: 'MER', val: tf.mer, prev: tfP.mer, fmt: v => v != null ? `${fr(v)}×` : '—', color: tf.mer != null ? (tf.mer >= 3 ? 'var(--green)' : tf.mer >= 2 ? 'var(--orange)' : 'var(--red)') : 'var(--text3)', key: 'mer', sources: ['shopify','meta'] },
          { label: 'CAC', val: tf.cac, prev: tfP.cac, fmt: f2, color: 'var(--text)', key: 'cac', lower: true, sources: ['shopify','meta','google'] },
          { label: 'Ratio LTV:CAC', val: tf.ratio, prev: tfP.ratio, fmt: v => v != null ? `${fr(v)}:1` : '—', color: ratioColor(tf.ratio), key: 'ratio', sources: ['shopify','meta'] },
          { label: 'Meta Spend', val: tf.meta, prev: tfP.meta, fmt: f0, color: 'var(--accent)', key: 'metaSpend', sources: ['meta'] },
          { label: 'Google Spend', val: tf.goog, prev: tfP.goog, fmt: v => v > 0 ? f0(v) : '—', color: 'var(--yellow)', key: 'googleSpend', sources: ['google'] },
        ]

        return (
        <>
          {/* Timeframe selector */}
          <div style={{...S.card, marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <TimeframeSelector
              value={preset?.startsWith('month_') ? preset : `month_${baseMonth}`}
              onChange={setPreset}
              disabled={loading}
              hideDateRange
              monthsCount={18}
            />
            <button onClick={fetchLive} disabled={loading} className="btn-glass" style={{
              marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
              cursor:loading?'wait':'pointer', opacity:loading?0.5:1,
            }}>
              <span style={{animation:loading?'spin 1s linear infinite':'none'}}>↻</span>
              {loading?'Aggiorno…':'Aggiorna'}
            </button>
            <span style={{fontSize:11,color:'var(--text3)'}}>{tfLabel}</span>
          </div>

          {/* Summary KPI Cards with sparkline + delta */}
          <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
                  <div className="label">{kpi.label}</div>
                  <PlatformBadges sources={kpi.sources} size={16} />
                </div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                  <div className="metric-value">{kpi.fmt(kpi.val)}</div>
                  <Sparkline dataArr={filled} dataKey={kpi.key} color={kpi.color} />
                </div>
                <div style={{marginTop:10}}>
                  <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                </div>
              </div>
            ))}
          </div>

          {/* Data Entry Table */}
          <FxChartCard title="Dati mensili" glowColor="#22c55e" subtitle="Shopify + Meta automatici · Google manuale">
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
                  {tableMonths.map((m,i) => {
                    const p = tableMonths[i+1]
                    return (
                      <tr key={m.month} style={{background: i%2===0?'transparent':'var(--surface)'}}>
                        <td style={{...mTD,color:'var(--text)',fontWeight:900,whiteSpace:'nowrap',fontSize:15}}>{monthName(m.month)}</td>
                        <td style={mTD}><MV value={m.fatturato} prev={p?.fatturato} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.fatturNC} prev={p?.fatturNC} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.fatturRC} prev={p?.fatturRC} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.resi||null} prev={p?.resi||null} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.metaSpend||null} prev={p?.metaSpend||null} kind="euro0" /></td>
                        <td style={mTD}>
                          <NumInput value={m.googleSpend} onChange={vn=>updateMonth(m.month,'googleSpend',vn)} placeholder="0" color="#eab308" />
                        </td>
                        <td style={mTD}><MV value={m.ordini} prev={p?.ordini} kind="int" /></td>
                        <td style={mTD}><MV value={m.nc} prev={p?.nc} kind="int" /></td>
                        <td style={mTD}><MV value={m.rc} prev={p?.rc} kind="int" /></td>
                        <td style={mTD}><MV value={m.sessioni||null} prev={p?.sessioni||null} kind="int" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </FxChartCard>

          {/* KPI Calcolati Table */}
          {tfMonths.filter(m => m.fatturato > 0 || m.totalSpend > 0).length > 0 && (
          <FxChartCard title="KPI calcolati" glowColor="#a78bfa">
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
                  {tableMonths.map((m,i) => {
                    const p = tableMonths[i+1]
                    return (
                      <tr key={m.month} style={{background: i%2===0?'transparent':'var(--surface)'}}>
                        <td style={{...mTD,color:'var(--text)',fontSize:15,fontWeight:900,whiteSpace:'nowrap'}}>{monthName(m.month)}</td>
                        <td style={mTD}><MV value={m.fatturato} prev={p?.fatturato} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.fatturNC} prev={p?.fatturNC} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.fatturRC} prev={p?.fatturRC} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.totalSpend} prev={p?.totalSpend} kind="euro0" /></td>
                        <td style={mTD}><MV value={m.mer} prev={p?.mer} kind="ratio" suffix="×" /></td>
                        <td style={mTD}><MV value={m.aMer} prev={p?.aMer} kind="ratio" suffix="×" /></td>
                        <td style={mTD}><MV value={m.cac} prev={p?.cac} kind="euro2" inverse /></td>
                        <td style={mTD}><MV value={m.cpo} prev={p?.cpo} kind="euro2" inverse /></td>
                        <td style={mTD}><MV value={m.aov} prev={p?.aov} kind="euro2" /></td>
                        <td style={mTD}><MV value={m.aovNC} prev={p?.aovNC} kind="euro2" /></td>
                        <td style={mTD}><MV value={m.aovRC} prev={p?.aovRC} kind="euro2" /></td>
                        <td style={mTD}><MV value={m.retention} prev={p?.retention} kind="percent1" /></td>
                        <td style={mTD}><MV value={m.cro} prev={p?.cro} kind="percent2" /></td>
                        <td style={mTD}><MV value={m.ltv} prev={p?.ltv} kind="euro2" /></td>
                        <td style={mTD}><MV value={m.ratio} prev={p?.ratio} kind="ratio" suffix=":1" /></td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </FxChartCard>
          )}

          {/* Charts — futuristic */}
          {filled.length > 0 && (
          <>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <FxChartCard title="Fatturato, Spesa e MER" glowColor="#22c55e">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                    <defs>
                      <linearGradient id="fx-rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="fx-spend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <filter id="fx-glow-g" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                    <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                    <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#fx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#fx-glow-g)'}} />
                    <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#fx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationEasing="ease-out" animationBegin={200} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </FxChartCard>

              <FxChartCard title="Nuovi clienti e clienti di ritorno" glowColor="#06b6d4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                    <defs>
                      <linearGradient id="fx-nc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="fx-rc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                    <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                    <Bar dataKey="nc" name="Nuovi clienti" fill="url(#fx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                    <Bar dataKey="rc" name="Clienti ritorno" fill="url(#fx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </FxChartCard>
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                    <defs>
                      <linearGradient id="fx-aov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="fx-cro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                    <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                    <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                    <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#fx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                    <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#fx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </FxChartCard>

              <FxChartCard title="Ratio LTV:CAC" glowColor="#a78bfa">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                    <defs>
                      <linearGradient id="fx-ratio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                        <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                    <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:700, position:'right'}} />
                    <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                    <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                    <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#fx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </FxChartCard>
            </div>
          </>
          )}

          {/* AI Insights & To-do */}
          <DashboardInsights preset={preset} />

          {/* Floating Mensile Agent (vertical chat) */}
          <MensileAgent data={data} selectedMonth={m0} previousMonth={m1} preset={preset} />
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
          preset={preset}
          weeklyTF={weeklyTF}
          setWeeklyTF={setWeeklyTF}
          weeklyCustom={weeklyCustom}
          setWeeklyCustom={setWeeklyCustom}
          onRefresh={fetchLive}
          loading={loading}
        />
      )}

      {/* QUARTER TAB */}
      {tab==='quarter' && (() => {
        const QUARTER_NAMES = ['Q1','Q2','Q3','Q4']
        const monthsInQuarter = (year, q) => {
          const start = (q-1)*3 + 1
          return [start, start+1, start+2].map(m => `${year}-${String(m).padStart(2,'0')}`)
        }
        const quarterLabel = (key) => {
          const [y, q] = key.split('-Q')
          return `${QUARTER_NAMES[Number(q)-1]} ${y}`
        }
        const quarterMinus = (key, n) => {
          const [y, qn] = key.split('-Q').map(Number)
          let nq = qn - n
          let ny = y
          while (nq < 1) { nq += 4; ny -= 1 }
          return `${ny}-Q${nq}`
        }

        // Current quarter from preset or today
        const now = new Date()
        const currentQ = `${now.getFullYear()}-Q${Math.floor(now.getMonth()/3) + 1}`
        const baseQ = (typeof preset === 'string' && preset.startsWith('quarter_'))
          ? preset.slice(8)
          : currentQ

        const q0 = baseQ
        const q1 = quarterMinus(baseQ, 1)

        // Live single-range payloads from /api/metrics?preset=quarter_YYYY-Qn
        // → shopifyRange = q0, shopifyPrevRange = q1.
        // Single-range queries usano la classificazione Shopify NC/RC del periodo
        // (deduplicata a livello cliente), che è quella che Marino vede in Shopify.
        // La somma mensile invece riclassifica ogni mese e gonfia NC.
        const isQuarterPreset = typeof preset === 'string' && preset.startsWith('quarter_')
        const presetQ = isQuarterPreset ? preset.slice(8) : null
        const sr = live?.shopifyRange
        const spr = live?.shopifyPrevRange
        const mr = live?.metaRange
        const mpr = live?.metaPrevRange

        // Aggregate months data into a quarter row, with live overlay for q0/q1.
        const aggregateQuarter = (key) => {
          const [y, q] = key.split('-Q').map(Number)
          const monthKeys = monthsInQuarter(y, q)
          const rows = data.filter(m => monthKeys.includes(m.month))

          const sum = (k) => rows.reduce((s,m)=>s + Number(m[k]||0), 0)

          // Live overlay: solo se preset effettivamente quarter_ e combacia
          const useLiveCurrent = isQuarterPreset && key === presetQ && sr
          const useLivePrev = isQuarterPreset && key === quarterMinus(presetQ, 1) && spr
          const useLiveMetaCurrent = isQuarterPreset && key === presetQ && mr
          const useLiveMetaPrev = isQuarterPreset && key === quarterMinus(presetQ, 1) && mpr

          const fatturato = useLiveCurrent ? Number(sr.revenue) || 0
                          : useLivePrev    ? Number(spr.revenue) || 0
                          : sum('fatturato')
          const fatturNC  = useLiveCurrent ? Number(sr.fatturNC) || 0
                          : useLivePrev    ? Number(spr.fatturNC) || 0
                          : sum('fatturNC')
          const fatturRC  = useLiveCurrent ? Number(sr.fatturRC) || 0
                          : useLivePrev    ? Number(spr.fatturRC) || 0
                          : sum('fatturRC')
          const resi      = useLiveCurrent ? Number(sr.resi) || 0
                          : useLivePrev    ? Number(spr.resi) || 0
                          : sum('resi')
          const resiNC    = useLiveCurrent ? Number(sr.resiNC) || 0
                          : useLivePrev    ? Number(spr.resiNC) || 0
                          : sum('resiNC')
          const resiRC    = useLiveCurrent ? Number(sr.resiRC) || 0
                          : useLivePrev    ? Number(spr.resiRC) || 0
                          : sum('resiRC')
          const ordini    = useLiveCurrent ? Number(sr.orders) || 0
                          : useLivePrev    ? Number(spr.orders) || 0
                          : sum('ordini')
          const nc        = useLiveCurrent ? Number(sr.nc) || 0
                          : useLivePrev    ? Number(spr.nc) || 0
                          : sum('nc')
          const rc        = useLiveCurrent ? Number(sr.rc) || 0
                          : useLivePrev    ? Number(spr.rc) || 0
                          : sum('rc')
          const sessioni  = useLiveCurrent ? Number(sr.sessions) || 0
                          : useLivePrev    ? Number(spr.sessions) || 0
                          : sum('sessioni')
          const metaSpend = useLiveMetaCurrent ? Number(mr.spend) || 0
                          : useLiveMetaPrev    ? Number(mpr.spend) || 0
                          : sum('metaSpend')
          const googleSpend = sum('googleSpend')
          const totalSpend = metaSpend + googleSpend

          const aov = ordini > 0 ? fatturato/ordini : null
          const aovNC = nc > 0 ? fatturNC/nc : null
          const aovRC = rc > 0 ? fatturRC/rc : null
          const mer = totalSpend > 0 ? fatturato/totalSpend : null
          const aMer = totalSpend > 0 ? fatturNC/totalSpend : null
          const cac = nc > 0 ? totalSpend/nc : null
          const cpo = ordini > 0 ? totalSpend/ordini : null
          const retention = nc+rc > 0 ? rc/(nc+rc)*100 : null
          const cro = sessioni > 0 && ordini > 0 ? ordini/sessioni*100 : null
          const ltv = aov != null ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
          const ratio = ltv && cac ? ltv/cac : null
          return { key, label: quarterLabel(key), fatturato, fatturNC, fatturRC, resi, resiNC, resiRC, ordini, nc, rc, sessioni, metaSpend, googleSpend, totalSpend, aov, aovNC, aovRC, mer, aMer, cac, cpo, retention, cro, ltv, ratio }
        }

        const tableQuarters = [aggregateQuarter(q0), aggregateQuarter(q1)]
        const cur = tableQuarters[0]
        const prev = tableQuarters[1]

        // Aggregati ultimi 6 quarter (più vecchio a sinistra), solo quelli con dati
        const chartQuarterKeys = []
        for (let i = 5; i >= 0; i--) chartQuarterKeys.push(quarterMinus(q0, i))
        const aggregatedQuarters = chartQuarterKeys
          .map(k => aggregateQuarter(k))
          .filter(q => q.fatturato > 0 || q.ordini > 0 || q.totalSpend > 0)
        const quarterChartData = aggregatedQuarters.map(q => ({
          label: q.label, fatturato: q.fatturato, spesa: q.totalSpend,
          nc: q.nc, rc: q.rc, mer: q.mer, aov: q.aov, cro: q.cro, ratio: q.ratio,
        }))

        const qVal = { fontFamily:'Barlow', fontWeight:900, fontSize:16, lineHeight:1.15, color:'var(--text)' }
        const qTH = {
          position:'sticky', top:0, zIndex:20,
          padding:'18px 20px', fontSize:11, fontWeight:800,
          textTransform:'uppercase', letterSpacing:'0.10em',
          textAlign:'left', whiteSpace:'nowrap', color:'var(--text2)',
          background:'rgba(255,255,255,0.025)', backdropFilter:'blur(20px)',
          borderBottom:'1.5px solid rgba(255,255,255,0.08)',
        }
        const qTD = {
          padding:'14px 20px', fontSize:15, fontWeight:500,
          verticalAlign:'top', borderBottom:'1px solid rgba(255,255,255,0.04)', color:'var(--text)',
        }

        const qDelta = (curr, prev, kind='euro0', inverse=false) => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff/p*100 : null
          const isDown = diff < 0
          const isGood = inverse ? isDown : !isDown
          const color = isGood ? 'var(--green)' : 'var(--red)'
          const sign = diff > 0 ? '+' : '−'
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
        const QV = ({value, prev, kind='euro0', suffix='', inverse=false}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={qVal}>{shown}</div>{qDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind, inverse)}</div>)
        }

        // Sparkline + delta badge per le KPI cards
        const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 32 }) => {
          const vals = dataArr.map(d => Number(d[dataKey] || 0))
          if (vals.length < 2 || vals.every(v => v === 0)) return null
          const max = Math.max(...vals), min = Math.min(...vals)
          const range = max - min || 1
          const points = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 4) - 2
            return `${x},${y}`
          }).join(' ')
          return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
        const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
          if (prev == null || prev === 0 || curr == null) return null
          const pct = ((curr - prev) / prev) * 100
          if (Math.abs(pct) < 0.1) return null
          const up = pct > 0
          const good = isLowerBetter ? !up : up
          return (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
              background: good ? '#22c55e20' : '#ef444420',
              color: good ? '#22c55e' : '#ef4444',
            }}>
              {up ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )
        }

        const kpiCards = [
          { label:'Fatturato', val:cur.fatturato, prev:prev.fatturato, fmt:f0, color:'var(--green)', key:'fatturato', sources:['shopify'] },
          { label:'Ordini', val:cur.ordini, prev:prev.ordini, fmt:fn, color:'var(--accent)', key:'ordini', sources:['shopify'] },
          { label:'AOV', val:cur.aov, prev:prev.aov, fmt:f2, color:'var(--orange)', key:'aov', sources:['shopify'] },
          { label:'Nuovi Clienti', val:cur.nc, prev:prev.nc, fmt:fn, color:'var(--cyan)', key:'nc', sources:['shopify'] },
          { label:'Clienti Ritorno', val:cur.rc, prev:prev.rc, fmt:fn, color:'var(--purple)', key:'rc', sources:['shopify'] },
          { label:'MER', val:cur.mer, prev:prev.mer, fmt:v=>v!=null?`${fr(v)}×`:'—', color:cur.mer!=null?(cur.mer>=3?'var(--green)':cur.mer>=2?'var(--orange)':'var(--red)'):'var(--text3)', key:'mer', sources:['shopify','meta'] },
          { label:'CAC', val:cur.cac, prev:prev.cac, fmt:f2, color:'var(--text)', key:'cac', lower:true, sources:['shopify','meta','google'] },
          { label:'Ratio LTV:CAC', val:cur.ratio, prev:prev.ratio, fmt:v=>v!=null?`${fr(v)}:1`:'—', color:ratioColor(cur.ratio), key:'ratio', sources:['shopify','meta'] },
          { label:'Meta Spend', val:cur.metaSpend, prev:prev.metaSpend, fmt:f0, color:'var(--accent)', key:'metaSpend', sources:['meta'] },
          { label:'Google Spend', val:cur.googleSpend, prev:prev.googleSpend, fmt:v=>v>0?f0(v):'—', color:'var(--yellow)', key:'googleSpend', sources:['google'] },
        ]

        return (
          <>
            {/* Timeframe selector */}
            <div style={{...S.card, marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <TimeframeSelector
                value={preset?.startsWith('quarter_') ? preset : `quarter_${q0}`}
                onChange={setPreset}
                disabled={loading}
                mode="quarter"
              />
              <button onClick={fetchLive} disabled={loading} className="btn-glass" style={{
                marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
                cursor:loading?'wait':'pointer', opacity:loading?0.5:1,
              }}>
                <span style={{animation:loading?'spin 1s linear infinite':'none'}}>↻</span>
                {loading?'Aggiorno…':'Aggiorna'}
              </button>
              <span style={{fontSize:11,color:'var(--text3)'}}>{quarterLabel(q0)} vs {quarterLabel(q1)}</span>
            </div>

            {/* KPI summary cards */}
            <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
              {kpiCards.map(kpi => (
                <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
                    <div className="label">{kpi.label}</div>
                    <PlatformBadges sources={kpi.sources} size={16} />
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div className="metric-value">{kpi.fmt(kpi.val)}</div>
                    <Sparkline dataArr={aggregatedQuarters} dataKey={kpi.key} color={kpi.color} />
                  </div>
                  <div style={{marginTop:10}}>
                    <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                  </div>
                </div>
              ))}
            </div>

            {/* Dati trimestrali table */}
            <FxChartCard title="Dati trimestrali" glowColor="#22c55e" subtitle="Aggregato da dati mensili">
              <div style={{overflow:'auto',maxHeight:'72vh'}}>
                <table style={{width:'100%',minWidth:1450,borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Trimestre','Fatturato €','Fatt. NC €','Fatt. RC €','Resi €','Meta ADS €','Google ADS €','Tot Ordini','NC #','RC #','Sessioni'].map(h=>(
                        <th key={h} style={qTH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableQuarters.map((q,i) => {
                      const p = tableQuarters[i+1]
                      return (
                        <tr key={q.key} style={{background: i%2===0?'transparent':'var(--surface)'}}>
                          <td style={{...qTD,color:'var(--text)',fontWeight:900,whiteSpace:'nowrap',fontSize:15}}>{q.label}</td>
                          <td style={qTD}><QV value={q.fatturato} prev={p?.fatturato} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.fatturNC} prev={p?.fatturNC} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.fatturRC} prev={p?.fatturRC} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.resi||null} prev={p?.resi||null} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.metaSpend||null} prev={p?.metaSpend||null} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.googleSpend||null} prev={p?.googleSpend||null} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.ordini} prev={p?.ordini} kind="int" /></td>
                          <td style={qTD}><QV value={q.nc} prev={p?.nc} kind="int" /></td>
                          <td style={qTD}><QV value={q.rc} prev={p?.rc} kind="int" /></td>
                          <td style={qTD}><QV value={q.sessioni||null} prev={p?.sessioni||null} kind="int" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </FxChartCard>

            {/* KPI calcolati table */}
            <FxChartCard title="KPI calcolati" glowColor="#a78bfa">
              <div style={{overflow:'auto',maxHeight:'72vh'}}>
                <table style={{width:'100%',minWidth:1600,borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Trimestre','Fatturato','Fatt. NC','Fatt. RC','ADV','MER','aMER','CAC','CPO','AOV','AOV NC','AOV RC','Ret%','CRO%','LTV','Ratio'].map(h=>(
                        <th key={h} style={qTH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableQuarters.map((q,i) => {
                      const p = tableQuarters[i+1]
                      return (
                        <tr key={q.key} style={{background: i%2===0?'transparent':'var(--surface)'}}>
                          <td style={{...qTD,color:'var(--text)',fontSize:15,fontWeight:900,whiteSpace:'nowrap'}}>{q.label}</td>
                          <td style={qTD}><QV value={q.fatturato} prev={p?.fatturato} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.fatturNC} prev={p?.fatturNC} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.fatturRC} prev={p?.fatturRC} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.totalSpend} prev={p?.totalSpend} kind="euro0" /></td>
                          <td style={qTD}><QV value={q.mer} prev={p?.mer} kind="ratio" suffix="×" /></td>
                          <td style={qTD}><QV value={q.aMer} prev={p?.aMer} kind="ratio" suffix="×" /></td>
                          <td style={qTD}><QV value={q.cac} prev={p?.cac} kind="euro2" inverse /></td>
                          <td style={qTD}><QV value={q.cpo} prev={p?.cpo} kind="euro2" inverse /></td>
                          <td style={qTD}><QV value={q.aov} prev={p?.aov} kind="euro2" /></td>
                          <td style={qTD}><QV value={q.aovNC} prev={p?.aovNC} kind="euro2" /></td>
                          <td style={qTD}><QV value={q.aovRC} prev={p?.aovRC} kind="euro2" /></td>
                          <td style={qTD}><QV value={q.retention} prev={p?.retention} kind="percent1" /></td>
                          <td style={qTD}><QV value={q.cro} prev={p?.cro} kind="percent2" /></td>
                          <td style={qTD}><QV value={q.ltv} prev={p?.ltv} kind="euro2" /></td>
                          <td style={qTD}><QV value={q.ratio} prev={p?.ratio} kind="ratio" suffix=":1" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </FxChartCard>

            {quarterChartData.length > 0 && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title="Fatturato, Spesa e MER" glowColor="#22c55e">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="qfx-rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="qfx-spend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="qfx-glow-g" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#qfx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#qfx-glow-g)'}} />
                        <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#qfx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationEasing="ease-out" animationBegin={200} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title="Nuovi clienti e clienti di ritorno" glowColor="#06b6d4">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                        <defs>
                          <linearGradient id="qfx-nc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                          </linearGradient>
                          <linearGradient id="qfx-rc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Bar dataKey="nc" name="Nuovi clienti" fill="url(#qfx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                        <Bar dataKey="rc" name="Clienti ritorno" fill="url(#qfx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="qfx-aov" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="qfx-cro" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#qfx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                        <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#qfx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title="Ratio LTV:CAC" glowColor="#a78bfa">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="qfx-ratio" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:700, position:'right'}} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#qfx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>
              </>
            )}

            {/* AI Insights & To-do */}
            <DashboardInsights preset={preset} />

            {/* Floating Quarter Agent (vertical chat) */}
            <QuarterAgent quarters={aggregatedQuarters} selectedQuarter={q0} previousQuarter={q1} preset={preset} />
          </>
        )
      })()}

      {/* YEAR TAB */}
      {tab==='year' && (() => {
        const monthsInYear = (year) =>
          Array.from({length:12}, (_,i) => `${year}-${String(i+1).padStart(2,'0')}`)
        const yearLabel = (key) => `${key}`
        const yearMinus = (key, n) => `${Number(key) - n}`

        const now = new Date()
        const currentY = `${now.getFullYear()}`
        const baseY = (typeof preset === 'string' && preset.startsWith('year_'))
          ? preset.slice(5)
          : currentY

        const y0 = baseY
        const y1 = yearMinus(baseY, 1)

        const isYearPreset = typeof preset === 'string' && preset.startsWith('year_')
        const presetY = isYearPreset ? preset.slice(5) : null
        const sr = live?.shopifyRange
        const spr = live?.shopifyPrevRange
        const mr = live?.metaRange
        const mpr = live?.metaPrevRange

        const aggregateYear = (key) => {
          const monthKeys = monthsInYear(key)
          const rows = data.filter(m => monthKeys.includes(m.month))

          const sum = (k) => rows.reduce((s,m)=>s + Number(m[k]||0), 0)

          // Live overlay: solo se il preset è effettivamente year_ e combacia
          // (altrimenti shopifyRange porta dati di un altro periodo)
          const useLiveCurrent = isYearPreset && key === presetY && sr
          const useLivePrev = isYearPreset && key === yearMinus(presetY, 1) && spr
          const useLiveMetaCurrent = isYearPreset && key === presetY && mr
          const useLiveMetaPrev = isYearPreset && key === yearMinus(presetY, 1) && mpr

          // YEAR-ONLY: pre-calcolo somma mensile per TUTTI i campi che usano
          // live overlay. Usati come floor sotto al live (ShopifyQL su range
          // year_ a volte ritorna 0 per rate-limit / breakdown fail random
          // su 6+ mesi). Cosi' card e tabelle leggono sempre dallo stesso
          // valore robusto: MAX(live, monthly).
          const fatturatoMonthly = sum('fatturato')
          const fatturNcMonthly  = sum('fatturNC')
          const fatturRcMonthly  = sum('fatturRC')
          const resiMonthly      = sum('resi')
          const resiNcMonthly    = sum('resiNC')
          const resiRcMonthly    = sum('resiRC')
          const ordiniMonthly    = sum('ordini')
          const ncMonthly        = sum('nc')
          const rcMonthly        = sum('rc')
          const sessioniMonthly  = sum('sessioni')

          // YEAR-ONLY: tutti i campi shopify usano MAX(live overlay, monthly).
          // Se ShopifyQL nel live ritorna 0 (rate-limit su range year_),
          // cade su monthly (per-mese piu' affidabile). Per anni storici
          // senza live overlay, monthly sempre.
          const fatturato = useLiveCurrent ? Math.max(Number(sr.revenue) || 0, fatturatoMonthly)
                          : useLivePrev    ? Math.max(Number(spr.revenue) || 0, fatturatoMonthly)
                          : fatturatoMonthly
          const fatturNC  = useLiveCurrent ? Math.max(Number(sr.fatturNC) || 0, fatturNcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.fatturNC) || 0, fatturNcMonthly)
                          : fatturNcMonthly
          const fatturRC  = useLiveCurrent ? Math.max(Number(sr.fatturRC) || 0, fatturRcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.fatturRC) || 0, fatturRcMonthly)
                          : fatturRcMonthly
          const resi      = useLiveCurrent ? Math.max(Number(sr.resi) || 0, resiMonthly)
                          : useLivePrev    ? Math.max(Number(spr.resi) || 0, resiMonthly)
                          : resiMonthly
          const resiNC    = useLiveCurrent ? Math.max(Number(sr.resiNC) || 0, resiNcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.resiNC) || 0, resiNcMonthly)
                          : resiNcMonthly
          const resiRC    = useLiveCurrent ? Math.max(Number(sr.resiRC) || 0, resiRcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.resiRC) || 0, resiRcMonthly)
                          : resiRcMonthly
          const ordini    = useLiveCurrent ? Math.max(Number(sr.orders) || 0, ordiniMonthly)
                          : useLivePrev    ? Math.max(Number(spr.orders) || 0, ordiniMonthly)
                          : ordiniMonthly
          const nc        = useLiveCurrent ? Math.max(Number(sr.nc) || 0, ncMonthly)
                          : useLivePrev    ? Math.max(Number(spr.nc) || 0, ncMonthly)
                          : ncMonthly
          const rc        = useLiveCurrent ? Math.max(Number(sr.rc) || 0, rcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.rc) || 0, rcMonthly)
                          : rcMonthly
          const sessioni  = useLiveCurrent ? Math.max(Number(sr.sessions) || 0, sessioniMonthly)
                          : useLivePrev    ? Math.max(Number(spr.sessions) || 0, sessioniMonthly)
                          : sessioniMonthly
          const metaSpend = useLiveMetaCurrent ? Number(mr.spend) || 0
                          : useLiveMetaPrev    ? Number(mpr.spend) || 0
                          : sum('metaSpend')
          const googleSpend = sum('googleSpend')
          const totalSpend = metaSpend + googleSpend

          const aov = ordini > 0 ? fatturato/ordini : null
          const aovNC = nc > 0 ? fatturNC/nc : null
          const aovRC = rc > 0 ? fatturRC/rc : null
          const mer = totalSpend > 0 ? fatturato/totalSpend : null
          const aMer = totalSpend > 0 ? fatturNC/totalSpend : null
          const cac = nc > 0 ? totalSpend/nc : null
          const cpo = ordini > 0 ? totalSpend/ordini : null
          const retention = nc+rc > 0 ? rc/(nc+rc)*100 : null
          const cro = sessioni > 0 && ordini > 0 ? ordini/sessioni*100 : null
          const ltv = aov != null ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
          const ratio = ltv && cac ? ltv/cac : null
          return { key, label: yearLabel(key), fatturato, fatturNC, fatturRC, resi, resiNC, resiRC, ordini, nc, rc, sessioni, metaSpend, googleSpend, totalSpend, aov, aovNC, aovRC, mer, aMer, cac, cpo, retention, cro, ltv, ratio }
        }

        const tableYears = [aggregateYear(y0), aggregateYear(y1)]
        const cur = tableYears[0]
        const prev = tableYears[1]

        // Ultimi 5 anni per i grafici (solo quelli con dati)
        const chartYearKeys = []
        for (let i = 4; i >= 0; i--) chartYearKeys.push(yearMinus(y0, i))
        const aggregatedYears = chartYearKeys
          .map(k => aggregateYear(k))
          .filter(y => y.fatturato > 0 || y.ordini > 0 || y.totalSpend > 0)
        const yearChartData = aggregatedYears.map(y => ({
          label: y.label, fatturato: y.fatturato, spesa: y.totalSpend,
          nc: y.nc, rc: y.rc, mer: y.mer, aov: y.aov, cro: y.cro, ratio: y.ratio,
        }))

        const qVal = { fontFamily:'Barlow', fontWeight:900, fontSize:16, lineHeight:1.15, color:'var(--text)' }
        const qTH = {
          position:'sticky', top:0, zIndex:20,
          padding:'18px 20px', fontSize:11, fontWeight:800,
          textTransform:'uppercase', letterSpacing:'0.10em',
          textAlign:'left', whiteSpace:'nowrap', color:'var(--text2)',
          background:'rgba(255,255,255,0.025)', backdropFilter:'blur(20px)',
          borderBottom:'1.5px solid rgba(255,255,255,0.08)',
        }
        const qTD = {
          padding:'14px 20px', fontSize:15, fontWeight:500,
          verticalAlign:'top', borderBottom:'1px solid rgba(255,255,255,0.04)', color:'var(--text)',
        }

        const qDelta = (curr, prev, kind='euro0', inverse=false) => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff/p*100 : null
          const isDown = diff < 0
          const isGood = inverse ? isDown : !isDown
          const color = isGood ? 'var(--green)' : 'var(--red)'
          const sign = diff > 0 ? '+' : '−'
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
        const YV = ({value, prev, kind='euro0', suffix='', inverse=false}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={qVal}>{shown}</div>{qDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind, inverse)}</div>)
        }

        const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 32 }) => {
          const vals = dataArr.map(d => Number(d[dataKey] || 0))
          if (vals.length < 2 || vals.every(v => v === 0)) return null
          const max = Math.max(...vals), min = Math.min(...vals)
          const range = max - min || 1
          const points = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 4) - 2
            return `${x},${y}`
          }).join(' ')
          return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
        const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
          if (prev == null || prev === 0 || curr == null) return null
          const pct = ((curr - prev) / prev) * 100
          if (Math.abs(pct) < 0.1) return null
          const up = pct > 0
          const good = isLowerBetter ? !up : up
          return (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
              background: good ? '#22c55e20' : '#ef444420',
              color: good ? '#22c55e' : '#ef4444',
            }}>
              {up ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )
        }

        const kpiCards = [
          { label:'Fatturato', val:cur.fatturato, prev:prev.fatturato, fmt:f0, color:'var(--green)', key:'fatturato', sources:['shopify'] },
          { label:'Ordini', val:cur.ordini, prev:prev.ordini, fmt:fn, color:'var(--accent)', key:'ordini', sources:['shopify'] },
          { label:'AOV', val:cur.aov, prev:prev.aov, fmt:f2, color:'var(--orange)', key:'aov', sources:['shopify'] },
          { label:'Nuovi Clienti', val:cur.nc, prev:prev.nc, fmt:fn, color:'var(--cyan)', key:'nc', sources:['shopify'] },
          { label:'Clienti Ritorno', val:cur.rc, prev:prev.rc, fmt:fn, color:'var(--purple)', key:'rc', sources:['shopify'] },
          { label:'MER', val:cur.mer, prev:prev.mer, fmt:v=>v!=null?`${fr(v)}×`:'—', color:cur.mer!=null?(cur.mer>=3?'var(--green)':cur.mer>=2?'var(--orange)':'var(--red)'):'var(--text3)', key:'mer', sources:['shopify','meta'] },
          { label:'CAC', val:cur.cac, prev:prev.cac, fmt:f2, color:'var(--text)', key:'cac', lower:true, sources:['shopify','meta','google'] },
          { label:'Ratio LTV:CAC', val:cur.ratio, prev:prev.ratio, fmt:v=>v!=null?`${fr(v)}:1`:'—', color:ratioColor(cur.ratio), key:'ratio', sources:['shopify','meta'] },
          { label:'Meta Spend', val:cur.metaSpend, prev:prev.metaSpend, fmt:f0, color:'var(--accent)', key:'metaSpend', sources:['meta'] },
          { label:'Google Spend', val:cur.googleSpend, prev:prev.googleSpend, fmt:v=>v>0?f0(v):'—', color:'var(--yellow)', key:'googleSpend', sources:['google'] },
        ]

        return (
          <>
            {/* Timeframe selector */}
            <div style={{...S.card, marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <TimeframeSelector
                value={preset?.startsWith('year_') ? preset : `year_${y0}`}
                onChange={setPreset}
                disabled={loading}
                mode="year"
              />
              <button onClick={fetchLive} disabled={loading} className="btn-glass" style={{
                marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
                cursor:loading?'wait':'pointer', opacity:loading?0.5:1,
              }}>
                <span style={{animation:loading?'spin 1s linear infinite':'none'}}>↻</span>
                {loading?'Aggiorno…':'Aggiorna'}
              </button>
              <span style={{fontSize:11,color:'var(--text3)'}}>{yearLabel(y0)} vs {yearLabel(y1)}</span>
            </div>

            {/* KPI summary cards */}
            <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
              {kpiCards.map(kpi => (
                <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
                    <div className="label">{kpi.label}</div>
                    <PlatformBadges sources={kpi.sources} size={16} />
                  </div>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div className="metric-value">{kpi.fmt(kpi.val)}</div>
                    <Sparkline dataArr={aggregatedYears} dataKey={kpi.key} color={kpi.color} />
                  </div>
                  <div style={{marginTop:10}}>
                    <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                  </div>
                </div>
              ))}
            </div>

            {/* Dati annuali table */}
            <FxChartCard title="Dati annuali" glowColor="#22c55e" subtitle="Aggregato da dati mensili">
              <div style={{overflow:'auto',maxHeight:'72vh'}}>
                <table style={{width:'100%',minWidth:1450,borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Anno','Fatturato €','Fatt. NC €','Fatt. RC €','Resi €','Meta ADS €','Google ADS €','Tot Ordini','NC #','RC #','Sessioni'].map(h=>(
                        <th key={h} style={qTH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableYears.map((y,i) => {
                      const p = tableYears[i+1]
                      return (
                        <tr key={y.key} style={{background: i%2===0?'transparent':'var(--surface)'}}>
                          <td style={{...qTD,color:'var(--text)',fontWeight:900,whiteSpace:'nowrap',fontSize:15}}>{y.label}</td>
                          <td style={qTD}><YV value={y.fatturato} prev={p?.fatturato} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.fatturNC} prev={p?.fatturNC} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.fatturRC} prev={p?.fatturRC} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.resi||null} prev={p?.resi||null} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.metaSpend||null} prev={p?.metaSpend||null} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.googleSpend||null} prev={p?.googleSpend||null} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.ordini} prev={p?.ordini} kind="int" /></td>
                          <td style={qTD}><YV value={y.nc} prev={p?.nc} kind="int" /></td>
                          <td style={qTD}><YV value={y.rc} prev={p?.rc} kind="int" /></td>
                          <td style={qTD}><YV value={y.sessioni||null} prev={p?.sessioni||null} kind="int" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </FxChartCard>

            {/* KPI calcolati table */}
            <FxChartCard title="KPI calcolati" glowColor="#a78bfa">
              <div style={{overflow:'auto',maxHeight:'72vh'}}>
                <table style={{width:'100%',minWidth:1600,borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Anno','Fatturato','Fatt. NC','Fatt. RC','ADV','MER','aMER','CAC','CPO','AOV','AOV NC','AOV RC','Ret%','CRO%','LTV','Ratio'].map(h=>(
                        <th key={h} style={qTH}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tableYears.map((y,i) => {
                      const p = tableYears[i+1]
                      return (
                        <tr key={y.key} style={{background: i%2===0?'transparent':'var(--surface)'}}>
                          <td style={{...qTD,color:'var(--text)',fontSize:15,fontWeight:900,whiteSpace:'nowrap'}}>{y.label}</td>
                          <td style={qTD}><YV value={y.fatturato} prev={p?.fatturato} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.fatturNC} prev={p?.fatturNC} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.fatturRC} prev={p?.fatturRC} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.totalSpend} prev={p?.totalSpend} kind="euro0" /></td>
                          <td style={qTD}><YV value={y.mer} prev={p?.mer} kind="ratio" suffix="×" /></td>
                          <td style={qTD}><YV value={y.aMer} prev={p?.aMer} kind="ratio" suffix="×" /></td>
                          <td style={qTD}><YV value={y.cac} prev={p?.cac} kind="euro2" inverse /></td>
                          <td style={qTD}><YV value={y.cpo} prev={p?.cpo} kind="euro2" inverse /></td>
                          <td style={qTD}><YV value={y.aov} prev={p?.aov} kind="euro2" /></td>
                          <td style={qTD}><YV value={y.aovNC} prev={p?.aovNC} kind="euro2" /></td>
                          <td style={qTD}><YV value={y.aovRC} prev={p?.aovRC} kind="euro2" /></td>
                          <td style={qTD}><YV value={y.retention} prev={p?.retention} kind="percent1" /></td>
                          <td style={qTD}><YV value={y.cro} prev={p?.cro} kind="percent2" /></td>
                          <td style={qTD}><YV value={y.ltv} prev={p?.ltv} kind="euro2" /></td>
                          <td style={qTD}><YV value={y.ratio} prev={p?.ratio} kind="ratio" suffix=":1" /></td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </FxChartCard>

            {yearChartData.length > 0 && (
              <>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title="Fatturato, Spesa e MER" glowColor="#22c55e">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="yfx-rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="yfx-spend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="yfx-glow-g" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#yfx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#yfx-glow-g)'}} />
                        <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#yfx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationEasing="ease-out" animationBegin={200} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title="Nuovi clienti e clienti di ritorno" glowColor="#06b6d4">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                        <defs>
                          <linearGradient id="yfx-nc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                          </linearGradient>
                          <linearGradient id="yfx-rc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Bar dataKey="nc" name="Nuovi clienti" fill="url(#yfx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                        <Bar dataKey="rc" name="Clienti ritorno" fill="url(#yfx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>

                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="yfx-aov" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="yfx-cro" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#yfx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                        <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#yfx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title="Ratio LTV:CAC" glowColor="#a78bfa">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="yfx-ratio" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:700, position:'right'}} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11,paddingTop:10}} iconType="circle" />
                        <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#yfx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>
              </>
            )}

            {/* AI Insights & To-do */}
            <DashboardInsights preset={preset} />

            {/* Floating Year Agent (vertical chat) */}
            <YearAgent years={aggregatedYears} selectedYear={y0} previousYear={y1} preset={preset} />
          </>
        )
      })()}

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
  <PerformanceAgentTab cfg={cfg} preset={preset} />
)}

{/* KLAVIYO TAB */}
{tab === 'klaviyo' && (
  <KlaviyoTab />
)}

{/* COMPETITOR INTEL TAB */}
{tab === 'competitorIntel' && (
  <CompetitorIntelTab />
)}

{/* PRICE COMPARISON TAB */}
{tab === 'priceComparison' && (
  <PriceComparisonTab />
)}

{/* INTEGRATIONS TAB */}
{tab === 'integrations' && (
  <IntegrationsTab />
)}

{/* CRO TAB */}
{tab === 'cro' && (
  <CROTab data={data} live={live} onRefresh={fetchLive} loading={loading} />
)}

{/* AI WEBSITE SCANNER TAB */}
{tab === 'webScanner' && (
  <WebsiteScannerTab />
)}

{/* CREATIVE LAB TAB */}
{tab === 'creativeLab' && (
  <CreativeLabTab />
)}
      </VendroShell>
    )
  }
