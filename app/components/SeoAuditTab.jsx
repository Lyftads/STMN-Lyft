'use client'

import PeriodoInBarra from './ui/PeriodoInBarra'
import { useStatoTab } from '../../lib/client/statoTab'
import { Fonte } from './ui/FasceTabella'
import { useState, useEffect, useCallback } from 'react'
import { getClientLocale } from '../../lib/i18n/clientLocale'
import Icon from './ui/Icon'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts'
// L'esperto SEO che legge i dati della tab. Nel fork per un solo cliente era
// stato tolto perche' li' l'agente non c'era: qui e' un pezzo del prodotto e
// va rimontato in tutti e sei i punti dove sta (audit + i cinque pannelli).
// Toglierlo non da' errore: la pagina si apre uguale e il bottone sparisce.
import SeoAgent from './SeoAgent'
import { useI18n } from '../../lib/i18n/I18nProvider'
import { num, perc } from '../../lib/client/numeri'

const STATUS = { pass: { color: '#22c55e', icon: '✓' }, warn: { color: '#f59e0b', icon: '!' }, fail: { color: '#ef4444', icon: '×' } }
const GROUPS = ['Essenziali', 'Social/Sharing', 'Strutturati', 'Contenuto', 'Tecnici']
const GROUP_KEYS = { 'Essenziali': 'seo.groupEssentials', 'Social/Sharing': 'seo.groupSocial', 'Strutturati': 'seo.groupStructured', 'Contenuto': 'seo.groupContent', 'Tecnici': 'seo.groupTechnical' }
const PRIO = { alta: '#ef4444', media: '#f59e0b', bassa: '#64d2ff' }
const scoreCol = s => s >= 85 ? '#22c55e' : s >= 70 ? '#64d2ff' : s >= 50 ? '#f59e0b' : '#ef4444'
const fmtDate = d => new Date(d).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })

const giorniDelPeriodo = (v) => v?.since ? Math.max(1, Math.round((Date.now() - new Date(`${v.since}T00:00:00`).getTime()) / 86400000)) : 28

export default function SeoAuditTab() {
  const { t } = useI18n()
  const [view, setView] = useState('gsc')              // gsc | audit | keyword | editor | competitor | aeo | history
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
        body: JSON.stringify({ locale: getClientLocale(), url, targetKeyword: keyword, limit }),
      })
      const data = await r.json()
      if (data.error) setError(data.error)
      else { setRes(data); loadHistory() }
    } catch { setError(t('seo.analysisError', null, 'Errore durante l\'analisi.')) }
    finally { setLoading(false) }
  }

  const loadAudit = async (id) => {
    setView('audit'); setCompare(null); setLoading(true); setError(null)
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
      setCompare({ before, after }); setView('audit'); setRes(null)
    } catch {} finally { setLoading(false) }
  }

  const delAudit = async (id, e) => {
    e.stopPropagation()
    try { await fetch(`/api/seo-audit/history?id=${id}`, { method: 'DELETE' }); loadHistory(); setPicks(p => p.filter(x => x !== id)) } catch {}
  }

  return (
    <div>
      {/* Sub-nav */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <Pill active={view === 'gsc'} onClick={() => setView('gsc')}>Search Console</Pill>
        <Pill active={view === 'audit'} onClick={() => setView('audit')}>Audit</Pill>
        <Pill active={view === 'keyword'} onClick={() => setView('keyword')}>Keyword AI</Pill>
        <Pill active={view === 'editor'} onClick={() => setView('editor')}>{t('seo.navEditor', null, 'Editor contenuti')}</Pill>
        <Pill active={view === 'competitor'} onClick={() => setView('competitor')}>Competitor</Pill>
        <Pill active={view === 'aeo'} onClick={() => setView('aeo')}>AI Visibility</Pill>
        <Pill active={view === 'history'} onClick={() => { setView('history'); loadHistory() }}>{t('seo.navHistory', null, 'Storico')} {history.length ? `(${history.length})` : ''}</Pill>
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
            <Pill small active={mode === 'page'} onClick={() => setMode('page')}>{t('seo.modePage', null, 'Pagina singola')}</Pill>
            <Pill small active={mode === 'site'} onClick={() => setMode('site')}>{t('seo.modeSite', null, 'Intero sito (multipagina)')}</Pill>
          </div>
          <div style={{ display: 'flex', gap: 12, marginBottom: 8, flexWrap: 'wrap' }}>
            <input value={url} onChange={e => setUrl(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
              placeholder={mode === 'site' ? t('seo.phSite', null, 'https://tuosito.com  (scopre le pagine dalla sitemap)') : t('seo.phPage', null, 'https://tuosito.com/pagina')}
              style={inputStyle} />
            {mode === 'site' && (
              <select value={limit} onChange={e => setLimit(+e.target.value)} style={{ ...inputStyle, flex: 'none', width: 130 }}>
                <option value={5}>{t('seo.pagesN', { n: 5 }, '5 pagine')}</option><option value={10}>{t('seo.pagesN', { n: 10 }, '10 pagine')}</option><option value={20}>{t('seo.pagesN', { n: 20 }, '20 pagine')}</option>
              </select>
            )}
            <button onClick={run} disabled={loading || !url.trim()} style={btnStyle(loading)}>
              {loading ? t('seo.analyzing', null, 'Analizzo…') : t('seo.analyze', null, 'Analizza')}
            </button>
          </div>
          <input value={keyword} onChange={e => setKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()}
            placeholder={t('seo.phKeywordTarget', null, 'Keyword target (opzionale) — es. accessori crossfit')} style={{ ...inputStyle, marginBottom: 24 }} />

          {error && <div className="glass-card" style={{ padding: 18, color: '#ef4444', marginBottom: 20 }}><Icon name="warning" size={13} /> {error}</div>}

          {compare && <CompareView compare={compare} />}
          {!compare && res && (
            <>
              <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
                <PdfButton data={res} />
              </div>
              {res.mode === 'site' ? <SiteResult res={res} /> : <PageResult res={res} />}
            </>
          )}
        </>
      )}

      {/* Esperto SEO flottante — sta fuori dal blocco `view === 'audit'` perche'
          deve restare raggiungibile da qualsiasi vista; se c'e' un audit in
          corso lo conosce, altrimenti risponde su SEO in generale. */}
      <SeoAgent audit={res} />

      {view === 'history' && (
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 14 }}>
            <div style={{ fontWeight: 600 }}>{t('seo.savedAudits', null, 'Audit salvati')}</div>
            <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.6 }}>
              {picks.length === 2 ? <button onClick={runCompare} style={{ ...btnStyle(false), padding: '8px 16px' }}>{t('seo.compareBeforeAfter', null, 'Confronta prima/dopo')}</button>
                : t('seo.selectTwo', { n: picks.length }, `Seleziona 2 audit della stessa URL per confrontarli (${picks.length}/2)`)}
            </div>
          </div>
          {history.length === 0 && <div style={{ fontSize: 13, opacity: 0.5 }}>{t('seo.noSavedAudits', null, 'Nessun audit salvato ancora. (Richiede la tabella seo_audits su Supabase — vedi note.)')}</div>}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {history.map(h => (
              <div key={h.id} onClick={() => loadAudit(h.id)} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', borderRadius: 12, cursor: 'pointer',
                background: picks.includes(h.id) ? 'var(--neutro-bg)' : 'var(--glass)', border: '1px solid var(--border)',
              }}>
                <input type="checkbox" checked={picks.includes(h.id)} onChange={() => {}} onClick={e => { e.stopPropagation(); togglePick(h.id) }} />
                <span style={{ width: 40, height: 28, borderRadius: 8, background: scoreCol(h.score) + '22', color: scoreCol(h.score), fontWeight: 600, fontSize: 15, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{h.score}</span>
                <span style={{ fontSize: 10, textTransform: 'uppercase', opacity: 0.5, width: 36 }}>{h.mode === 'site' ? t('seo.siteShort', null, 'sito') : t('seo.pageShort', null, 'pag.')}</span>
                <span style={{ flex: 1, fontSize: 13, wordBreak: 'break-all', opacity: 0.85 }}>{h.url}</span>
                <span style={{ fontSize: 13, opacity: 0.5 }}>{fmtDate(h.created_at)}</span>
                <span onClick={e => delAudit(h.id, e)} style={{ cursor: 'pointer', opacity: 0.4, fontSize: 17 }}>×</span>
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
  const { t } = useI18n()
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
            <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15, opacity: 0.85 }}>{t(GROUP_KEYS[group], null, group)}</div>
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
  const { t } = useI18n()
  return (
    <>
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 640, lineHeight: 1, color: scoreCol(res.avgScore) }}>{res.avgScore}</div>
          <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>{t('seo.avg', null, 'media')} · {res.scoreLabel}</div>
        </div>
        <div className="glass-card" style={{ padding: 24, display: 'flex', alignItems: 'center' }}>
          <div><div style={{ fontSize: 22, fontWeight: 600 }}>{res.pagesAnalyzed}</div><div style={{ fontSize: 13, opacity: 0.6 }}>{t('seo.pagesAnalyzed', null, 'pagine analizzate')}</div></div>
          <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.5, wordBreak: 'break-all' }}>{res.url}</div>
        </div>
      </div>
      <Recommendations recs={res.recommendations} />
      {/* problemi ricorrenti */}
      <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>{t('seo.commonIssues', null, 'Problemi ricorrenti')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {res.commonIssues.map(i => (
            <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: i.fail ? '#ef4444' : '#f59e0b' }} />
              <span style={{ flex: 1 }}>{i.label}</span>
              <span style={{ opacity: 0.6 }}>{i.affected}/{res.pagesAnalyzed} {t('seo.pagesWord', null, 'pagine')}</span>
            </div>
          ))}
        </div>
      </div>
      {/* per pagina */}
      <div className="glass-card" style={{ padding: 24 }}>
        <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>{t('seo.pagesWorst', null, 'Pagine (peggiori in alto)')}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {res.pages.map((p, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 12, fontSize: 13, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ width: 36, height: 24, borderRadius: 8, background: scoreCol(p.score) + '22', color: scoreCol(p.score), fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{p.score}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ wordBreak: 'break-all', opacity: 0.85 }}>{p.url}</div>
                {p.issues.length > 0 && <div style={{ fontSize: 11.5, opacity: 0.5, marginTop: 2 }}>{p.issues.slice(0, 5).join(' · ')}{p.issues.length > 5 ? ` +${p.issues.length - 5}` : ''}</div>}
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  )
}

