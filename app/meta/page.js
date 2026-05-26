'use client'

import { useEffect, useMemo, useState } from 'react'

const PRESETS = [
  { id: 'today', label: 'Oggi' },
  { id: 'yesterday', label: 'Ieri' },
  { id: 'last_7d', label: 'Ultimi 7g' },
  { id: 'last_14d', label: 'Ultimi 14g' },
  { id: 'last_28d', label: 'Ultimi 28g' },
  { id: 'this_month', label: 'Mese corrente' },
  { id: 'last_month', label: 'Mese scorso' },
  { id: 'custom', label: 'Custom' },
]

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(v) {
  return Math.round(n(v)).toLocaleString('it-IT')
}

function fmtEuro(v) {
  const x = n(v)
  if (!x) return '—'
  return `€${Math.round(x).toLocaleString('it-IT')}`
}

function fmtEuro2(v) {
  const x = n(v)
  if (!x) return '—'
  return `€${x.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

function fmtPct(v) {
  const x = n(v)
  if (!x) return '—'
  return `${x.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}%`
}

function fmtX(v) {
  const x = n(v)
  if (!x) return '0,00x'
  return `${x.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}x`
}

function fmtFreq(v) {
  const x = n(v)
  if (!x) return '—'
  return x.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })
}

function fmtDelta(v) {
  const x = n(v)
  if (!Number.isFinite(x)) return '—'
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toLocaleString('it-IT', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  })}%`
}

function safeArray(v) {
  return Array.isArray(v) ? v : []
}

function getLevelLabel(row) {
  if (!row) return '—'

  if (row.level === 'campaign') {
    return `Campagna · ${row.campaign_name || row.name || 'Senza nome'}`
  }

  if (row.level === 'adset') {
    return `Ad set · ${row.adset_name || row.name || 'Senza nome'}`
  }

  if (row.level === 'ad') {
    return `Ad · ${row.ad_name || row.name || 'Senza nome'}`
  }

  return row.name || row.level || '—'
}

