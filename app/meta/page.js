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

const GREEN = '#22c55e'
const BLUE = '#2f88ff'
const RED = '#ef4444'
const TEXT = '#f8fafc'
const MUTED = '#7b8aa3'
const BORDER = '#20324f'
const CARD = '#0b1222'
const BG = '#050b16'

function n(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function money(v, decimals = 0) {
  const x = n(v)
  if (!x) return '—'
  return `€${x.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}`
}

function int(v) {
  const x = n(v)
  if (!x) return '—'
  return Math.round(x).toLocaleString('it-IT')
}

function pct(v, decimals = 2) {
  const x = n(v)
  return `${x.toLocaleString('it-IT', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })}%`
}

function ratio(v) {
  const x = n(v)
  return `${x.toLocaleString('it-IT', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}x`
}

function metric(row, key) {
  return row?.metrics?.[key] ?? row?.[key] ?? 0
}

function trend(v, inverse = false) {
  if (v == null) return MUTED
  const good = inverse ? v < 0 : v > 0
  return good ? GREEN : RED
}

function MetricCard({ label, value }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderRadius: 10,
      padding: 20,
      minHeight: 96,
    }}>
      <div style={{
        color: MUTED,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.16em',
        textTransform: 'uppercase',
        marginBottom: 12,
      }}>
        {label}
      </div>
      <div style={{
        color: TEXT,
        fontSize: 26,
        fontWeight: 900,
        fontFamily: 'serif',
      }}>
        {value}
      </div>
    </div>
  )
}

