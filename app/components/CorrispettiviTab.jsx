'use client'

import AzioneBarra from './ui/AzioneBarra'
import { Live } from './ui/Mattoni'
import { soldi } from '../../lib/client/soldi'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useStatoTab } from '../../lib/client/statoTab'
import { Fonte } from './ui/FasceTabella'
import { useEffect, useMemo, useState } from 'react'
import Icon from './ui/Icon'
import { PlatformBadges } from './PlatformIcon'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  Registro corrispettivi e-commerce.
//
//  Un mese per volta, come lo chiede il commercialista. KPI, grafici e tabelle
//  nascono TUTTI dalle stesse righe filtrate: se si seleziona un perimetro, i
//  totali in alto cambiano con lui. Numeri che restano globali mentre la
//  tabella sotto e' filtrata sono il modo piu' rapido per far firmare una
//  dichiarazione sbagliata.
// ============================================================================

const PERIMETRI = [
  { id: 'all', chiave: 'cor.perimetroTutti', fallback: 'Tutti i perimetri', colore: 'var(--text2)' },
  { id: 'ITALIA', chiave: 'cor.perimetroItalia', fallback: 'Italia', colore: '#22c55e' },
  { id: 'OSS', chiave: 'cor.perimetroOss', fallback: 'IVA OSS', colore: '#3b82f6' },
  { id: 'EXTRA_UE', chiave: 'cor.perimetroExtra', fallback: 'Extra-UE', colore: '#a78bfa' },
  { id: 'SENZA_PAESE', chiave: 'cor.perimetroSenza', fallback: 'Da verificare', colore: '#f59e0b' },
]

const VISTE = [
  { id: 'paesi', chiave: 'cor.vistaPaesi', fallback: 'Paesi', nota: 'cor.vistaPaesiNota', notaFallback: 'Confronto geografico' },
  { id: 'giorniPaesi', chiave: 'cor.vistaGiorniPaesi', fallback: 'Giorni × Paesi', nota: 'cor.vistaGiorniPaesiNota', notaFallback: 'Massimo dettaglio' },
  { id: 'giorni', chiave: 'cor.vistaGiorni', fallback: 'Giorni', nota: 'cor.vistaGiorniNota', notaFallback: 'Trend temporale' },
]

const SCHEDE_GUIDA = ['panoramica', 'perimetri', 'shopify', 'giftcard', 'export', 'quadratura']

// Nessun mese minimo. Nel fork era '2025-07', il primo mese con dati di QUEL
// negozio: qui ogni cliente ha una storia diversa e una data scritta a mano
// nasconderebbe mesi veri. Si puo' chiedere qualunque mese passato; se vendite non
// ce ne sono il registro lo dice da se', con zero righe, che e' la verita'.

