'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { leggi } from '../../lib/clientCache'
import { soldi } from '../../lib/client/soldi'
import { miniatura } from '../../lib/client/miniatura'
import { usePilota } from './MissionControl'
import Icon from './ui/Icon'

// ============================================================================
//  IL FILM DELLA SETTIMANA — il report che si guarda invece di leggerlo (2ª versione).
//
//  Marino sulla prima: "lo stile e' quello vecchio, ogni slide e' piatta, non ci sono immagini,
//  grafici, descrizioni; non puoi fermarla e farla andare avanti". Quindi:
//   · stile dell'app (chiaro, schede, stessi caratteri): segue il tema, niente fondale viola;
//   · ogni quadro ha DUE meta': a sinistra il numero e UNA FRASE che lo spiega, a destra un
//     grafico o le foto dei prodotti;
//   · comandi veri e sempre in vista: indietro, pausa/riprendi, avanti, barre cliccabili,
//     contatore; da tastiera frecce, spazio, Esc. Il clic sul quadro non fa niente.
//  Ultima settimana CHIUSA (lun–dom) contro la precedente. Stessi numeri della Dashboard sullo
//  stesso periodo: /api/metrics (periodo personalizzato), /api/google-kpi, /api/meta-kpi, /api/cro.
// ============================================================================
const DURATA = 9000
const iso = (d) => d.toISOString().slice(0, 10)
const piu = (s, n) => { const d = new Date(`${s}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + n); return iso(d) }
function settimanaChiusa() {
  const o = new Date(); const oggi = new Date(Date.UTC(o.getFullYear(), o.getMonth(), o.getDate()))
  const lunedi = new Date(oggi); lunedi.setUTCDate(oggi.getUTCDate() - ((oggi.getUTCDay() + 6) % 7) - 7)
  return { since: iso(lunedi), until: piu(iso(lunedi), 6) }
}
const pct = (ora, prima) => (prima > 0 && ora != null ? ((ora - prima) / prima) * 100 : null)

function Conta({ a, formato }) {
  const [v, setV] = useState(0)
  useEffect(() => {
    if (a == null) return
    let vivo = true; const t0 = performance.now()
    const passo = (t) => { if (!vivo) return; const p = Math.min(1, (t - t0) / 1000), e = 1 - Math.pow(1 - p, 4); setV(a * e); if (p < 1) requestAnimationFrame(passo) }
    requestAnimationFrame(passo)
    return () => { vivo = false }
  }, [a])
  return <>{a == null ? '—' : formato(v)}</>
}

// ── I grafici: HTML e CSS, crescono all'ingresso ──
function Colonne({ serie, prima, etichette, formato, evidenzia }) {
  const tetto = Math.max(1, ...serie, ...(prima || []))
  return (
    <div className="flm-colonne">
      {serie.map((v, k) => (
        <div key={k} className={k === evidenzia ? 'top' : ''}>
          <span className="flm-col-val">{formato(v)}</span>
          <div className="flm-col-coppia">
            {prima && <i className="prima" style={{ '--h': `${(prima[k] / tetto) * 100}%`, '--r': `${k * 45}ms` }} />}
            <i style={{ '--h': `${(v / tetto) * 100}%`, '--r': `${k * 45 + 80}ms` }} />
          </div>
          <em>{etichette[k]}</em>
        </div>
      ))}
    </div>
  )
}
function Righe({ voci, formato }) {
  const tetto = Math.max(1, ...voci.map(v => v.valore))
  return (
    <ul className="flm-righe">
      {voci.map((v, k) => (
        <li key={k} className={v.foto !== undefined ? 'con-foto' : ''}>
          {v.foto !== undefined && (v.foto ? <img src={miniatura(v.foto, 120)} alt="" /> : <span className="flm-segnaposto" />)}
          <div><b>{v.nome}</b><i style={{ '--w': `${(v.valore / tetto) * 100}%`, '--r': `${k * 70}ms` }} /></div>
          <strong>{formato(v.valore)}{v.sotto && <small>{v.sotto}</small>}</strong>
        </li>
      ))}
    </ul>
  )
}
function Imbuto({ passi, loc }) {
  const base = passi[0]?.valore || 1
  return (
    <ul className="flm-imbuto">
      {passi.map((p, k) => (
        <li key={k}><span>{p.nome}</span><div><i style={{ '--w': `${Math.max(1.5, (p.valore / base) * 100)}%`, '--r': `${k * 110}ms` }} /></div><b>{p.testo}</b><em>{k ? `${((p.valore / base) * 100).toLocaleString(loc, { maximumFractionDigits: 2 })}%` : '100%'}</em></li>
      ))}
    </ul>
  )
}
function Rotta({ punti }) {
  const L = 600, A = 260, n = punti.length, tetto = Math.max(1, ...punti.map(p => p.alto ?? p.vero ?? 0)) * 1.05
  const x = (k) => (k / Math.max(1, n - 1)) * L, y = (v) => A - 8 - (v / tetto) * (A - 20)
  const iOggi = punti.findIndex(p => p.previsto != null && p.vero != null)
  const linea = (a) => a.map(([k, v], j) => `${j ? 'L' : 'M'}${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const veri = punti.map((p, k) => [k, p.vero]).filter(([, v]) => v != null)
  const fut = punti.map((p, k) => [k, p.previsto]).filter(([k, v]) => v != null && k >= iOggi); if (iOggi >= 0 && fut.length) fut[0] = [iOggi, punti[iOggi].vero]
  const alti = punti.map((p, k) => [k, p.alto]).filter(([k, v]) => v != null && k >= iOggi), bassi = punti.map((p, k) => [k, p.basso]).filter(([k, v]) => v != null && k >= iOggi)
  return (
    <svg className="flm-rotta" viewBox={`0 0 ${L} ${A}`} preserveAspectRatio="none" aria-hidden="true">
      {alti.length > 1 && <path className="fascia" d={`${linea(alti)}${bassi.slice().reverse().map(([k, v]) => `L${x(k).toFixed(1)},${y(v).toFixed(1)}`).join('')}Z`} />}
      {fut.length > 1 && <path className="previsto" d={linea(fut)} />}
      {veri.length > 1 && <path className="vero" pathLength="1" d={linea(veri)} />}
    </svg>
  )
}

export default function ReportFilm() {
  const { t, intlLocale } = useI18n()
  const [aperto, setAperto] = useState(false)
  const [dati, setDati] = useState(null)
  const [errore, setErrore] = useState(false)
  const [k, setK] = useState(0)
  const [pausa, setPausa] = useState(false)
  const pilota = usePilota().dati
  const periodo = useMemo(settimanaChiusa, [])

  useEffect(() => { const apri = () => { setK(0); setPausa(false); setAperto(true) }; window.addEventListener('lyft:film', apri); return () => window.removeEventListener('lyft:film', apri) }, [])

  useEffect(() => {
    if (!aperto || dati) return
    let vivo = true
    const p0 = piu(periodo.since, -7), p1 = piu(periodo.until, -7), q = `since=${periodo.since}&until=${periodo.until}`
    const sicuro = (u) => leggi(u).catch(() => null)
    Promise.all([leggi(`/api/metrics?preset=custom_${periodo.since}_${periodo.until}`), sicuro(`/api/metrics?preset=custom_${p0}_${p1}`), sicuro(`/api/google-kpi?preset=custom&${q}`), sicuro(`/api/meta-kpi?preset=custom&${q}`), sicuro(`/api/cro?${q}`), sicuro('/api/product-images')])
      .then(([m, mp, g, mk, cro, foto]) => { if (!vivo) return; if (!m || m.error || !m.shopifyRange) return setErrore(true); setDati({ m, mp, g, mk, cro, foto: foto || {} }) })
      .catch(() => vivo && setErrore(true))
    return () => { vivo = false }
  }, [aperto, dati, periodo])

  const quadri = useMemo(() => {
    if (!dati) return []
    const { m, mp, g, mk, cro, foto } = dati
    const s = m.shopifyRange || {}, sp = m.shopifyPrevRange || {}
    const e0 = (n) => soldi(n, 0), intero = (n) => Math.round(n).toLocaleString(intlLocale, { useGrouping: 'always' })
    const dec = (n, c = 1) => Number(n).toLocaleString(intlLocale, { maximumFractionDigits: c })
    const volte = (n) => `${Number(n).toLocaleString(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`
    const segno = (n) => (n == null ? '—' : `${n >= 0 ? '+' : '−'}${dec(Math.abs(n))}%`)
    const giornoLungo = (x) => new Intl.DateTimeFormat(intlLocale, { day: 'numeric', month: 'long' }).format(new Date(`${x}T12:00:00`))
    const nome = (j, stile) => new Intl.DateTimeFormat(intlLocale, { weekday: stile }).format(new Date(`${piu(periodo.since, j)}T12:00:00`))
    const nomiGiorni = Array.from({ length: 7 }, (_, j) => nome(j, 'short')), nomiLunghi = Array.from({ length: 7 }, (_, j) => nome(j, 'long'))
    const fotoDi = (n) => foto[n] || foto[String(n || '').toLowerCase()] || null
    const gg = m.shopifyDayBreakdown || [], ggP = mp?.shopifyDayBreakdown || []
    const fattG = gg.map(d => Number(d.revenue) || 0), fattGP = ggP.length === 7 ? ggP.map(d => Number(d.revenue) || 0) : null
    const ordG = gg.map(d => Number(d.orders) || 0), ordGP = ggP.length === 7 ? ggP.map(d => Number(d.orders) || 0) : null
    const iMax = (a) => a.indexOf(Math.max(...a))
    const aov = s.orders > 0 ? s.revenue / s.orders : null, aovP = sp.orders > 0 ? sp.revenue / sp.orders : null
    const spMeta = Number(m.metaRange?.spend) || 0, spGoogle = Number(g?.totals?.spend) || 0, spesa = spMeta + spGoogle
    const spesaP = (Number(m.metaPrevRange?.spend) || 0) + (Number(g?.prevTotals?.spend) || 0)
    const mer = spesa > 0 ? s.revenue / spesa : null, merP = spesaP > 0 ? sp.revenue / spesaP : null
    const spesaG = Array.from({ length: 7 }, (_, j) => { const d = piu(periodo.since, j); return (Number((mk?.daily || []).find(x => x.date === d)?.spend) || 0) + (Number((g?.daily || []).find(x => x.date === d)?.spend) || 0) })
    const prodotti = (m.shopifyTopProducts || []).slice(0, 5)
    const tutteFonti = m.shopifyMarketingSources || [], fonti = tutteFonti.slice(0, 5), totFonti = tutteFonti.reduce((a, f) => a + (Number(f.revenue) || 0), 0)
    const im = cro?.funnel, tr = pilota?.traiettoria, scorso = pilota?.meseScorso?.totale
    const mossa = (pilota?.mosse || []).find(x => x.stato === 'proposta' || x.stato === 'approvata')
    const legenda = [t('film.thisWeek', null, 'questa settimana'), t('film.weekBefore', null, 'settimana prima')]
    const quotaNuovi = s.revenue > 0 ? Math.round((s.fatturNC / s.revenue) * 100) : 0
    const q = []

    q.push({ tipo: 'copertina', occhiello: t('film.eyebrow', null, 'Il film della settimana'), titolo: `${giornoLungo(periodo.since)} — ${giornoLungo(periodo.until)}`,
      frase: t('film.sCover', { v: e0(s.revenue), o: intero(s.orders), n: intero(s.nc) }, `${e0(s.revenue)} di fatturato, ${intero(s.orders)} ordini, ${intero(s.nc)} clienti nuovi. Ecco com’è andata, quadro per quadro.`),
      mosaico: (m.shopifyTopProducts || []).map(p => fotoDi(p.label)).filter(Boolean).slice(0, 6) })

    q.push({ occhiello: t('dash.revenue', null, 'Fatturato'), valore: s.revenue, prima: sp.revenue, formato: e0,
      frase: fattG.length === 7 ? t('film.sRevenue', { o: segno(pct(s.orders, sp.orders)), a: segno(pct(aov, aovP)), g: nomiLunghi[iMax(fattG)], v: e0(Math.max(...fattG)) }, `Ordini ${segno(pct(s.orders, sp.orders))} e scontrino medio ${segno(pct(aov, aovP))} sulla settimana prima. Il giorno migliore: ${nomiLunghi[iMax(fattG)]}, ${e0(Math.max(...fattG))}.`) : null,
      grafico: fattG.length === 7 ? <Colonne serie={fattG} prima={fattGP} etichette={nomiGiorni} formato={e0} evidenzia={iMax(fattG)} /> : null, legenda: fattGP ? legenda : null })

    q.push({ occhiello: t('dash.orders', null, 'Ordini'), valore: s.orders, prima: sp.orders, formato: intero,
      frase: ordG.length === 7 ? t('film.sOrders', { m: dec(s.orders / 7), g: nomiLunghi[iMax(ordG)], n: Math.max(...ordG), a: aov ? soldi(aov, 2) : '—' }, `In media ${dec(s.orders / 7)} ordini al giorno; ${nomiLunghi[iMax(ordG)]} il più pieno con ${Math.max(...ordG)}. Scontrino medio ${aov ? soldi(aov, 2) : '—'}.`) : null,
      grafico: ordG.length === 7 ? <Colonne serie={ordG} prima={ordGP} etichette={nomiGiorni} formato={intero} evidenzia={iMax(ordG)} /> : null, legenda: ordGP ? legenda : null })

    q.push({ occhiello: t('dash.newCustomers', null, 'Nuovi clienti'), valore: s.nc, prima: sp.nc, formato: intero,
      frase: t('film.sCustomers', { p: quotaNuovi, vn: e0(s.fatturNC), r: intero(s.rc || 0), vr: e0(s.fatturRC) }, `Il ${quotaNuovi}% del fatturato viene da clienti nuovi (${e0(s.fatturNC)}). Sono tornati in ${intero(s.rc || 0)}, per ${e0(s.fatturRC)}.`),
      grafico: <Righe formato={e0} voci={[{ nome: t('dash.newCustomers', null, 'Nuovi clienti'), valore: Number(s.fatturNC) || 0, sotto: ` · ${intero(s.nc || 0)}` }, { nome: t('dash.returningShort', null, 'Clienti Ritorno'), valore: Number(s.fatturRC) || 0, sotto: ` · ${intero(s.rc || 0)}` }]} /> })

    if (im?.sessions > 0) q.push({ occhiello: t('film.funnel', null, 'Dalla visita all’acquisto'), valore: (im.purchase / im.sessions) * 100, formato: (n) => `${n.toLocaleString(intlLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
      frase: t('film.sFunnel', { c: dec((im.addToCart / im.sessions) * 100), k: dec((im.checkout / im.sessions) * 100), s: intero(im.sessions) }, `Su 100 visite, ${dec((im.addToCart / im.sessions) * 100)} mettono nel carrello e ${dec((im.checkout / im.sessions) * 100)} arrivano al check-out. ${intero(im.sessions)} sessioni in tutto.`),
      grafico: <Imbuto loc={intlLocale} passi={[{ nome: t('dash.sessions', null, 'Sessioni'), valore: im.sessions, testo: intero(im.sessions) }, { nome: t('lv.carts', null, 'Aggiunte al carrello'), valore: im.addToCart, testo: intero(im.addToCart) }, { nome: t('lv.checkout', null, 'Al check-out'), valore: im.checkout, testo: intero(im.checkout) }, { nome: t('lv.purchase', null, 'Acquisto completato'), valore: im.purchase, testo: intero(im.purchase) }]} /> })

    q.push({ occhiello: t('dash.sumAdSpend', null, 'Spesa ADV'), valore: spesa, prima: spesaP, formato: e0, inverso: true,
      frase: t('film.sAds', { m: e0(spMeta), g: e0(spGoogle), mer: mer ? volte(mer) : '—', d: segno(pct(mer, merP)) }, `Meta ${e0(spMeta)}, Google ${e0(spGoogle)}. Ogni euro speso ne ha riportati ${mer ? volte(mer) : '—'} di fatturato (${segno(pct(mer, merP))} sulla settimana prima).`),
      grafico: <Colonne serie={spesaG} etichette={nomiGiorni} formato={e0} evidenzia={-1} /> })

    if (fonti.length) { const quota = totFonti > 0 ? Math.round((fonti[0].revenue / totFonti) * 100) : 0
      q.push({ occhiello: t('film.sources', null, 'Da dove arrivano le vendite'), titolo: fonti[0].label,
        frase: t('film.sSources', { f: fonti[0].label, v: e0(fonti[0].revenue), p: quota }, `${fonti[0].label} è il primo canale: ${e0(fonti[0].revenue)}, il ${quota}% delle vendite attribuite.`),
        grafico: <Righe formato={e0} voci={fonti.map(f => ({ nome: f.label, valore: Number(f.revenue) || 0, sotto: ` · ${f.orders}` }))} /> }) }

    if (prodotti.length) { const tot = prodotti.reduce((a, p) => a + (Number(p.revenue) || 0), 0), quota = s.revenue > 0 ? Math.round((tot / s.revenue) * 100) : 0
      q.push({ occhiello: t('film.products', null, 'I prodotti della settimana'), titolo: prodotti[0].label,
        frase: t('film.sProducts', { n: prodotti.length, v: e0(tot), p: quota }, `I primi ${prodotti.length} fanno ${e0(tot)}: il ${quota}% del fatturato della settimana.`),
        grafico: <Righe formato={e0} voci={prodotti.map(p => ({ nome: p.label, valore: Number(p.revenue) || 0, foto: fotoDi(p.label), sotto: ` · ${p.quantity ?? p.orders} ${t('inv.pcs', null, 'pz')}` }))} /> }) }

    if (tr) { const mese = new Intl.DateTimeFormat(intlLocale, { month: 'long' }).format(new Date(`${tr.oggi}T12:00:00`)), d = scorso > 0 ? segno(pct(tr.previsto, scorso)) : '—'
      q.push({ occhiello: t('brief.course', null, 'La rotta del mese'), valore: tr.previsto, formato: e0,
        frase: t('film.sCourse', { mese, a: e0(tr.basso), b: e0(tr.alto), d }, `Se non si tocca niente, ${mese} chiude fra ${e0(tr.basso)} e ${e0(tr.alto)}: ${d} sul mese scorso.`), grafico: <Rotta punti={tr.punti} /> }) }

    if (mossa) q.push({ tipo: 'finale', occhiello: t('mc.proposes', null, 'Il pilota propone'), valore: mossa.previsto?.euroMese, formato: (n) => `+${e0(n)}`, unita: t('mc.perMonth', null, '/mese'),
      frase: mossa.tipo === 'ferma-prodotti-google'
        ? `${t('mc.moveStop', { n: mossa.quanti }, `Ferma ${mossa.quanti} prodotti in perdita su Google`)}. ${t('mc.whyStop', { spesa: e0(mossa.base?.spesa), giorni: mossa.base?.giorni }, '')}`
        : `${t('mc.movePush', { n: mossa.quanti }, `Spingi ${mossa.quanti} prodotti che rendono su Google`)}.`,
      mosaico: (mossa.prodotti || []).map(p => p.immagine).filter(Boolean).slice(0, 6) })
    return q
  }, [dati, pilota, periodo, t, intlLocale])

  const chiudi = useCallback(() => setAperto(false), [])
  const ultimo = quadri.length - 1
  const avanti = useCallback(() => setK(x => Math.min(ultimo, x + 1)), [ultimo])
  const indietro = useCallback(() => setK(x => Math.max(0, x - 1)), [])

  // avanza da solo; sull'ultimo quadro si ferma (non si chiude da solo)
  useEffect(() => { if (!aperto || pausa || !quadri.length || k >= ultimo) return; const tm = setTimeout(avanti, DURATA); return () => clearTimeout(tm) }, [aperto, pausa, k, quadri.length, ultimo, avanti])
  useEffect(() => {
    if (!aperto) return
    const tasti = (e) => { if (e.key === 'Escape') chiudi(); else if (e.key === 'ArrowRight') avanti(); else if (e.key === 'ArrowLeft') indietro(); else if (e.key === ' ') { e.preventDefault(); setPausa(p => !p) } }
    window.addEventListener('keydown', tasti); const prima = document.body.style.overflow; document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', tasti); document.body.style.overflow = prima }
  }, [aperto, chiudi, avanti, indietro])

  if (!aperto || typeof document === 'undefined') return null
  const q = quadri[k]
  const delta = q ? pct(q.valore, q.prima) : null
  const bene = delta == null ? null : (q.inverso ? delta <= 0 : delta >= 0)

  return createPortal(
    <div className="flm" role="dialog" aria-modal="true" aria-label={t('film.eyebrow', null, 'Il film della settimana')}>
      <header className="flm-testa">
        <div className="flm-barre">{quadri.map((_, j) => <button type="button" key={j} onClick={() => setK(j)} aria-label={`${j + 1}`} className={j < k ? 'fatta' : j === k ? (pausa || k >= ultimo ? 'ora ferma' : 'ora') : ''} style={j === k ? { '--durata': `${DURATA}ms` } : undefined}><i /></button>)}</div>
        <button type="button" className="flm-tondo" onClick={chiudi} aria-label={t('common.close', null, 'Chiudi')}><Icon name="close" size={16} /></button>
      </header>

      {!q ? <div className="flm-attesa">{errore ? t('film.error', null, 'La settimana non è ancora disponibile. Riprova tra poco.') : t('film.loading', null, 'Monto il film…')}</div> : (
        <main className={`flm-quadro ${q.tipo || ''}`} key={k}>
          <section className="flm-testo">
            <p className="flm-occhiello">{q.occhiello}</p>
            {q.formato ? <div className="flm-numero"><Conta a={q.valore} formato={q.formato} />{q.unita && <small>{q.unita}</small>}</div> : <h2 className="flm-titolo">{q.titolo}</h2>}
            {delta != null && <p className={`flm-delta ${bene ? 'su' : 'giu'}`}><b>{delta >= 0 ? '▲' : '▼'} {Math.abs(delta).toLocaleString(intlLocale, { maximumFractionDigits: 1 })}%</b><span>{t('film.vsWeekBefore', { v: q.formato(q.prima) }, `sulla settimana prima (${q.formato(q.prima)})`)}</span></p>}
            {q.frase && <p className="flm-frase">{q.frase}</p>}
            {q.tipo === 'finale' && <button type="button" className="flm-vai" onClick={chiudi}>{t('film.open', null, 'Apri la sala di controllo')}</button>}
          </section>
          <section className="flm-visivo">
            {q.mosaico?.length ? <div className={`flm-mosaico n${Math.min(6, q.mosaico.length)}`}>{q.mosaico.map((f, j) => <img key={j} src={miniatura(f, 600)} alt="" style={{ '--r': `${j * 70}ms` }} />)}</div> : q.grafico}
            {q.legenda && <p className="flm-legenda"><i />{q.legenda[0]}<i className="prima" />{q.legenda[1]}</p>}
          </section>
        </main>
      )}

      {quadri.length > 0 && (
        <footer className="flm-comandi">
          <button type="button" className="flm-tondo gira" onClick={indietro} disabled={k === 0} aria-label={t('film.prev', null, 'Indietro')}><Icon name="chevron" size={18} /></button>
          <button type="button" className="flm-tondo pieno" onClick={() => setPausa(p => !p)} aria-label={pausa ? t('mc.play', null, 'Riproduci') : t('mc.pause', null, 'Pausa')}>{pausa ? <Icon name="play" size={14} /> : <span className="flm-pausa" aria-hidden="true" />}</button>
          <button type="button" className="flm-tondo" onClick={avanti} disabled={k >= ultimo} aria-label={t('film.next', null, 'Avanti')}><Icon name="chevron" size={18} /></button>
          <span className="flm-conto">{k + 1} / {quadri.length}</span>
        </footer>
      )}
    </div>,
    document.body,
  )
}
