// Le persone: corpi low-poly a facce piatte con le giunture (anche, ginocchia, spalle, gomiti),
// mossi a mano: cammina, corre, siede e scrive, beve, parla, gioca, saluta. Niente modelli da scaricare.
import * as THREE from 'three'

const mat = {}
const M = c => mat[c] ||= new THREE.MeshStandardMaterial({ color: c, flatShading: true, roughness: .85 })
function pezzo(g, colore, x = 0, y = 0, z = 0) { const m = new THREE.Mesh(g, M(colore)); m.position.set(x, y, z); m.castShadow = true; return m }
const G = { cache: {} }
const geo = (chiave, crea) => G.cache[chiave] ||= crea()

// Aspetti: ogni agente ha il suo (pelle, capelli, vestiti). Si sceglie dal nome e dalla posizione in squadra.
const PELLI = ['#e8b48c', '#d9a077', '#f0c8a4', '#c68a5e', '#a86f4a', '#efc09a']
const CAPELLI = ['#2a1c14', '#5a3a22', '#d9b46a', '#1a1a1e', '#8a3a22', '#6b4a2e', '#3a2a1c', '#b5552a']
const MAGLIE = ['#3a3a44', '#d9d4c8', '#c0563a', '#2f5d7a', '#e0a23a', '#5a7a4a', '#7a3a4a', '#e8e4da', '#3d6b6b', '#8a5a9a', '#b3261e']
const PANTALONI = ['#26262c', '#2c3a52', '#3a3028', '#4a4a52', '#1e2a3a']
const DONNE = /^(giulia|sara|chiara|francesca|elena|noemi|anna|marta|laura|silvia|paola|alessia|martina|federica|valentina|olivia|mia|sofia|aurora|giorgia|beatrice|elisa|irene|marina|monica|roberta|simona|teresa|veronica)$/i
export function aspettoPer(nome, i = 0) {
  const primo = String(nome || '').trim().split(/\s+/)[0], donna = DONNE.test(primo)
  const stili = donna ? ['lunghi', 'coda', 'caschetto', 'crocchia'] : ['corti', 'corti', 'ciuffo', 'calvo', 'corti']
  return { donna, pelle: PELLI[(i * 5 + 1) % PELLI.length], capelli: CAPELLI[(i * 3 + (donna ? 2 : 0)) % CAPELLI.length], stile: stili[(i * 7 + 1) % stili.length], maglia: MAGLIE[i % MAGLIE.length], pantaloni: PANTALONI[(i * 2) % PANTALONI.length], occhiali: i % 3 === 1, barba: !donna && i % 4 === 2, giacca: i % 5 === 0, altezza: donna ? .96 : 1 + (i % 3) * .02 }
}

