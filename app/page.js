'use client'
import { useState, useEffect, useCallback } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'

const fmt  = (n, dec=2) => n != null ? `€${Number(n).toFixed(dec).replace('.',',')}` : '—'
const fmtn = (n)        => n != null ? Number(n).toLocaleString('it-IT') : '—'
const fmtp = (n)        => n != null ? `${Number(n).toFixed(1).replace('.',',')}%` : '—'
const fmtx = (n)        => n != null ? `${Number(n).toFixed(2).replace('.',',')}x` : '—'

const RATIO_CONFIG = {
  critical:  { color: '#E74C3C', label: '🔴 CRITICO',    text: 'Stai perdendo soldi su ogni cliente' },
  warning:   { color: '#E67E22', label: '🟡 ATTENZIONE', text: 'Margini risicati — ottimizza i costi' },
  good:      { color: '#27AE60', label: '🟢 OTTIMO',     text: 'Business sostenibile — scala con fiducia' },
  excellent: { color: '#2980B9', label: '🔵 ECCELLENTE', text: 'Valuta di investire di più in acquisizione' },
  no_data:   { color: '#B0B0C0', label: '⚪ N/D',        text: 'Collega Meta e Google per vedere il ratio' },
}

const DEFAULT_SETTINGS = {
  purchaseFrequency: 1.69,
  customerLifespan:  1.57,
  grossMargin:       30,
  newCustomers:      10718,
}

function loadSettings() {
  try {
    const s = localStorage.getItem('stmn_settings')
    return s ? { ...DEFAULT_SETTINGS, ...JSON.parse(s) } : DEFAULT_SETTINGS
  } catch { return DEFAULT_SETTINGS }
}
function saveSettings(s) {
  try { localStorage.setItem('stmn_settings', JSON.stringify(s)) } catch {}
}

function Card({ children, className = '' }) {
  return <div className={`bg-mid rounded-xl p-5 ${className}`}>{children}</div>
}

function MetricCard({ label, value, sub, color, big }) {
  return (
    <div className="bg-accent rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`font-bold ${big ? 'text-3xl' : 'text-2xl'}`} style={{ color: color || '#E94560' }}>{value}</p>
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
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>{p.name}: {typeof p.value === 'number' && p.value > 100 ? fmt(p.value) : p.value}</p>
      ))}
    </div>
  )
}

