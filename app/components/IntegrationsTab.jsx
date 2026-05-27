'use client'

import { useEffect, useState } from 'react'

const LOGO_MAP = {
  'shopify.com':          { slug: 'shopify',          color: '95BF47' },
  'meta.com':             { slug: 'meta',             color: '0081FB' },
  'klaviyo.com':          { slug: 'klaviyo',          color: '29B473' },
  'ads.google.com':       { slug: 'googleads',        color: '4285F4' },
  'analytics.google.com': { slug: 'googleanalytics',  color: 'E37400' },
  'tiktok.com':           { slug: 'tiktok',           color: '000000', dark: true },
  'pinterest.com':        { slug: 'pinterest',        color: 'E60023' },
  'snapchat.com':         { slug: 'snapchat',         color: 'FFFC00', dark: true },
  'openai.com':           { slug: 'openai',           color: '412991', dark: true },
  'gmail.com':            { slug: 'gmail',            color: 'EA4335' },
  'calendar.google.com':  { slug: 'googlecalendar',   color: '4285F4' },
  'drive.google.com':     { slug: 'googledrive',      color: '4285F4' },
  'quickbooks.intuit.com':{ slug: 'quickbooks',       color: '2CA01C' },
  'stripe.com':           { slug: 'stripe',           color: '635BFF' },
  'hotjar.com':           { slug: 'hotjar',           color: 'FD3A5C' },
  'slack.com':            { slug: 'slack',            color: '4A154B' },
  'notion.so':            { slug: 'notion',           color: '000000', dark: true },
  'zapier.com':           { slug: 'zapier',           color: 'FF4A00' },
}

function BrandLogo({ domain, size = 40 }) {
  const [err, setErr] = useState(false)
  const entry = LOGO_MAP[domain]

  if (entry && !err) {
    const iconUrl = `https://cdn.simpleicons.org/${entry.slug}/${entry.color}`
    return (
      <div style={{
        width: size, height: size, borderRadius: 12,
        background: entry.dark ? '#1a1525' : '#fff',
        display: 'grid', placeItems: 'center', flexShrink: 0,
        padding: Math.round(size * 0.18),
      }}>
        <img
          src={iconUrl}
          alt=""
          width={Math.round(size * 0.64)}
          height={Math.round(size * 0.64)}
          style={{ objectFit: 'contain' }}
          onError={() => setErr(true)}
        />
      </div>
    )
  }

  if (!err && domain) {
    return (
      <img
        src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
        alt=""
        width={size}
        height={size}
        style={{ borderRadius: 12, objectFit: 'contain', background: '#fff', flexShrink: 0 }}
        onError={() => setErr(true)}
      />
    )
  }

  return (
    <div style={{
      width: size, height: size, borderRadius: 12,
      background: '#1a1525', display: 'grid', placeItems: 'center',
      fontSize: size * 0.4, color: '#776a86', fontWeight: 900, flexShrink: 0,
    }}>
      {(domain || '?').charAt(0).toUpperCase()}
    </div>
  )
}

function ScopeBadge({ scope }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
      background: '#8b5cf615', color: '#c4b5fd',
      textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      {scope === 'workspace' ? 'Workspace-level' : 'User-level'}
    </span>
  )
}

function CategoryBadge({ category }) {
  const colors = {
    Commerce: '#22c55e',
    Advertising: '#3b82f6',
    'Email Marketing': '#8b5cf6',
    Analytics: '#f59e0b',
    AI: '#ec4899',
  }
  const color = colors[category] || '#9b90aa'
  return (
    <span style={{
      fontSize: 9, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
      background: `${color}18`, color,
      textTransform: 'uppercase', letterSpacing: '.04em',
    }}>
      {category}
    </span>
  )
}

