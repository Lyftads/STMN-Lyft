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
function getMonths() {
  const out = [], now = new Date()
  let [y,m] = MONTHS_START.split('-').map(Number)
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth()+1)) {
    out.push(`${y}-${String(m).padStart(2,'0')}`)
    m++; if(m>12){m=1;y++}
  }
  return out
}

const EMPTY = { fatturato:0, ordini:0, nuoviClienti:0, googleSpend:0 }
const DEF   = { freq:1.69, life:1.57, margin:30 }

function load() {
  try { return { m: JSON.parse(localStorage.getItem('stmn_m')||'{}'), c: JSON.parse(localStorage.getItem('stmn_c')||'{}') } }
  catch { return { m:{}, c:{} } }
}
const saveM = m => { try { localStorage.setItem('stmn_m', JSON.stringify(m)) } catch{} }
const saveC = c => { try { localStorage.setItem('stmn_c', JSON.stringify(c)) } catch{} }

// ── Tooltip personalizzato ────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{background:'#0f0f0f',border:'1px solid #242424',borderRadius:6,padding:'8px 12px',fontSize:11,fontFamily:'DM Mono'}}>
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
          background:'#0f0f0f',
          border:'1px solid #1a1a1a',
          borderRadius:4,
          padding:'4px 8px',
          width:110,
          textAlign:'right',
          fontSize:12,
          fontFamily:'DM Mono',
          color: color,
          outline:'none',
        }}
        onFocus={e => e.target.style.borderColor='#333'}
        onBlur={e => e.target.style.borderColor='#1a1a1a'}
      />
      {preview && <span style={{fontSize:10,textAlign:'right',color,opacity:0.5,fontFamily:'DM Mono'}}>{preview}</span>}
    </div>
  )
}

