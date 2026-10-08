'use client'

// Board del funnel in stile Motore Creativo: tela infinita a pallini, zoom
// con la rotella ancorato al cursore, spostamento trascinando il fondo (o con
// spazio/Alt/tasto centrale), "Centra" che inquadra tutto. Quattro gruppi
// affiancati, uno per fase del funnel, con intestazione colorata (nome,
// creative, quota di spesa) e le schede in griglia sotto: immagine, nome,
// campagna, spesa e ROAS. Clic sulla scheda = dettaglio di sempre.
//
// Qui non c'e' selezione a rettangolo (non ci sono azioni in blocco), quindi
// trascinare il fondo SPOSTA: e' il gesto che uno si aspetta su una mappa.

import { useCallback, useEffect, useRef, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { soldi } from '../../lib/client/soldi'
import { num } from '../../lib/client/numeri'
import { STADI, COLORE_FASE } from '../../lib/creative/stadio'

const MIN = 0.15, MAX = 2.5
const SOGLIA = 4 // px sotto i quali il gesto e' un clic

function immagineDi(row) {
  return row?.thumbnail_url || row?.display_image_url || row?.image_url || row?.creative_image_url || row?.preview_image_url
    || (Array.isArray(row?.products) ? row.products.find(p => p?.image_url)?.image_url : '') || ''
}

const CSS = `
.cfb-box{position:relative;height:min(78vh,820px);min-height:480px;overflow:hidden;border-radius:16px;border:1px solid var(--border);background-color:var(--surface);background-image:radial-gradient(var(--border2,rgba(128,128,128,.25)) 1px,transparent 1.2px);touch-action:none}
.cfb-contenuto{position:absolute;top:0;left:0;transform-origin:0 0;padding:48px;will-change:transform}
.cfb-albero{display:flex;align-items:flex-start;gap:36px}
.cfb-gruppo{display:flex;flex-direction:column;gap:14px;width:max-content;min-width:436px;padding:16px 16px 18px;border-radius:20px;border:1px solid var(--border);background:var(--glass)}
.cfb-testa{display:flex;align-items:baseline;gap:12px;flex-wrap:wrap}
.cfb-testa h3{font-size:14.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin:0;display:flex;align-items:center;gap:8px}
.cfb-testa h3 i{display:inline-block;width:10px;height:10px;border-radius:6px}
.cfb-testa .meta{font-size:11.5px;letter-spacing:.06em;color:var(--text3);font-variant-numeric:tabular-nums}
.cfb-griglia{display:flex;flex-wrap:wrap;gap:14px;align-items:flex-start;max-width:436px}
.cfb-vuoto{color:var(--text3);font-size:13px;padding:18px 4px;max-width:360px;line-height:1.45}
.cfb-scheda{position:relative;flex:0 0 196px;width:196px;border-radius:16px;overflow:hidden;border:1px solid var(--border);background:var(--surface);cursor:pointer;transition:transform .25s cubic-bezier(.16,1,.3,1),border-color .25s;user-select:none}
.cfb-scheda:hover{transform:translateY(-3px);border-color:var(--border3,var(--border))}
.cfb-scheda .fascia{position:absolute;top:0;left:0;right:0;height:3px;z-index:2}
.cfb-scheda .foto{aspect-ratio:1/1;background:var(--glass);display:grid;place-items:center;overflow:hidden}
.cfb-scheda .foto img{width:100%;height:100%;object-fit:cover;display:block;pointer-events:none}
.cfb-scheda .corpo{padding:10px 12px 12px;display:flex;flex-direction:column;gap:4px}
.cfb-scheda h4{margin:0;font-size:13px;font-weight:650;color:var(--text);line-height:1.3;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical}
.cfb-scheda .camp{font-size:11px;color:var(--text3);overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.cfb-scheda .numeri{display:flex;justify-content:space-between;gap:8px;margin-top:4px;font-size:13px;color:var(--text);font-variant-numeric:tabular-nums}
.cfb-scheda .numeri small{display:block;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:var(--text3);font-weight:640}
.cfb-comandi{position:absolute;right:16px;bottom:16px;display:flex;align-items:center;gap:6px;z-index:4;background:var(--glass2);border:1px solid var(--border);border-radius:12px;padding:6px;backdrop-filter:blur(10px)}
.cfb-comandi button{background:transparent;border:1px solid var(--border);color:var(--text2);width:30px;height:30px;border-radius:9px;cursor:pointer;font-size:15px;line-height:1}
.cfb-comandi button.testo{width:auto;padding:0 12px;font-size:12px;font-weight:640}
.cfb-comandi button:hover{background:var(--glass);color:var(--text)}
.cfb-comandi .mono{font-size:12px;color:var(--text3);min-width:44px;text-align:center;font-variant-numeric:tabular-nums}
.cfb-aiuto{position:absolute;left:18px;bottom:18px;z-index:4;pointer-events:none;font-size:11.5px;color:var(--text3)}
`

export default function CreativeFunnelBoard({ rows, stadi, onSelect, fonteAI }) {
  const { t } = useI18n()
  const box = useRef(null)
  const [z, setZ] = useState(0.7)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [spazio, setSpazio] = useState(false)
  const trascino = useRef(null)
  const [inMano, setInMano] = useState(false)

  const NOMI = {
    top: t('cr.funnel.top', null, 'Scoperta'),
    middle: t('cr.funnel.middle', null, 'Considerazione'),
    lower: t('cr.funnel.lower', null, 'Conversione'),
    riattivazione: t('cr.funnel.riattivazione', null, 'Riattivazione'),
  }

  // Gruppi per fase, dentro ordinati per spesa.
  const gruppi = {}
  for (const st of STADI) gruppi[st] = []
  let spesaTot = 0
  for (const r of rows) {
    const st = stadi[r.ad_id || r.id]?.stadio || 'top'
    gruppi[st].push(r); spesaTot += Number(r.spend) || 0
  }
  for (const st of STADI) gruppi[st].sort((a, b) => (Number(b.spend) || 0) - (Number(a.spend) || 0))

  // Zoom ancorato al cursore: si sposta anche l'origine, cosi' il punto sotto
  // il mouse resta fermo. Listener a mano con passive:false, o il browser
  // ignora preventDefault e scorre la pagina.
  const rotella = useCallback((e) => {
    e.preventDefault()
    const r = box.current?.getBoundingClientRect()
    if (!r) return
    const cx = e.clientX - r.left, cy = e.clientY - r.top
    setZ(prec => {
      const nuovo = Math.min(MAX, Math.max(MIN, prec * (e.deltaY < 0 ? 1.12 : 1 / 1.12)))
      if (nuovo === prec) return prec
      setPan(p => ({ x: cx - (cx - p.x) * (nuovo / prec), y: cy - (cy - p.y) * (nuovo / prec) }))
      return nuovo
    })
  }, [])
  useEffect(() => {
    const el = box.current; if (!el) return
    el.addEventListener('wheel', rotella, { passive: false })
    return () => el.removeEventListener('wheel', rotella)
  }, [rotella])

  useEffect(() => {
    const giuT = (e) => {
      if (e.code !== 'Space' || e.repeat) return
      const tg = e.target
      if (tg && (tg.tagName === 'INPUT' || tg.tagName === 'TEXTAREA' || tg.isContentEditable)) return
      e.preventDefault(); setSpazio(true)
    }
    const suT = (e) => { if (e.code === 'Space') setSpazio(false) }
    const persa = () => setSpazio(false)
    window.addEventListener('keydown', giuT); window.addEventListener('keyup', suT); window.addEventListener('blur', persa)
    return () => { window.removeEventListener('keydown', giuT); window.removeEventListener('keyup', suT); window.removeEventListener('blur', persa) }
  }, [])

  // "Centra" inquadra la larghezza e allinea in alto.
  const centra = useCallback(() => {
    const b = box.current, c = b?.querySelector('.cfb-contenuto')?.firstElementChild
    if (!b || !c) { setZ(0.7); setPan({ x: 0, y: 0 }); return }
    const m = 32
    const zx = (b.clientWidth - m * 2) / (c.scrollWidth || 1)
    const zy = (b.clientHeight - m * 2) / (c.scrollHeight || 1)
    const stipato = zy < zx * 0.55
    setZ(Math.max(MIN, Math.min(MAX, stipato ? Math.min(zx, 1) : Math.min(zx, zy))))
    setPan({ x: m, y: m })
  }, [])
  useEffect(() => { const id = requestAnimationFrame(centra); return () => cancelAnimationFrame(id) }, [centra, rows.length])

  const giu = (e) => {
    if (e.button === 2) return
    if (e.target.closest('button, a, input, select, textarea, label')) return
    const scheda = e.target.closest('.cfb-scheda')
    trascino.current = { x: e.clientX - pan.x, y: e.clientY - pan.y, x0: e.clientX, y0: e.clientY, scheda, mosso: false }
    box.current?.setPointerCapture?.(e.pointerId)
  }
  const muovi = (e) => {
    const tr = trascino.current
    if (!tr) return
    if (!tr.mosso && Math.abs(e.clientX - tr.x0) <= SOGLIA && Math.abs(e.clientY - tr.y0) <= SOGLIA) return
    tr.mosso = true; setInMano(true)
    setPan({ x: e.clientX - tr.x, y: e.clientY - tr.y })
  }
  const su = () => {
    const tr = trascino.current
    trascino.current = null; setInMano(false)
    if (!tr) return
    // clic secco su una scheda = apri il dettaglio
    if (!tr.mosso && tr.scheda) {
      const id = tr.scheda.dataset.id
      const row = rows.find(r => String(r.ad_id || r.id) === id)
      if (row) onSelect?.(row)
    }
  }
  const passo = (v) => setZ(p => Math.min(MAX, Math.max(MIN, p + v)))

  return (
    <div className="cfb-box" ref={box}
      onPointerDown={giu} onPointerMove={muovi} onPointerUp={su} onPointerCancel={su}
      style={{
        backgroundSize: `${24 * z}px ${24 * z}px`,
        backgroundPosition: `${pan.x}px ${pan.y}px`,
        cursor: inMano ? 'grabbing' : spazio ? 'grab' : 'default',
      }}>
      <style>{CSS}</style>
      <div className="cfb-contenuto" style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${z})` }}>
        <div className="cfb-albero">
          {STADI.map(st => {
            const lista = gruppi[st]
            const spesa = lista.reduce((s, r) => s + (Number(r.spend) || 0), 0)
            const quota = spesaTot ? (spesa / spesaTot) * 100 : 0
            return (
              <section className="cfb-gruppo" key={st} style={{ borderColor: `${COLORE_FASE[st]}55` }}>
                <div className="cfb-testa">
                  <h3 style={{ color: COLORE_FASE[st] }}><i style={{ background: COLORE_FASE[st] }} />{NOMI[st]}</h3>
                  <span className="meta">{t('cr.funnel.etichetta', { n: lista.length, pct: num(quota, 0) }, `${lista.length} creative · ${num(quota, 0)}%`)} · {soldi(spesa)}</span>
                </div>
                {lista.length === 0 ? (
                  <div className="cfb-vuoto">{t('cr.board.vuoto', null, 'Nessuna creatività in questa fase nel periodo.')}</div>
                ) : (
                  <div className="cfb-griglia">
                    {lista.map(row => {
                      const id = row.ad_id || row.id
                      const img = immagineDi(row)
                      const fonte = stadi[id]?.fonte
                      return (
                        <article className="cfb-scheda" key={id} data-id={id} title={fonte ? '' : t('cr.funnel.fonteIpotesi', null, 'ipotesi: nessun segnale')}>
                          <div className="fascia" style={{ background: COLORE_FASE[st] }} />
                          <div className="foto">
                            {img ? <img src={img} alt="" draggable={false} loading="lazy" />
                              : <span style={{ color: 'var(--text3)', fontSize: 11.5 }}>{t('cr.noPreview', null, 'Nessuna anteprima')}</span>}
                          </div>
                          <div className="corpo">
                            <h4>{row.name || id}</h4>
                            <div className="camp">{row.campaign_name || ''}</div>
                            <div className="numeri">
                              <span><small>{t('cr.spend', null, 'Spesa')}</small>{soldi(Number(row.spend) || 0)}</span>
                              <span style={{ textAlign: 'right' }}><small>ROAS</small>{num(Number(row.roas) || 0, 2)}</span>
                              <span style={{ textAlign: 'right' }}><small>{t('cr.orders', null, 'Ordini')}</small>{num(Number(row.purchases || row.orders) || 0)}</span>
                            </div>
                          </div>
                        </article>
                      )
                    })}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      </div>

      <div className="cfb-comandi">
        <button type="button" onClick={() => passo(-0.15)} aria-label="−">−</button>
        <span className="mono">{Math.round(z * 100)}%</span>
        <button type="button" onClick={() => passo(0.15)} aria-label="+">+</button>
        <button type="button" className="testo" onClick={centra}>{t('cr.board.centra', null, 'Centra')}</button>
      </div>
      <div className="cfb-aiuto">
        {t('cr.board.aiuto', null, 'Trascina per spostare · rotella per ingrandire · clic su una scheda per aprirla')}
        {fonteAI === 'loading' && <> · {t('cr.funnel.aiInCorso', null, 'L\'AI sta classificando le creative senza segnali…')}</>}
      </div>
    </div>
  )
}
