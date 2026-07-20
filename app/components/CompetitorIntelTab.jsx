'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { getClientLocale } from '../../lib/i18n/clientLocale'

// Le creative DCO/Advantage+ contengono token catalogo non risolti (es.
// {{product.name}}): li togliamo per non mostrare testo "rotto". Se dopo la
// pulizia resta vuoto → la sezione non viene mostrata.
function cleanAdText(s) {
  return String(s || '').replace(/\{\{[^}]*\}\}/g, '').replace(/\s{2,}/g, ' ').trim()
}

// Etichetta leggibile della fonte da cui catalogo/prezzi sono stati estratti.
// shopify/woocommerce = nome piattaforma; jsonld = dati strutturati del sito;
// browserless = render headless della pagina. Null = nessun badge.
export function sourceLabel(source, t) {
  if (!source) return null
  if (source === 'shopify') return 'Shopify'
  if (source === 'woocommerce') return 'WooCommerce'
  if (source === 'jsonld') return t('ci.srcWeb', null, 'Dati sito')
  if (source === 'browserless') return t('ci.srcRender', null, 'Scraping pagina')
  return null
}
import AnimatedNumber from './ui/AnimatedNumber'
import CompetitorAgent from './CompetitorAgent'
import CompetitorsEmptyNotice from './CompetitorsEmptyNotice'
import { useI18n } from '../../lib/i18n/I18nProvider'

const COMPETITOR_META = {
  velites: {
    name: 'Velites',
    color: '#2997ff',
    adLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=234280280078173',
    websiteUrl: 'https://eu.velitessport.com/it',
  },
  picsil: {
    name: 'Picsil',
    color: '#bf5af2',
    adLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=842231462504799',
    websiteUrl: 'https://it.picsilsport.com',
  },
  froggrips: {
    name: 'Frog Grips',
    color: '#64d2ff',
    adLibraryUrl:
      'https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=114720846967132',
    websiteUrl: 'https://froggrips.com.au',
  },
}

const COUNTRIES = [
  { id: 'IT', label: 'Italia', labelKey: 'ci.countryIT' },
  { id: 'ES', label: 'Spagna', labelKey: 'ci.countryES' },
  { id: 'US', label: 'USA', labelKey: 'ci.countryUS' },
  { id: 'AU', label: 'Australia', labelKey: 'ci.countryAU' },
  { id: 'GB', label: 'UK', labelKey: 'ci.countryGB' },
  { id: 'ALL', label: 'Tutti', labelKey: 'ci.countryALL' },
]

