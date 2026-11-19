'use client'

import { useCallback, useEffect, useState } from 'react'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { leggi as leggiInMemoria, inMemoria } from '../../lib/clientCache'

// ============================================================================
//  «Come si fa» per ogni integrazione, e le schede dei servizi che si collegano
//  con una chiave (ChatGPT, Claude, Higgsfield, casella di posta).
//
//  Chi collega un servizio per la prima volta non sa dove si crea una chiave
//  ne' quale dei due valori incollare: la guida sta DENTRO la scheda, coi
//  passi numerati e il link alla pagina giusta, non in un manuale a parte.
//  I testi stanno nei dizionari (guida.*) nelle cinque lingue.
// ============================================================================

// passi = quanti passi ha la guida (guida.<id>.p1 … pN); link = pagine da aprire.
export const GUIDE = {
  shopify: { passi: 3, link: [] },
  meta: { passi: 3, link: [{ k: 'guida.meta.l1', href: 'https://business.facebook.com/settings' }] },
  google: { passi: 3, link: [{ k: 'guida.google.l1', href: 'https://analytics.google.com/' }, { k: 'guida.google.l2', href: 'https://search.google.com/search-console' }] },
  ads: { passi: 2, link: [{ k: 'guida.ads.l1', href: 'https://ads.google.com/' }] },
  klaviyo: { passi: 3, link: [{ k: 'guida.klaviyo.l1', href: 'https://www.klaviyo.com/settings/account/users' }] },
  calendario: { passi: 3, link: [{ k: 'guida.calendario.l1', href: 'https://calendar.google.com/' }] },
  posta: { passi: 4, link: [{ k: 'guida.posta.l1', href: 'https://myaccount.google.com/signinoptions/two-step-verification' }, { k: 'guida.posta.l2', href: 'https://myaccount.google.com/apppasswords' }] },
  higgsfield: { passi: 3, link: [{ k: 'guida.higgsfield.l1', href: 'https://cloud.higgsfield.ai/api-keys' }] },
  anthropic: { passi: 4, link: [{ k: 'guida.anthropic.l1', href: 'https://platform.claude.com/settings/keys' }, { k: 'guida.anthropic.l2', href: 'https://platform.claude.com/settings/billing' }] },
  openai: { passi: 4, link: [{ k: 'guida.openai.l1', href: 'https://platform.openai.com/api-keys' }, { k: 'guida.openai.l2', href: 'https://platform.openai.com/settings/organization/billing/overview' }] },
}

export function ComeSiFa({ id }) {
  const { t } = useI18n()
  const g = GUIDE[id]
  if (!g) return null
  return (
    <details style={{ width: '100%', borderTop: '1px solid var(--border)', paddingTop: 10 }}>
      <summary style={{ fontSize: 13, fontWeight: 640, color: 'var(--text2)', cursor: 'pointer' }}>{t('guida.titolo', null, 'Come si fa')}</summary>
      <ol style={{ margin: '10px 0 0', paddingLeft: 20, listStyle: 'decimal', display: 'grid', gap: 7, fontSize: 13, lineHeight: 1.5, color: 'var(--text2)' }}>
        {Array.from({ length: g.passi }, (_, i) => <li key={i} style={{ listStyle: 'decimal', display: 'list-item' }}>{t(`guida.${id}.p${i + 1}`)}</li>)}
      </ol>
      {g.link.length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
          {g.link.map(l => (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
              style={{ fontSize: 11.5, fontWeight: 640, color: 'var(--text)', border: '1px solid var(--border2)', borderRadius: 999, padding: '5px 11px', textDecoration: 'none' }}>
              {t(l.k)} ↗
            </a>
          ))}
        </div>
      )}
    </details>
  )
}

