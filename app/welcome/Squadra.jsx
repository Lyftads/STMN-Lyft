'use client'

// Le due sezioni sul lavoro del team (Marino, 21 set 2026: «della sezione Productivity AI non hai
// fatto vedere nulla» e «una sezione con la chat, bella dinamica, che fa vedere una conversazione
// in stile tempo reale»).
//
// - Produttivita: le schede a sinistra avanzano da sole, con la barra che si riempie (come «Crea
//   rapidamente» su shopify.com); a destra la schermata della tab, dalla demo. Si ferma fuori
//   schermo; un clic sceglie e fa ripartire il giro.
// - TempoReale: una finestra di LyftTalk dove i messaggi arrivano uno alla volta, con "sta
//   scrivendo…", le reazioni e il task preparato dal Cervello. E' una conversazione d'esempio e la
//   didascalia lo dice. La pagina nasce con la conversazione intera (chi non ha JavaScript o ha
//   chiesto meno movimento la legge tutta); quando la finestra entra nello schermo ricomincia.
import { Fragment, useEffect, useRef, useState } from 'react'
import Icon from '../components/ui/Icon'
import LogoMark from '../components/LogoMark'
import Immagini from './Immagini'
import s from './landing.module.css'

const DURATA = 6500   // quanto resta accesa ogni scheda
const calmo = () => typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function useVisibile(ref, soglia = 0.3) {
  const [visibile, setVisibile] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([v]) => setVisibile(v.isIntersecting), { threshold: soglia })
    io.observe(el)
    return () => io.disconnect()
  }, [ref, soglia])
  return visibile
}

