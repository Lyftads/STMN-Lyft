// Il cantiere: tutta la parte ferma dell'ufficio (muri, mobili, oggetti) si costruisce con solidi
// semplici che finiscono in pochi "secchi" e vengono fusi in una manciata di mesh. Il colore sta nei
// vertici, così mille scatole costano come una. Tiene anche gli urti (rettangoli a terra) per chi cammina.
import * as THREE from 'three'
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js'

const _c = new THREE.Color(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler()
const _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1)

export class Cantiere {
  constructor() { this.secchi = {}; this.pila = [new THREE.Matrix4()]; this.giri = [0]; this.urti = [] }
  get M() { return this.pila[this.pila.length - 1] }
  get giro() { return this.giri[this.giri.length - 1] }
  // tutto quello che si costruisce dentro fn è spostato e girato insieme (un mobile, una stanza)
  con(x, y, z, ry, fn) {
    const m = new THREE.Matrix4().makeRotationY(ry || 0).setPosition(x, y, z)
    this.pila.push(this.M.clone().multiply(m)); this.giri.push(this.giro + (ry || 0))
    try { return fn() } finally { this.pila.pop(); this.giri.pop() }
  }
  punto(x = 0, y = 0, z = 0) { return new THREE.Vector3(x, y, z).applyMatrix4(this.M) }
  geo(colore, g, { s = 'solido', x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0, sx = 1, sy = 1, sz = 1 } = {}) {
    if (g.index) g = g.toNonIndexed()
    _m.compose(_p.set(x, y, z), _q.setFromEuler(_e.set(rx, ry, rz)), _s.set(sx, sy, sz))
    g.applyMatrix4(_m).applyMatrix4(this.M)
    const n = g.attributes.position.count, col = new Float32Array(n * 3)
    _c.set(colore)
    for (let i = 0; i < n; i++) { col[i * 3] = _c.r; col[i * 3 + 1] = _c.g; col[i * 3 + 2] = _c.b }
    g.setAttribute('color', new THREE.BufferAttribute(col, 3))
    ;(this.secchi[s] ||= []).push(g)
  }
  // y è sempre la BASE del solido (dove appoggia), non il centro
  box(c, w, h, d, x = 0, y = 0, z = 0, o = {}) { this.geo(c, new THREE.BoxGeometry(w, h, d), { ...o, x, y: y + h / 2, z }) }
  cil(c, r1, r2, h, x = 0, y = 0, z = 0, o = {}) { this.geo(c, new THREE.CylinderGeometry(r1, r2, h, o.seg || 8), { ...o, x, y: y + h / 2, z }) }
  cono(c, r, h, x = 0, y = 0, z = 0, o = {}) { this.geo(c, new THREE.ConeGeometry(r, h, o.seg || 6), { ...o, x, y: y + h / 2, z }) }
  ico(c, r, x = 0, y = 0, z = 0, o = {}) { this.geo(c, new THREE.IcosahedronGeometry(r, o.det || 0), { ...o, x, y, z }) }
  // rettangolo a terra che ferma chi cammina (coordinate locali, centro x,z)
  urto(w, d, x = 0, z = 0) {
    let x1 = Infinity, z1 = Infinity, x2 = -Infinity, z2 = -Infinity
    for (const [a, b] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) {
      _p.set(x + a * w / 2, 0, z + b * d / 2).applyMatrix4(this.M)
      x1 = Math.min(x1, _p.x); x2 = Math.max(x2, _p.x); z1 = Math.min(z1, _p.z); z2 = Math.max(z2, _p.z)
    }
    this.urti.push({ x1, z1, x2, z2 })
  }
  costruisci(materiali) {
    const fuori = {}
    for (const [nome, lista] of Object.entries(this.secchi)) {
      const g = mergeGeometries(lista, false)
      lista.forEach(x => x.dispose())
      const m = new THREE.Mesh(g, materiali[nome] || materiali.solido)
      m.name = nome; m.matrixAutoUpdate = false
      fuori[nome] = m
    }
    return fuori
  }
}

// ——— Trame disegnate (pavimenti, prato): niente immagini da scaricare ———
function tela(w, h, disegna) { const c = document.createElement('canvas'); c.width = w; c.height = h; disegna(c.getContext('2d'), w, h); return c }
function trama(c, rx, ry) { const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8; return t }
const caso = seme => () => (seme = (seme * 16807) % 2147483647) / 2147483647

