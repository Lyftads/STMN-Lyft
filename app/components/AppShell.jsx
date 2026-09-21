'use client'

import { flushSync } from 'react-dom'
import { BottoneIcona } from './ui/AzioneBarra'
import IntestazioniFerme from './ui/IntestazioniFerme'
import Spiegazioni from './ui/Spiegazioni'
import { impostaTema } from './AutoTheme'
import Avvisi from './ui/Avvisi'
import RicercaRapida from './ui/RicercaRapida'
import { useEffect, useRef, useState, useLayoutEffect } from 'react'
import TimeframeSelector from './TimeframeSelector'
import BmTimeframe from './ui/BmTimeframe'
import AddClientModal from './AddClientModal'
import { globalPresetToTf, tfToGlobalPreset } from '../../lib/tfQuery'
import { tabNascostaAlNegozio } from '../../lib/team/tipoNegozio'
import { getBrowserSupabase } from '../../lib/supabase/client'
import { preloadClienti } from '../../lib/clienti/preload'
import HelpDrawer from './HelpDrawer'
import { articleForTab } from '../../lib/help/content'
import DownloadReportButton from './DownloadReportButton'
import AlertsBell, { useAlerts } from './AlertsBell'
import ProfiloPopup from './ProfiloPopup'
import Avatar from './Avatar'
import NotificationsBell from './NotificationsBell'
import LogoMark from './LogoMark'
import LanguageSwitcher from './ui/LanguageSwitcher'
import Icon from './ui/Icon'
import CapsulaViva from './CapsulaViva'
import PreparingDataBanner from './PreparingDataBanner'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Queste tab avevano un titolo loro dentro la pagina e lasciavano VUOTA la barra
// in alto: due sistemi di titolo nello stesso prodotto. Ora il titolo lo mostra
// sempre la cornice; qui stanno le chiavi (e il testo di riserva) di ciascuna.
const TITOLI_TAB = {
  inventory: ['inv.title', 'Inventario', 'inv.subtitle', 'Unità operativa = taglia/SKU. Un prodotto può avere stock alto e una sola taglia in esaurimento — guarda sempre la taglia critica. Quantità da Shopify; valore su COGS (cost per item).'],
  productPerformance: ['pp.title', 'Performance prodotti', 'pp.subtitle', 'P&L per prodotto (B2C) · ricavo netto, COGS, ADS allocati in proporzione al ricavo, margine operativo e ROAS.'],
  productCosts: ['pc.title', 'Costi prodotto (landed)', 'pc.subtitle', 'Override del costo unitario reale per variante (incl. spedizione/dazi). Lo storico registra ogni cambio con data di validità ed è usato come COGS in Inventario e Performance prodotti.'],
  prezzi: ['prz.title', 'Prezzi', 'prz.subtitle', 'Lo stesso articolo da te e dai concorrenti: dove sei più caro, dove più conveniente. Si aggiorna da solo due volte al giorno.'],
  googleProducts: ['gp.title', 'Prodotti Google', 'gp.subtitleShell', 'Clic, costo e acquisti di ogni articolo del catalogo su Google Shopping e Performance Max.'],
  googleVerdicts: ['gpv.title', 'Performance prodotti Google', 'gpv.subtitle', 'Verdetti per prodotto, confrontati con le vendite reali di Shopify'],
  corrispettivi: ['cor.title', 'Corrispettivi e-commerce', 'cor.subtitle', 'Registro delle vendite per giorno e paese, con l’IVA registrata da Shopify e il regime fiscale, pronto per il commercialista.'],
  clienti: ['cli.title', 'Clienti', 'cli.subtitle2', 'Clienti divisi per ciclo di vita (RFM). Scegli un segmento e lancia la campagna giusta in un click.'],
}

// Titolo pagina via i18n: override solo dove diverso dall'etichetta tab.
function getPageTitle(tab, t) {
  if (TITOLI_TAB[tab]) return t(TITOLI_TAB[tab][0], null, TITOLI_TAB[tab][1])
  if (tab === 'scheduledReports') return t('title.scheduledReports')
  return t('tab.' + tab, null, t('tab.dashboard'))
}

function getPageSubtitle(tab, t) {
  if (TITOLI_TAB[tab]) return TITOLI_TAB[tab][2] ? t(TITOLI_TAB[tab][2], null, TITOLI_TAB[tab][3]) : ''
  return t('subtitle.' + tab, null, t('subtitle.default'))
}

const PRESETS = [
  { value: 'today', label: 'Oggi' },
  { value: 'yesterday', label: 'Ieri' },
  { value: 'last_7d', label: '7 giorni' },
  { value: 'last_14d', label: '14 giorni' },
  { value: 'last_28d', label: '28 giorni' },
  { value: 'last_90d', label: '90 giorni' },
  { value: 'current_month', label: 'Mese corrente' },
  { value: 'last_month', label: 'Mese scorso' },
  { value: 'ytd', label: 'YTD' },
]

