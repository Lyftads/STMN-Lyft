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

function num(v) {
  const x = Number(v)
  return Number.isFinite(x) ? x : 0
}

function fmtInt(v) {
  const x = num(v)
  if (!x) return '—'
  return Math.round(x).toLocaleString('it-IT')
}

function fmtEuro(v) {
  const x = num(v)
  if (!x) return '—'
  return `€${Math.round(x).toLocaleString('it-IT')}`
}

function fmtEuro2(v) {
  const x = num(v)
  if (!x) return '—'
  return `€${x.toFixed(2).replace('.', ',')}`
}

function fmtPct(v) {
  const x = num(v)
  if (!x) return '—'
  return `${x.toFixed(2).replace('.', ',')}%`
}

function fmtX(v) {
  const x = num(v)
  if (!x) return '0,00x'
  return `${x.toFixed(2).replace('.', ',')}x`
}

function fmtDelta(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '—'
  const x = Number(v)
  const sign = x > 0 ? '+' : ''
  return `${sign}${x.toFixed(1)}%`
}

function deltaColor(v) {
  if (v === null || v === undefined || Number.isNaN(Number(v))) return '#748199'
  return Number(v) >= 0 ? '#22c55e' : '#ff4d4d'
}

function MetricCard({ label, value }) {
  return (
    <div style={styles.card}>
      <div style={styles.kpiLabel}>{label}</div>
      <div style={styles.kpiValue}>{value}</div>
    </div>
  )
}

function PresetButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        ...styles.preset,
        borderColor: active ? '#22c55e' : '#203453',
        color: active ? '#22c55e' : '#748199',
        background: active ? '#062414' : '#071024',
      }}
    >
      {children}
    </button>
  )
}

function Row({ row, depth, open, loading, onClick }) {
  const canOpen = row.level === 'campaign' || row.level === 'adset'

  return (
    <tr>
      <td style={{ ...styles.td, minWidth: 360 }}>
        <div
          onClick={canOpen ? onClick : undefined}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            paddingLeft: depth * 22,
            cursor: canOpen ? 'pointer' : 'default',
          }}
        >
          {canOpen && (
            <span style={{ color: '#22c55e', width: 18 }}>
              {loading ? '…' : open ? '▾' : '▸'}
            </span>
          )}

          {!canOpen && <span style={{ width: 18 }} />}

          {row.thumbnail_url && (
            <img
              src={row.thumbnail_url}
              alt=""
              style={{
                width: 44,
                height: 44,
                objectFit: 'cover',
                borderRadius: 8,
                border: '1px solid #203453',
              }}
            />
          )}

          <div>
            <div style={{ color: row.level === 'campaign' ? '#22c55e' : '#eef2ff', fontWeight: 800 }}>
              {row.level === 'campaign' ? 'Campagna · ' : row.level === 'adset' ? 'Ad set · ' : 'Ad · '}
              {row.name || '—'}
            </div>
            <div style={{ fontSize: 11, color: '#748199', marginTop: 3 }}>
              {row.id}
            </div>
          </div>
        </div>
      </td>

      <td style={styles.td}>{fmtInt(row.impressions)}</td>
      <td style={styles.td}>{fmtInt(row.reach)}</td>
      <td style={styles.td}>{num(row.frequency).toFixed(2)}</td>
      <td style={styles.td}>{fmtEuro2(row.cpm)}</td>
      <td style={styles.td}>{fmtPct(row.ctr_link)}</td>
      <td style={styles.td}>{fmtEuro2(row.cpc_link)}</td>
      <td style={styles.td}>{fmtInt(row.link_clicks)}</td>
      <td style={styles.td}>{fmtEuro(row.spend)}</td>
      <td style={styles.td}>{fmtEuro2(row.cost_per_result)}</td>
      <td style={styles.td}>{fmtX(row.roas)}</td>
      <td style={styles.td}>{fmtInt(row.purchases)}</td>
      <td style={styles.td}>{fmtPct(row.conversione_acquisti)}</td>
      <td style={styles.td}>{fmtPct(row.cro_campagna)}</td>
      <td style={styles.td}>{fmtEuro2(row.aov_campagna)}</td>
    </tr>
  )
}

