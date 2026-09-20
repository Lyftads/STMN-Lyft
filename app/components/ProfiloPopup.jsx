'use client'

import { useEffect, useState } from 'react'
import Pannello from './ui/Pannello'
import Avatar from './Avatar'
import Icon from './ui/Icon'
import ElencoAlert from './AlertsBell'
import { Linguette, Bottone } from './ui/Mattoni'
import { impostaTema, sceltaTema } from './AutoTheme'
import { avvisa } from '../../lib/client/avviso'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS, LOCALE_FLAGS } from '../../lib/i18n/locales'
import { getBrowserSupabase } from '../../lib/supabase/client'

// ============================================================================
//  Il pop-up del profilo: si apre cliccando sul proprio nome in fondo al menu.
//
//  Tutto cio' che riguarda LA PERSONA sta qui, e non piu' sparso nella barra in
//  alto: foto, nome, soprannome, "chi sei"; quali notifiche ricevere per email;
//  lingua e tema; il centro avvisi. La barra in alto resta per le azioni della
//  tab (guida, cerca, notifiche, aggiorna, PDF, periodo).
//
//  Lingua e tema valgono subito, al click. Profilo e notifiche con "Salva".
// ============================================================================
const TIPI = ['tasks', 'comments', 'projects', 'creatives', 'chat']

