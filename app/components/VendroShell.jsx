'use client'

import { useEffect, useRef, useState } from 'react'
import TimeframeSelector from './TimeframeSelector'
import { getBrowserSupabase } from '../../lib/supabase/client'
import DownloadReportButton from './DownloadReportButton'
import AlertsBell from './AlertsBell'
import LogoMark from './LogoMark'

function getPageTitle(tab) {
  const map = {
    dashboard: 'Dashboard',
    kpiBrain: 'KPI Brain',
    attribution: 'Attribuzione',
    monthly: 'Monthly',
    weekly: 'Weekly',
    quarter: 'Quarter',
    year: 'Year',
    simulator: 'Simulatore',
    metaDetail: 'Meta Detail',
    metaKpi: 'Meta KPI',
    creative: 'Creative',
    creativeFatigue: 'Creative Fatigue',
    budgetAdvisor: 'Budget Advisor',
    performanceAgent: 'Performance Agent',
    klaviyo: 'Klaviyo',
    competitorIntel: 'Competitor Intel',
    priceComparison: 'Prezzi vs Competitor',
    integrations: 'Integrazioni',
    brandIdentity: 'Brand Identity',
    settings: 'Settings',
    cro: 'CRO',
    webScanner: 'AI Website Scanner',
    creativeLab: 'Creative Lab',
  }
  return map[tab] || 'Dashboard'
}

