// Logo LyftAI per l'intestazione dei PDF — versione statica (no animazioni)
// del LogoMark usato in app/landing, su badge scuro arrotondato.
export function reportLogoHtml(size = 30) {
  const mark = `<svg width="${size}" height="${size}" viewBox="0 0 100 100" style="display:block">
    <defs>
      <linearGradient id="lyftMainPdf" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#bf5af2"/><stop offset="100%" stop-color="#2997ff"/>
      </linearGradient>
    </defs>
    <circle cx="50" cy="50" r="44" fill="none" stroke="url(#lyftMainPdf)" stroke-width="3" stroke-dasharray="60 8 30 8" opacity="0.7"/>
    <g transform="translate(50 50)">
      <rect x="-26" y="-26" width="52" height="52" rx="10" transform="rotate(45)" fill="url(#lyftMainPdf)" opacity="0.95"/>
    </g>
    <g transform="translate(50 50)" fill="#ffffff">
      <rect x="-9" y="-14" width="5" height="28" rx="2"/>
      <rect x="-9" y="9" width="18" height="5" rx="2"/>
    </g>
    <circle cx="78" cy="22" r="4" fill="#22c55e"/>
  </svg>`
  return `<div style="display:inline-flex;align-items:center;gap:9px;background:#0e0e16;border:1px solid rgba(255,255,255,0.12);border-radius:12px;padding:7px 14px 7px 9px;">
    ${mark}
    <span style="font-size:${Math.round(size * 0.62)}px;font-weight:800;color:#ffffff;letter-spacing:-0.01em;line-height:1;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;">LyftAI</span>
  </div>`
}

// Barra logo (con margine sotto) da mettere in cima al body del PDF.
export function reportLogoBar(size = 30) {
  return `<div style="margin:0 0 18px;">${reportLogoHtml(size)}</div>`
}
