'use client'

import { useState, useEffect } from 'react'
import { Sankey, Tooltip, ResponsiveContainer } from 'recharts'

function PathNode({ x, y, width, height, payload, containerWidth }) {
  const isLast = payload.step === 3 || (x + width > containerWidth - 120)
  return (
    <g>
      <rect x={x} y={y} width={width} height={Math.max(height, 2)} rx={2} fill="#2997ff" fillOpacity={0.85} />
      <text x={isLast ? x - 6 : x + width + 6} y={y + height / 2} textAnchor={isLast ? 'end' : 'start'} fontSize={10} fill="#f5f5f7" dominantBaseline="middle">
        {(payload.name || '').slice(0, 26)}
      </text>
    </g>
  )
}

function Setup({ reason, detail }) {
  const REASON_LABEL = {
    'no-config': 'Env BigQuery mancanti (GA4_BQ_PROJECT / GA4_BQ_DATASET)',
    'no-creds': 'Credenziali Google assenti (client id / refresh token)',
    'scope': 'Token senza scope bigquery.readonly o permessi BigQuery insufficienti',
    'oauth': 'Errore OAuth Google (refresh token non valido)',
    'api': 'Errore BigQuery',
    'not-ready': 'Export GA4→BigQuery non ancora popolato',
  }
  const steps = {
    'no-creds': ['Collega Google dalla tab Integrazioni (con i 3 scope) oppure imposta GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET / GOOGLE_REFRESH_TOKEN su Vercel → Redeploy.'],
    'no-config': [
      'GA4 → Amministrazione → Collegamenti dei prodotti → BigQuery → collega un progetto GCP (export giornaliero). Attendi 24–48h che si popoli.',
      'Abilita la BigQuery API nel progetto GCP.',
      'Rigenera il refresh token includendo TUTTI gli scope: analytics.readonly + webmasters.readonly + bigquery.readonly. Aggiorna GOOGLE_REFRESH_TOKEN su Vercel.',
      'Imposta le env GA4_BQ_PROJECT (id progetto GCP) e GA4_BQ_DATASET (es. analytics_381385723) → Redeploy.',
    ],
    'scope': ['Il token non ha lo scope bigquery.readonly. Rigeneralo includendo anche analytics.readonly + webmasters.readonly + bigquery.readonly e aggiorna GOOGLE_REFRESH_TOKEN su Vercel → Redeploy.'],
    'oauth': ['Errore OAuth Google: rigenera il refresh token (con i 3 scope) e aggiornalo su Vercel.'],
    'api': ['Errore BigQuery. Verifica che l\'export GA4→BigQuery sia attivo e popolato, che la BigQuery API sia abilitata e che il dataset/project nelle env siano corretti.'],
    'not-ready': [
      'Permessi e token OK ✓ — ma nel dataset non ci sono ancora tabelle events_ (l\'export non si è ancora popolato).',
      'GA4 → Amministrazione → Collegamenti BigQuery: verifica che il link sia attivo. Le tabelle giornaliere events_AAAAMMGG compaiono dal giorno successivo.',
      'Per dati quasi in tempo reale attiva anche lo "Streaming" (richiede un account di fatturazione sul progetto GCP) → crea events_intraday_ in pochi minuti.',
      'Controlla in BigQuery (progetto/dataset) che esistano tabelle events_*; se il numero proprietà nel nome dataset è diverso, aggiorna GA4_BQ_DATASET.',
    ],
  }
  const list = steps[reason] || steps['no-config']
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Collega BigQuery per il percorso utente</div>
      {/* Diagnostica: motivo preciso + messaggio API */}
      <div style={{ background: 'rgba(255,159,10,0.10)', border: '1px solid rgba(255,159,10,0.35)', borderRadius: 10, padding: '10px 12px', marginBottom: 14, fontSize: 13 }}>
        <div><b>Stato:</b> {REASON_LABEL[reason] || reason || 'configurazione mancante'}</div>
        {detail && <div style={{ marginTop: 6, fontFamily: 'monospace', fontSize: 12, opacity: 0.85, wordBreak: 'break-word' }}>{detail}</div>}
      </div>
      <div style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.7 }}>
        Il Path Exploration pagina→pagina (come in GA4) si ricostruisce dai dati event-level esportati in BigQuery:
        <ol style={{ margin: '12px 0', paddingLeft: 20 }}>{list.map((s, i) => <li key={i} style={{ marginBottom: 6 }}>{s}</li>)}</ol>
        ⚠️ Quando rigeneri il token includi <b>sempre tutti e tre</b> gli scope, o rompi GA4/GSC.
      </div>
    </div>
  )
}

export default function UserPathTab() {
  const [days, setDays] = useState(28)
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let alive = true
    setState({ loading: true })
    fetch(`/api/ga4-path?days=${days}&debug=1`).then(r => r.json()).then(j => alive && setState({ loading: false, ...j }))
      .catch(() => alive && setState({ loading: false, configured: false, reason: 'api' }))
    return () => { alive = false }
  }, [days])

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ marginBottom: 14, fontSize: 13, opacity: 0.6 }}>Percorso degli utenti sul sito (Path Exploration) ricostruito da GA4 → BigQuery: da dove partono e quali pagine visitano in sequenza.</div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
        <select value={days} onChange={e => setDays(+e.target.value)} style={{ padding: '12px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, outline: 'none' }}>
          <option value={7}>7 giorni</option><option value={28}>28 giorni</option><option value={90}>90 giorni</option>
        </select>
      </div>

      {state.loading && <div style={{ opacity: 0.5, fontSize: 13 }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Interrogo BigQuery…</div>}
      {!state.loading && !state.configured && <Setup reason={state.reason} detail={state.error || state.oauthError} />}
      {!state.loading && state.configured && state.empty && <div className="glass-card" style={{ padding: 20, fontSize: 13 }}>Nessun dato di percorso nel periodo (l'export BigQuery potrebbe non essersi ancora popolato).</div>}
      {!state.loading && state.configured && !state.empty && state.nodes?.length > 0 && (
        <div className="glass-card" style={{ padding: 24 }}>
          <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 12 }}>{state.totalSessions?.toLocaleString('it-IT')} sessioni · primi 3 step · top pagine per step (le minori raggruppate in "Altre")</div>
          <div style={{ width: '100%', height: 560 }}>
            <ResponsiveContainer>
              <Sankey data={{ nodes: state.nodes, links: state.links }} node={<PathNode />} nodePadding={26} nodeWidth={12} margin={{ top: 10, right: 160, bottom: 10, left: 10 }} link={{ stroke: '#2997ff', strokeOpacity: 0.18 }}>
                <Tooltip contentStyle={{ background: 'rgba(8,8,15,0.95)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12 }} />
              </Sankey>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  )
}
