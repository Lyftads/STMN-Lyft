// L'edificio: pianta, muri con porte e vetrate, pavimenti, mobili, esterno di notte.
// Tutto misurato in metri. x va verso est, z verso sud; l'ingresso è sul lato sud (reception).
import * as THREE from 'three'
import { Cantiere, TRAME, cartello } from './mattoni.js'

export const H = 3.2
const SP = 0.22
const C = {
  muro: '#a5835f', muroScuro: '#5a3128', muroOpen: '#4e2a26', bordo: '#2a201b', legno: '#7a4e2c', legnoScuro: '#472b1a', legnoChiaro: '#c8a06c',
  piano: '#cdb89a', teal: '#2c5a55', nero: '#1b1b1f', grigio: '#8e8e92', grigioScuro: '#36363c', bianco: '#ece7dc', rosso: '#b3261e', rossoScuro: '#7c1c18',
  arancio: '#e08a2c', verdeTavolo: '#2c8a4c', foglia: '#3f8f3c', fogliaScura: '#2a6630', vaso: '#26262a', oro: '#d9a441', blu: '#2a5878', crema: '#e6d8ba', petrolio: '#1f5a66',
}
const LIBRI = ['#8c2f2a', '#2f5d7a', '#d9c7a0', '#3d6b47', '#b9772e', '#4a3a6b', '#c9c2b6', '#6b2d3a', '#2d2d33']
const caso = seme => () => (seme = (seme * 16807) % 2147483647) / 2147483647

// Le stanze: rettangolo, pavimento, e da dove le guarda la telecamera quando si sceglie la scheda.
export const STANZE = {
  riunioni: { nome: 'Sala riunioni', r: [0, 0, 12, 9], pav: 'spina' },
  direzione: { nome: 'Direzione', r: [12, 0, 22, 9], pav: 'moquette' },
  archivio: { nome: 'Archivio', r: [22, 0, 27, 9], pav: 'piastrelle' },
  giochi: { nome: 'Sala giochi', r: [27, 0, 38, 9], pav: 'assi' },
  corridoio: { nome: 'Corridoio', r: [0, 9, 11, 12], pav: 'assi' },
  cucina: { nome: 'Cucina', r: [0, 12, 11, 21], pav: 'piastrelle' },
  reception: { nome: 'Reception', r: [0, 21, 11, 30], pav: 'spina' },
  relax: { nome: 'Relax', r: [11, 9, 27, 30], pav: 'assi' },
  postazioni: { nome: 'Postazioni', r: [27, 9, 46, 30], pav: 'moquette' },
}

function muro(k, asse, fisso, da, a, { colore = C.muro, aperture = [], porte = [] } = {}) {
  const T = (u1, u2, y, h, col, s = 'solido', spess = SP, fuori = 0) => {
    if (u2 - u1 < 0.01) return
    if (asse === 'x') k.box(col, u2 - u1, h, spess, (u1 + u2) / 2, y, fisso + fuori, { s })
    else k.box(col, spess, h, u2 - u1, fisso + fuori, y, (u1 + u2) / 2, { s })
  }
  const U = (u1, u2) => { if (u2 - u1 < 0.01) return; if (asse === 'x') k.urto(u2 - u1, SP, (u1 + u2) / 2, fisso); else k.urto(SP, u2 - u1, fisso, (u1 + u2) / 2) }
  let cur = da
  for (const ap of [...aperture].sort((p, q) => p.da - q.da)) {
    T(cur, ap.da, 0, H, colore); U(cur, ap.da)
    const u1 = ap.da, u2 = ap.a
    if (ap.tipo === 'porta' || ap.tipo === 'varco') {
      T(u1, u2, 2.3, H - 2.3, colore)
      T(u1 - .05, u1 + .05, 0, 2.3, C.bordo, 'solido', SP + .06); T(u2 - .05, u2 + .05, 0, 2.3, C.bordo, 'solido', SP + .06); T(u1, u2, 2.26, .08, C.bordo, 'solido', SP + .06)
      if (ap.tipo === 'porta') porte.push({ asse, fisso, da: u1, a: u2 })
    } else if (ap.tipo === 'vetro') {
      T(u1, u2, 0, .14, C.bordo, 'solido', SP); T(u1, u2, .14, 2.46, '#b9d6d2', 'vetro', .04); T(u1, u2, 2.6, H - 2.6, colore); T(u1, u2, 2.56, .08, C.bordo, 'solido', SP + .04)
      const n = Math.max(1, Math.round((u2 - u1) / 1.25))
      for (let i = 0; i <= n; i++) { const u = u1 + (u2 - u1) * i / n; T(u - .035, u + .035, .14, 2.46, C.bordo, 'solido', SP - .04) }
      if (ap.tende) for (let y = .5; y < 2.5; y += .125) T(u1 + .05, u2 - .05, y, .018, '#cdbfa3', 'solido', .11, (ap.lato || 1) * .1)
      U(u1, u2)
    } else { // finestra sul fuori
      T(u1, u2, 0, .9, colore); T(u1, u2, .9, 1.5, '#9db9c9', 'vetro', .04); T(u1, u2, 2.4, H - 2.4, colore)
      T(u1, u2, .86, .08, C.bordo, 'solido', SP + .08); T(u1, u2, 2.36, .08, C.bordo, 'solido', SP + .04)
      const n = Math.max(1, Math.round((u2 - u1) / 1.5))
      for (let i = 0; i <= n; i++) { const u = u1 + (u2 - u1) * i / n; T(u - .035, u + .035, .9, 1.5, C.bordo, 'solido', SP - .04) }
      if (ap.tende) for (let y = 1.0; y < 2.36; y += .125) T(u1 + .05, u2 - .05, y, .018, '#cdbfa3', 'solido', .11, (ap.lato || 1) * .1)
      U(u1, u2)
    }
    cur = u2
  }
  T(cur, a, 0, H, colore); U(cur, a)
  T(da - SP / 2, a + SP / 2, H, .07, C.bordo, 'solido', SP + .08)
}

