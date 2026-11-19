// L'ufficio della squadra in 3D. Due modi: Panoramica (dall'alto, senza tetto, si gira col mouse e si
// salta da una stanza all'altra) ed Entra (si cammina dentro in prima o terza persona e si parla con gli
// agenti). Gli agenti seguono lo stato vero: chi ha un lavoro in corso è alla scrivania col monitor acceso,
// chi è libero gira fra caffè, biliardo, divano. I dati arrivano da /api/squadra/stato.
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js'
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js'
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js'
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js'
import { costruisciEdificio, VISTE, H } from './edificio.js'
import { creaPersona, anima, aspettoPer, etichette, scriviTarga, scriviFumetto } from './persone.js'

const $ = s => document.querySelector(s)
const Q = new URLSearchParams(location.search), SEMPLICE = Q.has('semplice'), TOCCO = matchMedia('(pointer: coarse)').matches
const pulito = t => String(t ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const primo = n => String(n || '').trim().split(/\s+/)[0]
const ora = q => { const d = new Date(q); return isNaN(d) ? '' : d.toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' }) }
const COLORI = ['#b79cff', '#ff9f6b', '#5fd0a8', '#ff6b8b', '#f5c04a', '#6cb8ff', '#8fe36b', '#5fd8e8', '#e88be0', '#c9c4bc', '#a0a8ff']

// ——— Dati: quelli veri, o una squadra di prova se la pagina è aperta fuori dal servizio ———
let S = null, prova = false
const PROVA = [['direttore', 'Lorenzo Ferri', 'Direttore'], ['campagne', 'Giulia Marchetti', 'Analista campagne'], ['kpi', 'Davide Conti', 'Analista KPI'], ['stratega', 'Sara Bellini', 'Stratega angle'], ['copy', 'Matteo Ricci', 'Copywriter'], ['art', 'Chiara Lombardi', 'Art director'], ['newsletter', 'Francesca Greco', 'Newsletter'], ['sito', 'Andrea Moretti', 'Sito Shopify'], ['competitor', 'Elena Russo', 'Competitor'], ['archivista', 'Luca Ferraro', 'Archivista'], ['qualita', 'Paolo Santoro', 'Controllo qualità']]
const LAVORI_PROVA = ['Controllo quotidiano Meta: ultimi 7 giorni contro i 7 precedenti', 'KPI del giorno: MER, CPO e CAC', 'Angle della settimana con brief completo', 'Copy della settimana: 5 headline per angle', 'Newsletter del giovedì in bozza']
function statoDiProva() {
  const giro = Math.floor(Date.now() / 30000), adesso = new Date().toISOString()
  return {
    cliente: 'Saracino', adesso, giri_oggi: 7,
    agenti: PROVA.map(([id, nome, ruolo], i) => ({ id, nome, ruolo, volto: false, in_coda: i % 4 === 1 ? 1 : 0, prossimo: { giorno: 'domani', ora: `0${6 + i % 4}:30`, compito: LAVORI_PROVA[i % 5] }, stato: (giro + i * 3) % 7 < 2 ? { inCorso: LAVORI_PROVA[i % 5], da: adesso } : { inCorso: null, ultimo: LAVORI_PROVA[(i + 2) % 5], ultimoQuando: adesso } })),
    lavori: [{ id: 'l1', titolo: 'Copy della settimana', agente: 'copy', stato: 'in_revisione' }, { id: 'l2', titolo: 'KPI del giorno', agente: 'kpi', stato: 'informativo' }],
    bacheca: [['campagne', 'Sara, il CPA dell\'angolo regalo è sceso del 12% sui 7 giorni: tienilo.'], ['stratega', 'Ricevuto. Passo il brief a Matteo e Chiara entro le 11.'], ['kpi', 'MER a 4,3 sugli ultimi 7 giorni, sopra l\'obiettivo.'], ['direttore', 'Piano del giorno in bacheca: priorità alle creatività nuove.'], ['copy', 'Prendo un caffè e parto con le headline.']].map(([da, testo], i) => ({ id: 'b' + i, da, testo, quando: new Date(Date.now() - i * 420000).toISOString() })),
    incarichi: PROVA.slice(0, 5).map(([id], i) => ({ id: 'i' + i, agente: id, compito: LAVORI_PROVA[i], stato: ['in_corso', 'fatto', 'in_coda', 'fatto', 'fatto'][i], creato: new Date(Date.now() - i * 900000).toISOString() })),
  }
}
async function caricaStato() {
  try { const r = await fetch('/api/squadra/stato', { cache: 'no-store', credentials: 'same-origin' }); if (r.ok) { const j = await r.json(); if (j && j.agenti) { S = j; prova = false; return } } } catch {}
  prova = true; S = statoDiProva()
}

// ——— Scena ———
const tela = $('#scena')
const renderer = new THREE.WebGLRenderer({ canvas: tela, antialias: true, powerPreference: 'high-performance' })
renderer.setPixelRatio(Math.min(devicePixelRatio || 1, SEMPLICE ? 1 : 1.75))
renderer.shadowMap.enabled = !SEMPLICE; renderer.shadowMap.type = THREE.PCFSoftShadowMap
renderer.toneMapping = THREE.ACESFilmicToneMapping; renderer.toneMappingExposure = 1.0
const scena = new THREE.Scene(); scena.background = new THREE.Color('#080c16'); scena.fog = new THREE.FogExp2('#080c16', .0052)
const camera = new THREE.PerspectiveCamera(46, 1, .08, 400)
const controlli = new OrbitControls(camera, tela)
Object.assign(controlli, { enableDamping: true, dampingFactor: .08, maxPolarAngle: 1.3, minDistance: 6, maxDistance: 120, autoRotate: true, autoRotateSpeed: .55, zoomSpeed: .8 })
let composer = null, bloom = null
function misura() {
  const w = innerWidth, h = innerHeight
  renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix()
  if (composer) composer.setSize(w, h)
}
addEventListener('resize', misura)

// ——— Griglia di cammino e percorso (A*) per gli agenti ———
const CEL = .4, OX = -3, OZ = -3, NX = Math.ceil(52 / CEL), NZ = Math.ceil(40 / CEL)
const chiuso = new Uint8Array(NX * NZ), costo = new Float32Array(NX * NZ), viene = new Int32Array(NX * NZ), segnoG = new Uint32Array(NX * NZ), segnoC = new Uint32Array(NX * NZ)
let giroRicerca = 0, URTI = []
const lim = (v, a, b) => Math.max(a, Math.min(b, v))
const cella = (x, z) => [lim(Math.floor((x - OX) / CEL), 0, NX - 1), lim(Math.floor((z - OZ) / CEL), 0, NZ - 1)]
const centro = (i, j) => new THREE.Vector3(OX + (i + .5) * CEL, 0, OZ + (j + .5) * CEL)
function preparaGriglia() {
  const m = .3
  for (const u of URTI) {
    const [i1, j1] = cella(u.x1 - m, u.z1 - m), [i2, j2] = cella(u.x2 + m, u.z2 + m)
    if (u.x2 + m < OX || u.z2 + m < OZ || u.x1 - m > OX + NX * CEL || u.z1 - m > OZ + NZ * CEL) continue
    for (let j = j1; j <= j2; j++) for (let i = i1; i <= i2; i++) { const cx = OX + (i + .5) * CEL, cz = OZ + (j + .5) * CEL; if (cx > u.x1 - m && cx < u.x2 + m && cz > u.z1 - m && cz < u.z2 + m) chiuso[j * NX + i] = 1 }
  }
}
function vicinaLibera(i, j) {
  if (!chiuso[j * NX + i]) return [i, j]
  for (let r = 1; r < 12; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
    if (Math.max(Math.abs(di), Math.abs(dj)) !== r) continue
    const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < NX && b < NZ && !chiuso[b * NX + a]) return [a, b]
  }
  return [i, j]
}
function siVede(a, b) { const d = a.distanceTo(b), n = Math.ceil(d / (CEL * .5)); for (let k = 1; k < n; k++) { const t = k / n, [i, j] = cella(a.x + (b.x - a.x) * t, a.z + (b.z - a.z) * t); if (chiuso[j * NX + i]) return false } return true }
function percorso(da, a) {
  const [si, sj] = vicinaLibera(...cella(da.x, da.z)), [ti, tj] = vicinaLibera(...cella(a.x, a.z)), parte = sj * NX + si, meta = tj * NX + ti
  giroRicerca++
  const mucchio = [[0, parte]]; costo[parte] = 0; segnoG[parte] = giroRicerca; viene[parte] = -1
  const su = () => { let i = mucchio.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (mucchio[p][0] <= mucchio[i][0]) break;[mucchio[p], mucchio[i]] = [mucchio[i], mucchio[p]]; i = p } }
  const giu = () => { let i = 0; for (;;) { const l = i * 2 + 1, r = l + 1; let m = i; if (l < mucchio.length && mucchio[l][0] < mucchio[m][0]) m = l; if (r < mucchio.length && mucchio[r][0] < mucchio[m][0]) m = r; if (m === i) break;[mucchio[m], mucchio[i]] = [mucchio[i], mucchio[m]]; i = m } }
  let trovato = false
  while (mucchio.length) {
    const cima = mucchio[0], ultimo = mucchio.pop(); if (mucchio.length) { mucchio[0] = ultimo; giu() }
    const c = cima[1]; if (c === meta) { trovato = true; break }
    if (segnoC[c] === giroRicerca) continue; segnoC[c] = giroRicerca
    const ci = c % NX, cj = (c / NX) | 0
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if (!di && !dj) continue
      const ni = ci + di, nj = cj + dj; if (ni < 0 || nj < 0 || ni >= NX || nj >= NZ) continue
      const n = nj * NX + ni; if (chiuso[n] || segnoC[n] === giroRicerca) continue
      if (di && dj && (chiuso[cj * NX + ni] || chiuso[nj * NX + ci])) continue
      const g = costo[c] + (di && dj ? 1.414 : 1)
      if (segnoG[n] !== giroRicerca || g < costo[n]) { costo[n] = g; segnoG[n] = giroRicerca; viene[n] = c; const dx = Math.abs(ni - ti), dz = Math.abs(nj - tj); mucchio.push([g + Math.max(dx, dz) + .414 * Math.min(dx, dz), n]); su() }
    }
  }
  if (!trovato) return [a.clone()]
  const punti = []; for (let c = meta; c !== -1; c = viene[c]) punti.push(centro(c % NX, (c / NX) | 0)); punti.reverse()
  const liscio = [punti[0]]; let i = 0
  while (i < punti.length - 1) { let j = punti.length - 1; while (j > i + 1 && !siVede(punti[i], punti[j])) j--; liscio.push(punti[j]); i = j }
  liscio.shift(); liscio.push(new THREE.Vector3(a.x, 0, a.z))
  return liscio
}

