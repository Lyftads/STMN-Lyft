'use client'

import AzioneBarra from './ui/AzioneBarra'
import { Scheletro } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { useStatoTab } from '../../lib/client/statoTab'
import { leggi, inMemoria } from '../../lib/clientCache'
import { Fonte } from './ui/FasceTabella'
import { useState, useEffect, useMemo, useRef } from 'react'
import { ResponsiveContainer, ComposedChart, Area, Line, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import { num, perc } from '../../lib/client/numeri'

const LS_KEY = 'lyft_pnl_cfg'
const DEF_CFG = {
  vatRate: 22, cogsPct: null, packagingPerOrder: 0, shippingPerOrder: 0, gatewayPct: 0, gatewayFixed: 0,
  gatewayFees: {}, // % fee per gateway esterno (PayPal/Klarna/Scalapay/…)
  // righe OPEX suggerite (Shopify non espone piano/app via API → vanno qui)
  fixedCosts: [{ name: 'Shopify (piano)', amount: '' }, { name: 'App Shopify', amount: '' }],
}

const eur = (n) => soldi(n)
const eur2 = (n) => soldi(n)
const pctv = (n) => perc(n, 1)
const MLAB = ['Gen', 'Feb', 'Mar', 'Apr', 'Mag', 'Giu', 'Lug', 'Ago', 'Set', 'Ott', 'Nov', 'Dic']
const MFULL = ['Gennaio', 'Febbraio', 'Marzo', 'Aprile', 'Maggio', 'Giugno', 'Luglio', 'Agosto', 'Settembre', 'Ottobre', 'Novembre', 'Dicembre']
const GW_LABELS = {
  shopify_payments: 'Shopify Payments', paypal: 'PayPal', paypal_express: 'PayPal', braintree: 'PayPal/Braintree',
  klarna: 'Klarna', scalapay: 'Scalapay', revolut: 'Revolut', revolut_pay: 'Revolut', stripe: 'Stripe',
  amazon_payments: 'Amazon Pay', shop_pay_installments: 'Shop Pay Installments', satispay: 'Satispay',
  cash_on_delivery: 'Contrassegno', bank_deposit: 'Bonifico', manual: 'Manuale', gift_card: 'Gift Card', unknown: 'Sconosciuto',
}
const gwLabel = (g) => GW_LABELS[g] || String(g).replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
const monthLabel = (m) => { const [y, mm] = m.split('-').map(Number); return `${MLAB[(mm || 1) - 1]} ${String(y).slice(2)}` }
const monthFull = (m) => { const [y, mm] = m.split('-').map(Number); return `${MFULL[(mm || 1) - 1]} ${y}` }

function Delta({ cur, prev, lowerBetter = false }) {
  if (prev == null || cur == null || !Number.isFinite(prev) || prev === 0) return null
  const dEur = cur - prev
  const dPct = (dEur / Math.abs(prev)) * 100
  const up = dEur > 0
  const good = lowerBetter ? !up : up
  const col = Math.abs(dPct) < 0.05 ? 'var(--text3)' : good ? '#22c55e' : '#ef4444'
  return <span style={{ fontSize: 10, fontWeight: 600, color: col, marginLeft: 6, whiteSpace: 'nowrap' }}>{up ? '▲' : '▼'} {perc(Math.abs(dPct), 0)} ({up ? '+' : '−'}{eur(Math.abs(dEur)).replace('€', '€')})</span>
}

export default function PnLTab({ data = [] }) {
  const { t, intlLocale } = useI18n()
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s
  const monthLabelL = (m) => { const [y, mm] = m.split('-').map(Number); return `${cap(new Date(y, (mm || 1) - 1, 1).toLocaleDateString(intlLocale, { month: 'short' }))} ${String(y).slice(2)}` }
  const monthFullL = (m) => { const [y, mm] = m.split('-').map(Number); return `${cap(new Date(y, (mm || 1) - 1, 1).toLocaleDateString(intlLocale, { month: 'long' }))} ${y}` }
  // Timeframe: questo mese / mese scorso / anno (dinamico) / personalizzato
  const now = new Date()
  const curY = now.getFullYear()
  const YEARS = [curY, curY - 1, curY - 2]
  const [tf, setTf] = useStatoTab('pnL.tf', { kind: 'year', year: curY })
  const [tfOpen, setTfOpen] = useState(false)
  const [cSince, setCSince] = useState('')
  const [cUntil, setCUntil] = useState('')
  const monthsBackTo = (y, m) => Math.max(1, (curY - y) * 12 + (now.getMonth() + 1 - m) + 1)
  // +12 mesi rispetto a quelli mostrati: servono per il confronto con lo stesso
  // mese dell'anno prima. Le query a Shopify restano le stesse (sono GROUP BY
  // month), cambia solo l'ampiezza del periodo.
  const fetchMonths = tf.kind === 'this_month' || tf.kind === 'last_month' ? 15
    : tf.kind === 'year' ? Math.min(60, monthsBackTo(tf.year, 1) + 12)
    : tf.kind === 'custom' && tf.since ? Math.min(60, monthsBackTo(Number(tf.since.slice(0, 4)), Number(tf.since.slice(5, 7))) + 12)
    : 24
  const [state, setState] = useState({ loading: true })
  const [cfg, setCfg] = useState(DEF_CFG)
  const [showCfg, setShowCfg] = useState(false)
  const [refreshKey, setRefreshKey] = useState(0)

  const [saved, setSaved] = useState(false)
  const saveTimer = useRef(null)

  useEffect(() => {
    let alive = true
    // 1) localStorage subito (istantaneo) → 2) account sul server (sovrascrive se presente)
    try { const s = JSON.parse(localStorage.getItem(LS_KEY) || 'null'); if (s) setCfg({ ...DEF_CFG, ...s }) } catch {}
    fetch('/api/pnl/config').then(r => r.json()).then(j => {
      if (alive && j?.config && Object.keys(j.config).length) {
        setCfg({ ...DEF_CFG, ...j.config })
        try { localStorage.setItem(LS_KEY, JSON.stringify(j.config)) } catch {}
      }
    }).catch(() => {})
    return () => { alive = false }
  }, [])

  const saveCfg = (next) => {
    setCfg(next)
    try { localStorage.setItem(LS_KEY, JSON.stringify(next)) } catch {}
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      fetch('/api/pnl/config', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ config: next }) })
        .then(() => { setSaved(true); setTimeout(() => setSaved(false), 2000) }).catch(() => {})
    }, 700)
  }

  const refreshVisto = useRef(refreshKey)
  const cacheRef = useRef({})  // memoria per fetchMonths → niente reload cambiando timeframe
  useEffect(() => {
    let alive = true
    // "Aggiorna" (refreshKey) salta la memoria; tutto il resto la usa, anche
    // dopo aver lasciato la tab ed esserci tornati.
    const forza = refreshVisto.current !== refreshKey
    refreshVisto.current = refreshKey
    const cached = forza ? null : (cacheRef.current[fetchMonths] || inMemoria(`/api/pnl?months=${fetchMonths}`))
    if (cached) { cacheRef.current[fetchMonths] = cached; setState({ loading: false, ...cached }); return () => { alive = false } }
    setState({ loading: true })
    leggi(`/api/pnl?months=${fetchMonths}${forza ? '&refresh=1' : ''}`).then(j => {
      if (!alive) return
      cacheRef.current[fetchMonths] = j
      setState({ loading: false, ...j })
    }).catch(() => alive && setState({ loading: false, configured: false }))
    return () => { alive = false }
  }, [fetchMonths, refreshKey])

  // ── Che tipo di negozio e' questo cliente ─────────────────────────────────
  //  Sul fork erano due certezze: quel negozio vende sui marketplace e ha negozi
  //  fisici. Qui sono due DOMANDE, e per la maggior parte dei clienti la risposta
  //  e' no. Le righe «di cui marketplace», «Commissioni marketplace» e «di cui
  //  Drive to Store» sarebbero tre zeri fissi in mezzo al conto economico: non
  //  un errore, ma rumore che fa sembrare incompleto un conto che e' completo.
  //  null = non si sa ancora: nel dubbio le righe non si disegnano, e non si
  //  chiama il Drive to Store. Stesso ripiego «spento» delle route.
  const [negozio, setNegozio] = useState(null)
  useEffect(() => {
    let vivo = true
    // no-store: e' un dato del TENANT, non deve sopravvivere a un cambio di
    // workspace dell'agenzia.
    fetch('/api/integrations/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(s => { if (vivo) setNegozio(s?.tipoNegozio || {}) })
      .catch(() => { if (vivo) setNegozio({}) })
    return () => { vivo = false }
  }, [])
  const haMarketplace = (negozio?.canaliEsclusi?.length || 0) > 0
  const haNegoziFisici = negozio?.negoziFisici === true

  // Le campagne Drive to Store sono scorporate da tutte le metriche dell'app, e
  // quindi anche dalla serie mensile da cui questo conto legge la spesa Meta.
  // Ma QUI devono restare: sono un costo vero dell'azienda. Si rimettono dentro
  // apposta, con la loro riga — la stessa lezione dei marketplace: quando si
  // toglie qualcosa da una sorgente condivisa, il conto economico si restringe
  // senza che nessuno lo abbia chiesto.
  const [dtsPerMese, setDtsPerMese] = useState({})
  useEffect(() => {
    if (!haNegoziFisici) { setDtsPerMese({}); return }
    let vivo = true
    leggi('/api/drive-to-store?part=monthly').then(j => { if (vivo && j?.ok) setDtsPerMese(j.perMese || {}) }).catch(() => {})
    return () => { vivo = false }
  }, [haNegoziFisici])

  // spesa ads per mese dal data mensile dell'app
  const adByMonth = useMemo(() => {
    const m = {}
    for (const r of (data || [])) { if (r?.month) m[r.month] = (Number(r.metaSpend) || 0) + (Number(r.googleSpend) || 0) }
    return m
  }, [data])

  // Advertising per canale. Il totale da solo non dice dove stanno i soldi:
  // due piattaforme con la stessa spesa e risultati opposti sono la cosa piu'
  // comune che ci sia, e il conto deve farle vedere separate.
  const adsByChannel = useMemo(() => {
    const m = {}
    for (const r of (data || [])) {
      if (!r?.month) continue
      m[r.month] = { meta: Number(r.metaSpend) || 0, google: Number(r.googleSpend) || 0 }
    }
    return m
  }, [data])

  // Fatturato (incl. IVA) dal monthly dell'app. Qui si RIMETTE dentro il
  // marketplace: nelle altre tab il fatturato ne e' privo apposta (non l'ha
  // portato la pubblicita'), ma il conto economico e' l'azienda intera e
  // toglierlo la farebbe sembrare piu' piccola di com'e'.
  const fattByMonth = useMemo(() => {
    const m = {}
    for (const r of (data || [])) { if (r?.month) m[r.month] = (Number(r.fatturato) || 0) + (Number(r.koongo) || 0) }
    return m
  }, [data])

  // Fatturato marketplace per mese. Arriva dalla serie mensile che questa tab
  // ha gia' fra le mani: chiederlo di nuovo a Shopify voleva dire una nona
  // query ShopifyQL in fila, e Shopify le strozza in burst — quella query
  // tornava vuota e la voce spariva dal conto.
  const koongoByMonth = useMemo(() => {
    const m = {}
    for (const r of (data || [])) { if (r?.month) m[r.month] = Number(r.koongo) || 0 }
    return m
  }, [data])

  const cogsRatio = cfg.cogsPct != null ? cfg.cogsPct / 100 : (state.cogsRatio ?? null)
  const fixedTotal = (cfg.fixedCosts || []).reduce((s, f) => s + (Number(f.amount) || 0), 0)

  // costruisci P&L per mese
  const rows = useMemo(() => {
    const series = state.series || []
    return series.map(s => {
      const net = s.netSales
      // priorità: override manuale % → COGS reale mensile da Shopify → ratio margine medio
      const realCogs = (state.cogsByMonth && state.cogsByMonth[s.month] != null) ? state.cogsByMonth[s.month] : null
      const cogs = cfg.cogsPct != null
        ? net * (cfg.cogsPct / 100)
        : (realCogs != null ? realCogs : (state.cogsRatio != null ? net * state.cogsRatio : null))
      const grossMargin = cogs != null ? net - cogs : null
      const adsDts = dtsPerMese[s.month] ?? dtsPerMese[String(s.month || '').slice(0, 7)] ?? 0
      const ads = (adByMonth[s.month] ?? 0) + adsDts
      const adsMeta = (adsByChannel[s.month]?.meta ?? 0) + adsDts
      const adsGoogle = adsByChannel[s.month]?.google ?? 0
      // Fee gateway: Shopify Payments = reale (o stima % sulla sua quota); gli altri
      // gateway (PayPal/Klarna/Scalapay/…) = loro quota di fatturato × % impostata.
      const base = s.totalSales
      const realSP = (state.feesByMonth && state.feesByMonth[s.month] != null) ? state.feesByMonth[s.month] : null
      const gwMix = state.gatewayMix?.mix, gwTotal = state.gatewayMix?.total || 0
      let fee
      if (gwMix && gwTotal > 0) {
        const isSP = (g) => g === 'shopify_payments'
        const spShare = Object.keys(gwMix).filter(isSP).reduce((a, g) => a + (gwMix[g] / gwTotal), 0)
        const spFee = realSP != null ? realSP : base * spShare * ((cfg.gatewayPct || 0) / 100)
        let otherFee = 0
        for (const g of Object.keys(gwMix)) { if (isSP(g)) continue; otherFee += base * (gwMix[g] / gwTotal) * ((cfg.gatewayFees?.[g] || 0) / 100) }
        fee = spFee + otherFee + s.orders * (cfg.gatewayFixed || 0)
      } else {
        fee = realSP != null ? realSP : (base * (cfg.gatewayPct || 0) / 100 + s.orders * (cfg.gatewayFixed || 0))
      }
      const packaging = s.orders * (cfg.packagingPerOrder || 0)
      const shipCost = s.orders * (cfg.shippingPerOrder || 0)
      // Commissione del marketplace: Amazon trattiene una quota su quello che
      // vende, e quei soldi non entrano mai in cassa. Si applica SOLO al
      // fatturato Koongo, non a tutto: sul negozio non c'e' nessuna trattenuta.
      const koongoRev = koongoByMonth[s.month] || 0
      const mkFeePct = cfg.marketplaceFeePct != null ? cfg.marketplaceFeePct : 15
      const marketplaceFee = koongoRev > 0 ? koongoRev * (mkFeePct / 100) : 0
      const contrib = grossMargin != null ? grossMargin - ads - fee - packaging - shipCost - marketplaceFee : null
      const ebit = contrib != null ? contrib - fixedTotal : null
      const ebitPct = ebit != null && net > 0 ? (ebit / net) * 100 : null
      // Fatturato (incl. IVA): dal monthly app (come le altre tab); fallback a total_sales ShopifyQL
      const fatturato = (fattByMonth[s.month] != null && fattByMonth[s.month] > 0) ? fattByMonth[s.month] : s.totalSales
      return { ...s, koongo: koongoRev, fatturato, net, cogs, grossMargin, ads, adsMeta, adsDts, adsGoogle, fee, packaging, shipCost, marketplaceFee, contrib, fixed: fixedTotal, ebit, ebitPct }
    })
  }, [state.series, state.feesByMonth, state.gatewayMix, state.cogsByMonth, state.cogsRatio, cogsRatio, adByMonth, adsByChannel, dtsPerMese, fattByMonth, koongoByMonth, cfg, fixedTotal])

  const annual = useMemo(() => {
    if (!rows.length) return null
    const sum = (k) => rows.reduce((a, r) => a + (Number(r[k]) || 0), 0)
    const net = sum('net'), ebit = sum('ebit')
    return {
      grossSales: sum('grossSales'), taxes: sum('taxes'), net, cogs: sum('cogs'), grossMargin: sum('grossMargin'),
      fatturato: sum('fatturato'), koongo: sum('koongo'), marketplaceFee: sum('marketplaceFee'),
      ads: sum('ads'), adsMeta: sum('adsMeta'), adsDts: sum('adsDts'), adsGoogle: sum('adsGoogle'),
      fee: sum('fee'), packaging: sum('packaging'), shipCost: sum('shipCost'), contrib: sum('contrib'),
      fixed: fixedTotal * rows.length, ebit, ebitPct: net > 0 ? (ebit / net) * 100 : null, orders: sum('orders'),
    }
  }, [rows, fixedTotal])

  const desc = [...rows].reverse() // più recente in alto
  // Voci del conto economico (righe); i mesi sono le colonne
  const lines = [
    { label: t('pnl.lineFatturato', null, 'Fatturato (incl. IVA)'), key: 'fatturato', fonte: ['shopify'] },
    // Non si sottrae: si dice soltanto quanta parte del fatturato arriva dai
    // marketplace. E' fatturato che non nasce dalla pubblicita', e leggere il
    // conto senza saperlo porta a conclusioni sbagliate sul marketing.
    haMarketplace && { label: t('pnl.lineKoongo', null, 'di cui marketplace (Koongo)'), key: 'koongo', fonte: ['shopify'], sub: true },
    { label: t('pnl.lineVat', null, 'IVA'), key: 'taxes', fonte: ['shopify'] },
    { label: t('pnl.lineNet', null, 'Ricavi netti (ex-IVA)'), key: 'net', strong: true , gapAfter: true },
    // ↑ quanto e' entrato   ↓ quanto e' costato produrlo
    { label: t('pnl.lineCogs', null, 'COGS (costo prodotti)'), key: 'cogs', fonte: ['shopify'], neg: true },
    { label: t('pnl.lineGrossMargin', null, 'Margine lordo'), key: 'grossMargin', strong: true , gapAfter: true },
    // ↑ cosa resta sul prodotto   ↓ cosa costa venderlo
    { label: t('pnl.lineAds', null, 'Advertising'), key: 'ads', fonte: ['meta', 'google'], neg: true },
    // Rientrate sotto il totale: sono il suo dettaglio, non due costi in piu'.
    // Somma gia' contata in "Advertising", quindi qui niente doppio conteggio.
    { label: t('pnl.lineAdsMeta', null, 'di cui Meta'), key: 'adsMeta', fonte: ['meta'], neg: true, sub: true },
    // Dentro a "di cui Meta": e' il suo dettaglio. Nel resto dell'app questa spesa
    // non c'e' (non porta traffico al sito), qui si' perche' e' un costo.
    haNegoziFisici && { label: t('pnl.lineAdsDts', null, 'di cui Drive to Store (negozi fisici)'), key: 'adsDts', fonte: ['meta'], neg: true, sub: true },
    { label: t('pnl.lineAdsGoogle', null, 'di cui Google'), key: 'adsGoogle', fonte: ['google'], neg: true, sub: true },
    { label: t('pnl.lineFee', null, 'Fee gateway'), key: 'fee', neg: true, badge: state.feesSource === 'shopify-payments' ? { text: t('pnl.badgeReal', null, 'reale'), real: true } : { text: t('pnl.badgeEst', null, 'stima'), real: false } },
    // Subito sotto la fee del gateway: sono la stessa cosa — una trattenuta di
    // chi incassa per conto tuo — e si leggono una sotto l'altra. Sempre a
    // vista, anche a zero: e' una voce fissa del conto di CHI VENDE sui
    // marketplace. Per gli altri non e' una voce a zero, e' una voce che non
    // esiste, e mostrarla sarebbe come stampare «Affitto negozi: €0» a chi
    // vende solo online.
    haMarketplace && { label: t('pnl.lineMarketplaceFee', { pct: (cfg.marketplaceFeePct ?? 15) }, `Commissioni marketplace (${cfg.marketplaceFeePct ?? 15}%)`), key: 'marketplaceFee', neg: true, badge: { text: t('pnl.badgeEst', null, 'stima'), real: false } },
    { label: t('pnl.linePackaging', null, 'Packaging'), key: 'packaging', neg: true },
    { label: t('pnl.lineShipping', null, 'Spedizione (corriere)'), key: 'shipCost', neg: true , gapAfter: true },
    // ↑ costi che seguono le vendite   ↓ costi che ci sono comunque
    // Costi fissi: una riga per ogni voce inserita a mano + sottototale
    ...(cfg.fixedCosts || []).filter(f => Number(f.amount) > 0).map((f, i) => ({
      label: f.name || t('pnl.fixedUnnamed', null, 'Costo fisso'), key: `fx${i}`, fixedVal: Number(f.amount) || 0, neg: true, noMoM: true, sub: true,
    })),
    { label: t('pnl.lineFixed', null, 'Costi fissi (OPEX)'), key: 'fixed', neg: true, strong: true , gapAfter: true },
    // ↑ tutto cio' che si sottrae   ↓ cosa rimane
    { label: t('pnl.lineContrib', null, 'Margine contribuzione'), key: 'contrib', strong: true },
    { label: t('pnl.lineEbit', null, 'EBIT (utile)'), key: 'ebit', ebit: true },
    { label: t('pnl.lineEbitPct', null, 'EBIT %'), key: 'ebitPct', pct: true , gapAfter: true },
    // ↑ il risultato   ↓ il volume che ci sta dietro
    { label: t('pnl.lineOrders', null, 'Ordini'), key: 'orders', fonte: ['shopify'], int: true },
    // Le righe legate ai marketplace e ai negozi fisici sopra valgono `false` per
    // chi non ha quelle funzioni: qui si tolgono davvero, o finirebbero in
    // tabella come celle vuote senza etichetta.
  ].filter(Boolean)
  // mese precedente per ogni mese (per la variazione MoM, indipendente da cosa mostro)
  const prevOf = {}
  rows.forEach((r, i) => { prevOf[r.month] = i > 0 ? rows[i - 1] : null })
  // mesi mostrati: tutti (finestra) oppure solo ultimo / precedente
  const asc = tf.kind === 'this_month' ? rows.slice(-1)
    : tf.kind === 'last_month' ? rows.slice(-2, -1)
    : tf.kind === 'year' ? rows.filter(r => r.month.startsWith(`${tf.year}-`))
    : tf.kind === 'custom' ? rows.filter(r => { const s = tf.since?.slice(0, 7), u = tf.until?.slice(0, 7); return (!s || r.month >= s) && (!u || r.month <= u) })
    : rows
  const totSum = (key) => asc.reduce((a, r) => a + (Number(r[key]) || 0), 0)
  const totalOf = (key) => key === 'ebitPct' ? (totSum('net') > 0 ? totSum('ebit') / totSum('net') * 100 : null) : totSum(key)
  // Le colonne dell'incidenza nascono CHIUSE: raddoppiano il numero di colonne,
  // e chi apre il conto economico vuole prima vedere gli euro. Restano li' come
  // una striscia stretta su cui si clicca per aprirle tutte insieme.
  const [incAperta, setIncAperta] = useState(false)
  // Anche il confronto con l'anno prima nasce chiuso: e' un secondo numero
  // accanto a ogni mese, e chi apre il conto vuole prima vedere quello di oggi.
  const [yoyAperta, setYoyAperta] = useState(false)
  // Barra di scorrimento anche in ALTO: con dodici mesi per tre colonne la
  // tabella e' piu' alta dello schermo, e per scorrere in orizzontale bisogna
  // scendere in fondo, spostarsi, e risalire. Due barre gemelle, sincronizzate.
  const tabRef = useRef(null)
  const topRef = useRef(null)
  const [larghezzaTab, setLarghezzaTab] = useState(0)
  const [serveScroll, setServeScroll] = useState(false)
  const perMese = useMemo(() => Object.fromEntries(rows.map(r => [r.month, r])), [rows])
  const meseAnnoPrima = (m) => {
    if (!m) return null
    const [y, mm] = String(m).split('-')
    return `${Number(y) - 1}-${mm}`
  }
  const rigaAnnoPrima = (m) => perMese[meseAnnoPrima(m)] || null

  // Totale dell'anno prima: gli STESSI mesi mostrati, dodici mesi indietro. Non
  // "l'anno solare precedente": se guardo marzo-maggio voglio marzo-maggio.
  const totalePrec = (line) => {
    if (line.key === 'ebitPct') {
      const net = asc.reduce((a, r) => a + (Number(rigaAnnoPrima(r.month)?.net) || 0), 0)
      const ebit = asc.reduce((a, r) => a + (Number(rigaAnnoPrima(r.month)?.ebit) || 0), 0)
      return net > 0 ? (ebit / net) * 100 : null
    }
    if (line.fixedVal != null) return line.fixedVal * asc.length
    let trovato = false
    const somma = asc.reduce((a, r) => {
      const rp = rigaAnnoPrima(r.month)
      if (!rp) return a
      trovato = true
      return a + (Number(rp[line.key]) || 0)
    }, 0)
    return trovato ? somma : null
  }

  const showTotal = asc.length > 1
  // voce + (anno prima + mese + incidenza) per ogni mese + il totale con le sue
  const nColonne = 1 + asc.length * 3 + (showTotal ? 3 : 0)

  // La larghezza da replicare cambia quando si aprono le colonne o cambia il
  // periodo: si rimisura da sola invece di fidarsi di un conto fatto una volta.
  useEffect(() => {
    const el = tabRef.current
    if (!el) return
    const misura = () => {
      setLarghezzaTab(el.scrollWidth)
      setServeScroll(el.scrollWidth > el.clientWidth + 1)
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [asc.length, incAperta, yoyAperta, rows.length, showTotal])

  const fmtCell = (line, v) => line.pct ? pctv(v) : line.int ? (v == null ? '—' : Math.round(v).toLocaleString('it-IT', { useGrouping: 'always' })) : eur(v)

  // Incidenza sul fatturato: il valore assoluto dice quanto, la percentuale
  // dice quanto PESA — ed e' la seconda a far vedere se un costo sta scappando
  // mentre il fatturato cresce. Si calcola solo sulle righe in euro: su "EBIT %"
  // sarebbe la percentuale di una percentuale, e su "Ordini" non vuol dire nulla.
  const incidenza = (line, valore, fatturato) => {
    if (line.pct || line.int) return null
    const f = Number(fatturato)
    const v = Number(valore)
    if (!Number.isFinite(f) || f === 0 || !Number.isFinite(v)) return null
    return (v / f) * 100
  }
  const fmtInc = (n) => n == null ? '' : perc(n, 1)

  return (
    // Nessun tetto di larghezza: un conto economico e' una griglia di mesi, e
    // ogni pixel tolto e' una colonna in meno che si legge senza scorrere.
    <div style={{ width: '100%' }}>
      <div className="rep-toolbar" style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="rep-desc" style={{ fontSize: 13, opacity: 0.6, flex: 1 }}>{t('pnl.desc', null, 'Conto economico mensile · ricavi e costi reali (Shopify + Ads) con variazioni mese su mese e totale annuale.')}</div>
        {(() => {
          const tfLabel = tf.kind === 'this_month' ? t('pnl.tfThisMonth', null, 'Questo mese')
            : tf.kind === 'last_month' ? t('pnl.tfLastMonth', null, 'Mese scorso')
            : tf.kind === 'year' ? String(tf.year)
            : (tf.since && tf.until) ? `${tf.since} → ${tf.until}` : t('pnl.tfCustom', null, 'Personalizzato')
          const presets = [
            { id: 'this_month', label: t('pnl.tfThisMonth', null, 'Questo mese'), on: tf.kind === 'this_month', set: () => setTf({ kind: 'this_month' }) },
            { id: 'last_month', label: t('pnl.tfLastMonth', null, 'Mese scorso'), on: tf.kind === 'last_month', set: () => setTf({ kind: 'last_month' }) },
            ...YEARS.map(y => ({ id: 'y' + y, label: String(y), on: tf.kind === 'year' && tf.year === y, set: () => setTf({ kind: 'year', year: y }) })),
          ]
          return (
            <div className="rep-period" style={{ position: 'relative' }}>
              <button onClick={() => setTfOpen(o => !o)} style={{ ...inp, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 10, minWidth: 150, justifyContent: 'space-between' }}>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 7 }}><Icon name="calendar" size={13} /> {tfLabel}</span>
                <span style={{ fontSize: 10, opacity: 0.6 }}>▼</span>
              </button>
              {tfOpen && (
                <>
                  <div onClick={() => setTfOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 40 }} />
                  <div className="tfs-pop" style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 50, background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 8, minWidth: 240, boxShadow: '0 18px 44px rgba(0,0,0,0.5)' }}>
                    {presets.map(p => (
                      <button key={p.id} onClick={() => { p.set(); setTfOpen(false) }} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: p.on ? 'var(--neutro-bg)' : 'transparent', border: 'none', borderRadius: 8, padding: '9px 11px', color: 'var(--text)', fontSize: 13, fontWeight: p.on ? 800 : 600, cursor: 'pointer' }}>
                        {p.label}{p.on && <Icon name="check" size={13} />}
                      </button>
                    ))}
                    <div style={{ borderTop: '1px solid var(--border)', margin: '8px 4px', paddingTop: 10 }}>
                      <div style={{ fontSize: 11.5, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', padding: '0 7px 8px' }}>{t('pnl.tfCustom', null, 'Personalizzato')}</div>
                      <div style={{ display: 'flex', gap: 8, padding: '0 7px' }}>
                        <input type="date" value={cSince} onChange={e => setCSince(e.target.value)} style={{ ...inp, padding: '7px 9px', fontSize: 13, flex: 1, colorScheme: 'dark' }} />
                        <input type="date" value={cUntil} onChange={e => setCUntil(e.target.value)} style={{ ...inp, padding: '7px 9px', fontSize: 13, flex: 1, colorScheme: 'dark' }} />
                      </div>
                      <button disabled={!cSince || !cUntil} onClick={() => { setTf({ kind: 'custom', since: cSince, until: cUntil }); setTfOpen(false) }} style={{ width: 'calc(100% - 14px)', margin: '8px 7px 0', background: cSince && cUntil ? 'var(--accent)' : 'var(--glass)', border: 'none', borderRadius: 8, padding: '8px', color: '#fff', fontSize: 13, fontWeight: 640, cursor: cSince && cUntil ? 'pointer' : 'default', opacity: cSince && cUntil ? 1 : 0.5 }}>{t('pnl.tfApply', null, 'Applica periodo')}</button>
                    </div>
                  </div>
                </>
              )}
            </div>
          )
        })()}
        <button className="rep-btn" onClick={() => setShowCfg(v => !v)} style={{ ...inp, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Icon name="gear" size={13} /> {t('pnl.costsSettings', null, 'Costi & impostazioni')}</button>
        <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => { cacheRef.current = {}; setRefreshKey(k => k + 1) }} disabled={state.loading} gira={state.loading} />
      </div>

      {showCfg && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px,1fr))', gap: 14, marginBottom: 16 }}>
            <Field label={t('pnl.cogsField', null, 'COGS % (se costi Shopify mancanti)')} value={cfg.cogsPct ?? ''} ph={state.avgMargin != null ? t('pnl.cogsAutoPh', { n: num(100 - state.avgMargin, 0) }, `auto: ${perc(100 - state.avgMargin, 0)}`) : t('pnl.eg40', null, 'es. 40')} onChange={v => saveCfg({ ...cfg, cogsPct: v === '' ? null : Number(v) })} />
            <Field label={t('pnl.packagingField', null, 'Packaging €/ordine')} value={cfg.packagingPerOrder} onChange={v => saveCfg({ ...cfg, packagingPerOrder: Number(v) || 0 })} />
            <Field label={t('pnl.shippingField', null, 'Spedizione corriere €/ordine')} value={cfg.shippingPerOrder} ph={t('pnl.eg550', null, 'es. 5.50 (tariffa media)')} onChange={v => saveCfg({ ...cfg, shippingPerOrder: Number(v) || 0 })} />
            <Field label={t('pnl.gatewayPctField', null, 'Fee gateway %')} value={cfg.gatewayPct} ph={state.feesSource === 'shopify-payments' ? t('pnl.autoShopifyPay', null, 'auto da Shopify Payments') : t('pnl.eg15', null, 'es. 1.5')} onChange={v => saveCfg({ ...cfg, gatewayPct: Number(v) || 0 })} />
            <Field label={t('pnl.gatewayFixedField', null, 'Fee gateway € fisso/ordine')} value={cfg.gatewayFixed} onChange={v => saveCfg({ ...cfg, gatewayFixed: Number(v) || 0 })} />
            {/* La percentuale si cambia da qui: le commissioni dei marketplace
                si rinegoziano e cambiano per categoria, e un 15 scritto nel
                codice invecchia senza che nessuno se ne accorga. */}
            {haMarketplace && <Field label={t('pnl.marketplaceFeeField', null, 'Commissione marketplace % (Koongo)')} value={cfg.marketplaceFeePct ?? ''} ph={t('pnl.eg15pct', null, 'es. 15')} onChange={v => saveCfg({ ...cfg, marketplaceFeePct: v === '' ? null : Number(v) })} />}
          </div>
          {state.gatewayMix?.mix && Object.keys(state.gatewayMix.mix).length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>{t('pnl.gwFeesTitle', null, 'Fee per metodo di pagamento (% sulla quota di fatturato · letta da Shopify)')}</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px,1fr))', gap: 10 }}>
                {Object.entries(state.gatewayMix.mix).sort((a, b) => b[1] - a[1]).map(([g, rev]) => {
                  const share = state.gatewayMix.total > 0 ? Math.round((rev / state.gatewayMix.total) * 100) : 0
                  const isSP = g === 'shopify_payments'
                  return (
                    <div key={g} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 11px' }}>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{gwLabel(g)}</div>
                        <div style={{ fontSize: 10, color: 'var(--text3)' }}>{share}% {t('pnl.gwOfRevenue', null, 'del fatturato')}</div>
                      </div>
                      {isSP
                        ? <span style={{ fontSize: 10, fontWeight: 640, color: state.feesSource === 'shopify-payments' ? '#22c55e' : '#f59e0b', background: state.feesSource === 'shopify-payments' ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${state.feesSource === 'shopify-payments' ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}`, borderRadius: 999, padding: '3px 8px', whiteSpace: 'nowrap' }}>{state.feesSource === 'shopify-payments' ? t('pnl.gwAuto', null, 'auto · reale') : t('pnl.gwSP', null, 'usa Fee %')}</span>
                        : <input value={cfg.gatewayFees?.[g] ?? ''} type="number" placeholder="%" onChange={e => saveCfg({ ...cfg, gatewayFees: { ...(cfg.gatewayFees || {}), [g]: Number(e.target.value) || 0 } })} style={{ ...inp, width: 72, padding: '7px 9px', textAlign: 'right' }} />}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
          <div style={{ fontSize: 13, opacity: 0.6, marginBottom: 8 }}>{t('pnl.opex', null, 'Costi fissi mensili (OPEX)')}</div>
          {(cfg.fixedCosts || []).map((f, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input value={f.name} placeholder={t('pnl.itemPh', null, 'Voce (es. Affitto)')} onChange={e => { const fc = [...cfg.fixedCosts]; fc[i] = { ...fc[i], name: e.target.value }; saveCfg({ ...cfg, fixedCosts: fc }) }} style={{ ...inp, flex: 1 }} />
              <input value={f.amount} type="number" placeholder={t('pnl.perMonthPh', null, '€/mese')} onChange={e => { const fc = [...cfg.fixedCosts]; fc[i] = { ...fc[i], amount: e.target.value }; saveCfg({ ...cfg, fixedCosts: fc }) }} style={{ ...inp, width: 130 }} />
              <button onClick={() => saveCfg({ ...cfg, fixedCosts: cfg.fixedCosts.filter((_, j) => j !== i) })} style={{ ...inp, cursor: 'pointer', width: 40 }}>×</button>
            </div>
          ))}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={() => saveCfg({ ...cfg, fixedCosts: [...(cfg.fixedCosts || []), { name: '', amount: '' }] })} style={{ ...inp, cursor: 'pointer' }}>{t('pnl.addFixed', null, '+ Aggiungi costo fisso')}</button>
            <span style={{ fontSize: 11.5, color: saved ? '#22c55e' : 'var(--text3)' }}>{saved ? t('pnl.savedAccount', null, '✓ Salvato sul tuo account') : t('pnl.autoSaveAccount', null, 'Si salva automaticamente sul tuo account')}</span>
          </div>
          <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 12 }}>
            {t('pnl.cogsLabel', null, 'COGS:')} {cfg.cogsPct != null ? t('pnl.cogsOverride', { n: cfg.cogsPct }, `override manuale ${cfg.cogsPct}%`) : state.cogsSource === 'shopify' ? t('pnl.cogsReal', null, 'reale dalle analitiche Shopify ✓ (cost_of_goods_sold)') : state.cogsRatio != null ? t('pnl.cogsEstimate', { n: state.avgMargin }, `stima da margine medio catalogo ${state.avgMargin}%`) : t('pnl.cogsSetHere', null, 'imposta una % qui')} · {t('pnl.feeLabel', null, 'Fee:')} {state.feesSource === 'shopify-payments' ? t('pnl.feeReal', null, 'reali da Shopify Payments ✓') : t('pnl.feeEstimate', null, 'stima da % (Shopify Payments non disponibile)')}
          </div>
        </div>
      )}

      {state.loading && <Scheletro kpi={0} righe={10} />}
      {!state.loading && !state.configured && <div className="glass-card" style={{ padding: 20, fontSize: 13, color: '#ef4444' }}><Icon name="warning" size={13} /> {state.error || t('pnl.notConfigured', null, 'Shopify non configurato.')}</div>}
      {!state.loading && state.configured && rows.length === 0 && <div className="glass-card" style={{ padding: 20, fontSize: 13 }}>{t('pnl.noDataPeriod', null, 'Nessun dato nel periodo.')}</div>}

      {!state.loading && asc.length > 1 && (
        <div className="glass-card" style={{ padding: 20, marginBottom: 16, position: 'relative', zIndex: 1 }}>
          <GraficoPnL asc={asc} monthLabelL={monthLabelL} t={t} />
        </div>
      )}

      {!state.loading && rows.length > 0 && (
        // Fuori dalla card: il vetro attorno a una tabella larga mangia spazio
        // ai lati e non aggiunge niente da leggere. Restano le righe a separare.
        // position:relative + z-index: senza, l'ombra della card del grafico
        // qui sopra sborda e annerisce le prime righe. Sembra un problema di
        // colore del testo e invece e' un'ombra che sta davanti.
        <>
        {serveScroll && (
          <div ref={topRef} className="pnl-scroll-sopra"
            onScroll={() => { if (tabRef.current && topRef.current) tabRef.current.scrollLeft = topRef.current.scrollLeft }}
            style={{ position: 'relative', zIndex: 2, width: '100%', overflowX: 'auto', overflowY: 'hidden', height: 12 }}>
            <div style={{ width: larghezzaTab, height: 1 }} />
          </div>
        )}
        <div ref={tabRef} className="rep-matrix"
          onScroll={() => { if (topRef.current && tabRef.current) topRef.current.scrollLeft = tabRef.current.scrollLeft }}
          style={{ position: 'relative', zIndex: 2, width: '100%', overflowX: 'auto', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
          <table className="tab-lyft" style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
            <thead>
              <tr>
                <th className="rep-label" style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', minWidth: 200 }}>{t('pnl.colItem', null, 'Voce')}</th>
                {asc.map(r => [
                  <th key={`${r.month}-yoy`} className="rep-side" onClick={() => setYoyAperta(v => !v)}
                    style={{ ...thYoy, ...(yoyAperta ? null : thYoyChiusa) }}
                    title={yoyAperta ? t('pnl.colYoyHide', null, 'Nascondi lo stesso mese dell’anno prima') : t('pnl.colYoyShow', null, 'Mostra lo stesso mese dell’anno prima')}>
                    {yoyAperta ? monthFullL(meseAnnoPrima(r.month)) : String(meseAnnoPrima(r.month) || '').slice(2, 4)}
                  </th>,
                  <th key={r.month} className="rep-val" style={{ ...th, minWidth: 110 }}>{monthFullL(r.month)}</th>,
                  <th key={`${r.month}-inc`} className="rep-side" onClick={() => setIncAperta(v => !v)}
                    style={{ ...thInc, ...(incAperta ? null : thIncChiusa) }}
                    title={incAperta ? t('pnl.colIncidenceHide', null, 'Nascondi l’incidenza sul fatturato') : t('pnl.colIncidenceShow', null, 'Mostra l’incidenza sul fatturato')}>
                    {incAperta ? t('pnl.colIncidence', null, '% fatt.') : '%'}
                  </th>,
                ])}
                {showTotal && <th onClick={() => setYoyAperta(v => !v)}
                  style={{ ...thYoy, ...(yoyAperta ? null : thYoyChiusa) }}
                  title={yoyAperta ? t('pnl.colYoyHide', null, 'Nascondi lo stesso mese dell’anno prima') : t('pnl.colYoyShow', null, 'Mostra lo stesso mese dell’anno prima')}>
                  {yoyAperta ? t('pnl.colTotalPrev', null, 'Totale anno prima') : t('pnl.colPrevShort', null, 'prec.')}
                </th>}
                {showTotal && <th className="rep-val" style={{ ...th, minWidth: 120, color: 'var(--accent)' }}>{t('pnl.colTotal', null, 'Totale')}</th>}
                {showTotal && <th onClick={() => setIncAperta(v => !v)}
                  style={{ ...thInc, ...(incAperta ? null : thIncChiusa) }}
                  title={incAperta ? t('pnl.colIncidenceHide', null, 'Nascondi l’incidenza sul fatturato') : t('pnl.colIncidenceShow', null, 'Mostra l’incidenza sul fatturato')}>
                  {incAperta ? t('pnl.colIncidence', null, '% fatt.') : '%'}
                </th>}
              </tr>
            </thead>
            <tbody>
              {lines.map(line => {
                const total = line.fixedVal != null ? line.fixedVal * asc.length : totalOf(line.key)
                const baseTd = { ...td, ...(line.strong ? { fontWeight: 600 } : {}) }
                const colorOf = (v) => line.ebit ? (v >= 0 ? '#22c55e' : '#ef4444') : undefined
                const riga = (
                  <tr key={line.key} style={line.ebit ? { background: 'rgba(48,209,88,0.05)' } : line.strong ? { background: 'var(--glass)' } : undefined}>
                    <td className={line.sub ? 'rep-label rep-sub' : 'rep-label'} style={{ ...baseTd, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)', paddingLeft: line.sub ? 28 : undefined, color: line.sub ? 'var(--text2)' : undefined, fontWeight: line.strong || line.ebit ? 700 : line.sub ? 500 : 500 }}>{line.label}<Fonte loghi={line.fonte} dopo />{line.badge && <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 999, color: line.badge.real ? '#22c55e' : '#f59e0b', background: line.badge.real ? 'rgba(52,211,153,0.12)' : 'rgba(245,158,11,0.12)', border: `1px solid ${line.badge.real ? 'rgba(52,211,153,0.3)' : 'rgba(245,158,11,0.3)'}` }}>{line.badge.text}</span>}</td>
                    {asc.map((r) => {
                      const cur = line.fixedVal != null ? line.fixedVal : r[line.key]
                      const inc = incidenza(line, cur, r.fatturato)
                      const rp = rigaAnnoPrima(r.month)
                      const curPrec = line.fixedVal != null ? line.fixedVal : (rp ? rp[line.key] : null)
                      // Il confronto segue quello che si sta guardando: a colonna
                      // chiusa il mese prima, a colonna aperta lo stesso mese
                      // dell'anno prima. Tenere il mese-su-mese mentre a fianco
                      // c'e' l'anno prima vorrebbe dire due confronti diversi
                      // uno accanto all'altro, e nessuno dei due si capisce.
                      const rigaConfronto = yoyAperta ? rp : prevOf[r.month]
                      const prev = (!line.noMoM && rigaConfronto) ? rigaConfronto[line.key] : null
                      return [
                        <td key={`${r.month}-yoy`} className="rep-side" onClick={() => setYoyAperta(v => !v)}
                          style={{ ...baseTd, ...tdYoy, ...(yoyAperta ? null : tdYoyChiusa) }}>
                          {yoyAperta ? (rp ? fmtCell(line, curPrec) : '—') : ''}
                        </td>,
                        <td key={r.month} className="rep-val" style={{ ...baseTd, color: line.sub ? 'var(--text2)' : colorOf(cur), fontWeight: line.ebit ? 700 : baseTd.fontWeight }}>
                          <div>{fmtCell(line, cur)}</div>
                          {!line.pct && !line.int && !line.noMoM && prev != null && (
                            <MoM cur={cur} prev={prev} lowerBetter={line.neg}
                              titolo={t('pnl.vsMonth', { m: monthFullL(rigaConfronto?.month) }, `rispetto a ${monthFullL(rigaConfronto?.month)}`)} />
                          )}
                        </td>,
                        <td key={`${r.month}-inc`} className="rep-side" onClick={() => setIncAperta(v => !v)}
                          style={{ ...baseTd, ...tdInc, ...(incAperta ? null : tdIncChiusa) }}>{incAperta ? fmtInc(inc) : ''}</td>,
                      ]
                    })}
                    {showTotal && <td onClick={() => setYoyAperta(v => !v)}
                      style={{ ...baseTd, ...tdYoy, ...(yoyAperta ? null : tdYoyChiusa), background: 'var(--neutro-bg)' }}>
                      {yoyAperta ? fmtCell(line, totalePrec(line)) : ''}
                    </td>}
                    {showTotal && <td className="rep-val" style={{ ...baseTd, fontWeight: 640, color: line.ebit ? colorOf(total) : 'var(--text)', background: 'var(--neutro-bg)' }}>{fmtCell(line, total)}</td>}
                    {showTotal && <td onClick={() => setIncAperta(v => !v)}
                      style={{ ...baseTd, ...tdInc, ...(incAperta ? null : tdIncChiusa), background: 'var(--neutro-bg)' }}>{incAperta ? fmtInc(incidenza(line, total, totalOf('fatturato'))) : ''}</td>}
                  </tr>
                )
                // Uno stacco dove finisce un ragionamento e ne comincia un
                // altro. Senza, quindici righe di seguito si leggono come un
                // elenco: con, si leggono come un conto.
                return line.gapAfter
                  ? [riga, <tr key={`${line.key}-gap`} aria-hidden="true"><td colSpan={nColonne} style={{ height: 30, padding: 0, border: 'none' }} /></tr>]
                  : riga
              })}
            </tbody>
          </table>
        </div>
        </>
      )}

      {/* Legenda. Una colonna che dice 18% dove tutti si aspettano 22 ha
          bisogno di spiegarsi accanto al numero, non in una nota che nessuno
          trova: senza, ogni volta si ricomincia a dubitare del dato. */}
      {!state.loading && rows.length > 0 && <LegendaIncidenza t={t} />}

      {/* Su macOS le barre di sistema spariscono quando non si scorre: qui
          devono restare a vista, altrimenti quella in alto non si trova. */}
      <style>{`
        .pnl-scroll-sopra::-webkit-scrollbar { height: 10px }
        .pnl-scroll-sopra::-webkit-scrollbar-track { background: rgba(255,255,255,0.03); border-radius: 999px }
        .pnl-scroll-sopra::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.18); border-radius: 999px }
        .pnl-scroll-sopra::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.30) }
        .pnl-scroll-sopra { scrollbar-width: thin; scrollbar-color: rgba(255,255,255,0.18) rgba(255,255,255,0.03) }
      `}</style>
    </div>
  )
}

// ── Andamento: ricavi, costi, EBIT ─────────────────────────────────────────
// Minimale: niente griglia fitta, niente cornici, niente legenda di libreria.
// Restano tre tracce e i numeri. I ricavi sono un'area che sfuma, i costi una
// linea sottile, l'EBIT una linea che si accende — cosi' l'occhio vede prima
// la forma e solo dopo i dettagli.
// Dinamico: le tracce si disegnano all'ingresso, e ogni voce della legenda si
// spegne e si riaccende al clic per isolare quello che si vuole guardare.
function GraficoPnL({ asc, monthLabelL, t }) {
  const [spente, setSpente] = useState(() => new Set())
  const accesa = (k) => !spente.has(k)
  const commuta = (k) => setSpente(prev => {
    const n = new Set(prev)
    n.has(k) ? n.delete(k) : n.add(k)
    return n
  })

  const serie = [
    { key: 'ricavi', label: t('pnl.seriesRevenue', null, 'Ricavi'), color: '#2997ff' },
    { key: 'costi', label: t('pnl.seriesCosts', null, 'Costi'), color: '#ef4444' },
    { key: 'ebit', label: 'EBIT', color: '#22c55e' },
  ]

  const dati = asc.map(r => ({
    name: monthLabelL(r.month),
    ricavi: r.net,
    costi: (r.net != null && r.ebit != null) ? Math.round(r.net - r.ebit) : null,
    ebit: r.ebit,
  }))

  const kEuro = (v) => {
    const n = Number(v)
    if (!Number.isFinite(n)) return ''
    const a = Math.abs(n)
    if (a >= 1000) return `${n < 0 ? '−' : ''}${Math.round(a / 1000)}k`
    return `${Math.round(n)}`
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14, flexWrap: 'wrap' }}>
        <div style={{ fontWeight: 600, fontSize: 13, opacity: 0.85, letterSpacing: '-0.01em' }}>
          {t('pnl.chartTitle2', null, 'Andamento')}
        </div>
        <div style={{ display: 'flex', gap: 4, marginLeft: 'auto' }}>
          {serie.map(x => (
            <button key={x.key} onClick={() => commuta(x.key)}
              title={t('pnl.seriesToggle', null, 'Mostra o nascondi la traccia')}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 7,
                background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 999,
                fontFamily: 'inherit', fontSize: 11.5, fontWeight: 600, letterSpacing: '0.02em',
                color: accesa(x.key) ? 'var(--text2)' : 'var(--text3)',
                opacity: accesa(x.key) ? 1 : 0.4, transition: 'opacity .18s ease, color .18s ease',
              }}>
              <span style={{
                width: 7, height: 7, borderRadius: 999, flexShrink: 0,
                background: accesa(x.key) ? x.color : 'transparent',
                border: `1px solid ${x.color}`,
                boxShadow: accesa(x.key) ? `0 0 8px ${x.color}99` : 'none',
                transition: 'background .18s ease, box-shadow .18s ease',
              }} />
              {x.label}
            </button>
          ))}
        </div>
      </div>

      <div style={{ width: '100%', height: 300 }}>
        <ResponsiveContainer>
          <ComposedChart data={dati} margin={{ top: 10, right: 6, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="pnl-ricavi" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2997ff" stopOpacity={0.34} />
                <stop offset="100%" stopColor="#2997ff" stopOpacity={0} />
              </linearGradient>
              <filter id="pnl-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="b" />
                <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>

            {/* Una griglia appena accennata: serve a posare l'occhio, non a
                disegnare una gabbia. */}
            <CartesianGrid stroke="rgba(255,255,255,0.04)" vertical={false} />
            <XAxis dataKey="name" axisLine={false} tickLine={false} tickMargin={10}
              tick={{ fill: 'var(--text3)', fontSize: 10, letterSpacing: '0.04em' }} />
            <YAxis axisLine={false} tickLine={false} width={46} tickMargin={6}
              tick={{ fill: 'var(--text3)', fontSize: 10, fontVariantNumeric: 'tabular-nums' }}
              tickFormatter={kEuro} />
            <Tooltip cursor={{ stroke: 'rgba(255,255,255,0.14)', strokeWidth: 1 }} content={<Etichetta serie={serie} />} />

            {accesa('ricavi') && (
              <Area type="monotone" dataKey="ricavi" name={serie[0].label} stroke="#2997ff" strokeWidth={1.6}
                fill="url(#pnl-ricavi)" dot={false} activeDot={{ r: 3.5, strokeWidth: 0 }}
                animationDuration={900} animationEasing="ease-out" />
            )}
            {accesa('costi') && (
              <Line type="monotone" dataKey="costi" name={serie[1].label} stroke="#ef4444" strokeWidth={1.4}
                strokeDasharray="4 4" dot={false} activeDot={{ r: 3.5, strokeWidth: 0 }}
                animationDuration={900} animationBegin={120} animationEasing="ease-out" />
            )}
            {accesa('ebit') && (
              <Line type="monotone" dataKey="ebit" name={serie[2].label} stroke="#22c55e" strokeWidth={2}
                dot={false} activeDot={{ r: 4, strokeWidth: 0 }} filter="url(#pnl-glow)"
                animationDuration={900} animationBegin={240} animationEasing="ease-out" />
            )}
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </>
  )
}

// Etichetta al passaggio del mouse: un pannello sottile con la barra del
// colore a sinistra, non il riquadro di serie della libreria.
function Etichetta({ active, payload, label, serie }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{
      background: 'var(--surface)', backdropFilter: 'blur(16px)',
      border: '1px solid rgba(255,255,255,0.10)', borderRadius: 12,
      padding: '10px 12px', fontSize: 13, minWidth: 140,
      boxShadow: '0 12px 34px rgba(0,0,0,0.55)',
    }}>
      <div style={{ fontSize: 10, letterSpacing: '0.10em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 7 }}>{label}</div>
      {payload.map(p => {
        const col = (serie || []).find(x => x.key === p.dataKey)?.color || p.color
        return (
          <div key={p.dataKey} style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 3 }}>
            <span style={{ width: 2, height: 13, borderRadius: 6, background: col, flexShrink: 0 }} />
            <span style={{ color: 'var(--text3)', flex: 1 }}>{p.name}</span>
            <b style={{ color: 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>{eur(p.value)}</b>
          </div>
        )
      })}
    </div>
  )
}

function LegendaIncidenza({ t }) {
  const [aperta, setAperta] = useState(false)
  const caso = (quanto, testo) => (
    <li style={{ marginBottom: 4 }}>
      <b style={{ color: INC_BLU, fontStyle: 'italic', fontWeight: 600 }}>{quanto}</b>
      <span style={{ color: 'var(--text3)' }}> — {testo}</span>
    </li>
  )
  return (
    <div style={{ marginTop: 14, fontSize: 13, lineHeight: 1.6 }}>
      <button onClick={() => setAperta(v => !v)} style={{
        background: 'none', border: 'none', padding: 0, cursor: 'pointer',
        color: INC_BLU, fontStyle: 'italic', fontSize: 13, fontWeight: 600, fontFamily: 'inherit',
      }}>
        {aperta ? '▾' : '▸'} {t('pnl.legendTitle', null, 'Come leggere la colonna % fatt.')}
      </button>

      {aperta && (
        <div className="glass-card" style={{ padding: '14px 18px', marginTop: 8, maxWidth: 760 }}>
          <p style={{ margin: '0 0 12px', color: 'var(--text2)' }}>
            {t('pnl.legendWhat', null, 'Ogni percentuale dice quanto pesa quella voce sul fatturato del mese, IVA inclusa. Il fatturato vale 100%.')}
          </p>

          <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 6 }}>
            {t('pnl.legendVatTitle', null, 'Perché l’IVA non è al 22%')}
          </div>
          <p style={{ margin: '0 0 10px', color: 'var(--text2)' }}>
            {t('pnl.legendVatMath', null, 'Il 22% è la percentuale sul netto. Su 122 € di fatturato l’imposta è 22 €, cioè il 18,03% del fatturato: anche un mese tutto italiano non leggerà mai 22%.')}
          </p>
          <ul style={{ margin: '0 0 10px', paddingLeft: 18 }}>
            {caso(t('pnl.legendCase1n', null, '18,03%'), t('pnl.legendCase1', null, 'tutte vendite italiane al 22%'))}
            {caso(t('pnl.legendCase2n', null, 'meno'), t('pnl.legendCase2', null, 'hai venduto fuori dall’Unione europea, dove l’IVA non si applica — Stati Uniti, Svizzera, Regno Unito'))}
            {caso(t('pnl.legendCase3n', null, 'più'), t('pnl.legendCase3', null, 'hai venduto in paesi con aliquota più alta — Ungheria 27%, Portogallo 23%, Paesi Bassi 21%'))}
          </ul>
          <p style={{ margin: '0 0 10px', color: 'var(--text2)' }}>
            {t('pnl.legendVatReal', null, 'L’importo non è una media: è l’imposta davvero incassata, ordine per ordine, con l’aliquota del paese di ciascuno. È la percentuale a muoversi col mix dei paesi, come risultato.')}
          </p>
          <p style={{ margin: 0, color: 'var(--text3)' }}>
            {t('pnl.legendEmpty', null, 'Le celle vuote sono volute: su «EBIT %» sarebbe la percentuale di una percentuale, su «Ordini» un numero diviso per degli euro.')}
          </p>
        </div>
      )}
    </div>
  )
}

// Variazione mese-su-mese (% e €) per cella della matrice
function MoM({ cur, prev, lowerBetter = false, titolo }) {
  if (prev == null || cur == null || !Number.isFinite(prev) || prev === 0) return null
  const d = cur - prev
  const pct = (d / Math.abs(prev)) * 100
  const up = d > 0
  const good = lowerBetter ? !up : up
  const col = Math.abs(pct) < 0.05 ? 'var(--text3)' : good ? '#22c55e' : '#ef4444'
  // Il titolo dice CONTRO COSA: il confronto cambia quando si apre la colonna
  // dell'anno prima, e una freccia senza riferimento e' una freccia muta.
  return <div title={titolo} style={{ fontSize: 10, fontWeight: 600, color: col, marginTop: 2, whiteSpace: 'nowrap', cursor: 'help' }}>{up ? '▲' : '▼'} {perc(Math.abs(pct), 0)} · {up ? '+' : '−'}{eur(Math.abs(d))}</div>
}

function Field({ label, value, onChange, ph }) {
  return (
    <div>
      <label style={{ fontSize: 11.5, opacity: 0.6, display: 'block', marginBottom: 4 }}>{label}</label>
      <input value={value === 0 || value == null ? '' : value} type="number" placeholder={ph || '0'} onChange={e => onChange(e.target.value)} style={{ ...inp, width: '100%' }} />
    </div>
  )
}

const inp = { padding: '9px 12px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 13, outline: 'none' }
const th = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11.5, opacity: 0.6, textAlign: 'right', whiteSpace: 'nowrap' }
// L'incidenza e' una lettura di servizio accanto al numero, non un secondo
// numero: azzurra, piu' piccola e in corsivo, cosi' l'occhio scorre gli euro e
// trova le percentuali solo quando le cerca.
// L'incidenza non e' un allarme ne' una categoria: si legge come un dato secondario, in grigio.
const INC_BLU = 'var(--text3)'
const thInc = { padding: '10px 10px 10px 4px', borderBottom: '1px solid var(--border)', fontSize: 10, opacity: 0.55, textAlign: 'right', whiteSpace: 'nowrap', color: INC_BLU, fontStyle: 'italic', fontWeight: 600, minWidth: 54 }
const tdInc = { padding: '9px 10px 9px 4px', textAlign: 'right', whiteSpace: 'nowrap', color: INC_BLU, fontStyle: 'italic', fontWeight: 500, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', cursor: 'pointer' }
// Chiusa: una striscia di pochi pixel, non un vuoto. Si vede che c'e' qualcosa
// da aprire, e non ruba spazio alle cifre.
const thIncChiusa = { minWidth: 20, width: 20, padding: '10px 6px', fontSize: 11.5, opacity: 0.5, textAlign: 'center' }
// Anno prima: grigia e in tono minore, cosi' il mese corrente resta il numero
// che si legge per primo. Chiusa e' una striscia con le due cifre dell'anno.
// Ogni mese e' un gruppo di tre colonne: anno prima, mese, incidenza. Senza
// uno stacco all'inizio del gruppo, aperte tutte, diventa una distesa di
// numeri in cui non si capisce piu' quale appartiene a quale mese. La riga
// verticale e lo spazio in piu' dicono dove comincia il mese nuovo.
const STACCO_MESE = { borderLeft: '1px solid rgba(255,255,255,0.16)', paddingLeft: 18 }
const thYoy = { padding: '10px 8px', borderBottom: '1px solid var(--border)', fontSize: 10, opacity: 0.45, textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text3)', fontWeight: 600, minWidth: 92, cursor: 'pointer', ...STACCO_MESE }
const tdYoy = { padding: '9px 8px', textAlign: 'right', whiteSpace: 'nowrap', color: 'var(--text3)', fontWeight: 500, fontSize: 13, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', ...STACCO_MESE }
const thYoyChiusa = { minWidth: 34, width: 34, padding: '10px 5px 10px 14px', fontSize: 10, textAlign: 'center', opacity: 0.4 }
const tdYoyChiusa = { minWidth: 34, width: 34, padding: '9px 5px 9px 14px' }
const tdIncChiusa = { minWidth: 20, width: 20, padding: '9px 6px' }
const td = { padding: '9px 12px', borderBottom: '1px solid var(--border)', textAlign: 'right', whiteSpace: 'nowrap' }
