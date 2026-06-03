export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { withTenantContext, getMeta } from '../../../../lib/tenant/credentials'
import { getRange } from '../../../../lib/metaRange'

// ============================================================================
//  Meta Audit — Strategy Classification (360° style)
//
//  Classifica gli adset attivi in 4 categorie basate sul TARGETING reale
//  (custom audiences subtype + lookalike + excluded):
//    - acquisition_prospecting  (broad/interest/lookalike, no CRM)
//    - acquisition_re_engagement (custom CRM audience con name "lapsed/winback/...")
//    - retargeting              (custom audience WEBSITE/ENGAGEMENT)
//    - retention                (custom audience CRM customer file)
//
//  Per ogni categoria aggrega: spend, revenue, ROAS, purchases, CPP, CPM,
//  CTR + daily time-series per chart trend.
//
//  GET ?preset=last_28d&account_id=act_XXX
//  Output: { categories: { [id]: { metrics, trend, adsets } }, total }
//
//  Robustezza: full pagination, parallel chunked, retry su 429, audience
//  cache per chiamata.
// ============================================================================

const GRAPH = 'https://graph.facebook.com/v19.0'

export async function GET(req) {
  return withTenantContext(req, async () => {
    const { accessToken, adAccountId } = getMeta()
    if (!accessToken) return NextResponse.json({ error: 'Meta token mancante' }, { status: 400 })
    if (!adAccountId) return NextResponse.json({ error: 'Meta Ad Account ID mancante' }, { status: 400 })

    const { searchParams } = new URL(req.url)
    const preset = searchParams.get('preset') || 'last_28d'
    const range = getRange(preset)
    const accountIds = normalizeAccountIds(adAccountId, searchParams.get('account_id'))

    try {
      const result = await buildAudit({ accessToken, accountIds, range })
      return NextResponse.json({
        preset, range,
        accounts: accountIds,
        ...result,
        updatedAt: new Date().toISOString(),
      })
    } catch (err) {
      return NextResponse.json({ error: err?.message || 'Errore Meta', categories: {} }, { status: 200 })
    }
  })
}

function normalizeAccountIds(envAccount, paramAccount) {
  const all = String(envAccount || '').split(',').map(s => s.trim()).filter(Boolean)
    .map(a => a.startsWith('act_') ? a : `act_${a}`)
  if (paramAccount) {
    const p = paramAccount.startsWith('act_') ? paramAccount : `act_${paramAccount}`
    if (all.includes(p)) return [p]
  }
  return all
}

// ── HTTP helpers ─────────────────────────────────────────────────

async function fbGet(url, retries = 2) {
  for (let i = 0; i <= retries; i++) {
    try {
      const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(20_000) })
      if (res.status === 429 || res.status === 500 || res.status === 503) {
        if (i < retries) {
          await new Promise(r => setTimeout(r, 1000 * (i + 1)))
          continue
        }
      }
      const data = await res.json()
      if (data.error) {
        // Rate limit retry
        if (data.error.code === 17 || data.error.code === 4) {
          if (i < retries) {
            await new Promise(r => setTimeout(r, 2000 * (i + 1)))
            continue
          }
        }
        throw new Error(`Meta API: ${data.error.message || data.error.type}`)
      }
      return data
    } catch (e) {
      if (i === retries) throw e
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('Meta API failed after retries')
}

async function fbGetAllPages(url, maxPages = 30) {
  const out = []
  let next = url
  let guard = 0
  while (next && guard < maxPages) {
    guard++
    const data = await fbGet(next)
    for (const r of (data.data || [])) out.push(r)
    next = data.paging?.next || null
  }
  return out
}

// ── Audience cache + subtype classification ──────────────────────

