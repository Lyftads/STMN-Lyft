// Logo Creative Studio — mark (tile gradiente con due spark) + lockup opzionale
// col wordmark. Vettoriale, on-brand (gradiente #7b5bff → #5b8bff).
export function CreativeStudioMark({ size = 28 }) {
  const gid = 'csm' + size
  return (
    <svg width={size} height={size} viewBox="0 0 512 512" fill="none" aria-hidden="true" style={{ display: 'block', flex: 'none' }}>
      <defs>
        <linearGradient id={gid} x1="40" y1="40" x2="472" y2="472" gradientUnits="userSpaceOnUse">
          <stop stopColor="#7B5BFF" />
          <stop offset="1" stopColor="#5B8BFF" />
        </linearGradient>
      </defs>
      <rect width="512" height="512" rx="116" fill={`url(#${gid})`} />
      <path d="M268 104C284 212 300 228 408 244C300 260 284 276 268 384C252 276 236 260 128 244C236 228 252 212 268 104Z" fill="#fff" />
      <path d="M392 120C398 156 404 162 440 168C404 174 398 180 392 216C386 180 380 174 344 168C380 162 386 156 392 120Z" fill="#fff" fillOpacity="0.9" />
    </svg>
  )
}

export default function CreativeStudioLogo({ size = 28, showText = true, color = '#fff' }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
      <CreativeStudioMark size={size} />
      {showText && (
        <span style={{ fontWeight: 800, fontSize: size * 0.62, letterSpacing: '-0.01em', color, fontFamily: 'Barlow', lineHeight: 1 }}>
          Creative <span style={{ opacity: 0.7 }}>Studio</span>
        </span>
      )}
    </span>
  )
}
