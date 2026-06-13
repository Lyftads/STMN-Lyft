'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import CreativeAgent from './CreativeAgent'
import { PlatformBadges } from './PlatformIcon'
import { useI18n } from '../../lib/i18n/I18nProvider'
import Icon from './ui/Icon'
import BmTimeframe from './ui/BmTimeframe'
import { tfQuery } from '../../lib/tfQuery'

const PRESETS = [
  { id: 'today', label: 'Oggi', labelKey: 'cr.presetToday' },
  { id: 'yesterday', label: 'Ieri', labelKey: 'cr.presetYesterday' },
  { id: 'last_7d', label: 'Ultimi 7 giorni', labelKey: 'cr.presetLast7d' },
  { id: 'current_month', label: 'Mese corrente', labelKey: 'cr.presetCurrentMonth' },
  { id: 'last_month', label: 'Mese scorso', labelKey: 'cr.presetLastMonth' },
  { id: 'last_90d', label: 'Ultimi 90 giorni', labelKey: 'cr.presetLast90d' },
]

function asNum(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

const chipStyle = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  color: 'var(--text2)',
  borderRadius: 11,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  outline: 'none',
}

const selectStyle = {
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  color: 'var(--text)',
  borderRadius: 11,
  padding: '10px 14px',
  fontSize: 13,
  fontWeight: 700,
  cursor: 'pointer',
  outline: 'none',
}

function money(v) {
  return `€${Math.round(asNum(v)).toLocaleString('it-IT')}`
}

