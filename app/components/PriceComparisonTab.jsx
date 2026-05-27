'use client'

import { useEffect, useState } from 'react'

const CATEGORIES = [
  { id: 'grips', label: 'Paracalli', icon: '🧤' },
  { id: 'ropes', label: 'Corde', icon: '🪢' },
  { id: 'knee_sleeves', label: 'Ginocchiere', icon: '🦵' },
  { id: 'men_apparel', label: 'Abbigliamento Uomo', icon: '👕' },
  { id: 'women_apparel', label: 'Abbigliamento Donna', icon: '👚' },
  { id: 'bags', label: 'Zaini / Borsoni', icon: '🎒' },
]

const CURRENCY_SYMBOLS = { EUR: '€', AUD: 'A$', USD: '$', GBP: '£' }

function money(v, currency = 'EUR') {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  const sym = CURRENCY_SYMBOLS[currency] || '€'
  return `${sym}${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function ProductCard({ product }) {
  return (
    <div style={{
      background: 'var(--glass)',
      border: '1px solid #252033',
      borderRadius: 14,
      overflow: 'hidden',
      width: 180,
      flexShrink: 0,
    }}>
      <div style={{
        aspectRatio: '1/1',
        background: 'var(--glass)',
        overflow: 'hidden',
        borderBottom: '1px solid #252033',
      }}>
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.style.display = 'none' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--border)', fontSize: 11 }}>No image</div>
        )}
      </div>
      <div style={{ padding: '10px 12px' }}>
        <div style={{
          fontSize: 11, fontWeight: 700, color: 'var(--text)', lineHeight: 1.3,
          maxHeight: 28, overflow: 'hidden',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', display: '-webkit-box',
        }}>
          {product.title}
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, marginTop: 6 }}>
          <span style={{
            fontSize: 15, fontWeight: 900, fontFamily: 'Barlow',
            color: product.onSale ? '#e63946' : '#22c55e',
          }}>
            {money(product.price, product.currency)}
          </span>
          {product.onSale && product.compareAtPrice > 0 && (
            <span style={{ fontSize: 10, color: 'var(--text3)', textDecoration: 'line-through' }}>
              {money(product.compareAtPrice, product.currency)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function BrandRow({ brandName, brandData, isOwn, ownAvg }) {
  const [expanded, setExpanded] = useState(false)
  const products = brandData.products || []
  const cur = brandData.currency || 'EUR'
  const sym = CURRENCY_SYMBOLS[cur] || '€'

  const sameUnit = cur === 'EUR'
  const deltaEuro = isOwn || !sameUnit ? null : (ownAvg != null && brandData.avg != null ? ownAvg - brandData.avg : null)
  const deltaPct = isOwn || !sameUnit ? null : (ownAvg != null && brandData.avg > 0 ? ((ownAvg - brandData.avg) / brandData.avg) * 100 : null)

  const deltaColor = deltaEuro != null
    ? (deltaEuro < 0 ? '#22c55e' : deltaEuro > 0 ? '#ef4444' : 'var(--text2)')
    : 'var(--text2)'

  return (
    <div style={{
      background: isOwn ? '#22c55e06' : 'var(--glass)',
      border: `1px solid ${isOwn ? '#22c55e25' : 'var(--border)'}`,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 10,
    }}>
      <div
        onClick={() => products.length > 0 && setExpanded(!expanded)}
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr 60px 100px 80px 80px 90px 80px',
          alignItems: 'center',
          padding: '14px 18px',
          cursor: products.length > 0 ? 'pointer' : 'default',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {products.length > 0 && (
            <span style={{ color: 'var(--text3)', fontSize: 12, width: 14 }}>{expanded ? '▾' : '▸'}</span>
          )}
          <span style={{
            fontSize: 14, fontWeight: 900,
            color: isOwn ? '#22c55e' : 'var(--text)',
          }}>
            {brandName}
          </span>
          {isOwn && (
            <span style={{ fontSize: 9, fontWeight: 800, padding: '2px 6px', borderRadius: 4, background: '#22c55e20', color: '#22c55e' }}>NOI</span>
          )}
        </div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text2)', textAlign: 'right' }}>
          {brandData.count}
        </div>
        <div style={{ fontSize: 16, fontWeight: 900, color: isOwn ? '#22c55e' : '#fff', textAlign: 'right', fontFamily: 'Barlow' }}>
          {money(brandData.avg, cur)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textAlign: 'right' }}>
          {money(brandData.min, cur)}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text3)', textAlign: 'right' }}>
          {money(brandData.max, cur)}
        </div>
        <div style={{ fontSize: 14, fontWeight: 900, color: deltaColor, textAlign: 'right', fontFamily: 'Barlow' }}>
          {deltaEuro != null ? `${deltaEuro > 0 ? '+' : ''}€${Math.abs(deltaEuro).toFixed(2)}` : (sameUnit ? '—' : cur)}
        </div>
        <div style={{ textAlign: 'right' }}>
          {deltaPct != null ? (
            <span style={{
              fontSize: 11, fontWeight: 800, padding: '3px 8px', borderRadius: 6,
              background: deltaPct < 0 ? '#22c55e18' : deltaPct > 0 ? '#ef444418' : '#8b8aa018',
              color: deltaPct < 0 ? '#22c55e' : deltaPct > 0 ? '#ef4444' : 'var(--text2)',
            }}>
              {deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%
            </span>
          ) : '—'}
        </div>
      </div>

      {expanded && products.length > 0 && (
        <div style={{
          padding: '12px 18px 18px',
          borderTop: '1px solid #252033',
          display: 'flex',
          gap: 12,
          overflowX: 'auto',
          paddingBottom: 14,
        }}>
          {products.map((p, i) => (
            <ProductCard key={i} product={p} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function PriceComparisonTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/competitor-intel?country=IT', { cache: 'no-store' })
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return <div style={{ color: 'var(--text2)', padding: 40, fontSize: 15, fontWeight: 700 }}>Carico comparazione prezzi...</div>
  }

  const comparison = data?.priceComparison || []
  if (!comparison.length) {
    return <div style={{ color: 'var(--text3)', padding: 40, fontSize: 14 }}>Nessun dato disponibile per la comparazione prezzi.</div>
  }

  const ownName = data?.ownStoreName || 'STMN Fitness'

  const headerStyle = {
    fontSize: 10, fontWeight: 800, color: 'var(--text3)',
    textTransform: 'uppercase', letterSpacing: '.1em',
    textAlign: 'right', padding: '8px 0',
  }

  return (
    <div>
      {comparison.map(cat => {
        const catMeta = CATEGORIES.find(c => c.id === cat.id) || { label: cat.label, icon: '📦' }
        const compEntries = Object.entries(cat.competitors)
        if (cat.own.count === 0 && compEntries.every(([, v]) => v.count === 0)) return null

        return (
          <div key={cat.id} className="reveal-zoom glass-section" style={{
            overflow: 'hidden', marginBottom: 24,
          }}>
            {/* Category header */}
            <div style={{
              padding: '18px 24px',
              borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, #8b5cf612, transparent)',
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 24 }}>{catMeta.icon}</span>
              <div>
                <div style={{ fontSize: 20, fontWeight: 950, color: '#fff', letterSpacing: '-0.03em' }}>
                  {catMeta.label}
                </div>
                <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {cat.own.count} nostri · {compEntries.reduce((s, [, v]) => s + v.count, 0)} competitor
                </div>
              </div>
            </div>

            <div style={{ padding: '16px 24px 20px' }}>
              {/* Column headers */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 60px 100px 80px 80px 90px 80px',
                padding: '0 18px 8px', gap: 8,
              }}>
                <div style={{ ...headerStyle, textAlign: 'left' }}>Brand</div>
                <div style={headerStyle}>Prodotti</div>
                <div style={headerStyle}>Prezzo medio</div>
                <div style={headerStyle}>Min</div>
                <div style={headerStyle}>Max</div>
                <div style={headerStyle}>Delta €</div>
                <div style={headerStyle}>Delta %</div>
              </div>

              {/* Own store */}
              {cat.own.count > 0 && (
                <BrandRow
                  brandName={ownName}
                  brandData={cat.own}
                  isOwn
                  ownAvg={null}
                />
              )}

              {/* Competitors */}
              {compEntries.map(([compName, v]) => (
                <BrandRow
                  key={compName}
                  brandName={compName}
                  brandData={v}
                  isOwn={false}
                  ownAvg={cat.own.avg}
                />
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
