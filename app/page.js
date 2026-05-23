'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

// ── Helpers ───────────────────────────────────────────────────
const f0  = n => n != null ? `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:0,maximumFractionDigits:0})}` : '—'
const f2  = n => n != null ? `€${Number(n).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
const fn  = n => n != null ? Number(n).toLocaleString('it-IT') : '—'
const fp  = n => n != null ? `${Number(n).toFixed(1)}%` : '—'
const fx  = n => n != null ? `${Number(n).toFixed(2).replace('.',',')}x` : '—'
const fr  = n => n != null ? `${Number(n).toFixed(1).replace('.',',')} : 1` : '— : —'

const RATIO = {
  critical:  { color:'#E74C3C', label:'🔴 CRITICO',    text:'Stai perdendo soldi su ogni cliente' },
  warning:   { color:'#E67E22', label:'🟡 ATTENZIONE', text:'Margini risicati — ottimizza i costi' },
  good:      { color:'#27AE60', label:'🟢 OTTIMO',     text:'Business sostenibile — scala con fiducia' },
  excellent: { color:'#2980B9', label:'🔵 ECCELLENTE', text:'Valuta di investire di più in acquisizione' },
  no_data:   { color:'#888',    label:'⚪ N/D',        text:'Dati insufficienti' },
}

const DEF = { freq:1.69, life:1.57, margin:30, google:0 }
function loadCfg() { try { return { ...DEF, ...JSON.parse(localStorage.getItem('stmn_cfg')||'{}') } } catch { return DEF } }
function saveCfg(c) { try { localStorage.setItem('stmn_cfg', JSON.stringify(c)) } catch {} }

// ── Components ────────────────────────────────────────────────
function KPI({ label, value, sub, color='#E94560', big }) {
  return (
    <div className="bg-accent rounded-xl p-4">
      <p className="text-xs text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`font-black ${big?'text-4xl':'text-2xl'}`} style={{color}}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}
function Card({ children, className='' }) {
  return <div className={`bg-mid rounded-xl p-5 ${className}`}>{children}</div>
}
const Tip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null
  return (
    <div className="bg-dark border border-accent rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gold font-bold mb-1">{label}</p>
      {payload.map((p,i) => <p key={i} style={{color:p.color}}>{p.name}: {typeof p.value==='number'&&p.value>500?f0(p.value):p.value}</p>)}
    </div>
  )
}

// ── Settings Modal ────────────────────────────────────────────
function Settings({ cfg, onSave, onClose }) {
  const [f, setF] = useState({...cfg})
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.75)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div className="bg-mid rounded-2xl p-6 w-96 border border-accent shadow-2xl">
        <div className="flex justify-between mb-5">
          <h2 className="text-gold font-bold text-lg">⚙️ Parametri LTV:CAC</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white">✕</button>
        </div>
        {[
          {k:'freq',  l:'Frequenza acquisti/anno', s:'0.01', u:'x'},
          {k:'life',  l:'Vita media cliente (anni)',s:'0.01', u:'anni'},
          {k:'margin',l:'Margine lordo (%)',        s:'1',    u:'%'},
          {k:'google',l:'Spesa Google Ads periodo (€)',s:'100',u:'€'},
        ].map(({k,l,s,u}) => (
          <div key={k} className="mb-3">
            <label className="text-gray-300 text-sm block mb-1">{l}</label>
            <div className="flex gap-2 items-center">
              <input type="number" step={s} value={f[k]} onChange={e=>setF(x=>({...x,[k]:parseFloat(e.target.value)||0}))}
                className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-right font-bold"/>
              <span className="text-gray-500 text-sm w-10">{u}</span>
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

// ── MAIN ──────────────────────────────────────────────────────
export default function App() {
  const [tab,    setTab]    = useState('dashboard')
  const [data,   setData]   = useState(null)
  const [loading,setLoading]= useState(true)
  const [error,  setError]  = useState(null)
  const [cfg,    setCfg]    = useState(DEF)
  const [showCfg,setShowCfg]= useState(false)
  const [updated,setUpdated]= useState(null)

  useEffect(()=>{ setCfg(loadCfg()) },[])

  const load = useCallback(async (loadProducts=false) => {
    setLoading(true); setError(null)
    try {
      const url = loadProducts ? '/api/metrics?products=1' : '/api/metrics'
      const r = await fetch(url)
      if (!r.ok) throw new Error(`HTTP ${r.status}`)
      const d = await r.json()
      if (d.error) throw new Error(d.error)
      setData(d); setUpdated(new Date())
    } catch(e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(()=>{ load() },[])

  // Calcoli globali
  const margin  = cfg.margin/100
  const freq    = cfg.freq
  const life    = cfg.life
  const aov     = data?.aov || 0
  const ltv     = Math.round(aov*freq*life*margin*100)/100
  const ltvGross= Math.round(aov*freq*life*100)/100
  const meta    = data?.metaSpend || 0
  const google  = cfg.google || 0
  const spend   = meta + google
  const nc      = data?.newCustomers || 0
  const cac     = spend>0&&nc>0 ? Math.round(spend/nc*100)/100 : null
  const ratio   = cac&&ltv>0 ? Math.round(ltv/cac*100)/100 : null
  const rs      = ratio==null?'no_data':ratio<1?'critical':ratio<3?'warning':ratio<=7?'good':'excellent'
  const rc      = RATIO[rs]

  const handleTabChange = (t) => {
    setTab(t)
    if (t === 'products' && (!data?.products?.length)) load(true)
  }

  const TABS = [
    { id:'dashboard', label:'📊 Dashboard' },
    { id:'monthly',   label:'📅 Mensile' },
    { id:'products',  label:'🛍️ Prodotti' },
    { id:'simulator', label:'🎯 Simulatore' },
  ]

  return (
    <div className="min-h-screen p-4 max-w-7xl mx-auto">
      {showCfg && <Settings cfg={cfg} onSave={c=>{setCfg(c);load()}} onClose={()=>setShowCfg(false)} />}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-black text-gold">STMN Fitness</h1>
          <p className="text-gray-500 text-xs">LTV:CAC Dashboard • Dal {data?.startDate||'2026-04-01'} • {updated?updated.toLocaleString('it-IT'):''}</p>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded-full ${data?.sources?.shopify?'bg-green-900 text-green-300':'bg-gray-800 text-gray-500'}`}>🛒 Shopify {data?.sources?.shopify?'✓':'○'}</span>
          <span className={`text-xs px-2 py-1 rounded-full ${data?.sources?.meta?'bg-green-900 text-green-300':'bg-gray-800 text-gray-500'}`}>📘 Meta {data?.sources?.meta?'✓':'○'}</span>
          <button onClick={()=>setShowCfg(true)} className="bg-dark border border-accent text-gray-300 text-xs px-3 py-1.5 rounded-lg hover:bg-accent">⚙️</button>
          <button onClick={load} disabled={loading} className="bg-gold text-white text-xs px-3 py-1.5 rounded-lg disabled:opacity-50">
            {loading?'⏳':'🔄'} Aggiorna
          </button>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 mb-6 bg-dark rounded-xl p-1">
        {TABS.map(t => (
          <button key={t.id} onClick={()=>handleTabChange(t.id)}
            className={`flex-1 text-sm py-2 px-3 rounded-lg transition-all font-medium ${tab===t.id?'bg-accent text-white':'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-900 border border-red-700 rounded-xl p-3 mb-4 text-red-300 text-sm">⚠️ {error}</div>}
      {loading&&!data && <div className="text-center py-20 text-gray-500"><p className="text-4xl mb-3">⏳</p><p>Caricamento dati Shopify + Meta...</p></div>}

      {/* ── TAB 1: DASHBOARD ── */}
      {tab==='dashboard' && (data||!loading) && (
        <>
          <div className="rounded-xl p-8 mb-6 border-2 text-center" style={{borderColor:rc.color,background:`${rc.color}15`}}>
            <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC</p>
            <p className="text-7xl font-black mb-2" style={{color:rc.color}}>{fr(ratio)}</p>
            <p className="text-xl font-bold" style={{color:rc.color}}>{rc.label}</p>
            <p className="text-gray-400 text-sm mt-1">{rc.text}</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            <KPI label="LTV Netto"     value={f2(ltv)}   sub={`Lordo: ${f2(ltvGross)}`} big />
            <KPI label="CAC"           value={f2(cac)}   sub={`${fn(nc)} nuovi clienti`} />
            <KPI label="AOV Reale"     value={f2(aov)}   sub={`${fn(data?.totalOrders)} ordini`} color="#3498DB" />
            <KPI label="Spesa Ads"     value={f0(spend)} sub={`Meta ${f0(meta)} + Google ${f0(google)}`} color="#9B59B6" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <KPI label="Fatturato Netto"    value={f0(data?.totalRevenue)} sub={`Lordo ${f0(data?.totalGross)}`} color="#27AE60" />
            <KPI label="Resi Totali"        value={f0(data?.totalReturns)} sub="dal 01/04/2026" color="#E74C3C" />
            <KPI label="Nuovi Clienti"      value={fn(data?.newCustomers)} sub="primo acquisto nel periodo" color="#1ABC9C" />
            <KPI label="Clienti di Ritorno" value={fn(data?.returningCustomers)} sub="già acquirenti" color="#F39C12" />
          </div>

          {/* Grafico ratio mensile */}
          {data?.monthly?.length > 0 && (() => {
            const chartData = data.monthly.map(m => {
              const mc  = m.metaSpend>0&&m.newCustomers>0 ? Math.round(m.metaSpend/m.newCustomers*100)/100 : null
              const ml  = m.aov>0 ? Math.round(m.aov*freq*life*margin*100)/100 : null
              const mr  = mc&&ml ? Math.round(ml/mc*100)/100 : null
              return { month:m.month, ratio:mr, cac:mc, ltv:ml }
            })
            return (
              <Card>
                <p className="text-sm font-medium text-gray-300 mb-4">Ratio LTV:CAC mensile</p>
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={chartData} margin={{top:5,right:20,left:0,bottom:5}}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                    <XAxis dataKey="month" tick={{fill:'#B0B0C0',fontSize:11}} />
                    <YAxis tick={{fill:'#B0B0C0',fontSize:11}} />
                    <Tooltip content={<Tip />} />
                    <Line dataKey="ratio" name="Ratio" stroke="#E94560" strokeWidth={3} dot={{r:5}} />
                    <Line dataKey="cac"   name="CAC €"  stroke="#9B59B6" strokeWidth={2} dot={{r:4}} />
                  </LineChart>
                </ResponsiveContainer>
              </Card>
            )
          })()}
        </>
      )}

      {/* ── TAB 2: MENSILE ── */}
      {tab==='monthly' && (data||!loading) && (
        <Card>
          <p className="text-sm font-medium text-gray-300 mb-4">📅 Dati mensili dal {data?.startDate||'2026-04-01'}</p>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-accent">
                  {['Mese','Ordini','Fatt. Lordo','Resi','Fatt. Netto','AOV','AOV Nuovi','AOV Ritorno','Nuovi Cl.','Cl. Ritorno','Spesa Meta','CAC','LTV','Ratio'].map(h=>(
                    <th key={h} className="py-2 px-2 text-left text-gold font-medium whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(data?.monthly||[]).map((m, i) => {
                  const ml  = m.aov>0 ? Math.round(m.aov*freq*life*margin*100)/100 : null
                  const mc  = m.metaSpend>0&&m.newCustomers>0 ? Math.round(m.metaSpend/m.newCustomers*100)/100 : null
                  const mr  = mc&&ml ? Math.round(ml/mc*100)/100 : null
                  const col = mr==null?'#888':mr<1?'#E74C3C':mr<3?'#E67E22':mr<=7?'#27AE60':'#2980B9'
                  return (
                    <tr key={m.month} className={i%2===0?'bg-dark':''}>
                      <td className="py-2 px-2 font-bold text-gray-200">{m.month}</td>
                      <td className="py-2 px-2 text-blue-300">{fn(m.orders)}</td>
                      <td className="py-2 px-2 text-gray-400">{f0(m.grossRevenue)}</td>
                      <td className="py-2 px-2 text-red-400">{m.returns>0?`-${f0(m.returns)}`:'—'}</td>
                      <td className="py-2 px-2 text-green-400 font-bold">{f0(m.netRevenue)}</td>
                      <td className="py-2 px-2 text-blue-400">{f2(m.aov)}</td>
                      <td className="py-2 px-2 text-cyan-400">{f2(m.aovNew)}</td>
                      <td className="py-2 px-2 text-indigo-400">{f2(m.aovRet)}</td>
                      <td className="py-2 px-2 text-cyan-300">{fn(m.newCustomers)}</td>
                      <td className="py-2 px-2 text-indigo-300">{fn(m.returningCustomers)}</td>
                      <td className="py-2 px-2 text-purple-400">{f0(m.metaSpend)}</td>
                      <td className="py-2 px-2">{f2(mc)}</td>
                      <td className="py-2 px-2">{f2(ml)}</td>
                      <td className="py-2 px-2 font-bold" style={{color:col}}>{mr?`${mr.toFixed(1)}:1`:'—'}</td>
                    </tr>
                  )
                })}
                {/* TOTALI */}
                {data?.monthly?.length > 0 && (() => {
                  const tot = data.monthly
                  const avgAov = Math.round(tot.reduce((s,m)=>s+m.aov,0)/tot.filter(m=>m.aov>0).length*100)/100
                  const totalNC = tot.reduce((s,m)=>s+m.newCustomers,0)
                  const totalMeta = tot.reduce((s,m)=>s+m.metaSpend,0)
                  const avgCac = totalNC>0 ? Math.round(totalMeta/totalNC*100)/100 : null
                  const avgLtv = avgAov>0 ? Math.round(avgAov*freq*life*margin*100)/100 : null
                  const avgRatio = avgCac&&avgLtv ? Math.round(avgLtv/avgCac*100)/100 : null
                  const col = avgRatio==null?'#888':avgRatio<1?'#E74C3C':avgRatio<3?'#E67E22':avgRatio<=7?'#27AE60':'#2980B9'
                  return (
                    <tr className="border-t-2 border-gold bg-accent font-bold">
                      <td className="py-2 px-2 text-gold">TOTALE</td>
                      <td className="py-2 px-2 text-blue-300">{fn(tot.reduce((s,m)=>s+m.orders,0))}</td>
                      <td className="py-2 px-2 text-gray-300">{f0(tot.reduce((s,m)=>s+m.grossRevenue,0))}</td>
                      <td className="py-2 px-2 text-red-400">-{f0(tot.reduce((s,m)=>s+m.returns,0))}</td>
                      <td className="py-2 px-2 text-green-400">{f0(tot.reduce((s,m)=>s+m.netRevenue,0))}</td>
                      <td className="py-2 px-2 text-blue-400">{f2(avgAov)}</td>
                      <td className="py-2 px-2 text-cyan-400">{f2(Math.round(tot.reduce((s,m)=>s+m.aovNew,0)/tot.filter(m=>m.aovNew>0).length*100)/100)}</td>
                      <td className="py-2 px-2 text-indigo-400">{f2(Math.round(tot.reduce((s,m)=>s+m.aovRet,0)/tot.filter(m=>m.aovRet>0).length*100)/100)}</td>
                      <td className="py-2 px-2 text-cyan-300">{fn(tot.reduce((s,m)=>s+m.newCustomers,0))}</td>
                      <td className="py-2 px-2 text-indigo-300">{fn(tot.reduce((s,m)=>s+m.returningCustomers,0))}</td>
                      <td className="py-2 px-2 text-purple-400">{f0(totalMeta)}</td>
                      <td className="py-2 px-2">{f2(avgCac)}</td>
                      <td className="py-2 px-2">{f2(avgLtv)}</td>
                      <td className="py-2 px-2 font-black text-lg" style={{color:col}}>{avgRatio?`${avgRatio.toFixed(1)}:1`:'—'}</td>
                    </tr>
                  )
                })()}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* ── TAB 3: PRODOTTI ── */}
      {tab==='products' && (data||!loading) && (
        <>
          <Card className="mb-4">
            <p className="text-sm font-medium text-gray-300 mb-4">🛍️ Top 20 prodotti per fatturato (dal {data?.startDate})</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-accent">
                    {['#','Prodotto','Unità Vendute','Fatturato','Prezzo Medio'].map(h=>(
                      <th key={h} className="py-2 px-3 text-left text-gold font-medium">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {(data?.products||[]).map((p,i)=>(
                    <tr key={p.id} className={i%2===0?'bg-dark':''}>
                      <td className="py-2 px-3 text-gray-500 font-bold">{i+1}</td>
                      <td className="py-2 px-3 text-gray-200 max-w-xs truncate">{p.title}</td>
                      <td className="py-2 px-3 text-blue-400">{fn(p.qty)}</td>
                      <td className="py-2 px-3 text-green-400 font-bold">{f0(p.revenue)}</td>
                      <td className="py-2 px-3 text-gray-300">{f2(p.aov)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
          {data?.products?.length > 0 && (
            <Card>
              <p className="text-sm font-medium text-gray-300 mb-4">Top 10 prodotti — fatturato</p>
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={data.products.slice(0,10)} layout="vertical" margin={{top:0,right:30,left:120,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                  <XAxis type="number" tick={{fill:'#B0B0C0',fontSize:10}} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="title" tick={{fill:'#B0B0C0',fontSize:10}} width={110}
                    tickFormatter={v=>v.length>18?v.slice(0,18)+'…':v} />
                  <Tooltip content={<Tip />} />
                  <Bar dataKey="revenue" name="Fatturato €" fill="#E94560" radius={[0,3,3,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}
        </>
      )}

      {/* ── TAB 4: SIMULATORE ── */}
      {tab==='simulator' && (
        <Simulator aov={aov} defaultCfg={cfg} />
      )}

      <p className="text-center text-gray-700 text-xs mt-8">STMN Fitness Dashboard • {new Date().getFullYear()}</p>
    </div>
  )
}

// ── Simulatore ────────────────────────────────────────────────
function Simulator({ aov, defaultCfg }) {
  const [s, setS] = useState({
    aov:    aov || 85,
    freq:   defaultCfg.freq   || 1.69,
    life:   defaultCfg.life   || 1.57,
    margin: defaultCfg.margin || 30,
    cac:    45,
  })
  const set = (k,v) => setS(x=>({...x,[k]:v}))

  const ltv   = Math.round(s.aov * s.freq * s.life * s.margin/100 * 100)/100
  const ratio = s.cac>0 ? Math.round(ltv/s.cac*100)/100 : 0
  const rs    = ratio<1?'critical':ratio<3?'warning':ratio<=7?'good':'excellent'
  const rc    = RATIO[rs]

  // What-if: per arrivare a 3:1
  const cacFor3 = Math.round(ltv/3*100)/100
  const aovFor3 = s.cac>0 ? Math.round(s.cac*3/(s.freq*s.life*s.margin/100)*100)/100 : 0
  const freqFor3 = s.cac>0 ? Math.round(s.cac*3/(s.aov*s.life*s.margin/100)*100)/100 : 0

  const sliders = [
    { k:'aov',    l:'AOV (€)',                 min:30,  max:200, step:1,    u:'€' },
    { k:'freq',   l:'Frequenza acquisti/anno', min:1,   max:5,   step:0.01, u:'x' },
    { k:'life',   l:'Vita media cliente (anni)',min:0.5, max:5,  step:0.01, u:'anni' },
    { k:'margin', l:'Margine lordo (%)',        min:5,   max:80,  step:1,    u:'%' },
    { k:'cac',    l:'CAC (€)',                  min:5,   max:200, step:1,    u:'€' },
  ]

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <p className="text-sm font-medium text-gray-300 mb-4">🎯 Simulatore LTV:CAC</p>
        {sliders.map(({ k,l,min,max,step,u }) => (
          <div key={k} className="mb-4">
            <div className="flex justify-between mb-1">
              <label className="text-gray-400 text-xs">{l}</label>
              <span className="text-gold font-bold text-sm">{s[k]}{u}</span>
            </div>
            <input type="range" min={min} max={max} step={step} value={s[k]}
              onChange={e=>set(k,parseFloat(e.target.value))}
              className="w-full accent-gold" />
          </div>
        ))}
      </Card>

      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-6 border-2 text-center" style={{borderColor:rc.color,background:`${rc.color}15`}}>
          <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC</p>
          <p className="text-6xl font-black" style={{color:rc.color}}>{fr(ratio)}</p>
          <p className="font-bold mt-1" style={{color:rc.color}}>{rc.label}</p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="bg-accent rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">LTV Netto</p>
            <p className="text-2xl font-bold text-green-400">{f2(ltv)}</p>
          </div>
          <div className="bg-accent rounded-xl p-4 text-center">
            <p className="text-xs text-gray-400 mb-1">LTV Lordo</p>
            <p className="text-2xl font-bold text-gray-300">{f2(Math.round(s.aov*s.freq*s.life*100)/100)}</p>
          </div>
        </div>

        <Card>
          <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">🎯 Per raggiungere ratio 3:1</p>
          {[
            { l:'Abbassa CAC a', v:f2(cacFor3),  sub:`da ${f2(s.cac)} (-${Math.round((s.cac-cacFor3)/s.cac*100)}%)` },
            { l:'Alza AOV a',    v:f2(aovFor3),  sub:`da ${f2(s.aov)} (+${Math.round((aovFor3-s.aov)/s.aov*100)}%)` },
            { l:'Alza frequenza a', v:`${freqFor3}x`, sub:`da ${s.freq}x (+${Math.round((freqFor3-s.freq)/s.freq*100)}%)` },
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
