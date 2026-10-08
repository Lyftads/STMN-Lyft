'use client'

// Dentro al pannello di una creativita': l'andamento giorno per giorno della
// spesa e del ROAS, e la quota di spesa per posizionamento. Dati da
// /api/creative-ad-detail (una chiamata per creativita' e periodo, in memoria).
// Grafici neutri (grigio, come gli sparkline): il colore resta ai verdetti.

import { useEffect, useState } from 'react'
import { AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { leggi, inMemoria } from '../../lib/clientCache'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { soldi } from '../../lib/client/soldi'
import { num } from '../../lib/client/numeri'
import { tfQuery } from '../../lib/tfQuery'
import { Fonte } from './ui/FasceTabella'
import useTema from './ui/useTema'

const GRIGIO = '#8e8e98'

function Titolo({ children }) {
  return <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 640, marginBottom: 10 }}>{children}</div>
}

function Nuvoletta({ active, payload, label, formato }) {
  if (!active || !payload?.length) return null
  return (
    <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', fontSize: 13, color: 'var(--text)' }}>
      <div style={{ color: 'var(--text3)', fontSize: 11.5 }}>{label}</div>
      <div style={{ fontWeight: 640, fontVariantNumeric: 'tabular-nums' }}>{formato(payload[0].value)}</div>
    </div>
  )
}

// Due istanze nel pannello (andamento sopra i pubblici, posizionamenti sotto)
// leggono lo stesso indirizzo: la promessa in corso si condivide, una chiamata.
const inCorso = new Map()
function leggiUnaVolta(url, onUpdate) {
  if (!inCorso.has(url)) {
    const pr = leggi(url, { onUpdate }).finally(() => inCorso.delete(url))
    inCorso.set(url, pr)
  }
  return inCorso.get(url)
}