export default function MetaPage() {
  const [preset, setPreset] = useState('last_28d')
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState('')
  const [data, setData] = useState(null)

  async function loadMeta(nextPreset = preset) {
    try {
      setLoading(true)
      setErr('')

      const res = await fetch(`/api/meta-detail?preset=${nextPreset}`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!json.ok) {
        setErr(json.error || 'Errore API Meta')
        setData(json)
        return
      }

      setData(json)
    } catch (e) {
      setErr(e?.message || 'Errore caricamento dati Meta')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadMeta(preset)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset])

  const summary = data?.summary || {}
  const previousSummary = data?.previousSummary || {}
  const comparison = data?.comparison || {}
  const rows = safeArray(data?.hierarchy)
  const todos = safeArray(data?.todos)
  const insight = data?.insight || ''
  const range = data?.range || {}
  const previousRange = data?.previousRange || {}

  const hasRows = rows.length > 0

  const totals = useMemo(() => {
    return {
      spend: n(summary.spend),
      impressions: n(summary.impressions),
      reach: n(summary.reach),
      frequency: n(summary.frequency),
      cpm: n(summary.cpm),
      ctr_link: n(summary.ctr_link),
      cpc_link: n(summary.cpc_link),
      link_clicks: n(summary.link_clicks),
      cost_per_result: n(summary.cost_per_result),
      roas: n(summary.roas),
      purchases: n(summary.purchases),
      conversione_acquisti: n(summary.conversione_acquisti),
      cro_campagna: n(summary.cro_campagna),
      aov_campagna: n(summary.aov_campagna),
    }
  }, [summary])

  return (
    <main className="min-h-screen bg-[#020817] text-slate-100 px-6 py-8">
      <div className="mx-auto max-w-[1680px] space-y-6">
        <header className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Meta Detail</h1>
            <p className="mt-2 text-sm text-slate-400">
              Analisi gerarchica campagne · ad set · ads
            </p>
            {range?.since && range?.until && (
              <p className="mt-1 text-xs text-slate-500">
                Periodo: {range.since} → {range.until}
              </p>
            )}
          </div>

          <div className="text-right">
            <div className={err ? 'text-red-400 font-semibold' : 'text-emerald-400 font-semibold'}>
              {loading ? 'Caricamento…' : err ? 'Errore dati' : 'Dati caricati'}
            </div>
            {data?.accounts?.length > 0 && (
              <p className="mt-1 text-xs text-slate-500">
                Account aggregati: {data.accounts.length}
              </p>
            )}
          </div>
        </header>

        {err && (
          <section className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-red-200">
            <div className="font-bold">Errore API</div>
            <div className="mt-1 text-sm break-words">{err}</div>
          </section>
        )}

        <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
          <div className="flex flex-wrap gap-3">
            {PRESETS.map((p) => (
              <button
                key={p.id}
                onClick={() => setPreset(p.id)}
                className={[
                  'rounded-full px-4 py-2 text-sm font-semibold border transition',
                  preset === p.id
                    ? 'border-emerald-400 bg-emerald-500/15 text-emerald-300'
                    : 'border-slate-700 bg-slate-900 text-slate-400 hover:text-slate-100 hover:border-slate-500',
                ].join(' ')}
              >
                {p.label}
              </button>
            ))}
          </div>
        </section>

        <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
          <Kpi title="Importo speso" value={fmtEuro(totals.spend)} />
          <Kpi title="ROAS" value={fmtX(totals.roas)} />
          <Kpi title="Costo risultato" value={fmtEuro2(totals.cost_per_result)} />
          <Kpi title="Acquisti" value={totals.purchases ? fmtInt(totals.purchases) : '—'} />
          <Kpi title="CTR link" value={fmtPct(totals.ctr_link)} />
        </section>

        <section className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <h2 className="text-sm font-black tracking-[0.2em] uppercase">
              Confronto · ultimi 7g vs 7g precedenti
            </h2>

            {previousRange?.since && previousRange?.until && (
              <p className="mt-4 text-sm text-slate-400">
                Periodo precedente: {previousRange.since} → {previousRange.until}
              </p>
            )}

            <div className="mt-5 grid grid-cols-2 md:grid-cols-4 gap-3">
              <DeltaBox label="Spesa" value={comparison.spend} />
              <DeltaBox label="ROAS" value={comparison.roas} />
              <DeltaBox label="CPA" value={comparison.cost_per_result} />
              <DeltaBox label="CTR" value={comparison.ctr_link} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
            <h2 className="text-sm font-black tracking-[0.2em] uppercase">
              Insight automatico
            </h2>

            <p className="mt-5 leading-7 text-slate-300">
              {insight || 'Non ci sono insight disponibili per il periodo selezionato.'}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
          <h2 className="text-sm font-black tracking-[0.2em] uppercase">
            To-do consigliate
          </h2>

          <div className="mt-5 space-y-3">
            {todos.length ? (
              todos.map((todo, idx) => (
                <div
                  key={idx}
                  className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-slate-300"
                >
                  <span className="font-black text-emerald-400">#{idx + 1}</span>{' '}
                  {Array.isArray(todo) ? todo.join(' ') : String(todo)}
                </div>
              ))
            ) : (
              <div className="rounded-xl border border-slate-700 bg-slate-900/60 px-4 py-3 text-slate-400">
                Nessuna to-do disponibile.
              </div>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-950/60 overflow-hidden">
          <div className="p-5">
            <h2 className="text-sm font-black tracking-[0.2em] uppercase">
              Gerarchia Meta · campagne / ad set / ads
            </h2>

            <p className="mt-3 text-sm text-slate-500">
              Dati aggregati dai due account Meta. Le ads mostrano anche anteprima creatività se presente.
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1600px] text-sm">
              <thead>
                <tr className="border-y border-slate-700 bg-slate-900/70 text-left text-xs uppercase tracking-[0.18em] text-slate-200">
                  <Th>Livello</Th>
                  <Th>Anteprima</Th>
                  <Th>Impression</Th>
                  <Th>Copertura</Th>
                  <Th>Freq.</Th>
                  <Th>CPM</Th>
                  <Th>CTR link</Th>
                  <Th>CPC link</Th>
                  <Th>Click link</Th>
                  <Th>Speso</Th>
                  <Th>Costo risultato</Th>
                  <Th>ROAS</Th>
                  <Th>Acquisti</Th>
                  <Th>Conv. acquisti</Th>
                  <Th>CRO campagna</Th>
                  <Th>AOV campagna</Th>
                </tr>
              </thead>

              <tbody>
                {!hasRows && (
                  <tr>
                    <td colSpan={16} className="px-4 py-8 text-slate-400">
                      Nessun dato Meta disponibile per il periodo selezionato.
                    </td>
                  </tr>
                )}

                {rows.map((row, idx) => {
                  const isCampaign = row.level === 'campaign'
                  const isAdset = row.level === 'adset'
                  const isAd = row.level === 'ad'

                  return (
                    <tr
                      key={row.id || idx}
                      className={[
                        'border-b border-slate-800',
                        isCampaign ? 'bg-emerald-500/5' : '',
                        isAdset ? 'bg-slate-900/30' : '',
                        isAd ? 'bg-slate-950' : '',
                      ].join(' ')}
                    >
                      <td className="px-4 py-4 min-w-[320px]">
                        <div
                          className={[
                            'font-bold',
                            isCampaign ? 'text-emerald-400' : '',
                            isAdset ? 'text-blue-300 pl-6' : '',
                            isAd ? 'text-slate-200 pl-12' : '',
                          ].join(' ')}
                        >
                          {getLevelLabel(row)}
                        </div>

                        {row.account_name && (
                          <div className="mt-1 text-xs text-slate-500">
                            {row.account_name}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-4">
                        {row.thumbnail_url ? (
                          <img
                            src={row.thumbnail_url}
                            alt={row.ad_name || row.name || 'Creatività'}
                            className="h-14 w-14 rounded-lg object-cover border border-slate-700"
                          />
                        ) : (
                          <span className="text-slate-600">—</span>
                        )}
                      </td>

                      <Td>{fmtInt(row.impressions)}</Td>
                      <Td>{fmtInt(row.reach)}</Td>
                      <Td>{fmtFreq(row.frequency)}</Td>
                      <Td>{fmtEuro2(row.cpm)}</Td>
                      <Td>{fmtPct(row.ctr_link)}</Td>
                      <Td>{fmtEuro2(row.cpc_link)}</Td>
                      <Td>{fmtInt(row.link_clicks)}</Td>
                      <Td>{fmtEuro(row.spend)}</Td>
                      <Td>{fmtEuro2(row.cost_per_result)}</Td>
                      <Td>{fmtX(row.roas)}</Td>
                      <Td>{row.purchases ? fmtInt(row.purchases) : '—'}</Td>
                      <Td>{fmtPct(row.conversione_acquisti)}</Td>
                      <Td>{fmtPct(row.cro_campagna)}</Td>
                      <Td>{fmtEuro2(row.aov_campagna)}</Td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
          <h2 className="text-sm font-black tracking-[0.2em] uppercase">
            Totale periodo
          </h2>

          <div className="mt-5 grid grid-cols-2 md:grid-cols-4 xl:grid-cols-8 gap-3">
            <Mini label="Impression" value={fmtInt(totals.impressions)} />
            <Mini label="Copertura" value={fmtInt(totals.reach)} />
            <Mini label="Frequenza" value={fmtFreq(totals.frequency)} />
            <Mini label="CPM" value={fmtEuro2(totals.cpm)} />
            <Mini label="CPC link" value={fmtEuro2(totals.cpc_link)} />
            <Mini label="Click link" value={fmtInt(totals.link_clicks)} />
            <Mini label="Conv. acquisti" value={fmtPct(totals.conversione_acquisti)} />
            <Mini label="AOV campagna" value={fmtEuro2(totals.aov_campagna)} />
          </div>
        </section>
      </div>
    </main>
  )
}

function Kpi({ title, value }) {
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-950/60 p-5">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
        {title}
      </div>
      <div className="mt-5 text-3xl font-black">{value}</div>
    </div>
  )
}

function Mini({ label, value }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <div className="text-[11px] uppercase tracking-[0.18em] text-slate-500 font-black">
        {label}
      </div>
      <div className="mt-2 text-lg font-bold text-slate-100">{value}</div>
    </div>
  )
}

function DeltaBox({ label, value }) {
  const x = n(value)
  const good = x >= 0

  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-4">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
        {label}
      </div>
      <div className={['mt-4 text-2xl font-black', good ? 'text-emerald-400' : 'text-red-400'].join(' ')}>
        {fmtDelta(x)}
      </div>
    </div>
  )
}

function Th({ children }) {
  return <th className="px-4 py-4 whitespace-nowrap">{children}</th>
}

function Td({ children }) {
  return <td className="px-4 py-4 whitespace-nowrap text-slate-200">{children}</td>
}
