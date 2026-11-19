'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Scheda, Bottone, Vuoto, Scheletro, Pastiglia, Linguette, Live } from './ui/Mattoni'
import { useI18n } from '../../lib/i18n/I18nProvider'
import CreaSquadra from './CreaSquadra'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useStatoTab } from '../../lib/client/statoTab'

// La Squadra agent del cliente: chi sta lavorando, cosa aspetta una decisione, cosa si
// dicono fra loro. I dati arrivano dal servizio del cliente attraverso /api/squadra/*
// (la chiave del servizio resta sul server). Qui non si decide niente da soli: ogni
// lavoro resta fermo finche' una persona non lo approva, lo rimanda o lo scarta.
const DA_DECIDERE = ['in_revisione', 'errore_pubblicazione', 'programmato']
const quando = (iso, loc) => { try { return new Date(iso).toLocaleString(loc, { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) } catch { return '' } }

export default function SquadraTab({ attiva = true }) {
  const { t, intlLocale } = useI18n()
  // Ultimo stato letto e ultima vista scelta: tornando sulla tab si ritrova tutto com'era, senza attesa.
  const [d, setD] = useState(() => inMemoria('/api/squadra/stato'))        // null = carico
  const [vista, setVista] = useStatoTab('squadra.vista', 'ufficio')
  const [ufficioAperto, setUfficioAperto] = useState(false)
  useEffect(() => { if (vista === 'ufficio' && attiva) setUfficioAperto(true) }, [vista, attiva])
  const [avviso, setAvviso] = useState(null)
  const vivo = useRef(true)

  const carica = useCallback(async () => {
    try {
      const j = (await leggi('/api/squadra/stato', { forza: true })) || { ok: false, codice: 'errore' }
      // Un aggiornamento andato male (il servizio degli agenti a volte risponde lento) non butta via cio' che si
      // sta guardando: restano i dati di prima e l'ufficio non si smonta. L'errore si mostra solo se non c'e' altro,
      // oppure se la squadra non esiste proprio piu'.
      if (vivo.current) setD(prima => (j.ok || !prima?.ok || j.codice === 'senza_squadra' ? j : prima))
    } catch { if (vivo.current) setD(x => x?.ok ? x : { ok: false, codice: 'spenta' }) }
  }, [])
  useEffect(() => {
    vivo.current = true
    // Nascosta (un'altra tab e' aperta) non interroga nessuno; appena torna in vista si aggiorna subito e poi
    // ogni 20 secondi, perche' gli agenti lavorano da soli.
    if (!attiva) return () => { vivo.current = false }
    carica()
    const giro = setInterval(() => { if (document.visibilityState === 'visible') carica() }, 20000)
    return () => { vivo.current = false; clearInterval(giro) }
  }, [carica, attiva])

  if (!d) return <Scheletro kpi={4} righe={6} />
  if (!d.ok) {
    const senza = d.codice === 'senza_squadra'
    // Nessuna squadra: non un vicolo cieco ma la procedura per crearla.
    if (senza) return <CreaSquadra />
    return (
      <>
        <Scheda><Vuoto
          titolo={senza ? t('studio.teamNoneTitle', null, 'Questo cliente non ha ancora una squadra') : t('studio.teamDownTitle', null, 'La squadra non risponde')}
          testo={senza ? t('studio.teamNoneText', null, 'La squadra è un servizio dedicato a ogni cliente, con i suoi agenti e le sue regole di brand. Si attiva su richiesta.') : t('studio.teamDownText', null, 'Il servizio degli agenti di questo cliente non è raggiungibile. I lavori già fatti non si perdono.')}>
          {!senza && <Bottone onClick={() => { setD(null); carica() }}>{t('studio.retry', null, 'Riprova')}</Bottone>}
        </Vuoto></Scheda>
      </>
    )
  }

  const lavori = d.lavori || []
  const daDecidere = lavori.filter(l => DA_DECIDERE.includes(l.stato))
  const alLavoro = (d.agenti || []).filter(a => a.stato?.inCorso).length
  const elenco = vista === 'decidere' ? daDecidere : vista === 'archivio' ? lavori.filter(l => !DA_DECIDERE.includes(l.stato)) : []

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 14, fontSize: 13, color: 'var(--text2)' }}>
        {d.cliente && <b style={{ color: 'var(--text)', fontWeight: 640 }}>{d.cliente}</b>}
        <span>{t('studio.teamCounts', { agenti: (d.agenti || []).length, lavoro: alLavoro, decidere: daDecidere.length, giri: d.giri_oggi ?? 0 }, `${(d.agenti || []).length} agenti · ${alLavoro} al lavoro · ${daDecidere.length} da decidere · ${d.giri_oggi ?? 0} giri oggi`)}</span>
        <Live />
      </div>

      <Linguette valore={vista} onChange={setVista} voci={[
        { id: 'ufficio', label: t('studio.tabOffice', null, 'Ufficio') },
        { id: 'decidere', label: `${t('studio.tabDecide', null, 'Da decidere')} (${daDecidere.length})` },
        { id: 'agenti', label: t('studio.tabAgents', null, 'Agenti') },
        { id: 'bacheca', label: t('studio.tabBoard', null, 'Bacheca') },
        { id: 'archivio', label: t('studio.tabArchive', null, 'Archivio') },
      ]} style={{ marginBottom: 14 }} />

      {avviso && <Scheda style={{ marginBottom: 12 }}><span style={{ fontSize: 13 }}>{avviso}</span></Scheda>}

      {/* L'ufficio 3D con gli agenti dentro: lo stesso della pagina della squadra, servito dal prodotto
          (public/ufficio3d) e alimentato da /api/squadra/stato, cioe' dalla squadra di QUESTO cliente.
          Si monta solo quando lo si guarda: e' una scena 3D e a tab chiusa non deve consumare. */}
      {(vista === 'ufficio' || ufficioAperto) && (
        <iframe title={t('studio.tabOffice', null, 'Ufficio')} src="/ufficio3d/index.html" allow="fullscreen"
          style={{ display: vista === 'ufficio' ? 'block' : 'none', width: '100%', height: 'calc(100dvh - 210px)', minHeight: 520, border: 0, borderRadius: 14, background: '#0b0d12' }} />
      )}

      {vista === 'agenti' && <Agenti agenti={d.agenti || []} t={t} loc={intlLocale} dopo={carica} />}

      {vista === 'bacheca' && (
        <Scheda>
          {(d.bacheca || []).length === 0 && <Vuoto titolo={t('studio.boardEmpty', null, 'Ancora nessun messaggio')} />}
          <div style={{ display: 'grid', gap: 12 }}>
            {(d.bacheca || []).slice(0, 80).map(m => {
              const chi = (d.agenti || []).find(a => a.id === m.da)
              return (
                <div key={m.id} style={{ display: 'grid', gap: 3 }}>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}><b style={{ color: 'var(--text2)', fontWeight: 640 }}>{chi?.nome || m.da}</b>{m.a ? ` → ${(d.agenti || []).find(a => a.id === m.a)?.nome || m.a}` : ''} · {quando(m.quando, intlLocale)}</div>
                  <div style={{ fontSize: 13, color: 'var(--text)', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{m.testo}</div>
                </div>
              )
            })}
          </div>
        </Scheda>
      )}

      {(vista === 'decidere' || vista === 'archivio') && (
        elenco.length === 0
          ? <Scheda><Vuoto titolo={vista === 'decidere' ? t('studio.decideEmpty', null, 'Niente da decidere adesso') : t('studio.archiveEmpty', null, 'Archivio vuoto')} testo={vista === 'decidere' ? t('studio.decideEmptyText', null, 'Quando un agente consegna un lavoro lo trovi qui, fermo, in attesa della tua decisione.') : null} /></Scheda>
          : <div style={{ display: 'grid', gap: 12 }}>{elenco.slice(0, 60).map(l => <Lavoro key={l.id} l={l} t={t} loc={intlLocale} admin={!!d.admin} conBottoni={vista === 'decidere'} dopo={carica} avvisa={setAvviso} />)}</div>
      )}
    </>
  )
}

