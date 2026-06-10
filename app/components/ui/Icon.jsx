'use client'

// Set centrale di icone SVG minimali (line-style, monocromatiche, currentColor).
// Sostituisce le emoji usate come icone nell'interfaccia.
// Uso: <Icon name="bell" size={16} /> — eredita il colore dal testo (currentColor).

const P = {
  // generiche / stato
  plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
  cursor: <path d="M5 3l14 6.5-6 1.8-2.2 6.2z" />,
  video: <><rect x="3" y="6" width="13" height="12" rx="2" /><path d="M16 10l5-2.5v9L16 14z" /></>,
  wave: <><line x1="4" y1="10" x2="4" y2="14" /><line x1="8" y1="6" x2="8" y2="18" /><line x1="12" y1="9" x2="12" y2="15" /><line x1="16" y1="5" x2="16" y2="19" /><line x1="20" y1="10" x2="20" y2="14" /></>,
  minus: <line x1="5" y1="12" x2="19" y2="12" />,
  download: <><path d="M12 3v12" /><polyline points="7 11 12 16 17 11" /><path d="M5 20h14" /></>,
  refresh: <><path d="M3.5 12a8.5 8.5 0 0 1 14.5-6l2 2" /><path d="M20.5 12A8.5 8.5 0 0 1 6 18l-2-2" /><polyline points="20 4 20 8 16 8" /><polyline points="4 20 4 16 8 16" /></>,
  warning: <><path d="M12 3 2.5 20h19L12 3Z" /><line x1="12" y1="10" x2="12" y2="14" /><line x1="12" y1="17.5" x2="12" y2="17.5" /></>,
  check: <polyline points="4 12.5 9.5 18 20 6.5" />,
  'check-circle': <><circle cx="12" cy="12" r="9" /><polyline points="8 12.5 11 15.5 16.5 9" /></>,
  close: <><line x1="6" y1="6" x2="18" y2="18" /><line x1="18" y1="6" x2="6" y2="18" /></>,
  info: <><circle cx="12" cy="12" r="9" /><line x1="12" y1="11" x2="12" y2="16.5" /><line x1="12" y1="7.6" x2="12" y2="7.6" /></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7l1-8Z" />,
  // comunicazione
  mail: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3.5 7 8.5 6 8.5-6" /></>,
  bell: <><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6Z" /><path d="M10.5 19a1.6 1.6 0 0 0 3 0" /></>,
  inbox: <><path d="M3 13h4l1.5 3h7l1.5-3h4" /><path d="M3 13 5.5 5h13L21 13v6a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1v-6Z" /></>,
  chat: <path d="M4 5h16v11H8l-4 4V5Z" />,
  link: <><path d="M9 14a4 4 0 0 0 6 .5l3-3a4 4 0 0 0-5.7-5.7L11 7" /><path d="M15 10a4 4 0 0 0-6-.5l-3 3A4 4 0 0 0 11.7 18L13 17" /></>,
  paperclip: <path d="M19 11.5 12 18.5a4.5 4.5 0 0 1-6.5-6.5l7-7a3 3 0 0 1 4.5 4.5l-7 7a1.5 1.5 0 0 1-2.2-2.2l6.2-6.2" />,
  mic: <><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5.5 11a6.5 6.5 0 0 0 13 0" /><line x1="12" y1="17.5" x2="12" y2="21" /></>,
  pin: <><path d="M9 3h6l-1 6 3 3v2H7v-2l3-3-1-6Z" /><line x1="12" y1="14" x2="12" y2="21" /></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></>,
  // navigazione / oggetti
  search: <><circle cx="11" cy="11" r="7" /><line x1="16.5" y1="16.5" x2="21" y2="21" /></>,
  gear: <><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4 5.3 5.3" /></>,
  trash: <><path d="M4 7h16" /><path d="M9 7V4h6v3" /><path d="M6 7l1 14h10l1-14" /></>,
  key: <><circle cx="8" cy="14" r="4" /><path d="m11 11 9-9M17 5l2 2M14.5 7.5l2 2" /></>,
  rocket: <><path d="M12 3c4 2 5 6 5 9l-2.5 2.5h-5L7 12c0-3 1-7 5-9Z" /><circle cx="12" cy="9.5" r="1.6" /><path d="M9.5 17c-1.5.5-2.5 2-2.5 4 2 0 3.5-1 4-2.5" /></>,
  globe: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.6 2.4 4 5.6 4 9s-1.4 6.6-4 9c-2.6-2.4-4-5.6-4-9s1.4-6.6 4-9Z" /></>,
  crown: <path d="M3 8l3.5 4L12 5l5.5 7L21 8l-1.5 11h-15L3 8Z" />,
  // commerce / dati
  cart: <><circle cx="9" cy="20" r="1.4" /><circle cx="17" cy="20" r="1.4" /><path d="M3 4h2l2.5 12h11l2-8H6" /></>,
  bag: <><path d="M5 8h14l-1 12H6L5 8Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
  money: <><circle cx="12" cy="12" r="9" /><path d="M12 7v10M14.5 9.3c-.6-.9-4.5-1.4-4.5 .9 0 2.5 5 1.3 5 3.7 0 2.3-3.9 1.9-4.6.8" /></>,
  box: <><path d="M12 3 4 7v10l8 4 8-4V7l-8-4Z" /><path d="M4 7l8 4 8-4M12 11v10" /></>,
  shirt: <path d="M8 3 4 6l2 3 1-1v12h10V8l1 1 2-3-4-3-2 2a3 3 0 0 1-4 0L8 3Z" />,
  // grafici
  'chart-bar': <><line x1="4" y1="20" x2="20" y2="20" /><rect x="6" y="11" width="3" height="7" /><rect x="11" y="7" width="3" height="11" /><rect x="16" y="13" width="3" height="5" /></>,
  'chart-line': <><polyline points="4 16 9 10 13 13 20 5" /><polyline points="15 5 20 5 20 10" /></>,
  calendar: <><rect x="4" y="5" width="16" height="16" rx="2" /><line x1="4" y1="9" x2="20" y2="9" /><line x1="9" y1="3" x2="9" y2="6" /><line x1="15" y1="3" x2="15" y2="6" /></>,
  file: <><path d="M7 3h7l4 4v14H7V3Z" /><path d="M14 3v4h4" /></>,
  users: <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0" /><path d="M16 5.5a3.2 3.2 0 0 1 0 6M17 20a5.5 5.5 0 0 0-2.5-4.6" /></>,
  user: <><circle cx="12" cy="8" r="3.4" /><path d="M5 20a7 7 0 0 1 14 0" /></>,
  desktop: <><rect x="3" y="4" width="18" height="12" rx="1.5" /><line x1="9" y1="20" x2="15" y2="20" /><line x1="12" y1="16" x2="12" y2="20" /></>,
  mobile: <><rect x="7" y="3" width="10" height="18" rx="2" /><line x1="11" y1="18" x2="13" y2="18" /></>,
  scale: <><line x1="12" y1="4" x2="12" y2="20" /><line x1="7" y1="20" x2="17" y2="20" /><path d="M4 8h16M4 8l-2.5 5a3 3 0 0 0 5 0L4 8ZM20 8l-2.5 5a3 3 0 0 0 5 0L20 8Z" /><path d="M12 4 4 8M12 4l8 4" /></>,
  // sidebar / navigazione estesa
  kanban: <><rect x="3" y="4" width="6" height="13" rx="1" /><rect x="15" y="4" width="6" height="9" rx="1" /><rect x="9" y="4" width="6" height="16" rx="1" /></>,
  clock: <><circle cx="12" cy="12" r="9" /><polyline points="12 7 12 12 16 14" /></>,
  grid: <><rect x="4" y="4" width="7" height="7" rx="1" /><rect x="13" y="4" width="7" height="7" rx="1" /><rect x="4" y="13" width="7" height="7" rx="1" /><rect x="13" y="13" width="7" height="7" rx="1" /></>,
  target: <><circle cx="12" cy="12" r="8.5" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="0.6" /></>,
  layers: <><path d="M12 3 3 8l9 5 9-5-9-5Z" /><path d="M3 13l9 5 9-5" /></>,
  funnel: <path d="M3 5h18l-7 8v6l-4-2v-4L3 5Z" />,
  scan: <><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><line x1="4" y1="12" x2="20" y2="12" /></>,
  image: <><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="8.5" cy="9.5" r="1.8" /><path d="m4 18 5-5 4 4 3-3 4 4" /></>,
  list: <><line x1="8" y1="6" x2="20" y2="6" /><line x1="8" y1="12" x2="20" y2="12" /><line x1="8" y1="18" x2="20" y2="18" /><line x1="4" y1="6" x2="4" y2="6" /><line x1="4" y1="12" x2="4" y2="12" /><line x1="4" y1="18" x2="4" y2="18" /></>,
  gauge: <><path d="M4 16a8 8 0 1 1 16 0" /><line x1="12" y1="16" x2="16" y2="10" /><line x1="4" y1="16" x2="20" y2="16" /></>,
  pulse: <polyline points="3 13 8 13 10 7 14 19 16 13 21 13" />,
  wallet: <><rect x="3" y="6" width="18" height="13" rx="2" /><path d="M3 9h13a2 2 0 0 1 0 4H3" /><circle cx="16.5" cy="11" r="0.7" /></>,
  euro: <><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5A4.5 4.5 0 1 0 15.5 16M7.5 10.5h5M7.5 13.5h5" /></>,
  send: <path d="M21 3 3 11l7 2 2 7 9-17Z" />,
  bulb: <><path d="M9 18h6M10 21h4" /><path d="M12 3a6 6 0 0 0-3.5 10.9c.6.4 1 1 1 1.7v.4h5v-.4c0-.7.4-1.3 1-1.7A6 6 0 0 0 12 3Z" /></>,
  eye: <><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" /><circle cx="12" cy="12" r="3" /></>,
  'eye-off': <><path d="M4 4l16 16" /><path d="M9.5 9.5A3 3 0 0 0 12 15a3 3 0 0 0 2.5-1.4" /><path d="M6.5 6.6C3.9 8.1 2 12 2 12s3.5 7 10 7c1.7 0 3.2-.4 4.5-1M9.5 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a18 18 0 0 1-2.2 3" /></>,
  flag: <><path d="M5 21V4M5 4h12l-2 4 2 4H5" /></>,
  tag: <><path d="M3 11V4h7l11 11-7 7L3 11Z" /><circle cx="7.5" cy="7.5" r="1.3" /></>,
  headphones: <><path d="M4 13v-1a8 8 0 0 1 16 0v1" /><rect x="3" y="13" width="4" height="7" rx="1.5" /><rect x="17" y="13" width="4" height="7" rx="1.5" /></>,
  phone: <path d="M6.5 3h3l1.5 4-2 1.5a11 11 0 0 0 5 5l1.5-2 4 1.5v3a2 2 0 0 1-2.2 2A16 16 0 0 1 4.5 5.2 2 2 0 0 1 6.5 3Z" />,
  'phone-off': <><path d="M10.7 5.1 9.5 3h-3a2 2 0 0 0-2 2.2 16 16 0 0 0 4 9.3M14 14.8a16 16 0 0 0 4.3 1.7A2 2 0 0 0 20 14.5v-3L16 10l-1.5 2" /><line x1="3" y1="3" x2="21" y2="21" /></>,
  dot: <circle cx="12" cy="12" r="5" />,
  heart: <path d="M12 20.5S3.5 15 3.5 8.8A4.3 4.3 0 0 1 12 6a4.3 4.3 0 0 1 8.5 2.8C20.5 15 12 20.5 12 20.5Z" />,
  bookmark: <path d="M6 3h12v18l-6-4-6 4V3Z" />,
  edit: <><path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z" /><path d="M14.5 6.7l2.8 2.8" /></>,
  crop: <><path d="M6 2v16h16M2 6h16v16" /></>,
  clipboard: <><rect x="5" y="5" width="14" height="16" rx="2" /><rect x="9" y="3" width="6" height="4" rx="1" /><line x1="8.5" y1="11" x2="15.5" y2="11" /><line x1="8.5" y1="15" x2="13.5" y2="15" /></>,
  // accenti
  sparkle: <path d="M12 3c.4 3.6 1.4 4.6 5 5-3.6.4-4.6 1.4-5 5-.4-3.6-1.4-4.6-5-5 3.6-.4 4.6-1.4 5-5Z" />,
  sparkles: <><path d="M11 3c.3 2.7 1 3.4 3.7 3.7C12 7 11.3 7.7 11 10.4 10.7 7.7 10 7 7.3 6.7 10 6.4 10.7 5.7 11 3Z" /><path d="M17.5 12c.2 1.7.6 2.1 2.3 2.3-1.7.2-2.1.6-2.3 2.3-.2-1.7-.6-2.1-2.3-2.3 1.7-.2 2.1-.6 2.3-2.3Z" /></>,
  star: <path d="M12 3.5l2.6 5.3 5.9.9-4.2 4.1 1 5.8-5.3-2.8-5.3 2.8 1-5.8L3.5 9.7l5.9-.9L12 3.5Z" />,
}

export default function Icon({ name, size = 16, strokeWidth = 1.8, filled, style, className, ...rest }) {
  const d = P[name]
  if (!d) return null
  // alcune icone sono "piene" per natura
  const isFill = filled || name === 'sparkle' || name === 'sparkles' || name === 'star' || name === 'pin' || name === 'dot'
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={isFill ? 'currentColor' : 'none'}
      stroke="currentColor"
      strokeWidth={isFill ? 0 : strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      style={{ flex: 'none', display: 'inline-block', verticalAlign: 'middle', ...style }}
      aria-hidden="true"
      {...rest}
    >
      {d}
    </svg>
  )
}
