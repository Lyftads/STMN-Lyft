'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'

const f0 = n => n!=null&&n!==0 ? `€${Number(n).toLocaleString('it-IT',{maximumFractionDigits:0})}` : '—'
const f2 = n => n!=null&&n!==0 ? `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
const fn = n => n!=null ? Number(n).toLocaleString('it-IT') : '—'
const fr = n => n!=null ? `${Number(n).toFixed(1).replace('.',',')} : 1` : '— : —'
const fp = n => n!=null ? `${Number(n).toFixed(1)}%` : '—'

const RATIO = {
  critical: {color:'#E74C3C',label:'🔴 CRITICO',   text:'Stai perdendo soldi su ogni cliente'},
  warning:  {color:'#E67E22',label:'🟡 ATTENZIONE',text:'Margini risicati — ottimizza i costi'},
  good:     {color:'#27AE60',label:'🟢 OTTIMO',    text:'Business sostenibile — scala con fiducia'},
  excellent:{color:'#2980B9',label:'🔵 ECCELLENTE',text:'Valuta di investire di più in acquisizione'},
  no_data:  {color:'#888',   label:'⚪ N/D',       text:'Dati insufficienti'},
}

// Mesi disponibili da aprile 2026 in poi
function getAvailableMonths() {
  const months = []
  const now    = new Date()
  let d = new Date('2026-04-01')
  while (d <= now) {
    months.push(`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`)
    d.setMonth(d.getMonth()+1)
  }
  return months
}

const EMPTY_MONTH = { fatturato:0, resi:0, ordini:0, nuoviClienti:0, googleSpend:0 }

function loadData() {
  try {
    return {
      months: JSON.parse(localStorage.getItem('stmn_months')||'{}'),
      cfg:    JSON.parse(localStorage.getItem('stmn_cfg')||'{}'),
    }
  } catch { return { months:{}, cfg:{} } }
}
function saveMonths(m) { try { localStorage.setItem('stmn_months', JSON.stringify(m)) } catch {} }
function saveCfg(c)    { try { localStorage.setItem('stmn_cfg',    JSON.stringify(c)) } catch {} }

const DEF_CFG = { freq:1.69, life:1.57, margin:30 }

// ── Components ────────────────────────────────────────────────
function KPI({label,value,sub,color='#E94560',big}) {
  return (
    <div className="bg-accent rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-black ${big?'text-4xl':'text-2xl'}`} style={{color}}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
function Card({children,className=''}) {
  return <div className={`bg-mid rounded-xl p-5 ${className}`}>{children}</div>
}
const Tip = ({active,payload,label}) => {
  if (!active||!payload?.length) return null
  return (
    <div className="bg-dark border border-accent rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gold font-bold mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{color:p.color}}>{p.name}: {typeof p.value==='number'&&p.value>100?f0(p.value):p.value}</p>)}
    </div>
  )
}

// ── Input mensile ─────────────────────────────────────────────
function MonthInput({month, data, metaSpend, onChange}) {
  const d = data || EMPTY_MONTH
  const net = (d.fatturato||0) - (d.resi||0)
  return (
    <tr className="border-b border-accent">
      <td className="py-2 px-2 font-bold text-gray-200 whitespace-nowrap">{month}</td>
      {[
        {k:'fatturato',    ph:'€0',    color:'text-green-400'},
        {k:'resi',         ph:'€0',    color:'text-red-400'},
        {k:'ordini',       ph:'0',     color:'text-blue-400'},
        {k:'nuoviClienti', ph:'0',     color:'text-cyan-400'},
        {k:'googleSpend',  ph:'€0',    color:'text-yellow-400'},
      ].map(({k,ph,color}) => (
        <td key={k} className="py-1 px-1">
          <input
            type="number" placeholder={ph} value={d[k]||''}
            onChange={e => onChange(month, k, parseFloat(e.target.value)||0)}
            className={`bg-dark border border-accent rounded px-2 py-1 w-24 text-right text-xs font-bold ${color} focus:outline-none focus:border-gold`}
          />
        </td>
      ))}
      <td className="py-2 px-2 text-green-300 font-bold text-xs">{f0(net)}</td>
      <td className="py-2 px-2 text-purple-400 text-xs">{f0(metaSpend)}</td>
    </tr>
  )
}

