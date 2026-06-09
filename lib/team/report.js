// ============================================================================
//  REPORT EMAIL DETTAGLIATO DELLA SQUADRA AI
//
//  Costruisce un'email HTML ricca, per settore, dai DATI LIVE (agent-context):
//  KPI, grafici (immagini via QuickChart), best creatives con immagine + copy +
//  CTA + descrizione + prodotti carosello, ed eventuali task creati.
//  - buildReportNarrative(liveData): 1 chiamata LLM → insight per settore (JSON).
//  - renderReportHTML({...}): HTML completo email-safe.
// ============================================================================

import { callBrain } from '../agent/gateway'

const PURPLE = '#7c5cff'

// ── format helpers ──────────────────────────────────────────────────────────
const eur = n => '€' + Math.round(Number(n) || 0).toLocaleString('it-IT')
const num = n => (Number(n) || 0).toLocaleString('it-IT')
const dec = (n, d = 1) => (Number(n) || 0).toLocaleString('it-IT', { maximumFractionDigits: d })
const pct = n => dec(n, 1) + '%'
const esc = s => String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const shortDate = s => { const m = String(s || '').match(/(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}/${m[2]}` : String(s || '').slice(0, 6) }

// ── QuickChart (grafici come immagini, renderizzabili in email) ──────────────
function qc(config, w = 600, h = 240) {
  const c = encodeURIComponent(JSON.stringify(config))
  return `https://quickchart.io/chart?bkg=%23ffffff&w=${w}&h=${h}&c=${c}`
}
function lineChart(labels, data, color = PURPLE) {
  return qc({ type: 'line', data: { labels, datasets: [{ data, borderColor: color, backgroundColor: color + '22', fill: true, tension: 0.35, pointRadius: 0, borderWidth: 2 }] },
    options: { plugins: { legend: { display: false } }, scales: { x: { ticks: { autoSkip: true, maxRotation: 0, font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } } } })
}
function barChart(labels, data, color = PURPLE, horizontal = false) {
  return qc({ type: 'bar', data: { labels, datasets: [{ data, backgroundColor: color, borderRadius: 4 }] },
    options: { indexAxis: horizontal ? 'y' : 'x', plugins: { legend: { display: false } }, scales: { x: { ticks: { font: { size: 9 } } }, y: { ticks: { font: { size: 9 } } } } } }, 600, horizontal ? 260 : 240)
}

// ── blocchi HTML ────────────────────────────────────────────────────────────
const wrap = inner => `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;max-width:680px;margin:0 auto;color:#1d1d1f;background:#f5f5f7;padding:0">${inner}</div>`
const card = inner => `<div style="background:#fff;border:1px solid #e5e5ea;border-radius:16px;padding:20px;margin:14px 16px">${inner}</div>`
const h2 = (emoji, txt) => `<h2 style="font-size:17px;margin:0 0 12px;display:flex;align-items:center;gap:8px">${emoji} ${esc(txt)}</h2>`
const note = txt => txt ? `<p style="font-size:13.5px;line-height:1.55;color:#3a3a3c;margin:10px 0 0;padding:10px 12px;background:#f5f3ff;border-left:3px solid ${PURPLE};border-radius:6px">${esc(txt)}</p>` : ''
const chartImg = (url, alt) => `<img src="${url}" alt="${esc(alt)}" width="100%" style="max-width:640px;display:block;margin:6px 0;border-radius:10px"/>`

function kpi(label, value, sub) {
  return `<td style="padding:6px"><div style="background:#faf9ff;border:1px solid #ece9ff;border-radius:12px;padding:12px 10px;text-align:center">
    <div style="font-size:11px;color:#86868b;text-transform:uppercase;letter-spacing:.04em">${esc(label)}</div>
    <div style="font-size:20px;font-weight:800;color:#1d1d1f;margin-top:3px">${value}</div>
    ${sub ? `<div style="font-size:11px;color:#86868b;margin-top:2px">${esc(sub)}</div>` : ''}</div></td>`
}
function kpiRow(items) {
  // 4 per riga
  const rows = []
  for (let i = 0; i < items.length; i += 4) rows.push(items.slice(i, i + 4).join(''))
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate">${rows.map(r => `<tr>${r}</tr>`).join('')}</table>`
}
function simpleTable(headers, rows) {
  if (!rows.length) return ''
  const th = headers.map(h => `<th style="text-align:left;padding:7px 10px;border-bottom:2px solid #1d1d1f;font-size:12px">${esc(h)}</th>`).join('')
  const tr = rows.map(r => `<tr>${r.map((c, i) => `<td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;${i > 0 ? 'text-align:right' : ''}">${c}</td>`).join('')}</tr>`).join('')
  return `<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-top:6px">${th ? `<thead><tr>${th}</tr></thead>` : ''}<tbody>${tr}</tbody></table>`
}

// ── card creative (immagine + metriche + copy + CTA + prodotti carosello) ────
function creativeCard(c) {
  const img = c.image ? `<img src="${esc(c.image)}" alt="creative" width="100%" style="display:block;border-radius:10px;max-height:300px;object-fit:cover"/>` : ''
  const metrics = `<table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0"><tr>
    ${['spend €' + num(c.spend), 'ROAS ' + (c.roas ?? '-'), 'CTR ' + (c.ctr ?? '-') + '%', 'CPC €' + dec(c.cpc, 2)].map(x => `<td style="font-size:12px;color:#3a3a3c;background:#f2f2f7;border-radius:6px;padding:5px 8px;text-align:center">${esc(x)}</td>`).join('<td style="width:6px"></td>')}
  </tr></table>`
  const copy = c.copy ? `<div style="font-size:13px;line-height:1.5;color:#1d1d1f;margin:6px 0"><b>Copy:</b> ${esc(String(c.copy).slice(0, 320))}${String(c.copy).length > 320 ? '…' : ''}</div>` : ''
  const cta = (c.cta || c.description) ? `<div style="font-size:12.5px;color:#3a3a3c;margin:4px 0">${c.cta ? `<b>CTA:</b> ${esc(c.cta)}` : ''}${c.cta && c.description ? ' · ' : ''}${c.description ? `<b>Descrizione:</b> ${esc(String(c.description).slice(0, 160))}` : ''}</div>` : ''
  let products = ''
  if (Array.isArray(c.products) && c.products.length) {
    const cells = c.products.slice(0, 5).map(p => `<td style="width:96px;vertical-align:top;text-align:center;padding:4px">
      ${p.image ? `<img src="${esc(p.image)}" width="88" height="88" style="border-radius:8px;object-fit:cover;border:1px solid #eee"/>` : ''}
      <div style="font-size:10.5px;color:#3a3a3c;margin-top:3px;line-height:1.2">${esc(String(p.name || '').slice(0, 34))}</div>
      ${p.price ? `<div style="font-size:10.5px;color:#86868b">${esc(p.price)}</div>` : ''}</td>`).join('')
    products = `<div style="font-size:11px;color:#86868b;margin-top:6px">Prodotti del carosello:</div><table cellpadding="0" cellspacing="0"><tr>${cells}</tr></table>`
  }
  return `<div style="border:1px solid #e5e5ea;border-radius:12px;padding:12px;margin-bottom:12px">
    <div style="font-weight:700;font-size:14px;margin-bottom:6px">${esc(c.name || 'Creative')}</div>
    ${img}${metrics}${copy}${cta}${products}</div>`
}

// ── narrativa per settore (LLM, una sola call, JSON, anti-invenzione) ────────
export async function buildReportNarrative(liveData) {
  try {
    const res = await callBrain({
      skill: {
        id: 'team-report',
        systemPrompt: 'Sei il team analytics di un brand e-commerce. Scrivi insight brevi, concreti e professionali per ogni settore, sempre basati sui DATI LIVE reali.',
        guard: 'Ogni numero/nome citato DEVE essere presente nei DATI LIVE. Non inventare. Italiano. ATTENZIONE: per spesa ads e ROAS usa metaDetail.summary (di periodo) e le serie weekly; NON usare metaAds.spend né klaviyo.revenue perché sono valori CUMULATIVI/lifetime e falserebbero il dato.',
      },
      query: 'Analizza i dati e dai un insight per ogni settore.',
      data: liveData,
      dataLabel: 'DATI LIVE del brand (numeri e nomi REALI):',
      dataMax: 45000,
      json: true,
      temperature: 0.35,
      guardTail: 'Restituisci SOLO JSON valido: {"executive": string, "sales": string, "ads": string, "creatives": string, "email": string, "seo": string, "cro": string}. Ogni campo 1-2 frasi con almeno un numero/nome reale dai DATI LIVE. "executive" = sintesi del momento del brand (2-3 frasi). Niente markdown, niente invenzioni.',
    })
    let p = res.content
    if (typeof p === 'string') { try { p = JSON.parse(p) } catch {} }
    return (p && typeof p === 'object') ? p : {}
  } catch { return {} }
}

// ── HTML completo ───────────────────────────────────────────────────────────
export function renderReportHTML({ liveData, narrative = {}, tasks = [], brandName = 'il tuo brand', periodLabel = 'ultimi 30 giorni', appUrl = 'https://lyftai.io' }) {
  const sh = liveData?.shopify || {}, ma = liveData?.metaAds || {}, kl = (liveData?.klaviyo || {}).kpis || {}, ga = (liveData?.ga4 || {}).summary || {}
  // IMPORTANTE: usa SOLO le serie weekly (coerenti, di periodo). NON usare
  // metaAds.spend né klaviyo.revenue: sono cumulativi/lifetime → falserebbero i KPI.
  const wk = Array.isArray(sh.weekly) ? sh.weekly : []
  const last4 = wk.slice(-4)
  const revenue = last4.reduce((s, w) => s + (Number(w.fatturato) || 0), 0) || Number(ga.totalRevenue) || 0
  const orders = last4.reduce((s, w) => s + (Number(w.ordini) || 0), 0)
  const maWk = Array.isArray(ma.weekly) ? ma.weekly : []
  const adSpend = maWk.slice(-4).reduce((s, w) => s + (Number(w.spend) || 0), 0)
  const aov = orders ? revenue / orders : 0
  const mer = adSpend ? revenue / adSpend : 0
  const roasMeta = Number(liveData?.metaDetail?.summary?.roas) || 0
  const sessions = Number(ga.sessions) || last4.reduce((s, w) => s + (Number(w.uniqueSessions) || 0), 0)
  const cr = sessions ? (orders / sessions * 100) : 0
  const lastMa = maWk[maWk.length - 1] || {}

  // Header + KPI ────────────────────────────────────────────────────────────
  let html = `<div style="background:linear-gradient(135deg,#7c5cff,#2a1746);padding:26px 20px;color:#fff;text-align:center">
    <div style="font-size:13px;opacity:.85;letter-spacing:.08em;text-transform:uppercase">Report Squadra AI · ${esc(periodLabel)}</div>
    <div style="font-size:24px;font-weight:800;margin-top:4px">${esc(brandName)}</div>
  </div>`
  html += card(`${narrative.executive ? `<p style="font-size:15px;line-height:1.6;margin:0 0 14px;color:#1d1d1f">${esc(narrative.executive)}</p>` : ''}
    ${kpiRow([
      kpi('Fatturato', eur(revenue), periodLabel),
      kpi('Ordini', num(orders)),
      kpi('AOV', eur(aov)),
      kpi('Spesa Ads', eur(adSpend)),
      kpi('MER', dec(mer, 2) + 'x', 'revenue/spend'),
      kpi('ROAS Meta', roasMeta ? dec(roasMeta, 2) + 'x' : 'n/d'),
      kpi('Sessioni', num(sessions)),
      kpi('Conv. Rate', pct(cr)),
    ])}`)

  // 🛒 Vendite ───────────────────────────────────────────────────────────────
  const topProd = Array.isArray(sh.topProducts) ? sh.topProducts.slice(0, 7) : []
  let salesInner = h2('🛒', 'Vendite & E-commerce')
  if (wk.length) salesInner += chartImg(lineChart(wk.slice(-12).map(w => shortDate(w.date)), wk.slice(-12).map(w => Math.round(Number(w.fatturato) || 0))), 'Trend fatturato')
  if (topProd.length) {
    salesInner += chartImg(barChart(topProd.map(p => String(p.label || p.product || '').slice(0, 20)), topProd.map(p => Math.round(Number(p.revenue) || 0)), '#30d158', true), 'Top prodotti')
    salesInner += simpleTable(['Prodotto', 'Revenue', 'Ordini'], topProd.map(p => [esc(String(p.label || p.product || '').slice(0, 40)), eur(p.revenue), num(p.orders)]))
  }
  salesInner += note(narrative.sales)
  html += card(salesInner)

  // 🚀 Advertising ────────────────────────────────────────────────────────────
  let adsInner = h2('🚀', 'Advertising (Meta)')
  adsInner += kpiRow([
    kpi('Spesa', eur(adSpend)),
    kpi('CTR', pct(lastMa.ctr)),
    kpi('CPM', eur(lastMa.cpm)),
    kpi('Frequency', dec(lastMa.frequency, 2)),
  ])
  if (maWk.length) adsInner += chartImg(barChart(maWk.slice(-12).map(w => shortDate(w.date)), maWk.slice(-12).map(w => Math.round(Number(w.spend) || 0)), '#ff453a'), 'Trend spesa ads')
  // top campagne
  const md = liveData?.metaDetail
  const campaigns = Array.isArray(md) ? md : Array.isArray(md?.campaigns) ? md.campaigns : Array.isArray(md?.rows) ? md.rows : []
  const topCamp = [...campaigns].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0)).slice(0, 6)
  if (topCamp.length) adsInner += simpleTable(['Campagna', 'Spend', 'ROAS'], topCamp.map(c => [esc(String(c.name || c.campaign_name || '-').slice(0, 38)), eur(c.spend), dec(c.roas ?? c.roas_link, 2) + 'x']))
  adsInner += note(narrative.ads)
  html += card(adsInner)

  // 🎨 Best Creatives ─────────────────────────────────────────────────────────
  const creatives = Array.isArray(liveData?.creatives) ? liveData.creatives : []
  const bestCre = [...creatives].filter(c => c.image || (Array.isArray(c.products) && c.products.length)).sort((a, b) => (Number(b.roas) || 0) - (Number(a.roas) || 0)).slice(0, 6)
  if (bestCre.length) {
    html += card(h2('🎨', 'Best Creatives') + note(narrative.creatives) + bestCre.map(creativeCard).join(''))
  }

  // 📧 Email ───────────────────────────────────────────────────────────────────
  let emInner = h2('📧', 'Email Marketing (Klaviyo)')
  emInner += kpiRow([
    kpi('Inviate', num(kl.received)),
    kpi('Open Rate', pct(kl.openRate)),
    kpi('Click Rate', pct(kl.clickRate)),
    kpi('CTOR', pct(kl.ctor)),
  ])
  const flows = Array.isArray(liveData?.klaviyo?.flows) ? liveData.klaviyo.flows.filter(f => (f.status || '').toLowerCase() === 'live' || f.status === 'active').slice(0, 6) : []
  if (flows.length) emInner += `<div style="font-size:12.5px;color:#3a3a3c;margin-top:8px"><b>Flow attivi:</b> ${flows.map(f => esc(f.name)).join(', ')}</div>`
  emInner += note(narrative.email)
  html += card(emInner)

  // 🔎 Traffico & SEO ──────────────────────────────────────────────────────────
  const channels = Array.isArray(liveData?.ga4?.channels) ? liveData.ga4.channels.slice(0, 6) : []
  let seoInner = h2('🔎', 'Traffico & SEO')
  if (channels.length) {
    seoInner += chartImg(barChart(channels.map(c => String(c.sessionDefaultChannelGroup || '').slice(0, 16)), channels.map(c => Number(c.sessions) || 0), '#2997ff'), 'Sessioni per canale')
    seoInner += simpleTable(['Canale', 'Sessioni', 'Conversioni'], channels.map(c => [esc(c.sessionDefaultChannelGroup || '-'), num(c.sessions), num(c.conversions)]))
  }
  seoInner += note(narrative.seo)
  html += card(seoInner)

  // 🧪 CRO ──────────────────────────────────────────────────────────────────────
  html += card(h2('🧪', 'CRO & Conversione') + kpiRow([
    kpi('Conv. Rate', pct(cr)),
    kpi('Bounce', pct(ga.bounceRate * (ga.bounceRate <= 1 ? 100 : 1))),
    kpi('Sessioni', num(sessions)),
    kpi('Durata media', dec(ga.averageSessionDuration, 0) + 's'),
  ]) + note(narrative.cro))

  // ✅ Task della settimana ─────────────────────────────────────────────────────
  if (tasks && tasks.length) {
    const rows = tasks.map(t => `<tr>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px">${esc(t.title)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px">${esc(t.assignee || '—')}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px"><span style="background:#f2f2f7;border-radius:5px;padding:2px 7px">${esc(t.priority)}</span></td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right">${esc(t.due_date)}</td>
      <td style="padding:7px 10px;border-bottom:1px solid #eee;font-size:12px;color:#86868b">${esc(t.proposer || '')}</td>
    </tr>`).join('')
    html += card(`${h2('✅', 'Task della settimana assegnati')}
      <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">
        <thead><tr>${['Task', 'Assegnato a', 'Priorità', 'Scadenza', 'Proposto da'].map(h => `<th style="text-align:left;padding:7px 10px;border-bottom:2px solid #1d1d1f;font-size:12px">${h}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody></table>`)
  }

  html += `<div style="text-align:center;padding:8px 16px 30px"><a href="${esc(appUrl)}" style="display:inline-block;background:${PURPLE};color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none;font-weight:700;font-size:14px">Apri LyftAI →</a>
    <div style="font-size:11px;color:#aeaeb2;margin-top:14px">Report generato dalla Squadra AI di LyftAI · dati reali, zero invenzioni</div></div>`

  return wrap(html)
}
