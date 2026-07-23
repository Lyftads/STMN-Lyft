import { getAdminSupabase } from '../supabase/server'
import { getEffectiveTenantId } from './credentials'

// ============================================================================
//  Brand Identity helper — leggi companies.brand_identity per route che
//  vogliono personalizzare comportamento per-tenant (system prompt agent,
//  competitor list, creative tools).
//
//  IMPORTANTE: separato da credentials.js perche' brand identity non e'
//  gated dal flag LYFT_MULTI_TENANT — e' funzionalita' per-user che deve
//  sempre essere disponibile (anche per il tenant beta STMN). Defensivo
//  on Supabase errors → ritorna null → caller fallback su default
//  hardcoded.
// ============================================================================

const cache = new Map() // userId → { value, expiresAt }
const TTL_MS = 5 * 60_000

// Workspace EFFETTIVO (cliente agency se switchato), non l'uid auth grezzo.
async function currentUserId() {
  try {
    return await getEffectiveTenantId()
  } catch {
    return null
  }
}

// Ritorna l'oggetto brand_identity completo per l'utente corrente, oppure
// null se non autenticato / errore DB.
// `explicitUserId`: le route che girano in withTenantContext DEVONO passare
// l'identità già risolta (getTenantInfo().userId) — ri-derivarla a metà
// richiesta può divergere su un hiccup del check agency e mischiare i tenant
// (bug 22 lug: competitor di STMN cacheati sotto la chiave di Saracino).
export async function getBrandIdentity(explicitUserId = null) {
  const userId = explicitUserId || await currentUserId()
  if (!userId) return null

  const hit = cache.get(userId)
  if (hit && hit.expiresAt > Date.now()) return hit.value

  const admin = getAdminSupabase()
  if (!admin) return null

  try {
    const { data, error } = await admin
      .from('companies')
      .select('brand_identity, company_name, name')
      .eq('user_id', userId)
      .maybeSingle()
    if (error) {
      console.log('[brand] fetch error:', error.message)
      cache.set(userId, { value: null, expiresAt: Date.now() + TTL_MS })
      return null
    }
    const value = {
      userName: data?.name || null,           // Nome del founder (es. "Marino")
      companyName: data?.company_name || null, // Nome azienda (es. "STMN Fitness")
      ...((data?.brand_identity && typeof data.brand_identity === 'object') ? data.brand_identity : {}),
    }
    cache.set(userId, { value, expiresAt: Date.now() + TTL_MS })
    return value
  } catch (e) {
    console.log('[brand] fetch threw:', e?.message || e)
    cache.set(userId, { value: null, expiresAt: Date.now() + TTL_MS })
    return null
  }
}

