'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useT } from '../../lib/i18n/I18nProvider'
import { globalPresetToTf, tfToGlobalPreset } from '../../lib/tfQuery'
import LogoMark from '../components/LogoMark'
import Icon from '../components/ui/Icon'
import BmTimeframe from '../components/ui/BmTimeframe'
import DeltaBadge from '../components/DeltaBadge'
import { BottoneIcona } from '../components/ui/AzioneBarra'
import { Kpi, Live, Linguette } from '../components/ui/Mattoni'

// ============================================================================
//  Dashboard generale: TUTTI i negozi dell'agenzia in una pagina sola.
//  E' la pagina del titolare, con un indirizzo a parte (/generale): non sta nel
//  menu dell'app e la porta dei dati (/api/generale) risponde solo a lui.
//
//  In cima al menu «Dashboard generale» = la somma di tutti i negozi; sotto, un
//  negozio alla volta. L'elenco non e' scritto qui: sono i clienti dell'agenzia
//  con Shopify collegato, quindi un cliente nuovo entra da solo.
//
//  I numeri di ogni negozio si leggono in diretta dalla SUA app (quella dedicata,
//  se ce l'ha) e sono quelli che il cliente vede li': fatturato senza marketplace,
//  spesa senza le campagne per i negozi fisici.
//
//  L'aspetto e' quello dell'app: stessa barra laterale (classi di AppShell),
//  stesso selettore del periodo (BmTimeframe), stesse schede (Kpi di Mattoni).
// ============================================================================

const OGNI = 5 * 60_000   // ogni quanto si rilegge da soli: e' la durata della cache delle app
const TUTTI = 'tutti'

const num = (v) => { const x = Number(v); return Number.isFinite(x) ? x : 0 }
const div = (a, b) => (a > 0 && b > 0 ? a / b : null)
const cifra = (v, dec) => new Intl.NumberFormat('it-IT', { useGrouping: 'always', minimumFractionDigits: dec, maximumFractionDigits: dec }).format(Math.abs(v))
const euro = (v, dec = 0) => v == null ? '—' : `${v < 0 ? '−' : ''}€${cifra(v, dec)}`
const intero = (v) => v == null ? '—' : cifra(Math.round(v), 0)
// le conversioni di Google possono essere frazioni (attribuzione): un decimale solo se serve
const conta = (v) => v == null ? '—' : cifra(v, Number.isInteger(Math.round(v * 10) / 10) ? 0 : 1)
const volte = (v) => v == null ? '—' : `${cifra(v, 2)}x`
const pct = (v) => `${v < 0 ? '−' : ''}${cifra(v, 1)}%`
const giorno = (iso) => new Date(`${iso}T12:00:00`).toLocaleDateString('it-IT', { day: 'numeric', month: 'short', year: 'numeric' })

async function leggi(ws, lettura, domanda = '') {
  const r = await fetch(`/api/generale?ws=${ws}&lettura=${lettura}${domanda ? '&' + domanda : ''}`, { cache: 'no-store' })
  if (r.status === 401 || r.status === 403) throw new Error('accesso')
  const j = await r.json().catch(() => null)
  if (!r.ok || !j) throw new Error('lettura')
  return j
}