function CompareView({ compare }) {
  const { t } = useI18n()
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
          <div style={{ fontSize: 22, fontWeight: 640, color: scoreCol(bScore) }}>{bScore}</div>
          <div style={{ fontSize: 11.5, opacity: 0.5 }}>{t('seo.before', null, 'Prima')} · {fmtDate(before.created_at)}</div>
        </div>
        <div style={{ fontSize: 22, opacity: 0.5 }}>→</div>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22, fontWeight: 640, color: scoreCol(aScore) }}>{aScore}</div>
          <div style={{ fontSize: 11.5, opacity: 0.5 }}>{t('seo.after', null, 'Dopo')} · {fmtDate(after.created_at)}</div>
        </div>
        <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
          <div style={{ fontSize: 22, fontWeight: 640, color: delta >= 0 ? '#22c55e' : '#ef4444' }}>{delta >= 0 ? '+' : ''}{delta}</div>
          <div style={{ fontSize: 13, opacity: 0.6, wordBreak: 'break-all', maxWidth: 360 }}>{after.url}</div>
        </div>
      </div>
      <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#22c55e' }}>↑ {t('seo.improved', { n: improved.length }, `Migliorati (${improved.length})`)}</div>
          {improved.length === 0 && <div style={{ fontSize: 13, opacity: 0.4 }}>{t('seo.none', null, 'Nessuno')}</div>}
          {improved.map((c, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0' }}>{c.label} <span style={{ opacity: 0.5 }}>({c.from}→{c.to})</span></div>)}
        </div>
        <div className="glass-card" style={{ padding: 20 }}>
          <div style={{ fontWeight: 600, marginBottom: 12, color: '#ef4444' }}>↓ {t('seo.regressed', { n: regressed.length }, `Peggiorati (${regressed.length})`)}</div>
          {regressed.length === 0 && <div style={{ fontSize: 13, opacity: 0.4 }}>{t('seo.none', null, 'Nessuno')}</div>}
          {regressed.map((c, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0' }}>{c.label} <span style={{ opacity: 0.5 }}>({c.from}→{c.to})</span></div>)}
        </div>
      </div>
    </>
  )
}

/* ---------- download PDF condiviso ---------- */
async function seoDownloadPdf(type, data, setBusy) {
  if (!data) return
  setBusy?.(true)
  try {
    const r = await fetch('/api/seo-audit/pdf', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, data, locale: getClientLocale() }) })
    const ct = r.headers.get('content-type') || ''
    const blob = await r.blob(); const u = URL.createObjectURL(blob)
    if (ct.includes('pdf')) { const a = document.createElement('a'); a.href = u; a.download = `SEO_${type || 'audit'}.pdf`; document.body.appendChild(a); a.click(); a.remove() }
    else window.open(u, '_blank')
    setTimeout(() => URL.revokeObjectURL(u), 15000)
  } catch {} finally { setBusy?.(false) }
}
function PdfButton({ type, data }) {
  const { t } = useI18n()
  const [busy, setBusy] = useState(false)
  return <button onClick={() => seoDownloadPdf(type, data, setBusy)} disabled={busy} style={{ padding: '9px 16px', borderRadius: 12, cursor: busy ? 'wait' : 'pointer', fontSize: 13, fontWeight: 600, background: 'var(--glass)', color: 'var(--text)', border: '1px solid var(--border)' }}>⤓ {busy ? t('seo.generatingPdf', null, 'Genero PDF…') : t('seo.downloadPdf', null, 'Scarica PDF')}</button>
}


/* ---------- Keyword AI (Keyword AI) ---------- */
function KeywordAIPanel() {
  const { t } = useI18n()
  const [kw, setKw] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [d, setD] = useState(null)
  const run = async () => {
    if (!kw.trim() || loading) return
    setLoading(true); setError(null); setD(null)
    try { const r = await fetch('/api/seo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: getClientLocale(), mode: 'keyword', keyword: kw }) }); const j = await r.json(); j.error ? setError(j.error) : setD(j) }
    catch { setError(t('seo.error', null, 'Errore')) } finally { setLoading(false) }
  }
  return (
    <div>
      <Row><input value={kw} onChange={e => setKw(e.target.value)} onKeyDown={e => e.key === 'Enter' && run()} placeholder={t('seo.phKwAnalyze', null, 'Keyword da analizzare — es. accessori crossfit')} style={inputStyle} /><button onClick={run} disabled={loading || !kw.trim()} style={btnStyle(loading)}>{loading ? t('seo.analyzing', null, 'Analizzo…') : t('seo.analyzeKeyword', null, 'Analizza keyword')}</button></Row>
      {error && <Err>{error}</Err>}
      {d && (
        <>
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginTop: 20, marginBottom: 16 }}>
            <Mini label={t('seo.intent', null, 'Intent')} value={d.intent} note={d.intentNote} />
            <Mini label={t('seo.difficulty', null, 'Difficoltà')} value={d.difficulty?.level} note={d.difficulty?.note} />
            <Mini label="AI Overview" value={d.aiOverview?.likely ? t('seo.likely', null, 'Probabile') : t('seo.unlikely', null, 'Improbabile')} note={d.aiOverview?.note} />
          </div>
          {d.volumeHint && <div style={{ fontSize: 13, opacity: 0.7, marginBottom: 16 }}>{t('seo.estVolume', null, 'Volume stimato:')} <strong>{d.volumeHint}</strong></div>}
          {d.summary && <div className="glass-card" style={{ padding: 18, marginBottom: 16, fontSize: 15 }}>{d.summary}</div>}
          <Block title={t('seo.relatedKw', null, 'Keyword correlate')}><Chips list={(d.related || []).map(r => `${r.term}${r.intent ? ` · ${r.intent}` : ''}`)} /></Block>
          <Block title={t('seo.questions', null, 'Domande (People Also Ask)')}>{(d.questions || []).map((q, i) => <div key={i} style={{ fontSize: 13, padding: '4px 0' }}>• {q}</div>)}</Block>
          <Block title={t('seo.contentIdeas', null, 'Idee di contenuto')}>{(d.contentIdeas || []).map((c, i) => <div key={i} style={{ padding: '6px 0', fontSize: 13 }}><strong>{c.title}</strong>{c.angle ? <span style={{ opacity: 0.65 }}> — {c.angle}</span> : null}</div>)}</Block>
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}><PdfButton type="keyword" data={d} /></div>
          {/* Ogni pannello passa all'agente il PROPRIO risultato: cosi' le
              domande suggerite parlano di quello che si ha davanti. */}
          <SeoAgent context={{ type: 'keyword', data: d }} hint={t('seo.hintKeyword', null, 'Esperto SEO — conosce questa analisi keyword.')} suggestions={[t('seo.sugKw1', null, 'Crea un cluster di contenuti da queste keyword'), t('seo.sugKw2', null, 'Scrivi 3 title ottimizzati per la keyword principale'), t('seo.sugKw3', null, 'Quale intent prioritizzo e perché?')]} />
        </>
      )}
    </div>
  )
}