// ——— Persone: agenti, reception, guardia, e chi visita (tu) ———
const agenti = [], comparse = []
let E = null, giocatore = null
const tramaCodice = (() => { const c = document.createElement('canvas'); c.width = 256; c.height = 144; const g = c.getContext('2d'); g.fillStyle = '#0d1420'; g.fillRect(0, 0, 256, 144); for (let i = 0; i < 12; i++) { g.fillStyle = ['#5fd0ff', '#7ef0a0', '#f5c04a', '#b79cff'][i % 4]; g.fillRect(12 + (i % 3) * 10, 10 + i * 11, 40 + (i * 53) % 150, 5) } const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t })()
const matAcceso = new THREE.MeshBasicMaterial({ map: tramaCodice, toneMapped: false }), matSpento = new THREE.MeshBasicMaterial({ color: '#07090c' })
function creaAgente(dati, i) {
  const p = creaPersona(aspettoPer(dati.nome, i)); etichette(p); scena.add(p.o)
  const posto = dati.id === 'direttore' ? E.posti.direttore : E.posti.scrivanie[agenti.filter(a => a.posto !== E.posti.direttore).length % E.posti.scrivanie.length]
  const schermo = new THREE.Mesh(new THREE.PlaneGeometry(.56, .32), matSpento); schermo.position.copy(posto.schermo.pos); schermo.rotation.y = posto.schermo.giro; scena.add(schermo)
  const ag = { id: dati.id, dati, p, posto: { ...posto, anim: 'seduto', mio: true }, schermo, colore: COLORI[i % COLORI.length], meta: null, cammino: null, finoA: 0, vel: 1.15 + (i % 4) * .08, fumettoFino: 0, scivola: null }
  p.o.position.copy(ag.posto.pos); p.o.rotation.y = ag.posto.giro; p.anim = 'seduto'; ag.meta = ag.posto; ag.animMeta = 'seduto'; ag.finoA = 2 + Math.random() * 18
  p.agente = ag; agenti.push(ag); return ag
}
const ATTIVITA = [['caffe', 3, 'Prendo un caffè.'], ['biliardo', 2, 'Partita a biliardo.'], ['calcetto', 1, 'Calcetto, chi viene?'], ['divano', 2, 'Due minuti di pausa.'], ['chiacchiera', 2, 'Due chiacchiere.'], ['acqua', 1, 'Un bicchiere d\'acqua.'], ['pingpong', 1, 'Ping pong!'], ['cabinato', 1, 'Una partita veloce.'], ['posto', 3, null]]
function vai(ag, meta, animazione, adesso) {
  if (ag.meta && ag.meta !== meta) ag.meta.occupato = null
  meta.occupato = ag.id; ag.meta = meta; ag.animMeta = animazione; ag.scivola = null
  ag.cammino = percorso(ag.p.o.position, meta.arrivo || meta.pos); ag.finoA = adesso + 28 + Math.random() * 50
}
function fumetto(ag, testo, adesso, durata = 5) { scriviFumetto(ag.p.fumetto, testo); ag.fumettoFino = adesso + durata }
function decidi(ag, adesso) {
  const lavora = !!(ag.dati.stato && ag.dati.stato.inCorso)
  if (lavora !== ag.lavora) { ag.lavora = lavora; scriviTarga(ag.p.targa, primo(ag.dati.nome), lavora ? 'Al lavoro' : 'Libero', lavora ? '#4ade80' : '#8b93b8'); if (lavora) fumetto(ag, 'Mi metto al lavoro.', adesso, 4) }
  ag.schermo.material = lavora && !ag.cammino && ag.meta === ag.posto ? matAcceso : matSpento
  if (lavora) { if (ag.meta !== ag.posto) vai(ag, ag.posto, 'scrive', adesso); else { ag.animMeta = 'scrive'; if (!ag.cammino && !ag.scivola) ag.p.anim = 'scrive' } return }
  if (ag.animMeta === 'scrive') { ag.animMeta = 'seduto'; if (!ag.cammino) ag.p.anim = 'seduto'; ag.finoA = adesso + 3 + Math.random() * 8 }
  if (adesso < ag.finoA || ag.cammino) return
  let tot = 0; for (const a of ATTIVITA) tot += a[1]
  let x = Math.random() * tot, scelta = ATTIVITA[0]; for (const a of ATTIVITA) { x -= a[1]; if (x <= 0) { scelta = a; break } }
  if (scelta[0] === 'posto') { if (ag.meta !== ag.posto) vai(ag, ag.posto, 'seduto', adesso); else ag.finoA = adesso + 10 + Math.random() * 20; return }
  const liberi = E.poi[scelta[0]].filter(q => !q.occupato); if (!liberi.length) { ag.finoA = adesso + 2; return }
  const q = liberi[Math.random() * liberi.length | 0]; vai(ag, q, q.anim || 'fermo', adesso); if (scelta[2]) fumetto(ag, scelta[2], adesso)
}
const giraVerso = (o, bersaglio, k) => { let d = bersaglio - o.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d)); o.rotation.y += d * k }
function muoviAgente(ag, dt, adesso) {
  const p = ag.p, o = p.o
  if (ag.cammino) {
    const m = ag.cammino[0], dx = m.x - o.position.x, dz = m.z - o.position.z, d = Math.hypot(dx, dz), passo = ag.vel * dt
    if (d <= passo) { o.position.x = m.x; o.position.z = m.z; ag.cammino.shift(); if (!ag.cammino.length) { ag.cammino = null; ag.scivola = { da: o.position.clone(), giro: o.rotation.y, t: 0 } } }
    else { o.position.x += dx / d * passo; o.position.z += dz / d * passo; giraVerso(o, Math.atan2(dx, dz), 1 - Math.exp(-dt * 9)) }
    p.anim = 'cammina'
  } else if (ag.scivola) {
    const s = ag.scivola; s.t = Math.min(1, s.t + dt * 3.2); const e = s.t * s.t * (3 - 2 * s.t)
    o.position.lerpVectors(s.da, ag.meta.pos, e); giraVerso(o, ag.meta.giro, e)
    p.altoSeduta = ag.meta.alto || .5; if (s.t > .35) p.anim = ag.animMeta
    if (s.t >= 1) { o.rotation.y = ag.meta.giro; ag.scivola = null }
  }
  if (ag.fumettoFino && adesso > ag.fumettoFino) { scriviFumetto(p.fumetto, ''); ag.fumettoFino = 0 }
  anima(p, dt, ag.vel - 1.15)
}