// ── Settings ──────────────────────────────────────────────────
function Settings({cfg, onSave, onClose}) {
  const [f, setF] = useState({...cfg})
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="bg-mid rounded-2xl p-6 w-88 border border-accent shadow-2xl">
        <div className="flex justify-between mb-5">
          <h2 className="text-gold font-bold text-lg">⚙️ Parametri LTV</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        {[
          {k:'freq',  l:'Frequenza acquisti/anno',  s:'0.01', u:'x'},
          {k:'life',  l:'Vita media cliente (anni)', s:'0.01', u:'anni'},
          {k:'margin',l:'Margine lordo (%)',          s:'1',    u:'%'},
        ].map(({k,l,s,u}) => (
          <div key={k} className="mb-4">
            <label className="text-gray-300 text-sm block mb-1">{l}</label>
            <div className="flex gap-2 items-center">
              <input type="number" step={s} value={f[k]}
                onChange={e=>setF(x=>({...x,[k]:parseFloat(e.target.value)||0}))}
                className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-right font-bold"/>
              <span className="text-gray-500 text-sm w-12">{u}</span>
            </div>
          </div>
        ))}
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 bg-dark border border-accent text-gray-300 rounded-lg py-2">Annulla</button>
          <button onClick={()=>{saveCfg(f);onSave(f);onClose()}} className="flex-1 bg-gold text-white rounded-lg py-2 font-bold">💾 Salva</button>
        </div>
      </div>
    </div>
  )
}

// ── Simulatore ────────────────────────────────────────────────
function Simulator({defaultCfg}) {
  const [s, setS] = useState({aov:85, freq:defaultCfg.freq||1.69, life:defaultCfg.life||1.57, margin:defaultCfg.margin||30, cac:35})
  const set = (k,v) => setS(x=>({...x,[k]:v}))
  const ltv   = Math.round(s.aov*s.freq*s.life*s.margin/100*100)/100
  const ratio = s.cac>0 ? Math.round(ltv/s.cac*100)/100 : 0
  const rs    = ratio<1?'critical':ratio<3?'warning':ratio<=7?'good':'excellent'
  const rc    = RATIO[rs]
  const cacFor3  = Math.round(ltv/3*100)/100
  const aovFor3  = s.cac>0 ? Math.round(s.cac*3/(s.freq*s.life*s.margin/100)*100)/100 : 0
  const freqFor3 = s.cac>0 ? Math.round(s.cac*3/(s.aov*s.life*s.margin/100)*100)/100 : 0
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <p className="text-sm font-medium text-gray-300 mb-5">🎯 Muovi i cursori</p>
        {[
          {k:'aov',   l:'AOV (€)',                  min:30, max:200, step:1,    u:'€'},
          {k:'freq',  l:'Frequenza acquisti/anno',  min:1,  max:5,   step:0.01, u:'x'},
          {k:'life',  l:'Vita media cliente (anni)', min:0.5,max:5,  step:0.01, u:'anni'},
          {k:'margin',l:'Margine lordo (%)',          min:5,  max:80,  step:1,   u:'%'},
          {k:'cac',   l:'CAC (€)',                   min:5,  max:300, step:1,   u:'€'},
        ].map(({k,l,min,max,step,u}) => (
          <div key={k} className="mb-4">
            <div className="flex justify-between mb-1">
              <label className="text-gray-400 text-xs">{l}</label>
              <span className="text-gold font-bold text-sm">{s[k]}{u}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={s[k]}
              onChange={e=>set(k,parseFloat(e.target.value))}
              className="w-full accent-gold"/>
          </div>
        ))}
      </Card>
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-6 border-2 text-center" style={{borderColor:rc.color,background:`${rc.color}15`}}>
          <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC</p>
          <p className="text-7xl font-black mb-1" style={{color:rc.color}}>{fr(ratio)}</p>
          <p className="font-bold" style={{color:rc.color}}>{rc.label}</p>
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
            <div className="bg-dark rounded-lg p-2"><p className="text-gray-500">LTV Netto</p><p className="text-green-400 font-bold text-base">{f2(ltv)}</p></div>
            <div className="bg-dark rounded-lg p-2"><p className="text-gray-500">LTV Lordo</p><p className="text-gray-300 font-bold text-base">{f2(Math.round(s.aov*s.freq*s.life*100)/100)}</p></div>
          </div>
        </div>
        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">Per raggiungere 3:1</p>
          {[
            {l:'Abbassa CAC a',      v:f2(cacFor3),   sub:`da ${f2(s.cac)} (${cacFor3<s.cac?'-':'+'} ${Math.abs(Math.round((s.cac-cacFor3)/s.cac*100))}%)`},
            {l:'Alza AOV a',         v:f2(aovFor3),   sub:`da ${f2(s.aov)} (+${Math.round((aovFor3-s.aov)/s.aov*100)}%)`},
            {l:'Alza frequenza a',   v:`${freqFor3}x`,sub:`da ${s.freq}x (+${Math.round((freqFor3-s.freq)/s.freq*100)}%)`},
          ].map(({l,v,sub})=>(
            <div key={l} className="flex justify-between items-center py-2 border-b border-accent last:border-0">
              <div><p className="text-gray-300 text-sm">{l}</p><p className="text-gray-500 text-xs">{sub}</p></div>
              <p className="text-gold font-bold">{v}</p>
            </div>
          ))}
        </Card>
      </div>
    </div>
  )
}