export default function CorrispettiviTab() {
  const { t } = useI18n()
  const oggi = new Date()
  const meseCorrente = `${oggi.getFullYear()}-${String(oggi.getMonth() + 1).padStart(2, '0')}`

  // Mese, perimetro, vista e scheda restano quando si torna sulla tab; il mese
  // gia' letto si rivede subito, senza attesa.
  const [mese, setMese] = useStatoTab('cor.mese', meseCorrente)
  const [dati, setDati] = useState(() => inMemoria(`/api/corrispettivi?mese=${mese}`))
  const [caricamento, setCaricamento] = useState(false)
  const [errore, setErrore] = useState('')
  const [perimetro, setPerimetro] = useStatoTab('cor.perimetro', 'all')
  const [vista, setVista] = useStatoTab('cor.vista', 'giorniPaesi')
  const [guidaAperta, setGuidaAperta] = useStatoTab('cor.guida', true)
  const [scheda, setScheda] = useStatoTab('cor.scheda', 'panoramica')
  const [giornoAperto, setGiornoAperto] = useState(null)
  const [ordiniGiorno, setOrdiniGiorno] = useState(null)

  const carica = async (m = mese, forza = false) => {
    const gia = forza ? null : inMemoria(`/api/corrispettivi?mese=${m}`)
    if (gia) setDati(gia); else setCaricamento(true)
    setErrore('')
    try {
      const j = await leggi(`/api/corrispettivi?mese=${m}${forza ? '&refresh=1' : ''}`, { onUpdate: setDati })
      if (!j || j.ok === false) { setErrore(j?.error || 'Errore'); setDati(null); return }
      setDati(j)
    } catch (e) { setErrore(e?.message || 'Errore di rete'); setDati(null) }
    finally { setCaricamento(false) }
  }
  useEffect(() => { carica(mese) }, [mese]) // eslint-disable-line

  const apriGiorno = async (giorno) => {
    if (giornoAperto === giorno) { setGiornoAperto(null); setOrdiniGiorno(null); return }
    setGiornoAperto(giorno); setOrdiniGiorno(null)
    try {
      setOrdiniGiorno(await leggi(`/api/corrispettivi/giorno?giorno=${giorno}`))
    } catch { setOrdiniGiorno({ ok: false, error: 'Errore di rete' }) }
  }

  const euro = (v) => soldi(v, 2)
  const euro0 = (v) => soldi(v)
  const giornoBreve = (g) => {
    const d = new Date(`${g}T12:00:00Z`)
    return `${String(d.getUTCDate()).padStart(2, '0')} ${d.toLocaleDateString('it-IT', { month: 'short', timeZone: 'UTC' })}`
  }

  // ── Tutto nasce da qui: righe filtrate per perimetro ─────────────────────
  const righe = dati?.righe || []
  const filtrate = useMemo(
    () => perimetro === 'all' ? righe : righe.filter(r => r.perimetro === perimetro),
    [righe, perimetro]
  )

  const somma = (elenco) => elenco.reduce((a, r) => ({
    lordo: a.lordo + r.lordo,
    imponibile: a.imponibile + (r.imponibile || 0),
    iva: a.iva + (r.iva || 0),
    vendite: a.vendite + r.vendite,
    sconti: a.sconti + r.sconti,
    resi: a.resi + r.resi,
    netto: a.netto + r.netto,
    spedizioni: a.spedizioni + r.spedizioni,
    ivaShopify: a.ivaShopify + r.ivaShopify,
    commissioniReso: a.commissioniReso + (r.commissioniReso || 0),
    ordini: a.ordini + r.ordini,
    senzaImponibile: a.senzaImponibile + (r.imponibile == null ? r.lordo : 0),
  }), {
    lordo: 0, imponibile: 0, iva: 0, vendite: 0, sconti: 0, resi: 0, netto: 0,
    spedizioni: 0, ivaShopify: 0, commissioniReso: 0, ordini: 0, senzaImponibile: 0,
  })

  const tot = useMemo(() => somma(filtrate), [filtrate])

  const perPaese = useMemo(() => {
    const m = new Map()
    for (const r of filtrate) {
      const k = r.iso || '__senza'
      if (!m.has(k)) m.set(k, { chiave: k, paese: r.paese, iso: r.iso, perimetro: r.perimetro, aliquota: r.aliquota, elenco: [] })
      m.get(k).elenco.push(r)
    }
    return [...m.values()].map(g => ({ ...g, ...somma(g.elenco) })).sort((a, b) => b.lordo - a.lordo)
  }, [filtrate])

  const perGiorno = useMemo(() => {
    const m = new Map()
    for (const r of filtrate) {
      if (!m.has(r.giorno)) m.set(r.giorno, { giorno: r.giorno, elenco: [] })
      m.get(r.giorno).elenco.push(r)
    }
    return [...m.values()].map(g => ({ ...g, ...somma(g.elenco) })).sort((a, b) => a.giorno.localeCompare(b.giorno))
  }, [filtrate])

  const q = dati?.qualita
  const quadratura = dati?.quadratura

  const pannello = { background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, minWidth: 0 }
  const scuro = { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 16, padding: 18, minWidth: 0 }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* ── Intestazione ───────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ maxWidth: 780 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            
            <PlatformBadges sources={['shopify']} size={24} />
            <Live />
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <AzioneBarra icona="refresh" titolo={t('shell.refresh', null, 'Aggiorna')} onClick={() => carica(mese, true)} disabled={caricamento} gira={caricamento} />
          <a className="riga-tocco" href={`/api/corrispettivi/export?mese=${mese}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'linear-gradient(135deg,#0ea5e9,#0369a1)', border: 'none', borderRadius: 12, padding: '10px 16px', color: '#fff', fontSize: 13, fontWeight: 640, textDecoration: 'none' }}>
            <Icon name="download" size={14} />
            {t('cor.export', null, 'Esporta XLSX')}
          </a>
        </div>
      </div>

      {/* ── Guida ──────────────────────────────────────────────────────── */}
      <div style={pannello}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="file" size={15} />
            <strong style={{ fontSize: 15, color: 'var(--text)' }}>{t('cor.guideTitle', null, 'Guida corrispettivi')}</strong>
          </div>
          <button className="riga-tocco" onClick={() => setGuidaAperta(v => !v)}
            style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, padding: '5px 10px', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
            {guidaAperta ? t('cor.guideClose', null, 'Chiudi guida') : t('cor.guideOpen', null, 'Apri guida')}
          </button>
        </div>
        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--text3)' }}>
          {t('cor.guideSub', null, 'Come nasce il registro: perimetri fiscali, dati Shopify, gift card, export e controlli prima della consegna.')}
        </p>

        {guidaAperta && (
          <>
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 12, padding: 4, background: 'var(--glass2)', borderRadius: 12 }}>
              {SCHEDE_GUIDA.map(s => (
                <button key={s} className="riga-tocco" onClick={() => setScheda(s)}
                  style={{
                    flex: '1 1 auto', padding: '7px 12px', borderRadius: 8, cursor: 'pointer', border: 'none',
                    background: scheda === s ? 'var(--surface)' : 'transparent',
                    color: scheda === s ? 'var(--text)' : 'var(--text2)',
                    fontSize: 13, fontWeight: scheda === s ? 800 : 600, whiteSpace: 'nowrap',
                  }}>
                  {t(`cor.tab.${s}`, null, {
                    panoramica: 'Panoramica', perimetri: 'Perimetri fiscali', shopify: 'Shopify',
                    giftcard: 'Gift card', export: 'Export XLSX', quadratura: 'Quadratura',
                  }[s])}
                </button>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--text2)', lineHeight: 1.65 }}>
              <ContenutoGuida scheda={scheda} t={t} />
            </div>
          </>
        )}
      </div>

      {/* ── Mese e perimetro ───────────────────────────────────────────── */}
      <div style={{ ...pannello, display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>
          {t('cor.month', null, 'Mese')}
          <input type="month" value={mese} max={meseCorrente}
            onChange={e => e.target.value && setMese(e.target.value)}
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13 }} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 5, fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>
          {t('cor.perimeter', null, 'Perimetro')}
          <select value={perimetro} onChange={e => setPerimetro(e.target.value)}
            style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 8, padding: '8px 10px', color: 'var(--text)', fontSize: 13, minWidth: 170 }}>
            {PERIMETRI.map(p => <option key={p.id} value={p.id}>{t(p.chiave, null, p.fallback)}</option>)}
          </select>
        </label>
        <span style={{ fontSize: 11.5, padding: '5px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.12)', color: '#22c55e', fontWeight: 600 }}>
          {t('cor.shopifyLive', null, 'Shopify live')}
        </span>
        {dati?.updatedAt && (
          <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>
            {t('cor.updatedAt', { at: new Date(dati.updatedAt).toLocaleString('it-IT', { useGrouping: 'always' }) }, `Aggiornato ${new Date(dati.updatedAt).toLocaleString('it-IT', { useGrouping: 'always' })}`)}
          </span>
        )}
        {dati && q && !q.meseCompleto && (
          <span style={{ fontSize: 11.5, color: '#f59e0b', fontWeight: 600 }}>
            {t('cor.monthOpen', null, 'Mese in corso: il registro si chiude a fine mese.')}
          </span>
        )}
      </div>

      {errore && <div style={{ ...pannello, color: '#fca5a5', fontWeight: 600 }}>{errore}</div>}

      {dati && (
        <>
          {/* ── Analisi ──────────────────────────────────────────────── */}
          <div style={scuro}>
            <div style={{ fontSize: 10, fontWeight: 680, letterSpacing: '0.12em', color: 'var(--text3)' }}>SHOPIFY</div>
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h2 style={{ margin: '2px 0 0', fontSize: 20, fontWeight: 680, color: 'var(--text)' }}>
                  {t('cor.analysis', null, 'Analisi corrispettivi')}
                </h2>
                <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--text3)' }}>
                  {t('cor.analysisSub', null, 'Filtra e confronta senza alterare il registro di origine.')}
                </p>
              </div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)' }}>
                {t('cor.rowCount', { o: righe.length, n: filtrate.length }, `${righe.length} righe di origine · ${filtrate.length} in vista`)}
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {VISTE.map(v => (
                <button key={v.id} onClick={() => setVista(v.id)}
                  className={`ly-filtro senza-tocco${vista === v.id ? ' acceso' : ''}`}>
                  <span style={{ fontSize: 13, fontWeight: vista === v.id ? 800 : 700 }}>{t(v.chiave, null, v.fallback)}</span>
                  <span style={{ fontSize: 10, color: 'var(--text3)' }}>{t(v.nota, null, v.notaFallback)}</span>
                </button>
              ))}
              {perimetro !== 'all' && (
                <button onClick={() => setPerimetro('all')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 12, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                  <Icon name="refresh" size={12} />{t('cor.reset', null, 'Azzera filtri')}
                </button>
              )}
            </div>

            {/* KPI */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 1, marginTop: 16, background: 'var(--border)', borderRadius: 12, overflow: 'hidden' }}>
              <Kpi etichetta={t('cor.kpiGross', null, 'Lordo fiscale')} valore={euro(tot.lordo)} colore="#22c55e" />
              <Kpi etichetta={t('cor.kpiTaxable', null, 'Imponibile')} valore={euro(tot.imponibile)} colore="var(--text)" />
              <Kpi etichetta={t('cor.kpiVat', null, 'IVA')} valore={euro(tot.iva)} colore="#3b82f6" />
              <Kpi etichetta={t('cor.kpiReturns', null, 'Resi e rimborsi')} valore={euro(tot.resi)} colore={tot.resi < 0 ? '#ef4444' : 'var(--text)'} />
              <Kpi etichetta={t('cor.kpiOrders', null, 'Ordini')} valore={tot.ordini.toLocaleString('it-IT', { useGrouping: 'always' })} colore="var(--text)" />
            </div>

            {tot.senzaImponibile > 0 && (
              <div style={{ marginTop: 10, fontSize: 11.5, color: '#f59e0b', fontWeight: 600 }}>
                {t('cor.noTaxableWarn', { x: euro(tot.senzaImponibile) }, `${euro(tot.senzaImponibile)} di lordo non ha un imponibile calcolabile: manca il paese di spedizione, quindi imponibile e IVA qui sopra sono incompleti.`)}
              </div>
            )}

            {/* Grafico giorni + distribuzione paesi */}
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12, marginTop: 16 }}>
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)' }}>{t('cor.trend', null, 'Andamento nel periodo')}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>
                  {t('cor.trendSub', { n: perGiorno.length }, `Lordo fiscale per giorno · ${perGiorno.length} giorni`)}
                </div>
                <Istogramma dati={perGiorno.map(g => ({ etichetta: giornoBreve(g.giorno), valore: g.lordo }))} euro={euro0} />
              </div>
              <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)' }}>{t('cor.byCountry', null, 'Distribuzione per paese')}</div>
                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 8 }}>{t('cor.byCountrySub', null, 'Primi 10 per lordo fiscale')}</div>
                <Barre dati={perPaese.slice(0, 10).map(p => ({ etichetta: p.paese, valore: p.lordo }))} euro={euro0} />
              </div>
            </div>
          </div>

          {/* ── Dettaglio ─────────────────────────────────────────────── */}
          <div style={pannello}>
            <div style={{ fontSize: 10, fontWeight: 680, letterSpacing: '0.12em', color: 'var(--text3)' }}>{t('cor.detail', null, 'DETTAGLIO')}</div>
            <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)', marginBottom: 10 }}>
              {t(VISTE.find(v => v.id === vista)?.chiave, null, VISTE.find(v => v.id === vista)?.fallback)} · EUR
            </div>
            <div className="m-scrollx" style={{ overflowX: 'auto', maxWidth: '100%', minWidth: 0 }}>
              <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 900 }}>
                <thead>
                  <tr style={{ color: 'var(--text2)' }}>
                    <th style={th('left')}><Fonte loghi={['shopify']} />{vista === 'giorni' ? t('cor.colDay', null, 'Giorno') : vista === 'paesi' ? t('cor.colCountry', null, 'Paese') : t('cor.colDayCountry', null, 'Giorno e paese')}</th>
                    <th style={th()}>{t('cor.colPerimeter', null, 'Perimetro')}</th>
                    <th style={th()}>{t('cor.colRate', null, 'Aliquota')}</th>
                    <th style={th()}>{t('cor.colOrders', null, 'Ordini')}</th>
                    <th style={th()}>{t('cor.colReturns', null, 'Resi')}</th>
                    <th style={th()}>{t('cor.colGross', null, 'Lordo')}</th>
                    <th style={th()}>{t('cor.colTaxable', null, 'Imponibile')}</th>
                    <th style={th()}>{t('cor.colVat', null, 'IVA')}</th>
                  </tr>
                </thead>
                <tbody>
                  {(vista === 'paesi' ? perPaese : vista === 'giorni' ? perGiorno : filtrate).map((r, i) => {
                    const etichetta = vista === 'paesi' ? r.paese
                      : vista === 'giorni' ? giornoBreve(r.giorno)
                      : `${giornoBreve(r.giorno)} · ${r.paese}`
                    const per = vista === 'giorni' ? null : r.perimetro
                    return (
                      <tr key={`${etichetta}-${i}`} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--gpv-riga)' : 'transparent' }}>
                        <td style={{ padding: '9px 12px', fontSize: 13, color: 'var(--text)', fontWeight: 600 }}>{etichetta}</td>
                        <td style={cella}>{per ? <Etichetta perimetro={per} t={t} /> : '—'}</td>
                        <td style={cella}>{r.aliquota == null ? '—' : `${r.aliquota}%`}</td>
                        <td style={cella}>{r.ordini}</td>
                        <td style={{ ...cella, color: r.resi < 0 ? '#ef4444' : 'var(--text3)' }}>{euro(r.resi)}</td>
                        <td style={{ ...cella, fontWeight: 640 }}>{euro(r.lordo)}</td>
                        <td style={cella}>{r.imponibile == null || (vista !== 'giorniPaesi' && r.senzaImponibile > 0 && r.imponibile === 0) ? '—' : euro(r.imponibile)}</td>
                        <td style={{ ...cella, color: '#3b82f6' }}>{r.iva == null ? '—' : euro(r.iva)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ── Quadratura ───────────────────────────────────────────── */}
          {quadratura && (
            <div style={{ ...pannello, borderColor: quadratura.nettoOk && quadratura.totaleOk ? 'rgba(34,197,94,0.35)' : 'rgba(239,68,68,0.45)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name={quadratura.nettoOk && quadratura.totaleOk ? 'check-circle' : 'warning'} size={16} />
                <strong style={{ fontSize: 15, color: quadratura.nettoOk && quadratura.totaleOk ? '#22c55e' : '#ef4444' }}>
                  {quadratura.nettoOk && quadratura.totaleOk
                    ? t('cor.checksOk', null, 'Controlli matematici superati')
                    : t('cor.checksKo', null, 'I conti di Shopify non chiudono: registro non consegnabile')}
                </strong>
              </div>
              <div style={{ marginTop: 8, fontSize: 13, color: 'var(--text2)', lineHeight: 1.7 }}>
                <div>
                  {t('cor.identity1', null, 'Lordo + sconti + resi = netto')} — {euro(quadratura.nettoAtteso)} {t('cor.vs', null, 'contro')} {euro(quadratura.nettoRilevato)}
                  <strong style={{ color: quadratura.nettoOk ? '#22c55e' : '#ef4444', marginLeft: 6 }}>
                    {quadratura.nettoOk ? 'OK' : `${euro(quadratura.scartoNetto)}`}
                  </strong>
                </div>
                <div>
                  {t('cor.identity2', null, 'Netto + spedizioni + IVA + commissioni di reso = totale')} — {euro(quadratura.totaleAtteso)} {t('cor.vs', null, 'contro')} {euro(quadratura.totaleRilevato)}
                  <strong style={{ color: quadratura.totaleOk ? '#22c55e' : '#ef4444', marginLeft: 6 }}>
                    {quadratura.totaleOk ? 'OK' : `${euro(quadratura.scartoTotale)}`}
                  </strong>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11.5, color: 'var(--text3)' }}>
                {t('cor.checksNote', null, 'I controlli valgono sempre sull\'intero mese, non sul perimetro selezionato: un\'identità contabile si verifica sul totale.')}
              </div>
            </div>
          )}

          {/* ── Riepilogo ─────────────────────────────────────────────── */}
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12 }}>
            <Riepilogo titolo={t('cor.sumRegister', null, 'Corrispettivo del periodo')} valore={euro(tot.lordo)} nota={t('cor.sumRegisterNote', null, 'Vendite totali al lordo dell\'IVA, al netto di sconti e resi')} forte />
            <Riepilogo titolo={t('cor.sumGross', null, 'Vendite lorde')} valore={euro(tot.vendite)} nota={t('cor.sumGrossNote', { n: tot.ordini }, `${tot.ordini} ordini nel periodo`)} />
            <Riepilogo titolo={t('cor.sumDiscounts', null, 'Sconti')} valore={euro(tot.sconti)} nota={t('cor.sumDiscountsNote', null, 'Esposti con segno negativo')} />
            <Riepilogo titolo={t('cor.sumReturns', null, 'Resi e rimborsi')} valore={euro(tot.resi)} nota={t('cor.sumReturnsNote', { x: euro(tot.commissioniReso) }, `Commissioni di reso: ${euro(tot.commissioniReso)}`)} />
            <Riepilogo titolo={t('cor.sumVat', null, 'IVA scorporata')} valore={euro(tot.iva)} nota={t('cor.sumVatNote', { x: euro(tot.ivaShopify) }, `IVA registrata da Shopify: ${euro(tot.ivaShopify)}`)} />
          </div>

          {/* ── Registro giornaliero + ordini ─────────────────────────── */}
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={pannello}>
              <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)' }}>{t('cor.dayRegister', null, 'Registro giornaliero')}</div>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 10 }}>
                {t('cor.dayRegisterSub', null, 'Apri un giorno per vedere quali ordini lo hanno formato.')}
              </div>
              <div style={{ maxHeight: 420, overflowY: 'auto' }}>
                {perGiorno.map(g => (
                  <button key={g.giorno} className="riga-tocco" onClick={() => apriGiorno(g.giorno)}
                    style={{
                      width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10,
                      padding: '9px 10px', borderRadius: 8, cursor: 'pointer', textAlign: 'left',
                      border: `1px solid ${giornoAperto === g.giorno ? 'var(--accent)' : 'transparent'}`,
                      background: giornoAperto === g.giorno ? 'var(--glass2)' : 'transparent', marginBottom: 2,
                    }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{giornoBreve(g.giorno)}</span>
                    <span style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                      <span style={{ fontSize: 11.5, color: 'var(--text3)' }}>{g.ordini} {t('cor.ordersShort', null, 'ord')}</span>
                      <span style={{ fontSize: 13, fontWeight: 640, color: 'var(--text)' }}>{euro(g.lordo)}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <div style={pannello}>
              <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)' }}>{t('cor.orderDetail', null, 'Dettaglio ordini')}</div>
              {!giornoAperto && (
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 10 }}>{t('cor.noDay', null, 'Nessun giorno selezionato.')}</div>
              )}
              {giornoAperto && !ordiniGiorno && (
                <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 10 }}>{t('cor.loadingOrders', null, 'Carico gli ordini…')}</div>
              )}
              {ordiniGiorno && ordiniGiorno.ok === false && (
                <div style={{ fontSize: 13, color: '#ef4444', marginTop: 10, fontWeight: 600 }}>{ordiniGiorno.error}</div>
              )}
              {ordiniGiorno?.ok && (
                <>
                  <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>
                    {t('cor.orderDetailNote', null, 'Ordini creati in questa data. Il registro segue la data di competenza del report, quindi i totali possono non coincidere.')}
                  </div>
                  {ordiniGiorno.oltreLaFinestra && (
                    <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 6, fontWeight: 600 }}>
                      {t('cor.beyond60', null, 'Oltre i 60 giorni Shopify restituisce solo una parte degli ordini: questo elenco può essere incompleto.')}
                    </div>
                  )}
                  {ordiniGiorno.senzaPaeseSpedizione > 0 && (
                    <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>
                      {t('cor.ordersFromBilling', { n: ordiniGiorno.senzaPaeseSpedizione }, `${ordiniGiorno.senzaPaeseSpedizione} ordini prendono il paese dalla fatturazione: il cliente ha inserito lì i dati di spedizione. Il registro li attribuisce lo stesso al regime giusto.`)}
                    </div>
                  )}
                  {/* Le stesse voci del registro, ordine per ordine: imponibile,
                      resi, IVA e totale. Con solo il lordo non si poteva
                      controllare nulla. */}
                  <div className="m-scrollx" style={{ maxHeight: 380, overflowY: 'auto', overflowX: 'auto', marginTop: 8, maxWidth: '100%', minWidth: 0 }}>
                    <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 420 }}>
                      <thead>
                        <tr style={{ color: 'var(--text2)' }}>
                          <th style={{ ...th('left'), position: 'sticky', top: 0, background: 'var(--surface)' }}><Fonte loghi={['shopify']} />{t('cor.colOrder', null, 'Ordine')}</th>
                          <th style={{ ...th('left'), position: 'sticky', top: 0, background: 'var(--surface)' }}>{t('cor.colCountry', null, 'Paese')}</th>
                          <th style={{ ...th(), position: 'sticky', top: 0, background: 'var(--surface)' }}>{t('cor.colTaxable', null, 'Imponibile')}</th>
                          <th style={{ ...th(), position: 'sticky', top: 0, background: 'var(--surface)' }}>{t('cor.colReturns', null, 'Resi')}</th>
                          <th style={{ ...th(), position: 'sticky', top: 0, background: 'var(--surface)' }}>{t('cor.colVat', null, 'IVA')}</th>
                          <th style={{ ...th(), position: 'sticky', top: 0, background: 'var(--surface)' }}>{t('cor.colTotal', null, 'Totale')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(ordiniGiorno.ordini || []).map((o, i) => (
                          <tr key={o.id} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--gpv-riga)' : 'transparent' }}>
                            <td style={{ padding: '7px 10px' }}>
                              <a href={o.link} target="_blank" rel="noreferrer" style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)', textDecoration: 'none' }}>{o.numero}</a>
                              <div style={{ fontSize: 10, color: 'var(--text3)' }}>{o.ora}</div>
                            </td>
                            <td style={{ padding: '7px 10px', fontSize: 11.5, color: 'var(--text2)', fontWeight: 500 }}>
                              {o.paese || t('cor.noCountry', null, 'paese mancante')}
                              {!o.paeseDaSpedizione && o.paese && (
                                <span style={{ fontSize: 10, color: 'var(--text3)', fontStyle: 'italic', marginLeft: 5 }}>
                                  {t('cor.fromBillingShort', null, 'da fatturazione')}
                                </span>
                              )}
                            </td>
                            <td style={{ ...cella, fontSize: 11.5 }}>{euro(o.imponibile)}</td>
                            <td style={{ ...cella, fontSize: 11.5, color: o.rimborsato > 0 ? '#ef4444' : 'var(--text3)' }}>{euro(-o.rimborsato)}</td>
                            <td style={{ ...cella, fontSize: 11.5, color: '#3b82f6' }}>{euro(o.iva)}</td>
                            <td style={{ ...cella, fontSize: 13, fontWeight: 640 }}>{euro(o.totale)}</td>
                          </tr>
                        ))}
                        <tr style={{ borderTop: '2px solid var(--border)' }}>
                          <td colSpan={2} style={{ padding: '8px 10px', fontSize: 11.5, fontWeight: 640, color: 'var(--text2)' }}>
                            {t('cor.dayTotal', { n: (ordiniGiorno.ordini || []).length }, `Totale · ${(ordiniGiorno.ordini || []).length} ordini`)}
                          </td>
                          <td style={{ ...cella, fontSize: 11.5, fontWeight: 640 }}>{euro(ordiniGiorno.imponibile)}</td>
                          <td style={{ ...cella, fontSize: 11.5, fontWeight: 640, color: ordiniGiorno.rimborsato > 0 ? '#ef4444' : 'var(--text3)' }}>{euro(-(ordiniGiorno.rimborsato || 0))}</td>
                          <td style={{ ...cella, fontSize: 11.5, fontWeight: 640, color: '#3b82f6' }}>{euro(ordiniGiorno.iva)}</td>
                          <td style={{ ...cella, fontSize: 13, fontWeight: 680 }}>{euro(ordiniGiorno.totale)}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Gift card: la catena che porta al corrispettivo fiscale ── */}
          <div style={pannello}>
            <div style={{ fontSize: 15, fontWeight: 640, color: 'var(--text)' }}>{t('cor.giftTitle', null, 'Gift card')}</div>
            <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 6, lineHeight: 1.65 }}>
              {t('cor.giftBody2', null, 'Le gift card monouso si tassano all\'emissione: il corrispettivo nasce quando il cliente le acquista. Al riscatto l\'importo va neutralizzato, altrimenti la merce pagata con la gift card verrebbe tassata una seconda volta. Shopify esclude le emissioni dal totale vendite, quindi qui vengono riaggiunte.')}
            </div>

            {dati.gift?.leggibili && dati.gift?.riscattiLeggibili && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 1, marginTop: 12, background: 'var(--border)', borderRadius: 12, overflow: 'hidden' }}>
                <Kpi etichetta={t('cor.chainReport', null, 'Vendite da report')} valore={euro(dati.totali.lordo)} colore="var(--text)" />
                <Kpi etichetta={t('cor.chainIssued', null, '+ Gift card emesse')} valore={euro(dati.gift.emesse)} colore={dati.gift.emesse ? '#22c55e' : 'var(--text3)'} />
                <Kpi etichetta={t('cor.chainRedeemed', null, '- Riscatti neutralizzati')} valore={euro(dati.gift.riscatti)} colore={dati.gift.riscatti ? '#ef4444' : 'var(--text3)'} />
                <Kpi etichetta={t('cor.chainCredited', null, '+ Riaccrediti')} valore={euro(dati.gift.accrediti)} colore={dati.gift.accrediti ? '#22c55e' : 'var(--text3)'} />
                <Kpi etichetta={t('cor.chainFinal', null, '= Corrispettivo fiscale')} valore={euro(dati.corrispettivoFiscale)} colore="#22c55e" />
              </div>
            )}

            {dati.rettificaValida && dati.perPerimetroFiscale?.length > 0 && (
              <div className="m-scrollx" style={{ overflowX: 'auto', marginTop: 12, maxWidth: '100%', minWidth: 0 }}>
                <div style={{ fontSize: 11.5, fontWeight: 640, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text3)', marginBottom: 6 }}>
                  {t('cor.fiscalByRegime', null, 'Totali fiscali per regime')}
                </div>
                <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', minWidth: 620 }}>
                  <thead>
                    <tr style={{ color: 'var(--text2)' }}>
                      <th style={th('left')}><Fonte loghi={['shopify']} />{t('cor.colRegime', null, 'Regime')}</th>
                      <th style={th()}>{t('cor.colSalesReport', null, 'Vendite da report')}</th>
                      <th style={th()}>{t('cor.colGiftAdj', null, 'Rettifica gift card')}</th>
                      <th style={th()}>{t('cor.colFiscalTotal', null, 'Corrispettivo')}</th>
                      <th style={th()}>{t('cor.colTaxable', null, 'Imponibile')}</th>
                      <th style={th()}>{t('cor.colVat', null, 'IVA')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dati.perPerimetroFiscale.map((p, i) => (
                      <tr key={p.perimetro} style={{ borderTop: '1px solid var(--border)', background: i % 2 ? 'var(--gpv-riga)' : 'transparent' }}>
                        <td style={{ padding: '8px 12px' }}><Etichetta perimetro={p.perimetro} t={t} /></td>
                        <td style={cella}>{euro(p.lordo)}</td>
                        <td style={{ ...cella, color: p.rettificaGift > 0 ? '#22c55e' : p.rettificaGift < 0 ? '#ef4444' : 'var(--text3)' }}>
                          {p.rettificaGift ? `${p.rettificaGift > 0 ? '+' : ''}${euro(p.rettificaGift)}` : '—'}
                        </td>
                        <td style={{ ...cella, fontWeight: 640 }}>{euro(p.corrispettivo)}</td>
                        <td style={cella}>{p.imponibileFiscale == null ? '—' : euro(p.imponibileFiscale)}</td>
                        <td style={{ ...cella, color: '#3b82f6' }}>{p.ivaFiscale == null ? '—' : euro(p.ivaFiscale)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {dati.gift?.nonAttribuiti > 0 && (
              <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 8, fontWeight: 600 }}>
                {t('cor.giftUnassigned', { n: dati.gift.nonAttribuiti }, `${dati.gift.nonAttribuiti} movimenti gift card non hanno un ordine collegato: restano nel totale del mese ma fuori dai regimi.`)}
              </div>
            )}

            {dati.gift?.movimenti?.length > 0 && (
              <div style={{ marginTop: 10 }}>
                {dati.gift.movimenti.map((m, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 11.5, padding: '4px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ color: 'var(--text2)' }}>{giornoBreve(m.giorno)}{m.ordine ? ` · ${m.ordine}` : ''}</span>
                    <span style={{ color: 'var(--text3)' }}>
                      {t('cor.giftMove.' + m.tipo, null, { emissione: 'emissione', riscatto: 'riscatto', accredito: 'riaccredito' }[m.tipo])}
                      {m.paese ? ` · ${m.paese}` : ''}
                    </span>
                    <span style={{ fontWeight: 600, color: m.tipo === 'riscatto' ? '#ef4444' : '#22c55e' }}>
                      {m.tipo === 'riscatto' ? '-' : '+'}{euro(m.importo)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {dati.gift?.leggibili && dati.gift.movimenti.length === 0 && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 8 }}>
                {t('cor.giftNone', null, 'Nessun movimento gift card in questo mese.')}
              </div>
            )}

            {q && !q.giftCardLeggibili && (
              <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 8, fontWeight: 600 }}>
                {t('cor.giftScope', null, 'Limite noto: il token dell\'app Shopify non ha il permesso read_gift_cards. Se un domani inizierete a venderne, va aggiunto o il registro le ignorerebbe in silenzio.')}
              </div>
            )}
            {q?.giftCardLeggibili && !q?.giftCardRiscattiLeggibili && (
              <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 8, fontWeight: 600 }}>
                {t('cor.giftNeedTx', null, 'Per includerle serve anche il permesso read_gift_card_transactions: senza le date dei riscatti, sommare le emissioni tasserebbe due volte la merce già pagata con la gift card.')}
              </div>
            )}
            {dati.gift?.troncato && (
              <div style={{ fontSize: 11.5, color: '#f59e0b', marginTop: 4, fontWeight: 600 }}>
                {t('cor.giftTruncated', null, 'Elenco gift card al limite: alcuni movimenti potrebbero mancare.')}
              </div>
            )}
            {q && q.ordiniStoriciCompleti === false && (
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginTop: 6 }}>
                {t('cor.ordersScope', null, 'Senza il permesso read_all_orders il dettaglio ordini copre solo gli ultimi 60 giorni. Il registro non ne soffre: legge da Analytics, che copre tutto lo storico.')}
              </div>
            )}
          </div>

          {/* ── Perimetro del dato ────────────────────────────────────── */}
          <div style={{ fontSize: 11.5, color: 'var(--text3)', lineHeight: 1.7 }}>
            {t('cor.scopeNote', null, "Il registro include tutti i canali di vendita, marketplace compresi: sono vendite dell'azienda. Il paese fiscale è quello di spedizione; se il cliente ha compilato solo l'indirizzo di fatturazione si usa quello. Restano in «Da verificare» solo gli ordini senza nessuno dei due.")}
            {q?.lordoDaFatturazione > 0 && (
              <><br /><span style={{ color: 'var(--text2)' }}>
                {t('cor.fromBilling', { x: euro(q.lordoDaFatturazione), pct: q.quotaDaFatturazionePct }, `${euro(q.lordoDaFatturazione)} (${q.quotaDaFatturazionePct}% del mese): il paese è preso dall'indirizzo di fatturazione e la riga è attribuita regolarmente al suo regime. Nessuna azione richiesta.`)}
              </span></>
            )}
            {q?.quotaSenzaPaesePct > 0 && (
              <><br /><span style={{ color: '#f59e0b', fontWeight: 600 }}>
                {t('cor.missingCountry', { x: euro(q.lordoSenzaPaese), pct: q.quotaSenzaPaesePct, n: q.ordiniSenzaPaese }, `${euro(q.lordoSenzaPaese)} (${q.quotaSenzaPaesePct}% del mese, ${q.ordiniSenzaPaese} ordini) non ha né il paese di spedizione né quello di fatturazione su Shopify: resta in «Da verificare».`)}
              </span></>
            )}
          </div>
        </>
      )}
    </div>
  )
}

