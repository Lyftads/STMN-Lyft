'use client'

import { useEffect, useMemo, useState } from 'react'

const COMPETITOR_META = {
  velites: {
    name: 'Velites',
    color: '#e63946',
    adLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=234280280078173',
    websiteUrl: 'https://eu.velitessport.com/it',
  },
  picsil: {
    name: 'Picsil',
    color: '#457b9d',
    adLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=842231462504799',
    websiteUrl: 'https://it.picsilsport.com',
  },
  froggrips: {
    name: 'Frog Grips',
    color: '#2a9d8f',
    adLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=114720846967132',
    websiteUrl: 'https://froggrips.com.au',
  },
}

const COUNTRIES = [
  { id: 'IT', label: 'Italia' },
  { id: 'ES', label: 'Spagna' },
  { id: 'US', label: 'USA' },
  { id: 'AU', label: 'Australia' },
  { id: 'GB', label: 'UK' },
  { id: 'ALL', label: 'Tutti' },
]

function money(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `€${n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatMini({ label, value, tone = '#fff' }) {
  return (
    <div
      style={{
        background: '#0d0a16',
        border: '1px solid #252033',
        borderRadius: 12,
        padding: '12px 14px',
      }}
    >
      <div
        style={{
          fontSize: 9,
          color: '#8b8aa0',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          marginBottom: 6,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 900, color: tone, fontFamily: 'Barlow' }}>
        {value}
      </div>
    </div>
  )
}

function PlatformBadge({ platform }) {
  const colors = {
    facebook: '#1877f2',
    instagram: '#e4405f',
    messenger: '#0084ff',
    audience_network: '#f7931e',
  }

  const labels = {
    facebook: 'FB',
    instagram: 'IG',
    messenger: 'MSG',
    audience_network: 'AN',
  }

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '3px 8px',
        borderRadius: 6,
        background: `${colors[platform] || '#555'}25`,
        color: colors[platform] || '#888',
        fontSize: 10,
        fontWeight: 800,
        letterSpacing: '0.05em',
      }}
    >
      {labels[platform] || platform}
    </span>
  )
}

function AdCard({ ad, index }) {
  const body = ad.bodies?.[0] || ''
  const title = ad.titles?.[0] || ''
  const caption = ad.captions?.[0] || ''
  const description = ad.descriptions?.[0] || ''
  const startDate = ad.startDate
    ? new Date(ad.startDate).toLocaleDateString('it-IT', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  return (
    <div
      style={{
        background: '#14111d',
        border: '1px solid #2c2638',
        borderRadius: 16,
        padding: 18,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <div
          style={{
            width: 24,
            height: 24,
            borderRadius: 999,
            background: '#5b2cff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff',
            fontSize: 11,
            fontWeight: 900,
            flexShrink: 0,
          }}
        >
          {index + 1}
        </div>

        {startDate && (
          <span style={{ fontSize: 11, color: '#6b6580', fontWeight: 600 }}>{startDate}</span>
        )}
      </div>

      {title && (
        <div
          style={{
            color: '#fff',
            fontSize: 14,
            fontWeight: 900,
            lineHeight: 1.35,
          }}
        >
          {title}
        </div>
      )}

      {body && (
        <div
          style={{
            color: '#c8c0d6',
            fontSize: 13,
            lineHeight: 1.5,
            maxHeight: 120,
            overflow: 'hidden',
            WebkitLineClamp: 5,
            WebkitBoxOrient: 'vertical',
            display: '-webkit-box',
          }}
        >
          {body}
        </div>
      )}

      {description && !body && (
        <div style={{ color: '#a89db8', fontSize: 12, lineHeight: 1.45 }}>{description}</div>
      )}

      {caption && (
        <div style={{ color: '#6b6580', fontSize: 11, fontStyle: 'italic' }}>{caption}</div>
      )}

      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
        {(ad.platforms || []).map((p) => (
          <PlatformBadge key={p} platform={p} />
        ))}
      </div>

      {ad.snapshotUrl && (
        <a
          href={ad.snapshotUrl}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            fontSize: 11,
            color: '#8b5cf6',
            fontWeight: 700,
            textDecoration: 'none',
            marginTop: 4,
          }}
        >
          Vedi anteprima →
        </a>
      )}
    </div>
  )
}

function ProductCard({ product }) {
  return (
    <div
      style={{
        background: '#14111d',
        border: '1px solid #2c2638',
        borderRadius: 16,
        overflow: 'hidden',
        position: 'relative',
      }}
    >
      {product.onSale && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            background: '#e63946',
            color: '#fff',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 11,
            fontWeight: 900,
            zIndex: 2,
          }}
        >
          −{product.discountPct}%
        </div>
      )}

      {!product.available && (
        <div
          style={{
            position: 'absolute',
            top: 10,
            left: 10,
            background: '#1a1425',
            color: '#ef4444',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            zIndex: 2,
            border: '1px solid #ef444440',
          }}
        >
          ESAURITO
        </div>
      )}

      <div
        style={{
          aspectRatio: '1 / 1',
          background: '#0a0818',
          borderBottom: '1px solid #2c2638',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {product.image ? (
          <img
            src={product.image}
            alt={product.title}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : (
          <div style={{ color: '#4a4060', fontSize: 12 }}>No image</div>
        )}
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            color: '#fff',
            fontSize: 13,
            fontWeight: 800,
            lineHeight: 1.3,
            marginBottom: 8,
            maxHeight: 34,
            overflow: 'hidden',
          }}
        >
          {product.title}
        </div>

        {product.type && (
          <div
            style={{
              fontSize: 10,
              color: '#6b6580',
              marginBottom: 8,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              fontWeight: 700,
            }}
          >
            {product.type}
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span
            style={{
              fontSize: 16,
              fontWeight: 900,
              color: product.onSale ? '#e63946' : '#22c55e',
              fontFamily: 'Barlow',
            }}
          >
            {money(product.price)}
          </span>

          {product.onSale && product.compareAtPrice > 0 && (
            <span
              style={{
                fontSize: 12,
                color: '#6b6580',
                textDecoration: 'line-through',
                fontWeight: 600,
              }}
            >
              {money(product.compareAtPrice)}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

function PromoTag({ promo }) {
  const colors = {
    discount: { bg: '#e6394620', border: '#e6394640', text: '#e63946' },
    shipping: { bg: '#22c55e20', border: '#22c55e40', text: '#22c55e' },
    code: { bg: '#8b5cf620', border: '#8b5cf640', text: '#8b5cf6' },
    sale: { bg: '#f59e0b20', border: '#f59e0b40', text: '#f59e0b' },
    bundle: { bg: '#06b6d420', border: '#06b6d440', text: '#06b6d4' },
  }

  const c = colors[promo.type] || colors.sale

  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: 10,
        background: c.bg,
        border: `1px solid ${c.border}`,
        color: c.text,
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {promo.text}
    </span>
  )
}

function CompetitorSection({ competitor, meta }) {
  const [section, setSection] = useState('ads')
  const [showAllProducts, setShowAllProducts] = useState(false)

  const { adLibrary, websiteData } = competitor
  const ads = adLibrary?.ads || []
  const products = websiteData?.products || []
  const stats = websiteData?.stats || {}
  const promos = websiteData?.promos || []

  const sortedProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        if (a.onSale && !b.onSale) return -1
        if (!a.onSale && b.onSale) return 1
        return b.price - a.price
      })
  }, [products])

  const displayProducts = showAllProducts ? sortedProducts : sortedProducts.slice(0, 12)

  return (
    <div
      style={{
        background: '#14111d',
        border: '1px solid #2c2638',
        borderRadius: 22,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid #2c2638',
          background: `linear-gradient(135deg, ${meta.color}15, transparent)`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 10,
              height: 40,
              borderRadius: 5,
              background: meta.color,
            }}
          />
          <div>
            <div
              style={{
                fontSize: 22,
                fontWeight: 950,
                color: '#fff',
                letterSpacing: '-0.03em',
              }}
            >
              {meta.name}
            </div>
            <a
              href={meta.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: '#8b8aa0', textDecoration: 'none' }}
            >
              {meta.websiteUrl} ↗
            </a>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: '#1a1425',
              border: '1px solid #332a41',
              color: '#c8c0d6',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {ads.length} ads attive
          </span>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: '#1a1425',
              border: '1px solid #332a41',
              color: '#c8c0d6',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {products.length} prodotti
          </span>
          {websiteData?.isShopify && (
            <span
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                background: '#95bf4720',
                border: '1px solid #95bf4740',
                color: '#95bf47',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              Shopify
            </span>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid #2c2638',
        }}
      >
        {[
          { id: 'ads', label: 'Creative Attive', icon: '▧' },
          { id: 'products', label: 'Catalogo & Prezzi', icon: '◎' },
        ].map((t) => (
          <button
            key={t.id}
            onClick={() => setSection(t.id)}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              borderBottom: section === t.id ? `2px solid ${meta.color}` : '2px solid transparent',
              background: section === t.id ? `${meta.color}08` : 'transparent',
              color: section === t.id ? '#fff' : '#6b6580',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            <span style={{ marginRight: 8 }}>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24 }}>
        {/* ADS SECTION */}
        {section === 'ads' && (
          <>
            {ads.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  marginBottom: 20,
                }}
              >
                <span style={{ fontSize: 13, color: '#8b8aa0' }}>
                  {ads.length} creative attive trovate via API
                </span>
                <a
                  href={meta.adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    color: '#60a5fa',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  Vedi tutto su Ad Library ↗
                </a>
              </div>
            )}

            {ads.length > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
                  gap: 14,
                  marginBottom: 20,
                }}
              >
                {ads.map((ad, i) => (
                  <AdCard key={ad.id || i} ad={ad} index={i} />
                ))}
              </div>
            )}

            {ads.length === 0 && (
              <>
                {/* Big Ad Library link card */}
                <a
                  href={meta.adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'block',
                    textDecoration: 'none',
                    background: 'linear-gradient(135deg, #1877f215, #1877f208)',
                    border: '1px solid #1877f230',
                    borderRadius: 18,
                    padding: '32px 28px',
                    marginBottom: 20,
                    transition: 'border-color .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div
                      style={{
                        width: 52,
                        height: 52,
                        borderRadius: 14,
                        background: '#1877f220',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontSize: 24,
                        flexShrink: 0,
                      }}
                    >
                      📢
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ color: '#fff', fontSize: 16, fontWeight: 900, marginBottom: 6 }}>
                        Vedi tutte le creative attive di {meta.name}
                      </div>
                      <div style={{ color: '#8b8aa0', fontSize: 13, lineHeight: 1.5 }}>
                        Clicca per aprire la Meta Ad Library con tutte le inserzioni attive, immagini,
                        video e copy
                      </div>
                    </div>
                    <div style={{ color: '#60a5fa', fontSize: 22, fontWeight: 900, flexShrink: 0 }}>→</div>
                  </div>
                </a>

                {adLibrary?.error && adLibrary.code === 10 && (
                  <div
                    style={{
                      padding: 20,
                      borderRadius: 14,
                      background: '#14111d',
                      border: '1px solid #2c2638',
                      marginBottom: 20,
                    }}
                  >
                    <div style={{ color: '#f59e0b', fontSize: 13, fontWeight: 800, marginBottom: 12 }}>
                      Come abilitare il caricamento automatico delle ads
                    </div>
                    <ol
                      style={{
                        margin: 0,
                        paddingLeft: 20,
                        color: '#8b8aa0',
                        fontSize: 12,
                        lineHeight: 2,
                      }}
                    >
                      <li>
                        Vai su{' '}
                        <a
                          href="https://developers.facebook.com/apps/"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ color: '#60a5fa', textDecoration: 'none' }}
                        >
                          Meta Developer Dashboard
                        </a>
                      </li>
                      <li>Seleziona la tua App → <strong style={{ color: '#c8c0d6' }}>App Review</strong> → <strong style={{ color: '#c8c0d6' }}>Permissions and Features</strong></li>
                      <li>Cerca <strong style={{ color: '#c8c0d6' }}>Page Public Content Access</strong> e richiedi l&apos;accesso</li>
                      <li>Una volta approvato, le creative dei competitor appariranno automaticamente qui</li>
                    </ol>
                  </div>
                )}

                {adLibrary?.error && adLibrary.code !== 10 && (
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 12,
                      background: '#f59e0b08',
                      border: '1px solid #f59e0b20',
                      color: '#8b8aa0',
                      fontSize: 12,
                    }}
                  >
                    API: {adLibrary.error}
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* PRODUCTS SECTION */}
        {section === 'products' && (
          <>
            {/* Price stats */}
            {stats.totalProducts > 0 && (
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <StatMini
                  label="Prodotti"
                  value={stats.totalProducts}
                  tone="#fff"
                />
                <StatMini
                  label="Prezzo medio"
                  value={money(stats.avgPrice)}
                  tone="#22c55e"
                />
                <StatMini
                  label="Min"
                  value={money(stats.minPrice)}
                  tone="#8b8aa0"
                />
                <StatMini
                  label="Max"
                  value={money(stats.maxPrice)}
                  tone="#f59e0b"
                />
                <StatMini
                  label="In saldo"
                  value={`${stats.onSaleCount} (${stats.onSalePct}%)`}
                  tone="#e63946"
                />
                <StatMini
                  label="Sconto medio"
                  value={stats.avgDiscount > 0 ? `−${stats.avgDiscount}%` : '—'}
                  tone="#e63946"
                />
              </div>
            )}

            {/* Categories */}
            {stats.categories?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
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
                  Categorie
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stats.categories.map(([cat, count]) => (
                    <span
                      key={cat}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 8,
                        background: '#1a1425',
                        border: '1px solid #332a41',
                        color: '#c8c0d6',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {cat}{' '}
                      <span style={{ color: '#6b6580' }}>({count})</span>
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Promos */}
            {promos.length > 0 && (
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
                  Promozioni rilevate
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {promos.map((p, i) => (
                    <PromoTag key={i} promo={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Product grid */}
            {displayProducts.length > 0 ? (
              <>
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
                    gap: 14,
                  }}
                >
                  {displayProducts.map((p, i) => (
                    <a
                      key={p.handle || i}
                      href={p.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ textDecoration: 'none', color: 'inherit' }}
                    >
                      <ProductCard product={p} />
                    </a>
                  ))}
                </div>

                {sortedProducts.length > 12 && !showAllProducts && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      onClick={() => setShowAllProducts(true)}
                      style={{
                        padding: '10px 28px',
                        borderRadius: 12,
                        background: '#1a1425',
                        border: '1px solid #332a41',
                        color: '#c8c0d6',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Mostra tutti ({sortedProducts.length} prodotti)
                    </button>
                  </div>
                )}

                {showAllProducts && sortedProducts.length > 12 && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      onClick={() => setShowAllProducts(false)}
                      style={{
                        padding: '10px 28px',
                        borderRadius: 12,
                        background: '#1a1425',
                        border: '1px solid #332a41',
                        color: '#c8c0d6',
                        fontSize: 13,
                        fontWeight: 800,
                        cursor: 'pointer',
                      }}
                    >
                      Mostra meno
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  border: '1px dashed #3a2d4b',
                  borderRadius: 16,
                  padding: 40,
                  textAlign: 'center',
                  color: '#6b6580',
                }}
              >
                {websiteData?.error
                  ? `Errore nello scraping: ${websiteData.error}`
                  : 'Nessun prodotto trovato. Il sito potrebbe non essere Shopify o potrebbe bloccare le richieste.'}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

export default function CompetitorIntelTab() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [country, setCountry] = useState('IT')

  useEffect(() => {
    fetchData()
  }, [country])

  async function fetchData() {
    setLoading(true)
    try {
      const res = await fetch(`/api/competitor-intel?country=${encodeURIComponent(country)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      setData(json)
    } catch (e) {
      console.error('Competitor intel fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const competitors = data?.competitors || []

  return (
    <div>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: 28,
        }}
      >
        <div>
          <h1
            style={{
              margin: 0,
              color: '#fff',
              fontSize: 32,
              fontWeight: 950,
              letterSpacing: '-0.04em',
            }}
          >
            Competitor Intelligence
          </h1>
          <p style={{ margin: '8px 0 0', color: '#8b8aa0', fontSize: 14 }}>
            Creative attive · Catalogo prodotti · Prezzi · Promozioni
            {data?.fetchedAt && (
              <span style={{ marginLeft: 12, color: '#4a4060' }}>
                Ultimo aggiornamento: {new Date(data.fetchedAt).toLocaleString('it-IT')}
                {data?.cached && ' (cache)'}
              </span>
            )}
            <br />
            <span style={{ fontSize: 11, color: '#3a2d4b' }}>
              Aggiornamento automatico ogni lunedì alle 06:00
              {data?.nextRefresh && ` · Prossimo: ${new Date(data.nextRefresh).toLocaleDateString('it-IT', { weekday: 'short', day: 'numeric', month: 'short' })}`}
            </span>
          </p>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            style={{
              background: '#1a1425',
              color: '#fff',
              border: '1px solid #3a2d4b',
              borderRadius: 12,
              padding: '10px 14px',
              fontSize: 13,
              outline: 'none',
              fontWeight: 700,
            }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>

          <button
            onClick={fetchData}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: 12,
              border: '1px solid #332a41',
              background: loading ? '#1a1425' : '#8b5cf620',
              color: loading ? '#6b6580' : '#c4b5fd',
              fontSize: 13,
              fontWeight: 800,
              cursor: loading ? 'wait' : 'pointer',
            }}
          >
            {loading ? 'Analisi in corso…' : 'Aggiorna'}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div
          style={{
            textAlign: 'center',
            padding: 80,
            color: '#6b6580',
          }}
        >
          <div
            style={{
              fontSize: 24,
              marginBottom: 16,
              animation: 'pulse 1.5s ease-in-out infinite',
            }}
          >
            ◎
          </div>
          <div style={{ fontSize: 14, fontWeight: 700 }}>
            Analizzo i competitor…
          </div>
          <div style={{ fontSize: 12, marginTop: 8, color: '#4a4060' }}>
            Scraping siti web e interrogazione Meta Ad Library
          </div>
        </div>
      )}

      {/* Overview Cards */}
      {competitors.length > 0 && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: `repeat(${competitors.length}, minmax(0, 1fr))`,
            gap: 14,
            marginBottom: 28,
          }}
        >
          {competitors.map((comp) => {
            const meta = COMPETITOR_META[comp.id] || {}
            const ws = comp.websiteData || {}
            const al = comp.adLibrary || {}
            const s = ws.stats || {}

            return (
              <div
                key={comp.id}
                style={{
                  background: '#14111d',
                  border: '1px solid #2c2638',
                  borderRadius: 16,
                  padding: 20,
                  borderTop: `3px solid ${meta.color || '#555'}`,
                }}
              >
                <div
                  style={{
                    fontSize: 16,
                    fontWeight: 950,
                    color: '#fff',
                    marginBottom: 14,
                    letterSpacing: '-0.02em',
                  }}
                >
                  {meta.name || comp.name}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 8,
                  }}
                >
                  <div>
                    <div style={{ fontSize: 9, color: '#6b6580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 4 }}>
                      Ads attive
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: al.count > 0 ? '#fff' : '#4a4060', fontFamily: 'Barlow' }}>
                      {al.count || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#6b6580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 4 }}>
                      Prodotti
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 900, color: s.totalProducts > 0 ? '#fff' : '#4a4060', fontFamily: 'Barlow' }}>
                      {s.totalProducts || 0}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#6b6580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 4 }}>
                      Prezzo medio
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: '#22c55e', fontFamily: 'Barlow' }}>
                      {money(s.avgPrice)}
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 9, color: '#6b6580', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 4 }}>
                      In saldo
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 900, color: s.onSaleCount > 0 ? '#e63946' : '#4a4060', fontFamily: 'Barlow' }}>
                      {s.onSaleCount > 0 ? `${s.onSaleCount} (${s.onSalePct}%)` : '—'}
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Competitor Detail Sections */}
      {competitors.map((comp) => {
        const meta = COMPETITOR_META[comp.id] || {
          name: comp.name,
          color: '#8b5cf6',
          adLibraryUrl: '#',
          websiteUrl: comp.websiteUrl,
        }

        return (
          <CompetitorSection key={comp.id} competitor={comp} meta={meta} />
        )
      })}
    </div>
  )
}