export default function MetaPage() {
  const [preset, setPreset] = useState('last_28d')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [openCampaigns, setOpenCampaigns] = useState({})
  const [openAdsets, setOpenAdsets] = useState({})
  const [children, setChildren] = useState({})
  const [loadingNode, setLoadingNode] = useState({})

  async function loadMain(nextPreset = preset) {
    setLoading(true)
    setError('')
    setOpenCampaigns({})
    setOpenAdsets({})
    setChildren({})

    try {
      const res = await fetch(`/api/meta-detail?preset=${nextPreset}`, {
        cache: 'no-store',
      })

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Errore caricamento Meta')
      }

      setData(json)
    } catch (e) {
      setError(e.message)
      setData(null)
    } finally {
      setLoading(false)
    }
  }

  async function loadAdsets(campaign) {
    const key = `campaign:${campaign.id}`

    if (children[key]) {
      setOpenCampaigns(prev => ({ ...prev, [campaign.id]: !prev[campaign.id] }))
      return
    }

    setLoadingNode(prev => ({ ...prev, [key]: true }))

    try {
      const res = await fetch(
        `/api/meta-detail?preset=${encodeURIComponent(preset)}&level=adsets&campaign_id=${encodeURIComponent(campaign.id)}`,
        { cache: 'no-store' }
      )

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Errore caricamento ad set')
      }

      setChildren(prev => ({ ...prev, [key]: json.rows || [] }))
      setOpenCampaigns(prev => ({ ...prev, [campaign.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(prev => ({ ...prev, [key]: false }))
    }
  }

  async function loadAds(adset) {
    const key = `adset:${adset.id}`

    if (children[key]) {
      setOpenAdsets(prev => ({ ...prev, [adset.id]: !prev[adset.id] }))
      return
    }

    setLoadingNode(prev => ({ ...prev, [key]: true }))

    try {
      const res = await fetch(
        `/api/meta-detail?preset=${preset}&level=ads&adset_id=${adset.id}`,
        { cache: 'no-store' }
      )

      const json = await res.json()

      if (!json.ok) {
        throw new Error(json.error || 'Errore caricamento ads')
      }

      setChildren(prev => ({ ...prev, [key]: json.rows || [] }))
      setOpenAdsets(prev => ({ ...prev, [adset.id]: true }))
    } catch (e) {
      setError(e.message)
    } finally {
      setLoadingNode(prev => ({ ...prev, [key]: false }))
    }
  }

  useEffect(() => {
    loadMain('last_28d')
  }, [])

  const summary = data?.summary || {}
  const rows = data?.rows || []
  const comparison = data?.comparison || {}

  const renderedRows = useMemo(() => {
    const out = []

    for (const campaign of rows) {
      out.push({
        row: campaign,
        depth: 0,
      })

      const campaignKey = `campaign:${campaign.id}`

      if (openCampaigns[campaign.id]) {
        const adsets = children[campaignKey] || []

        for (const adset of adsets) {
          out.push({
            row: adset,
            depth: 1,
          })

          const adsetKey = `adset:${adset.id}`

          if (openAdsets[adset.id]) {
            const ads = children[adsetKey] || []

            for (const ad of ads) {
              out.push({
                row: ad,
                depth: 2,
              })
            }
          }
        }
      }
    }

    return out
  }, [rows, openCampaigns, openAdsets, children])

  return (
    <main style={styles.page}>
      <div style={styles.header}>
        <div>
          <h1 style={styles.title}>Meta Detail</h1>
          <p style={styles.subtitle}>Analisi gerarchica campagne · ad set · ads attive</p>
        </div>

        <div style={{ color: data ? '#22c55e' : '#748199', fontWeight: 800, fontSize: 12 }}>
          {loading ? 'Caricamento…' : data ? 'Dati caricati' : '—'}
        </div>
      </div>

      <section style={styles.panel}>
        <div style={styles.presetWrap}>
          {PRESETS.map(p => (
            <PresetButton
              key={p.id}
              active={preset === p.id}
              onClick={() => {
                setPreset(p.id)
                loadMain(p.id)
              }}
            >
              {p.label}
            </PresetButton>
          ))}

          <button
            onClick={() => loadMain(preset)}
            style={styles.refresh}
          >
            ↻ Aggiorna
          </button>
        </div>
      </section>

      {error && (
        <div style={styles.error}>
          {error}
        </div>
      )}

      <section style={styles.kpiGrid}>
        <MetricCard label="Importo speso" value={fmtEuro(summary.spend)} />
        <MetricCard label="ROAS" value={fmtX(summary.roas)} />
        <MetricCard label="Costo risultato" value={fmtEuro2(summary.cost_per_result)} />
        <MetricCard label="Acquisti" value={fmtInt(summary.purchases)} />
        <MetricCard label="CTR link" value={fmtPct(summary.ctr_link)} />
      </section>

      <section style={styles.twoCols}>
        <div style={styles.box}>
          <h2 style={styles.boxTitle}>Confronto · periodo vs precedente</h2>
          <p style={styles.muted}>
            Periodo precedente: {data?.previousRange?.since || '—'} → {data?.previousRange?.until || '—'}
          </p>

          <div style={styles.compGrid}>
            <MetricCard label="Spesa" value={<span style={{ color: deltaColor(comparison.spend) }}>{fmtDelta(comparison.spend)}</span>} />
            <MetricCard label="ROAS" value={<span style={{ color: deltaColor(comparison.roas) }}>{fmtDelta(comparison.roas)}</span>} />
            <MetricCard label="CPA" value={<span style={{ color: deltaColor(comparison.cpa) }}>{fmtDelta(comparison.cpa)}</span>} />
            <MetricCard label="CTR" value={<span style={{ color: deltaColor(comparison.ctr) }}>{fmtDelta(comparison.ctr)}</span>} />
          </div>
        </div>

        <div style={styles.box}>
          <h2 style={styles.boxTitle}>Insight automatico</h2>
          <p style={styles.paragraph}>
            {data?.insight || '—'}
          </p>
        </div>
      </section>

      <section style={styles.box}>
        <h2 style={styles.boxTitle}>To-do consigliate</h2>

        {(data?.todos || []).length > 0 ? (
          <div style={{ display: 'grid', gap: 10 }}>
            {data.todos.map((todo, i) => (
              <div key={i} style={styles.todo}>
                <strong style={{ color: '#22c55e' }}>#{i + 1}</strong> {todo}
              </div>
            ))}
          </div>
        ) : (
          <p style={styles.paragraph}>—</p>
        )}
      </section>

      <section style={styles.box}>
        <h2 style={styles.boxTitle}>Gerarchia Meta · campagne / ad set / ads</h2>
        <p style={styles.muted}>
          Mostra solo campagne attive. Clicca una campagna per aprire gli ad set attivi. Clicca un ad set per aprire le ads attive.
        </p>

        <div style={{ overflowX: 'auto' }}>
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>Livello</th>
                <th style={styles.th}>Impression</th>
                <th style={styles.th}>Copertura</th>
                <th style={styles.th}>Freq.</th>
                <th style={styles.th}>CPM</th>
                <th style={styles.th}>CTR link</th>
                <th style={styles.th}>CPC link</th>
                <th style={styles.th}>Click link</th>
                <th style={styles.th}>Speso</th>
                <th style={styles.th}>Costo risultato</th>
                <th style={styles.th}>ROAS</th>
                <th style={styles.th}>Acquisti</th>
                <th style={styles.th}>Conv. acquisti</th>
                <th style={styles.th}>CRO campagna</th>
                <th style={styles.th}>AOV campagna</th>
              </tr>
            </thead>

            <tbody>
              {renderedRows.length > 0 ? (
                renderedRows.map(({ row, depth }) => {
                  const campaignKey = `campaign:${row.id}`
                  const adsetKey = `adset:${row.id}`

                  return (
                    <Row
                      key={`${row.level}:${row.id}`}
                      row={row}
                      depth={depth}
                      open={row.level === 'campaign' ? openCampaigns[row.id] : openAdsets[row.id]}
                      loading={row.level === 'campaign' ? loadingNode[campaignKey] : loadingNode[adsetKey]}
                      onClick={() => {
                        if (row.level === 'campaign') loadAdsets(row)
                        if (row.level === 'adset') loadAds(row)
                      }}
                    />
                  )
                })
              ) : (
                <tr>
                  <td style={styles.td} colSpan={15}>
                    {loading ? 'Caricamento dati Meta…' : 'Nessuna campagna attiva disponibile nel periodo selezionato.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    background: '#030817',
    color: '#eef2ff',
    padding: '32px 28px',
    fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
  },
  header: {
    maxWidth: 1680,
    margin: '0 auto 28px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  title: {
    margin: 0,
    fontSize: 28,
    fontWeight: 900,
    letterSpacing: '-0.04em',
  },
  subtitle: {
    margin: '10px 0 0',
    color: '#748199',
    fontSize: 14,
  },
  panel: {
    maxWidth: 1680,
    margin: '0 auto 22px',
    background: '#081124',
    border: '1px solid #203453',
    borderRadius: 14,
    padding: 20,
  },
  presetWrap: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: 10,
    alignItems: 'center',
  },
  preset: {
    padding: '10px 16px',
    borderRadius: 999,
    border: '1px solid #203453',
    fontWeight: 800,
    cursor: 'pointer',
  },
  refresh: {
    marginLeft: 'auto',
    padding: '12px 22px',
    borderRadius: 999,
    border: 'none',
    background: '#22c55e',
    color: '#03140a',
    fontWeight: 900,
    cursor: 'pointer',
  },
  error: {
    maxWidth: 1680,
    margin: '0 auto 22px',
    padding: 18,
    borderRadius: 10,
    border: '1px solid #ef4444',
    color: '#ff4d4d',
    background: '#220811',
    fontWeight: 800,
  },
  kpiGrid: {
    maxWidth: 1680,
    margin: '0 auto 22px',
    display: 'grid',
    gridTemplateColumns: 'repeat(5, minmax(0, 1fr))',
    gap: 14,
  },
  card: {
    background: '#081124',
    border: '1px solid #203453',
    borderRadius: 12,
    padding: 20,
    minHeight: 88,
  },
  kpiLabel: {
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    color: '#748199',
    fontWeight: 900,
    marginBottom: 16,
  },
  kpiValue: {
    fontSize: 28,
    fontWeight: 900,
    fontFamily: 'Georgia, serif',
  },
  twoCols: {
    maxWidth: 1680,
    margin: '0 auto 22px',
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 18,
  },
  box: {
    maxWidth: 1680,
    margin: '0 auto 22px',
    background: '#081124',
    border: '1px solid #203453',
    borderRadius: 14,
    padding: 22,
  },
  boxTitle: {
    margin: '0 0 18px',
    fontSize: 14,
    textTransform: 'uppercase',
    letterSpacing: '0.22em',
    fontWeight: 900,
  },
  muted: {
    color: '#748199',
    fontSize: 13,
    marginBottom: 18,
  },
  paragraph: {
    color: '#dbe4f0',
    lineHeight: 1.65,
    fontSize: 15,
  },
  compGrid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
    gap: 12,
  },
  todo: {
    padding: 14,
    border: '1px solid #203453',
    borderRadius: 10,
    background: '#071024',
    color: '#dbe4f0',
    lineHeight: 1.5,
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    minWidth: 1700,
  },
  th: {
    textAlign: 'left',
    padding: '14px 14px',
    borderBottom: '1px solid #203453',
    color: '#ffffff',
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: '0.18em',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '14px 14px',
    borderBottom: '1px solid #12213a',
    color: '#eef2ff',
    fontSize: 14,
    whiteSpace: 'nowrap',
  },
}