function money2(v) {
  return `€${asNum(v).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

function num(v) {
  return Math.round(asNum(v)).toLocaleString('it-IT')
}

function pct(v) {
  return `${asNum(v).toFixed(2)}%`
}

function ratio(v) {
  return asNum(v).toFixed(2)
}

function getCreativeImage(row) {
  return (
    row?.thumbnail_url ||
    row?.display_image_url ||
    row?.image_url ||
    row?.creative_image_url ||
    row?.preview_image_url ||
    ''
  )
}

function getCreativeName(row) {
  return (
    row?.name ||
    row?.creative_name ||
    row?.ad_name ||
    row?.ad_id ||
    'Creative senza nome'
  )
}

function Sparkline({ data, dataKey, color = 'var(--text)', width = 80, height = 26 }) {
  const vals = (data || []).map(d => Number(d[dataKey] || 0))
  if (vals.length < 2 || vals.every(v => v === 0)) return null
  const max = Math.max(...vals), min = Math.min(...vals)
  const range = max - min || 1
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * width
    const y = height - ((v - min) / range) * (height - 4) - 2
    return `${x},${y}`
  }).join(' ')
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ opacity: 0.8 }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

function DeltaBadge({ curr, prev, isLowerBetter = false }) {
  if (prev == null || prev === 0 || curr == null) return null
  const pct = ((curr - prev) / prev) * 100
  if (!Number.isFinite(pct) || Math.abs(pct) < 0.1) return null
  const up = pct > 0
  const good = isLowerBetter ? !up : up
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 7px', borderRadius: 6,
      background: good ? '#22c55e20' : '#ef444420',
      color: good ? '#22c55e' : '#ef4444',
    }}>
      {up ? '+' : ''}{pct.toFixed(2)}%
    </span>
  )
}

function Stat({ label, value, tone = 'var(--text)', prev, daily, dataKey, isLowerBetter = false, curr }) {
  return (
    <div
      className="glass-card"
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--border)',
        borderRadius: 14,
        padding: '14px 16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
        <div style={{
          fontSize: 10,
          color: 'var(--text3)',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 800,
        }}>
          {label}
        </div>
        <PlatformBadges sources={['meta']} size={14} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: 'var(--text)' }}>
          {value}
        </div>
        {daily && dataKey && <Sparkline data={daily} dataKey={dataKey} color={tone} />}
      </div>
      {prev != null && curr != null && (
        <div style={{ marginTop: 8 }}>
          <DeltaBadge curr={curr} prev={prev} isLowerBetter={isLowerBetter} />
        </div>
      )}
    </div>
  )
}

function CreativeCard({ row, index, onClick }) {
  const { t } = useI18n()
  const img = getCreativeImage(row)
  const name = getCreativeName(row)
  const products = Array.isArray(row.products) ? row.products.filter(p => p.image_url) : []
  const isCatalog = products.length > 0
  // DPA dove non abbiamo prodotti né immagine: lo riconosciamo dal
  // product_set_id e mostriamo un placeholder dedicato invece di "Nessuna"
  const isDpaWithoutImages = !img && !isCatalog && !!row.product_set_id

  const spend = asNum(row.spend)
  const purchases = asNum(row.purchases || row.orders)
  const purchaseValue = asNum(row.purchase_value || row.revenue)
  const roas = asNum(row.roas)
  const ctr = asNum(row.ctr_link || row.ctr)
  const cpc = asNum(row.cpc_link || row.cpc)
  const impressions = asNum(row.impressions)
  const clicks = asNum(row.link_clicks || row.clicks)
  const prev = row.prev || null // popolato solo se la creative era attiva nel periodo precedente

  // Colore accento dinamico in base a performance (ROAS)
  const accent =
    roas >= 4 ? { glow: '#22c55e', alpha: 'rgba(34,197,94,0.45)' } :
    roas >= 2.5 ? { glow: '#3b82f6', alpha: 'rgba(59,130,246,0.45)' } :
    roas >= 1.5 ? { glow: '#f59e0b', alpha: 'rgba(245,158,11,0.4)' } :
    { glow: '#ef4444', alpha: 'rgba(239,68,68,0.4)' }

  return (
    <div
      onClick={onClick}
      style={{
        position: 'relative',
        background: 'linear-gradient(155deg, rgba(20,16,40,0.85) 0%, rgba(8,8,18,0.95) 100%)',
        border: '1px solid var(--border)',
        borderRadius: 22,
        overflow: 'hidden',
        cursor: 'pointer',
        transition: 'transform 0.32s cubic-bezier(0.16,1,0.3,1), border-color 0.32s, box-shadow 0.32s',
        boxShadow: '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = 'translateY(-6px) scale(1.012)'
        e.currentTarget.style.borderColor = accent.alpha
        e.currentTarget.style.boxShadow = `0 24px 60px ${accent.alpha}, 0 8px 24px rgba(0,0,0,0.6), inset 0 1px 0 rgba(255,255,255,0.08)`
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = 'translateY(0) scale(1)'
        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
        e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)'
      }}
    >
      {/* Barra superiore animata che fa da indicatore performance */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 2,
        background: `linear-gradient(90deg, transparent, ${accent.glow}, transparent)`,
        animation: 'cr-shine 3.2s ease-in-out infinite',
        zIndex: 3,
      }} />
      {isCatalog ? (
        <div
          style={{
            aspectRatio: '1 / 1',
            background: 'var(--glass)',
            borderBottom: '1px solid var(--border)',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: 10, left: 10, zIndex: 2,
            padding: '4px 9px', borderRadius: 999,
            background: 'rgba(91,44,255,0.85)', color: 'var(--text)',
            fontSize: 10, fontWeight: 800, letterSpacing: '0.06em',
            textTransform: 'uppercase',
          }}>
            {t('cr.catalog', null, 'Catalogo')} · {products.length}
          </div>
          <div style={{
            display: 'flex', gap: 8, height: '100%',
            overflowX: 'auto', scrollSnapType: 'x mandatory',
            padding: 12, scrollbarWidth: 'thin',
          }}>
            {products.map(p => (
              <div key={p.id} style={{
                flex: '0 0 70%', aspectRatio: '1 / 1',
                background: '#0a0a14', borderRadius: 14,
                border: '1px solid var(--border)',
                overflow: 'hidden', scrollSnapAlign: 'start',
                display: 'flex', flexDirection: 'column',
              }}>
                <div style={{ flex: 1, overflow: 'hidden', background: '#0a0a14' }}>
                  <img
                    src={p.image_url}
                    alt={p.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                  />
                </div>
                <div style={{
                  padding: '8px 10px',
                  borderTop: '1px solid var(--border)',
                  background: 'rgba(0,0,0,0.4)',
                }}>
                  <div style={{
                    color: 'var(--text)', fontSize: 11, fontWeight: 800,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>{p.name || t('cr.product', null, 'Prodotto')}</div>
                  {p.price && (
                    <div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 2 }}>{p.price}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
      <div
        style={{
          aspectRatio: '1 / 1',
          background: 'var(--glass)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
        }}
      >
        {img ? (
          <img
            src={img}
            alt={name}
            style={{
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: 'block',
            }}
          />
        ) : isDpaWithoutImages ? (
          <div style={{
            width: '100%', height: '100%',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 14,
            background: 'linear-gradient(135deg, rgba(91,44,255,0.18) 0%, rgba(0,0,0,0.4) 100%)',
            padding: 20,
          }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'rgba(91,44,255,0.25)',
              border: '1px solid rgba(91,44,255,0.5)',
              display: 'grid', placeItems: 'center',
              color: '#a78bfa',
            }}><Icon name="image" size={26} /></div>
            <div style={{
              padding: '4px 10px', borderRadius: 999,
              background: 'rgba(91,44,255,0.85)', color: 'var(--text)',
              fontSize: 10, fontWeight: 800, letterSpacing: '0.08em',
              textTransform: 'uppercase',
            }}>Advantage+ Catalog</div>
            <div style={{ color: 'var(--text3)', fontSize: 11, textAlign: 'center', lineHeight: 1.4 }}>
              {t('cr.dynamicCarousel', null, 'Carosello dinamico')}<br/>{t('cr.metaManaged', null, '(prodotti gestiti da Meta)')}
            </div>
          </div>
        ) : (
          <div style={{ color: 'var(--text3)', fontSize: 13 }}>{t('cr.noImage', null, 'Nessuna immagine')}</div>
        )}
      </div>
      )}

      <div style={{ padding: 18, position: 'relative', zIndex: 2 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 10,
            marginBottom: 14,
          }}
        >
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 10,
              background: `linear-gradient(135deg, ${accent.glow}, rgba(91,44,255,0.85))`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text)',
              fontSize: 12,
              fontWeight: 900,
              flex: '0 0 auto',
              boxShadow: `0 0 14px ${accent.alpha}`,
            }}
          >
            {index + 1}
          </div>

          <div style={{ minWidth: 0, flex: 1 }}>
            <div
              style={{
                color: 'var(--text)',
                fontWeight: 900,
                fontSize: 14,
                lineHeight: 1.35,
                marginBottom: 5,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
              }}
            >
              {name}
            </div>

            <div style={{
              color: 'var(--text3)',
              fontSize: 11,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {row.campaign_name || t('cr.campaignUnavailable', null, 'Campagna non disponibile')}
            </div>
          </div>

          {prev && (
            <div style={{
              padding: '3px 8px',
              borderRadius: 999,
              background: 'rgba(59,130,246,0.15)',
              border: '1px solid rgba(59,130,246,0.35)',
              color: '#7dd3fc',
              fontSize: 9,
              fontWeight: 800,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap',
              flex: '0 0 auto',
            }}>{t('cr.vsPrev', null, 'vs prec.')}</div>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: 10,
          }}
        >
          <Mini label={t('cr.spend', null, 'Spesa')} value={money(spend)} curr={spend} prev={prev?.spend} />
          <Mini label={t('cr.revenue', null, 'Revenue')} value={money(purchaseValue)} curr={purchaseValue} prev={prev?.revenue} />
          <Mini label="ROAS" value={ratio(roas)} curr={roas} prev={prev?.roas} tone={accent.glow} highlight />
          <Mini label={t('cr.orders', null, 'Ordini')} value={num(purchases)} curr={purchases} prev={prev?.orders} />
          <Mini label="CTR" value={pct(ctr)} curr={ctr} prev={prev?.ctr_link} kind="pct" />
          <Mini label="CPC" value={money2(cpc)} curr={cpc} prev={prev?.cpc_link} isLowerBetter />
          <Mini label={t('cr.impressions', null, 'Impression')} value={num(impressions)} curr={impressions} prev={prev?.impressions} />
          <Mini label={t('cr.clicks', null, 'Click')} value={num(clicks)} curr={clicks} prev={prev?.link_clicks} />
        </div>
      </div>
    </div>
  )
}

function Mini({ label, value, curr, prev, isLowerBetter = false, tone, highlight = false, kind }) {
  // Mostra il delta solo quando prev è un numero valido (la creative
  // era attiva nel periodo precedente). Se prev è null/undefined → niente delta.
  let pctDelta = null
  let good = null
  if (typeof prev === 'number' && prev > 0 && typeof curr === 'number') {
    const pct = ((curr - prev) / prev) * 100
    if (Number.isFinite(pct) && Math.abs(pct) >= 0.1) {
      pctDelta = pct
      good = isLowerBetter ? pct < 0 : pct > 0
    }
  }

  return (
    <div
      style={{
        position: 'relative',
        background: highlight && tone
          ? `linear-gradient(135deg, ${tone}22 0%, rgba(255,255,255,0.025) 100%)`
          : 'rgba(255,255,255,0.025)',
        border: highlight && tone
          ? `1px solid ${tone}55`
          : '1px solid var(--border)',
        borderRadius: 12,
        padding: '10px 12px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          color: 'var(--text3)',
          fontSize: 9,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          marginBottom: 5,
          fontWeight: 800,
        }}
      >
        {label}
      </div>
      <div style={{
        display: 'flex',
        alignItems: 'baseline',
        gap: 6,
        flexWrap: 'wrap',
      }}>
        <div style={{
          color: 'var(--text)',
          fontSize: 13,
          fontWeight: 900,
          letterSpacing: '-0.01em',
        }}>
          {value}
        </div>
        {pctDelta != null && (
          <div style={{
            fontSize: 10,
            fontWeight: 800,
            color: good ? '#22c55e' : '#ef4444',
            whiteSpace: 'nowrap',
          }}>
            {pctDelta > 0 ? '▲' : '▼'} {Math.abs(pctDelta).toFixed(1)}%
          </div>
        )}
      </div>
    </div>
  )
}

function formatCta(cta) {
  if (!cta) return ''
  // Meta usa enum tipo "SHOP_NOW" → trasforma in "Shop Now"
  return cta
    .toLowerCase()
    .split('_')
    .map(w => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function CreativeDetailModal({ row, onClose }) {
  const { t } = useI18n()
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  useEffect(() => {
    const onKey = e => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  if (!mounted) return null

  const img = getCreativeImage(row)
  const name = getCreativeName(row)
  const products = Array.isArray(row.products) ? row.products.filter(p => p.image_url) : []
  const variants = row.variants || {}

  const copies = variants.copies?.length ? variants.copies : (row.copy ? [row.copy] : [])
  const headlines = variants.headlines?.length ? variants.headlines : (row.headline ? [row.headline] : [])
  const descriptions = variants.descriptions?.length ? variants.descriptions : (row.description ? [row.description] : [])
  const ctas = variants.ctas?.length ? variants.ctas : (row.cta ? [row.cta] : [])
  const links = variants.links?.length ? variants.links : (row.link ? [row.link] : [])

  const modal = (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 100,
        background: 'rgba(0,0,0,0.65)',
        backdropFilter: 'blur(6px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: 'rgba(8,8,15,0.95)',
          backdropFilter: 'blur(40px) saturate(1.8)',
          border: '1.5px solid var(--border)',
          borderRadius: 22,
          width: 'min(960px, 100%)',
          maxHeight: '90vh',
          overflow: 'hidden',
          display: 'grid',
          gridTemplateColumns: '420px 1fr',
        }}
      >
        {/* Colonna immagine */}
        <div style={{
          background: 'var(--glass)',
          borderRight: '1px solid var(--border)',
          padding: 24,
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'center',
        }}>
          {products.length > 0 ? (
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(2, 1fr)',
              gap: 10,
              width: '100%',
            }}>
              {products.slice(0, 6).map(p => (
                <div key={p.id} style={{
                  background: '#0a0a14',
                  borderRadius: 12,
                  border: '1px solid var(--border)',
                  overflow: 'hidden',
                }}>
                  <div style={{ aspectRatio: '1/1', overflow: 'hidden' }}>
                    <img src={p.image_url} alt={p.name} style={{
                      width: '100%', height: '100%', objectFit: 'cover', display: 'block',
                    }} />
                  </div>
                  <div style={{ padding: '8px 10px' }}>
                    <div style={{ color: 'var(--text)', fontSize: 11, fontWeight: 800, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                    {p.price && <div style={{ color: 'var(--text3)', fontSize: 10, marginTop: 2 }}>{p.price}</div>}
                  </div>
                </div>
              ))}
            </div>
          ) : img ? (
            <img src={img} alt={name} style={{ width: '100%', borderRadius: 14, display: 'block' }} />
          ) : (
            <div style={{ color: 'var(--text3)', fontSize: 13, padding: 40 }}>{t('cr.noPreview', null, 'Nessuna anteprima')}</div>
          )}
        </div>

        {/* Colonna contenuto */}
        <div style={{ overflowY: 'auto', maxHeight: '90vh' }}>
          <div style={{
            position: 'sticky', top: 0,
            background: 'rgba(8,8,15,0.92)',
            backdropFilter: 'blur(20px)',
            padding: '20px 24px',
            borderBottom: '1px solid var(--border)',
            display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12,
            zIndex: 2,
          }}>
            <div style={{ minWidth: 0, flex: 1 }}>
              <div style={{ color: 'var(--text)', fontSize: 17, fontWeight: 900, marginBottom: 4 }}>{name}</div>
              <div style={{ color: 'var(--text3)', fontSize: 12 }}>{row.campaign_name || t('cr.noCampaign', null, 'Senza campagna')}</div>
              {row.adset_name && (
                <div style={{ color: 'var(--text3)', fontSize: 11, marginTop: 2 }}>{row.adset_name}</div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              style={{
                background: 'transparent',
                border: '1px solid var(--border)',
                color: 'var(--text2)',
                borderRadius: 10,
                width: 34, height: 34,
                display: 'grid', placeItems: 'center',
                cursor: 'pointer', fontSize: 18,
              }}
            >×</button>
          </div>

          <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Performance bar */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 10,
              padding: 14,
              background: 'var(--glass)',
              borderRadius: 14,
              border: '1px solid var(--border)',
            }}>
              <MiniStat label={t('cr.spend', null, 'Spesa')} value={money(row.spend)} />
              <MiniStat label="ROAS" value={ratio(row.roas)} />
              <MiniStat label="CPC" value={money2(row.cpc_link)} />
              <MiniStat label="CTR" value={pct(row.ctr_link)} />
            </div>

            {copies.length > 0 && (
              <Section label={`Copy${copies.length > 1 ? ` · ${t('cr.variantsN', { n: copies.length }, `${copies.length} varianti`)}` : ''}`}>
                {copies.map((c, i) => (
                  <CopyBlock key={i} index={copies.length > 1 ? i + 1 : null} text={c} />
                ))}
              </Section>
            )}

            {headlines.length > 0 && (
              <Section label={`Headline${headlines.length > 1 ? ` · ${t('cr.variantsN', { n: headlines.length }, `${headlines.length} varianti`)}` : ''}`}>
                {headlines.map((h, i) => (
                  <div key={i} style={lineStyle}>
                    {headlines.length > 1 && <span style={badgeIdx}>{i + 1}</span>}
                    {h}
                  </div>
                ))}
              </Section>
            )}

            {descriptions.length > 0 && (
              <Section label={`${t('cr.description', null, 'Descrizione')}${descriptions.length > 1 ? ` · ${t('cr.variantsN', { n: descriptions.length }, `${descriptions.length} varianti`)}` : ''}`}>
                {descriptions.map((d, i) => (
                  <div key={i} style={lineStyle}>
                    {descriptions.length > 1 && <span style={badgeIdx}>{i + 1}</span>}
                    {d}
                  </div>
                ))}
              </Section>
            )}

            {(ctas.length > 0 || links.length > 0) && (
              <Section label={t('cr.ctaAndLink', null, 'CTA e Link')}>
                {ctas.map((c, i) => (
                  <div key={`cta-${i}`} style={lineStyle}>
                    <span style={{ ...badgeIdx, background: 'rgba(34,197,94,0.18)', color: '#86efac' }}>CTA</span>
                    {formatCta(c)}
                  </div>
                ))}
                {links.map((l, i) => (
                  <div key={`link-${i}`} style={{ ...lineStyle, flexDirection: 'column', alignItems: 'flex-start', gap: 4 }}>
                    <span style={{ ...badgeIdx, background: 'rgba(59,130,246,0.18)', color: '#93c5fd' }}>{t('cr.linkBadge', null, 'Link')}</span>
                    <a href={l} target="_blank" rel="noreferrer" style={{
                      color: '#7dd3fc', fontSize: 13, wordBreak: 'break-all', textDecoration: 'underline',
                    }}>{l}</a>
                  </div>
                ))}
              </Section>
            )}

            <Section label={t('cr.identifiers', null, 'Identificativi')}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 11, color: 'var(--text3)' }}>
                <div><span style={{ color: 'var(--text2)', fontWeight: 800 }}>Ad ID</span><br/>{row.ad_id}</div>
                <div><span style={{ color: 'var(--text2)', fontWeight: 800 }}>Creative ID</span><br/>{row.creative_id || '—'}</div>
                <div><span style={{ color: 'var(--text2)', fontWeight: 800 }}>Campaign ID</span><br/>{row.campaign_id || '—'}</div>
                <div><span style={{ color: 'var(--text2)', fontWeight: 800 }}>Adset ID</span><br/>{row.adset_id || '—'}</div>
              </div>
            </Section>
          </div>
        </div>
      </div>
    </div>
  )

  return createPortal(modal, document.body)
}

const lineStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 10,
  padding: '10px 14px',
  background: 'var(--glass)',
  border: '1px solid var(--border)',
  borderRadius: 10,
  color: 'var(--text)',
  fontSize: 13.5,
  lineHeight: 1.5,
}

const badgeIdx = {
  display: 'inline-block',
  padding: '2px 8px',
  borderRadius: 6,
  fontSize: 10,
  fontWeight: 800,
  background: 'rgba(91,44,255,0.18)',
  color: '#c4b5fd',
  flexShrink: 0,
}

function Section({ label, children }) {
  return (
    <div>
      <div style={{
        fontSize: 10, color: 'var(--text3)',
        textTransform: 'uppercase', letterSpacing: '0.12em',
        fontWeight: 800, marginBottom: 10,
      }}>{label}</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{children}</div>
    </div>
  )
}

function MiniStat({ label, value }) {
  return (
    <div>
      <div style={{ fontSize: 9, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 800, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 900, color: 'var(--text)' }}>{value}</div>
    </div>
  )
}

function CopyBlock({ index, text }) {
  return (
    <div style={{
      padding: '12px 14px',
      background: 'var(--glass)',
      border: '1px solid var(--border)',
      borderRadius: 10,
      color: 'var(--text)',
      fontSize: 13.5,
      lineHeight: 1.6,
      whiteSpace: 'pre-wrap',
      wordBreak: 'break-word',
    }}>
      {index != null && <span style={{ ...badgeIdx, marginRight: 8 }}>{index}</span>}
      {text}
    </div>
  )
}

// Cache su localStorage (7 giorni): le creative restano in memoria a lungo →
// sopravvivono al cambio tab E al refresh della pagina. Chiave = periodo+account.
const CREATIVE_LS = 'lyft_creative_cache_v1'
const CREATIVE_TTL = 7 * 24 * 60 * 60 * 1000 // 7 giorni

function readCreativeCache() {
  if (typeof window === 'undefined') return {}
  try { return JSON.parse(localStorage.getItem(CREATIVE_LS) || '{}') || {} } catch { return {} }
}
function getCreativeCached(key) {
  const e = readCreativeCache()[key]
  if (!e || (Date.now() - e.ts) > CREATIVE_TTL) return null
  return e.payload
}
function setCreativeCached(key, payload) {
  if (typeof window === 'undefined') return
  const entry = { payload, ts: Date.now() }
  try {
    const o = readCreativeCache(); o[key] = entry
    localStorage.setItem(CREATIVE_LS, JSON.stringify(o))
  } catch {
    // quota piena → tieni solo l'ultima vista
    try { localStorage.setItem(CREATIVE_LS, JSON.stringify({ [key]: entry })) } catch {}
  }
}

export default function CreativeTab() {
  const { t } = useI18n()
  const [tf, setTf] = useState({ preset: 'last_7d' })
  const preset = tf.preset
  const [accountFilter, setAccountFilter] = useState('')
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const key = `${tfQuery(tf)}|${accountFilter}`
    // Cache hit (anche dopo refresh, da localStorage) → mostra subito, niente fetch.
    const cached = getCreativeCached(key)
    if (cached) { setData(cached); setLoading(false); return }
    let active = true

    async function loadCreative() {
      try {
        setLoading(true)

        const params = new URLSearchParams(tfQuery(tf))
        if (accountFilter) params.set('account_id', accountFilter)
        const res = await fetch(`/api/creative?${params.toString()}`, {
          cache: 'no-store',
        })

        const json = await res.json()

        if (active) {
          if (json && json.ok !== false) setCreativeCached(key, json) // non cachare gli errori
          setData(json)
        }
      } catch (e) {
        console.log('Creative fetch error:', e.message)

        if (active) {
          setData(null)
        }
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    loadCreative()

    return () => {
      active = false
    }
  }, [tf, accountFilter])

  const rawRows = Array.isArray(data?.rows) ? data.rows : []

  // Filtri UI
  const [search, setSearch] = useState('')
  const [sortBy, setSortBy] = useState('roas')
  const [sortDir, setSortDir] = useState('desc')
  const [campaignFilter, setCampaignFilter] = useState('')
  const [quickFilter, setQuickFilter] = useState('')
  const [selectedCreative, setSelectedCreative] = useState(null)

  // Solo creative ATTIVE nel timeframe selezionato (con spesa > 0 nel periodo)
  const rows = useMemo(
    () => rawRows.filter(r => asNum(r.spend) > 0),
    [rawRows]
  )

  const campaigns = useMemo(() => {
    const set = new Map()
    for (const r of rows) {
      const id = r.campaign_id || ''
      const name = r.campaign_name || t('cr.noCampaign', null, 'Senza campagna')
      if (id && !set.has(id)) set.set(id, name)
    }
    return Array.from(set, ([id, name]) => ({ id, name }))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [rows])

  const filteredRows = useMemo(() => {
    const q = search.trim().toLowerCase()
    let out = rows
    if (q) {
      out = out.filter(r =>
        (r.name || '').toLowerCase().includes(q) ||
        (r.campaign_name || '').toLowerCase().includes(q) ||
        (r.adset_name || '').toLowerCase().includes(q)
      )
    }
    if (campaignFilter) {
      out = out.filter(r => r.campaign_id === campaignFilter)
    }
    if (quickFilter === 'top') {
      out = out.filter(r => asNum(r.roas) >= 3)
    } else if (quickFilter === 'winners') {
      out = out.filter(r => asNum(r.roas) >= 4)
    } else if (quickFilter === 'efficient') {
      const cpcVals = out.map(r => asNum(r.cpc_link)).filter(v => v > 0).sort((a, b) => a - b)
      const median = cpcVals[Math.floor(cpcVals.length / 2)] || 0
      out = out.filter(r => asNum(r.cpc_link) > 0 && asNum(r.cpc_link) <= median && asNum(r.orders || r.purchases) > 0)
    } else if (quickFilter === 'volume') {
      const sorted = [...out].sort((a, b) => asNum(b.spend) - asNum(a.spend))
      const topN = Math.max(1, Math.ceil(sorted.length * 0.2))
      const cutoff = asNum(sorted[topN - 1]?.spend)
      out = out.filter(r => asNum(r.spend) >= cutoff)
    } else if (quickFilter === 'ctr') {
      const sorted = [...out].sort((a, b) => asNum(b.ctr_link) - asNum(a.ctr_link))
      const topN = Math.max(1, Math.ceil(sorted.length * 0.2))
      const cutoff = asNum(sorted[topN - 1]?.ctr_link)
      out = out.filter(r => asNum(r.ctr_link) >= cutoff && asNum(r.ctr_link) > 0)
    }
    return out
  }, [rows, search, campaignFilter, quickFilter])

  const sortedRows = useMemo(() => {
    const getVal = (r) => {
      switch (sortBy) {
        case 'roas': return asNum(r.roas)
        case 'spend': return asNum(r.spend)
        case 'revenue': return asNum(r.purchase_value || r.revenue)
        case 'orders': return asNum(r.purchases || r.orders)
        case 'cpc': return asNum(r.cpc_link)
        case 'ctr': return asNum(r.ctr_link)
        case 'impressions': return asNum(r.impressions)
        default: return asNum(r.purchase_value || r.revenue)
      }
    }
    const mult = sortDir === 'asc' ? 1 : -1
    return [...filteredRows].sort((a, b) => (getVal(a) - getVal(b)) * mult)
  }, [filteredRows, sortBy, sortDir])

  const totals = useMemo(() => {
    return rows.reduce(
      (acc, row) => {
        acc.spend += asNum(row.spend)
        acc.revenue += asNum(row.purchase_value || row.revenue)
        acc.orders += asNum(row.purchases || row.orders)
        acc.impressions += asNum(row.impressions)
        acc.clicks += asNum(row.link_clicks || row.clicks)
        return acc
      },
      {
        spend: 0,
        revenue: 0,
        orders: 0,
        impressions: 0,
        clicks: 0,
      }
    )
  }, [rows])

  const totalRoas = totals.spend > 0 ? totals.revenue / totals.spend : 0
  // Usa cpc_link/ctr_link dalla API summary (calcolati con fallback chain
  // più solido che il calcolo client-side da totals.clicks).
  const apiSummary = data?.summary || null
  const totalCpc =
    asNum(apiSummary?.cpc_link) ||
    (totals.clicks > 0 ? totals.spend / totals.clicks : 0)
  const totalCtr =
    asNum(apiSummary?.ctr_link) ||
    (totals.impressions > 0 ? (totals.clicks / totals.impressions) * 100 : 0)

  const prevSummary = data?.prevSummary || null
  const daily = Array.isArray(data?.dailySeries) ? data.dailySeries : []

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'flex-end',
          alignItems: 'center',
          gap: 12,
          marginBottom: 18,
        }}
      >
        <PlatformBadges sources={['meta']} size={18} />
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '4px 10px', borderRadius: 999, background: 'rgba(34,197,94,0.14)', color: '#22c55e', fontSize: 12, fontWeight: 800, letterSpacing: '0.06em' }}>
          <span style={{ width: 7, height: 7, borderRadius: 999, background: '#22c55e', boxShadow: '0 0 8px #22c55e' }} />
          LIVE
        </span>
        <div style={{ marginLeft: 'auto' }}>
          <BmTimeframe value={tf} onChange={(v) => setTf({ preset: 'custom', since: v.since, until: v.until })} accent="#2997ff" disabled={loading} />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(0, 1fr))',
          gap: 14,
          marginBottom: 24,
        }}
      >
        <Stat label={t('cr.spend', null, 'Spesa')} value={money(totals.spend)} tone="#3b82f6"
          curr={totals.spend} prev={prevSummary?.spend} daily={daily} dataKey="spend" />
        <Stat label={t('cr.revenue', null, 'Revenue')} value={money(totals.revenue)} tone="#22c55e"
          curr={totals.revenue} prev={prevSummary?.revenue} daily={daily} dataKey="revenue" />
        <Stat label="ROAS" value={ratio(totalRoas)} tone="#22c55e"
          curr={totalRoas} prev={prevSummary?.roas} daily={daily} dataKey="roas" />
        <Stat label={t('cr.orders', null, 'Ordini')} value={num(totals.orders)} tone="#f97316"
          curr={totals.orders} prev={prevSummary?.orders} daily={daily} dataKey="orders" />
        <Stat label="CPC" value={money2(totalCpc)} tone="#ec4899"
          curr={totalCpc} prev={prevSummary?.cpc_link} daily={daily} dataKey="cpc_link" isLowerBetter />
        <Stat label={t('cr.ctrLink', null, 'CTR Link')} value={pct(totalCtr)} tone="#a78bfa"
          curr={totalCtr} prev={prevSummary?.ctr_link} daily={daily} dataKey="ctr_link" />
      </div>

      <div
        className="glass-section"
        style={{
          background: 'var(--glass)',
          border: '1px solid var(--border)',
          borderRadius: 22,
          padding: 24,
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 20,
          }}
        >
          <div>
            <h2
              style={{
                margin: 0,
                color: 'var(--text)',
                fontSize: 20,
                fontWeight: 900,
              }}
            >
              {t('cr.topCreative', null, 'Top Creative')}
            </h2>

            <p
              style={{
                margin: '6px 0 0',
                color: 'var(--text3)',
                fontSize: 13,
              }}
            >
              {t('cr.ofActive', { shown: sortedRows.length, total: rows.length }, `${sortedRows.length} di ${rows.length} creative attive`)}
            </p>
          </div>

          <div style={{ color: 'var(--text3)', fontSize: 13 }}>
            {loading ? t('cr.loading', null, 'Caricamento…') : t('cr.campaignsN', { n: campaigns.length }, `${campaigns.length} campagne`)}
          </div>
        </div>

        {/* Search + filtri sopra la griglia */}
        <div style={{ marginBottom: 18 }}>
          <input
            type="text"
            placeholder={t('cr.searchPlaceholder', null, 'Cerca creative per nome, campagna o adset…')}
            value={search}
            onChange={e => setSearch(e.target.value)}
            style={{
              width: '100%',
              background: 'var(--glass)',
              border: '1px solid var(--border)',
              borderRadius: 12,
              padding: '13px 16px',
              color: 'var(--text)',
              fontSize: 14,
              outline: 'none',
              marginBottom: 12,
            }}
          />

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value)}
              style={selectStyle}
            >
              <option value="roas">{t('cr.sortRoas', null, 'Sort: ROAS')}</option>
              <option value="spend">{t('cr.sortSpend', null, 'Sort: Spesa')}</option>
              <option value="revenue">{t('cr.sortRevenue', null, 'Sort: Revenue')}</option>
              <option value="orders">{t('cr.sortOrders', null, 'Sort: Ordini')}</option>
              <option value="cpc">{t('cr.sortCpc', null, 'Sort: CPC')}</option>
              <option value="ctr">{t('cr.sortCtr', null, 'Sort: CTR')}</option>
              <option value="impressions">{t('cr.sortImpressions', null, 'Sort: Impression')}</option>
            </select>

            <button
              type="button"
              onClick={() => setSortDir(d => d === 'desc' ? 'asc' : 'desc')}
              style={chipStyle}
            >
              {sortDir === 'desc' ? t('cr.highLow', null, 'High → Low') : t('cr.lowHigh', null, 'Low → High')}
            </button>

            <select
              value={campaignFilter}
              onChange={e => setCampaignFilter(e.target.value)}
              style={selectStyle}
            >
              <option value="">{t('cr.allCampaigns', null, 'Tutte le campagne')}</option>
              {campaigns.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>

            {(search || campaignFilter || quickFilter || accountFilter) && (
              <button
                type="button"
                onClick={() => { setSearch(''); setCampaignFilter(''); setQuickFilter(''); setAccountFilter('') }}
                style={{ ...chipStyle, borderColor: '#ef444477', color: '#fca5a5' }}
              >
                {t('cr.resetFilters', null, 'Reset filtri')}
              </button>
            )}
          </div>

          {/* Filtro per ad account Meta */}
          <div style={{ marginTop: 14, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{
              fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase',
              letterSpacing: '0.12em', fontWeight: 800, marginRight: 4,
            }}>{t('cr.account', null, 'Account')}</span>
            {[{ id: '', label: t('cr.allAccounts', null, 'Tutti') }, ...((data?.allAccounts || data?.accounts || []).map(a => ({ id: a, label: a })))].map(opt => {
              const active = accountFilter === opt.id
              return (
                <button
                  key={opt.id || 'all'}
                  type="button"
                  onClick={() => setAccountFilter(opt.id)}
                  disabled={loading}
                  style={{
                    background: active ? 'linear-gradient(135deg, rgba(8,102,255,0.28), rgba(66,103,178,0.22))' : 'rgba(255,255,255,0.04)',
                    border: active ? '1px solid rgba(8,102,255,0.55)' : '1px solid var(--border)',
                    color: active ? 'var(--text)' : 'var(--text2)',
                    borderRadius: 10,
                    padding: '8px 12px',
                    fontSize: 12,
                    fontWeight: 800,
                    cursor: loading ? 'wait' : 'pointer',
                    boxShadow: active ? '0 0 14px rgba(8,102,255,0.25)' : 'none',
                    fontFamily: opt.id ? 'monospace' : 'inherit',
                  }}
                >{opt.label}</button>
              )
            })}
          </div>

          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.12em', fontWeight: 800, marginBottom: 8 }}>
              {t('cr.quickFilters', null, 'Quick Filters')}
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {[
                { id: 'top', label: 'Top Performers' },
                { id: 'efficient', label: 'Efficient Spenders' },
                { id: 'volume', label: 'High Volume' },
                { id: 'winners', label: 'Winners (4x+)' },
                { id: 'ctr', label: 'Link CTR Champions' },
              ].map(f => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setQuickFilter(quickFilter === f.id ? '' : f.id)}
                  style={{
                    ...chipStyle,
                    borderColor: quickFilter === f.id ? '#5b2cff' : 'var(--border)',
                    background: quickFilter === f.id ? 'rgba(91,44,255,0.15)' : 'var(--glass)',
                    color: quickFilter === f.id ? '#c4b5fd' : 'var(--text2)',
                  }}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {sortedRows.length > 0 ? (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 18,
            }}
          >
            {sortedRows.map((row, index) => (
              <CreativeCard
                key={`${row.id || row.ad_id || index}-${index}`}
                row={row}
                index={index}
                onClick={() => setSelectedCreative(row)}
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              border: '1px dashed var(--border)',
              borderRadius: 18,
              padding: 40,
              textAlign: 'center',
              color: 'var(--text3)',
            }}
          >
            {loading
              ? t('cr.loadingCreatives', null, 'Sto caricando le creative…')
              : t('cr.noData', null, 'Nessun dato creative disponibile per il periodo selezionato.')}
          </div>
        )}
      </div>

      {selectedCreative && (
        <CreativeDetailModal
          row={selectedCreative}
          onClose={() => setSelectedCreative(null)}
        />
      )}

      <CreativeAgent
        rows={rows}
        summary={apiSummary}
        prevSummary={prevSummary}
        preset={preset}
      />
    </div>
  )
}