export default function AppShell({
  tab = 'dashboard',
  setTab,
  live,
  updated,
  preset = 'last_7d',
  setPreset,
  loading,
  onRefresh,
  allowedTabs,
  isOwner = false,
  children,
}) {
  const { t, locale } = useI18n()

  // Lock abbonamento SCADUTO: se true, OGNI navigazione viene forzata sulla
  // tab Settings (pagina piani) finché il cliente non rinnova. Stato dal
  // server (/api/billing-lock: Stripe/Shopify + esenzioni storiche).
  // Questo blocco vive solo nel SaaS multi-cliente: il fork a cliente unico
  // non ha abbonamenti, quindi non lo ha — ma qui è ciò che fa incassare.
  const [subLocked, setSubLocked] = useState(false)
  useEffect(() => {
    let alive = true
    fetch('/api/billing-lock', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) setSubLocked(!!j.locked) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (subLocked && tab !== 'settings' && typeof setTab === 'function') setTab('settings')
  }, [subLocked, tab, setTab])

  // Che tipo di negozio è questo cliente: decide quali voci di menu esistono
  // per lui (vedi il filtro sui gruppi, più sotto). no-store perché è un dato
  // del TENANT e non deve sopravvivere a un cambio di workspace dell'agenzia.
  // Se la lettura fallisce resta null = non si nasconde niente.
  const [negozio, setNegozio] = useState(null)
  useEffect(() => {
    let vivo = true
    fetch('/api/integrations/status', { cache: 'no-store' })
      .then(r => r.json())
      .then(s => { if (vivo) setNegozio(s?.tipoNegozio || null) })
      .catch(() => {})
    return () => { vivo = false }
  }, [])

  // Chi arriva da un segnalibro su una tab che per il suo negozio non esiste
  // (?tab=prezzi su un monomarca) non deve restarci: la voce non è nel menu,
  // quindi non avrebbe modo di uscirne se non tornando alla home. I dati sono
  // già protetti dalla route; questo serve a non lasciarlo in un vicolo cieco.
  useEffect(() => {
    if (negozio && tabNascostaAlNegozio(tab, negozio) && typeof setTab === 'function') setTab('dashboard')
  }, [negozio, tab, setTab])

  const [helpOpen, setHelpOpen] = useState(false)
  // Mobile: sidebar come drawer a scomparsa (hamburger). Desktop invariato.
  const [mobileNav, setMobileNav] = useState(false)
  const navRef = useRef(null)
  const burgerRef = useRef(null)

  // A hidden drawer must not remain in the keyboard tab order.
  useEffect(() => {
    const media = window.matchMedia('(max-width: 1024px)')
    const update = () => { if (navRef.current) navRef.current.inert = media.matches && !mobileNav }
    update()
    media.addEventListener('change', update)
    return () => media.removeEventListener('change', update)
  }, [mobileNav])

  useEffect(() => {
    if (!mobileNav) return
    const nav = navRef.current
    const previous = document.activeElement
    const focusable = () => Array.from(nav.querySelectorAll('button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), [tabindex="0"]')).filter(el => el.getClientRects().length)
    focusable()[0]?.focus()
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); setMobileNav(false) }
      if (event.key !== 'Tab') return
      const items = focusable()
      const first = items[0], last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus() }
    }
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      if (previous?.isConnected) previous.focus()
    }
  }, [mobileNav])
  // Pre-riscaldamento snapshot (una volta per sessione): mentre l'utente guarda
  // la dashboard, scaldiamo in background le tab analitiche pesanti ai loro
  // default, così la PRIMA apertura di ognuna è istantanea. Le richieste portano
  // i cookie → il server cacha per il workspace dell'utente (vale per ogni account).
  // Sequenziali con pausa per non saturare i rate limit (es. Meta error 17).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { if (sessionStorage.getItem('lyft_prewarm') === '1') return } catch {}
    let cancelled = false
    const iso = d => d.toISOString().slice(0, 10)
    const ppSince = iso(new Date(Date.now() - 30 * 86400000)), ppUntil = iso(new Date())
    // Commerce (Shopify, le più pesanti a freddo) PER PRIME → l'utente le apre
    // e le trova già calcolate. Poi le tab ads (Meta/Google) e Klaviyo.
    const WARM = [
      '/api/inventory',
      `/api/product-performance?since=${ppSince}&until=${ppUntil}`,
      '/api/product-costs-landed',
      '/api/meta-kpi?preset=last_7d',
      '/api/google-kpi?preset=last_7d',
      '/api/klaviyo?days=30',
      '/api/meta-detail?preset=last_7d',
      '/api/google-detail?preset=last_7d',
    ]
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    // Clienti: precarico SUBITO in parallelo (cache client + sessionStorage) così
    // aprendo la tab — anche più tardi e da un'altra tab — è già pronta.
    preloadClienti().catch(() => {})
    const run = async () => {
      await sleep(1500) // lascia partire prima il caricamento della dashboard
      try { sessionStorage.setItem('lyft_prewarm', '1') } catch {}
      for (const url of WARM) {
        if (cancelled) return
        try { await fetch(url, { cache: 'no-store', keepalive: true }) } catch {}
        await sleep(800) // scaglionato: gentile coi rate limit
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const navGroups = [
    {
      title: 'Commerce',
      color: '#ef4444',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: <Icon name="grid" /> },
        { id: 'inventory', label: 'Inventario', icon: <Icon name="box" /> },
        { id: 'productPerformance', label: 'Performance prodotti', icon: <Icon name="chart-bar" /> },
        { id: 'productCosts', label: 'Costi prodotto', icon: <Icon name="money" /> },
        { id: 'prezzi', label: 'Prezzi', icon: <Icon name="tag" /> },
        { id: 'kpiBrain', label: 'KPI Brain', icon: <Icon name="chart-line" /> },
        { id: 'attribution', label: 'Attribuzione', icon: <Icon name="target" /> },
        { id: 'ltvCohorts', label: 'LTV & Coorti', icon: <Icon name="layers" /> },
        { id: 'clienti', label: 'Clienti', icon: <Icon name="users" /> },
        { id: 'klaviyo', label: 'Email Marketing', icon: <Icon name="mail" /> },
      ],
    },
    {
      title: 'Productivity AI',
      color: 'var(--accent)',
      items: [
        { id: 'tasks', label: 'Progetti & Task', icon: <Icon name="kanban" /> },
        { id: 'calendar', label: 'Calendario', icon: <Icon name="calendar" /> },
        { id: 'timeOff', label: 'Ferie e permessi', icon: <Icon name="clock" /> },
        // Lyftimer, Squadra AI e Performance Agent sono roba da SaaS multi-cliente
        // (postazioni, ruoli, ore fatturabili): il fork a cliente unico le aveva tolte.
        { id: 'timeTracking', label: 'Lyftimer', icon: <Icon name="clock" /> },
        { id: 'chat', label: 'LyftTalk', icon: <Icon name="chat" /> },
        { id: 'creativeLibrary', label: 'Creatività', icon: <Icon name="image" /> },
        { id: 'team', label: 'Squadra AI', icon: <Icon name="users" /> },
      ],
    },
    {
      title: 'Intelligence Website',
      color: '#f59e0b',
      items: [
        { id: 'cro', label: 'CRO', icon: <Icon name="funnel" /> },
        { id: 'webScanner', label: 'AI Website Scanner', icon: <Icon name="scan" /> },
        { id: 'seoAudit', label: 'SEO Audit', icon: <Icon name="search" /> },
      ],
    },
    {
      title: 'Meta',
      color: '#0866FF',
      items: [
        { id: 'creative', label: 'Creative', icon: <Icon name="image" /> },
        { id: 'metaDetail', label: 'Meta Detail', icon: <Icon name="list" /> },
        { id: 'metaKpi', label: 'Meta KPI', icon: <Icon name="gauge" /> },
        { id: 'creativeFatigue', label: 'Creative Fatigue', icon: <Icon name="pulse" /> },
        { id: 'budgetAdvisor', label: 'Budget Advisor', icon: <Icon name="wallet" /> },
        { id: 'metaLeadgen', label: 'Lead Gen', icon: <Icon name="users" /> },
      ],
    },
    {
      title: 'Google',
      color: '#eab308',
      items: [
        { id: 'googleDetail', label: 'Google Detail', icon: <Icon name="list" /> },
        { id: 'googleProducts', label: 'Prodotti', icon: <Icon name="bag" /> },
        { id: 'googleVerdicts', label: 'Verdetti prodotti', icon: <Icon name="rocket" /> },
        { id: 'googleKpi', label: 'Google KPI', icon: <Icon name="gauge" /> },
        { id: 'googleBudgetAdvisor', label: 'Budget Advisor', icon: <Icon name="wallet" /> },
      ],
    },
    {
      // Gruppo intero che il fork aveva cancellato: l'incrementalità (MMM-lite) e
      // il geo-lift sono fra le cose che i clienti paganti comprano.
      title: 'Incrementality',
      color: '#14b8a6',
      items: [
        { id: 'incrContribution', label: 'Contributo incrementale', icon: <Icon name="layers" /> },
        { id: 'incrCurves', label: 'Curve di risposta', icon: <Icon name="chart-line" /> },
        { id: 'incrSimulator', label: 'Simulatore budget', icon: <Icon name="gauge" /> },
        { id: 'geolift', label: 'Geo-lift', icon: <Icon name="target" /> },
      ],
    },
    {
      title: 'Reports',
      color: '#22c55e',
      items: [
        { id: 'pnl', label: 'Conto Economico', icon: <Icon name="euro" /> },
        { id: 'corrispettivi', label: 'Corrispettivi', icon: <Icon name="clipboard" /> },
        { id: 'scheduledReports', label: 'Scheduled', icon: <Icon name="send" /> },
        { id: 'weekly', label: 'Weekly', icon: <Icon name="calendar" /> },
        { id: 'monthly', label: 'Monthly', icon: <Icon name="chart-bar" /> },
        { id: 'quarter', label: 'Quarter', icon: <Icon name="chart-line" /> },
        { id: 'year', label: 'Year', icon: <Icon name="pulse" /> },
        { id: 'simulator', label: 'Simulatore', icon: <Icon name="gauge" /> },
      ],
    },
    {
      title: 'System',
      color: 'var(--text2)',
      items: [
        { id: 'onboarding', label: 'Onboarding', icon: <Icon name="rocket" /> },
        { id: 'helpCenter', label: 'Centro Assistenza', icon: <Icon name="info" /> },
        { id: 'teamManage', label: 'Gestione team', icon: <Icon name="users" /> },
        { id: 'integrations', label: 'Integrazioni', icon: <Icon name="gear" /> },
        { id: 'brandIdentity', label: 'Brand Identity', icon: <Icon name="star" /> },
        { id: 'settings', label: 'Settings', icon: <Icon name="gear" /> },
      ],
    },
  ]

  // Creative Studio: voce SEMPRE visibile nel menu, ma per i non-owner (clienti)
  // si comporta come "coming soon" (gestito in goTo + placeholder in page.js).
  // Nessun filtro che la nasconda.

  // Gating per ruolo: se allowedTabs è un Set, filtra le voci (l'Admin/owner
  // riceve allowedTabs=undefined → vede tutto, comportamento invariato).
  //
  // Al filtro dei ruoli se ne somma un SECONDO, che risponde a una domanda
  // diversa: non «chi può entrare» ma «cosa esiste per questo negozio». Vale
  // anche per l'Admin — anzi soprattutto, perché il proprietario di un
  // monomarca è il primo a non dover vedere «Prezzi»: nessun altro vende i suoi
  // articoli, quindi non c'è niente da confrontare. Finché la risposta non
  // arriva (negozio === null) non si nasconde niente: una voce che sparisce per
  // un istante a ogni caricamento si nota, il contrario no.
  const groups = (allowedTabs
    ? navGroups
        .map(g => ({ ...g, items: g.items.filter(it => allowedTabs.has(it.id)) }))
    : navGroups.map(g => ({ ...g })))
    .map(g => ({ ...g, items: g.items.filter(it => !tabNascostaAlNegozio(it.id, negozio)) }))
    .filter(g => g.items.length > 0)

  // ── Preferiti e recenti ──────────────────────────────────
  // Con una quarantina di tab in otto gruppi, le quattro che si usano ogni giorno stanno in
  // fondo a un gruppo chiuso. La stella le porta in cima; "Recenti" ricorda le ultime aperte.
  // E' una comodita' di QUESTO dispositivo (localStorage): se manca, il menu e' quello di sempre.
  const [preferiti, setPreferiti] = useState([])
  const [recenti, setRecenti] = useState([])
  useEffect(() => {
    try { setPreferiti(JSON.parse(localStorage.getItem('lyft-preferiti') || '[]')); setRecenti(JSON.parse(localStorage.getItem('lyft-recenti') || '[]')) } catch {}
  }, [])
  const cambiaPreferito = (id) => setPreferiti(prev => {
    const dopo = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id].slice(-8)
    try { localStorage.setItem('lyft-preferiti', JSON.stringify(dopo)) } catch {}
    return dopo
  })

  const goTo = (id) => {
    setMobileNav(false) // su mobile il tap su una voce chiude il drawer
    // Abbonamento scaduto: qualunque voce clicchi, si torna SEMPRE ai piani.
    // Sta PRIMA di tutto il resto perche' una tab che l'utente non e' riuscito
    // ad aprire non deve finire nei "recenti" ne' far partire la dissolvenza.
    if (subLocked && id !== 'settings') {
      if (typeof setTab === 'function') setTab('settings')
      return
    }
    const calmo = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    // Toccare la voce GIA' attiva riporta in cima, come la barra delle app di iOS.
    if (id === tab) {
      const main = document.getElementById('app-content')
      // sulla Dashboard a schermo pieno scorre la colonna dei KPI, non la pagina
      const colonna = main?.querySelector('.dash-live-hero.lv .dash-live-left')
      for (const el of [main, colonna]) el?.scrollTo({ top: 0, behavior: calmo ? 'auto' : 'smooth' })
      return
    }
    // Il passaggio fra le tab sfuma (View Transitions) invece di scattare: dove il browser non le
    // ha, o se l'utente ha chiesto meno movimento, si cambia e basta come prima.
    const cambia = () => { if (typeof setTab === 'function') setTab(id) }
    if (typeof document !== 'undefined' && document.startViewTransition && !calmo && id !== tab) document.startViewTransition(() => flushSync(cambia))
    else cambia()
    setRecenti(prev => {
      const dopo = [id, ...prev.filter(x => x !== id)].slice(0, 6)
      try { localStorage.setItem('lyft-recenti', JSON.stringify(dopo)) } catch {}
      return dopo
    })
  }

  // Una tab nuova parte SEMPRE dall'alto: prima si conservava lo scorrimento della tab precedente e
  // si atterrava a meta' pagina. Sincrono (useLayoutEffect) perche' dentro flushSync della View
  // Transition il fotogramma nuovo dev'essere gia' in cima.
  useLayoutEffect(() => { const m = document.getElementById('app-content'); if (m) m.scrollTop = 0 }, [tab])

  // ── Accordion gruppi sidebar ──────────────────────────────
  // Apre di default solo il gruppo che contiene la tab attiva.
  const groupOf = (t) => groups.find(g => g.items.some(i => i.id === t))?.title
  const [openGroups, setOpenGroups] = useState(() => {
    const active = groupOf(tab)
    return active ? { [active]: true } : {}
  })
  // Se cambio tab (es. da link esterno), assicura che il suo gruppo sia aperto.
  useEffect(() => {
    const active = groupOf(tab)
    if (active) setOpenGroups(prev => (prev[active] ? prev : { ...prev, [active]: true }))
  }, [tab])
  const toggleGroup = (title) => setOpenGroups(prev => ({ ...prev, [title]: !prev[title] }))

  return (
    <>
    <a className="app-skip-link" href="#app-content">{t("shell.skipContent", null, "Vai al contenuto")}</a>
    <PreparingDataBanner />
    <div className="app-shell" style={{
      height: '100dvh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated radial gradient background — coerente con landing */}
      <style>{`
        @keyframes appOrbit1 {
          0%   { transform: translate(-15vw, -10vh) scale(1); }
          25%  { transform: translate(10vw, -15vh) scale(1.1); }
          50%  { transform: translate(20vw, 5vh) scale(0.95); }
          75%  { transform: translate(-5vw, 10vh) scale(1.05); }
          100% { transform: translate(-15vw, -10vh) scale(1); }
        }
        @keyframes appOrbit2 {
          0%   { transform: translate(15vw, 10vh) scale(1); }
          33%  { transform: translate(-10vw, 15vh) scale(1.15); }
          66%  { transform: translate(12vw, -10vh) scale(0.9); }
          100% { transform: translate(15vw, 10vh) scale(1); }
        }
        @keyframes appOrbit3 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-15vw, 12vh) scale(1.2); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
      {/* Qui c'erano tre macchie di colore sfocate che orbitavano dietro le pagine
          (viola, blu, verde). Tolte: lo sfondo e' piatto e neutro, come il resto. */}

      {/* Backdrop mobile: chiude il drawer al tap fuori */}
      {mobileNav && <div className="app-nav-backdrop" onClick={() => setMobileNav(false)} />}

      {/* Sidebar (desktop: colonna fissa · mobile: drawer via .app-sidebar) */}
      <aside id="app-navigation" ref={navRef} className={`app-sidebar${mobileNav ? ' open' : ''}`} style={{
        width: 240,
        minWidth: 240,
        height: '100dvh',
        position: 'relative',
        top: 0,
        borderRight: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'none',
        WebkitBackdropFilter: 'none',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 20px 20px' }}>
          <div className="app-brand-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <LogoMark size={32} />
            <span style={{
              fontSize: 22,
              fontWeight: 640,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
            }}>
              LyftAI
            </span>
            <button type="button" className="app-nav-close" aria-label={t('shell.closeMenu', null, 'Chiudi menu')} onClick={() => setMobileNav(false)}><Icon name="close" size={20} /></button>
          </div>

          {/* Workspace pill — dinamica da user.company_name */}
          <WorkspacePill />
        </div>

        {/* Nav */}
        <nav aria-label={t("shell.navigation", null, "Navigazione principale")} style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
          {(() => {
            const tutte = groups.flatMap(g => g.items)
            const trova = (ids) => ids.map(id => tutte.find(i => i.id === id)).filter(Boolean)
            const pref = trova(preferiti)
            const rec = trova(recenti).filter(i => !preferiti.includes(i.id) && i.id !== tab).slice(0, 3)
            const blocco = (titolo, voci) => voci.length > 0 && (
              <div className="app-nav-rapide" key={titolo}>
                <div className="app-nav-rapide-titolo">{titolo}</div>
                {voci.map(item => (
                  <button key={item.id} type="button" className={`app-nav-item app-nav-rapida${tab === item.id ? ' attiva' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => goTo(item.id)}>
                    <span className="app-nav-icon" aria-hidden="true">{item.icon}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t('tab.' + item.id, null, item.label)}</span>
                  </button>
                ))}
              </div>
            )
            return <>{blocco(t('shell.favourites', null, 'Preferiti'), pref)}{blocco(t('shell.recent', null, 'Recenti'), rec)}</>
          })()}
          {groups.map((group) => {
            const isOpen = !!openGroups[group.title]
            const hasActive = group.items.some(i => i.id === tab)
            return (
            <div className="app-nav-group" key={group.title} style={{ marginBottom: isOpen ? 30 : 16 }}>
              <button
                type="button"
                className="app-nav-group-toggle"
                aria-expanded={isOpen}
                onClick={() => toggleGroup(group.title)}
                style={{
                  width: '100%',
                  border: 0,
                  background: 'transparent',
                  cursor: 'pointer',
                  padding: '7px 20px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  color: isOpen || hasActive ? 'var(--text)' : 'var(--text2)',
                  fontSize: 15,
                  fontWeight: 640,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.color = (isOpen || hasActive) ? 'var(--text)' : '#c7c7cf' }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: 'var(--text3)', flexShrink: 0,
                  boxShadow: 'none',
                  opacity: 0,
                }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{t('group.' + group.title.toLowerCase(), null, group.title)}</span>
                {!isOpen && hasActive && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: 'var(--text2)', flexShrink: 0,
                    boxShadow: 'none',
                  }} />
                )}
                <span style={{
                  fontSize: 13,
                  color: 'var(--text3)',
                  transform: isOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s ease',
                  display: 'inline-flex',
                }}>›</span>
              </button>

              {isOpen && (
              <div style={{ display: 'grid', gap: 1, padding: '4px 8px 0' }}>
                {group.items.map((item) => {
                  const active = tab === item.id
                  return (
                    <button
                      key={item.id}
                      className="app-nav-item"
                      aria-current={active ? "page" : undefined}
                      type="button"
                      onClick={() => goTo(item.id)}
                      style={{
                        width: '100%',
                        border: 0,
                        borderRadius: 8,
                        padding: '9px 12px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: 10,
                        cursor: 'pointer',
                        textAlign: 'left',
                        color: active ? 'var(--text)' : 'var(--text2)',
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        transition: 'all 0.15s ease',
                        outline: 'none',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span className="app-nav-icon" style={{
                        width: 20,
                        color: active ? 'var(--text)' : 'var(--text3)',
                        fontSize: 15,
                        display: 'inline-flex',
                        justifyContent: 'center',
                        opacity: active ? 1 : 0.85,
                        transition: 'opacity 0.15s',
                      }}>
                        {item.icon}
                      </span>
                      <span style={{ flex: 1 }}>{t('tab.' + item.id, null, item.label)}</span>
                      {/* span e non button: un bottone dentro un bottone non e' HTML valido */}
                      <span role="button" tabIndex={0} className={`app-nav-stella${preferiti.includes(item.id) ? ' accesa' : ''}`}
                        aria-label={preferiti.includes(item.id) ? t('shell.favRemove', null, 'Togli dai preferiti') : t('shell.favAdd', null, 'Aggiungi ai preferiti')}
                        title={preferiti.includes(item.id) ? t('shell.favRemove', null, 'Togli dai preferiti') : t('shell.favAdd', null, 'Aggiungi ai preferiti')}
                        onClick={(e) => { e.stopPropagation(); cambiaPreferito(item.id) }}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); cambiaPreferito(item.id) } }}>
                        <Icon name="star" size={12} />
                      </span>
                    </button>
                  )
                })}
              </div>
              )}
            </div>
            )
          })}
        </nav>

        {/* Theme control lives in navigation, away from floating chat actions. */}
        {/* User */}
        <UserSection />
      </aside>

      {/* Main */}
      <main data-tab={tab} id="app-content" tabIndex={-1} className="app-main" style={{
        flex: 1,
        minWidth: 0,
        height: '100dvh',
        overflowY: 'auto',
        padding: tab === 'pnl' ? '40px 24px 80px' : '40px 48px 80px',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Il conto economico e' una griglia di mesi: il tetto di 1440px, che
            altrove tiene il testo leggibile, qui toglie colonne alla vista e
            costringe a scorrere. Solo per quella tab la pagina va larga. */}
        <div style={{ maxWidth: tab === 'pnl' ? 'none' : 1440, margin: '0 auto' }}>
          {/* Header */}
          <header className="app-header" style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
            marginBottom: 40,
            position: 'relative',
            zIndex: 10,   // sopra il globo della dashboard (top:-80px lo fa
                          // sbordare sui controlli → bloccava timeframe/bell/aggiorna)
          }}>
            {/* Hamburger (solo mobile): apre la sidebar-drawer */}
            <button type="button" className="app-burger" ref={burgerRef} aria-label="Menu" aria-expanded={mobileNav} aria-controls="app-navigation" onClick={() => setMobileNav(true)}>
              <span /><span /><span />
            </button>
            {/* Queste quattro tab hanno un titolo loro dentro la pagina: qui la
                cornice lo lascia vuoto per non stamparlo due volte. Lyftimer
                (timeTracking) esiste solo nel SaaS, quindi non e' nell'elenco del fork. */}
            {tab !== 'tasks' && tab !== 'timeTracking' && tab !== 'chat' && tab !== 'onboarding' && tab !== 'helpCenter' ? (
              <div className="app-header-title">
                <h1 className="heading-lg">
                  {getPageTitle(tab, t)}
                </h1>
                <p style={{
                  margin: 0,
                  color: 'var(--text3)',
                  fontSize: 15,
                  fontWeight: 400,
                }}>
                  {getPageSubtitle(tab, t)}
                </p>
              </div>
            ) : <div />}

            <div className="app-header-actions" style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              {tab !== 'helpCenter' && articleForTab(tab, locale) && (
                <BottoneIcona icona="info" titolo={t('help.guideFor', null, 'Guida di questa sezione')} onClick={() => setHelpOpen(true)} />
              )}
              <BottoneIcona icona="search" titolo={`${t('rr.title', null, 'Ricerca rapida')} · ⌘K`} onClick={() => window.dispatchEvent(new Event('lyft:ricerca-rapida'))} />
              {/* Il SaaS parla cinque lingue e i clienti la cambiano dalla testata:
                  nel fork (un cliente, una lingua) la voce era finita nel profilo. */}
              <LanguageSwitcher compact />
              <NotificationsBell onNavigate={goTo} />
              {/* La campanella degli avvisi: nel fork gli avvisi stanno solo nel
                  pop-up del profilo, qui resta anche in testata perche' e' il
                  canale con cui avvisiamo i clienti paganti. */}
              <AlertsBell />
              {/* Tab che hanno il loro Aggiorna interno → nascondiamo
                  il bottone globale per non duplicarlo */}
              {onRefresh && !['weekly','monthly','quarter','year','metaDetail','metaKpi','googleDetail','googleKpi','googleVerdicts','googleBudgetAdvisor','forecast','scheduledReports','cro','kpiBrain','webScanner','seoAudit','pnl','corrispettivi','clienti','inventory','productPerformance','productCosts','googleProducts','metaLeadgen','ltvCohorts'].includes(tab) && (
                <BottoneIcona icona="refresh" titolo={loading ? t('shell.refreshing') : t('shell.refresh')} onClick={onRefresh} disabled={loading} gira={loading} />
              )}
              {/* Nei report il PDF sta nella barra della tab, come in Weekly:
                  stessa posizione ovunque. Qui resta solo per Attribuzione. */}
              {['attribution'].includes(tab) && (
                <DownloadReportButton tab={getPageTitle(tab, t)} preset={preset} />
              )}
              {/* IL SELETTORE DEL PERIODO E' SEMPRE L'ULTIMO A DESTRA, in ogni tab: stesso
                  punto, che la barra abbia o no "Aggiorna" e il PDF. Qui arriva quello
                  delle tab (ui/PeriodoInBarra); Dashboard e Attribuzione usano il periodo
                  globale della pagina, disegnato nello stesso posto. */}
              <CapsulaViva updated={updated} onVai={goTo} />
              <div id="barra-azioni" style={{ display: 'contents' }} />
              <div id="barra-periodo" style={{ display: 'contents' }} />
              {setPreset && (tab === 'dashboard' || tab === 'attribution') && (
                <BmTimeframe value={globalPresetToTf(preset)} onChange={(v) => setPreset(tfToGlobalPreset(v))} disabled={loading} />
              )}
            </div>
          </header>

          {/* Abbonamento scaduto: la sola tab raggiungibile e' Settings, e qui si
              dice perche'. Senza questo banner il cliente vedrebbe solo i piani
              senza capire cosa gli e' successo. */}
          {subLocked && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 12, margin: '14px 0 4px',
              padding: '14px 18px', borderRadius: 14,
              background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.35)',
              position: 'relative', zIndex: 2,
            }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>⚠️</span>
              <div style={{ fontSize: 13, lineHeight: 1.5 }}>
                <strong style={{ color: '#ff6b62', fontWeight: 800 }}>{t('shell.subExpired', null, 'Abbonamento scaduto')}</strong>
                {' — '}
                <span style={{ color: 'var(--text2)' }}>{t('shell.subExpiredMsg', null, 'Rinnova il piano per continuare a usare LyftAI: tutte le sezioni si riattivano automaticamente appena l’abbonamento torna attivo.')}</span>
              </div>
            </div>
          )}
          <TabContent key={tab}>
            {children}
          </TabContent>
        </div>
      </main>
      <RicercaRapida gruppi={groups} onVai={goTo} t={t} azioni={[
        ...(setPreset ? [['today', t('tf.today', null, 'Oggi')], ['yesterday', t('tf.yesterday', null, 'Ieri')], ['last_7d', t('tf.last7d', null, 'Ultimi 7 giorni')], ['last_30d', t('tf.last30d', null, 'Ultimi 30 giorni')], ['this_month', t('tf.thisMonth', null, 'Questo mese')], ['last_month', t('tf.lastMonth', null, 'Mese scorso')]]
          .map(([id, nome]) => ({ id: 'periodo:' + id, nome: `${t('rr.period', null, 'Periodo della Dashboard')}: ${nome}`, parole: 'periodo timeframe date', gruppo: t('rr.commands', null, 'Comandi'), icona: <Icon name="calendar" />, esegui: () => { goTo('dashboard'); setPreset(id) } })) : []),
        ...[['light', t('profilo.giorno', null, 'Giorno')], ['dark', t('profilo.notte', null, 'Notte')], ['auto', t('profilo.automatico', null, 'Automatico')]]
          .map(([id, nome]) => ({ id: 'tema:' + id, nome: `${t('profilo.tema', null, 'Tema')}: ${nome}`, parole: 'tema theme chiaro scuro dark light', gruppo: t('rr.commands', null, 'Comandi'), icona: <Icon name="eye" />, esegui: () => impostaTema(id) })),
        { id: 'film', nome: t('film.cta', null, 'Il film della settimana'), parole: 'film report settimana wrapped racconto weekly', gruppo: t('rr.commands', null, 'Comandi'), icona: <Icon name="play" />, esegui: () => window.dispatchEvent(new Event('lyft:film')) },
        { id: 'profilo', nome: t('profilo.title', null, 'Il tuo profilo'), parole: 'profilo foto lingua notifiche avvisi esci logout', gruppo: t('rr.commands', null, 'Comandi'), icona: <Icon name="user" />, esegui: () => window.dispatchEvent(new Event('lyft:apri-profilo')) },
        ...(onRefresh ? [{ id: 'aggiorna', nome: t('shell.refresh', null, 'Aggiorna'), parole: 'aggiorna ricarica refresh dati', gruppo: t('rr.commands', null, 'Comandi'), icona: <Icon name="refresh" />, esegui: () => onRefresh() }] : []),
      ]} />
      <Avvisi />
      <IntestazioniFerme />
      <Spiegazioni />
      {/* Barra in basso su telefono: la Dashboard, i preferiti (la stella del menu) e il menu.
          Senza preferiti ci vanno le quattro tab piu' usate. Su computer non esiste. */}
      {(() => {
        const tutte = groups.flatMap(g => g.items)
        const scelte = (preferiti.length ? ['dashboard', ...preferiti] : ['dashboard', 'kpiBrain', 'inventory', 'chat'])
          .filter((id, k, a) => a.indexOf(id) === k).map(id => tutte.find(i => i.id === id)).filter(Boolean).slice(0, 4)
        return (
          <nav className="ly-barra-basso" aria-label={t('shell.quickNav', null, 'Navigazione rapida')}>
            {scelte.map(item => (
              <button key={item.id} type="button" className={`senza-tocco${tab === item.id ? ' attiva' : ''}`} aria-current={tab === item.id ? 'page' : undefined} onClick={() => goTo(item.id)}>
                <span aria-hidden="true">{item.icon}</span><i>{t('tab.' + item.id, null, item.label)}</i>
              </button>
            ))}
            <button type="button" className="senza-tocco" onClick={() => setMobileNav(true)} aria-haspopup="dialog">
              <span aria-hidden="true"><Icon name="list" /></span><i>{t('shell.menu', null, 'Menu')}</i>
            </button>
          </nav>
        )
      })()}
      {helpOpen && <HelpDrawer article={articleForTab(tab, locale)} onClose={() => setHelpOpen(false)} onNavigate={goTo} />}
    </div>
    </>
  )
}

