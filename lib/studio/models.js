// Registry modelli Creative Studio + pacchetti crediti.
// Dati puri (nessun segreto): importabili sia client sia server.
// Costo in CREDITI per immagine generata = costo reale API x margine (~2-3x).
// Fase 1 = solo immagini. Video/UGC arrivano nelle fasi successive (type video/ugc).

export const FORMATS = [
  { id: 'square',    label: '1:1',  falSize: 'square_hd',     openaiSize: '1024x1024' },
  { id: 'vertical',  label: '9:16', falSize: 'portrait_16_9', openaiSize: '1024x1536' },
  { id: 'landscape', label: '16:9', falSize: 'landscape_16_9', openaiSize: '1536x1024' },
]

// provider: 'fal' (gateway, 1 sola FAL_KEY) | 'openai' (GPT Image nativo)
export const IMAGE_MODELS = [
  { id: 'flux-pro',    name: 'FLUX 1.1 Pro',  provider: 'fal',    falModel: 'fal-ai/flux-pro/v1.1',        credits: 2, badge: 'Foto-realismo', envKey: 'FAL_KEY' },
  { id: 'flux-ultra',  name: 'FLUX 1.1 Ultra', provider: 'fal',   falModel: 'fal-ai/flux-pro/v1.1-ultra',  credits: 3, badge: 'Ultra dettaglio', envKey: 'FAL_KEY' },
  { id: 'ideogram-v3', name: 'Ideogram 3.0',  provider: 'fal',    falModel: 'fal-ai/ideogram/v3',          credits: 3, badge: 'Testo nell’immagine', envKey: 'FAL_KEY' },
  { id: 'recraft-v3',  name: 'Recraft V3',    provider: 'fal',    falModel: 'fal-ai/recraft-v3',           credits: 2, badge: 'Design / brand', envKey: 'FAL_KEY' },
  { id: 'imagen-4',    name: 'Imagen 4',      provider: 'fal',    falModel: 'fal-ai/imagen4/preview',      credits: 2, badge: 'Google', envKey: 'FAL_KEY' },
  { id: 'gpt-image-1', name: 'GPT Image',     provider: 'openai',                                          credits: 2, badge: 'Aderenza prompt', envKey: 'OPENAI_API_KEY' },
]

export function getImageModel(id) {
  return IMAGE_MODELS.find(m => m.id === id) || null
}

export function getFormat(id) {
  return FORMATS.find(f => f.id === id) || FORMATS[0]
}

// Pacchetti crediti acquistabili (one-time Stripe Checkout).
// Il prezzo REALE e' definito dai price_... su Stripe; qui solo display + mappa env.
export const CREDIT_PACKS = [
  { id: 'pack_100',  credits: 100,  priceLabel: '€9',   priceEnv: 'STRIPE_PRICE_CREDITS_100' },
  { id: 'pack_500',  credits: 500,  priceLabel: '€39',  priceEnv: 'STRIPE_PRICE_CREDITS_500',  best: true },
  { id: 'pack_2000', credits: 2000, priceLabel: '€129', priceEnv: 'STRIPE_PRICE_CREDITS_2000' },
]

export function getCreditPack(id) {
  return CREDIT_PACKS.find(p => p.id === id) || null
}
