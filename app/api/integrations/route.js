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
      description: 'Sync store data, orders, and customers',
      category: 'Commerce',
      domain: 'shopify.com',
      active: check('SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_TOKEN'),
      envVars: ['SHOPIFY_STORE_URL', 'SHOPIFY_ADMIN_TOKEN'],
      setupUrl: 'https://admin.shopify.com/store/YOUR_STORE/settings/apps/development',
      scope: 'workspace',
    },
    {
      id: 'meta',
      name: 'Meta Ads',
      description: 'Connect Facebook and Instagram ad accounts',
      category: 'Advertising',
      domain: 'meta.com',
      active: check('META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'),
      envVars: ['META_ACCESS_TOKEN', 'META_AD_ACCOUNT_ID'],
      setupUrl: 'https://business.facebook.com/settings/system-users',
      scope: 'workspace',
    },
    {
      id: 'klaviyo',
      name: 'Klaviyo',
      description: 'Sync email campaigns, flows, and segments',
      category: 'Email Marketing',
      domain: 'klaviyo.com',
      active: check('KLAVIYO_API_KEY'),
      envVars: ['KLAVIYO_API_KEY'],
      setupUrl: 'https://www.klaviyo.com/settings/account/api-keys',
      scope: 'workspace',
    },
    {
      id: 'google_ads',
      name: 'Google Ads',
      description: 'Track Google Ads campaigns and conversions',
      category: 'Advertising',
      domain: 'ads.google.com',
      active: check('GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_REFRESH_TOKEN'),
      envVars: ['GOOGLE_ADS_DEVELOPER_TOKEN', 'GOOGLE_ADS_CUSTOMER_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
      setupUrl: 'https://ads.google.com/aw/apicenter',
      scope: 'workspace',
    },
    {
      id: 'ga4',
      name: 'Google Analytics',
      description: 'Connect GA4 for website analytics',
      category: 'Analytics',
      domain: 'analytics.google.com',
      active: check('GA4_PROPERTY_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_REFRESH_TOKEN'),
      envVars: ['GA4_PROPERTY_ID', 'GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'],
      setupUrl: 'https://analytics.google.com/analytics/web/',
      scope: 'workspace',
    },
    {
      id: 'tiktok_ads',
      name: 'TikTok Ads',
      description: 'Track TikTok ad performance and spend',
      category: 'Advertising',
      domain: 'tiktok.com',
      active: check('TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'),
      envVars: ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_ADVERTISER_ID'],
      setupUrl: 'https://business-api.tiktok.com/portal/apps',
      scope: 'workspace',
    },
    {
      id: 'openai',
      name: 'OpenAI',
      description: 'AI agents, performance analysis, creative generation',
      category: 'AI',
      domain: 'openai.com',
      active: check('OPENAI_API_KEY'),
      envVars: ['OPENAI_API_KEY'],
      setupUrl: 'https://platform.openai.com/api-keys',
      scope: 'workspace',
    },
  ]

  const active = integrations.filter(i => i.active)
  const available = integrations.filter(i => !i.active)

  return NextResponse.json({ active, available })
}
