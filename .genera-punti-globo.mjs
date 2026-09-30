// Rigenera public/geo/punti-globo.bin dai confini (stessa matematica del globo).
// Uso: node .genera-punti-globo.mjs   (dopo aver cambiato coste/griglie in GloboLanding)
import fs from 'fs'
const d = JSON.parse(fs.readFileSync('public/geo/countries-110m.geojson', 'utf8'))
const poligoni = []
for (const f of d.features || []) {
  const geo = f.geometry; if (!geo) continue
  const gruppi = geo.type === 'Polygon' ? [geo.coordinates] : geo.type === 'MultiPolygon' ? geo.coordinates : []
  for (const p of gruppi) {
    const anello = p[0]; let a = 180, b = -180, c = 90, dd = -90
    for (const [x, y] of anello) { if (x < a) a = x; if (x > b) b = x; if (y < c) c = y; if (y > dd) dd = y }
    poligoni.push({ anello, a, b, c, d: dd })
  }
}
const dentro = (x, y, an) => { let k = false; for (let i = 0, j = an.length - 1; i < an.length; j = i++) { const [xi, yi] = an[i], [xj, yj] = an[j]; if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) k = !k } return k }
const terra = (x, y) => { for (const p of poligoni) if (x >= p.a && x <= p.b && y >= p.c && y <= p.d && dentro(x, y, p.anello)) return true; return false }
const out = []
const metti = (lat, lng, t) => { out.push(Math.round(lat * 200), Math.round(lng * 200), t) }
for (const p of poligoni) {
  const an = p.anello
  for (let i = 1; i < an.length; i++) {
    const [x0, y0] = an[i - 1], [x1, y1] = an[i]
    const passi = Math.max(1, Math.ceil(Math.hypot((x1 - x0) * Math.cos(y0 * Math.PI / 180), y1 - y0) / 0.5))
    for (let k = 0; k < passi; k++) {
      const t = k / passi, y = y0 + (y1 - y0) * t, x = x0 + (x1 - x0) * t
      const e = 0.6
      if (!terra(x + e, y) || !terra(x - e, y) || !terra(x, y + e) || !terra(x, y - e)) metti(y, x, 1)
    }
  }
}
const griglia = (passo, t, voglio) => {
  for (let lat = -60; lat <= 80; lat += passo) {
    const pl = passo / Math.max(0.15, Math.cos(lat * Math.PI / 180))
    for (let lng = -180; lng < 180; lng += pl) {
      const y = lat + (Math.random() - 0.5) * passo * 0.25, x = lng + (Math.random() - 0.5) * pl * 0.25
      if (terra(x, y) === voglio) metti(y, x, t)
    }
  }
}
griglia(0.72, 0, true)
griglia(1.5, 2, false)
fs.writeFileSync('public/geo/punti-globo.bin', Buffer.from(new Int16Array(out).buffer))
console.log('punti:', out.length / 3, '· bytes:', out.length * 2)