export function Produttivita({ t, lang }) {
  const p = t.produttivita
  const radice = useRef(null)
  const visibile = useVisibile(radice)
  const [attiva, setAttiva] = useState(0)
  const [giro, setGiro] = useState(0)
  const [fermo, setFermo] = useState(false)
  useEffect(() => { setFermo(calmo()) }, [])
  useEffect(() => {
    if (!visibile || fermo) return
    const id = setTimeout(() => setAttiva(a => (a + 1) % p.voci.length), DURATA)
    return () => clearTimeout(id)
  }, [attiva, giro, visibile, fermo, p.voci.length])
  const scegli = (i) => { setAttiva(i); setGiro(g => g + 1) }
  return (
    <section id="produttivita" className={s.sezione}>
      <div className={s.largo}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{p.etichetta}</p>
          <h2 className={s.h2}>{p.titolo}</h2>
          <p className={s.sotto}>{p.sotto}</p>
        </div>
        <div ref={radice} className={s.schede}>
          <div className={s.schedeElenco} role="tablist" aria-label={p.etichetta}>
            {p.voci.map((v, i) => (
              <button key={v.id} type="button" role="tab" aria-selected={i === attiva} className={`${s.scheda} ${i === attiva ? s.schedaAttiva : ''}`} onClick={() => scegli(i)}>
                <span className={s.schedaTitolo}>{v.titolo}</span>
                <span className={s.schedaTesto}>{v.testo}</span>
                <span className={s.schedaBarra} aria-hidden="true">
                  {i === attiva && <i key={`${attiva}-${giro}`} style={{ animationDuration: `${DURATA}ms`, animationPlayState: visibile && !fermo ? 'running' : 'paused' }} />}
                </span>
              </button>
            ))}
          </div>
          <div className={s.cornice} role="tabpanel">
            <div className={s.schermoFoto}>
              {p.voci.map((v, i) => (
                <Immagini key={v.id} lang={lang} id={v.id} alt={`${v.titolo} — ${v.testo}`} className={i === attiva ? s.fotoAttiva : ''} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}

// @nome in grassetto, come le menzioni in LyftTalk.
function conMenzioni(testo) {
  return testo.split(/(@\S+)/g).map((pezzo, i) => (pezzo.startsWith('@') ? <strong key={i} className={s.ltMenzione}>{pezzo}</strong> : <Fragment key={i}>{pezzo}</Fragment>))
}

function Avatar({ m }) {
  // Il Cervello ha il segno di LyftAI: e' il prodotto che parla.
  if (m.ai) return <span className={`${s.ltAvatar} ${s.ltAvatarAi}`} aria-hidden="true"><LogoMark size={24} withGlow={false} /></span>
  return <span className={s.ltAvatar} aria-hidden="true">{m.chi.slice(0, 1)}</span>
}

export function TempoReale({ t, lang }) {
  const c = t.tempoReale
  const radice = useRef(null)
  const visibile = useVisibile(radice, 0.35)
  const [n, setN] = useState(c.messaggi.length)           // quanti messaggi si vedono
  const [scrive, setScrive] = useState(null)               // chi sta scrivendo
  const [reazioni, setReazioni] = useState(() => new Set(c.messaggi.map((_, i) => i)))
  const [giro, setGiro] = useState(0)
  const [ore, setOre] = useState(null)                     // gli orari: solo nel browser, niente differenze col server
  const corpo = useRef(null)

  useEffect(() => {
    const adesso = Date.now()
    const f = new Intl.DateTimeFormat(lang, { hour: '2-digit', minute: '2-digit' })
    setOre(c.messaggi.map((_, i) => f.format(new Date(adesso - (c.messaggi.length - i) * 60000))))
  }, [c, lang])

  useEffect(() => {
    if (!visibile || calmo()) return
    let vivo = true
    const timer = []
    const dopo = (ms, fn) => timer.push(setTimeout(() => { if (vivo) fn() }, ms))
    setN(0); setScrive(null); setReazioni(new Set())
    let tempo = 700
    c.messaggi.forEach((m, i) => {
      dopo(tempo, () => setScrive(m))
      tempo += m.ai ? 1900 : 1200
      dopo(tempo, () => { setScrive(null); setN(i + 1) })
      if (m.reazioni) dopo(tempo + 1000, () => setReazioni(r => new Set(r).add(i)))
      tempo += 1400 + Math.min(2600, m.testo.length * 16)
    })
    dopo(tempo + 5500, () => setGiro(g => g + 1))
    return () => { vivo = false; timer.forEach(clearTimeout) }
  }, [visibile, giro, c])

  // l'ultimo messaggio sempre in vista, come in una chat vera
  useEffect(() => { const el = corpo.current; if (el) el.scrollTop = el.scrollHeight }, [n, scrive, reazioni])

  const persone = [...new Set(c.messaggi.filter(m => !m.ai).map(m => m.chi))]
  const ai = c.messaggi.find(m => m.ai)
  return (
    <section id="tempo-reale" className={`${s.sezione} ${s.sezioneGrigia}`}>
      <div className={s.largo}>
        <div className={s.testaSezione} data-compare>
          <p className={s.etichetta}>{c.etichetta}</p>
          <h2 className={s.h2}>{c.titolo}</h2>
          <p className={s.sotto}>{c.sotto}</p>
        </div>
        <div ref={radice} className={s.lt}>
          <aside className={s.ltLato} aria-hidden="true">
            <p className={s.ltLatoTitolo}>LyftTalk</p>
            {c.canali.map(k => <span key={k} className={`${s.ltCanale} ${k === c.canale ? s.ltCanaleAttivo : ''}`}># {k}</span>)}
            <p className={s.ltLatoTitolo} style={{ marginTop: 18 }}>{c.online}</p>
            {ai && <span className={s.ltPersona}><span className={`${s.ltPallino} ${s.ltPallinoAi}`} />{ai.chi}</span>}
            {persone.map(p => <span key={p} className={s.ltPersona}><span className={s.ltPallino} />{p}</span>)}
          </aside>
          <div className={s.ltMain}>
            <div className={s.ltTesta}>
              <strong># {c.canale}</strong>
              <span className={s.ltOnline}><span className={s.ltPallino} />{persone.length + 1} {c.online}</span>
            </div>
            <div ref={corpo} className={s.ltMessaggi} aria-live="off">
              <p className={s.ltGiorno}><span>{c.oggi}</span></p>
              {c.messaggi.slice(0, n).map((m, i) => (
                <div key={`${giro}-${i}`} className={s.ltMsg}>
                  <Avatar m={m} />
                  <div className={s.ltMsgCorpo}>
                    <p className={s.ltIntestazione}>
                      <strong>{m.chi}</strong>
                      {m.ai ? <span className={s.ltBadge}>{c.ai}</span> : <span className={s.ltRuolo}>{m.ruolo}</span>}
                      {ore && <span className={s.ltOra}>{ore[i]}</span>}
                    </p>
                    <p className={s.ltTesto}>{conMenzioni(m.testo)}</p>
                    {m.scheda && (
                      <div className={s.ltScheda}>
                        <p className={s.ltSchedaTitolo}>{m.scheda.titolo}</p>
                        <div className={s.ltSchedaVoci}>
                          {m.scheda.voci.map(([et, val, prima]) => (
                            <div key={et}><span>{et}</span><strong>{val}</strong><em>{prima}</em></div>
                          ))}
                        </div>
                      </div>
                    )}
                    {m.task && (
                      <div className={s.ltTask}>
                        <span className={s.ltTaskCasella} aria-hidden="true" />
                        <div><p>{m.task.titolo}</p><span>{m.task.chi} · {m.task.quando}</span></div>
                      </div>
                    )}
                    {m.reazioni && reazioni.has(i) && (
                      <div className={s.ltReazioni}>
                        {m.reazioni.map(([e, q]) => <span key={e} className={s.ltReazione}>{e} {q}</span>)}
                      </div>
                    )}
                  </div>
                </div>
              ))}
              {scrive && (
                <div className={s.ltScrive}>
                  <span className={s.ltPuntini} aria-hidden="true"><i /><i /><i /></span>
                  <span><strong>{scrive.chi}</strong> {c.scrive}</span>
                </div>
              )}
            </div>
            <div className={s.ltComposer} aria-hidden="true">
              <span>{c.scrivi}</span>
              <span className={s.ltInvia}><Icon name="send" size={14} /></span>
            </div>
          </div>
        </div>
        <p className={s.ltNota}>{c.nota}</p>
      </div>
    </section>
  )
}
