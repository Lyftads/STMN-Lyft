import Link from 'next/link'
import { getArea, getMarketing } from '../../../lib/marketing/solutions'
import { findArticle } from '../../../lib/help/content'
import { HELP_VIDEOS } from '../../../lib/help/videos'
import TutorialVideo from './TutorialVideo'
import LangSwitch from './LangSwitch'
import Reveal from './Reveal'

const ACCENT = '#bf5af2'
const BLUE = '#3b82f6'
const GREEN = '#22c55e'
const RED = '#f87171'

function framing(art) {
  const p = (art?.sections || []).find(s => s.p)?.p || ''
  const first = p.split(/(?<=\.)\s+/)[0] || ''
  return first.length > 175 ? first.slice(0, 172).trim() + '…' : first
}

function Ico({ d, size = 18, stroke = 'currentColor', fill = 'none' }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={stroke} strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{d.split(' M').map((seg, i) => <path key={i} d={(i ? 'M' : '') + seg} />)}</svg>
}

function Shot({ poster, alt, glow = ACCENT }) {
  return (
    <div style={{ position: 'relative' }}>
      <div aria-hidden style={{ position: 'absolute', inset: -28, borderRadius: '50%', background: `radial-gradient(circle, ${glow}30, transparent 68%)`, filter: 'blur(38px)', zIndex: 0 }} />
      <div className="sol-float" style={{ position: 'relative', zIndex: 1, borderRadius: 16, overflow: 'hidden', border: '1px solid rgba(255,255,255,0.12)', boxShadow: '0 30px 70px rgba(0,0,0,0.55)', background: '#0a0a14' }}>
        {poster
          ? <img src={poster} alt={alt} loading="lazy" style={{ display: 'block', width: '100%', aspectRatio: '16 / 10', objectFit: 'cover' }} />
          : <div style={{ width: '100%', aspectRatio: '16 / 10' }} />}
      </div>
    </div>
  )
}

