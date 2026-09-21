'use client'

import AzioneBarra from './ui/AzioneBarra'
import { avvisa } from '../../lib/client/avviso'
import { useState } from 'react'
import { presetToRange } from '../lib/reportRange'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import { useI18n } from '../../lib/i18n/I18nProvider'

// Bottone "Scarica report PDF" — genera il report del periodo selezionato.
// Props:
//  - tab: etichetta (es. "Weekly", "Meta Detail", "KPI Brain")
//  - preset / custom: timeframe (preset string oppure {since,until,label})
//  - campaigns: opzionale [{id,name}] → mostra un selettore campagna (Meta Detail)
//  - tipo: 'weekly' | 'monthly' | 'quarter' | 'year' per le tab del menu Report
//    (il `tab` arriva tradotto, questo no)
//  - ltv: { freq, life, margin } effettivi della tabella, cosi' LTV e LTV:CAC
//    nel PDF sono quelli che si vedono a schermo
export default function DownloadReportButton({ tab, preset, custom, campaigns = null, tipo = null, ltv = null, style }) {
  const { t } = useI18n()
  const [loading, setLoading] = useState(false)
  const [campaignId, setCampaignId] = useState('')

  const download = async () => {
    if (loading) return
    setLoading(true)
    try {
      const { since, until, prevSince, prevUntil, label } = presetToRange(preset, custom)
      const qs = new URLSearchParams({ tab, label, since, until, prevSince, prevUntil })
      if (preset && !custom) qs.set('preset', preset)
      if (campaignId) qs.set('campaignId', campaignId)
      if (tipo) qs.set('tipo', tipo)
      if (ltv && ltv.freq > 0 && ltv.life > 0 && ltv.margin > 0) {
        qs.set('ltvFreq', String(ltv.freq)); qs.set('ltvLife', String(ltv.life)); qs.set('ltvMargin', String(ltv.margin))
      }
      qs.set('locale', getClientLocale())
      const res = await fetch(`/api/report?${qs.toString()}`)
      const ct = res.headers.get('content-type') || ''
      // Una risposta d'errore NON e' un report. Prima si apriva in una scheda qualunque cosa non
      // fosse un PDF: con un 504 l'utente si trovava davanti il testo "FUNCTION_INVOCATION_TIMEOUT"
      // e nessuna spiegazione (Marino, 20 set: "si e' aperta una pagina web e non mi ha scaricato
      // il PDF"). Ora si dice che cosa e' successo, e non si apre niente.
      if (!res.ok) {
        // 503 "dati_non_freschi": una fonte ha risposto con dati vecchi o non ha risposto. Il report
        // non esce apposta, per non stampare numeri di ieri come se fossero di oggi: lo si dice.
        if (res.status === 503) {
          const j = await res.json().catch(() => null)
          if (j?.error === 'dati_non_freschi') {
            avvisa(t('report.notFresh', { f: (j.fonti || []).join(', ') }, `The report was not created: ${(j.fonti || []).join(', ')} did not return up-to-date data, and printing old numbers would be worse. Try again in a minute.`), 'errore', { durataMs: 11000 })
            return
          }
        }
        avvisa(res.status === 504 || res.status === 408
          ? t('report.tooSlow', null, 'The report was not generated: the server took too long. Try again in a moment.')
          : t('report.failedStatus', { s: res.status }, `The report was not generated (error ${res.status}). Try again in a moment.`), 'errore', { durataMs: 9000 })
        return
      }
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      if (ct.includes('pdf')) {
        const a = document.createElement('a')
        a.href = url
        a.download = `LyftAI_${String(tab).replace(/\s+/g, '_')}_${since}_${until}.pdf`
        document.body.appendChild(a); a.click(); a.remove()
      } else {
        // Il server non e' riuscito a stampare il PDF e ha mandato il report come pagina: si apre,
        // ma lo si DICE, con la via per salvarlo lo stesso.
        // window.open parte DOPO un'attesa lunga: per il browser non e' piu' "un clic dell'utente" e puo'
        // bloccarlo in silenzio. Si guarda se la scheda si e' aperta davvero; se no il report si salva
        // come file, e l'avviso dice quello che e' successo — non quello che si sperava.
        const scheda = window.open(url, '_blank')
        if (scheda) {
          avvisa(t('report.openedWeb', null, 'I could not create the PDF, so I opened the report in a new tab: from there you can save it with Print → Save as PDF.'), 'neutro', { durataMs: 9000 })
        } else {
          const a = document.createElement('a')
          a.href = url
          a.download = `LyftAI_${String(tab).replace(/\s+/g, '_')}_${since}_${until}.html`
          document.body.appendChild(a); a.click(); a.remove()
          avvisa(t('report.savedWeb', null, 'I could not create the PDF, so I saved the report as a web page in your downloads: open it and use Print → Save as PDF.'), 'neutro', { durataMs: 9000 })
        }
      }
      setTimeout(() => URL.revokeObjectURL(url), 15000)
    } catch (e) {
      avvisa(t('report.error', null, 'Error generating the report: ') + (e?.message || t('report.unknown', null, 'unknown')), 'errore')
    } finally {
      setLoading(false)
    }
  }

  // Senza il menu delle campagne non c'e' niente da disegnare qui: solo il bottone, che va nella barra.
  if (!campaigns) return (
    <AzioneBarra icona="download" gira={loading} disabled={loading} onClick={download}
        titolo={loading ? t('report.generating', null, 'Generating PDF…') : t('report.download', null, 'Download PDF report')} />
  )

  return (
    <div className="report-download" style={{ display: 'inline-flex', alignItems: 'center', gap: 8, ...style }}>
      {campaigns && (
        <select
          value={campaignId}
          onChange={(e) => setCampaignId(e.target.value)}
          className="btn-glass"
          style={{ padding: '9px 12px', fontWeight: 600, cursor: 'pointer', maxWidth: 240 }}
          title={t('report.pickCampaign', null, 'Choose a campaign for the hierarchical report')}
        >
          <option value="" style={{ background: 'var(--surface)' }}>{t('report.wholeAccount', null, 'Whole account')}</option>
          {campaigns.map(c => (
            <option key={c.id} value={c.id} style={{ background: 'var(--surface)' }}>{c.name}</option>
          ))}
        </select>
      )}
      {/* Sola icona, nella barra in alto accanto al periodo: stesso punto in ogni tab. */}
      <AzioneBarra icona="download" gira={loading} disabled={loading} onClick={download}
        titolo={loading ? t('report.generating', null, 'Generating PDF…') : t('report.download', null, 'Download PDF report')} />
    </div>
  )
}
