'use client'

import { useState, useEffect, useCallback } from 'react'

const STATUS = { pass: { color: '#30d158', icon: '✓' }, warn: { color: '#ff9f0a', icon: '!' }, fail: { color: '#ff375f', icon: '×' } }
const GROUPS = ['Essenziali', 'Social/Sharing', 'Strutturati', 'Contenuto', 'Tecnici']
const PRIO = { alta: '#ff375f', media: '#ff9f0a', bassa: '#64d2ff' }
const scoreCol = s => s >= 85 ? '#30d158' : s >= 70 ? '#64d2ff' : s >= 50 ? '#ff9f0a' : '#ff375f'
const fmtDate = d => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

export default function SeoAuditTab() {
  const [view, setView] = useState('audit')            // audit | keyword | editor | competitor | aeo | history
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
  const [pdfLoading, setPdfLoading] = useState(false)

  const downloadPdf = async (result) => {
    if (!result || pdfLoading) return
    setPdfLoading(true)
    try {
      const r = await fetch('/api/seo-audit/pdf', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ result }),
      })
      const ct = r.headers.get('content-type') || ''
      const blob = await r.blob()
      const u = URL.createObjectURL(blob)
      if (ct.includes('pdf')) {
        const host = (() => { try { return new URL(result.url).hostname.replace(/^www\./, '') } catch { return 'site' } })()
        const a = document.createElement('a')
        a.href = u; a.download = `SEO_${host}.pdf`
        document.body.appendChild(a); a.click(); a.remove()
      } else {
        window.open(u, '_blank') // fallback HTML (Browserless non configurato)
      }
      setTimeout(() => URL.revokeObjectURL(u), 15000)
    } catch {} finally { setPdfLoading(false) }
  }

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
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Pill active={view === 'audit'} onClick={() => setView('audit')}>Audit</Pill>
        <Pill active={view === 'keyword'} onClick={() => setView('keyword')}>Keyword AI</Pill>
        <Pill active={view === 'editor'} onClick={() => setView('editor')}>Editor contenuti</Pill>
        <Pill active={view === 'competitor'} onClick={() => setView('competitor')}>Competitor</Pill>
        <Pill active={view === 'aeo'} onClick={() => setView('aeo')}>AI Visibility</Pill>
        <Pill active={view === 'gsc'} onClick={() => setView('gsc')}>Search Console</Pill>
        <Pill active={view === 'history'} onClick={() => { setView('history'); loadHistory() }}>Storico {history.length ? `(${history.length})` : ''}</Pill>
      </div>

      {view === 'keyword' && <KeywordAIPanel />}
      {view === 'editor' && <EditorPanel />}
      {view === 'competitor' && <CompetitorPanel />}
      {view === 'aeo' && <AeoPanel />}
      {view === 'gsc' && <GSCPanel />}

      {view === 'audit' && (
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
          {!compare && res && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <button onClick={() => downloadPdf(res)} disabled={pdfLoading} style={{
                  padding: '9px 18px', borderRadius: 10, cursor: pdfLoading ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600,
                  background: 'var(--glass)', color: 'var(--text)', border: '1px solid var(--border)',
                }}>⤓ {pdfLoading ? 'Genero PDF…' : 'Scarica PDF'}</button>
              </div>
              {res.mode === 'site' ? <SiteResult res={res} /> : <PageResult res={res} />}
              <SeoAgentPanel audit={res} />
            </>
          )}
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

/* ---------- agente SEO verticale (chat) ---------- */
function SeoAgentPanel({ audit }) {
  const [messages, setMessages] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const send = async (text) => {
    const content = (text ?? input).trim()
    if (!content || loading) return
    const next = [...messages, { role: 'user', content }]
    setMessages(next); setInput(''); setLoading(true)
    try {
      const r = await fetch('/api/seo-agent', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next, audit }),
      })
      const j = await r.json()
      setMessages(prev => [...prev, { role: 'assistant', content: j.reply || `⚠ ${j.error || 'errore'}` }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: '⚠ Errore di rete' }])
    } finally { setLoading(false) }
  }

  const suggestions = [
    'Riscrivi title e meta description ottimizzati',
    'Quali keyword dovrei targetizzare e perché?',
    'Genera lo JSON-LD adatto a questa pagina',
    'Dammi una roadmap SEO prioritizzata (impatto/sforzo)',
  ]

  return (
    <div className="glass-card" style={{ padding: 24, marginTop: 16 }}>
      <div style={{ fontWeight: 700, marginBottom: 4, fontSize: 15 }}>✦ Esperto SEO</div>
      <div style={{ fontSize: 12, opacity: 0.55, marginBottom: 16 }}>Consulente SEO verticale — conosce l'audit qui sopra. Chiedi riscritture, keyword, schema, roadmap.</div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 14 }}>
        {messages.map((m, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '82%', padding: '10px 14px', borderRadius: 14, fontSize: 13.5, lineHeight: 1.55, whiteSpace: 'pre-wrap',
              background: m.role === 'user' ? 'var(--accent)' : 'var(--glass)',
              color: m.role === 'user' ? '#fff' : 'var(--text)',
              border: m.role === 'user' ? 'none' : '1px solid var(--border)',
            }}>{m.content}</div>
          </div>
        ))}
        {loading && <div style={{ fontSize: 13, opacity: 0.5 }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> L'esperto sta elaborando…</div>}
      </div>

      {messages.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
          {suggestions.map((s, i) => (
            <button key={i} onClick={() => send(s)} style={{
              fontSize: 12, padding: '7px 12px', borderRadius: 10, cursor: 'pointer',
              background: 'var(--glass)', color: 'var(--text)', border: '1px solid var(--border)',
            }}>{s}</button>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <input value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && send()}
          placeholder="Chiedi all'esperto SEO…"
          style={{ flex: 1, padding: '12px 14px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 14, outline: 'none' }} />
        <button onClick={() => send()} disabled={loading || !input.trim()} style={{
          padding: '12px 22px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer',
          background: loading ? 'rgba(41,151,255,0.4)' : 'var(--accent)', color: '#fff', fontWeight: 600, fontSize: 14,
        }}>Invia</button>
      </div>
    </div>
  )
}

/* ---------- Keyword AI (à la Neil Patel) ---------- */
function KeywordAIPanel() {
  const [kw, setKw] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [d, setD] = useState(null)
  const run = async () => {
    if (!kw.trim() || loading) return
    setLoading(true); setError(null); setD(null)
    try { const r = await fetch('/api/seo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'keyword', keyword: kw }) }); const j = await r.json(); j.error ? setError(j.error) : setD(j) }
    catch { setError('Errore') } finally { setLoading(false) }
  }
  return (
    <div>
      <Row><input value={kw} onChange={e => setKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder="Keyword da analizzare — es. accessori crossfit" style={inputStyle} /><button onClick={run} disabled={loading || !kw.trim()} style={btnStyle(loading)}>{loading ? 'Analizzo…' : 'Analizza keyword'}</button></Row>
      {error && <Err>{error}</Err>}
      {d && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 20, marginBottom: 16 }}>
            <Mini label="Intent" value={d.intent} note={d.intentNote} />
            <Mini label="Difficoltà" value={d.difficulty?.level} note={d.difficulty?.note} />
            <Mini label="AI Overview" value={d.aiOverview?.likely ? 'Probabile' : 'Improbabile'} note={d.aiOverview?.note} />
          </div>
          {d.volumeHint && <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>Volume stimato: <strong>{d.volumeHint}</strong></div>}
          {d.summary && <div className="glass-card" style={{ padding: 18, marginBottom: 16, fontSize: 14 }}>{d.summary}</div>}
          <Block title="Keyword correlate"><Chips list={(d.related || []).map(r => `${r.term}${r.intent ? ` · ${r.intent}` : ''}`)} /></Block>
          <Block title="Domande (People Also Ask)">{(d.questions || []).map((q, i) => <div key={i} style={{ fontSize: 13.5, padding: '4px 0' }}>• {q}</div>)}</Block>
          <Block title="Idee di contenuto">{(d.contentIdeas || []).map((c, i) => <div key={i} style={{ padding: '6px 0', fontSize: 13.5 }}><strong>{c.title}</strong>{c.angle ? <span style={{ opacity: 0.65 }}> — {c.angle}</span> : null}</div>)}</Block>
        </>
      )}
    </div>
  )
}

/* ---------- Editor contenuti (brief da competitor) ---------- */
function EditorPanel() {
  const [kw, setKw] = useState(''); const [comp, setComp] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [d, setD] = useState(null)
  const run = async () => {
    if (!kw.trim() || loading) return
    setLoading(true); setError(null); setD(null)
    const competitorUrls = comp.split('\n').map(s => s.trim()).filter(Boolean)
    try { const r = await fetch('/api/seo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'editor', keyword: kw, competitorUrls }) }); const j = await r.json(); j.error ? setError(j.error) : setD(j) }
    catch { setError('Errore') } finally { setLoading(false) }
  }
  return (
    <div>
      <Row><input value={kw} onChange={e => setKw(e.target.value)} placeholder="Keyword target del contenuto" style={inputStyle} /><button onClick={run} disabled={loading || !kw.trim()} style={btnStyle(loading)}>{loading ? 'Genero…' : 'Genera brief'}</button></Row>
      <textarea value={comp} onChange={e => setComp(e.target.value)} placeholder="URL competitor da analizzare (una per riga, opzionale)" style={{ ...inputStyle, marginTop: 12, minHeight: 80, fontFamily: 'inherit' }} />
      {error && <Err>{error}</Err>}
      {d && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <Mini label="Search intent" value={d.searchIntent} />
            <Mini label="Lunghezza consigliata" value={`${d.recommendedWords || '—'} parole`} />
          </div>
          {d.title && <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}><div style={{ fontSize: 11, opacity: 0.55 }}>TITLE ({d.title.length})</div><div style={{ fontSize: 14, fontWeight: 600 }}>{d.title}</div><div style={{ fontSize: 11, opacity: 0.55, marginTop: 8 }}>META ({(d.metaDescription || '').length})</div><div style={{ fontSize: 13 }}>{d.metaDescription}</div></div>}
          <Block title="Struttura heading consigliata">{(d.headings || []).map((h, i) => <div key={i} style={{ fontSize: 13.5, padding: '3px 0', paddingLeft: h.tag === 'H3' ? 20 : 0 }}><span style={{ opacity: 0.45, fontSize: 11 }}>{h.tag}</span> {h.text}</div>)}</Block>
          <Block title="Entità / argomenti da coprire"><Chips list={d.entities || []} /></Block>
          {(d.faq || []).length > 0 && <Block title="FAQ suggerite">{d.faq.map((f, i) => <div key={i} style={{ padding: '6px 0', fontSize: 13.5 }}><strong>{f.q}</strong><div style={{ opacity: 0.7 }}>{f.a}</div></div>)}</Block>}
          {d.schema && <Block title="Schema (JSON-LD)"><div style={{ fontSize: 13, opacity: 0.8 }}>{d.schema}</div></Block>}
          {(d.gaps || []).length > 0 && <Block title="Gap / opportunità vs competitor">{d.gaps.map((g, i) => <div key={i} style={{ fontSize: 13.5, padding: '3px 0' }}>• {g}</div>)}</Block>}
        </div>
      )}
    </div>
  )
}

/* ---------- Confronto competitor on-page ---------- */
function CompetitorPanel() {
  const [urls, setUrls] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [rows, setRows] = useState(null)
  const run = async () => {
    const list = urls.split('\n').map(s => s.trim()).filter(Boolean)
    if (list.length < 2 || loading) { if (list.length < 2) setError('Inserisci almeno 2 URL (la tua + competitor).'); return }
    setLoading(true); setError(null); setRows(null)
    try { const r = await fetch('/api/seo-competitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: list }) }); const j = await r.json(); j.error ? setError(j.error) : setRows(j.rows) }
    catch { setError('Errore') } finally { setLoading(false) }
  }
  const ok = (b) => <span style={{ color: b ? '#30d158' : '#ff375f' }}>{b ? '✓' : '×'}</span>
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') + new URL(u).pathname.replace(/\/$/, '') } catch { return u } }
  const metrics = rows ? [
    ['Score', r => <span style={{ color: scoreCol(r.score), fontWeight: 700 }}>{r.score}</span>],
    ['Title (lung.)', r => r.titleLen], ['Meta desc (lung.)', r => r.descLen], ['Parole', r => r.words],
    ['JSON-LD', r => ok(r.jsonld)], ['Hreflang', r => ok(r.hreflang)], ['OG image', r => ok(r.og)],
    ['Alt %', r => r.altCoverage == null ? '—' : `${r.altCoverage}%`], ['Velocità', r => r.speedMs == null ? '—' : `${(r.speedMs / 1000).toFixed(1)}s`], ['HTTPS', r => ok(r.https)],
  ] : []
  return (
    <div>
      <textarea value={urls} onChange={e => setUrls(e.target.value)} placeholder={'La tua URL + competitor (una per riga)\nhttps://tuosito.com/pagina\nhttps://competitor1.com/pagina'} style={{ ...inputStyle, minHeight: 100, fontFamily: 'inherit' }} />
      <Row><button onClick={run} disabled={loading} style={{ ...btnStyle(loading), marginTop: 12 }}>{loading ? 'Confronto…' : 'Confronta'}</button></Row>
      {error && <Err>{error}</Err>}
      {rows && (
        <div className="glass-card" style={{ padding: 20, marginTop: 20, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead><tr><th style={thStyle}></th>{rows.map((r, i) => <th key={i} style={{ ...thStyle, textAlign: 'left' }}>{r.error ? <span style={{ color: '#ff375f' }}>{host(r.url)} (errore)</span> : host(r.url)}</th>)}</tr></thead>
            <tbody>{metrics.map(([label, fn], mi) => (
              <tr key={mi}><td style={{ ...tdStyle, opacity: 0.6 }}>{label}</td>{rows.map((r, i) => <td key={i} style={tdStyle}>{r.error ? '—' : fn(r)}</td>)}</tr>
            ))}</tbody>
          </table>
        </div>
      )}
    </div>
  )
}

/* ---------- AI Visibility / AEO ---------- */
function AeoPanel() {
  const [brand, setBrand] = useState(''); const [site, setSite] = useState(''); const [prompts, setPrompts] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [d, setD] = useState(null)
  const run = async () => {
    const list = prompts.split('\n').map(s => s.trim()).filter(Boolean)
    if (!brand.trim() || !list.length || loading) { if (!brand.trim() || !list.length) setError('Inserisci brand e almeno un prompt.'); return }
    setLoading(true); setError(null); setD(null)
    try { const r = await fetch('/api/seo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ mode: 'aeo', brand, site, prompts: list }) }); const j = await r.json(); j.error ? setError(j.error) : setD(j) }
    catch { setError('Errore') } finally { setLoading(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 12 }}>Verifica se gli answer engine (ChatGPT/Gemini) citano il tuo brand per certe domande. Stima basata su LLM.</div>
      <Row><input value={brand} onChange={e => setBrand(e.target.value)} placeholder="Nome brand — es. STMN Fitness" style={inputStyle} /><input value={site} onChange={e => setSite(e.target.value)} placeholder="sito (opz.)" style={{ ...inputStyle, flex: 'none', width: 200 }} /></Row>
      <textarea value={prompts} onChange={e => setPrompts(e.target.value)} placeholder={'Prompt da testare (uno per riga)\nMigliori accessori per crossfit\nDove comprare attrezzatura crossfit online'} style={{ ...inputStyle, marginTop: 12, minHeight: 90, fontFamily: 'inherit' }} />
      <Row><button onClick={run} disabled={loading} style={{ ...btnStyle(loading), marginTop: 12 }}>{loading ? 'Verifico…' : 'Verifica visibilità AI'}</button></Row>
      {error && <Err>{error}</Err>}
      {d && (
        <div style={{ marginTop: 20 }}>
          <div className="glass-card" style={{ padding: 24, textAlign: 'center', marginBottom: 16, maxWidth: 220 }}>
            <div style={{ fontSize: 48, fontWeight: 800, color: scoreCol(d.visibilityScore) }}>{d.visibilityScore}</div>
            <div style={{ fontSize: 12, opacity: 0.6 }}>AI Visibility Score</div>
          </div>
          {d.summary && <div className="glass-card" style={{ padding: 18, marginBottom: 16, fontSize: 14 }}>{d.summary}</div>}
          {(d.results || []).map((r, i) => (
            <div key={i} className="glass-card" style={{ padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ color: r.mentioned ? '#30d158' : '#ff375f', fontWeight: 700 }}>{r.mentioned ? `✓ Citato${r.rank && r.rank !== 'n/d' ? ` (#${r.rank})` : ''}` : '× Non citato'}</span>
                <span style={{ fontSize: 14, opacity: 0.9 }}>{r.prompt}</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{r.why}</div>
              {r.competitorsMentioned?.length > 0 && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 4 }}>Citati invece: {r.competitorsMentioned.join(', ')}</div>}
              {r.howToImprove && <div style={{ fontSize: 12.5, marginTop: 6, color: '#64d2ff' }}>→ {r.howToImprove}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

/* ---------- Google Search Console (dati reali) ---------- */
const nf = (n) => Number(n || 0).toLocaleString('it-IT')
const pct = (c) => `${(Number(c || 0) * 100).toFixed(1)}%`

function SetupGSC() {
  return (
    <div className="glass-card" style={{ padding: 24 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 10 }}>Collega Google Search Console</div>
      <div style={{ fontSize: 13.5, opacity: 0.8, lineHeight: 1.7 }}>
        Per mostrare le keyword e le posizioni reali servono 3 step una tantum:
        <ol style={{ margin: '12px 0', paddingLeft: 20 }}>
          <li>Google Cloud (progetto <b>lyftai</b>) → <i>API e servizi</i> → abilita <b>Google Search Console API</b>.</li>
          <li>OAuth Playground → rigenera il refresh token includendo <b>entrambi</b> gli scope:<br />
            <code style={{ fontSize: 12 }}>https://www.googleapis.com/auth/analytics.readonly</code><br />
            <code style={{ fontSize: 12 }}>https://www.googleapis.com/auth/webmasters.readonly</code></li>
          <li>Aggiorna <b>GOOGLE_REFRESH_TOKEN</b> su Vercel (Production) → Redeploy.</li>
        </ol>
        ⚠️ Includi <b>entrambi</b> gli scope, così GA4 (globo) continua a funzionare e si attiva anche GSC.
      </div>
    </div>
  )
}

function GSCPanel() {
  const [state, setState] = useState({ loading: true })
  const [site, setSite] = useState('')
  const [days, setDays] = useState(28)
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/gsc?action=sites'); const j = await r.json()
        setState({ loading: false, configured: !!j.configured, sites: j.sites || [] })
        if (j.sites?.length) setSite(j.sites[0].siteUrl)
      } catch { setState({ loading: false, configured: false }) }
    })()
  }, [])

  useEffect(() => {
    if (!site) return
    let alive = true
    setLoading(true); setError(null); setData(null)
    fetch(`/api/gsc?site=${encodeURIComponent(site)}&days=${days}`).then(r => r.json()).then(j => {
      if (!alive) return
      if (j.error) setError(j.error); else if (!j.totals) setError('Nessun dato nel periodo.'); else setData(j)
    }).catch(() => alive && setError('Errore')).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [site, days])

  if (state.loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>Carico…</div>
  if (!state.configured) return <SetupGSC />
  if (!state.sites?.length) return <div className="glass-card" style={{ padding: 20, fontSize: 13 }}>Nessuna proprietà Search Console accessibile da questo account Google.</div>

  const QTable = ({ title, rows }) => (
    <Block title={title}>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead><tr><th style={thStyle}>Query</th><th style={thStyle}>Click</th><th style={thStyle}>Impr.</th><th style={thStyle}>CTR</th><th style={thStyle}>Pos.</th></tr></thead>
          <tbody>{rows.map((q, i) => (
            <tr key={i}><td style={tdStyle}>{q.key}</td><td style={tdStyle}>{nf(q.clicks)}</td><td style={tdStyle}>{nf(q.impressions)}</td><td style={tdStyle}>{pct(q.ctr)}</td><td style={tdStyle}>{q.position.toFixed(1)}</td></tr>
          ))}</tbody>
        </table>
      </div>
    </Block>
  )

  return (
    <div>
      <Row>
        <select value={site} onChange={e => setSite(e.target.value)} style={{ ...inputStyle, flex: 1 }}>
          {state.sites.map(s => <option key={s.siteUrl} value={s.siteUrl} style={{ background: 'var(--surface)' }}>{s.siteUrl}</option>)}
        </select>
        <select value={days} onChange={e => setDays(+e.target.value)} style={{ ...inputStyle, flex: 'none', width: 150 }}>
          <option value={7}>7 giorni</option><option value={28}>28 giorni</option><option value={90}>90 giorni</option><option value={180}>180 giorni</option>
        </select>
      </Row>

      {loading && <div style={{ opacity: 0.5, fontSize: 13, marginTop: 16 }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> Carico i dati da Search Console…</div>}
      {error && <Err>{error}</Err>}

      {data && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
            <Mini label="Click" value={nf(data.totals.clicks)} />
            <Mini label="Impression" value={nf(data.totals.impressions)} />
            <Mini label="CTR medio" value={pct(data.totals.ctr)} />
            <Mini label="Posizione media" value={data.totals.position.toFixed(1)} />
          </div>

          {data.opportunities.nearFirstPage.length > 0 && (
            <Block title="⚡ Opportunità — quasi in prima pagina (pos. 11–20)">
              {data.opportunities.nearFirstPage.map((q, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 13, padding: '4px 0', gap: 10 }}>
                  <span style={{ flex: 1 }}>{q.key}</span>
                  <span style={{ opacity: 0.6 }}>pos {q.position.toFixed(1)}</span>
                  <span style={{ opacity: 0.6, width: 90, textAlign: 'right' }}>{nf(q.impressions)} impr.</span>
                </div>
              ))}
            </Block>
          )}
          {data.opportunities.lowCtr.length > 0 && (
            <Block title="⚡ Opportunità — alto traffico potenziale, CTR basso (migliora title/meta)">
              {data.opportunities.lowCtr.map((q, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 13, padding: '4px 0', gap: 10 }}>
                  <span style={{ flex: 1 }}>{q.key}</span>
                  <span style={{ opacity: 0.6 }}>CTR {pct(q.ctr)}</span>
                  <span style={{ opacity: 0.6, width: 90, textAlign: 'right' }}>{nf(q.impressions)} impr.</span>
                </div>
              ))}
            </Block>
          )}

          <QTable title="Top query" rows={data.queries.slice(0, 50)} />
          <Block title="Top pagine">
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead><tr><th style={thStyle}>Pagina</th><th style={thStyle}>Click</th><th style={thStyle}>Impr.</th><th style={thStyle}>CTR</th><th style={thStyle}>Pos.</th></tr></thead>
                <tbody>{data.pages.slice(0, 30).map((p, i) => (
                  <tr key={i}><td style={{ ...tdStyle, maxWidth: 360, overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.key}</td><td style={tdStyle}>{nf(p.clicks)}</td><td style={tdStyle}>{nf(p.impressions)}</td><td style={tdStyle}>{pct(p.ctr)}</td><td style={tdStyle}>{p.position.toFixed(1)}</td></tr>
                ))}</tbody>
              </table>
            </div>
          </Block>
        </div>
      )}
    </div>
  )
}

/* ---------- micro-helper condivisi dai pannelli ---------- */
function Row({ children }) { return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div> }
function Err({ children }) { return <div className="glass-card" style={{ padding: 16, color: '#ff375f', marginTop: 16 }}>⚠ {children}</div> }
function Block({ title, children }) { return <div className="glass-card" style={{ padding: 20, marginBottom: 14 }}><div style={{ fontWeight: 700, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>{title}</div>{children}</div> }
function Mini({ label, value, note }) { return <div className="glass-card" style={{ padding: 16, flex: 1, minWidth: 160 }}><div style={{ fontSize: 11, opacity: 0.5, textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 17, fontWeight: 700, textTransform: 'capitalize' }}>{value || '—'}</div>{note && <div style={{ fontSize: 12, opacity: 0.6, marginTop: 4 }}>{note}</div>}</div> }
function Chips({ list }) { return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{(list || []).map((t, i) => <span key={i} style={{ fontSize: 12, padding: '4px 10px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--border)' }}>{t}</span>)}</div> }
const thStyle = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 11, opacity: 0.6, textAlign: 'left', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

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