export default function SolutionPage({ area, lang = 'it' }) {
  const ar = getArea(area)
  if (!ar) return null
  const { chrome, hero } = getMarketing(area, lang)

  const modules = ar.modules
    .map(id => {
      const art = findArticle(id, lang)
      const video = HELP_VIDEOS[id]
      if (!art) return null
      return { id, title: art.title, summary: art.summary, framing: framing(art), video }
    })
    .filter(Boolean)

  const heroMod = modules.find(m => m.id === ar.hero) || modules[0]
  const rest = modules.filter(m => m !== heroMod)
  const showcase = rest.slice(0, 3)
  const grid = rest.slice(3)

  return (
    <main style={{ position: 'relative', minHeight: '100vh', color: '#fff', fontFamily: 'Barlow, system-ui, sans-serif', background: '#000', overflow: 'hidden' }}>
      <style>{`
        .reveal { opacity: 0; transform: translateY(40px); transition: opacity 1s cubic-bezier(0.16,1,0.3,1), transform 1s cubic-bezier(0.16,1,0.3,1); }
        .reveal.in { opacity: 1; transform: translateY(0); }
        .reveal-blur { opacity: 0; filter: blur(14px); transform: translateY(20px); transition: opacity 1.1s, filter 1.1s, transform 1.1s; }
        .reveal-blur.in { opacity: 1; filter: blur(0); transform: translateY(0); }
        @keyframes solFloat { 0%,100%{ transform: translateY(0); } 50%{ transform: translateY(-9px); } }
        .sol-float { animation: solFloat 7s ease-in-out infinite; }
        .sol-link { transition: color 200ms ease; }
        .sol-link:hover { color: #fff; }
        .sol-card { transition: border-color 200ms ease, transform 200ms ease; }
        .sol-card:hover { border-color: rgba(191,90,242,0.45) !important; transform: translateY(-3px); }
        @media (prefers-reduced-motion: reduce){ .sol-float{ animation: none; } .reveal,.reveal-blur,.sol-card{ transition: none; } }
      `}</style>

      {/* Sfondo nero + orb ambientali (come la home) */}
      <div aria-hidden style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-12%', left: '-10%', width: '52vw', height: '52vw', borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}33, ${ACCENT}0d 42%, transparent 70%)`, filter: 'blur(30px)' }} />
        <div style={{ position: 'absolute', bottom: '-14%', right: '-12%', width: '50vw', height: '50vw', borderRadius: '50%', background: `radial-gradient(circle, ${BLUE}30, ${BLUE}0d 42%, transparent 70%)`, filter: 'blur(30px)' }} />
        <div style={{ position: 'absolute', top: '42%', left: '50%', width: '34vw', height: '34vw', transform: 'translateX(-50%)', borderRadius: '50%', background: `radial-gradient(circle, ${GREEN}18, transparent 70%)`, filter: 'blur(40px)' }} />
        <div style={{ position: 'absolute', inset: 0, background: 'radial-gradient(ellipse at center, transparent 35%, rgba(0,0,0,0.78) 100%)' }} />
      </div>

      <div style={{ position: 'relative', zIndex: 1 }}>
        {/* Header */}
        <header style={{ position: 'sticky', top: 0, zIndex: 50, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(18px)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '12px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <Link href="/welcome" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none', color: '#fff', fontWeight: 900, fontSize: 19, letterSpacing: '-0.02em' }}>
              <img src="/chat-192.png" alt="LyftAI" width={26} height={26} style={{ borderRadius: 7 }} /> LyftAI
            </Link>
            <Link href="/welcome" className="sol-link" style={{ fontSize: 13, color: 'rgba(255,255,255,0.55)', textDecoration: 'none', fontWeight: 600 }}>← {chrome.backToSite}</Link>
            <div style={{ flex: 1 }} />
            <LangSwitch current={lang} />
            <Link href="/login" className="sol-link" style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.8)', textDecoration: 'none', fontWeight: 600 }}>{chrome.login}</Link>
            <Link href="/register" className="cta-btn" style={{ padding: '9px 18px', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 13.5, fontWeight: 800 }}>{chrome.freeTrial}</Link>
          </div>
        </header>

        {/* Hero */}
        <section style={{ maxWidth: 980, margin: '0 auto', padding: '92px 24px 24px', textAlign: 'center' }}>
          <Reveal>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 9, padding: '7px 16px', borderRadius: 999, background: 'rgba(191,90,242,0.10)', border: `1px solid ${ACCENT}40`, color: '#d9c2ff', fontSize: 12, fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase' }}>
              <Ico d={ar.icon} size={15} stroke={ACCENT} /> {hero?.eyebrow || ar.id}
            </div>
            <h1 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(40px, 7vw, 68px)', fontWeight: 800, color: '#fff', margin: '22px 0 0', lineHeight: 1.02, letterSpacing: '-0.025em' }}>{hero?.h1}</h1>
            <p style={{ fontSize: 'clamp(16px, 2.2vw, 19px)', color: 'rgba(255,255,255,0.62)', maxWidth: 700, margin: '20px auto 0', lineHeight: 1.6 }}>{hero?.sub}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 30 }}>
              <Link href="/register" className="cta-btn" style={{ padding: '15px 30px', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 15.5, fontWeight: 800, boxShadow: '0 16px 50px rgba(123,91,255,0.35)' }}>{chrome.freeTrial}</Link>
              <Link href="/demo" style={{ padding: '15px 30px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontSize: 15.5, fontWeight: 700 }}>▶ {chrome.watchDemo}</Link>
            </div>
          </Reveal>
        </section>

        {/* Video featured (UNO) */}
        {heroMod?.video?.src && (
          <section style={{ maxWidth: 900, margin: '0 auto', padding: '24px' }}>
            <Reveal variant="blur">
              <div style={{ textAlign: 'center', marginBottom: 18 }}>
                <div style={{ fontSize: 12, color: ACCENT, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase' }}>{chrome.featured}</div>
                <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 800, color: '#fff', margin: '8px 0 0' }}>{heroMod.title}</h2>
              </div>
              <div style={{ position: 'relative' }}>
                <div aria-hidden style={{ position: 'absolute', inset: -40, borderRadius: '50%', background: `radial-gradient(circle, ${ACCENT}30, transparent 66%)`, filter: 'blur(50px)', zIndex: 0 }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <TutorialVideo video={heroMod.video} title={heroMod.title} />
                </div>
              </div>
            </Reveal>
          </section>
        )}

        {/* PAS: problema / soluzione */}
        {hero?.problem && hero?.solution && (
          <section style={{ maxWidth: 1000, margin: '0 auto', padding: '48px 24px 24px' }}>
            <Reveal>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 280, background: 'rgba(248,113,113,0.05)', border: '1px solid rgba(248,113,113,0.20)', borderRadius: 18, padding: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: RED, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}><Ico d="M12 9v4 M12 17h.01 M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" size={15} stroke={RED} /> {chrome.problemLabel}</div>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, margin: 0 }}>{hero.problem}</p>
                </div>
                <div style={{ flex: 1, minWidth: 280, background: 'rgba(34,197,94,0.05)', border: '1px solid rgba(34,197,94,0.20)', borderRadius: 18, padding: 26 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: GREEN, fontSize: 11.5, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 12 }}><Ico d="M20 6 9 17l-5-5" size={15} stroke={GREEN} /> {chrome.solutionLabel}</div>
                  <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.78)', lineHeight: 1.65, margin: 0 }}>{hero.solution}</p>
                </div>
              </div>
            </Reveal>
          </section>
        )}

        {/* Showcase: screenshot reali (poster) + descrizione, alternati */}
        {showcase.length > 0 && (
          <section style={{ maxWidth: 1140, margin: '0 auto', padding: '40px 24px 8px', display: 'flex', flexDirection: 'column', gap: 'clamp(56px, 8vw, 96px)' }}>
            {showcase.map((m, i) => {
              const glow = i % 2 ? BLUE : ACCENT
              return (
                <Reveal key={m.id} variant="blur">
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'clamp(28px, 5vw, 64px)', alignItems: 'center', flexDirection: i % 2 ? 'row-reverse' : 'row' }}>
                    <div style={{ flex: '1 1 320px', minWidth: 280 }}>
                      <div style={{ fontSize: 12, color: glow === BLUE ? '#9db4ff' : '#d9c2ff', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>{m.summary}</div>
                      <h3 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(24px, 3.6vw, 34px)', fontWeight: 800, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.015em', lineHeight: 1.05 }}>{m.title}</h3>
                      <p style={{ fontSize: 15.5, color: 'rgba(255,255,255,0.66)', lineHeight: 1.65, margin: 0 }}>{m.framing}</p>
                    </div>
                    <div style={{ flex: '1 1 440px', minWidth: 300 }}>
                      <Shot poster={m.video?.poster} alt={`${m.title} — schermata reale in LyftAI`} glow={glow} />
                    </div>
                  </div>
                </Reveal>
              )
            })}
          </section>
        )}

        {/* Inside: griglia dei moduli restanti */}
        {grid.length > 0 && (
          <section style={{ maxWidth: 1140, margin: '0 auto', padding: '64px 24px 8px' }}>
            <Reveal><h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, color: '#fff', textAlign: 'center', margin: '0 0 28px', letterSpacing: '-0.02em' }}>{chrome.inside}</h2></Reveal>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
              {grid.map((m, i) => (
                <Reveal key={m.id} delay={i * 70}>
                  <div className="sol-card glass-card-static" style={{ padding: 22, height: '100%', borderRadius: 16 }}>
                    <span style={{ display: 'inline-flex', width: 38, height: 38, borderRadius: 11, background: 'rgba(191,90,242,0.14)', border: `1px solid ${ACCENT}44`, alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}><Ico d="M20 6 9 17l-5-5" size={18} stroke={ACCENT} /></span>
                    <div style={{ fontSize: 16.5, fontWeight: 800, color: '#fff', marginBottom: 7 }}>{m.title}</div>
                    <div style={{ fontSize: 13.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>{m.summary}</div>
                  </div>
                </Reveal>
              ))}
            </div>
          </section>
        )}

        {/* Comparison: Senza / Con LyftAI */}
        <section style={{ maxWidth: 880, margin: '0 auto', padding: '72px 24px 8px' }}>
          <Reveal>
            <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(26px, 4vw, 38px)', fontWeight: 800, color: '#fff', textAlign: 'center', margin: '0 0 26px', letterSpacing: '-0.02em' }}>{chrome.compareTitle}</h2>
            <div className="glass-card-static" style={{ borderRadius: 18, overflow: 'hidden', padding: 0 }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1.1fr 1fr 1fr', alignItems: 'stretch' }}>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)' }} />
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', borderLeft: '1px solid rgba(255,255,255,0.06)', fontSize: 12.5, fontWeight: 800, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{chrome.withoutLabel}</div>
                <div style={{ padding: '14px 18px', borderBottom: '1px solid rgba(255,255,255,0.08)', background: 'rgba(191,90,242,0.07)', fontSize: 12.5, fontWeight: 800, color: '#d9c2ff', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{chrome.withLabel}</div>
                {(chrome.compare || []).map((row, i) => (
                  <div key={i} style={{ display: 'contents' }}>
                    <div style={{ padding: '15px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', fontSize: 13.5, fontWeight: 700, color: '#fff' }}>{row.k}</div>
                    <div style={{ padding: '15px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', borderLeft: '1px solid rgba(255,255,255,0.06)', fontSize: 13.5, color: 'rgba(255,255,255,0.5)' }}>{row.a}</div>
                    <div style={{ padding: '15px 18px', borderTop: '1px solid rgba(255,255,255,0.05)', background: 'rgba(191,90,242,0.05)', fontSize: 13.5, color: '#e8edf7', display: 'flex', alignItems: 'flex-start', gap: 8 }}><span style={{ color: GREEN, flexShrink: 0, marginTop: 2 }}><Ico d="M20 6 9 17l-5-5" size={14} stroke={GREEN} /></span>{row.b}</div>
                  </div>
                ))}
              </div>
            </div>
          </Reveal>
        </section>

        {/* Stats */}
        <section style={{ maxWidth: 1000, margin: '0 auto', padding: '72px 24px 8px' }}>
          <Reveal>
            <div style={{ fontSize: 12, color: ACCENT, fontWeight: 800, letterSpacing: '0.1em', textTransform: 'uppercase', textAlign: 'center', marginBottom: 22 }}>{chrome.statsTitle}</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
              {(chrome.stats || []).map((s, i) => (
                <div key={i} className="glass-card-static" style={{ borderRadius: 16, padding: '22px 18px', textAlign: 'center' }}>
                  <div style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(32px, 5vw, 44px)', fontWeight: 800, lineHeight: 1, background: `linear-gradient(135deg, #fff, ${i % 2 ? BLUE : ACCENT})`, WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent' }}>{s.v}</div>
                  <div style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.6)', marginTop: 8, lineHeight: 1.4 }}>{s.l}</div>
                </div>
              ))}
            </div>
          </Reveal>
        </section>

        {/* Fascia "tutto incluso" */}
        <section style={{ maxWidth: 880, margin: '56px auto 0', padding: '0 24px' }}>
          <Reveal>
            <div style={{ padding: '22px 26px', borderRadius: 18, display: 'flex', alignItems: 'center', gap: 14, justifyContent: 'center', textAlign: 'center', flexWrap: 'wrap', background: 'rgba(34,197,94,0.06)', border: `1px solid ${GREEN}30` }}>
              <span style={{ width: 36, height: 36, borderRadius: 10, background: 'rgba(34,197,94,0.14)', display: 'grid', placeItems: 'center', flexShrink: 0 }}><Ico d="M20 6 9 17l-5-5" size={18} stroke={GREEN} /></span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#e8edf7' }}>{chrome.included}</span>
            </div>
          </Reveal>
        </section>

        {/* CTA finale */}
        <section style={{ maxWidth: 760, margin: '0 auto', padding: '80px 24px 110px', textAlign: 'center' }}>
          <Reveal>
            <h2 style={{ fontFamily: 'Barlow Condensed, sans-serif', fontSize: 'clamp(30px, 5vw, 46px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.02em' }}>{chrome.finalH}</h2>
            <p style={{ fontSize: 16, color: 'rgba(255,255,255,0.58)', marginTop: 14 }}>{chrome.finalSub}</p>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', marginTop: 28 }}>
              <Link href="/register" className="cta-btn" style={{ padding: '16px 34px', borderRadius: 999, background: `linear-gradient(135deg, ${ACCENT}, ${BLUE})`, color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 800, boxShadow: '0 16px 50px rgba(123,91,255,0.35)' }}>{chrome.finalCta} →</Link>
              <Link href="/demo" style={{ padding: '16px 34px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', color: '#fff', textDecoration: 'none', fontSize: 16, fontWeight: 700 }}>▶ {chrome.watchDemo}</Link>
            </div>
          </Reveal>
        </section>

        {/* Footer */}
        <footer style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ maxWidth: 1200, margin: '0 auto', padding: '22px 24px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', fontSize: 12.5, color: 'rgba(255,255,255,0.42)' }}>
            <span style={{ fontWeight: 800, color: 'rgba(255,255,255,0.7)' }}>LyftAI</span>
            <span>© {new Date().getFullYear()} · {chrome.rights}</span>
            <div style={{ flex: 1 }} />
            <Link href="/welcome" className="sol-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>{chrome.backToSite}</Link>
            <Link href="/privacy" className="sol-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Privacy</Link>
            <Link href="/terms" className="sol-link" style={{ color: 'rgba(255,255,255,0.5)', textDecoration: 'none' }}>Terms</Link>
          </div>
        </footer>
      </div>
    </main>
  )
}