export const TRAME = {
  // una mattonella di trama copre `metri` metri: il chiamante passa larghezza e profondità della stanza
  spina(w, d) { // parquet a spina di pesce: listelli 1×4 alternati orizzontali e verticali, poi girati di 45°
    const n = 4, N = 2 * n, P = 20, mod = (a, b) => ((a % b) + b) % b
    const chiave = (x, y) => { const q = mod(x - y, N); return q < n ? `o${mod(y, N)}_${mod(x - q, N)}` : `v${mod(x, N)}_${mod(y - (N - 1 - q), N)}` }
    const c = tela(N * P, N * P, (g) => {
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        const k = chiave(x, y); let hsh = 7; for (const ch of k) hsh = (hsh * 31 + ch.charCodeAt(0)) % 997
        const t = 0.8 + (hsh % 100) / 100 * 0.34; g.fillStyle = `rgb(${150 * t | 0},${98 * t | 0},${56 * t | 0})`; g.fillRect(x * P, y * P, P, P)
        g.fillStyle = 'rgba(48,26,12,.7)'
        if (chiave(x + 1, y) !== k) g.fillRect(x * P + P - 1, y * P, 1.5, P)
        if (chiave(x, y + 1) !== k) g.fillRect(x * P, y * P + P - 1, P, 1.5)
      }
    })
    const t = trama(c, w / 1.5, d / 1.5); t.rotation = Math.PI / 4; return t
  },
  assi(w, d) { // assi di legno lunghe
    const r = caso(3)
    const c = tela(256, 256, (g) => {
      for (let i = 0; i < 8; i++) {
        let x = -r() * 120
        while (x < 256) { const l = 90 + r() * 90, t = 0.85 + r() * 0.28; g.fillStyle = `rgb(${158 * t | 0},${104 * t | 0},${62 * t | 0})`; g.fillRect(x, i * 32, l - 2, 30); x += l }
        g.fillStyle = 'rgba(60,32,14,.55)'; g.fillRect(0, i * 32 + 30, 256, 2)
      }
    })
    return trama(c, w / 4, d / 4)
  },
  piastrelle(w, d) {
    const r = caso(11)
    const c = tela(128, 128, (g) => { g.fillStyle = '#6f685e'; g.fillRect(0, 0, 128, 128); const t = 0.92 + r() * 0.1; g.fillStyle = `rgb(${190 * t | 0},${180 * t | 0},${162 * t | 0})`; g.fillRect(3, 3, 122, 122) })
    return trama(c, w / 1.1, d / 1.1)
  },
  scacchi(w, d) {
    const c = tela(64, 64, (g) => { g.fillStyle = '#d9d4c8'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#4a4744'; g.fillRect(0, 0, 32, 32); g.fillRect(32, 32, 32, 32) })
    return trama(c, w / 1, d / 1)
  },
  moquette(w, d) { // moquette rossa con il disegno a trattini, come nell'open space
    const r = caso(5)
    const c = tela(256, 256, (g) => {
      g.fillStyle = '#651b19'; g.fillRect(0, 0, 256, 256)
      for (let i = 0; i < 2600; i++) { g.fillStyle = `rgba(${r() < .5 ? '40,8,8' : '170,60,50'},${0.05 + r() * 0.08})`; g.fillRect(r() * 256, r() * 256, 2, 2) }
      for (let i = 0; i < 46; i++) { g.fillStyle = `rgba(${r() < .5 ? '168,60,48' : '60,12,12'},.5)`; const o = r() < .5; g.fillRect(r() * 256 | 0, r() * 256 | 0, o ? 22 : 7, o ? 7 : 22) }
    })
    return trama(c, w / 3.2, d / 3.2)
  },
  prato(w, d) {
    const r = caso(9)
    const c = tela(256, 256, (g) => { g.fillStyle = '#1c3a1c'; g.fillRect(0, 0, 256, 256); for (let i = 0; i < 5000; i++) { const t = r(); g.fillStyle = `rgba(${30 + t * 40 | 0},${70 + t * 60 | 0},${28 + t * 30 | 0},.5)`; g.fillRect(r() * 256, r() * 256, 2, 3) } })
    return trama(c, w / 6, d / 6)
  },
  cemento(w, d) {
    const r = caso(13)
    const c = tela(128, 128, (g) => { g.fillStyle = '#8f8a84'; g.fillRect(0, 0, 128, 128); for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(${r() < .5 ? '0,0,0' : '255,255,255'},.05)`; g.fillRect(r() * 128, r() * 128, 2, 2) } g.fillStyle = 'rgba(40,36,32,.6)'; g.fillRect(0, 0, 128, 2); g.fillRect(0, 0, 2, 128) })
    return trama(c, w / 2, d / 2)
  },
}

// Un cartello: testo disegnato su una tela, che si accende da solo (insegne, targhe, poster).
export function cartello(disegna, larghezza, altezza, { px = 256, luce = true } = {}) {
  const c = tela(Math.round(px * larghezza / altezza), px, disegna)
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 8
  const m = new THREE.Mesh(new THREE.PlaneGeometry(larghezza, altezza), luce ? new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }) : new THREE.MeshStandardMaterial({ map: t, roughness: .9 }))
  m.userData.tela = c; m.userData.trama = t
  return m
}
