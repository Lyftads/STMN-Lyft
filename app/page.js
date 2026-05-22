'use client'
import { useState, useEffect, useCallback } from 'react'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'

// ── Helpers ────────────────────────────────────────────────────
const fmt  = (n, dec=2) => n != null ? `€${Number(n).toFixed(dec).replace('.',',')}` : '—'
const fmtn = (n)        => n != null ? Number(n).toLocaleString('it-IT') : '—'
const fmtp = (n)        => n != null ? `${Number(n).toFixed(1).replace('.',',')}%` : '—'
const fmtx = (n)        => n != null ? `${Number(n).toFixed(2).replace('.',',')}x` : '—'

const RATIO_CONFIG = {
  critical:  { color: '#E74C3C', label: '🔴 CRITICO',  text: 'Stai perdendo soldi su ogni cliente' },
  warning:   { color: '#E67E22', label: '🟡 ATTENZIONE', text: 'Margini risicati — ottimizza i costi' },
  good:      { color: '#27AE60', label: '🟢 OTTIMO',   text: 'Business sostenibile — scala con fiducia' },
  excellent: { color: '#2980B9', label: '🔵 ECCELLENTE', text: 'Valuta di investire di più in acquisizione' },
  no_data:   { color: '#B0B0C0', label: '⚪ N/D',      text: 'Collega Meta e Google per vedere il ratio' },
}

// ── Componenti UI ──────────────────────────────────────────────
function Card({ children, className = '' }) {
  return (
    <div className={`bg-mid rounded-xl p-5 ${className}`}>
      {children}
    </div>
  )
}

function MetricCard({ label, value, sub, color, big }) {
  return (
    <div className="bg-accent rounded-xl p-4 flex flex-col gap-1">
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`font-bold ${big ? 'text-3xl' : 'text-2xl'}`} style={{ color: color || '#E94560' }}>
        {value}
      </p>
      {sub && <p className="text-xs text-gray-500">{sub}</p>}
    </div>
  )
}