// I campi che ogni servizio chiede. `segreto` = non si mostra mentre si scrive.
const CAMPI = {
  openai: [{ id: 'chiave', k: 'chiavi.campoChiave', ph: 'sk-…', segreto: true }],
  anthropic: [{ id: 'chiave', k: 'chiavi.campoChiave', ph: 'sk-ant-…', segreto: true }],
  higgsfield: [{ id: 'id', k: 'chiavi.campoHfId', ph: 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx' }, { id: 'segreto', k: 'chiavi.campoHfSegreto', ph: '', segreto: true }],
  posta: [{ id: 'indirizzo', k: 'chiavi.campoIndirizzo', ph: 'assistenza@tuodominio.it' }, { id: 'password', k: 'chiavi.campoPasswordApp', ph: 'xxxx xxxx xxxx xxxx', segreto: true }],
}
const ALTRO_PROVIDER = [{ id: 'imap', k: 'chiavi.campoImap', ph: 'imap.tuoprovider.it' }, { id: 'smtp', k: 'chiavi.campoSmtp', ph: 'smtp.tuoprovider.it' }]

const stileCampo = { width: '100%', fontSize: 13, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box' }
const stileBottone = { fontSize: 13, fontWeight: 640, padding: '8px 16px', borderRadius: 999, border: '1px solid var(--border2)', background: 'var(--glass)', color: 'var(--text)', cursor: 'pointer' }

// Una scheda: stato, modulo, guida. `Guscio` e' la OAuthCard della tab (stesso aspetto delle altre).
export function SchedaChiave({ servizio, Guscio, domain, name, descKey, desc, stato, admin, pronto, dopo }) {
  const { t } = useI18n()
  const [aperta, setAperta] = useState(false)
  const [valori, setValori] = useState({})
  const [altro, setAltro] = useState(false)
  const [attesa, setAttesa] = useState(false)
  const [esito, setEsito] = useState(null)   // { ok, testo }
  const collegato = !!stato
  const campi = [...CAMPI[servizio], ...(servizio === 'posta' && altro ? ALTRO_PROVIDER : [])]
  const completo = campi.every(c => String(valori[c.id] || '').trim())

  const salva = async () => {
    setAttesa(true); setEsito(null)
    try {
      const r = await fetch('/api/integrations/chiavi', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ servizio, campi: valori }) })
      const j = await r.json().catch(() => ({}))
      if (j.ok) { setValori({}); setAperta(false); setEsito({ ok: true, testo: j.verificata ? t('chiavi.salvataProvata', null, 'Chiave provata e salvata.') : t('chiavi.salvataNonProvata', null, 'Chiave salvata. Non si può provare prima: lo dirà la prima generazione.') }); dopo?.() }
      else setEsito({ ok: false, testo: j.errore || t('chiavi.errore', null, 'Non riuscito') })
    } catch { setEsito({ ok: false, testo: t('chiavi.errore', null, 'Non riuscito') }) } finally { setAttesa(false) }
  }
  const scollega = async () => {
    if (!window.confirm(t('chiavi.confermaScollega', { nome: name }, `Scollego ${name}? Le funzioni che lo usano si fermano.`))) return
    setAttesa(true); setEsito(null)
    try { await fetch(`/api/integrations/chiavi?servizio=${servizio}`, { method: 'DELETE' }); dopo?.() } finally { setAttesa(false) }
  }

  return (
    <Guscio domain={domain} name={name} desc={t(descKey, null, desc)}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
        {collegato
          ? <span style={{ fontSize: 11.5, fontWeight: 640, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)' }} />{t('chiavi.collegato', null, 'Collegato')} · <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{stato.etichetta}{stato.verificata ? '' : ` · ${t('chiavi.nonProvata', null, 'non provata')}`}</span></span>
          : <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('chiavi.nonCollegato', null, 'Non collegato')}</span>}
        <span style={{ flex: 1 }} />
        {admin && pronto && <button type="button" style={stileBottone} disabled={attesa} onClick={() => { setAperta(x => !x); setEsito(null) }}>{collegato ? t('chiavi.cambia', null, 'Cambia') : t('integrations.connectBtn', null, 'Collega')}</button>}
        {admin && collegato && <button type="button" style={{ ...stileBottone, background: 'transparent', color: 'var(--text3)' }} disabled={attesa} onClick={scollega}>{t('chiavi.scollega', null, 'Scollega')}</button>}
      </div>
      {!pronto && <div style={{ fontSize: 11.5, color: 'var(--text3)', width: '100%' }}>{t('chiavi.archivioAssente', null, 'L’archivio delle chiavi non è ancora attivo su questo ambiente.')}</div>}
      {pronto && !admin && <div style={{ fontSize: 11.5, color: 'var(--text3)', width: '100%' }}>{t('chiavi.soloAdmin', null, 'Solo un amministratore può collegare questo servizio.')}</div>}
      {aperta && (
        <div style={{ display: 'grid', gap: 8, width: '100%' }}>
          {campi.map(c => (
            <label key={c.id} style={{ display: 'grid', gap: 4 }}>
              <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t(c.k)}</span>
              <input type={c.segreto ? 'password' : 'text'} autoComplete="off" spellCheck={false} value={valori[c.id] || ''} placeholder={c.ph}
                onChange={e => setValori(v => ({ ...v, [c.id]: e.target.value }))} style={stileCampo} />
            </label>
          ))}
          {servizio === 'posta' && (
            <label style={{ fontSize: 11.5, color: 'var(--text3)', display: 'inline-flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}>
              <input type="checkbox" checked={altro} onChange={e => setAltro(e.target.checked)} />{t('chiavi.altroProvider', null, 'La casella non è Gmail (altro provider)')}
            </label>
          )}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={{ ...stileBottone, background: 'var(--btn-primario)', color: 'var(--btn-primario-testo)', borderColor: 'transparent' }} disabled={attesa || !completo} onClick={salva}>{attesa ? t('chiavi.provo', null, 'Provo la chiave…') : t('chiavi.verificaSalva', null, 'Verifica e salva')}</button>
            <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('chiavi.notaCifrata', null, 'Viene salvata cifrata e non viene più mostrata.')}</span>
          </div>
        </div>
      )}
      {esito && <div role="status" style={{ fontSize: 11.5, color: esito.ok ? 'var(--green)' : 'var(--red)', width: '100%' }}>{esito.testo}</div>}
      <ComeSiFa id={servizio} />
    </Guscio>
  )
}