// ── Pezzi di interfaccia ───────────────────────────────────────────────────

function Kpi({ etichetta, valore, colore }) {
  return (
    <div style={{ background: 'var(--surface)', padding: '12px 14px' }}>
      <div style={{ fontSize: 10, fontWeight: 640, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)' }}>{etichetta}</div>
      <div style={{ fontSize: 15, fontWeight: 680, color: colore, marginTop: 3 }}>{valore}</div>
    </div>
  )
}

function Riepilogo({ titolo, valore, nota, forte }) {
  return (
    <div style={{ background: 'var(--glass)', border: `1px solid ${forte ? 'rgba(34,197,94,0.35)' : 'var(--border)'}`, borderRadius: 12, padding: 14 }}>
      <div style={{ fontSize: 11.5, color: 'var(--text2)', fontWeight: 600 }}>{titolo}</div>
      <div style={{ fontSize: 15, fontWeight: 680, color: forte ? '#22c55e' : 'var(--text)', marginTop: 4 }}>{valore}</div>
      <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>{nota}</div>
    </div>
  )
}

function Etichetta({ perimetro, t }) {
  const p = PERIMETRI.find(x => x.id === perimetro) || PERIMETRI[0]
  return (
    <span style={{ fontSize: 10, fontWeight: 640, padding: '2px 8px', borderRadius: 999, color: p.colore, background: 'var(--glass2)' }}>
      {t(p.chiave, null, p.fallback)}
    </span>
  )
}

// Istogramma essenziale: niente libreria per due grafici, e con poche barre
// una libreria costerebbe piu' del disegno.
function Istogramma({ dati, euro }) {
  const massimo = Math.max(1, ...dati.map(d => d.valore))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 2, height: 130 }}>
      {dati.map((d, i) => (
        <div key={i} title={`${d.etichetta}: ${euro(d.valore)}`}
          style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: '100%' }}>
          <div style={{ height: `${Math.max(2, (d.valore / massimo) * 100)}%`, background: 'linear-gradient(180deg,#8b5cf6,#6d28d9)', borderRadius: '3px 3px 0 0' }} />
        </div>
      ))}
    </div>
  )
}

