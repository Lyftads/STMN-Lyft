import Link from 'next/link'
import { getArea, getMarketing } from '../../../lib/marketing/solutions'
import { findArticle } from '../../../lib/help/content'
import { HELP_VIDEOS } from '../../../lib/help/videos'
import TutorialVideo from './TutorialVideo'
import LangSwitch from './LangSwitch'

const ACCENT = '#bf5af2'
const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#f87171'

// Estrae il paragrafo di "framing" (PAS) dall'articolo help, accorciato a ~2 frasi.
function framing(art) {
  const p = (art?.sections || []).find(s => s.p)?.p || art?.summary || ''
  const sentences = p.split(/(?<=\.)\s+/)
  let out = ''
  for (const s of sentences) { if ((out + s).length > 300 && out) break; out += (out ? ' ' : '') + s }
  return out
}

function Ico({ d, size = 18, stroke = 'currentColor', fill = 'none' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}</svg>
}

export default function SolutionPage({ area, lang = 'it' }) {
  const ar = getArea(area)
  if (!ar) return null
  const { chrome, hero } = getMarketing(area, lang)

  const modules = ar.modules
    .map(id => {
      const art = findArticle(id, lang)
      const video = HELP_VIDEOS[id]
      if (!art || !video) return null
      return { id, title: art.title, summary: art.summary, framing: framing(art), video }
    })
    .filter(Boolean)

  return (
    <main style={{
      minHeight: '100vh', color: '#e8edf7', fontFamily: 'Barlow, system-ui, sans-serif',
      background: 'radial-gradient(circle at 25% 12%, rgba(191,90,242,0.12), transparent 42%), radial-gradient(circle at 82% 70%, rgba(59,130,246,0.10), transparent 42%), #030817',
    }}>
      {/* Header */}
      <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(3,8,23,0.78)', backdropFilter: 'blur(16px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <Link href="/welcome" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: 19, letterSpacing: '-0.02em' }}>
            <img src="/chat-192.png" alt="LyftAI" width={26} height={26} style={{ borderRadius: 7 }} /> LyftAI
          </Link>
          <Link href="/welcome" style={{ fontSize: 13, color: 'rgba(255,255,255,0.6)', textDecoration: 'none', fontWeight: 600 }}>← {chrome.backToSite}</Link>
          <div style={{ flex: 1 }} />
          <LangSwitch current={lang} />
          <Link href="/login" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 600 }}>{chrome.login}</Link>
          <Link href="/register" className="cta-btn" style={{ padding: '9px 18px', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 800 }}>{chrome.freeTrial}</Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '72px 24px 24px', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 16px', borderRadius: 999, background: 'rgba(191,90,242,0.12)', border: `1px solid ${ACCENT}44`, color: '#d9c2ff', fontSize: 12.5, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          <Ico d={ar.icon} size={15} stroke={ACCENT} /> {hero?.eyebrow || ar.id}
        </div>
        <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(34px, 6vw, 56px)', fontWeight: 800, color: '#fff', margin: '20px 0 0', lineHeight: 1.05, letterSpacing: '-0.02em' }}>{hero?.h1}</h1>
        <p style={{ fontSize: 'clamp(15px, 2.2vw, 18px)', color: 'rgba(255,255,255,0.66)', maxWidth: 720, margin: '18px auto 0', lineHeight: 1.6 }}>{hero?.sub}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
          <Link href="/register" className="cta-btn" style={{ padding: '14px 28px', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 800 }}>{chrome.freeTrial}</Link>
          <Link href="/demo" style={{ padding: '14px 28px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontSize: 15, fontWeight: 700 }}>▶ {chrome.watchDemo}</Link>
        </div>
      </section>

      {/* PAS band: problema / soluzione */}
      {hero?.problem && hero?.solution && (
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
          <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 280, background: 'rgba(248,113,113,0.06)', border: '1px solid rgba(248,113,113,0.22)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: RED, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}><Ico d="M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" size={15} stroke={RED} /> {chrome.problemLabel}</div>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0 }}>{hero.problem}</p>
            </div>
            <div style={{ flex: 1, minWidth: 280, background: 'rgba(34,197,94,0.06)', border: '1px solid rgba(34,197,94,0.22)', borderRadius: 16, padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GREEN, fontSize: 12, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}><Ico d="M20 6 9 17l-5-5" size={15} stroke={GREEN} /> {chrome.solutionLabel}</div>
              <p style={{ fontSize: 14.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.6, margin: 0 }}>{hero.solution}</p>
            </div>
          </div>
        </section>
      )}

      {/* Blocchi modulo (alternati) con video + screenshot reale */}
      <section style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px 20px', display: 'flex', flexDirection: 'column', gap: 56 }}>
        {modules.map((m, i) => (
          <div key={m.id} style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(24px, 4vw, 56px)', alignItems: 'center', flexDirection: i % 2 ? 'row-reverse' : 'row' }}>
            <div style={{ flex: '1 1 360px', minWidth: 280 }}>
              <div style={{ fontSize: 12, color: ACCENT, fontWeight: 800, letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8 }}>{m.summary}</div>
              <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(24px, 3.5vw, 32px)', fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.01em' }}>{m.title}</h2>
              <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.66)', lineHeight: 1.65, margin: 0 }}>{m.framing}</p>
              <div style={{ marginTop: 16, display: 'inline-flex', alignItems: 'center', gap: 8, color: '#9db4ff', fontSize: 13.5, fontWeight: 700 }}>
                <Ico d="M6 4l14 8-14 8z" size={14} fill="#9db4ff" stroke="none" /> {chrome.watchTutorial}
              </div>
            </div>
            <div style={{ flex: '1 1 420px', minWidth: 300 }}>
              <TutorialVideo video={m.video} title={m.title} />
            </div>
          </div>
        ))}
      </section>

      {/* Fascia "tutto incluso" */}
      <section style={{ maxWidth: 900, margin: '40px auto 0', padding: '0 24px' }}>
        <div className="glass-card-static" style={{ padding: '22px 26px', display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', textAlign: 'center', flexWrap: 'wrap', border: `1px solid ${GREEN}33` }}>
          <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico d="M20 6 9 17l-5-5" size={18} stroke={GREEN} /></span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#e8edf7' }}>{chrome.included}</span>
        </div>
      </section>

      {/* CTA finale */}
      <section style={{ maxWidth: 760, margin: '0 auto', padding: '64px 24px 96px', textAlign: 'center' }}>
        <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(28px, 4.5vw, 40px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{chrome.finalH}</h2>
        <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.6)', marginTop: 14 }}>{chrome.finalSub}</p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 26 }}>
          <Link href="/register" className="cta-btn" style={{ padding: '15px 32px', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 15.5, fontWeight: 800 }}>{chrome.finalCta} →</Link>
          <Link href="/demo" style={{ padding: '15px 32px', borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontSize: 15.5, fontWeight: 700 }}>▶ {chrome.watchDemo}</Link>
        </div>
      </section>

      {/* Footer */}
      <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,0.45)' }}>
          <span style={{ fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>LyftAI</span>
          <span>© {new Date().getFullYear()} · {chrome.rights}</span>
          <div style={{ flex: 1 }} />
          <Link href="/welcome" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>{chrome.backToSite}</Link>
          <Link href="/privacy" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Privacy</Link>
          <Link href="/terms" style={{ color: 'rgba(255,255,255,0.55)', textDecoration: 'none' }}>Terms</Link>
        </div>
      </footer>
    </main>
  )
}
