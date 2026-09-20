'use client'

import { Fonte } from './FasceTabella'
import { useEffect, useMemo, useRef, useState } from 'react'

// ============================================================================
//  Matrice dei report — voci in riga, periodi in colonna
//
//  La stessa lettura del conto economico, per Weekly, Monthly, Quarter e Year.
//  Prima ogni tab aveva la tabella girata (periodi in riga, metriche in
//  colonna): con sedici metriche si scorreva di lato per leggere un mese, e
//  confrontare due periodi voleva dire saltare fra righe lontane. Qui i periodi
//  stanno affiancati e ogni voce si legge in orizzontale.
//
//  Un solo componente per quattro tab: quando si corregge qualcosa si corregge
//  una volta. La lezione l'ha insegnata questo stesso file di conti, dove la
//  stessa tabella copiata in piu' posti restava indietro in uno dei due.
//
//  Ogni periodo e' un gruppo di tre colonne:
//    [anno prima]  [periodo]  [% sul riferimento]
//  Le due laterali nascono CHIUSE — una striscia su cui si clicca — perche'
//  chi apre un report vuole prima vedere i numeri di adesso.
//
//  Il confronto sotto al valore segue quello che si sta guardando: a colonna
//  dell'anno prima chiusa e' il periodo precedente, aperta e' lo stesso periodo
//  dell'anno prima. Due confronti diversi affiancati non si capirebbero.
// ============================================================================

// L'incidenza non e' un allarme ne' una categoria: si legge come un dato secondario, in grigio.
const INC_BLU = 'var(--text3)'

const th = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 11.5, opacity: 0.6, textAlign: 'right', whiteSpace: 'nowrap' }
const td = { padding: '9px 12px', textAlign: 'right', whiteSpace: 'nowrap' }

// Stacco all'inizio di ogni gruppo: senza, a colonne aperte i numeri diventano
// una distesa in cui non si capisce quale appartiene a quale periodo.
const STACCO = { borderLeft: '1px solid var(--border2)', paddingLeft: 18 }

const thYoy = { ...th, fontSize: 10, opacity: 0.45, color: 'var(--text3)', fontWeight: 600, minWidth: 92, cursor: 'pointer', ...STACCO }
const tdYoy = { ...td, color: 'var(--text3)', fontWeight: 500, fontSize: 13, fontVariantNumeric: 'tabular-nums', cursor: 'pointer', ...STACCO }
const thYoyChiusa = { minWidth: 34, width: 34, padding: '10px 5px 10px 14px', fontSize: 10, textAlign: 'center', opacity: 0.4 }
const tdYoyChiusa = { minWidth: 34, width: 34, padding: '9px 5px 9px 14px' }

const thInc = { ...th, fontSize: 10, opacity: 0.55, color: INC_BLU, fontStyle: 'italic', fontWeight: 600, minWidth: 54, padding: '10px 10px 10px 4px', cursor: 'pointer' }
const tdInc = { ...td, color: INC_BLU, fontStyle: 'italic', fontWeight: 500, fontSize: 11.5, fontVariantNumeric: 'tabular-nums', padding: '9px 10px 9px 4px', cursor: 'pointer' }
const thIncChiusa = { minWidth: 20, width: 20, padding: '10px 6px', fontSize: 11.5, opacity: 0.5, textAlign: 'center' }
const tdIncChiusa = { minWidth: 20, width: 20, padding: '9px 6px' }