/* ---------- Editor contenuti (brief da competitor) ---------- */
function EditorPanel() {
  const { t } = useI18n()
  const [kw, setKw] = useState(''); const [comp, setComp] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [d, setD] = useState(null)
  const run = async () => {
    if (!kw.trim() || loading) return
    setLoading(true); setError(null); setD(null)
    const competitorUrls = comp.split('\n').map(s => s.trim()).filter(Boolean)
    try { const r = await fetch('/api/seo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: getClientLocale(), mode: 'editor', keyword: kw, competitorUrls }) }); const j = await r.json(); j.error ? setError(j.error) : setD(j) }
    catch { setError(t('seo.error', null, 'Errore')) } finally { setLoading(false) }
  }
  return (
    <div>
      <Row><input value={kw} onChange={e => setKw(e.target.value)} placeholder={t('seo.phEditorKw', null, 'Keyword target del contenuto')} style={inputStyle} /><button onClick={run} disabled={loading || !kw.trim()} style={btnStyle(loading)}>{loading ? t('seo.generating', null, 'Genero…') : t('seo.generateBrief', null, 'Genera brief')}</button></Row>
      <textarea value={comp} onChange={e => setComp(e.target.value)} placeholder={t('seo.phEditorComp', null, 'URL competitor da analizzare (una per riga, opzionale)')} style={{ ...inputStyle, marginTop: 12, minHeight: 80, fontFamily: 'inherit' }} />
      {error && <Err>{error}</Err>}
      {d && (
        <div style={{ marginTop: 20 }}>
          <div style={{ display: 'flex', gap: 24, marginBottom: 16, flexWrap: 'wrap' }}>
            <Mini label={t('seo.searchIntent', null, 'Search intent')} value={d.searchIntent} />
            <Mini label={t('seo.recLength', null, 'Lunghezza consigliata')} value={`${d.recommendedWords || '—'} ${t('seo.wordsWord', null, 'parole')}`} />
          </div>
          {d.title && <div className="glass-card" style={{ padding: 16, marginBottom: 12 }}><div style={{ fontSize: 11.5, opacity: 0.55 }}>TITLE ({d.title.length})</div><div style={{ fontSize: 15, fontWeight: 600 }}>{d.title}</div><div style={{ fontSize: 11.5, opacity: 0.55, marginTop: 8 }}>META ({(d.metaDescription || '').length})</div><div style={{ fontSize: 13 }}>{d.metaDescription}</div></div>}
          <Block title={t('seo.headingStructure', null, 'Struttura heading consigliata')}>{(d.headings || []).map((h, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0', paddingLeft: h.tag === 'H3' ? 20 : 0 }}><span style={{ opacity: 0.45, fontSize: 11.5 }}>{h.tag}</span> {h.text}</div>)}</Block>
          <Block title={t('seo.entities', null, 'Entità / argomenti da coprire')}><Chips list={d.entities || []} /></Block>
          {(d.faq || []).length > 0 && <Block title={t('seo.faqSuggested', null, 'FAQ suggerite')}>{d.faq.map((f, i) => <div key={i} style={{ padding: '6px 0', fontSize: 13 }}><strong>{f.q}</strong><div style={{ opacity: 0.7 }}>{f.a}</div></div>)}</Block>}
          {d.schema && <Block title="Schema (JSON-LD)"><div style={{ fontSize: 13, opacity: 0.8 }}>{d.schema}</div></Block>}
          {(d.gaps || []).length > 0 && <Block title={t('seo.gaps', null, 'Gap / opportunità vs competitor')}>{d.gaps.map((g, i) => <div key={i} style={{ fontSize: 13, padding: '3px 0' }}>• {g}</div>)}</Block>}
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}><PdfButton type="editor" data={d} /></div>
          <SeoAgent context={{ type: 'editor', data: d }} hint={t('seo.hintEditor', null, 'Esperto SEO — conosce questo brief editoriale.')} suggestions={[t('seo.sugEd1', null, 'Espandi questo brief in una bozza di articolo'), t('seo.sugEd2', null, 'Genera lo JSON-LD completo'), t('seo.sugEd3', null, 'Migliora title e meta description')]} />
        </div>
      )}
    </div>
  )
}

/* ---------- Confronto competitor on-page ---------- */
function CompetitorPanel() {
  const { t } = useI18n()
  const [urls, setUrls] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [rows, setRows] = useState(null)
  const run = async () => {
    const list = urls.split('\n').map(s => s.trim()).filter(Boolean)
    if (list.length < 2 || loading) { if (list.length < 2) setError(t('seo.atLeast2', null, 'Inserisci almeno 2 URL (la tua + competitor).')); return }
    setLoading(true); setError(null); setRows(null)
    try { const r = await fetch('/api/seo-competitor', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ urls: list }) }); const j = await r.json(); j.error ? setError(j.error) : setRows(j.rows) }
    catch { setError(t('seo.error', null, 'Errore')) } finally { setLoading(false) }
  }
  const ok = (b) => <span style={{ color: b ? '#22c55e' : '#ef4444' }}>{b ? '✓' : '×'}</span>
  const host = u => { try { return new URL(u).hostname.replace(/^www\./, '') + new URL(u).pathname.replace(/\/$/, '') } catch { return u } }
  const metrics = rows ? [
    ['Score', r => <span style={{ color: scoreCol(r.score), fontWeight: 600 }}>{r.score}</span>],
    [t('seo.metricTitleLen', null, 'Title (lung.)'), r => r.titleLen], [t('seo.metricDescLen', null, 'Meta desc (lung.)'), r => r.descLen], [t('seo.metricWords', null, 'Parole'), r => r.words],
    ['JSON-LD', r => ok(r.jsonld)], ['Hreflang', r => ok(r.hreflang)], ['OG image', r => ok(r.og)],
    ['Alt %', r => r.altCoverage == null ? '—' : `${r.altCoverage}%`], [t('seo.metricSpeed', null, 'Velocità'), r => r.speedMs == null ? '—' : `${num(r.speedMs / 1000, 1)}s`], ['HTTPS', r => ok(r.https)],
  ] : []
  return (
    <div>
      <textarea value={urls} onChange={e => setUrls(e.target.value)} placeholder={t('seo.phCompUrls', null, 'La tua URL + competitor (una per riga)\nhttps://tuosito.com/pagina\nhttps://competitor1.com/pagina')} style={{ ...inputStyle, minHeight: 100, fontFamily: 'inherit' }} />
      <Row><button onClick={run} disabled={loading} style={{ ...btnStyle(loading), marginTop: 12 }}>{loading ? t('seo.comparing', null, 'Confronto…') : t('seo.compare', null, 'Confronta')}</button></Row>
      {error && <Err>{error}</Err>}
      {rows && (
        <>
          <Block title={t('seo.scoreCompare', null, 'Score a confronto')}>
            <div style={{ width: '100%', height: 170 }}>
              <ResponsiveContainer>
                <BarChart data={rows.filter(r => !r.error).map(r => ({ name: host(r.url).slice(0, 20), score: r.score }))} margin={{ top: 6, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="name" tick={{ fill: 'var(--text3)', fontSize: 10 }} />
                  <YAxis domain={[0, 100]} tick={{ fill: 'var(--text3)', fontSize: 10 }} width={34} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }} />
                  <Bar dataKey="score" radius={[4, 4, 0, 0]}>{rows.filter(r => !r.error).map((r, i) => <Cell key={i} fill={scoreCol(r.score)} />)}</Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Block>
          <div className="glass-card" style={{ padding: 20, marginTop: 20, overflowX: 'auto' }}>
            <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead><tr><th style={thStyle}></th>{rows.map((r, i) => <th key={i} style={{ ...thStyle, textAlign: 'left' }}>{r.error ? <span style={{ color: '#ef4444' }}>{host(r.url)} {t('seo.errorParen', null, '(errore)')}</span> : host(r.url)}</th>)}</tr></thead>
              <tbody>{metrics.map(([label, fn], mi) => (
                <tr key={mi}><td style={{ ...tdStyle, opacity: 0.6 }}>{label}</td>{rows.map((r, i) => <td key={i} style={tdStyle}>{r.error ? '—' : fn(r)}</td>)}</tr>
              ))}</tbody>
            </table>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '8px 0 4px' }}><PdfButton type="competitor" data={{ rows }} /></div>
          <SeoAgent context={{ type: 'competitor', data: { rows } }} hint={t('seo.hintCompetitor', null, 'Esperto SEO — conosce questo confronto con i competitor.')} suggestions={[t('seo.sugComp1', null, 'Come supero il competitor migliore?'), t('seo.sugComp2', null, 'Quali gap colmo per primi?'), t('seo.sugComp3', null, 'Piano on-page per batterli in SERP')]} />
        </>
      )}
    </div>
  )
}