// Locale condiviso con le funzioni module-level (impostato in fase di render
// dal componente principale, così i call-site restano invariati).
let _CI_LOC = 'it-IT'
function money(v) {
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return '—'
  return `€${n.toLocaleString(_CI_LOC, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function StatMini({ label, value, tone = 'var(--text)' }) {
  return (
    <div className="glass-card-static" style={{ padding: '14px 16px', borderRadius: 14 }}>
      <div className="label" style={{ fontSize: 9, marginBottom: 8 }}>{label}</div>
      <div className="metric-value-sm" style={{ color: tone }}>{value}</div>
    </div>
  )
}

function PlatformBadge({ platform }) {
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
        background: 'var(--glass2)',
        border: '1px solid var(--border2)',
        color: 'var(--text2)',
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
  const { t, intlLocale } = useI18n()
  const body = cleanAdText(ad.bodies?.[0])
  const title = cleanAdText(ad.titles?.[0])
  const caption = cleanAdText(ad.captions?.[0])
  const description = cleanAdText(ad.descriptions?.[0])
  const cta = cleanAdText(ad.cta)

  // Modale dettaglio creative (immagine + titolo + descrizione + CTA full)
  const [detailOpen, setDetailOpen] = useState(false)

  // ── Reverse-engineering on-brand (additivo) ──
  const [reOpen, setReOpen] = useState(false)
  const [brief, setBrief] = useState(null)
  const [reLoading, setReLoading] = useState(false)
  const [reError, setReError] = useState(null)
  const [genImg, setGenImg] = useState(null)
  const [genLoading, setGenLoading] = useState(false)

  const runReverse = async () => {
    setReOpen(true)
    if (brief || reLoading) return
    setReLoading(true); setReError(null)
    try {
      const r = await fetch('/api/creative-reverse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: getClientLocale(), ad: { pageName: ad.pageName, title, bodies: ad.bodies, body } }),
      })
      const j = await r.json()
      if (j.error) setReError(j.error)
      else setBrief(j.brief)
    } catch (e) { setReError(e?.message || t('ci.networkError', null, 'Errore di rete')) }
    finally { setReLoading(false) }
  }

  const runImage = async () => {
    if (!brief?.imagePrompt || genLoading) return
    setGenLoading(true)
    try {
      const r = await fetch('/api/creative-reverse', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ locale: getClientLocale(), generateImage: true, imagePrompt: brief.imagePrompt }),
      })
      const j = await r.json()
      if (j.imageUrl) setGenImg(j.imageUrl)
      else setReError(j.error || t('ci.imgGenFailed', null, 'Generazione immagine fallita'))
    } catch (e) { setReError(e?.message || t('ci.networkError', null, 'Errore di rete')) }
    finally { setGenLoading(false) }
  }
  const startDate = ad.startDate
    ? new Date(ad.startDate).toLocaleDateString(intlLocale, {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
      })
    : null

  const hasMedia = ad.imageUrl || ad.videoUrl

  return (
    <div
      className="glass-card-static"
      style={{
        borderRadius: 18,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Creative preview — cliccabile: apre il dettaglio (immagine + copy + CTA) */}
      {hasMedia && (
        <div
          onClick={() => setDetailOpen(true)}
          title={t('ci.openCreative', null, 'Apri creative')}
          style={{
          position: 'relative',
          aspectRatio: '1 / 1',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
          overflow: 'hidden',
          cursor: 'pointer',
        }}>
          {ad.videoUrl ? (
            <video
              src={ad.videoUrl}
              poster={ad.imageUrl || undefined}
              controls
              muted
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
            />
          ) : (
            <img
              src={ad.imageUrl}
              alt=""
              style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
              onError={e => { e.target.style.display = 'none' }}
            />
          )}
          {ad.isVideo && !ad.videoUrl && (
            <div style={{
              position: 'absolute', top: 10, left: 10,
              background: '#000a', padding: '3px 8px', borderRadius: 6,
              fontSize: 10, fontWeight: 800, color: 'var(--text)',
            }}>
              VIDEO
            </div>
          )}
          {startDate && (
            <div style={{
              position: 'absolute', top: 10, right: 10,
              background: '#000a', padding: '4px 10px', borderRadius: 8,
              fontSize: 10, fontWeight: 700, color: 'var(--text)',
              backdropFilter: 'blur(4px)',
            }}>
              {startDate}
            </div>
          )}
        </div>
      )}

      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(ad.platforms || []).map((p) => (
              <PlatformBadge key={p} platform={p} />
            ))}
          </div>
          {!hasMedia && startDate && (
            <span style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>{startDate}</span>
          )}
        </div>

        {/* Title — cliccabile: apre il dettaglio */}
        {title && (
          <div
            onClick={() => setDetailOpen(true)}
            style={{
              color: 'var(--text)', fontSize: 14, fontWeight: 900, lineHeight: 1.35, cursor: 'pointer',
            }}>
            {title}
          </div>
        )}

        {/* CTA reale dell'inserzione */}
        {cta && (
          <span style={{
            alignSelf: 'flex-start', fontSize: 11, fontWeight: 800, color: 'var(--accent)',
            background: 'rgba(41,151,255,0.12)', border: '1px solid rgba(41,151,255,0.25)',
            borderRadius: 8, padding: '4px 10px', textTransform: 'capitalize',
          }}>{cta}</span>
        )}

        {/* Body / Copy */}
        {body && (
          <div style={{
            color: 'var(--text2)', fontSize: 12, lineHeight: 1.55,
            maxHeight: hasMedia ? 80 : 120, overflow: 'hidden',
            WebkitLineClamp: hasMedia ? 4 : 5,
            WebkitBoxOrient: 'vertical', display: '-webkit-box',
          }}>
            {body}
          </div>
        )}

        {description && !body && (
          <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.45 }}>{description}</div>
        )}

        {caption && (
          <div style={{ color: 'var(--text3)', fontSize: 11, fontStyle: 'italic' }}>{caption}</div>
        )}

        {/* Link to snapshot */}
        {ad.snapshotUrl && (
          <a
            href={ad.snapshotUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              marginTop: 'auto', paddingTop: 8,
              fontSize: 11, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none',
            }}
          >
            {t('ci.seeOnAdLibrary', null, 'Vedi su Ad Library')}
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <path d="M4 2h6v6M10 2L2 10" stroke="#2997ff" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </a>
        )}

        {(body || title) && (
          <button
            onClick={runReverse}
            className="btn-glass"
            style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}
          >
            {t('ci.reverseBtn', null, '✨ Reverse-engineer on-brand')}
          </button>
        )}
      </div>

      {/* Modale DETTAGLIO: anteprima dell'inserzione stile Meta (testo → media → barra link + CTA) */}
      {detailOpen && createPortal(
        <div
          onClick={() => setDetailOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', zIndex: 100000, display: 'grid', placeItems: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(480px, 100%)', maxHeight: '92vh', overflowY: 'auto', background: '#fff', borderRadius: 14, overflow: 'hidden', boxShadow: '0 30px 90px rgba(0,0,0,0.6)', position: 'relative' }}
          >
            <button onClick={() => setDetailOpen(false)} aria-label={t('ci.close', null, 'Close')} style={{ position: 'absolute', top: 10, right: 10, zIndex: 2, background: 'rgba(0,0,0,0.55)', border: 'none', color: '#fff', borderRadius: '50%', width: 30, height: 30, cursor: 'pointer', fontSize: 16, lineHeight: 1 }}>×</button>

            {/* Header pagina (come Meta) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px' }}>
              <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'linear-gradient(135deg,#1877f2,#0a59c0)', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 16, flexShrink: 0 }}>
                {(ad.pageName || 'A').slice(0, 1).toUpperCase()}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ color: '#050505', fontWeight: 700, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ad.pageName || t('ci.advertiser', null, 'Inserzionista')}</div>
                <div style={{ color: '#65676b', fontSize: 12 }}>{t('ci.sponsored', null, 'Sponsorizzato')}{startDate ? ` · ${startDate}` : ''}</div>
              </div>
            </div>

            {/* Testo primario (sopra l'immagine, come Meta) */}
            {body && (
              <div style={{ padding: '0 14px 12px', color: '#050505', fontSize: 14, lineHeight: 1.5, whiteSpace: 'pre-wrap' }}>{body}</div>
            )}

            {/* Media */}
            {hasMedia && (
              <div style={{ background: '#000', lineHeight: 0 }}>
                {ad.videoUrl
                  ? <video src={ad.videoUrl} poster={ad.imageUrl || undefined} controls playsInline preload="metadata" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} />
                  : <img src={ad.imageUrl} alt="" style={{ width: '100%', maxHeight: '60vh', objectFit: 'contain', display: 'block' }} onError={e => { e.target.style.display = 'none' }} />}
              </div>
            )}

            {/* Barra link stile Meta: caption + titolo + descrizione + bottone CTA */}
            {(title || description || caption || cta) && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', background: '#f0f2f5' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  {caption && <div style={{ color: '#65676b', fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.02em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{caption}</div>}
                  {title && <div style={{ color: '#050505', fontWeight: 700, fontSize: 14, lineHeight: 1.3 }}>{title}</div>}
                  {description && <div style={{ color: '#65676b', fontSize: 12.5, lineHeight: 1.4, marginTop: 2 }}>{description}</div>}
                </div>
                {cta && (
                  <span style={{ flexShrink: 0, background: '#e4e6eb', color: '#050505', fontWeight: 700, fontSize: 13, borderRadius: 6, padding: '8px 14px', textTransform: 'capitalize', whiteSpace: 'nowrap' }}>{cta}</span>
                )}
              </div>
            )}

            {/* Footer: piattaforme + link Ad Library */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '10px 14px', borderTop: '1px solid #e4e6eb', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', gap: 6 }}>{(ad.platforms || []).map(p => <PlatformBadge key={p} platform={p} />)}</div>
              {ad.snapshotUrl && (
                <a href={ad.snapshotUrl} target="_blank" rel="noopener noreferrer" style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 12, color: '#1877f2', fontWeight: 700, textDecoration: 'none' }}>
                  {t('ci.seeOnAdLibrary', null, 'Vedi su Ad Library')}
                  <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M4 2h6v6M10 2L2 10" stroke="#1877f2" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </a>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {reOpen && (
        <div
          onClick={() => setReOpen(false)}
          style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(4px)', zIndex: 200, display: 'grid', placeItems: 'center', padding: 20 }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="glass-section"
            style={{ width: 'min(640px, 100%)', maxHeight: '88vh', overflowY: 'auto', padding: 24, background: 'rgba(10,10,20,0.92)' }}
          >
            <div style={{ position: 'relative', zIndex: 2 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div className="heading-sm" style={{ fontSize: 16 }}>{t('ci.variantTitle', null, '✨ Variante on-brand STMN')}</div>
                <button onClick={() => setReOpen(false)} style={{ background: 'transparent', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, width: 30, height: 30, cursor: 'pointer' }}>×</button>
              </div>

              {reLoading && <div style={{ color: 'var(--text3)', fontSize: 13, padding: '20px 0' }}><span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span> {t('ci.analyzingAd', null, "Analizzo l'inserzione e creo la variante…")}</div>}
              {reError && <div style={{ color: 'var(--red)', fontSize: 13 }}>{reError}</div>}

              {brief && (
                <div style={{ display: 'grid', gap: 14, fontSize: 13, color: 'var(--text2)', lineHeight: 1.55 }}>
                  <Field label={t('ci.fieldWhyWorks', null, "Perché funziona l'originale")} value={brief.whyItWorks} />
                  <Field label={t('ci.fieldStmnProduct', null, 'Prodotto STMN')} value={brief.stmnProduct} />
                  <Field label={t('ci.fieldAngle', null, 'Angolo on-brand')} value={brief.angle} />
                  <Field label={t('ci.fieldHook', null, 'Hook')} value={brief.hook} accent />
                  {Array.isArray(brief.primaryTexts) && brief.primaryTexts.length > 0 && (
                    <div>
                      <div className="label" style={{ marginBottom: 6 }}>{t('ci.fieldCopyVariants', null, 'Copy (varianti)')}</div>
                      <div style={{ display: 'grid', gap: 8 }}>
                        {brief.primaryTexts.map((t, i) => (
                          <div key={i} className="glass-card-static" style={{ padding: '10px 12px', borderRadius: 10, color: 'var(--text)', whiteSpace: 'pre-wrap' }}>{t}</div>
                        ))}
                      </div>
                    </div>
                  )}
                  <Field label={t('ci.fieldHeadline', null, 'Headline')} value={brief.headline} />
                  <Field label={t('ci.fieldVisual', null, 'Direzione visiva')} value={brief.visualBrief} />

                  <div style={{ borderTop: '1px solid var(--border)', paddingTop: 14 }}>
                    {!genImg && (
                      <button onClick={runImage} disabled={genLoading} className="btn-glass" style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: genLoading ? 'wait' : 'pointer' }}>
                        <span style={{ display: 'inline-block', animation: genLoading ? 'spin 1s linear infinite' : 'none' }}>◍</span>
                        {genLoading ? t('ci.genImgLoading', null, 'Genero immagine…') : t('ci.genImgBtn', null, 'Genera immagine on-brand')}
                      </button>
                    )}
                    {genImg && (
                      <img src={genImg} alt="creative on-brand" style={{ width: '100%', borderRadius: 12, marginTop: 4, display: 'block' }} />
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Field({ label, value, accent }) {
  if (!value) return null
  return (
    <div>
      <div className="label" style={{ marginBottom: 4 }}>{label}</div>
      <div style={{ color: accent ? 'var(--accent)' : 'var(--text)', fontWeight: accent ? 800 : 600 }}>{value}</div>
    </div>
  )
}

function ProductCard({ product }) {
  const { t } = useI18n()
  return (
    <div
      className="glass-card-static"
      style={{
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
            background: 'var(--red)',
            color: 'var(--text)',
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
            background: 'var(--glass)',
            color: 'var(--red)',
            padding: '4px 10px',
            borderRadius: 8,
            fontSize: 10,
            fontWeight: 800,
            zIndex: 2,
            border: '1px solid rgba(255,69,58,0.30)',
          }}
        >
          {t('ci.soldOut', null, 'ESAURITO')}
        </div>
      )}

      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)',
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
          <div style={{ color: 'var(--text3)', fontSize: 12 }}>{t('ci.noImage', null, 'No image')}</div>
        )}
      </div>

      <div style={{ padding: 14 }}>
        <div
          style={{
            color: 'var(--text)',
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
              color: 'var(--text3)',
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
              color: product.onSale ? 'var(--red)' : 'var(--text)',
              fontFamily: 'Barlow',
            }}
          >
            {money(product.price)}
          </span>

          {product.onSale && product.compareAtPrice > 0 && (
            <span
              style={{
                fontSize: 12,
                color: 'var(--text3)',
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
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '6px 12px',
        borderRadius: 10,
        background: 'rgba(41,151,255,0.10)',
        border: '1px solid rgba(41,151,255,0.25)',
        color: 'var(--accent)',
        fontSize: 12,
        fontWeight: 800,
      }}
    >
      {promo.text}
    </span>
  )
}

function CompetitorSection({ competitor, meta, country = 'IT' }) {
  const { t, intlLocale } = useI18n()
  // Default su "Catalogo & Prezzi": i prodotti caricano subito mentre le creative
  // (più lente) si popolano in background. Passando alla tab creative le trovi pronte.
  const [section, setSection] = useState('products')
  const [showAllProducts, setShowAllProducts] = useState(false)
  const [productSearch, setProductSearch] = useState('')

  const { adLibrary, websiteData } = competitor
  const apiAds = adLibrary?.ads || []
  const products = websiteData?.products || []
  const stats = websiteData?.stats || {}
  const promos = websiteData?.promos || []

  // Enrichment additivo: se l'API non ha (ancora) restituito creative, le
  // recuperiamo via Browserless (endpoint isolato). Quando l'app Meta sara'
  // approvata, apiAds sara' popolato e questo blocco non parte nemmeno.
  // pageId: prima quello risolto dal server (competitor per-cliente), poi
  // fallback dall'URL Ad Library (competitor beta hardcoded).
  const pageId = competitor?.pageId || (meta?.adLibraryUrl || '').match(/view_all_page_id=(\d+)/)?.[1] || null
  const [pageAds, setPageAds] = useState(null)
  const [pageTotal, setPageTotal] = useState(null)
  const [pageCapped, setPageCapped] = useState(false)
  const [pageAdsLoading, setPageAdsLoading] = useState(false)
  // Stato reale dell'ultimo fetch: errore API/scrape e presenza token Meta del
  // tenant — alimenta il banner (niente più messaggi fissi fuorvianti).
  const [pageAdsError, setPageAdsError] = useState(null)
  const [pageAdsMetaConnected, setPageAdsMetaConnected] = useState(true)
  useEffect(() => {
    if (apiAds.length > 0 || !pageId) return
    let cancelled = false
    const ckey = `aladpg:${pageId}`

    // Cache client (sessionStorage): riaprire la tab non ri-renderizza nulla
    try {
      const raw = sessionStorage.getItem(ckey)
      if (raw) {
        const c = JSON.parse(raw)
        if (c && Date.now() - c.ts < 6 * 3600 * 1000 && Array.isArray(c.ads) && c.ads.length) {
          setPageAds(c.ads); setPageTotal(c.total ?? null); setPageCapped(!!c.capped)
          return
        }
      }
    } catch {}

    setPageAdsLoading(true)
    // country=ALL: le creative di un advertiser sono globali (come fa il modulo
    // competitor). Filtrare per IT escluderebbe i brand esteri (es. Velites/ES).
    fetch(`/api/adlibrary-page?pageId=${encodeURIComponent(pageId)}&country=ALL`)
      .then(r => r.json())
      .then(j => {
        if (cancelled) return
        const list = Array.isArray(j?.ads) ? j.ads : []
        setPageAds(list)
        setPageTotal(Number.isFinite(j?.total) ? j.total : null)
        setPageCapped(!!j?.capped)
        setPageAdsError(!list.length && j?.error && j.error !== 'no_results' ? String(j.error) : null)
        if (j?.metaConnected === false) setPageAdsMetaConnected(false)
        if (list.length) {
          try { sessionStorage.setItem(ckey, JSON.stringify({ ts: Date.now(), ads: list, total: j.total ?? null, capped: !!j.capped })) } catch {}
        }
      })
      .catch(() => { if (!cancelled) setPageAds([]) })
      .finally(() => { if (!cancelled) setPageAdsLoading(false) })
    return () => { cancelled = true }
  }, [pageId, apiAds.length])

  const ads = apiAds.length > 0 ? apiAds : (pageAds || [])
  // Etichetta "ads attive": totale reale se noto, altrimenti "N+" quando si è
  // raggiunto il limite di caricamento, altrimenti il numero esatto.
  const nfmt = (n) => Number(n).toLocaleString(intlLocale)
  const realTotal = apiAds.length > 0 ? (adLibrary?.count || null) : pageTotal
  const headerAdsLabel =
    realTotal != null && realTotal >= ads.length ? t('ci.adsActive', { n: nfmt(realTotal) }, `${nfmt(realTotal)} ads attive`)
    : (pageCapped || ads.length >= 60) ? t('ci.adsActivePlus', { n: nfmt(ads.length) }, `${nfmt(ads.length)}+ ads attive`)
    : ads.length > 0 ? t('ci.adsActive', { n: nfmt(ads.length) }, `${nfmt(ads.length)} ads attive`)
    : t('ci.adsActiveNone', null, '— ads attive')
  const sectionAdsLabel =
    realTotal != null && realTotal > ads.length ? t('ci.shownTotal', { shown: nfmt(ads.length), total: nfmt(realTotal) }, `${nfmt(ads.length)} mostrate · ${nfmt(realTotal)} attive in totale`)
    : (pageCapped || ads.length >= 60) ? t('ci.shownPlus', { shown: nfmt(ads.length) }, `${nfmt(ads.length)} mostrate · ${nfmt(ads.length)}+ attive`)
    : t('ci.creativeActive', { n: nfmt(ads.length) }, `${nfmt(ads.length)} creative attive`)

  const sortedProducts = useMemo(() => {
    return [...products]
      .sort((a, b) => {
        if (a.onSale && !b.onSale) return -1
        if (!a.onSale && b.onSale) return 1
        return b.price - a.price
      })
  }, [products])

  const query = productSearch.trim().toLowerCase()
  const filteredProducts = useMemo(() => {
    if (!query) return sortedProducts
    return sortedProducts.filter((p) =>
      `${p.title || ''} ${p.type || ''} ${p.handle || ''}`.toLowerCase().includes(query)
    )
  }, [sortedProducts, query])

  // In ricerca mostriamo tutti i risultati; altrimenti il cap a 12 con "Mostra tutti"
  const displayProducts = query
    ? filteredProducts
    : showAllProducts
      ? filteredProducts
      : filteredProducts.slice(0, 12)

  return (
    <div
      className="glass-section reveal-zoom"
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        overflow: 'hidden',
        marginBottom: 24,
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: '20px 24px',
          borderBottom: '1px solid var(--border)',
          background: `linear-gradient(135deg, ${meta.color}15, transparent)`,
          position: 'relative',
          zIndex: 2,
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
                color: 'var(--text)',
                letterSpacing: '-0.03em',
              }}
            >
              {meta.name}
            </div>
            <a
              href={meta.websiteUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{ fontSize: 12, color: 'var(--text2)', textDecoration: 'none' }}
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
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {headerAdsLabel}
          </span>
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 10,
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              color: 'var(--text2)',
              fontSize: 12,
              fontWeight: 800,
            }}
          >
            {products.length} {t('ci.products', null, 'prodotti')}
          </span>
          {sourceLabel(websiteData?.source, t) && (
            <span
              title={t('ci.dataSourceTitle', null, 'Da dove arrivano catalogo e prezzi')}
              style={{
                padding: '6px 14px',
                borderRadius: 10,
                background: 'var(--glass2)',
                border: '1px solid var(--border2)',
                color: 'var(--text2)',
                fontSize: 11,
                fontWeight: 800,
              }}
            >
              {sourceLabel(websiteData?.source, t)}
            </span>
          )}
        </div>
      </div>

      {/* Section tabs */}
      <div
        style={{
          display: 'flex',
          gap: 0,
          borderBottom: '1px solid var(--border)',
          position: 'relative',
          zIndex: 2,
        }}
      >
        {[
          { id: 'products', label: t('ci.tabProducts', null, 'Catalogo & Prezzi'), icon: '◎' },
          { id: 'ads', label: t('ci.tabAds', null, 'Creative Attive'), icon: '▧' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setSection(tab.id)}
            style={{
              flex: 1,
              padding: '14px 20px',
              border: 'none',
              borderBottom: section === tab.id ? `2px solid ${meta.color}` : '2px solid transparent',
              background: section === tab.id ? `${meta.color}08` : 'transparent',
              color: section === tab.id ? 'var(--text)' : 'var(--text3)',
              fontSize: 13,
              fontWeight: 800,
              cursor: 'pointer',
              transition: 'all .15s',
            }}
          >
            <span style={{ marginRight: 8 }}>{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>

      <div style={{ padding: 24, position: 'relative', zIndex: 2 }}>
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
                <span style={{ fontSize: 13, color: 'var(--text2)' }}>
                  {sectionAdsLabel}
                  {adLibrary?.source === 'scrape' && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(41,151,255,0.10)' }}>
                      {t('ci.viaScrape', null, 'via Ad Library scrape')}
                    </span>
                  )}
                  {adLibrary?.source === 'api' && (
                    <span style={{ marginLeft: 8, fontSize: 10, color: 'var(--accent)', fontWeight: 700, padding: '2px 8px', borderRadius: 6, background: 'rgba(41,151,255,0.10)' }}>
                      {t('ci.viaApi', null, 'via Meta API')}
                    </span>
                  )}
                </span>
                <a
                  href={meta.adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    fontSize: 12,
                    color: '#2997ff',
                    fontWeight: 700,
                    textDecoration: 'none',
                  }}
                >
                  {t('ci.seeAllAdLibrary', null, 'Vedi tutto su Ad Library ↗')}
                </a>
              </div>
            )}

            {ads.length > 0 && (
              <div
                className="stagger-zoom m-stack"
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

            {ads.length === 0 && pageAdsLoading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '28px 4px', color: 'var(--text3)', fontSize: 13 }}>
                <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite' }}>◌</span>
                {t('ci.loadingCreatives', { name: meta.name }, `Carico le creative attive di ${meta.name} dalla Ad Library…`)}
              </div>
            )}

            {ads.length === 0 && !pageAdsLoading && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {/* Ad Library direct link */}
                <a
                  href={meta.adLibraryUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    textDecoration: 'none',
                    background: 'linear-gradient(135deg, rgba(41,151,255,0.10), rgba(41,151,255,0.04))',
                    border: '1px solid rgba(41,151,255,0.25)',
                    borderRadius: 18,
                    padding: '28px 24px',
                    transition: 'border-color .2s',
                  }}
                >
                  <div style={{
                    width: 52, height: 52, borderRadius: 14,
                    background: 'rgba(41,151,255,0.12)',
                    display: 'grid', placeItems: 'center', flexShrink: 0,
                  }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                      <path d="M12 2C6.477 2 2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.879V14.89h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.989C18.343 21.129 22 16.99 22 12c0-5.523-4.477-10-10-10z" fill="#2997ff"/>
                    </svg>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={{ color: 'var(--text)', fontSize: 16, fontWeight: 900, marginBottom: 4 }}>
                      {t('ci.openAdLibraryOf', { name: meta.name }, `Apri Ad Library di ${meta.name}`)}
                    </div>
                    <div style={{ color: 'var(--text2)', fontSize: 12, lineHeight: 1.5 }}>
                      {t('ci.viewAllActiveAds', null, 'Visualizza tutte le inserzioni attive con immagini, video e copy')}
                    </div>
                  </div>
                  <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ flexShrink: 0 }}>
                    <path d="M7 3h10v10M17 3L3 17" stroke="#2997ff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </a>

                {/* Status info — stato reale del caricamento creative */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '14px 18px', borderRadius: 12,
                  background: 'rgba(41,151,255,0.06)', border: '1px solid rgba(41,151,255,0.10)',
                }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: 'var(--accent)', flexShrink: 0,
                    animation: 'pulse 2s ease-in-out infinite',
                  }} />
                  <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.5 }}>
                    <strong style={{ color: 'var(--accent)', fontWeight: 800 }}>{t('ci.noCreativesTitle', null, 'Creative non caricate')}</strong>
                    {' — '}
                    {!pageAdsMetaConnected
                      ? t('ci.noCreativesConnect', null, 'Collega Meta Ads dall’Onboarding per leggere le creative via API. Nel frattempo puoi vederle su Ad Library dal link qui sopra.')
                      : pageAdsError
                        ? t('ci.noCreativesError', { err: pageAdsError }, `Lettura automatica non riuscita (${pageAdsError}). Puoi vedere tutte le creative su Ad Library dal link qui sopra.`)
                        : t('ci.noCreativesEmpty', null, 'La pagina non risulta avere inserzioni attive al momento. Verificale su Ad Library dal link qui sopra.')}
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* PRODUCTS SECTION */}
        {section === 'products' && (
          <>
            {/* Search bar */}
            {products.length > 0 && (
              <div style={{ position: 'relative', marginBottom: 20, maxWidth: 420 }}>
                <span
                  style={{
                    position: 'absolute',
                    left: 14,
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text3)',
                    fontSize: 14,
                    pointerEvents: 'none',
                  }}
                >
                  ⌕
                </span>
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => setProductSearch(e.target.value)}
                  placeholder={t('ci.searchProduct', null, 'Cerca un prodotto…')}
                  className="btn-glass"
                  style={{
                    width: '100%',
                    padding: '11px 38px',
                    fontWeight: 600,
                    color: 'var(--text)',
                    outline: 'none',
                  }}
                />
                {productSearch && (
                  <button
                    onClick={() => setProductSearch('')}
                    aria-label={t('ci.clearSearch', null, 'Pulisci ricerca')}
                    style={{
                      position: 'absolute',
                      right: 10,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'transparent',
                      border: 'none',
                      color: 'var(--text3)',
                      fontSize: 16,
                      cursor: 'pointer',
                      lineHeight: 1,
                    }}
                  >
                    ×
                  </button>
                )}
              </div>
            )}

            {/* Price stats */}
            {stats.totalProducts > 0 && (
              <div
                className="stagger-zoom m-grid2"
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
                  gap: 10,
                  marginBottom: 24,
                }}
              >
                <StatMini
                  label={t('ci.statProducts', null, 'Prodotti')}
                  value={stats.totalProducts}
                  tone="var(--text)"
                />
                <StatMini
                  label={t('ci.statAvgPrice', null, 'Prezzo medio')}
                  value={money(stats.avgPrice)}
                  tone="var(--accent)"
                />
                <StatMini
                  label={t('ci.statMin', null, 'Min')}
                  value={money(stats.minPrice)}
                  tone="#8b8aa0"
                />
                <StatMini
                  label={t('ci.statMax', null, 'Max')}
                  value={money(stats.maxPrice)}
                  tone="var(--text2)"
                />
                <StatMini
                  label={t('ci.statOnSale', null, 'In saldo')}
                  value={`${stats.onSaleCount} (${stats.onSalePct}%)`}
                  tone="var(--red)"
                />
                <StatMini
                  label={t('ci.statAvgDiscount', null, 'Sconto medio')}
                  value={stats.avgDiscount > 0 ? `−${stats.avgDiscount}%` : '—'}
                  tone="var(--red)"
                />
              </div>
            )}

            {/* Categories */}
            {stats.categories?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <div
                  style={{
                    fontSize: 10,
                    color: 'var(--text2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  {t('ci.categories', null, 'Categorie')}
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {stats.categories.map(([cat, count]) => (
                    <span
                      key={cat}
                      style={{
                        padding: '5px 12px',
                        borderRadius: 8,
                        background: 'var(--glass)',
                        border: '1px solid var(--border)',
                        color: 'var(--text2)',
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      {cat}{' '}
                      <span style={{ color: 'var(--text3)' }}>({count})</span>
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
                    color: 'var(--text2)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.12em',
                    fontWeight: 800,
                    marginBottom: 10,
                  }}
                >
                  {t('ci.promosDetected', null, 'Promozioni rilevate')}
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {promos.map((p, i) => (
                    <PromoTag key={i} promo={p} />
                  ))}
                </div>
              </div>
            )}

            {/* Conteggio risultati ricerca */}
            {query && (
              <div style={{ fontSize: 12, color: 'var(--text2)', marginBottom: 14, fontWeight: 600 }}>
                {t('ci.resultsFor', { n: filteredProducts.length, q: productSearch.trim() }, `${filteredProducts.length} risultat${filteredProducts.length === 1 ? 'o' : 'i'} per “${productSearch.trim()}”`)}
              </div>
            )}

            {/* Product grid */}
            {displayProducts.length > 0 ? (
              <>
                <div
                  className="stagger-zoom m-grid2"
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

                {!query && filteredProducts.length > 12 && !showAllProducts && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      onClick={() => setShowAllProducts(true)}
                      className="btn-glass"
                      style={{ padding: '10px 28px', cursor: 'pointer' }}
                    >
                      {t('ci.showAll', { n: filteredProducts.length }, `Mostra tutti (${filteredProducts.length} prodotti)`)}
                    </button>
                  </div>
                )}

                {!query && showAllProducts && filteredProducts.length > 12 && (
                  <div style={{ textAlign: 'center', marginTop: 20 }}>
                    <button
                      onClick={() => setShowAllProducts(false)}
                      className="btn-glass"
                      style={{ padding: '10px 28px', cursor: 'pointer' }}
                    >
                      {t('ci.showLess', null, 'Mostra meno')}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div
                style={{
                  border: '1px dashed var(--border)',
                  borderRadius: 16,
                  padding: 40,
                  textAlign: 'center',
                  color: 'var(--text3)',
                }}
              >
                {query
                  ? t('ci.noProductMatch', { q: productSearch.trim() }, `Nessun prodotto corrisponde a “${productSearch.trim()}”.`)
                  : websiteData?.error
                    ? t('ci.scrapeError', { err: websiteData.error }, `Errore nello scraping: ${websiteData.error}`)
                    : t('ci.noProductFound', null, 'Nessun prodotto trovato. Il sito potrebbe non essere Shopify o potrebbe bloccare le richieste.')}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// Cache di modulo (vive quanto la sessione/JS): { [country]: json }.
// Tornando sulla tab Competitor Intel i dati sono già pronti, niente refetch.
const __ciCache = {}

export default function CompetitorIntelTab({ onNavigate }) {
  const { t, intlLocale } = useI18n()
  _CI_LOC = intlLocale
  // Cache di modulo per-paese: cambiando tab dell'app e tornando, i dati (e le
  // chiamate a valle) NON si rifanno. "Aggiorna" forza comunque il refresh.
  const [data, setData] = useState(() => __ciCache['IT'] || null)
  const [loading, setLoading] = useState(false)
  const [country, setCountry] = useState('IT')

  useEffect(() => {
    // Se ho già i dati di questo paese in cache, mostrali senza rifare le chiamate.
    if (__ciCache[country]) { setData(__ciCache[country]); return }
    fetchData()
  }, [country]) // eslint-disable-line

  async function fetchData(force = false) {
    if (!force && __ciCache[country]) { setData(__ciCache[country]); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/competitor-intel?country=${encodeURIComponent(country)}`, {
        cache: 'no-store',
      })
      const json = await res.json()
      __ciCache[country] = json
      setData(json)
    } catch (e) {
      console.error('Competitor intel fetch error:', e)
    } finally {
      setLoading(false)
    }
  }

  const competitors = data?.competitors || []

  // ── Ricerca Ad Library per keyword (additivo) ──
  const [adInput, setAdInput] = useState('')
  const [adQuery, setAdQuery] = useState('')
  const [adResults, setAdResults] = useState(null)
  const [adTotal, setAdTotal] = useState(null)
  const [adCapped, setAdCapped] = useState(false)
  const [adLoading, setAdLoading] = useState(false)
  const [adError, setAdError] = useState(null)
  const [adLibraryUrl, setAdLibraryUrl] = useState(null)

  async function runAdSearch(term) {
    const t = (term ?? adInput).trim()
    if (!t || adLoading) return
    setAdLoading(true)
    setAdError(null)
    setAdQuery(t)
    try {
      // ads attive in tutto il mondo (ALL), non solo nel mercato selezionato
      const r = await fetch(`/api/adlibrary-search?q=${encodeURIComponent(t)}&country=ALL`)
      const j = await r.json()
      setAdLibraryUrl(j?.libraryUrl || null)
      setAdResults(Array.isArray(j?.ads) ? j.ads : [])
      setAdTotal(Number.isFinite(j?.total) ? j.total : null)
      setAdCapped(!!j?.capped)
      if (j?.error && !(j?.ads?.length)) setAdError(j.error)
    } catch (e) {
      setAdError(e?.message || t('ci.networkError', null, 'Errore di rete'))
      setAdResults([])
    } finally {
      setAdLoading(false)
    }
  }

  return (
    <div>
      {/* Toolbar (il titolo è già nell'header della shell) */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          marginBottom: 24,
          flexWrap: 'wrap',
        }}
      >
        <div style={{ fontSize: 11, color: 'var(--text3)', lineHeight: 1.5 }}>
          {data?.fetchedAt && (
            <>
              {t('ci.lastUpdate', null, 'Ultimo aggiornamento:')} {new Date(data.fetchedAt).toLocaleString(intlLocale)}
              {data?.cached && ` ${t('ci.cacheParen', null, '(cache)')}`}
              <br />
            </>
          )}
          <span style={{ color: 'var(--text3)' }}>
            {t('ci.autoUpdate', null, 'Aggiornamento automatico ogni lunedì alle 06:00')}
            {data?.nextRefresh && ` · ${t('ci.next', null, 'Prossimo:')} ${new Date(data.nextRefresh).toLocaleDateString(intlLocale, { weekday: 'short', day: 'numeric', month: 'short' })}`}
          </span>
        </div>

        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="btn-glass"
            style={{ padding: '10px 14px', fontWeight: 700, cursor: 'pointer' }}
          >
            {COUNTRIES.map((c) => (
              <option key={c.id} value={c.id} style={{ background: 'var(--surface)' }}>
                {t(c.labelKey, null, c.label)}
              </option>
            ))}
          </select>

          <button
            onClick={() => fetchData(true)}
            disabled={loading}
            className="btn-glass"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              cursor: loading ? 'wait' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            <span style={{ display: 'inline-block', animation: loading ? 'spin 1s linear infinite' : 'none' }}>↻</span>
            {loading ? t('ci.analyzingBtn', null, 'Analisi…') : t('ci.refresh', null, 'Aggiorna')}
          </button>
        </div>
      </div>

      {/* Loading */}
      {loading && !data && (
        <div
          style={{
            textAlign: 'center',
            padding: 80,
            color: 'var(--text3)',
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
            {t('ci.analyzingCompetitors', null, 'Analizzo i competitor…')}
          </div>
          <div style={{ fontSize: 12, marginTop: 8, color: 'var(--text3)' }}>
            {t('ci.scrapingDesc', null, 'Scraping siti web e interrogazione Meta Ad Library')}
          </div>
        </div>
      )}

      {/* Cliente senza competitor configurati → avviso a compilare Brand Identity */}
      {data?.needsCompetitors && <CompetitorsEmptyNotice onNavigate={onNavigate} />}

      {/* ── Ricerca Ad Library per keyword (additivo) ── */}
      <div
        className="glass-section reveal-zoom"
        style={{
          background: 'var(--glass)', border: '1px solid var(--border)',
          borderRadius: 18, padding: 22, marginBottom: 24,
        }}
      >
        <div style={{ position: 'relative', zIndex: 2 }}>
          <div className="heading-sm" style={{ fontSize: 16, marginBottom: 4 }}>{t('ci.adLibrarySearch', null, 'Ricerca Ad Library')}</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>
            {t('ci.adLibrarySearchDesc', null, 'Cerca creative attive su Meta per parola chiave, in tutto il mondo — non solo i competitor monitorati.')}
          </div>

          <form
            onSubmit={(e) => { e.preventDefault(); runAdSearch() }}
            style={{ display: 'flex', gap: 10, maxWidth: 520, marginBottom: adResults != null ? 18 : 0 }}
          >
            <div style={{ position: 'relative', flex: 1 }}>
              <span style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)', fontSize: 14, pointerEvents: 'none' }}>⌕</span>
              <input
                type="text"
                value={adInput}
                onChange={(e) => setAdInput(e.target.value)}
                placeholder={t('ci.searchPlaceholder', null, 'es. nome prodotto, brand, categoria…')}
                className="btn-glass"
                style={{ width: '100%', padding: '11px 14px 11px 38px', fontWeight: 600, color: 'var(--text)', outline: 'none' }}
              />
            </div>
            <button
              type="submit"
              disabled={adLoading || !adInput.trim()}
              className="btn-glass"
              style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: adLoading || !adInput.trim() ? 'not-allowed' : 'pointer', opacity: adLoading || !adInput.trim() ? 0.6 : 1 }}
            >
              <span style={{ display: 'inline-block', animation: adLoading ? 'spin 1s linear infinite' : 'none' }}>⌕</span>
              {adLoading ? t('ci.searching', null, 'Cerco…') : t('ci.search', null, 'Cerca')}
            </button>
          </form>

          {adError && (
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 12 }}>
              {t('ci.noReadableResult', { q: adQuery }, `Nessun risultato leggibile per “${adQuery}”.`)} {adLibraryUrl && (
                <a href={adLibraryUrl} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>{t('ci.openOnAdLibrary', null, 'Apri su Ad Library ↗')}</a>
              )}
            </div>
          )}

          {adResults != null && !adError && (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <span style={{ fontSize: 12, color: 'var(--text2)', fontWeight: 600 }}>
                  {adTotal != null && adTotal > adResults.length
                    ? t('ci.searchShownTotal', { shown: adResults.length, total: adTotal.toLocaleString(intlLocale), q: adQuery }, `${adResults.length} mostrate · ${adTotal.toLocaleString(intlLocale)} attive per “${adQuery}” · worldwide`)
                    : (adCapped || adResults.length >= 60)
                      ? t('ci.searchShownPlus', { shown: adResults.length, q: adQuery }, `${adResults.length} mostrate · ${adResults.length}+ per “${adQuery}” · worldwide`)
                      : t('ci.searchActive', { shown: adResults.length, q: adQuery }, `${adResults.length} creative attive per “${adQuery}” · worldwide`)}
                </span>
                {adLibraryUrl && (
                  <a href={adLibraryUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 700, textDecoration: 'none' }}>
                    Vedi tutto su Ad Library ↗
                  </a>
                )}
              </div>
              {adResults.length > 0 ? (
                <div className="stagger-zoom m-stack" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14 }}>
                  {adResults.map((ad, i) => (
                    <AdCard key={ad.id || i} ad={ad} index={i} />
                  ))}
                </div>
              ) : (
                <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('ci.noCreativeFound', null, 'Nessuna creative trovata.')}</div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Overview Cards */}
      {competitors.length > 0 && (
        <div
          className="stagger-zoom m-stack"
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
                className="glass-card"
                style={{ padding: 22, borderTop: `3px solid ${meta.color || 'var(--accent)'}` }}
              >
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    marginBottom: 16,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: meta.color || 'var(--accent)', boxShadow: `0 0 10px ${meta.color || 'var(--accent)'}` }} />
                  <div className="heading-sm" style={{ fontSize: 16 }}>{meta.name || comp.name}</div>
                </div>

                <div
                  className="m-stack"
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr',
                    gap: 16,
                    position: 'relative',
                    zIndex: 2,
                  }}
                >
                  <div>
                    <div className="label" style={{ fontSize: 9, marginBottom: 6 }}>{t('ci.ovAdsActive', null, 'Ads attive')}</div>
                    <div className="metric-value-sm" style={{ color: al.count > 0 ? 'var(--text)' : 'var(--text3)' }}>
                      <AnimatedNumber value={al.count || 0} />
                    </div>
                  </div>
                  <div>
                    <div className="label" style={{ fontSize: 9, marginBottom: 6 }}>{t('ci.statProducts', null, 'Prodotti')}</div>
                    <div className="metric-value-sm" style={{ color: s.totalProducts > 0 ? 'var(--text)' : 'var(--text3)' }}>
                      <AnimatedNumber value={s.totalProducts || 0} />
                    </div>
                  </div>
                  <div>
                    <div className="label" style={{ fontSize: 9, marginBottom: 6 }}>{t('ci.statAvgPrice', null, 'Prezzo medio')}</div>
                    <div className="metric-value-sm" style={{ color: 'var(--accent)' }}>{money(s.avgPrice)}</div>
                  </div>
                  <div>
                    <div className="label" style={{ fontSize: 9, marginBottom: 6 }}>{t('ci.statOnSale', null, 'In saldo')}</div>
                    <div className="metric-value-sm" style={{ color: s.onSaleCount > 0 ? 'var(--red)' : 'var(--text3)' }}>
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
          color: '#2997ff',
          // Sempre un link reale: pagina advertiser se il pageId e' noto,
          // altrimenti ricerca per nome ('#' riapriva l'app in un nuovo tab).
          adLibraryUrl: comp.pageId
            ? `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&view_all_page_id=${comp.pageId}&search_type=page&media_type=all`
            : `https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=ALL&q=${encodeURIComponent(comp.name || '')}&search_type=keyword_unordered&media_type=all`,
          websiteUrl: comp.websiteUrl,
        }

        return (
          <CompetitorSection key={comp.id} competitor={comp} meta={meta} country={country} />
        )
      })}

      <CompetitorAgent data={data} country={country} />
    </div>
  )
}
