'use client'

const LANGS = [['it', 'IT'], ['en', 'EN'], ['es', 'ES'], ['fr', 'FR'], ['de', 'DE']]

// Switch lingua per le pagine /soluzioni: allineato alla landing (cookie+localStorage),
// poi ricarica così il server ri-renderizza i contenuti nella lingua scelta.
export default function LangSwitch({ current = 'it' }) {
  const pick = (l) => {
    try {
      localStorage.setItem('lyftai_lang', l)
      document.cookie = `lyftai_lang=${l}; path=/; max-age=31536000; samesite=lax`
    } catch {}
    window.location.reload()
  }
  return (
    <div role="group" aria-label="Lingua" style={{ display: 'inline-flex', gap: 2, background: 'rgba(255,255,255,0.05)', borderRadius: 9, padding: 3 }}>
      {LANGS.map(([code, label]) => {
        const on = code === current
        return (
          <button
            key={code}
            type="button"
            onClick={() => pick(code)}
            aria-pressed={on}
            aria-label={`Lingua: ${label}`}
            style={{
              cursor: 'pointer', border: 'none', borderRadius: 7, padding: '4px 9px',
              fontSize: 11.5, fontWeight: 800, fontFamily: 'inherit',
              background: on ? 'rgba(123,91,255,0.9)' : 'transparent',
              color: on ? '#fff' : 'rgba(255,255,255,0.6)',
              transition: 'background 200ms ease, color 200ms ease',
            }}
          >{label}</button>
        )
      })}
    </div>
  )
}
