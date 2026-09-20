'use client'

import { useEffect, useState } from 'react'
import Pannello from './ui/Pannello'
import { Bottone } from './ui/Mattoni'
import { leggi } from '../../lib/clientCache'
import { soldi } from '../../lib/client/soldi'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { FUSO_PREDEFINITO } from '../../lib/periodi'
import { parla, zitto, puoParlare, linguaVoce, euroDetti } from '../../lib/client/voce'

// ============================================================================
//  Il briefing del mattino: dieci secondi, una volta al giorno.
//
//  Alla PRIMA apertura della giornata (su questo dispositivo): com'e' andato ieri — la
//  giornata intera, chiusa — e cio' che il controllo notturno ha trovato fuori dalla norma.
//  Poi sparisce e non torna fino a domani. Si appoggia a due cose rifatte il 19 set 2026 e
//  quindi affidabili: /api/oggi-vs-ieri (ieri intero, stesse regole della Dashboard) e il
//  centro avvisi deterministico. Se una delle due non risponde, quel pezzo non si mostra;
//  se non c'e' niente da dire, il briefing non si apre affatto.
//
//  DIFFERENZA DAL FORK (travaso sul SaaS). Due cose:
//   · il pilota. Li' la rotta del mese arrivava da usePilota() di MissionControl; qui quel
//     componente puo' non esserci ancora, e un import rotto fa fallire il build di tutti.
//     Si legge quindi direttamente /api/pilota: se la route non c'e' o risponde male, il
//     blocco della rotta non compare e il resto del briefing non se ne accorge. L'URL e' lo
//     stesso, e la memoria di clientCache e' per URL: quando arrivera' la scheda del pilota
//     la chiamata resta UNA sola.
//   · il fuso. Nel fork era scritto "Europe/Rome": il negozio era uno. Qui i clienti possono
//     stare altrove, quindi si parte da FUSO_PREDEFINITO (lib/periodi.js), che dichiara di
//     essere un ripiego. Sbagliare fuso non da' errori: sposta solo il confine del giorno,
//     cioe' l'ora in cui il briefing si considera "di oggi".
// ============================================================================
const oggiQui = () => new Intl.DateTimeFormat('en-CA', { timeZone: FUSO_PREDEFINITO }).format(new Date())

