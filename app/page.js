'use client'
import AzioneBarra from './components/ui/AzioneBarra'
import { globalPresetToTf } from '../lib/tfQuery'
import SintesiDashboard from './components/SintesiDashboard'
import SpiegaNumero from './components/SpiegaNumero'
import BriefingMattino from './components/BriefingMattino'
import { ComportamentoClienti, VenditePerProdotto } from './components/DashboardLive'
import { rangeLabel } from './components/ui/BmTimeframe'
import { Kpi, coloreFamiglia } from './components/ui/Mattoni'
import { soldi } from '../lib/client/soldi'
import { localeNumeri, sepDecimali } from '../lib/client/numeri'
import { useState, useEffect, useCallback, useRef } from 'react'

// anti-race fetchLive: la risposta di un preset vecchio non sovrascrive l'attivo
let __liveKey = null
import Icon from './components/ui/Icon'
import { weeklyReportKeys, monthlyReportKeys, quarterReportKeys } from '../lib/reportPeriods.mjs'
import { swrFetch, prefetch, getCached, invalidate, precarica, leggi, segnalaParziale, datiArrivati } from '../lib/clientCache'
import { allowedTabsFor, ALL_TABS } from '../lib/team/roleTabs'
import { BarChart, Bar, LineChart, Line, AreaChart, Area, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Legend } from 'recharts'
import AppShell from './components/AppShell'
import dynamicImport from 'next/dynamic'
import LiveStatsCards from './components/LiveStatsCards'
const DashboardGlobe = dynamicImport(() => import('./components/DashboardGlobe'), { ssr: false })
import Sparkline from './components/Sparkline'
import DeltaBadge from './components/DeltaBadge'
import DownloadReportButton from './components/DownloadReportButton'
import TimeframeSelector from './components/TimeframeSelector'
import { PlatformBadges } from './components/PlatformIcon'
import FloatingBrain from './components/FloatingBrain'
import MatriceReport from './components/ui/MatriceReport'
import { useI18n } from '../lib/i18n/I18nProvider'
import DriveToStoreCard from './components/DriveToStoreCard'
import { TelemetriaGlobo, MossePilota } from './components/MissionControl'
import ReportFilm from './components/ReportFilm'
// La fascia "hai superato gli ordini del piano" e' montata sopra OGNI tab: rimandarla a un
// pezzo di codice a parte costerebbe un giro di rete in piu' per 3 KB che servono sempre.
import PlanUsageBanner from './components/PlanUsageBanner'
import dynamic from 'next/dynamic'

// ── Il CODICE delle tab si carica dopo il primo disegno; i DATI restano tutti precaricati ──
// Misurato il 19 set 2026 sul fork (31 tab importate insieme): 1,5 MB di JavaScript all'avvio e
// 0,8 s di browser bloccato a digerirle, per mostrare la Dashboard. Qui le tab sono 47 — dodici
// in piu', che al fork non servono — quindi il conto di partenza era ancora peggiore, ed e'
// proprio questa la ragione del «molto piu' lento di AV». La regola di Marino — tutto gia'
// pronto, niente attese passando da una tab all'altra — riguarda i DATI, e resta com'e'
// (precarica() piu' sotto). Qui si rimanda solo il codice: la Dashboard parte leggera, e appena
// il browser e' a riposo i pezzi delle altre tab si scaricano uno dopo l'altro (precaricaCodice).
// Chi apre una tab prima che il suo pezzo sia arrivato lo scarica in quel momento.
const importatori = {}
const Pigra = (nome, importa) => { importatori[nome] = importa; return dynamic(importa, { ssr: false, loading: () => <div className="ly-scheletro-tab" aria-busy="true" /> }) }
// Stessa pigrizia, ma senza scheletro: per i pezzi che NON riempiono una tab intera — gli avvisi,
// i consigli, gli agenti che galleggiano in un angolo. Uno scheletro di tab intera al loro posto
// sarebbe un rettangolo grigio piantato in mezzo alla pagina.
const PigraMuta = (nome, importa) => { importatori[nome] = importa; return dynamic(importa, { ssr: false }) }
const KPIBrainTab = Pigra('KPIBrainTab', () => import('./components/KPIBrainTab'))
const ClientiTab = Pigra('ClientiTab', () => import('./components/ClientiTab'))
const HelpCenterTab = Pigra('HelpCenterTab', () => import('./components/HelpCenterTab'))
const CreativeTab = Pigra('CreativeTab', () => import('./components/CreativeTab'))
const MetaDetailTab = Pigra('MetaDetailTab', () => import('./components/MetaDetailTab'))
const EmailMarketingTab = Pigra('EmailMarketingTab', () => import('./components/EmailMarketingTab'))
const IntegrationsTab = Pigra('IntegrationsTab', () => import('./components/IntegrationsTab'))
const SettingsTab = Pigra('SettingsTab', () => import('./components/SettingsTab'))
const BrandIdentityPanel = Pigra('BrandIdentityPanel', () => import('./components/BrandIdentityPanel'))
const CROTab = Pigra('CROTab', () => import('./components/CROTab'))
const WebsiteScannerTab = Pigra('WebsiteScannerTab', () => import('./components/WebsiteScannerTab'))
const SeoAuditTab = Pigra('SeoAuditTab', () => import('./components/SeoAuditTab'))
const PnLTab = Pigra('PnLTab', () => import('./components/PnLTab'))
const OnboardingTab = Pigra('OnboardingTab', () => import('./components/OnboardingTab'))
const TasksTab = Pigra('TasksTab', () => import('./components/TasksTab'))
const CalendarTab = Pigra('CalendarTab', () => import('./components/CalendarTab'))
const TimeOffTab = Pigra('TimeOffTab', () => import('./components/TimeOffTab'))
const TeamManageTab = Pigra('TeamManageTab', () => import('./components/TeamManageTab'))
const CreativeLibraryTab = Pigra('CreativeLibraryTab', () => import('./components/CreativeLibraryTab'))
const ChatTab = Pigra('ChatTab', () => import('./components/ChatTab'))
const CreativeFatiguePanel = Pigra('CreativeFatiguePanel', () => import('./components/CreativeFatiguePanel'))
const MetaKpiTab = Pigra('MetaKpiTab', () => import('./components/MetaKpiTab'))
const LeadGenTab = Pigra('LeadGenTab', () => import('./components/LeadGenTab'))
const GoogleKpiTab = Pigra('GoogleKpiTab', () => import('./components/GoogleKpiTab'))
const GoogleDetailTab = Pigra('GoogleDetailTab', () => import('./components/GoogleDetailTab'))
const GoogleProductsTab = Pigra('GoogleProductsTab', () => import('./components/GoogleProductsTab'))
const GoogleVerdictsTab = Pigra('GoogleVerdictsTab', () => import('./components/GoogleVerdictsTab'))
const CorrispettiviTab = Pigra('CorrispettiviTab', () => import('./components/CorrispettiviTab'))
const ScheduledReportsTab = Pigra('ScheduledReportsTab', () => import('./components/ScheduledReportsTab'))
const InventoryTab = Pigra('InventoryTab', () => import('./components/InventoryTab'))
const ProductPerformanceTab = Pigra('ProductPerformanceTab', () => import('./components/ProductPerformanceTab'))
const ProductCostsTab = Pigra('ProductCostsTab', () => import('./components/ProductCostsTab'))
const PrezziTab = Pigra('PrezziTab', () => import('./components/PrezziTab'))
const AttributionPanel = Pigra('AttributionPanel', () => import('./components/AttributionPanel'))
const LtvCohortsTab = Pigra('LtvCohortsTab', () => import('./components/LtvCohortsTab'))

// ── Solo sul SaaS: le tab e gli agenti che il fork di un cliente singolo non ha ───────────────
// Gli agenti di periodo: una chat che galleggia dentro Weekly, Mensile, Trimestrale, Annuale e
// Simulatore, e legge i numeri gia' calcolati di quella tab.
const WeeklyAgent = PigraMuta('WeeklyAgent', () => import('./components/WeeklyAgent'))
const MensileAgent = PigraMuta('MensileAgent', () => import('./components/MensileAgent'))
const QuarterAgent = PigraMuta('QuarterAgent', () => import('./components/QuarterAgent'))
const YearAgent = PigraMuta('YearAgent', () => import('./components/YearAgent'))
const SimulatorAgent = PigraMuta('SimulatorAgent', () => import('./components/SimulatorAgent'))
// Le dodici tab in fondo alla coda: si usano meno delle altre, quindi il loro codice si scarica
// per ultimo e non ruba banda alla Dashboard appena aperta.
const TeamTab = Pigra('TeamTab', () => import('./components/TeamTab'))
const TimeTrackingTab = Pigra('TimeTrackingTab', () => import('./components/TimeTrackingTab'))
const BudgetAdvisorPanel = Pigra('BudgetAdvisorPanel', () => import('./components/BudgetAdvisorPanel'))
const GoogleBudgetAdvisorPanel = Pigra('GoogleBudgetAdvisorPanel', () => import('./components/GoogleBudgetAdvisorPanel'))
const IncrContributionTab = Pigra('IncrContributionTab', () => import('./components/IncrContributionTab'))
const IncrCurvesTab = Pigra('IncrCurvesTab', () => import('./components/IncrCurvesTab'))
const IncrSimulatorTab = Pigra('IncrSimulatorTab', () => import('./components/IncrSimulatorTab'))
const GeoLiftTab = Pigra('GeoLiftTab', () => import('./components/GeoLiftTab'))

let codicePrecaricato = false
function precaricaCodice() {
  if (codicePrecaricato || typeof window === 'undefined') return
  codicePrecaricato = true
  const nomi = Object.keys(importatori)
  const prossimo = (k) => {
    if (k >= nomi.length) return
    const vai = () => importatori[nomi[k]]().catch(() => {}).finally(() => setTimeout(() => prossimo(k + 1), 60))
    if (window.requestIdleCallback) window.requestIdleCallback(vai, { timeout: 2500 }); else setTimeout(vai, 200)
  }
  prossimo(0)
}

// ── Utils ─────────────────────────────────────────────────────
const f0 = n => soldi(n, 0, { zeroVuoto: true })
const f2 = n => soldi(n, 2, { zeroVuoto: true })
const fn = n => n>0 ? Number(n).toLocaleString(localeNumeri(), { useGrouping: 'always' }) : '—'
const fp = n => n!=null ? `${Number(n).toFixed(1)}x` : '—'
const fr = n => n!=null ? `${Number(n).toFixed(2).replace('.',sepDecimali())}` : '—'

// Stesso mese dell'anno prima: '2026-08' → '2025-08'
// Stessa settimana dell'anno prima: 364 giorni indietro, cosi' resta un lunedi'
const settimanaMenoUnAnno = (k) => {
  if (!k) return null
  const d = new Date(`${k}T00:00:00Z`)
  if (Number.isNaN(d.getTime())) return null
  d.setUTCDate(d.getUTCDate() - 364)
  return d.toISOString().slice(0, 10)
}

const meseMenoUnAnno = (m) => {
  if (!m) return null
  const [y, mm] = String(m).split('-')
  return `${Number(y) - 1}-${mm}`
}

// Le voci dei report, una volta sola per Weekly, Monthly, Quarter e Year.
// L'ordine e' quello in cui si ragiona: cosa e' entrato, da chi, quanto e'
// costato portarlo, quanto rende, quanta gente e' passata.
const righeReport = ({ t, mostraKoongo, googleAuto, chiavi = {} }) => {
  const k = { fatturato: 'fatturato', koongo: 'koongo', fatturNC: 'fatturNC', fatturRC: 'fatturRC',
    resi: 'resi', ordini: 'ordini', nc: 'nc', rc: 'rc', sessioni: 'sessioni',
    metaSpend: 'metaSpend', googleSpend: 'googleSpend', totalSpend: 'totalSpend',
    mer: 'mer', aMer: 'aMer', cac: 'cac', cpo: 'cpo', aov: 'aov', aovNC: 'aovNC', aovRC: 'aovRC',
    retention: 'retention', cro: 'cro', ltv: 'ltv', ratio: 'ratio', ...chiavi }
  const euro0 = v => f0(v)
  const euro2 = v => f2(v)
  const interi = v => fn(v)
  const volte = v => v != null ? `${fr(v)}×` : '—'
  const perc = v => v != null ? `${fr(v)}%` : '—'
  const rapporto = v => v != null ? `${fr(v)}:1` : '—'

  // Una voce che in quella tab non esiste NON si mostra: una riga di trattini
  // occupa spazio e fa dubitare del dato invece di dire che non c'e'.
  return [
    { key: k.fatturato, fonte: ['shopify'], label: t('dash.revenue', null, 'Fatturato'), fmt: euro0, strong: true },
    ...(mostraKoongo ? [{ key: k.koongo, fonte: ['shopify'], label: t('dash.koongoRevenue', null, 'Fatturato Koongo'), fmt: euro0, sub: true }] : []),
    { key: k.fatturNC, fonte: ['shopify'], label: t('dash.thRevNCShort', null, 'Fatt. NC'), fmt: euro0, sub: true },
    { key: k.fatturRC, fonte: ['shopify'], label: t('dash.thRevRCShort', null, 'Fatt. RC'), fmt: euro0, sub: true },
    { key: k.resi, fonte: ['shopify'], label: t('dash.thReturns', null, 'Resi'), fmt: euro0, inverse: true, gapAfter: true },

    { key: k.ordini, fonte: ['shopify'], label: t('dash.orders', null, 'Ordini'), fmt: interi, noPct: true, strong: true },
    { key: k.nc, fonte: ['shopify'], label: t('dash.newCustomersShort', null, 'Nuovi Clienti'), fmt: interi, noPct: true, sub: true },
    { key: k.rc, fonte: ['shopify'], label: t('dash.returningShort', null, 'Clienti Ritorno'), fmt: interi, noPct: true, sub: true, gapAfter: true },

    { key: k.totalSpend, fonte: ['meta', 'google'], label: 'ADV', fmt: euro0, inverse: true, strong: true },
    { key: k.metaSpend, fonte: ['meta'], label: t('pnl.lineAdsMeta', null, 'di cui Meta'), fmt: euro0, inverse: true, sub: true },
    { key: k.googleSpend, fonte: ['google'], label: t('pnl.lineAdsGoogle', null, 'di cui Google'), fmt: euro0, inverse: true, sub: true, badge: googleAuto?.configured ? null : t('pnl.badgeEst', null, 'stima'), gapAfter: true },

    { key: k.mer, label: 'MER', fmt: volte, noPct: true, strong: true },
    { key: k.aMer, label: 'aMER', fmt: volte, noPct: true },
    { key: k.cac, label: 'CAC', fmt: euro2, noPct: true, inverse: true },
    { key: k.cpo, label: 'CPO', fmt: euro2, noPct: true, inverse: true },
    { key: k.aov, label: 'AOV', fmt: euro2, noPct: true },
    { key: k.aovNC, label: 'AOV NC', fmt: euro2, noPct: true, sub: true },
    { key: k.aovRC, label: 'AOV RC', fmt: euro2, noPct: true, sub: true },
    { key: k.ltv, label: 'LTV', fmt: euro2, noPct: true },
    { key: k.ratio, label: t('dash.ratioLtvCacLabel', null, 'Ratio LTV:CAC'), fmt: rapporto, noPct: true, gapAfter: true },

    { key: k.sessioni, fonte: ['shopify'], label: t('dash.thSessions', null, 'Sessioni'), fmt: interi, noPct: true },
    { key: k.cro, fonte: ['shopify'], label: 'CRO%', fmt: perc, noPct: true },
    { key: k.retention, fonte: ['shopify'], label: 'Ret%', fmt: perc, noPct: true },
  ].filter(r => r.key)
}

const ratioStatus = r => r==null?'nd':r<1?'bad':r<3?'warn':'ok'
const ratioRgb    = r => ({nd:'var(--stat-nd-rgb)',bad:'var(--stat-bad-rgb)',warn:'var(--stat-warn-rgb)',ok:'var(--stat-ok-rgb)'})[ratioStatus(r)]
const ratioColor  = r => `rgb(${ratioRgb(r)})`
const ratioLabel  = r => ({nd:'N/D',bad:'CRITICO',warn:'ATTENZIONE',ok:'OTTIMO'})[ratioStatus(r)]

const MONTHS_START = '2025-01'

// Genera settimane dal 30/12/2024 a oggi (lunedì → domenica). Parte da un
// anno prima dei mesi perché la tabella confronta ogni settimana con la
// stessa dell'anno precedente: se l'elenco non ci arriva, quella colonna
// resta vuota per sempre.
function getWeeks() {
  const weeks = []
  let d = new Date('2024-12-30T00:00:00Z')
  const now = new Date()
  while (d <= now) {
    const end = new Date(d); end.setUTCDate(end.getUTCDate() + 6)
    const fmt = dt => `${String(dt.getUTCDate()).padStart(2,'0')}/${String(dt.getUTCMonth()+1).padStart(2,'0')}`
    // key = data lunedì in YYYY-MM-DD (compatibile con Meta date_start)
    const key = d.toISOString().slice(0,10)
    weeks.push({ key, label: `${fmt(d)} → ${fmt(end)}` })
    d = new Date(d); d.setUTCDate(d.getUTCDate() + 7)
  }
  return weeks
}
function getMonths() {
  const out = [], now = new Date()
  let [y,m] = MONTHS_START.split('-').map(Number)
  while (y < now.getFullYear() || (y === now.getFullYear() && m <= now.getMonth()+1)) {
    out.push(`${y}-${String(m).padStart(2,'0')}`)
    m++; if(m>12){m=1;y++}
  }
  return out
}

// Refresh in background della history Shopify (metrics_history su Supabase): una
// richiesta force dedicata che completa davvero. Guard per non spammare.
let historyBgInflight = false
const EMPTY  = { fatturato:0, ordini:0, nuoviClienti:0, googleSpend:0 }
const WEMPTY = { fatturato:0, fatturNC:0, fatturRC:0, meta:0, google:0, ordini:0, nc:0, rc:0, sessioni:0 }
// margin 100 = default quando NON ci sono costi prodotto inseriti (LTV netto
// = lordo). Se i costi ci sono, il margine REALE li sovrascrive (vedi cfg).
const DEF   = { freq:1.69, life:1.57, margin:100 }

function load() {
  try { return {
    m: JSON.parse(localStorage.getItem('stmn_m')||'{}'),
    c: JSON.parse(localStorage.getItem('stmn_c')||'{}'),
    w: JSON.parse(localStorage.getItem('stmn_w')||'{}'),
  } } catch { return { m:{}, c:{}, w:{} } }
}
const saveM = m => { try { localStorage.setItem('stmn_m', JSON.stringify(m)) } catch{} }
const saveC = c => { try { localStorage.setItem('stmn_c', JSON.stringify(c)) } catch{} }
const saveW = w => { try { localStorage.setItem('stmn_w', JSON.stringify(w)) } catch{} }

// ── Tooltip personalizzato ────────────────────────────────────
const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)',
      backdropFilter: 'none',
      WebkitBackdropFilter: 'none',
      border: '1px solid var(--border2)',
      borderTopColor: 'rgba(255,255,255,0.20)',
      borderRadius: 12,
      padding: '10px 14px',
      fontSize: 13,
      fontWeight: 600,
      fontFamily: 'Inter, sans-serif',
      boxShadow: '0 12px 36px rgba(0,0,0,0.7), 0 0 24px rgba(41,151,255,0.18)',
      minWidth: 140,
    }}>
      <div style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 8, letterSpacing: '0.10em', textTransform: 'uppercase', fontWeight: 600 }}>{label}</div>
      {payload.map((p,i) => (
        <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 4, alignItems: 'baseline' }}>
          <span style={{ color: p.color, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: p.color, boxShadow: 'none' }} />
            {p.name}
          </span>
          <span style={{ color: 'var(--text)', fontWeight: 640, fontVariantNumeric: 'tabular-nums' }}>
            {typeof p.value==='number' && p.value>100 ? f0(p.value) : p.value?.toFixed?.(2) ?? p.value}
          </span>
        </div>
      ))}
    </div>
  )
}

