'use client'

import { useCallback, useEffect, useState } from 'react'
import { Scheda, Bottone, Vuoto, Scheletro, Pastiglia } from './ui/Mattoni'
import { useI18n } from '../../lib/i18n/I18nProvider'

// «Crea la tua squadra»: cio' che prima era un file scritto a mano nel codice della squadra.
// Tre blocchi nella stessa pagina, dall'alto in basso: i collegamenti che servono, la scheda del
// brand (cio' che gli agenti devono sapere e non devono mai sbagliare) e gli agenti con il loro nome.
// Si puo' salvare e riprendere; «Crea la squadra» manda la richiesta.
const stileCampo = { width: '100%', fontSize: 13, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box', resize: 'vertical' }
const titolo = { fontSize: 15, fontWeight: 640, color: 'var(--text)', marginBottom: 4 }
const nota = { fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.5 }

export default function CreaSquadra() {
  const { t } = useI18n()
  const [d, setD] = useState(null)
  const [f, setF] = useState(null)        // i valori del modulo
  const [attesa, setAttesa] = useState(false)
  const [esito, setEsito] = useState(null)

  const leggi = useCallback(async () => {
    const j = await fetch('/api/squadra/crea', { cache: 'no-store' }).then(r => r.json()).catch(() => ({ ok: false }))
    setD(j)
    if (j.ok) {
      const c = j.configurazione || {}
      setF(prima => prima || {
        descrizione: c.descrizione || '', sito: c.sito || j.azienda?.sito || '', nicchia: c.nicchia || '', titolare: c.titolare || '',
        regole_brand: c.regole_brand || '', pareggio: c.pareggio || '', conoscenza: c.conoscenza || '',
        persone: Object.fromEntries((j.mestieri || []).map(m => [m.id, { nome: c.persone?.[m.id]?.nome || m.nome, acceso: m.fisso ? true : c.persone?.[m.id]?.acceso !== false }])),
      })
    }
  }, [])
  useEffect(() => { leggi() }, [leggi])

  const manda = async (azione) => {
    setAttesa(true); setEsito(null)
    try {
      const j = await fetch('/api/squadra/crea', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ azione, dati: f }) }).then(r => r.json())
      if (!j.ok) setEsito({ ok: false, testo: j.errore || t('studio.failed', null, 'Non riuscito') })
      else { setEsito({ ok: true, testo: azione === 'salva' ? t('crea.saved', null, 'Bozza salvata.') : '' }); await leggi() }
    } catch { setEsito({ ok: false, testo: t('studio.failed', null, 'Non riuscito') }) } finally { setAttesa(false) }
  }

  if (!d || (d.ok && !f)) return <Scheletro kpi={3} righe={6} />
  if (!d.ok || !d.pronto) return <Scheda><Vuoto titolo={t('studio.teamNoneTitle', null, 'Questo cliente non ha ancora una squadra')} testo={t('crea.notReady', null, 'La creazione della squadra dal prodotto non è ancora attiva su questo ambiente.')} /></Scheda>
  if (d.stato === 'richiesta') return (
    <Scheda><Vuoto titolo={t('crea.requestedTitle', null, 'La tua squadra è in preparazione')} testo={t('crea.requestedText', null, 'Abbiamo ricevuto la richiesta. Stiamo accendendo il servizio dedicato alla tua azienda: quando è pronto trovi qui l’ufficio con gli agenti. Di solito ci vuole meno di un giorno lavorativo.')} /></Scheda>
  )
  if (!d.admin) return <Scheda><Vuoto titolo={t('studio.teamNoneTitle', null, 'Questo cliente non ha ancora una squadra')} testo={t('crea.adminOnly', null, 'Solo un amministratore può creare la squadra.')} /></Scheda>

  const mancanti = (d.controlli || []).filter(c => c.obbligatorio && !c.ok)
  const campo = (k, righe) => righe
    ? <textarea rows={righe} value={f[k]} onChange={e => setF(v => ({ ...v, [k]: e.target.value }))} placeholder={t(`crea.ph.${k}`)} style={stileCampo} />
    : <input value={f[k]} onChange={e => setF(v => ({ ...v, [k]: e.target.value }))} placeholder={t(`crea.ph.${k}`)} style={stileCampo} />
  const voce = (k, righe, aiuto) => (
    <label style={{ display: 'grid', gap: 5 }}>
      <span style={{ fontSize: 13, fontWeight: 640, color: 'var(--text2)' }}>{t(`crea.f.${k}`)}</span>
      {campo(k, righe)}
      {aiuto && <span style={nota}>{t(`crea.h.${k}`)}</span>}
    </label>
  )

  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Scheda>
        <div style={{ fontSize: 20, fontWeight: 640, color: 'var(--text)' }}>{t('crea.title', null, 'Crea la tua squadra')}</div>
        <p style={{ fontSize: 13, color: 'var(--text2)', margin: '6px 0 0', maxWidth: 760, lineHeight: 1.5 }}>{t('crea.intro', null, 'Dodici agenti che lavorano ogni giorno su campagne, creatività, email e sito della tua azienda. Preparano tutto in bozza: esce solo ciò che approvi. Usano i tuoi collegamenti e la tua chiave Claude, quindi il consumo lo vedi e lo paghi direttamente tu.')}</p>
      </Scheda>

      <Scheda>
        <div style={titolo}>1 · {t('crea.s1', null, 'Collegamenti')}</div>
        <div style={{ ...nota, marginBottom: 12 }}>{t('crea.s1sub', null, 'Gli agenti lavorano con ciò che hai collegato nella tab Integrazioni. Quelli segnati come necessari servono per partire.')}</div>
        <div style={{ display: 'grid', gap: 8 }}>
          {(d.controlli || []).map(c => (
            <div key={c.id} style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
              <span style={{ fontSize: 13, color: 'var(--text)', minWidth: 190 }}>{t(`crea.c.${c.id}`)}</span>
              <Pastiglia tono={c.ok ? 'positivo' : c.obbligatorio ? 'negativo' : undefined}>{c.ok ? t('chiavi.collegato', null, 'Collegato') : t('chiavi.nonCollegato', null, 'Non collegato')}</Pastiglia>
              <span style={nota}>{c.obbligatorio ? t('crea.needed', null, 'necessario') : t(`crea.opt.${c.id}`)}</span>
            </div>
          ))}
        </div>
        {mancanti.length > 0 && <div style={{ marginTop: 12 }}><Bottone onClick={() => { window.location.href = '/integrazioni' }}>{t('crea.goIntegrations', null, 'Vai a Integrazioni')}</Bottone></div>}
      </Scheda>

      <Scheda>
        <div style={titolo}>2 · {t('crea.s2', null, 'Scheda del brand')}</div>
        <div style={{ ...nota, marginBottom: 12 }}>{t('crea.s2sub', null, 'È ciò che ogni agente legge prima di lavorare. Più è precisa, meno correzioni dovrai fare dopo.')}</div>
        <div style={{ display: 'grid', gap: 14 }}>
          {voce('descrizione', 2, true)}
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
            {voce('sito')}{voce('nicchia')}{voce('titolare', 0, true)}
          </div>
          {voce('regole_brand', 4, true)}
          {voce('pareggio', 2, true)}
          {voce('conoscenza', 8, true)}
        </div>
      </Scheda>

      <Scheda>
        <div style={titolo}>3 · {t('crea.s3', null, 'Gli agenti')}</div>
        <div style={{ ...nota, marginBottom: 12 }}>{t('crea.s3sub', null, 'Puoi cambiare i nomi e spegnere i mestieri che non ti servono, per esempio la newsletter se la cura un’agenzia. Direttore, Controllo qualità e Archivista restano sempre accesi.')}</div>
        <div style={{ display: 'grid', gap: 8, gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))' }}>
          {(d.mestieri || []).map(m => {
            const p = f.persone[m.id]
            return (
              <div key={m.id} style={{ display: 'flex', gap: 10, alignItems: 'center', border: '1px solid var(--border)', borderRadius: 12, padding: '10px 12px', opacity: p.acceso ? 1 : 0.55 }}>
                <input type="checkbox" checked={p.acceso} disabled={m.fisso} aria-label={t(`crea.m.${m.id}`)} onChange={e => setF(v => ({ ...v, persone: { ...v.persone, [m.id]: { ...p, acceso: e.target.checked } } }))} />
                <div style={{ flex: 1, minWidth: 0, display: 'grid', gap: 4 }}>
                  <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t(`crea.m.${m.id}`)}</span>
                  <input value={p.nome} onChange={e => setF(v => ({ ...v, persone: { ...v.persone, [m.id]: { ...p, nome: e.target.value } } }))} style={{ ...stileCampo, padding: '6px 10px' }} />
                </div>
              </div>
            )
          })}
        </div>
      </Scheda>

      <Scheda>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <Bottone tipo="primario" disabled={attesa || mancanti.length > 0} onClick={() => manda('richiedi')}>{attesa ? '…' : t('crea.create', null, 'Crea la squadra')}</Bottone>
          <Bottone disabled={attesa} onClick={() => manda('salva')}>{t('crea.save', null, 'Salva la bozza')}</Bottone>
          {mancanti.length > 0 && <span style={nota}>{t('crea.missing', null, 'Collega prima ciò che manca al passo 1.')}</span>}
        </div>
        {esito?.testo && <div role="status" style={{ fontSize: 11.5, marginTop: 8, color: esito.ok ? 'var(--green)' : 'var(--red)' }}>{esito.testo}</div>}
        <div style={{ ...nota, marginTop: 8 }}>{t('crea.footer', null, 'La squadra parte in sola bozza: niente viene pubblicato, inviato o modificato sul negozio senza una persona che lo approva.')}</div>
      </Scheda>
    </div>
  )
}