// ——— Porte scorrevoli: si aprono quando qualcuno si avvicina ———
const porte = []
function creaPorte() {
  const matVetro = new THREE.MeshStandardMaterial({ color: '#56706f', transparent: true, opacity: .3, roughness: .35, depthWrite: false })
  const matLegno = new THREE.MeshStandardMaterial({ color: '#6b4428', flatShading: true, roughness: .8 }), matBordo = new THREE.LineBasicMaterial({ color: '#1e1713' })
  for (const d of E.porte) {
    const largo = d.a - d.da, vetro = largo >= 1.9, mezzo = (d.da + d.a) / 2, ante = []
    for (const lato of [-1, 1]) {
      const g = d.asse === 'x' ? new THREE.BoxGeometry(largo / 2, 2.24, .05) : new THREE.BoxGeometry(.05, 2.24, largo / 2)
      const m = new THREE.Mesh(g, vetro ? matVetro : matLegno); m.add(new THREE.LineSegments(new THREE.EdgesGeometry(g), matBordo)); if (!vetro) m.castShadow = true
      m.position.y = 1.13; scena.add(m); ante.push({ m, lato })
    }
    porte.push({ ...d, largo, mezzo, ante, apre: 0, cx: d.asse === 'x' ? mezzo : d.fisso, cz: d.asse === 'x' ? d.fisso : mezzo })
  }
}
function muoviPorte(dt) {
  for (const d of porte) {
    let vicino = false
    for (const o of tutti) { const dx = o.position.x - d.cx, dz = o.position.z - d.cz; if (dx * dx + dz * dz < 4.6) { vicino = true; break } }
    d.apre += ((vicino ? 1 : 0) - d.apre) * (1 - Math.exp(-dt * 7))
    for (const a of d.ante) { const sposta = a.lato * (d.largo / 4 + d.apre * (d.largo / 2 - .06)); if (d.asse === 'x') a.m.position.set(d.mezzo + sposta, 1.13, d.fisso); else a.m.position.set(d.fisso, 1.13, d.mezzo + sposta) }
  }
}
const tutti = []
const portaChiusa = (x, z) => { for (const d of porte) { if (d.apre > .6) continue; if (d.asse === 'x' ? (Math.abs(z - d.fisso) < .18 && x > d.da && x < d.a) : (Math.abs(x - d.fisso) < .18 && z > d.da && z < d.a)) return true } return false }