// Costruisce un blocco di system prompt dalla brand identity. Usato
// come PREPEND nei system prompt degli agent AI.
//
// - Se brand_identity e' vuota o nulla → fallback a STMN-default (compat
//   per il tenant beta che non ha ancora compilato la form).
// - Se popolata → blocco strutturato che gli agent leggono per
//   personalizzare risposte su descrizione, prodotti, tone, brand guard.
//
// Sintesi: zero dati = zero rumore; piu' campi popolati = piu' verticalita'.
export async function buildBrandContext() {
  const brand = await getBrandIdentity()
  const userName = brand?.userName || 'Marino'
  const companyName = brand?.companyName || 'STMN Fitness'

  // Compat: STMN beta senza brand_identity → default STMN-specific
  if (!brand || isEmptyBrand(brand)) {
    return [
      `UTENTE: ${userName} (founder)`,
      `BRAND: ${companyName}`,
      `STMN Fitness (Stamina Fitness) vende accessori CrossFit di alta qualita':`,
      `paracalli, corde, ginocchiere, abbigliamento sportivo.`,
      `BRAND GUARD: mai supplementi/integratori/nutrizione.`,
    ].join('\n')
  }

  const lines = [`UTENTE: ${userName} (founder)`, `BRAND: ${companyName}`]

  if (brand.tagline) lines.push(`Tagline: ${brand.tagline}`)
  if (brand.description) lines.push(`Descrizione: ${brand.description}`)
  if (brand.mission) lines.push(`Mission: ${brand.mission}`)
  if (brand.founded) lines.push(`Fondazione: ${brand.founded}`)
  if (brand.website) lines.push(`Sito: ${brand.website}`)

  if (brand.category) lines.push(`Categoria: ${brand.category}`)
  if (arr(brand.subcategories).length) lines.push(`Sotto-categorie: ${arr(brand.subcategories).join(', ')}`)
  if (arr(brand.products).length) lines.push(`Prodotti principali: ${arr(brand.products).join(' · ')}`)
  if (brand.notSelling) lines.push(`BRAND GUARD (non promuovere): ${brand.notSelling}`)
  if (brand.targetAudience) lines.push(`Target audience: ${brand.targetAudience}`)
  if (arr(brand.markets).length) lines.push(`Mercati: ${arr(brand.markets).join(', ')}`)
  if (arr(brand.languages).length) lines.push(`Lingue: ${arr(brand.languages).join(', ')}`)

  if (arr(brand.toneTags).length) lines.push(`Tone of voice: ${arr(brand.toneTags).join(', ')}`)
  if (brand.languageStyle) lines.push(`Stile linguaggio: ${brand.languageStyle}`)
  if (arr(brand.brandWords).length) lines.push(`Lessico brand (usa): ${arr(brand.brandWords).join(', ')}`)
  if (arr(brand.forbiddenWords).length) lines.push(`Parole vietate (NON usare): ${arr(brand.forbiddenWords).join(', ')}`)
  if (brand.brandPersona) lines.push(`Brand persona: ${brand.brandPersona}`)
  if (arr(brand.copyExamples).length) {
    lines.push(`Esempi di copy che funzionano: ${arr(brand.copyExamples).map(s => `"${s}"`).join(' · ')}`)
  }

  if (arr(brand.colors).length) lines.push(`Palette colori: ${arr(brand.colors).join(', ')}`)
  if (brand.primaryFont) lines.push(`Font primario: ${brand.primaryFont}`)
  if (brand.photoStyle) lines.push(`Stile fotografico: ${brand.photoStyle}`)
  if (brand.adStyle) lines.push(`Stile creative ads: ${brand.adStyle}`)

  return lines.join('\n')
}

const arr = v => Array.isArray(v) ? v.filter(Boolean) : []

// "Vuoto" se NESSUN campo utile e' stato compilato.
// Permette al brand context di degradare gracefully al default STMN
// quando l'utente ha appena creato l'account e non ha compilato nulla.
function isEmptyBrand(b) {
  if (!b || typeof b !== 'object') return true
  const keys = ['tagline', 'description', 'mission', 'category', 'targetAudience',
                'brandPersona', 'languageStyle', 'photoStyle', 'adStyle']
  const stringFilled = keys.some(k => b[k] && String(b[k]).trim().length > 0)
  const arrayFilled = ['subcategories', 'products', 'toneTags', 'brandWords']
    .some(k => arr(b[k]).length > 0)
  return !stringFilled && !arrayFilled
}

// Estrae i competitor configurati dall'utente, ritorna array vuoto se
// nessuno e' stato configurato. Caller decide se usare questi o cadere
// su default hardcoded.
export async function getUserCompetitors(explicitUserId = null) {
  const brand = await getBrandIdentity(explicitUserId)
  const list = brand?.competitors
  if (!Array.isArray(list) || list.length === 0) return []
  return list
    .filter(c => c && typeof c === 'object' && (c.name || c.website))
    .map(c => ({
      id: (c.id || c.name || c.website || 'competitor').toString().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40),
      name: c.name || '',
      website: c.website || '',
      instagram: c.instagram || '',
      facebook: c.facebook || '',
      pageId: c.pageId || '',
    }))
}
