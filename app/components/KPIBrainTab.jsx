'use client'

import { useState, useMemo, useEffect } from 'react'
import Sparkline from './Sparkline'
import { PlatformBadges } from './PlatformIcon'
import KpiBrainAgent from './KpiBrainAgent'

export default function KPIBrainTab({ data, dataYear, live, cfg, S, shopifyWeeklyAll = [], metaWeeklyAll = [], onRefresh, loading }) {

  const [tf, setTf] = useState('this_month')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')

  const asNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const safeDiv = (a, b) => b > 0 ? a / b : null

  const { current: c, previous: p, label: tfLabel, currentMonths } = useMemo(() => {
    const now = new Date()
    const fmtM = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const thisM = fmtM(now)
    const prevM = fmtM(new Date(now.getFullYear(), now.getMonth()-1, 1))
    const m2ago = fmtM(new Date(now.getFullYear(), now.getMonth()-2, 1))
    const m3ago = fmtM(new Date(now.getFullYear(), now.getMonth()-3, 1))

    let cur = [], prev = [], label = ''
    if (tf === 'this_month') {
      cur = data.filter(m => m.month === thisM)
      prev = data.filter(m => m.month === prevM)
      label = `${thisM} vs ${prevM}`
    } else if (tf === 'last_month') {
      cur = data.filter(m => m.month === prevM)
      prev = data.filter(m => m.month === m2ago)
      label = `${prevM} vs ${m2ago}`
    } else if (tf === 'custom' && customSince && customUntil) {
      cur = data.filter(m => m.month >= customSince && m.month <= customUntil)
      const span = cur.length || 1
      const startD = new Date(customSince + '-01')
      const prevEnd = new Date(startD); prevEnd.setMonth(prevEnd.getMonth() - 1)
      const prevStart = new Date(prevEnd); prevStart.setMonth(prevStart.getMonth() - span + 1)
      prev = data.filter(m => m.month >= fmtM(prevStart) && m.month <= fmtM(prevEnd))
      label = `${customSince} → ${customUntil} vs periodo prec.`
    } else {
      cur = data.filter(m => m.month === thisM)
      prev = data.filter(m => m.month === prevM)
      label = `${thisM} vs ${prevM}`
    }

    const sum = (arr, k) => arr.reduce((s, m) => s + asNum(m[k]), 0)
    const compute = arr => {
      const fat = sum(arr,'fatturato'), ord = sum(arr,'ordini'), nc = sum(arr,'nc'), rc = sum(arr,'rc')
      const ses = sum(arr,'sessioni'), meta = sum(arr,'metaSpend'), goog = sum(arr,'googleSpend')
      const spend = meta + goog, impr = sum(arr,'impressions'), clicks = sum(arr,'linkClicks')
      const aov = safeDiv(fat,ord), roas = safeDiv(fat,meta), mer = safeDiv(fat,spend)
      const cac = safeDiv(spend,nc), ctr = impr>0?(clicks/impr)*100:null
      const cpc = safeDiv(meta,clicks), cpm = impr>0?(meta/impr)*1000:null
      const repeatRate = nc+rc>0?(rc/(nc+rc))*100:null
      const ltv = aov?(aov*cfg.freq*cfg.life*cfg.margin)/100:null
      return { fat,ord,nc,rc,ses,meta,goog,spend,impr,clicks,aov,roas,mer,cac,ctr,cpc,cpm,repeatRate,ltv }
    }
    return { current: compute(cur), previous: compute(prev), label, currentMonths: cur }
  }, [data, tf, customSince, customUntil, cfg])

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
      <div style={{...panel, marginBottom:16, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        {[{id:'this_month',l:'Questo mese'},{id:'last_month',l:'Mese precedente'},{id:'custom',l:'Custom'}].map(b => (
          <button key={b.id} onClick={()=>setTf(b.id)} style={{
            fontSize:12,padding:'6px 14px',borderRadius:6,cursor:'pointer',
            border:tf===b.id?'1px solid #22c55e':'1px solid var(--border)',
            background:tf===b.id?'#22c55e20':'transparent',
            color:tf===b.id?'#22c55e':'#94a3b8',fontWeight:tf===b.id?700:500,
          }}>{b.l}</button>
        ))}
        {tf==='custom' && (
          <>
            <span style={{fontSize:11,color:'var(--text3)'}}>Da:</span>
            <select value={customSince} onChange={e=>setCustomSince(e.target.value)} style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'#e8e8e8',fontSize:12}}>
              <option value="">Seleziona</option>
              {availableMonths.map(m=><option key={m.month} value={m.month}>{m.month}</option>)}
            </select>
            <span style={{color:'#555'}}>→</span>
            <span style={{fontSize:11,color:'var(--text3)'}}>A:</span>
            <select value={customUntil} onChange={e=>setCustomUntil(e.target.value)} style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:6,padding:'5px 8px',color:'#e8e8e8',fontSize:12}}>
              <option value="">Seleziona</option>
              {availableMonths.filter(m=>!customSince||m.month>=customSince).map(m=><option key={m.month} value={m.month}>{m.month}</option>)}
            </select>
          </>
        )}
        {onRefresh && (
          <button onClick={onRefresh} disabled={loading} style={{
            marginLeft:'auto',fontSize:12,padding:'6px 14px',borderRadius:6,
            border:'1px solid var(--border)',background:loading?'var(--glass)':'transparent',
            color:loading?'#555':'#94a3b8',fontWeight:700,cursor:loading?'wait':'pointer',
            display:'flex',alignItems:'center',gap:6,
          }}><span style={{animation:loading?'spin 1s linear infinite':'none'}}>↻</span>{loading?'Aggiorno…':'Aggiorna'}</button>
        )}
        <span style={{fontSize:11,color:'var(--text3)'}}>{tfLabel}</span>
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

      {/* Insights */}
      <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:22,padding:24}}>
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

      <KpiBrainAgent tf={tf} preset={tf === 'this_month' ? 'current_month' : tf === 'last_month' ? 'last_month' : 'last_28d'} />
    </div>
  )
}
