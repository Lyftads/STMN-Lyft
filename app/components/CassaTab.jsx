'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'

// ── Tab CASSA — controllo di cassa via open banking (multi-tenant) ──────────
// Collega i conti bancari (sola lettura, PSD2) e mostra: saldi, entrate/uscite,
// uscite per categoria (AI), movimenti recenti e proiezione di cassa 30/60/90.
// Alimenta anche il tool get_finance del Cervello.

const eur = (v, loc = 'it-IT') => (Number.isFinite(Number(v)) ? `€${Number(v).toLocaleString(loc, { maximumFractionDigits: 0 })}` : '—')

export default function CassaTab() {
  const { t, intlLocale } = useI18n()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [connecting, setConnecting] = useState(false)
  const [banks, setBanks] = useState(null)
  const [bankSearch, setBankSearch] = useState('')
  const [showPicker, setShowPicker] = useState(false)

  const load = useCallback(async (arg = false) => {
    // arg: boolean (refresh) oppure query string già pronta ('?refresh=1&code=…')
    const qs = typeof arg === 'string' ? arg : (arg ? '?refresh=1' : '')
    setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/cassa${qs}`, { cache: 'no-store' })
      const j = await r.json()
      if (!r.ok) throw new Error(j?.error || `HTTP ${r.status}`)
      setData(j)
    } catch (e) { setError(e?.message || 'Errore') }
    finally { setLoading(false) }
  }, [])

  useEffect(() => {
    // Ritorno dal collegamento banca: passa code+state alla route (scambio
    // sessione) e pulisci l'URL dai parametri sensibili.
    let qs = ''
    try {
      const p = new URLSearchParams(window.location.search)
      if (p.get('bankConnected') === '1') {
        qs = '?refresh=1'
        const code = p.get('code'), state = p.get('state')
        if (code && state) qs += `&code=${encodeURIComponent(code)}&state=${encodeURIComponent(state)}`
        try {
          const clean = new URL(window.location.href)
          for (const k of ['bankConnected', 'code', 'state', 'error', 'error_description']) clean.searchParams.delete(k)
          window.history.replaceState({}, '', clean)
        } catch {}
      }
    } catch {}
    load(qs || false)
  }, [load])

  const openPicker = async () => {
    setShowPicker(true)
    if (banks === null) {
      try {
        const r = await fetch('/api/cassa?action=institutions&country=IT', { cache: 'no-store' })
        const j = await r.json()
        setBanks(Array.isArray(j?.institutions) ? j.institutions : [])
        // Se il provider ha risposto con un errore (es. app non ancora attiva),
        // mostralo: "nessuna banca trovata" da solo è fuorviante.
        if (j?.error && !(j?.institutions || []).length) setError(j.error)
      } catch { setBanks([]) }
    }
  }

  const connectBank = async (b) => {
    if (connecting) return
    setConnecting(true)
    try {
      const psuType = Array.isArray(b.psuTypes) && b.psuTypes.includes('business') ? 'business' : (b.psuTypes?.[0] || 'business')
      const r = await fetch('/api/cassa', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'connect', institutionId: b.id, institutionName: b.name, country: b.country || 'IT', psuType }) })
      const j = await r.json()
      if (j?.link) { window.location.href = j.link; return }
      setError(j?.error || 'Errore collegamento')
    } catch (e) { setError(e?.message || 'Errore') }
    finally { setConnecting(false) }
  }

  const removeConnection = async (id) => {
    await fetch(`/api/cassa?id=${encodeURIComponent(id)}`, { method: 'DELETE' }).catch(() => {})
    load()
  }

  const filteredBanks = useMemo(() => {
    const q = bankSearch.trim().toLowerCase()
    const list = banks || []
    return q ? list.filter(b => b.name.toLowerCase().includes(q)) : list
  }, [banks, bankSearch])

  const hasData = !!(data?.balances || []).length
  const activeConns = (data?.connections || []).filter(c => c.status === 'active')

  // ── Stato: modulo non configurato (mancano le env del provider) ──
  if (!loading && data && data.configured === false) {
    return (
      <div className="glass-card" style={{ padding: 28, maxWidth: 640 }}>
        <div className="heading-sm" style={{ marginBottom: 8 }}>{t('cassa.title', null, 'Cassa')}</div>
        <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6 }}>
          {t('cassa.notConfigured', null, 'Il modulo Cassa non è ancora attivo su questa installazione (mancano le chiavi del provider open banking). Contatta il supporto.')}
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Header azioni */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 10, flexWrap: 'wrap' }}>
        <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>
          {hasData
            ? t('cassa.subtitle', null, 'Saldi e movimenti reali dai tuoi conti (sola lettura, aggiornati più volte al giorno).')
            : t('cassa.subtitleEmpty', null, 'Collega la banca in 2 minuti: connessione PSD2 di sola lettura, revocabile quando vuoi.')}
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {hasData && (
            <button onClick={() => load(true)} disabled={loading} className="glass-card-static" style={{ cursor: 'pointer', padding: '9px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', fontSize: 12.5, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="refresh" size={14} /> {t('cassa.refresh', null, 'Aggiorna')}
            </button>
          )}
          <button onClick={openPicker} style={{ cursor: 'pointer', padding: '9px 14px', borderRadius: 10, border: 'none', background: 'linear-gradient(135deg, #7c5cff, #5b3df0)', color: '#fff', fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <Icon name="plus" size={14} /> {t('cassa.connectBank', null, 'Collega banca')}
          </button>
        </div>
      </div>

      {error && <div style={{ marginBottom: 14, padding: '10px 14px', borderRadius: 10, background: 'rgba(255,69,58,0.10)', border: '1px solid rgba(255,69,58,0.3)', fontSize: 12.5, color: '#ff8a80' }}>{error}</div>}

      {/* Picker banca */}
      {showPicker && (
        <div className="glass-card" style={{ padding: 18, marginBottom: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <div style={{ fontWeight: 800, fontSize: 14 }}>{t('cassa.pickBank', null, 'Scegli la tua banca')}</div>
            <button onClick={() => setShowPicker(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer' }}><Icon name="close" size={16} /></button>
          </div>
          <input
            value={bankSearch} onChange={e => setBankSearch(e.target.value)}
            placeholder={t('cassa.searchBank', null, 'Cerca banca…')}
            style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--glass)', border: '1px solid var(--border2)', color: 'var(--text)', fontSize: 13, outline: 'none', marginBottom: 10 }}
          />
          {banks === null && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>…</div>}
          {Array.isArray(banks) && (
            <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 8, maxHeight: 300, overflowY: 'auto' }}>
              {filteredBanks.slice(0, 60).map(b => (
                <button key={b.id} onClick={() => connectBank(b)} disabled={connecting} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 11px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--glass)', color: 'var(--text)', cursor: 'pointer', textAlign: 'left' }}>
                  {b.logo ? <img src={b.logo} alt="" width={22} height={22} style={{ borderRadius: 5, flexShrink: 0 }} /> : <Icon name="money" size={18} />}
                  <span style={{ fontSize: 12.5, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name}</span>
                </button>
              ))}
              {filteredBanks.length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('cassa.noBankFound', null, 'Nessuna banca trovata.')}</div>}
            </div>
          )}
        </div>
      )}

      {loading && !data && <div style={{ opacity: 0.5, fontSize: 13 }}>{t('cassa.loading', null, 'Carico la cassa…')}</div>}

      {/* Empty state */}
      {!loading && data?.configured && !hasData && !showPicker && (
        <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
          <div style={{ fontSize: 34, marginBottom: 10 }}>🏦</div>
          <div className="heading-sm" style={{ marginBottom: 8 }}>{t('cassa.emptyTitle', null, 'Vedi le performance. Ora vedi anche la cassa.')}</div>
          <div style={{ fontSize: 13.5, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 560, margin: '0 auto 16px' }}>
            {t('cassa.emptyMsg', null, 'Collegando i conti aziendali, LyftAI incrocia le performance marketing con la liquidità reale: saprai non solo cosa rende, ma cosa puoi permetterti — e il Cervello ne terrà conto in ogni consiglio.')}
          </div>
          {activeConns.length === 0 && (data?.connections || []).some(c => c.status === 'pending') && (
            <div style={{ fontSize: 12.5, color: 'var(--text3)', marginBottom: 12 }}>{t('cassa.pendingNote', null, 'Collegamento in corso: se hai appena autorizzato la banca, premi Aggiorna tra qualche secondo.')}</div>
          )}
          <button onClick={openPicker} style={{ cursor: 'pointer', padding: '11px 20px', borderRadius: 11, border: 'none', background: 'linear-gradient(135deg, #7c5cff, #5b3df0)', color: '#fff', fontSize: 13.5, fontWeight: 700 }}>
            {t('cassa.connectBank', null, 'Collega banca')}
          </button>
        </div>
      )}

      {hasData && (
        <>
          {/* KPI */}
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 16 }}>
            <div className="glass-card" style={{ padding: 16 }}>
              <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>{t('cassa.kpiBalance', null, 'Saldo totale')}</div>
              <div style={{ fontSize: 24, fontWeight: 800 }}>{eur(data.totalBalance, intlLocale)}</div>
            </div>
            <div className="glass-card" style={{ padding: 16 }}>
              <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>{t('cassa.kpiIn', null, 'Entrate · 90g')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#30d158' }}>{eur(data.inflow90, intlLocale)}</div>
            </div>
            <div className="glass-card" style={{ padding: 16 }}>
              <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>{t('cassa.kpiOut', null, 'Uscite · 90g')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: '#ff6b62' }}>{eur(data.outflow90, intlLocale)}</div>
            </div>
            <div className="glass-card" style={{ padding: 16 }}>
              <div className="label" style={{ fontSize: 10, marginBottom: 6 }}>{t('cassa.kpiProj30', null, 'Proiezione · 30g')}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: (data.projection?.d30 ?? 0) >= 0 ? 'var(--text)' : '#ff6b62' }}>{eur(data.projection?.d30, intlLocale)}</div>
            </div>
          </div>

          {/* Proiezione + conti */}
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 14, marginBottom: 16 }}>
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>{t('cassa.projTitle', null, 'Proiezione di cassa')}</div>
              {data.projection ? (
                <>
                  <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap' }}>
                    {[['30', data.projection.d30], ['60', data.projection.d60], ['90', data.projection.d90]].map(([d, v]) => (
                      <div key={d}>
                        <div className="label" style={{ fontSize: 9.5, marginBottom: 4 }}>{d} {t('cassa.days', null, 'giorni')}</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: v >= 0 ? 'var(--text)' : '#ff6b62' }}>{eur(v, intlLocale)}</div>
                      </div>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 10 }}>
                    {t('cassa.projNote', { n: data.projection.basedOnDays }, `Stima basata sulle medie degli ultimi ${data.projection.basedOnDays} giorni di movimenti.`)}
                  </div>
                </>
              ) : <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('cassa.projSoon', null, 'Serve qualche giorno di storico per la proiezione.')}</div>}
            </div>
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 10 }}>{t('cassa.accounts', null, 'Conti collegati')}</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(data.balances || []).map(b => (
                  <div key={b.account_id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, fontSize: 12.5 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.name || b.iban || b.account_id}</span>
                    <strong>{eur(b.balance, intlLocale)}</strong>
                  </div>
                ))}
              </div>
              {(data.connections || []).length > 0 && (
                <div style={{ marginTop: 12, paddingTop: 10, borderTop: '1px solid var(--border)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {(data.connections || []).map(c => (
                    <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 11.5, color: 'var(--text3)' }}>
                      <span>{c.institution} · {c.status === 'active' ? t('cassa.connActive', null, 'attiva') : c.status}</span>
                      <button onClick={() => removeConnection(c.id)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 11 }}>{t('cassa.disconnect', null, 'Scollega')}</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Entrate/uscite per mese */}
          <div className="glass-card" style={{ padding: 18, marginBottom: 16 }}>
            <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 12 }}>{t('cassa.byMonth', null, 'Entrate e uscite per mese')}</div>
            <div style={{ width: '100%', height: 240 }}>
              <ResponsiveContainer>
                <BarChart data={data.byMonth || []} margin={{ top: 4, right: 8, left: -6, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                  <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text3)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text3)' }} />
                  <Tooltip contentStyle={{ background: '#15151d', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, fontSize: 12 }} formatter={(v, k) => [eur(v, intlLocale), k === 'in' ? t('cassa.in', null, 'Entrate') : t('cassa.out', null, 'Uscite')]} />
                  <Bar dataKey="in" fill="#30d158" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="out" fill="#ff6b62" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Uscite per categoria + movimenti recenti */}
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1.4fr', gap: 14 }}>
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 12 }}>{t('cassa.byCategory', null, 'Uscite per categoria · 90g')}</div>
              {(data.byCategory || []).slice(0, 9).map(c => {
                const max = data.byCategory?.[0]?.amount || 1
                return (
                  <div key={c.category} style={{ marginBottom: 9 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, marginBottom: 3 }}>
                      <span style={{ color: 'var(--text2)' }}>{c.category}</span>
                      <strong>{eur(c.amount, intlLocale)}</strong>
                    </div>
                    <div style={{ height: 5, borderRadius: 3, background: 'rgba(255,255,255,0.06)' }}>
                      <div style={{ height: '100%', width: `${Math.max(3, Math.round(c.amount / max * 100))}%`, borderRadius: 3, background: 'linear-gradient(90deg, #7c5cff, #5b3df0)' }} />
                    </div>
                  </div>
                )
              })}
              {(data.byCategory || []).length === 0 && <div style={{ fontSize: 12.5, color: 'var(--text3)' }}>{t('cassa.catSoon', null, 'Le categorie compaiono dopo la prima sincronizzazione.')}</div>}
            </div>
            <div className="glass-card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 13.5, marginBottom: 12 }}>{t('cassa.recent', null, 'Movimenti recenti')}</div>
              <div className="m-scrollx" style={{ maxHeight: 340, overflowY: 'auto' }}>
                {(data.recent || []).map((m, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.05)', fontSize: 12.5 }}>
                    <span style={{ color: 'var(--text3)', flex: '0 0 74px' }}>{m.booking_date}</span>
                    <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {m.counterparty || m.description || '—'}
                      {m.category && <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--text3)', border: '1px solid var(--border)', borderRadius: 6, padding: '1px 6px' }}>{m.category}</span>}
                    </span>
                    <strong style={{ color: (Number(m.amount) || 0) >= 0 ? '#30d158' : 'var(--text)' }}>{eur(m.amount, intlLocale)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