// Dai totali di un periodo ai KPI: le stesse divisioni di KPI Brain.
function kpi({ fatturato, ordini, nuovi, ritorno, meta, goog, valoreMeta = null, valoreGoogle = null, ordiniMeta = null, ordiniGoogle = null, marketplace = null, ordiniMarketplace = null, sessioni = null, spesaMonca = false }) {
  const spesa = num(meta) + num(goog)
  // Se una delle due spese non e' arrivata (lettura fallita), MER, CAC e CPO non si calcolano:
  // con meta' della spesa uscirebbero numeri belli e falsi.
  const intera = spesaMonca ? 0 : spesa
  return {
    fatturato, ordini, nuovi, ritorno, meta, goog, spesa, spesaMonca, marketplace, sessioni, valoreMeta, valoreGoogle,
    // quota dei clienti del periodo che avevano gia' comprato (come «Retention» in KPI Brain)
    ripetono: nuovi + ritorno > 0 ? ritorno / (nuovi + ritorno) * 100 : null,
    aov: div(fatturato, ordini), mer: div(fatturato, intera), cac: div(intera, nuovi), cpo: div(intera, ordini),
    roasMeta: valoreMeta != null ? div(valoreMeta, num(meta)) : null,
    roasGoogle: valoreGoogle != null ? div(valoreGoogle, num(goog)) : null,
    // il marketplace (dove c'e') viaggia a parte: mai dentro fatturato, MER, CAC, CPO
    ordiniMarketplace, carrelloMarketplace: div(num(marketplace), num(ordiniMarketplace)),
    // ordini che ogni piattaforma si attribuisce, e quanto le costa ciascuno
    ordiniMeta, ordiniGoogle, cpoMeta: div(num(meta), num(ordiniMeta)), cpoGoogle: div(num(goog), num(ordiniGoogle)),
  }
}
function daMetriche(sr, mr, google) {
  if (!sr?.since) return null
  const giorni = (google?.daily || []).filter(d => d.date >= sr.since && d.date <= sr.until)
  const somma = (campo) => giorni.reduce((s, d) => s + num(d[campo]), 0)
  // solo le app che tengono il marketplace a parte mandano queste due voci
  const mp = sr.koongoRevenue !== undefined
  return {
    range: { since: sr.since, until: sr.until },
    ...kpi({
      spesaMonca: !mr || !google,
      fatturato: num(sr.revenue), ordini: num(sr.orders), nuovi: num(sr.nc), ritorno: num(sr.rc), sessioni: num(sr.sessions) || null,
      marketplace: mp ? num(sr.koongoRevenue) : null, ordiniMarketplace: mp ? num(sr.koongoOrders) : null,
      meta: mr ? num(mr.spend) : null, valoreMeta: mr ? num(mr.purchaseValue) : null, ordiniMeta: mr ? num(mr.purchases) : null,
      goog: google?.configured ? somma('spend') : null, valoreGoogle: google?.configured ? somma('convValue') : null, ordiniGoogle: google?.configured ? somma('conversions') : null,
    }),
  }
}

// Tutti i negozi insieme. Si sommano i TOTALI (fatturato, ordini, spesa, clienti, valore
// attribuito) e i rapporti si rifanno sulla somma: MER, CAC, CPO, ROAS e carrello medio
// generali NON sono la media di quelli dei negozi. Se manca anche un solo negozio il totale
// non si mostra: una somma a meta' sarebbe un numero bello e falso.
function insieme(parti) {
  if (!parti.length || parti.some(p => !p)) return null
  const somma = (campo) => parti.reduce((a, p) => a + num(p[campo]), 0)
  // un dato che nessun negozio ha resta vuoto, invece di diventare zero
  const seCe = (campo) => (parti.every(p => p[campo] == null) ? null : somma(campo))
  const meta = parti.some(p => p.meta == null)
  // Google puo' mancare perche' un negozio non lo usa (vale zero) o perche' la lettura e' fallita (non si somma)
  const goog = parti.some(p => p.goog == null && p.spesaMonca)
  return {
    range: parti[0].range,
    ...kpi({
      spesaMonca: parti.some(p => p.spesaMonca),
      fatturato: somma('fatturato'), ordini: somma('ordini'), nuovi: somma('nuovi'), ritorno: somma('ritorno'),
      marketplace: seCe('marketplace'), ordiniMarketplace: seCe('ordiniMarketplace'),
      sessioni: parti.some(p => p.sessioni == null) ? null : somma('sessioni'),
      meta: meta ? null : somma('meta'), valoreMeta: meta ? null : seCe('valoreMeta'), ordiniMeta: meta ? null : seCe('ordiniMeta'),
      goog: goog ? null : seCe('goog'), valoreGoogle: goog ? null : seCe('valoreGoogle'), ordiniGoogle: goog ? null : seCe('ordiniGoogle'),
    }),
  }
}

async function caricaNegozio(n, preset) {
  const oggi = preset === 'today'
  const [metrics, google, stessaOra] = await Promise.all([
    leggi(n.id, 'metrics', `preset=${encodeURIComponent(preset)}`),
    leggi(n.id, 'google').catch(() => null),
    oggi ? leggi(n.id, 'oggi-vs-ieri').catch(() => null) : null,
  ])
  const base = daMetriche(metrics?.shopifyRange, metrics?.metaRange, google)
  if (!base) throw new Error('vuoto')
  // Il periodo prima. Su «Oggi» e' ieri FINO A QUEST'ORA, come in KPI Brain: contro la
  // giornata intera di ieri, a meta' giornata tutto risulterebbe in calo.
  const io = stessaOra?.ieriAllaStessaOra
  const prima = oggi
    ? (io ? kpi({ fatturato: num(io.fatturato), ordini: num(io.ordini), nuovi: num(io.nuovi), ritorno: num(io.abituali), meta: num(io.spesaMeta), goog: num(io.spesaGoogle), marketplace: io.marketplace != null ? num(io.marketplace) : null }) : null)
    : daMetriche(metrics?.shopifyPrevRange, metrics?.metaPrevRange, google)
  return { ...base, prima }
}