// Map audience.subtype Meta → categoria interna usata in classifyAdset.
// Reference: https://developers.facebook.com/docs/marketing-api/reference/custom-audience
function classifyAudienceSubtype(aud) {
  const subtype = String(aud?.subtype || '').toUpperCase()
  const name = String(aud?.name || '').toLowerCase()
  // Customer file (CRM upload, value-based, dynamic)
  if (subtype === 'CUSTOM' || subtype === 'PARTNER' || subtype === 'CLAIM' ||
      subtype === 'EXTERNAL' || subtype === 'BAG_OF_ACCOUNTS') {
    // CRM. Check se name suggerisce re-engagement
    if (/lapsed|winback|win[- ]?back|re[- ]?engage|dormant|inactive|churned|past[- ]?customer|3[06]0?d|60[- ]?day|90[- ]?day|180[- ]?day/i.test(name)) {
      return 'crm_lapsed'
    }
    return 'crm_active'
  }
  if (subtype === 'WEBSITE') return 'website'
  if (subtype === 'APP') return 'app'
  if (subtype === 'ENGAGEMENT' || subtype === 'IG_BUSINESS' || subtype === 'VIDEO' ||
      subtype === 'OFFLINE_CONVERSION' || subtype === 'EVENT_BASED' || subtype === 'FB_PIXEL') {
    return 'engagement'
  }
  if (subtype === 'LOOKALIKE') return 'lookalike'
  if (subtype === 'PRIMARY' || subtype === 'CITY' || subtype === 'STUDY_RULE_AUDIENCE') return 'engagement'
  return 'unknown'
}

async function fetchAudiencesMap(accessToken, accountIds, audienceIdsSet) {
  const map = new Map()

  // 1) Prima prova: fetch TUTTE le custom audiences di ogni account in 1 call.
  //    Piu' affidabile del batch by IDs (che spesso ritorna null per audiences
  //    cross-account o senza permission diretto).
  for (const accId of accountIds) {
    const url = `${GRAPH}/${accId}/customaudiences?fields=id,name,subtype,customer_file_source&limit=500&access_token=${accessToken}`
    try {
      const list = await fbGetAllPages(url, 10)
      for (const a of list) {
        if (a?.id) map.set(a.id, a)
      }
    } catch (e) {
      console.log('[meta-audit] account audiences fetch failed', accId, e?.message)
    }
  }

  // 2) Per gli IDs non risolti dal listing account (es. audiences in altro
  //    account shared), fallback su batch by IDs.
  const missing = Array.from(audienceIdsSet).filter(id => !map.has(id))
  if (missing.length > 0) {
    const chunks = []
    for (let i = 0; i < missing.length; i += 50) chunks.push(missing.slice(i, i + 50))
    for (const chunk of chunks) {
      const url = `${GRAPH}/?ids=${chunk.join(',')}&fields=id,name,subtype&access_token=${accessToken}`
      try {
        const data = await fbGet(url)
        for (const id of chunk) {
          if (data[id]) map.set(id, data[id])
        }
      } catch {}
    }
  }

  return map
}

// ── Adset classification ─────────────────────────────────────────

// 3 segmenti di pubblico esatti come Marino li imposta in Meta Ads Manager:
//   - Nuovo pubblico         (Acquisition / Prospecting)
//   - Pubblico che ha interagito (Retargeting / warm)
//   - Clienti esistenti      (Retention)
const CATEGORIES = {
  acquisition_prospecting: { label: 'Nuovo pubblico',             color: '#2997ff' },
  retargeting:             { label: 'Pubblico che ha interagito', color: '#bf5af2' },
  retention:               { label: 'Clienti esistenti',          color: '#22c55e' },
  unknown:                 { label: 'Sconosciuto',                color: '#94a3b8' },
}

// Classifica per nome ADSET (regex largo: copre IT + EN + abbreviazioni).
// Match sui 3 segmenti standard di Meta Ads Manager.
function classifyByName(adsetName = '') {
  const name = String(adsetName).toLowerCase().trim()

  // Retention: customer file / clienti esistenti
  if (/clienti esistenti|cliente[- ]?esistent|existing customer|customer file|customer list|buyer[s]?|past[- ]?customer|purchaser|crm|email[- ]?upload/i.test(name)) {
    return 'retention'
  }

  // Retargeting: warm / pubblico che ha interagito / website visitors / engagement
  if (/pubblico che ha interagit|che ha interagit|interagit[ao]|engagement|engaged|retargeting|retarget|remarketing|warm|website visitor|web[- ]?visit|page view|video view|ig[- ]?engag|fb[- ]?engag|add[- ]?to[- ]?cart|atc|view[- ]?content|vc|abandoned/i.test(name)) {
    return 'retargeting'
  }

  // Prospecting: cold / nuovo pubblico / broad / interest / lookalike
  if (/nuovo pubblico|new audience|broad|prospecting|prospect|cold|interest|lookalike|\blal\b|\blla\b|acquisition|acquisizione/i.test(name)) {
    return 'acquisition_prospecting'
  }

  return null // no match → fallback su targeting analysis (audience subtype)
}

