// ============================================================================
//  Lyft — il cuore dell'estensione.
//
//  Fa per conto di Lyft cio' che un sito non puo' fare da solo: aprire una
//  scheda, leggerla, cliccare un link, scrivere in un campo di ricerca. La
//  persona vede ogni passo, perche' succede nel suo browser, in schede vere.
//
//  Cio' che questa estensione NON fa, per costruzione:
//   · non tocca le schede che non ha aperto lei: lavora solo sulle sue, e le
//     tiene in un gruppo riconoscibile;
//   · non scrive mai in un campo password, ne' in campi di pagamento;
//   · non accetta comandi da siti diversi dal prodotto (lo garantisce il ponte);
//   · non apre indirizzi che non siano pagine web (niente file, niente pagine
//     interne del browser).
//  Che cosa fare lo decide il cervello sul server; qui si esegue un passo alla
//  volta e si restituisce cio' che si vede.
// ============================================================================
const api = typeof browser !== 'undefined' ? browser : chrome
const MIE = new Set()                       // schede aperte da Lyft in questa sessione
const ATTESA_CARICO = 15000

async function ricordaMie() { try { await api.storage.session.set({ mie: [...MIE] }) } catch {} }
async function rileggiMie() { try { const s = await api.storage.session.get('mie'); for (const t of s.mie || []) MIE.add(t) } catch {} }
api.tabs.onRemoved.addListener(id => { if (MIE.delete(id)) ricordaMie() })

const urlLecito = (u) => { try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' } catch { return false } }

function attendiCarico(tabId) {
  return new Promise(ok => {
    let fatto = false
    const fine = () => { if (fatto) return; fatto = true; api.tabs.onUpdated.removeListener(senti); ok() }
    const senti = (id, info) => { if (id === tabId && info.status === 'complete') setTimeout(fine, 400) }
    api.tabs.onUpdated.addListener(senti)
    api.tabs.get(tabId).then(t => { if (t.status === 'complete') setTimeout(fine, 400) }).catch(fine)
    setTimeout(fine, ATTESA_CARICO)
  })
}

async function esegui(tabId, func, args = []) {
  const r = await api.scripting.executeScript({ target: { tabId }, func, args })
  return r && r[0] ? r[0].result : null
}

// ---- cio' che gira DENTRO la pagina guidata (funzioni autosufficienti: vengono serializzate)
function inPagina_cartello(testo) {
  let c = document.getElementById('__lyft_cartello')
  if (!c) {
    c = document.createElement('div'); c.id = '__lyft_cartello'
    c.style.cssText = 'position:fixed;z-index:2147483647;left:50%;top:10px;transform:translateX(-50%);background:#02060b;color:#e6fbff;border:1px solid #38e8ff;border-radius:999px;padding:7px 16px;font:600 13px -apple-system,BlinkMacSystemFont,sans-serif;box-shadow:0 0 18px rgba(56,232,255,.45);pointer-events:none'
    document.documentElement.appendChild(c)
  }
  c.textContent = testo
}
function inPagina_leggi(max) {
  const visibile = (el) => { const r = el.getBoundingClientRect(); const s = getComputedStyle(el); return r.width > 4 && r.height > 4 && s.visibility !== 'hidden' && s.display !== 'none' }
  document.querySelectorAll('[data-lyft-n]').forEach(e => e.removeAttribute('data-lyft-n'))
  let n = 0
  const link = [], campi = []
  for (const a of document.querySelectorAll('a[href], button, [role="button"]')) {
    if (link.length >= 70) break
    const t = (a.innerText || a.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim()
    if (!t || t.length > 140 || !visibile(a)) continue
    a.setAttribute('data-lyft-n', String(++n))
    link.push({ n, testo: t.slice(0, 100), ...(a.href ? { va_a: String(a.href).slice(0, 160) } : {}) })
  }
  // Solo campi di RICERCA e di testo libero: mai password, email, carte, telefoni.
  for (const i of document.querySelectorAll('input[type="search"], input[type="text"], input:not([type]), textarea')) {
    if (campi.length >= 12) break
    const nome = `${i.name || ''} ${i.id || ''} ${i.autocomplete || ''} ${i.placeholder || ''}`.toLowerCase()
    if (/pass|card|carta|cvv|cvc|iban|email|mail|tel|phone|otp|codice|code|user|login/.test(nome) || !visibile(i)) continue
    i.setAttribute('data-lyft-n', String(++n))
    campi.push({ n, etichetta: (i.placeholder || i.getAttribute('aria-label') || i.name || 'campo').slice(0, 80) })
  }
  const testo = (document.body ? document.body.innerText : '').replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
  return { titolo: document.title.slice(0, 160), url: location.href.slice(0, 300), testo: testo.slice(0, max), testo_tagliato: testo.length > max, link, campi }
}
function inPagina_clicca(n) {
  const el = document.querySelector(`[data-lyft-n="${n}"]`)
  if (!el) return { errore: 'elemento non trovato: rileggi la pagina' }
  el.scrollIntoView({ block: 'center' })
  const prima = el.style.outline; el.style.outline = '3px solid #38e8ff'
  setTimeout(() => { el.style.outline = prima; el.click() }, 450)
  return { cliccato: (el.innerText || el.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().slice(0, 100) }
}
function inPagina_scrivi(n, testo, invio) {
  const el = document.querySelector(`[data-lyft-n="${n}"]`)
  if (!el || !/^(INPUT|TEXTAREA)$/.test(el.tagName)) return { errore: 'campo non trovato: rileggi la pagina' }
  if (el.type === 'password') return { errore: 'in un campo password non si scrive' }
  el.scrollIntoView({ block: 'center' }); el.focus()
  const imposta = Object.getOwnPropertyDescriptor(el.tagName === 'INPUT' ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype, 'value').set
  imposta.call(el, testo)
  el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true }))
  if (invio) setTimeout(() => {
    for (const tipo of ['keydown', 'keypress', 'keyup']) el.dispatchEvent(new KeyboardEvent(tipo, { key: 'Enter', code: 'Enter', keyCode: 13, which: 13, bubbles: true }))
    if (el.form) { try { el.form.requestSubmit() } catch { try { el.form.submit() } catch {} } }
  }, 350)
  return { scritto: testo.slice(0, 80), invio: !!invio }
}
function inPagina_scorri() { window.scrollBy({ top: Math.round(window.innerHeight * 0.85), behavior: 'smooth' }); return { scorso: true, in_fondo: window.innerHeight + window.scrollY >= document.body.scrollHeight - 40 } }

