'use client'

import { useEffect, useMemo, useState } from 'react'

const STYLES = [
  { id: 'performance', label: 'Performance', desc: 'Direct response, benefit-driven, CTA forte' },
  { id: 'ugc', label: 'UGC', desc: 'Tono personale, autentico, come un atleta vero' },
  { id: 'lifestyle', label: 'Lifestyle', desc: 'Aspirazionale, mood-driven, meno copy' },
  { id: 'comparison', label: 'Comparison', desc: 'Noi vs competitor, before/after' },
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

function ProductSelector({ products, selected, onToggle }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
        gap: 12,
      }}
    >
      {products.map((p) => {
        const isSelected = selected.includes(p.handle)
        return (
          <button
            key={p.handle}
            type="button"
            onClick={() => onToggle(p.handle)}
            style={{
              background: isSelected ? '#6d28d915' : '#14111d',
              border: `2px solid ${isSelected ? '#8b5cf6' : '#2c2638'}`,
              borderRadius: 16,
              padding: 0,
              cursor: 'pointer',
              textAlign: 'left',
              overflow: 'hidden',
              transition: 'border-color .15s',
            }}
          >
            <div
              style={{
                width: '100%',
                aspectRatio: '1/1',
                background: '#0a0818',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative',
              }}
            >
              {p.image ? (
                <img
                  src={p.image}
                  alt={p.title}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : (
                <span style={{ color: '#4a4060', fontSize: 11 }}>No img</span>
              )}
              {isSelected && (
                <div
                  style={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    width: 26,
                    height: 26,
                    borderRadius: 999,
                    background: '#8b5cf6',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: '#fff',
                    fontSize: 14,
                    fontWeight: 900,
                  }}
                >
                  ✓
                </div>
              )}
            </div>
            <div style={{ padding: '10px 12px' }}>
              <div
                style={{
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  lineHeight: 1.3,
                  maxHeight: 32,
                  overflow: 'hidden',
                  marginBottom: 4,
                }}
              >
                {p.title}
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ color: '#22c55e', fontSize: 13, fontWeight: 900, fontFamily: 'Barlow' }}>
                  {money(p.price)}
                </span>
                {p.sales && (
                  <span style={{ color: '#8b8aa0', fontSize: 10, fontWeight: 700 }}>
                    {money(p.sales.revenue)} rev
                  </span>
                )}
              </div>
            </div>
          </button>
        )
      })}
    </div>
  )
}

function CreativeCard({ creative, productImage, format }) {
  const [imgLoaded, setImgLoaded] = useState(false)

  return (
    <div
      style={{
        background: '#14111d',
        border: '1px solid #2c2638',
        borderRadius: 22,
        overflow: 'hidden',
      }}
    >
      {/* Generated image */}
      <div
        style={{
          aspectRatio: format === 'story' ? '9/16' : '1/1',
          maxHeight: format === 'story' ? 500 : 350,
          background: '#0a0818',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        {creative.generatedImage ? (
          <img
            src={creative.generatedImage}
            alt="AI generated ad concept"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            onLoad={() => setImgLoaded(true)}
          />
        ) : productImage ? (
          <img
            src={productImage}
            alt="Product"
            style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.6 }}
          />
        ) : (
          <div style={{ color: '#4a4060', fontSize: 13 }}>Immagine non generata</div>
        )}

        {creative.generatedImage && (
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 8,
              padding: '4px 10px',
              borderRadius: 8,
              background: '#0008',
              color: '#c4b5fd',
              fontSize: 10,
              fontWeight: 700,
            }}
          >
            AI Generated
          </div>
        )}
      </div>

      {/* Copy */}
      <div style={{ padding: 20 }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 12,
          }}
        >
          <span
            style={{
              padding: '4px 10px',
              borderRadius: 8,
              background: '#8b5cf620',
              border: '1px solid #8b5cf630',
              color: '#c4b5fd',
              fontSize: 10,
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
            }}
          >
            {creative.angle || 'Creative'}
          </span>
        </div>

        {creative.productTitle && (
          <div style={{ color: '#6b6580', fontSize: 11, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            {creative.productTitle}
          </div>
        )}

        <div style={{ color: '#fff', fontSize: 18, fontWeight: 950, lineHeight: 1.25, marginBottom: 12, letterSpacing: '-0.02em' }}>
          {creative.headline}
        </div>

        <div style={{ color: '#c8c0d6', fontSize: 13, lineHeight: 1.6, marginBottom: 14 }}>
          {creative.primaryText}
        </div>

        {creative.description && (
          <div style={{ color: '#8b8aa0', fontSize: 12, lineHeight: 1.5, marginBottom: 14, fontStyle: 'italic' }}>
            {creative.description}
          </div>
        )}

        <div
          style={{
            display: 'inline-block',
            padding: '8px 20px',
            borderRadius: 8,
            background: '#8b5cf6',
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            marginBottom: 14,
          }}
        >
          {creative.cta || 'Acquista ora'}
        </div>

        {creative.reasoning && (
          <div
            style={{
              padding: 14,
              borderRadius: 10,
              background: '#0d0a16',
              border: '1px solid #252033',
              marginTop: 8,
            }}
          >
            <div style={{ color: '#6b6580', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 6 }}>
              Perché funziona
            </div>
            <div style={{ color: '#8b8aa0', fontSize: 12, lineHeight: 1.5 }}>
              {creative.reasoning}
            </div>
          </div>
        )}

        {/* Download image */}
        {creative.generatedImage && (
          <a
            href={creative.generatedImage}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              marginTop: 12,
              padding: '8px 16px',
              borderRadius: 8,
              background: '#1a1425',
              border: '1px solid #332a41',
              color: '#c8c0d6',
              fontSize: 12,
              fontWeight: 700,
              textDecoration: 'none',
            }}
          >
            Scarica immagine ↓
          </a>
        )}
      </div>
    </div>
  )
}

