'use client'

import { useEffect, useState, useCallback } from 'react'
import Icon from '../ui/Icon'
import CreativeStudioLogo from '../ui/CreativeStudioLogo'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Home "I miei progetti" (a board): griglia di board con copertina,
// crea / rinomina / elimina. Cliccando una board si apre lo Studio.
export default function BoardsHome({ onOpen }) {
  const { t, intlLocale } = useI18n()
  const [boards, setBoards] = useState(null)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [menuId, setMenuId] = useState(null)
  const [prompt, setPrompt] = useState('')

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/studio/boards', { cache: 'no-store' })
      const j = await r.json()
      setBoards(Array.isArray(j.boards) ? j.boards : [])
    } catch { setBoards([]) }
  }, [])
  useEffect(() => { load() }, [load])

  const createBoard = async () => {
    if (creating) return
    const title = window.prompt(t('cs.boardNamePrompt', null, 'Nome del progetto'), '')
    if (title == null) return // annullato
    setCreating(true)
    try {
      const r = await fetch('/api/studio/boards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: (title || '').trim() || t('cs.boardUntitled', null, 'Senza titolo') }) })
      const j = await r.json()
      if (j.board) onOpen(j.board)
    } catch {} finally { setCreating(false) }
  }

  // Crea un progetto dalla barra "Cosa vuoi creare oggi?" e apre la board con il
  // prompt già pronto per generare.
  const createFromPrompt = async () => {
    if (creating) return
    const p = prompt.trim()
    setCreating(true)
    try {
      const title = p ? p.split(/\s+/).slice(0, 5).join(' ') : t('cs.boardUntitled', null, 'Senza titolo')
      const r = await fetch('/api/studio/boards', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title }) })
      const j = await r.json()
      if (j.board) onOpen(j.board, p)
    } catch {} finally { setCreating(false) }
  }

  const rename = async (b) => {
    const title = window.prompt(t('cs.boardRename', null, 'Rinomina progetto'), b.title)
    if (title == null) return
    await fetch('/api/studio/boards', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id, title }) })
    setMenuId(null); load()
  }
  const remove = async (b) => {
    if (!window.confirm(t('cs.boardDeleteConfirm', { title: b.title }, `Eliminare "${b.title}" e tutte le sue immagini?`))) return
    await fetch('/api/studio/boards', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: b.id }) })
    setMenuId(null); load()
  }

  const rel = (iso) => {
    if (!iso) return ''
    const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000))
    const u = [[31536000, 'y'], [2592000, 'mo'], [604800, 'w'], [86400, 'd'], [3600, 'h'], [60, 'm']]
    for (const [sec, label] of u) { const n = Math.floor(s / sec); if (n >= 1) return t('cs.editedAgo', { n, unit: label }, `Modificato ${n}${label} fa`) }
    return t('cs.editedNow', null, 'Modificato ora')
  }

  const list = (boards || []).filter(b => !query.trim() || b.title.toLowerCase().includes(query.trim().toLowerCase()))

  return (
    <div onClick={() => setMenuId(null)} style={{ height: '100dvh', overflowY: 'auto', color: '#fff', fontFamily: 'Barlow' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '28px 28px 60px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 28 }}>
          <CreativeStudioLogo size={26} />
        </div>

        <h1 style={{ textAlign: 'center', fontSize: 30, fontWeight: 900, margin: '28px 0 20px', letterSpacing: '-0.02em' }}>{t('cs.boardsHeadline', null, 'Cosa vuoi creare oggi?')}</h1>

        {/* Barra crea (a tela infinita): scrivi e parte un nuovo progetto */}
        <div style={{ maxWidth: 720, margin: '0 auto 34px', background: 'var(--glass2,rgba(255,255,255,0.05))', border: '1px solid var(--border)', borderRadius: 18, padding: 16 }}>
          <textarea
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); createFromPrompt() } }}
            rows={2}
            placeholder={t('cs.boardsCreatePh', null, 'Descrivi cosa vuoi creare…')}
            style={{ width: '100%', resize: 'none', background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 16, fontFamily: 'Barlow', lineHeight: 1.4, boxSizing: 'border-box' }}
          />
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 8 }}>
            <button onClick={createFromPrompt} disabled={creating} style={{ width: 40, height: 40, borderRadius: '50%', border: 'none', background: creating ? '#3a3a48' : 'linear-gradient(135deg,#7b5bff,#5b8bff)', color: '#fff', cursor: creating ? 'wait' : 'pointer', display: 'grid', placeItems: 'center' }}><Icon name="send" size={16} /></button>
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 15, fontWeight: 800 }}>{t('cs.boardsMine', null, 'I miei progetti')} {boards && <span style={{ color: 'var(--text3,#888)', fontWeight: 700 }}>· {boards.length}</span>}</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--glass2,#14141d)', border: '1px solid var(--border)', borderRadius: 999, padding: '8px 14px', minWidth: 240 }}>
            <Icon name="search" size={14} />
            <input value={query} onChange={e => setQuery(e.target.value)} placeholder={t('cs.boardsSearch', null, 'Cerca progetti…')} style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', color: '#fff', fontSize: 13, fontFamily: 'Barlow' }} />
          </div>
        </div>

        {/* Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 18 }}>
          {/* New project */}
          <button onClick={createBoard} disabled={creating} style={{ aspectRatio: '4/3', borderRadius: 16, border: '1.5px dashed var(--border)', background: 'var(--glass2,rgba(255,255,255,0.03))', color: 'var(--text2,#9aa)', cursor: creating ? 'wait' : 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, fontFamily: 'Barlow' }}>
            <div style={{ width: 46, height: 46, borderRadius: '50%', border: '1.5px solid var(--border)', display: 'grid', placeItems: 'center' }}><Icon name="plus" size={22} /></div>
            <span style={{ fontSize: 13.5, fontWeight: 800 }}>{creating ? t('cs.generating', null, 'Genero…') : t('cs.boardNew', null, 'Nuovo progetto')}</span>
          </button>

          {boards === null && [0, 1, 2].map(i => <div key={i} style={{ aspectRatio: '4/3', borderRadius: 16, background: 'var(--glass2,rgba(255,255,255,0.04))', border: '1px solid var(--border)' }} />)}

          {list.map(b => (
            <div key={b.id} onClick={() => onOpen(b)} style={{ position: 'relative', borderRadius: 16, border: '1px solid var(--border)', background: 'var(--glass2,rgba(255,255,255,0.04))', overflow: 'hidden', cursor: 'pointer' }}>
              {/* cover */}
              <div style={{ aspectRatio: '4/3', display: 'grid', gridTemplateColumns: '1fr 1fr', gridTemplateRows: '1fr 1fr', gap: 2, background: '#0c0c14' }}>
                {[0, 1, 2, 3].map(i => (
                  <div key={i} style={{ background: '#111', overflow: 'hidden' }}>
                    {b.covers[i] && <img src={b.covers[i]} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                  </div>
                ))}
                {b.count === 0 && <div style={{ gridColumn: '1/-1', gridRow: '1/-1', display: 'grid', placeItems: 'center', color: 'var(--text3,#777)', fontSize: 12 }}>{t('cs.boardEmpty', null, 'Vuoto')}</div>}
              </div>
              {/* footer */}
              <div style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{b.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3,#888)' }}>{rel(b.updated_at)}{b.count ? ` · ${b.count}` : ''}</div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); setMenuId(menuId === b.id ? null : b.id) }} style={{ background: 'transparent', border: '1px solid var(--border)', borderRadius: 8, width: 28, height: 28, color: '#fff', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>⋯</button>
              </div>
              {menuId === b.id && (
                <div onClick={e => e.stopPropagation()} className="glass-card-static" style={{ position: 'absolute', right: 10, bottom: 46, borderRadius: 10, border: '1px solid var(--border)', padding: 6, zIndex: 5, boxShadow: '0 10px 30px rgba(0,0,0,0.5)' }}>
                  <button onClick={() => rename(b)} style={menuItem}><Icon name="edit" size={13} /> {t('cs.boardRename', null, 'Rinomina')}</button>
                  <button onClick={() => remove(b)} style={{ ...menuItem, color: '#ff8095' }}><Icon name="trash" size={13} /> {t('cs.boardDelete', null, 'Elimina')}</button>
                </div>
              )}
            </div>
          ))}
        </div>

        {boards && boards.length === 0 && <div style={{ textAlign: 'center', color: 'var(--text2,#9aa)', fontSize: 14, marginTop: 40 }}>{t('cs.boardsEmptyAll', null, 'Nessun progetto ancora. Crea il primo!')}</div>}
      </div>
    </div>
  )
}

const menuItem = { display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '8px 12px', background: 'transparent', border: 'none', borderRadius: 7, color: '#fff', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontFamily: 'Barlow', whiteSpace: 'nowrap' }
