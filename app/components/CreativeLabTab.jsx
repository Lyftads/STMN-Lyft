'use client'

import { useEffect, useState } from 'react'

const STYLES = [
  { id: 'performance', label: 'Performance', desc: 'Direct response, CTA forte' },
  { id: 'ugc', label: 'UGC', desc: 'Tono autentico, da atleta' },
  { id: 'lifestyle', label: 'Lifestyle', desc: 'Aspirazionale, mood' },
  { id: 'comparison', label: 'Comparison', desc: 'Noi vs competitor' },
]

const FUNNEL_STAGES = [
  { id: 'tofu', label: 'TOFU', fullLabel: 'Top of Funnel', color: '#3b82f6', desc: 'Fredda — Awareness. Cattura chi non ti conosce.' },
  { id: 'mofu', label: 'MOFU', fullLabel: 'Middle of Funnel', color: '#f59e0b', desc: 'Tiepida — Considerazione. Mostra la soluzione.' },
  { id: 'bofu', label: 'BOFU', fullLabel: 'Bottom of Funnel', color: '#22c55e', desc: 'Calda — Conversione. Spingi all\'acquisto.' },
  { id: 'retargeting', label: 'Retargeting', fullLabel: 'Retargeting', color: '#ec4899', desc: 'Recupero — Chi ha già visitato o abbandonato.' },
]

const FORMATS = [
  { id: 'square', label: 'Feed 1:1' },
  { id: 'story', label: 'Story 9:16' },
]

