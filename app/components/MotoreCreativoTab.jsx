'use client'

import { useEffect, useState } from 'react'
import { Scheda, Bottone, Vuoto, Scheletro } from './ui/Mattoni'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { leggi as leggiInMemoria, inMemoria } from '../../lib/clientCache'

// Il Motore Creativo dentro il prodotto. La board ha una pagina sua (/motore) col suo
// foglio di stile: qui la si mostra in una cornice che occupa la tab. Prima pero' si
// chiede al server se per QUESTO cliente il Motore e' acceso: chi non l'ha mai usato
// vede cosa fa e il bottone per accenderlo, non una board vuota piena di errori.
export default function MotoreCreativoTab() {
  const { t } = useI18n()
  // Si parte dall'ultimo dato letto: tornando sulla tab non c'e' attesa.
  const [stato, setStato] = useState(() => inMemoria('/api/motore/cliente'))   // null = carico · { attivo, nome } · { errore }
  const [accendo, setAccendo] = useState(false)

  const leggi = (forza = false) => leggiInMemoria('/api/motore/cliente', { forza, onUpdate: setStato })
    .then(j => setStato(j && !j.error ? j : { errore: j?.error || 'errore' }))
    .catch(() => setStato({ errore: 'rete' }))
  useEffect(() => { leggi() }, [])

  const accendi = async () => {
    setAccendo(true)
    try {
      const r = await fetch('/api/motore/cliente', { method: 'POST' })
      const j = await r.json().catch(() => ({}))
      if (!r.ok) setStato(s => ({ ...s, avviso: j.error || 'errore' })); else await leggi(true)
    } finally { setAccendo(false) }
  }

  if (!stato) return <Scheletro kpi={4} righe={6} />
  if (stato.errore) return (
    <Scheda><Vuoto titolo={t('studio.motoreErrTitle', null, 'Il Motore Creativo non risponde')} testo={t('studio.motoreErrText', null, 'Riprova fra poco. Se continua, controlla di essere dentro il workspace giusto.')}>
      <Bottone onClick={() => { setStato(null); leggi(true) }}>{t('studio.retry', null, 'Riprova')}</Bottone>
    </Vuoto></Scheda>
  )
  if (!stato.attivo) return (
    <>
      <Scheda><Vuoto titolo={t('studio.motoreOffTitle', null, 'Non è ancora acceso per questo cliente')} testo={`${t('studio.motoreSub', null, 'Legge le inserzioni Meta e le vendite, dice quali creatività spegnere e quali scalare, e prepara ogni settimana le prossime da provare.')} ${t('studio.motoreOffText', null, 'Servono Shopify e Meta collegati dalla tab Integrazioni. Da quando lo accendi, ogni notte misura le creatività e aggiorna la board.')}`}>
        <Bottone tipo="primario" onClick={accendi} disabled={accendo}>{accendo ? t('studio.motoreTurningOn', null, 'Accendo…') : t('studio.motoreTurnOn', null, 'Accendi il Motore Creativo')}</Bottone>
        {stato.avviso && <span>{stato.avviso}</span>}
      </Vuoto></Scheda>
    </>
  )
  return (
    <iframe title={t('studio.motoreTitle', null, 'Motore Creativo')} src="/motore"
      style={{ display: 'block', width: '100%', height: 'calc(100dvh - 96px)', minHeight: 560, border: 0, borderRadius: 14, background: '#000' }} />
  )
}
