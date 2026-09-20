'use client'

import { useEffect, useMemo, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { useAlerts } from './AlertsBell'
import { usePilota } from './MissionControl'
import { soldi } from '../../lib/client/soldi'

// ============================================================================
//  LA CAPSULA VIVA — in testata, sempre, in ogni tab: che cosa sta facendo il software
//  ADESSO. Una riga sola che cambia: il Cervello che risponde, i dati che si aggiornano,
//  le anomalie della notte, le mosse che aspettano una decisione; se non c'e' niente da
//  dire: "Nominale" e l'ora dell'ultimo dato. Quando le cose da dire sono piu' d'una, si
//  alternano ogni 5 secondi. Un clic porta dove la cosa si risolve.
// ============================================================================
export default function CapsulaViva({ updated, onVai }) {
  const { t, intlLocale } = useI18n()
  const { counts } = useAlerts()
  const { dati, caricato } = usePilota()
  const [parziali, setParziali] = useState(0)
  const [cervello, setCervello] = useState(false)
  const [giro, setGiro] = useState(0)

  useEffect(() => {
    const p = (e) => setParziali(e.detail?.quanti || 0)
    const c = (e) => setCervello(!!e.detail?.loading)
    window.addEventListener('lyft:dati-parziali', p); window.addEventListener('lyft:cervello', c)
    return () => { window.removeEventListener('lyft:dati-parziali', p); window.removeEventListener('lyft:cervello', c) }
  }, [])

  const voci = useMemo(() => {
    const v = []
    if (cervello) v.push({ id: 'cervello', attivo: true, testo: t('cap.brain', null, 'Il Cervello sta rispondendo') })
    if (parziali) v.push({ id: 'dati', attivo: true, testo: t('shell.partial', null, 'Dati in aggiornamento'), titolo: t('shell.partialHint', null, 'Una fonte ha chiesto di attendere: mostro quello che ho e ricarico da solo tra poco.') })
    if (!caricato) v.push({ id: 'rotta', attivo: true, testo: t('cap.route', null, 'Calcolo la rotta del mese') })
    const guai = (counts?.urgent || 0) + (counts?.warning || 0)
    if (guai) v.push({ id: 'guai', allarme: true, testo: guai === 1 ? t('mc.anomalyOne', null, '1 anomalia') : t('mc.anomalies', { n: guai }, `${guai} anomalie`), vai: () => window.dispatchEvent(new CustomEvent('lyft:apri-profilo', { detail: { scheda: 'avvisi' } })) })
    const b = dati?.bilancio
    if (b?.proposte > 0) v.push({ id: 'mosse', testo: t('cap.moves', { n: b.proposte, v: soldi(b.inAttesaMese, 0) }, `Mosse in attesa: ${b.proposte} · +${soldi(b.inAttesaMese, 0)}/mese`), vai: () => onVai?.('dashboard') })
    if (!v.length) {
      const ora = updated ? new Intl.DateTimeFormat(intlLocale, { hour: '2-digit', minute: '2-digit' }).format(new Date(updated)) : null
      v.push({ id: 'ok', quieto: true, testo: ora ? t('cap.nominalAt', { ora }, `Nominale · dati delle ${ora}`) : t('mc.nominal', null, 'Nominale') })
    }
    return v
  }, [cervello, parziali, caricato, counts, dati, updated, t, intlLocale, onVai])

  useEffect(() => { if (voci.length < 2) return; const k = setInterval(() => setGiro(g => g + 1), 5000); return () => clearInterval(k) }, [voci.length])
  const voce = voci[giro % voci.length]
  const Tag = voce.vai ? 'button' : 'span'
  return (
    <Tag {...(voce.vai ? { type: 'button', onClick: voce.vai } : {})} role="status" title={voce.titolo} className={`cap-viva${voce.allarme ? ' allarme' : ''}${voce.attivo ? ' attivo' : ''}${voce.quieto ? ' quieto' : ''}`}>
      <i aria-hidden="true" /><span key={voce.id} className="cap-testo">{voce.testo}</span>
    </Tag>
  )
}
