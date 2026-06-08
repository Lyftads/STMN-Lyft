// Renderer Ad — compone un'immagine + testi/CTA/badge/logo su <canvas> e
// ritorna un dataURL. Tutto lato client, zero crediti. Template ispirati a
// layout di ad ad alte performance (overlay deterministico, brand-safe).

export const AD_FORMATS = [
  { id: 'square',    label: '1:1',  w: 1080, h: 1080 },
  { id: 'portrait',  label: '4:5',  w: 1080, h: 1350 },
  { id: 'vertical',  label: '9:16', w: 1080, h: 1920 },
  { id: 'landscape', label: '16:9', w: 1920, h: 1080 },
]

export const AD_TEMPLATES = [
  { id: 'bottom',  label: 'Bottom bar' },
  { id: 'panel',   label: 'Panel' },
  { id: 'minimal', label: 'Minimal' },
  { id: 'side',    label: 'Split' },
]

export function getAdFormat(id) { return AD_FORMATS.find(f => f.id === id) || AD_FORMATS[0] }

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = url
  })
}

// disegna l'immagine "cover" in un rettangolo
function drawCover(ctx, img, x, y, w, h) {
  const ir = img.width / img.height, rr = w / h
  let sw, sh, sx, sy
  if (ir > rr) { sh = img.height; sw = sh * rr; sx = (img.width - sw) / 2; sy = 0 }
  else { sw = img.width; sh = sw / rr; sx = 0; sy = (img.height - sh) / 2 }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h)
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