function SourceBadge({ name, active, icon }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full font-medium
      ${active ? 'bg-green-900 text-green-300' : 'bg-gray-800 text-gray-500'}`}>
      {icon} {name} {active ? '✓' : '○'}
    </span>
  )
}

// ── Tooltip custom ─────────────────────────────────────────────
const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div className="bg-dark border border-accent rounded-lg p-3 text-xs shadow-xl">
      <p className="text-gold font-bold mb-1">{label}</p>
      {payload.map((p, i) => (
        <p key={i} style={{ color: p.color }}>
          {p.name}: {p.name.includes('€') || ['AOV','CAC','Spesa'].some(k => p.name.includes(k))
            ? fmt(p.value) : p.name.includes('%') ? fmtp(p.value) : fmtn(p.value)}
        </p>
      ))}
    </div>
  )
}

// ── Pagina principale ──────────────────────────────────────────
export default function Dashboard() {
  const [data, setData]         = useState(null)
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState(null)
  const [lastUpdate, setLastUpdate] = useState(null)
  const [margin, setMargin]     = useState(40)

  const fetchData = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/metrics')
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json()
      if (json.error) throw new Error(json.error)
      setData(json)
      setLastUpdate(new Date())
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  // Ricalcola LTV con margine custom
  const ltvNet    = data ? Math.round(data.ltvGross * (margin / 100) * 100) / 100 : null
  const ratio     = data?.cac && ltvNet ? Math.round(ltvNet / data.cac * 100) / 100 : null
  const ratioStatus = ratio == null ? 'no_data'
    : ratio < 1 ? 'critical' : ratio < 3 ? 'warning' : ratio <= 7 ? 'good' : 'excellent'
  const rc = RATIO_CONFIG[ratioStatus]

  return (
    <div className="min-h-screen p-6 max-w-7xl mx-auto">

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
          <button
            onClick={fetchData}
            disabled={loading}
            className="bg-accent hover:bg-gold text-white text-sm px-4 py-2 rounded-lg
              transition-colors disabled:opacity-50 font-medium"
          >
            {loading ? '⏳ Aggiorno...' : '🔄 Aggiorna'}
          </button>
        </div>
      </div>

      {/* LAST UPDATE */}
      {lastUpdate && (
        <p className="text-xs text-gray-600 mb-6">
          Ultimo aggiornamento: {lastUpdate.toLocaleString('it-IT')}
          {data?.updatedAt && ` • Dati al: ${new Date(data.updatedAt).toLocaleString('it-IT')}`}
        </p>
      )}

      {/* ERROR */}
      {error && (
        <div className="bg-red-900 border border-red-700 rounded-xl p-4 mb-6 text-red-300 text-sm">
          ⚠️ Errore: {error}. Verifica le variabili d'ambiente in Vercel.
        </div>
      )}

      {/* RATIO PRINCIPALE */}
      {data && (
        <div className="rounded-xl p-6 mb-6 border-2 text-center"
          style={{ borderColor: rc.color, background: `${rc.color}15` }}>
          <p className="text-sm text-gray-400 mb-1">RATIO LTV : CAC</p>
          <p className="text-6xl font-black mb-2" style={{ color: rc.color }}>
            {ratio != null ? `${ratio.toFixed(1)} : 1` : '— : —'}
          </p>
          <p className="text-lg font-bold" style={{ color: rc.color }}>{rc.label}</p>
          <p className="text-gray-400 text-sm mt-1">{rc.text}</p>
        </div>
      )}

      {loading && !data && (
        <div className="text-center py-20 text-gray-500">
          <p className="text-4xl mb-3">⏳</p>
          <p>Connessione a Shopify, Meta e Google...</p>
        </div>
      )}

      {data && (
        <>
          {/* KPI GRID */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="LTV Netto"          value={fmt(ltvNet)}              sub={`Lordo: ${fmt(data.ltvGross)}`} big />
            <MetricCard label="CAC"                value={data.cac ? fmt(data.cac) : '—'} sub={`${fmtn(data.newCustomers)} nuovi clienti/anno`} />
            <MetricCard label="AOV Reale"          value={fmt(data.aov)}            sub={`${fmtn(data.totalOrders)} ordini`} color="#3498DB" />
            <MetricCard label="Spesa Ads totale"   value={fmt(data.totalAdSpend)}   sub={`Meta ${fmt(data.metaSpend)} + Google ${fmt(data.googleSpend)}`} color="#9B59B6" />
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <MetricCard label="Retention Rate"     value={fmtp(data.retentionRate)} sub="clienti che ricomprano"      color="#27AE60" />
            <MetricCard label="Churn Rate"         value={fmtp(data.churnRate)}     sub="finestra 365 giorni"         color="#E74C3C" />
            <MetricCard label="Vita Media Cliente" value={`${data.customerLifespan?.toFixed(2)?.replace('.',',')} anni`} sub="1 ÷ churn rate" color="#F39C12" />
            <MetricCard label="Frequenza Acquisti" value={fmtx(data.purchaseFrequency)} sub="ordini per cliente/anno"  color="#1ABC9C" />
          </div>

          {/* MARGINE SLIDER */}
          <Card className="mb-6">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium text-gray-300">Margine lordo %</p>
              <p className="text-2xl font-bold text-gold">{margin}%</p>
            </div>
            <input type="range" min={10} max={80} step={1} value={margin}
              onChange={e => setMargin(Number(e.target.value))}
              className="w-full accent-gold" />
            <div className="flex justify-between text-xs text-gray-600 mt-1">
              <span>10%</span><span>Trascina per aggiornare il calcolo LTV in tempo reale</span><span>80%</span>
            </div>
          </Card>

          {/* GRAFICI */}
          {data.monthly?.length > 0 && (
            <>
              {/* Trend fatturato + spesa */}
              <Card className="mb-6">
                <p className="text-sm font-medium text-gray-300 mb-4">Fatturato mensile vs Spesa Ads</p>
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={data.monthly} margin={{ top:5, right:20, left:0, bottom:5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                    <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:11 }} />
                    <YAxis tick={{ fill:'#B0B0C0', fontSize:11 }}
                      tickFormatter={v => `€${(v/1000).toFixed(0)}k`} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ color:'#B0B0C0', fontSize:12 }} />
                    <Bar dataKey="revenue"    name="Fatturato €"  fill="#0F3460" radius={[3,3,0,0]} />
                    <Bar dataKey="totalSpend" name="Spesa Ads €"  fill="#E94560" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>

              {/* Trend AOV + CAC */}
              <div className="grid md:grid-cols-2 gap-6 mb-6">
                <Card>
                  <p className="text-sm font-medium text-gray-300 mb-4">AOV mensile</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.monthly}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                      <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:10 }} />
                      <YAxis tick={{ fill:'#B0B0C0', fontSize:10 }}
                        tickFormatter={v => `€${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line dataKey="aov" name="AOV €" stroke="#3498DB"
                        strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>

                <Card>
                  <p className="text-sm font-medium text-gray-300 mb-4">CAC mensile (se dati ads disponibili)</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <LineChart data={data.monthly.filter(m => m.cac != null)}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                      <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:10 }} />
                      <YAxis tick={{ fill:'#B0B0C0', fontSize:10 }}
                        tickFormatter={v => `€${v}`} />
                      <Tooltip content={<ChartTooltip />} />
                      <Line dataKey="cac" name="CAC €" stroke="#E94560"
                        strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                </Card>
              </div>

              {/* Ordini mensili */}
              <Card className="mb-6">
                <p className="text-sm font-medium text-gray-300 mb-4">Ordini e clienti mensili</p>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={data.monthly}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#0F3460" />
                    <XAxis dataKey="month" tick={{ fill:'#B0B0C0', fontSize:11 }} />
                    <YAxis tick={{ fill:'#B0B0C0', fontSize:11 }} />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend wrapperStyle={{ color:'#B0B0C0', fontSize:12 }} />
                    <Bar dataKey="orders"    name="Ordini"          fill="#0F3460" radius={[3,3,0,0]} />
                    <Bar dataKey="customers" name="Clienti unici"   fill="#27AE60" radius={[3,3,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </Card>
            </>
          )}

          {/* TABELLA DETTAGLIO */}
          <Card className="mb-6">
            <p className="text-sm font-medium text-gray-300 mb-4">Dettaglio calcoli</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody>
                  {[
                    ['AOV (valore medio ordine)', fmt(data.aov), '✅ da Shopify'],
                    ['Frequenza acquisti/anno', fmtx(data.purchaseFrequency), '✅ da Shopify'],
                    ['Vita media cliente', `${data.customerLifespan?.toFixed(2)} anni`, '✅ calcolato'],
                    ['Margine lordo', `${margin}%`, '⚙️ impostazione'],
                    ['LTV Lordo', fmt(data.ltvGross), '= AOV × Freq × Vita'],
                    ['LTV Netto', fmt(ltvNet), '= LTV Lordo × Margine'],
                    ['Spesa Meta Ads', fmt(data.metaSpend), data.sources.meta ? '✅ da Meta' : '⚠️ non connesso'],
                    ['Spesa Google Ads', fmt(data.googleSpend), data.sources.google ? '✅ da Google' : '⚠️ non connesso'],
                    ['Spesa totale', fmt(data.totalAdSpend), '= Meta + Google'],
                    ['Nuovi clienti/anno', fmtn(data.newCustomers), '✅ da Shopify'],
                    ['CAC', data.cac ? fmt(data.cac) : '—', '= Spesa totale ÷ Nuovi clienti'],
                    ['Ratio LTV:CAC', ratio ? `${ratio} : 1` : '—', rc.label],
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
                ['< 1:1',    '#E74C3C', 'Critico', 'Ferma le campagne'],
                ['1:1 – 3:1','#E67E22', 'Attenzione', 'Ottimizza i costi'],
                ['4:1 – 7:1','#27AE60', 'Ottimo', 'Scala gradualmente'],
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

      {/* FOOTER */}
      <p className="text-center text-gray-700 text-xs mt-8">
        STMN Fitness Dashboard • Dati aggiornati ogni ora • {new Date().getFullYear()}
      </p>
    </div>
  )
}