function classifyAdset(adset, audMap) {
  // Step 0 (HIGHEST PRIORITY): match ESATTO sui 4 nomi adset Meta standard.
  // Lo screenshot di Marino mostra che dentro ogni campagna gli adset si
  // chiamano letteralmente "Pubblico che ha interagito", "Clienti esistenti",
  // "Nuovo pubblico", "Sconosciuto". Questo match e' la classifica primaria.
  const exact = classifyByNameExact(adset.name)
  if (exact) return exact

  // Step 1: targeting subtype (replica logica Meta).
  const t = adset.targeting || {}
  const includedRaw = (t.custom_audiences || [])
  const excludedRaw = (t.excluded_custom_audiences || [])
  const included = includedRaw.map(x => audMap.get(x.id)).filter(Boolean)
  const excluded = excludedRaw.map(x => audMap.get(x.id)).filter(Boolean)
  const incKinds = included.map(classifyAudienceSubtype)
  const excKinds = excluded.map(classifyAudienceSubtype)

  if (incKinds.includes('crm_active') || incKinds.includes('crm_lapsed')) {
    return 'retention'
  }
  if (incKinds.some(k => ['website', 'engagement', 'app'].includes(k))) {
    return 'retargeting'
  }
  if (incKinds.includes('lookalike')) {
    return 'acquisition_prospecting'
  }
  const hasAnyTargeting =
    Array.isArray(t.flexible_spec) && t.flexible_spec.length > 0 ||
    Array.isArray(t.interests) && t.interests.length > 0 ||
    t.age_min != null || t.geo_locations != null
  if (includedRaw.length === 0 && hasAnyTargeting) {
    return 'acquisition_prospecting'
  }

  // Step 2: fallback regex larghi su name.
  const byName = classifyByName(adset.name)
  if (byName) return byName

  // Step 3: esclusione di CRM → cold prospecting.
  if (excKinds.some(k => ['crm_active', 'crm_lapsed'].includes(k))) {
    return 'acquisition_prospecting'
  }

  return 'unknown'
}

// Match esatto sulle 4 etichette standard Meta Ads Manager.
function classifyByNameExact(adsetName = '') {
  const name = String(adsetName).trim().toLowerCase()
  if (name === 'clienti esistenti' || name === 'existing customers') return 'retention'
  if (name === 'pubblico che ha interagito' || name === 'engaged audience' || name === 'engaged audiences') return 'retargeting'
  if (name === 'nuovo pubblico' || name === 'new audience' || name === 'new audiences') return 'acquisition_prospecting'
  if (name === 'sconosciuto' || name === 'unknown') return 'unknown'
  return null
}

// ── Insights extraction ──────────────────────────────────────────

function numFrom(actions, types) {
  if (!Array.isArray(actions)) return 0
  for (const t of types) {
    const v = actions.find(a => a.action_type === t)?.value
    if (v) return parseFloat(v)
  }
  return 0
}

