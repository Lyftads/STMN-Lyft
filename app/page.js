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
import PriceComparisonTab from './components/PriceComparisonTab'
import IntegrationsTab from './components/IntegrationsTab'
import CROTab from './components/CROTab'
import CreativeLabTab from './components/CreativeLabTab'
import Sparkline from './components/Sparkline'
import DeltaBadge from './components/DeltaBadge'

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
function Stat({ label, value, sub, color='var(--text)', mono, dim, sparkData, sparkColor, current, previous }) {
  return (
    <div className="glass-card" style={{ padding: '20px 22px' }}>
      <div className="label" style={{ marginBottom: 12 }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div className={dim ? 'metric-value-sm' : 'metric-value'}>{value}</div>
        {sparkData && <Sparkline data={sparkData} color={sparkColor || 'var(--accent)'} width={80} height={32} />}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 10 }}>
        <DeltaBadge current={current} previous={previous} />
        {sub && <span style={{ fontSize: 12, color: 'var(--text3)' }}>{sub}</span>}
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

  const scenarioColors = ['#3b82f6', '#22c55e', '#f59e0b']
  const sm0 = n => n>0 ? `€${Math.round(n).toLocaleString('it-IT')}` : n<0 ? `-€${Math.round(Math.abs(n)).toLocaleString('it-IT')}` : '€0'
  const sm2 = n => `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const sp1 = n => `${Number(n).toFixed(1)}%`
  const si0 = n => n>0 ? Math.round(n).toLocaleString('it-IT') : '0'

  return (
    <>
    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:24,marginBottom:32}}>
      <div style={{background:'#0a1020',border:'1px solid #111827',borderRadius:8,padding:24}}>
        <p style={{fontSize:12,color:'#ccc',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:20,fontWeight:700}}>Simulatore LTV:CAC</p>
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

    {/* ── Scenario Advertising Simulator ── */}
    <div style={{background:'#0a1020',border:'1px solid #111827',borderRadius:10,padding:28,marginBottom:24}}>
      <p style={{fontSize:13,color:'#fff',textTransform:'uppercase',letterSpacing:'0.12em',marginBottom:6,fontWeight:700,fontFamily:'Barlow Condensed'}}>Scenari Advertising</p>
      <p style={{fontSize:11,color:'#555',marginBottom:24}}>Confronta 3 scenari · IVA 22% scorporata · COGS in % (prodotti + spedizione + packaging)</p>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:20,marginBottom:28}}>
        {scenarios.map((sc,i) => {
          const color = scenarioColors[i]
          return (
            <div key={i} style={{background:'#0d1628',border:`1px solid ${color}33`,borderRadius:12,padding:20}}>
              <input value={sc.name} onChange={e=>setSc(i,'name',e.target.value)}
                style={{width:'100%',background:'transparent',border:'none',color:color,fontSize:16,fontWeight:900,marginBottom:16,outline:'none',fontFamily:'Barlow'}}
                placeholder={`Scenario ${i+1}`} />

              <div style={{marginBottom:14}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                  <span style={{fontSize:10,color:'#555'}}>Spesa ADV mensile</span>
                </div>
                <input type="number" value={sc.spend} min={0} step={100}
                  onChange={e=>setSc(i,'spend',Math.max(0,parseFloat(e.target.value)||0))}
                  style={{width:'100%',background:'#0a1020',border:'1px solid #1e2d47',borderRadius:8,padding:'10px 14px',color:'#e8e8e8',fontSize:14,fontWeight:700,fontFamily:'Barlow',outline:'none',textAlign:'right'}}
                  placeholder="€" />
              </div>

              {[
                {k:'roas',l:'ROAS target',min:0.5,max:10,step:0.1,fmt:v=>`${v.toFixed(1)}×`},
                {k:'aov',l:'AOV medio (IVA inclusa)',min:20,max:300,step:1,fmt:v=>`€${v}`},
                {k:'cogs',l:'COGS % (prodotto+spedizione+packaging)',min:5,max:80,step:1,fmt:v=>`${v}%`},
              ].map(({k,l,min,max,step,fmt})=>(
                <div key={k} style={{marginBottom:12}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                    <span style={{fontSize:10,color:'#555'}}>{l}</span>
                    <span style={{fontSize:11,fontFamily:'Barlow',fontWeight:700,color:'#e8e8e8'}}>{fmt(sc[k])}</span>
                  </div>
                  <input type="range" min={min} max={max} step={step} value={sc[k]}
                    onChange={e=>setSc(i,k,parseFloat(e.target.value))} style={{width:'100%',accentColor:color}} />
                </div>
              ))}
            </div>
          )
        })}
      </div>

      <div style={{overflowX:'auto'}}>
        <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr>
              <th style={{padding:'12px 14px',textAlign:'left',color:'#94a3b8',fontWeight:700,fontSize:11,textTransform:'uppercase',fontFamily:'Barlow Condensed',borderBottom:'1px solid #1e2d47'}}>Metrica</th>
              {scenarios.map((sc,i)=>(
                <th key={i} style={{padding:'12px 14px',textAlign:'right',color:scenarioColors[i],fontWeight:900,fontSize:12,borderBottom:'1px solid #1e2d47',fontFamily:'Barlow'}}>{sc.name||`Scenario ${i+1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {l:'Fatturato IVA inclusa', f:c=>sm0(c.revenueIvaInclusa), bold:true},
              {l:'IVA 22% (da scorporare)', f:c=>`-${sm0(c.iva)}`, color:'#f59e0b'},
              {l:'Fatturato netto (senza IVA)', f:c=>sm0(c.revenue), bold:true, color:'#3b82f6'},
              {l:'Spesa ADV', f:(c,sc)=>sm0(sc.spend)},
              {l:'Ordini', f:c=>si0(c.orders)},
              {l:'AOV netto', f:c=>sm2(c.aovNetto)},
              {l:'ROAS', f:(c,sc)=>`${sc.roas.toFixed(1)}×`, bold:true},
              {l:'CPO', f:c=>sm2(c.cpo)},
              {l:'', sep:true},
              {l:'COGS', f:(c,sc)=>`${sc.cogs}%`, color:'#ef4444'},
              {l:'COGS totale', f:c=>sm0(c.cogsAmount), bold:true, color:'#ef4444'},
              {l:'Margine per ordine', f:c=>sm2(c.marginePerOrdine)},
              {l:'Margine %', f:c=>sp1(c.marginePct)},
              {l:'', sep:true},
              {l:'Profitto lordo (post COGS)', f:c=>sm0(c.profittoLordo), bold:true, color:'#3b82f6'},
              {l:'Profitto netto (post ADV)', f:c=>sm0(c.profittoNetto), bold:true, color:c=>c.profittoNetto>=0?'#22c55e':'#ef4444'},
              {l:'Net margin % (su lordo)', f:c=>sp1(c.netMarginPct), bold:true, color:c=>c.netMarginPct>=0?'#22c55e':'#ef4444'},
              {l:'Break-even ROAS', f:c=>`${c.breakEvenRoas.toFixed(2)}×`, color:'#f59e0b'},
            ].map((row,ri) => {
              if (row.sep) return <tr key={ri}><td colSpan={4} style={{height:8,borderBottom:'1px solid #1e2d47'}} /></tr>
              return (
              <tr key={ri} style={{background:ri%2===0?'transparent':'#080f1e'}}>
                <td style={{padding:'10px 14px',color:'#94a3b8',fontWeight:row.bold?800:500,fontSize:row.bold?13:12,fontFamily:'Barlow'}}>{row.l}</td>
                {scenarios.map((sc,i) => {
                  const calc = calcScenario(sc)
                  const cellColor = typeof row.color === 'function' ? row.color(calc) : row.color || '#f8fafc'
                  return <td key={i} style={{padding:'10px 14px',textAlign:'right',fontFamily:'Barlow',fontWeight:row.bold?900:700,fontSize:row.bold?15:13,color:cellColor}}>{row.f(calc,sc)}</td>
                })}
              </tr>
            )})}
          </tbody>
        </table>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:20,marginTop:24}}>
        <div style={{background:'#0d1628',borderRadius:10,padding:20}}>
          <p style={{fontSize:11,color:'#fff',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>Fatturato vs Profitto Netto</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scenarios.map((sc,i)=>{const c=calcScenario(sc);return{name:sc.name||`Sc.${i+1}`,lordo:c.revenueIvaInclusa,netto:c.revenue,profitto:c.profittoNetto}})} margin={{left:0,right:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
              <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`€${Math.round(v/1000)}k`} />
              <Tooltip content={<ChartTip />} />
              <Legend />
              <Bar dataKey="netto" name="Fatt. netto" fill="#3b82f6" radius={[4,4,0,0]} />
              <Bar dataKey="profitto" name="Profitto netto" fill="#22c55e" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <div style={{background:'#0d1628',borderRadius:10,padding:20}}>
          <p style={{fontSize:11,color:'#fff',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:14,fontWeight:700,fontFamily:'Barlow Condensed'}}>Breakdown Costi</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={scenarios.map((sc,i)=>{const c=calcScenario(sc);return{name:sc.name||`Sc.${i+1}`,iva:c.iva,cogs:c.cogsAmount,adv:sc.spend}})} margin={{left:0,right:0}}>
              <CartesianGrid strokeDasharray="2 4" stroke="#111827" />
              <XAxis dataKey="name" tick={{fill:'#94a3b8',fontSize:10,fontWeight:700}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'#94a3b8',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`€${Math.round(v/1000)}k`} />
              <Tooltip content={<ChartTip />} />
              <Legend />
              <Bar dataKey="iva" name="IVA 22%" fill="#f59e0b" stackId="c" radius={[4,4,0,0]} />
              <Bar dataKey="cogs" name="COGS" fill="#ef4444" stackId="c" />
              <Bar dataKey="adv" name="Spesa ADV" fill="#8b5cf6" stackId="c" radius={[0,0,4,4]} />
            </BarChart>
          </ResponsiveContainer>
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
          <div style={{marginTop:20,background:'#0d1628',borderRadius:10,padding:28}}>
            <p style={{fontSize:13,color:'#8b5cf6',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:20,fontWeight:900,fontFamily:'Barlow Condensed'}}>Analisi strategica CMO + CFO</p>

            {/* P&L Summary */}
            <div style={{marginBottom:20}}>
              <p style={{fontSize:11,color:'#f59e0b',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>P&L mensile per scenario</p>
              {cashFlowAnalysis.map((r,i) => (
                <div key={i} style={{background:'#0a1020',borderRadius:8,padding:'14px 18px',marginBottom:8,borderLeft:`3px solid ${scenarioColors[i]}`}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:6}}>
                    <span style={{color:scenarioColors[i],fontWeight:900,fontSize:14}}>{r.name}</span>
                    <span style={{color:r.profittoNetto>=0?'#22c55e':'#ef4444',fontWeight:950,fontSize:18,fontFamily:'Barlow'}}>{sm0(r.profittoNetto)}/mese</span>
                  </div>
                  <div style={{display:'flex',gap:16,flexWrap:'wrap',fontSize:11,color:'#94a3b8'}}>
                    <span>Fatt. lordo: {sm0(r.revenueIvaInclusa)}</span>
                    <span>IVA: -{sm0(r.iva)}</span>
                    <span>Fatt. netto: {sm0(r.revenue)}</span>
                    <span>COGS ({r.cogs}%): -{sm0(r.cogsAmount)}</span>
                    <span>ADV: -{sm0(r.spend)}</span>
                    <span style={{color:'#f59e0b'}}>ADV/Revenue: {sp1(r.advAsRevenueShare)}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cash Flow */}
            <div style={{marginBottom:20}}>
              <p style={{fontSize:11,color:'#06b6d4',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Flusso di cassa e sostenibilità</p>
              <div style={{fontSize:13,color:'#e8e8e8',lineHeight:1.7,fontWeight:600}}>
                {cashFlowAnalysis.map((r,i) => {
                  const isSafe = r.profittoNetto > 0 && r.netMarginPct >= 10
                  const isOk = r.profittoNetto > 0 && r.netMarginPct >= 5
                  const isTight = r.profittoNetto > 0 && r.netMarginPct < 5
                  const isLosing = r.profittoNetto < 0
                  return (
                    <div key={i} style={{marginBottom:12,paddingBottom:12,borderBottom:'1px solid #1e2d47'}}>
                      <span style={{color:scenarioColors[i],fontWeight:900}}>{r.name}:</span>{' '}
                      {isLosing && <span style={{color:'#ef4444'}}>In perdita di <strong>{sm0(Math.abs(r.profittoNetto))}/mese</strong>. Servono {sm0(r.runway)} di cassa extra ogni mese per sostenerlo. Non scalabile — stai finanziando la crescita di tasca tua. </span>}
                      {isTight && <span style={{color:'#f59e0b'}}>Margine netto solo al <strong>{sp1(r.netMarginPct)}</strong> — tecnicamente in profitto ma senza cuscinetto. Un calo del ROAS del 10% ti manda in perdita. Troppo rischioso per scalare. </span>}
                      {isOk && !isSafe && <span>Margine netto al <strong style={{color:'#22c55e'}}>{sp1(r.netMarginPct)}</strong> — sufficiente per scalare con cautela. Cash flow positivo di {sm0(r.profittoNetto)}/mese ({sm0(r.annualProfit)}/anno). </span>}
                      {isSafe && <span>Margine netto solido al <strong style={{color:'#22c55e'}}>{sp1(r.netMarginPct)}</strong>. Cash flow di {sm0(r.profittoNetto)}/mese = <strong>{sm0(r.annualProfit)}/anno</strong>. Puoi reinvestire il profitto per scalare senza rischio. </span>}
                      <span style={{color:'#776a86'}}>Cash in/out ratio: {r.cashRatio.toFixed(2)}× — per ogni €1 che esci, ne entrano €{r.cashRatio.toFixed(2)}. {r.cashRatio < 1.1 ? 'Troppo tirato.' : r.cashRatio < 1.3 ? 'Margine sottile.' : 'Sano.'}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Strategia di scaling */}
            <div style={{marginBottom:20}}>
              <p style={{fontSize:11,color:'#22c55e',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Strategia di scaling raccomandata</p>
              <div style={{fontSize:13,color:'#e8e8e8',lineHeight:1.7,fontWeight:600}}>
                {scalable.length > 0 ? (
                  <>
                    <p style={{marginBottom:8}}>Lo scenario migliore per scalare è <strong style={{color:'#22c55e'}}>"{scalable.sort((a,b)=>b.annualProfit-a.annualProfit)[0].name}"</strong> — genera {sm0(scalable[0].annualProfit)} di profitto annuo con un margine netto del {sp1(scalable[0].netMarginPct)} che lascia spazio per imprevisti (calo ROAS stagionale, aumento CPM, resi).</p>
                    <p style={{marginBottom:8}}>Con COGS al {scalable[0].cogs}% e ADV che pesa il {sp1(scalable[0].advAsRevenueShare)} del fatturato lordo, la struttura dei costi è {scalable[0].advAsRevenueShare < 25 ? 'sana — c\'è margine per aumentare la spesa ADV se il ROAS tiene' : scalable[0].advAsRevenueShare < 35 ? 'nella media — monitora attentamente il ROAS, non c\'è molto margine di errore' : 'alta — l\'ADV pesa troppo sul fatturato, prima di scalare devi migliorare il ROAS o l\'AOV'}.</p>
                    {scalable[0].monthsToRecover && <p style={{marginBottom:8}}>Ogni mese di ADV si ripaga in <strong>{scalable[0].monthsToRecover < 1 ? 'meno di un mese' : `${scalable[0].monthsToRecover.toFixed(1)} mesi`}</strong> — {scalable[0].monthsToRecover < 1 ? 'ciclo di cassa velocissimo, ideale per scalare' : scalable[0].monthsToRecover < 3 ? 'ciclo ragionevole' : 'ciclo lungo, attenzione alla liquidità'}.</p>}
                  </>
                ) : risky.length > 0 ? (
                  <p style={{color:'#f59e0b'}}>Nessuno scenario ha margini sufficienti per scalare in sicurezza. <strong>"{risky[0].name}"</strong> è in profitto ma con margini troppo sottili ({sp1(risky[0].netMarginPct)}). Prima di scalare: lavora sull'AOV (bundle, upsell), riduci i COGS (negozia fornitori, packaging), o migliora il ROAS (creative testing, audience optimization).</p>
                ) : (
                  <p style={{color:'#ef4444'}}>Tutti gli scenari sono in perdita. Non scalare la spesa ADV finché non raggiungi almeno il break-even. Concentrati su: migliorare il ROAS (creative, targeting), alzare l'AOV (bundle, cross-sell), ridurre i COGS, o valutare se il canale paid è sostenibile per il tuo modello di business.</p>
                )}
              </div>
            </div>

            {/* Visione a 12 mesi */}
            <div style={{marginBottom:16}}>
              <p style={{fontSize:11,color:'#ec4899',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:10}}>Proiezione 12 mesi</p>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {cashFlowAnalysis.map((r,i) => (
                  <div key={i} style={{background:'#0a1020',borderRadius:8,padding:'14px 18px',borderTop:`2px solid ${scenarioColors[i]}`}}>
                    <div style={{color:scenarioColors[i],fontWeight:900,fontSize:12,marginBottom:8}}>{r.name} — 12 mesi</div>
                    <div style={{fontSize:11,color:'#94a3b8',lineHeight:1.8}}>
                      <div>Fatturato annuo: <strong style={{color:'#f8fafc'}}>{sm0(r.revenueIvaInclusa * 12)}</strong></div>
                      <div>Spesa ADV annua: <strong style={{color:'#f8fafc'}}>{sm0(r.spend * 12)}</strong></div>
                      <div>COGS annuo: <strong style={{color:'#f8fafc'}}>{sm0(r.cogsAmount * 12)}</strong></div>
                      <div>IVA annua: <strong style={{color:'#f8fafc'}}>{sm0(r.iva * 12)}</strong></div>
                      <div style={{borderTop:'1px solid #1e2d47',marginTop:6,paddingTop:6}}>
                        Profitto netto annuo: <strong style={{color:r.annualProfit>=0?'#22c55e':'#ef4444',fontSize:14}}>{sm0(r.annualProfit)}</strong>
                      </div>
                      <div>Ordini annui: <strong style={{color:'#f8fafc'}}>{si0(r.orders * 12)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom line */}
            <div style={{background:'#0a1020',borderRadius:8,padding:'16px 20px',borderLeft:'3px solid #8b5cf6'}}>
              <p style={{fontSize:11,color:'#8b5cf6',fontWeight:800,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8}}>Bottom line</p>
              <div style={{fontSize:13,color:'#e8e8e8',lineHeight:1.6,fontWeight:600}}>
                Break-even ROAS: {cashFlowAnalysis.map(r=><span key={r.name}><strong style={{color:scenarioColors[results.indexOf(r)]}}>{r.name}</strong> = {r.breakEvenRoas.toFixed(2)}× · </span>)}
                <br/>Sotto questi valori perdi soldi. Sopra, ogni punto di ROAS in più è margine puro.
                {cashFlowAnalysis.some(r=>r.advAsRevenueShare>30) && <><br/><span style={{color:'#f59e0b'}}>La spesa ADV supera il 30% del fatturato in alcuni scenari — valuta di diversificare i canali (email, organic, referral) per ridurre la dipendenza dal paid.</span></>}
              </div>
            </div>
          </div>
        )
      })()}
    </div>
    </>
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
  const [preset, setPreset] = useState('last_90d')
  const [monthlyTF, setMonthlyTF] = useState('this_month')
  const [monthlyCustom, setMonthlyCustom] = useState({ since: '', until: '' })

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

  const prevTotals = {
    revenue: sumField(swPrev, 'fatturato'),
    orders: sumField(swPrev, 'ordini'),
    nc: sumField(swPrev, 'nc'),
    rc: sumField(swPrev, 'rc'),
    sessions: sumField(swPrev, 'uniqueSessions'),
    resi: sumField(swPrev, 'resi'),
    metaSpend: sumField(mwPrev, 'spend'),
    impressions: sumField(mwPrev, 'impressions'),
    clicks: sumField(mwPrev, 'linkClicks'),
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

  const S = {
    card: {},
    th:   { padding:'12px 16px', fontSize:11, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.06em', textAlign:'left', fontWeight:600, borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
    td:   { padding:'12px 16px', fontSize:14, borderBottom:'1px solid var(--border)', fontWeight:500, color:'var(--text)' },
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
            <Stat label="Fatturato" value={f0(periodTotals.revenue || totFat)}
              sparkData={swCurrent.map(w=>w.fatturato)} sparkColor="var(--green)"
              current={periodTotals.revenue} previous={prevTotals.revenue} />
            <Stat label="Ordini" value={fn(periodTotals.orders || totOrd)}
              sparkData={swCurrent.map(w=>w.ordini)} sparkColor="var(--accent)"
              current={periodTotals.orders} previous={prevTotals.orders} />
            <Stat label="AOV medio" value={avgAOV ? f2(avgAOV) : '—'}
              sparkData={swCurrent.map(w=> w.ordini > 0 ? w.fatturato/w.ordini : 0)}
              current={avgAOV} previous={prevTotals.orders > 0 ? prevTotals.revenue/prevTotals.orders : null} />
            <Stat label="Nuovi clienti" value={fn(periodTotals.nc || totNC)}
              sparkData={swCurrent.map(w=>w.nc)} sparkColor="var(--cyan)"
              current={periodTotals.nc} previous={prevTotals.nc} />
          </div>

          <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:14,marginBottom:20}}>
            <Stat label="LTV netto" value={avgLTV ? f2(avgLTV) : '—'} sub={`${cfg.freq}× · ${cfg.life}a · ${cfg.margin}%`} />
            <Stat label="CAC" value={avgCAC ? f2(avgCAC) : '—'} sub={`${fn(totNC)} NC`} />
            <Stat label="Spesa Meta" value={totMeta>0?f0(totMeta):'—'}
              sparkData={mwCurrent.map(w=>w.spend)} sparkColor="var(--accent)"
              current={periodTotals.metaSpend} previous={prevTotals.metaSpend} />
            <Stat label="Spesa totale" value={totSpend>0?f0(totSpend):'—'} sub="Meta + Google" />
          </div>

          {totResi > 0 && (
            <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
              <Stat label="Resi totali" value={f0(totResi)} />
              <Stat label="Resi nuovi clienti" value={totResiNC>0?f0(totResiNC):'—'} dim />
              <Stat label="Resi clienti ritorno" value={totResiRC>0?f0(totResiRC):'—'} dim />
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
    preset={preset}
    kpiRange={kpiRange}
    swCurrent={swCurrent}
    swPrev={swPrev}
    mwCurrent={mwCurrent}
    mwPrev={mwPrev}
    periodTotals={periodTotals}
    prevTotals={prevTotals}
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

        // ── Timeframe mensile: calcola periodo corrente e precedente ──
        const now = new Date()
        const fmtM = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        const thisMonth = fmtM(now)
        const prevMonth = fmtM(new Date(now.getFullYear(), now.getMonth()-1, 1))

        let tfMonths = []
        let tfPrevMonths = []
        let tfLabel = ''

        if (monthlyTF === 'this_month') {
          tfMonths = data.filter(m => m.month === thisMonth)
          tfPrevMonths = data.filter(m => m.month === prevMonth)
          tfLabel = `${thisMonth} vs ${prevMonth}`
        } else if (monthlyTF === 'last_month') {
          const beforePrev = fmtM(new Date(now.getFullYear(), now.getMonth()-2, 1))
          tfMonths = data.filter(m => m.month === prevMonth)
          tfPrevMonths = data.filter(m => m.month === beforePrev)
          tfLabel = `${prevMonth} vs ${beforePrev}`
        } else if (monthlyTF === 'custom' && monthlyCustom.since && monthlyCustom.until) {
          tfMonths = data.filter(m => m.month >= monthlyCustom.since && m.month <= monthlyCustom.until)
          const startDate = new Date(monthlyCustom.since + '-01')
          const endDate = new Date(monthlyCustom.until + '-01')
          const span = (endDate.getFullYear() - startDate.getFullYear()) * 12 + endDate.getMonth() - startDate.getMonth() + 1
          const prevEnd = new Date(startDate); prevEnd.setMonth(prevEnd.getMonth() - 1)
          const prevStart = new Date(prevEnd); prevStart.setMonth(prevStart.getMonth() - span + 1)
          tfPrevMonths = data.filter(m => m.month >= fmtM(prevStart) && m.month <= fmtM(prevEnd))
          tfLabel = `${monthlyCustom.since} → ${monthlyCustom.until} vs periodo prec.`
        } else {
          tfMonths = data.filter(m => m.month === thisMonth)
          tfPrevMonths = data.filter(m => m.month === prevMonth)
          tfLabel = `${thisMonth} vs ${prevMonth}`
        }

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
          { label: 'Fatturato', val: tf.fat, prev: tfP.fat, fmt: f0, color: '#22c55e', key: 'fatturato' },
          { label: 'Ordini', val: tf.ord, prev: tfP.ord, fmt: fn, color: '#f8fafc', key: 'ordini' },
          { label: 'AOV', val: tf.aov, prev: tfP.aov, fmt: f2, color: '#f59e0b', key: 'aov' },
          { label: 'Nuovi Clienti', val: tf.nc, prev: tfP.nc, fmt: fn, color: '#06b6d4', key: 'nc' },
          { label: 'Clienti Ritorno', val: tf.rc, prev: tfP.rc, fmt: fn, color: '#a78bfa', key: 'rc' },
          { label: 'MER', val: tf.mer, prev: tfP.mer, fmt: v => v != null ? `${fr(v)}×` : '—', color: tf.mer != null ? (tf.mer >= 3 ? '#22c55e' : tf.mer >= 2 ? '#f59e0b' : '#ef4444') : '#555', key: 'mer' },
          { label: 'CAC', val: tf.cac, prev: tfP.cac, fmt: f2, color: '#f8fafc', key: 'cac', lower: true },
          { label: 'Ratio LTV:CAC', val: tf.ratio, prev: tfP.ratio, fmt: v => v != null ? `${fr(v)}:1` : '—', color: ratioColor(tf.ratio), key: 'ratio' },
          { label: 'Meta Spend', val: tf.meta, prev: tfP.meta, fmt: f0, color: '#3b82f6', key: 'metaSpend' },
          { label: 'Google Spend', val: tf.goog, prev: tfP.goog, fmt: v => v > 0 ? f0(v) : '—', color: '#eab308', key: 'googleSpend' },
        ]

        return (
        <>
          {/* Timeframe selector */}
          <div style={{...S.card, marginBottom:16, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
            {[
              { id: 'this_month', l: 'Questo mese' },
              { id: 'last_month', l: 'Mese precedente' },
              { id: 'custom', l: 'Custom' },
            ].map(b => (
              <button key={b.id} onClick={() => setMonthlyTF(b.id)} style={{
                fontSize:12, padding:'6px 14px', borderRadius:6, cursor:'pointer',
                border: monthlyTF === b.id ? '1px solid #22c55e' : '1px solid #1e2d47',
                background: monthlyTF === b.id ? '#22c55e20' : 'transparent',
                color: monthlyTF === b.id ? '#22c55e' : '#94a3b8',
                fontWeight: monthlyTF === b.id ? 700 : 500,
              }}>{b.l}</button>
            ))}
            {monthlyTF === 'custom' && (
              <>
                <input type="month" value={monthlyCustom.since} onChange={e => setMonthlyCustom(p => ({...p, since: e.target.value}))}
                  style={{background:'#0a1020',border:'1px solid #1e2d47',borderRadius:6,padding:'5px 8px',color:'#e8e8e8',fontSize:12}} />
                <span style={{color:'#555'}}>→</span>
                <input type="month" value={monthlyCustom.until} onChange={e => setMonthlyCustom(p => ({...p, until: e.target.value}))}
                  style={{background:'#0a1020',border:'1px solid #1e2d47',borderRadius:6,padding:'5px 8px',color:'#e8e8e8',fontSize:12}} />
              </>
            )}
            <span style={{marginLeft:'auto',fontSize:11,color:'#64748b'}}>{tfLabel}</span>
          </div>

          {/* Summary KPI Cards with sparkline + delta */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:12,marginBottom:20}}>
            {kpiCards.map(kpi => (
              <div key={kpi.label} style={{background:'#0a1020',border:'1px solid #111827',borderRadius:10,padding:'16px 18px'}}>
                <div style={{fontSize:10,color:'#94a3b8',fontWeight:700,textTransform:'uppercase',letterSpacing:'.08em',marginBottom:8,fontFamily:'Barlow Condensed'}}>{kpi.label}</div>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                  <div style={{fontSize:24,fontWeight:950,color:kpi.color,fontFamily:'Barlow',letterSpacing:'-0.02em'}}>
                    {kpi.fmt(kpi.val)}
                  </div>
                  <Sparkline dataArr={filled} dataKey={kpi.key} color={kpi.color} />
                </div>
                <div style={{marginTop:8}}>
                  <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                </div>
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
                  {tfMonths.map((m,i)=>{
                    const p = i > 0 ? tfMonths[i-1] : (tfPrevMonths.length > 0 ? tfPrevMonths[tfPrevMonths.length-1] : null)
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
                  {tfMonths.length > 1 && (
                  <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                    <td style={{...mTD,color:'#94a3b8',fontWeight:900,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>Totale</td>
                    <td style={{...mTD,...mVal}}>{f0(tf.fat)}</td>
                    <td style={{...mTD,...mVal}}>{f0(sumField(tfMonths,'fatturNC'))}</td>
                    <td style={{...mTD,...mVal}}>{f0(sumField(tfMonths,'fatturRC'))}</td>
                    <td style={{...mTD,...mVal}}>{sumField(tfMonths,'resi')>0?f0(sumField(tfMonths,'resi')):'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.meta>0?f0(tf.meta):'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.goog>0?f0(tf.goog):'—'}</td>
                    <td style={{...mTD,...mVal}}>{fn(tf.ord)}</td>
                    <td style={{...mTD,...mVal}}>{fn(tf.nc)}</td>
                    <td style={{...mTD,...mVal}}>{fn(tf.rc)}</td>
                    <td style={{...mTD,...mVal}}>{tf.ses>0?fn(tf.ses):'—'}</td>
                  </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* KPI Calcolati Table */}
          {tfMonths.filter(m => m.fatturato > 0 || m.totalSpend > 0).length > 0 && (
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
                  {tfMonths.filter(m => m.fatturato > 0 || m.totalSpend > 0).map((m,i,arr)=>{
                    const p = i > 0 ? arr[i-1] : (tfPrevMonths.length > 0 ? tfPrevMonths[tfPrevMonths.length-1] : null)
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
                  {tfMonths.filter(m => m.fatturato > 0 || m.totalSpend > 0).length > 1 && (
                  <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                    <td style={{...mTD,color:'#94a3b8',fontWeight:900,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>Media / Totale</td>
                    <td style={{...mTD,...mVal}}>{f0(tf.fat)}</td>
                    <td style={{...mTD,...mVal}}>{f0(sumField(tfMonths,'fatturNC'))}</td>
                    <td style={{...mTD,...mVal}}>{f0(sumField(tfMonths,'fatturRC'))}</td>
                    <td style={{...mTD,...mVal}}>{f0(tf.spend)}</td>
                    <td style={{...mTD,...mVal}}>{tf.mer!=null?`${fr(tf.mer)}×`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{divSafe(sumField(tfMonths,'fatturNC'),tf.spend)!=null?`${fr(divSafe(sumField(tfMonths,'fatturNC'),tf.spend))}×`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.cac?f2(tf.cac):'—'}</td>
                    <td style={{...mTD,...mVal}}>{divSafe(tf.spend,tf.ord)?f2(divSafe(tf.spend,tf.ord)):'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.aov>0?f2(tf.aov):'—'}</td>
                    <td style={{...mTD,...mVal}}>{divSafe(sumField(tfMonths,'fatturNC'),tf.nc)>0?f2(divSafe(sumField(tfMonths,'fatturNC'),tf.nc)):'—'}</td>
                    <td style={{...mTD,...mVal}}>{divSafe(sumField(tfMonths,'fatturRC'),tf.rc)>0?f2(divSafe(sumField(tfMonths,'fatturRC'),tf.rc)):'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.nc+tf.rc>0?`${(tf.rc/(tf.nc+tf.rc)*100).toFixed(1)}%`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.ses>0&&tf.ord>0?`${(tf.ord/tf.ses*100).toFixed(2)}%`:'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.aov>0?f2(tf.aov*cfg.freq*cfg.life*cfg.margin/100):'—'}</td>
                    <td style={{...mTD,...mVal}}>{tf.ratio?`${fr(tf.ratio)}:1`:'—'}</td>
                  </tr>
                  )}
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
  <CROTab />
)}

{/* CREATIVE LAB TAB */}
{tab === 'creativeLab' && (
  <CreativeLabTab />
)}
      </VendroShell>
    )
  }