// Futuristic glowing dot with pulse
const FxDot = ({ cx, cy, color = 'var(--text)' }) => {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={6} fill={color} opacity={0.15}>
        <animate attributeName="r" values="6;10;6" dur="2s" repeatCount="indefinite" />
        <animate attributeName="opacity" values="0.15;0;0.15" dur="2s" repeatCount="indefinite" />
      </circle>
      <circle cx={cx} cy={cy} r={3.5} fill={color} stroke="#0b0b0b" strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 4px ${color})` }} />
    </g>
  )
}

function FxChartCard({ title, glowColor = '#2997ff', subtitle, children }) {
  return (
    <div className="fx-chart-card" style={{ '--fx-chart-glow': glowColor, marginBottom: 20 }}>
      <div className="fx-chart-header">
        <span className="fx-chart-dot" style={{ background: glowColor, boxShadow: 'none' }} />
        <span className="fx-chart-title">{title}</span>
        {subtitle && <span style={{ fontSize: 10, color: 'var(--text3)', marginLeft: 'auto', marginRight: 10 }}>{subtitle}</span>}
        <span className="fx-chart-spark">
          <span /><span /><span />
        </span>
      </div>
      <div className="fx-chart-body">{children}</div>
    </div>
  )
}

const FxActiveDot = ({ cx, cy, color = 'var(--text)' }) => {
  if (cx == null || cy == null) return null
  return (
    <g>
      <circle cx={cx} cy={cy} r={12} fill={color} opacity={0.18} />
      <circle cx={cx} cy={cy} r={7} fill={color} opacity={0.35} />
      <circle cx={cx} cy={cy} r={4} fill={color} stroke="var(--text)" strokeWidth={1.5} style={{ filter: `drop-shadow(0 0 8px ${color})` }} />
    </g>
  )
}

// ── Numero formattato in anteprima ────────────────────────────
function NumInput({ value, onChange, placeholder, color, isCount }) {
  const [raw, setRaw] = useState(value > 0 ? String(value) : '')

  useEffect(() => {
    if (value === 0) setRaw('')
    else if (parseFloat(raw) !== value) setRaw(String(value))
  }, [value])

  const handleChange = e => {
    const v = e.target.value
    setRaw(v)
    const n = parseFloat(v.replace(',','.')) || 0
    onChange(n)
  }

  const preview = value > 0
    ? (isCount ? Number(value).toLocaleString(localeNumeri(), { useGrouping: 'always' }) : `€${Math.round(value).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`)
    : null

  return (
    <div style={{display:'flex',flexDirection:'column',gap:2}}>
      <input
        type="number"
        placeholder={placeholder}
        value={raw}
        onChange={handleChange}
        style={{
          background:'var(--glass)',
          border:'1px solid var(--border)',
          borderRadius:6,
          padding:'4px 8px',
          width:110,
          textAlign:'right',
          fontSize:13,
          fontFamily: 'inherit',fontWeight:600,
          color: color,
          outline:'none',
        }}
        onFocus={e => e.target.style.borderColor='#333'}
        onBlur={e => e.target.style.borderColor='#1a1a1a'}
      />
      {preview && <span style={{fontSize:11.5,textAlign:'right',color,opacity:0.7,fontFamily: 'inherit',fontWeight:600}}>{preview}</span>}
    </div>
  )
}

// ── Stat box ──────────────────────────────────────────────────
// La scheda KPI della Dashboard e di KPI Brain e' quella di tutto il prodotto
// (ui/Mattoni). La famiglia — e quindi il colore del filo e dello sparkline —
// nasce da COSA misura il numero, non dalla tab: prima ogni scheda aveva un
// colore scelto a mano, e in KPI Brain gli sparkline erano tutti rossi anche
// quando il numero saliva.
function famigliaDellaScheda(label, sources) {
  const l = String(label || '').toLowerCase()
  if (/roas|mer\b|ratio|repeat|retention|ltv|margin/.test(l)) return 'resa'
  if (/ctr|cpm|click|clic|session|cro|impression|frequen|reach|copertura/.test(l)) return 'traffico'
  if (/spend|spesa|cpa|cpo|cac|cpc|costo|adv/.test(l)) return 'pub'
  if ((sources || []).includes('shopify')) return 'vendite'
  return (sources || []).some(x => x === 'meta' || x === 'google') ? 'pub' : undefined
}
// Monta i figli solo quando la pagina e' gia' disegnata, il browser e' a riposo e il riquadro e'
// in vista. Serve al globo 3D: three.js e le sue immagini erano la cosa piu' pesante dell'avvio
// (profilato il 19 set: i tre blocchi di codice piu' costosi erano tutti suoi) e partivano insieme
// ai numeri della Dashboard. Il riquadro tiene gia' il suo spazio: niente salti.
function QuandoFermo({ children, attesaMs = 1400 }) {
  const [pronto, setPronto] = useState(false)
  const rif = useRef(null)
  useEffect(() => {
    let vivo = true, oss = null, t = null
    const vai = () => { if (vivo) setPronto(true) }
    const quandoInVista = () => {
      if (!rif.current || !('IntersectionObserver' in window)) return vai()
      oss = new IntersectionObserver((e) => { if (e.some(x => x.isIntersecting)) { oss.disconnect(); (window.requestIdleCallback || ((f) => setTimeout(f, 1)))(vai, { timeout: 2000 }) } }, { rootMargin: '200px' })
      oss.observe(rif.current)
    }
    t = setTimeout(quandoInVista, attesaMs)
    return () => { vivo = false; clearTimeout(t); oss?.disconnect() }
  }, [attesaMs])
  return pronto ? children : <div ref={rif} style={{ width: '100%', height: '100%' }} aria-hidden="true" />
}

function Stat({ label, value, sub, sparkData, current, previous, sources, inverse, spiega }) {
  const fam = famigliaDellaScheda(label, sources)
  const [aperto, setAperto] = useState(false)
  // Con `spiega` il riquadro si clicca: si apre "Come nasce questo numero" (conto, fonti, andamento).
  const delta = current != null && Number(previous) > 0 ? ((Number(current) - Number(previous)) / Number(previous)) * 100 : null
  return (
    <>
      <Kpi etichetta={label} valore={value} famiglia={fam} fonti={sources}
        classe={spiega ? 'si-spiega' : undefined} onClick={spiega ? () => setAperto(true) : undefined}
        grafico={sparkData ? <Sparkline data={sparkData} color={coloreFamiglia(fam)} width={80} height={32} /> : null}>
        <DeltaBadge current={current} previous={previous} inverse={inverse} />
        {sub && <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{sub}</span>}
      </Kpi>
      {aperto && spiega && (
        <SpiegaNumero titolo={label} valore={value} conto={spiega.conto} risultato={spiega.conto?.length ? value : null} nota={spiega.nota}
          fonti={sources} serie={spiega.serie} etichettaSerie={spiega.etichettaSerie} formatta={spiega.formatta}
          prima={spiega.prima ? { ...spiega.prima, delta, inverso: inverse } : null} onClose={() => setAperto(false)} />
      )}
    </>
  )
}

// ── Ratio widget ──────────────────────────────────────────────
// Solo LTV:CAC: il MER e' gia' nella sintesi in alto (Marino: "il mer lo riporti sopra quindi levalo").
function RatioWidget({ ratio }) {
  const { t } = useI18n()
  const col  = ratioColor(ratio)
  const rgb  = ratioRgb(ratio)
  const lbl  = t('dash.ratioStatus.' + ratioStatus(ratio), null, ratioLabel(ratio))
  return (
    <div style={{
      border:'1px solid var(--border)',
      borderRadius:16,
      padding:'24px 24px',
      background:'var(--surface)',
    }}>
      <div>
        <div style={{fontSize:11.5,color:'var(--text2)',textTransform:'uppercase',letterSpacing:'0.1em',marginBottom:8}}>{t('dash.ratioLtvCacShort', null, 'Ratio LTV : CAC')}</div>
        <div style={{fontSize:22,fontWeight:650,color:'var(--text)',fontFamily: 'inherit',lineHeight:1,letterSpacing:'-0.035em',fontVariantNumeric:'tabular-nums'}}>
          {ratio!=null ? `${fr(ratio)}:1` : '—'}
        </div>
        <div style={{
          display:'inline-block',
          marginTop:10,
          padding:'3px 10px',
          borderRadius:16,
          background:`rgba(${rgb}, .14)`,
          color:col,
          fontSize:11.5,
          fontWeight:600,
          letterSpacing:'0.06em',
        }}>{lbl}</div>
      </div>
    </div>
  )
}

// ── Settings modal ────────────────────────────────────────────
function Settings({ cfg, onSave, onClose }) {
  const { t } = useI18n()
  const [f, setF] = useState({...cfg})
  return (
    <div style={{position:'fixed',inset:0,background:'var(--surface)',zIndex:50,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:12,padding:28,width:340}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:20}}>
          <span style={{fontWeight:600,fontSize:15}}>{t('sim.ltvParams', null, 'Parametri LTV')}</span>
          <button onClick={onClose} style={{color:'var(--text3)',background:'none',border:'none',fontSize:17,cursor:'pointer'}}><Icon name="close" size={16} /></button>
        </div>
        {[
          {k:'freq',  l:t('sim.freqYear', null, 'Frequenza acquisti / anno'), s:'0.01', u:'×/anno'},
          {k:'life',  l:t('sim.avgLife', null, 'Vita media cliente'),         s:'0.01', u:'anni'},
          {k:'margin',l:t('sim.grossMargin', null, 'Margine lordo'),               s:'1',    u:'%'},
        ].map(({k,l,s,u}) => (
          <div key={k} style={{marginBottom:16}}>
            <label style={{fontSize:11.5,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.07em',display:'block',marginBottom:6}}>{l}</label>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <input type="number" step={s} value={f[k]}
                onChange={e=>setF(x=>({...x,[k]:parseFloat(e.target.value)||0}))}
                style={{flex:1,background:'transparent',border:'1px solid var(--border)',borderRadius:6,padding:'6px 10px',color:'var(--text)',fontSize:15,fontFamily: 'inherit',fontWeight:600,textAlign:'right',outline:'none'}} />
              <span style={{fontSize:13,color:'#444',width:48}}>{u}</span>
            </div>
          </div>
        ))}
        <div style={{display:'flex',gap:10,marginTop:24}}>
          <button onClick={onClose} style={{flex:1,padding:'8px',border:'1px solid var(--border)',borderRadius:8,background:'none',color:'var(--text3)',cursor:'pointer',fontSize:13}}>{t('sim.cancel', null, 'Annulla')}</button>
          <button onClick={()=>{saveC(f);onSave(f);onClose()}} style={{flex:1,padding:'8px',border:'none',borderRadius:8,background:'#22c55e',color:'#000',fontWeight:600,cursor:'pointer',fontSize:13}}>{t('sim.save', null, 'Salva')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Simulatore ────────────────────────────────────────────────
function Simulator({ cfg }) {
  const { t } = useI18n()
  // margin del simulatore: parte dal margine effettivo ma il suo slider arriva
  // a 80 → clampa (con margine 100 = nessun costo inserito, parte da 80).
  const [s, setS] = useState({aov:85, freq:cfg.freq||1.69, life:cfg.life||1.57, margin:Math.min(cfg.margin||30, 80), cac:35})
  const set = (k,v) => setS(x=>({...x,[k]:v}))

  // AOV e CAC iniziali = medie REALI degli ultimi 90 giorni del workspace
  // (prima erano fissi 85/35 = STMN per tutte le aziende). Se l'utente ha
  // già mosso gli slider (valore ≠ default), non si sovrascrive.
  useEffect(() => {
    let alive = true
    const iso = d => d.toISOString().slice(0, 10)
    const since = iso(new Date(Date.now() - 89 * 86400000)), until = iso(new Date())
    Promise.all([
      fetch(`/api/cro?since=${since}&until=${until}`).then(r => r.json()).catch(() => null),
      fetch('/api/meta-kpi?preset=last_90d').then(r => r.json()).catch(() => null),
      fetch('/api/google-kpi?preset=last_90d').then(r => r.json()).catch(() => null),
    ]).then(([cro, mk, gk]) => {
      if (!alive || !cro) return
      const orders = cro.totalOrders || 0
      const aov90 = orders > 0 ? Math.round(cro.totalRevenue / orders) : 0
      const spend = ((mk?.totals?.spend) || 0) + ((gk?.totals?.spend) || 0)
      const nc = cro.newCustomers || 0
      const cac90 = nc > 0 ? Math.round(spend / nc) : 0
      setS(x => ({
        ...x,
        ...(aov90 > 0 && x.aov === 85 ? { aov: aov90 } : {}),
        ...(cac90 > 0 && x.cac === 35 ? { cac: cac90 } : {}),
      }))
    })
    return () => { alive = false }
  }, [])
  const ltv   = s.aov * s.freq * s.life * s.margin/100
  const ratio = s.cac > 0 ? ltv/s.cac : 0
  const col   = ratioColor(ratio)
  const cacFor3  = ltv/3
  const aovFor3  = s.cac>0 ? (s.cac*3)/(s.freq*s.life*s.margin/100) : 0

  const defaultScenario = { name:'', spend:3000, roas:3, aov:75, cogs:38 }
  const [scenarios, setScenarios] = useState([
    { ...defaultScenario, name:t('sim.scenConservative', null, 'Conservativo'), spend:2000, roas:2.5, cogs:38 },
    { ...defaultScenario, name:t('sim.scenBase', null, 'Base'), spend:4000, roas:3.5, cogs:38 },
    { ...defaultScenario, name:t('sim.scenAggressive', null, 'Aggressivo'), spend:8000, roas:4, cogs:38 },
  ])
  const setSc = (i,k,v) => setScenarios(prev => { const n=[...prev]; n[i]={...n[i],[k]:v}; return n })

  const IVA = 22

  const calcScenario = (sc) => {
    const revenueIvaInclusa = sc.spend * sc.roas
    const iva = revenueIvaInclusa * (IVA / (100 + IVA))
    const revenue = revenueIvaInclusa - iva
    const orders = sc.aov > 0 ? revenueIvaInclusa / sc.aov : 0
    const aovNetto = sc.aov / (1 + IVA / 100)
    const cogsAmount = revenue * (sc.cogs / 100)
    const marginePerOrdine = orders > 0 ? (revenue - cogsAmount) / orders : 0
    const marginePct = revenue > 0 ? ((revenue - cogsAmount) / revenue) * 100 : 0
    const profittoLordo = revenue - cogsAmount
    const profittoNetto = profittoLordo - sc.spend
    const netMarginPct = revenueIvaInclusa > 0 ? (profittoNetto / revenueIvaInclusa) * 100 : 0
    const mer = sc.spend > 0 ? revenueIvaInclusa / sc.spend : 0
    const cpo = orders > 0 ? sc.spend / orders : 0
    const breakEvenRoas = marginePct > 0 ? 100 / marginePct * (1 + IVA / 100) : 0
    return { revenueIvaInclusa, iva, revenue, orders, aovNetto, cogsAmount, marginePerOrdine, marginePct, profittoLordo, profittoNetto, netMarginPct, mer, cpo, breakEvenRoas }
  }

  // Palette minimale coerente con le altre tab:
  // slate (neutro), accent blu Apple, viola — niente verde/giallo accesi
  const scenarioColors = ['#64748b', '#2997ff', '#bf5af2']

  // Dati esposti al SimulatorAgent (CMO+CFO)
  const ltvInputs = { aov: s.aov, freq: s.freq, life: s.life, marginPct: s.margin, cac: s.cac }
  const ltvOutputs = {
    ltv: Math.round(ltv * 100) / 100,
    ratioLtvCac: Math.round(ratio * 100) / 100,
    cacForRatio3: Math.round(cacFor3),
    aovForRatio3: Math.round(aovFor3),
  }
  const cashFlowAnalysisFull = scenarios.map(sc => {
    const c = calcScenario(sc)
    const name = sc.name || ''
    const cashOut = sc.spend + c.cogsAmount
    const cashIn = c.revenueIvaInclusa
    const cashRatio = cashOut > 0 ? cashIn / cashOut : 0
    const monthsToRecover = c.profittoNetto > 0 ? sc.spend / c.profittoNetto : null
    const annualProfit = c.profittoNetto * 12
    const advAsRevenueShare = c.revenueIvaInclusa > 0 ? (sc.spend / c.revenueIvaInclusa) * 100 : 0
    return {
      name,
      input: { spend: sc.spend, roasTarget: sc.roas, aovIvaInclusa: sc.aov, cogsPct: sc.cogs },
      revenueIvaInclusa: Math.round(c.revenueIvaInclusa),
      iva: Math.round(c.iva),
      revenueNetto: Math.round(c.revenue),
      orders: Math.round(c.orders),
      aovNetto: Math.round(c.aovNetto * 100) / 100,
      cpo: Math.round(c.cpo * 100) / 100,
      cogsAmount: Math.round(c.cogsAmount),
      marginePerOrdine: Math.round(c.marginePerOrdine * 100) / 100,
      marginePct: Math.round(c.marginePct * 100) / 100,
      profittoLordo: Math.round(c.profittoLordo),
      profittoNetto: Math.round(c.profittoNetto),
      netMarginPct: Math.round(c.netMarginPct * 100) / 100,
      breakEvenRoas: Math.round(c.breakEvenRoas * 100) / 100,
      mer: Math.round(c.mer * 100) / 100,
      cashRatio: Math.round(cashRatio * 100) / 100,
      monthsToRecover: monthsToRecover != null ? Math.round(monthsToRecover * 10) / 10 : null,
      annualProfit: Math.round(annualProfit),
      advAsRevenueShare: Math.round(advAsRevenueShare * 10) / 10,
    }
  })
  const sm0 = n => n>0 ? `€${Math.round(n).toLocaleString(localeNumeri(), { useGrouping: 'always' })}` : n<0 ? `-€${Math.round(Math.abs(n)).toLocaleString(localeNumeri(), { useGrouping: 'always' })}` : '€0'
  const sm2 = n => `€${Number(n).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}`
  const sp1 = n => `${Number(n).toFixed(1)}%`
  const si0 = n => n>0 ? Math.round(n).toLocaleString(localeNumeri(), { useGrouping: 'always' }) : '0'

  // Stile slider futuristico riutilizzabile
  const sliderStyle = {
    width: '100%',
    accentColor: '#22c55e',
    height: 6,
  }

  // Palette blu notte coerente con le altre tab
  const NIGHT_BLUE = '#1e3a8a'   // navy profondo (sliders fill base)
  const NIGHT_BLUE_LIGHT = '#3b82f6' // hue intermedio
  const ACCENT_GLOW = '#2997ff'  // accent Apple per glow/highlight

  // Glass card 3D futuristica: backdrop blur reale + border 3D +
  // sim-pulse (floating motion gentle) + sim-scan (horizontal sweep) +
  // top accent bar cr-shine + hover lift. Replica del look delle
  // glass-card di Monthly/Weekly/Quarter/Year.
  const fxBlock = (children, { glow = ACCENT_GLOW, padding = 24, delay = 0, dark = false } = {}) => (
    <div
      style={{
        position: 'relative',
        background: dark
          ? 'linear-gradient(180deg, rgba(8,8,18,0.85) 0%, rgba(0,0,0,0.95) 100%)'
          : 'rgba(255,255,255,0.04)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        borderRadius: 16,
        overflow: 'hidden',
        border: '1.5px solid var(--border)',
        borderTopColor: 'rgba(255,255,255,0.12)',
        borderBottomColor: 'rgba(0,0,0,0.55)',
        boxShadow: 'none',
        animation: `sim-pulse 6s ease-in-out infinite`,
        animationDelay: `${delay}s`,
        transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        cursor: 'default',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.animationPlayState = 'paused'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.animationPlayState = 'running'
        e.currentTarget.style.transform = ''
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
      }}
    >
      {/* Top accent bar animata */}
      <div style={{
        position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
        background: 'none',
        filter: 'blur(0.3px)',
        opacity: 0.85,
        animation: 'cr-shine 4s ease-in-out infinite',
        zIndex: 3,
        pointerEvents: 'none',
      }} />
      {/* Scan-line orizzontale (gradient bianco) */}
      <div style={{
        position: 'absolute', top: 0, bottom: 0, left: '-50%',
        width: '40%',
        background: 'none',
        animation: `sim-scan 9s ease-in-out infinite`,
        animationDelay: `${delay + 1}s`,
        pointerEvents: 'none',
        zIndex: 1,
      }} />
      <div style={{ padding, position: 'relative', zIndex: 2 }}>{children}</div>
    </div>
  )

  return (
    <div>
      {/* Header */}
      {/* LTV:CAC + Target 3:1 */}
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 18 }}>
        {fxBlock((
          <>
            <div style={{ marginBottom: 18 }}>
              <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 15, fontWeight: 680, letterSpacing: '-0.01em' }}>
                {t('sim.title', null, 'Simulatore LTV:CAC')}
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
                {t('sim.subtitle', null, 'Trascina gli slider per simulare lo scenario unit economics')}
              </p>
            </div>

            {[
              {k:'aov',   l:'AOV',                  min:20, max:250, step:1,    fmt:v=>`€${v}`},
              {k:'freq',  l:t('sim.freqYearShort', null, 'Frequenza / anno'),     min:1,  max:6,   step:0.01, fmt:v=>`${v.toFixed(2)}×`},
              {k:'life',  l:t('sim.avgLifeYears', null, 'Vita media (anni)'),    min:0.5,max:6,   step:0.01, fmt:v=>`${v.toFixed(2)}`},
              {k:'margin',l:t('dash.marginPct', null, 'Margine %'),            min:5,  max:80,  step:1,    fmt:v=>`${v}%`},
              {k:'cac',   l:'CAC',                  min:5,  max:300, step:1,    fmt:v=>`€${v}`},
            ].map(({k,l,min,max,step,fmt}) => {
              const pct = ((s[k] - min) / (max - min)) * 100
              return (
                <div key={k} style={{ marginBottom: 18 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 11.5, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.1em' }}>{l}</span>
                    <span style={{ fontSize: 15, fontFamily: 'inherit', fontWeight: 680, color: 'var(--text)' }}>{fmt(s[k])}</span>
                  </div>
                  <div style={{ position: 'relative', height: 6, background: 'rgba(0,0,0,0.4)', borderRadius: 999, overflow: 'hidden', marginBottom: 4, boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)' }}>
                    <div style={{
                      position: 'absolute', top: 0, left: 0, bottom: 0,
                      width: `${pct}%`,
                      background: `linear-gradient(90deg, ${NIGHT_BLUE} 0%, ${NIGHT_BLUE_LIGHT} 100%)`,
                      borderRadius: 999,
                      boxShadow: 'none',
                      transition: 'width 0.12s',
                    }} />
                  </div>
                  <input type="range" min={min} max={max} step={step} value={s[k]}
                    onChange={e=>set(k,parseFloat(e.target.value))}
                    style={{ ...sliderStyle, accentColor: NIGHT_BLUE_LIGHT, marginTop: -10, position: 'relative', zIndex: 1, opacity: 0.6 }} />
                </div>
              )
            })}
          </>
        ), { glow: '#2997ff', delay: 0 })}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <RatioWidget ratio={ratio} />

          {fxBlock((
            <>
              <div style={{ marginBottom: 18 }}>
                <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 15, fontWeight: 680 }}>
                  {t('sim.toReach3', null, 'Per raggiungere 3:1')}
                </h2>
                <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
                  {t('sim.toReach3Sub', null, 'Cosa devi cambiare per arrivare al ratio target')}
                </p>
                <p style={{ margin: '3px 0 0', color: 'var(--text3)', fontSize: 11.5, opacity: 0.8 }}>
                  {t('sim.auto90', null, 'AOV e CAC partono dalla media reale degli ultimi 90 giorni.')}
                </p>
              </div>

              {[
                {l:t('sim.cacTarget', null, 'CAC target'),    v:`€${Math.round(cacFor3)}`,  sub:t('sim.currentCac', { cac: s.cac, sign: (cacFor3<s.cac?'−':'+'), pct: Math.abs(Math.round((s.cac-cacFor3)/s.cac*100)) }, `attuale €${s.cac} (${cacFor3<s.cac?'−':'+'} ${Math.abs(Math.round((s.cac-cacFor3)/s.cac*100))}%)`)},
                {l:t('sim.aovNeeded', null, 'AOV necessario'), v:`€${Math.round(aovFor3)}`, sub:t('sim.currentAov', { aov: s.aov, pct: Math.round((aovFor3-s.aov)/s.aov*100) }, `attuale €${s.aov} (+${Math.round((aovFor3-s.aov)/s.aov*100)}%)`)},
              ].map(({l,v,sub}) => (
                <div key={l} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '14px 16px',
                  background: 'var(--glass)',
                  border: '1px solid var(--border)',
                  borderTopColor: 'rgba(255,255,255,0.10)',
                  borderBottomColor: 'rgba(0,0,0,0.4)',
                  borderRadius: 12,
                  marginBottom: 10,
                  boxShadow: '0 8px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04)',
                }}>
                  <div>
                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{l}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{sub}</div>
                  </div>
                  <div style={{ fontSize: 22, fontWeight: 680, fontFamily: 'inherit', color: ACCENT_GLOW }}>{v}</div>
                </div>
              ))}
            </>
          ), { glow: '#2997ff', padding: 22, delay: 0.7 })}
        </div>
      </div>

    {/* ── Scenari Advertising Simulator ── */}
    {fxBlock((
      <>
      <div style={{ marginBottom: 22 }}>
        <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 20, fontWeight: 680, letterSpacing: '-0.01em' }}>
          Scenari Advertising
        </h2>
        <p style={{ margin: '6px 0 0', color: 'var(--text3)', fontSize: 13 }}>
          Confronta 3 scenari · IVA 22% scorporata · COGS in % (prodotti + spedizione + packaging)
        </p>
      </div>

      <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:16,marginBottom:24}}>
        {scenarios.map((sc,i) => {
          const color = scenarioColors[i]
          return (
            <div
              key={i}
              style={{
                position: 'relative',
                background: 'var(--surface)',
                backdropFilter: 'none',
                WebkitBackdropFilter: 'none',
                border: '1.5px solid var(--border)',
                borderTopColor: `${color}55`,
                borderBottomColor: 'rgba(0,0,0,0.65)',
                borderRadius: 16,
                padding: 22,
                overflow: 'hidden',
                boxShadow: `0 24px 60px rgba(0,0,0,0.7), 0 8px 20px rgba(0,0,0,0.5), 0 0 40px ${color}14, inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)`,
                animation: 'sim-pulse 6s ease-in-out infinite',
                animationDelay: `${i * 0.6}s`,
                transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
              }}
              onMouseEnter={e => {
                e.currentTarget.style.animationPlayState = 'paused'
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderTopColor = `${color}99`
              }}
              onMouseLeave={e => {
                e.currentTarget.style.animationPlayState = 'running'
                e.currentTarget.style.transform = ''
                e.currentTarget.style.boxShadow = 'none'
                e.currentTarget.style.borderTopColor = `${color}55`
              }}
            >
              <div style={{
                position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
                background: 'none',
                filter: 'blur(0.3px)',
                animation: 'cr-shine 3.5s ease-in-out infinite',
                animationDelay: `${i * 0.3}s`,
                zIndex: 3,
                pointerEvents: 'none',
              }} />
              {/* Scan-line sweep */}
              <div style={{
                position: 'absolute', top: 0, bottom: 0, left: '-50%',
                width: '40%',
                background: 'none',
                animation: 'sim-scan 9s ease-in-out infinite',
                animationDelay: `${i * 0.8 + 1}s`,
                pointerEvents: 'none',
                zIndex: 1,
              }} />

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                <div style={{
                  width: 24, height: 24, borderRadius: 8,
                  background: `linear-gradient(135deg, ${color}, ${color}99)`,
                  color: 'var(--text)', fontSize: 11.5, fontWeight: 680,
                  display: 'grid', placeItems: 'center',
                  boxShadow: 'none',
                }}>{i+1}</div>
                <input value={sc.name} onChange={e=>setSc(i,'name',e.target.value)}
                  style={{
                    flex: 1, background: 'transparent', border: 'none',
                    color, fontSize: 15, fontWeight: 680,
                    outline: 'none', fontFamily: 'Inter',
                    letterSpacing: '-0.01em',
                  }}
                  placeholder={`Scenario ${i+1}`} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 640, marginBottom: 6 }}>
                  {t('sim.monthlyAdSpend', null, 'Spesa ADV mensile')}
                </div>
                <input type="number" value={sc.spend} min={0} step={100}
                  onChange={e=>setSc(i,'spend',Math.max(0,parseFloat(e.target.value)||0))}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.35)',
                    border: `1px solid ${color}33`,
                    borderRadius: 12,
                    padding: '11px 14px',
                    color: 'var(--text)',
                    fontSize: 17,
                    fontWeight: 680,
                    fontFamily: 'inherit',
                    outline: 'none',
                    textAlign: 'right',
                  }}
                  placeholder="€" />
              </div>

              {[
                {k:'roas',l:t('sim.roasTarget', null, 'ROAS target'),min:0.5,max:10,step:0.1,fmt:v=>`${v.toFixed(1)}×`},
                {k:'aov',l:t('sim.aovAvgVat', null, 'AOV medio (IVA inclusa)'),min:20,max:300,step:1,fmt:v=>`€${v}`},
                {k:'cogs',l:'COGS %',min:5,max:80,step:1,fmt:v=>`${v}%`},
              ].map(({k,l,min,max,step,fmt})=>{
                const pct = ((sc[k] - min) / (max - min)) * 100
                return (
                  <div key={k} style={{ marginBottom: 14 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                      <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 640 }}>{l}</span>
                      <span style={{ fontSize: 13, fontFamily: 'inherit', fontWeight: 680, color: 'var(--text)' }}>{fmt(sc[k])}</span>
                    </div>
                    <div style={{
                      position: 'relative', height: 5,
                      background: 'rgba(0,0,0,0.45)',
                      borderRadius: 999,
                      marginBottom: 4,
                      boxShadow: 'inset 0 1px 2px rgba(0,0,0,0.6)',
                    }}>
                      <div style={{
                        position: 'absolute', top: 0, left: 0, bottom: 0,
                        width: `${pct}%`,
                        background: `linear-gradient(90deg, ${NIGHT_BLUE}, ${color})`,
                        borderRadius: 999,
                        boxShadow: 'none',
                      }} />
                    </div>
                    <input type="range" min={min} max={max} step={step} value={sc[k]}
                      onChange={e=>setSc(i,k,parseFloat(e.target.value))}
                      style={{ width: '100%', accentColor: color, marginTop: -8, opacity: 0.4, height: 5 }} />
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>

      <div
        style={{
          position: 'relative',
          background: 'var(--surface)',
          backdropFilter: 'none',
          WebkitBackdropFilter: 'none',
          borderRadius: 16,
          overflow: 'hidden',
          border: '1.5px solid var(--border)',
          borderTopColor: 'rgba(255,255,255,0.12)',
          borderBottomColor: 'rgba(0,0,0,0.65)',
          boxShadow: 'none',
          animation: 'sim-pulse 6s ease-in-out infinite',
          animationDelay: '2.1s',
          transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
        }}
        onMouseEnter={e => {
          e.currentTarget.style.animationPlayState = 'paused'
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
        }}
        onMouseLeave={e => {
          e.currentTarget.style.animationPlayState = 'running'
          e.currentTarget.style.transform = ''
          e.currentTarget.style.boxShadow = 'none'
          e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
        }}
      >
        {/* Top accent bar cr-shine */}
        <div style={{
          position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
          background: 'none',
          filter: 'blur(0.3px)',
          opacity: 0.85,
          animation: 'cr-shine 4s ease-in-out infinite',
          zIndex: 3,
          pointerEvents: 'none',
        }} />
        {/* Scan-line sweep */}
        <div style={{
          position: 'absolute', top: 0, bottom: 0, left: '-50%',
          width: '40%',
          background: 'none',
          animation: 'sim-scan 9s ease-in-out infinite',
          animationDelay: '3s',
          pointerEvents: 'none',
          zIndex: 1,
        }} />
        <div style={{ overflowX: 'auto', position: 'relative', zIndex: 2 }}>
        <table className="tab-lyft" style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
          <thead>
            <tr>
              <th style={{padding:'14px 18px',textAlign:'left',color:'var(--text3)',fontWeight:640,fontSize:10,textTransform:'uppercase',letterSpacing:'0.12em',borderBottom:'1.5px solid var(--border)'}}>{t('sim.metric', null, 'Metrica')}</th>
              {scenarios.map((sc,i)=>(
                <th key={i} className="th-libero" style={{padding:'14px 18px',textAlign:'right',color:scenarioColors[i],fontWeight:680,fontSize:13,borderBottom:'1.5px solid var(--border)',fontFamily:'Inter',letterSpacing:'-0.01em'}}>{sc.name||`Scenario ${i+1}`}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {[
              {l:t('sim.revVatIncl', null, 'Fatturato IVA inclusa'), f:c=>sm0(c.revenueIvaInclusa), bold:true},
              {l:t('sim.vat22', null, 'IVA 22% (da scorporare)'), f:c=>`-${sm0(c.iva)}`, muted:true},
              {l:t('sim.revNet', null, 'Fatturato netto (senza IVA)'), f:c=>sm0(c.revenue), bold:true},
              {l:t('sim.adSpend', null, 'Spesa ADV'), f:(c,sc)=>sm0(sc.spend), muted:true},
              {l:t('dash.orders', null, 'Ordini'), f:c=>si0(c.orders)},
              {l:t('sim.aovNet', null, 'AOV netto'), f:c=>sm2(c.aovNetto)},
              {l:'ROAS', f:(c,sc)=>`${sc.roas.toFixed(1)}×`, bold:true},
              {l:'CPO', f:c=>sm2(c.cpo)},
              {l:'', sep:true},
              {l:'COGS', f:(c,sc)=>`${sc.cogs}%`, muted:true},
              {l:t('sim.cogsTotal', null, 'COGS totale'), f:c=>sm0(c.cogsAmount), bold:true, muted:true},
              {l:t('sim.marginPerOrder', null, 'Margine per ordine'), f:c=>sm2(c.marginePerOrdine)},
              {l:t('dash.marginPct', null, 'Margine %'), f:c=>sp1(c.marginePct)},
              {l:'', sep:true},
              {l:t('sim.grossProfit', null, 'Profitto lordo (post COGS)'), f:c=>sm0(c.profittoLordo), bold:true},
              {l:t('sim.netProfit', null, 'Profitto netto (post ADV)'), f:c=>sm0(c.profittoNetto), bold:true, color:c=>c.profittoNetto>=0?'#22c55e':'#ef4444'},
              {l:t('sim.netMarginPct', null, 'Net margin % (su lordo)'), f:c=>sp1(c.netMarginPct), bold:true, color:c=>c.netMarginPct>=0?'#22c55e':'#ef4444'},
              {l:t('sim.breakEvenRoas', null, 'Break-even ROAS'), f:c=>`${c.breakEvenRoas.toFixed(2)}×`, muted:true},
            ].map((row,ri) => {
              if (row.sep) return <tr key={ri}><td colSpan={4} style={{height:12,borderBottom:'1px solid var(--border)'}} /></tr>
              return (
              <tr key={ri} style={{background:ri%2===0?'transparent':'rgba(255,255,255,0.015)',transition:'background 0.15s'}}>
                <td style={{padding:'11px 18px',color:'var(--text2)',fontWeight:row.bold?800:500,fontSize:13,fontFamily:'Inter'}}>{row.l}</td>
                {scenarios.map((sc,i) => {
                  const calc = calcScenario(sc)
                  const cellColor = typeof row.color === 'function'
                    ? row.color(calc)
                    : row.color
                      ? row.color
                      : row.muted
                        ? 'var(--text3)'
                        : '#f5f5f5'
                  return <td key={i} style={{padding:'11px 18px',textAlign:'right',fontFamily: 'inherit',fontWeight:row.bold?900:700,fontSize:row.bold?15:13,color:cellColor}}>{row.f(calc,sc)}</td>
                })}
              </tr>
            )})}
          </tbody>
        </table>
        </div>
      </div>

      <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14,marginTop:20}}>
        <div
          style={{
            position: 'relative',
            background: 'var(--surface)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1.5px solid var(--border)',
            borderTopColor: 'rgba(255,255,255,0.12)',
            borderBottomColor: 'rgba(0,0,0,0.65)',
            borderRadius: 16,
            padding: 22,
            overflow: 'hidden',
            boxShadow: 'none',
            animation: 'sim-pulse 6s ease-in-out infinite',
            transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.animationPlayState = 'paused'
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.animationPlayState = 'running'
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
            background: 'none',
            filter: 'blur(0.3px)',
            opacity: 0.85,
            animation: 'cr-shine 4s ease-in-out infinite',
            zIndex: 3,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '-50%',
            width: '40%',
            background: 'none',
            animation: 'sim-scan 9s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.14em',margin:0,fontWeight:640}}>{t('sim.revVsNetProfit', null, 'Fatturato vs Profitto netto')}</p>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'#22c55e', boxShadow:'0 0 10px #22c55e', animation:'card-pulse 2s ease-in-out infinite' }} />
              Live
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scenarios.map((sc,i)=>{const c=calcScenario(sc);return{name:sc.name||`Sc.${i+1}`,netto:c.revenue,profitto:c.profittoNetto}})} margin={{top:12,right:8,left:0,bottom:4}} barGap={6}>
              <defs>
                <linearGradient id="sim-bar-netto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.7} />
                </linearGradient>
                <linearGradient id="sim-bar-profitto" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#22c55e" stopOpacity={1} />
                  <stop offset="100%" stopColor="#15803d" stopOpacity={0.7} />
                </linearGradient>
                <filter id="sim-bar-glow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2.5" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${Math.round(v/1000)}k`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 10 }} iconType="circle" />
              <Bar
                dataKey="netto"
                name={t('sim.netRevShort', null, 'Fatt. netto')}
                fill="url(#sim-bar-netto)"
                radius={[10,10,0,0]}
                animationDuration={1400}
                animationEasing="ease-out"
                style={{ filter: 'url(#sim-bar-glow)' }}
              />
              <Bar
                dataKey="profitto"
                name={t('sim.netProfitShort', null, 'Profitto netto')}
                fill="url(#sim-bar-profitto)"
                radius={[10,10,0,0]}
                animationDuration={1400}
                animationBegin={180}
                animationEasing="ease-out"
                style={{ filter: 'url(#sim-bar-glow)' }}
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
        <div
          style={{
            position: 'relative',
            background: 'var(--surface)',
            backdropFilter: 'none',
            WebkitBackdropFilter: 'none',
            border: '1.5px solid var(--border)',
            borderTopColor: 'rgba(255,255,255,0.12)',
            borderBottomColor: 'rgba(0,0,0,0.65)',
            borderRadius: 16,
            padding: 22,
            overflow: 'hidden',
            boxShadow: 'none',
            animation: 'sim-pulse 6s ease-in-out infinite',
            transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
          }}
          onMouseEnter={e => {
            e.currentTarget.style.animationPlayState = 'paused'
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
          }}
          onMouseLeave={e => {
            e.currentTarget.style.animationPlayState = 'running'
            e.currentTarget.style.transform = ''
            e.currentTarget.style.boxShadow = 'none'
            e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
          }}
        >
          <div style={{
            position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
            background: 'none',
            filter: 'blur(0.3px)',
            opacity: 0.85,
            animation: 'cr-shine 4s ease-in-out infinite',
            zIndex: 3,
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', top: 0, bottom: 0, left: '-50%',
            width: '40%',
            background: 'none',
            animation: 'sim-scan 9s ease-in-out infinite',
            pointerEvents: 'none',
            zIndex: 1,
          }} />
          <div style={{ position: 'relative', zIndex: 2 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <p style={{fontSize:10,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.14em',margin:0,fontWeight:640}}>{t('sim.costBreakdown', null, 'Breakdown costi')}</p>
            <span style={{ display:'inline-flex', alignItems:'center', gap:6, fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.1em' }}>
              <span style={{ width:6, height:6, borderRadius:999, background:'#2997ff', boxShadow:'0 0 10px #2997ff', animation:'card-pulse 2s ease-in-out infinite' }} />
              Live
            </span>
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={scenarios.map((sc,i)=>{const c=calcScenario(sc);return{name:sc.name||`Sc.${i+1}`,iva:c.iva,cogs:c.cogsAmount,adv:sc.spend}})} margin={{top:12,right:8,left:0,bottom:4}} barGap={6}>
              <defs>
                <linearGradient id="sim-bar-iva" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--text3)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.08)" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="sim-bar-cogs" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--text2)" stopOpacity={1} />
                  <stop offset="100%" stopColor="rgba(255,255,255,0.18)" stopOpacity={1} />
                </linearGradient>
                <linearGradient id="sim-bar-adv" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#3b82f6" stopOpacity={1} />
                  <stop offset="100%" stopColor="#1e3a8a" stopOpacity={0.8} />
                </linearGradient>
                <filter id="sim-bar-glow-2" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="2" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
              </defs>
              <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
              <XAxis dataKey="name" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${Math.round(v/1000)}k`} />
              <Tooltip content={<ChartTip />} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
              <Legend wrapperStyle={{ fontSize: 11.5, paddingTop: 10 }} iconType="circle" />
              <Bar
                dataKey="iva"
                name="IVA 22%"
                fill="url(#sim-bar-iva)"
                stackId="c"
                radius={[10,10,0,0]}
                animationDuration={1400}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="cogs"
                name="COGS"
                fill="url(#sim-bar-cogs)"
                stackId="c"
                animationDuration={1400}
                animationBegin={180}
                animationEasing="ease-out"
              />
              <Bar
                dataKey="adv"
                name={t('sim.adSpend', null, 'Spesa ADV')}
                fill="url(#sim-bar-adv)"
                stackId="c"
                radius={[0,0,10,10]}
                animationDuration={1400}
                animationBegin={360}
                animationEasing="ease-out"
                style={{ filter: 'url(#sim-bar-glow-2)' }}
              />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </div>
      </div>

      {(() => {
        const results = scenarios.map((sc,i)=>({...calcScenario(sc), name:sc.name||`Scenario ${i+1}`, spend:sc.spend, roas:sc.roas, cogs:sc.cogs, aov:sc.aov}))
        const best = results.reduce((a,b)=>b.profittoNetto>a.profittoNetto?b:a)
        const mostEfficient = results.reduce((a,b)=>b.netMarginPct>a.netMarginPct?b:a)
        const safest = results.reduce((a,b)=>b.marginePct>a.marginePct?b:a)

        const cashFlowAnalysis = results.map(r => {
          const cashOut = r.spend + r.cogsAmount
          const cashIn = r.revenueIvaInclusa
          const cashRatio = cashOut > 0 ? cashIn / cashOut : 0
          const monthsToRecover = r.profittoNetto > 0 ? r.spend / r.profittoNetto : null
          const annualProfit = r.profittoNetto * 12
          const advAsRevenueShare = r.revenueIvaInclusa > 0 ? (r.spend / r.revenueIvaInclusa) * 100 : 0
          const runway = r.profittoNetto < 0 ? Math.abs(r.profittoNetto) : 0
          return { ...r, cashOut, cashIn, cashRatio, monthsToRecover, annualProfit, advAsRevenueShare, runway }
        })

        const scalable = cashFlowAnalysis.filter(r => r.profittoNetto > 0 && r.netMarginPct >= 5)
        const risky = cashFlowAnalysis.filter(r => r.profittoNetto > 0 && r.netMarginPct < 5 && r.netMarginPct >= 0)
        const losing = cashFlowAnalysis.filter(r => r.profittoNetto < 0)

        return (
          <div
            style={{
              marginTop: 22,
              background: 'var(--surface)',
              backdropFilter: 'none',
              WebkitBackdropFilter: 'none',
              border: '1.5px solid var(--border)',
              borderTopColor: 'rgba(255,255,255,0.12)',
              borderBottomColor: 'rgba(0,0,0,0.65)',
              borderRadius: 16,
              padding: 28,
              position: 'relative',
              overflow: 'hidden',
              boxShadow: 'none',
              animation: 'sim-pulse 6s ease-in-out infinite',
              animationDelay: '2.8s',
              transition: 'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.animationPlayState = 'paused'
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.18)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.animationPlayState = 'running'
              e.currentTarget.style.transform = ''
              e.currentTarget.style.boxShadow = 'none'
              e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.12)'
            }}
          >
            <div style={{
              position: 'absolute', top: 0, left: '8%', right: '8%', height: 1.5,
              background: 'none',
              filter: 'blur(0.3px)',
              animation: 'cr-shine 4s ease-in-out infinite',
              zIndex: 3,
              pointerEvents: 'none',
            }} />
            <div style={{
              position: 'absolute', top: 0, bottom: 0, left: '-50%',
              width: '40%',
              background: 'none',
              animation: 'sim-scan 9s ease-in-out infinite',
              animationDelay: '4s',
              pointerEvents: 'none',
              zIndex: 1,
            }} />

            <div style={{ marginBottom: 22 }}>
              <h2 style={{ margin: 0, color: 'var(--text)', fontSize: 15, fontWeight: 680, letterSpacing: '-0.01em' }}>
                {t('sim.strategicAnalysis', null, 'Analisi strategica CMO + CFO')}
              </h2>
              <p style={{ margin: '4px 0 0', color: 'var(--text3)', fontSize: 13 }}>
                {t('sim.strategicAnalysisSub', null, 'Lettura combinata marketing + finanza per ogni scenario')}
              </p>
            </div>

            {/* P&L Summary */}
            <div style={{ marginBottom: 22 }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.14em', marginBottom: 12 }}>
                {t('sim.plMonthly', null, 'P&L mensile per scenario')}
              </p>
              {cashFlowAnalysis.map((r,i) => (
                <div key={i} style={{
                  background: 'var(--glass)',
                  border: '1.5px solid var(--border)',
                  borderTopColor: 'rgba(255,255,255,0.10)',
                  borderBottomColor: 'rgba(0,0,0,0.4)',
                  borderLeftColor: scenarioColors[i],
                  borderLeftWidth: 3,
                  borderRadius: 12,
                  padding: '16px 18px',
                  marginBottom: 10,
                  boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
                }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:8}}>
                    <span style={{color:scenarioColors[i],fontWeight:680,fontSize:15}}>{r.name}</span>
                    <span style={{
                      color:r.profittoNetto>=0?'#22c55e':'#ef4444',
                      fontWeight:680, fontSize:15, fontFamily: 'inherit',
                    }}>{sm0(r.profittoNetto)}<span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--text3)', marginLeft: 4 }}>{t('sim.perMonth', null, '/mese')}</span></span>
                  </div>
                  <div style={{display:'flex',gap:14,flexWrap:'wrap',fontSize:11.5,color:'var(--text3)',fontWeight:600}}>
                    <span>{t('sim.grossRev', null, 'Fatt. lordo:')} <span style={{ color: 'var(--text2)' }}>{sm0(r.revenueIvaInclusa)}</span></span>
                    <span>IVA: <span style={{ color: 'var(--text2)' }}>-{sm0(r.iva)}</span></span>
                    <span>{t('sim.netRev', null, 'Fatt. netto:')} <span style={{ color: 'var(--text2)' }}>{sm0(r.revenue)}</span></span>
                    <span>COGS ({r.cogs}%): <span style={{ color: 'var(--text2)' }}>-{sm0(r.cogsAmount)}</span></span>
                    <span>ADV: <span style={{ color: 'var(--text2)' }}>-{sm0(r.spend)}</span></span>
                    <span>ADV/Revenue: <span style={{ color: 'var(--text2)' }}>{sp1(r.advAsRevenueShare)}</span></span>
                  </div>
                </div>
              ))}
            </div>

            {/* Cash Flow */}
            <div style={{marginBottom:22}}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:640,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:12}}>{t('sim.cashFlow', null, 'Flusso di cassa e sostenibilità')}</p>
              <div style={{
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.7,
                fontWeight: 500,
                background: 'var(--glass)',
                border: '1.5px solid var(--border)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.4)',
                borderRadius: 12,
                padding: '16px 18px',
                boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
              }}>
                {cashFlowAnalysis.map((r,i) => {
                  const isSafe = r.profittoNetto > 0 && r.netMarginPct >= 10
                  const isOk = r.profittoNetto > 0 && r.netMarginPct >= 5
                  const isTight = r.profittoNetto > 0 && r.netMarginPct < 5
                  const isLosing = r.profittoNetto < 0
                  return (
                    <div key={i} style={{marginBottom:12,paddingBottom:12,borderBottom:'1px solid var(--border)'}}>
                      <span style={{color:scenarioColors[i],fontWeight:680}}>{r.name}:</span>{' '}
                      {isLosing && <span style={{color:'#ef4444'}}>{t('sim.cfLosing', { loss: sm0(Math.abs(r.profittoNetto)), runway: sm0(r.runway) }, `In perdita di ${sm0(Math.abs(r.profittoNetto))}/mese. Servono ${sm0(r.runway)} di cassa extra ogni mese per sostenerlo. Non scalabile — stai finanziando la crescita di tasca tua. `)}</span>}
                      {isTight && <span style={{color:'#f59e0b'}}>{t('sim.cfTight', { margin: sp1(r.netMarginPct) }, `Margine netto solo al ${sp1(r.netMarginPct)} — tecnicamente in profitto ma senza cuscinetto. Un calo del ROAS del 10% ti manda in perdita. Troppo rischioso per scalare. `)}</span>}
                      {isOk && !isSafe && <span>{t('sim.cfOk', { margin: sp1(r.netMarginPct), monthly: sm0(r.profittoNetto), annual: sm0(r.annualProfit) }, `Margine netto al ${sp1(r.netMarginPct)} — sufficiente per scalare con cautela. Cash flow positivo di ${sm0(r.profittoNetto)}/mese (${sm0(r.annualProfit)}/anno). `)}</span>}
                      {isSafe && <span>{t('sim.cfSafe', { margin: sp1(r.netMarginPct), monthly: sm0(r.profittoNetto), annual: sm0(r.annualProfit) }, `Margine netto solido al ${sp1(r.netMarginPct)}. Cash flow di ${sm0(r.profittoNetto)}/mese = ${sm0(r.annualProfit)}/anno. Puoi reinvestire il profitto per scalare senza rischio. `)}</span>}
                      <span style={{color:'var(--text3)'}}>{t('sim.cfRatio', { ratio: r.cashRatio.toFixed(2) }, `Cash in/out ratio: ${r.cashRatio.toFixed(2)}× — per ogni €1 che esci, ne entrano €${r.cashRatio.toFixed(2)}.`)} {r.cashRatio < 1.1 ? t('sim.cfTooTight', null, 'Troppo tirato.') : r.cashRatio < 1.3 ? t('sim.cfThinMargin', null, 'Margine sottile.') : t('sim.cfHealthy', null, 'Sano.')}</span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Strategia di scaling */}
            <div style={{marginBottom:22}}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:640,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:12}}>{t('sim.scalingStrategy', null, 'Strategia di scaling raccomandata')}</p>
              <div style={{
                fontSize: 13,
                color: 'var(--text)',
                lineHeight: 1.7,
                fontWeight: 500,
                background: 'var(--glass)',
                border: '1.5px solid var(--border)',
                borderTopColor: 'rgba(255,255,255,0.10)',
                borderBottomColor: 'rgba(0,0,0,0.4)',
                borderRadius: 12,
                padding: '16px 18px',
                boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
              }}>
                {scalable.length > 0 ? (
                  <>
                    <p style={{marginBottom:8}}>{t('sim.scaleBest', { name: scalable.sort((a,b)=>b.annualProfit-a.annualProfit)[0].name, profit: sm0(scalable[0].annualProfit), margin: sp1(scalable[0].netMarginPct) }, `Lo scenario migliore per scalare è "${scalable.sort((a,b)=>b.annualProfit-a.annualProfit)[0].name}" — genera ${sm0(scalable[0].annualProfit)} di profitto annuo con un margine netto del ${sp1(scalable[0].netMarginPct)} che lascia spazio per imprevisti (calo ROAS stagionale, aumento CPM, resi).`)}</p>
                    <p style={{marginBottom:8}}>{t('sim.scaleCosts', { cogs: scalable[0].cogs, adv: sp1(scalable[0].advAsRevenueShare) }, `Con COGS al ${scalable[0].cogs}% e ADV che pesa il ${sp1(scalable[0].advAsRevenueShare)} del fatturato lordo, la struttura dei costi è`)} {scalable[0].advAsRevenueShare < 25 ? t('sim.costHealthy', null, 'sana — c\'è margine per aumentare la spesa ADV se il ROAS tiene') : scalable[0].advAsRevenueShare < 35 ? t('sim.costAvg', null, 'nella media — monitora attentamente il ROAS, non c\'è molto margine di errore') : t('sim.costHigh', null, 'alta — l\'ADV pesa troppo sul fatturato, prima di scalare devi migliorare il ROAS o l\'AOV')}.</p>
                    {scalable[0].monthsToRecover && <p style={{marginBottom:8}}>{t('sim.scalePayback', null, 'Ogni mese di ADV si ripaga in')} <strong>{scalable[0].monthsToRecover < 1 ? t('sim.lessThanMonth', null, 'meno di un mese') : t('sim.nMonths', { n: scalable[0].monthsToRecover.toFixed(1) }, `${scalable[0].monthsToRecover.toFixed(1)} mesi`)}</strong> — {scalable[0].monthsToRecover < 1 ? t('sim.cycleFast', null, 'ciclo di cassa velocissimo, ideale per scalare') : scalable[0].monthsToRecover < 3 ? t('sim.cycleReasonable', null, 'ciclo ragionevole') : t('sim.cycleLong', null, 'ciclo lungo, attenzione alla liquidità')}.</p>}
                  </>
                ) : risky.length > 0 ? (
                  <p style={{color:'var(--text2)'}}>{t('sim.scaleRisky', { name: risky[0].name, margin: sp1(risky[0].netMarginPct) }, `Nessuno scenario ha margini sufficienti per scalare in sicurezza. "${risky[0].name}" è in profitto ma con margini troppo sottili (${sp1(risky[0].netMarginPct)}). Prima di scalare: lavora sull'AOV (bundle, upsell), riduci i COGS (negozia fornitori, packaging), o migliora il ROAS (creative testing, audience optimization).`)}</p>
                ) : (
                  <p style={{color:'var(--text2)'}}>{t('sim.scaleLosing', null, "Tutti gli scenari sono in perdita. Non scalare la spesa ADV finché non raggiungi almeno il break-even. Concentrati su: migliorare il ROAS (creative, targeting), alzare l'AOV (bundle, cross-sell), ridurre i COGS, o valutare se il canale paid è sostenibile per il tuo modello di business.")}</p>
                )}
              </div>
            </div>

            {/* Visione a 12 mesi */}
            <div style={{marginBottom:18}}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:640,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:12}}>{t('sim.projection12', null, 'Proiezione 12 mesi')}</p>
              <div className="m-grid2" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:12}}>
                {cashFlowAnalysis.map((r,i) => (
                  <div key={i} style={{
                    background: 'var(--glass)',
                    border: '1.5px solid var(--border)',
                    borderTopColor: scenarioColors[i],
                    borderTopWidth: 2,
                    borderBottomColor: 'rgba(0,0,0,0.4)',
                    borderRadius: 12,
                    padding: '16px 18px',
                    boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
                  }}>
                    <div style={{color:scenarioColors[i],fontWeight:680,fontSize:13,marginBottom:10}}>{r.name} — {t('sim.months12', null, '12 mesi')}</div>
                    <div style={{fontSize:11.5,color:'var(--text3)',lineHeight:1.8}}>
                      <div>{t('sim.annualRev', null, 'Fatturato annuo:')} <strong style={{color:'var(--text)'}}>{sm0(r.revenueIvaInclusa * 12)}</strong></div>
                      <div>{t('sim.annualAdv', null, 'Spesa ADV annua:')} <strong style={{color:'var(--text)'}}>{sm0(r.spend * 12)}</strong></div>
                      <div>{t('sim.annualCogs', null, 'COGS annuo:')} <strong style={{color:'var(--text)'}}>{sm0(r.cogsAmount * 12)}</strong></div>
                      <div>{t('sim.annualVat', null, 'IVA annua:')} <strong style={{color:'var(--text)'}}>{sm0(r.iva * 12)}</strong></div>
                      <div style={{borderTop:'1px solid var(--border)',marginTop:8,paddingTop:8}}>
                        {t('sim.annualNetProfit', null, 'Profitto netto annuo:')} <strong style={{color:r.annualProfit>=0?'#22c55e':'#ef4444',fontSize:15,fontFamily: 'inherit'}}>{sm0(r.annualProfit)}</strong>
                      </div>
                      <div>{t('sim.annualOrders', null, 'Ordini annui:')} <strong style={{color:'var(--text)'}}>{si0(r.orders * 12)}</strong></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom line */}
            <div style={{
              background: 'var(--glass)',
              border: '1.5px solid var(--border)',
              borderTopColor: 'rgba(255,255,255,0.10)',
              borderBottomColor: 'rgba(0,0,0,0.4)',
              borderLeftColor: ACCENT_GLOW,
              borderLeftWidth: 3,
              borderRadius: 12,
              padding: '18px 22px',
              boxShadow: '0 14px 32px rgba(0,0,0,0.45), 0 4px 10px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.04), inset 0 -1px 0 rgba(0,0,0,0.18)',
            }}>
              <p style={{fontSize:10,color:'var(--text3)',fontWeight:640,textTransform:'uppercase',letterSpacing:'0.14em',marginBottom:10}}>{t('sim.bottomLine', null, 'Bottom line')}</p>
              <div style={{fontSize:13,color:'var(--text)',lineHeight:1.65,fontWeight:500}}>
                {t('sim.breakEvenRoasLabel', null, 'Break-even ROAS:')} {cashFlowAnalysis.map(r=><span key={r.name}><strong style={{color:scenarioColors[results.indexOf(r)]}}>{r.name}</strong> = {r.breakEvenRoas.toFixed(2)}× · </span>)}
                <br/>{t('sim.belowAbove', null, 'Sotto questi valori perdi soldi. Sopra, ogni punto di ROAS in più è margine puro.')}
                {cashFlowAnalysis.some(r=>r.advAsRevenueShare>30) && <><br/><span style={{color:'var(--text2)'}}>{t('sim.advOver30', null, 'La spesa ADV supera il 30% del fatturato in alcuni scenari — valuta di diversificare i canali (email, organic, referral) per ridurre la dipendenza dal paid.')}</span></>}
              </div>
            </div>
          </div>
        )
      })()}
      </>
    ), { glow: '#2997ff', padding: 28, delay: 1.4 })}

    {/* L'agente del Simulatore (CMO+CFO): legge gli scenari gia' calcolati qui sopra. */}
    <SimulatorAgent
      ltvInputs={ltvInputs}
      ltvOutputs={ltvOutputs}
      scenarios={scenarios}
      cashFlowAnalysis={cashFlowAnalysisFull}
    />
    </div>
  )
}
// ── Delta + celle KPI riutilizzabili ───────────────────────────
function DeltaMini({ current, previous, kind = 'number' }) {
  const RED = '#ef4444'
  const WHITE = '#f8fafc'

  const c = Number(current)
  const p = Number(previous)

  if (!Number.isFinite(c) || !Number.isFinite(p)) return null

  const diff = c - p
  if (Math.abs(diff) < 0.000001) return null

  const pct = p !== 0 ? diff / p * 100 : null
  const sign = diff > 0 ? '+' : '−'
  const color = diff < 0 ? RED : WHITE
  const abs = Math.abs(diff)

  const formatAbs = () => {
    if (kind === 'euro0') return `€${Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`
    if (kind === 'euro2') {
      return `€${abs.toLocaleString(localeNumeri(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }
    if (kind === 'int') return Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })
    if (kind === 'percent') {
      return `${abs.toLocaleString(localeNumeri(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
    }
    return abs.toLocaleString(localeNumeri(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  return (
    <div
      style={{
        marginTop: 8,
        display: 'grid',
        rowGap: 3,
        color,
        fontSize: 13,
        lineHeight: 1.2,
        fontWeight: 680,
        whiteSpace: 'nowrap',
      }}
    >
      <div>{sign}{formatAbs()}</div>

      {pct != null && (
        <div>
          {sign}{Math.abs(pct).toLocaleString(localeNumeri(), {
            minimumFractionDigits: 1,
            maximumFractionDigits: 1,
          })}%
        </div>
      )}
    </div>
  )
}

function MonthlyValue({ value, previous, kind = 'euro0', suffix = '' }) {
  const WHITE = '#f8fafc'

  const money0 = n =>
    n != null && Number(n) > 0
      ? `€${Math.round(Number(n)).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`
      : '—'

  const money2 = n =>
    n != null && Number(n) > 0
      ? `€${Number(n).toLocaleString(localeNumeri(), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}`
      : '—'

  const int0 = n =>
    n != null && Number(n) > 0
      ? Math.round(Number(n)).toLocaleString(localeNumeri(), { useGrouping: 'always' })
      : '—'

  const pct1 = n =>
    n != null
      ? `${Number(n).toLocaleString(localeNumeri(), {
          minimumFractionDigits: 1,
          maximumFractionDigits: 1,
        })}%`
      : '—'

  const pct2 = n =>
    n != null
      ? `${Number(n).toLocaleString(localeNumeri(), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })}%`
      : '—'

  const dec2 = n =>
    n != null
      ? Number(n).toLocaleString(localeNumeri(), {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        })
      : '—'

  let shown = '—'

  if (kind === 'euro0') shown = money0(value)
  else if (kind === 'euro2') shown = money2(value)
  else if (kind === 'int') shown = int0(value)
  else if (kind === 'percent1') shown = pct1(value)
  else if (kind === 'percent2') shown = pct2(value)
  else if (kind === 'ratio') shown = value != null ? `${dec2(value)}${suffix}` : '—'
  else shown = value != null ? String(value) : '—'

  return (
    <div>
      <div
        style={{
          fontFamily: 'inherit',
          fontWeight: 680,
          fontSize: 15,
          lineHeight: 1.15,
          color: WHITE,
          whiteSpace: 'nowrap',
        }}
      >
        {shown}
      </div>

      <DeltaMini
        current={value}
        previous={previous}
        kind={
          kind === 'percent1' || kind === 'percent2'
            ? 'percent'
            : kind
        }
      />
    </div>
  )
}

// ── WeeklyTab ─────────────────────────────────────────────────
function WeeklyTab({ weeks, data, metaWeekly, shopifyWeekly, googleWeekly, onUpdate, cfg, S, preset: presetProp, weeklyTF, setWeeklyTF, weeklyCustom, setWeeklyCustom, onRefresh, loading: loadingProp }) {
  const { t } = useI18n()
  const WHITE = '#f8fafc'
  const RED = '#ef4444'

  const money0 = n => n != null && Number(n) > 0 ? `€${Math.round(Number(n)).toLocaleString(localeNumeri(), { useGrouping: 'always' })}` : '—'
  const money2 = n => n != null && Number(n) > 0 ? `€${Number(n).toLocaleString(localeNumeri(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '—'
  const int0 = n => n != null && Number(n) > 0 ? Math.round(Number(n)).toLocaleString(localeNumeri(), { useGrouping: 'always' }) : '—'
  const pct1 = n => n != null ? `${Number(n).toLocaleString(localeNumeri(), { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '—'
  const pct2 = n => n != null ? `${Number(n).toLocaleString(localeNumeri(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '—'
  const dec2 = n => n != null ? Number(n).toLocaleString(localeNumeri(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'

  const asNum = v => Number.isFinite(Number(v)) ? Number(v) : 0
  const div = (a, b) => b > 0 ? a / b : null

  const delta = (curr, prev) => {
    if (curr == null || prev == null) return null
    const c = Number(curr)
    const p = Number(prev)
    if (!Number.isFinite(c) || !Number.isFinite(p)) return null

    const diff = c - p
    const pct = p !== 0 ? diff / p * 100 : null
    const equal = Math.abs(diff) < 0.000001

    return { diff, pct, equal }
  }

  const formatDelta = (v, kind) => {
    const abs = Math.abs(Number(v || 0))

    if (kind === 'euro0') {
      return `€${Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`
    }

    if (kind === 'euro2') {
      return `€${abs.toLocaleString(localeNumeri(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}`
    }

    if (kind === 'int') {
      return Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })
    }

    if (kind === 'percent') {
      return `${abs.toLocaleString(localeNumeri(), {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })}%`
    }

    return abs.toLocaleString(localeNumeri(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  const Delta = ({ current, previous, kind = 'number' }) => {
    const d = delta(current, previous)
    if (!d || d.equal) return null

    const sign = d.diff > 0 ? '+' : '−'
    const color = d.diff < 0 ? RED : WHITE

    return (
      <div
        style={{
          marginTop: 8,
          display: 'grid',
          rowGap: 3,
          color,
          fontSize: 13,
          lineHeight: 1.2,
          fontWeight: 680,
          whiteSpace: 'nowrap',
        }}
      >
        <div>{sign}{formatDelta(d.diff, kind)}</div>

        {d.pct != null && (
          <div>
            {sign}{Math.abs(d.pct).toLocaleString(localeNumeri(), {
              minimumFractionDigits: 1,
              maximumFractionDigits: 1,
            })}%
          </div>
        )}
      </div>
    )
  }

  const metaMap = {}
  for (const m of metaWeekly || []) {
    metaMap[m.date] = m
  }

  const shopifyMap = {}
  for (const s of shopifyWeekly || []) {
    shopifyMap[s.date] = s
  }

  // Spesa Google per settimana (lunedì-key) dal collegamento /api/google — prima
  // era solo manuale (input). Override del manuale quando c'è il dato automatico.
  const googleMap = {}
  for (const gg of googleWeekly || []) {
    if (gg?.date) googleMap[gg.date] = gg
  }

  const allWeeks = weeks.map(({ key, label }) => {
    const d = data[key] || WEMPTY
    const mw = metaMap[key] || {}
    const sw = shopifyMap[key] || {}
    const gw = googleMap[key] || {}

    // Una settimana con piu' resi che vendite ha il fatturato NEGATIVO: e' un dato, non un buco
    // (vedi la mappa dei mesi). Il valore a mano entra solo se l'automatico e' zero.
    const fat = asNum(sw.fatturato) !== 0 ? asNum(sw.fatturato) : asNum(d.fatturato)
    const koongo = asNum(sw.koongoFatturato)   // marketplace, accanto e mai dentro
    const fatNC = asNum(sw.fatturNC) !== 0 ? asNum(sw.fatturNC) : asNum(d.fatturNC)
    const fatRC = asNum(sw.fatturRC) !== 0 ? asNum(sw.fatturRC) : asNum(d.fatturRC || Math.max(fat - fatNC, 0))
    // I resi della settimana c'erano gia' nella serie (shopifyWeekly.resi) ma la tabella non li
    // mostrava: Marino, 21 set 2026, "si, aggiungili". Stessa voce di Monthly/Quarter/Year.
    const resi = asNum(sw.resi)

    const meta = mw.spend > 0 ? asNum(mw.spend) : asNum(d.meta)
    const google = gw.spend > 0 ? asNum(gw.spend) : asNum(d.google)
    const adv = meta + google

    const ord = sw.ordini > 0 ? asNum(sw.ordini) : asNum(d.ordini)
    const nc = sw.nc > 0 ? asNum(sw.nc) : asNum(d.nc)
    const rc = sw.rc > 0 ? asNum(sw.rc) : asNum(d.rc)

    const ses =
      sw.uniqueSessions > 0
        ? asNum(sw.uniqueSessions)
        : sw.online_store_visitors > 0
          ? asNum(sw.online_store_visitors)
          : asNum(d.sessioni)

    const mer = div(fat, adv)
    const aMer = div(fatNC, adv)
    const cac = div(adv, nc)
    const cpo = div(adv, ord)

    const aov = div(fat, ord)
    const aovNC = div(fatNC, nc)
    const aovRC = div(fatRC, rc)

    const retention = nc + rc > 0 ? rc / (nc + rc) * 100 : null
    const cro = ses > 0 && ord > 0 ? ord / ses * 100 : null

    const ltv = aov ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
    const ratio = ltv && cac ? ltv / cac : null

    return {
      key,
      label,
      fat,
      koongo,
      fatNC,
      fatRC,
      resi,
      meta,
      google,
      adv,
      ord,
      nc,
      rc,
      ses,
      mer,
      aMer,
      cac,
      cpo,
      aov,
      aovNC,
      aovRC,
      retention,
      cro,
      ltv,
      ratio,
      metaAuto: mw.spend > 0,
      googleAuto: gw.spend > 0,
      shopifyAuto:
        sw.fatturato > 0 ||
        sw.fatturNC > 0 ||
        sw.fatturRC > 0 ||
        sw.ordini > 0 ||
        sw.nc > 0 ||
        sw.rc > 0 ||
        sw.uniqueSessions > 0 ||
        sw.online_store_visitors > 0,
    }
  })

  const filled = allWeeks.filter(w => w.fat > 0 || w.adv > 0 || w.metaAuto || w.shopifyAuto)
  const sum = key => filled.reduce((s, w) => s + asNum(w[key]), 0)

  const totFat = sum('fat')
  const totFatNC = sum('fatNC')
  const totFatRC = sum('fatRC')
  const totAdv = sum('adv')
  const totMeta = sum('meta')
  const totGoog = sum('google')
  const totOrd = sum('ord')
  const totNC = sum('nc')
  const totRC = sum('rc')
  const totSes = sum('ses')

  const avgMER = div(totFat, totAdv)
  const avgAMER = div(totFatNC, totAdv)
  const avgCAC = div(totAdv, totNC)
  const avgCPO = div(totAdv, totOrd)

  const avgAOV = div(totFat, totOrd)
  const avgAOVNC = div(totFatNC, totNC)
  const avgAOVRC = div(totFatRC, totRC)

  const avgRet = totNC + totRC > 0 ? totRC / (totNC + totRC) * 100 : null
  const avgCRO = totSes > 0 && totOrd > 0 ? totOrd / totSes * 100 : null

  const avgLTV = avgAOV ? avgAOV * cfg.freq * cfg.life * cfg.margin / 100 : null
  const avgRatio = avgLTV && avgCAC ? avgLTV / avgCAC : null

  const chartData = filled.map(w => ({
    label: w.label,
    fatturato: w.fat,
    spesa: w.adv,
    nc: w.nc,
    rc: w.rc,
    mer: w.mer,
    aov: w.aov,
    cro: w.cro,
    ratio: w.ratio,
  }))

  const tableWrap = {
    overflow: 'auto',
    maxHeight: '72vh',
    position: 'relative',
  }

  const TH = {
    ...S.th,
    position: 'sticky',
    top: 0,
    zIndex: 20,
    background: 'var(--surface)',
    boxShadow: '0 1px 0 var(--border)',
    fontSize: 13,
    padding: '12px 14px',
  }

  const TD = {
    ...S.td,
    fontSize: 15,
    padding: '10px 14px',
    verticalAlign: 'top',
  }

  const valueStyle = {
    fontFamily: 'inherit',
    fontWeight: 680,
    fontSize: 15,
    lineHeight: 1.15,
  }

  const Value = ({ value, prev, kind = 'euro0', suffix = '' }) => {
    let shown = '—'

    if (kind === 'euro0') shown = money0(value)
    else if (kind === 'euro2') shown = money2(value)
    else if (kind === 'int') shown = int0(value)
    else if (kind === 'percent1') shown = pct1(value)
    else if (kind === 'percent2') shown = pct2(value)
    else if (kind === 'ratio') shown = value != null ? `${dec2(value)}${suffix}` : '—'
    else shown = value != null ? String(value) : '—'

    return (
      <div>
        <div style={{ ...valueStyle, color: WHITE }}>{shown}</div>
        <Delta
          current={value}
          previous={prev}
          kind={kind === 'percent1' || kind === 'percent2' ? 'percent' : kind}
        />
      </div>
    )
  }

  const InputOrValue = ({ week, field, value, prev, disabled, isCount = false }) => (
    disabled ? (
      <Value value={value} prev={prev} kind={isCount ? 'int' : 'euro0'} />
    ) : (
      <div>
        <NumInput
          value={value}
          onChange={val => onUpdate(week, field, val)}
          placeholder="0"
          color={WHITE}
          isCount={isCount}
        />
        <Delta current={value} previous={prev} kind={isCount ? 'int' : 'euro0'} />
      </div>
    )
  )

  // ── Weekly timeframe filter ──
  const getMonday = (d) => { const dt = new Date(d); dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); return dt.toISOString().slice(0,10) }
  const today = new Date()
  const thisMonday = getMonday(today)
  const lastMonday = (() => { const d = new Date(thisMonday); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0,10) })()
  const lastSunday = (() => { const d = new Date(thisMonday); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10) })()
  const prevPrevMonday = (() => { const d = new Date(lastMonday); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0,10) })()

  const week3ago = (() => { const d = new Date(prevPrevMonday); d.setUTCDate(d.getUTCDate() - 7); return d.toISOString().slice(0,10) })()

  let tfWeeks = [], tfPrevWeeks = [], tfLabel = ''
  if (weeklyTF === 'this_week') {
    // Solo settimana corrente, delta vs settimana precedente
    tfWeeks = allWeeks.filter(w => w.key === thisMonday)
    tfPrevWeeks = allWeeks.filter(w => w.key === lastMonday)
    tfLabel = `Settimana corrente vs precedente`
  } else if (weeklyTF === 'last_week') {
    // Solo settimana precedente, delta vs quella prima
    tfWeeks = allWeeks.filter(w => w.key === lastMonday)
    tfPrevWeeks = allWeeks.filter(w => w.key === prevPrevMonday)
    tfLabel = `Settimana precedente vs quella prima`
  } else if (weeklyTF === 'custom' && weeklyCustom.since && weeklyCustom.until) {
    // Custom: tutte le settimane che si SOVRAPPONGONO all'intervallo scelto.
    // Prima si filtrava per w.key, cioè il LUNEDÌ, dentro il range: bastava
    // scegliere sul calendario un intervallo senza lunedì (es. mar→dom, o un
    // giorno solo) perché non restasse nessuna settimana → tab Weekly vuota,
    // "non traccia nessun dato da Shopify". Una settimana va da key a key+6.
    const weekEnd = k => {
      const d = new Date(k + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + 6)
      return d.toISOString().slice(0, 10)
    }
    tfWeeks = allWeeks.filter(w => weekEnd(w.key) >= weeklyCustom.since && w.key <= weeklyCustom.until)
    const span = tfWeeks.length || 1
    const firstKey = tfWeeks[0]?.key || weeklyCustom.since
    const prevEnd = (() => { const d = new Date(firstKey); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0,10) })()
    const prevStart = (() => { const d = new Date(firstKey); d.setUTCDate(d.getUTCDate() - span * 7); return d.toISOString().slice(0,10) })()
    tfPrevWeeks = allWeeks.filter(w => w.key >= prevStart && w.key <= prevEnd)
    tfLabel = `${weeklyCustom.since} → ${weeklyCustom.until} vs periodo prec.`
  } else {
    tfWeeks = allWeeks.filter(w => w.key === thisMonday)
    tfPrevWeeks = allWeeks.filter(w => w.key === lastMonday)
    tfLabel = `Settimana corrente vs precedente`
  }

  // Colonne tabella: la settimana scelta, la precedente, e poi indietro fino
  // ad avere SEMPRE almeno due mesi. Con due sole colonne c'era il confronto ma
  // non l'andamento: una settimana storta sembrava una tendenza.
  //
  // Le colonne NON dipendono dall'arrivo dei dati. La prima versione le
  // fermava "dove finiva lo storico", ma la serie settimanale puo' tornare
  // vuota per un momento (Shopify strozza le query) e allora la tabella
  // ripiombava a due colonne: sembrava che la modifica fosse sparita. Una
  // settimana senza numeri mostra un trattino; il limite vero e' solo l'inizio
  // dell'elenco delle settimane.
  const MIN_SETTIMANE_TABELLA = 8
  const tableWeeks = (() => {
    const scelte = [...tfWeeks, ...tfPrevWeeks].sort((a, b) => b.key.localeCompare(a.key))
    const gia = new Set(scelte.map(w => w.key))
    const piuVecchia = scelte.length ? scelte[scelte.length - 1].key : null
    const mancanti = MIN_SETTIMANE_TABELLA - scelte.length
    if (mancanti <= 0) return scelte
    const prima = allWeeks
      .filter(w => !gia.has(w.key) && (piuVecchia == null || w.key < piuVecchia))
      .sort((a, b) => b.key.localeCompare(a.key))
      .slice(0, mancanti)
    return [...scelte, ...prima]
  })()
  // Colonne marketplace solo se il canale ha venduto nelle settimane mostrate.
  const mostraKoongoW = tableWeeks.some(w => Number(w.koongo || 0) > 0)

  // Available weeks for custom selector (all Monday dates with data)
  const availableWeeks = allWeeks.filter(w => w.fat > 0 || w.adv > 0 || w.metaAuto || w.shopifyAuto)

  const sumW = (arr, key) => arr.reduce((s, w) => s + asNum(w[key]), 0)
  const divW = (a, b) => b > 0 ? a / b : null

  const tf = { fat: sumW(tfWeeks,'fat'), ord: sumW(tfWeeks,'ord'), nc: sumW(tfWeeks,'nc'), rc: sumW(tfWeeks,'rc'), meta: sumW(tfWeeks,'meta'), google: sumW(tfWeeks,'google'), ses: sumW(tfWeeks,'ses'), koongo: sumW(tfWeeks,'koongo') }
  tf.adv = tf.meta + tf.google; tf.aov = divW(tf.fat, tf.ord); tf.mer = divW(tf.fat, tf.adv); tf.cac = divW(tf.adv, tf.nc)
  tf.ratio = tf.aov && tf.cac ? (tf.aov * cfg.freq * cfg.life * cfg.margin / 100) / tf.cac : null

  const tfP = { fat: sumW(tfPrevWeeks,'fat'), ord: sumW(tfPrevWeeks,'ord'), nc: sumW(tfPrevWeeks,'nc'), rc: sumW(tfPrevWeeks,'rc'), meta: sumW(tfPrevWeeks,'meta'), google: sumW(tfPrevWeeks,'google'), ses: sumW(tfPrevWeeks,'ses'), koongo: sumW(tfPrevWeeks,'koongo') }
  tfP.adv = tfP.meta + tfP.google; tfP.aov = divW(tfP.fat, tfP.ord); tfP.mer = divW(tfP.fat, tfP.adv); tfP.cac = divW(tfP.adv, tfP.nc)
  tfP.ratio = tfP.aov && tfP.cac ? (tfP.aov * cfg.freq * cfg.life * cfg.margin / 100) / tfP.cac : null

  const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 30 }) => {
    const vals = dataArr.map(d => Number(d[dataKey] || 0))
    if (vals.length < 2 || vals.every(v => v === 0)) return null
    const max = Math.max(...vals), min = Math.min(...vals), range = max - min || 1
    const points = vals.map((v, i) => `${(i/(vals.length-1))*width},${height-((v-min)/range)*(height-4)-2}`).join(' ')
    return <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}><polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
  }

  const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
    if (prev == null || prev === 0 || curr == null) return null
    const pctV = ((curr - prev) / prev) * 100
    if (Math.abs(pctV) < 0.1) return null
    const up = pctV > 0, good = isLowerBetter ? !up : up
    return <span style={{ fontSize:11.5, fontWeight:640, padding:'3px 8px', borderRadius:8, background:good?'#22c55e20':'#ef444420', color:good?'#22c55e':'#ef4444' }}>{up?'+':''}{pctV.toFixed(2)}%</span>
  }

  const ratioColor2 = r => ratioColor(r) // stesse soglie: un solo posto dove cambiarle
  const fr2 = n => n!=null ? `${Number(n).toFixed(2).replace('.',sepDecimali())}` : '—'
  const kpiCards = [
    { label:t('dash.revenue', null, 'Fatturato'), val:tf.fat, prev:tfP.fat, fmt:money0, color:'var(--green)', key:'fat', sources:['shopify'] },
    ...((tf.koongo > 0 || tfP.koongo > 0) ? [
      { label:t('dash.koongoRevenue', null, 'Fatturato Koongo'), val:tf.koongo, prev:tfP.koongo, fmt:money0, color:'var(--orange)', key:'koongo', sources:['shopify'] },
      { label:t('dash.revenueTotal', null, 'Fatturato totale'), val:tf.fat + tf.koongo, prev:tfP.fat + tfP.koongo, fmt:money0, color:'var(--green)', key:'fatTotale', sources:['shopify'] },
    ] : []),
    { label:t('dash.orders', null, 'Ordini'), val:tf.ord, prev:tfP.ord, fmt:int0, color:'var(--accent)', key:'ord', sources:['shopify'] },
    { label:'AOV', val:tf.aov, prev:tfP.aov, fmt:money2, color:'var(--orange)', key:'aov', sources:['shopify'] },
    { label:t('dash.newCustomersShort', null, 'Nuovi Clienti'), val:tf.nc, prev:tfP.nc, fmt:int0, color:'var(--cyan)', key:'nc', sources:['shopify'] },
    { label:t('dash.returningShort', null, 'Clienti Ritorno'), val:tf.rc, prev:tfP.rc, fmt:int0, color:'var(--purple)', key:'rc', sources:['shopify'] },
    { label:'MER', val:tf.mer, prev:tfP.mer, fmt:v=>v!=null?`${fr2(v)}×`:'—', color:tf.mer!=null?(tf.mer>=3?'var(--green)':tf.mer>=2?'var(--orange)':'var(--red)'):'var(--text3)', key:'mer', sources:['shopify','meta'] },
    { label:'CAC', val:tf.cac, prev:tfP.cac, fmt:money2, color:'var(--text)', key:'cac', lower:true, sources:['shopify','meta','google'] },
    { label:t('dash.ratioLtvCacLabel', null, 'Ratio LTV:CAC'), val:tf.ratio, prev:tfP.ratio, fmt:v=>v!=null?`${fr2(v)}:1`:'—', color:ratioColor2(tf.ratio), key:'ratio', sources:['shopify','meta'] },
    { label:t('dash.metaSpendLabel', null, 'Meta Spend'), val:tf.meta, prev:tfP.meta, fmt:money0, color:'var(--accent)', key:'meta', sources:['meta'] },
    { label:t('dash.googleSpend', null, 'Google Spend'), val:tf.google, prev:tfP.google, fmt:v=>v>0?money0(v):'—', color:'var(--yellow)', key:'google', sources:['google'] },
  ]

  return (
    <>
      {/* Timeframe selector */}
      <div className="rep-toolbar" style={{marginBottom:16, display:'flex', alignItems:'center', gap:8, flexWrap:'wrap'}}>
        <div className="rep-chips" style={{display:'contents'}}>
        {[
          { id:'this_week', l:t('dash.thisWeek', null, 'Questa settimana') },
          { id:'last_week', l:t('dash.lastWeek', null, 'Settimana precedente') },
          { id:'custom', l:t('dash.custom', null, 'Custom') },
        ].map(b => (
          <button key={b.id} onClick={()=>setWeeklyTF(b.id)} style={{
            fontSize:13, padding:'6px 14px', borderRadius:8, cursor:'pointer',
            border: weeklyTF===b.id?'1px solid #22c55e':'1px solid var(--border)',
            background: weeklyTF===b.id?'#22c55e20':'transparent',
            color: weeklyTF===b.id?'#22c55e':'var(--text3)',
            fontWeight: weeklyTF===b.id?700:500,
          }}>{b.l}</button>
        ))}
        </div>
        {weeklyTF==='custom' && (
          <div className="rep-custom" style={{display:'contents'}}>
            <span style={{fontSize:11.5,color:'var(--text3)'}}>{t('dash.from', null, 'Da:')}</span>
            <select value={weeklyCustom.since} onChange={e=>setWeeklyCustom(p=>({...p,since:e.target.value}))}
              style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 8px',color:'var(--text)',fontSize:13}}>
              <option value="">{t('dash.selectWeek', null, 'Seleziona settimana')}</option>
              {availableWeeks.map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
            <span style={{color:'var(--text3)'}}>→</span>
            <span style={{fontSize:11.5,color:'var(--text3)'}}>{t('dash.to', null, 'A:')}</span>
            <select value={weeklyCustom.until} onChange={e=>setWeeklyCustom(p=>({...p,until:e.target.value}))}
              style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:8,padding:'5px 8px',color:'var(--text)',fontSize:13}}>
              <option value="">{t('dash.selectWeek', null, 'Seleziona settimana')}</option>
              {availableWeeks.filter(w => !weeklyCustom.since || w.key >= weeklyCustom.since).map(w => <option key={w.key} value={w.key}>{w.label}</option>)}
            </select>
          </div>
        )}
        {onRefresh && (
          <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={onRefresh} disabled={loadingProp} gira={loadingProp} />
        )}
        <span className="rep-cmp" style={{fontSize:11.5,color:'var(--text3)'}}>{tfLabel}</span>
        <div className="rep-pdf" style={{display:'contents'}}><DownloadReportButton
          tab="Weekly"
          tipo="weekly"
          ltv={cfg}
          preset={weeklyTF === 'custom' ? undefined : weeklyTF}
          custom={weeklyTF === 'custom' && weeklyCustom.since && weeklyCustom.until ? (() => {
            // I due menu danno il LUNEDI' di ogni settimana, e la tabella qui sotto mostra le settimane
            // INTERE fino a quella scelta compresa. Al PDF invece arrivava quel lunedi' come ultimo
            // giorno: il report perdeva sei giorni dell'ultima settimana e confrontava N settimane con
            // N−1. Ora finisce la domenica (o oggi, se la settimana e' in corso), come la tabella.
            const d = new Date(`${weeklyCustom.until}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 6)
            const domenica = d.toISOString().slice(0, 10), oggi = new Date().toISOString().slice(0, 10)
            return { since: weeklyCustom.since, until: domenica > oggi ? oggi : domenica, label: 'Settimane selezionate' }
          })() : undefined}
        /></div>
      </div>

      {/* Spesa dei negozi fisici: fuori dai numeri qui sotto, mostrata a parte */}
      {(() => {
        const chiavi = (tfWeeks || []).map(w => w.key).filter(Boolean).sort()
        if (!chiavi.length) return null
        const fine = new Date(`${chiavi[chiavi.length - 1]}T12:00:00Z`); fine.setUTCDate(fine.getUTCDate() + 6)
        const oggi = new Date().toISOString().slice(0, 10)
        const until = fine.toISOString().slice(0, 10) > oggi ? oggi : fine.toISOString().slice(0, 10)
        return <DriveToStoreCard since={chiavi[0]} until={until} />
      })()}

      {/* KPI summary cards */}
      <div className="stagger-zoom m-grid2 rep-kpis" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
        {kpiCards.map(kpi => (
          <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
              <div className="label">{kpi.label}</div>
              <PlatformBadges sources={kpi.sources} size={16} />
            </div>
            <div className="rep-kpi-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
              <div className="metric-value">{kpi.fmt(kpi.val)}</div>
              <Sparkline dataArr={filled} dataKey={kpi.key} color={kpi.color} />
            </div>
            <div style={{marginTop:10}}><DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} /></div>
          </div>
        ))}
      </div>

      {/* Come il conto economico: voci in riga, settimane in colonna. Prima
          era girata, con venti metriche in orizzontale. */}
      <FxChartCard title={t('dash.weeklyData', null, 'Dati settimanali')} glowColor="#22c55e"
        subtitle={(googleWeekly && googleWeekly.length > 0) ? t('dash.allAutoSub', null, 'Shopify, Meta e Google automatici') : t('dash.weeklyDataSub', null, 'Shopify + Meta automatici · Google manuale')}>
        <MatriceReport t={t} chiaveBase="fat" etichettaColonna={t('dash.thItem', null, 'Voce')}
          periodi={tableWeeks.map((w, i) => {
            // Stessa settimana dell'anno prima: 52 settimane indietro. Se lo
            // storico non ci arriva la colonna resta vuota invece di mentire.
            const chiaveAnno = settimanaMenoUnAnno(w.key)
            const annoPrima = allWeeks.find(x => x.key === chiaveAnno) || null
            return {
              key: w.key,
              label: w.label,
              labelPrec: tableWeeks[i + 1]?.label || null,
              labelAnnoPrima: annoPrima?.label || null,
              siglaAnnoPrima: String(chiaveAnno || '').slice(2, 4),
              valori: w,
              valoriPrec: tableWeeks[i + 1] || null,
              valoriAnnoPrima: (annoPrima && (annoPrima.fat > 0 || annoPrima.adv > 0)) ? annoPrima : null,
            }
          })}
          righe={righeReport({ t, mostraKoongo: mostraKoongoW, googleAuto: { configured: (googleWeekly || []).length > 0 },
            chiavi: { fatturato: 'fat', fatturNC: 'fatNC', fatturRC: 'fatRC', ordini: 'ord',
                      sessioni: 'ses', totalSpend: 'adv', metaSpend: 'meta', googleSpend: 'google' } })} />
      </FxChartCard>


      {filled.length > 0 && (
        <>
          <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <FxChartCard title={t('dash.chartRevSpendMer', null, 'Fatturato, Spesa e MER')} glowColor="#22c55e">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="wkfx-rev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="wkfx-spend" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                    <filter id="wkfx-glow" x="-50%" y="-50%" width="200%" height="200%">
                      <feGaussianBlur stdDeviation="2.5" result="blur"/>
                      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                    </filter>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                  <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                  <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                  <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#wkfx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#wkfx-glow)'}} />
                  <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#wkfx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationBegin={200} connectNulls />
                  <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </FxChartCard>

            <FxChartCard title={t("dash.chartNewReturning", null, "Nuovi clienti e clienti di ritorno")} glowColor="#06b6d4">
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                  <defs>
                    <linearGradient id="wkfx-nc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                    </linearGradient>
                    <linearGradient id="wkfx-rc" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                      <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                  <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                  <Bar dataKey="nc" name="Nuovi clienti" fill="url(#wkfx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                  <Bar dataKey="rc" name="Clienti ritorno" fill="url(#wkfx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                </BarChart>
              </ResponsiveContainer>
            </FxChartCard>
          </div>

          <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
            <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="wkfx-aov" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                      <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                    </linearGradient>
                    <linearGradient id="wkfx-cro" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                      <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                  <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                  <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                  <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                  <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#wkfx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                  <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#wkfx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                </ComposedChart>
              </ResponsiveContainer>
            </FxChartCard>

            <FxChartCard title={t("dash.ratioLtvCacLabel", null, "Ratio LTV:CAC")} glowColor="#a78bfa">
              <ResponsiveContainer width="100%" height={240}>
                <AreaChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                  <defs>
                    <linearGradient id="wkfx-ratio" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                      <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                      <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                  <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                  <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                  <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:600,position:'right'}} />
                  <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                  <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                  <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#wkfx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                </AreaChart>
              </ResponsiveContainer>
            </FxChartCard>
          </div>
        </>
      )}

      {/* Floating Weekly Agent */}
      <WeeklyAgent weeks={filled} preset={presetProp} />
    </>
  )
}

// ── MAIN APP ──────────────────────────────────────────────────────
export default function App() {
  const { t, intlLocale } = useI18n()
  const [tab, setTab] = useState('dashboard')
  // Deep-link: ?tab=<id> apre direttamente quella sezione (usato anche dal
  // generatore video per inquadrare la tab giusta senza ambiguità di menu).
  useEffect(() => {
    // Id sconosciuti (tab rimosse, link vecchi) → dashboard, mai schermata vuota.
    try { const p = new URLSearchParams(window.location.search).get('tab'); if (p) setTab(ALL_TABS.includes(p) ? p : 'dashboard') } catch {}
  }, [])
  const [allowedTabs, setAllowedTabs] = useState(null) // null = accesso completo (Admin/owner)
  // Creative Studio attiva SOLO sul workspace STMN (owner sul proprio workspace).
  // Bloccata per TUTTI i clienti, incluso l'owner quando ha switchato su un
  // cliente (Saracino) → si usa ownerWorkspace (tenant effettivo = owner), NON
  // isOwner (utente reale, che resterebbe true anche dentro un cliente).
  const [isOwner, setIsOwner] = useState(false)
  useEffect(() => {
    let active = true
    fetch('/api/integrations/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(d => { if (active) setIsOwner(!!d?.ownerWorkspace) })
      .catch(() => {})
    return () => { active = false }
  }, [])
  const [live, setLive] = useState(null)
  const [loading, setLoading] = useState(true)
  const [cfgBase, setCfgBase] = useState(DEF)   // config manuale (editabile/salvata)
  const [ltvAuto, setLtvAuto] = useState(null)  // LTV calcolato dai dati (coorti 24m)
  const [googleAuto, setGoogleAuto] = useState({ configured: false, byMonth: {}, daily: [] }) // spesa Google Ads automatica dal collegamento (/api/google)
  const [showCfg, setShowCfg] = useState(false)
  const [months, setMonths] = useState({})
  const [weeks, setWeeks] = useState({})
  const [updated, setUpdated] = useState(null)
  // La demo pubblica parte sugli ultimi 28 giorni: i suoi dati d'esempio sono mensili, e sotto
  // «Oggi» mostrava come numeri di oggi quelli di un mese, confrontati con un «ieri» senza la
  // spesa Google (spesa +96%, MER -38%, in rosso, nella prima schermata che vede un visitatore).
  const [preset, setPreset] = useState(() => (typeof window !== 'undefined' && window.location.pathname.startsWith('/demo')) ? 'last_28d' : 'today')
  const [monthlyTF, setMonthlyTF] = useState('this_month')
  const [monthlyCustom, setMonthlyCustom] = useState({ since: '', until: '' })
  const [weeklyTF, setWeeklyTF] = useState('this_week')
  const [weeklyCustom, setWeeklyCustom] = useState({ since: '', until: '' })

  const avail = getMonths()

  // Gating per ruolo: recupera i ruoli dell'utente e calcola le tab consentite.
  // Admin/owner → allowedTabs=null (vede tutto). I membri non-admin → Set ridotto.
  useEffect(() => {
    let active = true
    leggi('/api/team-members')
      .then(d => { if (active && d?.me) setAllowedTabs(allowedTabsFor(d.me.roles, d.me.isAdmin, d.me.hiddenTabs)) })
      .catch(() => {})
    return () => { active = false }
  }, [])

  // Tab non consentita per il ruolo → prima tab consentita. 'settings' resta
  // SEMPRE passante: il billing-lock ci forza sopra anche i membri (senza
  // eccezione i due effect si rimbalzavano settings↔tasks in loop infinito).
  useEffect(() => {
    if (allowedTabs && !allowedTabs.has(tab) && tab !== 'settings') {
      setTab(allowedTabs.has('tasks') ? 'tasks' : ([...allowedTabs][0] || 'chat'))
    }
  }, [allowedTabs, tab])

  useEffect(() => {
    const s = load()
    if (s.c && Object.keys(s.c).length) setCfgBase({...DEF,...s.c})
    if (s.m) setMonths(s.m)
    if (s.w) setWeeks(s.w)
  }, [])

  // LTV automatico dai dati Shopify (proiezione coorti, 24 mesi) — una volta
  useEffect(() => {
    let alive = true
    fetch('/api/ltv-auto?months=24').then(r => r.json()).then(j => { if (alive && j?.enoughData) setLtvAuto(j) }).catch(() => {})
    return () => { alive = false }
  }, [])

  // Spesa Google Ads automatica dal collegamento (/api/google). Se il collegamento è attivo
  // costruiamo una mappa mese→spesa e i giorni; altrimenti (non configurato / errore / token Test)
  // resta vuota e si usa il manuale.
  // Prima si leggeva UNA volta, all'apertura, e basta: su "Oggi" la spesa Google restava quella
  // di quel momento anche premendo Aggiorna (AV, 21 set 2026: 32 € in pagina, 82 € veri), mentre
  // Shopify e Meta si aggiornavano. Ora si rilegge insieme ai dati vivi (fetchLive: Aggiorna e
  // cambio di periodo). /api/google non ha cache: il dato e' sempre quello di Google adesso.
  const caricaGoogle = useCallback(() => (
    fetch('/api/google', { cache: 'no-store' }).then(r => r.json()).then(j => {
      if (!j?.configured || !Array.isArray(j.monthly)) return
      const byMonth = {}
      const byMonthDetail = {}
      for (const m of j.monthly) {
        if (!m?.month) continue
        byMonth[m.month] = Number(m.spend) || 0
        byMonthDetail[m.month] = {
          impressions: Number(m.impressions) || 0,
          clicks: Number(m.clicks) || 0,
          conversions: Number(m.conversions) || 0,
          convValue: Number(m.convValue) || 0,
        }
      }
      setGoogleAuto({ configured: true, byMonth, byMonthDetail, daily: Array.isArray(j.daily) ? j.daily : [] })
    }).catch(() => {})
  ), [])
  useEffect(() => { caricaGoogle() }, [caricaGoogle])

  // Margine REALE dai costi prodotto (per l'LTV netto): se i costi sono
  // inseriti (coverage > 0) il margine calcolato vince su default e manuale;
  // senza costi inseriti si resta al margine di cfgBase (default 100 = netto
  // uguale al lordo, nessuna riduzione inventata).
  const [marginData, setMarginData] = useState(null) // { grossMargin, costCoverage }
  useEffect(() => {
    let alive = true
    // Finestra 30g = la STESSA pre-riscaldata all'avvio sessione (AppShell
    // prewarm) → snapshot già caldo, risposta immediata. Una finestra diversa
    // (es. 365g) creava una chiave cache fredda → computo pesante → timeout →
    // margine mai arrivato → 100% anche coi costi inseriti.
    const until = new Date().toISOString().slice(0, 10)
    const since = new Date(Date.now() - 30 * 86400e3).toISOString().slice(0, 10)
    const tryFetch = (attempt) => {
      fetch(`/api/product-performance?since=${since}&until=${until}`)
        .then(r => r.json())
        .then(j => {
          if (!alive) return
          const t = j?.totals
          if (t && t.grossMargin != null && (t.costCoverage || 0) > 0) {
            setMarginData({ grossMargin: t.grossMargin, costCoverage: t.costCoverage })
          } else if (attempt < 1) {
            // primo giro a freddo (snapshot in costruzione) → riprova una volta
            setTimeout(() => { if (alive) tryFetch(attempt + 1) }, 20000)
          }
        })
        .catch(() => { if (alive && attempt < 1) setTimeout(() => { if (alive) tryFetch(attempt + 1) }, 20000) })
    }
    tryFetch(0)
    return () => { alive = false }
  }, [])

  // cfg "effettiva": se abbiamo l'LTV dai dati, sostituisce gli ordini-a-vita
  // (freq×life) con il valore reale calcolato sulle coorti; se abbiamo i costi
  // prodotto, il margine reale sostituisce quello manuale. Così OGNI calcolo
  // LTV:CAC in App e nei componenti figli (Weekly/KPI Brain/Mensile/...) usa il
  // dato reale, senza toccare la config manuale (cfgBase, usata dall'editor).
  const ltvFromData = !!ltvAuto?.projectedAvgOrders
  const cfg = {
    ...cfgBase,
    ...(ltvFromData ? { freq: +(ltvAuto.projectedAvgOrders / (cfgBase.life || 1)).toFixed(4) } : {}),
    // REGOLA margine: costi prodotto inseriti → margine reale; altrimenti 100.
    // (Il valore manuale/salvato non conta più: evitava-solo di inventare numeri.)
    margin: marginData ? Math.max(1, Math.min(100, Math.round(marginData.grossMargin * 100))) : 100,
  }

  // Post-signup: redirect a /onboarding se l'utente non ha ancora completato
  // il wizard di setup integrazioni, oppure a /billing-required se non ha
  // una sub attiva/trialing. Sequenziale: prima onboarding, poi billing.
  useEffect(() => {
    if (typeof window === 'undefined') return
    let cancelled = false
    ;(async () => {
      try {
        // I membri del team appartengono al workspace dell'owner (che paga):
        // saltano onboarding e paywall, vanno dritti nell'app.
        const me = await leggi('/api/team-members').then(d => d?.me).catch(() => null)
        if (cancelled) return
        if (me && me.isMember) return

        const ob = await fetch('/api/onboarding').then(r => r.ok ? r.json() : null)
        if (cancelled) return
        if (ob && ob.completed === false) {
          window.location.href = '/onboarding'
          return
        }
        // Onboarding ok → verifica subscription status
        const subRes = await fetch('/api/stripe/subscription')
        if (cancelled) return
        // Redirect SOLO con risposta valida e status esplicito non-pagante:
        // un 500/timeout transitorio non deve buttare fuori un cliente pagante.
        if (subRes.ok) {
          const sub = await subRes.json().catch(() => null)
          if (sub) { // corpo valido: anche "nessun abbonamento" (status assente) manda al billing
            const status = sub?.subscription?.status
            // stessi stati "grace" del server (billingLock): past_due/incomplete
            // NON buttano fuori un pagante con un addebito in retry
            const isPaying = ['active', 'trialing', 'past_due', 'incomplete'].includes(status)
            if (!isPaying) window.location.href = '/billing-required'
          }
        }
      } catch {}
    })()
    return () => { cancelled = true }
  }, [])

  // fetchLive — usa cache SWR. Comportamento:
  // - cache hit fresh (< 60s): mostra subito, NO loading spinner, niente fetch
  // - cache hit stale (60s..5min): mostra cached subito, revalida in bg, onUpdate aggiorna silent
  // - cache miss: setLoading=true, fetch sync
  // - force=true (bottone Aggiorna): bypass cache, fetch sync
  // Ieri alla stessa ora: si legge solo quando il periodo e' "Oggi", e si rinfresca ogni 10 minuti.
  const [stessaOra, setStessaOra] = useState(null)
  useEffect(() => {
    if (preset !== 'today') { setStessaOra(null); return }
    let vivo = true
    const carica = (forza) => leggi('/api/oggi-vs-ieri', { forza }).then(j => { if (vivo && j?.ok) setStessaOra(j) }).catch(() => {})
    carica(false)
    const giro = setInterval(() => { if (!document.hidden) carica(true) }, 10 * 60_000)
    return () => { vivo = false; clearInterval(giro) }
  }, [preset])

  useEffect(() => { const t = setTimeout(precaricaCodice, 1200); return () => clearTimeout(t) }, [])
  // Dashboard in stile Live View: il blocco e' alto quanto lo spazio che resta sotto la testata,
  // cosi' la PAGINA non scorre, il globo resta fisso e scorre solo la colonna dei KPI. L'altezza
  // si misura (la testata cambia con la lingua e con la larghezza) e si passa al CSS in --lv-alto.
  const heroLv = useRef(null)
  useEffect(() => {
    if (tab !== 'dashboard') return
    const misura = () => { const e = heroLv.current, main = document.querySelector('.app-main'); if (!e || !main) return; const alto = Math.round(e.getBoundingClientRect().top - main.getBoundingClientRect().top + main.scrollTop); e.style.setProperty('--lv-alto', `${alto}px`) }
    misura(); const t1 = setTimeout(misura, 400), t2 = setTimeout(misura, 1500)
    window.addEventListener('resize', misura)
    return () => { clearTimeout(t1); clearTimeout(t2); window.removeEventListener('resize', misura) }
  }, [tab, loading])

  const giriIncompleti = useRef({})
  const fetchLiveRef = useRef(null)
  const fetchLive = useCallback(async (force = false) => {
    const key = `metrics:${preset}`
    caricaGoogle()   // la spesa Google viaggia con i dati vivi, non solo all'apertura
    __liveKey = key // anti-race: la risposta di un preset vecchio non deve sovrascrivere quello attivo
    const cached = !force ? getCached(key) : null

    if (cached) {
      // Mostra subito dati cached, NO loading flicker
      setLive(cached.data)
      setUpdated(new Date())
    } else {
      setLoading(true)
    }

    try {
      const { data, fromCache } = await swrFetch({
        key,
        forceRefresh: force,
        fetcher: async () => {
          const r = await fetch(`/api/metrics?preset=${encodeURIComponent(preset)}`)
          if (!r.ok) throw new Error(`HTTP ${r.status}`)
          return r.json()
        },
        // Revalidate background completata: aggiorna silent (no spinner)
        onUpdate: (fresh) => {
          if (__liveKey !== key) return
          setLive(fresh)
          setUpdated(new Date())
        },
      })
      if (__liveKey !== key) return
      // Se era miss/force, scrivi i dati appena arrivati
      if (!cached || force) {
        setLive(data)
        setUpdated(new Date())
      }
      // History servita "stale" dal DB → rinfrescala in background (richiesta force
      // dedicata che completa e riscrive metrics_history; il load corrente resta veloce).
      // Shopify ha rifiutato qualche lettura: i numeri sono parziali. Lo si dice (barra in alto) e
      // si richiede da soli dopo 30 s, al massimo tre volte — mai uno zero lasciato li' come vero.
      if (data?.shopifyIncompleto) {
        segnalaParziale(key)
        if ((giriIncompleti.current[key] = (giriIncompleti.current[key] || 0) + 1) <= 3) setTimeout(() => { if (__liveKey === key) fetchLiveRef.current?.(true) }, 30000)
        else datiArrivati(key)
      } else { datiArrivati(key); giriIncompleti.current[key] = 0 }
      if (data?.historyStale && !force && !historyBgInflight) {
        historyBgInflight = true
        fetch(`/api/metrics?preset=${encodeURIComponent(preset)}&force=1`)
          .catch(() => {}).finally(() => { historyBgInflight = false })
      }
    } catch (e) { console.log(e.message) }
    finally {
      if (!cached) setLoading(false)
    }
  }, [preset, caricaGoogle])

  fetchLiveRef.current = fetchLive
  useEffect(() => { fetchLive() }, [fetchLive])

  // Prefetch staggered al primo mount: warma la cache per i preset piu' usati
  // cosi' cambiare tab e' istantaneo. Stagger 250ms per non saturare la rete.
  // Skip preset gia' cached fresh.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const now = new Date()
    const mLabel = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
    const q = Math.floor(now.getMonth() / 3) + 1
    const y = now.getFullYear()

    // Prefetch ALLEGGERITO: solo i range corti/comuni per non saturare il
    // rate-limit Shopify all'avvio. I range lunghi (90d/mese/trimestre/anno)
    // si caricano on-demand quando l'utente apre quella tab, poi restano in cache.
    const PRESETS = [
      'last_7d', 'last_30d',
    ]

    // Prefetch list: [key, fetcher]
    const PREFETCH = [
      // Metrics core (dashboard / weekly / monthly / quarter / year / KPI brain)
      ...PRESETS.map(p => [
        `metrics:${p}`,
        () => fetch(`/api/metrics?preset=${encodeURIComponent(p)}`).then(r => r.ok ? r.json() : Promise.reject(new Error(`HTTP ${r.status}`))),
      ]),
      // Klaviyo default (30 giorni)
      ['klaviyo:30', () => fetch('/api/klaviyo?days=30').then(r => r.json())],
      // Meta Detail default (last_28d, campaigns level)
      // Key deve matchare quella generata da MetaDetailTab: qs() produce
      // "preset=X&level=Y" (preset set per primo, level secondo da extra)
      ['meta-detail:campaigns:preset=last_28d&level=campaigns',
        () => fetch('/api/meta-detail?preset=last_28d&level=campaigns', { cache: 'no-store' }).then(r => r.json()),
      ],
      // Google KPI, Google Detail e Meta KPI partono da "ultimi 7 giorni": la chiave
      // e' quella che si costruiscono da sole (tfKey = preset:since:until).
      ['google-kpi:last_7d::', () => fetch('/api/google-kpi?preset=last_7d').then(r => r.json())],
      ['google-detail:last_7d::', () => fetch('/api/google-detail?preset=last_7d&level=campaigns').then(r => r.json())],
      ['meta-kpi:last_7d::', () => fetch('/api/meta-kpi?preset=last_7d').then(r => r.json())],
      // Creative Fatigue (last_28d)
      ['creative-fatigue:last_28d:',
        () => fetch('/api/creative-fatigue?preset=last_28d').then(r => r.json()),
      ],
      // Budget Advisor (last_28d) — tab solo SaaS, ma il dato si scalda come gli altri
      ['budget-advisor:last_28d:',
        () => fetch('/api/budget-advisor?preset=last_28d').then(r => r.json()),
      ],
    ]

    const timers = []
    PREFETCH.forEach(([key, fetcher], i) => {
      const t = setTimeout(() => {
        prefetch({ key, fetcher })
      }, 800 + i * 250) // start 800ms dopo mount, stagger 250ms
      timers.push(t)
    })

    // ── Le tab nate dopo questo blocco ──────────────────────────────────────
    // Inventario, Performance prodotti, Prodotti e Performance prodotti Google,
    // Costi, Corrispettivi e Conto economico leggevano i dati solo alla prima
    // apertura: 2-3 secondi di attesa al primo clic, quando il resto del
    // prodotto risponde subito. Si scaldano qui, UNA ALLA VOLTA e a browser a
    // riposo (precarica): in parallelo si finirebbe contro i limiti di Shopify.
    // Gli URL devono essere IDENTICI a quelli che la tab chiede da sola con i
    // suoi valori di partenza, o il dato scaldato non lo trova nessuno.
    const giorno = (d) => d.toISOString().slice(0, 10)
    const oggiIso = giorno(now)
    const da30 = giorno(new Date(now.getTime() - 30 * 86400000))
    const da7 = giorno(new Date(now.getTime() - 7 * 86400000))
    const mesiConto = Math.min(60, (now.getMonth() + 1) + 12) // anno in corso + 12 mesi di confronto
    const tScaldo = setTimeout(() => precarica([
      '/api/inventory',
      `/api/product-performance?since=${da30}&until=${oggiIso}`,
      `/api/google-product-verdicts?since=${da30}&until=${oggiIso}`,
      `/api/google-products?since=${da7}&until=${oggiIso}`,
      '/api/product-costs-landed',
      `/api/corrispettivi?mese=${mLabel}`,
      `/api/pnl?months=${mesiConto}`,
      '/api/drive-to-store?part=monthly',
    ]), 4500)
    timers.push(tScaldo)

    return () => { timers.forEach(clearTimeout) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-allinea il preset al tipo di tab quando l'utente entra nella tab Quarter/Year/Monthly
  // (altrimenti shopifyRange continua a portare i dati del preset precedente, es. last_7d)
  useEffect(() => {
    const now = new Date()
    if (tab === 'year' && !(typeof preset === 'string' && preset.startsWith('year_'))) {
      setPreset(`year_${now.getFullYear()}`)
    } else if (tab === 'quarter' && !(typeof preset === 'string' && preset.startsWith('quarter_'))) {
      const q = Math.floor(now.getMonth() / 3) + 1
      setPreset(`quarter_${now.getFullYear()}-Q${q}`)
    } else if (tab === 'monthly' && !(typeof preset === 'string' && preset.startsWith('month_'))) {
      setPreset(`month_${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`)
    }
  }, [tab])  // eslint-disable-line react-hooks/exhaustive-deps

  // ── Range helpers for sparklines + deltas ──
  const kpiRange = live?.kpiBrain?.range || null
  const kpiPrevRange = live?.kpiBrain?.previousRange || null

  // Le sezioni di KPI Brain (paesi, fasce orarie, marchi, dove comprano) seguono
  // il periodo scelto: appena il periodo e' noto si scaldano in background, cosi'
  // aprendo la tab sono gia' li'. Stessi URL che la tab chiede da sola.
  useEffect(() => {
    if (!kpiRange?.since || !kpiRange?.until || tab === 'kpiBrain') return
    const q = `since=${kpiRange.since}&until=${kpiRange.until}`
    const t = setTimeout(() => precarica([
      `/api/brand-sales?${q}`, `/api/kpi-province?${q}`, `/api/hourly-sales?${q}`, `/api/shopify-countries?${q}`, '/api/product-images', '/api/pilota', '/api/prezzi',
    ]), 9000)
    return () => clearTimeout(t)
  }, [kpiRange?.since, kpiRange?.until]) // eslint-disable-line react-hooks/exhaustive-deps

  const filterByRange = (rows, range, dateField) => {
    if (!range?.since || !range?.until || !Array.isArray(rows)) return []
    return rows.filter(r => {
      const d = r[dateField || 'date'] || r.month
      return d && d >= range.since && d <= range.until
    })
  }

  const shopifyWeeklyAll = live?.shopifyWeekly || []
  const metaWeeklyAll = live?.metaWeekly || []

  const swCurrent = filterByRange(shopifyWeeklyAll, kpiRange)
  const swPrev = filterByRange(shopifyWeeklyAll, kpiPrevRange)
  const mwCurrent = filterByRange(metaWeeklyAll, kpiRange)
  const mwPrev = filterByRange(metaWeeklyAll, kpiPrevRange)
  // Google Ads period-aware: somma i giorni dentro il range del preset (prima
  // era mensile → sballava su "Oggi"/settimana). daily dal collegamento /api/google.
  const googleDailyAll = googleAuto.daily || []
  const gwCurrent = filterByRange(googleDailyAll, kpiRange, 'date')
  const gwPrev = filterByRange(googleDailyAll, kpiPrevRange, 'date')
  // Spesa Google per settimana (lunedì-key) per il Weekly tab — bucket dei giorni.
  const googleWeekly = (() => {
    if (!googleAuto.configured) return []
    const mondayOf = (ds) => { const d = new Date(ds + 'T00:00:00Z'); const wd = (d.getUTCDay() + 6) % 7; d.setUTCDate(d.getUTCDate() - wd); return d.toISOString().slice(0, 10) }
    const map = {}
    for (const x of googleDailyAll) { if (!x?.date) continue; const k = mondayOf(x.date); map[k] = (map[k] || 0) + (Number(x.spend) || 0) }
    return Object.entries(map).map(([date, spend]) => ({ date, spend: Math.round(spend * 100) / 100 }))
  })()

  const sumField = (rows, field) => rows.reduce((s, r) => s + (Number(r[field]) || 0), 0)

  const periodTotals = {
    revenue: sumField(swCurrent, 'fatturato'),
    orders: sumField(swCurrent, 'ordini'),
    nc: sumField(swCurrent, 'nc'),
    rc: sumField(swCurrent, 'rc'),
    sessions: sumField(swCurrent, 'uniqueSessions'),
    resi: sumField(swCurrent, 'resi'),
    metaSpend: sumField(mwCurrent, 'spend'),
    googleSpend: googleAuto.configured ? sumField(gwCurrent, 'spend') : 0,
    impressions: sumField(mwCurrent, 'impressions'),
    clicks: sumField(mwCurrent, 'linkClicks'),
    koongo: sumField(swCurrent, 'koongoFatturato'),
  }

  const spr = live?.shopifyPrevRange || {}
  const mpr = live?.metaPrevRange || {}
  // Su "Oggi" il periodo prima NON e' la giornata intera di ieri: e' ieri fino a QUEST'ORA
  // (/api/oggi-vs-ieri). Contro le 24 ore di ieri, a meta' giornata ogni KPI risulta in calo
  // solo perche' il giorno non e' finito (Marino, 19 set). Finche' quei numeri non arrivano
  // resta il confronto di prima; vale per tutti i riquadri, che leggono tutti da qui.
  // Il confronto alla stessa ora vale solo se «oggi» e' lo STESSO giorno per le due fonti.
  // /api/metrics decide la data in UTC, /api/oggi-vs-ieri nel fuso del negozio: fra
  // mezzanotte e le due (ora legale) la Dashboard mostra ancora il giorno prima, e confrontarlo
  // con «ieri fino alle 00:30» lo farebbe sembrare cresciuto di cento volte. Se le date non
  // coincidono si torna al confronto di prima, che almeno e' fatto sulla stessa giornata.
  const oggiDashboard = live?.kpiBrain?.range?.since || null
  const stessaOraValida = (preset === 'today' && stessaOra?.ieriAllaStessaOra && (!oggiDashboard || oggiDashboard === stessaOra.oggi)) ? stessaOra : null
  const io = stessaOraValida ? stessaOraValida.ieriAllaStessaOra : null
  const prevTotals = io ? {
    revenue: io.fatturato ?? 0, orders: io.ordini ?? 0, nc: io.nuovi ?? 0, rc: io.abituali ?? 0,
    // sessioni e clic: la quota di ieri a quest'ora applicata al numero di ieri della Dashboard
    sessions: stessaOraValida?.quote?.sessioni != null && Number(spr.sessions) > 0 ? Math.round(Number(spr.sessions) * stessaOraValida.quote.sessioni) : (io.sessioni ?? 0),
    resi: Number(spr.resi) || 0,
    metaSpend: io.spesaMeta ?? 0, googleSpend: googleAuto.configured ? (io.spesaGoogle ?? 0) : 0,
    impressions: io.impressioni ?? 0,
    clicks: stessaOraValida?.quote?.clic != null && Number(mpr.clicks) > 0 ? Math.round(Number(mpr.clicks) * stessaOraValida.quote.clic) : (io.clic ?? 0),
    koongo: io.marketplace ?? 0,
  } : {
    revenue: Number(spr.revenue)  || sumField(swPrev, 'fatturato'),
    orders:  Number(spr.orders)   || sumField(swPrev, 'ordini'),
    nc:      Number(spr.nc)       || sumField(swPrev, 'nc'),
    rc:      Number(spr.rc)       || sumField(swPrev, 'rc'),
    sessions:Number(spr.sessions) || sumField(swPrev, 'uniqueSessions'),
    resi:    Number(spr.resi)     || sumField(swPrev, 'resi'),
    metaSpend:   Number(mpr.spend)       || sumField(mwPrev, 'spend'),
    googleSpend: googleAuto.configured ? sumField(gwPrev, 'spend') : 0,
    impressions: Number(mpr.impressions) || sumField(mwPrev, 'impressions'),
    clicks:      Number(mpr.clicks)      || sumField(mwPrev, 'linkClicks'),
    koongo:      Number(spr.koongoRevenue) || sumField(swPrev, 'koongoFatturato'),
  }

  const updateWeek = (week, key, value) => {
    setWeeks(prev => {
      const next = { ...prev, [week]: { ...(prev[week]||WEMPTY), [key]: value } }
      saveW(next)
      return next
    })
  }

  const updateMonth = (month, key, value) => {
    setMonths(prev => {
      const next = { ...prev, [month]: { ...(prev[month]||EMPTY), [key]: value } }
      saveM(next)
      return next
    })
  }

  // ── Calcola dati automatici mensili da Shopify monthly + Meta + manuale Google ─────
  const asNum = v => {
    const n = Number(v)
    return Number.isFinite(n) ? n : 0
  }

  const safeDiv = (a, b) => {
    const x = asNum(a)
    const y = asNum(b)
    return y > 0 ? x / y : null
  }

  const monthKeyFromDate = date => {
    if (!date || typeof date !== 'string') return null
    return date.slice(0, 7)
  }

  const emptyMonth = month => ({
    month,
    fatturato: 0,
    fatturNC: 0,
    fatturRC: 0,
    resi: 0,
    resiNC: 0,
    resiRC: 0,
    ordini: 0,
    nc: 0,
    rc: 0,
    sessioni: 0,
    koongo: 0,
    metaSpend: 0,
    googleSpend: 0,
    impressions: 0,
    reach: 0,
    linkClicks: 0,
    metaRows: 0,
  })

  const monthlyAutoMap = {}

  // Crea sempre i mesi disponibili, così ogni mese nuovo appare automaticamente.
  for (const month of avail) {
    monthlyAutoMap[month] = emptyMonth(month)
  }

  // Shopify monthly (mese di calendario, dal backend - NIENTE aggregazione da weekly)
  for (const row of live?.shopifyMonthly || []) {
    const month = row?.month
    if (!month) continue

    if (!monthlyAutoMap[month]) {
      monthlyAutoMap[month] = emptyMonth(month)
    }

    // Assegnazione diretta (no +=): il backend ritorna già il totale del mese
    monthlyAutoMap[month].fatturato = asNum(row.fatturato)
    monthlyAutoMap[month].fatturNC = asNum(row.fatturNC)
    monthlyAutoMap[month].fatturRC = asNum(row.fatturRC)
    monthlyAutoMap[month].resi = asNum(row.resi)
    monthlyAutoMap[month].resiNC = asNum(row.resiNC)
    monthlyAutoMap[month].resiRC = asNum(row.resiRC)
    monthlyAutoMap[month].ordini = asNum(row.ordini)
    monthlyAutoMap[month].nc = asNum(row.nc)
    monthlyAutoMap[month].rc = asNum(row.rc)
    monthlyAutoMap[month].sessioni = asNum(row.uniqueSessions || row.sessioni)
    // Marketplace: viaggia accanto al mese, mai dentro fatturato.
    monthlyAutoMap[month].koongo = asNum(row.koongoFatturato)
  }

  // Meta monthly (mese di calendario, dal backend)
  for (const row of live?.metaMonthly || []) {
    const month = row?.month
    if (!month) continue

    if (!monthlyAutoMap[month]) {
      monthlyAutoMap[month] = emptyMonth(month)
    }

    monthlyAutoMap[month].metaSpend = asNum(row.spend)
  }

  // Meta weekly → aggregazione mensile SOLO come fallback per metriche aux
  // (impressions, reach, linkClicks) che non arrivano in metaMonthly.
  // Non riassegna metaSpend se è già arrivato dal monthly.
  for (const row of live?.metaWeekly || []) {
    const month = monthKeyFromDate(row?.date)
    if (!month) continue

    if (!monthlyAutoMap[month]) {
      monthlyAutoMap[month] = emptyMonth(month)
    }

    monthlyAutoMap[month].impressions += asNum(row.impressions)
    monthlyAutoMap[month].reach += asNum(row.reach)
    monthlyAutoMap[month].linkClicks += asNum(row.linkClicks)
    monthlyAutoMap[month].metaRows += 1

    if (monthlyAutoMap[month].metaSpend <= 0) {
      monthlyAutoMap[month].metaSpend += asNum(row.spend)
    }
  }

  // Unione dati automatici + dati manuali salvati in localStorage
  const data = Object.values(monthlyAutoMap)
    .sort((a, b) => a.month.localeCompare(b.month))
    .map(row => {
      const manual = months[row.month] || EMPTY

      // Un mese NEGATIVO e' un dato vero, non un dato mancante: sono resi di ordini dei mesi prima
      // (giugno 2025: −994 €, il rimborso di un ordine di maggio). Con "> 0" veniva azzerato e
      // l'anno 2025 risultava 994 € piu' alto del totale di Shopify (21 set 2026). Si ripiega sul
      // valore a mano solo quando il dato automatico manca davvero, cioe' e' zero.
      const fatturato = row.fatturato !== 0 ? row.fatturato : asNum(manual.fatturato)
      const fatturNC = row.fatturNC || 0
      const fatturRC = row.fatturRC !== 0 ? row.fatturRC : Math.max(fatturato - fatturNC, 0)

      const resi = asNum(row.resi)
      const resiNC = asNum(row.resiNC)
      const resiRC = asNum(row.resiRC)

      const ordini = row.ordini > 0 ? row.ordini : asNum(manual.ordini)
      const nc = row.nc > 0 ? row.nc : asNum(manual.nuoviClienti)
      const rc = row.rc > 0 ? row.rc : Math.max(ordini - nc, 0)

      const sessioni = asNum(row.sessioni)
      const metaSpend = asNum(row.metaSpend)
      // Google Ads: automatico dal collegamento se disponibile per il mese,
      // altrimenti fallback al valore manuale inserito a mano.
      const googleSpend = (googleAuto.configured && googleAuto.byMonth[row.month] != null)
        ? asNum(googleAuto.byMonth[row.month])
        : asNum(manual.googleSpend)
      // Dettaglio Google Ads (impression/click/conversioni/valore) dal collegamento,
      // per le card della sezione Google in KPI Brain. Solo automatico (no manuale).
      const gDet = (googleAuto.configured && googleAuto.byMonthDetail) ? (googleAuto.byMonthDetail[row.month] || null) : null
      const googleImpressions = asNum(gDet?.impressions)
      const googleClicks = asNum(gDet?.clicks)
      const googleConversions = asNum(gDet?.conversions)
      const googleConvValue = asNum(gDet?.convValue)
      const totalSpend = metaSpend + googleSpend

      const aov = safeDiv(fatturato, ordini)
      const aovNC = safeDiv(fatturNC, nc)
      const aovRC = safeDiv(fatturRC, rc)

      const cac = safeDiv(totalSpend, nc)
      const cpo = safeDiv(totalSpend, ordini)

      const mer = safeDiv(fatturato, totalSpend)
      const aMer = safeDiv(fatturNC, totalSpend)

      const retention = nc + rc > 0 ? rc / (nc + rc) * 100 : null
      const cro = sessioni > 0 && ordini > 0 ? ordini / sessioni * 100 : null

      const ltv = aov ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
      const ratio = ltv && cac ? ltv / cac : null

      return {
        month: row.month,

        fatturato,
        // Marketplace: senza questa riga il campo veniva perso proprio qui,
        // nella proiezione finale — arrivava dal backend, veniva messo nella
        // mappa e poi non entrava nell'oggetto che leggono le tab.
        koongo: asNum(row.koongo),
        fatturNC,
        fatturRC,

        resi,
        resiNC,
        resiRC,

        ordini,
        nc,
        rc,
        sessioni,

        metaSpend,
        googleSpend,
        googleImpressions,
        googleClicks,
        googleConversions,
        googleConvValue,
        totalSpend,

        aov,
        aovNC,
        aovRC,

        cac,
        cpo,

        mer,
        aMer,

        retention,
        cro,

        ltv,
        ratio,

        impressions: asNum(row.impressions),
        reach: asNum(row.reach),
        linkClicks: asNum(row.linkClicks),
      }
    })

  // ── Subset filtrato per periodo selezionato ───────────────
  const currentYear = String(new Date().getFullYear())
  const rangeStart = kpiRange?.since?.slice(0, 7) || `${currentYear}-01`
  const rangeEnd = kpiRange?.until?.slice(0, 7) || `${currentYear}-12`
  const dataYear = data.filter(m => m.month >= rangeStart && m.month <= rangeEnd)

  // ── Totali periodo selezionato ──
  // Se shopifyRange/metaRange è presente (live API ok), TRUST quei valori
  // anche se 0 — sono i dati esatti del range. Solo se l'API è fallita
  // (oggetto null) cascade su periodTotals settimanali → dataYear mensile.
  const sr = live?.shopifyRange
  const mr = live?.metaRange
  const hasSr = sr != null
  const hasMr = mr != null

  const sumMonthly = (k) => dataYear.reduce((s,m)=>s + Number(m[k] || 0), 0)

  const totFat   = hasSr ? Number(sr.revenue || 0)   : (periodTotals.revenue || sumMonthly('fatturato'))
  const totFatNC = hasSr ? Number(sr.fatturNC || 0)  : sumMonthly('fatturNC')
  const totFatRC = hasSr ? Number(sr.fatturRC || 0)  : sumMonthly('fatturRC')

  const totResi   = hasSr ? Number(sr.resi || 0)   : sumMonthly('resi')
  const totResiNC = hasSr ? Number(sr.resiNC || 0) : sumMonthly('resiNC')
  const totResiRC = hasSr ? Number(sr.resiRC || 0) : sumMonthly('resiRC')

  const totOrd = hasSr ? Number(sr.orders || 0)   : (periodTotals.orders || sumMonthly('ordini'))
  const totNC  = hasSr ? Number(sr.nc || 0)       : (periodTotals.nc     || sumMonthly('nc'))
  const totRC  = hasSr ? Number(sr.rc || 0)       : (periodTotals.rc     || sumMonthly('rc'))
  const totSes = hasSr ? Number(sr.sessions || 0) : sumMonthly('sessioni')

  // Marketplace via Koongo: fatturato vero, ma fuori da ogni numero qui sopra.
  // Non l'ha portato la pubblicita', quindi dentro MER, ROAS, CAC, CPO e AOV
  // racconterebbe un'efficienza che non c'e'.
  const koongoFat = hasSr ? Number(sr.koongoRevenue || 0) : 0
  const koongoOrd = hasSr ? Number(sr.koongoOrders || 0) : 0

  const totMeta  = hasMr ? Number(mr.spend || 0) : (periodTotals.metaSpend || sumMonthly('metaSpend'))
  // Google period-aware (somma giorni nel range del preset); fallback al mensile
  // solo se NON collegato via API (vecchio comportamento manuale).
  const totGoog  = googleAuto.configured ? (periodTotals.googleSpend || 0) : sumMonthly('googleSpend')
  const totSpend = totMeta + totGoog

  const avgAOV   = totOrd > 0 ? totFat   / totOrd : 0
  const avgAOVNC = totNC  > 0 ? totFatNC / totNC  : 0
  const avgAOVRC = totRC  > 0 ? totFatRC / totRC  : 0

  // Ordini-a-vita per cliente (= freq×life; data-driven quando disponibile)
  const lifeOrders = +(cfg.freq * cfg.life).toFixed(2)
  const avgLTVGross = avgAOV > 0 ? avgAOV * lifeOrders : null
  const avgLTV   = avgAOV > 0 ? avgAOV * lifeOrders * cfg.margin / 100 : null
  const avgCAC   = totSpend > 0 && totNC  > 0 ? totSpend / totNC  : null
  const avgCPO   = totSpend > 0 && totOrd > 0 ? totSpend / totOrd : null
  const avgRatio = avgLTV && avgCAC ? avgLTV / avgCAC : null
  const avgMER   = totFat   > 0 && totSpend > 0 ? totFat   / totSpend : null
  const avgAMER  = totFatNC > 0 && totSpend > 0 ? totFatNC / totSpend : null
  const avgRet   = totNC + totRC > 0 ? totRC / (totNC + totRC) * 100 : null
  const avgCRO   = totSes > 0 && totOrd > 0 ? totOrd / totSes * 100 : null

  // Alias retro-compatibili: alcuni componenti più sotto usano ancora i nomi *G
  const ltvG   = avgLTV
  const cacG   = avgCAC
  const cpoG   = avgCPO
  const ratioG = avgRatio
  const merG   = avgMER
  const aMerG  = avgAMER
  const retG   = avgRet
  const croG   = avgCRO

  const TABS = [
  { id: 'dashboard', l: 'Dashboard' },
  { id: 'kpiBrain', l: 'KPI Brain' },
  { id: 'monthly', l: 'Mensile' },
  { id: 'weekly', l: 'Weekly' },
  { id: 'creative', l: 'Creative' },
  { id: 'simulator', l: 'Simulatore' },
  { id: 'metaDetail', l: 'Meta Detail' },
]

  const S = { // shared styles
    card: { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:12, padding:24 },
    th:   { padding:'10px 14px', fontSize:11.5, color:'var(--text)', textTransform:'uppercase', letterSpacing:'0.1em', textAlign:'left', fontWeight:600, fontFamily: 'inherit', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' },
    td:   { padding:'10px 14px', fontSize:15, borderBottom:'1px solid var(--surface)', fontFamily: 'inherit', fontWeight:500 },
  }

  // Meta Detail: variabili sicure per evitare errori client-side
  const metaSpend = live?.metaSpend ?? totMeta ?? 0
  const metaMonthly = Array.isArray(live?.metaMonthly) ? live.metaMonthly : []
  const metaWeekly = Array.isArray(live?.metaWeekly) ? live.metaWeekly : []
  const metaDetailRows = metaMonthly.length ? metaMonthly : metaWeekly

  // ── "Come nasce questo numero": una spiegazione per ogni riquadro della Dashboard ──────────
  // Il conto con le cifre vere dentro, da dove viene, e l'andamento settimanale. Il confronto e'
  // quello dei riquadri: periodo precedente, oppure ieri alla stessa ora quando il periodo e' Oggi.
  const etPrima = stessaOraValida ? t('sn.yesterdayAt', { h: stessaOraValida.alle }, `ieri alle ${stessaOraValida.alle}`) : t('sn.before', null, 'periodo prima')
  const settimane = (elenco, campo) => (elenco || []).slice(-26).map(w => ({ x: w.date, v: Number(w[campo]) || 0 }))
  const rapportoSettimane = (num, campoN, den, campoD) => { const d = new Map((den || []).map(w => [w.date, Number(w[campoD]) || 0])); return (num || []).slice(-26).map(w => ({ x: w.date, v: d.get(w.date) > 0 ? (Number(w[campoN]) || 0) / d.get(w.date) : null })).filter(p => p.v != null) }
  const prevSpesa = (prevTotals.metaSpend || 0) + (prevTotals.googleSpend || 0)
  const SN = {
    fatturato: { nota: t('sn.nRevenue', null, 'Vendite di Shopify nel periodo, con i resi già tolti e SENZA il marketplace (che non lo porta la pubblicità e si mostra a parte).'), serie: settimane(shopifyWeeklyAll, 'fatturato'), formatta: f0, prima: { valore: prevTotals.revenue > 0 ? f0(prevTotals.revenue) : null, etichetta: etPrima } },
    ordini: { nota: t('sn.nOrders', null, 'Ordini di Shopify nel periodo, senza quelli del marketplace.'), serie: settimane(shopifyWeeklyAll, 'ordini'), formatta: fn, prima: { valore: prevTotals.orders > 0 ? fn(prevTotals.orders) : null, etichetta: etPrima } },
    ratio: { conto: [{ nome: t('dash.ltvNet', null, 'LTV netto'), valore: avgLTV ? f2(avgLTV) : '—', fonti: ['shopify'] }, { segno: '÷', nome: 'CAC', valore: avgCAC ? f2(avgCAC) : '—', fonti: ['meta','google'] }], nota: t('sn.nRatio', null, 'Quanto rende nel tempo un cliente nuovo rispetto a quanto costa acquisirlo. Sotto 1 si spende più di quanto il cliente restituisce; da 3 in su è sano.') },
    aov: { conto: [{ nome: t('dash.revenue', null, 'Fatturato'), valore: f0(totFat), fonti: ['shopify'] }, { segno: '÷', nome: t('dash.orders', null, 'Ordini'), valore: fn(totOrd), fonti: ['shopify'] }], nota: t('sn.nAov', null, 'Quanto vale in media un ordine.'), serie: rapportoSettimane(shopifyWeeklyAll, 'fatturato', shopifyWeeklyAll, 'ordini'), formatta: f2, prima: { valore: prevTotals.orders > 0 && prevTotals.revenue > 0 ? f2(prevTotals.revenue / prevTotals.orders) : null, etichetta: etPrima } },
    nuovi: { nota: t('sn.nNew', null, 'Ordini di chi compra per la prima volta (classificazione di Shopify), senza marketplace.'), serie: settimane(shopifyWeeklyAll, 'nc'), formatta: fn, prima: { valore: prevTotals.nc > 0 ? fn(prevTotals.nc) : null, etichetta: etPrima } },
    ritorno: { nota: t('sn.nReturning', null, 'Ordini di chi aveva già comprato (classificazione di Shopify), senza marketplace.'), serie: settimane(shopifyWeeklyAll, 'rc'), formatta: fn, prima: { valore: prevTotals.rc > 0 ? fn(prevTotals.rc) : null, etichetta: etPrima } },
    mer: { conto: [{ nome: t('dash.revenue', null, 'Fatturato'), valore: f0(totFat), fonti: ['shopify'] }, { segno: '÷', nome: t('dash.totalSpend', null, 'Spesa totale'), valore: f0(totSpend), fonti: ['meta', 'google'] }], nota: t('sn.nMer', null, 'Quanti euro di fatturato per ogni euro di pubblicità. Conta TUTTO il fatturato del negozio, non solo quello che le piattaforme si attribuiscono; fuori marketplace e campagne Drive to Store.'), serie: rapportoSettimane(shopifyWeeklyAll, 'fatturato', metaWeeklyAll, 'spend'), etichettaSerie: t('sn.trendMerMeta', null, 'Andamento settimanale (fatturato ÷ spesa Meta)'), formatta: (v) => `${fr(v)}×`, prima: { valore: prevSpesa > 0 && prevTotals.revenue > 0 ? `${fr(prevTotals.revenue / prevSpesa)}×` : null, etichetta: etPrima } },
    cac: { conto: [{ nome: t('dash.totalSpend', null, 'Spesa totale'), valore: f0(totSpend), fonti: ['meta', 'google'] }, { segno: '÷', nome: t('dash.newCustomers', null, 'Nuovi clienti'), valore: fn(totNC), fonti: ['shopify'] }], nota: t('sn.nCac', null, 'Quanto costa in pubblicità acquisire un cliente nuovo. Più basso è meglio.'), formatta: f2, prima: { valore: prevTotals.nc > 0 && prevSpesa > 0 ? f2(prevSpesa / prevTotals.nc) : null, etichetta: etPrima } },
    meta: { nota: t('sn.nMeta', null, 'Spesa delle campagne Meta nel periodo, senza le campagne Drive to Store (negozi fisici).'), serie: settimane(metaWeeklyAll, 'spend'), formatta: f0, prima: { valore: prevTotals.metaSpend > 0 ? f0(prevTotals.metaSpend) : null, etichetta: etPrima } },
    google: { nota: t('sn.nGoogle', null, 'Spesa delle campagne Google Ads nel periodo.'), formatta: f0, prima: { valore: prevTotals.googleSpend > 0 ? f0(prevTotals.googleSpend) : null, etichetta: etPrima } },
    spesa: { conto: [{ nome: t('dash.metaSpend', null, 'Spesa Meta'), valore: f0(totMeta), fonti: ['meta'] }, { segno: '+', nome: t('dash.googleSpendFull', null, 'Spesa Google'), valore: f0(totGoog), fonti: ['google'] }], nota: t('sn.nSpend', null, 'Tutta la pubblicità online del periodo.'), formatta: f0, prima: { valore: prevSpesa > 0 ? f0(prevSpesa) : null, etichetta: etPrima } },
  }

  // ── Cio' che e' uscito dalla Dashboard e sta in cima a KPI Brain: niente si e' perso ─────────
  const totSess = hasSr ? Number(sr.sessions || 0) : (periodTotals.sessions || 0)
  const bloccoEfficienza = (
    <section className="lv-efficienza">
      {/* la spesa dei negozi fisici per PRIMA cosa, una volta sola (in KPIBrainTab non c'e' piu') */}
      <DriveToStoreCard preset={preset} />
      <h2 className="lv-efficienza-titolo">{t('lv.efficiency', null, 'Efficienza e valore del cliente')}</h2>
      <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:14,marginBottom:14}}>
        <Stat spiega={SN.fatturato} label={t('dash.revenue', null, 'Fatturato')} value={totFat>0?f0(totFat):'—'} sources={['shopify']}
              sub={koongoFat > 0 ? t('dash.revenueNoKoongo', null, 'esclusi i marketplace') : undefined}
              sparkData={swCurrent.map(w=>w.fatturato)} sparkColor="var(--green)"
              current={totFat} previous={prevTotals.revenue} />
        <Stat spiega={SN.aov} label={t('dash.avgAov', null, 'AOV medio')} value={avgAOV ? f2(avgAOV) : '—'} sources={['shopify']}
              sparkData={swCurrent.map(w=> w.ordini > 0 ? w.fatturato/w.ordini : 0)}
              current={avgAOV} previous={prevTotals.orders > 0 ? prevTotals.revenue/prevTotals.orders : null} />
        <Stat spiega={SN.mer} label={t('dash.merBlended', null, 'MER blended')} value={avgMER ? `${fr(avgMER)}x` : '—'} sources={['shopify','meta','google']} sub="Revenue / Ad Spend"
              current={avgMER} previous={(prevTotals.metaSpend + prevTotals.googleSpend) > 0 ? prevTotals.revenue / (prevTotals.metaSpend + prevTotals.googleSpend) : null} />
        <Stat spiega={SN.cac} label="CAC" value={avgCAC ? f2(avgCAC) : '—'} sources={['shopify','meta','google']} sub={`${fn(totNC)} NC`}
              current={avgCAC} previous={prevTotals.nc > 0 && (prevTotals.metaSpend + prevTotals.googleSpend) > 0 ? (prevTotals.metaSpend + prevTotals.googleSpend) / prevTotals.nc : null} inverse />
      </div>
      <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0, 1fr))',gap:14,marginBottom:14}}>
        <Stat label={t('dash.ltvGross', null, 'LTV lordo')} value={avgLTVGross ? f2(avgLTVGross) : '—'} sources={['shopify']} sub={ltvFromData ? t('dash.ltvSubData', { orders: lifeOrders, months: ltvAuto.months }, `${lifeOrders} ord./cliente · dati ${ltvAuto.months}m`) : `${cfg.freq}× · ${cfg.life}a`} />
        <Stat label={t('dash.ltvNet', null, 'LTV netto')} value={avgLTV ? f2(avgLTV) : '—'} sources={['shopify']} sub={ltvFromData ? t('dash.ltvNetSubData', { orders: lifeOrders, margin: cfg.margin, months: ltvAuto.months }, `${lifeOrders} ord. · ${cfg.margin}% margine · dati ${ltvAuto.months}m`) : `${cfg.freq}× · ${cfg.life}a · ${cfg.margin}%`} />
        <Stat spiega={SN.spesa} label={t('dash.totalSpend', null, 'Spesa totale')} value={totSpend>0?f0(totSpend):'—'} sources={['meta','google']} sub="Meta + Google" />
        <Stat spiega={SN.ratio} label={t('dash.ratioLtvCacLabel', null, 'Ratio LTV:CAC')} value={avgRatio != null ? `${fr(avgRatio)}:1` : '—'} sources={['shopify','meta','google']}
              sub={t('dash.ratioStatus.' + ratioStatus(avgRatio), null, ratioLabel(avgRatio))} />
      </div>
      {koongoFat > 0 && (
            <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0, 1fr))',gap:14,marginBottom:20}}>
              <Stat label={t('dash.koongoRevenue', null, 'Fatturato Koongo')} value={f0(koongoFat)} sources={['shopify']}
                sub={t('dash.koongoSub2', { n: fn(koongoOrd) }, `${fn(koongoOrd)} ordini · marketplace`)}
                sparkData={swCurrent.map(w=>w.koongoFatturato || 0)} sparkColor="var(--amber, #f59e0b)"
                current={periodTotals.koongo} previous={prevTotals.koongo} />
              <Stat label={t('dash.revenueTotal', null, 'Fatturato totale')} value={f0(totFat + koongoFat)} sources={['shopify']}
                sub={t('dash.revenueTotalSub', null, 'Shopify + Koongo')}
                sparkData={swCurrent.map(w=>(w.fatturato || 0) + (w.koongoFatturato || 0))} sparkColor="var(--green)"
                current={totFat + koongoFat} previous={(prevTotals.revenue || 0) + (prevTotals.koongo || 0)} />
            </div>
          )}
      {totResi > 0 && (
            <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:14,marginBottom:20}}>
              <Stat label={t('dash.returnsTotal', null, 'Resi totali')} value={f0(totResi)} sources={['shopify']} />
              <Stat label={t('dash.returnsNew', null, 'Resi nuovi clienti')} value={totResiNC>0?f0(totResiNC):'—'} sources={['shopify']} dim />
              <Stat label={t('dash.returnsReturning', null, 'Resi clienti ritorno')} value={totResiRC>0?f0(totResiRC):'—'} sources={['shopify']} dim />
            </div>
          )}
    </section>
  )

  return (
  <AppShell
    tab={tab}
    setTab={setTab}
    live={live}
    updated={updated}
    preset={preset}
    setPreset={setPreset}
    loading={loading}
    allowedTabs={allowedTabs}
    isOwner={isOwner}
    onRefresh={() => fetchLive(true)}
  >
    {showCfg && <Settings cfg={cfgBase} onSave={c=>setCfgBase(c)} onClose={()=>setShowCfg(false)} />}
    {/* Quanto si e' consumato del piano: si fa vedere solo quando serve avvisare, e sta sopra
        OGNI tab perche' il limite si supera mentre si lavora, non solo nelle Impostazioni. */}
    <PlanUsageBanner onGoSettings={() => setTab('settings')} />

      {/* ⬇⬇⬇ DA QUI IN GIÙ: lascia il tuo JSX ORIGINALE invariato (header, tabs, dashboard cards, grafici, tab Mensile/Weekly/Simulatore/MetaDetail, chiusura return e chiusura componente) ⬇⬇⬇ */}

  

      {/* DASHBOARD TAB */}
      {tab==='dashboard' && (
        <>
          <DownloadReportButton tab="Completo" preset={preset} />
          {/* In cima: com'e' andato il periodo, in una frase e tre numeri. Il resto
              della Dashboard resta sotto, com'era. */}
          <BriefingMattino />
          {/* ── Dashboard in stile Live View (19 set 2026) ─────────────────────────────────────
              Marino: "troppo confusionaria, troppe cose: come la Live View di Shopify, con in piu' la
              spesa di Meta e di Google; i dati che escono vanno in KPI Brain". Qui restano: i tre
              numeri in cima, chi c'e' adesso sul sito, sessioni e ordini, nuovi e abituali, spesa Meta
              e Google, il comportamento dei clienti, le sedi, i prodotti piu' venduti — e il globo.
              AOV, MER, LTV, CAC, rapporto LTV:CAC, marketplace, resi e Drive to Store
              sono in KPI Brain (bloccoEfficienza): stessi numeri, stesso periodo. */}
          <div className="dash-live-hero lv" ref={heroLv}>
            <div className="dash-live-globe"><div className="lv-globo-tela"><QuandoFermo><DashboardGlobe /></QuandoFermo></div><TelemetriaGlobo /></div>
            <div className="dash-live-left lv-colonna">
              <SintesiDashboard t={t}
            stessaOra={stessaOraValida} periodo={rangeLabel(globalPresetToTf(preset), t, intlLocale)}
            fatturato={totFat} spesa={totSpend} mer={avgMER} ordini={totOrd}
            prima={{ fatturato: prevTotals.revenue, spesa: (prevTotals.metaSpend || 0) + (prevTotals.googleSpend || 0) }} />
              <MossePilota />
              <LiveStatsCards solo="visitatori" />
              <div className="lv-griglia">
                <Stat label={t('dash.sessions', null, 'Sessioni')} value={totSess > 0 ? fn(totSess) : '—'} sources={['shopify']}
                  current={totSess} previous={prevTotals.sessions} />
                <Stat spiega={SN.ordini} label={t('dash.orders', null, 'Ordini')} value={totOrd>0?fn(totOrd):'—'} sources={['shopify']}
              sparkData={swCurrent.map(w=>w.ordini)} sparkColor="var(--accent)"
              current={totOrd} previous={prevTotals.orders} />
                <Stat spiega={SN.nuovi} label={t('dash.newCustomers', null, 'Nuovi clienti')} value={totNC>0?fn(totNC):'—'} sources={['shopify']}
              sparkData={swCurrent.map(w=>w.nc)} sparkColor="var(--cyan)"
              current={totNC} previous={prevTotals.nc} />
                <Stat spiega={SN.ritorno} label={t('dash.returningCustomers', null, 'Clienti di ritorno')} value={totRC>0?fn(totRC):'—'} sources={['shopify']}
              sparkData={swCurrent.map(w=>w.rc)} sparkColor="var(--purple)"
              current={totRC} previous={prevTotals.rc} />
                <Stat spiega={SN.meta} label={t('dash.metaSpend', null, 'Spesa Meta')} value={totMeta>0?f0(totMeta):'—'} sources={['meta']}
              sparkData={mwCurrent.map(w=>w.spend)} sparkColor="var(--accent)"
              current={totMeta} previous={prevTotals.metaSpend} />
                <Stat spiega={SN.google} label={t('dash.googleSpendFull', null, 'Spesa Google')} value={totGoog>0?f0(totGoog):'—'} sources={['google']}
              sparkData={gwCurrent.map(x=>x.spend)} sparkColor="var(--yellow)"
              current={totGoog} previous={prevTotals.googleSpend} />
              </div>
              <ComportamentoClienti since={kpiRange?.since} until={kpiRange?.until} t={t} />
              <LiveStatsCards solo="sedi" since={kpiRange?.since} until={kpiRange?.until} />
              <VenditePerProdotto righe={live?.shopifyTopProducts} t={t} />
            </div>
          </div>
        </>
      )}
{/* KPI BRAIN TAB */}
{tab === 'kpiBrain' && bloccoEfficienza}
{tab === 'kpiBrain' && (
  <KPIBrainTab
    data={data}
    dataYear={dataYear}
    live={live}
    cfg={cfg}
    S={S}
    shopifyWeeklyAll={shopifyWeeklyAll}
    metaWeeklyAll={metaWeeklyAll}
    googleDailyAll={googleDailyAll}
    onRefresh={() => fetchLive(true)}
    loading={loading}
    preset={preset}
    setPreset={setPreset}
  />
)}
      {/* MENSILE TAB */}
      {tab==='monthly' && (() => {
        const filled = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
        const MONTH_NAMES_IT = ['Gennaio','Febbraio','Marzo','Aprile','Maggio','Giugno','Luglio','Agosto','Settembre','Ottobre','Novembre','Dicembre']
        const monthName = (s) => {
          if (!s) return ''
          const [y, m] = s.split('-').map(Number)
          try {
            const mn = new Date(Date.UTC(y, m-1, 1)).toLocaleDateString(intlLocale, { month: 'long' })
            return `${mn.charAt(0).toUpperCase() + mn.slice(1)} ${y}`
          } catch { return `${MONTH_NAMES_IT[m-1]} ${y}` }
        }
        const mTH = {
          position:'sticky', top:0, zIndex:20,
          padding:'18px 20px', fontSize:11.5, fontWeight:640,
          textTransform:'uppercase', letterSpacing:'0.10em',
          textAlign:'left', whiteSpace:'nowrap',
          color:'var(--text2)',
          background:'var(--glass)',
          backdropFilter:'blur(20px)',
          borderBottom:'1.5px solid var(--border)',
        }
        const mTHmonth = {
          ...mTH, color:'var(--text)', fontSize:13, letterSpacing:'-0.01em', textTransform:'none', fontWeight:600,
        }
        const mTD = {
          padding:'14px 20px', fontSize:15, fontWeight:500,
          verticalAlign:'top', borderBottom:'1px solid var(--border)',
          color:'var(--text)',
        }
        const mVal = { fontWeight:640, fontSize:15, lineHeight:1.15, color:'var(--text)', letterSpacing:'-0.01em', fontVariantNumeric:'tabular-nums' }

        const mDelta = (curr, prev, kind='euro0', inverse=false) => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff / p * 100 : null
          const isDown = diff < 0
          // Inverse = lower is better (CAC/CPO/CPC/CPM)
          const isGood = inverse ? isDown : !isDown
          const color = isGood ? 'var(--green)' : 'var(--red)'
          const sign = diff > 0 ? '+' : '−'
          const abs = Math.abs(diff)
          let fmtAbs = '—'
          if (kind === 'euro0') fmtAbs = `€${Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`
          else if (kind === 'euro2') fmtAbs = `€${abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}`
          else if (kind === 'int') fmtAbs = Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })
          else if (kind === 'percent') fmtAbs = `${abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}%`
          else fmtAbs = abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})
          return (
            <div style={{marginTop:8,color,fontSize:13,lineHeight:1.2,fontWeight:680,whiteSpace:'nowrap'}}>
              <div>{sign}{fmtAbs}</div>
              {pctV != null && <div>{sign}{Math.abs(pctV).toLocaleString(localeNumeri(),{minimumFractionDigits:1,maximumFractionDigits:1})}%</div>}
            </div>
          )
        }

        const MV = ({value, prev, kind='euro0', suffix='', inverse=false}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={mVal}>{shown}</div>{mDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind, inverse)}</div>)
        }

        // ── Timeframe Mensile: SEMPRE mese selezionato vs mese precedente ──
        const fmtM2 = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`
        const monthMinus = (m, n) => {
          const [y, mm] = m.split('-').map(Number)
          const d = new Date(y, mm - 1, 1)
          d.setMonth(d.getMonth() - n)
          return fmtM2(d)
        }

        // Mese base: dal preset month_X se valido, altrimenti mese corrente
        const baseMonth = (typeof preset === 'string' && preset.startsWith('month_'))
          ? preset.slice(6)
          : fmtM2(new Date())

        const m0 = baseMonth                  // mese selezionato (corrente)
        const m1 = monthMinus(baseMonth, 1)   // mese precedente
        const currentCalendarMonth = fmtM2(new Date())

        // Se il mese selezionato è quello in corso, sovrapponi i dati live
        // (live.shopifyRange contiene il parziale fino ad oggi)
        const overlayLive = (m) => {
          if (m.month !== m0 || m0 !== currentCalendarMonth) return m
          const sr = live?.shopifyRange
          if (!sr) return m
          // Assicuro un row anche se data non aveva il mese
          const o = {
            ...m,
            fatturato: Number(sr.revenue) || m.fatturato || 0,
            fatturNC:  Number(sr.fatturNC) || m.fatturNC || 0,
            fatturRC:  Number(sr.fatturRC) || m.fatturRC || 0,
            resi:      Number(sr.resi) || m.resi || 0,
            resiNC:    Number(sr.resiNC) || m.resiNC || 0,
            resiRC:    Number(sr.resiRC) || m.resiRC || 0,
            ordini:    Number(sr.orders) || m.ordini || 0,
            nc:        Number(sr.nc) || m.nc || 0,
            rc:        Number(sr.rc) || m.rc || 0,
            sessioni:  Number(sr.sessions) || m.sessioni || 0,
            metaSpend: Number(live?.metaRange?.spend) || m.metaSpend || 0,
          }
          // Le voci DERIVATE si rifanno sui numeri appena sovrapposti. Prima restavano quelle della
          // serie mensile: nella colonna del mese in corso ADV, Nuovi Clienti e CAC non tornavano fra
          // loro (21 set 2026: CAC 59,11 € in tabella, 59,12 € rifatto da ADV ÷ Nuovi della stessa
          // colonna). Stesse formule della mappa dei mesi qui sopra.
          o.totalSpend = o.metaSpend + (Number(o.googleSpend) || 0)
          o.aov = safeDiv(o.fatturato, o.ordini); o.aovNC = safeDiv(o.fatturNC, o.nc); o.aovRC = safeDiv(o.fatturRC, o.rc)
          o.cac = safeDiv(o.totalSpend, o.nc); o.cpo = safeDiv(o.totalSpend, o.ordini)
          o.mer = safeDiv(o.fatturato, o.totalSpend); o.aMer = safeDiv(o.fatturNC, o.totalSpend)
          o.retention = o.nc + o.rc > 0 ? o.rc / (o.nc + o.rc) * 100 : null
          o.cro = o.sessioni > 0 && o.ordini > 0 ? o.ordini / o.sessioni * 100 : null
          o.ltv = o.aov ? o.aov * cfg.freq * cfg.life * cfg.margin / 100 : null
          o.ratio = o.ltv && o.cac ? o.ltv / o.cac : null
          return o
        }

        // Se il mese non esiste in data (filtrato out perché vuoto), lo ricreo
        const ensureMonthRow = (label) => {
          const existing = data.find(m => m.month === label)
          if (existing) return existing
          return { month: label, fatturato:0, fatturNC:0, fatturRC:0, resi:0, resiNC:0, resiRC:0, ordini:0, nc:0, rc:0, sessioni:0, metaSpend:0, googleSpend:0, totalSpend:0 }
        }

        // KPI cards summary: solo mese selezionato (delta vs precedente)
        const tfMonths = [overlayLive(ensureMonthRow(m0))]
        const tfPrevMonths = [ensureMonthRow(m1)]

        // Colonne tabella: il mese scelto e i quattro precedenti, SEMPRE. Come
        // nel Weekly, le colonne non aspettano i dati: se la serie mensile arriva
        // vuota per un momento il mese resta in tabella con i trattini, invece
        // di sparire e far sembrare persa la vista. Il limite e' solo l'inizio
        // dello storico dell'app (MONTHS_START).
        const MIN_MESI_TABELLA = 5
        const tableMonths = (() => {
          const out = [overlayLive(ensureMonthRow(m0)), ensureMonthRow(m1)]
          for (let i = 2; i < MIN_MESI_TABELLA; i++) {
            const label = monthMinus(baseMonth, i)
            if (label < MONTHS_START) break
            out.push(ensureMonthRow(label))
          }
          return out
        })()

        const tfLabel = `${m0} vs ${m1}`

        const sumField = (arr, key) => arr.reduce((s,m) => s + Number(m[key] || 0), 0)
        const divSafe = (a, b) => b > 0 ? a / b : null

        // Le colonne marketplace compaiono solo se il canale ha venduto in
        // uno dei mesi mostrati: due colonne di zeri in una tabella gia' larga
        // sono solo rumore.
        const mostraKoongo = filled.some(m => Number(m.koongo || 0) > 0)

        const tf = {
          fat: sumField(tfMonths, 'fatturato'),
          ord: sumField(tfMonths, 'ordini'),
          nc: sumField(tfMonths, 'nc'),
          rc: sumField(tfMonths, 'rc'),
          meta: sumField(tfMonths, 'metaSpend'),
          goog: sumField(tfMonths, 'googleSpend'),
          spend: sumField(tfMonths, 'totalSpend'),
          ses: sumField(tfMonths, 'sessioni'),
          koongo: sumField(tfMonths, 'koongo'),
        }
        tf.aov = divSafe(tf.fat, tf.ord)
        tf.mer = divSafe(tf.fat, tf.spend)
        tf.cac = divSafe(tf.spend, tf.nc)
        tf.ratio = tf.aov && tf.cac ? (tf.aov * cfg.freq * cfg.life * cfg.margin / 100) / tf.cac : null

        const tfP = {
          fat: sumField(tfPrevMonths, 'fatturato'),
          ord: sumField(tfPrevMonths, 'ordini'),
          nc: sumField(tfPrevMonths, 'nc'),
          rc: sumField(tfPrevMonths, 'rc'),
          meta: sumField(tfPrevMonths, 'metaSpend'),
          goog: sumField(tfPrevMonths, 'googleSpend'),
          spend: sumField(tfPrevMonths, 'totalSpend'),
          ses: sumField(tfPrevMonths, 'sessioni'),
          koongo: sumField(tfPrevMonths, 'koongo'),
        }
        tfP.aov = divSafe(tfP.fat, tfP.ord)
        tfP.mer = divSafe(tfP.fat, tfP.spend)
        tfP.cac = divSafe(tfP.spend, tfP.nc)
        tfP.ratio = tfP.aov && tfP.cac ? (tfP.aov * cfg.freq * cfg.life * cfg.margin / 100) / tfP.cac : null

        // ── Sparkline SVG builder ──
        const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 30 }) => {
          const vals = dataArr.map(d => Number(d[dataKey] || 0))
          if (vals.length < 2 || vals.every(v => v === 0)) return null
          const max = Math.max(...vals), min = Math.min(...vals)
          const range = max - min || 1
          const points = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 4) - 2
            return `${x},${y}`
          }).join(' ')
          return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }

        // ── Delta badge (%) ──
        const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
          if (prev == null || prev === 0 || curr == null) return null
          const pct = ((curr - prev) / prev) * 100
          if (Math.abs(pct) < 0.1) return null
          const up = pct > 0
          const good = isLowerBetter ? !up : up
          return (
            <span style={{
              fontSize: 11.5, fontWeight: 640, padding: '3px 8px', borderRadius: 8,
              background: good ? '#22c55e20' : '#ef444420',
              color: good ? '#22c55e' : '#ef4444',
            }}>
              {up ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )
        }

        const chartData = filled.map(m => ({
          label: m.month, fatturato: m.fatturato, spesa: m.totalSpend,
          nc: m.nc, rc: m.rc, mer: m.mer, aov: m.aov, cro: m.cro, ratio: m.ratio,
        }))

        const kpiCards = [
          { label: t('dash.revenue', null, 'Fatturato'), val: tf.fat, prev: tfP.fat, fmt: f0, color: 'var(--green)', key: 'fatturato', sources: ['shopify'] },
          // Marketplace: accanto al fatturato, mai dentro. Compare solo se il
          // canale ha venduto in uno dei due periodi confrontati.
          ...(tf.koongo > 0 || tfP.koongo > 0 ? [
            { label: t('dash.koongoRevenue', null, 'Fatturato Koongo'), val: tf.koongo, prev: tfP.koongo, fmt: f0, color: 'var(--orange)', key: 'koongo', sources: ['shopify'] },
            { label: t('dash.revenueTotal', null, 'Fatturato totale'), val: tf.fat + tf.koongo, prev: tfP.fat + tfP.koongo, fmt: f0, color: 'var(--green)', key: 'fatturatoTotale', sources: ['shopify'] },
          ] : []),
          { label: t('dash.orders', null, 'Ordini'), val: tf.ord, prev: tfP.ord, fmt: fn, color: 'var(--accent)', key: 'ordini', sources: ['shopify'] },
          { label: 'AOV', val: tf.aov, prev: tfP.aov, fmt: f2, color: 'var(--orange)', key: 'aov', sources: ['shopify'] },
          { label: t('dash.newCustomersShort', null, 'Nuovi Clienti'), val: tf.nc, prev: tfP.nc, fmt: fn, color: 'var(--cyan)', key: 'nc', sources: ['shopify'] },
          { label: t('dash.returningShort', null, 'Clienti Ritorno'), val: tf.rc, prev: tfP.rc, fmt: fn, color: 'var(--purple)', key: 'rc', sources: ['shopify'] },
          { label: 'MER', val: tf.mer, prev: tfP.mer, fmt: v => v != null ? `${fr(v)}×` : '—', color: tf.mer != null ? (tf.mer >= 3 ? 'var(--green)' : tf.mer >= 2 ? 'var(--orange)' : 'var(--red)') : 'var(--text3)', key: 'mer', sources: ['shopify','meta'] },
          { label: 'CAC', val: tf.cac, prev: tfP.cac, fmt: f2, color: 'var(--text)', key: 'cac', lower: true, sources: ['shopify','meta','google'] },
          { label: t('dash.ratioLtvCacLabel', null, 'Ratio LTV:CAC'), val: tf.ratio, prev: tfP.ratio, fmt: v => v != null ? `${fr(v)}:1` : '—', color: ratioColor(tf.ratio), key: 'ratio', sources: ['shopify','meta'] },
          { label: t('dash.metaSpendLabel', null, 'Meta Spend'), val: tf.meta, prev: tfP.meta, fmt: f0, color: 'var(--accent)', key: 'metaSpend', sources: ['meta'] },
          { label: t('dash.googleSpend', null, 'Google Spend'), val: tf.goog, prev: tfP.goog, fmt: v => v > 0 ? f0(v) : '—', color: 'var(--yellow)', key: 'googleSpend', sources: ['google'] },
        ]

        return (
        <>
          {/* Timeframe selector */}
          <div className="rep-toolbar" style={{marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
            <TimeframeSelector
              value={preset?.startsWith('month_') ? preset : `month_${baseMonth}`}
              onChange={setPreset}
              disabled={loading}
              hideDateRange
              monthsCount={18}
            />
            <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => fetchLive(true)} disabled={loading} gira={loading} />
            <div className="rep-pdf" style={{display:'contents'}}><DownloadReportButton tab={t('tab.monthly', null, 'Monthly')} tipo="monthly" ltv={cfg} preset={preset} /></div>
            <span className="rep-cmp" style={{fontSize:11.5,color:'var(--text3)'}}>{tfLabel}</span>
          </div>

          {(() => { const o = new Date().toISOString().slice(0, 10); return <DriveToStoreCard since={`${o.slice(0, 7)}-01`} until={o} /> })()}

          {/* Summary KPI Cards with sparkline + delta */}
          <div className="stagger-zoom m-grid2 rep-kpis" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
            {kpiCards.map(kpi => (
              <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
                  <div className="label">{kpi.label}</div>
                  <PlatformBadges sources={kpi.sources} size={16} />
                </div>
                <div className="rep-kpi-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                  <div className="metric-value">{kpi.fmt(kpi.val)}</div>
                  <Sparkline dataArr={filled} dataKey={kpi.key} color={kpi.color} />
                </div>
                <div style={{marginTop:10}}>
                  <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                </div>
              </div>
            ))}
          </div>

          {/* Una tabella sola, come il conto economico: voci in riga e mesi in
              colonna. Prima erano due tabelle girate — sedici metriche in
              orizzontale — e per leggere un mese si scorreva di lato mentre il
              confronto fra due mesi stava su righe lontane. */}
          <FxChartCard title={t('dash.monthlyData', null, 'Dati mensili')} glowColor="#22c55e"
            subtitle={googleAuto.configured ? t('dash.allAutoSub', null, 'Shopify, Meta e Google automatici') : t('dash.weeklyDataSub', null, 'Shopify + Meta automatici · Google manuale')}>
            <MatriceReport t={t} chiaveBase="fatturato" etichettaColonna={t('dash.thItem', null, 'Voce')}
              periodi={tableMonths.map((m, i) => {
                const annoPrima = data.find(x => x.month === meseMenoUnAnno(m.month)) || null
                return {
                  key: m.month,
                  label: monthName(m.month),
                  labelPrec: tableMonths[i + 1] ? monthName(tableMonths[i + 1].month) : null,
                  labelAnnoPrima: annoPrima ? monthName(annoPrima.month) : null,
                  siglaAnnoPrima: String(meseMenoUnAnno(m.month) || '').slice(2, 4),
                  valori: m,
                  valoriPrec: tableMonths[i + 1] || null,
                  valoriAnnoPrima: annoPrima,
                }
              })}
              righe={righeReport({ t, mostraKoongo, googleAuto })} />
          </FxChartCard>

          {/* Charts — futuristic */}
          {filled.length > 0 && (
          <>
            <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <FxChartCard title={t('dash.chartRevSpendMer', null, 'Fatturato, Spesa e MER')} glowColor="#22c55e">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                    <defs>
                      <linearGradient id="fx-rev" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="fx-spend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                      </linearGradient>
                      <filter id="fx-glow-g" x="-50%" y="-50%" width="200%" height="200%">
                        <feGaussianBlur stdDeviation="2.5" result="blur"/>
                        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                      </filter>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                    <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                    <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                    <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#fx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#fx-glow-g)'}} />
                    <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#fx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationEasing="ease-out" animationBegin={200} connectNulls />
                    <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </FxChartCard>

              <FxChartCard title={t("dash.chartNewReturning", null, "Nuovi clienti e clienti di ritorno")} glowColor="#06b6d4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                    <defs>
                      <linearGradient id="fx-nc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                      </linearGradient>
                      <linearGradient id="fx-rc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                        <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                    <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                    <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                    <Bar dataKey="nc" name="Nuovi clienti" fill="url(#fx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                    <Bar dataKey="rc" name="Clienti ritorno" fill="url(#fx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                  </BarChart>
                </ResponsiveContainer>
              </FxChartCard>
            </div>

            <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
              <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
                <ResponsiveContainer width="100%" height={240}>
                  <ComposedChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                    <defs>
                      <linearGradient id="fx-aov" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                        <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="fx-cro" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                        <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                    <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                    <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                    <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                    <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#fx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                    <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#fx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </FxChartCard>

              <FxChartCard title={t("dash.ratioLtvCacLabel", null, "Ratio LTV:CAC")} glowColor="#a78bfa">
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={chartData} margin={{top:8,right:18,left:0,bottom:4}}>
                    <defs>
                      <linearGradient id="fx-ratio" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                        <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                    <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                    <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:600, position:'right'}} />
                    <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                    <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                    <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#fx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                  </AreaChart>
                </ResponsiveContainer>
              </FxChartCard>
            </div>
          </>
          )}

          {/* Floating Mensile Agent (vertical chat) */}
          <MensileAgent data={data} selectedMonth={m0} previousMonth={m1} preset={preset} />
        </>
      )})()}

      {/* WEEKLY TAB */}
      {tab==='weekly' && (
        <WeeklyTab
          weeks={getWeeks()}
          data={weeks}
          metaWeekly={live?.metaWeekly || []}
          shopifyWeekly={live?.shopifyWeekly || []}
          googleWeekly={googleWeekly}
          onUpdate={updateWeek}
          cfg={cfg}
          S={S}
          preset={preset}
          weeklyTF={weeklyTF}
          setWeeklyTF={setWeeklyTF}
          weeklyCustom={weeklyCustom}
          setWeeklyCustom={setWeeklyCustom}
          onRefresh={() => fetchLive(true)}
          loading={loading}
        />
      )}

      {/* QUARTER TAB */}
      {tab==='quarter' && (() => {
        const QUARTER_NAMES = ['Q1','Q2','Q3','Q4']
        const monthsInQuarter = (year, q) => {
          const start = (q-1)*3 + 1
          return [start, start+1, start+2].map(m => `${year}-${String(m).padStart(2,'0')}`)
        }
        const quarterLabel = (key) => {
          const [y, q] = key.split('-Q')
          return `${QUARTER_NAMES[Number(q)-1]} ${y}`
        }
        const quarterMinus = (key, n) => {
          const [y, qn] = key.split('-Q').map(Number)
          let nq = qn - n
          let ny = y
          while (nq < 1) { nq += 4; ny -= 1 }
          return `${ny}-Q${nq}`
        }

        // Current quarter from preset or today
        const now = new Date()
        const currentQ = `${now.getFullYear()}-Q${Math.floor(now.getMonth()/3) + 1}`
        const baseQ = (typeof preset === 'string' && preset.startsWith('quarter_'))
          ? preset.slice(8)
          : currentQ

        const q0 = baseQ
        const q1 = quarterMinus(baseQ, 1)

        // Live single-range payloads from /api/metrics?preset=quarter_YYYY-Qn
        // → shopifyRange = q0, shopifyPrevRange = q1.
        // Single-range queries usano la classificazione Shopify NC/RC del periodo
        // (deduplicata a livello cliente), che è quella che Marino vede in Shopify.
        // La somma mensile invece riclassifica ogni mese e gonfia NC.
        const isQuarterPreset = typeof preset === 'string' && preset.startsWith('quarter_')
        const presetQ = isQuarterPreset ? preset.slice(8) : null
        const sr = live?.shopifyRange
        const spr = live?.shopifyPrevRange
        const mr = live?.metaRange
        const mpr = live?.metaPrevRange

        // Aggregate months data into a quarter row, with live overlay for q0/q1.
        const aggregateQuarter = (key) => {
          const [y, q] = key.split('-Q').map(Number)
          const monthKeys = monthsInQuarter(y, q)
          const rows = data.filter(m => monthKeys.includes(m.month))

          const sum = (k) => rows.reduce((s,m)=>s + Number(m[k]||0), 0)

          // Live overlay: solo se preset effettivamente quarter_ e combacia
          const useLiveCurrent = isQuarterPreset && key === presetQ && sr
          const useLivePrev = isQuarterPreset && key === quarterMinus(presetQ, 1) && spr
          const useLiveMetaCurrent = isQuarterPreset && key === presetQ && mr
          const useLiveMetaPrev = isQuarterPreset && key === quarterMinus(presetQ, 1) && mpr

          const fatturato = useLiveCurrent ? Number(sr.revenue) || 0
                          : useLivePrev    ? Number(spr.revenue) || 0
                          : sum('fatturato')
          const fatturNC  = useLiveCurrent ? Number(sr.fatturNC) || 0
                          : useLivePrev    ? Number(spr.fatturNC) || 0
                          : sum('fatturNC')
          const fatturRC  = useLiveCurrent ? Number(sr.fatturRC) || 0
                          : useLivePrev    ? Number(spr.fatturRC) || 0
                          : sum('fatturRC')
          const resi      = useLiveCurrent ? Number(sr.resi) || 0
                          : useLivePrev    ? Number(spr.resi) || 0
                          : sum('resi')
          const resiNC    = useLiveCurrent ? Number(sr.resiNC) || 0
                          : useLivePrev    ? Number(spr.resiNC) || 0
                          : sum('resiNC')
          const resiRC    = useLiveCurrent ? Number(sr.resiRC) || 0
                          : useLivePrev    ? Number(spr.resiRC) || 0
                          : sum('resiRC')
          const ordini    = useLiveCurrent ? Number(sr.orders) || 0
                          : useLivePrev    ? Number(spr.orders) || 0
                          : sum('ordini')
          const nc        = useLiveCurrent ? Number(sr.nc) || 0
                          : useLivePrev    ? Number(spr.nc) || 0
                          : sum('nc')
          const rc        = useLiveCurrent ? Number(sr.rc) || 0
                          : useLivePrev    ? Number(spr.rc) || 0
                          : sum('rc')
          const sessioni  = useLiveCurrent ? Number(sr.sessions) || 0
                          : useLivePrev    ? Number(spr.sessions) || 0
                          : sum('sessioni')
          const metaSpend = useLiveMetaCurrent ? Number(mr.spend) || 0
                          : useLiveMetaPrev    ? Number(mpr.spend) || 0
                          : sum('metaSpend')
          const googleSpend = sum('googleSpend')
          const totalSpend = metaSpend + googleSpend
          const koongo    = useLiveCurrent ? Number(sr.koongoRevenue) || 0
                          : useLivePrev    ? Number(spr.koongoRevenue) || 0
                          : sum('koongo')

          const aov = ordini > 0 ? fatturato/ordini : null
          const aovNC = nc > 0 ? fatturNC/nc : null
          const aovRC = rc > 0 ? fatturRC/rc : null
          const mer = totalSpend > 0 ? fatturato/totalSpend : null
          const aMer = totalSpend > 0 ? fatturNC/totalSpend : null
          const cac = nc > 0 ? totalSpend/nc : null
          const cpo = ordini > 0 ? totalSpend/ordini : null
          const retention = nc+rc > 0 ? rc/(nc+rc)*100 : null
          const cro = sessioni > 0 && ordini > 0 ? ordini/sessioni*100 : null
          const ltv = aov != null ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
          const ratio = ltv && cac ? ltv/cac : null
          return { key, label: quarterLabel(key), fatturato, koongo, fatturNC, fatturRC, resi, resiNC, resiRC, ordini, nc, rc, sessioni, metaSpend, googleSpend, totalSpend, aov, aovNC, aovRC, mer, aMer, cac, cpo, retention, cro, ltv, ratio }
        }

        // Il trimestre scelto e i quattro precedenti: con due colonne si vedeva
        // solo se saliva o scendeva, con cinque si vede anche l'anno intero e lo
        // stesso trimestre dell'anno prima accanto. aggregateQuarter su un
        // trimestre senza dati restituisce zeri: la colonna resta, coi trattini.
        const MIN_TRIMESTRI_TABELLA = 5
        const tableQuarters = Array.from({ length: MIN_TRIMESTRI_TABELLA }, (_, i) =>
          aggregateQuarter(i === 0 ? q0 : quarterMinus(q0, i)))
        const mostraKoongoQ = tableQuarters.some(q => Number(q.koongo || 0) > 0)
        const cur = aggregateQuarter(q0)
        const prev = aggregateQuarter(q1)

        // Aggregati ultimi 6 quarter (più vecchio a sinistra), solo quelli con dati
        const chartQuarterKeys = []
        for (let i = 5; i >= 0; i--) chartQuarterKeys.push(quarterMinus(q0, i))
        const aggregatedQuarters = chartQuarterKeys
          .map(k => aggregateQuarter(k))
          .filter(q => q.fatturato > 0 || q.ordini > 0 || q.totalSpend > 0)
        const quarterChartData = aggregatedQuarters.map(q => ({
          label: q.label, fatturato: q.fatturato, spesa: q.totalSpend,
          nc: q.nc, rc: q.rc, mer: q.mer, aov: q.aov, cro: q.cro, ratio: q.ratio,
        }))

        const qVal = { fontFamily: 'inherit', fontWeight:680, fontSize:15, lineHeight:1.15, color:'var(--text)' }
        const qTH = {
          position:'sticky', top:0, zIndex:20,
          padding:'18px 20px', fontSize:11.5, fontWeight:640,
          textTransform:'uppercase', letterSpacing:'0.10em',
          textAlign:'left', whiteSpace:'nowrap', color:'var(--text2)',
          background:'var(--glass)', backdropFilter:'blur(20px)',
          borderBottom:'1.5px solid var(--border)',
        }
        const qTD = {
          padding:'14px 20px', fontSize:15, fontWeight:500,
          verticalAlign:'top', borderBottom:'1px solid var(--border)', color:'var(--text)',
        }

        const qDelta = (curr, prev, kind='euro0', inverse=false) => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff/p*100 : null
          const isDown = diff < 0
          const isGood = inverse ? isDown : !isDown
          const color = isGood ? 'var(--green)' : 'var(--red)'
          const sign = diff > 0 ? '+' : '−'
          const abs = Math.abs(diff)
          let fmtAbs = '—'
          if (kind === 'euro0') fmtAbs = `€${Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`
          else if (kind === 'euro2') fmtAbs = `€${abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}`
          else if (kind === 'int') fmtAbs = Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })
          else if (kind === 'percent') fmtAbs = `${abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}%`
          else fmtAbs = abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})
          return (
            <div style={{marginTop:8,color,fontSize:13,lineHeight:1.2,fontWeight:680,whiteSpace:'nowrap'}}>
              <div>{sign}{fmtAbs}</div>
              {pctV != null && <div>{sign}{Math.abs(pctV).toLocaleString(localeNumeri(),{minimumFractionDigits:1,maximumFractionDigits:1})}%</div>}
            </div>
          )
        }
        const QV = ({value, prev, kind='euro0', suffix='', inverse=false}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={qVal}>{shown}</div>{qDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind, inverse)}</div>)
        }

        // Sparkline + delta badge per le KPI cards
        const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 30 }) => {
          const vals = dataArr.map(d => Number(d[dataKey] || 0))
          if (vals.length < 2 || vals.every(v => v === 0)) return null
          const max = Math.max(...vals), min = Math.min(...vals)
          const range = max - min || 1
          const points = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 4) - 2
            return `${x},${y}`
          }).join(' ')
          return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
        const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
          if (prev == null || prev === 0 || curr == null) return null
          const pct = ((curr - prev) / prev) * 100
          if (Math.abs(pct) < 0.1) return null
          const up = pct > 0
          const good = isLowerBetter ? !up : up
          return (
            <span style={{
              fontSize: 11.5, fontWeight: 640, padding: '3px 8px', borderRadius: 8,
              background: good ? '#22c55e20' : '#ef444420',
              color: good ? '#22c55e' : '#ef4444',
            }}>
              {up ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )
        }

        const kpiCards = [
          { label:t('dash.revenue', null, 'Fatturato'), val:cur.fatturato, prev:prev.fatturato, fmt:f0, color:'var(--green)', key:'fatturato', sources:['shopify'] },
          ...((cur.koongo > 0 || prev.koongo > 0) ? [
            { label:t('dash.koongoRevenue', null, 'Fatturato Koongo'), val:cur.koongo, prev:prev.koongo, fmt:f0, color:'var(--orange)', key:'koongo', sources:['shopify'] },
            { label:t('dash.revenueTotal', null, 'Fatturato totale'), val:cur.fatturato + cur.koongo, prev:prev.fatturato + prev.koongo, fmt:f0, color:'var(--green)', key:'fatturatoTotale', sources:['shopify'] },
          ] : []),
          { label:t('dash.orders', null, 'Ordini'), val:cur.ordini, prev:prev.ordini, fmt:fn, color:'var(--accent)', key:'ordini', sources:['shopify'] },
          { label:'AOV', val:cur.aov, prev:prev.aov, fmt:f2, color:'var(--orange)', key:'aov', sources:['shopify'] },
          { label:t('dash.newCustomersShort', null, 'Nuovi Clienti'), val:cur.nc, prev:prev.nc, fmt:fn, color:'var(--cyan)', key:'nc', sources:['shopify'] },
          { label:t('dash.returningShort', null, 'Clienti Ritorno'), val:cur.rc, prev:prev.rc, fmt:fn, color:'var(--purple)', key:'rc', sources:['shopify'] },
          { label:'MER', val:cur.mer, prev:prev.mer, fmt:v=>v!=null?`${fr(v)}×`:'—', color:cur.mer!=null?(cur.mer>=3?'var(--green)':cur.mer>=2?'var(--orange)':'var(--red)'):'var(--text3)', key:'mer', sources:['shopify','meta'] },
          { label:'CAC', val:cur.cac, prev:prev.cac, fmt:f2, color:'var(--text)', key:'cac', lower:true, sources:['shopify','meta','google'] },
          { label:t('dash.ratioLtvCacLabel', null, 'Ratio LTV:CAC'), val:cur.ratio, prev:prev.ratio, fmt:v=>v!=null?`${fr(v)}:1`:'—', color:ratioColor(cur.ratio), key:'ratio', sources:['shopify','meta'] },
          { label:t('dash.metaSpendLabel', null, 'Meta Spend'), val:cur.metaSpend, prev:prev.metaSpend, fmt:f0, color:'var(--accent)', key:'metaSpend', sources:['meta'] },
          { label:t('dash.googleSpend', null, 'Google Spend'), val:cur.googleSpend, prev:prev.googleSpend, fmt:v=>v>0?f0(v):'—', color:'var(--yellow)', key:'googleSpend', sources:['google'] },
        ]

        return (
          <>
            {/* Timeframe selector */}
            <div className="rep-toolbar" style={{marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <TimeframeSelector
                value={preset?.startsWith('quarter_') ? preset : `quarter_${q0}`}
                onChange={setPreset}
                disabled={loading}
                mode="quarter"
              />
              <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => fetchLive(true)} disabled={loading} gira={loading} />
              <div className="rep-pdf" style={{display:'contents'}}><DownloadReportButton tab={t('tab.quarter', null, 'Quarter')} tipo="quarter" ltv={cfg} preset={preset} /></div>
              <span className="rep-cmp" style={{fontSize:11.5,color:'var(--text3)'}}>{quarterLabel(q0)} vs {quarterLabel(q1)}</span>
            </div>

            {(() => {
              const [anno, q] = String(q0).split('-Q').map(Number)
              if (!anno || !q) return null
              const oggi = new Date().toISOString().slice(0, 10)
              const since = `${anno}-${String((q - 1) * 3 + 1).padStart(2, '0')}-01`
              const ultimo = new Date(Date.UTC(anno, q * 3, 0)).toISOString().slice(0, 10)
              return <DriveToStoreCard since={since} until={ultimo > oggi ? oggi : ultimo} />
            })()}

            {/* KPI summary cards */}
            <div className="stagger-zoom m-grid2 rep-kpis" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
              {kpiCards.map(kpi => (
                <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
                    <div className="label">{kpi.label}</div>
                    <PlatformBadges sources={kpi.sources} size={16} />
                  </div>
                  <div className="rep-kpi-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div className="metric-value">{kpi.fmt(kpi.val)}</div>
                    <Sparkline dataArr={aggregatedQuarters} dataKey={kpi.key} color={kpi.color} />
                  </div>
                  <div style={{marginTop:10}}>
                    <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                  </div>
                </div>
              ))}
            </div>

            {/* Come il conto economico: voci in riga, trimestri in colonna. */}
            <FxChartCard title={t('dash.quarterData', null, 'Dati trimestrali')} glowColor="#22c55e" subtitle={t('dash.aggMonthly', null, 'Aggregato da dati mensili')}>
              <MatriceReport t={t} chiaveBase="fatturato" etichettaColonna={t('dash.thItem', null, 'Voce')}
                periodi={tableQuarters.map((q, i) => {
                  const chiaveAnnoPrima = quarterMinus(q.key, 4)
                  const annoPrima = aggregateQuarter(chiaveAnnoPrima)
                  return {
                    key: q.key,
                    label: q.label,
                    labelPrec: tableQuarters[i + 1]?.label || null,
                    labelAnnoPrima: quarterLabel(chiaveAnnoPrima),
                    siglaAnnoPrima: String(chiaveAnnoPrima || '').slice(2, 4),
                    valori: q,
                    valoriPrec: tableQuarters[i + 1] || null,
                    // Un trimestre senza fatturato ne' spesa non e' un calo:
                    // e' storico che non c'e'. Meglio un trattino di uno zero.
                    valoriAnnoPrima: (annoPrima && (annoPrima.fatturato > 0 || annoPrima.totalSpend > 0)) ? annoPrima : null,
                  }
                })}
                righe={righeReport({ t, mostraKoongo: mostraKoongoQ, googleAuto })} />
            </FxChartCard>


            {quarterChartData.length > 0 && (
              <>
                <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title={t('dash.chartRevSpendMer', null, 'Fatturato, Spesa e MER')} glowColor="#22c55e">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="qfx-rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="qfx-spend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="qfx-glow-g" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#qfx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#qfx-glow-g)'}} />
                        <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#qfx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationEasing="ease-out" animationBegin={200} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title={t("dash.chartNewReturning", null, "Nuovi clienti e clienti di ritorno")} glowColor="#06b6d4">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                        <defs>
                          <linearGradient id="qfx-nc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                          </linearGradient>
                          <linearGradient id="qfx-rc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Bar dataKey="nc" name="Nuovi clienti" fill="url(#qfx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                        <Bar dataKey="rc" name="Clienti ritorno" fill="url(#qfx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>

                <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="qfx-aov" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="qfx-cro" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#qfx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                        <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#qfx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title={t("dash.ratioLtvCacLabel", null, "Ratio LTV:CAC")} glowColor="#a78bfa">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={quarterChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="qfx-ratio" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:600, position:'right'}} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#qfx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>
              </>
            )}

            {/* Floating Quarter Agent (vertical chat) */}
            <QuarterAgent quarters={aggregatedQuarters} selectedQuarter={q0} previousQuarter={q1} preset={preset} />
          </>
        )
      })()}

      {/* YEAR TAB */}
      {tab==='year' && (() => {
        const monthsInYear = (year) =>
          Array.from({length:12}, (_,i) => `${year}-${String(i+1).padStart(2,'0')}`)
        const yearLabel = (key) => `${key}`
        const yearMinus = (key, n) => `${Number(key) - n}`

        const now = new Date()
        const currentY = `${now.getFullYear()}`
        const baseY = (typeof preset === 'string' && preset.startsWith('year_'))
          ? preset.slice(5)
          : currentY

        const y0 = baseY
        const y1 = yearMinus(baseY, 1)

        const isYearPreset = typeof preset === 'string' && preset.startsWith('year_')
        const presetY = isYearPreset ? preset.slice(5) : null
        const sr = live?.shopifyRange
        const spr = live?.shopifyPrevRange
        const mr = live?.metaRange
        const mpr = live?.metaPrevRange

        const aggregateYear = (key) => {
          const monthKeys = monthsInYear(key)
          const rows = data.filter(m => monthKeys.includes(m.month))

          const sum = (k) => rows.reduce((s,m)=>s + Number(m[k]||0), 0)

          // Live overlay: solo se il preset è effettivamente year_ e combacia
          // (altrimenti shopifyRange porta dati di un altro periodo)
          const useLiveCurrent = isYearPreset && key === presetY && sr
          const useLivePrev = isYearPreset && key === yearMinus(presetY, 1) && spr
          const useLiveMetaCurrent = isYearPreset && key === presetY && mr
          const useLiveMetaPrev = isYearPreset && key === yearMinus(presetY, 1) && mpr

          // YEAR-ONLY: pre-calcolo somma mensile per TUTTI i campi che usano
          // live overlay. Usati come floor sotto al live (ShopifyQL su range
          // year_ a volte ritorna 0 per rate-limit / breakdown fail random
          // su 6+ mesi). Cosi' card e tabelle leggono sempre dallo stesso
          // valore robusto: MAX(live, monthly).
          const fatturatoMonthly = sum('fatturato')
          const fatturNcMonthly  = sum('fatturNC')
          const fatturRcMonthly  = sum('fatturRC')
          const resiMonthly      = sum('resi')
          const resiNcMonthly    = sum('resiNC')
          const resiRcMonthly    = sum('resiRC')
          const ordiniMonthly    = sum('ordini')
          const ncMonthly        = sum('nc')
          const rcMonthly        = sum('rc')
          const sessioniMonthly  = sum('sessioni')

          // YEAR-ONLY: tutti i campi shopify usano MAX(live overlay, monthly).
          // Se ShopifyQL nel live ritorna 0 (rate-limit su range year_),
          // cade su monthly (per-mese piu' affidabile). Per anni storici
          // senza live overlay, monthly sempre.
          const fatturato = useLiveCurrent ? Math.max(Number(sr.revenue) || 0, fatturatoMonthly)
                          : useLivePrev    ? Math.max(Number(spr.revenue) || 0, fatturatoMonthly)
                          : fatturatoMonthly
          const fatturNC  = useLiveCurrent ? Math.max(Number(sr.fatturNC) || 0, fatturNcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.fatturNC) || 0, fatturNcMonthly)
                          : fatturNcMonthly
          const fatturRC  = useLiveCurrent ? Math.max(Number(sr.fatturRC) || 0, fatturRcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.fatturRC) || 0, fatturRcMonthly)
                          : fatturRcMonthly
          const resi      = useLiveCurrent ? Math.max(Number(sr.resi) || 0, resiMonthly)
                          : useLivePrev    ? Math.max(Number(spr.resi) || 0, resiMonthly)
                          : resiMonthly
          const resiNC    = useLiveCurrent ? Math.max(Number(sr.resiNC) || 0, resiNcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.resiNC) || 0, resiNcMonthly)
                          : resiNcMonthly
          const resiRC    = useLiveCurrent ? Math.max(Number(sr.resiRC) || 0, resiRcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.resiRC) || 0, resiRcMonthly)
                          : resiRcMonthly
          const ordini    = useLiveCurrent ? Math.max(Number(sr.orders) || 0, ordiniMonthly)
                          : useLivePrev    ? Math.max(Number(spr.orders) || 0, ordiniMonthly)
                          : ordiniMonthly
          const nc        = useLiveCurrent ? Math.max(Number(sr.nc) || 0, ncMonthly)
                          : useLivePrev    ? Math.max(Number(spr.nc) || 0, ncMonthly)
                          : ncMonthly
          const rc        = useLiveCurrent ? Math.max(Number(sr.rc) || 0, rcMonthly)
                          : useLivePrev    ? Math.max(Number(spr.rc) || 0, rcMonthly)
                          : rcMonthly
          const sessioni  = useLiveCurrent ? Math.max(Number(sr.sessions) || 0, sessioniMonthly)
                          : useLivePrev    ? Math.max(Number(spr.sessions) || 0, sessioniMonthly)
                          : sessioniMonthly
          const metaSpend = useLiveMetaCurrent ? Number(mr.spend) || 0
                          : useLiveMetaPrev    ? Number(mpr.spend) || 0
                          : sum('metaSpend')
          const googleSpend = sum('googleSpend')
          const totalSpend = metaSpend + googleSpend

          const aov = ordini > 0 ? fatturato/ordini : null
          const aovNC = nc > 0 ? fatturNC/nc : null
          const aovRC = rc > 0 ? fatturRC/rc : null
          const mer = totalSpend > 0 ? fatturato/totalSpend : null
          const aMer = totalSpend > 0 ? fatturNC/totalSpend : null
          const cac = nc > 0 ? totalSpend/nc : null
          const cpo = ordini > 0 ? totalSpend/ordini : null
          const retention = nc+rc > 0 ? rc/(nc+rc)*100 : null
          const cro = sessioni > 0 && ordini > 0 ? ordini/sessioni*100 : null
          const ltv = aov != null ? aov * cfg.freq * cfg.life * cfg.margin / 100 : null
          const ratio = ltv && cac ? ltv/cac : null
          return { key, label: yearLabel(key), fatturato, koongo: sum('koongo'), fatturNC, fatturRC, resi, resiNC, resiRC, ordini, nc, rc, sessioni, metaSpend, googleSpend, totalSpend, aov, aovNC, aovRC, mer, aMer, cac, cpo, retention, cro, ltv, ratio }
        }

        const tableYears = [aggregateYear(y0), aggregateYear(y1)]
        const mostraKoongoY = tableYears.some(y => Number(y.koongo || 0) > 0)
        const cur = tableYears[0]
        const prev = tableYears[1]

        // Ultimi 5 anni per i grafici (solo quelli con dati)
        const chartYearKeys = []
        for (let i = 4; i >= 0; i--) chartYearKeys.push(yearMinus(y0, i))
        const aggregatedYears = chartYearKeys
          .map(k => aggregateYear(k))
          .filter(y => y.fatturato > 0 || y.ordini > 0 || y.totalSpend > 0)
        const yearChartData = aggregatedYears.map(y => ({
          label: y.label, fatturato: y.fatturato, spesa: y.totalSpend,
          nc: y.nc, rc: y.rc, mer: y.mer, aov: y.aov, cro: y.cro, ratio: y.ratio,
        }))

        const qVal = { fontFamily: 'inherit', fontWeight:680, fontSize:15, lineHeight:1.15, color:'var(--text)' }
        const qTH = {
          position:'sticky', top:0, zIndex:20,
          padding:'18px 20px', fontSize:11.5, fontWeight:640,
          textTransform:'uppercase', letterSpacing:'0.10em',
          textAlign:'left', whiteSpace:'nowrap', color:'var(--text2)',
          background:'var(--glass)', backdropFilter:'blur(20px)',
          borderBottom:'1.5px solid var(--border)',
        }
        const qTD = {
          padding:'14px 20px', fontSize:15, fontWeight:500,
          verticalAlign:'top', borderBottom:'1px solid var(--border)', color:'var(--text)',
        }

        const qDelta = (curr, prev, kind='euro0', inverse=false) => {
          if (curr == null || prev == null) return null
          const c = Number(curr), p = Number(prev)
          if (!Number.isFinite(c) || !Number.isFinite(p)) return null
          const diff = c - p
          if (Math.abs(diff) < 0.001) return null
          const pctV = p !== 0 ? diff/p*100 : null
          const isDown = diff < 0
          const isGood = inverse ? isDown : !isDown
          const color = isGood ? 'var(--green)' : 'var(--red)'
          const sign = diff > 0 ? '+' : '−'
          const abs = Math.abs(diff)
          let fmtAbs = '—'
          if (kind === 'euro0') fmtAbs = `€${Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })}`
          else if (kind === 'euro2') fmtAbs = `€${abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}`
          else if (kind === 'int') fmtAbs = Math.round(abs).toLocaleString(localeNumeri(), { useGrouping: 'always' })
          else if (kind === 'percent') fmtAbs = `${abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}%`
          else fmtAbs = abs.toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})
          return (
            <div style={{marginTop:8,color,fontSize:13,lineHeight:1.2,fontWeight:680,whiteSpace:'nowrap'}}>
              <div>{sign}{fmtAbs}</div>
              {pctV != null && <div>{sign}{Math.abs(pctV).toLocaleString(localeNumeri(),{minimumFractionDigits:1,maximumFractionDigits:1})}%</div>}
            </div>
          )
        }
        const YV = ({value, prev, kind='euro0', suffix='', inverse=false}) => {
          let shown = '—'
          if (kind==='euro0') shown = f0(value)
          else if (kind==='euro2') shown = f2(value)
          else if (kind==='int') shown = fn(value)
          else if (kind==='percent1') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:1,maximumFractionDigits:1})}%`:'—'
          else if (kind==='percent2') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}%`:'—'
          else if (kind==='ratio') shown = value!=null?`${Number(value).toLocaleString(localeNumeri(),{minimumFractionDigits:2,maximumFractionDigits:2})}${suffix}`:'—'
          return (<div><div style={qVal}>{shown}</div>{qDelta(value, prev, kind==='percent1'||kind==='percent2'?'percent':kind, inverse)}</div>)
        }

        const Sparkline = ({ dataArr, dataKey, color = '#22c55e', width = 80, height = 30 }) => {
          const vals = dataArr.map(d => Number(d[dataKey] || 0))
          if (vals.length < 2 || vals.every(v => v === 0)) return null
          const max = Math.max(...vals), min = Math.min(...vals)
          const range = max - min || 1
          const points = vals.map((v, i) => {
            const x = (i / (vals.length - 1)) * width
            const y = height - ((v - min) / range) * (height - 4) - 2
            return `${x},${y}`
          }).join(' ')
          return (
            <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{opacity:0.7}}>
              <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )
        }
        const DeltaBadge = ({ curr, prev, isLowerBetter = false }) => {
          if (prev == null || prev === 0 || curr == null) return null
          const pct = ((curr - prev) / prev) * 100
          if (Math.abs(pct) < 0.1) return null
          const up = pct > 0
          const good = isLowerBetter ? !up : up
          return (
            <span style={{
              fontSize: 11.5, fontWeight: 640, padding: '3px 8px', borderRadius: 8,
              background: good ? '#22c55e20' : '#ef444420',
              color: good ? '#22c55e' : '#ef4444',
            }}>
              {up ? '+' : ''}{pct.toFixed(2)}%
            </span>
          )
        }

        const kpiCards = [
          { label:t('dash.revenue', null, 'Fatturato'), val:cur.fatturato, prev:prev.fatturato, fmt:f0, color:'var(--green)', key:'fatturato', sources:['shopify'] },
          ...((cur.koongo > 0 || prev.koongo > 0) ? [
            { label:t('dash.koongoRevenue', null, 'Fatturato Koongo'), val:cur.koongo, prev:prev.koongo, fmt:f0, color:'var(--orange)', key:'koongo', sources:['shopify'] },
            { label:t('dash.revenueTotal', null, 'Fatturato totale'), val:cur.fatturato + cur.koongo, prev:prev.fatturato + prev.koongo, fmt:f0, color:'var(--green)', key:'fatturatoTotale', sources:['shopify'] },
          ] : []),
          { label:t('dash.orders', null, 'Ordini'), val:cur.ordini, prev:prev.ordini, fmt:fn, color:'var(--accent)', key:'ordini', sources:['shopify'] },
          { label:'AOV', val:cur.aov, prev:prev.aov, fmt:f2, color:'var(--orange)', key:'aov', sources:['shopify'] },
          { label:t('dash.newCustomersShort', null, 'Nuovi Clienti'), val:cur.nc, prev:prev.nc, fmt:fn, color:'var(--cyan)', key:'nc', sources:['shopify'] },
          { label:t('dash.returningShort', null, 'Clienti Ritorno'), val:cur.rc, prev:prev.rc, fmt:fn, color:'var(--purple)', key:'rc', sources:['shopify'] },
          { label:'MER', val:cur.mer, prev:prev.mer, fmt:v=>v!=null?`${fr(v)}×`:'—', color:cur.mer!=null?(cur.mer>=3?'var(--green)':cur.mer>=2?'var(--orange)':'var(--red)'):'var(--text3)', key:'mer', sources:['shopify','meta'] },
          { label:'CAC', val:cur.cac, prev:prev.cac, fmt:f2, color:'var(--text)', key:'cac', lower:true, sources:['shopify','meta','google'] },
          { label:t('dash.ratioLtvCacLabel', null, 'Ratio LTV:CAC'), val:cur.ratio, prev:prev.ratio, fmt:v=>v!=null?`${fr(v)}:1`:'—', color:ratioColor(cur.ratio), key:'ratio', sources:['shopify','meta'] },
          { label:t('dash.metaSpendLabel', null, 'Meta Spend'), val:cur.metaSpend, prev:prev.metaSpend, fmt:f0, color:'var(--accent)', key:'metaSpend', sources:['meta'] },
          { label:t('dash.googleSpend', null, 'Google Spend'), val:cur.googleSpend, prev:prev.googleSpend, fmt:v=>v>0?f0(v):'—', color:'var(--yellow)', key:'googleSpend', sources:['google'] },
        ]

        return (
          <>
            {/* Timeframe selector */}
            <div className="rep-toolbar" style={{marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
              <TimeframeSelector
                value={preset?.startsWith('year_') ? preset : `year_${y0}`}
                onChange={setPreset}
                disabled={loading}
                mode="year"
              />
              <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => fetchLive(true)} disabled={loading} gira={loading} />
              <div className="rep-pdf" style={{display:'contents'}}><DownloadReportButton tab={t('tab.year', null, 'Year')} tipo="year" ltv={cfg} preset={preset} /></div>
              <span className="rep-cmp" style={{fontSize:11.5,color:'var(--text3)'}}>{yearLabel(y0)} vs {yearLabel(y1)}</span>
            </div>

            {(() => {
              const oggi = new Date().toISOString().slice(0, 10)
              const ultimo = `${y0}-12-31`
              return <DriveToStoreCard since={`${y0}-01-01`} until={ultimo > oggi ? oggi : ultimo} />
            })()}

            {/* KPI summary cards */}
            <div className="stagger-zoom m-grid2 rep-kpis" style={{display:'grid',gridTemplateColumns:'repeat(auto-fill, minmax(220px, 1fr))',gap:14,marginBottom:20}}>
              {kpiCards.map(kpi => (
                <div key={kpi.label} className="glass-card" style={{padding:'20px 22px'}}>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8,marginBottom:12}}>
                    <div className="label">{kpi.label}</div>
                    <PlatformBadges sources={kpi.sources} size={16} />
                  </div>
                  <div className="rep-kpi-row" style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10}}>
                    <div className="metric-value">{kpi.fmt(kpi.val)}</div>
                    <Sparkline dataArr={aggregatedYears} dataKey={kpi.key} color={kpi.color} />
                  </div>
                  <div style={{marginTop:10}}>
                    <DeltaBadge curr={kpi.val} prev={kpi.prev} isLowerBetter={kpi.lower} />
                  </div>
                </div>
              ))}
            </div>

            {/* Una tabella sola, come il conto economico: prima erano due
                tabelle girate e i due anni stavano su righe lontane. */}
            <FxChartCard title={t('dash.yearData', null, 'Dati annuali')} glowColor="#22c55e" subtitle={t('dash.aggMonthly', null, 'Aggregato da dati mensili')}>
              <MatriceReport t={t} chiaveBase="fatturato" etichettaColonna={t('dash.thItem', null, 'Voce')}
                periodi={tableYears.map((y, i) => ({
                  key: y.key,
                  label: y.label,
                  labelPrec: tableYears[i + 1]?.label || null,
                  valori: y,
                  valoriPrec: tableYears[i + 1] || null,
                  // Niente colonna "anno prima" qui: la colonna accanto E' gia'
                  // l'anno prima, e ripeterla sarebbe lo stesso numero due volte.
                  valoriAnnoPrima: null,
                }))}
                righe={righeReport({ t, mostraKoongo: mostraKoongoY, googleAuto })} />
            </FxChartCard>

            {yearChartData.length > 0 && (
              <>
                <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title={t('dash.chartRevSpendMer', null, 'Fatturato, Spesa e MER')} glowColor="#22c55e">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="yfx-rev" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.5}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="yfx-spend" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity={0}/>
                          </linearGradient>
                          <filter id="yfx-glow-g" x="-50%" y="-50%" width="200%" height="200%">
                            <feGaussianBlur stdDeviation="2.5" result="blur"/>
                            <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
                          </filter>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${Math.round(v/1000)}k`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="fatturato" name="Fatturato" stroke="#22c55e" strokeWidth={2.5} fill="url(#yfx-rev)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationEasing="ease-out" connectNulls style={{filter:'url(#yfx-glow-g)'}} />
                        <Area yAxisId="left" type="monotone" dataKey="spesa" name="Spesa Ads" stroke="#3b82f6" strokeWidth={2.5} fill="url(#yfx-spend)" dot={<FxDot color="#3b82f6" />} activeDot={<FxActiveDot color="#3b82f6" />} animationDuration={1500} animationEasing="ease-out" animationBegin={200} connectNulls />
                        <Line yAxisId="right" type="monotone" dataKey="mer" name="MER" stroke="#f8fafc" strokeWidth={2} strokeDasharray="6 4" dot={<FxDot color="#f8fafc" />} activeDot={<FxActiveDot color="#f8fafc" />} animationDuration={1500} animationBegin={400} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title={t("dash.chartNewReturning", null, "Nuovi clienti e clienti di ritorno")} glowColor="#06b6d4">
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}} barGap={8}>
                        <defs>
                          <linearGradient id="yfx-nc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#0e7490" stopOpacity={0.85}/>
                          </linearGradient>
                          <linearGradient id="yfx-rc" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#c4b5fd" stopOpacity={1}/>
                            <stop offset="100%" stopColor="#6d28d9" stopOpacity={0.85}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <Tooltip content={<ChartTip />} cursor={{fill:'rgba(255,255,255,0.04)'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Bar dataKey="nc" name="Nuovi clienti" fill="url(#yfx-nc)" radius={[8,8,0,0]} animationDuration={1200} animationEasing="ease-out" />
                        <Bar dataKey="rc" name="Clienti ritorno" fill="url(#yfx-rc)" radius={[8,8,0,0]} animationDuration={1200} animationBegin={200} animationEasing="ease-out" />
                      </BarChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>

                <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
                  <FxChartCard title="AOV e CRO" glowColor="#f59e0b">
                    <ResponsiveContainer width="100%" height={240}>
                      <ComposedChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="yfx-aov" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#f59e0b" stopOpacity={0.45}/>
                            <stop offset="100%" stopColor="#f59e0b" stopOpacity={0}/>
                          </linearGradient>
                          <linearGradient id="yfx-cro" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#22c55e" stopOpacity={0.4}/>
                            <stop offset="100%" stopColor="#22c55e" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis yAxisId="left" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} />
                        <YAxis yAxisId="right" orientation="right" tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} tickFormatter={v=>`${v}%`} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Area yAxisId="left" type="monotone" dataKey="aov" name="AOV" stroke="#f59e0b" strokeWidth={2.5} fill="url(#yfx-aov)" dot={<FxDot color="#f59e0b" />} activeDot={<FxActiveDot color="#f59e0b" />} animationDuration={1500} connectNulls />
                        <Area yAxisId="right" type="monotone" dataKey="cro" name="CRO %" stroke="#22c55e" strokeWidth={2.5} fill="url(#yfx-cro)" dot={<FxDot color="#22c55e" />} activeDot={<FxActiveDot color="#22c55e" />} animationDuration={1500} animationBegin={200} connectNulls />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </FxChartCard>

                  <FxChartCard title={t("dash.ratioLtvCacLabel", null, "Ratio LTV:CAC")} glowColor="#a78bfa">
                    <ResponsiveContainer width="100%" height={240}>
                      <AreaChart data={yearChartData} margin={{top:8,right:18,left:0,bottom:4}}>
                        <defs>
                          <linearGradient id="yfx-ratio" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.55}/>
                            <stop offset="50%" stopColor="#6366f1" stopOpacity={0.20}/>
                            <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="2 6" stroke="rgba(255,255,255,0.04)" vertical={false} />
                        <XAxis dataKey="label" tick={{fill:'var(--text3)',fontSize:10,fontWeight:600}} axisLine={false} tickLine={false} />
                        <YAxis tick={{fill:'var(--text3)',fontSize:10}} axisLine={false} tickLine={false} />
                        <ReferenceLine y={3} stroke="#22c55e" strokeDasharray="6 4" strokeOpacity={0.55} label={{value:'Target 3:1',fill:'#22c55e',fontSize:10,fontWeight:600, position:'right'}} />
                        <Tooltip content={<ChartTip />} cursor={{stroke:'rgba(255,255,255,0.1)', strokeWidth:1, strokeDasharray:'3 3'}} />
                        <Legend wrapperStyle={{fontSize:11.5,paddingTop:10}} iconType="circle" />
                        <Area type="monotone" dataKey="ratio" name="Ratio" stroke="#a78bfa" strokeWidth={2.5} fill="url(#yfx-ratio)" dot={<FxDot color="#a78bfa" />} activeDot={<FxActiveDot color="#a78bfa" />} animationDuration={1800} animationEasing="ease-out" connectNulls />
                      </AreaChart>
                    </ResponsiveContainer>
                  </FxChartCard>
                </div>
              </>
            )}

            {/* Floating Year Agent (vertical chat) */}
            <YearAgent years={aggregatedYears} selectedYear={y0} previousYear={y1} preset={preset} />
          </>
        )
      })()}

      {/* SIMULATORE TAB */}
      {tab==='simulator' && <Simulator cfg={cfg} />}
{tab === 'creative' && (
  <CreativeTab />
)}

