'use client'
import { useState, useEffect, useCallback } from 'react'
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const fmt  = (n, dec=2) => n != null && n !== 0 ? `€${Number(n).toLocaleString('it-IT', {minimumFractionDigits:dec,maximumFractionDigits:dec})}` : '—'
const fmtn = (n) => n != null ? Number(n).toLocaleString('it-IT') : '—'
const fmtp = (n) => n != null ? `${Number(n).toFixed(1).replace('.',',')}%` : '—'
const fmtx = (n) => n != null ? `${Number(n).toFixed(2).replace('.',',')}x` : '—'

const RATIO_CONFIG = {
  critical:  { color: '#E74C3C', label: '🔴 CRITICO',    text: 'Stai perdendo soldi su ogni cliente' },
  warning:   { color: '#E67E22', label: '🟡 ATTENZIONE', text: 'Margini risicati — ottimizza i costi' },
  good:      { color: '#27AE60', label: '🟢 OTTIMO',     text: 'Business sostenibile — scala con fiducia' },
  excellent: { color: '#2980B9', label: '🔵 ECCELLENTE', text: 'Valuta di investire di più in acquisizione' },
  no_data:   { color: '#B0B0C0', label: '⚪ N/D',        text: 'Dati insufficienti per il calcolo' },
}

const DEFAULT_SETTINGS = {
  purchaseFrequency: 1.69,
  customerLifespan:  1.57,
  grossMargin:       30,
  googleAdsSpend:    0,
  cacPeriodStart:    '2026-01-01',
  cacPeriodEnd:      '',
}

function loadSettings() {
  try { const s = localStorage.getItem('stmn_settings'); return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS }
  catch { return DEFAULT_SETTINGS }
}
function saveSettings(s) { try { localStorage.setItem('stmn_settings', JSON.stringify(s)) } catch {} }

function Card({ children, className='' }) {
  return <div className={`bg-mid rounded-xl p-5 ${className}`}>{children}</div>
}
function MetricCard({ label, value, sub, color, big }) {
  return (
    <div className="bg-accent rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`font-bold ${big ? 'text-3xl' : 'text-2xl'}`} style={{ color: color||'#E94560' }}>{value}</p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}
function SourceBadge({ name, active, icon }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium ${active ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
      {icon} {name} {active ? '✓' : '○'}
    </span>
  )
}
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark border border-accent rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gold font-bold mb-1">{label}</p>
      {payload.map((p, i) => {
        const isCount = ['Ordini'].includes(p.name)
        return <p key={i} style={{ color: p.color }}>{p.name}: {isCount ? fmtn(p.value) : fmt(p.value, 0)}</p>
      })}
    </div>
  )
}

