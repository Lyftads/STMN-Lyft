'use client'

import { useEffect, useState } from 'react'

const STYLES = [
  { id: 'performance', label: 'Performance', desc: 'Direct response, CTA forte' },
  { id: 'ugc', label: 'UGC', desc: 'Tono autentico, da atleta' },
  { id: 'lifestyle', label: 'Lifestyle', desc: 'Aspirazionale, mood' },
  { id: 'comparison', label: 'Comparison', desc: 'Noi vs competitor' },
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
          padding: '8px 14px', borderRadius: 8, border: '1px solid #332a41',
          background: '#1a1425', color: page <= 1 ? '#4a4060' : '#c8c0d6',
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
              border: `1px solid ${p === page ? '#8b5cf6' : '#332a41'}`,
              background: p === page ? '#8b5cf620' : '#1a1425',
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
          padding: '8px 14px', borderRadius: 8, border: '1px solid #332a41',
          background: '#1a1425', color: page >= totalPages ? '#4a4060' : '#c8c0d6',
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
        background: '#14111d',
        border: `2px solid ${accepted ? '#22c55e' : '#2c2638'}`,
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
          background: '#0a0818',
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
        <div
          style={{
            display: 'inline-block', padding: '3px 10px', borderRadius: 6,
            background: '#8b5cf620', border: '1px solid #8b5cf630',
            color: '#c4b5fd', fontSize: 10, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10,
          }}
        >
          {creative.angle || 'Creative'}
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
              background: '#0d0a16', border: '1px solid #252033', marginTop: 12,
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
                flex: 1, padding: '10px', borderRadius: 10, border: '1px solid #332a41',
                background: '#1a1425', color: rejecting ? '#4a4060' : '#c8c0d6',
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
              borderRadius: 8, background: '#1a1425', border: '1px solid #332a41',
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
  const [format, setFormat] = useState('square')
  const [imageModel, setImageModel] = useState('dall-e-3')
  const [generating, setGenerating] = useState(false)
  const [creatives, setCreatives] = useState([])
  const [accepted, setAccepted] = useState({})
  const [rejectingIdx, setRejectingIdx] = useState(null)
  const [genError, setGenError] = useState(null)

  useEffect(() => { loadData(1) }, [])

  async function loadData(p) {
    setLoading(true)
    try {
      const res = await fetch(`/api/creative-lab?page=${p}&perPage=20`, { cache: 'no-store' })
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
          style, format, imageModel, generateImages: true,
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
          style, format, imageModel, generateImages: true, singleIndex: idx,
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
                  <div key={i} style={{ background: '#0d0a16', border: '1px solid #252033', borderRadius: 12, padding: 14, minWidth: 200 }}>
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
          <div style={{ background: '#14111d', border: '1px solid #2c2638', borderRadius: 22, padding: 24, marginBottom: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
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

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 12 }}>
              {products.map((p) => {
                const isSel = selected.includes(p.handle)
                return (
                  <button
                    key={p.handle} type="button"
                    onClick={() => toggleProduct(p.handle)}
                    style={{
                      background: isSel ? '#6d28d915' : '#0d0a16',
                      border: `2px solid ${isSel ? '#8b5cf6' : '#252033'}`,
                      borderRadius: 14, padding: 0, cursor: 'pointer', textAlign: 'left', overflow: 'hidden',
                    }}
                  >
                    <div style={{ width: '100%', aspectRatio: '1/1', background: '#0a0818', overflow: 'hidden', position: 'relative' }}>
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
                      border: `1px solid ${style === s.id ? '#8b5cf6' : '#332a41'}`,
                      background: style === s.id ? '#8b5cf620' : '#1a1425',
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
                      border: `1px solid ${format === f.id ? '#8b5cf6' : '#332a41'}`,
                      background: format === f.id ? '#8b5cf620' : '#1a1425',
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
                  { id: 'dall-e-3', name: 'DALL-E 3', ready: true },
                  { id: 'gpt-image-1', name: 'GPT Image', ready: true },
                  { id: 'gemini', name: 'Gemini', ready: false },
                  { id: 'nanabanan', name: 'NanaBanan Pro', ready: false },
                ]).map((m) => (
                  <button key={m.id} onClick={() => m.ready && setImageModel(m.id)}
                    style={{
                      padding: '9px 14px', borderRadius: 10,
                      border: `1px solid ${imageModel === m.id ? '#8b5cf6' : '#332a41'}`,
                      background: imageModel === m.id ? '#8b5cf620' : '#1a1425',
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
                background: selected.length && !generating ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)' : '#1a1425',
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