{/* META DETAIL TAB */}
{tab === 'metaDetail' && (
  <MetaDetailTab />
)}

{tab === 'metaKpi' && (
  <MetaKpiTab live={live} globalPreset={preset} />
)}

{tab === 'metaLeadgen' && (
  <LeadGenTab />
)}

{tab === 'googleKpi' && (
  <GoogleKpiTab />
)}

{tab === 'googleDetail' && (
  <GoogleDetailTab />
)}

{tab === 'googleProducts' && (
  <GoogleProductsTab />
)}

{tab === 'googleVerdicts' && (
  <GoogleVerdictsTab />
)}

{tab === 'corrispettivi' && (
  <CorrispettiviTab />
)}

{tab === 'googleBudgetAdvisor' && (
  <GoogleBudgetAdvisorPanel />
)}

{tab === 'incrContribution' && (
  <IncrContributionTab />
)}

{tab === 'incrCurves' && (
  <IncrCurvesTab />
)}

{tab === 'incrSimulator' && (
  <IncrSimulatorTab />
)}

{tab === 'geolift' && (
  <GeoLiftTab />
)}

{tab === 'scheduledReports' && (
  <ScheduledReportsTab />
)}

{tab === 'creativeFatigue' && (
  <CreativeFatiguePanel />
)}