/* ---------- AI Visibility / AEO ---------- */
function AeoPanel() {
  const { t } = useI18n()
  const [brand, setBrand] = useState(''); const [site, setSite] = useState(''); const [prompts, setPrompts] = useState(''); const [loading, setLoading] = useState(false); const [error, setError] = useState(null); const [d, setD] = useState(null)
  const run = async () => {
    const list = prompts.split('\n').map(s => s.trim()).filter(Boolean)
    if (!brand.trim() || !list.length || loading) { if (!brand.trim() || !list.length) setError(t('seo.brandPromptReq', null, 'Inserisci brand e almeno un prompt.')); return }
    setLoading(true); setError(null); setD(null)
    try { const r = await fetch('/api/seo-ai', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locale: getClientLocale(), mode: 'aeo', brand, site, prompts: list }) }); const j = await r.json(); j.error ? setError(j.error) : setD(j) }
    catch { setError(t('seo.error', null, 'Errore')) } finally { setLoading(false) }
  }
  return (
    <div>
      <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 12 }}>{t('seo.aeoIntro', null, 'Verifica se gli answer engine (ChatGPT/Gemini) citano il tuo brand per certe domande. Stima basata su LLM.')}</div>
      <Row><input value={brand} onChange={e => setBrand(e.target.value)} placeholder={t('seo.phBrand', null, 'Nome brand — es. Acme Store')} style={inputStyle} /><input value={site} onChange={e => setSite(e.target.value)} placeholder={t('seo.phSiteOpt', null, 'sito (opz.)')} style={{ ...inputStyle, flex: 'none', width: 200 }} /></Row>
      <textarea value={prompts} onChange={e => setPrompts(e.target.value)} placeholder={t('seo.phPrompts', null, 'Prompt da testare (uno per riga)\nMigliori accessori per crossfit\nDove comprare attrezzatura crossfit online')} style={{ ...inputStyle, marginTop: 12, minHeight: 90, fontFamily: 'inherit' }} />
      <Row><button onClick={run} disabled={loading} style={{ ...btnStyle(loading), marginTop: 12 }}>{loading ? t('seo.verifying', null, 'Verifico…') : t('seo.verifyAi', null, 'Verifica visibilità AI')}</button></Row>
      {error && <Err>{error}</Err>}
      {d && (
        <div style={{ marginTop: 20 }}>
          <div className="glass-card" style={{ padding: 24, textAlign: 'center', marginBottom: 16, maxWidth: 220 }}>
            <div style={{ fontSize: 22, fontWeight: 640, color: scoreCol(d.visibilityScore) }}>{d.visibilityScore}</div>
            <div style={{ fontSize: 13, opacity: 0.6 }}>AI Visibility Score</div>
          </div>
          {d.summary && <div className="glass-card" style={{ padding: 18, marginBottom: 16, fontSize: 15 }}>{d.summary}</div>}
          {(d.results || []).map((r, i) => (
            <div key={i} className="glass-card" style={{ padding: 16, marginBottom: 10 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                <span style={{ color: r.mentioned ? '#22c55e' : '#ef4444', fontWeight: 600 }}>{r.mentioned ? `${t('seo.cited', null, 'Citato')}${r.rank && r.rank !== 'n/d' ? ` (#${r.rank})` : ''}` : `× ${t('seo.notCited', null, 'Non citato')}`}</span>
                <span style={{ fontSize: 15, opacity: 0.9 }}>{r.prompt}</span>
              </div>
              <div style={{ fontSize: 13, opacity: 0.7 }}>{r.why}</div>
              {r.competitorsMentioned?.length > 0 && <div style={{ fontSize: 13, opacity: 0.55, marginTop: 4 }}>{t('seo.citedInstead', null, 'Citati invece:')} {r.competitorsMentioned.join(', ')}</div>}
              {r.howToImprove && <div style={{ fontSize: 13, marginTop: 6, color: 'var(--text)' }}>→ {r.howToImprove}</div>}
            </div>
          ))}
          <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '4px 0' }}><PdfButton type="aeo" data={d} /></div>
          <SeoAgent context={{ type: 'aeo', data: d }} hint={t('seo.hintAeo', null, 'Esperto SEO — conosce questo report di AI Visibility.')} suggestions={[t('seo.sugAeo1', null, 'Come mi faccio citare da ChatGPT per questi prompt?'), t('seo.sugAeo2', null, 'Strategia per migliorare la AI visibility'), t('seo.sugAeo3', null, 'Che contenuti creo per gli answer engine?')]} />
        </div>
      )}
    </div>
  )
}