function BestAdInsight({ ad }) {
  return (
    <div
      style={{
        background: '#0d0a16',
        border: '1px solid #252033',
        borderRadius: 12,
        padding: 14,
        minWidth: 220,
      }}
    >
      <div style={{ color: '#fff', fontSize: 12, fontWeight: 800, marginBottom: 6, lineHeight: 1.3, maxHeight: 30, overflow: 'hidden' }}>
        {ad.name || 'Ad senza nome'}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontSize: 11 }}>
        <div>
          <span style={{ color: '#6b6580' }}>ROAS </span>
          <span style={{ color: '#22c55e', fontWeight: 900 }}>{(ad.roas || 0).toFixed(2)}</span>
        </div>
        <div>
          <span style={{ color: '#6b6580' }}>CTR </span>
          <span style={{ color: '#60a5fa', fontWeight: 900 }}>{(ad.ctr || 0).toFixed(2)}%</span>
        </div>
        <div>
          <span style={{ color: '#6b6580' }}>Spend </span>
          <span style={{ color: '#fff', fontWeight: 800 }}>{money(ad.spend)}</span>
        </div>
        <div>
          <span style={{ color: '#6b6580' }}>Rev </span>
          <span style={{ color: '#22c55e', fontWeight: 800 }}>{money(ad.revenue)}</span>
        </div>
      </div>
    </div>
  )
}