function DeltaBox({ label, value, inverse }) {
  return (
    <div style={{
      background: '#081020',
      border: `1px solid ${BORDER}`,
      borderRadius: 8,
      padding: 14,
    }}>
      <div style={{
        color: MUTED,
        fontSize: 11,
        fontWeight: 800,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>
        {label}
      </div>
      <div style={{
        color: value == null ? MUTED : trend(value, inverse),
        fontSize: 22,
        fontWeight: 900,
      }}>
        {value == null ? '—' : `${value > 0 ? '+' : ''}${value.toFixed(1)}%`}
      </div>
    </div>
  )
}

function Cell({ children, bold, green, blue }) {
  return (
    <td style={{
      padding: '13px 14px',
      borderTop: `1px solid ${BORDER}`,
      color: green ? GREEN : blue ? BLUE : TEXT,
      fontWeight: bold ? 900 : 500,
      whiteSpace: 'nowrap',
      verticalAlign: 'middle',
    }}>
      {children}
    </td>
  )
}

function Thumb({ src, name }) {
  if (!src) {
    return (
      <div style={{
        width: 54,
        height: 54,
        borderRadius: 8,
        background: '#111827',
        border: `1px solid ${BORDER}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: MUTED,
        fontSize: 10,
      }}>
        no img
      </div>
    )
  }

  return (
    <img
      src={src}
      alt={name || 'creative'}
      style={{
        width: 54,
        height: 54,
        objectFit: 'cover',
        borderRadius: 8,
        border: `1px solid ${BORDER}`,
        background: '#111827',
      }}
    />
  )
}

export default function MetaPage() {
  const [preset, setPreset] = useState('last_28d')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [openCampaigns, setOpenCampaigns] = useState({})
  const [openAdsets, setOpenAdsets] = useState({})

  async function load(nextPreset = preset) {
    setLoading(true)
    setError('')

    try {
      const params = new URLSearchParams()
      params.set('preset', nextPreset)

      if (nextPreset === 'custom' && since && until) {
        params.set('since', since)
        params.set('until', until)
      }

      const res = await fetch(`/api/meta-detail?${params.toString()}`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!json.ok) {
        setError(json.error || 'Errore caricamento Meta.')
      }

      setData(json)
    } catch (e) {
      setError(e?.message || 'Errore caricamento Meta.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(preset)
  }, [])

  const summary = data?.summary || {}
  const comparison = data?.comparison || {}
  const hierarchy = Array.isArray(data?.hierarchy) ? data.hierarchy : []

  const rows = useMemo(() => {
    const out = []

    for (const campaign of hierarchy) {
      out.push({
        ...campaign,
        type: 'campaign',
        depth: 0,
      })

      if (openCampaigns[campaign.id]) {
        for (const adset of campaign.adsets || []) {
          out.push({
            ...adset,
            type: 'adset',
            depth: 1,
            parentCampaignId: campaign.id,
          })

          if (openAdsets[adset.id]) {
            for (const ad of adset.ads || []) {
              out.push({
                ...ad,
                type: 'ad',
                depth: 2,
                parentCampaignId: campaign.id,
                parentAdsetId: adset.id,
              })
            }
          }
        }
      }
    }

    return out
  }, [hierarchy, openCampaigns, openAdsets])

  function toggleCampaign(id) {
    setOpenCampaigns(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  function toggleAdset(id) {
    setOpenAdsets(prev => ({
      ...prev,
      [id]: !prev[id],
    }))
  }

  return (
    <main style={{
      background: BG,
      minHeight: '100vh',
      color: TEXT,
      padding: '32px 28px 80px',
      fontFamily: 'Inter, Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 1500, margin: '0 auto' }}>
        <header style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
        }}>
          <div>
            <h1 style={{ margin: 0, fontSize: 28, fontWeight: 900 }}>
              Meta Detail
            </h1>
            <p style={{ color: MUTED, marginTop: 10, fontSize: 13 }}>
              Analisi gerarchica campagne · ad set · ads attive
            </p>
          </div>

          <div style={{
            color: error ? RED : GREEN,
            fontWeight: 800,
            fontSize: 13,
          }}>
            {loading ? 'Caricamento…' : error ? 'Errore dati' : 'Dati caricati'}
          </div>
        </header>

        <section style={{
          background: CARD,
          border: `1px solid ${BORDER}`,
          borderRadius: 10,
          padding: 18,
          marginBottom: 18,
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 10,
            alignItems: 'center',
          }}>
            {PRESETS.map(p => (
              <button
                key={p.id}
                onClick={() => {
                  setPreset(p.id)
                  load(p.id)
                }}
                style={{
                  border: `1px solid ${p.id === preset ? GREEN : BORDER}`,
                  color: p.id === preset ? GREEN : MUTED,
                  background: p.id === preset ? 'rgba(34,197,94,0.08)' : '#081020',
                  borderRadius: 999,
                  padding: '10px 16px',
                  cursor: 'pointer',
                  fontWeight: 800,
                }}
              >
                {p.label}
              </button>
            ))}

            {preset === 'custom' && (
              <>
                <input
                  type="date"
                  value={since}
                  onChange={e => setSince(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="date"
                  value={until}
                  onChange={e => setUntil(e.target.value)}
                  style={inputStyle}
                />
                <button
                  onClick={() => load('custom')}
                  style={{
                    border: 'none',
                    background: GREEN,
                    color: '#00110a',
                    borderRadius: 999,
                    padding: '10px 16px',
                    cursor: 'pointer',
                    fontWeight: 900,
                  }}
                >
                  Applica
                </button>
              </>
            )}

            <button
              onClick={() => load(preset)}
              style={{
                marginLeft: 'auto',
                border: 'none',
                background: GREEN,
                color: '#00110a',
                borderRadius: 999,
                padding: '10px 18px',
                cursor: 'pointer',
                fontWeight: 900,
              }}
            >
              ↻ Aggiorna
            </button>
          </div>
        </section>

        {error && (
          <section style={{
            background: 'rgba(239,68,68,0.08)',
            border: `1px solid ${RED}`,
            color: RED,
            borderRadius: 10,
            padding: 16,
            marginBottom: 18,
            fontWeight: 700,
          }}>
            {error}
          </section>
        )}

        <section style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
          gap: 12,
          marginBottom: 18,
        }}>
          <MetricCard label="Importo speso" value={money(summary.spend)} />
          <MetricCard label="ROAS" value={ratio(summary.roas)} />
          <MetricCard label="Costo risultato" value={money(summary.cost_per_result, 2)} />
          <MetricCard label="Acquisti" value={int(summary.purchases)} />
          <MetricCard label="CTR link" value={pct(summary.ctr_link)} />
        </section>

        <section style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}>
          <div style={panelStyle}>
            <h2 style={titleStyle}>Confronto · periodo vs precedente</h2>
            <p style={{ color: MUTED, fontSize: 13 }}>
              Periodo precedente: {data?.previousRange?.since || '—'} → {data?.previousRange?.until || '—'}
            </p>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              marginTop: 16,
            }}>
              <DeltaBox label="Spesa" value={comparison.spend} inverse />
              <DeltaBox label="ROAS" value={comparison.roas} />
              <DeltaBox label="CPA" value={comparison.cpa} inverse />
              <DeltaBox label="CTR" value={comparison.ctr} />
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={titleStyle}>Insight automatico</h2>
            <p style={{ lineHeight: 1.65, color: '#d7deea', fontSize: 14 }}>
              {data?.insight || '—'}
            </p>
          </div>
        </section>

        <section style={panelStyle}>
          <h2 style={titleStyle}>To-do consigliate</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {(data?.todos || []).map((todo, i) => (
              <div
                key={`${todo}-${i}`}
                style={{
                  border: `1px solid ${BORDER}`,
                  background: '#081020',
                  borderRadius: 8,
                  padding: '13px 14px',
                  color: '#d7deea',
                  lineHeight: 1.5,
                }}
              >
                <strong style={{ color: GREEN }}>#{i + 1}</strong> {todo}
              </div>
            ))}
          </div>
        </section>

        <section style={{
          ...panelStyle,
          marginTop: 18,
          overflow: 'hidden',
        }}>
          <h2 style={titleStyle}>Gerarchia Meta · campagne / ad set / ads</h2>
          <p style={{ color: MUTED, fontSize: 13, marginBottom: 18 }}>
            Mostra solo campagne attive. Clicca su una campagna per aprire gli ad set attivi. Clicca su un ad set per aprire le ads attive.
          </p>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              minWidth: 1800,
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr>
                  {[
                    'Livello',
                    'Anteprima',
                    'Impression',
                    'Copertura',
                    'Freq.',
                    'CPM',
                    'CTR link',
                    'CPC link',
                    'Click link',
                    'Speso',
                    'Costo risultato',
                    'ROAS',
                    'Acquisti',
                    'Conv. acquisti',
                    'CRO campagna',
                    'AOV campagna',
                  ].map(h => (
                    <th
                      key={h}
                      style={{
                        textAlign: 'left',
                        padding: '12px 14px',
                        color: TEXT,
                        fontSize: 11,
                        letterSpacing: '0.15em',
                        textTransform: 'uppercase',
                        borderBottom: `1px solid ${BORDER}`,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <Cell>
                      Nessuna campagna attiva disponibile nel periodo selezionato.
                    </Cell>
                  </tr>
                )}

                {rows.map(row => {
                  const isCampaign = row.type === 'campaign'
                  const isAdset = row.type === 'adset'
                  const isAd = row.type === 'ad'

                  const isOpenCampaign = openCampaigns[row.id]
                  const isOpenAdset = openAdsets[row.id]

                  return (
                    <tr
                      key={`${row.type}-${row.id}`}
                      style={{
                        background:
                          isCampaign ? '#0c1830' :
                          isAdset ? '#081426' :
                          '#07101e',
                      }}
                    >
                      <Cell bold green={isCampaign}>
                        <button
                          onClick={() => {
                            if (isCampaign) toggleCampaign(row.id)
                            if (isAdset) toggleAdset(row.id)
                          }}
                          disabled={isAd}
                          style={{
                            border: 'none',
                            background: 'transparent',
                            color: isCampaign ? GREEN : isAdset ? TEXT : MUTED,
                            fontWeight: 900,
                            cursor: isAd ? 'default' : 'pointer',
                            padding: 0,
                            textAlign: 'left',
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                          }}
                        >
                          <span style={{ width: 18 }}>
                            {isCampaign ? (isOpenCampaign ? '▾' : '▸') : ''}
                            {isAdset ? (isOpenAdset ? '▾' : '▸') : ''}
                            {isAd ? '•' : ''}
                          </span>

                          <span style={{ paddingLeft: row.depth * 22 }}>
                            {isCampaign && `Campagna · ${row.name}`}
                            {isAdset && `Ad set · ${row.name}`}
                            {isAd && `Ad · ${row.name}`}
                          </span>
                        </button>
                      </Cell>

                      <Cell>
                        {isAd ? <Thumb src={row.thumbnail_url} name={row.name} /> : '—'}
                      </Cell>

                      <Cell>{int(metric(row, 'impressions'))}</Cell>
                      <Cell>{int(metric(row, 'reach'))}</Cell>
                      <Cell>{n(metric(row, 'frequency')).toFixed(2)}</Cell>
                      <Cell>{money(metric(row, 'cpm'), 2)}</Cell>
                      <Cell>{pct(metric(row, 'ctr_link'))}</Cell>
                      <Cell>{money(metric(row, 'cpc_link'), 2)}</Cell>
                      <Cell>{int(metric(row, 'link_clicks'))}</Cell>
                      <Cell blue>{money(metric(row, 'spend'))}</Cell>
                      <Cell>{money(metric(row, 'cost_per_result'), 2)}</Cell>
                      <Cell>{ratio(metric(row, 'roas'))}</Cell>
                      <Cell>{int(metric(row, 'purchases'))}</Cell>
                      <Cell>{pct(metric(row, 'conversione_acquisti'))}</Cell>
                      <Cell>{pct(metric(row, 'cro_campagna'))}</Cell>
                      <Cell>{money(metric(row, 'aov_campagna'), 2)}</Cell>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  )
}

const inputStyle = {
  background: '#081020',
  color: TEXT,
  border: `1px solid ${BORDER}`,
  borderRadius: 999,
  padding: '10px 14px',
  fontWeight: 700,
}

const panelStyle = {
  background: CARD,
  border: `1px solid ${BORDER}`,
  borderRadius: 10,
  padding: 20,
  marginBottom: 18,
}

const titleStyle = {
  margin: '0 0 14px',
  color: TEXT,
  fontSize: 14,
  fontWeight: 900,
  letterSpacing: '0.18em',
  textTransform: 'uppercase',
}