function ConnectedCard({ integration }) {
  const { name, description, domain, category, scope } = integration
  return (
    <div style={{
      background: '#110d1a',
      border: '1px solid #22c55e33',
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <BrandLogo domain={domain} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#f7f2ff' }}>{name}</div>
          <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 2 }}>{description}</div>
        </div>
        <div style={{
          width: 32, height: 32, borderRadius: '50%',
          background: '#22c55e22', display: 'grid', placeItems: 'center',
        }}>
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8.5L6.5 12L13 4" stroke="#22c55e" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        <ScopeBadge scope={scope} />
        <CategoryBadge category={category} />
        <span style={{
          fontSize: 10, fontWeight: 800, color: '#22c55e',
          display: 'inline-flex', alignItems: 'center', gap: 4,
          marginLeft: 'auto',
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
          Connected
        </span>
      </div>
    </div>
  )
}

function AvailableCard({ integration, onConnect }) {
  const { name, description, domain, category, scope } = integration
  return (
    <div style={{
      background: '#110d1a',
      border: '1px solid #292134',
      borderRadius: 16,
      padding: '20px 22px',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <BrandLogo domain={domain} size={44} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 16, fontWeight: 900, color: '#f7f2ff' }}>{name}</div>
          <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 2 }}>{description}</div>
        </div>
        <button
          onClick={() => onConnect(integration)}
          style={{
            background: 'none', border: 'none',
            color: '#9b90aa', fontSize: 18, cursor: 'pointer',
            padding: '4px 8px',
          }}
        >
          →
        </button>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <ScopeBadge scope={scope} />
        <CategoryBadge category={category} />
      </div>
    </div>
  )
}

const COMING_SOON = [
  { name: 'Gmail', description: 'Sync emails and message data', domain: 'gmail.com', scope: 'user' },
  { name: 'Google Calendar', description: 'Sync calendar events and schedules', domain: 'calendar.google.com', scope: 'user' },
  { name: 'Google Drive', description: 'Shared Drive files with domain-wide access', domain: 'drive.google.com', scope: 'user' },
  { name: 'QuickBooks', description: 'Sync invoices and financial data', domain: 'quickbooks.intuit.com', scope: 'workspace' },
  { name: 'Stripe', description: 'Payment processing and revenue data', domain: 'stripe.com', scope: 'workspace' },
  { name: 'Hotjar', description: 'Heatmaps, recordings, and user feedback', domain: 'hotjar.com', scope: 'workspace' },
  { name: 'Slack', description: 'Team notifications and alerts', domain: 'slack.com', scope: 'workspace' },
  { name: 'Notion', description: 'Docs, wikis, and project management', domain: 'notion.so', scope: 'workspace' },
  { name: 'Zapier', description: 'Connect with 5000+ apps via automations', domain: 'zapier.com', scope: 'workspace' },
]