function Barre({ dati, euro }) {
  const massimo = Math.max(1, ...dati.map(d => d.valore))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {dati.map((d, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 10, color: 'var(--text2)', width: 92, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.etichetta}</span>
          <div style={{ flex: 1, height: 9, background: 'var(--glass2)', borderRadius: 999, overflow: 'hidden' }}>
            <div style={{ width: `${(d.valore / massimo) * 100}%`, height: '100%', background: '#0ea5e9', borderRadius: 999 }} />
          </div>
          <span style={{ fontSize: 10, color: 'var(--text3)', width: 68, textAlign: 'right' }}>{euro(d.valore)}</span>
        </div>
      ))}
    </div>
  )
}

function ContenutoGuida({ scheda, t }) {
  const P = ({ children }) => <p style={{ margin: '0 0 8px' }}>{children}</p>
  const L = ({ children }) => <li style={{ margin: '0 0 5px' }}>{children}</li>
  const UL = ({ children }) => <ul style={{ margin: '0 0 8px', paddingLeft: 18 }}>{children}</ul>

  if (scheda === 'panoramica') return (
    <>
      <P><strong>{t('cor.g.panoramicaT', null, 'Cosa fa il registro e da dove arrivano i dati.')}</strong></P>
      <UL>
        <L>{t('cor.g.panoramica1', null, 'Fonte unica: Shopify Analytics (ShopifyQL), raggruppato per giorno e paese di spedizione.')}</L>
        <L>{t('cor.g.panoramica2', null, 'I totali sono per giorno, paese e regime fiscale: Italia, IVA OSS, extra-UE.')}</L>
        <L>{t('cor.g.panoramica3', null, 'Include tutti i canali di vendita, marketplace compresi: restano vendite dell\'azienda.')}</L>
        <L>{t('cor.g.panoramica4', null, 'Un mese per richiesta, anche sui mesi passati.')}</L>
      </UL>
    </>
  )
  if (scheda === 'perimetri') return (
    <>
      <P><strong>{t('cor.g.perimetriT', null, 'Italia, OSS, extra-UE e casi da verificare.')}</strong></P>
      <UL>
        <L><strong>Italia</strong> — {t('cor.g.perimetri1', null, 'paese di spedizione IT, vendite domestiche.')}</L>
        <L><strong>IVA OSS</strong> — {t('cor.g.perimetri2', null, 'paesi UE non italiani, con l\'aliquota ordinaria del paese di destinazione.')}</L>
        <L><strong>Extra-UE</strong> — {t('cor.g.perimetri3', null, 'fuori UE: IVA 0%.')}</L>
        <L><strong>Da verificare</strong> — {t('cor.g.perimetri4', null, 'paese mancante su Shopify: la riga non viene attribuita a nessun regime.')}</L>
      </UL>
      <P>{t('cor.g.perimetri5', null, 'L\'imponibile si ricava scorporando dal lordo con l\'aliquota ordinaria in vigore quel giorno, non con l\'IVA registrata da Shopify. Le aliquote cambiano nel tempo e il registro usa quella del periodo ricostruito.')}</P>
      <P>{t('cor.g.perimetri7', null, 'Quando il paese di spedizione manca, si usa quello di fatturazione: arrivano dalla stessa interrogazione, quindi il registro resta una sola contabilità. Le righe dedotte così vengono contate e dichiarate a parte.')}</P>
      <P>{t('cor.g.perimetri6', null, 'Limite noto: aliquote ridotte e territori speciali (Livigno, Campione, Canarie) non sono distinguibili dal solo paese e restano approssimati all\'aliquota ordinaria.')}</P>
    </>
  )
  if (scheda === 'shopify') return (
    <>
      <P><strong>{t('cor.g.shopifyT', null, 'Vendite, paese e quadratura interna.')}</strong></P>
      <div style={{ background: 'var(--glass2)', borderRadius: 12, padding: '10px 12px', fontFamily: 'ui-monospace, monospace', fontSize: 11.5, margin: '0 0 8px' }}>
        {t('cor.g.formula', null, 'Corrispettivo = vendite lorde + sconti + resi + spedizioni + IVA + commissioni di reso')}
      </div>
      <UL>
        <L>{t('cor.g.shopify1', null, 'Sconti e resi arrivano già con segno negativo e seguono la data del report, cioè il giorno contabile del movimento.')}</L>
        <L>{t('cor.g.shopify2', null, 'Due identità devono chiudere entro 2 centesimi: lordo + sconti + resi = netto, e netto + spedizioni + IVA + commissioni = totale.')}</L>
        <L>{t('cor.g.shopify3', null, 'Se non chiudono, il registro lo dice e non va consegnato.')}</L>
        <L>{t('cor.g.shopify4', null, 'Il corrispettivo fiscale aggiunge a queste vendite le gift card emesse e sottrae quelle riscattate: Shopify non le conta nel totale vendite.')}</L>
      </UL>
    </>
  )
  if (scheda === 'giftcard') return (
    <>
      <P><strong>{t('cor.g.giftT', null, 'Gift card monouso: IVA all\'emissione.')}</strong></P>
      <UL>
        <L>{t('cor.g.gift1', null, 'Il corrispettivo nasce all\'acquisto della gift card, non al suo utilizzo.')}</L>
        <L>{t('cor.g.gift2', null, 'Al riscatto l\'importo va neutralizzato, altrimenti la stessa somma sarebbe tassata due volte.')}</L>
        <L>{t('cor.g.gift3', null, 'Se il negozio le vende e i permessi Shopify lo consentono, ogni movimento è incluso e attribuito al paese del suo ordine; altrimenti il registro lo dichiara qui sotto invece di ignorarle in silenzio.')}</L>
      </UL>
    </>
  )
  if (scheda === 'export') return (
    <>
      <P><strong>{t('cor.g.exportT', null, 'Fogli dell\'Excel per il commercialista.')}</strong></P>
      <UL>
        <L><strong>LEGENDA</strong> — {t('cor.g.export1', null, 'questa guida, dentro il file.')}</L>
        <L><strong>RIEPILOGO</strong> — {t('cor.g.export2', null, 'totali per regime fiscale e paese.')}</L>
        <L><strong>DETTAGLIO</strong> — {t('cor.g.export3', null, 'tutte le righe: giorno, regime, paese, ordini, resi, lordo, imponibile, IVA.')}</L>
        <L><strong>CORRISPETTIVI IT</strong> — {t('cor.g.export4', null, 'solo perimetro Italia.')}</L>
        <L><strong>IVA OSS</strong> — {t('cor.g.export5', null, 'solo vendite UE non italiane, con aliquota per paese.')}</L>
        <L><strong>DA VERIFICARE</strong> — {t('cor.g.export6', null, 'solo le righe senza nessun paese, da sistemare prima della dichiarazione.')}</L>
        <L><strong>GIFT CARD</strong> e <strong>QUADRATURA</strong> — {t('cor.g.export8', null, 'GIFT CARD: ogni emissione, riscatto e riaccredito con il suo effetto sul corrispettivo. QUADRATURA: i controlli superati o falliti.')}</L>
      </UL>
      <P>{t('cor.g.export7', null, 'Nome del file: corrispettivi-shopify-AAAA-MM.xlsx')}</P>
    </>
  )
  return (
    <>
      <P><strong>{t('cor.g.quadraturaT', null, 'Controlli prima di consegnare al commercialista.')}</strong></P>
      <UL>
        <L>{t('cor.g.quadratura1', null, 'Le due identità contabili devono essere verdi: se una salta, il mese non è consegnabile.')}</L>
        <L>{t('cor.g.quadratura2', null, 'Il lordo senza paese deve essere vicino a zero: ogni euro lì dentro è una vendita senza regime IVA.')}</L>
        <L>{t('cor.g.quadratura3', null, 'Il mese deve essere chiuso: su un mese in corso il registro cambia ancora.')}</L>
        <L>{t('cor.g.quadratura4', null, 'Confronta il corrispettivo del periodo con il totale vendite del pannello Shopify: devono coincidere.')}</L>
      </UL>
    </>
  )
}

const th = (align = 'right') => ({
  padding: '9px 12px', fontSize: 10, fontWeight: 640, textTransform: 'uppercase',
  letterSpacing: '0.08em', textAlign: align, whiteSpace: 'nowrap',
})
const cella = { padding: '9px 12px', fontSize: 13, color: 'var(--text)', textAlign: 'right', whiteSpace: 'nowrap' }
