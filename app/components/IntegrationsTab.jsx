'use client'

import { useEffect, useState } from 'react'

const BRAND_COLORS = {
  'shopify.com': '#95BF47',
  'meta.com': '#0081FB',
  'klaviyo.com': '#29B473',
  'ads.google.com': '#4285F4',
  'analytics.google.com': '#E37400',
  'tiktok.com': '#000000',
  'pinterest.com': '#E60023',
  'snapchat.com': '#FFFC00',
  'openai.com': '#000000',
  'gmail.com': '#EA4335',
  'calendar.google.com': '#4285F4',
  'drive.google.com': '#0F9D58',
  'quickbooks.intuit.com': '#2CA01C',
  'stripe.com': '#635BFF',
  'hotjar.com': '#FD3A5C',
  'slack.com': '#4A154B',
  'notion.so': '#000000',
  'zapier.com': '#FF4A00',
}

const BRAND_ICONS = {
  'shopify.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M15.34 3.04c-.03 0-.06.02-.08.04-.02.02-.34.44-.74 1-.38-.64-.96-1.19-1.7-1.27-.02 0-.04 0-.06.01l-.23.04C12.24 2.3 11.82 2 11.26 2c-1.36.04-2.72 1.71-3.52 3.64-.92.29-1.56.49-1.58.5-.47.15-.48.16-.54.6C5.56 7.14 4 19 4 19l9.02 1.6L20 19.2s-4.58-15.82-4.6-15.9c-.02-.08-.03-.14-.06-.26zM12.36 5.3l-1.84.57c.36-1.08.96-2.12 1.6-2.68.24.38.36.93.24 2.11zm-1.1-2.96c.1 0 .2.04.3.1-.76.56-1.54 1.84-1.9 3.14l-1.46.45c.44-1.56 1.54-3.65 3.06-3.69zm.28 8.84c-.06-.28-.96-.34-1.44-.14-.86.36-1.4 1.24-1.24 2.1.22 1.24 1.7 1.34 2.2.48.32-.56.54-1.62.48-2.44zM12.7 4.2c-.02-.9-.14-1.5-.34-1.9.34.04.62.4.84.86-.16.32-.34.66-.5 1.04z" fill="#95BF47"/><path d="M15.26 3.08c-.02-.04-.04-.04-.06-.04-.02 0-.06.02-.08.04 0 0-.34.44-.74 1l-.44 1.68 1.74-.54c-.1-.36-.22-.72-.36-1.1-.02-.08-.03-.14-.06-1.04z" fill="#5E8E3E"/></svg>,
  'meta.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill="#0081FB"/></svg>,
  'klaviyo.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M2 4l10 8L22 4H2zm0 2.5V20h20V6.5L12 14.5 2 6.5z" fill="#29B473"/></svg>,
  'ads.google.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="3" fill="#FBBC05"/><path d="M12 7L17 17H7L12 7z" fill="#4285F4"/><rect x="4" y="14" width="6" height="6" rx="1" fill="#34A853"/><rect x="14" y="14" width="6" height="6" rx="1" fill="#EA4335"/></svg>,
  'analytics.google.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="14" width="4" height="7" rx="1" fill="#E37400"/><rect x="10" y="8" width="4" height="13" rx="1" fill="#E37400" opacity=".7"/><rect x="17" y="3" width="4" height="18" rx="1" fill="#E37400" opacity=".4"/></svg>,
  'tiktok.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .56.04.82.12V9.01a6.34 6.34 0 00-.82-.05A6.34 6.34 0 003.15 15.3a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V8.96a8.27 8.27 0 004.83 1.56V7.07a4.84 4.84 0 01-1.07-.38z" fill="#fff"/></svg>,
  'pinterest.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2C6.477 2 2 6.477 2 12c0 4.237 2.636 7.855 6.356 9.312-.088-.791-.167-2.005.035-2.868.181-.78 1.172-4.97 1.172-4.97s-.299-.598-.299-1.482c0-1.388.805-2.424 1.808-2.424.852 0 1.264.64 1.264 1.408 0 .858-.546 2.14-.828 3.33-.236.995.499 1.806 1.48 1.806 1.778 0 3.144-1.874 3.144-4.58 0-2.394-1.72-4.068-4.177-4.068-2.845 0-4.515 2.134-4.515 4.34 0 .859.331 1.781.745 2.282a.3.3 0 01.069.288l-.278 1.133c-.044.183-.145.222-.335.134-1.249-.581-2.03-2.407-2.03-3.874 0-3.154 2.292-6.052 6.608-6.052 3.469 0 6.165 2.472 6.165 5.776 0 3.447-2.173 6.22-5.19 6.22-1.013 0-1.965-.527-2.291-1.148l-.623 2.378c-.226.869-.835 1.958-1.244 2.621.937.29 1.931.446 2.962.446 5.523 0 10-4.477 10-10S17.523 2 12 2z" fill="#E60023"/></svg>,
  'snapchat.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M12 2C9.2 2 7.3 3.4 6.5 5.8c-.2.5-.3 1.2-.3 2.1v1.6c-.7-.1-1.4.1-1.7.5-.2.3-.1.6.2.8.7.5 1.5.7 1.5.7 0 .4-.3 1.2-.9 2-.5.7-1.2 1.1-1.5 1.3-.4.2-.5.6-.3.9.2.4.7.6 1.5.7.2 0 .3.3.3.5 0 .3-.1.6-.1.7 0 .3.2.5.5.6.5.1 1.1.2 1.6.5.4.3.8.8 1.7.9.9.2 1.6.3 2.5.3s1.6-.1 2.5-.3c.9-.1 1.3-.7 1.7-.9.5-.3 1.1-.4 1.6-.5.3-.1.5-.3.5-.6 0-.1-.1-.4-.1-.7 0-.2.1-.4.3-.5.8-.1 1.3-.3 1.5-.7.2-.3.1-.7-.3-.9-.3-.2-1-.6-1.5-1.3-.6-.8-.9-1.6-.9-2 0 0 .8-.2 1.5-.7.3-.2.4-.5.2-.8-.3-.4-1-.6-1.7-.5V7.9c0-.9-.1-1.6-.3-2.1C16.7 3.4 14.8 2 12 2z" fill="#FFFC00"/></svg>,
  'openai.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M22.28 9.37a5.85 5.85 0 00-.5-4.79 5.89 5.89 0 00-6.35-2.83A5.85 5.85 0 0011.1.22a5.89 5.89 0 00-5.62 4.1 5.85 5.85 0 00-3.9 2.83 5.89 5.89 0 00.72 6.9 5.85 5.85 0 00.5 4.78 5.89 5.89 0 006.35 2.84 5.85 5.85 0 004.33 1.53 5.89 5.89 0 005.62-4.1 5.85 5.85 0 003.9-2.84 5.89 5.89 0 00-.72-6.89z" fill="#fff"/></svg>,
  'stripe.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M13.976 9.15c-2.172-.806-3.356-1.426-3.356-2.409 0-.831.683-1.305 1.901-1.305 2.227 0 4.515.858 6.09 1.631l.89-5.494C18.252.975 15.697 0 12.165 0 9.667 0 7.589.654 6.104 1.872 4.56 3.147 3.757 4.918 3.757 7.11c0 4.46 2.726 5.685 5.766 6.957 2.09.867 2.974 1.59 2.974 2.586 0 1.027-.862 1.634-2.384 1.634-2.048 0-5.268-1.042-7.3-2.414L2 21.544C3.917 22.769 7.075 24 10.57 24c2.626 0 4.787-.66 6.312-1.878 1.63-1.298 2.363-3.147 2.363-5.476 0-4.583-2.79-5.905-5.269-6.996z" fill="#635BFF"/></svg>,
  'gmail.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M2 6l10 7 10-7v12H2V6z" fill="#EA4335"/><path d="M22 6l-10 7L2 6h20z" fill="#FBBC05"/></svg>,
  'slack.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M5.04 15.16a2.5 2.5 0 11-2.5-2.5h2.5v2.5zm1.26 0a2.5 2.5 0 115 0v6.26a2.5 2.5 0 11-5 0v-6.26z" fill="#E01E5A"/><path d="M8.8 5.04a2.5 2.5 0 112.5-2.5v2.5H8.8zm0 1.3a2.5 2.5 0 110 5H2.54a2.5 2.5 0 110-5H8.8z" fill="#36C5F0"/><path d="M18.96 8.84a2.5 2.5 0 112.5 2.5h-2.5V8.84zm-1.26 0a2.5 2.5 0 11-5 0V2.54a2.5 2.5 0 115 0v6.3z" fill="#2EB67D"/><path d="M15.2 18.96a2.5 2.5 0 11-2.5 2.5v-2.5h2.5zm0-1.26a2.5 2.5 0 110-5h6.26a2.5 2.5 0 110 5H15.2z" fill="#ECB22E"/></svg>,
  'notion.so': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M4 4.5A1.5 1.5 0 015.5 3h9.586a1.5 1.5 0 011.06.44l3.415 3.414A1.5 1.5 0 0120 7.914V19.5a1.5 1.5 0 01-1.5 1.5h-13A1.5 1.5 0 014 19.5v-15z" stroke="#fff" strokeWidth="1.5"/><path d="M8 12h8M8 16h5" stroke="#fff" strokeWidth="1.5" strokeLinecap="round"/></svg>,
  'zapier.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M15.54 8.46l-2.83-2.83a1 1 0 00-1.42 0L8.46 8.46a1 1 0 000 1.41L11.29 12l-2.83 2.83a1 1 0 000 1.41l2.83 2.83a1 1 0 001.42 0l2.83-2.83a1 1 0 000-1.41L12.71 12l2.83-2.83a1 1 0 000-1.41z" fill="#FF4A00"/></svg>,
  'hotjar.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M16 2c0 4-2 6-4 8s-4 4-4 8h4c0-4 2-6 4-8s4-4 4-8h-4zM8 6c0 4-2 6-4 8h4c0-2 1-3 2-4s2-2 2-4H8z" fill="#FD3A5C"/></svg>,
  'drive.google.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><path d="M8 2l-6 10.5h4.5L12 2H8z" fill="#0F9D58"/><path d="M12 2l5.5 10.5H22L16 2h-4z" fill="#FBBC05"/><path d="M2 12.5L4.5 17h15L17 12.5H2z" fill="#4285F4"/></svg>,
  'calendar.google.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="17" rx="2" stroke="#4285F4" strokeWidth="2"/><path d="M3 9h18" stroke="#4285F4" strokeWidth="2"/><path d="M8 2v4M16 2v4" stroke="#4285F4" strokeWidth="2" strokeLinecap="round"/><rect x="7" y="12" width="3" height="3" rx=".5" fill="#4285F4"/><rect x="14" y="12" width="3" height="3" rx=".5" fill="#4285F4"/></svg>,
  'quickbooks.intuit.com': (s) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" fill="#2CA01C"/><path d="M8 8v8l4-4-4-4zm4 0l4 4-4 4V8z" fill="#fff"/></svg>,
}

function BrandLogo({ domain, size = 40 }) {
  const [err, setErr] = useState(false)
  const iconFn = BRAND_ICONS[domain]
  const bgColor = BRAND_COLORS[domain] || '#1a1525'

  if (iconFn) {
    return (
      <div style={{
        width: size, height: size, borderRadius: 12,
        background: domain === 'tiktok.com' || domain === 'openai.com' || domain === 'notion.so' || domain === 'slack.com' ? '#000' : '#fff',
        display: 'grid', placeItems: 'center', flexShrink: 0,
      }}>
        {iconFn(Math.round(size * 0.6))}
      </div>
    )
  }

  const faviconUrl = `https://www.google.com/s2/favicons?domain=${domain}&sz=128`
  if (!err && domain) {
    return (
      <img
        src={faviconUrl}
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
      background: bgColor + '33', display: 'grid', placeItems: 'center',
      fontSize: size * 0.4, color: bgColor, fontWeight: 900, flexShrink: 0,
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
