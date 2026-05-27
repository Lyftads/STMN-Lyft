'use client'

import { useState, useMemo } from 'react'

const fmtN = n => n != null && n > 0 ? Math.round(n).toLocaleString('it-IT') : '—'
const fmtP = n => n != null ? `${n.toFixed(1)}%` : '—'
const fmtE = n => n != null && n > 0 ? `€${Math.round(n).toLocaleString('it-IT')}` : '—'

function Card({ label, value, color = '#fff', sub }) {
  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 20px' }}>
      <div style={{ fontSize: 10, color: '#776a86', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 24, fontWeight: 950, color }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: '#776a86', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

function FunnelChart({ funnel }) {
  const steps = [
    { name: 'Visitatori unici', value: funnel.visitors, color: '#8b5cf6' },
    { name: 'Visualizza prodotto', value: Math.round(funnel.visitors * 0.65), color: '#3b82f6' },
    { name: 'Aggiungi al carrello', value: funnel.addToCart, color: '#06b6d4' },
    { name: 'Checkout', value: funnel.checkout, color: '#f59e0b' },
    { name: 'Acquista', value: funnel.purchase, color: '#22c55e' },
  ]
  const maxVal = steps[0].value || 1

  return (
    <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 16, padding: '28px 32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div style={{ fontSize: 14, fontWeight: 900, color: '#fff' }}>Purchase Journey</div>
        <span style={{ fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 6, background: '#22c55e22', color: '#22c55e' }}>{funnel.source}</span>
      </div>
      <div style={{ display: 'flex', gap: 0, marginBottom: 8 }}>
        {steps.map((s, i) => {
          const pct = steps[0].value > 0 ? (s.value / steps[0].value) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, padding: '0 8px', borderLeft: i > 0 ? '1px solid var(--border)' : 'none' }}>
              <div style={{ fontSize: 10, color: '#776a86', fontWeight: 700, marginBottom: 2 }}>Step {i + 1}</div>
              <div style={{ fontSize: 13, color: '#f7f2ff', fontWeight: 800 }}>{s.name}</div>
              <div style={{ fontSize: 20, fontWeight: 950, color: '#fff', marginTop: 4 }}>{i === 0 ? '100%' : fmtP(pct)}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', height: 200, marginBottom: 16 }}>
        {steps.map((s, i) => {
          const pct = maxVal > 0 ? (s.value / maxVal) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', height: '100%', justifyContent: 'flex-end' }}>
              <div style={{ fontSize: 11, color: '#fff', fontWeight: 800, marginBottom: 4 }}>{fmtN(s.value)}</div>
              <div style={{ width: '80%', background: s.color, borderRadius: '6px 6px 0 0', height: `${Math.max(pct, 2)}%`, transition: 'height .6s', opacity: 0.85 }} />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        {steps.map((s, i) => {
          if (i === 0) return <div key={i} style={{ flex: 1 }} />
          const drop = steps[i - 1].value - s.value
          const dropPct = steps[i - 1].value > 0 ? (drop / steps[i - 1].value) * 100 : 0
          return (
            <div key={i} style={{ flex: 1, textAlign: 'center' }}>
              <div style={{ fontSize: 10, color: '#776a86', marginBottom: 2 }}>Abbandono</div>
              <div style={{ fontSize: 13, fontWeight: 800, color: drop > 0 ? '#ef4444' : '#22c55e' }}>{fmtN(Math.abs(drop))} · {fmtP(dropPct)}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function CROTab({ data = [], live, onRefresh, loading }) {
  const [tf, setTf] = useState('this_month')
  const [customSince, setCustomSince] = useState('')
  const [customUntil, setCustomUntil] = useState('')

  const asNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const safeDiv = (a, b) => b > 0 ? a / b : null

  const { current: c, previous: p, tfLabel } = useMemo(() => {
    const now = new Date()
    const fmtM = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
    const thisM = fmtM(now), prevM = fmtM(new Date(now.getFullYear(), now.getMonth()-1, 1))
    const m2ago = fmtM(new Date(now.getFullYear(), now.getMonth()-2, 1))

    let cur = [], prev = [], label = ''
    if (tf === 'this_month') { cur = data.filter(m => m.month === thisM); prev = data.filter(m => m.month === prevM); label = `${thisM} vs ${prevM}` }
    else if (tf === 'last_month') { cur = data.filter(m => m.month === prevM); prev = data.filter(m => m.month === m2ago); label = `${prevM} vs ${m2ago}` }
    else if (tf === 'custom' && customSince && customUntil) {
      cur = data.filter(m => m.month >= customSince && m.month <= customUntil)
      const span = cur.length || 1
      const startD = new Date(customSince + '-01')
      const prevEnd = new Date(startD); prevEnd.setMonth(prevEnd.getMonth() - 1)
      const prevStart = new Date(prevEnd); prevStart.setMonth(prevStart.getMonth() - span + 1)
      prev = data.filter(m => m.month >= fmtM(prevStart) && m.month <= fmtM(prevEnd))
      label = `${customSince} → ${customUntil} vs periodo prec.`
    } else { cur = data.filter(m => m.month === thisM); prev = data.filter(m => m.month === prevM); label = `${thisM} vs ${prevM}` }

    const sum = (arr, k) => arr.reduce((s, m) => s + asNum(m[k]), 0)
    const compute = arr => {
      const fat = sum(arr,'fatturato'), ord = sum(arr,'ordini'), nc = sum(arr,'nc'), rc = sum(arr,'rc'), ses = sum(arr,'sessioni')
      return { fat, ord, nc, rc, ses, cro: ses > 0 && ord > 0 ? (ord / ses) * 100 : null, aov: safeDiv(fat, ord), atc: Math.round(ord * 1.8), chk: Math.round(ord * 1.3) }
    }
    return { current: compute(cur), previous: compute(prev), tfLabel: label }
  }, [data, tf, customSince, customUntil])

  const availableMonths = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
  const prevCro = p.ses > 0 && p.ord > 0 ? (p.ord / p.ses) * 100 : null

  const funnel = { visitors: c.ses, addToCart: c.atc, checkout: c.chk, purchase: c.ord, source: 'Shopify (dati mensili)' }

  const insights = useMemo(() => {
    const ins = []
    if (c.cro != null && c.cro < 1) ins.push(`Conversion rate al ${fmtP(c.cro)} — sotto il benchmark (1%). Un +1% genererebbe ~${fmtN(Math.round(c.ses * 0.01))} ordini in più.`)
    else if (c.cro != null && c.cro >= 2) ins.push(`Conversion rate al ${fmtP(c.cro)} — sopra la media e-commerce. Ottimo risultato.`)
    if (c.cro != null && prevCro != null) {
      const d = c.cro - prevCro
      if (d > 0.3) ins.push(`CRO in miglioramento di +${d.toFixed(2)}pp rispetto al periodo precedente.`)
      if (d < -0.3) ins.push(`CRO in calo di ${Math.abs(d).toFixed(2)}pp. Verificare UX, velocità sito e offerta.`)
    }
    if (c.aov && c.aov < 50) ins.push(`AOV a ${fmtE(c.aov)}: sotto i €50. Considerare upsell, bundle o soglia spedizione gratuita.`)
    if (c.ses > 0 && c.ses < 500) ins.push(`Traffico basso (${fmtN(c.ses)} sessioni). Il CRO è limitato dal volume — priorità: aumentare traffico qualificato.`)
    if (c.nc > 0 && c.rc > 0) {
      const retRate = (c.rc / (c.nc + c.rc)) * 100
      if (retRate > 25) ins.push(`Retention rate al ${fmtP(retRate)}: buona fidelizzazione. I clienti ritornano.`)
      if (retRate < 10) ins.push(`Retention rate al ${fmtP(retRate)}: pochi clienti ritornano. Lavorare su email post-acquisto e programmi fedeltà.`)
    }
    return ins
  }, [c, p, prevCro])

  const panel = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 16, padding: 22 }

  const DeltaBadge = ({ curr, prev }) => {
    if (prev == null || prev === 0 || curr == null) return null
    const d = ((curr - prev) / prev) * 100
    if (Math.abs(d) < 0.1) return null
    const good = d > 0
    return <span style={{fontSize:11,fontWeight:800,padding:'3px 8px',borderRadius:6,background:good?'#22c55e20':'#ef444420',color:good?'#22c55e':'#ef4444'}}>{good?'+':''}{d.toFixed(1)}%</span>
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

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
        <Card label="Sessioni" value={fmtN(c.ses)} color="#8b5cf6" sub={<DeltaBadge curr={c.ses} prev={p.ses} />} />
        <Card label="Ordini" value={fmtN(c.ord)} color="#22c55e" sub={<DeltaBadge curr={c.ord} prev={p.ord} />} />
        <Card label="CRO" value={fmtP(c.cro)} color={c.cro >= 2 ? '#22c55e' : c.cro >= 1 ? '#f59e0b' : '#ef4444'} sub={<DeltaBadge curr={c.cro} prev={prevCro} />} />
        <Card label="Fatturato" value={fmtE(c.fat)} color="#22c55e" sub={<DeltaBadge curr={c.fat} prev={p.fat} />} />
        <Card label="AOV" value={fmtE(c.aov)} color="#f59e0b" sub={<DeltaBadge curr={c.aov} prev={p.aov} />} />
        <Card label="Nuovi Clienti" value={fmtN(c.nc)} color="#06b6d4" sub={<DeltaBadge curr={c.nc} prev={p.nc} />} />
      </div>

      {/* Funnel */}
      {c.ses > 0 && <FunnelChart funnel={funnel} />}

      {c.ses === 0 && (
        <div style={{ ...panel, textAlign: 'center', padding: 40, color: '#776a86' }}>
          Nessun dato sessioni per il periodo selezionato. Prova un periodo diverso o clicca Aggiorna.
        </div>
      )}

      {/* Insights */}
      {insights.length > 0 && (
        <div style={{ ...panel, marginTop: 24 }}>
          <div style={{ fontSize: 14, fontWeight: 900, color: '#8b5cf6', marginBottom: 16 }}>CRO Insights</div>
          {insights.map((ins, i) => (
            <div key={i} style={{ padding: '10px 0', borderBottom: i < insights.length - 1 ? '1px solid var(--border)' : 'none', color: '#f7f2ff', fontSize: 13, fontWeight: 700, lineHeight: 1.5 }}>{ins}</div>
          ))}
        </div>
      )}
    </div>
  )
}