// ——— Camminare dentro ———
let modo = 'panoramica', persona = 3, guardaY = Math.PI, guardaX = -.12, vy = 0, volo = null
const tasti = new Set(), leva = { x: 0, z: 0 }
const urta = (x, z, r = .3) => { for (const u of URTI) if (x > u.x1 - r && x < u.x2 + r && z > u.z1 - r && z < u.z2 + r) return true; return false }
const dentro = (x, z) => (x > 0 && x < 38 && z > 0 && z < 9) || (x > 0 && x < 46 && z >= 9 && z < 30)
function muoviGiocatore(dt) {
  const o = giocatore.o, avanti = (tasti.has('KeyW') || tasti.has('ArrowUp') ? 1 : 0) - (tasti.has('KeyS') || tasti.has('ArrowDown') ? 1 : 0) - leva.z, lato = (tasti.has('KeyD') || tasti.has('ArrowRight') ? 1 : 0) - (tasti.has('KeyA') || tasti.has('ArrowLeft') ? 1 : 0) + leva.x
  const corre = tasti.has('ShiftLeft') || tasti.has('ShiftRight') || Math.hypot(leva.x, leva.z) > .92, fermoPerChat = !$('#chat').hidden
  let mx = 0, mz = 0
  if (!fermoPerChat && (avanti || lato)) {
    const fx = Math.sin(guardaY), fz = Math.cos(guardaY), n = Math.max(1, Math.hypot(avanti, lato))
    mx = (fx * avanti - fz * lato) / n; mz = (fz * avanti + fx * lato) / n
    const v = (corre ? 5.2 : 2.3) * dt
    if (!urta(o.position.x + mx * v, o.position.z)) o.position.x += mx * v
    if (!urta(o.position.x, o.position.z + mz * v)) o.position.z += mz * v
    giraVerso(o, Math.atan2(mx, mz), 1 - Math.exp(-dt * 12)); giocatore.anim = corre ? 'corre' : 'cammina'
  } else giocatore.anim = 'fermo'
  vy -= 13 * dt; o.position.y += vy * dt; if (o.position.y <= 0) { o.position.y = 0; vy = 0 }
  anima(giocatore, dt, .4)
  const dx = Math.sin(guardaY) * Math.cos(guardaX), dy = Math.sin(guardaX), dz = Math.cos(guardaY) * Math.cos(guardaX)
  if (persona === 1) { camera.position.set(o.position.x + Math.sin(guardaY) * .12, o.position.y + 1.63, o.position.z + Math.cos(guardaY) * .12); camera.lookAt(camera.position.x + dx, camera.position.y + dy, camera.position.z + dz) }
  else {
    const tx = o.position.x, ty = o.position.y + 1.5, tz = o.position.z; let dist = 3.5
    for (let k = 1; k <= 14; k++) { const s = k / 14 * 3.5, x = tx - dx * s, z = tz - dz * s, y = ty - dy * s; if (urta(x, z, .12) || portaChiusa(x, z) || (dentro(x, z) && y > H - .2) || y < .25) { dist = Math.max(.5, s - .3); break } }
    camera.position.set(tx - dx * dist, ty - dy * dist, tz - dz * dist); camera.lookAt(tx + dx * .6, ty + dy * .6 + .1, tz + dz * .6)
  }
  giocatore.o.visible = persona === 3
  // chi ho davanti?
  let vicino = null, meglio = 2.6
  for (const ag of agenti) { const d = ag.p.o.position.distanceTo(o.position); if (d < meglio) { meglio = d; vicino = ag } }
  if (vicino !== davanti) { davanti = vicino; const el = $('#invito'); el.hidden = !vicino || fermoPerChat; if (vicino) el.innerHTML = `${TOCCO ? '' : '<kbd>E</kbd>'}per parlare con ${pulito(primo(vicino.dati.nome))} (${pulito(vicino.dati.ruolo)})` }
  if (fermoPerChat) $('#invito').hidden = true
}
let davanti = null