// ——— Mobili (origine a terra al centro, il davanti guarda +z) ———
function sedia(k, col = '#24242a', ruote = true) {
  if (ruote) { k.cil(C.nero, .27, .3, .05, 0, 0, 0, { seg: 5 }); k.cil('#55555c', .03, .03, .36, 0, .05, 0, { seg: 5 }) }
  else for (const [x, z] of [[-.19, -.19], [.19, -.19], [-.19, .19], [.19, .19]]) k.box(C.legnoScuro, .04, .42, .04, x, 0, z)
  k.box(col, .46, .08, .46, 0, .42, 0); k.box(col, .44, .52, .07, 0, .52, -.22); k.box(C.nero, .05, .14, .05, 0, .44, -.22)
}
function monitor(k, x, z, largo = .62) {
  k.box(C.nero, .22, .02, .15, x, .77, z + .02); k.box(C.nero, .04, .16, .03, x, .79, z); k.box(C.nero, largo, .38, .04, x, .93, z)
}
function pianta(k, r, grande = true) {
  const h = grande ? 1 : .55
  k.cil(C.vaso, .2 * h + .06, .15 * h + .04, .36 * h + .05, 0, 0, 0, { seg: 7 })
  const n = grande ? 9 : 6
  for (let i = 0; i < n; i++) { const a = i / n * Math.PI * 2 + r(), ap = .35 + r() * .5, l = (.55 + r() * .5) * h; k.con(0, .36 * h, 0, a, () => k.cono(i % 2 ? C.foglia : C.fogliaScura, .11 * h + .03, l, 0, 0, 0, { seg: 4, rx: ap, sz: .35 })) }
}
function lampada(k, x, z, y = H, { r = .32, filo = .9, col = '#c9a06a' } = {}) { // lampada a sospensione
  k.cil(C.nero, .01, .01, filo, x, y - filo, z, { seg: 4 }); k.cono(col, r, r * .9, x, y - filo - r * .9, z, { seg: 6 }); k.ico('#fff1c9', r * .32, x, y - filo - r * .86, z, { s: 'luce' })
}
function libreria(k, r, larga = 2, alta = 2.2) {
  k.box(C.legnoChiaro, larga, alta, .04, 0, 0, -.16); k.box(C.legnoChiaro, .05, alta, .36, -larga / 2, 0, 0); k.box(C.legnoChiaro, .05, alta, .36, larga / 2, 0, 0)
  const colonne = Math.max(2, Math.round(larga / .55))
  for (let i = 1; i < colonne; i++) k.box(C.legnoChiaro, .04, alta, .34, -larga / 2 + larga * i / colonne, 0, 0)
  for (let y = 0; y <= alta + .01; y += alta / 5) {
    k.box(C.legnoChiaro, larga, .04, .36, 0, Math.min(y, alta - .04), 0)
    if (y > alta - .2) break
    for (let i = 0; i < colonne; i++) {
      const x0 = -larga / 2 + larga * i / colonne + .05, cella = larga / colonne - .1, tipo = r()
      if (tipo < .55) { let x = x0; while (x < x0 + cella * (.5 + r() * .5) - .05) { const w = .035 + r() * .03, hh = .22 + r() * .12; k.box(LIBRI[r() * LIBRI.length | 0], w, hh, .22, x + w / 2, y + .04, 0); x += w + .004 } }
      else if (tipo < .8) for (let j = 0; j < 3 + r() * 3; j++) k.box(LIBRI[r() * LIBRI.length | 0], .26, .035, .2, x0 + cella / 2, y + .04 + j * .037, 0, { ry: (r() - .5) * .3 })
      else if (tipo < .9) k.box('#b08a5a', .3, .2, .24, x0 + cella / 2, y + .04, 0)
    }
  }
  k.urto(larga, .4)
}
function cubicolo(k, r, acceso) {
  k.box(C.piano, 1.72, .05, .8, 0, .72, 0); k.box(C.grigioScuro, .42, .62, .7, .6, .1, 0); k.box(C.grigioScuro, .05, .72, .7, -.82, 0, 0)
  k.box(C.teal, 1.8, 1.32, .06, 0, .08, -.43); k.box(C.crema, 1.82, .04, .09, 0, 1.4, -.43); k.box(C.crema, .07, 1.4, .07, -.9, 0, -.43)
  k.box(C.teal, .06, 1.32, .92, -.9, .08, .02); k.box(C.crema, .09, .04, .94, -.9, 1.4, .02)
  monitor(k, 0, -.2); k.box(C.nero, .42, .02, .14, 0, .77, .14); k.box(C.nero, .06, .025, .1, .34, .77, .14)
  if (r() < .5) { k.con(-.55, 0, -.16, .35, () => monitor(k, 0, 0, .5)); if (r() < .7) k.box(['#b56cff', '#5fd0ff', '#7ef0a0'][r() * 3 | 0], .44, .26, .01, -.55 + .008, 0.99, -.137, { s: 'luce', ry: .35 }) }
  if (r() < .7) k.cil(['#e8e4da', '#d0582a', '#2f5d7a'][r() * 3 | 0], .04, .035, .1, .55 + r() * .15, .77, -.1 + r() * .3, { seg: 6 })
  if (r() < .6) k.box('#f2efe6', .21, .012, .3, -.45 + r() * .2, .77, .15, { ry: r() - .5 })
  for (let i = 0; i < 3; i++) if (r() < .6) k.box(['#f0a030', '#f6d24a', '#ff7a4a'][r() * 3 | 0], .1, .1, .01, -.6 + r() * 1.2, .9 + r() * .35, -.395)
  if (r() < .3) k.con(.62, .77, -.2, 0, () => { k.cil(C.vaso, .06, .05, .09, 0, 0, 0, { seg: 6 }); k.cono(C.foglia, .09, .22, 0, .08, 0, { seg: 5 }) })
  k.con(0, 0, .78, Math.PI, () => sedia(k))
  k.urto(1.8, .9, 0, -.02)
  if (acceso === 'fisso') k.box(r() < .5 ? '#69c2ff' : '#8de7c0', .56, .32, .01, 0, .96, -.178, { s: 'luce' })
  return { pos: k.punto(0, 0, .78), giro: k.giro + Math.PI, schermo: { pos: k.punto(0, 1.12, -.176), giro: k.giro } }
}
function biliardo(k, tappeto) {
  k.box(tappeto, 4, .02, 2.8, 0, .004, 0); k.box(C.legnoScuro, 2.5, .34, 1.35, 0, .42, 0)
  for (const [x, z] of [[-1.1, -.55], [1.1, -.55], [-1.1, .55], [1.1, .55]]) k.box(C.legnoScuro, .16, .42, .16, x, 0, z)
  k.box(C.verdeTavolo, 2.3, .04, 1.14, 0, .76, 0)
  k.box(C.legno, 2.56, .09, .12, 0, .76, -.63); k.box(C.legno, 2.56, .09, .12, 0, .76, .63); k.box(C.legno, .12, .09, 1.38, -1.22, .76, 0); k.box(C.legno, .12, .09, 1.38, 1.22, .76, 0)
  const palle = ['#f4f0e6', '#d6362c', '#e6b422', '#2456a6', '#1c1c1c', '#7a2a8a', '#e07020', '#2f8a4a']
  palle.forEach((c, i) => k.ico(c, .035, -.9 + (i * .37) % 1.9, .835, -.4 + (i * .29) % .8, { det: 1 }))
  k.box('#c79a5a', 1.3, .02, .02, .2, .81, .3, { ry: .5 })
  k.urto(2.56, 1.4)
  return [[0, 1.15, Math.PI], [0, -1.15, 0], [1.75, 0, -Math.PI / 2], [-1.75, 0, Math.PI / 2]].map(([x, z, g]) => ({ pos: k.punto(x, 0, z), giro: k.giro + g, anim: 'gioca' }))
}
function calcetto(k) {
  k.box('#6b3a22', 1.4, .28, .78, 0, .62, 0); k.box('#2f8a4a', 1.28, .02, .66, 0, .86, 0)
  for (const [x, z] of [[-.6, -.3], [.6, -.3], [-.6, .3], [.6, .3]]) k.box('#3a2416', .08, .64, .08, x, 0, z)
  for (let i = 0; i < 6; i++) { const x = -.52 + i * .21; k.cil('#b9b9bd', .012, .012, 1.1, x, .93, 0, { seg: 4, rx: Math.PI / 2 }); for (let j = -1; j <= 1; j++) k.box(i % 2 ? '#c93a2c' : '#2c5ac9', .04, .1, .03, x, .86, j * .2) }
  k.urto(1.4, .8)
  return [[0, .75, Math.PI], [0, -.75, 0]].map(([x, z, g]) => ({ pos: k.punto(x, 0, z), giro: k.giro + g, anim: 'gioca' }))
}
function pouf(k, col) { k.ico(col, .46, 0, .27, 0, { det: 1, sy: .62 }); k.ico(col, .3, 0, .5, -.16, { det: 1, sy: .7 }); k.urto(.7, .7) }
function divano(k, col, w = 2.2) {
  k.box(col, w, .34, .86, 0, .08, 0); k.box(col, w, .5, .2, 0, .4, -.33); k.box(col, .2, .5, .86, -w / 2 + .1, .1, 0); k.box(col, .2, .5, .86, w / 2 - .1, .1, 0)
  const n = Math.round((w - .4) / .7), posti = []
  for (let i = 0; i < n; i++) { const x = -(n - 1) * .35 + i * .7; k.box('#3b3b42', .62, .1, .56, x, .42, .1); k.box('#3b3b42', .5, .3, .12, x, .5, -.2, { rx: -.2 }); posti.push({ pos: k.punto(x, 0, .12), giro: k.giro, anim: 'seduto', arrivo: k.punto(x, 0, .95), alto: .46 }) }
  k.urto(w, .9)
  return posti
}
function tavolino(k) { k.box(C.legnoScuro, 1.1, .05, .6, 0, .38, 0); for (const [x, z] of [[-.48, -.24], [.48, -.24], [-.48, .24], [.48, .24]]) k.box(C.nero, .04, .38, .04, x, 0, z); k.box('#e8e4da', .3, .02, .22, .15, .43, 0, { ry: .3 }); k.urto(1.1, .6) }
function cabinato(k) { k.box('#2a2440', .7, 1.75, .75, 0, 0, 0); k.box('#e03a6a', .72, .22, .1, 0, 1.55, .35); k.box('#58d0ff', .52, .42, .02, 0, 1.02, .385, { s: 'luce', rx: -.25 }); k.box('#3a3358', .7, .12, .3, 0, .82, .45); k.ico('#e03a3a', .035, -.15, .97, .47); k.ico('#f0c030', .03, .12, .95, .5); k.urto(.75, .8) }
function boccione(k) { k.box('#d8d4cc', .34, 1.0, .34, 0, 0, 0); k.cil('#7fb8d8', .14, .14, .36, 0, 1.0, 0, { seg: 8, s: 'vetro' }); k.cil('#5f98b8', .15, .15, .04, 0, 1.36, 0, { seg: 8 }); k.box('#2a5a9a', .05, .05, .04, -.07, .72, .18); k.box('#b3261e', .05, .05, .04, .07, .72, .18); k.urto(.4, .4) }
function distributore(k) { k.box('#26262c', .95, 1.9, .8, 0, 0, 0); k.box('#f0e6c0', .6, 1.3, .02, -.12, .45, .405, { s: 'luce' }); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) k.box(['#d6362c', '#2f8a4a', '#e6b422', '#2456a6'][(i + j) % 4], .09, .16, .03, -.33 + j * .14, .55 + i * .3, .42); k.box('#1a1a1e', .2, .5, .02, .34, .9, .405); k.urto(.95, .8) }
function fotocopiatrice(k) { k.box('#d9d6cf', .9, .95, .7, 0, 0, 0); k.box('#2a2c40', .86, .12, .66, 0, .95, 0); k.box('#e9e6df', .5, .05, .5, -.1, 1.07, 0, { rz: .06 }); k.box('#bdbab2', .5, .04, .4, .68, .55, 0, { rz: -.25 }); k.box('#7fe0a0', .12, .06, .01, .28, 1.0, .336, { s: 'luce' }); k.urto(.95, .75) }
function scatole(k, r, n = 3) { for (let i = 0; i < n; i++) k.box(i % 2 ? '#b8894f' : '#a67a42', .5, .36, .4, (r() - .5) * .5, i < 2 ? 0 : .36, (r() - .5) * .5 + (i === 1 ? .45 : 0), { ry: r() - .5 }); k.urto(.8, .9) }
function albero(k, r) {
  const h = 3.4 + r() * 3.2
  if (r() < .62) { k.cil('#3a2616', .13, .2, h * .32, 0, 0, 0, { seg: 5 }); for (let i = 0; i < 3; i++) k.cono(i % 2 ? '#1f4a2a' : '#245632', (1.5 - i * .34) * (h / 5), h * .42, 0, h * (.22 + i * .2), 0, { seg: 6, ry: r() * 3 }) }
  else { k.cil('#3a2616', .12, .18, h * .45, 0, 0, 0, { seg: 5 }); k.ico('#2a5e30', h * .28, 0, h * .6, 0, { det: 1, sy: .9 }); k.ico('#234f2a', h * .2, h * .12, h * .72, .2, { det: 0 }) }
}
function lampione(k, luci) { k.cil('#1e1e22', .05, .07, 3.6, 0, 0, 0, { seg: 6 }); k.box('#1e1e22', .5, .06, .16, .2, 3.56, 0); k.box('#fff0c4', .3, .04, .12, .28, 3.52, 0, { s: 'luce' }); const p = k.punto(.3, 3.3, 0); luci.push({ x: p.x, y: p.y, z: p.z, colore: 0xffd9a0, forza: 26, raggio: 13 }) }

