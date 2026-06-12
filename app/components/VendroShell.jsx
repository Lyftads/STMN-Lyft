'use client'

import { useEffect, useRef, useState } from 'react'
import TimeframeSelector from './TimeframeSelector'
import BmTimeframe from './ui/BmTimeframe'
import AddClientModal from './AddClientModal'
import { globalPresetToTf, tfToGlobalPreset } from '../../lib/tfQuery'
import { getBrowserSupabase } from '../../lib/supabase/client'
import DownloadReportButton from './DownloadReportButton'
import AlertsBell from './AlertsBell'
import NotificationsBell from './NotificationsBell'
import LogoMark from './LogoMark'
import LanguageSwitcher from './ui/LanguageSwitcher'
import Icon from './ui/Icon'
import { CreativeStudioMark } from './ui/CreativeStudioLogo'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Titolo pagina via i18n: override solo dove diverso dall'etichetta tab.
function getPageTitle(tab, t) {
  if (tab === 'scheduledReports') return t('title.scheduledReports')
  return t('tab.' + tab, null, t('tab.dashboard'))
}

function getPageSubtitle(tab, t) {
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

export default function VendroShell({
  tab = 'dashboard',
  setTab,
  live,
  updated,
  preset = 'last_7d',
  setPreset,
  loading,
  onRefresh,
  allowedTabs,
  children,
}) {
  const { t } = useI18n()

  // Badge "azioni in attesa" sulla voce Coda Azioni (Fase 1).
  const [pendingActions, setPendingActions] = useState(0)
  useEffect(() => {
    let alive = true
    const load = () => fetch('/api/actions?status=pending')
      .then(r => r.ok ? r.json() : null)
      .then(j => { if (alive && j) setPendingActions((j.actions || []).length) })
      .catch(() => {})
    load()
    const id = setInterval(load, 60_000)
    return () => { alive = false; clearInterval(id) }
  }, [tab])

  // Pre-riscaldamento snapshot (una volta per sessione): mentre l'utente guarda
  // la dashboard, scaldiamo in background le tab analitiche pesanti ai loro
  // default, così la PRIMA apertura di ognuna è istantanea. Le richieste portano
  // i cookie → il server cacha per il workspace dell'utente (vale per ogni account).
  // Sequenziali con pausa per non saturare i rate limit (es. Meta error 17).
  useEffect(() => {
    if (typeof window === 'undefined') return
    try { if (sessionStorage.getItem('lyft_prewarm') === '1') return } catch {}
    let cancelled = false
    const WARM = [
      '/api/meta-kpi?preset=last_7d',
      '/api/google-kpi?preset=last_7d',
      '/api/klaviyo?days=30',
      '/api/meta-detail?preset=last_7d',
      '/api/google-detail?preset=last_7d',
    ]
    const sleep = ms => new Promise(r => setTimeout(r, ms))
    const run = async () => {
      await sleep(3000) // lascia caricare prima la dashboard
      try { sessionStorage.setItem('lyft_prewarm', '1') } catch {}
      for (const url of WARM) {
        if (cancelled) return
        try { await fetch(url, { cache: 'no-store', keepalive: true }) } catch {}
        await sleep(1200) // scaglionato: gentile coi rate limit
      }
    }
    run()
    return () => { cancelled = true }
  }, [])

  const navGroups = [
    {
      title: 'Commerce',
      color: '#ff375f',
      items: [
        { id: 'onboarding', label: 'Onboarding', icon: <Icon name="rocket" /> },
        { id: 'dashboard', label: 'Dashboard', icon: <Icon name="grid" /> },
        { id: 'inventory', label: 'Inventario', icon: <Icon name="box" /> },
        { id: 'productPerformance', label: 'Performance prodotti', icon: <Icon name="chart-bar" /> },
        { id: 'productCosts', label: 'Costi prodotto', icon: <Icon name="money" /> },
        { id: 'kpiBrain', label: 'KPI Brain', icon: <Icon name="chart-line" /> },
        { id: 'attribution', label: 'Attribuzione', icon: <Icon name="target" /> },
        { id: 'ltvCohorts', label: 'LTV & Coorti', icon: <Icon name="layers" /> },
        { id: 'klaviyo', label: 'Klaviyo', icon: <Icon name="mail" /> },
      ],
    },
    {
      title: 'Productivity AI',
      color: '#7b5bff',
      items: [
        { id: 'tasks', label: 'Progetti & Task', icon: <Icon name="kanban" /> },
        { id: 'timeTracking', label: 'Lyftimer', icon: <Icon name="clock" /> },
        { id: 'chat', label: 'LyftTalk', icon: <Icon name="chat" /> },
        { id: 'team', label: 'Squadra AI', icon: <Icon name="users" /> },
        { id: 'performanceAgent', label: 'Performance Agent', icon: <Icon name="sparkle" /> },
        { id: 'creativeStudio', label: 'Creative Studio', icon: <CreativeStudioMark size={15} /> },
        { id: 'actionQueue', label: 'Coda Azioni', icon: <Icon name="bolt" /> },
      ],
    },
    {
      title: 'Intelligence Website',
      color: '#ff9f0a',
      items: [
        { id: 'cro', label: 'CRO', icon: <Icon name="funnel" /> },
        { id: 'webScanner', label: 'AI Website Scanner', icon: <Icon name="scan" /> },
        { id: 'seoAudit', label: 'SEO Audit', icon: <Icon name="search" /> },
        { id: 'competitorIntel', label: 'Competitor Intel', icon: <Icon name="target" /> },
        { id: 'priceComparison', label: 'Prezzi vs Competitor', icon: <Icon name="scale" /> },
        { id: 'creativeIntel', label: 'Creative Intel', icon: <Icon name="eye" /> },
      ],
    },
    {
      title: 'Meta',
      color: '#0866FF',
      items: [
        { id: 'creative', label: 'Creative', icon: <Icon name="image" /> },
        { id: 'metaDetail', label: 'Meta Detail', icon: <Icon name="list" /> },
        { id: 'metaKpi', label: 'Meta KPI', icon: <Icon name="gauge" /> },
        { id: 'lighthouse', label: 'Lighthouse', icon: <Icon name="warning" /> },
        { id: 'creativeFatigue', label: 'Creative Fatigue', icon: <Icon name="pulse" /> },
        { id: 'budgetAdvisor', label: 'Budget Advisor', icon: <Icon name="wallet" /> },
      ],
    },
    {
      title: 'Google',
      color: '#eab308',
      items: [
        { id: 'googleDetail', label: 'Google Detail', icon: <Icon name="list" /> },
        { id: 'googleProducts', label: 'Prodotti', icon: <Icon name="bag" /> },
        { id: 'googleKpi', label: 'Google KPI', icon: <Icon name="gauge" /> },
        { id: 'googleLighthouse', label: 'Lighthouse', icon: <Icon name="warning" /> },
        { id: 'googleBudgetAdvisor', label: 'Budget Advisor', icon: <Icon name="wallet" /> },
      ],
    },
    {
      title: 'Reports',
      color: '#30d158',
      items: [
        { id: 'pnl', label: 'Conto Economico', icon: <Icon name="euro" /> },
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
      color: '#86868b',
      items: [
        { id: 'integrations', label: 'Integrazioni', icon: <Icon name="gear" /> },
        { id: 'brandIdentity', label: 'Brand Identity', icon: <Icon name="star" /> },
        { id: 'settings', label: 'Settings', icon: <Icon name="gear" /> },
      ],
    },
  ]

  // Gating per ruolo: se allowedTabs è un Set, filtra le voci (l'Admin/owner
  // riceve allowedTabs=undefined → vede tutto, comportamento invariato).
  const groups = allowedTabs
    ? navGroups
        .map(g => ({ ...g, items: g.items.filter(it => allowedTabs.has(it.id)) }))
        .filter(g => g.items.length > 0)
    : navGroups

  const goTo = (id) => {
    // Creative Studio: apre direttamente l'app a tutto schermo in una nuova finestra
    // (la board è importante e merita lo spazio pieno, come "Apri come app").
    if (id === 'creativeStudio') {
      try { window.open('/creative-studio', '_blank', 'noopener') } catch {}
      return
    }
    if (typeof setTab === 'function') setTab(id)
  }

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
    <div style={{
      height: '100vh',
      background: 'var(--bg)',
      color: 'var(--text)',
      display: 'flex',
      fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Animated radial gradient background — coerente con landing */}
      <style>{`
        @keyframes vendroOrbit1 {
          0%   { transform: translate(-15vw, -10vh) scale(1); }
          25%  { transform: translate(10vw, -15vh) scale(1.1); }
          50%  { transform: translate(20vw, 5vh) scale(0.95); }
          75%  { transform: translate(-5vw, 10vh) scale(1.05); }
          100% { transform: translate(-15vw, -10vh) scale(1); }
        }
        @keyframes vendroOrbit2 {
          0%   { transform: translate(15vw, 10vh) scale(1); }
          33%  { transform: translate(-10vw, 15vh) scale(1.15); }
          66%  { transform: translate(12vw, -10vh) scale(0.9); }
          100% { transform: translate(15vw, 10vh) scale(1); }
        }
        @keyframes vendroOrbit3 {
          0%   { transform: translate(0, 0) scale(1); }
          50%  { transform: translate(-15vw, 12vh) scale(1.2); }
          100% { transform: translate(0, 0) scale(1); }
        }
      `}</style>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        overflow: 'hidden',
      }}>
        <div style={{
          position: 'absolute', top: '20%', left: '30%',
          width: 700, height: 700, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(191,90,242,0.18), rgba(191,90,242,0.05) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'vendroOrbit1 40s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', top: '50%', right: '20%',
          width: 600, height: 600, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(41,151,255,0.15), rgba(41,151,255,0.04) 40%, transparent 70%)',
          filter: 'blur(60px)',
          animation: 'vendroOrbit2 45s ease-in-out infinite',
        }} />
        <div style={{
          position: 'absolute', bottom: '10%', left: '50%',
          width: 500, height: 500, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(34,197,94,0.10), transparent 70%)',
          filter: 'blur(70px)',
          animation: 'vendroOrbit3 55s ease-in-out infinite',
        }} />
      </div>

      {/* Sidebar */}
      <aside style={{
        width: 240,
        minWidth: 240,
        height: '100vh',
        position: 'relative',
        top: 0,
        borderRight: '1px solid var(--border)',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(40px) saturate(1.8)',
        WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
        display: 'flex',
        flexDirection: 'column',
        zIndex: 20,
      }}>
        {/* Logo */}
        <div style={{ padding: '28px 20px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <LogoMark size={32} />
            <span style={{
              fontSize: 22,
              fontWeight: 800,
              letterSpacing: '-0.04em',
              color: 'var(--text)',
            }}>
              LyftAI
            </span>
          </div>

          {/* Workspace pill — dinamica da user.company_name */}
          <WorkspacePill />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
          {groups.map((group) => {
            const isOpen = !!openGroups[group.title]
            const hasActive = group.items.some(i => i.id === tab)
            return (
            <div key={group.title} style={{ marginBottom: isOpen ? 30 : 16 }}>
              <button
                type="button"
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
                  color: isOpen || hasActive ? 'var(--text)' : '#c7c7cf',
                  fontSize: 14,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = 'var(--text)' }}
                onMouseLeave={e => { e.currentTarget.style.color = (isOpen || hasActive) ? 'var(--text)' : '#c7c7cf' }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: group.color, flexShrink: 0,
                  boxShadow: `0 0 6px ${group.color}`,
                  opacity: isOpen || hasActive ? 1 : 0.5,
                }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{t('group.' + group.title.toLowerCase(), null, group.title)}</span>
                {!isOpen && hasActive && (
                  <span style={{
                    width: 6, height: 6, borderRadius: '50%',
                    background: group.color, flexShrink: 0,
                    boxShadow: `0 0 6px ${group.color}`,
                  }} />
                )}
                <span style={{
                  fontSize: 12,
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
                        color: active ? 'var(--text)' : '#c7c7cf',
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        fontSize: 13,
                        fontWeight: active ? 600 : 500,
                        transition: 'all 0.15s ease',
                        outline: 'none',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{
                        width: 20,
                        color: active ? 'var(--text)' : group.color,
                        fontSize: 14,
                        display: 'inline-flex',
                        justifyContent: 'center',
                        opacity: active ? 1 : 0.85,
                        transition: 'opacity 0.15s',
                      }}>
                        {item.icon}
                      </span>
                      <span style={{ flex: 1 }}>{t('tab.' + item.id, null, item.label)}</span>
                      {item.id === 'actionQueue' && pendingActions > 0 && (
                        <span style={{
                          minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
                          background: '#fbbf24', color: '#1a1400', fontSize: 11, fontWeight: 800,
                          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                        }}>{pendingActions > 99 ? '99+' : pendingActions}</span>
                      )}
                    </button>
                  )
                })}
              </div>
              )}
            </div>
            )
          })}
        </nav>

        {/* User */}
        <UserSection />
      </aside>

      {/* Main */}
      <main style={{
        flex: 1,
        minWidth: 0,
        height: '100vh',
        overflowY: 'auto',
        padding: '40px 48px 80px',
        position: 'relative',
        zIndex: 1,
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          {/* Header */}
          <header style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            gap: 24,
            marginBottom: 40,
            position: 'relative',
            zIndex: 10,   // sopra il globo della dashboard (top:-80px lo fa
                          // sbordare sui controlli → bloccava timeframe/bell/aggiorna)
          }}>
            {tab !== 'tasks' && tab !== 'timeTracking' && tab !== 'chat' && tab !== 'onboarding' && tab !== 'creativeStudio' && tab !== 'inventory' && tab !== 'productPerformance' && tab !== 'productCosts' && tab !== 'googleProducts' ? (
              <div>
                <h1 className="heading-lg" style={{ marginBottom: 6 }}>
                  {getPageTitle(tab, t)}
                </h1>
                <p style={{
                  margin: 0,
                  color: 'var(--text3)',
                  fontSize: 14,
                  fontWeight: 400,
                }}>
                  {getPageSubtitle(tab, t)}
                </p>
              </div>
            ) : <div />}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <LanguageSwitcher compact />
              <NotificationsBell onNavigate={goTo} />
              <AlertsBell />
              {setPreset && (tab === 'dashboard' || tab === 'attribution') && (
                <BmTimeframe value={globalPresetToTf(preset)} onChange={(v) => setPreset(tfToGlobalPreset(v))} accent="#2997ff" disabled={loading} />
              )}
              {/* Tab che hanno il loro Aggiorna interno → nascondiamo
                  il bottone globale per non duplicarlo */}
              {onRefresh && !['weekly','monthly','quarter','year','metaDetail','metaKpi','lighthouse','googleDetail','googleKpi','googleLighthouse','googleBudgetAdvisor','forecast','scheduledReports','cro','kpiBrain','webScanner','seoAudit','pnl','competitorIntel'].includes(tab) && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={loading}
                  className="btn-glass"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    cursor: loading ? 'wait' : 'pointer',
                    opacity: loading ? 0.5 : 1,
                  }}
                >
                  <span style={{
                    display: 'inline-block',
                    animation: loading ? 'spin 1s linear infinite' : 'none',
                  }}>↻</span>
                  {loading ? t('shell.refreshing') : t('shell.refresh')}
                </button>
              )}
              {['monthly', 'quarter', 'year', 'attribution'].includes(tab) && (
                <DownloadReportButton tab={getPageTitle(tab, t)} preset={preset} />
              )}
            </div>
          </header>

          <TabContent key={tab}>
            {children}
          </TabContent>
        </div>
      </main>
    </div>
  )
}