function wrapLines(ctx, text, maxW) {
  const words = (text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (const w of words) {
    const test = line ? line + ' ' + w : w
    if (ctx.measureText(test).width > maxW && line) { lines.push(line); line = w }
    else line = test
  }
  if (line) lines.push(line)
  return lines
}

function drawText(ctx, text, x, y, font, color, maxW, lineH, align = 'left') {
  ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'top'
  const lines = wrapLines(ctx, text, maxW)
  lines.forEach((ln, i) => ctx.fillText(ln, x, y + i * lineH))
  return lines.length * lineH
}

function ctaPill(ctx, text, x, y, font, bg, fg, padX = 38, padY = 22, align = 'left') {
  ctx.font = font
  const w = ctx.measureText(text).width + padX * 2
  const h = parseInt(font, 10) + padY * 2
  const px = align === 'center' ? x - w / 2 : x
  ctx.fillStyle = bg; roundRect(ctx, px, y, w, h, h / 2); ctx.fill()
  ctx.fillStyle = fg; ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
  ctx.fillText(text, px + padX, y + h / 2 + 2)
  return { w, h }
}

function badgeCircle(ctx, text, cx, cy, r, bg, fg) {
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fillStyle = bg; ctx.fill()
  ctx.fillStyle = fg; ctx.font = `800 ${Math.round(r * 0.55)}px Inter, Arial, sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, cy + 2)
}

// opts: { imageUrl, format, template, fields:{headline,subhead,cta,badge,showLogo}, brand:{primary,accent,onPrimary,logoImg} }
export async function renderAd({ imageUrl, format, template, fields = {}, brand = {} }) {
  const f = getAdFormat(format)
  const W = f.w, H = f.h
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')
  const primary = brand.primary || '#7b5bff'
  const accent = brand.accent || '#ff375f'
  const onPrimary = brand.onPrimary || '#ffffff'
  const img = imageUrl ? await loadImage(imageUrl).catch(() => null) : null
  const pad = Math.round(W * 0.06)
  const big = Math.round(W * 0.072)
  const sub = Math.round(W * 0.034)
  const ctaF = `800 ${Math.round(W * 0.034)}px Inter, Arial, sans-serif`
  const headF = `800 ${big}px Inter, Arial, sans-serif`
  const subF = `500 ${sub}px Inter, Arial, sans-serif`

  ctx.fillStyle = '#0b0b12'; ctx.fillRect(0, 0, W, H)

  const drawLogo = (x, y, maxW = W * 0.26) => {
    if (!fields.showLogo) return
    if (brand.logoImg) {
      const lw = Math.min(maxW, brand.logoImg.width)
      const lh = lw * (brand.logoImg.height / brand.logoImg.width)
      ctx.drawImage(brand.logoImg, x, y, lw, lh)
    } else if (brand.name) {
      drawText(ctx, brand.name, x, y, `800 ${Math.round(W * 0.03)}px Inter, Arial, sans-serif`, '#fff', maxW, 1)
    }
  }
  const drawBadge = () => { if (fields.badge) badgeCircle(ctx, fields.badge, W - pad - W * 0.085, pad + W * 0.085, W * 0.085, accent, '#fff') }

  if (template === 'panel') {
    const imgH = Math.round(H * 0.6)
    if (img) drawCover(ctx, img, 0, 0, W, imgH)
    ctx.fillStyle = primary; ctx.fillRect(0, imgH, W, H - imgH)
    let y = imgH + pad
    y += drawText(ctx, fields.headline || '', pad, y, headF, onPrimary, W - pad * 2, big * 1.12) + 10
    if (fields.subhead) y += drawText(ctx, fields.subhead, pad, y, subF, onPrimary, W - pad * 2, sub * 1.3) + 18
    if (fields.cta) ctaPill(ctx, fields.cta, pad, y, ctaF, onPrimary, primary)
    drawLogo(pad, pad, W * 0.3); drawBadge()
  } else if (template === 'minimal') {
    if (img) drawCover(ctx, img, 0, 0, W, H)
    const g = ctx.createLinearGradient(0, 0, 0, H * 0.4); g.addColorStop(0, 'rgba(0,0,0,0.55)'); g.addColorStop(1, 'rgba(0,0,0,0)')
    ctx.fillStyle = g; ctx.fillRect(0, 0, W, H * 0.4)
    drawText(ctx, fields.headline || '', W / 2, pad + W * 0.06, headF, '#fff', W - pad * 2, big * 1.12, 'center')
    if (fields.cta) ctaPill(ctx, fields.cta, W / 2, H - pad - W * 0.11, ctaF, primary, onPrimary, 38, 22, 'center')
    drawLogo(W / 2 - W * 0.13, pad, W * 0.26); drawBadge()
  } else if (template === 'side') {
    const vert = H > W
    const split = vert ? Math.round(H * 0.5) : Math.round(W * 0.52)
    if (vert) { if (img) drawCover(ctx, img, 0, 0, W, split); ctx.fillStyle = primary; ctx.fillRect(0, split, W, H - split) }
    else { if (img) drawCover(ctx, img, W - split, 0, split, H); ctx.fillStyle = primary; ctx.fillRect(0, 0, W - split, H) }
    const bx = pad, byTop = vert ? split + pad : pad
    let y = byTop
    y += drawText(ctx, fields.headline || '', bx, y, headF, onPrimary, (vert ? W : W - split) - pad * 2, big * 1.12) + 10
    if (fields.subhead) y += drawText(ctx, fields.subhead, bx, y, subF, onPrimary, (vert ? W : W - split) - pad * 2, sub * 1.3) + 18
    if (fields.cta) ctaPill(ctx, fields.cta, bx, y, ctaF, onPrimary, primary)
    drawLogo(bx, byTop - (vert ? 0 : 0) + (vert ? 0 : 0) - 0 + 0, W * 0.22); drawBadge()
  } else { // bottom
    if (img) drawCover(ctx, img, 0, 0, W, H)
    const g = ctx.createLinearGradient(0, H * 0.45, 0, H); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.82)')
    ctx.fillStyle = g; ctx.fillRect(0, H * 0.45, W, H * 0.55)
    let y = H - pad - W * 0.04
    const blockH = (fields.cta ? W * 0.12 : 0) + big * 1.2 + (fields.subhead ? sub * 1.4 : 0)
    y = H - pad - blockH
    y += drawText(ctx, fields.headline || '', pad, y, headF, '#fff', W - pad * 2, big * 1.12) + 8
    if (fields.subhead) y += drawText(ctx, fields.subhead, pad, y, subF, 'rgba(255,255,255,0.88)', W - pad * 2, sub * 1.3) + 16
    if (fields.cta) ctaPill(ctx, fields.cta, pad, y, ctaF, primary, onPrimary)
    drawLogo(pad, pad, W * 0.26); drawBadge()
  }

  return canvas.toDataURL('image/jpeg', 0.92)
}

export function loadBrandLogo(url) { return url ? loadImage(url).catch(() => null) : Promise.resolve(null) }
