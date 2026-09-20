'use client'

import AzioneBarra from './ui/AzioneBarra'
import { Kpi, Scheletro, coloreFamiglia, famigliaDi } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { useStatoTab } from '../../lib/client/statoTab'
import { useEffect, useState } from 'react'
import Icon from './ui/Icon'
import {
  LineChart, Line, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import { getCached, inMemoria, invalidate, leggi, swrFetch } from '../../lib/clientCache'
import { PlatformBadges } from './PlatformIcon'
import DownloadReportButton from './DownloadReportButton'
import PeriodoInBarra from './ui/PeriodoInBarra'
import { tfQuery, tfKey } from '../../lib/tfQuery'
import RecommendationsFeed from './RecommendationsFeed'
import MetaAdsAgent from './MetaAdsAgent'
import { useI18n } from '../../lib/i18n/I18nProvider'
import DriveToStoreCard from './DriveToStoreCard'

// Mini-grafico sparkline per le card KPI
function Sparkline({ data, dataKey, color = '#2997ff', width = 92, height = 30 }) {
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * width},${height - ((v - min) / range) * (height - 4) - 2}`).join(' ')
  // L'id del gradiente finisce in un attributo SVG: si ripuliscono TUTTI i caratteri
  // non alfanumerici, non solo il cancelletto — il colore ora arriva da coloreFamiglia()
  // e potrebbe non essere un esadecimale.
  const gid = `mk-sl-${dataKey}-${String(color).replace(/[^a-zA-Z0-9]/g, '')}`
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ flexShrink: 0, overflow: 'visible' }}>
      <defs>
        <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.35} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={`0,${height} ${pts} ${width},${height}`} fill={`url(#${gid})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─────────────────────────────────────────────────────────────
//  Meta KPI Tab
//  - Card KPI in alto (10 metriche)
//  - Grafici separati sotto (7 grafici: Spend, ROAS, CPO, CTR, CPM,
//    Frequency, Reach)
// ─────────────────────────────────────────────────────────────

const PRESETS = [
  { value: 'today',        label: 'Oggi', labelKey: 'meta.today' },
  { value: 'yesterday',    label: 'Ieri', labelKey: 'meta.yesterday' },
  { value: 'last_7d',      label: '7gg' },
  { value: 'last_14d',     label: '14gg' },
  { value: 'last_28d',     label: '28gg' },
  { value: 'last_30d',     label: '30gg' },
  { value: 'last_90d',     label: '90gg' },
  { value: 'current_month',label: 'Mese', labelKey: 'mkpi.monthShort' },
  { value: 'ytd',          label: 'YTD' },
]

// I soldi passano tutti da lib/client/soldi: stesso simbolo, stesso punto delle
// migliaia, stesso meno in ogni tab. 'auto' = niente decimali sopra mille.
const eur  = v => soldi(v)
const eur2 = v => soldi(v, 'auto')
const num  = v => v != null ? Number(v).toLocaleString('it-IT', { useGrouping: 'always' }) : '—'
const pct  = v => v != null ? `${Number(v).toFixed(2)}%` : '—'
const mul  = v => v != null && v > 0 ? `${Number(v).toFixed(2)}x` : '—'

// 'kind' controlla il formato del delta assoluto:
//   money   → mostra € (es. +€1.234)
//   ratio   → mostra unita' (es. +0.12 punti per ROAS/freq)
//   percent → mostra punti percentuali (es. +0.45 pp per CTR)
//   count   → mostra numero (es. +1.234)
// 'lower' = true significa che un calo e' positivo (CPO, CPM, CPC, frequenza).
const KPIS = [
  { key: 'spend',      label: 'Spesa',       labelKey: 'meta.spend',     fmt: eur,  kind: 'money'   },
  { key: 'revenue',    label: 'Revenue',     fmt: eur,  kind: 'money'   },
  { key: 'roas',       label: 'ROAS',        fmt: mul,  kind: 'ratio'   },
  { key: 'purchases',  label: 'Acquisti',    labelKey: 'meta.purchases', fmt: num,  kind: 'count'   },
  { key: 'cpo',        label: 'CPO',         fmt: eur2, kind: 'money',  lower: true },
  { key: 'impressions',label: 'Impressioni', labelKey: 'mkpi.impressions', fmt: num,  kind: 'count'   },
  { key: 'reach',      label: 'Copertura',   labelKey: 'meta.reach',     fmt: num,  kind: 'count'   },
  { key: 'frequency',  label: 'Frequenza',   labelKey: 'meta.frequency', fmt: v => v != null ? Number(v).toFixed(2) : '—', kind: 'ratio', lower: true },
  { key: 'cpm',        label: 'CPM',         fmt: eur2, kind: 'money',  lower: true },
  { key: 'ctr_link',   label: 'CTR link',    labelKey: 'meta.ctrLink',   fmt: pct,  kind: 'percent' },
  { key: 'cpc_link',   label: 'CPC link',    labelKey: 'meta.cpcLink',   fmt: eur2, kind: 'money',  lower: true },
  { key: 'link_clicks',label: 'Click link',  labelKey: 'meta.clickLink', fmt: num,  kind: 'count'   },
]

const CHARTS = [
  { key: 'spend',     label: 'Spending',  fmt: eur  },
  { key: 'roas',      label: 'ROAS',      fmt: mul  },
  { key: 'cpo',       label: 'CPO',       fmt: eur2 },
  { key: 'ctr_link',  label: 'CTR link',  labelKey: 'meta.ctrLink',   fmt: pct  },
  { key: 'cpm',       label: 'CPM',       fmt: eur2 },
  { key: 'frequency', label: 'Frequenza', labelKey: 'meta.frequency', fmt: v => v != null ? Number(v).toFixed(2) : '—' },
  { key: 'reach',     label: 'Copertura', labelKey: 'meta.reach',     fmt: num  },
]


export default function MetaKpiTab({ live, globalPreset }) {
  const { t } = useI18n()
  // useStatoTab, non useState: il periodo scelto sopravvive al cambio di tab, cosi'
  // tornando qui non si riparte da "7gg" e non si rifa' un caricamento inutile.
  const [tf, setTf] = useStatoTab('metaKpi.tf', { preset: 'last_7d' })
  const preset = tf.preset
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const load = (force = false) => {
    let cancelled = false
    const key = `meta-kpi:${tfKey(tf)}`
    if (force) invalidate(key)
    const cached = !force ? getCached(key) : null
    if (cached) {
      setData(cached.data)
    } else {
      setLoading(true)
    }
    setError(null)
    swrFetch({
      key, forceRefresh: force,
      fetcher: () => fetch(`/api/meta-kpi?${tfQuery(tf)}`).then(r => r.json()),
      onUpdate: fresh => { if (!cancelled) setData(fresh) },
    })
      .then(({ data: j }) => {
        if (cancelled) return
        if (j?.error && !j?.totals) setError(j.error)
        if (!cached || force) setData(j)
      })
      .catch(e => { if (!cancelled && !cached) setError(e?.message) })
      .finally(() => { if (!cancelled && !cached) setLoading(false) })
    return () => { cancelled = true }
  }

  useEffect(() => {
    const cleanup = load()
    return cleanup
  }, [tf]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Segmenti di pubblico (Tutti / Nuovo / Esistenti / Interagito / Sconosciuto) ──
  const [seg, setSeg] = useState('all')
  const [segData, setSegData] = useState(null)
  const range = data?.range
  useEffect(() => {
    if (!range?.since || !range?.until) return
    let cancelled = false
    const url = `/api/meta-segments?preset=custom&since=${range.since}&until=${range.until}`
    // Se quello stesso periodo e' gia' stato letto in questa sessione lo si rimette
    // subito: cambiando linguetta i segmenti non devono tornare "in caricamento".
    const gia = inMemoria(url)
    setSegData(gia?.ok ? gia.segments : null)
    leggi(url)
      .then(j => { if (!cancelled && j?.ok) setSegData(j.segments) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [range?.since, range?.until])

  const SEG_TABS = [
    { id: 'all', label: t('seg.all', null, 'All'), color: '#2997ff' },
    { id: 'new', label: t('seg.new', null, 'New audience'), color: '#22c55e' },
    { id: 'returning', label: t('seg.returning', null, 'Existing customers'), color: '#2997ff' },
    { id: 'engaged', label: t('seg.engaged', null, 'Engaged'), color: '#f59e0b' },
    { id: 'unknown', label: t('seg.unknown', null, 'Unknown'), color: '#8c8c8c' },
  ]
  const segView = seg !== 'all' ? (segData?.[seg] || null) : null
  const totals = segView ? segView.totals : (data?.totals || {})
  const prevTotals = segView ? segView.prevTotals : (data?.prevTotals || {})
  const daily = segView ? (segView.daily || []) : (Array.isArray(data?.daily) ? data.daily : [])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Header: titolo + preset selector + Aggiorna */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 120, display: 'flex', alignItems: 'center', gap: 10 }}>
          <PlatformBadges sources={['meta']} size={26} />
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 13, fontWeight: 640, letterSpacing: '0.06em' }}>
            <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: 'none' }} />
            LIVE
          </span>
        </div>
        {/* Periodo e Aggiorna si disegnano nella barra in alto della cornice (portal su
            #barra-periodo / #barra-azioni, esposti da AppShell): stanno nello stesso
            punto in ogni tab. Il PDF resta qui perche' e' un'azione della tab. */}
        <div className="report-toolbar" style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <PeriodoInBarra value={tf} onChange={setTf} disabled={loading} />
          <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => load(true)} disabled={loading} gira={loading} />
          <DownloadReportButton tab="Meta KPI" preset={tf.preset === 'custom' ? undefined : tf.preset} custom={tf.preset === 'custom' ? { since: tf.since, until: tf.until } : undefined} />
        </div>
      </div>

      {/* Drive to Store: spesa scorporata da ROAS/CPO e mostrata a parte. Sul SaaS vale
          solo per chi ha dichiarato negozi fisici: il gate sta nella route, che a
          interruttore spento risponde { attivo: false } e la scheda non si monta
          (regge anche una risposta senza dati: si nasconde da sola). */}
      <DriveToStoreCard preset={tf.preset === 'custom' ? undefined : tf.preset} since={tf.preset === 'custom' ? tf.since : undefined} until={tf.preset === 'custom' ? tf.until : undefined} />

      {error && (
        <div className="glass-card-static" style={{ padding: 18, color: '#fca5a5', fontSize: 13 }}><Icon name="warning" size={13} /> {error}</div>
      )}

      {/* L'attesa ha gia' la forma di quello che arriva: la pagina non salta. */}
      {loading && !data && <Scheletro kpi={6} righe={0} />}

      {data && (
        <>
          {/* Tab segmenti di pubblico (dato reale Meta) */}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
            {SEG_TABS.map(s => {
              const active = seg === s.id
              const disabled = s.id !== 'all' && !segData
              return (
                <button key={s.id} type="button" onClick={() => setSeg(s.id)} disabled={disabled}
                  style={{
                    padding: '8px 14px', borderRadius: 12, fontSize: 13, fontWeight: 640, cursor: disabled ? 'default' : 'pointer',
                    background: active ? `${s.color}22` : 'rgba(255,255,255,0.04)',
                    border: active ? `1px solid ${s.color}` : '1px solid var(--border)',
                    color: active ? 'var(--text)' : 'var(--text2)', opacity: disabled ? 0.5 : 1, whiteSpace: 'nowrap',
                  }}>{s.label}</button>
              )
            })}
            {seg !== 'all' && !segData && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('seg.loadingSegments', null, 'loading segments…')}</span>}
            {seg !== 'all' && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('seg.realData', null, 'real Meta data by audience segment')}</span>}
          </div>

          {/* CARD KPI — minmax(min(100%, …)) perche' su telefono una colonna piu' larga
              dello schermo fa scorrere la pagina in orizzontale. */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 200px), 1fr))',
            gap: 12,
          }}>
            {KPIS.map(k => (
              <KpiCard key={k.key} kpi={k} value={totals[k.key]} prev={prevTotals[k.key]} daily={daily} />
            ))}
          </div>

          {/* GRAFICI SEPARATI */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 420px), 1fr))',
            gap: 16,
          }}>
            {CHARTS.map(c => (
              <SeparateChart key={c.key} chart={c} daily={daily} />
            ))}
          </div>

          {/* Raccomandazioni proattive (come in Dashboard) */}
          <RecommendationsFeed metrics={live} preset={globalPreset || preset} />
        </>
      )}

      {/* Agente verticalizzato Meta Ads. Il fork per un cliente solo lo aveva tolto:
          qui resta montato perche' e' l'agente della tab e riceve proprio i numeri che
          si stanno guardando (segmento compreso). Va montato FUORI dal blocco `data`,
          cosi' c'e' anche mentre i KPI arrivano. */}
      <MetaAdsAgent
        data={{ summary: totals, previousSummary: prevTotals, dailySeries: daily, range: data?.range, rows: [] }}
        preset={preset}
      />
    </div>
  )
}

