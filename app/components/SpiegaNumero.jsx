'use client'

import Pannello from './ui/Pannello'
import { Fonte } from './ui/FasceTabella'
import { Variazione } from './ui/Mattoni'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  "Come nasce questo numero": il pop-up che si apre cliccando un KPI della Dashboard.
//
//  La richiesta che Marino ha fatto piu' spesso e' stata "i calcoli non si capiscono".
//  Qui ogni numero si spiega da solo, con tre cose: il CONTO con le cifre vere dentro
//  (fatturato ÷ spesa = MER), da DOVE viene ogni pezzo, e l'ANDAMENTO delle ultime
//  settimane. Niente colore: il grafico e' una linea, il confronto sta nella pillola.
//
//    <SpiegaNumero titolo valore conto={[{ segno, nome, valore }]} risultato nota
//                  fonti={['shopify']} prima={{ valore, delta, etichetta, inverso }}
//                  serie={[{ x: '2026-09-14', v: 2933 }]} formatta={fn} onClose />
// ============================================================================

function Linea({ serie, formatta }) {
  const punti = (serie || []).filter(p => p && Number.isFinite(p.v))
  if (punti.length < 3) return null
  const W = 640, H = 150, m = { s: 8, d: 8, a: 14, b: 22 }
  const vs = punti.map(p => p.v), min = Math.min(0, ...vs), max = Math.max(...vs) || 1
  const x = (k) => m.s + (k / (punti.length - 1)) * (W - m.s - m.d)
  const y = (v) => m.a + (1 - (v - min) / (max - min || 1)) * (H - m.a - m.b)
  const d = punti.map((p, k) => `${k ? 'L' : 'M'}${x(k).toFixed(1)},${y(p.v).toFixed(1)}`).join(' ')
  const ultimo = punti[punti.length - 1], picco = punti.reduce((a, p) => (p.v > a.v ? p : a), punti[0])
  const giorno = (s) => { const dt = new Date(`${String(s).slice(0, 10)}T00:00:00Z`); return Number.isNaN(+dt) ? s : dt.toLocaleDateString('it-IT', { day: 'numeric', month: 'short', timeZone: 'UTC' }) }
  return (
    <div className="sn-grafico">
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label="andamento" preserveAspectRatio="none">
        <line x1={m.s} x2={W - m.d} y1={y(min)} y2={y(min)} className="sn-asse" />
        <path d={`${d} L${x(punti.length - 1)},${y(min)} L${x(0)},${y(min)} Z`} className="sn-area" />
        <path d={d} className="sn-linea" />
        <circle cx={x(punti.length - 1)} cy={y(ultimo.v)} r="3.5" className="sn-punto" />
      </svg>
      <div className="sn-grafico-piede">
        <span>{giorno(punti[0].x)}</span>
        <span>{`▲ ${formatta(picco.v)} · ${giorno(picco.x)}`}</span>
        <span>{giorno(ultimo.x)}</span>
      </div>
    </div>
  )
}

export default function SpiegaNumero({ titolo, valore, conto = [], risultato, nota, fonti = [], prima, serie, etichettaSerie, formatta = (v) => String(v), onClose }) {
  const { t } = useI18n()
  return (
    <Pannello titolo={titolo} sotto={t('sn.sub', null, 'Come nasce questo numero')} larghezza={620} onClose={onClose}>
      <div className="sn-valore">
        <b>{valore}</b>
        {prima && (prima.delta != null || (prima.valore != null && prima.valore !== '—')) && <span><Variazione delta={prima.delta} inverso={prima.inverso} />{prima.valore != null && prima.valore !== '—' && <i>{prima.etichetta} {prima.valore}</i>}</span>}
      </div>

      {conto.length > 0 && (
        <section className="sn-blocco">
          <h4>{t('sn.calc', null, 'Il conto')}</h4>
          <div className="sn-conto">
            {conto.map((r, k) => (
              <div key={k} className="sn-riga">
                <span className="sn-segno">{r.segno || ''}</span>
                <span className="sn-nome">{r.nome}{r.fonti?.length > 0 && <Fonte loghi={r.fonti} size={12} dopo />}</span>
                <span className="sn-cifra">{r.valore}</span>
              </div>
            ))}
            {risultato != null && (
              <div className="sn-riga sn-totale"><span className="sn-segno">=</span><span className="sn-nome">{titolo}</span><span className="sn-cifra">{risultato}</span></div>
            )}
          </div>
        </section>
      )}

      {(nota || fonti.length > 0) && (
        <section className="sn-blocco">
          <h4>{t('sn.source', null, 'Da dove viene')}{fonti.length > 0 && <Fonte loghi={fonti} size={13} dopo />}</h4>
          {nota && <p className="sn-nota">{nota}</p>}
        </section>
      )}

      {serie?.length >= 3 && (
        <section className="sn-blocco">
          <h4>{etichettaSerie || t('sn.trend', null, 'Andamento settimanale')}</h4>
          <Linea serie={serie} formatta={formatta} />
        </section>
      )}
    </Pannello>
  )
}
