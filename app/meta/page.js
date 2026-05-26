'use client'

import { useEffect, useMemo, useState } from 'react'

const DARK = '#030817'
const CARD = '#0a1020'
const LINE = '#1e2d47'
const WHITE = '#f8fafc'
const MUTED = '#64748b'
const GREEN = '#22c55e'
const BLUE = '#3b82f6'
const RED = '#ef4444'
const YELLOW = '#eab308'

const money = n =>
  n != null && Number(n) > 0
    ? `€${Number(n).toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    : '—'

const money0 = n =>
  n != null && Number(n) > 0
    ? `€${Math.round(Number(n)).toLocaleString('it-IT')}`
    : '—'

const int0 = n =>
  n != null && Number(n) > 0
    ? Math.round(Number(n)).toLocaleString('it-IT')
    : '—'

const pct = n =>
  n != null && Number.isFinite(Number(n))
    ? `${Number(n).toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
    : '—'

const dec = n =>
  n != null && Number.isFinite(Number(n))
    ? Number(n).toLocaleString('it-IT', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    : '—'

const safeNum = v => {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const div = (a, b) => {
  const x = Number(a)
  const y = Number(b)
  if (!Number.isFinite(x) || !Number.isFinite(y) || y <= 0) return null
  return x / y
}

const iso = d => d.toISOString().slice(0, 10)

const todayLocal = () => {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  return d
}

const addDays = (d, days) => {
  const x = new Date(d)
  x.setDate(x.getDate() + days)
  return x
}

const startOfMonth = d => new Date(d.getFullYear(), d.getMonth(), 1)

const endOfMonth = d => new Date(d.getFullYear(), d.getMonth() + 1, 0)

const getPresetRange = preset => {
  const t = todayLocal()

  if (preset === 'today') return { from: iso(t), to: iso(t) }

  if (preset === 'yesterday') {
    const y = addDays(t, -1)
    return { from: iso(y), to: iso(y) }
  }

  if (preset === 'last7') return { from: iso(addDays(t, -6)), to: iso(t) }

  if (preset === 'last14') return { from: iso(addDays(t, -13)), to: iso(t) }

  if (preset === 'last28') return { from: iso(addDays(t, -27)), to: iso(t) }

  if (preset === 'thisMonth') {
    return { from: iso(startOfMonth(t)), to: iso(t) }
  }

  if (preset === 'lastMonth') {
    const lm = new Date(t.getFullYear(), t.getMonth() - 1, 1)
    return { from: iso(startOfMonth(lm)), to: iso(endOfMonth(lm)) }
  }

  return { from: iso(addDays(t, -6)), to: iso(t) }
}

const getRowDate = r =>
  r.date ||
  r.day ||
  r.date_start ||
  r.dateStart ||
  r.start_date ||
  r.week ||
  r.week_start ||
  r.month ||
  null

const inRange = (row, from, to) => {
  const d = getRowDate(row)
  if (!d) return true
  const date = String(d).slice(0, 10)
  return date >= from && date <= to
}

const normalizeRow = raw => {
  const impressions = safeNum(raw.impressions)
  const reach = safeNum(raw.reach)
  const spend = safeNum(raw.spend ?? raw.amount_spent ?? raw.importo_speso)
  const linkClicks = safeNum(raw.linkClicks ?? raw.link_clicks ?? raw.inline_link_clicks)
  const clicks = safeNum(raw.clicks)
  const purchases = safeNum(raw.purchases ?? raw.purchase ?? raw.acquisti)
  const revenue = safeNum(raw.revenue ?? raw.purchaseValue ?? raw.purchase_value ?? raw.conversion_value)
  const video3s = safeNum(raw.video3s ?? raw.video_3_sec_views ?? raw.thruplays_3s ?? raw.video_views_3s)

  const cpm = raw.cpm != null ? safeNum(raw.cpm) : div(spend * 1000, impressions)
  const ctrLink =
    raw.ctrLink != null
      ? safeNum(raw.ctrLink)
      : raw.ctr_link != null
        ? safeNum(raw.ctr_link)
        : impressions > 0
          ? (linkClicks / impressions) * 100
          : null

  const cpcLink =
    raw.cpcLink != null
      ? safeNum(raw.cpcLink)
      : raw.cpc_link != null
        ? safeNum(raw.cpc_link)
        : div(spend, linkClicks)

  const costPerResult =
    raw.costPerResult != null
      ? safeNum(raw.costPerResult)
      : raw.cost_per_result != null
        ? safeNum(raw.cost_per_result)
        : div(spend, purchases)

  const roas =
    raw.roas != null
      ? safeNum(raw.roas)
      : raw.purchase_roas != null
        ? safeNum(raw.purchase_roas)
        : div(revenue, spend)

  const purchaseConversion =
    raw.purchaseConversion != null
      ? safeNum(raw.purchaseConversion)
      : raw.purchase_conversion != null
        ? safeNum(raw.purchase_conversion)
        : linkClicks > 0
          ? (purchases / linkClicks) * 100
          : null

  const croCampaign =
    raw.croCampaign != null
      ? safeNum(raw.croCampaign)
      : raw.cro_campaign != null
        ? safeNum(raw.cro_campaign)
        : linkClicks > 0
          ? (purchases / linkClicks) * 100
          : null

  const aovCampaign =
    raw.aovCampaign != null
      ? safeNum(raw.aovCampaign)
      : raw.aov_campaign != null
        ? safeNum(raw.aov_campaign)
        : div(revenue, purchases)

  const hookRate =
    raw.hookRate != null
      ? safeNum(raw.hookRate)
      : raw.hook_rate != null
        ? safeNum(raw.hook_rate)
        : impressions > 0
          ? (video3s / impressions) * 100
          : null

  return {
    id: raw.id || raw.ad_id || raw.adset_id || raw.campaign_id || `${raw.name || 'row'}-${Math.random()}`,
    level: raw.level || raw.type || raw.entityLevel || 'campaign',
    date: getRowDate(raw),
    campaignId: raw.campaignId || raw.campaign_id || raw.campaign?.id || null,
    campaignName: raw.campaignName || raw.campaign_name || raw.campaign?.name || raw.name || 'Campagna',
    adsetId: raw.adsetId || raw.adset_id || raw.adset?.id || null,
    adsetName: raw.adsetName || raw.adset_name || raw.adset?.name || 'Ad set',
    adId: raw.adId || raw.ad_id || raw.ad?.id || null,
    adName: raw.adName || raw.ad_name || raw.ad?.name || raw.name || 'Ad',
    name: raw.name || raw.adName || raw.ad_name || raw.campaignName || raw.campaign_name || '—',
    thumbnail:
      raw.thumbnail ||
      raw.thumbnail_url ||
      raw.image_url ||
      raw.imageUrl ||
      raw.creative?.thumbnail_url ||
      raw.creative?.image_url ||
      null,
    impressions,
    reach,
    cpm,
    ctrLink,
    cpcLink,
    linkClicks,
    spend,
    costPerResult,
    roas,
    purchases,
    purchaseConversion,
    croCampaign,
    aovCampaign,
    hookRate,
    revenue,
  }
}

const sumRows = rows => {
  const spend = rows.reduce((s, r) => s + safeNum(r.spend), 0)
  const impressions = rows.reduce((s, r) => s + safeNum(r.impressions), 0)
  const reach = rows.reduce((s, r) => s + safeNum(r.reach), 0)
  const linkClicks = rows.reduce((s, r) => s + safeNum(r.linkClicks), 0)
  const purchases = rows.reduce((s, r) => s + safeNum(r.purchases), 0)
  const revenue = rows.reduce((s, r) => s + safeNum(r.revenue), 0)

  return {
    impressions,
    reach,
    spend,
    linkClicks,
    purchases,
    revenue,
    cpm: div(spend * 1000, impressions),
    ctrLink: impressions > 0 ? (linkClicks / impressions) * 100 : null,
    cpcLink: div(spend, linkClicks),
    costPerResult: div(spend, purchases),
    roas: div(revenue, spend),
    purchaseConversion: linkClicks > 0 ? (purchases / linkClicks) * 100 : null,
    croCampaign: linkClicks > 0 ? (purchases / linkClicks) * 100 : null,
    aovCampaign: div(revenue, purchases),
    hookRate: null,
  }
}

const buildHierarchy = rows => {
  const campaigns = {}

  for (const row of rows) {
    const cKey = row.campaignId || row.campaignName || 'Campagna'
    if (!campaigns[cKey]) {
      campaigns[cKey] = {
        id: cKey,
        name: row.campaignName || row.name || 'Campagna',
        rows: [],
        adsets: {},
      }
    }

    campaigns[cKey].rows.push(row)

    const aKey = row.adsetId || row.adsetName || 'Ad set'
    if (!campaigns[cKey].adsets[aKey]) {
      campaigns[cKey].adsets[aKey] = {
        id: aKey,
        name: row.adsetName || 'Ad set',
        rows: [],
        ads: [],
      }
    }

    campaigns[cKey].adsets[aKey].rows.push(row)

    campaigns[cKey].adsets[aKey].ads.push({
      ...row,
      name: row.adName || row.name || 'Ad',
    })
  }

  return Object.values(campaigns).map(c => ({
    ...c,
    metrics: sumRows(c.rows),
    adsets: Object.values(c.adsets).map(a => ({
      ...a,
      metrics: sumRows(a.rows),
      ads: a.ads,
    })),
  }))
}

const deltaPct = (current, previous) => {
  const c = Number(current)
  const p = Number(previous)
  if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0) return null
  return ((c - p) / p) * 100
}

function MetricCard({ label, value, sub }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${LINE}`,
      borderRadius: 10,
      padding: 16,
    }}>
      <div style={{
        color: MUTED,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        fontWeight: 800,
        marginBottom: 8,
      }}>
        {label}
      </div>
      <div style={{
        color: WHITE,
        fontSize: 24,
        fontWeight: 900,
        fontFamily: 'Barlow',
      }}>
        {value}
      </div>
      {sub && (
        <div style={{ color: MUTED, fontSize: 12, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function PresetButton({ active, children, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        border: `1px solid ${active ? GREEN : LINE}`,
        background: active ? '#052e16' : 'transparent',
        color: active ? GREEN : MUTED,
        borderRadius: 999,
        padding: '7px 12px',
        fontSize: 12,
        fontWeight: 800,
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}

function MetricRow({ title, m, level = 0, thumbnail }) {
  const pad = level === 0 ? 0 : level === 1 ? 24 : 48
  const bg = level === 0 ? '#081226' : level === 1 ? '#07101f' : 'transparent'

  return (
    <tr style={{ background: bg }}>
      <td style={{ ...td, paddingLeft: 14 + pad, minWidth: 320 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {thumbnail ? (
            <img
              src={thumbnail}
              alt=""
              style={{
                width: 46,
                height: 46,
                borderRadius: 8,
                objectFit: 'cover',
                border: `1px solid ${LINE}`,
              }}
            />
          ) : level === 2 ? (
            <div style={{
              width: 46,
              height: 46,
              borderRadius: 8,
              border: `1px solid ${LINE}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: MUTED,
              fontSize: 10,
            }}>
              no img
            </div>
          ) : null}

          <div>
            <div style={{
              color: level === 0 ? GREEN : WHITE,
              fontWeight: 900,
              fontSize: level === 0 ? 14 : 13,
            }}>
              {level === 0 ? 'Campagna · ' : level === 1 ? 'Ad set · ' : 'Ad · '}
              {title}
            </div>
            {level === 2 && (
              <div style={{ color: MUTED, fontSize: 11, marginTop: 3 }}>
                Anteprima creatività
              </div>
            )}
          </div>
        </div>
      </td>
      <td style={td}>{int0(m.impressions)}</td>
      <td style={td}>{int0(m.reach)}</td>
      <td style={td}>{money(m.cpm)}</td>
      <td style={td}>{pct(m.ctrLink)}</td>
      <td style={td}>{money(m.cpcLink)}</td>
      <td style={td}>{int0(m.linkClicks)}</td>
      <td style={td}>{money0(m.spend)}</td>
      <td style={td}>{money(m.costPerResult)}</td>
      <td style={td}>{m.roas != null ? `${dec(m.roas)}x` : '—'}</td>
      <td style={td}>{int0(m.purchases)}</td>
      <td style={td}>{pct(m.purchaseConversion)}</td>
      <td style={td}>{pct(m.croCampaign)}</td>
      <td style={td}>{money(m.aovCampaign)}</td>
      <td style={td}>{pct(m.hookRate)}</td>
    </tr>
  )
}

