'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'

// ── Utils ─────────────────────────────────────────────────────
const f0 = n => n>0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'
const f2 = n => n>0 ? `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
const fn = n => n>0 ? Number(n).toLocaleString('it-IT') : '—'
const fp = n => n!=null ? `${Number(n).toFixed(1)}x` : '—'
const fr = n => n!=null ? `${Number(n).toFixed(2).replace('.',',')}` : '—'

const ratioStatus = r => r==null?'nd':r<1?'bad':r<3?'warn':'ok'
const ratioColor  = r => ({nd:'#555',bad:'#ef4444',warn:'#f59e0b',ok:'#22c55e'})[ratioStatus(r)]
const ratioLabel  = r => ({nd:'N/D',bad:'CRITICO',warn:'ATTENZIONE',ok:'OTTIMO'})[ratioStatus(r)]

const MONTHS_START = '2026-04'

// Genera settimane dal 29/12/2025 a oggi (lunedì → domenica)
function getWeeks() {
  const weeks = []
  // Prima settimana: lun 29 dic 2025
  let d = new Date('2025-12-29T00:00:00Z')
  const now = new Date()
  while (d <= now) {
    const end = new Date(d); end.setDate(end.getDate() + 6)
    const fmt = dt => `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}`
    const key = `${d.getUTCFullYear()}-${fmt(d).replace('/','')}`
    weeks.push({ key, label: `${fmt(d)} → ${fmt(end)}` })
    d.setDate(d.getDate() + 7)
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
const WEMPTY = { fatturato:0, meta:0, google:0, ordini:0, nc:0, rc:0, sessioni:0 }
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
function WeeklyTab({ weeks, data, onUpdate, cfg, S }) {
  const allWeeks = weeks.map(({ key, label }) => {
    const d   = data[key] || WEMPTY
    const adv = (d.meta||0) + (d.google||0)
    const fat = d.fatturato || 0
    const ord = d.ordini    || 0
    const nc  = d.nc        || 0
    const rc  = d.rc        || 0
    const ses = d.sessioni  || 0
    const mer       = adv>0&&fat>0   ? fat/adv : null
    const cac       = adv>0&&nc>0    ? adv/nc  : null
    const cpo       = adv>0&&ord>0   ? adv/ord : null
    const aov       = ord>0&&fat>0   ? fat/ord : null
    const retention = (nc+rc)>0      ? rc/(nc+rc)*100 : null
    const cro       = ses>0&&ord>0   ? ord/ses*100    : null
    const ltv       = aov ? aov * cfg.freq * cfg.life * cfg.margin/100 : null
    const ratio     = ltv&&cac ? ltv/cac : null
    return { key, label, fat, meta:d.meta||0, google:d.google||0, adv, ord, nc, rc, ses, mer, cac, cpo, aov, retention, cro, ltv, ratio }
  })

  // Totali solo settimane con dati
  const filled = allWeeks.filter(w => w.fat > 0 || w.adv > 0)
  const totFat  = filled.reduce((s,w)=>s+w.fat,0)
  const totAdv  = filled.reduce((s,w)=>s+w.adv,0)
  const totMeta = filled.reduce((s,w)=>s+w.meta,0)
  const totGoog = filled.reduce((s,w)=>s+w.google,0)
  const totOrd  = filled.reduce((s,w)=>s+w.ord,0)
  const totNC   = filled.reduce((s,w)=>s+w.nc,0)
  const totRC   = filled.reduce((s,w)=>s+w.rc,0)
  const totSes  = filled.reduce((s,w)=>s+w.ses,0)
  const avgMER  = totAdv>0&&totFat>0 ? totFat/totAdv : null
  const avgCAC  = totAdv>0&&totNC>0  ? totAdv/totNC  : null
  const avgCPO  = totAdv>0&&totOrd>0 ? totAdv/totOrd : null
  const avgAOV  = totOrd>0&&totFat>0 ? totFat/totOrd : null
  const avgRet  = (totNC+totRC)>0    ? totRC/(totNC+totRC)*100 : null
  const avgCRO  = totSes>0&&totOrd>0 ? totOrd/totSes*100 : null
  const avgLTV  = avgAOV ? avgAOV*cfg.freq*cfg.life*cfg.margin/100 : null
  const avgRatio= avgLTV&&avgCAC ? avgLTV/avgCAC : null

  const TH  = { ...S.th, fontSize:10, padding:'8px 10px' }
  const TD  = { ...S.td, fontSize:12, padding:'7px 10px' }
  const col = r => r==null?'#555':r<1?'#ef4444':r<3?'#f59e0b':'#22c55e'

  return (
    <>
      {/* INPUT TABLE */}
      <div style={{...S.card, marginBottom:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <span style={{fontSize:13,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.08em',textTransform:'uppercase'}}>Inserimento dati settimanali</span>
          <span style={{fontSize:10,color:'#22c55e'}}>Dal 29 dic 2025 ad oggi — aggiornamento automatico ✓</span>
        </div>
        <div style={{overflowX:'auto'}}>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr>
                {['Settimana','Fatturato €','Meta ADS €','Google ADS €','Tot Ordini','NC #','RC #','Sessioni'].map(h=>(
                  <th key={h} style={TH}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allWeeks.map(({ key, label, fat, meta, google, ord, nc, rc, ses }, i) => (
                <tr key={key} style={{background:i%2===0?'transparent':'#080f1e'}}>
                  <td style={{...TD,color:'#94a3b8',fontWeight:600,whiteSpace:'nowrap',fontSize:11}}>{label}</td>
                  {[
                    {k:'fatturato', v:fat,    color:'#22c55e'},
                    {k:'meta',      v:meta,   color:'#3b82f6'},
                    {k:'google',    v:google, color:'#eab308'},
                    {k:'ordini',    v:ord,    color:'#e8e8e8', isCount:true},
                    {k:'nc',        v:nc,     color:'#06b6d4', isCount:true},
                    {k:'rc',        v:rc,     color:'#818cf8', isCount:true},
                    {k:'sessioni',  v:ses,    color:'#94a3b8', isCount:true},
                  ].map(({k,v,color,isCount}) => (
                    <td key={k} style={{...TD,padding:'5px 8px'}}>
                      <NumInput value={v} onChange={val=>onUpdate(key,k,val)} placeholder="0" color={color} isCount={isCount} />
                    </td>
                  ))}
                </tr>
              ))}
              {/* TOTALI */}
              <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                <td style={{...TD,color:'#555',fontWeight:800,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>TOTALE</td>
                <td style={{...TD,color:'#22c55e',fontWeight:800}}>{f0(totFat)}</td>
                <td style={{...TD,color:'#3b82f6',fontWeight:800}}>{f0(totMeta)}</td>
                <td style={{...TD,color:'#eab308',fontWeight:800}}>{totGoog>0?f0(totGoog):'—'}</td>
                <td style={{...TD,color:'#e8e8e8',fontWeight:800}}>{fn(totOrd)}</td>
                <td style={{...TD,color:'#06b6d4',fontWeight:800}}>{fn(totNC)}</td>
                <td style={{...TD,color:'#818cf8',fontWeight:800}}>{fn(totRC)}</td>
                <td style={{...TD,color:'#94a3b8',fontWeight:800}}>{fn(totSes)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* KPI CALCOLATI */}
      {filled.length > 0 && (
        <div style={{...S.card, marginBottom:20}}>
          <p style={{fontSize:11,color:'#fff',fontWeight:700,fontFamily:'Barlow Condensed',letterSpacing:'0.12em',textTransform:'uppercase',marginBottom:16}}>KPI calcolati</p>
          <div style={{overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse'}}>
              <thead>
                <tr>
                  {['Sett.','Fatturato','Invest. ADV','MER','CAC','CPO','AOV','Retention%','CRO%','LTV','Ratio'].map(h=>(
                    <th key={h} style={TH}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allWeeks.filter(w=>w.fat>0||w.adv>0).map((w,i)=>(
                  <tr key={w.key} style={{background:i%2===0?'transparent':'#080f1e'}}>
                    <td style={{...TD,color:'#94a3b8',fontSize:10,fontWeight:600,whiteSpace:'nowrap'}}>{w.label}</td>
                    <td style={{...TD,color:'#22c55e',fontWeight:700}}>{f0(w.fat)}</td>
                    <td style={{...TD,color:'#888'}}>{w.adv>0?f0(w.adv):'—'}</td>
                    <td style={{...TD,color:w.mer!=null?(w.mer>=3?'#22c55e':w.mer>=2?'#f59e0b':'#ef4444'):'#555',fontWeight:700,fontFamily:'Barlow'}}>
                      {w.mer!=null?`${fr(w.mer)}×`:'—'}
                    </td>
                    <td style={{...TD}}>{w.cac?f2(w.cac):'—'}</td>
                    <td style={{...TD}}>{w.cpo?f2(w.cpo):'—'}</td>
                    <td style={{...TD,color:'#3b82f6'}}>{w.aov?f2(w.aov):'—'}</td>
                    <td style={{...TD,color:'#818cf8'}}>{w.retention!=null?`${w.retention.toFixed(1)}%`:'—'}</td>
                    <td style={{...TD,color:'#94a3b8'}}>{w.cro!=null?`${w.cro.toFixed(2)}%`:'—'}</td>
                    <td style={{...TD}}>{w.ltv?f2(w.ltv):'—'}</td>
                    <td style={{...TD,fontWeight:900,fontFamily:'Barlow',fontSize:15,color:col(w.ratio)}}>
                      {w.ratio?`${fr(w.ratio)}:1`:'—'}
                    </td>
                  </tr>
                ))}
                <tr style={{background:'#0a1020',borderTop:'1px solid #1e2d47'}}>
                  <td style={{...TD,color:'#555',fontWeight:800,fontSize:10,textTransform:'uppercase',letterSpacing:'0.1em',fontFamily:'Barlow Condensed'}}>MEDIA</td>
                  <td style={{...TD,color:'#22c55e',fontWeight:800}}>{f0(totFat/filled.length)}</td>
                  <td style={{...TD,color:'#888',fontWeight:800}}>{totAdv>0?f0(totAdv/filled.length):'—'}</td>
                  <td style={{...TD,color:avgMER!=null?(avgMER>=3?'#22c55e':avgMER>=2?'#f59e0b':'#ef4444'):'#555',fontWeight:800,fontFamily:'Barlow',fontSize:15}}>
                    {avgMER!=null?`${fr(avgMER)}×`:'—'}
                  </td>
                  <td style={{...TD,fontWeight:800}}>{avgCAC?f2(avgCAC):'—'}</td>
                  <td style={{...TD,fontWeight:800}}>{avgCPO?f2(avgCPO):'—'}</td>
                  <td style={{...TD,color:'#3b82f6',fontWeight:800}}>{avgAOV?f2(avgAOV):'—'}</td>
                  <td style={{...TD,color:'#818cf8',fontWeight:800}}>{avgRet!=null?`${avgRet.toFixed(1)}%`:'—'}</td>
                  <td style={{...TD,color:'#94a3b8',fontWeight:800}}>{avgCRO!=null?`${avgCRO.toFixed(2)}%`:'—'}</td>
                  <td style={{...TD,fontWeight:800}}>{avgLTV?f2(avgLTV):'—'}</td>
                  <td style={{...TD,fontWeight:900,fontFamily:'Barlow',fontSize:18,color:col(avgRatio)}}>
                    {avgRatio?`${fr(avgRatio)}:1`:'—'}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* GRAFICI WEEKLY */}
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
                  <Bar dataKey="fat"  name="Fatturato" fill="#22c55e" radius={[2,2,0,0]} />
                  <Bar dataKey="meta" name="Meta ADS"  fill="#3b82f6" radius={[2,2,0,0]} />
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
                  <Line dataKey="cro"       name="CRO %"       stroke="#3b82f6" strokeWidth={2} dot={{r:3}} connectNulls />
                  <Line dataKey="retention" name="Retention %"  stroke="#818cf8" strokeWidth={2} dot={{r:3}} connectNulls />
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
    td:   { padding:'10px 14px', fontSize:14, borderBottom:'1px solid #0d1628', fontFamily:'Barlow',fontWeight:700, fontWeight:500 },
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
          <button onClick={fetchLive} disabled={loading} style={{padding:'4px 12px',fontSize:11,background:'#22c55e',color:'#000',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',opacity:loading?.5:1}}>
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