function money(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `€${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function Pagination({ page, totalPages, onPageChange }) {
  if (totalPages <= 1) return null
  const pages = []
  for (let i = 1; i <= totalPages; i++) {
    if (i === 1 || i === totalPages || Math.abs(i - page) <= 2) {
      pages.push(i)
    } else if (pages[pages.length - 1] !== '...') {
      pages.push('...')
    }
  }
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginTop: 20 }}>
      <button
        onClick={() => onPageChange(page - 1)}
        disabled={page <= 1}
        style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--glass)', color: page <= 1 ? '#4a4060' : '#c8c0d6',
          fontSize: 13, fontWeight: 700, cursor: page <= 1 ? 'default' : 'pointer',
        }}
      >
        ←
      </button>
      {pages.map((p, i) =>
        p === '...' ? (
          <span key={`e${i}`} style={{ padding: '8px 6px', color: '#6b6580' }}>…</span>
        ) : (
          <button
            key={p}
            onClick={() => onPageChange(p)}
            style={{
              padding: '8px 14px', borderRadius: 8,
              border: `1px solid ${p === page ? '#8b5cf6' : 'var(--border)'}`,
              background: p === page ? '#8b5cf620' : 'var(--glass)',
              color: p === page ? '#c4b5fd' : '#8b8aa0',
              fontSize: 13, fontWeight: 800, cursor: 'pointer',
            }}
          >
            {p}
          </button>
        )
      )}
      <button
        onClick={() => onPageChange(page + 1)}
        disabled={page >= totalPages}
        style={{
          padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)',
          background: 'var(--glass)', color: page >= totalPages ? '#4a4060' : '#c8c0d6',
          fontSize: 13, fontWeight: 700, cursor: page >= totalPages ? 'default' : 'pointer',
        }}
      >
        →
      </button>
    </div>
  )
}

function PreviewCard({ creative, productImage, format, onAccept, onReject, accepted, rejecting }) {
  return (
    <div
      style={{
        background: 'var(--glass)',
        border: `2px solid ${accepted ? '#22c55e' : 'var(--border)'}`,
        borderRadius: 22,
        overflow: 'hidden',
        position: 'relative',
        opacity: rejecting ? 0.5 : 1,
        transition: 'opacity .2s, border-color .2s',
      }}
    >
      {accepted && (
        <div
          style={{
            position: 'absolute', top: 12, left: 12, zIndex: 3,
            padding: '5px 12px', borderRadius: 8,
            background: '#22c55e', color: '#000',
            fontSize: 11, fontWeight: 900,
          }}
        >
          ACCETTATA ✓
        </div>
      )}

      {/* Image */}
      <div
        style={{
          aspectRatio: format === 'story' ? '9/16' : '1/1',
          maxHeight: format === 'story' ? 500 : 350,
          background: 'var(--surface)',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {creative.generatedImage ? (
          <img
            src={creative.generatedImage}
            alt="AI generated"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : creative.imageError ? (
          <div style={{ padding: 24, textAlign: 'center' }}>
            <div style={{ color: '#ef4444', fontSize: 13, fontWeight: 700, marginBottom: 8 }}>
              Generazione immagine fallita
            </div>
            <div style={{ color: '#6b6580', fontSize: 11, lineHeight: 1.5 }}>
              {creative.imageError}
            </div>
          </div>
        ) : (
          <div style={{ color: '#4a4060', fontSize: 12 }}>Generazione in corso…</div>
        )}

        {creative.imageModel && creative.generatedImage && (
          <div
            style={{
              position: 'absolute', bottom: 8, right: 8,
              padding: '4px 10px', borderRadius: 8,
              background: '#0008', color: '#c4b5fd',
              fontSize: 10, fontWeight: 700,
            }}
          >
            {creative.imageModel}
          </div>
        )}
      </div>

      {/* Copy */}
      <div style={{ padding: 18 }}>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          <span
            style={{
              padding: '3px 10px', borderRadius: 6,
              background: '#8b5cf620', border: '1px solid #8b5cf630',
              color: '#c4b5fd', fontSize: 10, fontWeight: 800,
              textTransform: 'uppercase', letterSpacing: '0.06em',
            }}
          >
            {creative.angle || 'Creative'}
          </span>
          {creative.funnelStage && (
            <span
              style={{
                padding: '3px 10px', borderRadius: 6,
                background: `${(FUNNEL_STAGES.find(f => f.id === creative.funnelStage) || {}).color || '#555'}20`,
                border: `1px solid ${(FUNNEL_STAGES.find(f => f.id === creative.funnelStage) || {}).color || '#555'}30`,
                color: (FUNNEL_STAGES.find(f => f.id === creative.funnelStage) || {}).color || '#888',
                fontSize: 10, fontWeight: 800, textTransform: 'uppercase',
              }}
            >
              {creative.funnelStage}
            </span>
          )}
          {creative.persona && (
            <span
              style={{
                padding: '3px 10px', borderRadius: 6,
                background: '#06b6d420', border: '1px solid #06b6d430',
                color: '#06b6d4', fontSize: 10, fontWeight: 800,
              }}
            >
              {creative.persona}
            </span>
          )}
        </div>

        {creative.productTitle && (
          <div style={{ color: '#6b6580', fontSize: 10, fontWeight: 700, marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {creative.productTitle}
          </div>
        )}

        <div style={{ color: '#fff', fontSize: 17, fontWeight: 950, lineHeight: 1.25, marginBottom: 10, letterSpacing: '-0.02em' }}>
          {creative.headline}
        </div>

        <div style={{ color: '#c8c0d6', fontSize: 13, lineHeight: 1.55, marginBottom: 12 }}>
          {creative.primaryText}
        </div>

        {creative.description && (
          <div style={{ color: '#8b8aa0', fontSize: 12, lineHeight: 1.4, marginBottom: 12, fontStyle: 'italic' }}>
            {creative.description}
          </div>
        )}

        <div
          style={{
            display: 'inline-block', padding: '7px 18px', borderRadius: 8,
            background: '#8b5cf6', color: '#fff', fontSize: 12, fontWeight: 800,
          }}
        >
          {creative.cta || 'Acquista ora'}
        </div>

        {creative.reasoning && (
          <div
            style={{
              padding: 12, borderRadius: 10,
              background: 'var(--glass)', border: '1px solid var(--border)', marginTop: 12,
            }}
          >
            <div style={{ color: '#6b6580', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 4 }}>
              Perché funziona
            </div>
            <div style={{ color: '#8b8aa0', fontSize: 11, lineHeight: 1.5 }}>
              {creative.reasoning}
            </div>
          </div>
        )}

        {/* Accept / Reject */}
        {!accepted && (
          <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
            <button
              onClick={onAccept}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #22c55e40',
                background: '#22c55e15', color: '#22c55e', fontSize: 13, fontWeight: 800, cursor: 'pointer',
              }}
            >
              ✓ Accetta
            </button>
            <button
              onClick={onReject}
              disabled={rejecting}
              style={{
                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid var(--border)',
                background: 'var(--glass)', color: rejecting ? '#4a4060' : '#c8c0d6',
                fontSize: 13, fontWeight: 800, cursor: rejecting ? 'wait' : 'pointer',
              }}
            >
              {rejecting ? '…' : '↻ Rigenera'}
            </button>
          </div>
        )}

        {accepted && creative.generatedImage && (
          <a
            href={creative.generatedImage}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-block', marginTop: 12, padding: '8px 16px',
              borderRadius: 8, background: 'var(--glass)', border: '1px solid var(--border)',
              color: '#c8c0d6', fontSize: 12, fontWeight: 700, textDecoration: 'none',
            }}
          >
            Scarica immagine ↓
          </a>
        )}
      </div>
    </div>
  )
}

export default function CreativeLabTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState([])
  const [style, setStyle] = useState('performance')
  const [funnelStage, setFunnelStage] = useState('tofu')
  const [format, setFormat] = useState('square')
  const [imageModel, setImageModel] = useState('gpt-image-1')
  const [search, setSearch] = useState('')
  const [refImages, setRefImages] = useState({})
  const [manualBrief, setManualBrief] = useState({ context: '', persona: '', productFeatures: '' })
  const [generating, setGenerating] = useState(false)
  const [creatives, setCreatives] = useState([])
  const [accepted, setAccepted] = useState({})
  const [rejectingIdx, setRejectingIdx] = useState(null)
  const [genError, setGenError] = useState(null)

  function compressImage(file) {
    return new Promise((resolve) => {
      const reader = new FileReader()
      reader.onload = (e) => {
        const img = new Image()
        img.onload = () => {
          const canvas = document.createElement('canvas')
          const max = 800
          let w = img.width, h = img.height
          if (w > max || h > max) {
            if (w > h) { h = Math.round(h * max / w); w = max }
            else { w = Math.round(w * max / h); h = max }
          }
          canvas.width = w; canvas.height = h
          canvas.getContext('2d').drawImage(img, 0, 0, w, h)
          resolve(canvas.toDataURL('image/jpeg', 0.8))
        }
        img.src = e.target.result
      }
      reader.readAsDataURL(file)
    })
  }

  async function handleRefUpload(productTitle, files) {
    const existing = refImages[productTitle] || []
    const remaining = 3 - existing.length
    if (remaining <= 0) return
    const toProcess = Array.from(files).slice(0, remaining)
    const compressed = await Promise.all(toProcess.map(compressImage))
    setRefImages((prev) => ({
      ...prev,
      [productTitle]: [...(prev[productTitle] || []), ...compressed],
    }))
  }

  function removeRef(productTitle, idx) {
    setRefImages((prev) => ({
      ...prev,
      [productTitle]: (prev[productTitle] || []).filter((_, i) => i !== idx),
    }))
  }

  useEffect(() => { loadData(1) }, [])

  async function loadData(p, q) {
    setLoading(true)
    const query = q !== undefined ? q : search
    try {
      const params = new URLSearchParams({ page: p, perPage: 20 })
      if (query) params.set('search', query)
      const res = await fetch(`/api/creative-lab?${params}`, { cache: 'no-store' })
      const json = await res.json()
      setData(json)
      setPage(p)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function changePage(p) {
    loadData(p)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  function toggleProduct(handle) {
    setSelected((prev) =>
      prev.includes(handle) ? prev.filter((h) => h !== handle) : prev.length >= 4 ? prev : [...prev, handle]
    )
  }

  async function generate() {
    if (!selected.length || generating) return
    setGenerating(true)
    setGenError(null)
    setCreatives([])
    setAccepted({})

    const selectedProducts = (data?.products || []).filter((p) => selected.includes(p.handle))

    try {
      const res = await fetch('/api/creative-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: selectedProducts.map((p) => ({
            title: p.title, price: p.price, description: p.description,
            productType: p.productType, tags: p.tags?.slice(0, 5),
            salesRevenue: p.sales?.revenue, salesOrders: p.sales?.orders,
          })),
          bestAds: (data?.bestAds || []).slice(0, 5),
          competitors: data?.competitorSummary || [],
          productReferences: refImages,
          manualBrief,
          style, funnelStage, format, imageModel, generateImages: true,
        }),
      })
      const json = await res.json()
      if (json.error) {
        setGenError(json.error)
      } else {
        setCreatives(json.creatives || [])
      }
    } catch (e) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  async function regenerateSingle(idx) {
    const creative = creatives[idx]
    if (!creative || rejectingIdx !== null) return
    setRejectingIdx(idx)

    const product = (data?.products || []).find(
      (p) => creative.productTitle && p.title.toLowerCase().includes(creative.productTitle.toLowerCase())
    ) || (data?.products || []).find((p) => selected.includes(p.handle))

    try {
      const res = await fetch('/api/creative-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: [product ? {
            title: product.title, price: product.price, description: product.description,
            productType: product.productType, tags: product.tags?.slice(0, 5),
            salesRevenue: product.sales?.revenue,
          } : { title: creative.productTitle }],
          bestAds: (data?.bestAds || []).slice(0, 5),
          competitors: data?.competitorSummary || [],
          productReferences: refImages,
          manualBrief,
          style, funnelStage, format, imageModel, generateImages: true, singleIndex: idx,
        }),
      })
      const json = await res.json()
      if (json.creatives?.[0]) {
        setCreatives((prev) => prev.map((c, i) => (i === idx ? json.creatives[0] : c)))
      }
    } catch (e) {
      console.error(e)
    } finally {
      setRejectingIdx(null)
    }
  }

  const products = data?.products || []
  const bestAds = data?.bestAds || []
  const models = data?.availableModels || []

  return (
    <div>
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ margin: 0, color: '#fff', fontSize: 32, fontWeight: 950, letterSpacing: '-0.04em' }}>
          Creative Lab
        </h1>
        <p style={{ margin: '8px 0 0', color: '#8b8aa0', fontSize: 14 }}>
          Genera ad creative basate su best seller, performance ads e analisi competitor
        </p>
      </div>

      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 80, color: '#6b6580' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Carico dati prodotti e performance…</div>
        </div>
      )}

      {data && (
        <>
          {/* Best Ads */}
          {bestAds.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 10 }}>
                Top ads per ROAS (ultimi 28g)
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                {bestAds.slice(0, 6).map((ad, i) => (
                  <div key={i} style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 12, padding: 14, minWidth: 200 }}>
                    <div style={{ color: '#fff', fontSize: 12, fontWeight: 800, marginBottom: 6, lineHeight: 1.3, maxHeight: 30, overflow: 'hidden' }}>
                      {ad.name || 'Ad'}
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4, fontSize: 11 }}>
                      <div><span style={{ color: '#6b6580' }}>ROAS </span><span style={{ color: '#22c55e', fontWeight: 900 }}>{(ad.roas || 0).toFixed(2)}</span></div>
                      <div><span style={{ color: '#6b6580' }}>Rev </span><span style={{ color: '#22c55e', fontWeight: 800 }}>{money(ad.revenue)}</span></div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 22, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 900 }}>Seleziona prodotti</h2>
                <p style={{ margin: '6px 0 0', color: '#6b6580', fontSize: 12 }}>
                  {data.totalProducts} prodotti totali · Ordinati per vendite · Pagina {data.page}/{data.totalPages}
                </p>
              </div>
              <span style={{ color: '#8b8aa0', fontSize: 13, fontWeight: 800 }}>
                {selected.length}/4 selezionati
              </span>
            </div>

            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                clearTimeout(window.__clSearchTimer)
                window.__clSearchTimer = setTimeout(() => loadData(1, e.target.value), 400)
              }}
              placeholder="Cerca prodotto per nome…"
              style={{
                width: '100%',
                padding: '12px 18px',
                borderRadius: 12,
                border: '1px solid var(--border)',
                background: 'var(--glass)',
                color: '#fff',
                fontSize: 14,
                fontWeight: 600,
                outline: 'none',
                marginBottom: 16,
                boxSizing: 'border-box',
              }}
            />

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {products.map((p) => {
                const isSel = selected.includes(p.handle)
                return (
                  <button
                    key={p.handle} type="button"
                    onClick={() => toggleProduct(p.handle)}
                    style={{
                      background: isSel ? '#6d28d915' : 'var(--glass)',
                      border: `2px solid ${isSel ? '#8b5cf6' : 'var(--border)'}`,
                      borderRadius: 14, padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1/1', background: 'var(--surface)', overflow: 'hidden', position: 'relative' }}>
                      {p.image ? (
                        <img src={p.image} alt={p.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#4a4060', fontSize: 11 }}>No img</div>
                      )}
                      {isSel && (
                        <div style={{ position: 'absolute', top: 6, right: 6, width: 24, height: 24, borderRadius: 999, background: '#8b5cf6', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: 13, fontWeight: 900 }}>✓</div>
                      )}
                      {p.sales && (
                        <div style={{ position: 'absolute', bottom: 6, left: 6, padding: '3px 8px', borderRadius: 6, background: '#000a', color: '#22c55e', fontSize: 10, fontWeight: 800 }}>
                          {money(p.sales.revenue)}
                        </div>
                      )}
                    </div>
                    <div style={{ padding: '8px 10px' }}>
                      <div style={{ color: '#fff', fontSize: 11, fontWeight: 800, lineHeight: 1.25, maxHeight: 28, overflow: 'hidden' }}>{p.title}</div>
                      <div style={{ color: '#22c55e', fontSize: 12, fontWeight: 900, fontFamily: 'Barlow', marginTop: 4 }}>{money(p.price)}</div>
                    </div>
                  </button>
                )
              })}
            </div>

            <Pagination page={data.page} totalPages={data.totalPages} onPageChange={changePage} />
          </div>

          {/* Reference Images Upload */}
          {selected.length > 0 && (
            <div
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                borderRadius: 18,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 4 }}>
                Foto reference prodotto (opzionale)
              </div>
              <div style={{ fontSize: 11, color: '#4a4060', marginBottom: 16 }}>
                Carica fino a 3 foto per prodotto — l&apos;AI analizzerà colori, materiali e dettagli per generare immagini più fedeli
              </div>

              {selected.map((handle) => {
                const product = products.find((p) => p.handle === handle)
                if (!product) return null
                const refs = refImages[product.title] || []

                return (
                  <div
                    key={handle}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 14,
                      padding: '12px 0',
                      borderBottom: '1px solid var(--border)',
                    }}
                  >
                    {/* Product thumb */}
                    <div style={{ width: 48, height: 48, borderRadius: 10, overflow: 'hidden', flexShrink: 0, background: 'var(--surface)' }}>
                      {product.image && <img src={product.image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                    </div>

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ color: '#fff', fontSize: 13, fontWeight: 800, marginBottom: 4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {product.title}
                      </div>

                      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                        {/* Uploaded previews */}
                        {refs.map((src, i) => (
                          <div key={i} style={{ position: 'relative', width: 40, height: 40, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--border)' }}>
                            <img src={src} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            <button
                              onClick={() => removeRef(product.title, i)}
                              style={{
                                position: 'absolute', top: -4, right: -4,
                                width: 16, height: 16, borderRadius: 999,
                                background: '#ef4444', border: 'none', color: '#fff',
                                fontSize: 10, fontWeight: 900, cursor: 'pointer',
                                display: 'flex', alignItems: 'center', justifyContent: 'center',
                              }}
                            >
                              ×
                            </button>
                          </div>
                        ))}

                        {/* Upload button */}
                        {refs.length < 3 && (
                          <label
                            style={{
                              width: 40, height: 40, borderRadius: 8,
                              border: '1px dashed var(--border)', background: 'var(--glass)',
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              cursor: 'pointer', color: '#6b6580', fontSize: 18,
                            }}
                          >
                            +
                            <input
                              type="file"
                              accept="image/*"
                              multiple
                              style={{ display: 'none' }}
                              onChange={(e) => handleRefUpload(product.title, e.target.files)}
                            />
                          </label>
                        )}

                        <span style={{ color: '#4a4060', fontSize: 10, marginLeft: 4 }}>
                          {refs.length}/3
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {/* Manual Brief */}
          {selected.length > 0 && (
            <div
              style={{
                background: 'var(--glass)',
                border: '1px solid var(--border)',
                borderRadius: 18,
                padding: 20,
                marginBottom: 20,
              }}
            >
              <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 4 }}>
                Brief manuale (opzionale)
              </div>
              <div style={{ fontSize: 11, color: '#4a4060', marginBottom: 16 }}>
                Aggiungi dettagli che l&apos;AI deve considerare nella generazione
              </div>

              <div style={{ display: 'grid', gap: 14 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b6580', fontWeight: 700, marginBottom: 6 }}>
                    Contesto / Ambientazione
                  </label>
                  <textarea
                    value={manualBrief.context}
                    onChange={(e) => setManualBrief((p) => ({ ...p, context: e.target.value }))}
                    placeholder="Es: Ambientazione in un box CrossFit durante un WOD, atmosfera intensa con luci al neon..."
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--glass)',
                      color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b6580', fontWeight: 700, marginBottom: 6 }}>
                    Buyer Persona target
                  </label>
                  <textarea
                    value={manualBrief.persona}
                    onChange={(e) => setManualBrief((p) => ({ ...p, persona: e.target.value }))}
                    placeholder="Es: Donna 28-35, fa HYROX, corre 3x/settimana + functional 2x, primo acquisto di paracalli..."
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--glass)',
                      color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 11, color: '#6b6580', fontWeight: 700, marginBottom: 6 }}>
                    Caratteristiche prodotto da evidenziare
                  </label>
                  <textarea
                    value={manualBrief.productFeatures}
                    onChange={(e) => setManualBrief((p) => ({ ...p, productFeatures: e.target.value }))}
                    placeholder="Es: Zero magnesite, grip ultra-sottile 2mm, cuciture rinforzate, pelle vegana, colorazione nera/rossa..."
                    rows={2}
                    style={{
                      width: '100%', padding: '10px 14px', borderRadius: 10,
                      border: '1px solid var(--border)', background: 'var(--glass)',
                      color: '#fff', fontSize: 13, fontWeight: 600, outline: 'none',
                      resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box',
                    }}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Funnel Stage Selector */}
          <div
            style={{
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              borderRadius: 18,
              padding: 20,
              marginBottom: 20,
            }}
          >
            <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 12 }}>
              Fase del Funnel — Andromeda Variance
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
              {FUNNEL_STAGES.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFunnelStage(f.id)}
                  style={{
                    padding: '14px 16px',
                    borderRadius: 14,
                    border: `2px solid ${funnelStage === f.id ? f.color : 'var(--border)'}`,
                    background: funnelStage === f.id ? `${f.color}15` : 'var(--glass)',
                    cursor: 'pointer',
                    textAlign: 'left',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ width: 8, height: 8, borderRadius: 999, background: f.color }} />
                    <span style={{ color: funnelStage === f.id ? '#fff' : '#8b8aa0', fontSize: 14, fontWeight: 900 }}>{f.label}</span>
                    <span style={{ color: '#6b6580', fontSize: 10, fontWeight: 700 }}>{f.fullLabel}</span>
                  </div>
                  <div style={{ color: funnelStage === f.id ? '#c8c0d6' : '#4a4060', fontSize: 11, lineHeight: 1.4, fontWeight: 600 }}>
                    {f.desc}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'end', flexWrap: 'wrap', marginBottom: 28 }}>
            {/* Style */}
            <div>
              <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 8 }}>Stile</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {STYLES.map((s) => (
                  <button key={s.id} onClick={() => setStyle(s.id)} title={s.desc}
                    style={{
                      padding: '9px 16px', borderRadius: 10,
                      border: `1px solid ${style === s.id ? '#8b5cf6' : 'var(--border)'}`,
                      background: style === s.id ? '#8b5cf620' : 'var(--glass)',
                      color: style === s.id ? '#c4b5fd' : '#8b8aa0',
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >{s.label}</button>
                ))}
              </div>
            </div>

            {/* Format */}
            <div>
              <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 8 }}>Formato</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {FORMATS.map((f) => (
                  <button key={f.id} onClick={() => setFormat(f.id)}
                    style={{
                      padding: '9px 14px', borderRadius: 10,
                      border: `1px solid ${format === f.id ? '#8b5cf6' : 'var(--border)'}`,
                      background: format === f.id ? '#8b5cf620' : 'var(--glass)',
                      color: format === f.id ? '#c4b5fd' : '#8b8aa0',
                      fontSize: 12, fontWeight: 800, cursor: 'pointer',
                    }}
                  >{f.label}</button>
                ))}
              </div>
            </div>

            {/* Image Model */}
            <div>
              <div style={{ fontSize: 10, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 8 }}>Modello immagine</div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(models.length > 0 ? models : [
                  { id: 'gpt-image-1', name: 'GPT Image', ready: true },
                  { id: 'gemini', name: 'Gemini', ready: false },
                  { id: 'dall-e-3', name: 'DALL-E 3', ready: true },
                ]).map((m) => (
                  <button key={m.id} onClick={() => m.ready && setImageModel(m.id)}
                    style={{
                      padding: '9px 14px', borderRadius: 10,
                      border: `1px solid ${imageModel === m.id ? '#8b5cf6' : 'var(--border)'}`,
                      background: imageModel === m.id ? '#8b5cf620' : 'var(--glass)',
                      color: !m.ready ? '#4a4060' : imageModel === m.id ? '#c4b5fd' : '#8b8aa0',
                      fontSize: 12, fontWeight: 800,
                      cursor: m.ready ? 'pointer' : 'not-allowed',
                      opacity: m.ready ? 1 : 0.6,
                    }}
                    title={m.ready ? m.name : `${m.name} — API key non configurata`}
                  >
                    {m.name}{!m.ready && ' 🔒'}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={generate}
              disabled={!selected.length || generating}
              style={{
                padding: '12px 28px', borderRadius: 12, border: 'none', marginLeft: 'auto',
                background: selected.length && !generating ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : 'var(--glass)',
                color: selected.length && !generating ? '#fff' : '#6b6580',
                fontSize: 14, fontWeight: 900, cursor: selected.length && !generating ? 'pointer' : 'not-allowed',
                boxShadow: selected.length && !generating ? '0 4px 20px rgba(139,92,246,.3)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {generating ? 'Generazione…' : `Genera ${selected.length > 0 ? selected.length * 3 : 0} Creative`}
            </button>
          </div>

          {/* Generating */}
          {generating && (
            <div style={{ textAlign: 'center', padding: 50, color: '#8b8aa0' }}>
              <div style={{ fontSize: 18, marginBottom: 10 }}>✧</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd' }}>
                L&apos;AI sta generando copy e immagini…
              </div>
              <div style={{ fontSize: 12, marginTop: 6, color: '#6b6580' }}>
                GPT-4o per il copy + {imageModel === 'gpt-image-1' ? 'GPT Image' : imageModel === 'gemini' ? 'Gemini' : 'DALL-E 3'} per le immagini · 20-40 secondi
              </div>
            </div>
          )}

          {genError && (
            <div style={{ padding: 18, borderRadius: 14, background: '#ef444415', border: '1px solid #ef444430', color: '#ef4444', fontSize: 13, marginBottom: 20 }}>
              <strong>Errore:</strong> {genError}
            </div>
          )}

          {/* Results — Preview Cards */}
          {creatives.length > 0 && !generating && (
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
                <div>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 950 }}>Preview Creative</h2>
                  <p style={{ margin: '6px 0 0', color: '#6b6580', fontSize: 12 }}>
                    {creatives.length} varianti · Accetta quelle che ti piacciono, rigenera le altre
                  </p>
                </div>
                <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 800 }}>
                  {Object.keys(accepted).length} accettate
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 16 }}>
                {creatives.map((c, i) => {
                  const product = products.find(
                    (p) => c.productTitle && (
                      p.title.toLowerCase().includes(c.productTitle.toLowerCase()) ||
                      c.productTitle.toLowerCase().includes(p.title.toLowerCase())
                    )
                  )
                  return (
                    <PreviewCard
                      key={`${i}-${c.headline}`}
                      creative={c}
                      productImage={product?.image}
                      format={format}
                      accepted={!!accepted[i]}
                      rejecting={rejectingIdx === i}
                      onAccept={() => setAccepted((prev) => ({ ...prev, [i]: true }))}
                      onReject={() => regenerateSingle(i)}
                    />
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
