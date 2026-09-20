'use client'

import { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import Icon from './ui/Icon'
import CreativeCanvas from './CreativeCanvas'
import { useI18n } from '../../lib/i18n/I18nProvider'

// ============================================================================
//  Creatività — l'idea e le sue tre declinazioni.
//
//  Una creatività non è un file: è la stessa idea in tre formati (quadrato
//  1080×1080, verticale 1080×1920, orizzontale 1920×1080). Lo stato sta
//  sull'idea, non sul ritaglio: si approva o si boccia la creatività.
//
//  Si organizzano per INIZIATIVA (progetto o promo), non per prodotto: un
//  prodotto compare in dieci promo, e la domanda che ci si fa davvero è
//  "quali creatività ho per la promo di settembre".
//
//  Linguaggio visivo del Motore Creativo: nero pieno, vetri con la barra
//  d'accento DIETRO al contenuto, occhielli condensati. Disciplina del colore:
//  verde/ambra/rosso decidono, azzurro solo per l'interazione, il resto neutro.
//  "Utilizzata" non è un verdetto: resta neutra chiara.
// ============================================================================

const FORMATS = [
  { id: '1:1',  w: 1080, h: 1080, key: 'cl.fmt.square',     it: 'Quadrato' },
  { id: '9:16', w: 1080, h: 1920, key: 'cl.fmt.vertical',   it: 'Verticale' },
  { id: '16:9', w: 1920, h: 1080, key: 'cl.fmt.horizontal', it: 'Orizzontale' },
]
const STATUSES = ['da_rivisionare', 'accettata', 'bocciata', 'utilizzata']
const STATUS_COLOR = {
  da_rivisionare: '#ffd60a',   // ambra: aspetta una decisione
  accettata:      '#22c55e',   // verde: decisa
  bocciata:       '#ef4444',   // rosso: decisa
  utilizzata:     '#e9e9e9',   // neutro chiaro: non è un verdetto, è uno stato d'uso
}
const ACCENT = '#2997ff'
const MAX_MB = 50

// Misure della tela: una scheda larga abbastanza da tenere i tre formati
// affiancati, e tre schede per riga. Le righe crescono verso il basso, la
// tela non finisce mai.
const CARD_W = 640
const BOARD_W = CARD_W * 3 + 18 * 2

const EYEBROW = {
  fontFamily: "'Barlow Condensed','Inter',system-ui,sans-serif",
  fontWeight: 600, letterSpacing: '.14em', textTransform: 'uppercase',
}
const GLASS = {
  position: 'relative', isolation: 'isolate', overflow: 'hidden',
  background: 'rgba(255,255,255,.02)', backdropFilter: 'none',
  border: '1px solid rgba(255,255,255,.06)', borderTopColor: 'rgba(255,255,255,.10)',
  boxShadow: '0 12px 30px rgba(0,0,0,.55), inset 0 1px 0 rgba(255,255,255,.05)',
  borderRadius: 16,
}

export default function CreativeLibraryTab() {
  const { t } = useI18n()
  const tr = (k, f, v) => t(k, v || null, f)
  const fmtLabel = f => tr(f.key, f.it)

  const [data, setData] = useState({ items: [], projects: [], promos: [], can: { write: false }, needsSetup: false })
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  // Si apre su cio' che aspetta una decisione: l'archivio serve a giudicare le
  // creativita', e la prima cosa da vedere e' quelle che nessuno ha ancora
  // guardato. Il resto e' a un clic.
  const [fStatus, setFStatus] = useState('da_rivisionare')
  const [fScope, setFScope] = useState('all')      // progetto o promo
  const [creating, setCreating] = useState(false)
  const [preview, setPreview] = useState(null)
  const [uploads, setUploads] = useState({})
  const [selected, setSelected] = useState(() => new Set())   // schede scelte
  const [menu, setMenu] = useState(null)                      // menu del tasto destro
  const [bulk, setBulk] = useState(null)                      // caricamento in blocco

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const j = await fetch('/api/creative-library/items', { cache: 'no-store' }).then(r => r.json())
      setData({
        items: j.items || [], projects: j.projects || [], promos: j.promos || [],
        can: j.can || { write: false }, needsSetup: !!j.needsSetup,
      })
    } finally { setLoading(false) }
  }, [])

  useEffect(() => { load() }, [load])
  const can = !!data.can?.write

  // Le iniziative: progetti e promo insieme, sono la stessa domanda.
  const scopes = useMemo(() => ([
    ...data.projects.map(p => ({ key: `project:${p.id}`, id: p.id, type: 'project', label: p.name })),
    ...data.promos.map(p => ({ key: `promo:${p.id}`, id: p.id, type: 'promo', label: p.title })),
  ]), [data.projects, data.promos])

  const scopeOf = (item) => {
    if (item.project_id) return scopes.find(s => s.type === 'project' && s.id === item.project_id) || null
    if (item.promo_id) return scopes.find(s => s.type === 'promo' && s.id === item.promo_id) || null
    return null
  }

  // La ricerca sta a monte dei filtri: le voci laterali contano su questo, non
  // su cio' che il filtro attuale lascia passare, altrimenti scegliendo un
  // progetto tutti gli altri crollerebbero a zero.
  const searched = useMemo(() => {
    const needle = q.trim().toLowerCase()
    if (!needle) return data.items
    return data.items.filter(i => `${i.name} ${i.author || ''}`.toLowerCase().includes(needle))
  }, [data.items, q])

  const visible = useMemo(() => searched.filter(i => {
    if (fStatus !== 'all' && i.status !== fStatus) return false
    if (fScope !== 'all') {
      const s = scopeOf(i)
      if (fScope === 'none' ? !!s : (!s || s.key !== fScope)) return false
    }
    return true
  }), [searched, fStatus, fScope, scopes])

  // Raggruppate per iniziativa: è così che si cercano.
  const groups = useMemo(() => {
    const map = new Map()
    for (const i of visible) {
      const s = scopeOf(i)
      const key = s ? s.key : 'none'
      if (!map.has(key)) map.set(key, { key, label: s ? s.label : tr('cl.noScope', 'Senza iniziativa'), type: s?.type || null, items: [] })
      map.get(key).items.push(i)
    }
    return [...map.values()].sort((a, b) => (a.key === 'none' ? 1 : b.key === 'none' ? -1 : a.label.localeCompare(b.label)))
  }, [visible, scopes])

  // Le voci laterali: ogni progetto e ogni promo, anche a zero. Un progetto
  // appena creato deve comparire, altrimenti non c'e' modo di aprirlo per
  // metterci dentro la prima creativita'.
  const scopeStats = useMemo(() => {
    const vuoto = () => ({ items: [], byStatus: {} })
    const map = new Map()
    for (const sc of scopes) map.set(sc.key, { ...sc, ...vuoto() })
    map.set('none', { key: 'none', type: null, label: tr('cl.noScope', 'Senza iniziativa'), ...vuoto() })
    for (const i of searched) {
      const sc = scopeOf(i)
      const b = map.get(sc ? sc.key : 'none')
      if (!b) continue
      b.items.push(i)
      b.byStatus[i.status] = (b.byStatus[i.status] || 0) + 1
    }
    // La miniatura e' il primo file che c'e': una voce con la faccia della
    // creativita' si ritrova a colpo d'occhio, una riga di testo no.
    for (const b of map.values()) {
      b.thumb = b.items.flatMap(i => i.files || []).find(f => f.file_url) || null
    }
    return map
  }, [searched, scopes])

  const counts = useMemo(() => {
    const c = { total: data.items.length }
    for (const s of STATUSES) c[s] = data.items.filter(i => i.status === s).length
    c.complete = data.items.filter(i => FORMATS.every(f => (i.files || []).some(x => x.format === f.id))).length
    return c
  }, [data.items])

  const setStatus = async (item, status) => {
    setData(d => ({ ...d, items: d.items.map(i => i.id === item.id ? { ...i, status } : i) }))
    await fetch('/api/creative-library/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: item.id, status }),
    })
  }

  const setScope = async (item, key) => {
    const s = scopes.find(x => x.key === key)
    await fetch('/api/creative-library/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: item.id,
        projectId: s?.type === 'project' ? s.id : null,
        promoId: s?.type === 'promo' ? s.id : null,
      }),
    })
    load()
  }

  // Verdetto del singolo formato: capita che di tre declinazioni solo una sia
  // da rifare, e bocciare l'intera creatività per quella sarebbe sbagliato.
  const setAssetStatus = async (asset, status) => {
    setData(d => ({
      ...d,
      items: d.items.map(i => i.id === asset.item_id
        ? { ...i, files: (i.files || []).map(f => f.id === asset.id ? { ...f, status } : f) }
        : i),
    }))
    await fetch('/api/creative-library', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: asset.id, status }),
    })
  }

  // Verdetto applicato a tutte le schede scelte: con dieci creatività e trenta
  // file, deciderle una per una è il motivo per cui non le decide nessuno.
  const setStatusMany = async (ids, status) => {
    setData(d => ({ ...d, items: d.items.map(i => ids.has(i.id) ? { ...i, status } : i) }))
    await Promise.all([...ids].map(id => fetch('/api/creative-library/items', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    })))
  }

  // Scarica: una alla volta con un filo di distanza, perche' aprire venti
  // schede insieme fa scattare il blocco dei popup e non ne arriva nessuna.
  const downloadMany = (items) => {
    const urls = items.flatMap(i => (i.files || []).map(f => f.file_url)).filter(Boolean)
    urls.forEach((u, k) => setTimeout(() => window.open(u, '_blank', 'noopener'), k * 350))
  }

  const removeMany = async (ids) => {
    if (!ids.size) return
    if (!confirm(tr('cl.deleteManyConfirm', 'Eliminare {n} creatività e i loro file?', { n: ids.size }))) return
    setData(d => ({ ...d, items: d.items.filter(i => !ids.has(i.id)) }))
    setSelected(new Set())
    await Promise.all([...ids].map(id => fetch(`/api/creative-library/items?id=${id}`, { method: 'DELETE' })))
  }

  const removeItem = async (item) => {
    if (!confirm(tr('cl.deleteItemConfirm', 'Eliminare questa creatività e i suoi file?'))) return
    setData(d => ({ ...d, items: d.items.filter(i => i.id !== item.id) }))
    await fetch(`/api/creative-library/items?id=${item.id}`, { method: 'DELETE' })
  }

  const removeFile = async (item, format) => {
    if (!confirm(tr('cl.deleteFileConfirm', 'Eliminare questo formato?'))) return
    await fetch(`/api/creative-library/items?id=${item.id}&format=${encodeURIComponent(format)}`, { method: 'DELETE' })
    load()
  }

  const uploadInto = async (item, format, file) => {
    const key = `${item.id}:${format}`
    const set = (pct, error = null) => setUploads(u => ({ ...u, [key]: { pct, error } }))
    try {
      if (file.size > MAX_MB * 1024 * 1024) { set(0, tr('cl.tooBig', 'Supera i {n} MB consentiti.', { n: MAX_MB })); return }
      set(1)
      // Avviso, non blocco: le proporzioni sbagliate si vedono subito, ma può
      // esserci un motivo per caricare un ritaglio fuori standard.
      const ratio = await readRatio(file)
      const target = FORMATS.find(f => f.id === format)
      if (ratio && target && Math.abs(ratio - target.w / target.h) > 0.06) {
        if (!confirm(tr('cl.ratioWarn', 'Questo file non sembra {fmt} ({w}×{h}). Caricarlo lo stesso?', { fmt: fmtLabel(target), w: target.w, h: target.h }))) {
          setUploads(u => { const n = { ...u }; delete n[key]; return n }); return
        }
      }
      const sign = await fetch('/api/creative-library/upload-url', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ filename: file.name, size: file.size }),
      }).then(r => r.json())
      if (!sign?.ok) { set(0, sign?.error || tr('cl.signFailed', 'Permesso di caricamento negato.')); return }

      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.open('PUT', sign.signedUrl, true)
        xhr.setRequestHeader('x-upsert', 'true')
        if (file.type) xhr.setRequestHeader('Content-Type', file.type)
        xhr.upload.onprogress = e => { if (e.lengthComputable) set(Math.round((e.loaded / e.total) * 95)) }
        xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`storage ${xhr.status}`))
        xhr.onerror = () => reject(new Error('rete'))
        xhr.send(file)
      })

      const r = await fetch('/api/creative-library', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ asset: {
          itemId: item.id, format, name: file.name,
          filePath: sign.path, fileUrl: sign.publicUrl,
          kind: (file.type || '').startsWith('video') ? 'video' : 'statica',
          mime: file.type || null, size: file.size,
        } }),
      }).then(x => x.json())
      if (!r?.ok) { set(0, r?.error || tr('cl.saveFailed', 'Salvataggio non riuscito.')); return }
      set(100)
      setTimeout(() => setUploads(u => { const n = { ...u }; delete n[key]; return n }), 900)
      load()
    } catch (e) { set(0, e?.message || 'errore') }
  }

  // Chiude il menu contestuale a ogni clic o Esc: un menu che resta aperto
  // dopo l'azione fa credere che l'azione non sia partita.
  useEffect(() => {
    if (!menu) return
    const close = () => setMenu(null)
    const esc = e => { if (e.key === 'Escape') setMenu(null) }
    window.addEventListener('click', close)
    window.addEventListener('keydown', esc)
    return () => { window.removeEventListener('click', close); window.removeEventListener('keydown', esc) }
  }, [menu])

  // La selezione a rettangolo la disegna la tela: lì i rettangoli sono già
  // quelli sullo schermo, quindi zoom e spostamento sono dentro il conto.
  const bandSelect = (ids, add) => setSelected(prev => new Set(add ? [...prev, ...ids] : ids))

  // Destro su una scheda fuori selezione: la seleziona da sola, come ogni
  // gestore di file. Agire su una selezione invisibile fa danni muti.
  const openMenu = (e, payload = {}) => {
    e.preventDefault(); e.stopPropagation()
    if (payload.item && !selected.has(payload.item.id)) setSelected(new Set([payload.item.id]))
    setMenu({ x: e.clientX, y: e.clientY, ...payload })
  }

  // Le voci del menu: quattro liste diverse a seconda di dove si e' cliccato.
  // Sul fondo restano comunque i comandi generali, perche' e' li' che si va a
  // cercarli quando non si sa dove altro guardare.
  const menuVoci = () => {
    if (!menu) return []
    const chiudi = fn => () => { fn(); setMenu(null) }

    if (menu.asset) {
      const f = FORMATS.find(x => x.id === menu.asset.format)
      return [
        { titolo: `${menu.item.name} · ${f ? fmtLabel(f) : menu.asset.format}` },
        ...STATUSES.map(st => ({
          label: tr(`cl.st.${st}`, st), dot: STATUS_COLOR[st],
          fai: chiudi(() => setAssetStatus(menu.asset, st)),
        })),
        { sep: true },
        { label: tr('cl.download', 'Scarica'), icona: 'download',
          fai: chiudi(() => window.open(menu.asset.file_url, '_blank', 'noopener')) },
        { label: tr('cl.deleteFormat', 'Elimina questo formato'), icona: 'trash', color: '#ef4444',
          fai: chiudi(() => removeFile(menu.item, menu.asset.format)) },
      ]
    }

    const ids = selected.size ? selected : (menu.item ? new Set([menu.item.id]) : new Set())
    const scelte = visible.filter(i => ids.has(i.id))
    const n = ids.size
    const conFile = scelte.filter(i => (i.files || []).length).length

    const generali = [
      { sep: true },
      can && { label: tr('cl.newItem', 'Nuova creatività'), icona: 'plus', fai: chiudi(() => setCreating(true)) },
      can && { label: tr('cl.bulk', 'Carica in blocco'), icona: 'layers', fai: chiudi(() => setBulk({})) },
      { sep: true },
      { label: tr('cl.selectAllN', 'Seleziona tutte ({n})', { n: visible.length }), icona: 'check',
        off: !visible.length, fai: chiudi(() => setSelected(new Set(visible.map(i => i.id)))) },
      { label: tr('cl.clearSel', 'Azzera selezione'), icona: 'close',
        off: !selected.size, fai: chiudi(() => setSelected(new Set())) },
    ]

    if (!n) return [{ titolo: tr('cl.noneSelected', 'Nessuna creatività scelta') }, ...generali.slice(1)]

    return [
      { titolo: n === 1 ? scelte[0]?.name || tr('cl.verdict', 'Verdetto') : tr('cl.verdictMany', 'Verdetto · {n} scelte', { n }) },
      ...STATUSES.map(st => ({
        label: tr(`cl.st.${st}`, st), dot: STATUS_COLOR[st],
        fai: chiudi(() => setStatusMany(ids, st)),
      })),
      { sep: true },
      { label: n === 1 ? tr('cl.downloadFiles', 'Scarica i file') : tr('cl.downloadManyN', 'Scarica i file di {n}', { n: conFile }),
        icona: 'download', off: !conFile, fai: chiudi(() => downloadMany(scelte)) },
      can && { sep: true },
      can && { label: n === 1 ? tr('cl.deleteItem', 'Elimina creatività') : tr('cl.deleteManyN', 'Elimina le {n} scelte', { n }),
        icona: 'trash', color: '#ef4444',
        fai: chiudi(() => n === 1 && menu.item ? removeItem(menu.item) : removeMany(ids)) },
      ...generali,
    ]
  }

  if (loading) return <Empty text={tr('cl.loading', 'Carico l’archivio…')} />

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {data.needsSetup && (
        <Banner
          title={tr('cl.setupItemsTitle', 'Creatività a tre formati non attive')}
          body={tr('cl.setupItemsBody', 'Esegui supabase/creative_items.sql per accoppiare i formati e usare gli stati.')}
        />
      )}

      {/* Riepilogo */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(158px, 1fr))', gap: 10, position: 'relative', zIndex: 2 }}>
        <Kpi label={tr('cl.statTotal', 'Creatività')} value={counts.total} />
        <Kpi label={tr('cl.statComplete', 'Complete · 3 formati')} value={counts.complete}
             sub={counts.total ? tr('cl.ofTotal', 'su {n}', { n: counts.total }) : null} />
        {STATUSES.map(s => (
          <Kpi key={s} label={tr(`cl.st.${s}`, s)} value={counts[s] || 0} dot={STATUS_COLOR[s]} />
        ))}
      </div>

      {/* Filtri */}
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center', position: 'relative', zIndex: 2 }}>
        <input value={q} onChange={e => setQ(e.target.value)} placeholder={tr('cl.search2', 'Cerca creatività o autore…')}
          style={{ ...pill, width: 240, cursor: 'text' }} />
        <Chip on={fStatus === 'all'} onClick={() => setFStatus('all')}>{tr('cl.allStatus', 'Tutti gli stati')}</Chip>
        {STATUSES.map(s => (
          <Chip key={s} on={fStatus === s} onClick={() => setFStatus(s)} dot={STATUS_COLOR[s]}>
            {tr(`cl.st.${s}`, s)} <b style={{ opacity: .55, fontWeight: 600 }}>{counts[s] || 0}</b>
          </Chip>
        ))}
        {can && (
          <button type="button" onClick={() => setBulk({})} style={{
            marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
            background: 'rgba(255,255,255,.03)', border: '1px solid rgba(255,255,255,.06)',
            color: 'var(--text2)', fontSize: 13, fontWeight: 500,
          }}>
            <Icon name="layers" size={13} /> {tr('cl.bulk', 'Carica in blocco')}
          </button>
        )}
        {can && (
          <button type="button" onClick={() => setCreating(true)} style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
            background: 'var(--neutro-bg)', border: '1px solid rgba(41,151,255,.42)',
            color: ACCENT, fontSize: 13, fontWeight: 600,
          }}>
            <Icon name="plus" size={13} /> {tr('cl.newItem', 'Nuova creatività')}
          </button>
        )}
      </div>

      {/* A sinistra le iniziative, a destra la tela senza fine: si sceglie il
          progetto o la promo e la tela mostra solo quello. */}
      <div style={{ display: 'flex', gap: 18, alignItems: 'flex-start', flexWrap: 'wrap', position: 'relative', zIndex: 2 }}>

        <ScopeSidebar
          stats={scopeStats} scopes={scopes} tr={tr}
          active={fScope} onPick={setFScope}
          status={fStatus} onStatus={setFStatus}
          total={searched.length}
        />

        <div style={{ flex: '1 1 560px', minWidth: 0 }}>
        <CreativeCanvas
          count={tr('cl.canvasCount', '{n} creatività', { n: visible.length })}
          label={{
            reset: tr('cl.canvasReset', 'Centra'),
            hint: tr('cl.canvasHint', 'spazio o Alt per spostarti, rotella per lo zoom'),
          }}
          onBandSelect={bandSelect}
          onBackground={() => setSelected(new Set())}
          onMenu={openMenu}>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 28, width: BOARD_W, padding: '4px 0 48px' }}>
            {groups.length === 0 ? (
              // Vuoto per davvero o vuoto per via dei filtri: sono due cose
              // diverse. Dire "nessuna creatività" a chi ne ha cinquanta tutte
              // gia' decise e' una bugia, e chiude la strada invece di aprirla.
              <div style={{ width: CARD_W }}>
                {data.items.length ? (
                  <div style={{ ...GLASS, padding: '30px 24px', textAlign: 'center' }}>
                    <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0, lineHeight: 1.55 }}>
                      {fStatus !== 'all'
                        ? tr('cl.noneWithStatus', 'Nessuna creatività in stato «{st}» qui.', { st: tr(`cl.st.${fStatus}`, fStatus) })
                        : tr('cl.noneWithFilters', 'Nessuna creatività con questi filtri.')}
                    </p>
                    <button type="button" onClick={() => { setFStatus('all'); setFScope('all'); setQ('') }} style={{
                      marginTop: 14, padding: '8px 16px', borderRadius: 999, cursor: 'pointer',
                      background: 'var(--neutro-bg)', border: '1px solid rgba(41,151,255,.42)',
                      color: ACCENT, fontSize: 13, fontWeight: 600,
                    }}>
                      {tr('cl.showEverything', 'Mostra tutte le {n}', { n: data.items.length })}
                    </button>
                  </div>
                ) : (
                  <Empty text={can ? tr('cl.emptyCan2', 'Nessuna creatività. Creane una e carica i tre formati.') : tr('cl.empty', 'Nessun file in archivio.')} />
                )}
              </div>
            ) : groups.map(g => (
              <div key={g.key} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {/* Con una sola iniziativa scelta il titolo e' gia' acceso
                    nella colonna: ripeterlo sulla tela e' rumore. */}
                {fScope === 'all' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
                    {g.type && <Icon name={g.type === 'promo' ? 'tag' : 'kanban'} size={12} />}
                    <span style={{ ...EYEBROW, fontSize: 11.5, color: 'var(--text3)' }}>{g.label}</span>
                    <span style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)', fontVariantNumeric: 'tabular-nums' }}>{g.items.length}</span>
                    <span style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(255,255,255,.10), transparent)' }} />
                  </div>
                )}
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 18 }}>
                  {g.items.map(item => (
                    <div key={item.id} style={{ width: CARD_W }}>
                      <ItemCard
                        item={item} can={can} tr={tr} fmtLabel={fmtLabel}
                        scopes={scopes} scopeKey={scopeOf(item)?.key || ''} uploads={uploads}
                        selected={selected.has(item.id)}
                        onSelect={(e) => setSelected(prev => {
                          const n = new Set(e.metaKey || e.ctrlKey || e.shiftKey ? prev : [])
                          n.has(item.id) ? n.delete(item.id) : n.add(item.id)
                          return n
                        })}
                        onMenu={openMenu}
                        onStatus={setStatus} onAssetStatus={setAssetStatus} onScope={setScope}
                        onRemove={removeItem} onRemoveFile={removeFile} onUpload={uploadInto} onPreview={setPreview}
                      />
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </CreativeCanvas>
        </div>
      </div>

      {menu && <ContextMenu x={menu.x} y={menu.y} voci={menuVoci()} />}

      {creating && (
        <NewItemModal scopes={scopes} tr={tr} onClose={() => setCreating(false)}
          onCreated={() => { setCreating(false); load() }} />
      )}

      {bulk && (
        <BulkUploadModal scopes={scopes} tr={tr} fmtLabel={fmtLabel}
          onClose={() => setBulk(null)} onDone={() => { setBulk(null); load() }} />
      )}

      {preview && (
        <div onClick={() => setPreview(null)} style={{
          position: 'fixed', inset: 0, zIndex: 500, background: 'rgba(0,0,0,0.9)',
          display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
        }}>
          <div onClick={e => e.stopPropagation()} style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
            <div style={{ ...EYEBROW, fontSize: 11.5, color: 'var(--text3)' }}>{preview.name}</div>
            {preview.kind === 'statica'
              ? <img src={preview.file_url} alt="" style={{ maxWidth: '88vw', maxHeight: '78vh', objectFit: 'contain', borderRadius: 12 }} />
              : <video src={preview.file_url} controls autoPlay style={{ maxWidth: '88vw', maxHeight: '78vh', borderRadius: 12 }} />}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Colonna delle iniziative ───────────────────────────────────────────────
// Progetti e promo, con la faccia della prima creativita' come miniatura.
// Scegliendone una la tela mostra solo quella; sotto la voce accesa compaiono
// i suoi stati, cosi' "di questo progetto fammi vedere solo le da rivisionare"
// e' un colpo di mouse e non un giro dai filtri.
function ScopeSidebar({ stats, scopes, tr, active, onPick, status, onStatus, total }) {
  const progetti = scopes.filter(x => x.type === 'project')
  const promo = scopes.filter(x => x.type === 'promo')
  const senza = stats.get('none')

  return (
    <aside style={{
      flex: '0 0 268px', maxWidth: '100%', alignSelf: 'stretch',
      background: 'rgba(255,255,255,.018)', backdropFilter: 'blur(30px)',
      border: '1px solid rgba(255,255,255,.06)', borderRadius: 16, padding: 12,
      display: 'flex', flexDirection: 'column', gap: 4,
      maxHeight: 'calc(100vh - 300px)', minHeight: 460, overflowY: 'auto',
    }}>
      <div style={{ ...EYEBROW, fontSize: 10, color: 'var(--text4, #6b7280)', padding: '6px 8px 10px' }}>
        {tr('cl.sidebarTitle', 'Progetti e promo')}
      </div>

      <Voce on={active === 'all'} label={tr('cl.allScopes', 'Tutti i progetti e le promo')}
        sub={tr('cl.canvasCount', '{n} creatività', { n: total })}
        icona="layers" onClick={() => onPick('all')} />

      {progetti.length > 0 && <Sezione>{tr('cl.projectsGroup', 'Progetti')}</Sezione>}
      {progetti.map(sc => (
        <VoceScope key={sc.key} b={stats.get(sc.key)} icona="kanban" tr={tr}
          on={active === sc.key} onClick={() => onPick(sc.key)}
          status={status} onStatus={onStatus} />
      ))}

      {promo.length > 0 && <Sezione>{tr('cl.promosGroup', 'Promo')}</Sezione>}
      {promo.map(sc => (
        <VoceScope key={sc.key} b={stats.get(sc.key)} icona="tag" tr={tr}
          on={active === sc.key} onClick={() => onPick(sc.key)}
          status={status} onStatus={onStatus} />
      ))}

      {/* "Senza iniziativa" compare solo se qualcosa c'e' davvero dentro:
          una voce sempre vuota e' un cassetto che non si apre mai. */}
      {senza?.items.length > 0 && (
        <>
          <Sezione>{tr('cl.noScope', 'Senza iniziativa')}</Sezione>
          <VoceScope b={senza} icona="inbox" tr={tr}
            on={active === 'none'} onClick={() => onPick('none')}
            status={status} onStatus={onStatus} />
        </>
      )}

      {!progetti.length && !promo.length && (
        <p style={{ fontSize: 13, color: 'var(--text4, #6b7280)', padding: '10px 8px', lineHeight: 1.5 }}>
          {tr('cl.noScopesYet', 'Nessun progetto e nessuna promo. Si creano in Progetti & Task e nel Calendario.')}
        </p>
      )}
    </aside>
  )
}

function Sezione({ children }) {
  return (
    <div style={{ ...EYEBROW, fontSize: 10, color: 'var(--text4, #6b7280)', padding: '12px 8px 4px' }}>
      {children}
    </div>
  )
}

function VoceScope({ b, icona, tr, on, onClick, status, onStatus }) {
  if (!b) return null
  const n = b.items.length
  const daFare = b.byStatus.da_rivisionare || 0
  const sub = n === 0
    ? tr('cl.noneYet', 'nessuna creatività')
    : `${tr('cl.canvasCount', '{n} creatività', { n })} · ${daFare
        ? tr('cl.toReviewN', '{n} da rivisionare', { n: daFare })
        : tr('cl.allDecided', 'tutte decise')}`

  return (
    <div>
      <Voce on={on} label={b.label} sub={sub} icona={icona} thumb={b.thumb} dim={n === 0} onClick={onClick} />
      {on && n > 0 && (
        <div style={{
          display: 'flex', flexDirection: 'column', gap: 2,
          margin: '2px 0 8px 18px', paddingLeft: 12, borderLeft: '1px solid rgba(255,255,255,.08)',
        }}>
          <SubVoce on={status === 'all'} onClick={() => onStatus('all')}
            label={tr('cl.allStatus', 'Tutti gli stati')} n={n} />
          {STATUSES.filter(st => b.byStatus[st] || status === st).map(st => (
            <SubVoce key={st} on={status === st} onClick={() => onStatus(status === st ? 'all' : st)}
              label={tr(`cl.st.${st}`, st)} n={b.byStatus[st] || 0} dot={STATUS_COLOR[st]} />
          ))}
        </div>
      )}
    </div>
  )
}

function Voce({ on, label, sub, icona, thumb, dim, onClick }) {
  return (
    <button type="button" onClick={onClick} title={label} style={{
      display: 'flex', gap: 11, alignItems: 'center', textAlign: 'left', width: '100%',
      background: on ? 'var(--neutro-bg)' : 'transparent',
      border: `1px solid ${on ? 'rgba(41,151,255,.3)' : 'transparent'}`,
      borderRadius: 12, padding: 9, cursor: 'pointer', font: 'inherit',
      opacity: dim && !on ? .55 : 1,
      transition: 'background .16s ease, border-color .16s ease, opacity .16s ease',
    }}
      onMouseEnter={e => { if (!on) e.currentTarget.style.background = 'rgba(255,255,255,.03)' }}
      onMouseLeave={e => { if (!on) e.currentTarget.style.background = 'transparent' }}>
      <span style={{
        width: 42, height: 42, flex: '0 0 auto', borderRadius: 12, overflow: 'hidden',
        background: '#0b0b10', border: '1px solid rgba(255,255,255,.06)',
        display: 'grid', placeItems: 'center', color: 'var(--text4, #6b7280)',
      }}>
        {thumb
          ? (thumb.kind === 'statica'
              ? <img src={thumb.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              : <video src={thumb.file_url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />)
          : <Icon name={icona} size={15} />}
      </span>
      <span style={{ display: 'flex', flexDirection: 'column', gap: 3, minWidth: 0 }}>
        <b style={{
          fontSize: 13, fontWeight: 600, lineHeight: 1.3, letterSpacing: '-.01em',
          color: on ? 'var(--text)' : 'var(--text2)',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden',
        }}>{label}</b>
        <i style={{ fontStyle: 'normal', fontSize: 11.5, color: 'var(--text4, #6b7280)' }}>{sub}</i>
      </span>
    </button>
  )
}

function SubVoce({ on, onClick, label, n, dot }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, width: '100%',
      font: 'inherit', fontSize: 11.5, textAlign: 'left', padding: '6px 10px', borderRadius: 8,
      cursor: 'pointer', border: `1px solid ${on ? 'rgba(41,151,255,.3)' : 'transparent'}`,
      background: on ? 'var(--neutro-bg)' : 'transparent',
      color: on ? ACCENT : 'var(--text4, #6b7280)',
      transition: 'background .14s ease, color .14s ease',
    }}
      onMouseEnter={e => { if (!on) { e.currentTarget.style.background = 'rgba(255,255,255,.03)'; e.currentTarget.style.color = 'var(--text3)' } }}
      onMouseLeave={e => { if (!on) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text4, #6b7280)' } }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: 7, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot, flexShrink: 0 }} />}
        {label}
      </span>
      <span style={{ fontSize: 11.5, opacity: on ? 1 : .6, flex: '0 0 auto', fontVariantNumeric: 'tabular-nums' }}>{n}</span>
    </button>
  )
}


// ── Scheda creatività: i tre formati affiancati ────────────────────────────
function ItemCard({ item, can, tr, fmtLabel, scopes, scopeKey, uploads, selected, onSelect, onMenu, onStatus, onAssetStatus, onScope, onRemove, onRemoveFile, onUpload, onPreview }) {
  const refs = useRef({})
  const fileOf = fid => (item.files || []).find(f => f.format === fid) || null
  const missing = FORMATS.filter(f => !fileOf(f.id)).length
  const color = STATUS_COLOR[item.status]

  return (
    <div data-card={item.id}
      onContextMenu={e => onMenu(e, { item })}
      style={{
        ...GLASS, padding: '15px 16px 16px',
        // Il bordo porta il verdetto, il contorno la selezione: due
        // informazioni diverse non possono usare lo stesso segno.
        outline: selected ? `2px solid ${ACCENT}` : 'none', outlineOffset: 2,
      }}>
      {/* Barra d'accento dietro al contenuto: davanti scurirebbe le anteprime */}
      <span style={{
        content: '""', position: 'absolute', top: 0, left: '12%', right: '12%', height: 1.5, zIndex: -1,
        background: 'none', filter: 'blur(.3px)',
      }} />

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
        <span style={{ width: 7, height: 7, borderRadius: 999, background: color, flexShrink: 0 }} />
        <span onClick={onSelect} title={tr('cl.selectHint', 'Clic per selezionare · destro per il menu')}
          style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)', cursor: 'pointer' }}>
          {item.name}
        </span>
        <span style={{ ...EYEBROW, fontSize: 10, color }}>{tr(`cl.st.${item.status}`, item.status)}</span>
        {missing > 0 && (
          <span style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)' }}>
            {tr('cl.missingN', 'manca {n} di 3', { n: missing })}
          </span>
        )}

        {can && (
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, alignItems: 'center' }}>
            <select value={item.status} onChange={e => onStatus(item, e.target.value)}
              title={tr('cl.verdict', 'Verdetto')}
              style={{ ...pill, padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', color, borderColor: `${color}4d` }}>
              {STATUSES.map(st => <option key={st} value={st} style={opt}>{tr(`cl.st.${st}`, st)}</option>)}
            </select>
            <select value={scopeKey} onChange={e => onScope(item, e.target.value)} style={{ ...pill, padding: '6px 11px', fontSize: 11.5, cursor: 'pointer', maxWidth: 190 }}>
              <option value="" style={opt}>{tr('cl.noScope', 'Senza iniziativa')}</option>
              {scopes.map(s => <option key={s.key} value={s.key} style={opt}>{s.label}</option>)}
            </select>
            <button type="button" onClick={() => onRemove(item)} title={tr('cl.delete', 'Elimina')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4, #6b7280)', display: 'flex' }}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        )}
      </div>

      {can && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
          <span style={{ ...EYEBROW, fontSize: 10, color: 'var(--text4, #6b7280)', alignSelf: 'center', marginRight: 3 }}>
            {tr('cl.verdict', 'Verdetto')}
          </span>
          {STATUSES.map(st => {
            const on = item.status === st
            const c = STATUS_COLOR[st]
            return (
              <button key={st} type="button" onClick={() => onStatus(item, on ? 'da_rivisionare' : st)}
                title={tr(`cl.st.${st}`, st)}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  fontSize: 11.5, fontWeight: on ? 700 : 500, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
                  border: `1px solid ${on ? c + '6b' : 'rgba(255,255,255,.06)'}`,
                  background: on ? `${c}1f` : 'rgba(255,255,255,.03)',
                  color: on ? c : 'var(--text4, #6b7280)',
                  transition: 'color .16s, border-color .16s, background .16s',
                }}>
                <span style={{ width: 6, height: 6, borderRadius: 999, background: on ? c : 'rgba(255,255,255,.18)' }} />
                {tr(`cl.st.${st}`, st)}
              </button>
            )
          })}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
        {FORMATS.map(f => {
          const file = fileOf(f.id)
          const up = uploads[`${item.id}:${f.id}`]
          const fc = file ? (STATUS_COLOR[file.status] || STATUS_COLOR.da_rivisionare) : null
          return (
            <div key={f.id}
              onContextMenu={file ? (e => onMenu(e, { item, asset: file })) : undefined}
              style={{
                // Il bordo del riquadro porta il verdetto DI QUEL formato: si
                // vede a colpo d'occhio quale delle tre declinazioni è da rifare.
                border: `1px solid ${fc ? fc + '59' : 'rgba(255,255,255,.06)'}`,
                borderRadius: 12, overflow: 'hidden', background: 'rgba(255,255,255,.015)',
              }}>
              <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 7, borderBottom: '1px solid rgba(255,255,255,.06)' }}>
                <span style={{ ...EYEBROW, fontSize: 10, color: 'var(--text3)' }}>{fmtLabel(f)}</span>
                <span style={{ fontSize: 10, color: 'var(--text4, #6b7280)', fontVariantNumeric: 'tabular-nums' }}>{f.w}×{f.h}</span>
                {file && can && (
                  <>
                    <select value={file.status || 'da_rivisionare'} onChange={e => onAssetStatus(file, e.target.value)}
                      title={tr('cl.fmtVerdict', 'Verdetto di questo formato')}
                      style={{ ...pill, marginLeft: 'auto', padding: '3px 8px', fontSize: 10, borderRadius: 999, cursor: 'pointer', color: fc, borderColor: `${fc}4d` }}>
                      {STATUSES.map(st => <option key={st} value={st} style={opt}>{tr(`cl.st.${st}`, st)}</option>)}
                    </select>
                    <button type="button" onClick={() => onRemoveFile(item, f.id)} title={tr('cl.delete', 'Elimina')}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4, #6b7280)', display: 'flex' }}>
                      <Icon name="trash" size={10} />
                    </button>
                  </>
                )}
              </div>

              {file ? (
                <button type="button" onClick={() => onPreview(file)} style={{
                  border: 'none', padding: 0, cursor: 'pointer', background: '#000',
                  width: '100%', height: 148, display: 'grid', placeItems: 'center', overflow: 'hidden',
                }}>
                  {file.kind === 'statica'
                    ? <img src={file.file_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    : <video src={file.file_url} muted preload="metadata" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                </button>
              ) : (
                <div style={{ height: 148, display: 'grid', placeItems: 'center', padding: 10 }}>
                  {up ? (
                    up.error
                      ? <span style={{ fontSize: 11.5, color: '#ef4444', textAlign: 'center' }}>{up.error}</span>
                      : (
                        <div style={{ width: '78%' }}>
                          <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,.08)', overflow: 'hidden' }}>
                            <div style={{ width: `${up.pct}%`, height: '100%', background: ACCENT, transition: 'width .2s' }} />
                          </div>
                          <div style={{ fontSize: 10, color: 'var(--text4, #6b7280)', textAlign: 'center', marginTop: 6, fontVariantNumeric: 'tabular-nums' }}>{up.pct}%</div>
                        </div>
                      )
                  ) : can ? (
                    <>
                      <input ref={el => { refs.current[f.id] = el }} type="file" accept="video/*,image/*" style={{ display: 'none' }}
                        onChange={e => { const file = e.target.files?.[0]; if (file) onUpload(item, f.id, file); e.target.value = '' }} />
                      <button type="button" onClick={() => refs.current[f.id]?.click()} style={{
                        display: 'inline-flex', alignItems: 'center', gap: 6, padding: '7px 14px', borderRadius: 999,
                        cursor: 'pointer', background: 'transparent', border: '1px dashed rgba(255,255,255,.15)',
                        color: 'var(--text3)', fontSize: 11.5, fontWeight: 500,
                      }}>
                        <Icon name="plus" size={11} /> {tr('cl.addFormat', 'Carica')}
                      </button>
                    </>
                  ) : (
                    <span style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)' }}>{tr('cl.missing', 'manca')}</span>
                  )}
                </div>
              )}

              {file && (
                <div style={{ padding: '7px 10px', display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span title={file.name} style={{ fontSize: 10, color: 'var(--text4, #6b7280)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {file.name}
                  </span>
                  <a href={file.file_url} download title={tr('cl.download', 'Scarica')} style={{ color: 'var(--text4, #6b7280)', display: 'flex' }}>
                    <Icon name="download" size={11} />
                  </a>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ── Menu del tasto destro ──────────────────────────────────────────────────
// Prende un elenco di voci ({ titolo } · { sep } · { label, fai, ... }) invece
// di un contenuto fisso: lo stesso menu serve il fondo della tela, una scheda,
// piu' schede scelte e un singolo formato, che sono quattro liste diverse.
//
// Si ribalta se sborda dallo schermo: un menu tagliato a meta' e' un menu che
// non si puo' usare.
function ContextMenu({ x, y, voci }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ x, y, misurato: false })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()

    // Dove il menu e' finito DAVVERO. Se un antenato ha un transform o un
    // filtro, position:fixed non parte piu' dalla finestra ma da quel
    // riquadro: invece di fidarsi, si misura lo scarto e lo si toglie. Cosi'
    // il menu si apre sotto al puntatore comunque sia fatta la pagina.
    const dx = r.left - x
    const dy = r.top - y

    // Ribaltamento ai bordi: un menu tagliato a meta' non si puo' usare.
    const fx = x + r.width > window.innerWidth - 8 ? Math.max(8, x - r.width) : x
    const fy = y + r.height > window.innerHeight - 8 ? Math.max(8, y - r.height) : y

    setPos({ x: fx - dx, y: fy - dy, misurato: true })
  }, [x, y])

  return (
    <div ref={ref} onClick={e => e.stopPropagation()} onContextMenu={e => e.preventDefault()}
      style={{
        position: 'fixed', left: pos.x, top: pos.y, zIndex: 600, minWidth: 232, maxWidth: 320,
        visibility: pos.misurato ? 'visible' : 'hidden',
        padding: '6px 0', borderRadius: 12, background: 'var(--surface)', backdropFilter: 'blur(20px)',
        border: '1px solid rgba(255,255,255,.10)', boxShadow: '0 20px 50px rgba(0,0,0,.7)',
      }}>
      {voci.filter(Boolean).map((v, i) => {
        if (v.sep) return <div key={i} style={{ height: 1, background: 'rgba(255,255,255,.07)', margin: '6px 0' }} />
        if (v.titolo) return (
          <div key={i} style={{ ...EYEBROW, fontSize: 10, color: 'var(--text4, #6b7280)', padding: '6px 12px 6px' }}>
            {v.titolo}
          </div>
        )
        return (
          <button key={i} type="button" disabled={v.off}
            onMouseDown={e => { e.stopPropagation(); if (!v.off) v.fai() }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
              padding: '7px 12px', border: 'none', background: 'transparent',
              cursor: v.off ? 'default' : 'pointer', opacity: v.off ? .35 : 1,
              color: v.color || 'var(--text2)', fontSize: 13, fontWeight: 500,
            }}
            onMouseEnter={e => { if (!v.off) e.currentTarget.style.background = 'rgba(255,255,255,.05)' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
            {v.dot
              ? <span style={{ width: 7, height: 7, borderRadius: 999, background: v.dot, flexShrink: 0 }} />
              : v.icona ? <Icon name={v.icona} size={12} /> : null}
            <span style={{ flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{v.label}</span>
          </button>
        )
      })}
    </div>
  )
}

function NewItemModal({ scopes, tr, onClose, onCreated }) {
  const [f, setF] = useState({ name: '', scope: '', notes: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  const save = async () => {
    if (!f.name.trim()) { setError(tr('cl.errName', 'Serve un nome.')); return }
    setBusy(true); setError(null)
    const s = scopes.find(x => x.key === f.scope)
    const r = await fetch('/api/creative-library/items', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: f.name, notes: f.notes,
        projectId: s?.type === 'project' ? s.id : null,
        promoId: s?.type === 'promo' ? s.id : null,
      }),
    }).then(x => x.json()).catch(() => ({ ok: false }))
    if (!r?.ok) { setError(r?.error || tr('cl.saveFailed', 'Salvataggio non riuscito.')); setBusy(false); return }
    onCreated()
  }

  const projects = scopes.filter(s => s.type === 'project')
  const promos = scopes.filter(s => s.type === 'promo')

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ ...GLASS, width: '100%', maxWidth: 430, padding: 22, display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)', flex: 1 }}>{tr('cl.newItem', 'Nuova creatività')}</div>
          <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4, #6b7280)', display: 'flex' }}>
            <Icon name="close" size={15} />
          </button>
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)', marginTop: -7, lineHeight: 1.5 }}>
          {tr('cl.newItemHint2', 'Crea la scheda, poi carichi i tre formati: quadrato, verticale e orizzontale.')}
        </div>

        <Field label={tr('cl.name', 'Nome')}>
          <input value={f.name} onChange={e => setF(p => ({ ...p, name: e.target.value }))}
            placeholder={tr('cl.namePh', 'Es. Hook borsa in pelle · settembre')} style={{ ...pill, width: '100%', cursor: 'text' }} />
        </Field>

        <Field label={tr('cl.scope', 'Progetto o promo')}>
          <select value={f.scope} onChange={e => setF(p => ({ ...p, scope: e.target.value }))} style={{ ...pill, width: '100%', cursor: 'pointer' }}>
            <option value="" style={opt}>{tr('cl.noScope', 'Senza iniziativa')}</option>
            {projects.length > 0 && (
              <optgroup label={tr('cl.projectsGroup', 'Progetti')}>
                {projects.map(s => <option key={s.key} value={s.key} style={opt}>{s.label}</option>)}
              </optgroup>
            )}
            {promos.length > 0 && (
              <optgroup label={tr('cl.promosGroup', 'Promo')}>
                {promos.map(s => <option key={s.key} value={s.key} style={opt}>{s.label}</option>)}
              </optgroup>
            )}
          </select>
        </Field>

        <Field label={tr('cl.notes', 'Note')}>
          <textarea value={f.notes} onChange={e => setF(p => ({ ...p, notes: e.target.value }))} rows={2}
            style={{ ...pill, width: '100%', borderRadius: 12, resize: 'vertical', fontFamily: 'inherit', cursor: 'text' }} />
        </Field>

        {error && <div style={{ fontSize: 11.5, color: '#ef4444' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end' }}>
          <button type="button" onClick={onClose} style={{ ...pill, cursor: 'pointer' }}>{tr('cl.cancel', 'Annulla')}</button>
          <button type="button" onClick={save} disabled={busy} style={{
            padding: '8px 18px', borderRadius: 999, cursor: busy ? 'wait' : 'pointer',
            background: 'var(--neutro-bg)', border: '1px solid rgba(41,151,255,.42)',
            color: ACCENT, fontSize: 13, fontWeight: 600,
          }}>{busy ? tr('cl.saving', 'Salvo…') : tr('cl.create', 'Crea')}</button>
        </div>
      </div>
    </div>
  )
}


// ── Caricamento in blocco ──────────────────────────────────────────────────
// Si trascinano trenta file e il sistema fa il lavoro noioso: riconosce il
// formato dalle proporzioni e raggruppa i file nella stessa creatività quando
// il nome base coincide (hook_borsa_1x1 / hook_borsa_9x16 → una scheda sola).
// Poi si controlla e si conferma: indovinare senza mostrare cosa si è indovinato
// è il modo migliore per creare venti schede sbagliate in un colpo.
function BulkUploadModal({ scopes, tr, fmtLabel, onClose, onDone }) {
  const [rows, setRows] = useState([])
  const [scope, setScope] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(0)
  const [error, setError] = useState(null)
  const fileRef = useRef(null)

  const baseName = (n) => n
    .replace(/\.[a-z0-9]+$/i, '')
    .replace(/[_-]?(1080\s*[x×]\s*1080|1080\s*[x×]\s*1920|1920\s*[x×]\s*1080)/ig, '')
    .replace(/[_-]?(1x1|9x16|16x9|1:1|9:16|16:9|square|quadrato|vert(icale)?|oriz(zontale)?|horizontal|story|feed|reel)s?/ig, '')
    .replace(/[_-]+$/,'').replace(/^[_-]+/,'').replace(/[_-]+/g, ' ').trim()

  const addFiles = async (files) => {
    const next = []
    for (const file of Array.from(files || [])) {
      const ratio = await readRatio(file)
      let format = ''
      if (ratio) {
        let best = null
        for (const f of FORMATS) {
          const d = Math.abs(ratio - f.w / f.h)
          if (best === null || d < best.d) best = { d, id: f.id }
        }
        if (best && best.d < 0.12) format = best.id
      }
      next.push({ key: `${file.name}-${file.size}-${Math.random().toString(36).slice(2, 6)}`, file, name: baseName(file.name) || file.name, format, pct: null, error: null })
    }
    setRows(prev => [...prev, ...next])
  }

  const setRow = (key, patch) => setRows(prev => prev.map(r => r.key === key ? { ...r, ...patch } : r))

  const run = async () => {
    const bad = rows.find(r => !r.format || !r.name.trim())
    if (bad) { setError(tr('cl.bulkMissing', 'Ogni file vuole un nome e un formato.')); return }
    setBusy(true); setError(null)
    const s = scopes.find(x => x.key === scope)
    const created = new Map()   // nome creatività → id

    for (const r of rows) {
      try {
        const nome = r.name.trim()
        let itemId = created.get(nome.toLowerCase())
        if (!itemId) {
          const res = await fetch('/api/creative-library/items', {
            method: 'POST', headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: nome,
              projectId: s?.type === 'project' ? s.id : null,
              promoId: s?.type === 'promo' ? s.id : null,
            }),
          }).then(x => x.json())
          if (!res?.ok) { setRow(r.key, { error: res?.error || 'errore' }); continue }
          itemId = res.item.id
          created.set(nome.toLowerCase(), itemId)
        }

        const sign = await fetch('/api/creative-library/upload-url', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ filename: r.file.name, size: r.file.size }),
        }).then(x => x.json())
        if (!sign?.ok) { setRow(r.key, { error: sign?.error || 'permesso negato' }); continue }

        await new Promise((resolve, reject) => {
          const xhr = new XMLHttpRequest()
          xhr.open('PUT', sign.signedUrl, true)
          xhr.setRequestHeader('x-upsert', 'true')
          if (r.file.type) xhr.setRequestHeader('Content-Type', r.file.type)
          xhr.upload.onprogress = e => { if (e.lengthComputable) setRow(r.key, { pct: Math.round((e.loaded / e.total) * 95) }) }
          xhr.onload = () => (xhr.status >= 200 && xhr.status < 300) ? resolve() : reject(new Error(`storage ${xhr.status}`))
          xhr.onerror = () => reject(new Error('rete'))
          xhr.send(r.file)
        })

        const reg = await fetch('/api/creative-library', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ asset: {
            itemId, format: r.format, name: r.file.name,
            filePath: sign.path, fileUrl: sign.publicUrl,
            kind: (r.file.type || '').startsWith('video') ? 'video' : 'statica',
            mime: r.file.type || null, size: r.file.size,
          } }),
        }).then(x => x.json())
        if (!reg?.ok) { setRow(r.key, { error: reg?.error || 'non registrato' }); continue }
        setRow(r.key, { pct: 100 })
        setDone(d => d + 1)
      } catch (e) { setRow(r.key, { error: e?.message || 'errore' }) }
    }
    setBusy(false)
    if (!rows.some(r => r.error)) onDone()
  }

  const gruppi = new Set(rows.map(r => r.name.trim().toLowerCase()).filter(Boolean)).size

  return (
    <div onClick={busy ? undefined : onClose} style={{
      position: 'fixed', inset: 0, zIndex: 400, background: 'rgba(0,0,0,0.75)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{ ...GLASS, width: '100%', maxWidth: 720, maxHeight: '88vh', padding: 22, display: 'flex', flexDirection: 'column', gap: 13 }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <div style={{ fontSize: 15, fontWeight: 600, letterSpacing: '-.01em', color: 'var(--text)', flex: 1 }}>
            {tr('cl.bulk', 'Carica in blocco')}
          </div>
          {!busy && (
            <button type="button" onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4, #6b7280)', display: 'flex' }}>
              <Icon name="close" size={15} />
            </button>
          )}
        </div>
        <div style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)', marginTop: -7, lineHeight: 1.5 }}>
          {tr('cl.bulkHint', 'Il formato lo riconosce dalle proporzioni, e i file con lo stesso nome base finiscono nella stessa creatività. Controlla prima di confermare.')}
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <input ref={fileRef} type="file" multiple accept="video/*,image/*" style={{ display: 'none' }}
            onChange={e => { addFiles(e.target.files); e.target.value = '' }} />
          <button type="button" disabled={busy} onClick={() => fileRef.current?.click()} style={{ ...pill, cursor: 'pointer' }}>
            + {tr('cl.chooseFiles', 'Scegli i file')}
          </button>
          <select value={scope} onChange={e => setScope(e.target.value)} disabled={busy} style={{ ...pill, cursor: 'pointer', maxWidth: 260 }}>
            <option value="" style={opt}>{tr('cl.noScope', 'Senza iniziativa')}</option>
            {scopes.map(x => <option key={x.key} value={x.key} style={opt}>{x.label}</option>)}
          </select>
          {rows.length > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)', marginLeft: 'auto' }}>
              {tr('cl.bulkCount', '{f} file · {c} creatività', { f: rows.length, c: gruppi })}
            </span>
          )}
        </div>

        {rows.length > 0 && (
          <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6, minHeight: 100 }}>
            {rows.map(r => (
              <div key={r.key} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderRadius: 12, background: 'rgba(255,255,255,.02)', border: '1px solid rgba(255,255,255,.06)' }}>
                <span title={r.file.name} style={{ fontSize: 10, color: 'var(--text4, #6b7280)', width: 130, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.file.name}
                </span>
                <input value={r.name} disabled={busy} onChange={e => setRow(r.key, { name: e.target.value })}
                  placeholder={tr('cl.name', 'Nome')} style={{ ...pill, flex: 1, minWidth: 120, cursor: 'text', fontSize: 11.5, padding: '5px 10px' }} />
                <select value={r.format} disabled={busy} onChange={e => setRow(r.key, { format: e.target.value })}
                  style={{ ...pill, cursor: 'pointer', fontSize: 11.5, padding: '5px 10px', borderColor: r.format ? 'rgba(255,255,255,.06)' : 'rgba(255,214,10,.45)' }}>
                  <option value="" style={opt}>{tr('cl.pickFormat', 'Formato?')}</option>
                  {FORMATS.map(f => <option key={f.id} value={f.id} style={opt}>{fmtLabel(f)}</option>)}
                </select>
                {r.error ? <span style={{ fontSize: 10, color: '#ef4444', width: 90, textAlign: 'right' }}>{r.error}</span>
                  : r.pct != null ? <span style={{ fontSize: 10, color: r.pct === 100 ? '#22c55e' : 'var(--text4, #6b7280)', width: 90, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.pct === 100 ? '✓' : r.pct + '%'}</span>
                  : !busy ? (
                    <button type="button" onClick={() => setRows(prev => prev.filter(x => x.key !== r.key))}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text4, #6b7280)', display: 'flex' }}>
                      <Icon name="close" size={12} />
                    </button>
                  ) : <span style={{ width: 90 }} />}
              </div>
            ))}
          </div>
        )}

        {error && <div style={{ fontSize: 11.5, color: '#ef4444' }}>{error}</div>}

        <div style={{ display: 'flex', gap: 9, justifyContent: 'flex-end', alignItems: 'center' }}>
          {busy && <span style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)', marginRight: 'auto' }}>{tr('cl.bulkRunning', 'Caricamento… {n} di {t}', { n: done, t: rows.length })}</span>}
          {!busy && <button type="button" onClick={onClose} style={{ ...pill, cursor: 'pointer' }}>{tr('cl.cancel', 'Annulla')}</button>}
          <button type="button" onClick={run} disabled={busy || rows.length === 0} style={{
            padding: '8px 18px', borderRadius: 999, cursor: (busy || !rows.length) ? 'default' : 'pointer',
            opacity: (busy || !rows.length) ? .5 : 1,
            background: 'var(--neutro-bg)', border: '1px solid rgba(41,151,255,.42)',
            color: ACCENT, fontSize: 13, fontWeight: 600,
          }}>{busy ? tr('cl.saving', 'Salvo…') : tr('cl.bulkGo', 'Carica tutto')}</button>
        </div>
      </div>
    </div>
  )
}

// ── Pezzi minori ───────────────────────────────────────────────────────────
function readRatio(file) {
  return new Promise(resolve => {
    const url = URL.createObjectURL(file)
    const done = r => { URL.revokeObjectURL(url); resolve(r) }
    if ((file.type || '').startsWith('video')) {
      const v = document.createElement('video')
      v.preload = 'metadata'
      v.onloadedmetadata = () => done(v.videoWidth && v.videoHeight ? v.videoWidth / v.videoHeight : null)
      v.onerror = () => done(null)
      v.src = url
    } else {
      const img = new Image()
      img.onload = () => done(img.width && img.height ? img.width / img.height : null)
      img.onerror = () => done(null)
      img.src = url
    }
    setTimeout(() => done(null), 4000) // un file che non si apre non blocca il caricamento
  })
}

function Kpi({ label, value, sub, dot }) {
  return (
    <div style={{ ...GLASS, padding: '15px 16px 16px' }}>
      <span style={{
        position: 'absolute', top: 0, left: '12%', right: '12%', height: 1.5, zIndex: -1,
        background: 'none', filter: 'blur(.3px)',
      }} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />}
        <span style={{ ...EYEBROW, fontSize: 10, color: 'var(--text4, #6b7280)' }}>{label}</span>
      </div>
      <div style={{ fontSize: 22, fontWeight: 640, letterSpacing: '-.035em', lineHeight: 1, marginTop: 8, fontVariantNumeric: 'tabular-nums', color: 'var(--text)' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 11.5, color: 'var(--text4, #6b7280)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

function Chip({ children, on, onClick, dot }) {
  return (
    <button type="button" onClick={onClick} style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: 13, fontWeight: 500, padding: '6px 13px', borderRadius: 999, cursor: 'pointer',
      border: `1px solid ${on ? 'rgba(41,151,255,.42)' : 'rgba(255,255,255,.06)'}`,
      background: on ? 'var(--neutro-bg)' : 'rgba(255,255,255,.03)',
      color: on ? ACCENT : 'var(--text4, #6b7280)',
      transition: 'color .16s, border-color .16s, background .16s',
    }}>
      {dot && <span style={{ width: 6, height: 6, borderRadius: 999, background: dot }} />}
      {children}
    </button>
  )
}

function Field({ label, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
      <span style={{ ...EYEBROW, fontSize: 10, color: 'var(--text4, #6b7280)' }}>{label}</span>
      {children}
    </label>
  )
}

function Banner({ title, body }) {
  return (
    <div style={{ padding: '13px 16px', borderRadius: 12, background: 'rgba(255,214,10,.06)', border: '1px solid rgba(255,214,10,.32)', position: 'relative', zIndex: 2 }}>
      <strong style={{ color: '#ffd60a', fontWeight: 600, fontSize: 13 }}>{title}</strong>
      <div style={{ color: 'var(--text3)', marginTop: 3, fontSize: 13, lineHeight: 1.5 }}>{body}</div>
    </div>
  )
}

function Empty({ text }) {
  return <div style={{ padding: '44px 20px', textAlign: 'center', color: 'var(--text4, #6b7280)', fontSize: 13 }}>{text}</div>
}

const pill = {
  font: 'inherit', fontSize: 13, fontWeight: 500, padding: '7px 13px', borderRadius: 999,
  border: '1px solid rgba(255,255,255,.06)', background: 'rgba(255,255,255,.03)',
  color: 'var(--text2)', outline: 'none',
}
const opt = { background: 'var(--surface)' }