function TabContent({ children }) {
  const ref = useRef(null)
  const [entered, setEntered] = useState(false)
  // A entrata finita il transform va TOLTO, non lasciato a identita'. Un
  // transform diverso da none rende questo div il contenitore di riferimento
  // per ogni position:fixed che sta dentro la tab: menu del tasto destro,
  // rettangoli di selezione e finestre a schermo intero si posizionavano
  // rispetto a questo riquadro invece che alla finestra, e uscivano spostati
  // della colonna laterale piu' l'intestazione.
  const [posato, setPosato] = useState(false)

  useEffect(() => {
    setEntered(false)
    setPosato(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
  }, [])

  useEffect(() => {
    if (!entered) return
    // Un filo oltre i 600ms della transizione: il transform sparisce quando
    // ha gia' finito di muoversi, cosi' l'entrata resta quella di prima.
    const id = setTimeout(() => setPosato(true), 700)
    return () => clearTimeout(id)
  }, [entered])

  useEffect(() => {
    if (!entered || !ref.current) return

    const ANIM_SELECTOR = '.reveal, .reveal-scale, .reveal-zoom, .stagger, .stagger-zoom, [data-scroll]'

    const intersectionObs = new IntersectionObserver(
      entries => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible')
            intersectionObs.unobserve(entry.target)
          }
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -20px 0px' }
    )

    const observed = new WeakSet()
    const observeAll = (root) => {
      const observe = (el) => {
        if (!el || !el.classList || observed.has(el) || el.classList.contains('visible')) return
        observed.add(el)
        intersectionObs.observe(el)
      }
      // Root stesso può essere un nodo animato (es. .stagger-zoom aggiunto
      // da React quando arrivano i dati) — querySelectorAll cerca solo
      // i discendenti, quindi controlla anche il root.
      if (root.matches?.(ANIM_SELECTOR)) observe(root)
      root.querySelectorAll?.(ANIM_SELECTOR).forEach(observe)
    }

    observeAll(ref.current)

    // Watch for elements added asynchronously (e.g. fetched insights)
    const mutationObs = new MutationObserver(mutations => {
      for (const m of mutations) {
        m.addedNodes?.forEach(node => {
          if (node.nodeType === 1) observeAll(node)
        })
      }
    })
    mutationObs.observe(ref.current, { childList: true, subtree: true })

    return () => {
      intersectionObs.disconnect()
      mutationObs.disconnect()
    }
  }, [entered])


  return (
    <div
      ref={ref}
      className="app-tab-content"
      style={{
        opacity: entered ? 1 : 0,
        transform: posato ? 'none' : entered ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.97)',
        transition: 'opacity 0.6s cubic-bezier(0.16,1,0.3,1), transform 0.6s cubic-bezier(0.16,1,0.3,1)',
      }}
    >
      {children}
    </div>
  )
}