function impostaModo(m) {
  modo = m
  document.querySelectorAll('#modo button').forEach(b => b.classList.toggle('on', b.dataset.modo === m))
  const cammina = m === 'entra'
  $('#stanze').hidden = cammina; $('#persona').hidden = !cammina; $('#tasti').hidden = !cammina || TOCCO; $('#mirino').hidden = !cammina; $('#leva').hidden = $('#tocco').hidden = !(cammina && TOCCO)
  $('#sinistra').hidden = cammina || pannelliNascosti; $('#destra').hidden = cammina || pannelliNascosti; $('#invito').hidden = true; davanti = null
  controlli.enabled = !cammina; controlli.autoRotate = false
  for (const s of E.soffitto) s.visible = cammina
  if (!cammina) { if (document.pointerLockElement) document.exitPointerLock(); giocatore.o.visible = true; vola('panoramica', .01) }
  else { giocatore.o.position.copy(E.posti.giocatore.pos); guardaY = Math.PI; guardaX = -.1 }
}
function vola(nome, durata = 1.1) {
  const v = VISTE[nome]; if (!v) return
  document.querySelectorAll('#stanze button').forEach(b => b.classList.toggle('on', b.dataset.vista === nome))
  controlli.autoRotate = false
  volo = { da: camera.position.clone(), a: new THREE.Vector3(...v[0]), tda: controlli.target.clone(), ta: new THREE.Vector3(...v[1]), t: 0, durata }
}

// ——— Pannelli ———
let pannelliNascosti = false, ultimoMessaggio = null
const diAgente = id => agenti.find(a => a.id === id)
function aggiornaPannelli() {
  const nome = S.cliente || 'Saracino', alLavoro = S.agenti.filter(a => a.stato && a.stato.inCorso)
  $('#marca-nome').textContent = `Squadra ${nome}`; $('#marca-sotto').textContent = `${S.agenti.length} agenti in linea`; $('#prova').hidden = !prova
  $('#d-agenti').textContent = S.agenti.length; $('#d-corso').textContent = alLavoro.length
  $('#d-ok').textContent = (S.lavori || []).filter(l => ['in_revisione', 'attesa_nota'].includes(l.stato)).length
  const oggi = new Date().toDateString(), diOggi = (S.incarichi || []).filter(i => new Date(i.creato).toDateString() === oggi), fatti = diOggi.filter(i => i.stato === 'fatto').length
  $('#d-avanti').textContent = diOggi.length ? `${fatti}/${diOggi.length}` : '0'
  $('#ora-testo').textContent = alLavoro.length ? `${primo(alLavoro[0].nome)}: ${alLavoro[0].stato.inCorso}` : 'Nessun lavoro in corso'
  $('#ora-pill').textContent = alLavoro.length ? 'AL LAVORO' : 'FERMI'; $('#ora-pill').classList.toggle('vivo', !!alLavoro.length)
  $('#persone').innerHTML = S.agenti.map(a => { const l = a.stato && a.stato.inCorso; return `<div data-id="${pulito(a.id)}"><div><b>${pulito(primo(a.nome))}</b> <span>· ${pulito(a.ruolo)}</span>${l ? `<small>${pulito(l)}</small>` : ''}</div><span class="pill${l ? ' vivo' : ''}">${l ? 'AL LAVORO' : 'LIBERO'}</span></div>` }).join('')
  const nomeDi = id => { const a = S.agenti.find(x => x.id === id); return a ? primo(a.nome) : id === 'marino' ? 'Marino' : id === 'sistema' ? 'Sistema' : (id || '—') }
  const inc = (S.incarichi || []).slice(0, 8), STATI = { in_coda: 'in coda', in_corso: 'in corso', fatto: 'fatto', fallito: 'non riuscito' }
  $('#tempo').innerHTML = inc.length ? inc.map(i => `<div><small>${ora(i.creato)} · ${pulito(nomeDi(i.agente))} · ${STATI[i.stato] || pulito(i.stato)}</small><br>${pulito(String(i.compito || '').slice(0, 110))}</div>`).join('') : '<div class="vuoto">Gli incarichi compaiono qui appena la squadra parte.</div>'
  const voci = (S.bacheca || []).slice(0, 40)
  $('#voci').innerHTML = voci.length ? voci.map(m => { const ag = diAgente(m.da); return `<div><div class="chi"><span style="color:${ag ? ag.colore : '#9aa2c8'}">${pulito(nomeDi(m.da))}${m.a ? ` → ${pulito(nomeDi(m.a))}` : ''}</span><small>${ora(m.quando)}</small></div><p>${pulito(String(m.testo || '').slice(0, 260))}</p></div>` }).join('') : '<div class="vuoto">Ancora nessun messaggio.</div>'
  const sel = $('#inc-chi'); if (sel.options.length !== S.agenti.length) sel.innerHTML = S.agenti.map(a => `<option value="${pulito(a.id)}">${pulito(primo(a.nome))} · ${pulito(a.ruolo)}</option>`).join('')
  // fumetto a chi ha appena scritto in bacheca
  if (voci.length && ultimoMessaggio !== null && voci[0].id !== ultimoMessaggio) { const ag = diAgente(voci[0].da); if (ag) fumetto(ag, String(voci[0].testo || '').replace(/\s+/g, ' ').slice(0, 60), tempo, 8) }
  if (voci.length) ultimoMessaggio = voci[0].id; else if (ultimoMessaggio === null) ultimoMessaggio = ''
  disegnaLavagna(alLavoro)
}
function disegnaLavagna(alLavoro) {
  const c = E.lavagna.userData.tela, g = c.getContext('2d'), w = c.width, h = c.height
  g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h); g.fillStyle = '#1c2030'; g.font = '800 44px -apple-system,Arial'; g.textBaseline = 'alphabetic'; g.fillText('LAVAGNA DEI LAVORI', 40, 76)
  g.font = '500 26px -apple-system,Arial'; g.fillStyle = '#6a708a'; g.fillText(alLavoro.length ? `${alLavoro.length} al lavoro adesso` : 'Nessun lavoro in corso', 40, 116)
  const righe = alLavoro.length ? alLavoro.map(a => [primo(a.nome), a.stato.inCorso, '#3f6df0']) : (S.incarichi || []).slice(0, 5).map(i => { const a = S.agenti.find(x => x.id === i.agente); return [a ? primo(a.nome) : '—', i.compito, i.stato === 'fatto' ? '#3aa864' : '#b9bdcc'] })
  righe.slice(0, 5).forEach(([n, t, col], i) => { const y = 170 + i * 66; g.fillStyle = col; g.beginPath(); g.arc(56, y - 9, 11, 0, 7); g.fill(); g.fillStyle = '#1c2030'; g.font = '700 28px -apple-system,Arial'; g.fillText(n, 84, y); const wn = g.measureText(n).width; g.font = '400 28px -apple-system,Arial'; g.fillStyle = '#4a5068'; let tx = String(t || ''); while (g.measureText(tx).width > w - 150 - wn && tx.length > 4) tx = tx.slice(0, -2); g.fillText(tx + (tx !== String(t || '') ? '…' : ''), 100 + wn, y) })
  E.lavagna.userData.trama.needsUpdate = true
}
async function daiIncarico(agente, compito) {
  if (prova) return { ok: false, errore: 'Qui ci sono dati di prova: l\'incarico parte solo dalla pagina vera della squadra.' }
  try { const r = await fetch('/api/squadra/incarico', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agente, compito }) }); const j = await r.json().catch(() => ({})); return r.ok && j.ok ? { ok: true } : { ok: false, errore: j.errore || `errore ${r.status}` } } catch (e) { return { ok: false, errore: 'rete non raggiungibile' } }
}

