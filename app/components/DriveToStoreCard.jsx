'use client'

import { soldi } from '../../lib/client/soldi'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import PlatformIcon from './PlatformIcon'

// ============================================================================
//  La spesa Drive to Store, messa A PARTE e spiegata.
//
//  Quelle campagne sono tolte da ROAS, CAC, CPO e MER in tutto il SaaS. Togliere
//  un numero senza dire dove e' finito sarebbe peggio che lasciarlo: questa
//  scheda lo fa vedere accanto alle metriche da cui e' stato scorporato, e
//  scrive il perche'. Se nel periodo non c'e' stata spesa, non compare.
//
//  Si passa `since`/`until`, oppure `preset`.
//
//  SUL SAAS la scheda vale solo per chi HA negozi fisici (companies.negozi_fisici,
//  vedi supabase/tipo_negozio.sql e lib/team/tipoNegozio.js). Il gate sta nella route:
//  a interruttore spento risponde { attivo: false } senza chiamare Meta, e qui la
//  scheda non si monta. Spento e' anche il valore di serie: a un cliente che abbia
//  chiamato per caso una campagna "Drive to Store Launch" NON si toglie la spesa dai
//  conti alle spalle — e chi non ha negozi non si vede comparire una scheda che non
//  lo riguarda.
// ============================================================================

export default function DriveToStoreCard({ since, until, preset, style }) {
  const { t } = useI18n()
  const [d, setD] = useState(null)
  const [aperta, setAperta] = useState(false)

  useEffect(() => {
    const qs = since && until ? `since=${since}&until=${until}` : preset ? `preset=${encodeURIComponent(preset)}` : null
    if (!qs) return
    let vivo = true
    // La scheda sta in nove tab: lo stesso periodo si legge una volta sola.
    setD(inMemoria(`/api/drive-to-store?${qs}`))
    leggi(`/api/drive-to-store?${qs}`).then(j => { if (vivo && j?.ok) setD(j) }).catch(() => {})
    return () => { vivo = false }
  }, [since, until, preset])

  // `attivo === false` = il cliente non ha negozi fisici: la funzione e' proprio spenta.
  if (!d || d.attivo === false || !(d.spesa > 0)) return null
  const euro = (v) => soldi(v || 0, 2)

  return (
    <div className="dts-scheda" style={style}>
      {/* Una riga sola. La dicitura che la spesa e' fuori dalle metriche resta
          SEMPRE scritta; la spiegazione lunga e le campagne si aprono a richiesta:
          ripetuta per intero in nove tab occupava piu' dei numeri. */}
      <button className="dts-testa senza-tocco" onClick={() => setAperta(v => !v)} aria-expanded={aperta}>
        <span className="dts-titolo">
          <PlatformIcon platform="meta" size={13} />
          <b>{d.etichetta || t('dts.title', null, 'Drive to Store · negozi fisici')}</b>
          <span className="dts-fuori">{t('dts.out', null, 'fuori da ROAS, CAC, CPO e MER')}</span>
        </span>
        <span className="dts-destra">
          <span className="dts-cifra">{euro(d.spesa)}</span>
          <i className="dts-freccia">{aperta ? '▴' : '▾'}</i>
        </span>
      </button>
      {aperta && (
        <p className="dts-nota">
          {t('dts.note', null, 'Questa spesa NON entra nel calcolo di ROAS, CAC, CPO e MER: le campagne Drive to Store portano a un negozio su Google Maps, non al sito, quindi online non possono rendere. Resta conteggiata solo nel conto economico, perché è comunque un costo. La regola vale per ogni campagna con «drivetostore» nel nome, anche future.')}
        </p>
      )}
      {aperta && (
        <div className="dts-elenco">
          {(d.campagne || []).map(c => (
            <div key={c.nome} className="dts-riga">
              <span className="dts-nome">{c.nome}</span>
              <span className="dts-det">{(c.impression || 0).toLocaleString('it-IT', { useGrouping: 'always' })} {t('dts.impr', null, 'impression')} · {(c.clic || 0).toLocaleString('it-IT', { useGrouping: 'always' })} {t('dts.clicks', null, 'clic')}</span>
              <b>{euro(c.spesa)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
