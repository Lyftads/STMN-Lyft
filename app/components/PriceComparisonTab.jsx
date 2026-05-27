'use client'

import { useEffect, useMemo, useState } from 'react'

const CATEGORIES = [
  { id: 'grips', label: 'Paracalli', icon: '🧤' },
  { id: 'ropes', label: 'Corde', icon: '🪢' },
  { id: 'knee_sleeves', label: 'Ginocchiere', icon: '🦵' },
  { id: 'men_apparel', label: 'Abb. Uomo', icon: '👕' },
  { id: 'women_apparel', label: 'Abb. Donna', icon: '👚' },
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
      background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14,
      overflow: 'hidden', width: 170, flexShrink: 0,
    }}>
      <div style={{
        aspectRatio: '1/1', background: 'var(--surface)', overflow: 'hidden',
        borderBottom: '1px solid var(--border)',
      }}>
        {product.image ? (
          <img src={product.image} alt={product.title}
            style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            onError={e => { e.target.style.display = 'none' }} />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', color: 'var(--border)', fontSize: 11 }}>No image</div>
        )}
      </div>
      <div style={{ padding: '8px 10px' }}>
        <div style={{
          fontSize: 10, fontWeight: 700, color: '#e2dcf0', lineHeight: 1.3,
          maxHeight: 26, overflow: 'hidden',
          WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', display: '-webkit-box',
        }}>{product.title}</div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 5, marginTop: 5 }}>
          <span style={{ fontSize: 14, fontWeight: 900, fontFamily: 'Barlow', color: product.onSale ? '#e63946' : '#22c55e' }}>
            {money(product.price, product.currency)}
          </span>
          {product.onSale && product.compareAtPrice > 0 && (
            <span style={{ fontSize: 9, color: '#6b6580', textDecoration: 'line-through' }}>
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
  const sameUnit = cur === 'EUR'

  const deltaEuro = isOwn || !sameUnit ? null : (ownAvg != null && brandData.avg != null ? ownAvg - brandData.avg : null)
  const deltaPct = isOwn || !sameUnit ? null : (ownAvg != null && brandData.avg > 0 ? ((ownAvg - brandData.avg) / brandData.avg) * 100 : null)
  const deltaColor = deltaEuro != null ? (deltaEuro < 0 ? '#22c55e' : deltaEuro > 0 ? '#ef4444' : '#8b8aa0') : '#8b8aa0'

  return (
    <div style={{
      background: isOwn ? '#22c55e06' : 'var(--glass)',
      border: `1px solid ${isOwn ? '#22c55e25' : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden', marginBottom: 8,
    }}>
      <div onClick={() => products.length > 0 && setExpanded(!expanded)} style={{
        display: 'grid', gridTemplateColumns: '1fr 55px 95px 75px 75px 85px 75px',
        alignItems: 'center', padding: '12px 16px',
        cursor: products.length > 0 ? 'pointer' : 'default', gap: 6,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {products.length > 0 && <span style={{ color: '#6b6580', fontSize: 11, width: 12 }}>{expanded ? '▾' : '▸'}</span>}
          <span style={{ fontSize: 13, fontWeight: 900, color: isOwn ? '#22c55e' : '#e2dcf0' }}>{brandName}</span>
          {isOwn && <span style={{ fontSize: 8, fontWeight: 800, padding: '2px 5px', borderRadius: 4, background: '#22c55e20', color: '#22c55e' }}>NOI</span>}
        </div>
        <div style={{ fontSize: 12, fontWeight: 700, color: '#8b8aa0', textAlign: 'right' }}>{brandData.count}</div>
        <div style={{ fontSize: 15, fontWeight: 900, color: isOwn ? '#22c55e' : '#fff', textAlign: 'right', fontFamily: 'Barlow' }}>{money(brandData.avg, cur)}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6580', textAlign: 'right' }}>{money(brandData.min, cur)}</div>
        <div style={{ fontSize: 11, fontWeight: 700, color: '#6b6580', textAlign: 'right' }}>{money(brandData.max, cur)}</div>
        <div style={{ fontSize: 13, fontWeight: 900, color: deltaColor, textAlign: 'right', fontFamily: 'Barlow' }}>
          {deltaEuro != null ? `${deltaEuro > 0 ? '+' : ''}€${Math.abs(deltaEuro).toFixed(2)}` : (sameUnit ? '—' : cur)}
        </div>
        <div style={{ textAlign: 'right' }}>
          {deltaPct != null ? (
            <span style={{
              fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 5,
              background: deltaPct < 0 ? '#22c55e18' : deltaPct > 0 ? '#ef444418' : '#8b8aa018',
              color: deltaPct < 0 ? '#22c55e' : deltaPct > 0 ? '#ef4444' : '#8b8aa0',
            }}>{deltaPct > 0 ? '+' : ''}{deltaPct.toFixed(1)}%</span>
          ) : '—'}
        </div>
      </div>
      {expanded && products.length > 0 && (
        <div style={{ padding: '10px 16px 14px', borderTop: '1px solid var(--border)', display: 'flex', gap: 10, overflowX: 'auto' }}>
          {products.map((p, i) => <ProductCard key={i} product={p} />)}
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

  const comparison = data?.priceComparison || []
  const ownName = data?.ownStoreName || 'STMN Fitness'

  // ── Summary KPIs ──
  const summary = useMemo(() => {
    if (!comparison.length) return null
    let totalOwn = 0, totalComp = 0, countOwn = 0, countComp = 0
    let cheaperCount = 0, moreExpensiveCount = 0, catCount = 0

    for (const cat of comparison) {
      if (cat.own.count === 0) continue
      catCount++
      totalOwn += cat.own.avg * cat.own.count
      countOwn += cat.own.count

      for (const [, v] of Object.entries(cat.competitors)) {
        if (v.currency !== 'EUR') continue
        totalComp += v.avg * v.count
        countComp += v.count
        if (v.deltaEuro != null) {
          if (v.deltaEuro < 0) cheaperCount++
          else if (v.deltaEuro > 0) moreExpensiveCount++
        }
      }
    }

    const avgOwn = countOwn > 0 ? totalOwn / countOwn : 0
    const avgComp = countComp > 0 ? totalComp / countComp : 0
    const totalComparisons = cheaperCount + moreExpensiveCount

    return {
      avgOwn, avgComp, countOwn, countComp,
      cheaperCount, moreExpensiveCount, catCount, totalComparisons,
      positionPct: totalComparisons > 0 ? Math.round((cheaperCount / totalComparisons) * 100) : 0,
    }
  }, [comparison])

  // ── Reports ──
  const reports = useMemo(() => {
    if (!comparison.length) return []
    const items = []

    for (const cat of comparison) {
      const catMeta = CATEGORIES.find(c => c.id === cat.id)
      if (cat.own.count === 0) continue

      const eurComps = Object.entries(cat.competitors).filter(([, v]) => v.currency === 'EUR')

      for (const [compName, v] of eurComps) {
        if (v.deltaEuro == null) continue
        const cheaper = v.deltaEuro < 0
        const absDelta = Math.abs(v.deltaEuro)
        const absPct = Math.abs(v.deltaPct)

        if (absPct > 15) {
          items.push({
            severity: cheaper ? 'positive' : 'warning',
            category: catMeta?.label || cat.label,
            title: cheaper
              ? `Siamo più economici di ${compName} sui ${catMeta?.label}`
              : `Siamo più cari di ${compName} sui ${catMeta?.label}`,
            body: cheaper
              ? `Il nostro prezzo medio (€${cat.own.avg.toFixed(2)}) è inferiore del ${absPct.toFixed(1)}% rispetto a ${compName} (€${v.avg.toFixed(2)}), con un vantaggio di €${absDelta.toFixed(2)} per prodotto. Questo è un punto di forza da evidenziare nelle ads e nelle landing page.`
              : `Il nostro prezzo medio (€${cat.own.avg.toFixed(2)}) è superiore del ${absPct.toFixed(1)}% rispetto a ${compName} (€${v.avg.toFixed(2)}), con €${absDelta.toFixed(2)} in più per prodotto. Valutare se il posizionamento premium è intenzionale o se c'è margine per un adeguamento.`,
          })
        }
      }

      if (eurComps.length >= 2) {
        const allCompAvgs = eurComps.map(([, v]) => v.avg)
        const marketAvg = allCompAvgs.reduce((a, b) => a + b, 0) / allCompAvgs.length
        const ownVsMarket = ((cat.own.avg - marketAvg) / marketAvg) * 100

        if (Math.abs(ownVsMarket) > 10) {
          items.push({
            severity: ownVsMarket < 0 ? 'positive' : 'neutral',
            category: catMeta?.label || cat.label,
            title: ownVsMarket < 0
              ? `${catMeta?.label}: sotto la media di mercato`
              : `${catMeta?.label}: sopra la media di mercato`,
            body: `Il nostro prezzo medio per ${catMeta?.label} (€${cat.own.avg.toFixed(2)}) è ${Math.abs(ownVsMarket).toFixed(1)}% ${ownVsMarket < 0 ? 'inferiore' : 'superiore'} alla media dei competitor EUR (€${marketAvg.toFixed(2)}). ${
              ownVsMarket < 0
                ? 'Abbiamo un vantaggio competitivo di prezzo che possiamo sfruttare nella comunicazione.'
                : 'Il prezzo più alto deve essere giustificato da qualità, brand perception o servizio superiore.'
            }`,
          })
        }
      }

      const ownOnSale = (cat.own.products || []).filter(p => p.onSale)
      if (ownOnSale.length > 0 && cat.own.count > 0) {
        const salePct = Math.round((ownOnSale.length / cat.own.count) * 100)
        if (salePct > 30) {
          items.push({
            severity: 'warning',
            category: catMeta?.label || cat.label,
            title: `${catMeta?.label}: ${salePct}% dei prodotti in saldo`,
            body: `${ownOnSale.length} prodotti su ${cat.own.count} sono attualmente in saldo. Una percentuale così alta può erodere la percezione del brand e i margini. Considerare di ridurre le promozioni o limitarle a prodotti specifici.`,
          })
        }
      }
    }

    return items.sort((a, b) => {
      const order = { warning: 0, neutral: 1, positive: 2 }
      return (order[a.severity] || 1) - (order[b.severity] || 1)
    })
  }, [comparison])

  if (loading) {
    return <div style={{ color: '#8b8aa0', padding: 40, fontSize: 15, fontWeight: 700 }}>Carico comparazione prezzi...</div>
  }

  if (!comparison.length) {
    return <div style={{ color: '#6b6580', padding: 40, fontSize: 14 }}>Nessun dato disponibile.</div>
  }

  const sevColor = s => ({ positive: '#22c55e', warning: '#f59e0b', neutral: '#8b5cf6' }[s] || '#8b8aa0')
  const sevLabel = s => ({ positive: 'VANTAGGIO', warning: 'ATTENZIONE', neutral: 'INSIGHT' }[s] || 'INFO')

  const colHeader = {
    fontSize: 9, fontWeight: 800, color: '#6b6580',
    textTransform: 'uppercase', letterSpacing: '.1em',
    textAlign: 'right', padding: '6px 0',
  }

  return (
    <div>
      {/* ── SUMMARY CARDS ── */}
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 12, marginBottom: 24 }}>
          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 9, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 6 }}>Nostri prodotti</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: '#22c55e', fontFamily: 'Barlow' }}>{summary.countOwn}</div>
            <div style={{ fontSize: 11, color: '#6b6580', marginTop: 4 }}>in {summary.catCount} categorie</div>
          </div>

          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 9, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 6 }}>Prezzo medio nostro</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: '#fff', fontFamily: 'Barlow' }}>€{summary.avgOwn.toFixed(2)}</div>
            <div style={{ fontSize: 11, color: '#6b6580', marginTop: 4 }}>vs competitor €{summary.avgComp.toFixed(2)}</div>
          </div>

          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 9, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 6 }}>Più economici</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: '#22c55e', fontFamily: 'Barlow' }}>{summary.cheaperCount}</div>
            <div style={{ fontSize: 11, color: '#6b6580', marginTop: 4 }}>su {summary.totalComparisons} confronti</div>
          </div>

          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 9, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 6 }}>Più cari</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: summary.moreExpensiveCount > 0 ? '#ef4444' : '#8b8aa0', fontFamily: 'Barlow' }}>{summary.moreExpensiveCount}</div>
            <div style={{ fontSize: 11, color: '#6b6580', marginTop: 4 }}>su {summary.totalComparisons} confronti</div>
          </div>

          <div style={{ background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
            <div style={{ fontSize: 9, color: '#8b8aa0', textTransform: 'uppercase', letterSpacing: '.1em', fontWeight: 800, marginBottom: 6 }}>Posizionamento prezzo</div>
            <div style={{ fontSize: 28, fontWeight: 950, color: summary.positionPct >= 50 ? '#22c55e' : '#f59e0b', fontFamily: 'Barlow' }}>{summary.positionPct}%</div>
            <div style={{ fontSize: 11, color: '#6b6580', marginTop: 4 }}>categorie più economici</div>
          </div>
        </div>
      )}

      {/* ── Last update info ── */}
      {data?.fetchedAt && (
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20, padding: '10px 16px',
          background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 10,
        }}>
          <div style={{ fontSize: 11, color: '#6b6580' }}>
            Ultimo aggiornamento: {new Date(data.fetchedAt).toLocaleString('it-IT')}
            {data.cached && <span style={{ marginLeft: 8, color: '#8b8aa0' }}>(cache)</span>}
          </div>
          <div style={{ fontSize: 10, color: '#4a4060' }}>
            Aggiornamento automatico ogni lunedì
          </div>
        </div>
      )}

      {/* ── CATEGORY SECTIONS ── */}
      {comparison.map(cat => {
        const catMeta = CATEGORIES.find(c => c.id === cat.id) || { label: cat.label, icon: '📦' }
        const compEntries = Object.entries(cat.competitors)
        if (cat.own.count === 0 && compEntries.every(([, v]) => v.count === 0)) return null

        return (
          <div key={cat.id} style={{
            background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 18,
            overflow: 'hidden', marginBottom: 20,
          }}>
            <div style={{
              padding: '16px 22px', borderBottom: '1px solid var(--border)',
              background: 'linear-gradient(135deg, #8b5cf610, transparent)',
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{catMeta.icon}</span>
              <div>
                <div style={{ fontSize: 18, fontWeight: 950, color: '#fff', letterSpacing: '-0.03em' }}>{catMeta.label}</div>
                <div style={{ fontSize: 10, color: '#6b6580', marginTop: 2 }}>
                  {cat.own.count} nostri · {compEntries.reduce((s, [, v]) => s + v.count, 0)} competitor
                </div>
              </div>
            </div>

            <div style={{ padding: '14px 22px 18px' }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 55px 95px 75px 75px 85px 75px',
                padding: '0 16px 6px', gap: 6,
              }}>
                <div style={{ ...colHeader, textAlign: 'left' }}>Brand</div>
                <div style={colHeader}>Prodotti</div>
                <div style={colHeader}>Media</div>
                <div style={colHeader}>Min</div>
                <div style={colHeader}>Max</div>
                <div style={colHeader}>Delta €</div>
                <div style={colHeader}>Delta %</div>
              </div>

              {cat.own.count > 0 && <BrandRow brandName={ownName} brandData={cat.own} isOwn ownAvg={null} />}
              {compEntries.map(([compName, v]) => (
                <BrandRow key={compName} brandName={compName} brandData={v} isOwn={false} ownAvg={cat.own.avg} />
              ))}
            </div>
          </div>
        )
      })}

      {/* ── REPORTS ── */}
      {reports.length > 0 && (
        <div style={{
          background: 'var(--glass)', border: '1px solid var(--border)', borderRadius: 18,
          overflow: 'hidden', marginTop: 8,
        }}>
          <div style={{
            padding: '16px 22px', borderBottom: '1px solid var(--border)',
            background: 'linear-gradient(135deg, #06b6d410, transparent)',
          }}>
            <div style={{ fontSize: 18, fontWeight: 950, color: '#fff', letterSpacing: '-0.03em' }}>
              Report analisi prezzi
            </div>
            <div style={{ fontSize: 11, color: '#6b6580', marginTop: 3 }}>
              {reports.length} osservazioni basate sulla comparazione corrente
            </div>
          </div>

          <div style={{ padding: '16px 22px', display: 'flex', flexDirection: 'column', gap: 12 }}>
            {reports.map((r, i) => (
              <div key={i} style={{
                padding: '14px 16px', borderRadius: 12,
                background: 'var(--glass)', borderLeft: `3px solid ${sevColor(r.severity)}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{
                    fontSize: 8, fontWeight: 900, padding: '2px 7px', borderRadius: 4,
                    background: `${sevColor(r.severity)}20`, color: sevColor(r.severity),
                    letterSpacing: '.08em',
                  }}>{sevLabel(r.severity)}</span>
                  <span style={{ fontSize: 10, color: '#6b6580', fontWeight: 700 }}>{r.category}</span>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: '#e2dcf0', marginBottom: 6 }}>{r.title}</div>
                <div style={{ fontSize: 12, color: '#9b90aa', lineHeight: 1.6 }}>{r.body}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