// ——— Chat con un agente: le quattro domande leggono lo stato vero; il testo libero è un incarico ———
let chatCon = null
function messaggio(testo, tipo = '') { const d = document.createElement('div'); d.className = 'm ' + tipo; d.textContent = testo; $('#messaggi').appendChild(d); $('#messaggi').scrollTop = 1e6; return d }
function apriChat(ag) {
  chatCon = ag; const a = ag.dati, lavora = !!(a.stato && a.stato.inCorso)
  if (document.pointerLockElement) document.exitPointerLock()
  $('#chat-volto').innerHTML = a.volto ? `<img src="/api/squadra/volto/${pulito(a.id)}" alt="">` : `<span class="iniz" style="background:${ag.colore}">${pulito(primo(a.nome)[0] || '?')}</span>`
  $('#chat-nome').textContent = primo(a.nome); $('#chat-ruolo').textContent = a.ruolo; $('#chat-stato').textContent = lavora ? 'AL LAVORO' : 'LIBERO'; $('#chat-stato').classList.toggle('vivo', lavora)
  $('#messaggi').innerHTML = ''; messaggio(`Chiedi a ${primo(a.nome)} a cosa sta lavorando, se ci sono blocchi o cosa c'è dopo. Se scrivi qui sotto, il messaggio parte come incarico vero.`, 'nota')
  $('#chat-testo').placeholder = `Dai un incarico a ${primo(a.nome)}…`; $('#chat').hidden = false; $('#invito').hidden = true
  if (!TOCCO) setTimeout(() => $('#chat-testo').focus(), 30)
  if (!ag.cammino && !lavora) { ag.p.anim = ag.meta && ag.meta.anim === 'seduto' ? 'seduto' : 'saluta'; setTimeout(() => { if (!ag.cammino && ag.p.anim === 'saluta') ag.p.anim = 'parla' }, 1600); ag.finoA = tempo + 40 }
}
function chiudiChat() { $('#chat').hidden = true; if (chatCon && !chatCon.cammino && ['parla', 'saluta'].includes(chatCon.p.anim)) chatCon.p.anim = chatCon.animMeta; chatCon = null; davanti = null }
function risposta(q, ag) {
  const a = (S.agenti || []).find(x => x.id === ag.id) || ag.dati, st = a.stato || {}
  if (q === 'fai') return st.inCorso ? `Sto lavorando a questo: ${st.inCorso}${st.da ? ` (dalle ${ora(st.da)})` : ''}.` : `Adesso nessun lavoro in corso.${st.ultimo ? ` L'ultima cosa chiusa${st.ultimoQuando ? ` alle ${ora(st.ultimoQuando)}` : ''}: ${String(st.ultimo).replace(/[.\s]+$/, '')}.` : ''} Dammi un incarico e parto.`
  if (q === 'problemi') { const falliti = (S.incarichi || []).filter(i => i.agente === a.id && i.stato === 'fallito'), errori = (S.lavori || []).filter(l => l.agente === a.id && l.stato === 'errore_pubblicazione'); return falliti.length || errori.length ? [...falliti.slice(0, 3).map(i => `Incarico non riuscito: ${String(i.compito).slice(0, 120)}`), ...errori.slice(0, 3).map(l => `Pubblicazione in errore: ${l.titolo}`)].join('\n') : 'Nessun blocco: non risultano incarichi falliti né pubblicazioni in errore a mio nome.' }
  if (q === 'punto') { const miei = (S.lavori || []).filter(l => l.agente === a.id), attesa = miei.filter(l => ['in_revisione', 'attesa_nota'].includes(l.stato)); return `${a.in_coda || 0} incarichi in coda.${attesa.length ? ` ${attesa.length} lavori aspettano il tuo OK: ${attesa.slice(0, 3).map(l => l.titolo).join(', ')}.` : ' Nessun lavoro mio aspetta il tuo OK.'}` }
  return a.prossimo ? `Il prossimo giro è ${a.prossimo.giorno} alle ${a.prossimo.ora}: ${a.prossimo.compito}` : 'Non ho giri in calendario: lavoro quando arriva un incarico.'
}