const th = {
  padding: '12px 14px',
  color: WHITE,
  borderBottom: `1px solid ${LINE}`,
  textAlign: 'left',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  fontWeight: 900,
  whiteSpace: 'nowrap',
}

const td = {
  padding: '12px 14px',
  color: WHITE,
  borderBottom: '1px solid #111827',
  fontSize: 13,
  whiteSpace: 'nowrap',
}

export default function MetaPage() {
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [preset, setPreset] = useState('last7')
  const [customFrom, setCustomFrom] = useState(getPresetRange('last7').from)
  const [customTo, setCustomTo] = useState(getPresetRange('last7').to)

  const range = useMemo(() => {
    if (preset === 'custom') return { from: customFrom, to: customTo }
    return getPresetRange(preset)
  }, [preset, customFrom, customTo])

  useEffect(() => {
    async function run() {
      setLoading(true)
      try {
        const r = await fetch('/api/metrics', { cache: 'no-store' })
        const j = await r.json()
        setLive(j)
      } catch (e) {
        console.error(e)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [])

  const rawRows = useMemo(() => {
    const arr =
      live?.metaHierarchy ||
      live?.metaDetail ||
      live?.metaInsights ||
      live?.metaAds ||
      live?.metaWeekly ||
      []

    return Array.isArray(arr) ? arr : []
  }, [live])

  const rows = useMemo(() => rawRows.map(normalizeRow), [rawRows])

  const filtered = useMemo(
    () => rows.filter(r => inRange(r, range.from, range.to)),
    [rows, range]
  )

  const hierarchy = useMemo(() => buildHierarchy(filtered), [filtered])

  const totals = useMemo(() => sumRows(filtered), [filtered])

  const compare = useMemo(() => {
    const to = new Date(range.from)
    to.setDate(to.getDate() - 1)

    const from = new Date(to)
    from.setDate(from.getDate() - 6)

    const previousRows = rows.filter(r => inRange(r, iso(from), iso(to)))
    const previous = sumRows(previousRows)

    return {
      from: iso(from),
      to: iso(to),
      previous,
      spendDelta: deltaPct(totals.spend, previous.spend),
      roasDelta: deltaPct(totals.roas, previous.roas),
      cpaDelta: deltaPct(totals.costPerResult, previous.costPerResult),
      ctrDelta: deltaPct(totals.ctrLink, previous.ctrLink),
    }
  }, [rows, range, totals])

  const todo = useMemo(() => {
    const list = []

    if (totals.ctrLink != null && totals.ctrLink < 1) {
      list.push('CTR link basso: testa nuovi hook creativi e prime righe copy più dirette. [Inferenza]')
    }

    if (totals.hookRate != null && totals.hookRate < 25) {
      list.push('Hook Rate sotto soglia: cambia i primi 3 secondi dei video, mostrando subito beneficio, problema o risultato. [Inferenza]')
    }

    if (totals.costPerResult != null && totals.roas != null && totals.roas < 1.5) {
      list.push('ROAS debole rispetto al costo per risultato: riduci budget sulle ads con CPA alto e rialloca su creatività con migliore conversione. [Inferenza]')
    }

    if (totals.purchases <= 0 && totals.linkClicks > 0) {
      list.push('Ci sono click ma non acquisti: controlla landing, offerta, checkout e coerenza messaggio-annuncio. [Inferenza]')
    }

    if (list.length === 0) {
      list.push('Non emergono criticità automatiche forti dai dati disponibili. Continua a scalare gradualmente le campagne con ROAS e CRO migliori. [Inferenza]')
    }

    return list
  }, [totals])

  const insight = useMemo(() => {
    if (!filtered.length) {
      return 'Non ci sono dati Meta disponibili nel periodo selezionato.'
    }

    return `Nel periodo ${range.from} → ${range.to}, Meta ha generato ${int0(totals.impressions)} impression, ${int0(totals.reach)} persone raggiunte e ${int0(totals.linkClicks)} click sul link, con una spesa totale di ${money0(totals.spend)}. Il ROAS rilevato è ${totals.roas != null ? `${dec(totals.roas)}x` : 'non disponibile'} e il costo per risultato è ${money(totals.costPerResult)}. [Inferenza] In ottica Andromeda, conviene dare più segnali creativi chiari all’algoritmo: creatività differenziate, angoli di comunicazione distinti e segnali di conversione coerenti, evitando troppe varianti quasi uguali.`
  }, [filtered, range, totals])

  return (
    <div style={{
      minHeight: '100vh',
      background: DARK,
      color: WHITE,
      padding: '24px 28px 60px',
      fontFamily: 'Barlow, system-ui, sans-serif',
    }}>
      <div style={{
        maxWidth: 1560,
        margin: '0 auto',
      }}>
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 24,
        }}>
          <div>
            <h1 style={{
              margin: 0,
              fontSize: 22,
              fontWeight: 900,
              letterSpacing: '-0.03em',
            }}>
              Meta Detail
            </h1>
            <p style={{
              margin: '6px 0 0',
              color: MUTED,
              fontSize: 12,
            }}>
              Analisi gerarchica campagne · ad set · ads
            </p>
          </div>

          <div style={{
            color: loading ? YELLOW : GREEN,
            fontSize: 12,
            fontWeight: 800,
          }}>
            {loading ? 'Caricamento…' : 'Dati caricati'}
          </div>
        </div>

        <div style={{
          background: CARD,
          border: `1px solid ${LINE}`,
          borderRadius: 12,
          padding: 18,
          marginBottom: 18,
        }}>
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 8,
            alignItems: 'center',
          }}>
            <PresetButton active={preset === 'today'} onClick={() => setPreset('today')}>Oggi</PresetButton>
            <PresetButton active={preset === 'yesterday'} onClick={() => setPreset('yesterday')}>Ieri</PresetButton>
            <PresetButton active={preset === 'last7'} onClick={() => setPreset('last7')}>Ultimi 7g</PresetButton>
            <PresetButton active={preset === 'last14'} onClick={() => setPreset('last14')}>Ultimi 14g</PresetButton>
            <PresetButton active={preset === 'last28'} onClick={() => setPreset('last28')}>Ultimi 28g</PresetButton>
            <PresetButton active={preset === 'thisMonth'} onClick={() => setPreset('thisMonth')}>Mese corrente</PresetButton>
            <PresetButton active={preset === 'lastMonth'} onClick={() => setPreset('lastMonth')}>Mese scorso</PresetButton>
            <PresetButton active={preset === 'custom'} onClick={() => setPreset('custom')}>Custom</PresetButton>

            {preset === 'custom' && (
              <div style={{ display: 'flex', gap: 8, marginLeft: 8 }}>
                <input
                  type="date"
                  value={customFrom}
                  onChange={e => setCustomFrom(e.target.value)}
                  style={inputStyle}
                />
                <input
                  type="date"
                  value={customTo}
                  onChange={e => setCustomTo(e.target.value)}
                  style={inputStyle}
                />
              </div>
            )}
          </div>
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: 12,
          marginBottom: 18,
        }}>
          <MetricCard label="Importo speso" value={money0(totals.spend)} />
          <MetricCard label="ROAS" value={totals.roas != null ? `${dec(totals.roas)}x` : '—'} />
          <MetricCard label="Costo risultato" value={money(totals.costPerResult)} />
          <MetricCard label="Acquisti" value={int0(totals.purchases)} />
          <MetricCard label="CTR link" value={pct(totals.ctrLink)} />
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: '1.1fr 1fr',
          gap: 18,
          marginBottom: 18,
        }}>
          <div style={panelStyle}>
            <h2 style={panelTitle}>Confronto · ultimi 7g vs 7g precedenti</h2>
            <div style={{
              color: MUTED,
              fontSize: 12,
              marginBottom: 12,
            }}>
              Periodo precedente: {compare.from} → {compare.to}
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
            }}>
              <CompareBox label="Spesa" value={compare.spendDelta} positiveGood={false} />
              <CompareBox label="ROAS" value={compare.roasDelta} positiveGood />
              <CompareBox label="CPA" value={compare.cpaDelta} positiveGood={false} />
              <CompareBox label="CTR" value={compare.ctrDelta} positiveGood />
            </div>
          </div>

          <div style={panelStyle}>
            <h2 style={panelTitle}>Insight automatico</h2>
            <p style={{
              color: '#cbd5e1',
              fontSize: 14,
              lineHeight: 1.6,
              margin: 0,
            }}>
              {insight}
            </p>
          </div>
        </div>

        <div style={panelStyle}>
          <h2 style={panelTitle}>To-do consigliate</h2>
          <div style={{ display: 'grid', gap: 10 }}>
            {todo.map((t, i) => (
              <div key={i} style={{
                border: `1px solid ${LINE}`,
                borderRadius: 8,
                padding: 12,
                color: '#cbd5e1',
                fontSize: 14,
                lineHeight: 1.5,
              }}>
                <strong style={{ color: GREEN }}>#{i + 1}</strong> {t}
              </div>
            ))}
          </div>
        </div>

        <div style={{
          ...panelStyle,
          marginTop: 18,
          padding: 0,
          overflow: 'hidden',
        }}>
          <div style={{
            padding: '18px 18px 0',
          }}>
            <h2 style={panelTitle}>Gerarchia Meta · Campagne / Ad set / Ads</h2>
            <p style={{
              color: MUTED,
              fontSize: 12,
              marginTop: -6,
              marginBottom: 14,
            }}>
              Metriche disponibili per ogni livello. Le ads mostrano anche nome creatività e thumbnail quando presente nei dati.
            </p>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{
              width: '100%',
              minWidth: 1700,
              borderCollapse: 'collapse',
            }}>
              <thead>
                <tr>
                  <th style={th}>Livello</th>
                  <th style={th}>Impression</th>
                  <th style={th}>Copertura</th>
                  <th style={th}>CPM</th>
                  <th style={th}>CTR link</th>
                  <th style={th}>CPC link</th>
                  <th style={th}>Click link</th>
                  <th style={th}>Speso</th>
                  <th style={th}>Costo risultato</th>
                  <th style={th}>ROAS</th>
                  <th style={th}>Acquisti</th>
                  <th style={th}>Conv. acquisti</th>
                  <th style={th}>CRO campagna</th>
                  <th style={th}>AOV campagna</th>
                  <th style={th}>Hook Rate</th>
                </tr>
              </thead>

              <tbody>
                {hierarchy.length ? hierarchy.map(c => (
                  <>
                    <MetricRow key={`c-${c.id}`} title={c.name} m={c.metrics} level={0} />

                    {c.adsets.map(a => (
                      <>
                        <MetricRow key={`a-${c.id}-${a.id}`} title={a.name} m={a.metrics} level={1} />

                        {a.ads.map(ad => (
                          <MetricRow
                            key={`ad-${c.id}-${a.id}-${ad.id}`}
                            title={ad.name}
                            m={ad}
                            level={2}
                            thumbnail={ad.thumbnail}
                          />
                        ))}
                      </>
                    ))}
                  </>
                )) : (
                  <tr>
                    <td style={td} colSpan={15}>
                      Nessun dato Meta disponibile per il periodo selezionato.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}

function CompareBox({ label, value, positiveGood }) {
  const isPositive = value != null && value >= 0
  const good = value == null ? null : positiveGood ? isPositive : !isPositive

  return (
    <div style={{
      border: `1px solid ${LINE}`,
      borderRadius: 8,
      padding: 12,
      background: '#07101f',
    }}>
      <div style={{
        color: MUTED,
        fontSize: 11,
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
        marginBottom: 8,
        fontWeight: 800,
      }}>
        {label}
      </div>

      <div style={{
        color: value == null ? MUTED : good ? GREEN : RED,
        fontWeight: 900,
        fontSize: 20,
      }}>
        {value == null ? '—' : `${value >= 0 ? '+' : ''}${value.toFixed(1)}%`}
      </div>
    </div>
  )
}

const panelStyle = {
  background: CARD,
  border: `1px solid ${LINE}`,
  borderRadius: 12,
  padding: 18,
}

const panelTitle = {
  margin: '0 0 14px',
  color: WHITE,
  fontSize: 13,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  fontWeight: 900,
  fontFamily: 'Barlow Condensed, Barlow, system-ui',
}

const inputStyle = {
  background: '#07101f',
  border: `1px solid ${LINE}`,
  borderRadius: 8,
  color: WHITE,
  padding: '7px 10px',
  fontSize: 12,
  outline: 'none',
}