{tab === 'budgetAdvisor' && (
  <BudgetAdvisorPanel />
)}

{tab === 'attribution' && (
  <>
    <DriveToStoreCard preset={preset} />
    <AttributionPanel preset={preset} reloadKey={updated} live={live} />
  </>
)}

{tab === 'ltvCohorts' && (
  <LtvCohortsTab />
)}

{/* KLAVIYO TAB */}
{tab === 'klaviyo' && (
  <EmailMarketingTab />
)}

{tab === 'inventory' && (
  <InventoryTab />
)}

{tab === 'productPerformance' && (
  <ProductPerformanceTab />
)}

{tab === 'productCosts' && (
  <ProductCostsTab />
)}

{/* Prezzi: esiste solo per chi vende marchi di altri. La route risponde "non attiva" a un
    monomarca, e la voce sparisce dal menu; qui si monta comunque, cosi' chi ci arriva da un
    collegamento diretto vede la spiegazione invece di una pagina bianca. */}
{tab === 'prezzi' && (
  <PrezziTab />
)}

{tab === 'clienti' && (
  <ClientiTab onNavigate={setTab} />
)}

{tab === 'helpCenter' && (
  <HelpCenterTab onNavigate={setTab} />
)}

{/* INTEGRATIONS TAB */}
{tab === 'integrations' && (
  <IntegrationsTab />
)}