// ——— Avvio ———
let tempo = 0
async function avvia() {
  await caricaStato()
  E = costruisciEdificio({ cliente: S.cliente || 'Saracino', scrivanieVive: Math.max(12, S.agenti.length + 1) })
  URTI = E.urti; preparaGriglia(); scena.add(E.gruppo)
  for (const s of E.soffitto) s.visible = false
  // luci: cielo notturno, una luce dall'alto che fa le ombre, e le lampade calde stanza per stanza
  scena.add(new THREE.HemisphereLight('#5a6a98', '#2a1c12', SEMPLICE ? 1.5 : .62))
  const sole = new THREE.DirectionalLight('#ffd9b4', .8); sole.position.set(30, 46, 24); sole.target.position.set(22, 0, 15); scena.add(sole, sole.target)
  if (!SEMPLICE) { sole.castShadow = true; sole.shadow.mapSize.set(2048, 2048); Object.assign(sole.shadow.camera, { left: -36, right: 36, top: 30, bottom: -30, near: 5, far: 90 }); sole.shadow.bias = -.0005; sole.shadow.normalBias = .04 }
  for (const l of E.luci.slice(0, SEMPLICE ? 8 : 40)) { const p = new THREE.PointLight(l.colore, l.forza, l.raggio, 1.6); p.position.set(l.x, l.y, l.z); scena.add(p) }
  creaPorte()
  S.agenti.forEach((a, i) => creaAgente(a, i))
  // comparse: reception e guardia
  for (const [posto, aspetto, nome, ruolo] of [[E.posti.reception, { donna: true, pelle: '#f0c8a4', capelli: '#d9b46a', stile: 'coda', maglia: '#e8e4da', pantaloni: '#26262c', giacca: true, altezza: .96 }, 'Reception', 'Accoglienza'], [E.posti.guardia, { pelle: '#d9a077', capelli: '#2a1c14', stile: 'cappello', maglia: '#e8e4da', pantaloni: '#1c2433', manicheCorte: true, scritta: true }, 'Sicurezza', 'Ingresso']]) {
    const p = creaPersona(aspetto); etichette(p); scriviTarga(p.targa, nome, ruolo, '#8b93b8'); p.o.position.copy(posto.pos); p.o.rotation.y = posto.giro; scena.add(p.o); comparse.push(p)
  }
  giocatore = creaPersona({ pelle: '#e8b48c', capelli: '#2a1c14', stile: 'corti', maglia: '#eeff00', pantaloni: '#1c1c20', scarpe: '#f2efe6', barba: true })
  giocatore.o.position.copy(E.posti.giocatore.pos); giocatore.o.rotation.y = E.posti.giocatore.giro; scena.add(giocatore.o)
  tutti.push(...agenti.map(a => a.p.o), ...comparse.map(p => p.o), giocatore.o)

  if (!SEMPLICE) {
    const rt = new THREE.WebGLRenderTarget(innerWidth, innerHeight, { samples: 4, type: THREE.HalfFloatType })
    composer = new EffectComposer(renderer, rt); composer.addPass(new RenderPass(scena, camera))
    bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), .2, .5, .93); composer.addPass(bloom); composer.addPass(new OutputPass())
  }
  misura()
  camera.position.set(...VISTE.panoramica[0]); controlli.target.set(...VISTE.panoramica[1]); controlli.update()
  aggiornaPannelli(); collegaComandi(); impostaModo(Q.get('modo') === 'entra' ? 'entra' : 'panoramica')
  if (Q.get('vista')) vola(Q.get('vista'), .01); else controlli.autoRotate = !Q.has('fermo')
  if (Q.get('x')) { giocatore.o.position.set(+Q.get('x'), 0, +Q.get('z')); guardaY = +(Q.get('giro') || 0); window.__ufficio.persona(+(Q.get('persona') || 3)) }
  $('#carico').remove()
  // Nascosto (la persona guarda un'altra sezione: la cornice ha larghezza zero) non interroga la squadra ogni 5 secondi.
  setInterval(async () => { if (!innerWidth) return; await caricaStato(); for (const ag of agenti) { const d = S.agenti.find(a => a.id === ag.id); if (d) ag.dati = d } aggiornaPannelli() }, prova ? 6000 : 5000)
  renderer.setAnimationLoop(ciclo)
}
const orologio = new THREE.Clock()
let prossimaDecisione = 0
function ciclo() {
  const dt = Math.min(orologio.getDelta(), .05); tempo += dt
  if (tempo > prossimaDecisione) { prossimaDecisione = tempo + .5; for (const ag of agenti) if (ag !== chatCon) decidi(ag, tempo) }
  for (const ag of agenti) muoviAgente(ag, dt, tempo)
  for (const p of comparse) anima(p, dt)
  if (modo === 'entra') muoviGiocatore(dt)
  else {
    anima(giocatore, dt)
    if (volo) { volo.t = Math.min(1, volo.t + dt / volo.durata); const e = volo.t * volo.t * (3 - 2 * volo.t); camera.position.lerpVectors(volo.da, volo.a, e); controlli.target.lerpVectors(volo.tda, volo.ta, e); if (volo.t >= 1) volo = null }
    controlli.update()
  }
  muoviPorte(dt)
  if (composer) composer.render(); else renderer.render(scena, camera)
}