function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  return (
    <div style={{ position:'fixed',inset:0,background:'rgba(0,0,0,0.7)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center' }}>
      <div className="bg-mid rounded-2xl p-6 w-full max-w-md shadow-2xl border border-accent max-h-screen overflow-y-auto">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-gold font-bold text-xl">⚙️ Impostazioni</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        <p className="text-gray-400 text-sm mb-4">Parametri per il calcolo LTV:CAC</p>

        <p className="text-gold text-xs font-bold uppercase tracking-wider mb-3">Metriche LTV</p>
        {[
          { key:'purchaseFrequency', label:'Frequenza acquisti (x/anno)', step:'0.01', suffix:'x/anno' },
          { key:'customerLifespan',  label:'Vita media cliente (anni)',    step:'0.01', suffix:'anni' },
          { key:'grossMargin',       label:'Margine lordo (%)',            step:'1',    suffix:'%' },
        ].map(({ key, label, step, suffix }) => (
          <div key={key} className="mb-3">
            <label className="text-gray-300 text-sm block mb-1">{label}</label>
            <div className="flex items-center gap-2">
              <input type="number" step={step} value={form[key]}
                onChange={e => set(key, parseFloat(e.target.value)||0)}
                className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-right font-bold" />
              <span className="text-gray-500 text-sm w-16">{suffix}</span>
            </div>
          </div>
        ))}

        <p className="text-gold text-xs font-bold uppercase tracking-wider mb-3 mt-5">📅 Periodo calcolo CAC</p>
        <p className="text-gray-500 text-xs mb-3">Usa lo stesso periodo per spesa Meta e nuovi clienti</p>
        <div className="flex gap-2 mb-3">
          <div className="flex-1">
            <label className="text-gray-400 text-xs block mb-1">Dal</label>
            <input type="date" value={form.cacPeriodStart}
              onChange={e => set('cacPeriodStart', e.target.value)}
              className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-sm" />
          </div>
          <div className="flex-1">
            <label className="text-gray-400 text-xs block mb-1">Al (vuoto = oggi)</label>
            <input type="date" value={form.cacPeriodEnd}
              onChange={e => set('cacPeriodEnd', e.target.value)}
              className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-sm" />
          </div>
        </div>

        <p className="text-gold text-xs font-bold uppercase tracking-wider mb-3 mt-5">Google Ads</p>
        <div className="mb-3">
          <label className="text-gray-300 text-sm block mb-1">Spesa Google Ads nel periodo (€)</label>
          <div className="flex items-center gap-2">
            <input type="number" step="1" value={form.googleAdsSpend}
              onChange={e => set('googleAdsSpend', parseFloat(e.target.value)||0)}
              className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-right font-bold" />
            <span className="text-gray-500 text-sm w-8">€</span>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 bg-dark border border-accent text-gray-300 rounded-lg py-2 hover:bg-accent transition-colors">Annulla</button>
          <button onClick={() => { saveSettings(form); onSave(form); onClose() }}
            className="flex-1 bg-gold text-white rounded-lg py-2 font-bold hover:opacity-90 transition-opacity">💾 Salva</button>
        </div>
      </div>
    </div>
  )
}

