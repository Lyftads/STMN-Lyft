import { chromium } from 'playwright'
import { execSync } from 'child_process'
const cookieStr = execSync('cd /private/tmp/claude-501/-Users-marino/240b3dc8-f2e8-4dac-904f-68a79300cc05/scratchpad && python3 -c "import sys;sys.path.insert(0,\'.\');import lyft_api_owner as O;print(O.cookies())"').toString().trim()
const cookies = cookieStr.split('; ').map(p => { const i = p.indexOf('='); return { name: p.slice(0,i), value: p.slice(i+1), domain: 'lyftai.io', path: '/' } })
const b = await chromium.launch()
const ctx = await b.newContext({ viewport: { width: 1500, height: 1000 } })
await ctx.addCookies(cookies)
const page = await ctx.newPage()
const calls = [], bad = []
page.on('request', r => { const u=r.url(); if (u.includes('/api/')) calls.push(u.replace('https://lyftai.io','')) })
page.on('response', r => { if (r.status() >= 400) bad.push(`${r.status()} ${r.url().replace('https://lyftai.io','')}`) })
await page.goto('https://lyftai.io/', { waitUntil: 'domcontentloaded', timeout: 90000 })
await page.waitForTimeout(14000)
const euro = t => (t.match(/€\s?[\d.,]+/g)||[]).slice(0,6).join('  ')
console.log('KPI PRIMA:', euro(await page.locator('body').innerText()))

const openCal = async () => {
  for (const btn of await page.locator('button').all()) {
    const t = ((await btn.innerText().catch(()=>''))||'')
    if (/giorni|Oggi|Ieri|settimana|mese|→/i.test(t) && t.length < 40) { await btn.click(); return true }
  }
  return false
}
await openCal(); await page.waitForTimeout(2000)
// clic su un giorno per NUMERO, rileggendo il DOM ogni volta
// prendo solo i giorni ABILITATI (quelli futuri sono disabilitati)
const enabled = []
for (const btn of await page.locator('button').all()) {
  const t = ((await btn.innerText().catch(()=>''))||'').trim()
  if (!/^\d{1,2}$/.test(t)) continue
  if (!(await btn.isVisible().catch(()=>false))) continue
  if (!(await btn.isEnabled().catch(()=>false))) continue
  enabled.push(t)
}
console.log('giorni selezionabili:', enabled.length, '→', enabled.slice(0,12).join(','), '...', enabled.slice(-6).join(','))
const pick = async (label) => { await page.locator(`button:visible:text-is("${label}")`).first().click({ timeout: 15000 }) }
await pick(enabled[3]); await page.waitForTimeout(900)
await pick(enabled[9]); await page.waitForTimeout(900)
console.log('selezionati i giorni', enabled[3], 'e', enabled[9])
await page.screenshot({ path: '/tmp/cal_sel.png' })
const panel = await page.locator('body').innerText()
const m = panel.match(/\d{1,2}\s+\w+\s+\d{4}\s*[-–—→]\s*\d{1,2}\s+\w+\s+\d{4}|\d{4}-\d{2}-\d{2}\s*→\s*\d{4}-\d{2}-\d{2}/)
console.log('range selezionato nel pannello:', m ? m[0] : '(non leggibile)')
calls.length = 0; bad.length = 0
let apply = null
for (const btn of await page.locator('button').all()) { const t=((await btn.innerText().catch(()=>''))||'').trim(); if (/^(Aggiorna|Update|Applica|Apply)$/i.test(t)) { apply = btn; break } }
if (!apply) { console.log('!! Aggiorna non trovato'); await b.close(); process.exit(0) }
await apply.click()
await page.waitForTimeout(22000)
console.log('\nCHIAMATE dopo Aggiorna:'); for (const c of [...new Set(calls)]) console.log('   ', c)
console.log('ERRORI HTTP:', bad.length ? [...new Set(bad)].join(' | ') : 'nessuno')
console.log('\nKPI DOPO:', euro(await page.locator('body').innerText()))
await page.screenshot({ path: '/tmp/cal_after.png' })
await b.close()