// Il servizio dice fra quanti minuti (dalla mezzanotte di oggi, ora di Roma) parte il prossimo giro:
// da li' si ricava «oggi», «domani» o il giorno della settimana, nella lingua di chi guarda.
function giornoDelGiro(p, loc) {
  const giorni = Math.floor((Number(p?.m) || 0) / 1440)
  try {
    if (giorni <= 1) return new Intl.RelativeTimeFormat(loc, { numeric: 'auto' }).format(giorni, 'day')
    return new Date(Date.now() + giorni * 86400000).toLocaleDateString(loc, { weekday: 'long', timeZone: 'Europe/Rome' })
  } catch { return p?.giorno || '' }
}

function Agenti({ agenti, t, loc, dopo }) {
  const [chi, setChi] = useState(agenti[0]?.id || '')
  const [testo, setTesto] = useState('')
  const [esito, setEsito] = useState(null)
  const [invio, setInvio] = useState(false)
  const manda = async () => {
    if (!testo.trim() || !chi) return
    setInvio(true); setEsito(null)
    try {
      const r = await fetch('/api/squadra/incarico', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ agente: chi, compito: testo.trim() }) }).then(x => x.json())
      if (r.ok) { setTesto(''); setEsito(t('studio.taskQueued', null, 'In coda: la risposta arriva in bacheca.')); dopo() } else setEsito(r.errore || t('studio.failed', null, 'Non riuscito'))
    } catch { setEsito(t('studio.failed', null, 'Non riuscito')) } finally { setInvio(false) }
  }
  return (
    <div style={{ display: 'grid', gap: 12 }}>
      <Scheda>
        <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', marginBottom: 10 }}>{t('studio.taskTitle', null, 'Dai un incarico')}</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-start' }}>
          <select value={chi} onChange={e => setChi(e.target.value)} aria-label={t('studio.taskWho', null, 'A chi')} style={{ fontSize: 13, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)' }}>
            {agenti.map(a => <option key={a.id} value={a.id}>{a.nome} — {a.ruolo}</option>)}
          </select>
          <textarea value={testo} onChange={e => setTesto(e.target.value)} rows={2} placeholder={t('studio.taskPlaceholder', null, 'Cosa deve fare, in poche righe')}
            style={{ flex: '1 1 320px', fontSize: 13, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }} />
          <Bottone tipo="primario" onClick={manda} disabled={invio || !testo.trim()}>{t('studio.taskSend', null, 'Manda')}</Bottone>
        </div>
        {esito && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{esito}</div>}
      </Scheda>
      <div style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))' }}>
        {agenti.map(a => {
          const lavora = !!(a.stato?.inCorso)
          return (
            <Scheda key={a.id}>
              <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                {a.volto
                  ? <img src={`/api/squadra/volto/${a.id}`} alt="" width={44} height={44} style={{ borderRadius: 999, objectFit: 'cover', flexShrink: 0 }} />
                  : <span aria-hidden style={{ width: 44, height: 44, borderRadius: 999, background: 'var(--surface2)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 640, color: 'var(--text2)', flexShrink: 0 }}>{(a.nome || '?').slice(0, 1)}</span>}
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)' }}>{a.nome}</div>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>{a.ruolo}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 10 }}>
                <Pastiglia tono={lavora ? 'positivo' : undefined}>{lavora ? t('studio.agentWorking', null, 'Al lavoro') : t('studio.agentFree', null, 'Libero')}</Pastiglia>
                {a.in_coda > 0 && <Pastiglia>{t('studio.agentQueue', { n: a.in_coda }, `${a.in_coda} in coda`)}</Pastiglia>}
              </div>
              {a.prossimo?.ora && <div title={a.prossimo.compito || undefined} style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('studio.agentNext', null, 'Prossimo giro')}: {giornoDelGiro(a.prossimo, loc)} {a.prossimo.ora}</div>}
              {a.stato?.ultimo && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.stato.ultimo}</div>}
            </Scheda>
          )
        })}
      </div>
    </div>
  )
}