// ——— Comandi ———
function collegaComandi() {
  $('#modo').addEventListener('click', e => { const m = e.target.dataset.modo; if (m && m !== modo) impostaModo(m) })
  $('#stanze').addEventListener('click', e => { const v = e.target.dataset.vista; if (v) vola(v) })
  $('#persona').addEventListener('click', e => { const p = e.target.dataset.persona; if (p) impostaPersona(+p) })
  $('#pannelli').addEventListener('click', () => { pannelliNascosti = !pannelliNascosti; $('#pannelli').textContent = pannelliNascosti ? 'Mostra pannelli' : 'Nascondi pannelli'; if (modo !== 'entra') { $('#sinistra').hidden = $('#destra').hidden = pannelliNascosti } })
  $('#schermo').addEventListener('click', () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.().catch(() => {}) })
  const impostaPersona = p => { persona = p; document.querySelectorAll('#persona button').forEach(b => b.classList.toggle('on', +b.dataset.persona === p)) }
  addEventListener('keydown', e => {
    if (e.target.matches('input, textarea, select')) { if (e.code === 'Escape') { e.target.blur(); if (!$('#chat').hidden) chiudiChat() } return }
    tasti.add(e.code)
    if (e.code === 'Escape' && !$('#chat').hidden) chiudiChat()
    if (modo !== 'entra') return
    if (e.code === 'Space') { e.preventDefault(); if (giocatore.o.position.y === 0) vy = 4.6 }
    if (e.code === 'KeyV') impostaPersona(persona === 3 ? 1 : 3)
    if (e.code === 'KeyE' && davanti && $('#chat').hidden) { e.preventDefault(); apriChat(davanti) }
  })
  addEventListener('keyup', e => tasti.delete(e.code)); addEventListener('blur', () => tasti.clear())
  // sguardo: mouse agganciato dopo un clic, oppure trascinando
  let giu = null, mosso = 0
  tela.addEventListener('pointerdown', e => { giu = { x: e.clientX, y: e.clientY, id: e.pointerId }; mosso = 0; controlli.autoRotate = false })
  addEventListener('pointermove', e => {
    if (modo !== 'entra') { if (giu) mosso += Math.abs(e.movementX) + Math.abs(e.movementY); return }
    const agganciato = document.pointerLockElement === tela
    if (!agganciato && !(giu && giu.id === e.pointerId)) return
    const dx = agganciato ? e.movementX : e.clientX - giu.x, dy = agganciato ? e.movementY : e.clientY - giu.y
    if (!agganciato) { giu.x = e.clientX; giu.y = e.clientY; mosso += Math.abs(dx) + Math.abs(dy) }
    guardaY -= dx * (TOCCO ? .006 : .0026); guardaX = lim(guardaX - dy * (TOCCO ? .005 : .0022), -1.1, 1.1)
  })
  addEventListener('pointerup', e => {
    const era = giu; giu = null; if (!era || mosso > 6 || e.target !== tela) return
    if (modo === 'entra') { if (!TOCCO && document.pointerLockElement !== tela && $('#chat').hidden) tela.requestPointerLock?.(); return }
    const r = tela.getBoundingClientRect(), raggio = new THREE.Raycaster(); raggio.setFromCamera(new THREE.Vector2((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1), camera)
    const colpi = raggio.intersectObjects(agenti.map(a => a.p.o), true); const c = colpi.find(x => x.object.userData.persona && x.object.userData.persona.agente); if (c) apriChat(c.object.userData.persona.agente)
  })
  $('#invito').addEventListener('click', () => davanti && apriChat(davanti))
  // telefono: leva per camminare, bottoni per parlare e saltare
  const lv = $('#leva'); let lvId = null
  const levaMuovi = e => { const r = lv.getBoundingClientRect(), x = (e.clientX - r.left - r.width / 2) / (r.width / 2), z = (e.clientY - r.top - r.height / 2) / (r.height / 2), n = Math.max(1, Math.hypot(x, z)); leva.x = x / n; leva.z = z / n; lv.firstElementChild.style.transform = `translate(${leva.x * 34}px,${leva.z * 34}px)` }
  lv.addEventListener('pointerdown', e => { lvId = e.pointerId; lv.setPointerCapture(lvId); levaMuovi(e) }); lv.addEventListener('pointermove', e => e.pointerId === lvId && levaMuovi(e))
  const levaFine = () => { lvId = null; leva.x = leva.z = 0; lv.firstElementChild.style.transform = '' }; lv.addEventListener('pointerup', levaFine); lv.addEventListener('pointercancel', levaFine)
  $('#t-parla').addEventListener('click', () => davanti && apriChat(davanti)); $('#t-salta').addEventListener('click', () => { if (giocatore.o.position.y === 0) vy = 4.6 })
  // pannello di sinistra
  $('#persone').addEventListener('click', e => { const r = e.target.closest('[data-id]'); const ag = r && diAgente(r.dataset.id); if (ag) apriChat(ag) })
  $('#inc-esempi').innerHTML = ['Fammi il punto sulle campagne degli ultimi 7 giorni', 'Proponi 3 angoli per la prossima settimana', 'Dimmi cosa aspetta il mio OK'].map(t => `<button>${pulito(t)}</button>`).join('')
  $('#inc-esempi').addEventListener('click', e => { if (e.target.tagName === 'BUTTON') { $('#inc-testo').value = e.target.textContent; $('#inc-testo').focus() } })
  $('#inc-invia').addEventListener('click', async () => { const t = $('#inc-testo').value.trim(); if (!t) return; $('#inc-invia').disabled = true; const r = await daiIncarico($('#inc-chi').value, t); $('#inc-invia').disabled = false; $('#inc-esito').textContent = r.ok ? 'Incarico consegnato: è in cima alla coda.' : `Non consegnato: ${r.errore}`; if (r.ok) $('#inc-testo').value = '' })
  // chat
  $('#chat-chiudi').addEventListener('click', chiudiChat)
  $('#chat .rapide').addEventListener('click', e => { const q = e.target.dataset.q; if (!q || !chatCon) return; const ag = chatCon; messaggio(e.target.textContent, 'io'); const attesa = messaggio(`${primo(ag.dati.nome)} sta scrivendo…`, 'nota'); setTimeout(() => { attesa.remove(); if (chatCon === ag) messaggio(risposta(q, ag)) }, 450) })
  const invia = async () => { const t = $('#chat-testo').value.trim(); if (!t || !chatCon) return; const ag = chatCon; $('#chat-testo').value = ''; messaggio(t, 'io'); const r = await daiIncarico(ag.id, t); if (chatCon === ag) messaggio(r.ok ? 'Ricevuto: l\'ho messo in cima alla coda. Ti rispondo in bacheca e su Telegram.' : `Non sono riuscito a prenderlo in carico: ${r.errore}`, r.ok ? '' : 'nota') }
  $('#chat-invia').addEventListener('click', invia); $('#chat-testo').addEventListener('keydown', e => { if (e.code === 'Enter') invia() })
  // aggancio per i collaudi
  window.__ufficio = { camera, controlli, agenti, giocatore: () => giocatore, guarda: (y, x = -.1) => { guardaY = y; guardaX = x }, apriChat: id => apriChat(diAgente(id)), impostaModo, persona: p => impostaPersona(p), renderer }
}
avvia().catch(e => { $('#carico').textContent = `L'ufficio non si è aperto: ${e.message}`; console.error(e) })
