'use client'
import { useEffect, useMemo, useRef, useState } from 'react'
import { PRESET, risolvi, personalizzato, giorniDi } from '../periodo'

// ============================================================================
//  Il selettore del periodo.
//
//  Preset a sinistra, due mesi di calendario a destra, confronto col periodo
//  precedente, e nulla si applica finche' non si preme Aggiorna. L'ultima cosa
//  e' la piu' importante: scegliendo un intervallo si clicca due volte, e senza
//  una conferma esplicita il primo clic farebbe partire una lettura su un
//  intervallo che nessuno voleva.
// ============================================================================

const MESI = ['gennaio', 'febbraio', 'marzo', 'aprile', 'maggio', 'giugno',
  'luglio', 'agosto', 'settembre', 'ottobre', 'novembre', 'dicembre']
const MESI_BREVI = ['gen', 'feb', 'mar', 'apr', 'mag', 'giu', 'lug', 'ago', 'set', 'ott', 'nov', 'dic']
const GG = ['lun', 'mar', 'mer', 'gio', 'ven', 'sab', 'dom']

const iso = (d) => d.toISOString().slice(0, 10)
const daIso = (s) => new Date(s + 'T00:00:00Z')
const oggiIso = () => iso(new Date())

function etichettaData(s) {
  if (!s) return ''
  const d = daIso(s)
  return `${d.getUTCDate()} ${MESI_BREVI[d.getUTCMonth()]} ${d.getUTCFullYear()}`
}

export function etichettaPeriodo(v) {
  if (!v) return ''
  if (v.preset && v.preset !== 'personalizzato') {
    return PRESET.find(p => p.id === v.preset)?.nome || v.preset
  }
  if (v.since === v.until) return etichettaData(v.since)
  return `${etichettaData(v.since)} — ${etichettaData(v.until)}`
}

// Le caselle di un mese, lunedi' per primo. Si restituiscono anche le caselle
// vuote iniziali, perche' una griglia allineata si legge e una sfalsata no.
function caselle(anno, mese) {
  const primo = new Date(Date.UTC(anno, mese, 1))
  const salto = (primo.getUTCDay() + 6) % 7
  const quanti = new Date(Date.UTC(anno, mese + 1, 0)).getUTCDate()
  const out = []
  for (let i = 0; i < salto; i++) out.push(null)
  for (let g = 1; g <= quanti; g++) out.push(iso(new Date(Date.UTC(anno, mese, g))))
  return out
}

function Mese({ anno, mese, da, a, oggi, scegli }) {
  const celle = caselle(anno, mese)
  return (
    <div className="permese">
      <div className="permese-testa">{MESI[mese]} {anno}</div>
      <div className="pergg">{GG.map(g => <span key={g}>{g}</span>)}</div>
      <div className="pergriglia">
        {celle.map((s, i) => {
          if (!s) return <span key={'v' + i} className="pergiorno vuoto" />
          const futuro = s > oggi
          const dentro = da && a && s >= da && s <= a
          const estremo = s === da || s === a
          return (
            <button key={s} type="button" disabled={futuro}
              className={'pergiorno' + (futuro ? ' futuro' : '') + (dentro ? ' dentro' : '') + (estremo ? ' estremo' : '')}
              onClick={() => scegli(s)}>{daIso(s).getUTCDate()}</button>
          )
        })}
      </div>
    </div>
  )
}