// ——— Costruzione ———
export function costruisciEdificio({ cliente = 'Squadra', scrivanieVive = 12 } = {}) {
  const k = new Cantiere(), r = caso(20261113)
  const porte = [], luci = [], cartelli = [], schermi = []
  const posti = { scrivanie: [], direttore: null, reception: null, guardia: null, giocatore: null }
  const poi = { caffe: [], biliardo: [], calcetto: [], divano: [], pingpong: [], acqua: [], riunione: [], chiacchiera: [], cabinato: [] }
  const gruppo = new THREE.Group()

  // pavimenti (uno per stanza, con la sua trama) e prato
  const piano = (x1, z1, x2, z2, t, y = 0, opz = {}) => { const m = new THREE.Mesh(new THREE.PlaneGeometry(x2 - x1, z2 - z1), new THREE.MeshStandardMaterial({ map: t, roughness: .92, ...opz })); m.rotation.x = -Math.PI / 2; m.position.set((x1 + x2) / 2, y, (z1 + z2) / 2); m.receiveShadow = true; gruppo.add(m); return m }
  for (const s of Object.values(STANZE)) { const [x1, z1, x2, z2] = s.r; piano(x1, z1, x2, z2, TRAME[s.pav](x2 - x1, z2 - z1)) }
  piano(21, 24, 27, 30, TRAME.scacchi(6, 6), .006)
  piano(-60, -50, 106, 80, TRAME.prato(166, 130), -.03)
  piano(-3, 30.1, 49, 33.2, TRAME.cemento(52, 3.1), -.01); piano(46.1, 6, 49, 30.1, TRAME.cemento(2.9, 24.1), -.01); piano(3.6, 33.2, 7.4, 50, TRAME.cemento(3.8, 16.8), -.01)
  piano(50.5, 4, 62, 34, TRAME.cemento(11.5, 30), -.012, { color: '#55555a' })
  for (let i = 0; i < 6; i++) k.box('#cfcfc8', .1, .012, 4.4, 52 + i * 1.9, 0, 12)

  // ——— Muri: perimetro ———
  const o = (extra = {}) => ({ porte, ...extra })
  muro(k, 'x', 0, 0, 38, o({ aperture: [{ da: 2, a: 5 }, { da: 7, a: 10 }, { da: 14, a: 17, tende: true }, { da: 29, a: 32 }, { da: 33.5, a: 36.5 }] }))
  muro(k, 'z', 38, 0, 9, o({ aperture: [{ da: 3, a: 6 }] }))
  muro(k, 'x', 9, 38, 46, o({ colore: C.muroOpen, aperture: [{ da: 40, a: 44.5, tende: true }] }))
  muro(k, 'z', 46, 9, 30, o({ colore: C.muroOpen, aperture: [{ da: 11.5, a: 15.5, tende: true, lato: -1 }, { da: 18, a: 22, tende: true, lato: -1 }, { da: 24.5, a: 28.5, tende: true, lato: -1 }] }))
  muro(k, 'x', 30, 0, 46, o({ aperture: [{ da: 1, a: 3.6, tipo: 'vetro' }, { da: 4.3, a: 6.7, tipo: 'porta' }, { da: 7.4, a: 10.2, tipo: 'vetro' }, { da: 13, a: 19.5, lato: -1 }, { da: 30, a: 34.5, tende: true, lato: -1 }, { da: 37, a: 41.5, tende: true, lato: -1 }] }))
  muro(k, 'z', 0, 0, 30, o({ aperture: [{ da: 2, a: 7 }, { da: 14, a: 19 }, { da: 23, a: 28 }] }))
  // ——— Muri interni ———
  muro(k, 'z', 12, 0, 9, o()); muro(k, 'z', 22, 0, 9, o({ colore: C.muroScuro })); muro(k, 'z', 27, 0, 9, o())
  muro(k, 'x', 9, 0, 12, o({ aperture: [{ da: .8, a: 4.6, tipo: 'vetro', tende: true, lato: -1 }, { da: 5.2, a: 6.8, tipo: 'porta' }, { da: 7.4, a: 11.4, tipo: 'vetro', tende: true, lato: -1 }] }))
  muro(k, 'x', 9, 12, 22, o({ colore: C.muroScuro, aperture: [{ da: 12.8, a: 16.2, tipo: 'vetro', tende: true, lato: -1 }, { da: 17, a: 18.6, tipo: 'porta' }, { da: 19.3, a: 21.4, tipo: 'vetro', tende: true, lato: -1 }] }))
  muro(k, 'x', 9, 22, 27, o({ aperture: [{ da: 23.7, a: 25.3, tipo: 'porta' }] }))
  muro(k, 'x', 9, 27, 38, o({ colore: C.muroOpen, aperture: [{ da: 28, a: 29.6, tipo: 'porta' }] }))
  muro(k, 'x', 12, 0, 11, o({ aperture: [{ da: 1, a: 5.6, tipo: 'vetro' }, { da: 7, a: 8.8, tipo: 'porta' }] }))
  muro(k, 'z', 11, 12, 21, o({ aperture: [{ da: 12.5, a: 14.7, tipo: 'vetro', tende: true }, { da: 15.3, a: 17.3, tipo: 'porta' }, { da: 17.9, a: 20.5, tipo: 'vetro', tende: true }] }))
  muro(k, 'x', 21, 0, 11, o({ colore: C.legnoScuro }))
  muro(k, 'z', 11, 21, 30, o({ aperture: [{ da: 21.5, a: 23.6, tipo: 'vetro' }, { da: 24.2, a: 26.2, tipo: 'porta' }, { da: 26.8, a: 29.5, tipo: 'vetro' }] }))
  muro(k, 'z', 27, 9, 30, o({ colore: C.muroOpen, aperture: [{ da: 9.6, a: 12.4, tipo: 'vetro' }, { da: 13, a: 15, tipo: 'porta' }, { da: 15.6, a: 20.4, tipo: 'vetro' }] }))
  muro(k, 'x', 24, 21, 27, o({ aperture: [{ da: 21.8, a: 23, tipo: 'porta' }, { da: 24.9, a: 26.1, tipo: 'porta' }] }))
  muro(k, 'z', 21, 24, 30, o()); muro(k, 'z', 24, 24, 30, o())

  // soffitto (si vede solo quando si entra a piedi) con le plafoniere
  k.box('#33261f', 38, .12, 9, 19, H + .06, 4.5, { s: 'soffitto' }); k.box('#33261f', 46, .12, 21, 23, H + .06, 19.5, { s: 'soffitto' })
  const plafoniera = (x, z, w = 1.2, d = .6) => { k.box('#231a15', w + .12, .06, d + .12, x, H - .03, z, { s: 'soffitto' }); k.box('#fff0d0', w, .02, d, x, H - .05, z, { s: 'soffittoLuce' }) }
  const ventola = (x, z) => { k.cil('#2a201b', .06, .06, .3, x, H - .3, z, { s: 'soffitto', seg: 6 }); for (let i = 0; i < 4; i++) k.box('#e9e2d2', 1.3, .02, .22, x, H - .32, z, { s: 'soffitto', ry: i * Math.PI / 4 * 2 + .4 }) }
  const luce = (x, z, forza = 30, raggio = 13, colore = 0xffd2a6, y = 2.7) => luci.push({ x, y, z, colore, forza, raggio })

  // ——— Reception ———
  for (let x = .5; x < 10.9; x += .17) k.box(x * 10 % 3 < 1.5 ? C.legnoScuro : '#5a3924', .09, H - .1, .07, x, 0, 21.16)
  const ins = cartello((g, w, h) => { g.clearRect(0, 0, w, h); g.fillStyle = '#fff'; g.textAlign = 'center'; g.font = `800 ${h * .36}px "Avenir Next","Helvetica Neue",Arial`; g.fillText(`SQUADRA ${cliente}`.toUpperCase(), w / 2, h * .5, w * .96); g.font = `600 ${h * .16}px "Avenir Next","Helvetica Neue",Arial`; g.fillText('A I   T E A M   ·   S E M P R E   A T T I V A', w / 2, h * .84, w * .9) }, 4.6, 1.0)
  ins.position.set(5.5, 2.3, 21.24); cartelli.push(ins)
  k.con(5.5, 0, 23.3, 0, () => {
    k.box(C.legno, 3.4, 1.06, .16, 0, 0, .3); k.box(C.legnoScuro, 3.5, .06, .9, 0, 1.06, 0); k.box(C.legno, .16, 1.06, .8, -1.62, 0, -.1); k.box(C.legno, .16, 1.06, .8, 1.62, 0, -.1); k.box(C.piano, 3.1, .05, .6, 0, .74, -.2)
    monitor(k, .3, -.25); k.cil('#e9e4da', .07, .05, .26, -1.25, 1.12, .05, { seg: 7 }); for (let i = 0; i < 5; i++) k.ico('#c0262c', .05, -1.25 + (i - 2) * .05, 1.5 + (i % 2) * .08, .05 + (i % 3 - 1) * .04)
    k.cil('#3e7a3a', .012, .012, .22, -1.25, 1.3, .05, { seg: 4 }); k.cil('#c9b28a', .07, .07, .2, .95, 1.12, 0, { seg: 7 }); k.box('#2a2a30', .3, .16, .2, 1.3, 1.12, -.05)
    k.urto(3.5, 1)
    posti.reception = { pos: k.punto(0, 0, -.75), giro: k.giro, anim: 'fermo' }
  })
  const targa = cartello((g, w, h) => { g.fillStyle = '#5a2f1c'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0e2c8'; g.textAlign = 'center'; g.font = `800 ${h * .56}px Arial`; g.fillText('RECEPTION', w / 2, h * .7) }, .9, .2, { px: 64 })
  targa.position.set(4.4, .78, 23.69); cartelli.push(targa)
  for (const x of [4.5, 6.5]) k.con(x, 0, 25.6, Math.PI, () => { sedia(k, '#4a1c20'); k.urto(.5, .5) })
  k.con(.85, 0, 26, Math.PI / 2, () => poi.divano.push(...divano(k, '#8c8478', 2.4)))
  k.con(2.2, 0, 26, 0, () => tavolino(k))
  k.con(10.2, 0, 29, 0, () => pianta(k, r)); k.con(.8, 0, 22, 0, () => pianta(k, r)); k.con(10.2, 0, 22.2, 0, () => pianta(k, r, false))
  k.box(C.rossoScuro, 2.2, .02, 1.4, 5.5, .004, 28.9)
  lampada(k, 4.3, 22.9, H, { r: .22, filo: 1.1, col: '#2a2a2e' }); lampada(k, 6.7, 22.9, H, { r: .22, filo: 1.1, col: '#2a2a2e' })
  luce(5.5, 25.5, 34); plafoniera(3, 27); plafoniera(8, 27)
  posti.guardia = { pos: new THREE.Vector3(8.6, 0, 28.6), giro: -2.4, anim: 'fermo' }
  posti.giocatore = { pos: new THREE.Vector3(5.5, 0, 28.2), giro: Math.PI }

  // ——— Sala riunioni ———
  k.con(6, 0, 4.7, 0, () => {
    k.box(C.arancio, 5.6, .02, 3.4, 0, .004, 0); k.box('#b96a1c', 5.9, .015, 3.7, 0, .002, 0)
    k.box('#5e3a22', 3.8, .07, 1.4, 0, .72, 0); k.box('#3c2415', .5, .72, .9, -1.2, 0, 0); k.box('#3c2415', .5, .72, .9, 1.2, 0, 0)
    for (let i = 0; i < 3; i++) for (const lato of [-1, 1]) { const x = -1.2 + i * 1.2; k.con(x, 0, lato * 1.1, lato > 0 ? Math.PI : 0, () => { sedia(k); poi.riunione.push({ pos: k.punto(0, 0, 0), giro: k.giro, anim: 'seduto' }) }); k.box('#2c2c32', .34, .02, .24, x, .79, lato * .4); if ((i + lato) % 2) k.box('#f2efe6', .2, .012, .28, x + .4, .79, lato * .4, { ry: .3 }) }
    for (const lato of [-1, 1]) k.con(lato * 2.3, 0, 0, lato > 0 ? -Math.PI / 2 : Math.PI / 2, () => { sedia(k); poi.riunione.push({ pos: k.punto(0, 0, 0), giro: k.giro, anim: 'seduto' }) })
    k.urto(3.8, 1.4)
  })
  k.box(C.nero, 2.6, 1.4, .08, 6, 1.2, .18); k.box('#16304a', 2.44, 1.26, .02, 6, 1.27, .23, { s: 'luce' }); for (let i = 0; i < 4; i++) k.box('#4f9fe0', .9 - i * .15, .06, .01, 5.3, 2.2 - i * .16, .245, { s: 'luce' })
  k.con(1, 0, 1, 0, () => pianta(k, r)); k.con(11, 0, 8, 0, () => pianta(k, r)); k.con(11.2, 0, 1, 0, () => pianta(k, r, false))
  k.con(1.2, 0, 6, Math.PI / 2, () => { k.box(C.legnoScuro, 1.8, .8, .45, 0, 0, 0); k.cil('#e8e4da', .05, .04, .12, -.4, .8, 0, { seg: 6 }); k.box('#2a2a30', .3, .2, .25, .4, .8, 0); k.urto(1.8, .5) })
  lampada(k, 4.8, 4.7, H, { filo: 1.0 }); lampada(k, 7.2, 4.7, H, { filo: 1.0 }); luce(6, 4.7, 36); plafoniera(3, 2.2); plafoniera(9, 2.2)

  // ——— Direzione ———
  k.con(17, 0, 3.6, 0, () => {
    k.box('#4a2a1a', 2.4, .08, 1.05, 0, .72, 0); k.box('#3a2014', 2.2, .72, .08, 0, 0, .44); k.box('#3a2014', .5, .72, .9, -.9, 0, 0); k.box('#3a2014', .5, .72, .9, .9, 0, 0)
    monitor(k, .35, .1); k.box(C.nero, .42, .02, .14, .35, .8, -.2)
    k.cil(C.oro, .09, .12, .06, -.75, .8, .2, { seg: 6 }); k.cil(C.oro, .03, .03, .14, -.75, .86, .2, { seg: 6 }); k.cono(C.oro, .13, .22, -.75, 1.0, .2, { seg: 7, rx: Math.PI }); k.box('#5a3a22', .34, .08, .1, -.05, .8, .38); k.box('#f2efe6', .22, .012, .3, -.3, .8, -.1, { ry: .2 })
    k.con(0, 0, -.85, 0, () => sedia(k, '#3a1c1c'))
    posti.direttore = { pos: k.punto(0, 0, -.85), giro: k.giro, schermo: { pos: k.punto(.35, 1.12, .076), giro: k.giro + Math.PI } }
    for (const x of [-.6, .6]) k.con(x, 0, 1.45, Math.PI, () => { sedia(k, '#e6dfd0', false); poi.chiacchiera.push({ pos: k.punto(0, 0, 0), giro: k.giro, anim: 'seduto' }) })
    k.urto(2.4, 1.1)
  })
  k.con(15.5, 0, .45, 0, () => libreria(k, r, 2.6, 2.3)); k.con(19.4, 0, .45, 0, () => libreria(k, r, 2.2, 2.3)); k.con(21.55, 0, 5.4, -Math.PI / 2, () => libreria(k, r, 2.6, 2.3))
  k.con(20.9, 0, 1.2, 0, () => { k.cil('#2a2a2e', .04, .18, .5, 0, 0, 0, { seg: 6 }); k.ico('#3d7a8a', .26, 0, .78, 0, { det: 1 }); k.ico('#c9a84a', .262, 0, .78, 0, { det: 0, sx: .6, sz: .6 }) })
  k.con(13.3, 0, 6.6, .9, () => { for (const [x, rz] of [[-.4, .12], [.4, -.12]]) k.box('#6b4a2c', .04, 1.7, .04, x, 0, 0, { rz }); k.box('#6b4a2c', .04, 1.5, .04, 0, 0, -.5, { rx: .3 }); k.box('#f4f0e4', 1.0, .8, .03, 0, .85, .04); k.urto(.9, .7) })
  const grafico = cartello((g, w, h) => { g.fillStyle = '#f4f0e4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#b3261e'; g.lineWidth = 5; g.beginPath(); g.moveTo(w * .14, h * .12); g.lineTo(w * .14, h * .8); g.lineTo(w * .9, h * .8); g.stroke(); g.beginPath(); [[.16, .3], [.3, .42], [.42, .36], [.54, .58], [.68, .52], [.84, .74]].forEach(([x, y], i) => i ? g.lineTo(w * x, h * y) : g.moveTo(w * x, h * y)); g.stroke(); g.strokeStyle = '#2f5d7a'; g.setLineDash([10, 8]); g.beginPath(); g.moveTo(w * .2, h * .7); g.lineTo(w * .86, h * .22); g.stroke(); g.fillStyle = '#3a2a1c'; g.font = `800 ${h * .1}px Arial`; g.textAlign = 'center'; g.fillText('MER', w * .5, h * .12); g.fillText('OBIETTIVO SETTIMANA', w * .52, h * .95) }, .96, .76, { luce: false })
  grafico.position.set(13.3 + Math.sin(.9) * .07, 1.25, 6.6 + Math.cos(.9) * .07); grafico.rotation.y = .9; cartelli.push(grafico)
  k.con(20, 0, 7.4, 0, () => { k.box('#2c8a4c', 2.6, .03, 1.1, 0, .004, 0); k.cil('#1a1a1a', .06, .06, .01, 1.0, .035, 0, { seg: 8 }); k.cil('#d8d8d8', .008, .008, .7, 1.0, .03, 0, { seg: 4 }); k.box('#e07020', .18, .12, .01, 1.09, .6, 0); k.ico('#f4f0e6', .03, -.9, .06, .1, { det: 1 }) })
  k.con(13, 0, 1.1, 0, () => pianta(k, r)); k.con(21.2, 0, 8.3, 0, () => pianta(k, r, false))
  for (const x of [12.9, 13.8]) { k.box('#3a2416', .46, .6, .03, x * 0 + 12.14, 1.5 + (x > 13 ? .7 : 0), 4.2); k.box('#efe6cf', .36, .5, .01, 12.16, 1.55 + (x > 13 ? .7 : 0), 4.2) }
  lampada(k, 17, 3.9, H, { r: .5, filo: .7 }); lampada(k, 14, 6.5, H, { r: .34, filo: .8 }); luce(17, 4.4, 30, 12, 0xffc694)

  // ——— Archivio ———
  k.con(22.5, 0, 4, Math.PI / 2, () => libreria(k, r, 5, 2.4)); k.con(26.5, 0, 3, -Math.PI / 2, () => libreria(k, r, 4, 2.4))
  k.con(24.5, 0, .7, 0, () => fotocopiatrice(k)); k.con(26.2, 0, 7.6, 0, () => scatole(k, r, 4)); luce(24.5, 4.5, 16, 9, 0xffd0a0); plafoniera(24.5, 4.5)

  // ——— Sala giochi (ping pong) ———
  k.con(32.5, 0, 4.6, 0, () => {
    k.box('#2a5ea8', 2.74, .05, 1.52, 0, .74, 0); k.box('#f4f0e6', 2.74, .052, .03, 0, .74, 0); k.box('#f4f0e6', .03, .16, 1.6, 0, .79, 0)
    for (const [x, z] of [[-1.1, -.6], [1.1, -.6], [-1.1, .6], [1.1, .6]]) k.box('#26262c', .06, .74, .06, x, 0, z)
    k.urto(2.74, 1.52)
    poi.pingpong.push({ pos: k.punto(-2.0, 0, 0), giro: k.giro + Math.PI / 2, anim: 'gioca' }, { pos: k.punto(2.0, 0, 0), giro: k.giro - Math.PI / 2, anim: 'gioca' })
  })
  k.con(28, 0, 1.2, .5, () => pouf(k, C.arancio)); k.con(29.6, 0, 1, -.3, () => pouf(k, C.rosso)); k.con(37.3, 0, 7.6, -Math.PI / 2, () => { cabinato(k); poi.cabinato.push({ pos: k.punto(0, 0, .85), giro: k.giro + Math.PI, anim: 'gioca' }) })
  k.con(37, 0, 1, 0, () => pianta(k, r)); k.con(36.4, 0, .5, 0, () => { k.box('#2a2a30', 1.6, .9, .4, 0, 0, 0); k.urto(1.6, .4) })
  luce(32.5, 4.6, 34, 13); plafoniera(30, 4.6); plafoniera(35, 4.6); ventola(32.5, 2)

  // ——— Corridoio ———
  k.box(C.rossoScuro, 2.6, .02, 1.3, 3, .004, 10.5); k.box(C.rossoScuro, 2.6, .02, 1.3, 8, .004, 10.5)
  k.con(.7, 0, 10.5, 0, () => pianta(k, r)); luce(5.5, 10.5, 16, 9); plafoniera(3, 10.5); plafoniera(8, 10.5)

  // ——— Cucina ———
  k.con(4.2, 0, 12.45, 0, () => {
    k.box('#e9e2d2', 6.8, .86, .62, 0, 0, 0); k.box('#3a3634', 6.9, .05, .66, 0, .86, 0); k.box('#e9e2d2', 6.8, .7, .36, 0, 1.55, -.13)
    for (let i = 0; i < 9; i++) { k.box('#2a2a2e', .03, .14, .02, -3.2 + i * .78, .5, .32); k.box('#2a2a2e', .03, .14, .02, -3.2 + i * .78, 1.65, .06) }
    k.box('#b9bcc2', .7, .03, .4, -1.2, .9, 0); k.cil('#b9bcc2', .015, .015, .26, -1.2, .92, -.2, { seg: 5 })
    k.box('#2e2e34', .5, .3, .36, .2, .91, 0); k.box('#111', .3, .2, .01, .14, .96, .185)
    k.box('#b3261e', .3, .38, .3, 1.5, .91, 0); k.box('#1c1c20', .22, .1, .2, 1.5, .93, .1); k.cil('#e8e4da', .04, .035, .08, 1.5, .93, .14, { seg: 6 })
    k.box('#d8d4cc', .34, .22, .26, 2.6, .91, 0); for (let i = 0; i < 3; i++) k.cil('#e8e4da', .05, .04, .1, -2.6 + i * .16, .91, .05, { seg: 6 })
    k.urto(6.9, .66)
    poi.caffe.push({ pos: k.punto(1.5, 0, .95), giro: k.giro + Math.PI, anim: 'beve' }, { pos: k.punto(.3, 0, .95), giro: k.giro + Math.PI, anim: 'beve' })
  })
  k.con(8.3, 0, 12.55, 0, () => { k.box('#a3201c', .85, 1.92, .78, 0, 0, 0); k.box('#c9c9cc', .04, .5, .04, -.3, 1.1, .41); k.box('#7a1614', .86, .02, .79, 0, 1.25, 0); k.urto(.85, .8) })
  k.con(9.9, 0, 12.6, 0, () => distributore(k))
  k.con(5.2, 0, 16.8, 0, () => {
    k.box('#3a3634', 2.9, .9, 1.15, 0, 0, 0); k.box('#55504c', 3.05, .05, 1.3, 0, .9, 0)
    k.box('#2a2a2e', .9, .1, .5, .7, .95, .1); for (let i = 0; i < 7; i++) k.ico(['#e6b422', '#e08a2c', '#f0d890'][i % 3], .07, .4 + (i % 4) * .18, 1.1, -.05 + (i % 2) * .22, { det: 1 })
    k.box('#c9c9cc', .34, .26, .3, -.9, .95, .15); k.cil('#f4f0e6', .13, .09, .08, -.2, .95, -.25, { seg: 8 }); k.cil('#3e7a3a', .012, .012, .34, .1, .95, .35, { seg: 4 }); k.ico('#f4f0e6', .05, .1, 1.32, .35)
    k.box('#c8a06c', .34, .02, .24, -.5, .95, .35, { ry: .4 }); k.box('#2f8a4a', .2, .1, .2, 1.25, .95, -.3)
    for (const x of [-1, -.33, .33, 1]) k.con(x, 0, 1.05, 0, () => { k.cil('#b9b9bd', .025, .025, .62, 0, 0, 0, { seg: 5 }); k.cil('#2a2a2e', .2, .22, .03, 0, 0, 0, { seg: 8 }); k.cil('#f0ece2', .2, .12, .14, 0, .62, 0, { seg: 8 }) })
    k.urto(3.05, 1.3)
    poi.caffe.push({ pos: k.punto(-1.9, 0, 0), giro: k.giro + Math.PI / 2, anim: 'parla' }, { pos: k.punto(1.95, 0, .2), giro: k.giro - Math.PI / 2, anim: 'beve' }, { pos: k.punto(0, 0, -1.05), giro: k.giro, anim: 'parla' })
  })
  k.con(10.4, 0, 20.3, 0, () => { boccione(k); poi.acqua.push({ pos: k.punto(-.7, 0, 0), giro: k.giro + Math.PI / 2, anim: 'beve' }) })
  k.con(.7, 0, 20.2, 0, () => pianta(k, r)); k.con(1.4, 0, 20.4, 0, () => { k.box('#2a2a2e', .4, .5, .4, 0, 0, 0); k.urto(.4, .4) })
  for (let i = 0; i < 3; i++) { k.box('#c8a06c', .9, .04, .22, .28, 1.5 + i * .4, 16.5 - i * 0); for (let j = 0; j < 3; j++) k.cil(['#e8e4da', '#b3261e', '#2f5d7a'][(i + j) % 3], .05, .05, .14, .28, 1.54 + i * .4, 16.2 + j * .3, { seg: 6 }) }
  const cuc = cartello((g, w, h) => { g.fillStyle = '#2a201b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0e2c8'; g.textAlign = 'center'; g.font = `800 ${h * .6}px Arial`; g.fillText('CUCINA', w / 2, h * .72) }, 1.1, .3, { px: 64 })
  cuc.position.set(11.14, 2.65, 16.3); cuc.rotation.y = Math.PI / 2; cartelli.push(cuc)
  lampada(k, 4.4, 16.8, H, { r: .3, filo: .85, col: '#2a2a2e' }); lampada(k, 6, 16.8, H, { r: .3, filo: .85, col: '#2a2a2e' }); luce(5.2, 16.6, 38, 13, 0xffdcba); plafoniera(2.5, 14.5); plafoniera(8.5, 19)

  // ——— Relax ———
  k.con(17.5, 0, 13.6, 0, () => poi.biliardo.push(...biliardo(k, C.petrolio)))
  k.con(22, 0, 20, 0, () => poi.biliardo.push(...biliardo(k, C.arancio)))
  k.con(14, 0, 19.6, Math.PI / 2, () => poi.calcetto.push(...calcetto(k)))
  k.con(24.6, 0, 11.2, .4, () => pouf(k, C.arancio)); k.con(13, 0, 24.2, -.5, () => pouf(k, C.rosso)); k.con(25.6, 0, 16.6, 1, () => pouf(k, '#2f5d7a'))
  k.con(11.75, 0, 13.4, Math.PI / 2, () => { cabinato(k); poi.cabinato.push({ pos: k.punto(0, 0, .85), giro: k.giro + Math.PI, anim: 'gioca' }) })
  k.box(C.rossoScuro, 7.4, .02, 4.2, 16.2, .004, 27.4)
  k.con(16.2, 0, 29.35, Math.PI, () => poi.divano.push(...divano(k, '#8c8478', 3)))
  k.con(16.2, 0, 27.7, 0, () => tavolino(k))
  k.con(12.4, 0, 27.2, Math.PI / 2, () => { k.box('#6f685e', .8, .36, .8, 0, .06, 0); k.box('#6f685e', .8, .5, .18, 0, .4, -.31); k.urto(.8, .8); poi.divano.push({ pos: k.punto(0, 0, .08), giro: k.giro, anim: 'seduto', arrivo: k.punto(0, 0, .9), alto: .46 }) })
  k.con(19.6, 0, 26, .3, () => pouf(k, C.rosso)); k.con(20.2, 0, 29.2, 0, () => pianta(k, r)); k.con(11.7, 0, 29.3, 0, () => pianta(k, r))
  k.con(26.4, 0, 22.4, -Math.PI / 2, () => { k.box('#b98a55', 1.8, 1.1, .05, 0, 1.1, 0); k.box('#4a2e1c', 1.9, .06, .07, 0, 2.2, 0); k.box('#4a2e1c', 1.9, .06, .07, 0, 1.06, 0); for (let i = 0; i < 12; i++) k.box(['#f6d24a', '#ff7a4a', '#f2efe6', '#7ec8e3', '#b3261e'][i % 5], .2, .22, .01, -.75 + (i % 6) * .3, 1.25 + (i > 5 ? .5 : 0) + (i % 2) * .08, .032, { rz: (i % 3 - 1) * .08 }) })
  k.con(26.2, 0, 23.4, 0, () => pianta(k, r)); k.con(11.7, 0, 22, 0, () => pianta(k, r)); k.con(26.2, 0, 9.8, 0, () => pianta(k, r)); k.con(11.8, 0, 9.8, 0, () => pianta(k, r, false))
  k.con(20.6, 0, 23.2, 0, () => { k.cil('#2a2a2e', .2, .24, .04, 0, 0, 0, { seg: 8 }); k.cil('#55555c', .02, .02, 1.3, 0, 0, 0, { seg: 5 }); k.cil('#b9b9bd', .26, .26, .06, 0, 1.32, 0, { seg: 10, rx: Math.PI / 2 }) })
  k.con(12, 0, 18, Math.PI / 2, () => libreria(k, r, 1.6, 1.9))
  poi.chiacchiera.push({ pos: new THREE.Vector3(20, 0, 16.6), giro: 2.2, anim: 'parla' }, { pos: new THREE.Vector3(21, 0, 15.6), giro: -1, anim: 'parla' }, { pos: new THREE.Vector3(15, 0, 23), giro: .6, anim: 'parla' }, { pos: new THREE.Vector3(16, 0, 24), giro: -2.4, anim: 'parla' }, { pos: new THREE.Vector3(24.5, 0, 14), giro: 1.6, anim: 'fermo' })
  for (const [x, z] of [[17.5, 13.6], [22, 20]]) { lampada(k, x - .6, z, H, { r: .24, filo: 1.1, col: '#2e5a3a' }); lampada(k, x + .6, z, H, { r: .24, filo: 1.1, col: '#2e5a3a' }) }
  luce(17.5, 13.6, 34); luce(22, 20, 34); luce(15.5, 26.5, 28, 12); luce(14, 19, 14, 9)
  ventola(15, 16.5); ventola(23, 14); ventola(18, 24); plafoniera(13, 11); plafoniera(24, 24.6 - 2); plafoniera(18, 18)
  // bagni
  for (const x0 of [21, 24]) { k.box('#d8d4cc', .5, .4, .6, x0 + 2.5, 0, 29.2); k.box('#ece7dc', .5, .5, .2, x0 + 2.5, .4, 29.5); k.box('#ece7dc', .6, .12, .45, x0 + .6, .78, 29.5); k.box('#9fb8c4', .5, .6, .02, x0 + .6, 1.2, 29.86, { s: 'vetro' }); k.urto(.6, .7, x0 + 2.5, 29.3); k.urto(.6, .5, x0 + .6, 29.6); luce(x0 + 1.5, 27, 8, 6, 0xfff0e0, 2.6) }
  const wc = cartello((g, w, h) => { g.fillStyle = '#2a201b'; g.fillRect(0, 0, w, h); g.fillStyle = '#f0e2c8'; g.textAlign = 'center'; g.font = `800 ${h * .6}px Arial`; g.fillText('BAGNI', w / 2, h * .72) }, .9, .28, { px: 64 })
  wc.position.set(24, 2.65, 23.86); wc.rotation.y = Math.PI; cartelli.push(wc)

  // ——— Postazioni ———
  let n = 0
  for (const zr of [13.4, 19.3, 25.2]) for (let i = 0; i < 6; i++) for (const lato of [1, -1]) {
    const x = 31.6 + i * 1.9, vivo = n < scrivanieVive && (i % 2 === 0 || zr < 14)
    k.con(x, 0, zr + lato * .45, lato > 0 ? 0 : Math.PI, () => { const p = cubicolo(k, r, vivo ? 'vivo' : (r() < .55 ? 'fisso' : 'spento')); if (vivo) { posti.scrivanie.push(p); n++ } })
  }
  for (const zr of [13.4, 19.3, 25.2]) { k.con(30.2, 0, zr, 0, () => pianta(k, r)); if (zr > 14) k.con(43.4, 0, zr, 0, () => pianta(k, r, false)) }
  k.box(C.nero, 3.5, 2.0, .08, 34.2, 1.05, 9.16)
  k.con(45.5, 0, 16.9, -Math.PI / 2, () => libreria(k, r, 2.2, 2)); k.con(45.5, 0, 23.3, -Math.PI / 2, () => libreria(k, r, 2, 2))
  k.con(44.9, 0, 28.9, Math.PI, () => fotocopiatrice(k)); k.con(43.2, 0, 29, 0, () => scatole(k, r, 4)); k.con(28.2, 0, 28.8, 0, () => scatole(k, r, 3))
  k.con(45.4, 0, 10.2, 0, () => { boccione(k); poi.acqua.push({ pos: k.punto(-.7, 0, .2), giro: k.giro + Math.PI / 2, anim: 'beve' }) })
  k.con(28, 0, 16.4, 0, () => pianta(k, r)); k.con(38.8, 0, 9.9, 0, () => pianta(k, r)); k.con(28, 0, 21.4, Math.PI / 2, () => { k.box('#3a2416', 1.6, 1.0, .05, 0, 1.2, -.3); for (let i = 0; i < 8; i++) k.box(['#f6d24a', '#ff7a4a', '#7ec8e3', '#9be08a'][i % 4], .22, .22, .01, -.6 + (i % 4) * .4, 1.35 + (i > 3 ? .42 : 0), -.27) })
  const grafico2 = cartello((g, w, h) => { g.fillStyle = '#f4f0e4'; g.fillRect(0, 0, w, h); g.strokeStyle = '#2f8a4a'; g.lineWidth = 6; g.beginPath(); [[.1, .78], [.28, .6], [.44, .66], [.6, .4], [.76, .46], [.92, .2]].forEach(([x, y], i) => i ? g.lineTo(w * x, h * y) : g.moveTo(w * x, h * y)); g.stroke(); g.fillStyle = '#3a2a1c'; g.font = `800 ${h * .13}px Arial`; g.fillText('ORDINI', w * .08, h * .18) }, 1.3, .9, { luce: false })
  grafico2.position.set(45.86, 1.8, 20); grafico2.rotation.y = -Math.PI / 2; cartelli.push(grafico2)
  const neon = cartello((g, w, h) => { g.clearRect(0, 0, w, h); g.textAlign = 'center'; g.font = `800 ${h * .7}px "Avenir Next",Arial`; g.shadowColor = '#6d7bff'; g.shadowBlur = h * .2; g.fillStyle = '#8f9bff'; g.fillText(String(cliente).toUpperCase(), w / 2, h * .76, w * .94) }, 2.4, .42, { px: 128 })
  neon.position.set(34.2, 2.92, 9.2); cartelli.push(neon)
  for (const [x, z] of [[32, 13.4], [37, 13.4], [42, 13.4], [32, 19.3], [37, 19.3], [42, 19.3], [32, 25.2], [37, 25.2], [42, 25.2]]) plafoniera(x, z, 1.4, .7)
  for (const [x, z] of [[33, 14], [40.5, 14], [33, 22.5], [40.5, 22.5], [36.5, 28]]) luce(x, z, 30, 13, 0xffd6ae)

  // ——— Fuori: tettoia d'ingresso, lampioni, alberi, panchine ———
  for (const [x, z] of [[3.9, 30.4], [7.1, 30.4], [3.9, 33], [7.1, 33]]) k.box('#2a201b', .14, 2.9, .14, x, 0, z)
  k.box('#2a201b', 3.8, .12, 3.2, 5.5, 2.9, 31.7); k.box('#fff0c4', 1.2, .03, .3, 5.5, 2.87, 31.7, { s: 'luce' }); luci.push({ x: 5.5, y: 2.6, z: 31.7, colore: 0xffd9a0, forza: 18, raggio: 10 })
  for (const [x, z, g] of [[-1.6, 34.4, 0], [14, 34.4, 0], [30, 34.4, 0], [47.6, 20, Math.PI / 2], [9, 44, 0]]) k.con(x, 0, z, g, () => lampione(k, luci))
  for (const [x, z] of [[11, 31.6], [20, 31.6], [36, 31.6]]) k.con(x, 0, z, Math.PI, () => { k.box('#5a3a22', 1.6, .06, .42, 0, .42, 0); k.box('#5a3a22', 1.6, .34, .05, 0, .5, .2); k.box('#26262a', .06, .42, .4, -.7, 0, 0); k.box('#26262a', .06, .42, .4, .7, 0, 0); k.urto(1.6, .45) })
  for (const x of [24, 28, 40, 44]) k.box('#234f2a', 3.4, .7, .7, x, 0, 30.6)
  k.con(54, 0, 12, 0, () => { k.box('#3a4a6a', 1.8, .6, 4.1, 0, .3, 0); k.box('#22283a', 1.6, .5, 2.2, 0, .9, -.2); for (const [x, z] of [[-.9, 1.3], [.9, 1.3], [-.9, -1.3], [.9, -1.3]]) k.cil('#151518', .32, .32, .2, x, .0, z, { seg: 8, rz: Math.PI / 2 }); k.urto(1.9, 4.2) })
  for (let i = 0; i < 130; i++) {
    const x = -55 + r() * 155, z = -45 + r() * 120
    if (x > -4 && x < 50 && z > -3 && z < 35) continue
    if (x > 50 && x < 63 && z > 3 && z < 35) continue
    if (x > 2 && x < 9 && z > 30 && z < 51) continue
    k.con(x, 0, z, r() * 6, () => albero(k, r))
  }
  // bordo invisibile attorno al lotto, per chi esce a fare due passi
  k.urto(1, 100, -12, 20); k.urto(1, 100, 66, 20); k.urto(100, 1, 25, -10); k.urto(100, 1, 25, 52)

  const materiali = {
    solido: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .86, metalness: 0 }),
    luce: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
    vetro: new THREE.MeshStandardMaterial({ vertexColors: true, transparent: true, opacity: .2, roughness: .1, metalness: .2, depthWrite: false, side: THREE.DoubleSide }),
    soffitto: new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: .95 }),
    soffittoLuce: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }),
  }
  const mesh = k.costruisci(materiali)
  mesh.solido.castShadow = true; mesh.solido.receiveShadow = true
  for (const m of Object.values(mesh)) { m.updateMatrix(); gruppo.add(m) }
  for (const c of cartelli) gruppo.add(c)

  // la lavagna dei lavori sul muro delle postazioni: la ridisegna la pagina con i dati veri
  const lavagna = cartello((g, w, h) => { g.fillStyle = '#f4f2ec'; g.fillRect(0, 0, w, h) }, 3.3, 1.8, { px: 512 })
  lavagna.position.set(34.2, 2.05, 9.21); gruppo.add(lavagna)

  return { gruppo, urti: k.urti, porte, posti, poi, luci, lavagna, soffitto: [mesh.soffitto, mesh.soffittoLuce].filter(Boolean) }
}

// Dove guarda la telecamera per ogni scheda (posizione, bersaglio)
export const VISTE = {
  panoramica: [[47, 37, 53], [21.5, 0, 15.5]],
  postazioni: [[36.5, 17, 36], [36.5, 0, 18.5]],
  riunioni: [[6, 12, 15.5], [6, 0, 4.2]],
  direzione: [[17, 11, 15], [17, 0, 4.2]],
  relax: [[19, 19, 36], [19, 0, 19]],
  cucina: [[5.5, 12, 27], [5.5, 0, 16]],
}