/* ---------- Google Search Console (dati reali) ---------- */
const nf = (n) => num(n || 0, 0)
// toFixed scrive all'inglese ("1.8%"): in questa tab erano 136 numeri col punto
// e nemmeno uno con la virgola.
const pct = (c) => perc(Number(c || 0) * 100, 1)

function SetupGSC() {
  const { t } = useI18n()
  return (
    <div className="glass-card" style={{ padding: 28, textAlign: 'center' }}>
      <div style={{ fontWeight: 640, fontSize: 15, marginBottom: 8 }}>{t('seo.gscSetupTitle', null, 'Collega Google Search Console')}</div>
      <div style={{ fontSize: 13, opacity: 0.8, lineHeight: 1.6, maxWidth: 540, margin: '0 auto 18px' }}>
        {t('seo.gscConnectIntro', null, 'Un solo collegamento Google abilita Search Console, GA4 e Google Ads. Clicca qui sotto e autorizza l’accesso in sola lettura.')}
      </div>
      <button onClick={() => { window.location.href = '/api/google/auth/start' }} style={{ padding: '11px 24px', fontWeight: 640, fontSize: 15, borderRadius: 12, border: 'none', background: '#2997ff', color: '#fff', cursor: 'pointer' }}>
        {t('seo.gscConnectBtn', null, 'Collega Google')}
      </button>
      <div style={{ fontSize: 13, opacity: 0.6, marginTop: 14, lineHeight: 1.5, maxWidth: 540, marginInline: 'auto' }}>
        {t('seo.gscReconnectNote', null, 'Hai già collegato Google in passato? Clicca comunque: serve riautorizzare una volta per attivare Search Console.')}
      </div>
    </div>
  )
}

function Delta({ v, suffix = '%', invert = false }) {
  if (v == null) return null
  const good = invert ? v < 0 : v > 0
  const col = v === 0 ? 'var(--text3)' : good ? '#22c55e' : '#ef4444'
  return <span style={{ fontSize: 11.5, fontWeight: 600, color: col, marginLeft: 6 }}>{v > 0 ? '▲' : v < 0 ? '▼' : '•'} {num(Math.abs(v), 1)}{suffix}</span>
}
function DimTable({ rows, label, fmtKey }) {
  const { t } = useI18n()
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="tab-lyft" style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
        <thead><tr><th style={thStyle}><Fonte loghi={['google']} />{label}</th><th style={thStyle}>{t('seo.thClicks', null, 'Click')}</th><th style={thStyle}>{t('seo.thImpr', null, 'Impr.')}</th><th style={thStyle}>CTR</th><th style={thStyle}>{t('seo.thPos', null, 'Pos.')}</th></tr></thead>
        <tbody>{rows.map((q, i) => (
          <tr key={i}><td style={{ ...tdStyle, maxWidth: 380, overflow: 'hidden', textOverflow: 'ellipsis' }}>{fmtKey ? fmtKey(q.key) : q.key}</td><td style={tdStyle}>{nf(q.clicks)}</td><td style={tdStyle}>{nf(q.impressions)}</td><td style={tdStyle}>{pct(q.ctr)}</td><td style={tdStyle}>{num(q.position, 1)}</td></tr>
        ))}</tbody>
      </table>
    </div>
  )
}