function ConnectModal({ integration, onClose }) {
  if (!integration) return null
  const { name, domain, setupUrl, envVars, description } = integration

  return (
    <div
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,.75)', backdropFilter: 'blur(8px)',
        display: 'grid', placeItems: 'center',
      }}
      onClick={onClose}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#14111d',
          border: '1px solid #292134',
          borderRadius: 20,
          padding: '28px 32px',
          maxWidth: 480,
          width: '90%',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
          <BrandLogo domain={domain} size={48} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 20, fontWeight: 950, color: '#fff' }}>{name}</div>
            <div style={{ fontSize: 12, color: '#9b90aa', marginTop: 2 }}>{description}</div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 32, height: 32, borderRadius: 10,
              background: '#1a1525', border: '1px solid #292134',
              color: '#776a86', fontSize: 16, cursor: 'pointer',
              display: 'grid', placeItems: 'center',
            }}
          >
            ✕
          </button>
        </div>

        <a
          href={setupUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'flex', alignItems: 'center', gap: 14,
            padding: '16px 20px', borderRadius: 14,
            background: 'linear-gradient(135deg, #6d28d9, #8b5cf6)',
            textDecoration: 'none', cursor: 'pointer',
            marginBottom: 16,
          }}
        >
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'rgba(255,255,255,.15)',
            display: 'grid', placeItems: 'center',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="7" stroke="#fff" strokeWidth="1.5"/>
              <path d="M6 8h4M8 6v4" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: '#fff' }}>Connect with OAuth</div>
            <div style={{ fontSize: 11, color: 'rgba(255,255,255,.6)', marginTop: 2 }}>
              Secure, one-click authentication
            </div>
          </div>
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ marginRight: 4 }}>
            <path d="M5 2h7v7M12 2L2 12" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={{ color: 'rgba(255,255,255,.5)', fontSize: 16 }}>›</span>
        </a>

        {envVars?.length > 0 && (
          <div style={{
            background: '#1a1525', borderRadius: 12, padding: '14px 16px', marginBottom: 16,
          }}>
            <div style={{ fontSize: 10, fontWeight: 800, color: '#776a86', textTransform: 'uppercase', marginBottom: 8, letterSpacing: '.08em' }}>
              Environment variables (Vercel)
            </div>
            {envVars.map(v => (
              <div key={v} style={{
                fontSize: 12, fontWeight: 700, color: '#c4b5fd',
                fontFamily: 'monospace', padding: '3px 0',
              }}>
                {v}
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: 11, color: '#776a86', textAlign: 'center', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <circle cx="6" cy="6" r="5" stroke="#776a86" strokeWidth="1"/>
            <path d="M6 4v2.5M6 8h.005" stroke="#776a86" strokeWidth="1" strokeLinecap="round"/>
          </svg>
          Ensure popups are enabled in your browser for authentication
        </div>
      </div>
    </div>
  )
}

export default function IntegrationsTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)

  useEffect(() => {
    fetch('/api/integrations', { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: '#9b90aa', padding: 40, fontSize: 15, fontWeight: 700 }}>Loading integrations...</div>
  }

  if (!data) {
    return <div style={{ color: '#ef4444', padding: 40 }}>Error loading integrations</div>
  }

  const { active, available } = data

  const sectionHeader = (label, count, color) => (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      margin: '0 0 16px',
    }}>
      <div style={{
        width: 3, height: 18, borderRadius: 2,
        background: color,
      }} />
      <span style={{
        fontSize: 12, fontWeight: 950, color,
        textTransform: 'uppercase', letterSpacing: '.14em',
      }}>
        {label} ({count})
      </span>
    </div>
  )

  return (
    <div>
      {active.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          {sectionHeader('Connected', active.length, '#22c55e')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {active.map(i => (
              <ConnectedCard key={i.id} integration={i} />
            ))}
          </div>
        </div>
      )}

      {available.length > 0 && (
        <div style={{ marginBottom: 36 }}>
          {sectionHeader('Available', available.length, '#8b5cf6')}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
            {available.map(i => (
              <AvailableCard key={i.id} integration={i} onConnect={setSelected} />
            ))}
          </div>
        </div>
      )}

      <div style={{ marginBottom: 36 }}>
        {sectionHeader('Coming soon', COMING_SOON.length, '#776a86')}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))', gap: 14 }}>
          {COMING_SOON.map(cs => (
            <div key={cs.name} style={{
              background: '#110d1a',
              border: '1px solid #1e1829',
              borderRadius: 16,
              padding: '18px 22px',
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              opacity: 0.6,
            }}>
              <BrandLogo domain={cs.domain} size={38} />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#f7f2ff' }}>{cs.name}</div>
                <div style={{ fontSize: 11, color: '#776a86', marginTop: 2 }}>{cs.description}</div>
              </div>
              <span style={{
                fontSize: 10, fontWeight: 800, color: '#776a86',
                padding: '3px 10px', borderRadius: 6, background: '#1a1525',
              }}>
                Soon
              </span>
            </div>
          ))}
        </div>
      </div>

      <ConnectModal integration={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