export function creaPersona(a = {}) {
  a = { pelle: PELLI[0], capelli: CAPELLI[0], stile: 'corti', maglia: MAGLIE[0], pantaloni: PANTALONI[0], scarpe: '#1c1c20', altezza: 1, ...a }
  const radice = new THREE.Group(), bacino = new THREE.Group(); bacino.position.y = .9; radice.add(bacino)
  const torso = new THREE.Group(); bacino.add(torso)
  const colTorso = a.giacca ? '#26262c' : a.maglia
  const busto = pezzo(geo('busto', () => { const g = new THREE.CylinderGeometry(.21, .165, .56, 6); g.scale(1, 1, .62); return g }), colTorso, 0, .3, 0); torso.add(busto)
  torso.add(pezzo(geo('fianchi', () => { const g = new THREE.CylinderGeometry(.168, .175, .16, 6); g.scale(1, 1, .64); return g }), a.gonna || a.pantaloni, 0, -.04, 0))
  torso.add(pezzo(geo('spalle', () => { const g = new THREE.CylinderGeometry(.075, .075, .5, 5); g.rotateZ(Math.PI / 2); g.scale(1, .8, .9); return g }), colTorso, 0, .53, 0))
  torso.add(pezzo(geo('cintura', () => { const g = new THREE.CylinderGeometry(.172, .172, .035, 6); g.scale(1, 1, .66); return g }), '#1a1a1e', 0, .04, 0))
  if (!a.giacca) torso.add(pezzo(geo('colletto', () => { const g = new THREE.CylinderGeometry(.07, .085, .04, 5); return g }), a.donna ? colTorso : '#f2efe6', 0, .585, 0))
  if (a.giacca) { torso.add(pezzo(geo('camicia', () => new THREE.BoxGeometry(.1, .34, .02)), '#f2efe6', 0, .38, .118)); torso.add(pezzo(geo('cravatta', () => new THREE.BoxGeometry(.035, .26, .02)), a.maglia, 0, .36, .128)) }
  if (a.scritta) torso.add(pezzo(geo('targhetta', () => new THREE.BoxGeometry(.08, .05, .01)), '#f2efe6', -.09, .42, .125))
  // testa
  const testa = new THREE.Group(); testa.position.y = .7; torso.add(testa)
  testa.add(pezzo(geo('collo', () => new THREE.CylinderGeometry(.05, .06, .1, 5)), a.pelle, 0, -.1, 0))
  testa.add(pezzo(geo('cranio', () => { const g = new THREE.IcosahedronGeometry(.17, 1); g.scale(.9, 1.06, .96); return g }), a.pelle))
  testa.add(pezzo(geo('naso', () => new THREE.ConeGeometry(.025, .06, 4)), a.pelle, 0, -.02, .165))
  for (const x of [-.06, .06]) testa.add(pezzo(geo('occhio', () => new THREE.BoxGeometry(.028, .028, .02)), '#1a1a1e', x, .03, .148))
  for (const x of [-.06, .06]) testa.add(pezzo(geo('sopracciglio', () => new THREE.BoxGeometry(.05, .012, .02)), a.capelli, x, .068, .15))
  testa.add(pezzo(geo('bocca', () => new THREE.BoxGeometry(.05, .01, .02)), '#7a3a30', 0, -.075, .15))
  const cap = a.capelli
  if (a.stile !== 'calvo') testa.add(pezzo(geo('calotta', () => { const g = new THREE.IcosahedronGeometry(.18, 1); g.scale(.95, .8, 1.02); return g }), cap, 0, .07, -.025))
  if (a.stile === 'ciuffo') testa.add(pezzo(geo('ciuffo', () => new THREE.BoxGeometry(.2, .07, .1)), cap, .02, .16, .1))
  if (a.stile === 'lunghi' || a.stile === 'caschetto') { const l = a.stile === 'lunghi' ? .36 : .22; testa.add(pezzo(geo('dietro' + l, () => new THREE.BoxGeometry(.3, l, .12)), cap, 0, -.02 - l / 2 + .1, -.12)); for (const x of [-.15, .15]) testa.add(pezzo(geo('lato' + l, () => new THREE.BoxGeometry(.05, l * .8, .16)), cap, x, -.02 - l * .4 + .1, -.02)) }
  if (a.stile === 'coda') testa.add(pezzo(geo('coda', () => { const g = new THREE.ConeGeometry(.06, .3, 5); g.rotateX(Math.PI * .8); return g }), cap, 0, -.02, -.22))
  if (a.stile === 'crocchia') testa.add(pezzo(geo('crocchia', () => new THREE.IcosahedronGeometry(.075, 0)), cap, 0, .2, -.1))
  if (a.stile === 'cappello') { testa.add(pezzo(geo('cupola', () => new THREE.CylinderGeometry(.16, .175, .1, 7)), a.cappello || '#1c2433', 0, .15, 0)); testa.add(pezzo(geo('visiera', () => new THREE.BoxGeometry(.2, .02, .14)), a.cappello || '#1c2433', 0, .11, .17)) }
  if (a.barba) testa.add(pezzo(geo('barba', () => { const g = new THREE.IcosahedronGeometry(.13, 0); g.scale(1, .7, .8); return g }), cap, 0, -.1, .07))
  if (a.occhiali) { for (const x of [-.062, .062]) { for (const y of [.004, .058]) testa.add(pezzo(geo('mont-o', () => new THREE.BoxGeometry(.078, .01, .012)), '#16161a', x, y, .16)); for (const dx of [-.036, .036]) testa.add(pezzo(geo('mont-v', () => new THREE.BoxGeometry(.01, .064, .012)), '#16161a', x + dx, .031, .16)) } testa.add(pezzo(geo('ponte', () => new THREE.BoxGeometry(.05, .01, .012)), '#16161a', 0, .04, .16)); for (const x of [-.13, .13]) testa.add(pezzo(geo('asta', () => new THREE.BoxGeometry(.01, .01, .16)), '#16161a', x, .045, .08)) }
  // braccia
  const braccio = lato => {
    const spalla = new THREE.Group(); spalla.position.set(lato * .245, .52, 0); torso.add(spalla)
    spalla.add(pezzo(geo('omero', () => new THREE.CylinderGeometry(.058, .05, .3, 5)), colTorso, 0, -.15, 0))
    const gomito = new THREE.Group(); gomito.position.y = -.3; spalla.add(gomito)
    gomito.add(pezzo(geo('avambraccio', () => new THREE.CylinderGeometry(.048, .04, .26, 5)), a.manicheCorte ? a.pelle : colTorso, 0, -.13, 0))
    gomito.add(pezzo(geo('mano', () => new THREE.IcosahedronGeometry(.05, 0)), a.pelle, 0, -.29, 0))
    return { spalla, gomito }
  }
  const gamba = lato => {
    const anca = new THREE.Group(); anca.position.set(lato * .095, -.06, 0); bacino.add(anca)
    anca.add(pezzo(geo('coscia', () => new THREE.CylinderGeometry(.085, .068, .44, 5)), a.gonna ? a.pelle : a.pantaloni, 0, -.2, 0))
    const ginocchio = new THREE.Group(); ginocchio.position.y = -.42; anca.add(ginocchio)
    ginocchio.add(pezzo(geo('stinco', () => new THREE.CylinderGeometry(.064, .05, .4, 5)), a.gonna ? a.pelle : a.pantaloni, 0, -.2, 0))
    ginocchio.add(pezzo(geo('scarpa', () => new THREE.BoxGeometry(.1, .08, .25)), a.scarpe, 0, -.4, .05))
    return { anca, ginocchio }
  }
  const p = { o: radice, bacino, torso, testa, bS: braccio(-1), bD: braccio(1), gS: gamba(-1), gD: gamba(1), fase: Math.random() * 6, anim: 'fermo', t: Math.random() * 10, altoSeduta: .5, aspetto: a }
  radice.scale.setScalar(a.altezza)
  radice.traverse(x => { x.userData.persona = p })
  return p
}