function GSCPanel() {
  const { t } = useI18n()
  const [state, setState] = useState({ loading: true })
  const [site, setSite] = useState('')
  // Stesso selettore del periodo di tutte le tab, nella barra in alto. Search
  // Console ragiona a giorni all'indietro da oggi: il periodo scelto diventa quel numero.
  const [tfSeo, setTfSeo] = useStatoTab('seo.tf', { preset: 'last_28d' })
  const [days, setDays] = useState(() => (tfSeo?.since ? giorniDelPeriodo(tfSeo) : 28))
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [dim, setDim] = useState('query')

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch('/api/gsc?action=sites'); const j = await r.json()
        setState({ loading: false, configured: !!j.configured, sites: j.sites || [] })
        // Pre-seleziona il sito salvato dal cliente (companies.gsc_site_url),
        // altrimenti il primo verificato.
        if (j.sites?.length) setSite(j.saved || j.sites[0].siteUrl)
      } catch { setState({ loading: false, configured: false }) }
    })()
  }, [])

  useEffect(() => {
    if (!site) return
    let alive = true
    setLoading(true); setError(null); setData(null)
    fetch(`/api/gsc?site=${encodeURIComponent(site)}&days=${days}`).then(r => r.json()).then(j => {
      if (!alive) return
      if (j.error) setError(j.error); else if (!j.totals) setError(t('seo.noDataPeriod', null, 'Nessun dato nel periodo.')); else setData(j)
    }).catch(() => alive && setError(t('seo.error', null, 'Errore'))).finally(() => alive && setLoading(false))
    return () => { alive = false }
  }, [site, days])

  if (state.loading) return <div style={{ opacity: 0.5, fontSize: 13 }}>{t('seo.loading', null, 'Carico…')}</div>
  if (!state.configured) return <SetupGSC />
  if (!state.sites?.length) return <div className="glass-card" style={{ padding: 20, fontSize: 13 }}>{t('seo.noGscProperty', null, 'Nessuna proprietà Search Console accessibile da questo account Google.')}</div>

  const fmtDay = (d) => d ? d.slice(5).replace('-', '/') : ''
  const dims = [['query', 'Query'], ['page', t('seo.dimPages', null, 'Pagine')], ['country', t('seo.dimCountries', null, 'Paesi')], ['device', t('seo.dimDevices', null, 'Dispositivi')], ['appearance', t('seo.dimAppearance', null, 'Aspetto ricerca')]]
  const dimRows = data ? ({ query: data.queries, page: data.pages, country: data.countries, device: data.devices, appearance: data.appearance }[dim] || []) : []
  const dimLabel = { query: 'Query', page: t('seo.dimPage', null, 'Pagina'), country: t('seo.dimCountry', null, 'Paese'), device: t('seo.dimDevice', null, 'Dispositivo'), appearance: t('seo.dimAppearanceShort', null, 'Aspetto') }[dim]
  const fmtKey = dim === 'country' ? (k => (k || '').toUpperCase()) : dim === 'device' ? (k => ({ DESKTOP: 'Desktop', MOBILE: 'Mobile', TABLET: 'Tablet' }[k] || k)) : null

  return (
    <div>
      <Row>
        <select value={site} onChange={e => { const s = e.target.value; setSite(s); fetch('/api/integrations/gsc-site', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ site: s }) }).catch(() => {}) }} style={{ ...inputStyle, flex: 1 }}>
          {state.sites.map(s => <option key={s.siteUrl} value={s.siteUrl} style={{ background: 'var(--surface)' }}>{s.siteUrl}</option>)}
        </select>
        <PeriodoInBarra value={tfSeo} onChange={(v) => { setTfSeo(v); setDays(giorniDelPeriodo(v)) }} disabled={loading} />
      </Row>

      {loading && <div style={{ opacity: 0.5, fontSize: 13, marginTop: 16 }}><span style={{ display: "inline-flex", animation: "spin 1s linear infinite" }}><Icon name="refresh" size={13} /></span> {t('seo.loadingGsc', null, 'Carico i dati da Search Console…')}</div>}
      {error && <Err>{error}</Err>}

      {data && (
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <PdfButton type="gsc" data={data} />
          </div>
          {/* KPI con delta vs periodo precedente */}
          <div className="m-grid2" style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 16, marginBottom: 16 }}>
            <div className="glass-card" style={{ padding: 16 }}><div style={{ fontSize: 11.5, opacity: 0.5, textTransform: 'uppercase' }}>{t('seo.kpiClicks', null, 'Click')}</div><div style={{ fontSize: 22, fontWeight: 600 }}>{nf(data.totals.clicks)}<Delta v={data.deltas.clicks} /></div></div>
            <div className="glass-card" style={{ padding: 16 }}><div style={{ fontSize: 11.5, opacity: 0.5, textTransform: 'uppercase' }}>{t('seo.kpiImpressions', null, 'Impression')}</div><div style={{ fontSize: 22, fontWeight: 600 }}>{nf(data.totals.impressions)}<Delta v={data.deltas.impressions} /></div></div>
            <div className="glass-card" style={{ padding: 16 }}><div style={{ fontSize: 11.5, opacity: 0.5, textTransform: 'uppercase' }}>{t('seo.kpiCtr', null, 'CTR medio')}</div><div style={{ fontSize: 22, fontWeight: 600 }}>{pct(data.totals.ctr)}<Delta v={data.deltas.ctr} suffix="pp" /></div></div>
            <div className="glass-card" style={{ padding: 16 }}><div style={{ fontSize: 11.5, opacity: 0.5, textTransform: 'uppercase' }}>{t('seo.kpiPosition', null, 'Posizione media')}</div><div style={{ fontSize: 22, fontWeight: 600 }}>{num(data.totals.position, 1)}<Delta v={data.deltas.position} suffix="" invert /></div></div>
          </div>

          {/* Grafico temporale */}
          <Block title={t('seo.perfOverTime', null, 'Rendimento nel tempo')}>
            <div style={{ width: '100%', height: 260 }}>
              <ResponsiveContainer>
                <LineChart data={data.series} margin={{ top: 6, right: 8, left: -8, bottom: 0 }}>
                  <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={fmtDay} tick={{ fill: 'var(--text3)', fontSize: 10 }} minTickGap={28} />
                  <YAxis yAxisId="l" tick={{ fill: 'var(--text3)', fontSize: 10 }} width={42} />
                  <YAxis yAxisId="r" orientation="right" tick={{ fill: 'var(--text3)', fontSize: 10 }} width={42} />
                  <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }} labelFormatter={fmtDay} />
                  <Line yAxisId="l" type="monotone" dataKey="clicks" name={t('seo.thClicks', null, 'Click')} stroke="#2997ff" strokeWidth={2} dot={false} />
                  <Line yAxisId="r" type="monotone" dataKey="impressions" name={t('seo.thImpr', null, 'Impr.')} stroke="#bf5af2" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Block>

          {/* Brand vs non-brand + Paesi (mini grafici) */}
          <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
            <Block title={t('seo.brandedTraffic', null, 'Traffico correlato al brand')}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 8, fontSize: 13 }}>
                <span style={{ flex: 1 }}>{t('seo.withBrand', null, 'Con brand')}</span><span style={{ fontWeight: 600 }}>{data.branded.brandedPct}%</span>
              </div>
              <div style={{ height: 8, borderRadius: 6, background: 'var(--glass2)', marginBottom: 12 }}><div style={{ height: '100%', borderRadius: 6, width: `${data.branded.brandedPct}%`, background: 'linear-gradient(90deg,#2997ff,#64d2ff)' }} /></div>
              <div style={{ fontSize: 11.5, opacity: 0.5 }}>{nf(data.branded.brandedClicks)} {t('seo.clickBrand', null, 'click brand')} · {nf(data.branded.nonBrandedClicks)} {t('seo.nonBrand', null, 'non-brand')} · token: {data.branded.tokens.join(', ')}</div>
            </Block>
            <Block title={t('seo.topCountries', null, 'Paesi principali (click)')}>
              <div style={{ width: '100%', height: 130 }}>
                <ResponsiveContainer>
                  <BarChart data={data.countries.slice(0, 6).map(c => ({ name: (c.key || '').toUpperCase(), clicks: c.clicks }))} layout="vertical" margin={{ left: 6, right: 8, top: 0, bottom: 0 }}>
                    <XAxis type="number" hide /><YAxis type="category" dataKey="name" width={42} tick={{ fill: 'var(--text3)', fontSize: 11.5 }} />
                    <Tooltip contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 12, padding: '8px 12px', fontSize: 13, color: 'var(--text)', boxShadow: '0 8px 24px rgba(0,0,0,.14)' }} />
                    <Bar dataKey="clicks" radius={[0, 4, 4, 0]} fill="#22c55e" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Block>
          </div>

          {/* Pagine in crescita / calo */}
          {(data.pageMovers.up.length > 0 || data.pageMovers.down.length > 0) && (
            <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 14 }}>
              <Block title={t('seo.pagesUp', null, '↑ Pagine in crescita (click vs periodo prec.)')}>
                {data.pageMovers.up.length === 0 && <div style={{ fontSize: 13, opacity: 0.4 }}>—</div>}
                {data.pageMovers.up.map((p, i) => <div key={i} style={{ display: 'flex', fontSize: 13, padding: '3px 0', gap: 8 }}><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.key}</span><span style={{ color: '#22c55e', fontWeight: 600 }}>+{nf(p.delta)}</span></div>)}
              </Block>
              <Block title={t('seo.pagesDown', null, '↓ Pagine in calo')}>
                {data.pageMovers.down.length === 0 && <div style={{ fontSize: 13, opacity: 0.4 }}>—</div>}
                {data.pageMovers.down.map((p, i) => <div key={i} style={{ display: 'flex', fontSize: 13, padding: '3px 0', gap: 8 }}><span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.key}</span><span style={{ color: '#ef4444', fontWeight: 600 }}>{nf(p.delta)}</span></div>)}
              </Block>
            </div>
          )}

          {/* Opportunità */}
          {data.opportunities.nearFirstPage.length > 0 && (
            <Block title={t('seo.oppNearFirst', null, 'Opportunità — quasi in prima pagina (pos. 11–20)')}>
              {data.opportunities.nearFirstPage.map((q, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 13, padding: '4px 0', gap: 10 }}><span style={{ flex: 1 }}>{q.key}</span><span style={{ opacity: 0.6 }}>pos {num(q.position, 1)}</span><span style={{ opacity: 0.6, width: 90, textAlign: 'right' }}>{nf(q.impressions)} impr.</span></div>
              ))}
            </Block>
          )}
          {data.opportunities.lowCtr.length > 0 && (
            <Block title={t('seo.oppLowCtr', null, 'Opportunità — alto traffico, CTR basso (migliora title/meta)')}>
              {data.opportunities.lowCtr.map((q, i) => (
                <div key={i} style={{ display: 'flex', fontSize: 13, padding: '4px 0', gap: 10 }}><span style={{ flex: 1 }}>{q.key}</span><span style={{ opacity: 0.6 }}>CTR {pct(q.ctr)}</span><span style={{ opacity: 0.6, width: 90, textAlign: 'right' }}>{nf(q.impressions)} impr.</span></div>
              ))}
            </Block>
          )}

          {/* Tabella per dimensione — position/zIndex: senza, l'ombra delle
              glass-card sopra/sotto viene dipinta SOPRA i pill (sembrano coperti
              da un overlay nero) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8, marginBottom: 30, position: 'relative', zIndex: 2 }}>
            {dims.map(([id, lbl]) => <Pill key={id} small active={dim === id} onClick={() => setDim(id)}>{lbl}</Pill>)}
          </div>
          <Block title={t('seo.detailBy', { dim: dimLabel.toLowerCase() }, `Dettaglio per ${dimLabel.toLowerCase()}`)}>
            {dimRows.length === 0 ? <div style={{ fontSize: 13, opacity: 0.4 }}>{t('seo.noDataDim', null, 'Nessun dato per questa dimensione.')}</div> : <DimTable rows={dimRows.slice(0, 50)} label={dimLabel} fmtKey={fmtKey} />}
          </Block>

          <SeoAgent context={{ type: 'gsc', data }} hint={t('seo.hintGsc', null, 'Esperto SEO — conosce i dati reali di Search Console qui sopra.')} suggestions={[t('seo.sugGsc1', null, 'Su quali query lavoro per prime?'), t('seo.sugGsc2', null, 'Come alzo il CTR delle query con CTR basso?'), t('seo.sugGsc3', null, 'Quali pagine ottimizzo per salire di posizione?')]} />
        </div>
      )}
    </div>
  )
}

/* ---------- micro-helper condivisi dai pannelli ---------- */
function Row({ children }) { return <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{children}</div> }
function Err({ children }) { return <div className="glass-card" style={{ padding: 16, color: '#ef4444', marginTop: 16 }}><Icon name="warning" size={13} /> {children}</div> }
function Block({ title, children }) { return <div className="glass-card" style={{ padding: 20, marginBottom: 14 }}><div style={{ fontWeight: 600, fontSize: 13, marginBottom: 10, opacity: 0.85 }}>{title}</div>{children}</div> }
function Mini({ label, value, note }) { return <div className="glass-card" style={{ padding: 16, flex: 1, minWidth: 160 }}><div style={{ fontSize: 11.5, opacity: 0.5, textTransform: 'uppercase' }}>{label}</div><div style={{ fontSize: 15, fontWeight: 600, textTransform: 'capitalize' }}>{value || '—'}</div>{note && <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>{note}</div>}</div> }
function Chips({ list }) { return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>{(list || []).map((t, i) => <span key={i} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--border)' }}>{t}</span>)}</div> }
const thStyle = { padding: '6px 10px', borderBottom: '1px solid var(--border)', fontSize: 11.5, opacity: 0.6, textAlign: 'left', whiteSpace: 'nowrap' }
const tdStyle = { padding: '6px 10px', borderBottom: '1px solid var(--border)', whiteSpace: 'nowrap' }

/* ---------- pezzi riusabili ---------- */
function ScoreHeader({ score, label, summary, url, meta }) {
  const { t } = useI18n()
  return (
    <div className="m-stack" style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: 20, marginBottom: 24 }}>
      <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
        <div style={{ fontSize: 22, fontWeight: 640, lineHeight: 1, color: scoreCol(score) }}>{score}</div>
        <div style={{ fontSize: 13, opacity: 0.6, marginTop: 4 }}>/ 100 · {label}</div>
      </div>
      <div className="glass-card" style={{ padding: 24, display: 'flex', alignItems: 'center', gap: 28 }}>
        <Sum n={summary.pass} label={t('seo.sumOk', null, 'Ok')} color="#22c55e" />
        <Sum n={summary.warn} label={t('seo.sumWarn', null, 'Da migliorare')} color="#f59e0b" />
        <Sum n={summary.fail} label={t('seo.sumFail', null, 'Critici')} color="#ef4444" />
        <div style={{ marginLeft: 'auto', fontSize: 13, opacity: 0.5, textAlign: 'right' }}>
          <div style={{ wordBreak: 'break-all' }}>{url}</div>
          {meta && <div>{meta.words} {t('seo.wordsWord', null, 'parole')} · {num(meta.loadMs / 1000, 1)}s</div>}
        </div>
      </div>
    </div>
  )
}
function KeywordPanel({ kw }) {
  const { t } = useI18n()
  const Chips = ({ list }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {list.map((k, i) => (
        <span key={i} style={{ fontSize: 13, padding: '4px 10px', borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--border)' }}>
          {k.term} <span style={{ opacity: 0.5 }}>{k.count}× · {k.density}%</span>
        </span>
      ))}
    </div>
  )
  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 16 }}>
      <div style={{ fontWeight: 600, marginBottom: 14, fontSize: 15 }}>{t('seo.kwAnalysis', null, 'Analisi keyword')}</div>
      {kw.target && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 12, background: 'rgba(41,151,255,0.1)', fontSize: 13 }}>
          {t('seo.target', null, 'Target')} <strong>"{kw.target.keyword}"</strong>: {kw.target.count} {t('seo.occurrences', null, 'occorrenze')} · {t('seo.density', null, 'densità')} <strong>{kw.target.density}%</strong>
          <span style={{ opacity: 0.6 }}> {t('seo.idealDensity', null, '(ideale 0,5–3,5%)')}</span>
        </div>
      )}
      <div style={{ fontSize: 13, opacity: 0.55, marginBottom: 6 }}>{t('seo.topWords', null, 'Parole più frequenti')}</div>
      <Chips list={kw.unigrams} />
      <div style={{ fontSize: 13, opacity: 0.55, margin: '14px 0 6px' }}>{t('seo.phrases2', null, 'Frasi (2 parole)')}</div>
      <Chips list={kw.bigrams} />
      {kw.trigrams?.length > 0 && <><div style={{ fontSize: 13, opacity: 0.55, margin: '14px 0 6px' }}>{t('seo.phrases3', null, 'Frasi (3 parole)')}</div><Chips list={kw.trigrams} /></>}
    </div>
  )
}
function Recommendations({ recs }) {
  const { t } = useI18n()
  if (!recs?.length) return null
  return (
    <div className="glass-card" style={{ padding: 24, marginBottom: 24 }}>
      <div style={{ fontWeight: 600, marginBottom: 16, fontSize: 15 }}>{t('seo.recActions', null, 'Azioni consigliate (AI)')}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {recs.map((r, i) => (
          <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.5, padding: '3px 8px', borderRadius: 8, color: PRIO[r.priority] || '#64d2ff', border: `1px solid ${PRIO[r.priority] || '#64d2ff'}`, flexShrink: 0, marginTop: 2 }}>{r.priority}</span>
            <div><div style={{ fontWeight: 600, fontSize: 15 }}>{r.title}</div><div style={{ fontSize: 13, opacity: 0.7 }}>{r.action}</div></div>
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
      <span style={{ width: 20, height: 20, borderRadius: '50%', flexShrink: 0, background: s.color + '22', color: s.color, fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>{s.icon}</span>
      <div style={{ flex: 1 }}>
        <span style={{ fontSize: 15, fontWeight: 500 }}>{c.label}</span>
        <span style={{ fontSize: 13, opacity: 0.6, marginLeft: 8 }}>{c.detail}</span>
      </div>
    </div>
  )
}
function Sum({ n, label, color }) {
  return <div style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 600, color }}>{n}</div><div style={{ fontSize: 13, opacity: 0.6 }}>{label}</div></div>
}
function Pill({ active, onClick, children, small }) {
  return (
    <button onClick={onClick} style={{
      padding: small ? '7px 14px' : '9px 18px', borderRadius: 12, cursor: 'pointer', fontSize: 13, fontWeight: 600,
      background: active ? 'var(--accent)' : 'var(--glass)', color: active ? 'var(--text)' : 'var(--text)',
      border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
    }}>{children}</button>
  )
}

const inputStyle = { flex: 1, minWidth: 240, padding: '14px 16px', borderRadius: 12, background: 'var(--glass)', border: '1px solid var(--border)', color: 'var(--text)', fontSize: 15, outline: 'none' }
const btnStyle = (loading) => ({ padding: '14px 28px', borderRadius: 12, border: 'none', cursor: loading ? 'wait' : 'pointer', background: loading ? 'rgba(41,151,255,0.4)' : 'var(--accent)', color: 'var(--text)', fontWeight: 600, fontSize: 15 })