export default function MatriceReport({
  periodi,            // [{ key, label, labelAnnoPrima, valori, valoriPrec, valoriAnnoPrima }]
  righe,              // [{ key, label, fmt, neg, strong, sub, forte, noPct, gapAfter, badge, noConfronto }]
  chiaveBase,         // riga su cui si calcola l'incidenza (es. 'fatturato')
  totale,             // { label, valori, valoriPrec, valoriAnnoPrima } | null
  t,
  etichettaColonna = 'Voce',
}) {
  const [incAperta, setIncAperta] = useState(false)
  const [yoyAperta, setYoyAperta] = useState(false)

  // La colonna dell'anno prima esiste solo se qualcuno la puo' riempire.
  const haAnnoPrima = useMemo(
    () => periodi.some(p => p.valoriAnnoPrima) || !!totale?.valoriAnnoPrima,
    [periodi, totale]
  )

  const nColonne = 1 + periodi.length * (haAnnoPrima ? 3 : 2) + (totale ? (haAnnoPrima ? 3 : 2) : 0)

  // ── Barra di scorrimento anche in ALTO ────────────────────────────────
  // Con molti periodi la tabella e' piu' alta dello schermo: senza, per
  // spostarsi di lato bisogna scendere in fondo, scorrere e risalire.
  const tabRef = useRef(null)
  const topRef = useRef(null)
  const [larghezza, setLarghezza] = useState(0)
  const [serveScroll, setServeScroll] = useState(false)

  useEffect(() => {
    const el = tabRef.current
    if (!el) return
    const misura = () => {
      setLarghezza(el.scrollWidth)
      setServeScroll(el.scrollWidth > el.clientWidth + 1)
    }
    misura()
    const ro = new ResizeObserver(misura)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    return () => ro.disconnect()
  }, [periodi.length, righe.length, incAperta, yoyAperta, totale])

  const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : null }

  // Incidenza: solo sulle voci in valore. Su un rapporto sarebbe la percentuale
  // di un rapporto, su un conteggio un numero diviso per degli euro.
  const incidenza = (riga, valore, valori) => {
    if (riga.noPct || !chiaveBase) return null
    const base = num(valori?.[chiaveBase])
    const v = num(valore)
    if (base == null || base === 0 || v == null) return null
    return (v / base) * 100
  }
  const fmtInc = (n) => n == null ? '' : `${n.toFixed(1).replace('.', ',')}%`

  const cellaValore = (riga, valori) => {
    const v = valori ? valori[riga.key] : null
    return riga.fmt ? riga.fmt(v) : (v == null ? '—' : v)
  }

  const intestazioneGruppo = (p, chiave) => [
    haAnnoPrima && (
      <th key={`${chiave}-yoy`} className="rep-side" onClick={() => setYoyAperta(x => !x)}
        style={{ ...thYoy, ...(yoyAperta ? null : thYoyChiusa) }}
        title={yoyAperta ? t('rep.yoyHide', null, 'Nascondi lo stesso periodo dell’anno prima') : t('rep.yoyShow', null, 'Mostra lo stesso periodo dell’anno prima')}>
        {yoyAperta ? (p.labelAnnoPrima || t('rep.prevShort', null, 'prec.')) : (p.siglaAnnoPrima || '·')}
      </th>
    ),
    <th key={chiave} className="rep-val" style={{ ...th, minWidth: 118, color: p.forte ? 'var(--accent)' : undefined }}>{p.label}</th>,
    <th key={`${chiave}-inc`} className="rep-side" onClick={() => setIncAperta(x => !x)}
      style={{ ...thInc, ...(incAperta ? null : thIncChiusa) }}
      title={incAperta ? t('rep.incHide', null, 'Nascondi l’incidenza') : t('rep.incShow', null, 'Mostra l’incidenza')}>
      {incAperta ? t('rep.incShort', null, '%') : '%'}
    </th>,
  ]

  const celleGruppo = (riga, p, chiave, baseTd, sfondo) => {
    const valori = p.valori
    const confronto = yoyAperta ? p.valoriAnnoPrima : p.valoriPrec
    const cur = num(valori?.[riga.key])
    const prev = riga.noConfronto ? null : num(confronto?.[riga.key])
    return [
      haAnnoPrima && (
        <td key={`${chiave}-yoy`} className="rep-side" onClick={() => setYoyAperta(x => !x)}
          style={{ ...baseTd, ...tdYoy, ...(yoyAperta ? null : tdYoyChiusa), ...sfondo }}>
          {yoyAperta ? (p.valoriAnnoPrima ? cellaValore(riga, p.valoriAnnoPrima) : '—') : ''}
        </td>
      ),
      <td key={chiave} className="rep-val" style={{ ...baseTd, ...sfondo, color: riga.sub ? 'var(--text2)' : undefined }}>
        <div>{cellaValore(riga, valori)}</div>
        {prev != null && cur != null && (
          <Delta cur={cur} prev={prev} inverse={riga.inverse}
            titolo={t('rep.vs', { p: (yoyAperta ? p.labelAnnoPrima : p.labelPrec) || '' }, `rispetto a ${(yoyAperta ? p.labelAnnoPrima : p.labelPrec) || ''}`)} />
        )}
      </td>,
      <td key={`${chiave}-inc`} className="rep-side" onClick={() => setIncAperta(x => !x)}
        style={{ ...baseTd, ...tdInc, ...(incAperta ? null : tdIncChiusa), ...sfondo }}>
        {incAperta ? fmtInc(incidenza(riga, valori?.[riga.key], valori)) : ''}
      </td>,
    ]
  }

  return (
    <>
      {serveScroll && (
        <div ref={topRef} className="rep-scroll-sopra"
          onScroll={() => { if (tabRef.current && topRef.current) tabRef.current.scrollLeft = topRef.current.scrollLeft }}
          style={{ position: 'relative', zIndex: 2, width: '100%', overflowX: 'auto', overflowY: 'hidden', height: 12 }}>
          <div style={{ width: larghezza, height: 1 }} />
        </div>
      )}

      <div ref={tabRef} className="rep-matrix"
        onScroll={() => { if (topRef.current && tabRef.current) topRef.current.scrollLeft = tabRef.current.scrollLeft }}
        style={{ position: 'relative', zIndex: 2, width: '100%', overflowX: 'auto', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <table className="tab-lyft" style={{ borderCollapse: 'collapse', fontSize: 13, minWidth: '100%' }}>
          <thead>
            <tr>
              <th className="rep-label" style={{ ...th, textAlign: 'left', position: 'sticky', left: 0, zIndex: 2, background: 'var(--surface)', minWidth: 200 }}>{etichettaColonna}</th>
              {periodi.map(p => intestazioneGruppo(p, p.key))}
              {totale && intestazioneGruppo({ ...totale, forte: true }, '__tot')}
            </tr>
          </thead>
          <tbody>
            {righe.map(riga => {
              const baseTd = { ...td, borderBottom: '1px solid var(--border)', ...(riga.strong ? { fontWeight: 600 } : {}) }
              const rigaJsx = (
                <tr key={riga.key} style={riga.forte ? { background: 'rgba(48,209,88,0.05)' } : riga.strong ? { background: 'var(--glass)' } : undefined}>
                  <td className={riga.sub ? 'rep-label rep-sub' : 'rep-label'} style={{
                    ...baseTd, textAlign: 'left', position: 'sticky', left: 0, zIndex: 1, background: 'var(--surface)',
                    paddingLeft: riga.sub ? 28 : undefined, color: riga.sub ? 'var(--text2)' : undefined,
                    fontWeight: riga.strong || riga.forte ? 700 : 500,
                  }}>
                    {riga.label}<Fonte loghi={riga.fonte} dopo />
                    {riga.badge && (
                      <span style={{ marginLeft: 8, fontSize: 10, fontWeight: 640, textTransform: 'uppercase', letterSpacing: '0.05em', padding: '2px 7px', borderRadius: 999, color: '#f59e0b', background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>{riga.badge}</span>
                    )}
                  </td>
                  {periodi.map(p => celleGruppo(riga, p, p.key, baseTd, null))}
                  {totale && celleGruppo(riga, totale, '__tot', baseTd, { background: 'var(--neutro-bg)' })}
                </tr>
              )
              // Uno stacco dove finisce un ragionamento e ne comincia un altro:
              // quindici righe di fila si leggono come un elenco, a blocchi si
              // leggono come un conto.
              return riga.gapAfter
                ? [rigaJsx, <tr key={`${riga.key}-gap`} aria-hidden="true"><td colSpan={nColonne} style={{ height: 30, padding: 0, border: 'none' }} /></tr>]
                : rigaJsx
            })}
          </tbody>
        </table>
      </div>

      {/* Su macOS le barre di sistema spariscono quando non si scorre: quella
          in alto deve restare a vista, altrimenti non la cerca nessuno. */}
      <style>{`
        .rep-scroll-sopra::-webkit-scrollbar { height: 10px }
        .rep-scroll-sopra::-webkit-scrollbar-track { background: var(--glass2); border-radius: 999px }
        .rep-scroll-sopra::-webkit-scrollbar-thumb { background: var(--border3); border-radius: 999px }
        .rep-scroll-sopra::-webkit-scrollbar-thumb:hover { background: var(--text3) }
        .rep-scroll-sopra { scrollbar-width: thin; scrollbar-color: var(--border3) var(--glass2) }
      `}</style>
    </>
  )
}

// Variazione rispetto al periodo di confronto. Il titolo dice CONTRO COSA:
// il riferimento cambia con un clic, e una freccia senza riferimento e' muta.
function Delta({ cur, prev, inverse = false, titolo }) {
  if (prev == null || cur == null || !Number.isFinite(prev) || prev === 0) return null
  const d = cur - prev
  const pct = (d / Math.abs(prev)) * 100
  if (Math.abs(pct) < 0.05) return null
  const su = d > 0
  const bene = inverse ? !su : su
  const col = bene ? '#22c55e' : '#ef4444'
  return (
    <div title={titolo} style={{ fontSize: 10, fontWeight: 600, color: col, marginTop: 2, whiteSpace: 'nowrap', cursor: 'help' }}>
      {su ? '▲' : '▼'} {Math.abs(pct).toFixed(0)}%
    </div>
  )
}