// Ogni animazione è una posa-bersaglio calcolata a ogni fotogramma; le giunture la inseguono morbide.
const posa = { bY: .9, tX: 0, tZ: 0, hX: 0, hY: 0, sSx: 0, sSz: 0, gSx: 0, sDx: 0, sDz: 0, gDx: 0, aSx: 0, kSx: 0, aDx: 0, kDx: 0 }
export function anima(p, dt, velocita = 0) {
  p.t += dt
  const t = p.t, q = { ...posa }, s = Math.sin, a = p.anim
  if (a === 'cammina' || a === 'corre') {
    const corsa = a === 'corre', amp = corsa ? .95 : .6
    p.fase += dt * (corsa ? 11 : 3.1 + velocita * 2.6)
    const f = p.fase
    q.aSx = s(f) * amp; q.aDx = -s(f) * amp; q.kSx = Math.max(0, -Math.cos(f)) * amp * 1.5 + .08; q.kDx = Math.max(0, Math.cos(f)) * amp * 1.5 + .08
    q.sSx = -s(f) * amp * .75; q.sDx = s(f) * amp * .75; q.gSx = corsa ? -1.3 : -.25 - Math.max(0, s(f)) * .3; q.gDx = corsa ? -1.3 : -.25 - Math.max(0, -s(f)) * .3
    q.bY = .9 + Math.abs(Math.cos(f)) * (corsa ? .06 : .028) - .02; q.tX = corsa ? .22 : .05; q.sSz = -.06; q.sDz = .06
  } else if (a === 'seduto' || a === 'scrive') {
    q.bY = p.altoSeduta + .08; q.aSx = q.aDx = -1.5; q.kSx = q.kDx = 1.5; q.tX = .04
    if (a === 'scrive') { q.sSx = -.42; q.sDx = -.42; q.gSx = -1.15 + s(t * 17) * .07; q.gDx = -1.15 + s(t * 13 + 1) * .07; q.sSz = .1; q.sDz = -.1; q.hX = .12 + s(t * .6) * .04; q.hY = s(t * .37) * .12 }
    else { q.sSx = -.5; q.sDx = -.5; q.gSx = q.gDx = -.5; q.hY = s(t * .5) * .35; q.tX = -.1 }
  } else if (a === 'beve') {
    const su = (s(t * .9) + 1) / 2; q.sDx = -.5 - su * .7; q.gDx = -1.5 - su * .7; q.sDz = -.1; q.hX = -su * .16; q.sSz = -.08; q.hY = s(t * .3) * .3
  } else if (a === 'parla') {
    q.sDx = -.5 + s(t * 2.3) * .25; q.gDx = -1.2 + s(t * 3.1) * .35; q.sSx = -.2; q.gSx = -.6 + s(t * 1.7) * .2; q.hY = s(t * .8) * .25; q.hX = s(t * 1.9) * .06; q.tZ = s(t * .7) * .03
  } else if (a === 'gioca') {
    const colpo = Math.max(0, s(t * 1.4)) ** 6; q.tX = .5; q.sSx = -1.5; q.gSx = -.2; q.sDx = -.5 + colpo * .5; q.gDx = -1.5 + colpo * .8; q.hX = -.3; q.aSx = -.3; q.aDx = .25; q.kSx = .25; q.bY = .86
  } else if (a === 'saluta') {
    q.sDz = 2.5 + s(t * 9) * .3; q.gDx = -.5; q.sDx = 0; q.hY = .1; q.sSz = -.08
  } else { // fermo: respira, sposta il peso
    q.sSz = -.07 - s(t * 1.2) * .012; q.sDz = .07 + s(t * 1.2) * .012; q.gSx = -.12; q.gDx = -.12; q.tZ = s(t * .45) * .02; q.hY = s(t * .33) * .28; q.hX = s(t * .5) * .04; q.bY = .9 + s(t * 1.2) * .004
  }
  const k = 1 - Math.exp(-dt * 11), L = (o, c, v) => { o[c] += (v - o[c]) * k }
  L(p.bacino.position, 'y', q.bY); L(p.torso.rotation, 'x', q.tX); L(p.torso.rotation, 'z', q.tZ); L(p.testa.rotation, 'x', q.hX); L(p.testa.rotation, 'y', q.hY)
  L(p.bS.spalla.rotation, 'x', q.sSx); L(p.bS.spalla.rotation, 'z', q.sSz); L(p.bS.gomito.rotation, 'x', q.gSx)
  L(p.bD.spalla.rotation, 'x', q.sDx); L(p.bD.spalla.rotation, 'z', q.sDz); L(p.bD.gomito.rotation, 'x', q.gDx)
  L(p.gS.anca.rotation, 'x', q.aSx); L(p.gS.ginocchio.rotation, 'x', q.kSx); L(p.gD.anca.rotation, 'x', q.aDx); L(p.gD.ginocchio.rotation, 'x', q.kDx)
}