function pickPurchases(actions) {
  return numFrom(actions, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
}

// ── Main builder ─────────────────────────────────────────────────

async function buildAudit({ accessToken, accountIds, range }) {
  const adsetsAll = []

  // 1) Per ogni account, recupera TUTTI gli adset con targeting (no filtro
  // effective_status: a volte un adset 'status=ACTIVE' ha effective_status
  // PAUSED se la campagna superiore e' pausata → veniva escluso. Filtriamo
  // client-side per status=ACTIVE dopo la fetch.
  // Per fields: 'targeting{...}' nested non sempre ritorna la sub-struttura,
  // chiediamo 'targeting' intero.
  // STEP 1: fetch TUTTE le campagne dell'account, poi filtra client-side
  // per effective_status === 'ACTIVE'. Piu' affidabile del filtro server-side
  // 'effective_status=["ACTIVE"]' (che a volte ritorna 0 risultati).
  let debugCampaignsAll = 0
  const activeCampaignIds = []
  const campaignMeta = {} // id → { name, account }
  for (const accId of accountIds) {
    const fields = encodeURIComponent('id,name,status,effective_status')
    const url = `${GRAPH}/${accId}/campaigns?fields=${fields}&limit=500&access_token=${accessToken}`
    try {
      const list = await fbGetAllPages(url, 30)
      debugCampaignsAll += list.length
      for (const c of list) {
        if (c.effective_status === 'ACTIVE') {
          activeCampaignIds.push(c.id)
          campaignMeta[c.id] = { name: c.name, account: accId }
        }
      }
    } catch (e) {
      console.log('[meta-audit] campaigns fetch failed for', accId, e?.message)
    }
  }
  const debugCampaignsFetched = activeCampaignIds.length

  // STEP 2: per ogni account, fetch tutti gli adset e tieni solo quelli
  // appartenenti a una campagna ATTIVA. Cosi' replichiamo il filtro
  // "Inserzioni attive" di Meta Ads Manager.
  // Includiamo adset anche se status=PAUSED a livello adset: Meta Ads
  // Manager li mostra comunque raggruppati sotto la campagna attiva
  // (sono sotto-segmenti di pubblico spesso paused per fine budget).
  const activeCampaignSet = new Set(activeCampaignIds)
  let debugTotalFetched = 0
  for (const accId of accountIds) {
    const fields = encodeURIComponent('id,name,status,effective_status,campaign_id,targeting')
    const url = `${GRAPH}/${accId}/adsets?fields=${fields}&limit=500&access_token=${accessToken}`
    try {
      const list = await fbGetAllPages(url, 30)
      debugTotalFetched += list.length
      const usable = list.filter(a =>
        activeCampaignSet.has(a.campaign_id) &&
        !['DELETED', 'ARCHIVED'].includes(a.effective_status)
      )
      for (const a of usable) {
        adsetsAll.push({ ...a, _account: accId, _campaignName: campaignMeta[a.campaign_id]?.name || '' })
      }
    } catch (e) {
      console.log('[meta-audit] adsets fetch failed for', accId, e?.message)
    }
  }

  if (adsetsAll.length === 0) {
    return { total: zeroBucket(), categories: emptyCategories(), adsetsClassified: [] }
  }

  // 2) Raccogli tutti gli audience ID referenziati (incluse + escluse)
  const audienceIds = new Set()
  for (const a of adsetsAll) {
    for (const x of (a.targeting?.custom_audiences || [])) audienceIds.add(x.id)
    for (const x of (a.targeting?.excluded_custom_audiences || [])) audienceIds.add(x.id)
  }

  // 3) Fetch audience subtypes (batch 50)
  const audMap = await fetchAudiencesMap(accessToken, accountIds, audienceIds)

  // 4) Classifica ogni adset
  const adsetsClassified = adsetsAll.map(a => ({
    ...a,
    category: classifyAdset(a, audMap),
  }))

  // 5) Insights aggregate per categoria (timeRange totale)
  //    + daily breakdown (time_increment=1) per chart trend
  const buckets = {}
  for (const cat of Object.keys(CATEGORIES)) buckets[cat] = zeroBucket()
  const trendByCategory = {}
  for (const cat of Object.keys(CATEGORIES)) trendByCategory[cat] = new Map() // date → metrics

  // Adset insights con filtering=adset.id IN [...] non e' scalabile. Andiamo
  // per account con time_range + filtering by adset_ids in chunks di 50.
  const adsetByAccount = {}
  for (const a of adsetsClassified) {
    if (!adsetByAccount[a._account]) adsetByAccount[a._account] = []
    adsetByAccount[a._account].push(a)
  }

  for (const [accId, list] of Object.entries(adsetByAccount)) {
    const idToCategory = {}
    for (const a of list) idToCategory[a.id] = a.category

    // Fetch insights aggregato senza time_increment (totali per adset)
    const adsetIds = list.map(a => a.id)
    for (let i = 0; i < adsetIds.length; i += 50) {
      const chunk = adsetIds.slice(i, i + 50)
      const filtering = encodeURIComponent(JSON.stringify([{ field: 'adset.id', operator: 'IN', value: chunk }]))
      const fields = encodeURIComponent('adset_id,spend,impressions,clicks,inline_link_clicks,reach,ctr,cpm,actions,action_values')
      const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))
      const url = `${GRAPH}/${accId}/insights?level=adset&time_range=${timeRange}&filtering=${filtering}&fields=${fields}&limit=500&access_token=${accessToken}`
      try {
        const rows = await fbGetAllPages(url, 10)
        for (const r of rows) {
          const cat = idToCategory[r.adset_id]
          if (!cat) continue
          accumulate(buckets[cat], r)
        }
      } catch (e) {
        console.log('[meta-audit] adset insights failed', e?.message)
      }
    }

    // Fetch insights con time_increment=1 per trend chart (con TUTTE le metriche)
    for (let i = 0; i < adsetIds.length; i += 50) {
      const chunk = adsetIds.slice(i, i + 50)
      const filtering = encodeURIComponent(JSON.stringify([{ field: 'adset.id', operator: 'IN', value: chunk }]))
      const fields = encodeURIComponent('adset_id,date_start,spend,impressions,clicks,inline_link_clicks,actions,action_values')
      const timeRange = encodeURIComponent(JSON.stringify({ since: range.since, until: range.until }))
      const url = `${GRAPH}/${accId}/insights?level=adset&time_range=${timeRange}&time_increment=1&filtering=${filtering}&fields=${fields}&limit=2000&access_token=${accessToken}`
      try {
        const rows = await fbGetAllPages(url, 30)
        for (const r of rows) {
          const cat = idToCategory[r.adset_id]
          if (!cat) continue
          const day = r.date_start
          const trendMap = trendByCategory[cat]
          if (!trendMap.has(day)) trendMap.set(day, {
            date: day, spend: 0, revenue: 0, purchases: 0,
            impressions: 0, clicks: 0, link_clicks: 0,
          })
          const t = trendMap.get(day)
          t.spend += parseFloat(r.spend || 0)
          t.revenue += numFrom(r.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
          t.purchases += pickPurchases(r.actions)
          t.impressions += parseInt(r.impressions || 0)
          t.clicks += parseInt(r.clicks || 0)
          // inline_link_clicks puo' venire dal fields diretto o da actions[action_type=link_click]
          t.link_clicks += parseInt(r.inline_link_clicks || 0) || numFrom(r.actions, ['link_click'])
        }
      } catch (e) {
        console.log('[meta-audit] adset trend failed', e?.message)
      }
    }
  }

  // Compute derived KPIs
  for (const cat of Object.keys(CATEGORIES)) {
    finalize(buckets[cat])
  }

  // Trend sort + serialize: derivati daily (ROAS, CPO, CAC, CPM, CTR link, CPC link)
  const trends = {}
  for (const cat of Object.keys(CATEGORIES)) {
    trends[cat] = Array.from(trendByCategory[cat].values())
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(t => {
        const roas = t.spend > 0 ? +(t.revenue / t.spend).toFixed(3) : 0
        const cpo  = t.purchases > 0 ? +(t.spend / t.purchases).toFixed(2) : null
        // CAC: per Prospecting assume tutti new customer → spend/purchases.
        // Per altre categorie, l'AOV non rappresenta acquisizione, quindi
        // CAC = CPO solo concettualmente per Prospecting; lo esponiamo
        // sempre per coerenza (la UI lo mostra solo dove rilevante).
        const cac  = cpo
        const cpm  = t.impressions > 0 ? +((t.spend / t.impressions) * 1000).toFixed(2) : 0
        const ctr_link = t.impressions > 0 ? +((t.link_clicks / t.impressions) * 100).toFixed(3) : 0
        const cpc_link = t.link_clicks > 0 ? +(t.spend / t.link_clicks).toFixed(2) : null
        return {
          date: t.date,
          spend: +t.spend.toFixed(2),
          revenue: +t.revenue.toFixed(2),
          purchases: Math.round(t.purchases),
          impressions: t.impressions,
          clicks: t.clicks,
          link_clicks: t.link_clicks,
          roas, cpo, cac, cpm, ctr_link, cpc_link,
        }
      })
  }

  // Totali blended
  const total = zeroBucket()
  for (const cat of Object.keys(CATEGORIES)) {
    total.spend += buckets[cat].spend
    total.revenue += buckets[cat].revenue
    total.purchases += buckets[cat].purchases
    total.impressions += buckets[cat].impressions
    total.clicks += buckets[cat].clicks
    total.link_clicks += buckets[cat].link_clicks
  }
  finalize(total)

  // Categories output enriched con label/color/adsetCount
  const categories = {}
  const adsetCountByCat = {}
  for (const a of adsetsClassified) {
    adsetCountByCat[a.category] = (adsetCountByCat[a.category] || 0) + 1
  }
  for (const [id, meta] of Object.entries(CATEGORIES)) {
    categories[id] = {
      id,
      label: meta.label,
      color: meta.color,
      metrics: buckets[id],
      trend: trends[id],
      adsetCount: adsetCountByCat[id] || 0,
    }
  }

  return {
    total,
    categories,
    adsetsClassified: adsetsClassified.map(a => ({
      id: a.id,
      name: a.name,
      campaign: a.campaign?.name || '',
      category: a.category,
      account: a._account,
    })),
    audiencesAnalyzed: audMap.size,
    adsetsAnalyzed: adsetsAll.length,
    debug: {
      campaigns_total: debugCampaignsAll,
      campaigns_active: debugCampaignsFetched,
      adsets_fetched_total: debugTotalFetched,
      adsets_kept_after_filter: adsetsAll.length,
      audiences_in_map: audMap.size,
      audience_ids_referenced: audienceIds.size,
      accounts: accountIds,
      classification_breakdown: adsetCountByCat,
      sample_adset_names: adsetsClassified.slice(0, 15).map(a => ({ n: a.name, cmp: a._campaignName, cat: a.category })),
    },
  }
}