export default function Dashboard() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings]   = useState(DEFAULT_SETTINGS)

  useEffect(() => { setSettings(loadSettings()) }, [])

  const fetchData = useCallback(async (s) => {
    const cfg = s || settings
    setLoading(true); setError(null)
    try {
      const start = cfg.cacPeriodStart || '2026-01-01'
      const end   = cfg.cacPeriodEnd   || new Date().toISOString().slice(0,10)
      const res   = await fetch(`/api/metrics?cacStart=${start}&cacEnd=${end}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json); setLastUpdate(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [settings])

  useEffect(() => { fetchData() }, [])

  const handleSave = (s) => { setSettings(s); fetchData(s) }

  // ── Calcoli LTV:CAC ──────────────────────────────────────────
  const margin   = settings.grossMargin / 100
  const freq     = settings.purchaseFrequency
  const lifespan = settings.customerLifespan
  const aov      = data?.aov || 0
  const ltvGross = aov * freq * lifespan
  const ltvNet   = Math.round(ltvGross * margin * 100) / 100

  const googleSpend      = settings.googleAdsSpend || 0
  const metaSpendPeriod  = data?.metaSpendPeriod   || 0
  const totalSpendPeriod = metaSpendPeriod + googleSpend
  const newCustPeriod    = data?.newCustomers       || 0
  const cac = totalSpendPeriod > 0 && newCustPeriod > 0 ? Math.round(totalSpendPeriod / newCustPeriod * 100) / 100 : null
  const ratio = cac && ltvNet > 0 ? Math.round(ltvNet / cac * 100) / 100 : null
  const ratioStatus = ratio == null ? 'no_data' : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'
  const rc = RATIO_CONFIG[ratioStatus]

  const cacStart = settings.cacPeriodStart || '2026-01-01'
  const cacEnd   = settings.cacPeriodEnd   || new Date().toISOString().slice(0,10)

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {showSettings && <SettingsModal settings={settings} onSave={handleSave} onClose={() => setShowSettings(false)} />}

      {/* HEADER */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gold">STMN Fitness</h1>
          <p className="text-gray-400 text-sm">LTV : CAC Dashboard — aggiornamento automatico</p>
        </div>
        <div className="flex items-center gap-3">
          {data?.sources && (
            <div className="flex gap-2">
              <SourceBadge name="Shopify" active={data.sources.shopify} icon="🛒" />
              <SourceBadge name="Meta"    active={data.sources.meta}    icon="📘" />
              <SourceBadge name="Google"  active={data.sources.google}  icon="🔍" />
            </div>
          )}
          <button onClick={() => setShowSettings(true)} className="bg-dark border border-accent text-gray-300 text-sm px-3 py-2 rounded-lg hover:bg-accent transition-colors">⚙️ Impostazioni</button>
          <button onClick={() => fetchData()} disabled={loading} className="bg-accent hover:bg-gold text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 font-medium">
            {loading ? '⏳ Aggiorno...' : '🔄 Aggiorna'}
          </button>
        </div>
      </div>

      {lastUpdate && <p className="text-xs text-gray-600 mb-6">Ultimo aggiornamento: {lastUpdate.toLocaleString('it-IT')} • Periodo CAC: {cacStart} → {cacEnd}</p>}
      {error && <div className="bg-red-900 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">⚠️ Errore: {error}</div>}

      {/* RATIO */}
      <div className="rounded-xl p-6 mb-6 border-2 text-center" style={{ borderColor: rc.color, background: `${rc.color}15` }}>
        <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC</p>
        <p className="text-6xl font-black mb-2" style={{ color: rc.color }}>
          {ratio != null ? `${ratio.toFixed(1).replace('.',',')} : 1` : '— : —'}
        </p>
        <p className="text-lg font-bold" style={{ color: rc.color }}>{rc.label}</p>
        <p className="text-gray-400 text-sm mt-1">{rc.text}</p>
      </div>

      {loading && !data && <div className="text-center py-20 text-gray-500"><p className="text-4xl mb-3">⏳</p><p>Caricamento dati in corso...</p></div>}

      {(data || !loading) && (
        <>
          {/* KPI PRINCIPALI */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MetricCard label="LTV Netto"        value={fmt(ltvNet)}           sub={`Lordo: ${fmt(ltvGross)}`} big />
            <MetricCard label="CAC"              value={cac ? fmt(cac) : '—'}  sub={`${fmtn(newCustPeriod)} nuovi acquirenti`} />
            <MetricCard label="AOV Reale"        value={fmt(aov)}              sub={`${fmtn(data?.totalOrders)} ordini nel periodo`} color="#3498DB" />
            <MetricCard label="Spesa Ads Periodo" value={fmt(totalSpendPeriod)} sub={`Meta ${fmt(metaSpendPeriod)} + Google ${fmt(googleSpend)}`} color="#9B59B6" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Frequenza Acquisti"  value={fmtx(freq)}          sub="ordini per cliente/anno"  color="#1ABC9C" />
            <MetricCard label="Vita Media Cliente"  value={`${lifespan.toFixed(2).replace('.',',')} anni`} sub="1 ÷ churn rate" color="#F39C12" />
            <MetricCard label="Fatturato Netto"     value={fmt(data?.netRevenue,0)}   sub={`Lordo ${fmt(data?.grossRevenue,0)} • Resi ${fmt(data?.returns,0)}`} color="#27AE60" />
            <MetricCard label="Margine Lordo"       value={fmtp(settings.grossMargin)} sub="sui costi variabili"  color="#E94560" />
          </div>

          {/* RIEPILOGO NUOVI vs RETURNING */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            <Card>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">🆕 Nuovi Clienti — {cacStart} → {cacEnd}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center"><p className="text-2xl font-bold text-cyan-400">{fmtn(data?.newCustomers)}</p><p className="text-xs text-gray-500">Acquirenti</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-cyan-300">{fmt(data?.revenueNew,0)}</p><p className="text-xs text-gray-500">Fatturato</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-cyan-200">{fmt(data?.aovNew)}</p><p className="text-xs text-gray-500">AOV</p></div>
              </div>
            </Card>
            <Card>
              <p className="text-xs text-gray-400 uppercase tracking-wider mb-3">🔄 Clienti di Ritorno — {cacStart} → {cacEnd}</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="text-center"><p className="text-2xl font-bold text-indigo-400">{fmtn(data?.returningCustomers)}</p><p className="text-xs text-gray-500">Acquirenti</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-indigo-300">{fmt(data?.revenueRet,0)}</p><p className="text-xs text-gray-500">Fatturato</p></div>
                <div className="text-center"><p className="text-2xl font-bold text-indigo-200">{fmt(data?.aovRet)}</p><p className="text-xs text-gray-500">AOV</p></div>
              </div>
            </Card>
          </div>

          {/* GRAFICO SPESA META */}
          {data?.monthly?.length > 0 && (
            <Card className="mb-6">
              <p className="text-sm font-medium text-gray-300 mb-4">Spesa Meta mensile (ultimi 12 mesi)</p>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={data.monthly} margin={{ top:5,right:20,left:0,bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                  <XAxis dataKey="month" tick={{ fill:'#B0B0C0',fontSize:11 }} />
                  <YAxis tick={{ fill:'#B0B0C0',fontSize:11 }} tickFormatter={v=>`€${(v/1000).toFixed(0)}k`} />
                  <Tooltip content={<ChartTooltip />} />
                  <Bar dataKey="totalSpend" name="Spesa Meta €" fill="#E94560" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>
          )}

          {/* TABELLA MENSILE */}
          {data?.monthly?.length > 0 && (
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-300">📅 Storico Mensile — Spesa Meta</p>
                <p className="text-xs text-gray-500">Ordini e Nuovi Clienti da Shopify • Dati periodo da ⚙️</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-accent">
                      {['Mese','Ordini','Nuovi Clienti Reg.','Spesa Meta','CAC Mese'].map(h => (
                        <th key={h} className="py-2 px-3 text-left text-gold font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m, i) => {
                      const monthlyCac = m.totalSpend > 0 && m.newCustomers > 0 ? Math.round(m.totalSpend / m.newCustomers * 100)/100 : null
                      return (
                        <tr key={m.month} className={i%2===0?'bg-dark':''}>
                          <td className="py-2 px-3 font-medium text-gray-300">{m.month}</td>
                          <td className="py-2 px-3 text-blue-400">{m.orders > 0 ? fmtn(m.orders) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3 text-cyan-400">{m.newCustomers > 0 ? fmtn(m.newCustomers) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3 text-purple-400">{m.totalSpend > 0 ? fmt(m.totalSpend) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3 text-gray-300">{monthlyCac ? fmt(monthlyCac) : <span className="text-gray-600">—</span>}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-gray-600 mt-3">⚠️ Fatturato/AOV/Resi mensili disponibili solo nel riepilogo del periodo selezionato nelle Impostazioni</p>
            </Card>
          )}

          {/* GOOGLE ADS */}
          <Card className="mb-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-300 mb-1">🔍 Google Ads — Report campagne</p>
                <p className="text-xs text-gray-500">Spesa, conversioni, ROAS e performance campagne</p>
              </div>
              <a href="https://datastudio.google.com/u/0/reporting/922f6dea-56c4-451d-bbc7-c528ec21f5a1/page/5oMrD"
                target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-2 bg-accent hover:bg-gold text-white text-sm px-4 py-2 rounded-lg transition-colors font-medium whitespace-nowrap">
                📊 Apri Looker Studio ↗
              </a>
            </div>
          </Card>

          {/* BENCHMARK */}
          <Card>
            <p className="text-sm font-medium text-gray-300 mb-3">Tabella benchmark LTV:CAC</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                ['< 1:1','#E74C3C','Critico','Ferma le campagne'],
                ['1:1 – 3:1','#E67E22','Attenzione','Ottimizza i costi'],
                ['4:1 – 7:1','#27AE60','Ottimo','Scala gradualmente'],
                ['> 10:1','#2980B9','Eccellente','Investi di più'],
              ].map(([range,color,status,action]) => (
                <div key={range} className="rounded-lg p-3 text-center" style={{ background:`${color}20`,border:`1px solid ${color}40` }}>
                  <p className="font-bold" style={{ color }}>{range}</p>
                  <p className="text-white mt-1">{status}</p>
                  <p className="text-gray-500 mt-1">{action}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <p className="text-center text-gray-700 text-xs mt-8">STMN Fitness Dashboard • {new Date().getFullYear()}</p>
    </div>
  )
}
