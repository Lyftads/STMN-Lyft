'use client'

import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { PieChart, Pie, Cell, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Sparkline from './Sparkline'
import { PlatformBadges } from './PlatformIcon'
import KpiBrainAgent from './KpiBrainAgent'
import TimeframeSelector from './TimeframeSelector'
import DownloadReportButton from './DownloadReportButton'

export default function KPIBrainTab({ data, dataYear, live, cfg, S, shopifyWeeklyAll = [], metaWeeklyAll = [], onRefresh, loading, preset = 'today', setPreset }) {

  const asNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const safeDiv = (a, b) => b > 0 ? a / b : null

  const { current: c, previous: p, label: tfLabel, currentMonths } = useMemo(() => {
    // Compute from live API ranges (works for any preset: today/yesterday/7d/month_X)
    const sr = live?.shopifyRange
    const mr = live?.metaRange
    const spr = live?.shopifyPrevRange
    const mpr = live?.metaPrevRange

    const compute = (s, m) => {
      const fat = asNum(s?.revenue), ord = asNum(s?.orders)
      const nc = asNum(s?.nc), rc = asNum(s?.rc)
      const ses = asNum(s?.sessions)
      const meta = asNum(m?.spend), goog = 0
      const spend = meta + goog
      const impr = asNum(m?.impressions), clicks = asNum(m?.clicks)
      const aov = safeDiv(fat, ord), roas = safeDiv(fat, meta), mer = safeDiv(fat, spend)
      const cac = safeDiv(spend, nc), ctr = impr > 0 ? (clicks/impr)*100 : null
      const cpc = safeDiv(meta, clicks), cpm = impr > 0 ? (meta/impr)*1000 : null
      const repeatRate = nc + rc > 0 ? (rc/(nc+rc))*100 : null
      const ltv = aov ? (aov*cfg.freq*cfg.life*cfg.margin)/100 : null
      return { fat,ord,nc,rc,ses,meta,goog,spend,impr,clicks,aov,roas,mer,cac,ctr,cpc,cpm,repeatRate,ltv }
    }

    const range = live?.kpiBrain?.range
    const prevRange = live?.kpiBrain?.previousRange
    const label = range?.since && range?.until
      ? `${range.since} → ${range.until}${prevRange?.since ? ` vs ${prevRange.since} → ${prevRange.until}` : ''}`
      : '—'

    // For month_YYYY-MM, also collect matching monthly rows (used for sparkline trend)
    const sinceM = range?.since?.slice(0, 7)
    const untilM = range?.until?.slice(0, 7)
    const cur = (sinceM && untilM)
      ? data.filter(m => m.month >= sinceM && m.month <= untilM)
      : []

    return { current: compute(sr, mr), previous: compute(spr, mpr), label, currentMonths: cur }
  }, [data, live, cfg])

  const availableMonths = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)

  const money = n => n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'
  const money2 = n => n > 0 ? `€${n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
  const int0 = n => n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
  const pct = n => n != null ? `${n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%` : '—'
  const ratio = n => n != null ? `${n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}x` : '—'
  const shortMoney = n => { const v=Number(n||0); if(v>=1e6)return`€${(v/1e6).toFixed(1)}M`; if(v>=1e3)return`€${(v/1e3).toFixed(1)}K`; return money(v) }
  const shortNum = n => { const v=Number(n||0); if(v>=1e6)return`${(v/1e6).toFixed(2)}M`; if(v>=1e3)return`${(v/1e3).toFixed(1)}K`; return int0(v) }

  const DeltaBadge = ({ curr, prev, isLower = false }) => {
    if (prev == null || prev === 0 || curr == null) return null
    const d = ((curr - prev) / prev) * 100
    if (Math.abs(d) < 0.1) return null
    const up = d > 0, good = isLower ? !up : up
    return <span style={{fontSize:11,fontWeight:800,padding:'3px 8px',borderRadius:6,background:good?'#22c55e20':'#ef444420',color:good?'#22c55e':'#ef4444'}}>{up?'+':''}{d.toFixed(1)}%</span>
  }

  // Sparkline data from full data array (all months for trend)
  const sparkData = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
  const sparkFor = key => sparkData.map(m => {
    if (key === 'aov') return m.ordini > 0 ? m.fatturato / m.ordini : 0
    if (key === 'repeatRate') return m.nc + m.rc > 0 ? (m.rc / (m.nc + m.rc)) * 100 : 0
    if (key === 'ltv') { const aov = m.ordini > 0 ? m.fatturato / m.ordini : 0; return aov > 0 ? (aov * cfg.freq * cfg.life * cfg.margin) / 100 : 0 }
    if (key === 'roas') return m.metaSpend > 0 ? m.fatturato / m.metaSpend : 0
    if (key === 'mer') return m.totalSpend > 0 ? m.fatturato / m.totalSpend : 0
    if (key === 'ctr') return m.impressions > 0 ? (m.linkClicks / m.impressions) * 100 : 0
    if (key === 'cpc') return m.linkClicks > 0 ? m.metaSpend / m.linkClicks : 0
    if (key === 'cpm') return m.impressions > 0 ? (m.metaSpend / m.impressions) * 1000 : 0
    return m[key] || 0
  })

  const metrics = [
    { group:'Shopify', title:'Fatturato', value:shortMoney(c.fat), color:'#22c55e', sparkKey:'fatturato', curr:c.fat, prev:p.fat },
    { group:'Shopify', title:'Ordini', value:int0(c.ord), color:'#22c55e', sparkKey:'ordini', curr:c.ord, prev:p.ord },
    { group:'Shopify', title:'AOV', value:money2(c.aov), color:'#f59e0b', sparkKey:'aov', curr:c.aov, prev:p.aov },
    { group:'Shopify', title:'Nuovi Clienti', value:int0(c.nc), color:'#06b6d4', sparkKey:'nc', curr:c.nc, prev:p.nc },
    { group:'Shopify', title:'Clienti Ritorno', value:int0(c.rc), color:'#a78bfa', sparkKey:'rc', curr:c.rc, prev:p.rc },
    { group:'Shopify', title:'Repeat Rate', value:pct(c.repeatRate), color:'#0ea5e9', sparkKey:'repeatRate', curr:c.repeatRate, prev:p.repeatRate },
    { group:'Shopify', title:'LTV', value:money2(c.ltv), color:'#0ea5e9', sparkKey:'ltv' },
    { group:'Meta Ads', title:'Spend', value:shortMoney(c.meta), color:'#3b82f6', sparkKey:'metaSpend', curr:c.meta, prev:p.meta },
    { group:'Meta Ads', title:'ROAS', value:ratio(c.roas), color:'#22c55e', sparkKey:'roas', curr:c.roas, prev:p.roas },
    { group:'Meta Ads', title:'MER', value:ratio(c.mer), color:'#a855f7', sparkKey:'mer', curr:c.mer, prev:p.mer },
    { group:'Meta Ads', title:'CTR', value:pct(c.ctr), color:'#3b82f6', sparkKey:'ctr', curr:c.ctr, prev:p.ctr },
    { group:'Meta Ads', title:'CPC', value:money2(c.cpc), color:'#ef4444', sparkKey:'cpc', curr:c.cpc, prev:p.cpc, lower:true },
    { group:'Meta Ads', title:'CPM', value:money2(c.cpm), color:'#f59e0b', sparkKey:'cpm', curr:c.cpm, prev:p.cpm, lower:true },
    { group:'Meta Ads', title:'Impressions', value:shortNum(c.impr), color:'#3b82f6', sparkKey:'impressions', curr:c.impr, prev:p.impr },
    { group:'Meta Ads', title:'Clicks', value:shortNum(c.clicks), color:'#3b82f6', sparkKey:'linkClicks', curr:c.clicks, prev:p.clicks },
  ]

  // ── Top products: match images from store products.json ──
  const [productImages, setProductImages] = useState({})
  useEffect(() => {
    fetch('/api/product-images').then(r => r.json()).then(imgs => {
      if (imgs && typeof imgs === 'object') setProductImages(imgs)
    }).catch(() => {})
  }, [])

  // ── Paesi di fatturazione (con delta vs periodo precedente) ──
  const kpiRange = live?.kpiBrain?.range
  const kpiPrevRange = live?.kpiBrain?.previousRange
  const [countries, setCountries] = useState([])
  const [countriesPrev, setCountriesPrev] = useState([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  useEffect(() => {
    const since = kpiRange?.since
    const until = kpiRange?.until
    if (!since || !until) return
    let cancelled = false
    setCountriesLoading(true)
    setCountriesError(null)

    // Fetch current period (sempre) + previous period (solo se range esiste)
    const fetchCurrent = fetch(`/api/shopify-countries?since=${since}&until=${until}`).then(r => r.json())
    const fetchPrev = kpiPrevRange?.since && kpiPrevRange?.until
      ? fetch(`/api/shopify-countries?since=${kpiPrevRange.since}&until=${kpiPrevRange.until}`).then(r => r.json())
      : Promise.resolve({ countries: [] })

    Promise.all([fetchCurrent, fetchPrev])
      .then(([curr, prev]) => {
        if (cancelled) return
        if (curr?.error) { setCountriesError(curr.error); setCountries([]); setCountriesPrev([]); return }
        setCountries(Array.isArray(curr?.countries) ? curr.countries : [])
        setCountriesPrev(Array.isArray(prev?.countries) ? prev.countries : [])
      })
      .catch(e => { if (!cancelled) setCountriesError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setCountriesLoading(false) })
    return () => { cancelled = true }
  }, [kpiRange?.since, kpiRange?.until, kpiPrevRange?.since, kpiPrevRange?.until])

  // Indice del periodo precedente per delta lookup
  const prevByKey = useMemo(() => {
    const m = new Map()
    for (const r of countriesPrev) {
      const key = r.country_code || r.country
      m.set(key, {
        revenue: r.revenue || 0,
        orders: r.orders || 0,
        ncOrders: r.ncOrders || 0,
        rcOrders: r.rcOrders || 0,
        ncRevenue: r.ncRevenue || 0,
        rcRevenue: r.rcRevenue || 0,
      })
    }
    return m
  }, [countriesPrev])

  // Format helpers per i delta NC/RC
  const fmtDeltaPct = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 'NEW' : null
    const d = ((curr - prev) / prev) * 100
    return `${d >= 0 ? '+' : ''}${d.toFixed(1)}%`
  }
  const fmtDeltaEur = (curr, prev) => {
    const d = curr - prev
    if (d === 0) return '€0'
    const sign = d > 0 ? '+' : '-'
    return `${sign}€${Math.round(Math.abs(d)).toLocaleString('it-IT')}`
  }
  const deltaColor = (curr, prev) => {
    if (prev === 0 && curr > 0) return '#a5b4fc' // NEW
    if (curr > prev) return '#86efac'
    if (curr < prev) return '#fca5a5'
    return 'var(--text3)'
  }

  const countryFlag = code => {
    if (!code || code.length !== 2) return '🌐'
    // Converti country code in flag emoji via regional indicator symbols
    const A = 0x1F1E6
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => A + c.charCodeAt(0) - 65))
  }
  const countriesTotal = countries.reduce((s, r) => s + (r.revenue || 0), 0)

  const findImage = (name) => {
    if (!name) return null
    return productImages[name] || productImages[name.toLowerCase()] ||
      productImages[name.replace(/["'"]/g,'').trim()] ||
      productImages[name.replace(/["'"]/g,'').trim().toLowerCase()] ||
      // Partial match: find a key that contains the product name
      Object.entries(productImages).find(([k]) => k.toLowerCase().includes(name.toLowerCase().slice(0,20)))?.[1] ||
      null
  }

  const topProducts = (live?.shopifyTopProducts || []).map(r => {
    const label = r.label || r.name || r.title || r.product_title || '—'
    return {
      label,
      value: asNum(r.value ?? r.revenue ?? r.total_sales),
      orders: asNum(r.orders),
      image: r.image || r.imageUrl || findImage(label),
    }
  }).filter(r => r.value > 0)

  // ── Day breakdown ──
  const dayNameIT = d => {
    const map = { sun:'Domenica',sunday:'Domenica',mon:'Lunedì',monday:'Lunedì',tue:'Martedì',tuesday:'Martedì',wed:'Mercoledì',wednesday:'Mercoledì',thu:'Giovedì',thursday:'Giovedì',fri:'Venerdì',friday:'Venerdì',sat:'Sabato',saturday:'Sabato',
      domenica:'Domenica',lunedi:'Lunedì',lunedì:'Lunedì',martedi:'Martedì',martedì:'Martedì',mercoledi:'Mercoledì',mercoledì:'Mercoledì',giovedi:'Giovedì',giovedì:'Giovedì',venerdi:'Venerdì',venerdì:'Venerdì',sabato:'Sabato' }
    return map[String(d||'').toLowerCase()] || d
  }
  const dayBreakdown = (live?.shopifyDayBreakdown || []).map(r => ({
    label: dayNameIT(r.day || r.label),
    value: asNum(r.value ?? r.revenue ?? r.sales),
    orders: asNum(r.orders),
  })).filter(r => r.value > 0 || r.orders > 0)

  const marketingSources = [
    { label: 'Meta Ads', value: c.meta },
    { label: 'Google Ads', value: c.goog },
  ].filter(r => r.value > 0)

  const customerBreakdown = [
    { label: 'Nuovi Clienti', value: c.nc },
    { label: 'Clienti di Ritorno', value: c.rc },
  ].filter(r => r.value > 0)

  const insights = useMemo(() => {
    const items = []
    if (c.roas != null) {
      if (c.roas >= 3) items.push({sev:'positive',text:`ROAS Meta a ${ratio(c.roas)}: rendimento eccellente, le campagne generano un ritorno triplo.`})
      else if (c.roas >= 1.5) items.push({sev:'neutral',text:`ROAS Meta a ${ratio(c.roas)}: profittabile ma sotto 3x. Ottimizzare creative e targeting.`})
      else if (c.roas < 1) items.push({sev:'warning',text:`ROAS Meta a ${ratio(c.roas)}: sotto break-even, si perde denaro sulle campagne.`})
    }
    if (c.aov && p.aov) {
      const d = ((c.aov-p.aov)/p.aov)*100
      if (d > 10) items.push({sev:'positive',text:`AOV in crescita del ${d.toFixed(1)}% (${money2(c.aov)} vs ${money2(p.aov)}).`})
      if (d < -10) items.push({sev:'warning',text:`AOV in calo del ${Math.abs(d).toFixed(1)}% (${money2(c.aov)} vs ${money2(p.aov)}). Verificare prodotti e upsell.`})
    }
    if (c.repeatRate != null && c.repeatRate < 15) items.push({sev:'warning',text:`Repeat Rate al ${pct(c.repeatRate)}: pochi clienti ritornano. Valutare programmi fedeltà e email post-acquisto.`})
    if (c.repeatRate != null && c.repeatRate >= 25) items.push({sev:'positive',text:`Repeat Rate al ${pct(c.repeatRate)}: ottima fidelizzazione.`})
    if (c.ctr != null && c.ctr < 1) items.push({sev:'warning',text:`CTR Meta a ${pct(c.ctr)}: le creatività non attraggono click. Rinnovare copy e visual.`})
    if (c.fat > 0 && p.fat > 0) {
      const d = ((c.fat-p.fat)/p.fat)*100
      if (d > 15) items.push({sev:'positive',text:`Revenue in crescita del ${d.toFixed(1)}% vs periodo precedente.`})
      if (d < -15) items.push({sev:'warning',text:`Revenue in calo del ${Math.abs(d).toFixed(1)}% vs periodo precedente. Analizzare cause.`})
    }
    return items
  }, [c, p])

  const card = { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:16, padding:20 }
  const panel = { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:18, padding:22 }
  const sevColor = s => ({positive:'#22c55e',warning:'#f59e0b',neutral:'#8b5cf6'}[s]||'#8b8aa0')

  const groupSources = (g) => {
    if (g === 'Shopify') return ['shopify']
    if (g === 'Meta Ads') return ['meta']
    if (g === 'Google Ads') return ['google']
    if (g === 'Klaviyo') return ['klaviyo']
    return []
  }

  const MetricCard = ({ item }) => (
    <div className="glass-card" style={card}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:10}}>
        <div style={{color:'var(--text2)',fontSize:13}}>{item.title}</div>
        <PlatformBadges sources={groupSources(item.group)} size={16} />
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
        <div style={{color:'#fff',fontSize:28,fontWeight:900,letterSpacing:'-0.03em'}}>{item.value}</div>
        {item.sparkKey && <Sparkline data={sparkFor(item.sparkKey)} color={item.color} width={80} height={32} />}
      </div>
      <div style={{marginTop:10,display:'flex',alignItems:'center',gap:8}}>
        <DeltaBadge curr={item.curr} prev={item.prev} isLower={item.lower} />
      </div>
    </div>
  )

  const ProgressBar = ({ rows, color, format = money }) => {
    const max = Math.max(...rows.map(r => Number(r.value || 0)), 1)
    return rows.length > 0 ? rows.map(row => (
      <div key={row.label}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:7,fontSize:12}}>
          <span style={{color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.label}</span>
          <span style={{color:'var(--text2)',fontWeight:800}}>{format(row.value)}</span>
        </div>
        <div style={{height:8,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
          <div style={{width:`${Math.max(4,(row.value/max)*100)}%`,height:'100%',background:color,borderRadius:999}} />
        </div>
      </div>
    )) : <div style={{color:'var(--text3)',fontSize:13}}>Nessun dato.</div>
  }

  return (
    <div>
      {/* Timeframe */}
      <div style={{...panel, marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
        {setPreset && <TimeframeSelector value={preset} onChange={setPreset} disabled={loading} />}
        {onRefresh && (
          <button onClick={onRefresh} disabled={loading} className="btn-glass" style={{
            marginLeft:'auto', display:'flex', alignItems:'center', gap:6,
            cursor:loading?'wait':'pointer', opacity:loading?0.5:1,
          }}><span style={{animation:loading?'spin 1s linear infinite':'none'}}>↻</span>{loading?'Aggiorno…':'Aggiorna'}</button>
        )}
        <span style={{fontSize:11,color:'var(--text3)'}}>{tfLabel}</span>
        <DownloadReportButton tab="KPI Brain" preset={preset} style={{ marginLeft: onRefresh ? 0 : 'auto' }} />
      </div>

      {/* Key Metrics */}
      <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:22,padding:24,marginBottom:24}}>
        <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:6}}>Key Metrics</div>
        <div style={{fontSize:12,color:'var(--text3)',marginBottom:20}}>Shopify + Meta Ads · {tfLabel}</div>
        <div style={{fontSize:13,color:'#fff',fontWeight:900,marginBottom:12}}>Shopify</div>
        <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:14,marginBottom:20}}>
          {metrics.filter(m=>m.group==='Shopify').map(item=><MetricCard key={item.title} item={item} />)}
        </div>
        <div style={{fontSize:13,color:'#fff',fontWeight:900,marginBottom:12}}>Meta Ads</div>
        <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14}}>
          {metrics.filter(m=>m.group==='Meta Ads').map(item=><MetricCard key={item.title} item={item} />)}
        </div>
      </div>


      {/* Breakdowns */}
      <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:22,padding:24,marginBottom:24}}>
        <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:18}}>Breakdowns</div>

        {/* Row 1: Top Products + Day Breakdown (affiancati) */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={panel}>
            <div style={{fontSize:14,color:'var(--text)',fontWeight:800,marginBottom:18}}>Top 10 prodotti per revenue</div>
            <div style={{display:'grid',gap:10}}>
              {topProducts.length > 0 ? topProducts.slice(0,10).map((row,i) => {
                const max = topProducts[0]?.value || 1
                return (
                  <div key={row.label}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      {row.image ? <img src={row.image} alt="" style={{width:36,height:36,borderRadius:8,objectFit:'cover',flexShrink:0,border:'1px solid var(--border)'}} onError={e=>{e.target.style.display='none'}} />
                        : <div style={{width:36,height:36,borderRadius:8,background:'var(--surface)',display:'grid',placeItems:'center',fontSize:12,color:'var(--text3)',flexShrink:0}}>{i+1}</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:12,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.label}</div>
                        <div style={{fontSize:11,color:'var(--text2)',fontWeight:800}}>{money(row.value)}{row.orders?` · ${int0(row.orders)} ordini`:''}</div>
                      </div>
                    </div>
                    <div style={{height:6,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
                      <div style={{width:`${Math.max(4,(row.value/max)*100)}%`,height:'100%',background:'#ec4899',borderRadius:999}} />
                    </div>
                  </div>
                )
              }) : <div style={{color:'var(--text3)',fontSize:13}}>Nessun dato disponibile.</div>}
            </div>
          </div>

          {/* Day breakdown (affiancato) */}
          <div style={panel}>
            <div style={{fontSize:14,color:'var(--text)',fontWeight:800,marginBottom:18}}>Vendite per giorno della settimana</div>
            <div style={{display:'grid',gap:10}}>
              {dayBreakdown.length > 0 ? dayBreakdown.map(row => {
                const max = Math.max(...dayBreakdown.map(r => r.value), 1)
                return (
                  <div key={row.label}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:7,fontSize:12}}>
                      <span style={{color:'var(--text)'}}>{row.label}</span>
                      <span style={{color:'var(--text2)',fontWeight:800}}>{money(row.value)}{row.orders ? ` · ${int0(row.orders)} ordini` : ''}</span>
                    </div>
                    <div style={{height:8,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
                      <div style={{width:`${Math.max(4,(row.value/max)*100)}%`,height:'100%',background:'#14b8a6',borderRadius:999}} />
                    </div>
                  </div>
                )
              }) : <div style={{color:'var(--text3)',fontSize:13}}>Nessun dato.</div>}
            </div>
          </div>
        </div>

        {/* Row 2: Spesa marketing + New vs Returning (sotto) */}
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div style={panel}>
            <div style={{fontSize:14,color:'var(--text)',fontWeight:800,marginBottom:18}}>Spesa marketing per canale</div>
            <div style={{display:'grid',gap:14}}><ProgressBar rows={marketingSources} color="#3b82f6" /></div>
          </div>

          <div style={panel}>
            <div style={{fontSize:14,color:'var(--text)',fontWeight:800,marginBottom:18}}>New vs Returning</div>
            <div style={{display:'grid',gap:14}}><ProgressBar rows={customerBreakdown} color="#f97316" format={int0} /></div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      {topProducts.length > 0 && (
        <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:22,padding:24,marginBottom:24}}>
          <div style={{fontSize:18,fontWeight:900,color:'#fff',marginBottom:18}}>Top Performers</div>
          <div className="stagger-zoom" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:16}}>
            {topProducts.slice(0,4).map((item,i) => (
              <div key={item.label} className="glass-card" style={{...card,display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:28,height:28,borderRadius:999,background:'#ffffff22',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,flexShrink:0}}>{i+1}</div>
                  {item.image && <img src={item.image} alt="" style={{width:40,height:40,borderRadius:10,objectFit:'cover',border:'1px solid var(--border)'}} onError={e=>{e.target.style.display='none'}} />}
                </div>
                <div style={{color:'var(--text)',fontWeight:900,fontSize:14,lineHeight:1.3}}>{item.label}</div>
                <div>
                  <div style={{color:'var(--text2)',fontSize:11,marginBottom:4}}>Revenue</div>
                  <div style={{color:'var(--text)',fontWeight:900,fontSize:22}}>{money(item.value)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Paesi di fatturazione (black glass 3D futuristic) ──────── */}
      <div
        style={{
          position:'relative',
          background:'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)',
          backdropFilter:'blur(40px) saturate(2.2)',
          WebkitBackdropFilter:'blur(40px) saturate(2.2)',
          borderRadius:22,
          overflow:'hidden',
          border:'1.5px solid rgba(255,255,255,0.06)',
          borderTopColor:'rgba(255,255,255,0.12)',
          borderBottomColor:'rgba(0,0,0,0.65)',
          boxShadow:'0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
          animation:'sim-pulse 6s ease-in-out infinite',
          transition:'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.animationPlayState = 'paused'
          e.currentTarget.style.transform = 'translateY(-6px) scale(1.005)'
          e.currentTarget.style.boxShadow = '0 50px 100px rgba(0,0,0,0.85), 0 20px 40px rgba(0,0,0,0.6), 0 0 80px rgba(14,165,233,0.18), inset 0 1.5px 0 rgba(255,255,255,0.08), inset 0 -1.5px 0 rgba(0,0,0,0.3)'
          e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.animationPlayState = 'running'
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = '0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)'
          e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
        }}
      >
        {/* shine top edge */}
        <div style={{position:'absolute',top:0,left:'8%',right:'8%',height:1.5,background:'linear-gradient(90deg, transparent, #0ea5e9aa, transparent)',filter:'blur(0.3px)',opacity:0.85,animation:'cr-shine 4s ease-in-out infinite',zIndex:3,pointerEvents:'none'}} />
        {/* scan sweep */}
        <div style={{position:'absolute',top:0,bottom:0,left:'-50%',width:'40%',background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',animation:'sim-scan 9s ease-in-out infinite',pointerEvents:'none',zIndex:1}} />

        <div style={{padding:24,position:'relative',zIndex:2}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,marginBottom:18,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{
                width:42,height:42,borderRadius:11,
                background:'linear-gradient(135deg,#0ea5e9,#1e3a8a)',
                display:'grid',placeItems:'center',
                fontSize:20,color:'#fff',
                boxShadow:'0 0 24px rgba(14,165,233,0.45), inset 0 1px 0 rgba(255,255,255,0.18)',
              }}>🌍</div>
              <div>
                <div style={{fontSize:18,fontWeight:900,color:'#fff',letterSpacing:'-0.01em'}}>Paesi di fatturazione</div>
                <div style={{color:'var(--text3)',fontSize:12,marginTop:2}}>
                  {countriesLoading
                    ? 'Caricamento ordini Shopify…'
                    : countriesError
                      ? <span style={{color:'#fca5a5'}}>{countriesError}</span>
                      : `${countries.length} ${countries.length === 1 ? 'paese' : 'paesi'} nel periodo · ${tfLabel}`}
                </div>
              </div>
            </div>
          </div>

          {countriesLoading && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px',gap:12,color:'var(--text3)'}}>
              <div style={{width:24,height:24,border:'3px solid rgba(255,255,255,0.1)',borderTopColor:'#0ea5e9',borderRadius:999,animation:'spin 1s linear infinite'}} />
              <div style={{fontSize:12,fontWeight:700,letterSpacing:'0.08em',textTransform:'uppercase'}}>Caricamento…</div>
            </div>
          )}

          {(!countriesLoading && !countriesError && countries.length === 0) && (
            <div style={{padding:18,border:'1px solid #f59e0b44',background:'#f59e0b10',borderRadius:12,color:'#fcd34d',fontWeight:700,fontSize:13}}>
              Nessun ordine nel periodo selezionato.
            </div>
          )}

          {!countriesLoading && countries.length > 0 && (
            <div style={{display:'grid',gap:8}}>
              {countries.map((row, i) => {
                const pct = countriesTotal > 0 ? (row.revenue / countriesTotal) * 100 : 0
                const prev = prevByKey.get(row.country_code || row.country) || { revenue: 0, orders: 0 }
                const deltaRev = row.revenue - prev.revenue
                const deltaPct = prev.revenue > 0 ? (deltaRev / prev.revenue) * 100 : null
                const isNew = prev.revenue === 0 && row.revenue > 0
                const up = deltaRev > 0
                const topDeltaColor = isNew ? '#a5b4fc' : up ? '#86efac' : deltaRev < 0 ? '#fca5a5' : 'var(--text3)'
                const topDeltaBg = isNew ? 'rgba(99,102,241,0.12)' : up ? 'rgba(34,197,94,0.10)' : deltaRev < 0 ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)'
                const topDeltaBorder = isNew ? 'rgba(99,102,241,0.30)' : up ? 'rgba(34,197,94,0.25)' : deltaRev < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'
                const hasSegmentData = row.ncOrders > 0 || row.rcOrders > 0 || prev.ncOrders > 0 || prev.rcOrders > 0
                return (
                  <div
                    key={`${row.country_code || row.country}-${i}`}
                    onClick={() => setSelectedCountry({ row, prev, range: kpiRange, prevRange: kpiPrevRange })}
                    style={{
                      position:'relative',
                      display:'flex',
                      flexDirection:'column',
                      gap:14,
                      padding:'14px 16px',
                      borderRadius:14,
                      background:'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.18))',
                      border:'1px solid rgba(255,255,255,0.05)',
                      borderTopColor:'rgba(255,255,255,0.10)',
                      borderBottomColor:'rgba(0,0,0,0.4)',
                      boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
                      animation:`fadeUp 0.4s ease ${i*0.04}s both`,
                      transition:'transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease, box-shadow 0.25s ease',
                      cursor:'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.22)'
                      e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 20px rgba(0,0,0,0.4), 0 0 32px rgba(14,165,233,0.18)'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.10)'
                      e.currentTarget.style.boxShadow = 'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)'
                    }}
                  >
                    {/* TOP ROW */}
                    <div style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto auto auto',alignItems:'center',gap:14}}>
                      <div style={{fontSize:28,lineHeight:1,filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'}}>{countryFlag(row.country_code)}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:14,fontWeight:800,color:'#fff',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.country}</div>
                        <div style={{position:'relative',height:5,marginTop:6,borderRadius:999,background:'rgba(255,255,255,0.04)',overflow:'hidden'}}>
                          <div style={{position:'absolute',inset:0,width:`${Math.max(2,Math.min(100,pct))}%`,background:'linear-gradient(90deg,#0ea5e9,#1e3a8a)',borderRadius:999,boxShadow:'0 0 12px rgba(14,165,233,0.55)',transition:'width 0.6s cubic-bezier(0.16,1,0.3,1)'}} />
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:14,fontWeight:900,color:'#fff',letterSpacing:'-0.01em'}}>{money(row.revenue)}</div>
                        <div style={{fontSize:10.5,color:'#0ea5e9',fontWeight:800,letterSpacing:'0.06em',textTransform:'uppercase',marginTop:2}}>{pct.toFixed(1)}%</div>
                      </div>
                      <div style={{
                        textAlign:'right',
                        minWidth:96,
                        padding:'6px 10px',
                        borderRadius:9,
                        background:topDeltaBg,
                        border:`1px solid ${topDeltaBorder}`,
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)',
                      }}>
                        <div style={{fontSize:12,fontWeight:900,color:topDeltaColor,display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end',lineHeight:1.1}}>
                          {isNew ? 'NEW' : (
                            <>
                              <span style={{fontSize:10,opacity:0.85}}>{up ? '▲' : deltaRev < 0 ? '▼' : '–'}</span>
                              {deltaPct != null ? `${deltaPct >= 0 ? '+' : ''}${deltaPct.toFixed(1)}%` : '—'}
                            </>
                          )}
                        </div>
                        <div style={{fontSize:10,fontWeight:800,color:topDeltaColor,opacity:0.85,marginTop:2}}>
                          {isNew ? money(row.revenue) : (deltaRev !== 0 ? (deltaRev > 0 ? `+€${Math.round(deltaRev).toLocaleString('it-IT')}` : `-€${Math.round(Math.abs(deltaRev)).toLocaleString('it-IT')}`) : '€0')}
                        </div>
                        <div style={{fontSize:8.5,color:topDeltaColor,fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',opacity:0.6,marginTop:1}}>vs precedente</div>
                      </div>
                      <div style={{
                        textAlign:'right',
                        minWidth:68,
                        padding:'6px 12px',
                        borderRadius:9,
                        background:'rgba(34,197,94,0.12)',
                        border:'1px solid rgba(34,197,94,0.28)',
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}>
                        <div style={{fontSize:13,fontWeight:900,color:'#86efac'}}>{int0(row.orders)}</div>
                        <div style={{fontSize:9,color:'#86efac',fontWeight:700,letterSpacing:'0.06em',textTransform:'uppercase',opacity:0.75,marginTop:1}}>ordini</div>
                      </div>
                      <div style={{
                        width:32,height:32,borderRadius:8,
                        display:'grid',placeItems:'center',
                        background:'rgba(255,255,255,0.04)',
                        border:'1px solid rgba(255,255,255,0.08)',
                        color:'#0ea5e9',fontSize:14,fontWeight:900,
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}>↗</div>
                    </div>

                    {/* BOTTOM: card per ogni dato NC + RC */}
                    {hasSegmentData && (
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        <SegmentBlock
                          title="Nuovi clienti"
                          accent={{ text:'#67e8f9', bg:'rgba(6,182,212,0.10)', border:'rgba(6,182,212,0.30)' }}
                          ordersCurr={row.ncOrders}
                          ordersPrev={prev.ncOrders}
                          revCurr={row.ncRevenue}
                          revPrev={prev.ncRevenue}
                          money={money}
                          int0={int0}
                          fmtDeltaPct={fmtDeltaPct}
                          fmtDeltaEur={fmtDeltaEur}
                          deltaColor={deltaColor}
                        />
                        <SegmentBlock
                          title="Clienti di ritorno"
                          accent={{ text:'#d8b4fe', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.30)' }}
                          ordersCurr={row.rcOrders}
                          ordersPrev={prev.rcOrders}
                          revCurr={row.rcRevenue}
                          revPrev={prev.rcRevenue}
                          money={money}
                          int0={int0}
                          fmtDeltaPct={fmtDeltaPct}
                          fmtDeltaEur={fmtDeltaEur}
                          deltaColor={deltaColor}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Insights */}
      <div className="glass-section reveal-zoom" style={{marginTop:18,background:'var(--glass)',border:'1px solid var(--border)',borderRadius:22,padding:24}}>
        <div style={{display:'flex',alignItems:'center',gap:12,marginBottom:18}}>
          <div style={{width:36,height:36,borderRadius:10,background:'#06b6d422',color:'#06b6d4',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:900,fontSize:16}}>✦</div>
          <div>
            <div style={{fontSize:18,fontWeight:900,color:'var(--text)'}}>Insight & Riepilogo</div>
            <div style={{color:'var(--text2)',fontSize:12}}>{insights.length} osservazioni sul periodo</div>
          </div>
        </div>
        <div style={{display:'grid',gap:12}}>
          {insights.length > 0 ? insights.map((item,i) => (
            <div key={i} style={{padding:16,borderRadius:12,background:'var(--glass)',borderLeft:`3px solid ${sevColor(item.sev)}`}}>
              <div style={{color:'var(--text)',fontSize:13,lineHeight:1.6}}>{item.text}</div>
            </div>
          )) : (
            <div style={{border:'1px solid #22c55e44',background:'#22c55e10',borderRadius:12,padding:18,color:'#22c55e',fontWeight:800}}>
              Nessuna criticità rilevata.
            </div>
          )}
        </div>
      </div>

      <KpiBrainAgent tf={preset} preset={preset} />

      {selectedCountry && (
        <CountryDetailModal
          data={selectedCountry}
          onClose={() => setSelectedCountry(null)}
          money={money}
          int0={int0}
          countryFlag={countryFlag}
          fmtDeltaPct={fmtDeltaPct}
          fmtDeltaEur={fmtDeltaEur}
          deltaColor={deltaColor}
          tfLabel={tfLabel}
        />
      )}
    </div>
  )
}

// ── SegmentBlock: card per ogni dato NC/RC sotto la riga country ──
function SegmentBlock({ title, accent, ordersCurr, ordersPrev, revCurr, revPrev, money, int0, fmtDeltaPct, fmtDeltaEur, deltaColor }) {
  const dPct = fmtDeltaPct(revCurr, revPrev)
  const dEur = revPrev > 0 ? fmtDeltaEur(revCurr, revPrev) : (revCurr > 0 ? `+${money(revCurr)}` : '€0')
  const dColor = deltaColor(revCurr, revPrev)
  const cards = [
    { label: 'Ordini', value: int0(ordersCurr), color: '#fff' },
    { label: 'Revenue', value: money(revCurr), color: '#fff' },
    { label: 'Delta %', value: dPct || '—', color: dColor },
    { label: 'Delta €', value: dEur, color: dColor },
  ]
  return (
    <div style={{
      padding: '12px 12px 10px',
      borderRadius: 12,
      background: accent.bg,
      border: `1px solid ${accent.border}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 800,
        color: accent.text,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>{title}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {cards.map((c, idx) => (
          <div key={idx} style={{
            padding: '7px 8px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.30)',
            border: '1px solid rgba(255,255,255,0.04)',
            borderTopColor: 'rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            minWidth: 0,
          }}>
            <div style={{
              fontSize: 8.5, fontWeight: 700,
              color: 'var(--text3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.85,
              marginBottom: 3,
              whiteSpace: 'nowrap',
            }}>{c.label}</div>
            <div style={{
              fontSize: 12.5, fontWeight: 900,
              color: c.color,
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CountryDetailModal: popup con pie + area chart + breakdown ─────
function CountryDetailModal({ data, onClose, money, int0, countryFlag, fmtDeltaPct, fmtDeltaEur, deltaColor, tfLabel }) {
  const [daily, setDaily] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!data?.range) return
    const { range, row } = data
    setLoading(true)
    fetch(`/api/shopify-countries?since=${range.since}&until=${range.until}&country=${row.country_code || ''}&breakdown=daily`)
      .then(r => r.json())
      .then(j => setDaily(Array.isArray(j?.daily) ? j.daily : []))
      .catch(() => setDaily([]))
      .finally(() => setLoading(false))
  }, [data])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted || !data) return null
  const { row, prev } = data
  const safeCode = (row.country_code || 'XX').toLowerCase()
  const pieData = [
    { name: 'Nuovi clienti', value: row.ncRevenue || 0, color: '#06b6d4' },
    { name: 'Clienti di ritorno', value: row.rcRevenue || 0, color: '#a855f7' },
  ]
  const hasPie = (row.ncRevenue || 0) + (row.rcRevenue || 0) > 0

  return createPortal(
    <>
      <div
        onClick={onClose}
        style={{
          position:'fixed', inset:0,
          background:'rgba(0,0,0,0.65)',
          backdropFilter:'blur(8px)',
          WebkitBackdropFilter:'blur(8px)',
          zIndex:200,
          animation:'fadeUp .25s ease',
        }}
      />
      <div
        style={{
          position:'fixed',
          top:'50%', left:'50%',
          transform:'translate(-50%, -50%)',
          width:'min(1040px, 95vw)',
          maxHeight:'92vh',
          overflowY:'auto',
          zIndex:201,
          background:'linear-gradient(180deg, rgba(10,10,22,0.96) 0%, rgba(0,0,0,0.98) 100%)',
          backdropFilter:'blur(40px) saturate(2.2)',
          WebkitBackdropFilter:'blur(40px) saturate(2.2)',
          borderRadius:26,
          border:'1.5px solid rgba(255,255,255,0.08)',
          borderTopColor:'rgba(255,255,255,0.16)',
          borderBottomColor:'rgba(0,0,0,0.7)',
          boxShadow:'0 60px 120px rgba(0,0,0,0.85), 0 0 100px rgba(14,165,233,0.18), inset 0 1.5px 0 rgba(255,255,255,0.08)',
          // opacity-only — niente conflitto col translate(-50%, -50%)
          animation:'modalIn 0.32s cubic-bezier(0.16,1,0.3,1) both',
          overflow:'hidden',
        }}
      >
        {/* shine top */}
        <div style={{position:'absolute', top:0, left:'8%', right:'8%', height:1.5, background:'linear-gradient(90deg, transparent, #0ea5e9cc, transparent)', filter:'blur(0.3px)', opacity:1, animation:'cr-shine 4s ease-in-out infinite', zIndex:3, pointerEvents:'none'}} />
        {/* scan sweep */}
        <div style={{position:'absolute', top:0, bottom:0, left:'-50%', width:'40%', background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.04), transparent)', animation:'sim-scan 9s ease-in-out infinite', pointerEvents:'none', zIndex:1}} />

        <div style={{padding:28, position:'relative', zIndex:2, overflowY:'auto', maxHeight:'92vh'}}>
          {/* Header */}
          <div style={{display:'flex', alignItems:'center', justifyContent:'space-between', gap:14, marginBottom:24, flexWrap:'wrap'}}>
            <div style={{display:'flex', alignItems:'center', gap:16}}>
              <div style={{fontSize:54, lineHeight:1, filter:'drop-shadow(0 6px 12px rgba(0,0,0,0.5))'}}>{countryFlag(row.country_code)}</div>
              <div>
                <div style={{fontSize:9.5, fontWeight:800, color:'#0ea5e9', letterSpacing:'0.16em', textTransform:'uppercase'}}>Paese · {tfLabel}</div>
                <div style={{fontSize:28, fontWeight:900, color:'#fff', letterSpacing:'-0.02em', marginTop:4}}>{row.country}</div>
                <div style={{fontSize:13, color:'var(--text3)', marginTop:6}}>{money(row.revenue)} fatturato · {int0(row.orders)} ordini</div>
              </div>
            </div>
            <button onClick={onClose} style={{
              background:'rgba(255,255,255,0.06)',
              border:'1px solid rgba(255,255,255,0.10)',
              color:'#fff',
              width:38, height:38,
              borderRadius:11,
              cursor:'pointer',
              fontSize:20, fontWeight:300,
              display:'grid', placeItems:'center',
              transition:'all 0.2s ease',
            }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.10)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.18)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.10)' }}
            >×</button>
          </div>

          {/* Charts: pie + area */}
          <div style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1.4fr)', gap:14, marginBottom:14}}>
            {/* Pie chart */}
            <div style={{
              padding:18, borderRadius:16,
              background:'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.20))',
              border:'1px solid rgba(255,255,255,0.06)',
              borderTopColor:'rgba(255,255,255,0.10)',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{position:'absolute', top:0, left:'8%', right:'8%', height:1, background:'linear-gradient(90deg, transparent, rgba(6,182,212,0.6), transparent)', animation:'cr-shine 5s ease-in-out infinite'}} />
              <div style={{fontSize:10, fontWeight:800, color:'#0ea5e9', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12}}>Composizione fatturato</div>
              {hasPie ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <defs>
                        <linearGradient id={`pieNC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#0e7490" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id={`pieRC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c084fc" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6b21a8" stopOpacity={1}/>
                        </linearGradient>
                        <filter id={`pieGlow-${safeCode}`}>
                          <feGaussianBlur stdDeviation="4" result="b"/>
                          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={92}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive
                        animationDuration={1200}
                        animationEasing="ease-out"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth={1.5}
                      >
                        <Cell fill={`url(#pieNC-${safeCode})`} filter={`url(#pieGlow-${safeCode})`}/>
                        <Cell fill={`url(#pieRC-${safeCode})`} filter={`url(#pieGlow-${safeCode})`}/>
                      </Pie>
                      <Tooltip
                        contentStyle={{background:'rgba(0,0,0,0.92)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, fontSize:12, fontWeight:700}}
                        formatter={v => money(v)}
                        cursor={{fill:'rgba(255,255,255,0.04)'}}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex', justifyContent:'space-around', marginTop:6, fontSize:11.5}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, color:'#67e8f9', fontWeight:800}}>
                      <div style={{width:11, height:11, borderRadius:3, background:'linear-gradient(180deg, #22d3ee, #0e7490)', boxShadow:'0 0 10px rgba(6,182,212,0.7)'}} />
                      Nuovi {money(row.ncRevenue)}
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:6, color:'#d8b4fe', fontWeight:800}}>
                      <div style={{width:11, height:11, borderRadius:3, background:'linear-gradient(180deg, #c084fc, #6b21a8)', boxShadow:'0 0 10px rgba(168,85,247,0.7)'}} />
                      Ritorno {money(row.rcRevenue)}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12}}>Nessun fatturato classificato (tutti guest)</div>
              )}
            </div>

            {/* Area chart */}
            <div style={{
              padding:18, borderRadius:16,
              background:'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.20))',
              border:'1px solid rgba(255,255,255,0.06)',
              borderTopColor:'rgba(255,255,255,0.10)',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{position:'absolute', top:0, left:'8%', right:'8%', height:1, background:'linear-gradient(90deg, transparent, rgba(14,165,233,0.6), transparent)', animation:'cr-shine 5s ease-in-out infinite', animationDelay:'.5s'}} />
              <div style={{fontSize:10, fontWeight:800, color:'#0ea5e9', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12}}>Trend giornaliero fatturato</div>
              {loading ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:240, gap:12, color:'var(--text3)'}}>
                  <div style={{width:24, height:24, border:'3px solid rgba(255,255,255,0.1)', borderTopColor:'#0ea5e9', borderRadius:999, animation:'spin 1s linear infinite'}} />
                  <div style={{fontSize:11, fontWeight:700, letterSpacing:'0.08em', textTransform:'uppercase'}}>Caricamento</div>
                </div>
              ) : daily.length === 0 ? (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:12}}>Nessun dato giornaliero nel periodo</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={daily} margin={{top:8,right:8,left:-8,bottom:0}}>
                    <defs>
                      <linearGradient id={`areaTotal-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.55}/>
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id={`areaNC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45}/>
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id={`areaRC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.40}/>
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={{stroke:'rgba(255,255,255,0.08)'}} tickFormatter={d => d.slice(5)} />
                    <YAxis stroke="rgba(255,255,255,0.3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${Math.round(v)}`} />
                    <Tooltip
                      contentStyle={{background:'rgba(0,0,0,0.92)', border:'1px solid rgba(255,255,255,0.10)', borderRadius:8, fontSize:12, fontWeight:700}}
                      labelStyle={{color:'#0ea5e9'}}
                      formatter={(v, n) => [money(v), n === 'revenue' ? 'Totale' : n === 'ncRevenue' ? 'Nuovi' : 'Ritorno']}
                      cursor={{stroke:'rgba(14,165,233,0.4)', strokeWidth:1, strokeDasharray:'3 3'}}
                    />
                    <Area type="monotone" dataKey="ncRevenue" stackId="seg" stroke="#22d3ee" strokeWidth={1.5} fill={`url(#areaNC-${safeCode})`} isAnimationActive animationDuration={1400} animationEasing="ease-out"/>
                    <Area type="monotone" dataKey="rcRevenue" stackId="seg" stroke="#c084fc" strokeWidth={1.5} fill={`url(#areaRC-${safeCode})`} isAnimationActive animationDuration={1400} animationEasing="ease-out"/>
                    <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2.5} fill="none" isAnimationActive animationDuration={1600} animationEasing="ease-out" dot={{r:3, fill:'#0ea5e9', stroke:'#fff', strokeWidth:1}}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* NC + RC segment detail */}
          <div style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <SegmentBlock
              title="Nuovi clienti"
              accent={{ text:'#67e8f9', bg:'rgba(6,182,212,0.10)', border:'rgba(6,182,212,0.30)' }}
              ordersCurr={row.ncOrders} ordersPrev={prev.ncOrders}
              revCurr={row.ncRevenue} revPrev={prev.ncRevenue}
              money={money} int0={int0}
              fmtDeltaPct={fmtDeltaPct} fmtDeltaEur={fmtDeltaEur} deltaColor={deltaColor}
            />
            <SegmentBlock
              title="Clienti di ritorno"
              accent={{ text:'#d8b4fe', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.30)' }}
              ordersCurr={row.rcOrders} ordersPrev={prev.rcOrders}
              revCurr={row.rcRevenue} revPrev={prev.rcRevenue}
              money={money} int0={int0}
              fmtDeltaPct={fmtDeltaPct} fmtDeltaEur={fmtDeltaEur} deltaColor={deltaColor}
            />
          </div>
        </div>
      </div>
    </>,
    document.body
  )
}