function getPageSubtitle(tab) {
  const map = {
    kpiBrain: 'Your business intelligence at a glance',
    attribution: 'Total Impact · paid vs organico · contributo per canale · MER blended',
    creative: 'Analisi creative Meta Ads',
    creativeFatigue: 'Creative da rinfrescare · frequency, CTR, CPA',
    budgetAdvisor: 'Riallocazione budget campagne attive · forecast ROAS',
    metaDetail: 'Dettaglio performance Meta',
    metaKpi: 'KPI completi Meta Ads · Spend, ROAS, CPO, CTR, CPM, Frequency, Reach',
    performanceAgent: 'Consulente AI · Performance · CMO · CRO · Ads',
    klaviyo: 'Email Marketing · Campagne · Flussi · Segmenti',
    competitorIntel: 'Creative attive · Catalogo · Prezzi · Promozioni',
    priceComparison: 'Confronto prezzi per categoria',
    integrations: 'Collega e gestisci tutte le piattaforme',
    brandIdentity: 'Identita\' del brand · Tone of voice · Visual · Competitor',
    settings: 'Subscription · Piani · Fatturazione',
    cro: 'Funnel · Top Pages · Flusso Traffico',
    webScanner: 'Scanner CRO con AI Vision · Heuristic evaluation · Quick wins',
    creativeLab: 'Genera ad creative con AI',
    simulator: 'LTV:CAC · Scenari Advertising · Forecasting · Strategia CMO + CFO',
    dashboard: 'Panoramica completa del business',
  }
  return map[tab] || 'Panoramica completa del business'
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
  children,
}) {
  const navGroups = [
    {
      title: 'Commerce',
      color: '#ff375f',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: '⌁' },
        { id: 'kpiBrain', label: 'KPI Brain', icon: '↗' },
        { id: 'attribution', label: 'Attribuzione', icon: '⌖' },
        { id: 'klaviyo', label: 'Klaviyo', icon: '✉' },
        { id: 'cro', label: 'CRO', icon: '⊘' },
        { id: 'webScanner', label: 'AI Website Scanner', icon: '◌' },
      ],
    },
    {
      title: 'Meta',
      color: '#0866FF',
      items: [
        { id: 'creative', label: 'Creative', icon: '▧' },
        { id: 'metaDetail', label: 'Meta Detail', icon: '◉' },
        { id: 'metaKpi', label: 'Meta KPI', icon: '◎' },
        { id: 'creativeFatigue', label: 'Creative Fatigue', icon: '◍' },
        { id: 'budgetAdvisor', label: 'Budget Advisor', icon: '⊞' },
      ],
    },
    {
      title: 'Reports',
      color: '#30d158',
      items: [
        { id: 'weekly', label: 'Weekly', icon: '⟳' },
        { id: 'monthly', label: 'Monthly', icon: '▦' },
        { id: 'quarter', label: 'Quarter', icon: '◧' },
        { id: 'year', label: 'Year', icon: '◎' },
        { id: 'simulator', label: 'Simulatore', icon: '⊞' },
      ],
    },
    {
      title: 'Intelligence',
      color: '#64d2ff',
      items: [
        { id: 'competitorIntel', label: 'Competitor Intel', icon: '◈' },
        { id: 'priceComparison', label: 'Prezzi vs Competitor', icon: '⚖' },
      ],
    },
    {
      title: 'AI',
      color: '#bf5af2',
      items: [
        { id: 'performanceAgent', label: 'Performance Agent', icon: '✦' },
        { id: 'creativeLab', label: 'Creative Lab', icon: '✧' },
      ],
    },
    {
      title: 'System',
      color: '#86868b',
      items: [
        { id: 'integrations', label: 'Integrazioni', icon: '⚙' },
        { id: 'brandIdentity', label: 'Brand Identity', icon: '◉' },
        { id: 'settings', label: 'Settings', icon: '✦' },
      ],
    },
  ]

  const goTo = (id) => {
    if (typeof setTab === 'function') setTab(id)
  }

  // ── Accordion gruppi sidebar ──────────────────────────────
  // Apre di default solo il gruppo che contiene la tab attiva.
  const groupOf = (t) => navGroups.find(g => g.items.some(i => i.id === t))?.title
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
      background: '#000',
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
              color: '#fff',
            }}>
              LyftAI
            </span>
          </div>

          {/* Workspace pill — dinamica da user.company_name */}
          <WorkspacePill />
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
          {navGroups.map((group) => {
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
                  color: isOpen || hasActive ? '#fff' : 'var(--text2)',
                  fontSize: 13,
                  fontWeight: 800,
                  textTransform: 'uppercase',
                  letterSpacing: '0.10em',
                  transition: 'color 0.15s ease',
                }}
                onMouseEnter={e => { e.currentTarget.style.color = '#fff' }}
                onMouseLeave={e => { e.currentTarget.style.color = (isOpen || hasActive) ? '#fff' : 'var(--text2)' }}
              >
                <span style={{
                  width: 5, height: 5, borderRadius: '50%',
                  background: group.color, flexShrink: 0,
                  boxShadow: `0 0 6px ${group.color}`,
                  opacity: isOpen || hasActive ? 1 : 0.5,
                }} />
                <span style={{ flex: 1, textAlign: 'left' }}>{group.title}</span>
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
                        color: active ? '#fff' : 'var(--text2)',
                        background: active ? 'rgba(255,255,255,0.08)' : 'transparent',
                        fontSize: 12,
                        fontWeight: active ? 600 : 500,
                        transition: 'all 0.15s ease',
                        outline: 'none',
                      }}
                      onMouseEnter={e => { if (!active) e.currentTarget.style.background = 'rgba(255,255,255,0.04)' }}
                      onMouseLeave={e => { if (!active) e.currentTarget.style.background = 'transparent' }}
                    >
                      <span style={{
                        width: 20,
                        color: active ? '#fff' : group.color,
                        fontSize: 14,
                        display: 'inline-flex',
                        justifyContent: 'center',
                        opacity: active ? 1 : 0.6,
                        transition: 'opacity 0.15s',
                      }}>
                        {item.icon}
                      </span>
                      <span>{item.label}</span>
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
          }}>
            <div>
              <h1 className="heading-lg" style={{ marginBottom: 6 }}>
                {getPageTitle(tab)}
              </h1>
              <p style={{
                margin: 0,
                color: 'var(--text3)',
                fontSize: 14,
                fontWeight: 400,
              }}>
                {getPageSubtitle(tab)}
              </p>
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              flexShrink: 0,
            }}>
              <AlertsBell />
              {setPreset && (tab === 'dashboard' || tab === 'attribution') && (
                <TimeframeSelector value={preset} onChange={setPreset} disabled={loading} />
              )}
              {/* Tab che hanno il loro Aggiorna interno → nascondiamo
                  il bottone globale per non duplicarlo */}
              {onRefresh && !['weekly','monthly','quarter','year','metaDetail','metaKpi','cro','kpiBrain','webScanner','competitorIntel'].includes(tab) && (
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
                  {loading ? 'Carico…' : 'Aggiorna'}
                </button>
              )}
              {['monthly', 'quarter', 'year', 'attribution'].includes(tab) && (
                <DownloadReportButton tab={getPageTitle(tab)} preset={preset} />
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

  useEffect(() => {
    const supabase = getBrowserSupabase()
    if (!supabase) return
    supabase.auth.getUser().then(({ data: { user } }) => {
      const meta = user?.user_metadata || {}
      const name = meta.company_name || meta.companyName
      if (name) setCompanyName(name)
    })
  }, [])

  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid var(--border)',
      borderRadius: 12,
      padding: '10px 14px',
      display: 'flex',
      alignItems: 'center',
      gap: 10,
    }}>
      <span style={{
        width: 28, height: 28, borderRadius: 7,
        background: 'linear-gradient(135deg, #2997ff, #bf5af2)',
        display: 'inline-block', flexShrink: 0,
      }} />
      <span style={{ flex: 1, minWidth: 0 }}>
        <span style={{
          display: 'block', fontSize: 13, fontWeight: 700, color: '#fff',
          whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
        }}>{companyName}</span>
        <span style={{ display: 'block', fontSize: 10, color: 'var(--text3)', marginTop: 1 }}>Shopify + Meta</span>
      </span>
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
          color: '#fff', fontSize: 11, fontWeight: 700,
          flexShrink: 0,
        }}>{initials}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
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
          border: '1px solid rgba(255,255,255,0.10)',
          borderRadius: 11,
          boxShadow: '0 20px 60px rgba(0,0,0,0.7)',
          padding: 6,
          zIndex: 100,
        }}>
          <div style={{
            padding: '8px 12px',
            fontSize: 11, color: 'var(--text3)',
            borderBottom: '1px solid rgba(255,255,255,0.06)',
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