// Lo stato delle chiavi del cliente, letto una volta e riletto dopo ogni salvataggio.
export function useChiavi() {
  const [d, setD] = useState(() => inMemoria('/api/integrations/chiavi'))
  // Dopo un salvataggio si rilegge saltando la memoria (e riscrivendola).
  const leggi = useCallback((forza = true) => leggiInMemoria('/api/integrations/chiavi', { forza, onUpdate: setD }).then(j => setD(j || { ok: false })).catch(() => setD({ ok: false })), [])
  useEffect(() => { leggi(false) }, [leggi])
  return { pronto: !!d?.pronto, admin: !!d?.admin, studio: !!d?.studio, servizi: d?.servizi || {}, leggi }
}

// Google Calendar: e' della PERSONA (non dell'azienda). Serve a Lyft per dire gli appuntamenti e fissare le call.
export function SchedaCalendario({ Guscio }) {
  const { t } = useI18n()
  const [s, setS] = useState(() => inMemoria('/api/integrations/calendario'))
  const leggi = useCallback((forza = true) => leggiInMemoria('/api/integrations/calendario', { forza, onUpdate: setS }).then(j => setS(j || { ok: false })).catch(() => setS({ ok: false })), [])
  useEffect(() => { leggi(false) }, [leggi])
  const stile = { fontSize: 13, fontWeight: 640, padding: '8px 16px', borderRadius: 999, border: '1px solid var(--border2)', background: 'var(--glass)', color: 'var(--text)', cursor: 'pointer' }
  return (
    <Guscio domain="calendar.google.com" name="Google Calendar" desc={t('chiavi.descCalendario', null, 'Lyft legge i tuoi appuntamenti e fissa le call con il link di Meet. È il tuo calendario personale, non quello dell’azienda.')}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', width: '100%' }}>
        {s?.collegato
          ? <span style={{ fontSize: 11.5, fontWeight: 640, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 6 }}><span style={{ width: 6, height: 6, borderRadius: 999, background: 'var(--green)' }} />{t('chiavi.collegato', null, 'Collegato')} · <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{s.email}</span></span>
          : <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{t('chiavi.nonCollegato', null, 'Non collegato')}</span>}
        <span style={{ flex: 1 }} />
        {s?.pronto && <button type="button" style={stile} onClick={() => { window.location.href = '/api/google/auth/start?servizio=calendario' }}>{s.collegato ? t('chiavi.cambia', null, 'Cambia') : t('integrations.connectBtn', null, 'Collega')}</button>}
        {s?.collegato && <button type="button" style={{ ...stile, background: 'transparent', color: 'var(--text3)' }} onClick={async () => { await fetch('/api/integrations/calendario', { method: 'DELETE' }); leggi() }}>{t('chiavi.scollega', null, 'Scollega')}</button>}
      </div>
      {s && !s.pronto && <div style={{ fontSize: 11.5, color: 'var(--text3)', width: '100%' }}>{t('chiavi.archivioAssente', null, 'L’archivio delle chiavi non è ancora attivo su questo ambiente.')}</div>}
      <ComeSiFa id="calendario" />
    </Guscio>
  )
}