// ── Settings Modal ─────────────────────────────────────────────
function SettingsModal({ settings, onSave, onClose }) {
  const [form, setForm] = useState({ ...settings })
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.7)', zIndex:50, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div className="bg-mid rounded-2xl p-6 w-full max-w-md shadow-2xl border border-accent">
        <div className="flex justify-between items-center mb-5">
          <h2 className="text-gold font-bold text-xl">⚙️ Impostazioni metriche</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-xl">✕</button>
        </div>
        <p className="text-gray-400 text-sm mb-5">Aggiorna questi valori ogni trimestre dalla tua analisi Shopify.</p>

        {[
          { key:'purchaseFrequency', label:'Frequenza acquisti (x/anno)',   step:'0.01', suffix:'x/anno' },
          { key:'customerLifespan',  label:'Vita media cliente (anni)',      step:'0.01', suffix:'anni' },
          { key:'grossMargin',       label:'Margine lordo (%)',              step:'1',    suffix:'%' },
          { key:'newCustomers',      label:'Nuovi clienti/anno',             step:'1',    suffix:'clienti' },
        ].map(({ key, label, step, suffix }) => (
          <div key={key} className="mb-4">
            <label className="text-gray-300 text-sm block mb-1">{label}</label>
            <div className="flex items-center gap-2">
              <input
                type="number" step={step} value={form[key]}
                onChange={e => set(key, parseFloat(e.target.value) || 0)}
                className="bg-dark border border-accent rounded-lg px-3 py-2 text-white w-full text-right font-bold"
              />
              <span className="text-gray-500 text-sm w-16">{suffix}</span>
            </div>
          </div>
        ))}

        <div className="flex gap-3 mt-6">
          <button onClick={onClose}
            className="flex-1 bg-dark border border-accent text-gray-300 rounded-lg py-2 hover:bg-accent transition-colors">
            Annulla
          </button>
          <button onClick={() => { saveSettings(form); onSave(form); onClose() }}
            className="flex-1 bg-gold text-white rounded-lg py-2 font-bold hover:opacity-90 transition-opacity">
            💾 Salva
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Dashboard principale ───────────────────────────────────────
export default function Dashboard() {
  const [data, setData]           = useState(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [showSettings, setShowSettings] = useState(false)
  const [settings, setSettings]   = useState(DEFAULT_SETTINGS)

  useEffect(() => { setSettings(loadSettings()) }, [])

  const fetchData = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json); setLastUpdate(new Date())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Calcoli con settings locali
  const aov      = data?.aov || 0
  const margin   = settings.grossMargin / 100
  const freq     = settings.purchaseFrequency
  const lifespan = settings.customerLifespan
  const newCust  = settings.newCustomers

  const ltvGross = aov * freq * lifespan
  const ltvNet   = ltvGross * margin
  const metaSpend = data?.metaSpend || 0
  const totalSpend = data?.totalAdSpend || 0
  const cac      = newCust > 0 && totalSpend > 0 ? Math.round(totalSpend / newCust * 100) / 100 : null
  const ratio    = cac && ltvNet ? Math.round(ltvNet / cac * 100) / 100 : null
  const ratioStatus = ratio == null ? 'no_data'
    : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'
  const rc = RATIO_CONFIG[ratioStatus]

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">
      {showSettings && (
        <SettingsModal
          settings={settings}
          onSave={s => setSettings(s)}
          onClose={() => setShowSettings(false)}
        />
      )}

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
          <button onClick={() => setShowSettings(true)}
            className="bg-dark border border-accent text-gray-300 text-sm px-3 py-2 rounded-lg hover:bg-accent transition-colors">
            ⚙️ Impostazioni
          </button>
          <button onClick={fetchData} disabled={loading}
            className="bg-accent hover:bg-gold text-white text-sm px-4 py-2 rounded-lg transition-colors disabled:opacity-50 font-medium">
            {loading ? '⏳ Aggiorno...' : '🔄 Aggiorna'}
          </button>
        </div>
      </div>

      {lastUpdate && (
        <p className="text-xs text-gray-600 mb-6">
          Ultimo aggiornamento: {lastUpdate.toLocaleString('it-IT')}
        </p>
      )}

      {error && (
        <div className="bg-red-900 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ⚠️ Errore: {error}
        </div>
      )}

      {/* RATIO */}
      {(data || !loading) && (
        <div className="rounded-xl p-6 mb-6 border-2 text-center"
          style={{ borderColor: rc.color, background: `${rc.color}15` }}>
          <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC</p>
          <p className="text-6xl font-black mb-2" style={{ color: rc.color }}>
            {ratio != null ? `${ratio.toFixed(1).replace('.',',')} : 1` : '— : —'}
          </p>
          <p className="text-lg font-bold" style={{ color: rc.color }}>{rc.label}</p>
          <p className="text-gray-400 text-sm mt-1">{rc.text}</p>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">⏳</p>
          <p>Connessione a Shopify e Meta...</p>
        </div>
      )}

      {(data || !loading) && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <MetricCard label="LTV Netto"        value={fmt(ltvNet)}       sub={`Lordo: ${fmt(ltvGross)}`} big />
            <MetricCard label="CAC"              value={cac ? fmt(cac) : '—'} sub={`${fmtn(newCust)} nuovi clienti/anno`} />
            <MetricCard label="AOV Reale"        value={fmt(aov)}          sub={`${fmtn(data?.totalOrders)} ordini`} color="#3498DB" />
            <MetricCard label="Spesa Ads Totale" value={fmt(totalSpend)}   sub={`Meta ${fmt(metaSpend)} + Google €0`} color="#9B59B6" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Frequenza Acquisti" value={fmtx(freq)}     sub="ordini per cliente/anno"   color="#1ABC9C" />
            <MetricCard label="Vita Media Cliente" value={`${lifespan.toFixed(2).replace('.',',')} anni`} sub="1 ÷ churn rate" color="#F39C12" />
            <MetricCard label="Margine Lordo"      value={fmtp(settings.grossMargin)} sub="sui costi variabili" color="#27AE60" />
            <MetricCard label="Nuovi Clienti/Anno" value={fmtn(newCust)}  sub="da analisi Shopify" color="#E94560" />
          </div>

          {/* Info settings */}
          <div className="bg-dark rounded-lg px-4 py-3 mb-6 flex items-center justify-between">
            <p className="text-gray-500 text-xs">
              ⚙️ Frequenza, vita media e nuovi clienti vengono da analisi manuale — aggiornali ogni trimestre
            </p>
            <button onClick={() => setShowSettings(true)}
              className="text-gold text-xs hover:underline ml-4">
              Modifica →
            </button>
          </div>

          {/* GRAFICI */}
          {data?.monthly?.length > 0 && (
            <>
              <Card className="mb-6">
                <p className="text-sm font-medium text-gray-300 mb-4">Fatturato mensile vs Spesa Ads</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} margin={{ top:5, right:20, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                    <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:11 }} />
                    <YAxis tick={{ fill:'#B0B0C0', fontSize:11 }} tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ color:'#B0B0C0', fontSize:12 }} />
                    <Bar dataKey="revenue"    name="Fatturato €" fill="#0F3460" radius={[3,3,0,0]} />
                    <Bar dataKey="totalSpend" name="Spesa Ads €" fill="#E94560" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <p className="text-sm font-medium text-gray-300 mb-4">AOV mensile</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                      <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:10 }} />
                      <YAxis tick={{ fill:'#B0B0C0', fontSize:10 }} tickFormatter={v => `€${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line dataKey="aov" name="AOV €" stroke="#3498DB" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <p className="text-sm font-medium text-gray-300 mb-4">Ordini mensili</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                      <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:10 }} />
                      <YAxis tick={{ fill:'#B0B0C0', fontSize:10 }} />
                      <Tooltip content={<ChartTooltip />} />
                      <Bar dataKey="orders" name="Ordini" fill="#0F3460" radius={[3,3,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </Card>
              </div>
            </>
          )}


          {/* TABELLA STORICO MENSILE */}
          {data?.monthly?.length > 0 && (
            <Card className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <p className="text-sm font-medium text-gray-300">📅 Storico Mensile LTV:CAC</p>
                <p className="text-xs text-gray-500">Spesa Meta + AOV + Nuovi clienti in tempo reale da Shopify</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-accent">
                      {['Mese','Spesa Mktg','Nuovi Clienti','AOV','CAC','LTV','Ratio'].map(h => (
                        <th key={h} className="py-2 px-3 text-left text-gold font-medium">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.monthly.map((m, i) => {
                      const monthlyNewClients = m.newCustomers > 0 ? m.newCustomers : Math.round(newCust / 12)
                      const monthlyCac = m.totalSpend > 0 && monthlyNewClients > 0
                        ? m.totalSpend / monthlyNewClients : null
                      const monthlyLtv = m.aov > 0 ? m.aov * freq * lifespan * margin : null
                      const monthlyRatio = monthlyCac && monthlyLtv ? monthlyLtv / monthlyCac : null
                      const ratioColor = monthlyRatio == null ? '#B0B0C0'
                        : monthlyRatio < 1 ? '#E74C3C'
                        : monthlyRatio < 3 ? '#E67E22'
                        : '#27AE60'
                      return (
                        <tr key={m.month} className={i%2===0 ? 'bg-dark' : ''}>
                          <td className="py-2 px-3 font-medium text-gray-300">{m.month}</td>
                          <td className="py-2 px-3 text-purple-400">{m.totalSpend > 0 ? fmt(m.totalSpend) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3 text-gray-400">{monthlyNewClients.toLocaleString('it-IT')}</td>
                          <td className="py-2 px-3 text-blue-400">{m.aov > 0 ? fmt(m.aov) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3">{monthlyCac ? fmt(monthlyCac) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3">{monthlyLtv ? fmt(monthlyLtv) : <span className="text-gray-600">—</span>}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: ratioColor }}>
                            {monthlyRatio ? `${monthlyRatio.toFixed(2).replace('.',',')} : 1` : <span className="text-gray-600">—</span>}
                          </td>
                        </tr>
                      )
                    })}
                    {/* Riga media */}
                    {(() => {
                      const withData = data.monthly.filter(m => m.totalSpend > 0 && m.aov > 0)
                      if (withData.length === 0) return null
                      const avgSpend = withData.reduce((s,m) => s+m.totalSpend, 0) / withData.length
                      const avgAov   = withData.reduce((s,m) => s+m.aov, 0) / withData.length
                      const avgNewCl = withData.reduce((s,m) => s+(m.newCustomers||0), 0) / withData.length || Math.round(newCust / 12)
                      const avgCac   = avgSpend / avgNewCl
                      const avgLtv   = avgAov * freq * lifespan * margin
                      const avgRatio = avgLtv / avgCac
                      const rc2 = avgRatio < 1 ? '#E74C3C' : avgRatio < 3 ? '#E67E22' : '#27AE60'
                      return (
                        <tr className="border-t-2 border-accent bg-accent">
                          <td className="py-2 px-3 font-bold text-gold">📊 MEDIE</td>
                          <td className="py-2 px-3 font-bold text-purple-400">{fmt(avgSpend)}</td>
                          <td className="py-2 px-3 font-bold text-gray-300">{avgNewCl.toLocaleString('it-IT')}</td>
                          <td className="py-2 px-3 font-bold text-blue-400">{fmt(avgAov)}</td>
                          <td className="py-2 px-3 font-bold">{fmt(avgCac)}</td>
                          <td className="py-2 px-3 font-bold">{fmt(avgLtv)}</td>
                          <td className="py-2 px-3 font-bold" style={{ color: rc2 }}>{avgRatio.toFixed(2).replace('.',',')} : 1</td>
                        </tr>
                      )
                    })()}
                  </tbody>
                </table>
              </div>
            </Card>
          )}
          {/* TABELLA */}
          <Card className="mb-6">
            <p className="text-sm font-medium text-gray-300 mb-4">Dettaglio calcoli</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['AOV (valore medio ordine)',  fmt(aov),          '✅ da Shopify (tempo reale)'],
                    ['Frequenza acquisti/anno',    fmtx(freq),        '⚙️ impostazioni manuali'],
                    ['Vita media cliente',         `${lifespan.toFixed(2)} anni`, '⚙️ impostazioni manuali'],
                    ['Margine lordo',              fmtp(settings.grossMargin), '⚙️ impostazioni manuali'],
                    ['LTV Lordo',                  fmt(ltvGross),     '= AOV × Freq × Vita'],
                    ['LTV Netto',                  fmt(ltvNet),       '= LTV Lordo × Margine'],
                    ['Spesa Meta Ads',             fmt(metaSpend),    data?.sources?.meta ? '✅ da Meta (tempo reale)' : '⚠️ non connesso'],
                    ['Nuovi clienti/anno',         fmtn(newCust),     '⚙️ impostazioni manuali'],
                    ['CAC',                        cac ? fmt(cac) : '—', '= Spesa Ads ÷ Nuovi clienti'],
                    ['Ratio LTV:CAC',              ratio ? `${ratio} : 1` : '—', rc.label],
                  ].map(([label, value, note], i) => (
                    <tr key={i} className={i%2===0 ? 'bg-dark' : ''}>
                      <td className="py-2 px-3 text-gray-400">{label}</td>
                      <td className="py-2 px-3 font-bold text-right text-white">{value}</td>
                      <td className="py-2 px-3 text-gray-500 text-xs">{note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          {/* BENCHMARK */}
          <Card>
            <p className="text-sm font-medium text-gray-300 mb-3">Tabella benchmark</p>
            <div className="grid grid-cols-4 gap-2 text-xs">
              {[
                ['< 1:1',    '#E74C3C', 'Critico',    'Ferma le campagne'],
                ['1:1 – 3:1','#E67E22', 'Attenzione', 'Ottimizza i costi'],
                ['4:1 – 7:1','#27AE60', 'Ottimo',     'Scala gradualmente'],
                ['> 10:1',   '#2980B9', 'Eccellente', 'Investi di più'],
              ].map(([range, color, status, action]) => (
                <div key={range} className="rounded-lg p-3 text-center"
                  style={{ background: `${color}20`, border: `1px solid ${color}40` }}>
                  <p className="font-bold" style={{ color }}>{range}</p>
                  <p className="text-white mt-1">{status}</p>
                  <p className="text-gray-500 mt-1">{action}</p>
                </div>
              ))}
            </div>
          </Card>
        </>
      )}

      <p className="text-center text-gray-700 text-xs mt-8">
        STMN Fitness Dashboard • AOV e Spesa Ads aggiornati in tempo reale • {new Date().getFullYear()}
      </p>
    </div>
  )
}