function zeroBucket() {
  return {
    spend: 0, revenue: 0, purchases: 0,
    impressions: 0, clicks: 0, link_clicks: 0,
    roas: 0, cpp: null, cpm: 0, ctr: 0, ctr_link: 0, cpc_link: null,
  }
}

function accumulate(bucket, r) {
  bucket.spend += parseFloat(r.spend || 0)
  bucket.revenue += numFrom(r.action_values, ['omni_purchase', 'purchase', 'offsite_conversion.fb_pixel_purchase'])
  bucket.purchases += pickPurchases(r.actions)
  bucket.impressions += parseInt(r.impressions || 0)
  bucket.clicks += parseInt(r.clicks || 0)
  bucket.link_clicks += parseInt(r.inline_link_clicks || 0) || numFrom(r.actions, ['link_click'])
}

function finalize(b) {
  b.roas = b.spend > 0 ? +(b.revenue / b.spend).toFixed(2) : 0
  b.cpp = b.purchases > 0 ? +(b.spend / b.purchases).toFixed(2) : null
  b.cpm = b.impressions > 0 ? +((b.spend / b.impressions) * 1000).toFixed(2) : 0
  b.ctr = b.impressions > 0 ? +((b.clicks / b.impressions) * 100).toFixed(2) : 0
  b.ctr_link = b.impressions > 0 ? +((b.link_clicks / b.impressions) * 100).toFixed(3) : 0
  b.cpc_link = b.link_clicks > 0 ? +(b.spend / b.link_clicks).toFixed(2) : null
  b.spend = +b.spend.toFixed(2)
  b.revenue = +b.revenue.toFixed(2)
  b.purchases = Math.round(b.purchases)
}

function emptyCategories() {
  const out = {}
  for (const [id, meta] of Object.entries(CATEGORIES)) {
    out[id] = { id, label: meta.label, color: meta.color, metrics: zeroBucket(), trend: [], adsetCount: 0 }
  }
  return out
}