// ── WorkspacePill: pillola in alto sidebar con nome azienda dinamico ──
// Mostra il company_name dell'utente loggato (dai metadata Supabase) invece
// di un valore hardcoded. Fallback su "LyftAI" se l'utente non ha ancora un
// nome azienda configurato.
//
// Qui NON esiste il ramo "workspace fisso" del fork: questo e' il SaaS, il
// passaggio fra i clienti dell'agenzia e' la funzione, non un caso limite.
function WorkspacePill() {
  const { t } = useI18n()
  const [companyName, setCompanyName] = useState('LyftAI')
  const [ws, setWs] = useState({ workspaces: [], activeId: null, isAgency: false })
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [addBusy, setAddBusy] = useState(false)
  const [addError, setAddError] = useState(null)
  const ref = useRef(null)

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (supabase) supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata || {}
      const name = meta.company_name || meta.companyName
      if (name) setCompanyName(name)
    })
    fetch('/api/workspaces').then(r => r.ok ? r.json() : null).then(d => { if (d?.workspaces) setWs(d) }).catch(() => {})
  }, [])

  useEffect(() => {
    if (!open) return
    const onDoc = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const active = ws.workspaces.find(w => w.id === ws.activeId)
  const label = active?.label || companyName
  const multi = ws.isAgency || ws.workspaces.length > 1

  // Cambiando workspace, svuota le cache client per-utente (metriche/clienti/
  // prewarm salvate in localStorage/sessionStorage NON sono per-workspace) →
  // evita di mostrare per un istante i dati del workspace precedente.
  const clearWorkspaceCache = () => {
    try {
      for (const store of [localStorage, sessionStorage]) {
        for (const k of Object.keys(store)) {
          if (/^stmn_|^lyft_|clienti|metrics|kpi|swr/i.test(k)) store.removeItem(k)
        }
      }
    } catch {}
  }

  const switchTo = async (id) => {
    if (id === ws.activeId) { setOpen(false); return }
    setBusy(true)
    try { await fetch('/api/workspaces/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: id }) }); clearWorkspaceCache(); window.location.href = '/?tab=dashboard' }
    catch { setBusy(false) }
  }

  const deleteClient = async (id, lbl) => {
    if (!window.confirm(t('shell.deleteClientConfirm', { name: lbl || '' }, 'Delete client "{name}"? Its connected data will be removed and cannot be recovered.'))) return
    setBusy(true)
    try {
      const r = await fetch(`/api/workspaces/clients?clientId=${encodeURIComponent(id)}`, { method: 'DELETE' }).then(x => x.json())
      // Anche se era il workspace attivo: il mapping è rimosso → al reload
      // getEffectiveTenantId ignora il cookie stale e torna al tuo workspace.
      if (r?.ok) { clearWorkspaceCache(); window.location.href = '/?tab=dashboard' }
      else { setBusy(false); setAddError(r?.error || 'Errore eliminazione') }
    } catch { setBusy(false) }
  }
  const createClient = async (name) => {
    setAddBusy(true); setAddError(null)
    try {
      const r = await fetch('/api/workspaces/clients', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: name, companyName: name }) })
      const j = await r.json()
      if (j?.workspace?.id) { await switchTo(j.workspace.id) }
      else { setAddBusy(false); setAddError(j?.error || 'Errore creazione cliente') }
    } catch { setAddBusy(false); setAddError('Errore di rete') }
  }

  const card = {
    background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12,
    padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, width: '100%',
  }
  // Quadratino neutro accanto al nome. Il fork ci mette il logo del suo unico
  // cliente, preso da un file fisso: qui i workspace sono tanti e ognuno avrebbe
  // il suo, quindi finche' non c'e' un logo per workspace resta il segnaposto
  // (neutro, non una sfumatura colorata: vale la regola "zero colori").
  const avatar = (
    <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--text)', display: 'inline-block', flexShrink: 0 }} />
  )

  // Sempre interattivo: anche un utente singolo deve poter creare il PRIMO
  // cliente (→ diventa agency). Lo switcher mostra le aziende + "Aggiungi cliente".
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} disabled={busy} style={{ ...card, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {avatar}
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>{t('shell.switchCompany', null, 'Switch company')}</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200, background: 'var(--surface, #0e0e0e)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxHeight: 320, overflowY: 'auto' }}>
          {ws.workspaces.map(w => {
            const on = w.id === ws.activeId
            return (
              <div key={w.id} style={{ display: 'flex', alignItems: 'center', gap: 2, borderRadius: 8, background: on ? 'var(--neutro-bg)' : 'transparent' }}>
                <button type="button" onClick={() => switchTo(w.id)} style={{ flex: 1, minWidth: 0, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: on ? '#2997ff' : 'var(--text2)', fontSize: 13, fontWeight: on ? 800 : 600 }}>
                  <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label}{w.isSelf ? ' · ' + t('shell.you', null, 'you') : ''}</span>
                  {on && <span>✓</span>}
                </button>
                {!w.isSelf && (
                  <button type="button" title={t('shell.deleteClient', null, 'Delete client')} onClick={(e) => { e.stopPropagation(); deleteClient(w.id, w.label) }} style={{ flexShrink: 0, border: 'none', background: 'transparent', color: 'var(--text3)', cursor: 'pointer', padding: '6px 8px', borderRadius: 8, display: 'inline-flex' }}>
                    <Icon name="trash" size={13} />
                  </button>
                )}
              </div>
            )
          })}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
          <button type="button" onClick={() => { setOpen(false); setAddError(null); setAddOpen(true) }} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#22c55e', fontSize: 13, fontWeight: 600 }}>{t('shell.addClient', null, '+ Add client')}</button>
        </div>
      )}
      <AddClientModal open={addOpen} busy={addBusy} error={addError} onClose={() => setAddOpen(false)} onSubmit={createClient} />
    </div>
  )
}