export default function CreativeDettaglioExtra({ row, tf, mostra = 'tutto' }) {
  const { t } = useI18n()
  const chiaro = useTema() === 'light'
  const adId = row?.ad_id || row?.id
  const url = adId ? `/api/creative-ad-detail?${tfQuery(tf)}&ad_id=${encodeURIComponent(adId)}` : null
  const [dati, setDati] = useState(() => (url ? inMemoria(url) : null))
  const [attesa, setAttesa] = useState(() => !!url && !inMemoria(url))

  useEffect(() => {
    if (!url) return
    let vivo = true
    const gia = inMemoria(url)
    if (gia) { setDati(gia); setAttesa(false) } else setAttesa(true)
    leggiUnaVolta(url, d => { if (vivo) setDati(d) })
      .then(d => { if (vivo) setDati(d) })
      .catch(() => {})
      .finally(() => { if (vivo) setAttesa(false) })
    return () => { vivo = false }
  }, [url])

  const daily = Array.isArray(dati?.daily) ? dati.daily : []
  const posizioni = Array.isArray(dati?.placements) ? dati.placements : []
  const asse = { stroke: 'var(--text3)', fontSize: 10, tickLine: false, axisLine: false }
  const giorno = d => String(d || '').slice(5).replace('-', '/')
  const th = { padding: '6px 6px', fontSize: 10, fontWeight: 640, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }
  const td = { padding: '7px 6px', fontSize: 13, textAlign: 'right', color: 'var(--text)', whiteSpace: 'nowrap', fontVariantNumeric: 'tabular-nums' }

  if (attesa && !dati) {
    return <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('cr.andamento.caricamento', null, 'Sto leggendo andamento e posizionamenti…')}</div>
  }
  if (dati?.ok === false || dati?.error) {
    return <div style={{ color: '#fca5a5', fontSize: 13 }}>{t('cr.andamento.errore', { err: dati.error || 'Meta' }, `Andamento non disponibile: ${dati.error || 'Meta'}`)}</div>
  }

  const andamento = mostra === 'tutto' || mostra === 'andamento'
  const posiz = mostra === 'tutto' || mostra === 'posizionamenti'
  return (
    <>
      {andamento && <div>
        <Titolo>{t('cr.andamento.titolo', null, 'Andamento giornaliero')}</Titolo>
        {daily.length < 2 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('cr.andamento.vuoto', null, 'Serve più di un giorno di spesa per disegnare l’andamento.')}</div>
        ) : (
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px 6px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6, paddingLeft: 6 }}>{t('cr.spend', null, 'Spesa')}</div>
              <ResponsiveContainer width="100%" height={140}>
                <AreaChart data={daily} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
                  <defs>
                    <linearGradient id="cr-area-spesa" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={GRIGIO} stopOpacity={chiaro ? 0.28 : 0.35} />
                      <stop offset="100%" stopColor={GRIGIO} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <XAxis dataKey="date" {...asse} tickFormatter={giorno} minTickGap={18} />
                  <YAxis {...asse} tickFormatter={v => `€${Math.round(v)}`} width={48} />
                  <Tooltip content={<Nuvoletta formato={v => soldi(v, 2)} />} cursor={{ stroke: GRIGIO, strokeOpacity: 0.4 }} labelFormatter={giorno} />
                  <Area type="monotone" dataKey="spend" stroke={GRIGIO} strokeWidth={2} fill="url(#cr-area-spesa)" dot={false} isAnimationActive={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 10px 6px' }}>
              <div style={{ fontSize: 11.5, color: 'var(--text3)', marginBottom: 6, paddingLeft: 6 }}>ROAS</div>
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={daily} margin={{ top: 4, right: 6, left: -14, bottom: 0 }}>
                  <XAxis dataKey="date" {...asse} tickFormatter={giorno} minTickGap={18} />
                  <YAxis {...asse} tickFormatter={v => num(v, 1)} width={48} />
                  <Tooltip content={<Nuvoletta formato={v => num(v, 2)} />} cursor={{ stroke: GRIGIO, strokeOpacity: 0.4 }} labelFormatter={giorno} />
                  <Line type="monotone" dataKey="roas" stroke={GRIGIO} strokeWidth={2} dot={{ r: 2.5, fill: GRIGIO, strokeWidth: 0 }} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>}

      {posiz && <div>
        <Titolo>{t('cr.posizionamenti.titolo', null, 'Spesa per posizionamento')}</Titolo>
        {posizioni.length === 0 ? (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('cr.posizionamenti.vuoto', null, 'Meta non ha attribuito la spesa a nessun posizionamento in questo periodo.')}</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tab-lyft" style={{ width: '100%', minWidth: 0, borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ ...th, textAlign: 'left' }}><Fonte loghi={['meta']} />{t('cr.posizionamenti.colonna', null, 'Posizionamento')}</th>
                  <th style={th}>{t('cr.spend', null, 'Spesa')}</th>
                  <th style={th}>{t('cr.share', null, 'Quota')}</th>
                  <th style={th}>{t('cr.orders', null, 'Ordini')}</th>
                  <th style={th}>ROAS</th>
                  <th style={th}>CPA</th>
                </tr>
              </thead>
              <tbody>
                {posizioni.map(p => (
                  <tr key={`${p.platform}-${p.position}`} style={{ borderTop: '1px solid var(--border)' }}>
                    <td style={{ ...td, textAlign: 'left' }}>
                      {p.label}
                      <div style={{ marginTop: 3, width: 90, height: 4, borderRadius: 2, background: 'var(--glass2)', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min(100, p.share)}%`, height: '100%', background: GRIGIO }} />
                      </div>
                    </td>
                    <td style={td}>{soldi(p.spend)}</td>
                    <td style={{ ...td, color: 'var(--text2)' }}>{num(p.share, 0)}%</td>
                    <td style={td}>{num(p.purchases)}</td>
                    <td style={{ ...td, fontWeight: 640 }}>{p.roas ? num(p.roas, 2) : '—'}</td>
                    <td style={td}>{p.cpa != null ? soldi(p.cpa, 2) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>}
    </>
  )
}
