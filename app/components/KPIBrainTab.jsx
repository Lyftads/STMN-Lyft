'use client'

import AzioneBarra from './ui/AzioneBarra'
import Pannello from './ui/Pannello'
import { Kpi, famigliaDi, coloreFamiglia } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useState, useMemo, useEffect } from 'react'
import { PieChart, Pie, Cell, AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import Sparkline from './Sparkline'
import Icon from './ui/Icon'
import PlatformIcon from './PlatformIcon'
import KpiBrainAgent from './KpiBrainAgent'
import PeriodoInBarra from './ui/PeriodoInBarra'
import { globalPresetToTf, tfToGlobalPreset } from '../../lib/tfQuery'
import DownloadReportButton from './DownloadReportButton'
import MetaSegmentsPanel from './MetaSegmentsPanel'
import GoogleSegmentsPanel from './GoogleSegmentsPanel'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { num } from '../../lib/client/numeri'

export default function KPIBrainTab({ data, dataYear, live, cfg, S, shopifyWeeklyAll = [], metaWeeklyAll = [], googleDailyAll = [], onRefresh, loading, preset = 'today', setPreset }) {
  const { t } = useI18n()

  const asNum = v => { const n = Number(v); return Number.isFinite(n) ? n : 0 }
  const safeDiv = (a, b) => b > 0 ? a / b : null

  const { current: c, previous: p, label: tfLabel, currentMonths } = useMemo(() => {
    // Compute from live API ranges (works for any preset: today/yesterday/7d/month_X)
    const sr = live?.shopifyRange
    const mr = live?.metaRange
    const spr = live?.shopifyPrevRange
    const mpr = live?.metaPrevRange

    const compute = (s, m, g = {}) => {
      const fat = asNum(s?.revenue), ord = asNum(s?.orders)
      const nc = asNum(s?.nc), rc = asNum(s?.rc)
      const ses = asNum(s?.sessions)
      const meta = asNum(m?.spend), goog = asNum(g.spend)
      const spend = meta + goog
      const impr = asNum(m?.impressions), clicks = asNum(m?.clicks)
      // Acquisti Meta (count) + valore acquisti Meta → ROAS EFFETTIVO della piattaforma
      // (valore acquisti Meta / spesa Meta), non il fatturato Shopify totale.
      const mPurch = asNum(m?.purchases), mPurchVal = asNum(m?.purchaseValue)
      const aov = safeDiv(fat, ord), roas = safeDiv(mPurchVal, meta), mer = safeDiv(fat, spend)
      const cac = safeDiv(spend, nc), ctr = impr > 0 ? (clicks/impr)*100 : null
      const cpc = safeDiv(meta, clicks), cpm = impr > 0 ? (meta/impr)*1000 : null
      const repeatRate = nc + rc > 0 ? (rc/(nc+rc))*100 : null
      const ltv = aov ? (aov*cfg.freq*cfg.life*cfg.margin)/100 : null
      // Google Ads (dettaglio dal collegamento: impression/click/conversioni/valore)
      const gImpr = asNum(g.impressions), gClicks = asNum(g.clicks)
      const gConv = asNum(g.conversions), gConvVal = asNum(g.convValue)
      const gRoas = safeDiv(gConvVal, goog)       // ROAS Google = valore conversioni / spesa
      const gCtr = gImpr > 0 ? (gClicks/gImpr)*100 : null
      const gCpc = safeDiv(goog, gClicks)
      const gCpm = gImpr > 0 ? (goog/gImpr)*1000 : null
      // CAC per canale paid = spesa del canale / acquisizioni del canale
      // (Meta: acquisti; Google: conversioni). È il costo per acquisizione del canale.
      const cacMeta = safeDiv(meta, mPurch), cacGoogle = safeDiv(goog, gConv)
      return { fat,ord,nc,rc,ses,meta,goog,spend,impr,clicks,aov,roas,mer,cac,ctr,cpc,cpm,repeatRate,ltv,
               mPurch,mPurchVal,cacMeta,cacGoogle,
               gImpr,gClicks,gConv,gConvVal,gRoas,gCtr,gCpc,gCpm }
    }

    const range = live?.kpiBrain?.range
    const prevRange = live?.kpiBrain?.previousRange
    const label = range?.since && range?.until
      ? `${range.since} → ${range.until}${prevRange?.since ? ` vs ${prevRange.since} → ${prevRange.until}` : ''}`
      : '—'

    // For month_YYYY-MM, also collect matching monthly rows (used for sparkline trend)
    const sinceM = range?.since?.slice(0, 7)
    const untilM = range?.until?.slice(0, 7)
    const cur = (sinceM && untilM)
      ? data.filter(m => m.month >= sinceM && m.month <= untilM)
      : []

    // Google Ads spend per il periodo: somma googleSpend dei mesi del range
    // (il dato arriva automatico dal collegamento, iniettato nelle righe `data`
    // in page.js; coerente con come la Dashboard tratta Google).
    const prevSinceM = prevRange?.since?.slice(0, 7)
    const prevUntilM = prevRange?.until?.slice(0, 7)
    const prevMonths = (prevSinceM && prevUntilM)
      ? data.filter(m => m.month >= prevSinceM && m.month <= prevUntilM)
      : []

    // Dettaglio Google del periodo. Preferiamo il GIORNALIERO (/api/google `daily`,
    // con impression/click/conv/valore per giorno): è period-accurate per QUALSIASI
    // preset (oggi/ieri/7gg/mese). Fallback alla somma MENSILE solo se il range cade
    // fuori dalla finestra daily (~100 giorni), es. mesi vecchi.
    const sumGMonthly = rows => rows.reduce((a, m) => ({
      spend:       a.spend       + asNum(m.googleSpend),
      impressions: a.impressions + asNum(m.googleImpressions),
      clicks:      a.clicks      + asNum(m.googleClicks),
      conversions: a.conversions + asNum(m.googleConversions),
      convValue:   a.convValue   + asNum(m.googleConvValue),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 })
    const dailyInRange = (since, until) => (Array.isArray(googleDailyAll) ? googleDailyAll : [])
      .filter(d => d?.date && since && until && d.date >= since && d.date <= until)
    const sumGDaily = rows => rows.reduce((a, d) => ({
      spend:       a.spend       + asNum(d.spend),
      impressions: a.impressions + asNum(d.impressions),
      clicks:      a.clicks      + asNum(d.clicks),
      conversions: a.conversions + asNum(d.conversions),
      convValue:   a.convValue   + asNum(d.convValue),
    }), { spend: 0, impressions: 0, clicks: 0, conversions: 0, convValue: 0 })
    const curDaily = dailyInRange(range?.since, range?.until)
    const prevDaily = dailyInRange(prevRange?.since, prevRange?.until)
    const gCur = curDaily.length ? sumGDaily(curDaily) : sumGMonthly(cur)
    const gPrev = prevDaily.length ? sumGDaily(prevDaily) : sumGMonthly(prevMonths)

    return { current: compute(sr, mr, gCur), previous: compute(spr, mpr, gPrev), label, currentMonths: cur }
  }, [data, live, cfg, googleDailyAll])

  const availableMonths = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)

  const money = n => soldi(n, 0, { zeroVuoto: true })
  const money2 = n => n > 0 ? `€${n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}` : '—'
  const int0 = n => n > 0 ? Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' }) : '—'
  const pct = n => n != null ? `${n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}%` : '—'
  const ratio = n => n != null ? `${n.toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}x` : '—'
  const shortMoney = n => { const v=Number(n||0); if(v>=1e6)return`€${num(v/1e6,1)}M`; if(v>=1e3)return`€${num(v/1e3,1)}K`; return money(v) }
  const shortNum = n => { const v=Number(n||0); if(v>=1e6)return`${num(v/1e6,2)}M`; if(v>=1e3)return`${num(v/1e3,1)}K`; return int0(v) }

  const DeltaBadge = ({ curr, prev, isLower = false }) => {
    if (prev == null || prev === 0 || curr == null) return null
    const d = ((curr - prev) / prev) * 100
    if (Math.abs(d) < 0.1) return null
    const up = d > 0, good = isLower ? !up : up
    return <span style={{fontSize:11.5,fontWeight:640,padding:'3px 8px',borderRadius:8,background:good?'#22c55e20':'#ef444420',color:good?'#22c55e':'#ef4444'}}>{up?'+':''}{num(d,1)}%</span>
  }

  // Sparkline data from full data array (all months for trend)
  const sparkData = data.filter(m => m.fatturato > 0 || m.totalSpend > 0)
  const sparkFor = key => sparkData.map(m => {
    if (key === 'aov') return m.ordini > 0 ? m.fatturato / m.ordini : 0
    if (key === 'repeatRate') return m.nc + m.rc > 0 ? (m.rc / (m.nc + m.rc)) * 100 : 0
    if (key === 'ltv') { const aov = m.ordini > 0 ? m.fatturato / m.ordini : 0; return aov > 0 ? (aov * cfg.freq * cfg.life * cfg.margin) / 100 : 0 }
    if (key === 'roas') return m.metaSpend > 0 ? m.fatturato / m.metaSpend : 0
    if (key === 'mer') return m.totalSpend > 0 ? m.fatturato / m.totalSpend : 0
    if (key === 'ctr') return m.impressions > 0 ? (m.linkClicks / m.impressions) * 100 : 0
    if (key === 'cpc') return m.linkClicks > 0 ? m.metaSpend / m.linkClicks : 0
    if (key === 'cpm') return m.impressions > 0 ? (m.metaSpend / m.impressions) * 1000 : 0
    if (key === 'gRoas') return m.googleSpend > 0 ? (m.googleConvValue || 0) / m.googleSpend : 0
    if (key === 'gCtr') return m.googleImpressions > 0 ? (m.googleClicks / m.googleImpressions) * 100 : 0
    if (key === 'gCpc') return m.googleClicks > 0 ? m.googleSpend / m.googleClicks : 0
    if (key === 'gCpm') return m.googleImpressions > 0 ? (m.googleSpend / m.googleImpressions) * 1000 : 0
    return m[key] || 0
  })

  const metrics = [
    { group:'Shopify', title:t('kpi.revenue', null, 'Fatturato'), value:shortMoney(c.fat), color:'#22c55e', sparkKey:'fatturato', curr:c.fat, prev:p.fat },
    { group:'Shopify', title:t('kpi.orders', null, 'Ordini'), value:int0(c.ord), color:'#22c55e', sparkKey:'ordini', curr:c.ord, prev:p.ord },
    { group:'Shopify', title:'AOV', value:money2(c.aov), color:'#f59e0b', sparkKey:'aov', curr:c.aov, prev:p.aov },
    { group:'Shopify', title:t('kpi.newCustomers', null, 'Nuovi Clienti'), value:int0(c.nc), color:'#06b6d4', sparkKey:'nc', curr:c.nc, prev:p.nc },
    { group:'Shopify', title:t('kpi.returningCustomers', null, 'Clienti Ritorno'), value:int0(c.rc), color:'#a78bfa', sparkKey:'rc', curr:c.rc, prev:p.rc },
    { group:'Shopify', title:'Repeat Rate', value:pct(c.repeatRate), color:'#0ea5e9', sparkKey:'repeatRate', curr:c.repeatRate, prev:p.repeatRate },
    { group:'Shopify', title:'LTV', value:money2(c.ltv), color:'#0ea5e9', sparkKey:'ltv' },
    { group:'Meta Ads', title:'Spend', value:shortMoney(c.meta), color:'#3b82f6', sparkKey:'metaSpend', curr:c.meta, prev:p.meta },
    { group:'Meta Ads', title:'ROAS', value:ratio(c.roas), color:'#22c55e', sparkKey:'roas', curr:c.roas, prev:p.roas },
    { group:'Meta Ads', title:'MER', value:ratio(c.mer), color:'#a855f7', sparkKey:'mer', curr:c.mer, prev:p.mer },
    { group:'Meta Ads', title:'CTR', value:pct(c.ctr), color:'#3b82f6', sparkKey:'ctr', curr:c.ctr, prev:p.ctr },
    { group:'Meta Ads', title:'CPC', value:money2(c.cpc), color:'#ef4444', sparkKey:'cpc', curr:c.cpc, prev:p.cpc, lower:true },
    { group:'Meta Ads', title:'CPM', value:money2(c.cpm), color:'#f59e0b', sparkKey:'cpm', curr:c.cpm, prev:p.cpm, lower:true },
    { group:'Meta Ads', title:'Impressions', value:shortNum(c.impr), color:'#3b82f6', sparkKey:'impressions', curr:c.impr, prev:p.impr },
    { group:'Meta Ads', title:'Clicks', value:shortNum(c.clicks), color:'#3b82f6', sparkKey:'linkClicks', curr:c.clicks, prev:p.clicks },
    { group:'Meta Ads', title:'Acquisti', value:shortNum(c.mPurch), color:'#22c55e', sparkKey:'metaPurchases', curr:c.mPurch, prev:p.mPurch },
    { group:'Meta Ads', title:'CAC', value:money2(c.cacMeta), color:'#ef4444', sparkKey:'cacMeta', curr:c.cacMeta, prev:p.cacMeta, lower:true },
    { group:'Google Ads', title:'Spend', value:shortMoney(c.goog), color:'#eab308', sparkKey:'googleSpend', curr:c.goog, prev:p.goog },
    { group:'Google Ads', title:'ROAS', value:ratio(c.gRoas), color:'#22c55e', sparkKey:'gRoas', curr:c.gRoas, prev:p.gRoas },
    { group:'Google Ads', title:'MER', value:ratio(c.mer), color:'#a855f7', sparkKey:'mer', curr:c.mer, prev:p.mer },
    { group:'Google Ads', title:'CTR', value:pct(c.gCtr), color:'#eab308', sparkKey:'gCtr', curr:c.gCtr, prev:p.gCtr },
    { group:'Google Ads', title:'CPC', value:money2(c.gCpc), color:'#ef4444', sparkKey:'gCpc', curr:c.gCpc, prev:p.gCpc, lower:true },
    { group:'Google Ads', title:'CPM', value:money2(c.gCpm), color:'#f59e0b', sparkKey:'gCpm', curr:c.gCpm, prev:p.gCpm, lower:true },
    { group:'Google Ads', title:'Impressions', value:shortNum(c.gImpr), color:'#eab308', sparkKey:'googleImpressions', curr:c.gImpr, prev:p.gImpr },
    { group:'Google Ads', title:'Clicks', value:shortNum(c.gClicks), color:'#eab308', sparkKey:'googleClicks', curr:c.gClicks, prev:p.gClicks },
    { group:'Google Ads', title:'Conversioni', value:shortNum(c.gConv), color:'#22c55e', sparkKey:'googleConversions', curr:c.gConv, prev:p.gConv },
    { group:'Google Ads', title:'CAC', value:money2(c.cacGoogle), color:'#ef4444', sparkKey:'cacGoogle', curr:c.cacGoogle, prev:p.cacGoogle, lower:true },
  ]

  // ── Che negozio e' questo cliente: vende marchi di ALTRI? ─────────────────
  //  «Brand piu' venduti» e «Prezzo pieno vs saldo» dicono qualcosa solo a chi
  //  rivende marchi altrui: a un monomarca disegnerebbero una barra sola al
  //  100%, che e' peggio del pannello assente. La risposta sta sul cliente
  //  (companies.multimarca, vedi lib/team/tipoNegozio.js) e viaggia insieme
  //  allo stato delle integrazioni.
  //  null = non si sa ancora, o la chiamata e' fallita: nel dubbio non si
  //  chiama Shopify e non si disegna niente — lo stesso ripiego "spento" che
  //  usano le route. Nessuno si vede comparire una funzione che non lo riguarda.
  const [multimarca, setMultimarca] = useState(null)
  useEffect(() => {
    let vivo = true
    // no-store come in page.js: e' un dato del TENANT e non deve sopravvivere
    // a un cambio di workspace dell'agenzia.
    fetch('/api/integrations/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(s => { if (vivo) setMultimarca(s?.tipoNegozio?.multimarca === true) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  // ── Top products: match images from store products.json ──
  const [productImages, setProductImages] = useState({})
  useEffect(() => {
    leggi('/api/product-images').then(imgs => {
      if (imgs && typeof imgs === 'object') setProductImages(imgs)
    }).catch(() => {})
  }, [])

  // ── Paesi di fatturazione (con delta vs periodo precedente) ──
  const kpiRange = live?.kpiBrain?.range
  const kpiPrevRange = live?.kpiBrain?.previousRange
  const [countries, setCountries] = useState(() => { const m = kpiRange?.since && kpiRange?.until ? inMemoria(`/api/shopify-countries?since=${kpiRange.since}&until=${kpiRange.until}`) : null; return Array.isArray(m?.countries) ? m.countries : [] })
  const [countriesPrev, setCountriesPrev] = useState([])
  const [countriesLoading, setCountriesLoading] = useState(false)
  const [countriesError, setCountriesError] = useState(null)
  const [selectedCountry, setSelectedCountry] = useState(null)
  useEffect(() => {
    const since = kpiRange?.since
    const until = kpiRange?.until
    if (!since || !until) return
    let cancelled = false
    setCountriesLoading(!inMemoria(`/api/shopify-countries?since=${since}&until=${until}`))
    setCountriesError(null)

    // Fetch current period (sempre) + previous period (solo se range esiste)
    const fetchCurrent = leggi(`/api/shopify-countries?since=${since}&until=${until}`)
    const fetchPrev = kpiPrevRange?.since && kpiPrevRange?.until
      ? leggi(`/api/shopify-countries?since=${kpiPrevRange.since}&until=${kpiPrevRange.until}`)
      : Promise.resolve({ countries: [] })

    Promise.all([fetchCurrent, fetchPrev])
      .then(([curr, prev]) => {
        if (cancelled) return
        if (curr?.error) { setCountriesError(curr.error); setCountries([]); setCountriesPrev([]); return }
        setCountries(Array.isArray(curr?.countries) ? curr.countries : [])
        setCountriesPrev(Array.isArray(prev?.countries) ? prev.countries : [])
      })
      .catch(e => { if (!cancelled) setCountriesError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setCountriesLoading(false) })
    return () => { cancelled = true }
  }, [kpiRange?.since, kpiRange?.until, kpiPrevRange?.since, kpiPrevRange?.until])

  // ── Fasce orarie migliori per giorno (segue il timeframe del KPI Brain) ──
  const [hourly, setHourly] = useState(() => (kpiRange?.since && kpiRange?.until ? inMemoria(`/api/hourly-sales?since=${kpiRange.since}&until=${kpiRange.until}`) : null))
  const [hourlyLoading, setHourlyLoading] = useState(false)
  const [hourlyError, setHourlyError] = useState(null)
  const [hourlyMetric, setHourlyMetric] = useState('orders')
  useEffect(() => {
    const since = kpiRange?.since
    const until = kpiRange?.until
    if (!since || !until) return
    let cancelled = false
    setHourlyLoading(!inMemoria(`/api/hourly-sales?since=${since}&until=${until}`))
    setHourlyError(null)
    leggi(`/api/hourly-sales?since=${since}&until=${until}`)
      .then(j => {
        if (cancelled) return
        if (!j || j.ok === false) { setHourlyError(j?.error || 'Shopify'); setHourly(null); return }
        setHourly(j)
      })
      .catch(e => { if (!cancelled) setHourlyError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setHourlyLoading(false) })
    return () => { cancelled = true }
  }, [kpiRange?.since, kpiRange?.until])

  // ── Brand e categorie più venduti (segue il timeframe del KPI Brain) ──
  //  Solo per i multimarca: vedi sopra. La chiamata NON parte per gli altri.
  const [brandSales, setBrandSales] = useState(null)
  const [brandLoading, setBrandLoading] = useState(false)
  const [brandError, setBrandError] = useState(null)
  const [brandOpen, setBrandOpen] = useState(null)
  const [saleOpen, setSaleOpen] = useState(null)
  useEffect(() => {
    const since = kpiRange?.since
    const until = kpiRange?.until
    if (!since || !until || multimarca !== true) return
    let cancelled = false
    // Se la risposta di questo periodo e' gia' in memoria si mostra subito.
    const gia = inMemoria(`/api/brand-sales?since=${since}&until=${until}`)
    if (gia) setBrandSales(gia)
    setBrandLoading(!gia)
    setBrandError(null)
    leggi(`/api/brand-sales?since=${since}&until=${until}`)
      .then(j => {
        if (cancelled) return
        // Un errore di Shopify si dice: una lista vuota sembrerebbe "nessuna vendita".
        if (!j || j.ok === false) { setBrandError(j?.error || 'Shopify'); setBrandSales(null); return }
        setBrandSales(j)
      })
      .catch(e => { if (!cancelled) setBrandError(e?.message || 'Errore di rete') })
      .finally(() => { if (!cancelled) setBrandLoading(false) })
    return () => { cancelled = true }
  }, [kpiRange?.since, kpiRange?.until, multimarca])

  // ── Dove comprano: province e comuni, dai dettagli degli ordini ───────
  const [province, setProvince] = useState(() => (kpiRange?.since && kpiRange?.until ? inMemoria(`/api/kpi-province?since=${kpiRange.since}&until=${kpiRange.until}`) : null))
  const [provLoading, setProvLoading] = useState(false)
  const [provError, setProvError] = useState(null)
  const [provOpen, setProvOpen] = useState(null)
  const [provOrdine, setProvOrdine] = useState({ campo: 'fatturato', giu: true })
  useEffect(() => {
    const since = kpiRange?.since, until = kpiRange?.until
    if (!since || !until) return
    let annullato = false, timer = null
    setProvLoading(!inMemoria(`/api/kpi-province?since=${since}&until=${until}`))
    setProvError(null)
    leggi(`/api/kpi-province?since=${since}&until=${until}`)
      .then(j => {
        if (annullato) return
        // Un errore si dice: una tabella vuota sembrerebbe "nessun ordine".
        if (!j || j.ok === false) { setProvError(j?.error || 'Shopify'); setProvince(null); return }
        setProvince(j)
        // Un pezzo e' "in ritardo" (Shopify o Meta hanno detto "riprova"): si riprova da soli,
        // fino a tre volte, senza chiedere niente a chi guarda.
        let giri = 0
        const riprova = () => {
          if (annullato || giri++ >= 3) return
          leggi(`/api/kpi-province?since=${since}&until=${until}`, { forza: true })
            .then(n => { if (annullato || !n || n.ok === false) return; setProvince(n); if (n.inRitardo?.length) timer = setTimeout(riprova, 30000) })
            .catch(() => {})
        }
        if (j.inRitardo?.length) timer = setTimeout(riprova, 30000)
      })
      .catch(e => { if (!annullato) setProvError(e?.message || 'Errore di rete') })
      .finally(() => { if (!annullato) setProvLoading(false) })
    return () => { annullato = true; clearTimeout(timer) }
  }, [kpiRange?.since, kpiRange?.until])

  const COLONNE_PROV = [
    { id: 'provincia', label: t('kpi.provCol', null, 'Provincia'), testo: true },
    { id: 'ordini', label: t('kpi.provOrders', null, 'Ordini') },
    { id: 'fatturato', label: t('kpi.provRevenue', null, 'Fatturato'), soldi: true },
    { id: 'aov', label: 'AOV', soldi: true },
    { id: 'nuovi', label: t('kpi.provNew', null, 'Nuovi') },
    { id: 'ritorno', label: t('kpi.provReturning', null, 'Di ritorno') },
    { id: 'sessioni', label: t('kpi.provSessions', null, 'Sessioni') },
    { id: 'cro', label: t('kpi.provCro', null, 'Conversione'), pct: true },
  ]
  // Le regioni: e' li' che esiste la spesa pubblicitaria, quindi e' li' che
  // si decide il budget. Si apre su questa vista.
  const [provVista, setProvVista] = useState('regioni')
  const [regOrdine, setRegOrdine] = useState({ campo: 'spesa', giu: true })
  const COLONNE_REG = [
    { id: 'regione', label: t('kpi.regCol', null, 'Regione') },
    { id: 'ordini', label: t('kpi.provOrders', null, 'Ordini') },
    { id: 'fatturato', label: t('kpi.provRevenue', null, 'Fatturato') },
    { id: 'sessioni', label: t('kpi.provSessions', null, 'Sessioni') },
    { id: 'cro', label: t('kpi.provCro', null, 'Conversione') },
    { id: 'spesaMeta', label: t('kpi.regMeta', null, 'Spesa Meta') },
    { id: 'spesaGoogle', label: t('kpi.regGoogle', null, 'Spesa Google') },
    { id: 'spesa', label: t('kpi.regSpend', null, 'Spesa totale') },
    { id: 'mer', label: 'MER' },
    { id: 'cpo', label: t('kpi.regCpo', null, 'Costo per ordine') },
  ]
  const regioniOrdinate = useMemo(() => {
    const righe = [...(province?.regioni || [])]
    const { campo, giu } = regOrdine
    righe.sort((a, b) => {
      const va = a[campo], vb = b[campo]
      if (typeof va === 'string' || typeof vb === 'string') {
        return giu ? String(vb || '').localeCompare(String(va || '')) : String(va || '').localeCompare(String(vb || ''))
      }
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return giu ? vb - va : va - vb
    })
    return righe
  }, [province, regOrdine])
  // Conversione complessiva delle regioni: il metro con cui si legge ogni riga.
  const croMedio = useMemo(() => {
    const r = province?.regioni || []
    const o = r.reduce((a, x) => a + (x.sessioni > 0 ? x.ordini : 0), 0), se = r.reduce((a, x) => a + (x.sessioni || 0), 0)
    return se > 0 ? Math.round((o / se) * 10000) / 100 : null
  }, [province])

  const provinceOrdinate = useMemo(() => {
    const righe = [...(province?.province || [])]
    const { campo, giu } = provOrdine
    righe.sort((a, b) => {
      const va = a[campo], vb = b[campo]
      if (typeof va === 'string' || typeof vb === 'string') {
        return giu ? String(vb || '').localeCompare(String(va || '')) : String(va || '').localeCompare(String(vb || ''))
      }
      // I vuoti stanno sempre in fondo: non sono zeri.
      if (va == null && vb == null) return 0
      if (va == null) return 1
      if (vb == null) return -1
      return giu ? vb - va : va - vb
    })
    return righe
  }, [province, provOrdine])

  // Indice del periodo precedente per delta lookup
  const prevByKey = useMemo(() => {
    const m = new Map()
    for (const r of countriesPrev) {
      const key = r.country_code || r.country
      m.set(key, {
        revenue: r.revenue || 0,
        orders: r.orders || 0,
        ncOrders: r.ncOrders || 0,
        rcOrders: r.rcOrders || 0,
        ncRevenue: r.ncRevenue || 0,
        rcRevenue: r.rcRevenue || 0,
      })
    }
    return m
  }, [countriesPrev])

  // Format helpers per i delta NC/RC
  const fmtDeltaPct = (curr, prev) => {
    if (prev === 0) return curr > 0 ? 'NEW' : null
    const d = ((curr - prev) / prev) * 100
    return `${d >= 0 ? '+' : ''}${num(d, 1)}%`
  }
  const fmtDeltaEur = (curr, prev) => {
    const d = curr - prev
    if (d === 0) return '€0'
    const sign = d > 0 ? '+' : '-'
    return `${sign}€${Math.round(Math.abs(d)).toLocaleString('it-IT', { useGrouping: 'always' })}`
  }
  const deltaColor = (curr, prev) => {
    if (prev === 0 && curr > 0) return '#a5b4fc' // NEW
    if (curr > prev) return '#86efac'
    if (curr < prev) return '#fca5a5'
    return 'var(--text3)'
  }

  const countryFlag = code => {
    if (!code || code.length !== 2) return '🌐'
    // Converti country code in flag emoji via regional indicator symbols
    const A = 0x1F1E6
    return String.fromCodePoint(...code.toUpperCase().split('').map(c => A + c.charCodeAt(0) - 65))
  }
  const countriesTotal = countries.reduce((s, r) => s + (r.revenue || 0), 0)

  const findImage = (name) => {
    if (!name) return null
    return productImages[name] || productImages[name.toLowerCase()] ||
      productImages[name.replace(/["'"]/g,'').trim()] ||
      productImages[name.replace(/["'"]/g,'').trim().toLowerCase()] ||
      // Partial match: find a key that contains the product name
      Object.entries(productImages).find(([k]) => k.toLowerCase().includes(name.toLowerCase().slice(0,20)))?.[1] ||
      null
  }

  const topProducts = (live?.shopifyTopProducts || []).map(r => {
    const label = r.label || r.name || r.title || r.product_title || '—'
    return {
      label,
      value: asNum(r.value ?? r.revenue ?? r.total_sales),
      orders: asNum(r.orders),
      image: r.image || r.imageUrl || findImage(label),
    }
  }).filter(r => r.value > 0)

  // ── Day breakdown ──
  const dayNameIT = d => {
    const map = { sun:'Domenica',sunday:'Domenica',mon:'Lunedì',monday:'Lunedì',tue:'Martedì',tuesday:'Martedì',wed:'Mercoledì',wednesday:'Mercoledì',thu:'Giovedì',thursday:'Giovedì',fri:'Venerdì',friday:'Venerdì',sat:'Sabato',saturday:'Sabato',
      domenica:'Domenica',lunedi:'Lunedì',lunedì:'Lunedì',martedi:'Martedì',martedì:'Martedì',mercoledi:'Mercoledì',mercoledì:'Mercoledì',giovedi:'Giovedì',giovedì:'Giovedì',venerdi:'Venerdì',venerdì:'Venerdì',sabato:'Sabato' }
    return map[String(d||'').toLowerCase()] || d
  }
  const dayBreakdown = (live?.shopifyDayBreakdown || []).map(r => ({
    label: dayNameIT(r.day || r.label),
    value: asNum(r.value ?? r.revenue ?? r.sales),
    orders: asNum(r.orders),
  })).filter(r => r.value > 0 || r.orders > 0)

  const marketingSources = [
    { label: 'Meta Ads', value: c.meta },
    { label: 'Google Ads', value: c.goog },
  ].filter(r => r.value > 0)

  const customerBreakdown = [
    { label: 'Nuovi Clienti', value: c.nc },
    { label: 'Clienti di Ritorno', value: c.rc },
  ].filter(r => r.value > 0)

  const card = { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:16, padding:20 }
  const panel = { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:16, padding:22 }
  // Uno zero e' un fatto — "nessun cliente di ritorno" e' un'informazione, un
  // trattino sembra un dato che manca. Il trattino resta per cio' che davvero
  // non e' misurabile (null).
  const conta0 = n => n == null ? '—' : Math.round(n).toLocaleString('it-IT', { useGrouping: 'always' })
  const comuniLabel = (n) => n === 1
    ? t('kpi.provTownOne', null, '1 comune')
    : t('kpi.provTownsInline', { n }, `${n} comuni`)

  // I pannelli dei marchi esistono solo per chi rivende marchi altrui.
  const mostraBrand = multimarca === true
  // «Dove comprano» si disegna solo se ha qualcosa da dire: senza ordini
  // italiani resterebbe un'intestazione con sotto il vuoto.
  const mostraDove = provLoading || !!provError
    || (province?.regioni?.length > 0) || (province?.province?.length > 0)

  const groupSources = (g) => {
    if (g === 'Shopify') return ['shopify']
    if (g === 'Meta Ads') return ['meta']
    if (g === 'Google Ads') return ['google']
    if (g === 'Klaviyo') return ['klaviyo']
    return []
  }

  // Stessa scheda KPI di tutto il prodotto: il colore e' quello della famiglia
  // del numero, non uno scelto a mano (gli sparkline erano tutti rossi anche
  // quando il numero saliva).
  const famigliaMetrica = (item) => famigliaDi(item.sparkKey)
    || (/roas|mer|repeat|ltv|ratio/i.test(item.title) ? 'resa' : /ctr|cpm|clic|impression|session|cro/i.test(item.title) ? 'traffico' : item.group === 'Shopify' ? 'vendite' : 'pub')
  const MetricCard = ({ item }) => {
    const fam = famigliaMetrica(item)
    return (
      <Kpi etichetta={item.title} valore={item.value} famiglia={fam} fonti={groupSources(item.group)}
        grafico={item.sparkKey ? <Sparkline data={sparkFor(item.sparkKey)} color={coloreFamiglia(fam)} width={80} height={32} /> : null}>
        <DeltaBadge curr={item.curr} prev={item.prev} isLower={item.lower} />
      </Kpi>
    )
  }

  const ProgressBar = ({ rows, color, format = money }) => {
    const max = Math.max(...rows.map(r => Number(r.value || 0)), 1)
    return rows.length > 0 ? rows.map(row => (
      <div key={row.label}>
        <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:7,fontSize:13}}>
          <span style={{color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.label}</span>
          <span style={{color:'var(--text2)',fontWeight:640}}>{format(row.value)}</span>
        </div>
        <div style={{height:8,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
          <div style={{width:`${Math.max(4,(row.value/max)*100)}%`,height:'100%',background:color,borderRadius:999}} />
        </div>
      </div>
    )) : <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.noData', null, 'Nessun dato.')}</div>
  }

  return (
    <div>
      {/* Timeframe */}
      <div className="barra-strumenti" style={{marginBottom:16, display:'flex', alignItems:'center', gap:12, flexWrap:'wrap'}}>
        {setPreset && <div style={{ marginLeft: 'auto' }}><PeriodoInBarra value={globalPresetToTf(preset)} onChange={(v) => setPreset(tfToGlobalPreset(v))} accent="#2997ff" disabled={loading} /></div>}
        {onRefresh && (
          <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={onRefresh} disabled={loading} gira={loading} />
        )}
        <DownloadReportButton tab="KPI Brain" preset={preset} style={{ marginLeft: onRefresh ? 0 : 'auto' }} />
      </div>

      {/* Key Metrics */}
      <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:16,padding:28,marginBottom:28}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:28}}>
          <div className="titolo-sezione">{t('kpi.keyMetrics', null, 'Key Metrics')}</div>
          <span style={{display:'inline-flex',alignItems:'center',gap:5,fontSize:11.5,fontWeight:640,color:'#22c55e',background:'rgba(34,197,94,0.12)',border:'1px solid rgba(34,197,94,0.3)',borderRadius:999,padding:'2px 9px'}}>
            <span style={{width:6,height:6,borderRadius:'50%',background:'#22c55e'}} /> Live
          </span>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,position:'relative',zIndex:2}}><PlatformIcon platform="shopify" size={18} /><span style={{fontSize:15,color:'var(--text)',fontWeight:680}}>Shopify</span></div>
        <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(3, 1fr)',gap:14,marginBottom:38}}>
          {metrics.filter(m=>m.group==='Shopify').map(item=><MetricCard key={item.title} item={item} />)}
        </div>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,position:'relative',zIndex:2}}><PlatformIcon platform="meta" size={18} /><span style={{fontSize:15,color:'var(--text)',fontWeight:680}}>Meta Ads</span></div>
        <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14,marginBottom:14}}>
          {metrics.filter(m=>m.group==='Meta Ads').map(item=><MetricCard key={item.title} item={item} />)}
        </div>
        <div style={{margin:'18px 0 48px',position:'relative',zIndex:2}}><MetaSegmentsPanel since={kpiRange?.since} until={kpiRange?.until} /></div>
        <div style={{display:'flex',alignItems:'center',gap:9,marginBottom:14,position:'relative',zIndex:2}}><PlatformIcon platform="google" size={18} /><span style={{fontSize:15,color:'var(--text)',fontWeight:680}}>Google Ads</span></div>
        <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:14}}>
          {metrics.filter(m=>m.group==='Google Ads').map(item=><MetricCard key={item.title} item={item} />)}
        </div>
        <div style={{marginTop:18,position:'relative',zIndex:2}}><GoogleSegmentsPanel since={kpiRange?.since} until={kpiRange?.until} /></div>
      </div>


      {/* Breakdowns */}
      <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:16,padding:24,marginBottom:24}}>
        <div style={{fontSize:15,fontWeight:680,color:'var(--text)',marginBottom:18}}>{t('kpi.breakdowns', null, 'Breakdowns')}</div>

        {/* Row 1: Top Products + Day Breakdown (affiancati) */}
        <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          <div style={panel}>
            <div style={{fontSize:15,color:'var(--text)',fontWeight:640,marginBottom:18}}>{t('kpi.top10Products', null, 'Top 10 prodotti per revenue')}</div>
            <div style={{display:'grid',gap:10}}>
              {topProducts.length > 0 ? topProducts.slice(0,10).map((row,i) => {
                const max = topProducts[0]?.value || 1
                return (
                  <div key={row.label}>
                    <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      {row.image ? <img src={miniatura(row.image, 36)} loading="lazy" alt="" style={{width:36,height:36,borderRadius:8,objectFit:'cover',flexShrink:0,border:'1px solid var(--border)'}} onError={e=>{e.target.style.display='none'}} />
                        : <div style={{width:36,height:36,borderRadius:8,background:'var(--surface)',display:'grid',placeItems:'center',fontSize:13,color:'var(--text3)',flexShrink:0}}>{i+1}</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{fontSize:13,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.label}</div>
                        <div style={{fontSize:11.5,color:'var(--text2)',fontWeight:640}}>{money(row.value)}{row.orders?` · ${int0(row.orders)} ${t('kpi.ordersWord', null, 'ordini')}`:''}</div>
                      </div>
                    </div>
                    <div style={{height:6,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
                      <div style={{width:`${Math.max(4,(row.value/max)*100)}%`,height:'100%',background:'#ec4899',borderRadius:999}} />
                    </div>
                  </div>
                )
              }) : <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.noDataAvailable', null, 'Nessun dato disponibile.')}</div>}
            </div>
          </div>

          {/* Day breakdown (affiancato) */}
          <div style={panel}>
            <div style={{fontSize:15,color:'var(--text)',fontWeight:640,marginBottom:18}}>{t('kpi.salesByWeekday', null, 'Vendite per giorno della settimana')}</div>
            <div style={{display:'grid',gap:10}}>
              {dayBreakdown.length > 0 ? dayBreakdown.map(row => {
                const max = Math.max(...dayBreakdown.map(r => r.value), 1)
                return (
                  <div key={row.label}>
                    <div style={{display:'flex',justifyContent:'space-between',gap:12,marginBottom:7,fontSize:13}}>
                      <span style={{color:'var(--text)'}}>{row.label}</span>
                      <span style={{color:'var(--text2)',fontWeight:640}}>{money(row.value)}{row.orders ? ` · ${int0(row.orders)} ${t('kpi.ordersWord', null, 'ordini')}` : ''}</span>
                    </div>
                    <div style={{height:8,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
                      <div style={{width:`${Math.max(4,(row.value/max)*100)}%`,height:'100%',background:'#14b8a6',borderRadius:999}} />
                    </div>
                  </div>
                )
              }) : <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.noData', null, 'Nessun dato.')}</div>}
            </div>
          </div>
        </div>

        {/* Fasce orarie migliori, accanto alle vendite per giorno della settimana:
            per ogni giorno dove si concentrano visite, ordini e conversione. */}
        <HourlyBandsPanel
          data={hourly} loading={hourlyLoading} error={hourlyError}
          metric={hourlyMetric} setMetric={setHourlyMetric}
          panel={panel} money={money} int0={int0} t={t}
        />

        {/* Row 2: Spesa marketing + New vs Returning (sotto) */}
        <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
          <div style={panel}>
            <div style={{fontSize:15,color:'var(--text)',fontWeight:640,marginBottom:18}}>{t('kpi.marketingSpendByChannel', null, 'Spesa marketing per canale')}</div>
            <div style={{display:'grid',gap:14}}><ProgressBar rows={marketingSources} color="#3b82f6" /></div>
          </div>

          <div style={panel}>
            <div style={{fontSize:15,color:'var(--text)',fontWeight:640,marginBottom:18}}>{t('kpi.newVsReturning', null, 'New vs Returning')}</div>
            <div style={{display:'grid',gap:14}}><ProgressBar rows={customerBreakdown} color="#f97316" format={int0} /></div>
          </div>
        </div>

        {/* Row 3: Brand più venduti, con le categorie di ognuno.
            Solo per i multimarca: a chi vende solo il proprio marchio questo
            pannello disegnerebbe una barra sola al 100%. */}
        {mostraBrand && (
        <div style={{...panel, marginTop:16}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:16}}>
            <div>
              <div style={{fontSize:15,color:'var(--text)',fontWeight:640}}>{t('kpi.brandsTitle', null, 'Brand più venduti')}</div>
              <div style={{fontSize:11.5,color:'var(--text3)',marginTop:3}}>{t('kpi.brandsSub', null, 'Fatturato per brand e categorie nel periodo · senza marketplace')}</div>
            </div>
            {Array.isArray(brandSales?.categories) && brandSales.categories.length > 0 && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                {brandSales.categories.slice(0,5).map(c => (
                  <span key={c.name || 'none'} style={{fontSize:11.5,fontWeight:640,color:'var(--text2)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:999,padding:'3px 9px'}}>
                    {c.name || t('kpi.uncategorized', null, 'Senza categoria')} · {c.share}%
                  </span>
                ))}
              </div>
            )}
          </div>

          {brandLoading && !brandSales && <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.brandsLoading', null, 'Carico brand e categorie…')}</div>}
          {brandError && <div style={{color:'#fca5a5',fontSize:13}}>{t('kpi.brandsError', { err: brandError }, `Brand non disponibili: ${brandError}`)}</div>}
          {!brandLoading && !brandError && brandSales && (brandSales.brands || []).length === 0 && (
            <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.brandsEmpty', null, 'Nessuna vendita nel periodo.')}</div>
          )}

          <div style={{display:'grid',gap:12,opacity:brandLoading ? 0.55 : 1,transition:'opacity .2s'}}>
            {(brandSales?.brands || []).slice(0,10).map((b,i) => {
              const max = brandSales.brands[0]?.revenue || 1
              const open = brandOpen?.brand === b.brand
              const d = b.deltaPct
              return (
                <div key={b.brand}>
                  <button
                    type="button"
                    onClick={() => setBrandOpen(b)}
                    title={t('kpi.brandOpen', null, 'Apri il dettaglio del brand')}
                    style={{all:'unset',display:'block',width:'100%',cursor:'pointer'}}
                  >
                    <div className="kb-brand-line" style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <div style={{width:22,fontSize:11.5,fontWeight:680,color:'var(--text3)',textAlign:'right',flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1,minWidth:0,fontSize:13,fontWeight:640,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>
                        {b.brand} <span style={{fontSize:11.5,fontWeight:600,color:'var(--text3)'}}>· {b.share}%</span>
                      </div>
                      <div className="kb-brand-rev" style={{fontSize:13,fontWeight:640,color:'var(--text2)',whiteSpace:'nowrap'}}>
                        {money(b.revenue)} · {int0(b.orders)} {t('kpi.ordersWord', null, 'ordini')}
                      </div>
                      <div style={{width:58,textAlign:'right',fontSize:11.5,fontWeight:640,flexShrink:0,color: d == null ? 'var(--text3)' : d >= 0 ? '#22c55e' : '#ef4444'}}
                        title={t('kpi.brandVsPrev', null, 'vs periodo precedente')}>
                        {d == null ? '—' : `${d >= 0 ? '+' : ''}${d.toLocaleString('it-IT',{maximumFractionDigits:1})}%`}
                      </div>
                      <div style={{width:14,fontSize:13,color:open?'#a78bfa':'var(--text3)',flexShrink:0}}>›</div>
                    </div>
                    <div className="kb-brand-bar" style={{height:6,marginLeft:32,background:'var(--surface)',borderRadius:999,overflow:'hidden'}}>
                      <div style={{width:`${Math.max(3,(b.revenue/max)*100)}%`,height:'100%',background:'#a78bfa',borderRadius:999}} />
                    </div>
                  </button>

                </div>
              )
            })}
          </div>
        </div>
        )}

        {/* Row 3b: quanti pezzi sono usciti a prezzo pieno e quanti in saldo.
            Stesso gate del pannello dei brand: e' una lettura per marchio. */}
        {mostraBrand && (
        <div style={{...panel, marginTop:16}}>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:4}}>
            <div>
              <div style={{fontSize:15,color:'var(--text)',fontWeight:640}}>{t('kpi.saleTitle', null, 'Prezzo pieno vs saldo')}</div>
              <div style={{fontSize:11.5,color:'var(--text3)',marginTop:3}}>{t('kpi.saleSub', null, 'Pezzi venduti per brand, divisi fra prodotti a prezzo pieno e prodotti in saldo')}</div>
            </div>
            {brandSales?.totals && ((brandSales.totals.saleUnits || 0) + (brandSales.totals.fullUnits || 0)) > 0 && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <span style={{fontSize:11.5,fontWeight:640,color:'#22c55e',background:'#22c55e14',border:'1px solid #22c55e40',borderRadius:999,padding:'3px 9px'}}>
                  {int0(brandSales.totals.fullUnits || 0)} {t('kpi.saleFull', null, 'prezzo pieno')}
                </span>
                <span style={{fontSize:11.5,fontWeight:640,color:'#f59e0b',background:'#f59e0b14',border:'1px solid #f59e0b40',borderRadius:999,padding:'3px 9px'}}>
                  {int0(brandSales.totals.saleUnits || 0)} {t('kpi.saleDiscounted', null, 'in saldo')}
                </span>
              </div>
            )}
          </div>
          {/* Il limite si dichiara nella pagina, non solo nel codice. */}
          <div style={{fontSize:10,color:'var(--text3)',marginBottom:14,lineHeight:1.5}}>
            {brandSales?.saleMethod === 'orders'
              ? t('kpi.saleMethodOrders', null, 'Calcolato sugli ordini: il prezzo davvero pagato in quel periodo, sconti inclusi')
              : t('kpi.saleMethodCatalog', null, 'Calcolato sul listino di oggi: Shopify non conserva il prezzo del giorno dell ordine')}
            {brandSales?.saleFallback === 'scope' && (
              <span style={{color:'#f59e0b'}}> · {t('kpi.saleFallbackScope', null, 'Storico ordini non accessibile: uso il listino di oggi per tutto il periodo')}</span>
            )}
            {brandSales?.saleFallback === 'timeout' && (
              <span style={{color:'#f59e0b'}}> · {t('kpi.saleFallbackTimeout', null, 'Periodo troppo lungo per rileggere tutti gli ordini: uso il listino di oggi per tutto il periodo')}</span>
            )}
          </div>

          {brandLoading && !brandSales && <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.brandsLoading', null, 'Carico brand e categorie…')}</div>}
          {brandError && <div style={{color:'#fca5a5',fontSize:13}}>{t('kpi.brandsError', { err: brandError }, `Brand non disponibili: ${brandError}`)}</div>}

          <div style={{display:'grid',gap:12,opacity:brandLoading ? 0.55 : 1,transition:'opacity .2s'}}>
            {(brandSales?.brands || [])
              .filter(b => ((b.saleUnits || 0) + (b.fullUnits || 0)) > 0)
              .slice(0,10)
              .map((b,i) => {
                const tot = (b.saleUnits || 0) + (b.fullUnits || 0)
                const quotaSaldo = tot > 0 ? (b.saleUnits / tot) * 100 : 0
                return (
                  <button
                    key={b.brand}
                    type="button"
                    onClick={() => setSaleOpen(b)}
                    title={t('kpi.saleOpen', null, 'Apri il dettaglio dei saldi di questo brand')}
                    style={{all:'unset',display:'block',width:'100%',cursor:'pointer'}}
                  >
                    <div className="kb-brand-line" style={{display:'flex',alignItems:'center',gap:10,marginBottom:6}}>
                      <div style={{width:22,fontSize:11.5,fontWeight:680,color:'var(--text3)',textAlign:'right',flexShrink:0}}>{i+1}</div>
                      <div style={{flex:1,minWidth:0,fontSize:13,fontWeight:640,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{b.brand}</div>
                      <div className="kb-brand-rev" style={{fontSize:13,fontWeight:640,color:'var(--text2)',whiteSpace:'nowrap'}}>
                        <span style={{color:'#22c55e'}}>{int0(b.fullUnits || 0)}</span>
                        {' / '}
                        <span style={{color:'#f59e0b'}}>{int0(b.saleUnits || 0)}</span>
                        {' '}{t('kpi.unitsWord', null, 'pezzi')}
                      </div>
                      <div style={{width:58,textAlign:'right',fontSize:11.5,fontWeight:640,flexShrink:0,color:'#f59e0b'}} title={t('kpi.saleShare', null, 'quota in saldo')}>
                        {quotaSaldo.toLocaleString('it-IT',{maximumFractionDigits:1})}%
                      </div>
                      <div style={{width:14,fontSize:13,color:saleOpen?.brand === b.brand ? '#a78bfa' : 'var(--text3)',flexShrink:0}}>›</div>
                    </div>
                    {/* Barra a due tinte: verde il pieno, ambra il saldo. */}
                    <div className="kb-brand-bar" style={{height:6,marginLeft:32,background:'var(--surface)',borderRadius:999,overflow:'hidden',display:'flex'}}>
                      <div style={{width:`${100 - quotaSaldo}%`,height:'100%',background:'#22c55e'}} />
                      <div style={{width:`${quotaSaldo}%`,height:'100%',background:'#f59e0b'}} />
                    </div>
                  </button>
                )
              })}
          </div>
        </div>
        )}
      </div>

      {/* Top Performers */}
      {topProducts.length > 0 && (
        <div className="glass-section reveal-zoom" style={{background:'var(--glass)',border:'1px solid var(--border)',borderRadius:16,padding:24,marginBottom:24}}>
          <div style={{fontSize:15,fontWeight:680,color:'var(--text)',marginBottom:18}}>{t('kpi.topPerformers', null, 'Top Performers')}</div>
          <div className="stagger-zoom m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, 1fr)',gap:16}}>
            {topProducts.slice(0,4).map((item,i) => (
              <div key={item.label} className="glass-card" style={{...card,display:'flex',flexDirection:'column',gap:12}}>
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <div style={{width:28,height:28,borderRadius:999,background:'#ffffff22',color:'var(--text)',display:'flex',alignItems:'center',justifyContent:'center',fontWeight:680,flexShrink:0}}>{i+1}</div>
                  {item.image && <img src={miniatura(item.image, 40)} loading="lazy" alt="" style={{width:40,height:40,borderRadius:12,objectFit:'cover',border:'1px solid var(--border)'}} onError={e=>{e.target.style.display='none'}} />}
                </div>
                <div style={{color:'var(--text)',fontWeight:680,fontSize:15,lineHeight:1.3}}>{item.label}</div>
                <div>
                  <div style={{color:'var(--text2)',fontSize:11.5,marginBottom:4}}>Revenue</div>
                  <div style={{color:'var(--text)',fontWeight:680,fontSize:22}}>{money(item.value)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Paesi di fatturazione (black glass 3D futuristic) ──────── */}
      <div
        style={{
          position:'relative',
          background:'var(--surface)',
          backdropFilter:'blur(40px) saturate(2.2)',
          WebkitBackdropFilter:'blur(40px) saturate(2.2)',
          borderRadius:16,
          overflow:'hidden',
          border:'1.5px solid var(--border)',
          borderTopColor:'rgba(255,255,255,0.12)',
          borderBottomColor:'rgba(0,0,0,0.65)',
          boxShadow:'0 30px 80px rgba(0,0,0,0.80), 0 12px 24px rgba(0,0,0,0.55), 0 4px 8px rgba(0,0,0,0.4), inset 0 1.5px 0 rgba(255,255,255,0.06), inset 0 -1.5px 0 rgba(0,0,0,0.25)',
          animation:'sim-pulse 6s ease-in-out infinite',
          transition:'transform 0.4s cubic-bezier(0.16,1,0.3,1), box-shadow 0.4s ease, border-color 0.4s ease',
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
        {/* shine top edge */}
        <div style={{position:'absolute',top:0,left:'8%',right:'8%',height:1.5,background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)',filter:'blur(0.3px)',opacity:0.85,animation:'cr-shine 4s ease-in-out infinite',zIndex:3,pointerEvents:'none'}} />
        {/* scan sweep */}
        <div style={{position:'absolute',top:0,bottom:0,left:'-50%',width:'40%',background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.035), transparent)',animation:'sim-scan 9s ease-in-out infinite',pointerEvents:'none',zIndex:1}} />

        <div style={{padding:24,position:'relative',zIndex:2}}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:14,marginBottom:18,flexWrap:'wrap'}}>
            <div style={{display:'flex',alignItems:'center',gap:14}}>
              <div style={{
                width:42,height:42,borderRadius:12,
                background:'var(--btn-primario)',
                display:'grid',placeItems:'center',
                color:'var(--btn-primario-testo)',
                boxShadow:'none',
              }}><Icon name="globe" size={22} /></div>
              <div>
                <div style={{fontSize:15,fontWeight:680,color:'var(--text)',letterSpacing:'-0.01em'}}>{t('kpi.billingCountries', null, 'Paesi di fatturazione')}</div>
                <div style={{color:'var(--text3)',fontSize:13,marginTop:2}}>
                  {countriesLoading
                    ? t('kpi.loadingShopifyOrders', null, 'Caricamento ordini Shopify…')
                    : countriesError
                      ? <span style={{color:'#fca5a5'}}>{countriesError}</span>
                      : `${countries.length} ${countries.length === 1 ? t('kpi.country', null, 'paese') : t('kpi.countries', null, 'paesi')} ${t('kpi.inPeriod', null, 'nel periodo')} · ${tfLabel}`}
                </div>
              </div>
            </div>
          </div>

          {countriesLoading && (
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',padding:'40px 20px',gap:12,color:'var(--text3)'}}>
              <div style={{width:24,height:24,border:'3px solid var(--border2)',borderTopColor:'#0ea5e9',borderRadius:999,animation:'spin 1s linear infinite'}} />
              <div style={{fontSize:13,fontWeight:600,letterSpacing:'0.08em',textTransform:'uppercase'}}>{t('kpi.loading', null, 'Caricamento…')}</div>
            </div>
          )}

          {(!countriesLoading && !countriesError && countries.length === 0) && (
            <div style={{padding:18,border:'1px solid #f59e0b44',background:'#f59e0b10',borderRadius:12,color:'#fcd34d',fontWeight:600,fontSize:13}}>
              {t('kpi.noOrdersInPeriod', null, 'Nessun ordine nel periodo selezionato.')}
            </div>
          )}

          {!countriesLoading && countries.length > 0 && (
            <div style={{display:'grid',gap:8}}>
              {countries.map((row, i) => {
                const pct = countriesTotal > 0 ? (row.revenue / countriesTotal) * 100 : 0
                const prev = prevByKey.get(row.country_code || row.country) || { revenue: 0, orders: 0 }
                const deltaRev = row.revenue - prev.revenue
                const deltaPct = prev.revenue > 0 ? (deltaRev / prev.revenue) * 100 : null
                const isNew = prev.revenue === 0 && row.revenue > 0
                const up = deltaRev > 0
                const topDeltaColor = isNew ? '#a5b4fc' : up ? '#86efac' : deltaRev < 0 ? '#fca5a5' : 'var(--text3)'
                const topDeltaBg = isNew ? 'rgba(99,102,241,0.12)' : up ? 'rgba(34,197,94,0.10)' : deltaRev < 0 ? 'rgba(239,68,68,0.10)' : 'rgba(255,255,255,0.03)'
                const topDeltaBorder = isNew ? 'rgba(99,102,241,0.30)' : up ? 'rgba(34,197,94,0.25)' : deltaRev < 0 ? 'rgba(239,68,68,0.25)' : 'rgba(255,255,255,0.06)'
                const hasSegmentData = row.ncOrders > 0 || row.rcOrders > 0 || prev.ncOrders > 0 || prev.rcOrders > 0
                return (
                  <div
                    key={`${row.country_code || row.country}-${i}`}
                    onClick={() => setSelectedCountry({ row, prev, range: kpiRange, prevRange: kpiPrevRange })}
                    style={{
                      position:'relative',
                      display:'flex',
                      flexDirection:'column',
                      gap:14,
                      padding:'14px 16px',
                      borderRadius:16,
                      background:'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(0,0,0,0.18))',
                      border:'1px solid var(--border)',
                      borderTopColor:'rgba(255,255,255,0.10)',
                      borderBottomColor:'rgba(0,0,0,0.4)',
                      boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
                      animation:`fadeUp 0.4s ease ${i*0.04}s both`,
                      transition:'transform 0.25s cubic-bezier(0.16,1,0.3,1), border-color 0.25s ease, box-shadow 0.25s ease',
                      cursor:'pointer',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.22)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.borderTopColor = 'rgba(255,255,255,0.10)'
                      e.currentTarget.style.boxShadow = 'none'
                    }}
                  >
                    {/* TOP ROW */}
                    <div className="kb-country-top" style={{display:'grid',gridTemplateColumns:'auto 1fr auto auto auto auto',alignItems:'center',gap:14}}>
                      <div style={{fontSize:28,lineHeight:1,filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.4))'}}>{countryFlag(row.country_code)}</div>
                      <div style={{minWidth:0}}>
                        <div style={{fontSize:15,fontWeight:640,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{row.country}</div>
                        <div style={{position:'relative',height:5,marginTop:6,borderRadius:999,background:'var(--glass)',overflow:'hidden'}}>
                          <div style={{position:'absolute',inset:0,width:`${Math.max(2,Math.min(100,pct))}%`,background:'var(--text3)',borderRadius:999,transition:'width 0.6s cubic-bezier(0.16,1,0.3,1)'}} />
                        </div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:15,fontWeight:680,color:'var(--text)',letterSpacing:'-0.01em'}}>{money(row.revenue)}</div>
                        <div style={{fontSize:10,color:'#0ea5e9',fontWeight:640,letterSpacing:'0.06em',textTransform:'uppercase',marginTop:2}}>{num(pct, 1)}%</div>
                      </div>
                      <div style={{
                        textAlign:'right',
                        minWidth:96,
                        padding:'6px 10px',
                        borderRadius:8,
                        background:topDeltaBg,
                        border:`1px solid ${topDeltaBorder}`,
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04)',
                      }}>
                        <div style={{fontSize:13,fontWeight:680,color:topDeltaColor,display:'flex',alignItems:'center',gap:4,justifyContent:'flex-end',lineHeight:1.1}}>
                          {isNew ? 'NEW' : (
                            <>
                              <span style={{fontSize:10,opacity:0.85}}>{up ? '▲' : deltaRev < 0 ? '▼' : '–'}</span>
                              {deltaPct != null ? `${deltaPct >= 0 ? '+' : ''}${num(deltaPct, 1)}%` : '—'}
                            </>
                          )}
                        </div>
                        <div style={{fontSize:10,fontWeight:640,color:topDeltaColor,opacity:0.85,marginTop:2}}>
                          {isNew ? money(row.revenue) : (deltaRev !== 0 ? (deltaRev > 0 ? `+€${Math.round(deltaRev).toLocaleString('it-IT', { useGrouping: 'always' })}` : `-€${Math.round(Math.abs(deltaRev)).toLocaleString('it-IT', { useGrouping: 'always' })}`) : '€0')}
                        </div>
                        <div style={{fontSize:10,color:topDeltaColor,fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',opacity:0.6,marginTop:1}}>{t('kpi.vsPrevious', null, 'vs precedente')}</div>
                      </div>
                      <div style={{
                        textAlign:'right',
                        minWidth:68,
                        padding:'6px 12px',
                        borderRadius:8,
                        background:'rgba(34,197,94,0.12)',
                        border:'1px solid rgba(34,197,94,0.28)',
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}>
                        <div style={{fontSize:13,fontWeight:680,color:'#86efac'}}>{int0(row.orders)}</div>
                        <div style={{fontSize:10,color:'#86efac',fontWeight:600,letterSpacing:'0.06em',textTransform:'uppercase',opacity:0.75,marginTop:1}}>{t('kpi.ordersWord', null, 'ordini')}</div>
                      </div>
                      <div style={{
                        width:32,height:32,borderRadius:8,
                        display:'grid',placeItems:'center',
                        background:'var(--glass)',
                        border:'1px solid var(--border)',
                        color:'#0ea5e9',fontSize:15,fontWeight:680,
                        boxShadow:'inset 0 1px 0 rgba(255,255,255,0.06)',
                      }}>↗</div>
                    </div>

                    {/* BOTTOM: card per ogni dato NC + RC */}
                    {hasSegmentData && (
                      <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12}}>
                        <SegmentBlock
                          title={t('kpi.segNew', null, 'Nuovi clienti')}
                          accent={{ text:'#67e8f9', bg:'rgba(6,182,212,0.10)', border:'rgba(6,182,212,0.30)' }}
                          ordersCurr={row.ncOrders}
                          ordersPrev={prev.ncOrders}
                          revCurr={row.ncRevenue}
                          revPrev={prev.ncRevenue}
                          money={money}
                          int0={int0}
                          fmtDeltaPct={fmtDeltaPct}
                          fmtDeltaEur={fmtDeltaEur}
                          deltaColor={deltaColor}
                        />
                        <SegmentBlock
                          title={t('kpi.segReturning', null, 'Clienti di ritorno')}
                          accent={{ text:'#d8b4fe', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.30)' }}
                          ordersCurr={row.rcOrders}
                          ordersPrev={prev.rcOrders}
                          revCurr={row.rcRevenue}
                          revPrev={prev.rcRevenue}
                          money={money}
                          int0={int0}
                          fmtDeltaPct={fmtDeltaPct}
                          fmtDeltaEur={fmtDeltaEur}
                          deltaColor={deltaColor}
                        />
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* Dove comprano — province e comuni, dall'indirizzo dell'ordine.
          Si disegna solo se c'e' qualcosa da dire: un negozio senza ordini
          italiani vedrebbe un'intestazione con sotto il vuoto. */}
      {mostraDove && (
      <div className="glass-section reveal-zoom" style={{marginTop:18,background:'var(--glass)',border:'1px solid var(--border)',borderRadius:16,padding:24}}>
        <div>
          <div style={{display:'flex',alignItems:'baseline',justifyContent:'space-between',gap:12,flexWrap:'wrap',marginBottom:14}}>
            <div>
              <div style={{fontSize:15,color:'var(--text)',fontWeight:640}}>{t('kpi.provTitle', null, 'Dove comprano')}</div>
              <div style={{fontSize:11.5,color:'var(--text3)',marginTop:3}}>
                {t('kpi.provSub', null, 'Province e comuni dall’indirizzo dell’ordine · senza marketplace · clicca una provincia per i dettagli')}
              </div>
            </div>
            {province?.totali && (
              <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                <span style={{fontSize:11.5,fontWeight:640,color:'var(--text2)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:999,padding:'3px 9px'}}>
                  {t('kpi.provCount', { n: province.totali.province }, `${province.totali.province} province`)}
                </span>
                <span style={{fontSize:11.5,fontWeight:640,color:'var(--text2)',background:'var(--surface)',border:'1px solid var(--border)',borderRadius:999,padding:'3px 9px'}}>
                  {t('kpi.provTownCount', { n: province.totali.comuni }, `${province.totali.comuni} comuni`)}
                </span>
              </div>
            )}
          </div>

          <div style={{display:'flex',gap:6,marginBottom:14,flexWrap:'wrap'}}>
            {[['regioni', t('kpi.viewRegions', null, 'Regioni · con la spesa')], ['province', t('kpi.viewProvinces', null, 'Province e comuni')]].map(([id, et]) => (
              <button key={id} onClick={() => setProvVista(id)} className="riga-tocco" aria-pressed={provVista === id} style={{
                padding:'7px 14px', borderRadius:999, fontSize:13, fontWeight:640, cursor:'pointer',
                border:`1px solid ${provVista === id ? 'var(--accent)' : 'var(--border)'}`,
                background: provVista === id ? 'var(--accent)' : 'var(--surface)',
                color: provVista === id ? '#fff' : 'var(--text2)',
              }}>{et}</button>
            ))}
          </div>

          {provLoading && !province && <div style={{color:'var(--text3)',fontSize:13}}>{t('kpi.provLoading', null, 'Leggo gli ordini…')}</div>}

          {provVista === 'regioni' && province?.regioni?.length > 0 && (() => {
            const merMedio = province.spesaRegioni?.merMedio ?? null
            const sr = province.spesaRegioni || {}
            return (
              <>
                {(() => {
                  const R = regioniOrdinate
                  const maxFatt = Math.max(1, ...R.map(x => x.fatturato || 0))
                  const maxSpesa = Math.max(1, ...R.map(x => x.spesa || 0))
                  const maxQuota = Math.max(1, ...R.map(x => Math.max(x.quotaSpesa || 0, x.quotaFatturato || 0)))
                  const tot = R.reduce((a, x) => ({
                    ordini: a.ordini + x.ordini, fatturato: a.fatturato + x.fatturato, sessioni: a.sessioni + (x.sessioni || 0),
                    meta: a.meta + (x.spesaMeta || 0), google: a.google + (x.spesaGoogle || 0), spesa: a.spesa + (x.spesa || 0),
                  }), { ordini: 0, fatturato: 0, sessioni: 0, meta: 0, google: 0, spesa: 0 })
                  const spesaCompleta = R.every(x => x.spesa != null)
                  const FAM = { ordini:'fam-vendite', fatturato:'fam-vendite', sessioni:'fam-traffico', cro:'fam-traffico', spesaMeta:'fam-pub', spesaGoogle:'fam-pub', spesa:'fam-pub', mer:'fam-resa', cpo:'fam-resa' }
                  const PRIMA = new Set(['ordini', 'sessioni', 'spesaMeta', 'mer'])
                  const LOGO = { spesaMeta: 'meta', spesaGoogle: 'google', sessioni: 'shopify' }
                  const sessTotali = sr.sessioni?.totale ?? null
                  const sessSenzaRegione = (sr.sessioni?.nonAssegnate || []).reduce((a, x) => a + (x.valore || 0), 0)
                  const croTotale = sessTotali > 0 ? Math.round((tot.ordini / sessTotali) * 10000) / 100 : croMedio
                  // Sotto il 70% della media: rosso. Sopra il 130%: blu. In mezzo il
                  // numero resta un numero, senza colore a distrarre.
                  const giudizio = (v, medio) => v == null || medio == null ? 'media' : v < medio * 0.7 ? 'sotto' : v > medio * 1.3 ? 'sopra' : 'media'
                  return (
                    <>
                      <div className="reg-legenda">
                        <span><i style={{background:'var(--gpv-google)'}} />{t('kpi.regLegSpend', null, 'quota della spesa')}</span>
                        <span><i style={{background:'var(--gpv-shopify)'}} />{t('kpi.regLegSales', null, 'quota delle vendite')}</span>
                        <span>{t('kpi.regLegHint', null, 'quando la gialla supera la verde, la regione costa più di quel che rende')}</span>
                      </div>
                      <div className="m-scrollx" style={{overflowX:'auto',maxWidth:'100%'}}>
                        <table className="tabella-ferma reg-tab" style={{minWidth:940}}>
                          <thead>
                            <tr className="reg-fasce">
                              <th className="reg-vuota reg-primo" />
                              <th colSpan={2} className="fam fam-vendite"><span style={{display:'inline-flex',alignItems:'center',gap:6}}><PlatformIcon platform="shopify" size={11} />{t('kpi.regFamSales', null, 'Vendite')}</span></th>
                              <th colSpan={2} className="fam fam-traffico">{t('kpi.regFamTraffic', null, 'Traffico')}</th>
                              <th colSpan={3} className="fam fam-pub">{t('kpi.regFamAds', null, 'Pubblicità')}</th>
                              <th colSpan={2} className="fam fam-resa">{t('kpi.regFamYield', null, 'Resa')}</th>
                            </tr>
                            <tr className="reg-colonne">
                              {COLONNE_REG.map((col, k) => {
                                const attiva = regOrdine.campo === col.id
                                return (
                                  <th key={col.id}
                                    onClick={() => setRegOrdine(o => ({ campo: col.id, giu: o.campo === col.id ? !o.giu : true }))}
                                    className={[k === 0 ? 'reg-primo gp-prodotto' : FAM[col.id], PRIMA.has(col.id) ? 'stacco' : '', attiva ? 'attiva' : ''].filter(Boolean).join(' ')}>
                                    {LOGO[col.id] && <span className="reg-logo"><PlatformIcon platform={LOGO[col.id]} size={11} /></span>}
                                    {col.label}{attiva ? (regOrdine.giu ? ' ▾' : ' ▴') : ''}
                                  </th>
                                )
                              })}
                            </tr>
                          </thead>
                          <tbody>
                            {R.map((r, k) => (
                              <tr key={r.regione} onClick={() => setProvOpen(r)} title={t('kpi.regOpen', null, 'Apri il dettaglio della regione')}>
                                <td className="reg-primo gp-prodotto">
                                  <div className="reg-riga-nome">
                                    <span className="reg-posto">{k + 1}</span>
                                    <div>
                                      <div className="reg-nome">{r.regione}</div>
                                      {r.quotaSpesa != null && (
                                        <div className="reg-doppia">
                                          <div className="reg-doppia-riga">
                                            <div className="reg-doppia-binario"><div className="reg-doppia-piena" style={{width:`${Math.max(2, (r.quotaSpesa / maxQuota) * 100)}%`,background:'var(--gpv-google)'}} /></div>
                                            <span className="reg-doppia-num">{r.quotaSpesa.toLocaleString('it-IT', { useGrouping: 'always' })}%</span>
                                          </div>
                                          <div className="reg-doppia-riga">
                                            <div className="reg-doppia-binario"><div className="reg-doppia-piena" style={{width:`${Math.max(2, ((r.quotaFatturato || 0) / maxQuota) * 100)}%`,background:'var(--gpv-shopify)'}} /></div>
                                            <span className="reg-doppia-num">{(r.quotaFatturato ?? 0).toLocaleString('it-IT', { useGrouping: 'always' })}%</span>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="fam-vendite stacco">{conta0(r.ordini)}</td>
                                <td className="fam-vendite">
                                  <div className="reg-valore">{money(r.fatturato)}</div>
                                  <div className="reg-barra"><div className="reg-barra-piena" style={{width:`${Math.max(2, (r.fatturato / maxFatt) * 100)}%`}} /></div>
                                </td>
                                <td className="fam-traffico stacco">{conta0(r.sessioni)}</td>
                                <td className="fam-traffico"><span className={`reg-pillola ${giudizio(r.cro, croMedio)}`}>{r.cro == null ? '—' : `${r.cro.toLocaleString('it-IT', { useGrouping: 'always' })}%`}</span></td>
                                <td className="fam-pub stacco">{r.spesaMeta == null ? '—' : money(r.spesaMeta)}</td>
                                <td className="fam-pub">{r.spesaGoogle == null ? '—' : money(r.spesaGoogle)}</td>
                                <td className="fam-pub">
                                  <div className="reg-valore">{r.spesa == null ? '—' : money(r.spesa)}</div>
                                  {r.spesa != null && <div className="reg-barra"><div className="reg-barra-piena" style={{width:`${Math.max(2, (r.spesa / maxSpesa) * 100)}%`}} /></div>}
                                </td>
                                <td className="fam-resa stacco"><span className={`reg-pillola ${giudizio(r.mer, merMedio)}`}>{r.mer == null ? '—' : `${r.mer.toLocaleString('it-IT', { useGrouping: 'always' })}×`}</span></td>
                                <td className="fam-resa">{r.cpo == null ? '—' : money(r.cpo)}</td>
                              </tr>
                            ))}
                          </tbody>
                          <tfoot>
                            <tr>
                              <td className="reg-primo gp-prodotto">{t('kpi.regTotal', { n: R.length }, `Italia · ${R.length} regioni`)}</td>
                              <td className="stacco">{conta0(tot.ordini)}</td>
                              <td>{money(tot.fatturato)}</td>
                              {/* Il totale e' quello del paese intero, lo stesso che si legge
                                  su Shopify: le sessioni di cui Shopify non conosce la regione
                                  non stanno in nessuna riga, ma nel totale si'. */}
                              <td className="stacco">
                                {conta0(sessTotali ?? tot.sessioni)}
                                {sessSenzaRegione > 0 && <div className="reg-sotto">{t('kpi.regSessNoRegion', { n: sessSenzaRegione.toLocaleString('it-IT', { useGrouping: 'always' }) }, `${sessSenzaRegione.toLocaleString('it-IT', { useGrouping: 'always' })} senza regione`)}</div>}
                              </td>
                              <td>{croTotale == null ? '—' : `${croTotale.toLocaleString('it-IT', { useGrouping: 'always' })}%`}</td>
                              <td className="stacco">{sr.meta?.errore ? '—' : money(tot.meta)}</td>
                              <td>{sr.google?.errore ? '—' : money(tot.google)}</td>
                              <td>{spesaCompleta ? money(tot.spesa) : '—'}</td>
                              <td className="stacco">{merMedio == null ? '—' : `${merMedio.toLocaleString('it-IT', { useGrouping: 'always' })}×`}</td>
                              <td>{spesaCompleta && tot.ordini > 0 ? money(tot.spesa / tot.ordini) : '—'}</td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </>
                  )
                })()}
                <div style={{marginTop:12,fontSize:11.5,color:'var(--text3)',lineHeight:1.6}}>
                  <div>{t('kpi.regAvg', { m: merMedio ?? '—', c: croMedio ?? '—' },
                    `Media delle regioni: MER ${merMedio ?? '—'}× · conversione ${croMedio ?? '—'}%. In rosso chi sta sotto il 70% della media, in blu chi supera il 130%.`)}</div>
                  <div>{t('kpi.regSpendNote', null,
                    'La spesa è quella di tutto il periodo, comprese le campagne oggi spente: una campagna che ha speso conta, anche se non gira più. Meta e Google misurano dove si trovava chi ha visto l’annuncio; le vendite dove è stato spedito l’ordine.')}</div>
                  {sr.meta?.errore && <div style={{color:'#ef4444'}}>{t('kpi.regMetaErr', { e: sr.meta.errore }, `Spesa Meta non disponibile (${sr.meta.errore}): il totale e il MER non si calcolano.`)}</div>}
                  {sr.google?.errore && <div style={{color:'#ef4444'}}>{t('kpi.regGoogleErr', { e: sr.google.errore }, `Spesa Google non disponibile (${sr.google.errore}): il totale e il MER non si calcolano.`)}</div>}
                  {!sr.sessioni?.errore && sr.sessioni?.totale > 0 && (
                    <div>{t('kpi.regSessNote', { n: sr.sessioni.totale.toLocaleString('it-IT', { useGrouping: 'always' }) },
                      `Sessioni di Shopify, solo Italia: ${sr.sessioni.totale.toLocaleString('it-IT', { useGrouping: 'always' })} nel periodo, le stesse che leggi nel pannello Shopify filtrando per paese. Quelle di cui Shopify non rileva la regione stanno nel totale, non nelle righe.`)}</div>
                  )}
                  {sr.sessioni?.errore && (/rate limit|riprova|retry/i.test(sr.sessioni.errore)
                    ? <div style={{ color: 'var(--text3)' }}>{t('kpi.regSessWait', null, 'Sessioni in aggiornamento: Shopify ha chiesto di attendere, riprovo da solo tra poco.')}</div>
                    : <div style={{color:'#ef4444'}}>{t('kpi.regSessErr', { e: sr.sessioni.errore }, `Sessioni non disponibili (${sr.sessioni.errore}).`)}</div>)}
                  {[...(sr.meta?.fuoriItalia || []), ...(sr.google?.fuoriItalia || [])].length > 0 && (
                    <div>{t('kpi.regOutside', { v: money([...(sr.meta?.fuoriItalia || []), ...(sr.google?.fuoriItalia || [])].reduce((a, x) => a + x.valore, 0)) },
                      `Spesa fuori dalle regioni italiane o senza regione: ${money([...(sr.meta?.fuoriItalia || []), ...(sr.google?.fuoriItalia || [])].reduce((a, x) => a + x.valore, 0))}, non compresa qui.`)}</div>
                  )}
                  {(sr.provinceSenzaRegione || []).length > 0 && (
                    <div>{t('kpi.regNoRegion', { l: sr.provinceSenzaRegione.map(x => x.provincia).join(', ') },
                      `Province che non so assegnare a una regione: ${sr.provinceSenzaRegione.map(x => x.provincia).join(', ')}.`)}</div>
                  )}
                </div>
              </>
            )
          })()}
          {provError && <div style={{color:'#fca5a5',fontSize:13}}>{t('kpi.provError', { err: provError }, `Province non disponibili: ${provError}`)}</div>}

          {provVista === 'province' && province?.province?.length > 0 && (
            <>
              {(() => {
                const P = provinceOrdinate.slice(0, 40)
                const maxFatt = Math.max(1, ...P.map(x => x.fatturato || 0))
                const FAMP = { ordini:'fam-vendite', fatturato:'fam-vendite', aov:'fam-vendite', nuovi:'fam-resa', ritorno:'fam-resa', sessioni:'fam-traffico', cro:'fam-traffico' }
                const PRIMAP = new Set(['ordini', 'nuovi', 'sessioni'])
                return (
                  <div className="m-scrollx" style={{overflowX:'auto',maxWidth:'100%'}}>
                    <table className="tabella-ferma reg-tab" style={{minWidth:820}}>
                      <thead>
                        <tr className="reg-fasce">
                          <th className="reg-vuota reg-primo" />
                          <th colSpan={3} className="fam fam-vendite"><span style={{display:'inline-flex',alignItems:'center',gap:6}}><PlatformIcon platform="shopify" size={11} />{t('kpi.regFamSales', null, 'Vendite')}</span></th>
                          <th colSpan={2} className="fam fam-resa">{t('kpi.regFamCustomers', null, 'Clienti')}</th>
                          <th colSpan={2} className="fam fam-traffico">{t('kpi.regFamTraffic', null, 'Traffico')}</th>
                        </tr>
                        <tr className="reg-colonne">
                          {COLONNE_PROV.map((col, k) => {
                            const attiva = provOrdine.campo === col.id
                            return (
                              <th key={col.id}
                                onClick={() => setProvOrdine(o => ({ campo: col.id, giu: o.campo === col.id ? !o.giu : true }))}
                                className={[k === 0 ? 'reg-primo gp-prodotto' : FAMP[col.id], PRIMAP.has(col.id) ? 'stacco' : '', attiva ? 'attiva' : ''].filter(Boolean).join(' ')}>
                                {col.label}{attiva ? (provOrdine.giu ? ' ▾' : ' ▴') : ''}
                              </th>
                            )
                          })}
                        </tr>
                      </thead>
                      <tbody>
                        {P.map((r, k) => (
                          <tr key={r.provincia} onClick={() => setProvOpen(r)} title={t('kpi.provOpen', null, 'Apri il dettaglio della provincia')}>
                            <td className="reg-primo gp-prodotto">
                              <div className="reg-riga-nome">
                                <span className="reg-posto">{k + 1}</span>
                                <div>
                                  <div className="reg-nome">{r.provincia}</div>
                                  <div className="reg-sotto">{comuniLabel(r.comuni.length)}</div>
                                </div>
                              </div>
                            </td>
                            <td className="fam-vendite stacco">{conta0(r.ordini)}</td>
                            <td className="fam-vendite">
                              <div className="reg-valore">{money(r.fatturato)}</div>
                              <div className="reg-barra"><div className="reg-barra-piena" style={{width:`${Math.max(2, (r.fatturato / maxFatt) * 100)}%`}} /></div>
                            </td>
                            <td className="fam-vendite">{r.aov == null ? '—' : money(r.aov)}</td>
                            <td className="fam-resa stacco">{conta0(r.nuovi)}</td>
                            <td className="fam-resa">{conta0(r.ritorno)}</td>
                            <td className="fam-traffico stacco">{conta0(r.sessioni)}</td>
                            <td className="fam-traffico">{r.cro == null ? '—' : `${r.cro.toLocaleString('it-IT', { useGrouping: 'always' })}%`}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )
              })()}

              {/* I limiti si dichiarano qui, non solo nel codice. */}
              <div style={{marginTop:12,fontSize:11.5,color:'var(--text3)',lineHeight:1.6}}>
                {province.fuori?.recuperatiDallaFatturazione > 0 && (
                  <div>{t('kpi.provBilling', { n: province.fuori.recuperatiDallaFatturazione },
                    `${province.fuori.recuperatiDallaFatturazione} ordini non avevano la provincia di spedizione: presa da quella di fatturazione.`)}</div>
                )}
                {province.fuori?.senzaProvincia > 0 && (
                  <div>{t('kpi.provNoProvince', { n: province.fuori.senzaProvincia, v: money(province.fuori.fatturatoSenzaProvincia) },
                    `${province.fuori.senzaProvincia} ordini restano senza provincia (${money(province.fuori.fatturatoSenzaProvincia)}) e non compaiono qui.`)}</div>
                )}
                {province.fuori?.estero > 0 && (
                  <div>{t('kpi.provAbroad', { n: province.fuori.estero }, `${province.fuori.estero} ordini dall’estero, fuori da questa tabella.`)}</div>
                )}
                <div>{t('kpi.provSessionsNote2', { c: province.analytics?.copertura ?? 0 },
                  `Sessioni di Shopify, solo Italia (le stesse del pannello Shopify). Shopify conosce la città della sessione, non la provincia: la città si lega alla provincia grazie agli ordini. Copertura ${province.analytics?.copertura ?? 0}% delle sessioni italiane.`)}</div>
              </div>
            </>
          )}
        </div>
      </div>
      )}

      {/* L'agente della tab: legge gli stessi numeri e risponde a domande.
          Esiste solo qui nel SaaS — il fork l'aveva tolto. */}
      <KpiBrainAgent tf={preset} preset={preset} />

      {provOpen && (
        <ProvinciaDetailModal
          riga={provOpen}
          regione={provOpen?.regione != null}
          tfLabel={tfLabel}
          onClose={() => setProvOpen(null)}
          {...(() => {
            // Le frecce scorrono l'elenco nell'ordine in cui lo si vede.
            const diRegioni = provOpen?.regione != null
            const lista = diRegioni ? regioniOrdinate : provinceOrdinate
            const i = lista.findIndex(x => (diRegioni ? x.regione === provOpen.regione : x.provincia === provOpen.provincia))
            return {
              onPrecedente: i > 0 ? () => setProvOpen(lista[i - 1]) : undefined,
              onSuccessiva: i >= 0 && i < lista.length - 1 ? () => setProvOpen(lista[i + 1]) : undefined,
              posizione: i >= 0 ? `${i + 1} / ${lista.length}` : undefined,
            }
          })()}
          money={money}
          conta0={conta0}
          t={t}
        />
      )}

      {brandOpen && (
        <BrandDetailModal
          brand={brandOpen}
          range={kpiRange}
          totals={brandSales?.totals}
          genderCoverage={brandSales?.genderCoveragePct}
          onClose={() => setBrandOpen(null)}
          money={money}
          int0={int0}
          tfLabel={tfLabel}
        />
      )}

      {saleOpen && (
        <SaleDetailModal
          brand={saleOpen}
          onClose={() => setSaleOpen(null)}
          money={money}
          int0={int0}
          tfLabel={tfLabel}
        />
      )}

      {selectedCountry && (
        <CountryDetailModal
          data={selectedCountry}
          onClose={() => setSelectedCountry(null)}
          money={money}
          int0={int0}
          countryFlag={countryFlag}
          fmtDeltaPct={fmtDeltaPct}
          fmtDeltaEur={fmtDeltaEur}
          deltaColor={deltaColor}
          tfLabel={tfLabel}
        />
      )}
    </div>
  )
}

// ── SegmentBlock: card per ogni dato NC/RC sotto la riga country ──
function SegmentBlock({ title, accent, ordersCurr, ordersPrev, revCurr, revPrev, money, int0, fmtDeltaPct, fmtDeltaEur, deltaColor }) {
  const { t } = useI18n()
  const dPct = fmtDeltaPct(revCurr, revPrev)
  const dEur = revPrev > 0 ? fmtDeltaEur(revCurr, revPrev) : (revCurr > 0 ? `+${money(revCurr)}` : '€0')
  const dColor = deltaColor(revCurr, revPrev)
  const cards = [
    { label: t('kpi.orders', null, 'Ordini'), value: int0(ordersCurr), color: 'var(--text)' },
    { label: 'Revenue', value: money(revCurr), color: 'var(--text)' },
    { label: 'Delta %', value: dPct || '—', color: dColor },
    { label: 'Delta €', value: dEur, color: dColor },
  ]
  return (
    <div style={{
      padding: '12px 12px 10px',
      borderRadius: 12,
      background: accent.bg,
      border: `1px solid ${accent.border}`,
      boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)',
    }}>
      <div style={{
        fontSize: 10, fontWeight: 640,
        color: accent.text,
        letterSpacing: '0.14em',
        textTransform: 'uppercase',
        marginBottom: 10,
      }}>{title}</div>
      <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
        {cards.map((c, idx) => (
          <div key={idx} className="country-segment-value" style={{
            padding: '7px 8px',
            borderRadius: 8,
            background: 'rgba(0,0,0,0.30)',
            border: '1px solid var(--border)',
            borderTopColor: 'rgba(255,255,255,0.08)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)',
            minWidth: 0,
          }}>
            <div style={{
              fontSize: 10, fontWeight: 600,
              color: 'var(--text3)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              opacity: 0.85,
              marginBottom: 3,
              whiteSpace: 'nowrap',
            }}>{c.label}</div>
            <div style={{
              fontSize: 13, fontWeight: 680,
              color: c.color,
              letterSpacing: '-0.01em',
              lineHeight: 1.1,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>{c.value}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ── CountryDetailModal: popup con pie + area chart + breakdown ─────
function CountryDetailModal({ data, onClose, money, int0, countryFlag, fmtDeltaPct, fmtDeltaEur, deltaColor, tfLabel }) {
  const { t } = useI18n()
  const [daily, setDaily] = useState([])
  const [loading, setLoading] = useState(true)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!data?.range) return
    const { range, row } = data
    setLoading(true)
    leggi(`/api/shopify-countries?since=${range.since}&until=${range.until}&country=${row.country_code || ''}&breakdown=daily`)
      .then(j => setDaily(Array.isArray(j?.daily) ? j.daily : []))
      .catch(() => setDaily([]))
      .finally(() => setLoading(false))
  }, [data])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted || !data) return null
  const { row, prev } = data
  const safeCode = (row.country_code || 'XX').toLowerCase()
  const pieData = [
    { name: 'Nuovi clienti', value: row.ncRevenue || 0, color: '#06b6d4' },
    { name: 'Clienti di ritorno', value: row.rcRevenue || 0, color: '#a855f7' },
  ]
  const hasPie = (row.ncRevenue || 0) + (row.rcRevenue || 0) > 0

  return (
    <Pannello larghezza={1040} onClose={onClose}
      titolo={<><span style={{ marginRight: 10 }}>{countryFlag(row.country_code)}</span>{row.country}</>}
      sotto={<>{money(row.revenue)} {t('kpi.revenueWord', null, 'fatturato')} · {int0(row.orders)} {t('kpi.ordersWord', null, 'ordini')} · {tfLabel}</>}>
      <div>
          {/* Charts: pie + area */}
          <div className="m-stack" style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1.4fr)', gap:14, marginBottom:14}}>
            {/* Pie chart */}
            <div className="country-detail-chart" style={{
              padding:18, borderRadius:16,
              background:'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.20))',
              border:'1px solid var(--border)',
              borderTopColor:'rgba(255,255,255,0.10)',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{position:'absolute', top:0, left:'8%', right:'8%', height:1, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)', animation:'cr-shine 5s ease-in-out infinite'}} />
              <div style={{fontSize:10, fontWeight:640, color:'var(--country-accent, #0ea5e9)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12}}>{t('kpi.revenueComposition', null, 'Composizione fatturato')}</div>
              {hasPie ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <defs>
                        <linearGradient id={`pieNC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#22d3ee" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#0e7490" stopOpacity={1}/>
                        </linearGradient>
                        <linearGradient id={`pieRC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#c084fc" stopOpacity={1}/>
                          <stop offset="100%" stopColor="#6b21a8" stopOpacity={1}/>
                        </linearGradient>
                        <filter id={`pieGlow-${safeCode}`}>
                          <feGaussianBlur stdDeviation="4" result="b"/>
                          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
                        </filter>
                      </defs>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius={55} outerRadius={92}
                        paddingAngle={3}
                        dataKey="value"
                        isAnimationActive
                        animationDuration={1200}
                        animationEasing="ease-out"
                        stroke="rgba(255,255,255,0.12)"
                        strokeWidth={1.5}
                      >
                        <Cell fill={`url(#pieNC-${safeCode})`} filter={`url(#pieGlow-${safeCode})`}/>
                        <Cell fill={`url(#pieRC-${safeCode})`} filter={`url(#pieGlow-${safeCode})`}/>
                      </Pie>
                      <Tooltip
                        contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
                        formatter={v => money(v)}
                        cursor={{fill:'rgba(255,255,255,0.04)'}}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex', justifyContent:'space-around', marginTop:6, fontSize:11.5}}>
                    <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--country-new, #67e8f9)', fontWeight:640}}>
                      <div style={{width:11, height:11, borderRadius:6, background:'var(--country-new, #67e8f9)', boxShadow:'none'}} />
                      {t('kpi.new', null, 'Nuovi')} {money(row.ncRevenue)}
                    </div>
                    <div style={{display:'flex', alignItems:'center', gap:6, color:'var(--country-returning, #d8b4fe)', fontWeight:640}}>
                      <div style={{width:11, height:11, borderRadius:6, background:'var(--country-returning, #d8b4fe)', boxShadow:'none'}} />
                      {t('kpi.returning', null, 'Ritorno')} {money(row.rcRevenue)}
                    </div>
                  </div>
                </>
              ) : (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13}}>{t('kpi.noClassifiedRevenue', null, 'Nessun fatturato classificato (tutti guest)')}</div>
              )}
            </div>

            {/* Area chart */}
            <div className="country-detail-chart" style={{
              padding:18, borderRadius:16,
              background:'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.20))',
              border:'1px solid var(--border)',
              borderTopColor:'rgba(255,255,255,0.10)',
              boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
              position:'relative', overflow:'hidden',
            }}>
              <div style={{position:'absolute', top:0, left:'8%', right:'8%', height:1, background:'linear-gradient(90deg, transparent, rgba(255,255,255,0.28), transparent)', animation:'cr-shine 5s ease-in-out infinite', animationDelay:'.5s'}} />
              <div style={{fontSize:10, fontWeight:640, color:'var(--country-accent, #0ea5e9)', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12}}>{t('kpi.dailyRevenueTrend', null, 'Trend giornaliero fatturato')}</div>
              {loading ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:240, gap:12, color:'var(--text3)'}}>
                  <div style={{width:24, height:24, border:'3px solid var(--border2)', borderTopColor:'#0ea5e9', borderRadius:999, animation:'spin 1s linear infinite'}} />
                  <div style={{fontSize:11.5, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase'}}>{t('kpi.loadingShort', null, 'Caricamento')}</div>
                </div>
              ) : daily.length === 0 ? (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13}}>{t('kpi.noDailyData', null, 'Nessun dato giornaliero nel periodo')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={daily} margin={{top:8,right:8,left:-8,bottom:0}}>
                    <defs>
                      <linearGradient id={`areaTotal-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0ea5e9" stopOpacity={0.55}/>
                        <stop offset="100%" stopColor="#0ea5e9" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id={`areaNC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#06b6d4" stopOpacity={0.45}/>
                        <stop offset="100%" stopColor="#06b6d4" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id={`areaRC-${safeCode}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a855f7" stopOpacity={0.40}/>
                        <stop offset="100%" stopColor="#a855f7" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={{stroke:'rgba(255,255,255,0.08)'}} tickFormatter={d => d.slice(5)} />
                    <YAxis stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${Math.round(v)}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
                      labelStyle={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 4 }}
                      formatter={(v, n) => [money(v), n === 'revenue' ? t('kpi.total', null, 'Totale') : n === 'ncRevenue' ? t('kpi.new', null, 'Nuovi') : t('kpi.returning', null, 'Ritorno')]}
                      cursor={{stroke:'rgba(14,165,233,0.4)', strokeWidth:1, strokeDasharray:'3 3'}}
                    />
                    <Area type="monotone" dataKey="ncRevenue" stackId="seg" stroke="#22d3ee" strokeWidth={1.5} fill={`url(#areaNC-${safeCode})`} isAnimationActive animationDuration={1400} animationEasing="ease-out"/>
                    <Area type="monotone" dataKey="rcRevenue" stackId="seg" stroke="#c084fc" strokeWidth={1.5} fill={`url(#areaRC-${safeCode})`} isAnimationActive animationDuration={1400} animationEasing="ease-out"/>
                    <Area type="monotone" dataKey="revenue" stroke="#0ea5e9" strokeWidth={2.5} fill="none" isAnimationActive animationDuration={1600} animationEasing="ease-out" dot={{r:3, fill:'#0ea5e9', stroke:'var(--text)', strokeWidth:1}}/>
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* NC + RC segment detail */}
          <div className="m-stack" style={{display:'grid', gridTemplateColumns:'1fr 1fr', gap:14}}>
            <SegmentBlock
              title={t('kpi.segNew', null, 'Nuovi clienti')}
              accent={{ text:'var(--country-new, #67e8f9)', bg:'rgba(6,182,212,0.10)', border:'rgba(6,182,212,0.30)' }}
              ordersCurr={row.ncOrders} ordersPrev={prev.ncOrders}
              revCurr={row.ncRevenue} revPrev={prev.ncRevenue}
              money={money} int0={int0}
              fmtDeltaPct={fmtDeltaPct} fmtDeltaEur={fmtDeltaEur} deltaColor={deltaColor}
            />
            <SegmentBlock
              title={t('kpi.segReturning', null, 'Clienti di ritorno')}
              accent={{ text:'var(--country-returning, #d8b4fe)', bg:'rgba(168,85,247,0.10)', border:'rgba(168,85,247,0.30)' }}
              ordersCurr={row.rcOrders} ordersPrev={prev.rcOrders}
              revCurr={row.rcRevenue} revPrev={prev.rcRevenue}
              money={money} int0={int0}
              fmtDeltaPct={fmtDeltaPct} fmtDeltaEur={fmtDeltaEur} deltaColor={deltaColor}
            />
          </div>
      </div>
    </Pannello>
  )
}

// ============================================================================
//  Dettaglio di un brand — stesso impianto del pop-up dei Paesi di fatturazione
//  (e le stesse classi country-detail-*, cosi' il tema White lo veste senza
//  regole in piu'): mix delle categorie a ciambella, andamento giornaliero,
//  categorie con le sottocategorie, e i prodotti che hanno venduto di piu'.
// ============================================================================
const CAT_COLORS = ['#a78bfa', '#22d3ee', '#f472b6', '#f59e0b', '#22c55e', '#94a3b8']

const COLORI_GENERE = { DONNA: '#f472b6', UOMO: '#38bdf8', UNISEX: '#a78bfa', BAMBINO: '#facc15' }
const coloreGenere = (n) => COLORI_GENERE[n] || '#94a3b8'
// Il genere arriva dal metafield com'e' scritto in Shopify: una lista in JSON
// ('["WOMAN"]'). Si legge la lista e si scrive in italiano.
const NOMI_GENERE = { WOMAN: 'Donna', WOMEN: 'Donna', DONNA: 'Donna', MAN: 'Uomo', MEN: 'Uomo', UOMO: 'Uomo', UNISEX: 'Unisex', KIDS: 'Bambino', KID: 'Bambino', BAMBINO: 'Bambino' }
const nomeGenere = (grezzo) => {
  let voci = [String(grezzo ?? '')]
  try { const j = JSON.parse(String(grezzo)); if (Array.isArray(j)) voci = j.map(String) } catch {}
  return voci.map(v => NOMI_GENERE[v.trim().toUpperCase()] || v).filter(Boolean).join(' · ') || '—'
}

// Gemello di BrandDetailModal per i saldi. Riusa le stesse classi
// country-detail-*: il tema bianco e il mobile le vestono gia, senza regole in piu.
function SaleDetailModal({ brand, onClose, money, int0, tfLabel }) {
  const { t } = useI18n()
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const box = { background:'var(--glass)', border:'1px solid var(--border)', borderRadius:16, padding:16 }
  const eyebrow = { fontSize:10, fontWeight:640, color:'#a78bfa', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:10 }
  const pieni = brand.fullProducts || []
  const scontati = brand.saleProducts || []
  const tot = (brand.saleUnits || 0) + (brand.fullUnits || 0)
  const quota = tot > 0 ? (brand.saleUnits / tot) * 100 : 0

  const Lista = ({ voci, colore, vuoto }) => (
    voci.length === 0
      ? <div style={{fontSize:13,color:'var(--text3)'}}>{vuoto}</div>
      : <div style={{display:'flex',flexDirection:'column',gap:8}}>
          {voci.map(p => (
            <div key={p.productId} style={{display:'flex',alignItems:'center',gap:10}}>
              {p.image
                ? <img src={miniatura(p.image, 34)} loading="lazy" alt="" style={{width:34,height:34,borderRadius:8,objectFit:'cover',flexShrink:0}} />
                : <div style={{width:34,height:34,borderRadius:8,background:'var(--surface)',flexShrink:0}} />}
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:13,fontWeight:600,color:'var(--text)',whiteSpace:'nowrap',overflow:'hidden',textOverflow:'ellipsis'}}>{p.title}</div>
                <div style={{fontSize:10,color:'var(--text3)'}}>
                  {int0(p.units)} {t('kpi.unitsWord', null, 'pezzi')} · {money(p.revenue)}
                  {p.discountPct ? ` · -${p.discountPct}%` : ''}
                </div>
              </div>
              <div style={{width:8,height:8,borderRadius:'50%',background:colore,flexShrink:0}} />
            </div>
          ))}
        </div>
  )

  return (
    <Pannello titolo={brand.brand} sotto={<>{t('kpi.saleCap', null, 'Saldi')} · {tfLabel}</>} larghezza={1040} onClose={onClose}>
      <div>
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14, marginBottom:22, flexWrap:'wrap'}}>
            <div>
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:10}}>
                {[
                  { k: t('kpi.saleFull', null, 'prezzo pieno'), v: `${int0(brand.fullUnits || 0)}`, c: '#22c55e' },
                  { k: t('kpi.saleDiscounted', null, 'in saldo'), v: `${int0(brand.saleUnits || 0)}`, c: '#f59e0b' },
                  { k: t('kpi.saleShare', null, 'quota in saldo'), v: `${quota.toLocaleString('it-IT',{maximumFractionDigits:1})}%`, c: '#f59e0b' },
                  { k: t('kpi.saleFull', null, 'prezzo pieno'), v: money(brand.fullRevenue || 0), c: '#22c55e' },
                  { k: t('kpi.saleDiscounted', null, 'in saldo'), v: money(brand.saleRevenue || 0), c: '#f59e0b' },
                ].map((x, i) => (
                  <div key={i} className="country-segment-value" style={{padding:'7px 12px', borderRadius:12, background:'var(--glass)', border:'1px solid var(--border)'}}>
                    <div style={{fontSize:15, fontWeight:680, color:x.c}}>{x.v}</div>
                    <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em'}}>{x.k}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div style={{height:10, borderRadius:999, overflow:'hidden', display:'flex', marginBottom:8}}>
            <div style={{width:`${100 - quota}%`, background:'#22c55e'}} />
            <div style={{width:`${quota}%`, background:'#f59e0b'}} />
          </div>
          <div style={{fontSize:10, color:'var(--text3)', marginBottom:18, lineHeight:1.5}}>{t('kpi.saleNote', null, '')}</div>

          <div className="m-stack" style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1fr)', gap:14}}>
            <div className="country-detail-chart" style={box}>
              <div style={eyebrow}>{t('kpi.saleProductsFull', null, 'Venduti a prezzo pieno')}</div>
              <Lista voci={pieni} colore="#22c55e" vuoto={t('kpi.saleNoneFull', null, 'Nessun prodotto a prezzo pieno nel periodo.')} />
            </div>
            <div className="country-detail-chart" style={box}>
              <div style={eyebrow}>{t('kpi.saleProductsDisc', null, 'Venduti in saldo')}</div>
              <Lista voci={scontati} colore="#f59e0b" vuoto={t('kpi.saleNoneDisc', null, 'Nessun prodotto in saldo nel periodo.')} />
            </div>
          </div>
      </div>
    </Pannello>
  )
}

// ============================================================================
//  Dettaglio di una provincia. Tutto quello che serve e' gia' nella riga:
//  comuni, marchi e categorie arrivano con l'elenco, quindi qui non si chiama
//  niente e il pannello si apre subito.
// ============================================================================
function ProvinciaDetailModal({ riga, regione = false, onClose, onPrecedente, onSuccessiva, posizione, money, conta0, tfLabel, t }) {
  const [montato, setMontato] = useState(false)
  useEffect(() => { setMontato(true) }, [])
  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  if (!montato || !riga) return null

  const COLORI = ['#8b5cf6', '#2997ff', '#22c55e', '#f59e0b', '#ef4444', '#06b6d4', '#ec4899', '#84cc16']
  const comuni = (riga.comuni || []).slice(0, 12)
  const marchi = (riga.marchi || []).slice(0, 10)
  const categorie = (riga.categorie || []).filter(c => c.fatturato > 0)
  const totCat = categorie.reduce((a, c) => a + c.fatturato, 0)

  // Le schede prendono i colori dal tema invece di avere un gradiente scuro
  // scritto a mano: su fondo bianco quel gradiente diventava una macchia
  // grigia con un bordo che non c'entrava niente.
  const cap = { fontSize:10, fontWeight:640, color:'var(--text3)', letterSpacing:'0.12em', textTransform:'uppercase', marginBottom:12 }
  const kpi = (etichetta, valore, nota) => (
    <div className="prov-kpi">
      <div className="prov-kpi-et">{etichetta}</div>
      <div className="prov-kpi-val">{valore}</div>
      {nota && <div className="prov-kpi-nota">{nota}</div>}
    </div>
  )

  return (
    <Pannello titolo={riga.provincia} larghezza={980} onClose={onClose} onPrecedente={onPrecedente} onSuccessiva={onSuccessiva} posizione={posizione}
      sotto={`${regione
        ? t('kpi.provCount', { n: (riga.comuni || []).length }, `${(riga.comuni || []).length} province`)
        : (riga.comuni || []).length === 1
          ? t('kpi.provTownOne', null, '1 comune')
          : t('kpi.provTownsInline', { n: (riga.comuni || []).length }, `${(riga.comuni || []).length} comuni`)} · ${tfLabel}`}>
          <div className="m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0,1fr))',gap:12,marginBottom:16}}>
            {kpi(t('kpi.provOrders', null, 'Ordini'), conta0(riga.ordini))}
            {kpi(t('kpi.provRevenue', null, 'Fatturato'), money(riga.fatturato), riga.aov != null ? `AOV ${money(riga.aov)}` : null)}
            {kpi(t('kpi.provNew', null, 'Nuovi'), conta0(riga.nuovi),
              riga.quotaNuovi != null ? t('kpi.provNewShare', { p: riga.quotaNuovi }, `${riga.quotaNuovi}% degli ordini`) : null)}
            {kpi(t('kpi.provReturning', null, 'Di ritorno'), conta0(riga.ritorno), money(riga.fatturatoRitorno))}
          </div>
          <div className="m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(2, minmax(0,1fr))',gap:12,marginBottom:20}}>
            {kpi(t('kpi.provSessions', null, 'Sessioni'), conta0(riga.sessioni),
              riga.sessioni == null ? t('kpi.provNoSessions', null, 'Nessuna sessione attribuita a questa provincia') : null)}
            {kpi(t('kpi.provCro', null, 'Conversione'), riga.cro == null ? '—' : `${riga.cro}%`,
              riga.cro == null ? t('kpi.provCroNa', null, 'Serve almeno una sessione attribuita') : null)}
          </div>

          {regione && (
            <>
              <div className="m-grid2" style={{display:'grid',gridTemplateColumns:'repeat(4, minmax(0,1fr))',gap:12,marginBottom:14}}>
                {kpi(t('kpi.regMeta', null, 'Spesa Meta'), riga.spesaMeta == null ? '—' : money(riga.spesaMeta))}
                {kpi(t('kpi.regGoogle', null, 'Spesa Google'), riga.spesaGoogle == null ? '—' : money(riga.spesaGoogle))}
                {kpi('MER', riga.mer == null ? '—' : `${riga.mer.toLocaleString('it-IT', { useGrouping: 'always' })}×`,
                  riga.quotaSpesa != null ? t('kpi.regShare', { s: riga.quotaSpesa, f: riga.quotaFatturato ?? 0 }, `${riga.quotaSpesa}% spesa · ${riga.quotaFatturato ?? 0}% vendite`) : null)}
                {kpi(t('kpi.regCpo', null, 'Costo per ordine'), riga.cpo == null ? '—' : money(riga.cpo))}
              </div>
              <div className="prov-scheda" style={{marginBottom:20}}>
                <div style={cap}>{t('kpi.regCampaigns', null, 'Campagne che spendono qui')}</div>
                {(riga.campagne || []).length === 0 ? (
                  <div style={{fontSize:13,color:'var(--text3)'}}>{t('kpi.regNoCampaigns', null, 'Nessuna campagna ha speso in questa regione')}</div>
                ) : (
                  <div style={{maxHeight:220,overflowY:'auto'}}>
                    {(riga.campagne || []).map((c, i) => (
                      <div key={`${c.piattaforma}-${c.campagna}-${i}`} className="prov-riga" style={{fontSize:13}}>
                        <span style={{fontSize:10,fontWeight:640,letterSpacing:'0.06em',color:'var(--text3)',width:52,flexShrink:0,textTransform:'uppercase'}}>{c.piattaforma}</span>
                        <span style={{color:'var(--text)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.campagna}</span>
                        <span style={{color:'var(--text)',fontWeight:640,width:86,textAlign:'right',flexShrink:0}}>{money(c.spesa)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}

          <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1.2fr 1fr',gap:14,marginBottom:14}}>
            <div className="prov-scheda">
              <div style={cap}>{regione ? t('kpi.regTopProvinces', null, 'Province per fatturato') : t('kpi.provTopTowns', null, 'Comuni per fatturato')}</div>
              {comuni.length === 0 ? (
                <div style={{fontSize:13,color:'var(--text3)'}}>{t('kpi.provNoTowns', null, 'Nessun comune registrato')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={Math.max(160, comuni.length * 26)}>
                  <BarChart data={comuni} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
                    <XAxis type="number" hide />
                    <YAxis type="category" dataKey="comune" width={116} tick={{ fontSize: 11.5 }} />
                    <Tooltip formatter={(v) => money(v)} cursor={{ fill: 'rgba(255,255,255,0.04)' }} />
                    <Bar dataKey="fatturato" radius={[0, 6, 6, 0]}>
                      {comuni.map((c, i) => <Cell key={c.comune} fill={COLORI[i % COLORI.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>
            <div className="prov-scheda">
              <div style={cap}>{t('kpi.provCategories', null, 'Categorie')}</div>
              {categorie.length === 0 ? (
                <div style={{fontSize:13,color:'var(--text3)'}}>{t('kpi.provNoCategories', null, 'Nessuna categoria')}</div>
              ) : (
                <>
                  <ResponsiveContainer width="100%" height={168}>
                    <PieChart>
                      <Pie data={categorie} dataKey="fatturato" nameKey="categoria" innerRadius={42} outerRadius={68} paddingAngle={2}>
                        {categorie.map((c, i) => <Cell key={c.categoria} fill={COLORI[i % COLORI.length]} />)}
                      </Pie>
                      <Tooltip formatter={(v) => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex',flexDirection:'column',gap:5,marginTop:8}}>
                    {categorie.slice(0, 6).map((c, i) => (
                      <div key={c.categoria} style={{display:'flex',alignItems:'center',gap:8,fontSize:11.5}}>
                        <span style={{width:9,height:9,borderRadius:6,background:COLORI[i % COLORI.length],flexShrink:0}} />
                        <span style={{color:'var(--text2)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.categoria}</span>
                        <span style={{color:'var(--text)',fontWeight:600}}>{money(c.fatturato)}</span>
                        <span style={{color:'var(--text3)',width:40,textAlign:'right'}}>{totCat > 0 ? `${Math.round((c.fatturato / totCat) * 100)}%` : '—'}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1.3fr 1fr',gap:14,marginBottom:14}}>
            <div className="prov-scheda">
              <div style={cap}>{t('kpi.provProducts', null, 'Prodotti più venduti qui')}</div>
              {(riga.prodotti || []).length === 0 ? (
                <div style={{fontSize:13,color:'var(--text3)'}}>{t('kpi.provNoProducts', null, 'Nessun prodotto')}</div>
              ) : (riga.prodotti || []).map((pr, i) => (
                <div key={`${pr.titolo}-${i}`} className="prov-riga">
                  {pr.immagine
                    ? <img src={miniatura(pr.immagine, 38)} loading="lazy" alt="" className="prov-foto" />
                    : <div className="prov-foto prov-foto-vuota" />}
                  <div style={{minWidth:0,flex:1}}>
                    <div className="prov-prod-titolo">{pr.titolo}</div>
                    <div className="prov-prod-nota">
                      {[pr.categoria, pr.genere].filter(Boolean).join(' · ') || t('kpi.provNoCategory', null, 'senza categoria')}
                    </div>
                  </div>
                  <div style={{textAlign:'right',flexShrink:0}}>
                    <div style={{fontWeight:640,color:'var(--text)',fontSize:13}}>{money(pr.fatturato)}</div>
                    <div style={{color:'var(--text3)',fontSize:11.5}}>{t('kpi.provPieces', { n: pr.pezzi }, `${pr.pezzi} pz`)}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="prov-scheda">
              <div style={cap}>{t('kpi.provGender', null, 'Per chi comprano')}</div>
              {(riga.generi || []).length === 0 ? (
                <div style={{fontSize:13,color:'var(--text3)'}}>{t('kpi.provNoGender', null, 'Genere non dichiarato sui prodotti')}</div>
              ) : (() => {
                const tot = (riga.generi || []).reduce((a, g) => a + g.fatturato, 0)
                return (riga.generi || []).map((g, i) => {
                  const quota = tot > 0 ? (g.fatturato / tot) * 100 : 0
                  return (
                    <div key={g.genere} style={{marginBottom:10}}>
                      <div style={{display:'flex',alignItems:'baseline',gap:8,fontSize:11.5,marginBottom:4}}>
                        <span style={{color:'var(--text2)',fontWeight:600,flex:1}}>{g.genere}</span>
                        <span style={{color:'var(--text)',fontWeight:640}}>{money(g.fatturato)}</span>
                        <span style={{color:'var(--text3)',width:38,textAlign:'right'}}>{Math.round(quota)}%</span>
                      </div>
                      <div className="prov-barra">
                        <div className="prov-barra-piena" style={{width:`${Math.max(quota, 2)}%`,background:COLORI[i % COLORI.length]}} />
                      </div>
                    </div>
                  )
                })
              })()}
            </div>
          </div>

          <div className="m-stack" style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:14}}>
            <div className="prov-scheda">
              <div style={cap}>{t('kpi.provBrands', null, 'Marchi più venduti qui')}</div>
              {marchi.length === 0 ? (
                <div style={{fontSize:13,color:'var(--text3)'}}>{t('kpi.provNoBrands', null, 'Nessun marchio')}</div>
              ) : marchi.map((m, i) => (
                <div key={m.marchio} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom: i < marchi.length - 1 ? '1px solid var(--border)' : 'none',fontSize:13}}>
                  <span style={{color:'var(--text)',fontWeight:600,flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{m.marchio}</span>
                  <span style={{color:'var(--text3)'}}>{t('kpi.provPieces', { n: m.pezzi }, `${m.pezzi} pz`)}</span>
                  <span style={{color:'var(--text)',fontWeight:640,width:86,textAlign:'right'}}>{money(m.fatturato)}</span>
                </div>
              ))}
            </div>
            <div className="prov-scheda">
              <div style={cap}>{regione ? t('kpi.regProvincesList', null, 'Province') : t('kpi.provTownsList', null, 'Comuni')}</div>
              <div style={{maxHeight:240,overflowY:'auto'}}>
                {(riga.comuni || []).map((c, i) => (
                  <div key={c.comune} style={{display:'flex',alignItems:'center',gap:8,padding:'6px 0',borderBottom: i < riga.comuni.length - 1 ? '1px solid var(--border)' : 'none',fontSize:13}}>
                    <span style={{color:'var(--text)',flex:1,minWidth:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{c.comune}</span>
                    <span style={{color:'var(--text3)'}}>{t('kpi.provOrdersShort', { n: c.ordini }, `${c.ordini} ord.`)}</span>
                    <span style={{color:'var(--text)',fontWeight:640,width:86,textAlign:'right'}}>{money(c.fatturato)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
    </Pannello>
  )
}

function BrandDetailModal({ brand, range, totals, onClose, money, int0, tfLabel, genderCoverage }) {
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)
  const [daily, setDaily] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    if (!brand?.brand || !range?.since || !range?.until) return
    let cancelled = false
    setLoading(true); setError(null)
    leggi(`/api/brand-sales?since=${range.since}&until=${range.until}&brand=${encodeURIComponent(brand.brand)}&breakdown=daily`)
      .then(j => {
        if (cancelled) return
        if (!j || j.ok === false) { setError(j?.error || 'Shopify'); setDaily([]); return }
        setDaily(Array.isArray(j.daily) ? j.daily : [])
      })
      .catch(e => { if (!cancelled) { setError(e?.message || 'Errore di rete'); setDaily([]) } })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [brand?.brand, range?.since, range?.until])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!mounted || !brand) return null

  const safeId = String(brand.brand).replace(/[^a-z0-9]/gi, '').toLowerCase() || 'brand'
  const catLabel = (name) => name || t('kpi.uncategorized', null, 'Senza categoria')
  // La ciambella mostra solo le fette positive: una categoria in negativo (resi
  // oltre le vendite) non ha una fetta, ma resta nell'elenco sotto col suo segno.
  const cats = (brand.categories || [])
  const pieData = cats.filter(c => c.revenue > 0).map((c, i) => ({ name: catLabel(c.name), value: c.revenue, color: CAT_COLORS[i % CAT_COLORS.length] }))
  const colorOf = (name) => { const k = cats.findIndex(c => c.name === name); return CAT_COLORS[(k < 0 ? 0 : k) % CAT_COLORS.length] }
  const d = brand.deltaPct
  const chartBox = {
    padding:18, borderRadius:16,
    background:'linear-gradient(180deg, rgba(255,255,255,0.025), rgba(0,0,0,0.20))',
    border:'1px solid var(--border)', borderTopColor:'rgba(255,255,255,0.10)',
    boxShadow:'inset 0 1px 0 rgba(255,255,255,0.04), 0 4px 12px rgba(0,0,0,0.25)',
    position:'relative', overflow:'hidden',
  }
  const cap = { fontSize:10, fontWeight:640, color:'#a78bfa', letterSpacing:'0.14em', textTransform:'uppercase', marginBottom:12 }

  return (
    <Pannello titolo={brand.brand} sotto={<>{t('kpi.brandCap', null, 'Brand')} · {tfLabel}</>} larghezza={1040} onClose={onClose}>
      <div>
          {/* Intestazione */}
          <div style={{display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:14, marginBottom:22, flexWrap:'wrap'}}>
            <div>
              <div style={{display:'flex', gap:8, flexWrap:'wrap', marginTop:10}}>
                {[
                  { k: t('kpi.revenueWord', null, 'fatturato'), v: money(brand.revenue) },
                  { k: t('kpi.ordersWord', null, 'ordini'), v: int0(brand.orders) },
                  { k: t('kpi.unitsWord', null, 'pezzi'), v: int0(brand.units) },
                  { k: t('kpi.brandShareShort', null, 'quota'), v: `${brand.share}%` },
                ].map(x => (
                  <div key={x.k} className="country-segment-value" style={{padding:'7px 12px', borderRadius:12, background:'var(--glass)', border:'1px solid var(--border)'}}>
                    <div style={{fontSize:15, fontWeight:680, color:'var(--text)'}}>{x.v}</div>
                    <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em'}}>{x.k}</div>
                  </div>
                ))}
                <div className="country-segment-value" style={{padding:'7px 12px', borderRadius:12, background:'var(--glass)', border:'1px solid var(--border)'}}>
                  <div style={{fontSize:15, fontWeight:680, color: d == null ? 'var(--text3)' : d >= 0 ? '#22c55e' : '#ef4444'}}>
                    {d == null ? '—' : `${d >= 0 ? '+' : ''}${d.toLocaleString('it-IT', { maximumFractionDigits: 1 })}%`}
                  </div>
                  <div style={{fontSize:10, color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'.08em'}}>{t('kpi.brandVsPrev', null, 'vs periodo precedente')}</div>
                </div>
              </div>
            </div>
          </div>

          {/* Grafici: mix categorie + andamento giornaliero */}
          <div className="m-stack" style={{display:'grid', gridTemplateColumns:'minmax(0, 1fr) minmax(0, 1.4fr)', gap:14, marginBottom:14}}>
            <div className="country-detail-chart" style={chartBox}>
              <div style={cap}>{t('kpi.brandCategoryMix', null, 'Mix categorie')}</div>
              {pieData.length > 0 ? (
                <>
                  <ResponsiveContainer width="100%" height={220}>
                    <PieChart>
                      <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={92} paddingAngle={3} dataKey="value"
                        isAnimationActive animationDuration={1100} animationEasing="ease-out" stroke="rgba(255,255,255,0.12)" strokeWidth={1.5}>
                        {pieData.map(p => <Cell key={`${safeId}-${p.name}`} fill={p.color} />)}
                      </Pie>
                      <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }} formatter={v => money(v)} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div style={{display:'flex', flexWrap:'wrap', justifyContent:'center', gap:'6px 14px', marginTop:6, fontSize:11.5}}>
                    {pieData.map(p => (
                      <div key={p.name} style={{display:'flex', alignItems:'center', gap:6, color:'var(--text2)', fontWeight:640}}>
                        <div style={{width:10, height:10, borderRadius:6, background:p.color}} />{p.name}
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13}}>{t('kpi.noDataAvailable', null, 'Nessun dato disponibile.')}</div>
              )}
            </div>

            <div className="country-detail-chart" style={chartBox}>
              <div style={cap}>{t('kpi.dailyRevenueTrend', null, 'Trend giornaliero fatturato')}</div>
              {loading ? (
                <div style={{display:'flex', alignItems:'center', justifyContent:'center', height:240, gap:12, color:'var(--text3)'}}>
                  <div style={{width:24, height:24, border:'3px solid var(--border2)', borderTopColor:'#a78bfa', borderRadius:999, animation:'spin 1s linear infinite'}} />
                  <div style={{fontSize:11.5, fontWeight:600, letterSpacing:'0.08em', textTransform:'uppercase'}}>{t('kpi.loadingShort', null, 'Caricamento')}</div>
                </div>
              ) : error ? (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'#fca5a5', fontSize:13, textAlign:'center'}}>{t('kpi.brandsError', { err: error }, `Brand non disponibili: ${error}`)}</div>
              ) : daily.length === 0 ? (
                <div style={{height:240, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13}}>{t('kpi.noDailyData', null, 'Nessun dato giornaliero nel periodo')}</div>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <AreaChart data={daily} margin={{top:8, right:8, left:-8, bottom:0}}>
                    <defs>
                      <linearGradient id={`brandArea-${safeId}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#a78bfa" stopOpacity={0.5}/>
                        <stop offset="100%" stopColor="#a78bfa" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="date" stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={{stroke:'rgba(255,255,255,0.08)'}} tickFormatter={x => x.slice(5)} />
                    <YAxis stroke="var(--text3)" fontSize={10} tickLine={false} axisLine={false} tickFormatter={v => `€${Math.round(v)}`} />
                    <Tooltip
                      contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }}
                      labelStyle={{ color: 'var(--text3)', fontSize: 11.5, marginBottom: 4 }}
                      formatter={(v, n) => n === 'revenue' ? [money(v), t('kpi.revenueWord', null, 'fatturato')] : [int0(v), t('kpi.ordersWord', null, 'ordini')]}
                      cursor={{stroke:'rgba(167,139,250,0.4)', strokeWidth:1, strokeDasharray:'3 3'}}
                    />
                    <Area type="monotone" dataKey="revenue" stroke="#a78bfa" strokeWidth={2.5} fill={`url(#brandArea-${safeId})`} isAnimationActive animationDuration={1300} animationEasing="ease-out" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
          </div>

          {/* Genere: quale pubblico porta fatturato. Se il metafield non risponde
              lo si dice in chiaro, invece di mostrare un riquadro vuoto che
              sembrerebbe un problema di dati. */}
          <div className="country-detail-chart" style={{...chartBox, marginBottom:14}}>
            <div style={cap}>{t('kpi.genderTitle', null, 'Genere')}</div>
            {(brand.genders || []).length === 0 ? (
              <div style={{fontSize:13, color:'var(--text3)'}}>
                {!genderCoverage
                  ? t('kpi.genderMissing', null, 'Metafield del genere non trovato nel catalogo: controlla come si chiama il campo in Shopify.')
                  : t('kpi.genderNone', null, 'Genere non valorizzato su questi prodotti.')}
              </div>
            ) : (
              <>
                <div style={{display:'grid', gap:12}}>
                  {(brand.genders || []).map(g => (
                    <div key={g.name}>
                      <div style={{display:'flex', justifyContent:'space-between', gap:10, fontSize:13, marginBottom:5}}>
                        <span style={{display:'flex', alignItems:'center', gap:7, color:'var(--text)', fontWeight:640}}>
                          <span style={{width:9, height:9, borderRadius:6, background:coloreGenere(nomeGenere(g.name).toUpperCase())}} />{nomeGenere(g.name)}
                        </span>
                        <span style={{color:'var(--text2)', fontWeight:640, whiteSpace:'nowrap'}}>
                          {money(g.revenue)} · {g.share}% · {int0(g.units)} {t('kpi.unitsWord', null, 'pezzi')}
                        </span>
                      </div>
                      <div style={{height:6, background:'var(--surface)', borderRadius:999, overflow:'hidden'}}>
                        <div style={{width:`${Math.max(2, Math.min(100, g.share))}%`, height:'100%', background:coloreGenere(nomeGenere(g.name).toUpperCase()), borderRadius:999}} />
                      </div>
                    </div>
                  ))}
                </div>
                {typeof genderCoverage === 'number' && genderCoverage < 95 && (
                  <div style={{fontSize:10, color:'var(--text3)', marginTop:10}}>
                    {t('kpi.genderCoverage', { pct: genderCoverage }, `Genere valorizzato sul ${genderCoverage}% del fatturato`)}
                  </div>
                )}
              </>
            )}
          </div>

          {/* Categorie con sottocategorie + prodotti top */}
          <div className="m-stack" style={{display:'grid', gridTemplateColumns:'minmax(0, 1.2fr) minmax(0, 1fr)', gap:14}}>
            <div className="country-detail-chart" style={chartBox}>
              <div style={cap}>{t('kpi.brandCategories', { brand: brand.brand }, `Categorie di ${brand.brand}`)}</div>
              <div style={{display:'grid', gap:14}}>
                {cats.map(c => (
                  <div key={c.name || 'none'}>
                    <div style={{display:'flex', justifyContent:'space-between', gap:10, fontSize:13, marginBottom:5}}>
                      <span style={{display:'flex', alignItems:'center', gap:7, color:'var(--text)', fontWeight:640}}>
                        <span style={{width:9, height:9, borderRadius:6, background:colorOf(c.name)}} />{catLabel(c.name)}
                      </span>
                      <span style={{color:'var(--text2)', fontWeight:640, whiteSpace:'nowrap'}}>{money(c.revenue)} · {c.share}% · {int0(c.units)} {t('kpi.unitsWord', null, 'pezzi')}</span>
                    </div>
                    <div style={{height:6, background:'var(--surface)', borderRadius:999, overflow:'hidden'}}>
                      <div style={{width:`${Math.max(2, Math.min(100, c.share))}%`, height:'100%', background:colorOf(c.name), borderRadius:999}} />
                    </div>
                    {(c.subCategories || []).filter(x => x.name).length > 0 && (
                      <div style={{display:'grid', gap:5, marginTop:8, paddingLeft:16}}>
                        {c.subCategories.filter(x => x.name).slice(0, 6).map(x => (
                          <div key={x.name} style={{display:'grid', gridTemplateColumns:'minmax(0,1fr) 90px 44px', alignItems:'center', gap:8, fontSize:11.5}}>
                            <span style={{color:'var(--text2)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{x.name}</span>
                            <div style={{height:4, background:'var(--surface)', borderRadius:999, overflow:'hidden'}}>
                              <div style={{width:`${Math.max(2, Math.min(100, x.share))}%`, height:'100%', background:colorOf(c.name), opacity:0.65, borderRadius:999}} />
                            </div>
                            <span style={{color:'var(--text3)', fontWeight:640, textAlign:'right'}}>{x.share}%</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="country-detail-chart" style={chartBox}>
              <div style={cap}>{t('kpi.brandTopProducts', null, 'Prodotti più venduti')}</div>
              <div style={{display:'grid', gap:10}}>
                {(brand.topProducts || []).map((p, i) => (
                  <div key={p.productId} style={{display:'flex', alignItems:'center', gap:12}}>
                    <div style={{width:18, fontSize:11.5, fontWeight:680, color:'var(--text3)', textAlign:'right', flexShrink:0}}>{i + 1}</div>
                    {p.image
                      ? <img src={miniatura(p.image, 48)} loading="lazy" alt="" style={{width:48, height:48, borderRadius:12, objectFit:'cover', flexShrink:0, border:'1px solid var(--border)'}} onError={e => { e.target.style.display = 'none' }} />
                      : <div style={{width:48, height:48, borderRadius:12, background:'var(--surface)', flexShrink:0}} />}
                    <div style={{minWidth:0, flex:1}}>
                      <div style={{fontSize:13, color:'var(--text)', fontWeight:600, whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis'}}>{p.title}</div>
                      <div style={{fontSize:11.5, color:'var(--text3)', marginTop:2}}>{[p.category, p.subCategory].filter(Boolean).join(' · ')}</div>
                    </div>
                    <div style={{textAlign:'right', flexShrink:0}}>
                      <div style={{fontSize:13, color:'var(--text)', fontWeight:680}}>{money(p.revenue)}</div>
                      <div style={{fontSize:10, color:'var(--text3)', fontWeight:600}}>{int0(p.units)} {t('kpi.unitsWord', null, 'pezzi')}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
      </div>
    </Pannello>
  )
}

// ============================================================================
//  Fasce orarie migliori per giorno — mappa di calore giorno × fascia.
//  Un solo colore in intensita': il valore piu' alto della metrica scelta e'
//  il piu' pieno, cosi' il picco di ogni giorno si vede senza leggere i numeri.
//  La fascia migliore del giorno ha il bordo, ed e' ripetuta nella colonna a
//  destra. Su telefono la griglia scorre di lato con i giorni sempre a vista.
// ============================================================================
const HOURLY_METRICS = ['orders', 'sessions', 'cro']
const HOURLY_BEST_KEY = { orders: 'orders', sessions: 'sessions', cro: 'cro' }

function HourlyBandsPanel({ data, loading, error, metric, setMetric, panel, money, int0, t }) {
  const days = Array.isArray(data?.days) ? data.days : []
  const bands = Array.isArray(data?.bands) ? data.bands : []
  const dayLabel = (d) => t(`kpi.dow${d}`, null, ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'][d])
  const metricLabel = { orders: t('kpi.hourlyMetricOrders', null, 'Ordini'), sessions: t('kpi.hourlyMetricSessions', null, 'Visite'), cro: 'CRO' }
  const fmt = (b) => {
    if (metric === 'cro') return b.cro == null ? '—' : `${b.cro.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
    const v = b[metric] || 0
    if (metric === 'sessions' && v >= 1000) return `${(v / 1000).toLocaleString('it-IT', { maximumFractionDigits: 1 })}k`
    return int0(v)
  }
  // Scala di intensita' sulla metrica scelta, su tutta la settimana: cosi' si
  // confrontano anche i giorni fra loro, non solo le fasce dentro un giorno.
  const minS = data?.minSessionsForCro || 40
  const valueOf = (b) => metric === 'cro' ? (b.sessions >= minS ? (b.cro || 0) : 0) : (b[metric] || 0)
  const max = Math.max(1e-9, ...days.flatMap(d => d.bands.map(valueOf)))
  const cellBg = (b) => { const a = valueOf(b) / max; return a <= 0 ? 'transparent' : `rgba(20,184,166,${(0.08 + a * 0.62).toFixed(3)})` }

  return (
    <div className="kpi-hourly" style={{ ...panel, marginBottom: 16 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, color: 'var(--text)', fontWeight: 640 }}>{t('kpi.hourlyTitle', null, 'Fasce orarie migliori per giorno')}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{t('kpi.hourlySub', null, 'Visite, ordini e conversione per fascia · orario del negozio · senza marketplace')}</div>
        </div>
        <div className="kpi-hourly-switch" role="tablist" style={{ display: 'flex', gap: 4, padding: 3, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border)' }}>
          {HOURLY_METRICS.map(m => (
            <button key={m} type="button" role="tab" aria-selected={metric === m} onClick={() => setMetric(m)}
              style={{ minHeight: 34, padding: '6px 12px', borderRadius: 8, border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 640,
                background: metric === m ? '#14b8a6' : 'transparent', color: metric === m ? '#fff' : 'var(--text2)' }}>
              {metricLabel[m]}
            </button>
          ))}
        </div>
      </div>

      {loading && !data && <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('kpi.hourlyLoading', null, 'Calcolo le fasce orarie…')}</div>}
      {error && <div style={{ color: '#fca5a5', fontSize: 13 }}>{t('kpi.hourlyError', { err: error }, `Fasce orarie non disponibili: ${error}`)}</div>}
      {!loading && !error && data && (data.totals?.sessions || 0) + (data.totals?.orders || 0) === 0 && (
        <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('kpi.hourlyEmpty', null, 'Nessuna visita né ordine nel periodo.')}</div>
      )}

      {days.length > 0 && (
        <div className="kpi-hourly-scroll" style={{ overflowX: 'auto', margin: '0 -4px', padding: '0 4px', opacity: loading ? 0.55 : 1, transition: 'opacity .2s' }}>
          <table style={{ width: '100%', minWidth: 560, borderCollapse: 'separate', borderSpacing: 4, tableLayout: 'fixed' }}>
            <thead>
              <tr>
                <th style={{ width: 48, position: 'sticky', left: 0, zIndex: 1, background: 'var(--glass)', fontSize: 10, fontWeight: 640, color: 'var(--text3)', textAlign: 'left' }}></th>
                {bands.map(b => (
                  <th key={b} style={{ fontSize: 10, fontWeight: 640, color: 'var(--text3)', textAlign: 'center', whiteSpace: 'nowrap', padding: '0 0 2px' }}>{b}</th>
                ))}
                <th style={{ width: 64, fontSize: 10, fontWeight: 640, color: '#14b8a6', textAlign: 'center', whiteSpace: 'nowrap' }}>{t('kpi.hourlyBest', null, 'Migliore')}</th>
              </tr>
            </thead>
            <tbody>
              {days.map(d => {
                const best = d.best?.[HOURLY_BEST_KEY[metric]]
                return (
                  <tr key={d.dow}>
                    <td style={{ position: 'sticky', left: 0, zIndex: 1, background: 'var(--glass)', fontSize: 13, fontWeight: 640, color: 'var(--text)', textAlign: 'left', whiteSpace: 'nowrap' }}>{dayLabel(d.dow)}</td>
                    {d.bands.map(b => (
                      <td key={b.band}
                        title={t('kpi.hourlyCellTitle', { day: dayLabel(d.dow), band: b.band, sessions: int0(b.sessions), orders: int0(b.orders), cro: b.cro == null ? '—' : `${b.cro}%`, revenue: money(b.revenue) }, `${dayLabel(d.dow)} ${b.band}: ${int0(b.sessions)} visite · ${int0(b.orders)} ordini · CRO ${b.cro == null ? '—' : b.cro + '%'} · ${money(b.revenue)}`)}
                        style={{
                          height: 34, borderRadius: 8, textAlign: 'center', verticalAlign: 'middle', fontSize: 11.5, fontWeight: 600,
                          fontVariantNumeric: 'tabular-nums', color: 'var(--text)', background: cellBg(b),
                          outline: best === b.band ? '2px solid #14b8a6' : '1px solid var(--border)', outlineOffset: best === b.band ? -2 : -1,
                        }}>
                        {fmt(b)}
                      </td>
                    ))}
                    <td style={{ textAlign: 'center', fontSize: 13, fontWeight: 680, color: best ? '#14b8a6' : 'var(--text3)', whiteSpace: 'nowrap' }}>{best || '—'}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
      {metric === 'cro' && days.length > 0 && (
        <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('kpi.hourlyCroNote', { n: minS }, `La conversione entra in classifica solo con almeno ${minS} visite nella fascia.`)}</div>
      )}
    </div>
  )
}