export default function SelettorePeriodo({ valore, cambia }) {
  const [aperto, setAperto] = useState(false)
  // La bozza: si tocca questa, non il valore vero. Applicare a ogni clic
  // farebbe partire una lettura sul primo estremo di un intervallo di due.
  const [bozza, setBozza] = useState(valore)
  const [ancora, setAncora] = useState(null)   // primo giorno cliccato
  // Il mese di SINISTRA e' quello prima della fine dell'intervallo, cosi' la
  // fine cade nel pannello di destra e il periodo si vede tutto. Mettendo la
  // fine a sinistra si apriva su settembre-ottobre per un intervallo che
  // finisce il 2 settembre: mezza vista sul futuro e il periodo fuori campo.
  const meseDa = (fine) => {
    const d = daIso(fine || oggiIso())
    const p = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1))
    return { anno: p.getUTCFullYear(), mese: p.getUTCMonth() }
  }
  const [mese, setMese] = useState(() => meseDa(valore?.until))
  const box = useRef(null)
  const oggi = oggiIso()

  useEffect(() => {
    if (!aperto) return
    setBozza(valore); setAncora(null)
    const r = valore?.preset && valore.preset !== 'personalizzato' ? risolvi(valore.preset) : valore
    setMese(meseDa(r?.until))
  }, [aperto, valore])

  useEffect(() => {
    if (!aperto) return
    const fuori = (e) => { if (box.current && !box.current.contains(e.target)) setAperto(false) }
    const esc = (e) => { if (e.key === 'Escape') setAperto(false) }
    document.addEventListener('mousedown', fuori)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', fuori); document.removeEventListener('keydown', esc) }
  }, [aperto])

  // L'intervallo che la bozza rappresenta adesso: da un preset o dai due
  // estremi scelti a mano.
  const range = useMemo(() => {
    if (bozza?.preset && bozza.preset !== 'personalizzato') return risolvi(bozza.preset)
    return personalizzato(bozza?.since, bozza?.until) || risolvi('ultimi-30')
  }, [bozza])

  const scegliPreset = (id) => {
    setBozza(b => ({ ...b, preset: id, since: undefined, until: undefined }))
    setAncora(null)
    setMese(meseDa(risolvi(id).until))
  }

  // Primo clic: apre un intervallo. Secondo clic: lo chiude. Terzo: ricomincia.
  const scegliGiorno = (s) => {
    if (!ancora) {
      setAncora(s)
      setBozza(b => ({ ...b, preset: 'personalizzato', since: s, until: s }))
      return
    }
    const c = personalizzato(ancora, s)
    setAncora(null)
    setBozza(b => ({ ...b, preset: 'personalizzato', since: c.since, until: c.until }))
  }

  const sposta = (n) => setMese(m => {
    const d = new Date(Date.UTC(m.anno, m.mese + n, 1))
    return { anno: d.getUTCFullYear(), mese: d.getUTCMonth() }
  })

  const secondo = new Date(Date.UTC(mese.anno, mese.mese + 1, 1))
  const applica = () => {
    cambia({ ...range, confronta: !!bozza?.confronta })
    setAperto(false)
  }

  return (
    <div className="persel" ref={box}>
      <button type="button" className="perpill" onClick={() => setAperto(a => !a)} data-on={aperto ? 1 : 0}>
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <rect x="2" y="3" width="12" height="11" rx="2" stroke="currentColor" strokeWidth="1.4" />
          <path d="M2 6.5h12M5.5 2v2.5M10.5 2v2.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
        </svg>
        <span>{etichettaPeriodo(valore)}</span>
        <i className="percaret" />
      </button>

      {aperto && (
        <div className="perpanel">
          <div className="perlista">
            <div className="perlista-testa">Periodo</div>
            {PRESET.map(p => (
              <button key={p.id} type="button" className="pervoce" data-on={bozza?.preset === p.id ? 1 : 0}
                onClick={() => scegliPreset(p.id)}>
                <i className="perradio" />{p.nome}
              </button>
            ))}
          </div>

          <div className="percal">
            <div className="percal-testa">
              <button type="button" className="pernav" onClick={() => sposta(-1)} aria-label="Mese precedente">‹</button>
              <div className="percal-mesi">
                <span>{MESI[mese.mese]} {mese.anno}</span>
                <span>{MESI[secondo.getUTCMonth()]} {secondo.getUTCFullYear()}</span>
              </div>
              <button type="button" className="pernav" onClick={() => sposta(1)} aria-label="Mese successivo">›</button>
            </div>

            <div className="percal-corpo">
              <Mese anno={mese.anno} mese={mese.mese} da={range.since} a={range.until} oggi={oggi} scegli={scegliGiorno} />
              <Mese anno={secondo.getUTCFullYear()} mese={secondo.getUTCMonth()} da={range.since} a={range.until} oggi={oggi} scegli={scegliGiorno} />
            </div>

            <label className="perconfronta">
              <input type="checkbox" checked={!!bozza?.confronta}
                onChange={(e) => setBozza(b => ({ ...b, confronta: e.target.checked }))} />
              <span>Confronta</span>
              <i>col periodo precedente, lungo uguale</i>
            </label>

            <div className="perpiede">
              <span className="perrange">
                {range.since === range.until
                  ? etichettaData(range.since)
                  : `${etichettaData(range.since)} — ${etichettaData(range.until)}`}
                <i>{giorniDi(range)} giorni</i>
              </span>
              <button type="button" className="perbtn" onClick={() => setAperto(false)}>Annulla</button>
              <button type="button" className="perbtn forte" onClick={applica}>Aggiorna</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