// ---- i comandi
async function miaScheda(tab) { await rileggiMie(); if (!MIE.has(tab)) throw new Error('Lyft lavora solo sulle schede che ha aperto lui') }
const COMANDI = {
  async stato() { await rileggiMie(); return { versione: api.runtime.getManifest().version, schede: [...MIE] } },
  async apri({ url }) {
    if (!urlLecito(url)) throw new Error('indirizzo non valido: solo pagine web')
    const t = await api.tabs.create({ url, active: true })
    MIE.add(t.id); await ricordaMie()
    // Le schede di Lyft stanno in un gruppo col suo nome (dove il browser ha i gruppi): si riconoscono a colpo d'occhio.
    try { if (api.tabs.group) { const g = await api.tabs.group({ tabIds: [...MIE].filter(Boolean) }); if (api.tabGroups) await api.tabGroups.update(g, { title: 'Lyft', color: 'cyan' }) } } catch {}
    await attendiCarico(t.id)
    try { await esegui(t.id, inPagina_cartello, ['Lyft sta guidando questa scheda']) } catch {}
    const ora = await api.tabs.get(t.id)
    return { tab: t.id, titolo: ora.title, url: ora.url }
  },
  async vai({ tab, url }) {
    await miaScheda(tab); if (!urlLecito(url)) throw new Error('indirizzo non valido: solo pagine web')
    await api.tabs.update(tab, { url, active: true }); await attendiCarico(tab)
    try { await esegui(tab, inPagina_cartello, ['Lyft sta guidando questa scheda']) } catch {}
    const ora = await api.tabs.get(tab); return { tab, titolo: ora.title, url: ora.url }
  },
  async leggi({ tab }) { await miaScheda(tab); await api.tabs.update(tab, { active: true }); try { await esegui(tab, inPagina_cartello, ['Lyft sta leggendo…']) } catch {} ; return esegui(tab, inPagina_leggi, [5000]) },
  async clicca({ tab, n }) { await miaScheda(tab); await api.tabs.update(tab, { active: true }); const r = await esegui(tab, inPagina_clicca, [Number(n)]); if (r && !r.errore) { await new Promise(ok => setTimeout(ok, 900)); await attendiCarico(tab); try { await esegui(tab, inPagina_cartello, ['Lyft sta guidando questa scheda']) } catch {} } return r },
  async scrivi({ tab, n, testo, invio }) { await miaScheda(tab); await api.tabs.update(tab, { active: true }); const r = await esegui(tab, inPagina_scrivi, [Number(n), String(testo || '').slice(0, 300), !!invio]); if (r && !r.errore && invio) { await new Promise(ok => setTimeout(ok, 900)); await attendiCarico(tab) } return r },
  async scorri({ tab }) { await miaScheda(tab); return esegui(tab, inPagina_scorri) },
  async chiudi({ tab }) { await miaScheda(tab); await api.tabs.remove(tab); return { chiusa: true } },
}

api.runtime.onMessage.addListener((m, mittente, rispondi) => {
  // Solo il ponte (uno script di questa estensione, dentro una pagina del prodotto) puo' dare comandi.
  if (!mittente || mittente.id !== api.runtime.id || !mittente.tab) { rispondi({ errore: 'mittente non ammesso' }); return false }
  const f = COMANDI[m && m.comando]
  if (!f) { rispondi({ errore: 'comando sconosciuto' }); return false }
  f(m.dati || {}).then(r => rispondi(r || {})).catch(e => rispondi({ errore: String(e && e.message || e) }))
  return true
})