// ── Stat box ──────────────────────────────────────────────────
function Stat({ label, value, sub, color='#e8e8e8', mono, dim }) {
  return (
    <div style={{
      background:'#0f0f0f',
      border:'1px solid #1a1a1a',
      borderRadius:8,
      padding:'14px 16px',
    }}>
      <div style={{fontSize:10,color:'#555',textTransform:'uppercase',letterSpacing:'0.08em',marginBottom:6}}>{label}</div>
      <div style={{fontSize:dim?18:22,fontWeight:700,color,fontFamily:mono?'DM Mono':'DM Sans',letterSpacing:mono?'-0.03em':'normal'}}>{value}</div>
      {sub && <div style={{fontSize:11,color:'#444',marginTop:4}}>{sub}</div>}
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
        <div style={{fontSize:64,fontWeight:800,color:col,fontFamily:'DM Mono',lineHeight:1,letterSpacing:'-0.04em'}}>
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
        <div style={{fontSize:36,fontWeight:700,color:'#e8e8e8',fontFamily:'DM Mono',letterSpacing:'-0.03em'}}>
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
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'#0f0f0f',border:'1px solid #242424',borderRadius:10,padding:28,width:340}}>
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
                style={{flex:1,background:'#080808',border:'1px solid #242424',borderRadius:4,padding:'6px 10px',color:'#e8e8e8',fontSize:14,fontFamily:'DM Mono',textAlign:'right',outline:'none'}} />
              <span style={{fontSize:12,color:'#444',width:48}}>{u}</span>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:24}}>
          <button onClick={onClose} style={{flex:1,padding:'8px',border:'1px solid #242424',borderRadius:6,background:'none',color:'#888',cursor:'pointer',fontSize:13}}>Annulla</button>
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
      <div style={{background:'#0f0f0f',border:'1px solid #1a1a1a',borderRadius:8,padding:24}}>
        <p style={{fontSize:12,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:20}}>Muovi i cursori</p>
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
              <span style={{fontSize:12,fontFamily:'DM Mono',color:'#e8e8e8'}}>{fmt(s[k])}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={s[k]}
              onChange={e=>set(k,parseFloat(e.target.value))} style={{width:'100%'}} />
          </div>
        ))}
      </div>

      <div style={{display:'flex',flexDirection:'column',gap:16}}>
        <RatioWidget ratio={ratio} mer={s.cac>0&&s.aov>0?ltv/s.cac:null} />
        <div style={{background:'#0f0f0f',border:'1px solid #1a1a1a',borderRadius:8,padding:20}}>
          <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Per raggiungere 3:1</p>
          {[
            {l:'CAC target',    v:`€${Math.round(cacFor3)}`,  sub:`attuale €${s.cac} (${cacFor3<s.cac?'−':'+'} ${Math.abs(Math.round((s.cac-cacFor3)/s.cac*100))}%)`},
            {l:'AOV necessario', v:`€${Math.round(aovFor3)}`, sub:`attuale €${s.aov} (+${Math.round((aovFor3-s.aov)/s.aov*100)}%)`},
          ].map(({l,v,sub}) => (
            <div key={l} style={{display:'flex',justifyContent:'space-between',alignItems:'center',padding:'10px 0',borderBottom:'1px solid #1a1a1a'}}>
              <div>
                <div style={{fontSize:13,color:'#e8e8e8'}}>{l}</div>
                <div style={{fontSize:11,color:'#444',marginTop:2}}>{sub}</div>
              </div>
              <div style={{fontSize:18,fontWeight:700,fontFamily:'DM Mono',color:'#22c55e'}}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────
export default function App() {
  const [tab,    setTab]    = useState('dashboard')
  const [live,   setLive]   = useState(null)
  const [loading,setLoading]= useState(true)
  const [cfg,    setCfg]    = useState(DEF)
  const [showCfg,setShowCfg]= useState(false)
  const [months, setMonths] = useState({})
  const [updated,setUpdated]= useState(null)

  const avail = getMonths()

  useEffect(() => {
    const s = load()
    if (s.c && Object.keys(s.c).length) setCfg({...DEF,...s.c})
    if (s.m) setMonths(s.m)
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
    {id:'simulator', l:'Simulatore'},
  ]

  const S = { // shared styles
    card: { background:'#0f0f0f', border:'1px solid #1a1a1a', borderRadius:8, padding:20 },
    th:   { padding:'8px 12px', fontSize:10, color:'#555', textTransform:'uppercase', letterSpacing:'0.07em', textAlign:'left', fontWeight:500, borderBottom:'1px solid #1a1a1a', whiteSpace:'nowrap' },
    td:   { padding:'8px 12px', fontSize:12, borderBottom:'1px solid #0f0f0f', fontFamily:'DM Mono' },
  }

  return (
    <div style={{minHeight:'100vh',background:'#080808',padding:'20px 24px',maxWidth:1400,margin:'0 auto'}}>
      {showCfg && <Settings cfg={cfg} onSave={c=>setCfg(c)} onClose={()=>setShowCfg(false)} />}

      {/* HEADER */}
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:28}}>
        <div>
          <div style={{fontSize:15,fontWeight:700,letterSpacing:'-0.02em',color:'#e8e8e8'}}>STMN Fitness</div>
          <div style={{fontSize:11,color:'#444',marginTop:2,fontFamily:'DM Mono'}}>
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
          <button onClick={()=>setShowCfg(true)} style={{padding:'4px 10px',fontSize:11,background:'none',border:'1px solid #242424',borderRadius:6,color:'#888',cursor:'pointer'}}>⚙ LTV</button>
          <button onClick={fetchLive} disabled={loading} style={{padding:'4px 12px',fontSize:11,background:'#22c55e',color:'#000',border:'none',borderRadius:6,fontWeight:700,cursor:'pointer',opacity:loading?.5:1}}>
            {loading ? '...' : '↻ Aggiorna'}
          </button>
        </div>
      </div>

      {/* TABS */}
      <div style={{display:'flex',gap:2,marginBottom:24,borderBottom:'1px solid #1a1a1a',paddingBottom:0}}>
        {TABS.map(t => (
          <button key={t.id} onClick={()=>setTab(t.id)} style={{
            padding:'8px 18px', fontSize:12, background:'none', border:'none', cursor:'pointer',
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
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>Ratio LTV:CAC mensile</p>
              <ResponsiveContainer width="100%" height={200}>
                <LineChart data={data} margin={{top:4,right:16,left:0,bottom:4}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:10,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:10,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
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
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>Fatturato vs Spesa Ads</p>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={data} margin={{top:4,right:16,left:0,bottom:4}} barGap={4}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:10,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:10,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
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
              <span style={{fontSize:12,color:'#888'}}>Inserimento dati mensili</span>
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
                      <tr key={month} style={{borderBottom:'1px solid #111'}}>
                        <td style={{...S.td,color:'#888',fontWeight:600}}>{month}</td>
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
                  <tr style={{background:'#0a0a0a',borderTop:'1px solid #242424'}}>
                    <td style={{...S.td,color:'#555',fontWeight:700,fontSize:10,textTransform:'uppercase',letterSpacing:'0.07em'}}>Totale</td>
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
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:16}}>KPI calcolati</p>
              <div style={{overflowX:'auto'}}>
                <table style={{width:'100%',borderCollapse:'collapse'}}>
                  <thead>
                    <tr>
                      {['Mese','AOV','Spesa Totale','CAC','LTV','Ratio','MER'].map(h=>(
                        <th key={h} style={S.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.map((m,i) => (
                      <tr key={m.month} style={{background:i%2===0?'transparent':'#0a0a0a'}}>
                        <td style={{...S.td,color:'#888',fontWeight:600}}>{m.month}</td>
                        <td style={{...S.td,color:'#e8e8e8'}}>{m.aov>0?f2(m.aov):'—'}</td>
                        <td style={{...S.td,color:'#888'}}>{m.totalSpend>0?f0(m.totalSpend):'—'}</td>
                        <td style={{...S.td,color:'#e8e8e8'}}>{m.cac?f2(m.cac):'—'}</td>
                        <td style={{...S.td,color:'#e8e8e8'}}>{m.ltv?f2(m.ltv):'—'}</td>
                        <td style={{...S.td,fontWeight:700,fontFamily:'DM Mono',color:ratioColor(m.ratio)}}>{m.ratio?`${fr(m.ratio)}:1`:'—'}</td>
                        <td style={{...S.td,color:'#22c55e',fontWeight:600}}>{m.mer?`${fr(m.mer)}×`:'—'}</td>
                      </tr>
                    ))}
                    <tr style={{background:'#0a0a0a',borderTop:'1px solid #242424'}}>
                      <td style={{...S.td,color:'#555',fontWeight:700,fontSize:10,textTransform:'uppercase'}}>Media</td>
                      <td style={{...S.td,color:'#e8e8e8',fontWeight:700}}>{avgAOV>0?f2(avgAOV):'—'}</td>
                      <td style={{...S.td,color:'#888',fontWeight:700}}>{totSpend>0?f0(Math.round(totSpend/avail.length)):'—'}</td>
                      <td style={{...S.td,fontWeight:700}}>{cacG?f2(cacG):'—'}</td>
                      <td style={{...S.td,fontWeight:700}}>{ltvG?f2(ltvG):'—'}</td>
                      <td style={{...S.td,fontWeight:800,fontFamily:'DM Mono',fontSize:16,color:ratioColor(ratioG)}}>{ratioG?`${fr(ratioG)}:1`:'—'}</td>
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
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Fatturato vs Spesa Ads</p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={data} barGap={3} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" vertical={false} />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9}} axisLine={false} tickLine={false} tickFormatter={v=>`${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTip />} />
                  <Bar dataKey="fatturato"  name="Fatturato" fill="#22c55e" radius={[2,2,0,0]} />
                  <Bar dataKey="metaSpend"  name="Meta"      fill="#3b82f6" radius={[2,2,0,0]} />
                  <Bar dataKey="googleSpend" name="Google"   fill="#eab308" radius={[2,2,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>CAC mensile</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="cac" name="CAC €" stroke="#e8e8e8" strokeWidth={2} dot={{r:4,fill:'#e8e8e8'}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>MER mensile</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} tickFormatter={v=>`${v.toFixed(1)}×`} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="mer" name="MER" stroke="#22c55e" strokeWidth={2} dot={{r:4,fill:'#22c55e'}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={S.card}>
              <p style={{fontSize:11,color:'#555',textTransform:'uppercase',letterSpacing:'0.07em',marginBottom:14}}>Ratio LTV:CAC mensile</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={data} margin={{top:0,right:8,left:0,bottom:0}}>
                  <CartesianGrid strokeDasharray="2 4" stroke="#1a1a1a" />
                  <XAxis dataKey="month" tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'#555',fontSize:9,fontFamily:'DM Mono'}} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="4 4" strokeOpacity={0.4} label={{value:'3:1',fill:'#22c55e',fontSize:9}} />
                  <Tooltip content={<ChartTip />} />
                  <Line dataKey="ratio" name="Ratio" stroke="#e8e8e8" strokeWidth={2} dot={{r:4}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* ── SIMULATORE ── */}
      {tab==='simulator' && (
        <div className="fade-up">
          <Simulator cfg={cfg} />
        </div>
      )}

      <div style={{textAlign:'center',fontSize:10,color:'#2a2a2a',marginTop:40,fontFamily:'DM Mono'}}>
        STMN Fitness · LTV:CAC Dashboard · {new Date().getFullYear()}
      </div>
    </div>
  )
}
