'use client'

import { useState, useEffect, useCallback } from 'react'

const STATUS = { pass: { color: '#30d158', icon: '✓' }, warn: { color: '#ff9f0a', icon: '!' }, fail: { color: '#ff375f', icon: '×' } }
const GROUPS = ['Essenziali', 'Social/Sharing', 'Strutturati', 'Contenuto', 'Tecnici']
const PRIO = { alta: '#ff375f', media: '#ff9f0a', bassa: '#64d2ff' }
const scoreCol = s => s >= 85 ? '#30d158' : s >= 70 ? '#64d2ff' : s >= 50 ? '#ff9f0a' : '#ff375f'
const fmtDate = d => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SeoAuditTab() {
  const [view, setView] = useState('analyze')          // analyze | history
  const [mode, setMode] = useState('page')             // page | site
  const [url, setUrl] = useState('')
  const [keyword, setKeyword] = useState('')
  const [limit, setLimit] = useState(10)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [res, setRes] = useState(null)

  const [history, setHistory] = useState([])
  const [picks, setPicks] = useState([])               // id selezionati per confronto
  const [compare, setCompare] = useState(null)         // { before, after }

  const loadHistory = useCallback(async () => {
    try {
      const r = await fetch('/api/seo-audit/history')
      const d = await r.json()
      setHistory(d.items || [])
    } catch {}
  }, [])
  useEffect(() => { loadHistory() }, [loadHistory])

  const run = async () => {
    if (!url.trim() || loading) return
    setLoading(true); setError(null); setRes(null); setCompare(null)
    try {
      const endpoint = mode === 'site' ? '/api/seo-audit/site' : '/api/seo-audit'
      const r = await fetch(endpoint, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url, targetKeyword: keyword, limit }),
      })
      const data = await r.json()
      if (data.error) setError(data.error)
      else { setRes(data); loadHistory() }
    } catch { setError('Errore durante l\'analisi.') }
    finally { setLoading(false) }
  }

  const loadAudit = async (id) => {
    setView('analyze'); setCompare(null); setLoading(true); setError(null)
    try {
      const r = await fetch(`/api/seo-audit/history?id=${id}`)
      const d = await r.json()
      if (d.result) setRes(d.result)
    } catch {} finally { setLoading(false) }
  }

  const togglePick = (id) => setPicks(p => p.includes(id) ? p.filter(x => x !== id) : (p.length < 2 ? [...p, id] : [p[1], id]))

  const runCompare = async () => {
    if (picks.length !== 2) return
    setLoading(true)
    try {
      const [a, b] = await Promise.all(picks.map(id => fetch(`/api/seo-audit/history?id=${id}`).then(r => r.json())))
      // ordina per data: before = più vecchio
      const [before, after] = new Date(a.created_at) <= new Date(b.created_at) ? [a, b] : [b, a]
      setCompare({ before, after }); setView('analyze'); setRes(null)
    } catch {} finally { setLoading(false) }
  }

  const delAudit = async (id, e) => {
    e.stopPropagation()
    try { await fetch(`/api/seo-audit/history?id=${id}`, { method: 'DELETE' }); loadHistory(); setPicks(p => p.filter(x => x !== id)) } catch {}
  }

  return (
    <div style={{ maxWidth: 1100 }}>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18 }}>
        <Pill active={view === 'analyze'} onClick={() => setView('analyze')}>Analizza</Pill>
        <Pill active={view === 'history'} onClick={() => { setView('history'); loadHistory() }}>Storico {history.length ? `(${history.length})` : ''}</Pill>
      </div>

      {view === 'analyze' && (
        <>
          {/* Controlli */}
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <Pill small active={mode === 'page'} onClick={() => setMode('page')}>Pagina singola</Pill>
            <Pill small active={mode === 'site'} onClick={() => setMode('site')}>Intero sito (multipagina)</Pill>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
              placeholder={mode === 'site' ? 'https://tuosito.com  (scopre le pagine dalla sitemap)' : 'https://tuosito.com/pagina'}
              style={inputStyle} />
            {mode === 'site' && (
              <select value={limit} onChange={e => setLimit(+e.target.value)} style={{ ...inputStyle, flex: 'none', width: 130 }}>
                <option value={5}>5 pagine</option><option value={10}>10 pagine</option><option value={20}>20 pagine</option>
              </select>
            )}
            <button onClick={run} disabled={loading || !url.trim()} style={btnStyle(loading)}>
              {loading ? 'Analizzo…' : 'Analizza'}
            </button>
          </div>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
            placeholder="Keyword target (opzionale) — es. accessori crossfit" style={{ ...inputStyle, marginBottom: 24 }} />

          {error && <div className="glass-card" style={{ padding: 18, color: '#ff375f', marginBottom: 20 }}>⚠ {error}</div>}

          {compare && <CompareView compare={compare} />}
          {!compare && res && (res.mode === 'site' ? <SiteResult res={res} /> : <PageResult res={res} />)}
        </>
      )}

      {view === 'history' && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 700 }}>Audit salvati</div>
            <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.6 }}>
              {picks.length === 2 ? <button onClick={runCompare} style={{ ...btnStyle(false), padding: '8px 16px' }}>Confronta prima/dopo</button>
                : `Seleziona 2 audit della stessa URL per confrontarli (${picks.length}/2)`}
            </div>
          </div>
          {history.length === 0 && <div style={{ fontSize: 13, opacity: 0.5 }}>Nessun audit salvato ancora. (Richiede la tabella <code>seo_audits</code> su Supabase — vedi note.)</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <div key={h.id} onClick={() => loadAudit(h.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 10, cursor: 'pointer',
                background: picks.includes(h.id) ? 'rgba(41,151,255,0.12)' : 'var(--glass)', border: '1px solid var(--border)',
              }}>
                <input type="checkbox" checked={picks.includes(h.id)} onChange={() => {}} onClick={e => { e.stopPropagation(); togglePick(h.id) }} />
                <span style={{ width: 40, height: 28, borderRadius: 6, background: scoreCol(h.score) + '22', color: scoreCol(h.score), fontWeight: 700, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{h.score}</span>
                <span style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.5, width: 36 }}>{h.mode === 'site' ? 'sito' : 'pag.'}</span>
                <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-all', opacity: 0.85 }}>{h.url}</span>
                <span style={{ fontSize: 12, opacity: 0.5 }}>{fmtDate(h.created_at)}</span>
                <span onClick={e => delAudit(h.id, e)} style={{ cursor: 'pointer', opacity: 0.4, fontSize: 16 }}>×</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ---------- viste risultato ---------- */
function PageResult({ res }) {
  return (
    <>
      <ScoreHeader score={res.score} label={res.scoreLabel} summary={res.summary} url={res.url} meta={res.meta} />
      {res.keywords && <KeywordPanel kw={res.keywords} />}
      <Recommendations recs={res.recommendations} />
      {GROUPS.map(group => {
        const items = (res.checks || []).filter(c => c.group === group)
        if (!items.length) return null
        return (
          <div key={group} className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
            <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14, opacity: 0.85 }}>{group}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {items.map(c => <CheckRow key={c.id} c={c} />)}
            </div>
          </div>
        )
      })}
    </>
  )
}