function TabContent({ children }) {
  const ref = useRef(null)
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    setEntered(false)
    requestAnimationFrame(() => requestAnimationFrame(() => setEntered(true)))
  }, [])

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
      style={{
        opacity: entered ? 1 : 0,
        transform: entered ? 'translateY(0) scale(1)' : 'translateY(30px) scale(0.97)',
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
function WorkspacePill() {
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

  const switchTo = async (id) => {
    if (id === ws.activeId) { setOpen(false); return }
    setBusy(true)
    try { await fetch('/api/workspaces/switch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ workspaceId: id }) }); window.location.href = '/?tab=dashboard' }
    catch { setBusy(false) }
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
  const avatar = (
    <span style={{ width: 28, height: 28, borderRadius: 7, background: 'linear-gradient(135deg, #2997ff, #bf5af2)', display: 'inline-block', flexShrink: 0 }} />
  )

  // Sempre interattivo: anche un utente singolo deve poter creare il PRIMO
  // cliente (→ diventa agency). Lo switcher mostra le aziende + "Aggiungi cliente".
  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button type="button" onClick={() => setOpen(o => !o)} disabled={busy} style={{ ...card, cursor: busy ? 'wait' : 'pointer', opacity: busy ? 0.6 : 1 }}>
        {avatar}
        <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
          <span style={{ display: 'block', fontSize: 13, fontWeight: 700, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>
          <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>Cambia azienda</span>
        </span>
        <span style={{ fontSize: 10, color: 'var(--text3)' }}>▾</span>
      </button>
      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, zIndex: 200, background: 'var(--surface, #0d0d16)', border: '1px solid var(--border)', borderRadius: 12, padding: 6, boxShadow: '0 20px 50px rgba(0,0,0,0.5)', maxHeight: 320, overflowY: 'auto' }}>
          {ws.workspaces.map(w => {
            const on = w.id === ws.activeId
            return (
              <button key={w.id} type="button" onClick={() => switchTo(w.id)} style={{ width: '100%', textAlign: 'left', display: 'flex', alignItems: 'center', gap: 8, padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: on ? 'rgba(41,151,255,0.14)' : 'transparent', color: on ? '#2997ff' : 'var(--text2)', fontSize: 13, fontWeight: on ? 800 : 600 }}>
                <span style={{ flex: 1, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{w.label}{w.isSelf ? ' · tuo' : ''}</span>
                {on && <span>✓</span>}
              </button>
            )
          })}
          <div style={{ height: 1, background: 'var(--border)', margin: '6px 4px' }} />
          <button type="button" onClick={() => { setOpen(false); setAddError(null); setAddOpen(true) }} style={{ width: '100%', textAlign: 'left', padding: '9px 10px', borderRadius: 8, border: 'none', cursor: 'pointer', background: 'transparent', color: '#22c55e', fontSize: 13, fontWeight: 700 }}>+ Aggiungi cliente</button>
        </div>
      )}
      <AddClientModal open={addOpen} busy={addBusy} error={addError} onClose={() => setAddOpen(false)} onSubmit={createClient} />
    </div>
  )
}

// ── UserSection: leggi user da Supabase, mostra nome+azienda, dropdown logout ──
function UserSection() {
  const [user, setUser] = useState(null)
  const [company, setCompany] = useState(null)
  const [open, setOpen] = useState(false)
  const menuRef = useRef(null)

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
    if (!user) return
    // Leggi metadata custom dal user
    const meta = user.user_metadata || {}
    setCompany({
      name: meta.name || user.email?.split('@')[0] || 'Utente',
      companyName: meta.company_name || meta.companyName || '',
      email: user.email || '',
    })
  }, [user])

  useEffect(() => {
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const handleLogout = async () => {
    const supabase = getBrowserSupabase()
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const initials = company?.name
    ? company.name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
    : '··'

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '14px 20px', position: 'relative' }} ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%', background: 'transparent', border: 'none',
          cursor: 'pointer', padding: 0, textAlign: 'left',
          display: 'flex', alignItems: 'center', gap: 10,
        }}
      >
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          display: 'grid', placeItems: 'center',
          background: 'linear-gradient(135deg, #2997ff, #bf5af2)',
          color: 'var(--text)', fontSize: 11, fontWeight: 700,
          flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: 'var(--text)', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {company?.name || '…'}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {company?.companyName || (company?.email ? company.email : 'Admin')}
          </div>
        </div>
        <span style={{ color: 'var(--text3)', fontSize: 14 }}>{open ? '▾' : '▸'}</span>
      </button>

      {open && (
        <div style={{
          position: 'absolute', bottom: 'calc(100% + 6px)', left: 14, right: 14,
          background: 'rgba(10,10,22,0.96)',
          backdropFilter: 'blur(40px)',
          border: '1px solid var(--border2)',
          borderRadius: 11,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          padding: 6,
          zIndex: 100,
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize: 11, color: 'var(--text3)',
            borderBottom: '1px solid var(--border)',
            marginBottom: 4,
          }}>{company?.email || ''}</div>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              width: '100%', textAlign: 'left',
              padding: '9px 12px', borderRadius: 7,
              background: 'transparent', border: 'none',
              color: '#fca5a5', fontSize: 12.5, fontWeight: 700,
              cursor: 'pointer',
              display: 'flex', alignItems: 'center', gap: 8,
            }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(239,68,68,0.08)'}
            onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
          >
            ↩ Logout
          </button>
        </div>
      )}
    </div>
  )
}