// ── Card KPI singola ─────────────────────────────────────────
function KpiCard({ kpi, value, prev, daily }) {
  const { t } = useI18n()
  const v = Number(value || 0)
  const p = Number(prev || 0)
  const hasPrev = prev != null && Number.isFinite(p)
  const absDelta = hasPrev ? v - p : null
  const pctDelta = hasPrev && p !== 0 ? ((v - p) / Math.abs(p)) * 100 : null

  // Per metriche "lower is better" un calo (delta negativo) e' positivo.
  const isPositive = absDelta == null ? null
                   : kpi.lower ? absDelta < 0
                   : absDelta > 0

  const fmtAbs = (d) => {
    if (d == null) return ''
    const sign = d > 0 ? '+' : d < 0 ? '−' : ''
    const x = Math.abs(d)
    switch (kpi.kind) {
      case 'money':   return `${sign}${soldi(x, x < 100 ? 2 : 0)}`
      case 'ratio':   return `${sign}${x.toFixed(2)}`
      case 'percent': return `${sign}${x.toFixed(2)} pp`
      case 'count':   return `${sign}${x.toLocaleString('it-IT', { maximumFractionDigits: 0, useGrouping: 'always' })}`
      default:        return `${sign}${x.toFixed(2)}`
    }
  }

  // Il mattone <Kpi> disegna la scheda come in ogni altra tab: il verde/rosso della
  // variazione lo decide lui, a partire da `inverso` (per CPO, CPM, CPC, frequenza
  // scendere e' una buona notizia).
  const fam = famigliaDi(kpi.key)
  return (
    <Kpi etichetta={t(kpi.labelKey, null, kpi.label)} valore={kpi.fmt(value)} famiglia={fam} fonti={['meta']}
      delta={hasPrev && Math.abs(absDelta) > 0.0001 ? pctDelta : null} inverso={!!kpi.lower}
      grafico={<Sparkline data={daily} dataKey={kpi.key} color={coloreFamiglia(fam)} />}>
      {hasPrev && Math.abs(absDelta) > 0.0001 && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)' }}>{fmtAbs(absDelta)}</span>}
      {hasPrev && Math.abs(absDelta) <= 0.0001 && <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)' }}>{t('mkpi.samePrev', null, '= periodo precedente')}</span>}
    </Kpi>
  )
}