export default function ProfiloPopup({ onClose, onSaved, avvisi, apri = 'profilo' }) {
  const { t, locale, setLocale } = useI18n()
  const [scheda, setScheda] = useState(apri)
  const [profilo, setProfilo] = useState(null)
  const [pronto, setPronto] = useState(false)
  const [nome, setNome] = useState('')
  const [soprannome, setSoprannome] = useState('')
  const [bio, setBio] = useState('')
  const [ruolo, setRuolo] = useState('')
  const [tutte, setTutte] = useState(true)
  const [tipi, setTipi] = useState(TIPI)
  const [file, setFile] = useState(null)
  const [anteprima, setAnteprima] = useState(null)
  const [salvo, setSalvo] = useState(false)
  const [tema, setTema] = useState('light')

  useEffect(() => {
    setTema(sceltaTema())
    fetch('/api/profile', { cache: 'no-store' }).then(r => r.json()).then(d => {
      setProfilo(d.profile || null)
      setNome(d.profile?.full_name || '')
      setAnteprima(d.profile?.avatar_url || null)
      setSoprannome(d.personale?.nickname || '')
      // "Chi sei" non parte mai vuoto: se la persona non ha scritto niente ci va il suo RUOLO
      // (Marino, 19 set), e poi puo' aggiungere quello che vuole. Si salva come testo normale.
      setRuolo(d.ruolo || '')
      setBio(d.personale?.bio || d.ruolo || '')
      setTutte(d.personale?.emailAll !== false)
      setTipi(d.personale?.emailAll === false ? (d.personale.emailTypes || []) : TIPI)
    }).catch(() => {}).finally(() => setPronto(true))
  }, [])

  // La foto si RIMPICCIOLISCE qui, prima di partire: si mostra al massimo a 72 px, e una foto da
  // telefono pesa anche 1 MB. La mia, caricata a grandezza piena, era gli 860 KB piu' pesanti
  // dell'avvio della Dashboard (misurato il 19 set) — per un cerchietto da 32 px nel menu.
  async function scegliFoto(e) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    let pronta = f
    try {
      const img = await createImageBitmap(f)
      const lato = 384, q = Math.min(img.width, img.height)
      const tela = document.createElement('canvas'); tela.width = tela.height = lato
      // quadrato centrale: l'avatar e' un cerchio, i bordi non si vedrebbero comunque
      tela.getContext('2d').drawImage(img, (img.width - q) / 2, (img.height - q) / 2, q, q, 0, 0, lato, lato)
      const blob = await new Promise(r => tela.toBlob(r, 'image/jpeg', 0.86))
      if (blob && blob.size < f.size) pronta = new File([blob], 'avatar.jpg', { type: 'image/jpeg' })
    } catch {}   // formato che il browser non sa leggere: parte l'originale, come prima
    setFile(pronta); setAnteprima(URL.createObjectURL(pronta))
  }

  // "Tutte" accende ogni voce; spegnere una voce spegne "tutte"; riaccenderle
  // tutte a mano equivale a "tutte" (cosi' chi le ha tutte riceve anche le
  // famiglie di notifiche che nasceranno domani).
  function cambiaTutte(v) { setTutte(v); if (v) setTipi(TIPI) }
  function cambiaTipo(k) {
    const dopo = tipi.includes(k) ? tipi.filter(x => x !== k) : [...tipi, k]
    setTipi(dopo)
    setTutte(dopo.length === TIPI.length)
  }

  async function salva() {
    setSalvo(true)
    try {
      const fd = new FormData()
      if (nome.trim()) fd.append('full_name', nome.trim())
      fd.append('nickname', soprannome)
      fd.append('bio', bio)
      fd.append('email_all', tutte ? '1' : '0')
      fd.append('email_types', tipi.join(','))
      if (file) fd.append('avatar', file)
      const r = await fetch('/api/profile', { method: 'POST', body: fd }).then(x => x.json()).catch(() => ({}))
      if (!r.ok) { avvisa(r.error || t('profile.saveError', null, 'Errore salvataggio profilo'), 'errore'); return }
      avvisa(t('profilo.saved', null, 'Profilo salvato'), 'ok')
      const dati = { profile: r.profile || profilo, personale: r.personale || null }
      try { window.dispatchEvent(new CustomEvent('lyft:profilo', { detail: dati })) } catch {}
      if (onSaved && r.profile) onSaved(r.profile)
      onClose?.()
    } finally { setSalvo(false) }
  }

  async function esci() {
    const supabase = getBrowserSupabase()
    if (supabase) await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const nAvvisi = avvisi?.counts?.total || 0
  const voci = [
    { id: 'profilo', label: t('profilo.tabProfilo', null, 'Profilo') },
    { id: 'notifiche', label: t('profilo.tabNotifiche', null, 'Notifiche') },
    { id: 'aspetto', label: t('profilo.tabAspetto', null, 'Lingua e tema') },
    ...(avvisi ? [{ id: 'avvisi', label: t('profilo.tabAvvisi', null, 'Avvisi'), n: nAvvisi || null }] : []),
  ]
  const mostrato = soprannome.trim() || nome.trim() || profilo?.email || ''

  return (
    <Pannello
      titolo={t('profilo.title', null, 'Il tuo profilo')}
      sotto={profilo?.email || ''}
      onClose={onClose}
      larghezza={620}
      altezza={760}
      piede={(
        <>
          <Bottone tipo="discreto" onClick={esci} style={{ color: 'var(--rosso, #ff453a)' }}>{t('profilo.logout', null, 'Esci')}</Bottone>
          <span style={{ flex: 1 }} />
          <Bottone onClick={onClose}>{t('common.cancel', null, 'Annulla')}</Bottone>
          <Bottone tipo="primario" onClick={salva} disabled={salvo || !pronto}>{salvo ? t('metaConnect.saving', null, 'Salvataggio…') : t('common.save', null, 'Salva')}</Bottone>
        </>
      )}
    >
      <Linguette voci={voci} valore={scheda} onChange={setScheda} style={{ marginBottom: 20 }} />

      {scheda === 'profilo' && (
        <div className="pf-blocco">
          <div className="pf-foto">
            <Avatar name={mostrato} url={anteprima} size={72} />
            <div>
              <label className="ly-btn" style={{ cursor: 'pointer' }}>
                {t('profile.changePhoto', null, 'Cambia foto')}
                <input type="file" hidden accept=".png,.jpg,.jpeg,.webp,.gif" onChange={scegliFoto} />
              </label>
              <div className="pf-nota">{t('profilo.photoHint', null, 'PNG, JPG o WebP, fino a 3 MB')}</div>
            </div>
          </div>

          <label className="pf-campo">
            <span>{t('profile.fullName', null, 'Nome e cognome')}</span>
            <input value={nome} onChange={e => setNome(e.target.value)} placeholder={t('profile.namePlaceholder', null, 'Mario Rossi')} />
          </label>
          <label className="pf-campo">
            <span>{t('profilo.nickname', null, 'Soprannome')}</span>
            <input value={soprannome} maxLength={40} onChange={e => setSoprannome(e.target.value)} placeholder={t('profilo.nicknamePh', null, 'Come vuoi essere chiamato')} />
            <em>{t('profilo.nicknameHint', null, 'È il nome che vedi in fondo al menu al posto di nome e cognome.')}</em>
          </label>
          <label className="pf-campo">
            <span>{t('profilo.bio', null, 'Chi sei')}</span>
            <textarea value={bio} maxLength={400} rows={4} onChange={e => setBio(e.target.value)} placeholder={t('profilo.bioPh', null, 'Il tuo ruolo, di cosa ti occupi, quando sei reperibile…')} />
            <em>{ruolo ? `${t('profilo.role', null, 'Ruolo')}: ${ruolo} · ` : ''}{bio.length}/400</em>
          </label>
        </div>
      )}

      {scheda === 'notifiche' && (
        <div className="pf-blocco">
          <div className="pf-titolo"><Icon name="mail" size={15} /> {t('profilo.emailTitle', null, 'Notifiche via email')}</div>
          {profilo?.email && <div className="pf-nota" style={{ marginTop: -6 }}>{t('profilo.emailTo', { email: profilo.email }, `Arrivano a ${profilo.email}`)}</div>}

          <Riga acceso={tutte} onChange={() => cambiaTutte(!tutte)} forte
            titolo={t('profilo.emailAll', null, 'Tutte le notifiche')}
            nota={t('profilo.emailAllHint', null, 'Ricevi per email tutto quello che arriva nella campanella.')} />

          <div className="pf-nota" style={{ marginTop: 4 }}>{t('profilo.emailSome', null, 'Oppure scegli solo quelle che ti servono:')}</div>
          <div className="pf-elenco">
            {TIPI.map(k => (
              <Riga key={k} acceso={tipi.includes(k)} onChange={() => cambiaTipo(k)}
                titolo={t(`profilo.tipo.${k}`, null, k)}
                nota={t(`profilo.tipo.${k}Hint`, null, '')} />
            ))}
          </div>
        </div>
      )}

      {scheda === 'aspetto' && (
        <div className="pf-blocco">
          <div className="pf-titolo"><Icon name="globe" size={15} /> {t('profilo.lingua', null, 'Lingua')}</div>
          <div className="pf-scelte">
            {LOCALES.map(l => (
              <button key={l} type="button" className={`pf-scelta senza-tocco${l === locale ? ' scelta' : ''}`} aria-pressed={l === locale} onClick={() => setLocale(l)}>
                <span style={{ fontSize: 17, lineHeight: 1 }}>{LOCALE_FLAGS[l]}</span>{LOCALE_LABELS[l]}
              </button>
            ))}
          </div>

          <div className="pf-titolo" style={{ marginTop: 10 }}>{t('profilo.tema', null, 'Tema')}</div>
          <div className="pf-scelte">
            {[['light', t('profilo.giorno', null, 'Giorno')], ['dark', t('profilo.notte', null, 'Notte')], ['auto', t('profilo.automatico', null, 'Automatico')]].map(([k, nomeTema]) => (
              <button key={k} type="button" className={`pf-scelta senza-tocco${tema === k ? ' scelta' : ''}`} aria-pressed={tema === k} onClick={() => { impostaTema(k); setTema(k) }}>
                {nomeTema}
              </button>
            ))}
          </div>
          <div className="pf-nota">{t('profilo.aspettoHint', null, 'Lingua e tema cambiano subito, senza salvare.')}</div>
        </div>
      )}

      {scheda === 'avvisi' && avvisi && <ElencoAlert {...avvisi} t={t} />}
    </Pannello>
  )
}

function Riga({ acceso, onChange, titolo, nota, forte = false }) {
  return (
    <label className={`pf-riga${forte ? ' forte' : ''}`}>
      <input type="checkbox" checked={acceso} onChange={onChange} />
      <span className="pf-segno" aria-hidden="true">{acceso && <Icon name="check" size={11} />}</span>
      <span className="pf-riga-testo"><b>{titolo}</b>{nota && <i>{nota}</i>}</span>
    </label>
  )
}