export default function CreativeLabTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selected, setSelected] = useState([])
  const [style, setStyle] = useState('performance')
  const [format, setFormat] = useState('square')
  const [generating, setGenerating] = useState(false)
  const [results, setResults] = useState(null)
  const [genError, setGenError] = useState(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    setLoading(true)
    try {
      const res = await fetch('/api/creative-lab', { cache: 'no-store' })
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  function toggleProduct(handle) {
    setSelected((prev) =>
      prev.includes(handle)
        ? prev.filter((h) => h !== handle)
        : prev.length >= 4
          ? prev
          : [...prev, handle]
    )
  }

  async function generate() {
    if (!selected.length || generating) return
    setGenerating(true)
    setGenError(null)
    setResults(null)

    const selectedProducts = (data?.products || []).filter((p) => selected.includes(p.handle))

    try {
      const res = await fetch('/api/creative-lab', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          products: selectedProducts.map((p) => ({
            title: p.title,
            price: p.price,
            description: p.description,
            productType: p.productType,
            tags: p.tags?.slice(0, 5),
            salesRevenue: p.sales?.revenue,
            salesOrders: p.sales?.orders,
          })),
          bestAds: (data?.bestAds || []).slice(0, 5),
          competitors: data?.competitorSummary || [],
          style,
          format,
          count: 3,
          generateImages: true,
        }),
      })

      const json = await res.json()
      if (json.error) {
        setGenError(json.error)
      } else {
        setResults(json)
      }
    } catch (e) {
      setGenError(e.message)
    } finally {
      setGenerating(false)
    }
  }

  const products = data?.products || []
  const bestAds = data?.bestAds || []

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1
          style={{
            margin: 0,
            color: '#fff',
            fontSize: 32,
            fontWeight: 950,
            letterSpacing: '-0.04em',
          }}
        >
          Creative Lab
        </h1>
        <p style={{ margin: '8px 0 0', color: '#8b8aa0', fontSize: 14 }}>
          Genera ad creative basate sui best seller, performance ads e analisi competitor
        </p>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div style={{ textAlign: 'center', padding: 80, color: '#6b6580' }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>Carico dati prodotti e performance…</div>
        </div>
      )}

      {data && (
        <>
          {/* Best Performing Ads Insights */}
          {bestAds.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <div
                style={{
                  fontSize: 10,
                  color: '#8b8aa0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 800,
                  marginBottom: 10,
                }}
              >
                Top ads per ROAS (ultimi 28g) — l&apos;AI usa questi dati per generare
              </div>
              <div style={{ display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6 }}>
                {bestAds.slice(0, 6).map((ad, i) => (
                  <BestAdInsight key={i} ad={ad} />
                ))}
              </div>
            </div>
          )}

          {/* Product Selection */}
          <div
            style={{
              background: '#14111d',
              border: '1px solid #2c2638',
              borderRadius: 22,
              padding: 24,
              marginBottom: 24,
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: 18,
              }}
            >
              <div>
                <h2 style={{ margin: 0, color: '#fff', fontSize: 18, fontWeight: 900 }}>
                  Seleziona prodotti
                </h2>
                <p style={{ margin: '6px 0 0', color: '#6b6580', fontSize: 12 }}>
                  Scegli fino a 4 prodotti · Ordinati per revenue
                </p>
              </div>
              <span style={{ color: '#8b8aa0', fontSize: 13, fontWeight: 800 }}>
                {selected.length}/4 selezionati
              </span>
            </div>

            <ProductSelector products={products} selected={selected} onToggle={toggleProduct} />
          </div>

          {/* Style & Format */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto auto',
              gap: 16,
              alignItems: 'end',
              marginBottom: 28,
            }}
          >
            {/* Stile */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: '#8b8aa0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 800,
                  marginBottom: 10,
                }}
              >
                Stile creativo
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {STYLES.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setStyle(s.id)}
                    style={{
                      padding: '10px 18px',
                      borderRadius: 12,
                      border: `1px solid ${style === s.id ? '#8b5cf6' : '#332a41'}`,
                      background: style === s.id ? '#8b5cf620' : '#1a1425',
                      color: style === s.id ? '#c4b5fd' : '#8b8aa0',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                    title={s.desc}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Formato */}
            <div>
              <div
                style={{
                  fontSize: 10,
                  color: '#8b8aa0',
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  fontWeight: 800,
                  marginBottom: 10,
                }}
              >
                Formato
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                {FORMATS.map((f) => (
                  <button
                    key={f.id}
                    onClick={() => setFormat(f.id)}
                    style={{
                      padding: '10px 16px',
                      borderRadius: 12,
                      border: `1px solid ${format === f.id ? '#8b5cf6' : '#332a41'}`,
                      background: format === f.id ? '#8b5cf620' : '#1a1425',
                      color: format === f.id ? '#c4b5fd' : '#8b8aa0',
                      fontSize: 13,
                      fontWeight: 800,
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Generate */}
            <button
              onClick={generate}
              disabled={!selected.length || generating}
              style={{
                padding: '14px 32px',
                borderRadius: 14,
                border: 'none',
                background:
                  selected.length && !generating
                    ? 'linear-gradient(135deg, #8b5cf6, #6d28d9)'
                    : '#1a1425',
                color: selected.length && !generating ? '#fff' : '#6b6580',
                fontSize: 15,
                fontWeight: 900,
                cursor: selected.length && !generating ? 'pointer' : 'not-allowed',
                boxShadow:
                  selected.length && !generating ? '0 4px 20px rgba(139,92,246,.3)' : 'none',
                whiteSpace: 'nowrap',
              }}
            >
              {generating
                ? 'Generazione in corso…'
                : `Genera ${selected.length > 0 ? selected.length * 3 : 0} Creative`}
            </button>
          </div>

          {/* Generating state */}
          {generating && (
            <div
              style={{
                textAlign: 'center',
                padding: 60,
                color: '#8b8aa0',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 12 }}>✦</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#c4b5fd' }}>
                L&apos;AI sta generando copy e immagini…
              </div>
              <div style={{ fontSize: 12, marginTop: 8, color: '#6b6580' }}>
                GPT-4o per il copy + DALL-E 3 per le immagini · Può richiedere 20-40 secondi
              </div>
            </div>
          )}

          {/* Error */}
          {genError && (
            <div
              style={{
                padding: 20,
                borderRadius: 14,
                background: '#ef444415',
                border: '1px solid #ef444430',
                color: '#ef4444',
                fontSize: 13,
                marginBottom: 20,
              }}
            >
              <strong>Errore:</strong> {genError}
            </div>
          )}

          {/* Results */}
          {results?.creatives?.length > 0 && (
            <div>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                <div>
                  <h2 style={{ margin: 0, color: '#fff', fontSize: 20, fontWeight: 950 }}>
                    Creative generate
                  </h2>
                  <p style={{ margin: '6px 0 0', color: '#6b6580', fontSize: 12 }}>
                    {results.creatives.length} varianti · Stile {results.style} · {results.format === 'story' ? 'Story 9:16' : 'Feed 1:1'}
                  </p>
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  style={{
                    padding: '8px 20px',
                    borderRadius: 10,
                    border: '1px solid #332a41',
                    background: '#1a1425',
                    color: '#c8c0d6',
                    fontSize: 13,
                    fontWeight: 800,
                    cursor: 'pointer',
                  }}
                >
                  Rigenera
                </button>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 18,
                }}
              >
                {results.creatives.map((c, i) => {
                  const product = products.find(
                    (p) =>
                      c.productTitle &&
                      (p.title.toLowerCase().includes(c.productTitle.toLowerCase()) ||
                        c.productTitle.toLowerCase().includes(p.title.toLowerCase()))
                  )
                  return (
                    <CreativeCard
                      key={i}
                      creative={c}
                      productImage={product?.image}
                      format={results.format}
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