// ── Singolo grafico separato ─────────────────────────────────
function SeparateChart({ chart, daily }) {
  const { t } = useI18n()
  const series = daily.map(d => ({
    date: (d.date || '').slice(5),
    v: d[chart.key] ?? 0,
  }))

  return (
    <div className="glass-card-static" style={{ padding: 20 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 640, letterSpacing: '0.12em', textTransform: 'uppercase' }}>
            {t('mkpi.trend', null, 'Andamento')}
          </div>
          <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', marginTop: 3 }}>{t(chart.labelKey, null, chart.label)}</div>
        </div>
        <PlatformBadges sources={['meta']} size={16} />
      </div>
      <div style={{ height: 220 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={series}>
            <defs>
              <linearGradient id={`grad-${chart.key}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"  stopColor="var(--text)" stopOpacity={0.18} />
                <stop offset="100%" stopColor="var(--text)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
            <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text3)' }} />
            <YAxis tick={{ fontSize: 10, fill: 'var(--text3)' }} width={50} />
            {/* Il riquadro del valore segue il tema: con un fondo scuro fisso, sul tema
                chiaro era una macchia nera. */}
            <Tooltip
              contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
              formatter={v => [chart.fmt(v), t(chart.labelKey, null, chart.label)]}
            />
            <Area type="monotone" dataKey="v" stroke="var(--text)" fill={`url(#grad-${chart.key})`} strokeWidth={1.5} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
