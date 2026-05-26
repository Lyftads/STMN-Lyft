export const dynamic = 'force-dynamic'

import { NextResponse } from 'next/server'

function check(...vars) {
  return vars.every(v => !!process.env[v])
}

export async function GET() {
  const integrations = [
    {
      id: 'shopify',
      name: 'Shopify',
      category: 'Commerce',
      icon: '🛍',
      active: check('SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_TOKEN'),
      envVars: ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_TOKEN'],
      setupUrl: 'https://admin.shopify.com/store/YOUR_STORE/settings/apps/development',
      instructions: [
        'Vai su Shopify Admin → Settings → Apps and sales channels → Develop apps',
        'Crea una nuova app o seleziona quella esistente',
        'In API credentials, copia Admin API access token',
        'Aggiungi SHOPIFY_STORE_URL (es. your-store.myshopify.com) e SHOPIFY_ADMIN_TOKEN su Vercel',
      ],
    },
    {
      id: 'meta',
      name: 'Meta Ads',
      category: 'Advertising',
      icon: '📘',
      active: check('META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'),
      envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
      setupUrl: 'https://business.facebook.com/settings/system-users',
      instructions: [
        'Vai su Meta Business Suite → Settings → System Users',
        'Crea un system user o usa quello esistente',
        'Genera un token con permessi: ads_read, ads_management, read_insights',
        'Copia l\'Ad Account ID (formato: act_XXXXXXXX)',
        'Aggiungi META_ACCESS_TOKEN e META_AD_ACCOUNT_ID su Vercel',
      ],
    },
    {
      id: 'klaviyo',
      name: 'Klaviyo',
      category: 'Email Marketing',
      icon: '✉️',
      active: check('KLAVIYO_API_KEY'),
      envVars: ['KLAVIYO_API_KEY'],
      setupUrl: 'https://www.klaviyo.com/settings/account/api-keys',
      instructions: [
        'Vai su Klaviyo → Settings → API Keys',
        'Crea una nuova Private API Key (o copia quella esistente)',
        'Aggiungi KLAVIYO_API_KEY su Vercel',
      ],
    },
    {
      id: 'google_ads',
      name: 'Google Ads',
      category: 'Advertising',
      icon: '📊',
      active: check('GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_REFRESH_TOKEN'),
      envVars: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
      setupUrl: 'https://ads.google.com/aw/apicenter',
      instructions: [
        'Vai su Google Ads → Tools → API Center e richiedi un Developer Token',
        'Crea un progetto su Google Cloud Console → APIs & Services → Credentials',
        'Crea OAuth 2.0 Client ID (tipo: Web application)',
        'Usa OAuth Playground per generare un Refresh Token con scope ads',
        'Copia il Customer ID (formato: XXX-XXX-XXXX, rimuovi i trattini)',
        'Aggiungi tutte le variabili su Vercel: GOOGLE_ADS_DEVELOPER_TOKEN, GOOGLE_ADS_CUSTOMER_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN',
      ],
    },
    {
      id: 'ga4',
      name: 'Google Analytics 4',
      category: 'Analytics',
      icon: '📈',
      active: check('GA4_PROPERTY_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_REFRESH_TOKEN'),
      envVars: ['GA4_PROPERTY_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
      setupUrl: 'https://analytics.google.com/analytics/web/#/a/p/admin/account/property',
      instructions: [
        'Vai su Google Analytics → Admin → Property Settings e copia il Property ID',
        'Usa lo stesso progetto Google Cloud di Google Ads (o creane uno nuovo)',
        'Abilita la Google Analytics Data API nel progetto',
        'Usa OAuth Playground con scope analytics.readonly per generare un Refresh Token',
        'Aggiungi GA4_PROPERTY_ID su Vercel (le credenziali Google sono condivise con Google Ads)',
      ],
    },
    {
      id: 'tiktok_ads',
      name: 'TikTok Ads',
      category: 'Advertising',
      icon: '🎵',
      active: check('TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'),
      envVars: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'],
      setupUrl: 'https://business-api.tiktok.com/portal/apps',
      instructions: [
        'Vai su TikTok for Business → Marketing API → My Apps',
        'Crea una nuova app o seleziona quella esistente',
        'Richiedi i permessi: Ad Account Management, Ad Management, Reporting',
        'Genera un long-lived Access Token dalla dashboard dell\'app',
        'Copia l\'Advertiser ID dal TikTok Ads Manager (numero in alto a destra)',
        'Aggiungi TIKTOK_ACCESS_TOKEN e TIKTOK_ADVERTISER_ID su Vercel',
      ],
    },
    {
      id: 'pinterest_ads',
      name: 'Pinterest Ads',
      category: 'Advertising',
      icon: '📌',
      active: check('PINTEREST_ACCESS_TOKEN', 'PINTEREST_AD_ACCOUNT_ID'),
      envVars: ['PINTEREST_ACCESS_TOKEN', 'PINTEREST_AD_ACCOUNT_ID'],
      setupUrl: 'https://developers.pinterest.com/apps/',
      instructions: [
        'Vai su Pinterest Developers → My Apps e crea un\'app',
        'Richiedi accesso alla Marketing API',
        'Genera un Access Token con scope: ads:read',
        'Copia l\'Ad Account ID da Pinterest Ads Manager',
        'Aggiungi PINTEREST_ACCESS_TOKEN e PINTEREST_AD_ACCOUNT_ID su Vercel',
      ],
    },
    {
      id: 'snapchat_ads',
      name: 'Snapchat Ads',
      category: 'Advertising',
      icon: '👻',
      active: check('SNAPCHAT_ACCESS_TOKEN', 'SNAPCHAT_AD_ACCOUNT_ID'),
      envVars: ['SNAPCHAT_ACCESS_TOKEN', 'SNAPCHAT_AD_ACCOUNT_ID'],
      setupUrl: 'https://business.snapchat.com/',
      instructions: [
        'Vai su Snap Business Manager → Business Settings → API Tokens',
        'Crea un token con permessi di lettura campagne',
        'Copia l\'Ad Account ID',
        'Aggiungi SNAPCHAT_ACCESS_TOKEN e SNAPCHAT_AD_ACCOUNT_ID su Vercel',
      ],
    },
    {
      id: 'openai',
      name: 'OpenAI (Agent)',
      category: 'AI',
      icon: '🤖',
      active: check('OPENAI_API_KEY'),
      envVars: ['OPENAI_API_KEY'],
      setupUrl: 'https://platform.openai.com/api-keys',
      instructions: [
        'Vai su OpenAI Platform → API Keys',
        'Crea una nuova API key',
        'Aggiungi OPENAI_API_KEY su Vercel',
      ],
    },
  ]

  const active = integrations.filter(i => i.active)
  const available = integrations.filter(i => !i.active)

  return NextResponse.json({ active, available })
}