// ——— Targhetta col nome e fumetto: disegnati su tela, stanno nel mondo (da vicino sono grandi, da lontano piccoli) ———
function etichetta(larghezzaMondo) {
  const c = document.createElement('canvas'); c.width = 512; c.height = 96
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthWrite: false, toneMapped: false }))
  s.scale.set(larghezzaMondo, larghezzaMondo * 96 / 512, 1); s.userData = { c, t, testo: null }; s.renderOrder = 5
  return s
}
function pillola(g, x, y, w, h, r) { g.beginPath(); g.roundRect(x, y, w, h, r); g.fill() }
export function scriviTarga(s, nome, stato, colore) {
  const chiave = `${nome}|${stato}|${colore}`; if (s.userData.testo === chiave) return; s.userData.testo = chiave
  const { c, t } = s.userData, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height)
  g.font = '700 40px -apple-system,"Helvetica Neue",Arial'; const w1 = g.measureText(nome).width
  g.font = '500 36px -apple-system,"Helvetica Neue",Arial'; const w2 = g.measureText(' · ' + stato).width
  const w = Math.min(500, w1 + w2 + 92), x0 = (c.width - w) / 2
  g.fillStyle = 'rgba(22,24,40,.9)'; pillola(g, x0, 12, w, 72, 36)
  g.fillStyle = colore; g.beginPath(); g.arc(x0 + 38, 48, 11, 0, 7); g.fill()
  g.textBaseline = 'middle'; g.fillStyle = '#fff'; g.font = '700 40px -apple-system,"Helvetica Neue",Arial'; g.fillText(nome, x0 + 62, 50)
  g.fillStyle = 'rgba(170,176,214,.95)'; g.font = '500 36px -apple-system,"Helvetica Neue",Arial'; g.fillText(' · ' + stato, x0 + 62 + w1, 50, w - w1 - 80)
  t.needsUpdate = true
}
export function scriviFumetto(s, testo) {
  if (s.userData.testo === testo) return; s.userData.testo = testo
  const { c, t } = s.userData, g = c.getContext('2d'); g.clearRect(0, 0, c.width, c.height)
  if (!testo) { s.visible = false; t.needsUpdate = true; return }
  s.visible = true; g.font = '500 38px -apple-system,"Helvetica Neue",Arial'
  let tx = testo; while (g.measureText(tx).width > 440 && tx.length > 4) tx = tx.slice(0, -2); if (tx !== testo) tx = tx.trimEnd() + '…'
  const w = g.measureText(tx).width + 56, x0 = (c.width - w) / 2
  g.fillStyle = '#fff'; pillola(g, x0, 10, w, 68, 22); g.beginPath(); g.moveTo(c.width / 2 - 14, 76); g.lineTo(c.width / 2, 94); g.lineTo(c.width / 2 + 14, 76); g.fill()
  g.fillStyle = '#1c1c24'; g.textBaseline = 'middle'; g.fillText(tx, x0 + 28, 46)
  t.needsUpdate = true
}
export function etichette(p) {
  p.targa = etichetta(1.15); p.targa.position.y = 2.02; p.o.add(p.targa)
  p.fumetto = etichetta(1.6); p.fumetto.position.y = 2.3; p.fumetto.visible = false; p.o.add(p.fumetto)
}