// ── UserSection: il proprio nome in fondo al menu. Un click apre il pop-up del
// profilo (foto, soprannome, notifiche email, lingua, tema, avvisi, uscita). Il
// pallino sull'avatar dice che nel centro avvisi c'e' qualcosa da leggere: e' il
// secondo segnale, oltre alla campanella in testata.
// Il pop-up si apre SEMPRE sulla scheda Profilo, anche con avvisi urgenti.
function UserSection() {
  const { t } = useI18n()
  const [user, setUser] = useState(null)
  const [profilo, setProfilo] = useState(null)
  const [personale, setPersonale] = useState(null)
  const [aperto, setAperto] = useState(null)
  const avvisi = useAlerts()

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => setUser(user))
    // Sub al cambiamento sessione (es. logout in un'altra scheda)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    fetch('/api/profile', { cache: 'no-store' }).then(r => r.json())
      .then(d => { setProfilo(d.profile || null); setPersonale(d.personale || null) }).catch(() => {})
    // Salvato dal pop-up (anche da quello aperto in LyftTalk): si aggiorna senza ricaricare.
    const aggiorna = (e) => {
      if (e.detail?.profile) setProfilo(e.detail.profile)
      if (e.detail?.personale) setPersonale(e.detail.personale)
    }
    // di norma sul Profilo; la sala di controllo puo' chiedere di aprirlo sugli Avvisi
    const apri = (e) => setAperto(e?.detail?.scheda || 'profilo')
    window.addEventListener('lyft:profilo', aggiorna)
    window.addEventListener('lyft:apri-profilo', apri)
    return () => { window.removeEventListener('lyft:profilo', aggiorna); window.removeEventListener('lyft:apri-profilo', apri) }
  }, [])

  const meta = user?.user_metadata || {}
  const nome = personale?.nickname || profilo?.full_name || meta.name || user?.email?.split('@')[0] || '…'
  const sotto = meta.company_name || meta.companyName || user?.email || ''
  const daLeggere = avvisi.counts?.total || 0
  const urgente = (avvisi.counts?.urgent || 0) > 0

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px' }}>
      <button
        type="button"
        className="app-user-btn senza-tocco"
        onClick={() => setAperto('profilo')}
        aria-haspopup="dialog"
        title={daLeggere > 0 ? t('profilo.alertBadge', { n: daLeggere }, `${daLeggere} avvisi da leggere`) : t('profilo.open', null, 'Apri il tuo profilo')}
      >
        <span style={{ position: 'relative', flexShrink: 0 }}>
          <Avatar name={nome} url={profilo?.avatar_url || null} size={32} />
          {daLeggere > 0 && <span className={`app-user-pallino${urgente ? ' urgente' : ''}`}>{daLeggere > 9 ? '9+' : daLeggere}</span>}
        </span>
        <span style={{ flex: 1, minWidth: 0 }}>
          <span className="app-user-nome">{nome}</span>
          <span className="app-user-sotto">{sotto}</span>
        </span>
        <Icon name="chevron" size={13} />
      </button>
      {aperto && <ProfiloPopup apri={aperto} avvisi={avvisi} onClose={() => setAperto(null)} />}
    </div>
  )
}