{/* BRAND IDENTITY TAB */}
{tab === 'brandIdentity' && (
  <BrandIdentityPanel />
)}

{/* SETTINGS TAB */}
{tab === 'settings' && (
  <SettingsTab />
)}

{/* CRO TAB */}
{tab === 'cro' && (
  <CROTab data={data} live={live} onRefresh={() => fetchLive(true)} loading={loading} />
)}

{/* AI WEBSITE SCANNER TAB */}
{tab === 'webScanner' && (
  <WebsiteScannerTab />
)}

{tab === 'seoAudit' && (
  <SeoAuditTab />
)}

{tab === 'pnl' && (
  <PnLTab data={data} />
)}

{/* ONBOARDING */}
{tab === 'onboarding' && (
  <OnboardingTab />
)}

{/* TEAM · PROGETTI & TASK */}
{tab === 'tasks' && (
  <TasksTab />
)}

{tab === 'calendar' && (
  <CalendarTab />
)}

{tab === 'timeOff' && (
  <TimeOffTab />
)}

{tab === 'creativeLibrary' && (
  <CreativeLibraryTab />
)}

{tab === 'teamManage' && (
  <TeamManageTab />
)}

{/* TEAM · LYFTIMER (time tracking) */}
{tab === 'timeTracking' && (
  <TimeTrackingTab />
)}

{/* TEAM · CHAT */}
{tab === 'chat' && (
  <ChatTab />
)}

{tab === 'team' && (
  <TeamTab />
)}

      <FloatingBrain currentTab={tab} />
      <ReportFilm />
      </AppShell>
    )
  }
