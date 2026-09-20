'use client'

import { NumeroAnimato, Variazione } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'

// ============================================================================
//  I tre numeri di Marino — fatturato, spesa ADV, MER — in cima alla Dashboard.
//
//  Seconda stesura (19 set): la prima era grande e a sinistra, con una frase lunga
//  ("troppo grande: falla centrata, caratteri piu' piccoli, piu' minimale"). Ora una
//  riga sola al centro: etichetta, numero, variazione, e sotto in piccolo il valore
//  di confronto. Niente colore: solo tipografia; verde e rosso stanno nella variazione.
//
//  Su "Oggi" il confronto e' con IERI ALLA STESSA ORA (/api/oggi-vs-ieri): contro la
//  giornata intera di ieri, alle quattro del pomeriggio il fatturato e' sempre "in
//  calo". Se ieri a quell'ora il numero era zero o negativo (un reso), la percentuale
//  non ha senso e non si scrive: resta il valore di ieri, che basta.
// ============================================================================
const perc = (ora, prima) => (ora != null && prima > 0 ? ((ora - prima) / prima) * 100 : null)

// La cifra e' quella di tutte le schede (una misura sola in tutto il prodotto). Resta una rete: la
// cella e' larga ~127 px (101 su telefono) e la cifra non va a capo, quindi un numero lunghissimo
// USCIREBBE dalla scheda — misurato il 20 set: "€32.692" a 35 px occupava 129 px. A 22 px ci sta
// fino a "€132.692"; da nove caratteri in su ("€1.595.982") i TRE numeri scendono insieme di un
// gradino, cosi' la striscia resta una. Le cifre sono a larghezza fissa: basta contare i caratteri.
const troppoLungo = (valori) => valori.some(v => String(v ?? '').length >= 9)

export default function SintesiDashboard({ periodo, stessaOra = null, fatturato, spesa, mer, ordini, prima = {}, t }) {
  const conIeri = !!stessaOra?.ieriAllaStessaOra
  const base = conIeri ? stessaOra.ieriAllaStessaOra : prima
  const merPrima = conIeri ? base.mer : (prima.fatturato > 0 && prima.spesa > 0 ? prima.fatturato / prima.spesa : null)
  const volte = (v) => (v == null ? '—' : `${v.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`)
  const etichettaPrima = conIeri ? t('dash.sumYesterday', null, 'ieri') : t('dash.sumBefore', null, 'prima')

  const vFatturato = fatturato > 0 ? soldi(fatturato) : '—'
  const vSpesa = spesa > 0 ? soldi(spesa) : '—'
  const vMer = volte(mer)
  const gradino = troppoLungo([vFatturato, vSpesa, vMer]) ? 'lungo' : undefined

  const numero = (etichetta, valore, delta, inverso, valorePrima, nota) => (
    <div className="ly-sintesi-numero">
      <div className="ly-sintesi-et">{etichetta}</div>
      <div className="ly-sintesi-val" data-lung={gradino}><NumeroAnimato>{valore}</NumeroAnimato></div>
      <div className="ly-sintesi-piede">
        <Variazione delta={delta} inverso={inverso} />
        {valorePrima != null && <span>{etichettaPrima} {valorePrima}</span>}
      </div>
      {nota && <div className="ly-sintesi-nota">{nota}</div>}
    </div>
  )

  const didascalia = conIeri
    ? t('dash.sumCaptionToday', { h: stessaOra.alle }, `Oggi alle ${stessaOra.alle} · confronto con ieri alla stessa ora`)
    : t('dash.sumCaptionPeriod', { p: periodo }, `${periodo} · confronto con il periodo precedente`)

  return (
    <section className="ly-sintesi">
      <div className="ly-sintesi-numeri">
        {numero(t('dash.revenue', null, 'Fatturato'), vFatturato, perc(fatturato, base.fatturato), false,
          base.fatturato != null ? soldi(base.fatturato) : null,
          ordini > 0 ? (ordini === 1 ? t('dash.sumOrdersOne', null, '1 ordine') : t('dash.sumOrders', { n: ordini }, `${ordini} ordini`)) : null)}
        {numero(t('dash.sumAdSpend', null, 'Spesa ADV'), vSpesa, perc(spesa, base.spesa), true,
          base.spesa != null ? soldi(base.spesa) : null, t('dash.sumMetaGoogle', null, 'Meta + Google'))}
        {numero('MER', vMer, perc(mer, merPrima), false, merPrima > 0 ? volte(merPrima) : null, t('dash.revenueDivSpend', null, 'Fatturato ÷ Spesa Ads'))}
      </div>
      <p className="ly-sintesi-didascalia">{didascalia}</p>
    </section>
  )
}