export default function Generale() {
  const t = useT()
  const [negozi, setNegozi] = useState(null)   // null = sto chiedendo l'elenco
  const [daCollegare, setDaCollegare] = useState([])
  const [chiuso, setChiuso] = useState(null)   // 'accesso' | 'lettura': l'elenco non e' arrivato
  const [scelta, setScelta] = useState(TUTTI)
  const [preset, setPreset] = useState('today')
  const [dati, setDati] = useState({})         // «negozio|periodo» → { v, errore, alle, carico }
  const [menu, setMenu] = useState(false)      // il cassetto del menu, sul telefono
  const giro = useRef(0)

  useEffect(() => {
    fetch('/api/generale?elenco=1', { cache: 'no-store' })
      .then(async r => { if (!r.ok) throw new Error(r.status === 401 || r.status === 403 ? 'accesso' : 'lettura'); return r.json() })
      .then(j => { setNegozi(j.negozi || []); setDaCollegare(j.daCollegare || []) })
      .catch(e => setChiuso(e.message))
  }, [])

  const carica = useCallback((p) => {
    if (!negozi?.length) return
    const mio = ++giro.current
    for (const n of negozi) {
      const k = `${n.id}|${p}`
      const metti = (pezzo) => setDati(d => ({ ...d, [k]: { ...d[k], ...pezzo } }))
      metti({ carico: true })
      caricaNegozio(n, p)
        .then(v => { if (mio === giro.current) metti({ v, errore: null, carico: false, alle: Date.now() }) })
        .catch(e => { if (mio === giro.current) metti({ errore: e.message || 'lettura', carico: false }) })
    }
  }, [negozi])

  // Alla prima apertura, a ogni cambio di periodo, ogni 5 minuti e quando si torna sulla finestra.
  useEffect(() => {
    carica(preset)
    const ogni = setInterval(() => { if (!document.hidden) carica(preset) }, OGNI)
    let ultima = Date.now()
    const torna = () => { if (!document.hidden && Date.now() - ultima > 60_000) { ultima = Date.now(); carica(preset) } }
    document.addEventListener('visibilitychange', torna)
    return () => { clearInterval(ogni); document.removeEventListener('visibilitychange', torna) }
  }, [preset, carica])

  const lista = negozi || []
  const totale = scelta === TUTTI
  const scelto = lista.find(n => n.id === scelta)
  const nomeTutti = t('gen.all', null, 'Dashboard generale')
  const titolo = totale ? nomeTutti : (scelto?.nome || '')
  const pezzi = lista.map(n => ({ n, ...(dati[`${n.id}|${preset}`] || {}) }))
  const tutti = totale ? insieme(pezzi.map(p => p.v)) : null
  const mancanti = pezzi.filter(p => !p.v && p.errore)
  const ora = !totale ? (dati[`${scelta}|${preset}`] || {}) : {
    v: tutti ? { ...tutti, prima: insieme(pezzi.map(p => p.v?.prima)) } : null,
    carico: pezzi.some(p => p.carico),
    alle: pezzi.length && pezzi.every(p => p.alle) ? Math.min(...pezzi.map(p => p.alle)) : null,
    errore: pezzi.find(p => p.errore)?.errore || null,
  }
  const v = ora.v, pr = v?.prima
  const vuoto = !v
  const arrivati = pezzi.filter(p => p.v).length
  const voci = [{ id: TUTTI, nome: nomeTutti, icona: 'grid' }, ...lista.map(n => ({ id: n.id, nome: n.nome, icona: 'chart-line' }))]
  const val = (testo) => (vuoto ? '—' : testo)
  const nota = (testo) => <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{testo}</span>
  const S = ['shopify'], SMG = ['shopify', 'meta', 'google']
  const conMarketplace = v?.marketplace != null

  const scheda = (etichetta, valore, { fonti, cur, prec, inverso, sotto } = {}) => (
    <Kpi etichetta={etichetta} valore={valore} fonti={fonti}>
      {!vuoto && <DeltaBadge current={cur} previous={prec} inverse={inverso} />}
      {sotto && nota(sotto)}
    </Kpi>
  )
  const griglia = (colonne) => ({ display: 'grid', gridTemplateColumns: `repeat(${colonne}, minmax(0, 1fr))`, gap: 14, marginBottom: 14 })
  const avviso = (testo) => <div className="ly-scheda" style={{ marginBottom: 14, color: 'var(--text2)', fontSize: 13 }}>{testo}</div>

  return (
    <div className="app-shell" style={{ height: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'SF Pro Display', sans-serif", position: 'relative', overflow: 'hidden' }}>
      <style>{`.cookie-consent{display:none!important}.gen-telefono{display:none}@media (max-width:900px){.gen-telefono{display:block;margin:-20px 0 18px;overflow-x:auto}}`}</style>
      {menu && <div className="app-nav-backdrop" onClick={() => setMenu(false)} />}

      <aside id="app-navigation" className={`app-sidebar${menu ? ' open' : ''}`} style={{ width: 240, minWidth: 240, height: '100dvh', position: 'relative', top: 0, borderRight: '1px solid var(--border)', background: 'rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', zIndex: 20 }}>
        <div style={{ padding: '28px 20px 20px' }}>
          <div className="app-brand-row" style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 24 }}>
            <a href="/" title={t('gen.backToApp', null, 'Torna a LyftAI')} style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
              <LogoMark size={32} />
              <span style={{ fontSize: 22, fontWeight: 640, letterSpacing: '-0.04em', color: 'var(--text)' }}>LyftAI</span>
            </a>
            <button type="button" className="app-nav-close" aria-label={t('shell.closeMenu', null, 'Chiudi menu')} onClick={() => setMenu(false)}><Icon name="close" size={20} /></button>
          </div>
          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'default' }}>
            <span style={{ width: 28, height: 28, borderRadius: 8, background: 'var(--text)', display: 'inline-block', flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {totale ? t('gen.shops', { n: lista.length }, `${lista.length} negozi`) : titolo}
            </span>
          </div>
        </div>

        <nav aria-label={t('shell.navigation', null, 'Navigazione principale')} style={{ flex: 1, overflowY: 'auto', padding: '4px 0 16px' }}>
          <div className="app-nav-group" style={{ marginBottom: 30 }}>
            <div className="app-nav-group-toggle" style={{ padding: '7px 20px', display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text)', fontSize: 15, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.10em' }}>
              <span style={{ flex: 1, textAlign: 'left' }}>{t('gen.title', null, 'Tutti i negozi')}</span>
            </div>
            <div style={{ display: 'grid', gap: 1, padding: '4px 8px 0' }}>
              {voci.map(m => {
                const attivo = m.id === scelta
                return (
                  <button key={m.id} type="button" className="app-nav-item" aria-current={attivo ? 'page' : undefined} onClick={() => { setScelta(m.id); setMenu(false) }}
                    style={{ width: '100%', border: 0, borderRadius: 8, padding: '9px 12px', display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', textAlign: 'left', color: attivo ? 'var(--text)' : 'var(--text2)', background: attivo ? 'rgba(255,255,255,0.08)' : 'transparent', fontSize: 13, fontWeight: attivo ? 600 : 500, transition: 'all 0.15s ease', outline: 'none' }}>
                    <span className="app-nav-icon" style={{ width: 20, fontSize: 15, display: 'inline-flex', justifyContent: 'center' }}><Icon name={m.icona} /></span>
                    <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{m.nome}</span>
                  </button>
                )
              })}
            </div>
          </div>
        </nav>
      </aside>

      <main id="app-content" className="app-main" style={{ flex: 1, minWidth: 0, height: '100dvh', overflowY: 'auto', padding: '40px 48px 80px', position: 'relative', zIndex: 1 }}>
        <div style={{ maxWidth: 1440, margin: '0 auto' }}>
          <header className="app-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 24, marginBottom: 40, position: 'relative', zIndex: 10 }}>
            <button type="button" className="app-burger" aria-label="Menu" aria-expanded={menu} aria-controls="app-navigation" onClick={() => setMenu(true)}><span /><span /><span /></button>
            <div className="app-header-title">
              <h1 className="heading-lg">{titolo}</h1>
              <p style={{ margin: 0, color: 'var(--text3)', fontSize: 15, fontWeight: 400 }}>
                {v?.range ? (v.range.since === v.range.until ? giorno(v.range.since) : `${giorno(v.range.since)} – ${giorno(v.range.until)}`)
                  : chiuso ? '' : totale && lista.length ? t('gen.readingN', { a: arrivati, n: lista.length }, `sto leggendo… ${arrivati} negozi su ${lista.length}`) : t('gen.reading', null, 'sto leggendo…')}
                {v && totale ? ` · ${lista.map(n => n.nome).join(', ')}` : ''}
                {ora.alle ? ` · ${t('gen.updatedAt', null, 'aggiornato alle')} ${new Date(ora.alle).toLocaleTimeString('it-IT', { hour: '2-digit', minute: '2-digit' })}` : ''}
              </p>
            </div>
            <div className="app-header-actions" style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <BottoneIcona icona="refresh" titolo={t('gen.refresh', null, 'Aggiorna')} onClick={() => carica(preset)} disabled={!!ora.carico} gira={!!ora.carico} />
              <BmTimeframe value={globalPresetToTf(preset)} onChange={(x) => setPreset(tfToGlobalPreset(x))} />
            </div>
          </header>

          {/* da telefono la barra laterale non c'e': i negozi diventano linguette */}
          <div className="gen-telefono"><Linguette voci={voci.map(m => ({ id: m.id, label: m.nome }))} valore={scelta} onChange={setScelta} /></div>

          {chiuso && avviso(chiuso === 'accesso'
            ? t('gen.closed', null, 'Questa pagina è riservata. Se è la tua, rientra con il tuo account e riaprila.')
            : t('gen.listFailed', null, 'L’elenco dei negozi non è arrivato. Ricarica la pagina fra un minuto.'))}
          {negozi && lista.length === 0 && avviso(t('gen.noShops', null, 'Nessun cliente con Shopify collegato.'))}
          {daCollegare.length > 0 && totale && avviso(t('gen.toConnect', { nomi: daCollegare.join(', ') }, `Fuori dal totale perché senza Shopify collegato: ${daCollegare.join(', ')}.`))}

          {ora.errore && (!totale || !vuoto || mancanti.length > 0) && avviso(
            totale && vuoto ? t('gen.allMissing', { nomi: mancanti.map(p => p.n.nome).join(', ') }, `Il totale non si può calcolare: non sono arrivati i dati di ${mancanti.map(p => p.n.nome).join(', ')}. Riprova fra un minuto con «Aggiorna».`)
              : vuoto ? t('gen.noData', null, 'I dati di questo negozio non sono arrivati. Riprova fra un minuto con «Aggiorna».')
              : t('gen.stale', null, 'L’ultima lettura non è riuscita: i numeri qui sotto sono quelli di prima.'))}

          {!chiuso && lista.length > 0 && <>
            <section className="lv-efficienza">
              <h2 className="lv-efficienza-titolo" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>{t('gen.sales', null, 'Vendite')} <Live testo="Live" /></h2>
              <div className="stagger-zoom m-grid2" style={griglia(3)}>
                {scheda(t('gen.revenue', null, 'Fatturato totale'), val(euro(v?.fatturato)), { fonti: S, cur: v?.fatturato, prec: pr?.fatturato, sotto: conMarketplace ? t('gen.revenueSub', null, 'escluso marketplace') : null })}
                {scheda(t('gen.orders', null, 'Numero di ordini'), val(intero(v?.ordini)), { fonti: S, cur: v?.ordini, prec: pr?.ordini })}
                {scheda(t('gen.aov', null, 'AOV medio'), val(euro(v?.aov, 2)), { fonti: S, cur: v?.aov, prec: pr?.aov })}
              </div>
            </section>

            {conMarketplace && (
              <section className="lv-efficienza">
                <h2 className="lv-efficienza-titolo">{t('gen.marketplace', null, 'Marketplace')}</h2>
                <div className="stagger-zoom m-grid2" style={griglia(3)}>
                  {scheda(t('gen.mpRevenue', null, 'Fatturato marketplace'), val(euro(v?.marketplace)), { fonti: S, cur: v?.marketplace, prec: pr?.marketplace, sotto: t('gen.mpSub', null, 'Koongo · fuori dal fatturato totale') })}
                  {scheda(t('gen.mpOrders', null, 'Ordini marketplace'), val(intero(v?.ordiniMarketplace)), { fonti: S, cur: v?.ordiniMarketplace, prec: pr?.ordiniMarketplace })}
                  {scheda(t('gen.mpAov', null, 'Carrello medio marketplace'), val(euro(v?.carrelloMarketplace, 2)), { fonti: S, cur: v?.carrelloMarketplace, prec: pr?.carrelloMarketplace })}
                </div>
              </section>
            )}

            <section className="lv-efficienza">
              <h2 className="lv-efficienza-titolo">{t('gen.ads', null, 'Pubblicità')}</h2>
              <div className="stagger-zoom m-grid2" style={griglia(4)}>
                {scheda(t('gen.metaSpend', null, 'Spesa Meta'), val(euro(v?.meta)), { fonti: ['meta'], cur: v?.meta, prec: pr?.meta })}
                {scheda(t('gen.ordersMeta', null, 'Ordini Meta'), val(conta(v?.ordiniMeta)), { fonti: ['meta'], cur: v?.ordiniMeta, prec: pr?.ordiniMeta })}
                {scheda(t('gen.cpoMeta', null, 'CPO Meta'), val(euro(v?.cpoMeta, 2)), { fonti: ['meta'], cur: v?.cpoMeta, prec: pr?.cpoMeta, inverso: true })}
                {scheda(t('gen.roasMeta', null, 'ROAS Meta'), val(volte(v?.roasMeta)), { fonti: ['meta'], cur: v?.roasMeta, prec: pr?.roasMeta })}
              </div>
              <div className="stagger-zoom m-grid2" style={griglia(4)}>
                {scheda(t('gen.googleSpend', null, 'Spesa Google'), val(euro(v?.goog)), { fonti: ['google'], cur: v?.goog, prec: pr?.goog })}
                {scheda(t('gen.ordersGoogle', null, 'Ordini Google'), val(conta(v?.ordiniGoogle)), { fonti: ['google'], cur: v?.ordiniGoogle, prec: pr?.ordiniGoogle })}
                {scheda(t('gen.cpoGoogle', null, 'CPO Google'), val(euro(v?.cpoGoogle, 2)), { fonti: ['google'], cur: v?.cpoGoogle, prec: pr?.cpoGoogle, inverso: true })}
                {scheda(t('gen.roasGoogle', null, 'ROAS Google'), val(volte(v?.roasGoogle)), { fonti: ['google'], cur: v?.roasGoogle, prec: pr?.roasGoogle })}
              </div>
            </section>

            <section className="lv-efficienza">
              <h2 className="lv-efficienza-titolo">{t('gen.efficiency', null, 'Efficienza')}</h2>
              <div className="stagger-zoom m-grid2" style={griglia(3)}>
                {scheda('MER', val(volte(v?.mer)), { fonti: SMG, cur: v?.mer, prec: pr?.mer, sotto: t('gen.merSub', null, 'fatturato ÷ spesa totale') })}
                {scheda('CAC', val(euro(v?.cac, 2)), { fonti: SMG, cur: v?.cac, prec: pr?.cac, inverso: true, sotto: t('gen.cacSub', null, 'spesa totale ÷ nuovi clienti') })}
                {scheda('CPO', val(euro(v?.cpo, 2)), { fonti: SMG, cur: v?.cpo, prec: pr?.cpo, inverso: true, sotto: t('gen.cpoSub', null, 'spesa totale ÷ ordini') })}
              </div>
            </section>

            <section className="lv-efficienza">
              <h2 className="lv-efficienza-titolo">{t('gen.customers', null, 'Clienti')}</h2>
              <div className="stagger-zoom m-grid2" style={griglia(4)}>
                {scheda(t('gen.newCustomers', null, 'Nuovi clienti'), val(intero(v?.nuovi)), { fonti: S, cur: v?.nuovi, prec: pr?.nuovi })}
                {scheda(t('gen.returning', null, 'Clienti di ritorno'), val(intero(v?.ritorno)), { fonti: S, cur: v?.ritorno, prec: pr?.ritorno })}
                {scheda(t('gen.repeatRate', null, 'Repeat rate'), val(v?.ripetono != null ? pct(v.ripetono) : '—'), { fonti: S, cur: v?.ripetono, prec: pr?.ripetono, sotto: t('gen.repeatSub', null, 'clienti di ritorno ÷ clienti') })}
                {scheda(t('gen.sessions', null, 'Sessioni'), val(intero(v?.sessioni)), { fonti: S, cur: v?.sessioni, prec: pr?.sessioni })}
              </div>
            </section>
          </>}
        </div>
      </main>
    </div>
  )
}
