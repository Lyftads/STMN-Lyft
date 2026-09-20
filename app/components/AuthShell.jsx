'use client'

import { useId, useState } from 'react'
import Icon from './ui/Icon'
import LogoMark from './LogoMark'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { LOCALES, LOCALE_LABELS } from '../../lib/i18n/locales'

// ============================================================================
//  Il guscio di accesso: login, recupero e conferma della password.
//
//  Rifatto il 19 set 2026. Era rimasto allo stile di una volta — vetro nero, aloni
//  viola, bottone sfumato — mentre tutto il resto dell'app e' passato al sistema
//  sobrio (niente colore, tipografia, superfici piane). La prima pagina che si vede
//  era l'unica che non somigliava al prodotto.
//  Ora: stesso marchio del menu, una scheda piana al centro, campi e bottone del
//  sistema (classi ly-auth-* in lyft-system.css), tema chiaro di partenza come
//  l'app, e la lingua si sceglie qui sotto — prima di entrare non c'e' il profilo.
// ============================================================================

export function AuthShell({ title, subtitle, children }) {
  const { locale, setLocale } = useI18n()
  return (
    <div className="auth-shell ly-auth">
      <main className="auth-card ly-auth-scheda">
        <div className="ly-auth-marchio">
          <LogoMark size={30} withGlow={false} />
          <span>LyftAI</span>
        </div>
        <h1 className="ly-auth-titolo">{title}</h1>
        {subtitle && <p className="ly-auth-sotto">{subtitle}</p>}
        {children}
      </main>
      <nav className="ly-auth-lingue" aria-label="Language">
        {LOCALES.map(l => (
          <button key={l} type="button" className={`senza-tocco${l === locale ? ' scelta' : ''}`} aria-pressed={l === locale} onClick={() => setLocale(l)} title={LOCALE_LABELS[l]}>
            {l.toUpperCase()}
          </button>
        ))}
      </nav>
    </div>
  )
}

export function AuthInput({ label, hint, type, ...props }) {
  const { t } = useI18n()
  const generatedId = useId()
  const inputId = props.id || generatedId
  const [show, setShow] = useState(false)
  const isPassword = type === 'password'
  const inputType = isPassword ? (show ? 'text' : 'password') : type
  const mostra = show ? t('auth.hidePw', null, 'Nascondi password') : t('auth.showPw', null, 'Mostra password')
  return (
    <div className="ly-auth-campo">
      <label htmlFor={inputId}>{label}</label>
      <div style={{ position: 'relative' }}>
        <input type={inputType} {...props} id={inputId} style={isPassword ? { paddingRight: 46 } : undefined} />
        {isPassword && (
          <button type="button" className="ly-auth-occhio senza-tocco" onClick={() => setShow(s => !s)} aria-label={mostra} title={mostra}>
            <Icon name={show ? 'eye-off' : 'eye'} size={17} />
          </button>
        )}
      </div>
      {hint && <div className="ly-auth-nota">{hint}</div>}
    </div>
  )
}

export function AuthButton({ loading, children }) {
  return (
    <button className="auth-submit ly-auth-bottone" type="submit" disabled={loading}>
      {loading && <span className="ly-auth-giro" aria-hidden="true" />}
      {children}
    </button>
  )
}

export function AuthError({ error }) {
  if (!error) return null
  return <div role="alert" className="auth-error ly-auth-errore">{error}</div>
}
