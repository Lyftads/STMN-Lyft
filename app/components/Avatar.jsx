'use client'

// Avatar utente: foto se presente, altrimenti iniziali su sfondo colorato.
// `online`: undefined = nessun pallino, true = verde, false = grigio.
export default function Avatar({ name, url, size = 32, online }) {
  const initials = (name || '?').trim().split(/\s+/).map(s => s[0]).slice(0, 2).join('').toUpperCase() || '?'
  const dot = size * 0.32
  const inner = url
    ? <img src={url} alt={name || ''} style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', display: 'block' }} />
    : <div style={{ width: size, height: size, borderRadius: '50%', background: 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(size * 0.4), fontWeight: 700, fontFamily: 'Barlow' }}>{initials}</div>
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      {inner}
      {online !== undefined && (
        <span style={{ position: 'absolute', right: -1, bottom: -1, width: dot, height: dot, borderRadius: '50%', background: online ? '#30d158' : '#6b6b78', border: '2px solid #15151f' }} />
      )}
    </div>
  )
}