function Lavoro({ l, t, loc, admin, conBottoni, dopo, avvisa }) {
  const [nota, setNota] = useState('')
  const [aperta, setAperta] = useState(null)   // 'mod' | 'no' | 'prog' | null
  const [attesa, setAttesa] = useState(false)
  const [intero, setIntero] = useState(false)

  const decidi = async (azione, testo = '') => {
    if (azione === 'pub' && !window.confirm(t('studio.confirmPublish', null, 'Pubblico adesso? L’azione viene eseguita subito sulla piattaforma.'))) return
    setAttesa(true); avvisa(null)
    try {
      const r = await fetch('/api/squadra/azione', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: l.id, azione, nota: testo }) }).then(x => x.json())
      if (!r.ok || r.errore) avvisa(r.errore || t('studio.failed', null, 'Non riuscito'))
      else if (r.stato === 'pubblicato_in_parte') avvisa(`${t('studio.partlyPublished', null, 'Pubblicato in parte. Non fatto')}: ${(r.non_fatte || []).join(' · ')}`)
      else if (r.stato === 'programmato') avvisa(`${t('studio.scheduledFor', null, 'Programmato per')} ${r.programmato_per}`)
      setAperta(null); setNota('')
    } catch { avvisa(t('studio.failed', null, 'Non riuscito')) } finally { setAttesa(false); dopo() }
  }
  const conNota = (azione) => { if (aperta !== azione) { setAperta(azione); return } if (!nota.trim()) return; decidi(azione, nota.trim()) }

  return (
    <Scheda>
      <div style={{ display: 'flex', gap: 10, alignItems: 'baseline', flexWrap: 'wrap' }}>
        <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', flex: '1 1 260px', minWidth: 0 }}>{l.titolo}</div>
        <Pastiglia tono={l.stato === 'errore_pubblicazione' ? 'negativo' : undefined}>{t(`studio.state.${l.stato}`, null, String(l.stato || '').replace(/_/g, ' '))}</Pastiglia>
      </div>
      <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 3 }}>{l.autore_nome || l.autore} · {quando(l.aggiornato || l.creato, loc)}{l.programmato_bello ? ` · ${t('studio.scheduledFor', null, 'Programmato per')} ${l.programmato_bello}` : ''}</div>
      {l.riassunto && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 10, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.riassunto}</div>}
      {l.errore_pubblicazione && <div style={{ fontSize: 13, color: 'var(--red)', marginTop: 8 }}>{l.errore_pubblicazione}</div>}
      {l.nota_marino && <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('studio.yourNote', null, 'La tua nota')}: {l.nota_marino}</div>}
      {(l.immagini || []).length > 0 && (
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 12 }}>
          {l.immagini.map(u => <a key={u} href={u} target="_blank" rel="noreferrer"><img src={u} alt="" loading="lazy" style={{ height: 150, borderRadius: 10, display: 'block' }} onError={e => { e.currentTarget.style.display = 'none' }} /></a>)}
        </div>
      )}
      {l.drive?.cartella && /^https:\/\//.test(l.drive.cartella) && <div style={{ marginTop: 8, fontSize: 13 }}><a href={l.drive.cartella} target="_blank" rel="noreferrer">{t('studio.onDrive', null, 'Grafiche su Drive')}</a></div>}
      {l.contenuto && (
        <div style={{ marginTop: 10 }}>
          <button type="button" onClick={() => setIntero(x => !x)} style={{ fontSize: 11.5, color: 'var(--text3)', background: 'none', border: 0, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>{intero ? t('studio.hideFull', null, 'Nascondi il contenuto') : t('studio.showFull', null, 'Contenuto completo')}</button>
          {intero && <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 8, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{l.contenuto}</div>}
        </div>
      )}
      {conBottoni && (
        <div style={{ marginTop: 14 }}>
          <div className="barra-strumenti" style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {l.stato === 'programmato' ? (
              admin && <>
                <Bottone tipo="primario" disabled={attesa} onClick={() => decidi('pub')}>{t('studio.publishNow', null, 'Pubblica ora')}</Bottone>
                <Bottone disabled={attesa} onClick={() => decidi('annprog')}>{t('studio.cancelSchedule', null, 'Annulla programmazione')}</Bottone>
              </>
            ) : (
              <>
                <Bottone tipo="primario" disabled={attesa} onClick={() => decidi('ok')}>{t('studio.approve', null, 'Approva')}</Bottone>
                {l.pubblicabile && admin && <Bottone disabled={attesa} onClick={() => decidi('pub')}>{t('studio.publish', null, 'Pubblica')}</Bottone>}
                {l.pubblicabile && admin && <Bottone disabled={attesa} onClick={() => conNota('prog')}>{t('studio.schedule', null, 'Programma')}</Bottone>}
                <Bottone disabled={attesa} onClick={() => conNota('mod')}>{t('studio.edit', null, 'Modifica')}</Bottone>
                <Bottone disabled={attesa} onClick={() => conNota('no')}>{t('studio.discard', null, 'Scarta')}</Bottone>
              </>
            )}
          </div>
          {aperta && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
              <textarea value={nota} onChange={e => setNota(e.target.value)} rows={2} autoFocus
                placeholder={aperta === 'prog' ? t('studio.schedulePlaceholder', null, 'Per quando? Per esempio: 10 dicembre alle 9 (ora di Roma)') : aperta === 'no' ? t('studio.discardPlaceholder', null, 'Cosa non andava? Serve alla squadra per non rifarlo.') : t('studio.editPlaceholder', null, 'Cosa cambiare, in poche righe')}
                style={{ flex: '1 1 320px', fontSize: 13, padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', resize: 'vertical', fontFamily: 'inherit' }} />
              <Bottone tipo="primario" disabled={attesa || !nota.trim()} onClick={() => decidi(aperta, nota.trim())}>{t('studio.confirm', null, 'Conferma')}</Bottone>
            </div>
          )}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>{t('studio.approveHint', null, 'Approva = per te va bene, non pubblica niente. Pubblica = viene eseguito subito.')}</div>
        </div>
      )}
    </Scheda>
  )
}