// ── APP ───────────────────────────────────────────────────────
export default function App() {
  const [tab,    setTab]    = useState('dashboard')
  const [live,   setLive]   = useState(null)
  const [loading,setLoading]= useState(true)
  const [cfg,    setCfg]    = useState(DEF_CFG)
  const [showCfg,setShowCfg]= useState(false)
  const [months, setMonths] = useState({}) // dati manuali
  const [updated,setUpdated]= useState(null)

  const availMonths = getAvailableMonths()

  useEffect(()=>{
    const saved = loadData()
    if (saved.cfg && Object.keys(saved.cfg).length) setCfg({...DEF_CFG,...saved.cfg})
    if (saved.months) setMonths(saved.months)
  },[])

  const fetchLive = useCallback(async ()=>{
    setLoading(true)
    try {
      const r = await fetch('/api/metrics')
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      setLive(d); setUpdated(new Date())
    } catch(e) { console.log(e.message) }
    finally { setLoading(false) }
  },[])

  useEffect(()=>{ fetchLive() },[])

  const updateMonth = (month, key, value) => {
    setMonths(prev => {
      const next = { ...prev, [month]: { ...(prev[month]||EMPTY_MONTH), [key]: value } }
      saveMonths(next)
      return next
    })
  }

  // Calcoli globali dai dati manuali
  const allMonthData = availMonths.map(m => {
    const d = months[m] || EMPTY_MONTH
    const metaSpend = (live?.metaMonthly||[]).find(x=>x.month===m)?.spend || 0
    const net       = (d.fatturato||0) - (d.resi||0)
    const aov       = d.ordini>0 ? net/d.ordini : 0
    const ltv       = aov>0 ? Math.round(aov*cfg.freq*cfg.life*cfg.margin/100*100)/100 : null
    const totalSpend = metaSpend + (d.googleSpend||0)
    const cac       = totalSpend>0&&d.nuoviClienti>0 ? Math.round(totalSpend/d.nuoviClienti*100)/100 : null
    const ratio     = ltv&&cac ? Math.round(ltv/cac*100)/100 : null
    const rs        = ratio==null?'no_data':ratio<1?'critical':ratio<3?'warning':ratio<=7?'good':'excellent'
    return { month:m, ...d, metaSpend, totalSpend, net, aov:Math.round(aov*100)/100, ltv, cac, ratio, ratioColor:RATIO[rs].color }
  })

  // Totali periodo
  const totFatturato  = allMonthData.reduce((s,m)=>s+(m.fatturato||0),0)
  const totResi       = allMonthData.reduce((s,m)=>s+(m.resi||0),0)
  const totNet        = allMonthData.reduce((s,m)=>s+m.net,0)
  const totOrdini     = allMonthData.reduce((s,m)=>s+(m.ordini||0),0)
  const totNC         = allMonthData.reduce((s,m)=>s+(m.nuoviClienti||0),0)
  const totMeta       = allMonthData.reduce((s,m)=>s+m.metaSpend,0)
  const totSpend      = allMonthData.reduce((s,m)=>s+m.totalSpend,0)
  const avgAOV        = totOrdini>0 ? totNet/totOrdini : 0
  const ltvGlobal     = avgAOV>0 ? Math.round(avgAOV*cfg.freq*cfg.life*cfg.margin/100*100)/100 : null
  const cacGlobal     = totSpend>0&&totNC>0 ? Math.round(totSpend/totNC*100)/100 : null
  const ratioGlobal   = ltvGlobal&&cacGlobal ? Math.round(ltvGlobal/cacGlobal*100)/100 : null
  const rsGlobal      = ratioGlobal==null?'no_data':ratioGlobal<1?'critical':ratioGlobal<3?'warning':ratioGlobal<=7?'good':'excellent'
  const rcGlobal      = RATIO[rsGlobal]

  const TABS = [
    {id:'dashboard',label:'📊 Dashboard'},
    {id:'monthly',  label:'📅 Mensile'},
    {id:'simulator',label:'🎯 Simulatore'},
  ]

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      {showCfg && <Settings cfg={cfg} onSave={c=>{setCfg(c)}} onClose={()=>setShowCfg(false)} />}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-gold">STMN Fitness</h1>
          <p className="text-gray-500 text-xs">LTV:CAC Dashboard • Dal 2026-04-01 • {updated?updated.toLocaleString('it-IT'):''}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${live?.sources?.shopify?'bg-green-900 text-green-300':'bg-gray-800 text-gray-500'}`}>🛒 Shopify {live?.sources?.shopify?'✓':'○'}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${live?.sources?.meta?'bg-green-900 text-green-300':'bg-gray-800 text-gray-500'}`}>📘 Meta {live?.sources?.meta?'✓':'○'}</span>
          <button onClick={()=>setShowCfg(true)} className="bg-dark border border-accent text-gray-300 text-xs px-3 py-1.5 rounded-lg hover:bg-accent">⚙️</button>
          <button onClick={fetchLive} disabled={loading} className="bg-gold text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
            {loading?'⏳':'🔄'} Aggiorna
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-6 bg-dark rounded-xl p-1">
        {TABS.map(t=>(
          <button key={t.id} onClick={()=>setTab(t.id)}
            className={`flex-1 text-sm py-2 px-3 rounded-lg transition-all font-medium ${tab===t.id?'bg-accent text-white':'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {/* ── DASHBOARD ── */}
      {tab==='dashboard' && (
        <>
          <div className="rounded-xl p-8 mb-6 border-2 text-center" style={{borderColor:rcGlobal.color,background:`${rcGlobal.color}15`}}>
            <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC — Periodo completo</p>
            <p className="text-7xl font-black mb-2" style={{color:rcGlobal.color}}>{fr(ratioGlobal)}</p>
            <p className="text-xl font-bold" style={{color:rcGlobal.color}}>{rcGlobal.label}</p>
            <p className="text-gray-400 text-sm mt-1">{rcGlobal.text}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <KPI label="LTV Netto"      value={ltvGlobal?f2(ltvGlobal):'—'} sub={`AOV ${f2(Math.round(avgAOV*100)/100)} • ${cfg.freq}x/anno`} big />
            <KPI label="CAC"            value={cacGlobal?f2(cacGlobal):'—'} sub={`${fn(totNC)} nuovi clienti`} />
            <KPI label="AOV Medio"      value={f2(Math.round(avgAOV*100)/100)} sub={`${fn(totOrdini)} ordini totali`} color="#3498DB" />
            <KPI label="Spesa Ads Totale" value={f0(totSpend)} sub={`Meta ${f0(totMeta)}`} color="#9B59B6" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6">
            <KPI label="Fatturato Lordo" value={f0(totFatturato)} sub={`dal 01/04/2026`} color="#27AE60" />
            <KPI label="Resi Totali"     value={f0(totResi)}      sub="da inserimento manuale" color="#E74C3C" />
            <KPI label="Fatturato Netto" value={f0(totNet)}        sub={`Lordo ${f0(totFatturato)} − Resi ${f0(totResi)}`} color="#1ABC9C" />
          </div>

          {/* Grafico Ratio mensile */}
          {allMonthData.some(m=>m.ratio!=null) && (
            <Card className="mb-4">
              <p className="text-sm font-medium text-gray-300 mb-4">Ratio LTV:CAC mensile</p>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={allMonthData} margin={{top:5,right:20,left:0,bottom:5}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                  <XAxis dataKey="month" tick={{fill:'#B0B0C0',fontSize:11}} />
                  <YAxis tick={{fill:'#B0B0C0',fontSize:11}} />
                  <Tooltip content={<Tip />} />
                  <Line dataKey="ratio" name="Ratio" stroke="#E94560" strokeWidth={3} dot={{r:5}} connectNulls />
                  <Line dataKey="cac"   name="CAC €"  stroke="#9B59B6" strokeWidth={2} dot={{r:4}} connectNulls />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* Grafico Fatturato vs Meta */}
          <Card>
            <p className="text-sm font-medium text-gray-300 mb-4">Fatturato Netto vs Spesa Meta</p>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={allMonthData} margin={{top:5,right:20,left:0,bottom:5}}>
                <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                <XAxis dataKey="month" tick={{fill:'#B0B0C0',fontSize:11}} />
                <YAxis tick={{fill:'#B0B0C0',fontSize:11}} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} />
                <Tooltip content={<Tip />} />
                <Bar dataKey="net"      name="Fatt. Netto €" fill="#27AE60" radius={[3,3,0,0]} />
                <Bar dataKey="metaSpend" name="Spesa Meta €"  fill="#E94560" radius={[3,3,0,0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* ── MENSILE ── */}
      {tab==='monthly' && (
        <Card>
          <div className="flex items-center justify-between mb-4">
            <p className="text-sm font-medium text-gray-300">📅 Dati mensili — inserimento manuale</p>
            <p className="text-xs text-gray-500">Spesa Meta aggiornata automaticamente ✅</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b-2 border-gold">
                  <th className="py-2 px-2 text-left text-gold">Mese</th>
                  <th className="py-2 px-2 text-right text-green-400">Fatt. Lordo €</th>
                  <th className="py-2 px-2 text-right text-red-400">Resi €</th>
                  <th className="py-2 px-2 text-right text-blue-400">Ordini #</th>
                  <th className="py-2 px-2 text-right text-cyan-400">Nuovi Clienti #</th>
                  <th className="py-2 px-2 text-right text-yellow-400">Google Ads €</th>
                  <th className="py-2 px-2 text-right text-green-300">Fatt. Netto</th>
                  <th className="py-2 px-2 text-right text-purple-400">Meta Auto</th>
                </tr>
              </thead>
              <tbody>
                {availMonths.map(m => (
                  <MonthInput
                    key={m} month={m}
                    data={months[m]}
                    metaSpend={(live?.metaMonthly||[]).find(x=>x.month===m)?.spend||0}
                    onChange={updateMonth}
                  />
                ))}
                {/* TOTALI */}
                <tr className="border-t-2 border-gold bg-accent font-bold">
                  <td className="py-2 px-2 text-gold">TOTALE</td>
                  <td className="py-2 px-2 text-right text-green-400">{f0(totFatturato)}</td>
                  <td className="py-2 px-2 text-right text-red-400">-{f0(totResi)}</td>
                  <td className="py-2 px-2 text-right text-blue-400">{fn(totOrdini)}</td>
                  <td className="py-2 px-2 text-right text-cyan-400">{fn(totNC)}</td>
                  <td className="py-2 px-2 text-right text-yellow-400">{f0(allMonthData.reduce((s,m)=>s+(m.googleSpend||0),0))}</td>
                  <td className="py-2 px-2 text-right text-green-300">{f0(totNet)}</td>
                  <td className="py-2 px-2 text-right text-purple-400">{f0(totMeta)}</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Tabella risultati calcolati */}
          {allMonthData.some(m=>m.ratio!=null) && (
            <div className="mt-6">
              <p className="text-sm font-medium text-gray-300 mb-3">📊 KPI calcolati</p>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-accent">
                      {['Mese','AOV','Spesa Totale','CAC','LTV','Ratio'].map(h=>(
                        <th key={h} className="py-2 px-3 text-left text-gold font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {allMonthData.map((m,i)=>(
                      <tr key={m.month} className={i%2===0?'bg-dark':''}>
                        <td className="py-2 px-3 font-bold text-gray-200">{m.month}</td>
                        <td className="py-2 px-3 text-blue-400">{m.aov>0?f2(m.aov):'—'}</td>
                        <td className="py-2 px-3 text-purple-400">{m.totalSpend>0?f0(m.totalSpend):'—'}</td>
                        <td className="py-2 px-3">{m.cac?f2(m.cac):'—'}</td>
                        <td className="py-2 px-3">{m.ltv?f2(m.ltv):'—'}</td>
                        <td className="py-2 px-3 font-black text-base" style={{color:m.ratioColor}}>{m.ratio?`${m.ratio.toFixed(1)}:1`:'—'}</td>
                      </tr>
                    ))}
                    <tr className="border-t-2 border-gold bg-accent font-bold">
                      <td className="py-2 px-3 text-gold">MEDIA</td>
                      <td className="py-2 px-3 text-blue-400">{f2(Math.round(avgAOV*100)/100)}</td>
                      <td className="py-2 px-3 text-purple-400">{f0(Math.round(totSpend/availMonths.length))}</td>
                      <td className="py-2 px-3">{f2(cacGlobal)}</td>
                      <td className="py-2 px-3">{f2(ltvGlobal)}</td>
                      <td className="py-2 px-3 font-black text-lg" style={{color:rcGlobal.color}}>{ratioGlobal?`${ratioGlobal.toFixed(1)}:1`:'—'}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Card>
      )}

      {/* ── SIMULATORE ── */}
      {tab==='simulator' && <Simulator defaultCfg={cfg} />}

      <p className="text-center text-gray-700 text-xs mt-8">STMN Fitness Dashboard • {new Date().getFullYear()}</p>
    </div>
  )
}