function SiteResult({ res }) {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: scoreCol(res.avgScore) }}>{res.avgScore}</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>media · {res.scoreLabel}</div>
        </div>
        <div className="glass-card" style={{ padding: 24, display: 'flex', alignItems: 'center' }}>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{res.pagesAnalyzed}</div><div style={{ fontSize: 12, opacity: 0.6 }}>pagine analizzate</div></div>
          <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.5, wordBreak: 'break-all' }}>{res.url}</div>
        </div>
      </div>
      <Recommendations recs={res.recommendations} />
      {/* problemi ricorrenti */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Problemi ricorrenti</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {res.commonIssues.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: i.fail ? '#ff375f' : '#ff9f0a' }} />
              <span style={{ flex: 1 }}>{i.label}</span>
              <span style={{ opacity: 0.6 }}>{i.affected}/{res.pagesAnalyzed} pagine</span>
            </div>
          ))}
        </div>
      </div>
      {/* per pagina */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Pagine (peggiori in alto)</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {res.pages.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 36, height: 24, borderRadius: 6, background: scoreCol(p.score) + '22', color: scoreCol(p.score), fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.score}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ wordBreak: 'break-all', opacity: 0.85 }}>{p.url}</div>
                {p.issues.length > 0 && <div style={{ fontSize: 11, opacity: 0.5, marginTop: 2 }}>{p.issues.slice(0, 5).join(' · ')}{p.issues.length > 5 ? ` +${p.issues.length - 5}` : ''}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function CompareView({ compare }) {
  const { before, after } = compare
  const bScore = before.score, aScore = after.score
  const delta = aScore - bScore
  const bChecks = before.result?.checks || [], aChecks = after.result?.checks || []
  const bMap = Object.fromEntries(bChecks.map(c => [c.id, c]))
  const changes = []
  for (const c of aChecks) {
    const prev = bMap[c.id]
    if (prev && prev.status !== c.status) changes.push({ label: c.label, from: prev.status, to: c.status, detail: c.detail })
  }
  const rank = { fail: 0, warn: 1, pass: 2 }
  const improved = changes.filter(c => rank[c.to] > rank[c.from])
  const regressed = changes.filter(c => rank[c.to] < rank[c.from])

  return (
    <>
      <div className="glass-card" style={{ padding: 24, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 24 }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: scoreCol(bScore) }}>{bScore}</div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>Prima · {fmtDate(before.created_at)}</div>
        </div>
        <div style={{ fontSize: 28, opacity: 0.5 }}>→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 36, fontWeight: 800, color: scoreCol(aScore) }}>{aScore}</div>
          <div style={{ fontSize: 11, opacity: 0.5 }}>Dopo · {fmtDate(after.created_at)}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 32, fontWeight: 800, color: delta >= 0 ? '#30d158' : '#ff375f' }}>{delta >= 0 ? '+' : ''}{delta}</div>
          <div style={{ fontSize: 12, opacity: 0.6, wordBreak: 'break-all', maxWidth: 360 }}>{after.url}</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#30d158' }}>↑ Migliorati ({improved.length})</div>
          {improved.length === 0 && <div style={{ fontSize: 13, opacity: 0.4 }}>Nessuno</div>}
          {improved.map((c, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0' }}>{c.label} <span style={{ opacity: 0.5 }}>({c.from}→{c.to})</span></div>)}
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 700, marginBottom: 12, color: '#ff375f' }}>↓ Peggiorati ({regressed.length})</div>
          {regressed.length === 0 && <div style={{ fontSize: 13, opacity: 0.4 }}>Nessuno</div>}
          {regressed.map((c, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0' }}>{c.label} <span style={{ opacity: 0.5 }}>({c.from}→{c.to})</span></div>)}
        </div>
      </div>
    </>
  )
}

/* ---------- pezzi riusabili ---------- */
function ScoreHeader({ score, label, summary, url, meta }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 24 }}>
      <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: scoreCol(score) }}>{score}</div>
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>/ 100 · {label}</div>
      </div>
      <div className="glass-card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 28 }}>
        <Sum n={summary.pass} label="Ok" color="#30d158" />
        <Sum n={summary.warn} label="Da migliorare" color="#ff9f0a" />
        <Sum n={summary.fail} label="Critici" color="#ff375f" />
        <div style={{ marginLeft: 'auto', fontSize: 12, opacity: 0.5, textAlign: 'right' }}>
          <div style={{ wordBreak: 'break-all' }}>{url}</div>
          {meta && <div>{meta.words} parole · {(meta.loadMs / 1000).toFixed(1)}s</div>}
        </div>
      </div>
    </div>
  )
}
function KeywordPanel({ kw }) {
  const Chips = ({ list }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {list.map((k, i) => (
        <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--border)' }}>
          {k.term} <span style={{ opacity: 0.5 }}>{k.count}× · {k.density}%</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 14, fontSize: 14 }}>Analisi keyword</div>
      {kw.target && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(41,151,255,0.1)', fontSize: 13 }}>
          Target <strong>"{kw.target.keyword}"</strong>: {kw.target.count} occorrenze · densità <strong>{kw.target.density}%</strong>
          <span style={{ opacity: 0.6 }}> (ideale 0,5–3,5%)</span>
        </div>
      )}
      <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 6 }}>Parole più frequenti</div>
      <Chips list={kw.unigrams} />
      <div style={{ fontSize: 12, opacity: 0.55, margin: '14px 0 6px' }}>Frasi (2 parole)</div>
      <Chips list={kw.bigrams} />
      {kw.trigrams?.length > 0 && <><div style={{ fontSize: 12, opacity: 0.55, margin: '14px 0 6px' }}>Frasi (3 parole)</div><Chips list={kw.trigrams} /></>}
    </div>
  )
}
function Recommendations({ recs }) {
  if (!recs?.length) return null
  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ fontWeight: 700, marginBottom: 16, fontSize: 15 }}>✦ Azioni consigliate (AI)</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recs.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 8px', borderRadius: 6, color: PRIO[r.priority] || '#64d2ff', border: `1px solid ${PRIO[r.priority] || '#64d2ff'}`, flexShrink: 0, marginTop: 2 }}>{r.priority}</span>
            <div><div style={{ fontWeight: 600, fontSize: 14 }}>{r.title}</div><div style={{ fontSize: 13, opacity: 0.7 }}>{r.action}</div></div>
          </div>
        ))}
      </div>
    </div>
  )
}
function CheckRow({ c }) {
  const s = STATUS[c.status]
  return (
    <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: s.color + '22', color: s.color, fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{s.icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 14, fontWeight: 500 }}>{c.label}</span>
        <span style={{ fontSize: 13, opacity: 0.6, marginLeft: 8 }}>{c.detail}</span>
      </div>
    </div>
  )
}
function Sum({ n, label, color }) {
  return <div style={{ textAlign: 'center' }}><div style={{ fontSize: 28, fontWeight: 700, color }}>{n}</div><div style={{ fontSize: 12, opacity: 0.6 }}>{label}</div></div>
}
function Pill({ active, onClick, children, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '7px 14px' : '9px 18px', borderRadius: 10, cursor: 'pointer', fontSize: small ? 13 : 14, fontWeight: 600,
      background: active ? 'var(--accent)' : 'var(--glass)', color: active ? '#fff' : 'var(--text)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    }}>{children}</button>
  )
}

const inputStyle = { flex: 1, minWidth: 240, padding: '14px 16px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 15, outline: 'none' }
const btnStyle = (loading) => ({ padding: '14px 28px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(41,151,255,0.4)' : 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 15 })