export default function BriefingMattino() {
  const { t, intlLocale } = useI18n()
  const [dati, setDati] = useState(null)
  const [parlando, setParlando] = useState(false)
  useEffect(() => () => zitto(), [])

  useEffect(() => {
    let vivo = true
    const oggi = oggiQui()
    try { if (localStorage.getItem('lyft-briefing') === oggi) return } catch { return }   // senza memoria si riaprirebbe a ogni visita: meglio niente
    const ora = Number(new Intl.DateTimeFormat('en-GB', { timeZone: FUSO_PREDEFINITO, hour: '2-digit', hourCycle: 'h23' }).format(new Date()))
    if (ora < 6) return                                  // prima delle 6 il controllo notturno non ha ancora girato
    Promise.all([
      leggi('/api/oggi-vs-ieri').catch(() => null),
      fetch('/api/alerts', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      fetch('/api/profile', { cache: 'no-store' }).then(r => r.json()).catch(() => null),
      // Il pilota e' una tab a parte e puo' non esserci: "nessuna risposta" vale "nessuna rotta".
      leggi('/api/pilota').catch(() => null),
    ]).then(([ovi, al, pr, pil]) => {
      if (!vivo) return
      const ieri = ovi?.ok ? ovi.ieriIntero : null
      const avvisi = (al?.alerts || []).filter(a => (a.createdAt || '').slice(0, 10) >= oggi || a.severity === 'urgent').slice(0, 3)
      if (!ieri && !avvisi.length) return
      // `personale` e' il pop-up del profilo del fork (soprannome): dove non c'e' resta il nome
      // del team member, e se manca pure quello il briefing dice solo "Buongiorno".
      setDati({ ieri, avvisi, nome: pr?.personale?.nickname || (pr?.profile?.full_name || '').split(' ')[0] || '', giornoIeri: ovi?.ieri, pilota: (pil && !pil.error && pil.ok !== false) ? pil : null })
    })
    return () => { vivo = false }
  }, [])

  if (!dati) return null
  const chiudi = () => { zitto(); try { localStorage.setItem('lyft-briefing', oggiQui()) } catch {} ; setDati(null) }
  const { ieri, avvisi, nome, pilota } = dati
  const volte = (v) => (v == null ? '—' : `${Number(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}×`)
  const dataIeri = dati.giornoIeri ? new Date(`${dati.giornoIeri}T00:00:00Z`).toLocaleDateString(intlLocale || 'it-IT', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }) : ''
  const pulisci = (s) => String(s || '').replace(/^\[Auto-scan [^\]]+\]\s*/, '')

  // La rotta del mese e le mosse del pilota (se /api/pilota ha gia' risposto: non si aspetta).
  const tr = pilota?.traiettoria, scorso = pilota?.meseScorso?.totale, bil = pilota?.bilancio
  const vsScorso = tr && scorso > 0 ? Math.round(((tr.previsto - scorso) / scorso) * 100) : null
  const segnoPct = (n) => `${n >= 0 ? '+' : '−'}${Math.abs(n)}%`
  // Il briefing DETTO: le stesse cose che si leggono, in frasi.
  const ascoltaBriefing = () => {
    if (parlando) { zitto(); setParlando(false); return }
    const f = []
    f.push(nome ? t('brief.helloName', { n: nome }, `Buongiorno, ${nome}`) + '.' : t('brief.hello', null, 'Buongiorno') + '.')
    if (ieri) f.push(`${t('brief.yesterday', { d: dataIeri }, `Ieri, ${dataIeri}`)}: ${t('dash.revenue', null, 'Fatturato')} ${euroDetti(ieri.fatturato)}${ieri.ordini != null ? `, ${ieri.ordini} ${t('brief.orders', null, 'ordini')}` : ''}. ${t('dash.sumAdSpend', null, 'Spesa ADV')} ${euroDetti(ieri.spesa)}${ieri.mer > 0 ? `, MER ${Number(ieri.mer).toLocaleString(intlLocale || 'it-IT', { maximumFractionDigits: 1 })}` : ''}.`)
    f.push(`${t('brief.night', null, 'Dal controllo di stanotte')}: ${avvisi.length ? avvisi.map(a => pulisci(a.content)).join('. ') : t('brief.quiet', null, 'Niente fuori dalla norma: nessun avviso.')}`)
    if (tr) f.push(`${t('brief.course', null, 'La rotta del mese')}: ${t('brief.courseLine', { v: euroDetti(tr.previsto), d: vsScorso != null ? segnoPct(vsScorso) : '' }, `A fine mese ${euroDetti(tr.previsto)}`)}.`)
    if (bil?.proposte > 0) f.push(t('brief.movesLine', { n: bil.proposte, v: euroDetti(bil.inAttesaMese) }, `Mosse proposte dal pilota: ${bil.proposte}.`))
    if (parla(f.join(' '), linguaVoce(intlLocale), { onFine: () => setParlando(false) })) setParlando(true)
  }

  return (
    <Pannello titolo={nome ? t('brief.helloName', { n: nome }, `Buongiorno, ${nome}`) : t('brief.hello', null, 'Buongiorno')} sotto={t('brief.sub', null, 'Il punto in dieci secondi')}
      larghezza={560} onClose={chiudi}
      piede={<>{puoParlare() && <Bottone onClick={ascoltaBriefing}>{parlando ? t('brief.stop', null, 'Ferma') : t('brief.listen', null, 'Ascolta')}</Bottone>}<span style={{ flex: 1 }} /><Bottone tipo="primario" onClick={chiudi}>{t('brief.go', null, 'Vai alla Dashboard')}</Bottone></>}>
      {ieri && (
        <section className="br-blocco">
          <h4>{t('brief.yesterday', { d: dataIeri }, `Ieri, ${dataIeri}`)}</h4>
          <div className="br-numeri">
            <div><b>{ieri.fatturato != null ? soldi(ieri.fatturato) : '—'}</b><span>{t('dash.revenue', null, 'Fatturato')}{ieri.ordini != null ? ` · ${ieri.ordini} ${t('brief.orders', null, 'ordini')}` : ''}</span></div>
            <div><b>{ieri.spesa != null ? soldi(ieri.spesa) : '—'}</b><span>{t('dash.sumAdSpend', null, 'Spesa ADV')}</span></div>
            <div><b>{ieri.mer > 0 ? volte(ieri.mer) : '—'}</b><span>MER</span></div>
          </div>
        </section>
      )}
      {tr && (
        <section className="br-blocco">
          <h4>{t('brief.course', null, 'La rotta del mese')}</h4>
          <p className="br-quiete" style={{ color: 'var(--text)' }}>{t('brief.courseLine', { v: soldi(tr.previsto), d: vsScorso != null ? segnoPct(vsScorso) : '—' }, `A fine mese ${soldi(tr.previsto)}`)}</p>
          {bil?.proposte > 0 && <p className="br-quiete">{t('brief.movesLine', { n: bil.proposte, v: soldi(bil.inAttesaMese) }, `Mosse proposte dal pilota: ${bil.proposte}.`)}</p>}
        </section>
      )}
      <section className="br-blocco">
        <h4>{t('brief.night', null, 'Dal controllo di stanotte')}</h4>
        {avvisi.length === 0
          ? <p className="br-quiete">{t('brief.quiet', null, 'Niente fuori dalla norma: nessun avviso.')}</p>
          : <ul className="br-avvisi">{avvisi.map(a => <li key={a.id} className={a.severity === 'urgent' ? 'urgente' : ''}>{pulisci(a.content)}</li>)}</ul>}
      </section>
    </Pannello>
  )
}
