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
  { id: 'flux-kontext', name: 'Prodotto fedele (Kontext)', provider: 'fal-kontext', falModel: 'fal-ai/flux-pro/kontext/max', falModelMulti: 'fal-ai/flux-pro/kontext/max/multi', credits: 3, badge: 'Fedeltà prodotto', envKey: 'FAL_KEY', needsRef: true },
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

// Editing immagini (FLUX Kontext = edit descrittivo, reframe = cambio formato).
export const EDIT_CREDITS = 2
export const EDIT_FAL = {
  edit: 'fal-ai/flux-pro/kontext',        // prompt + image_url → immagine modificata
  reframe: 'fal-ai/image-editing/reframe', // image_url + aspect_ratio → nuovo formato
}

// Modelli VIDEO (Fase 2) — solo text->video e image->video, via fal.ai.
// Costo crediti alto (il video costa molto di più: ~$0.25-1.0 per 5s).
// t2v = endpoint text-to-video, i2v = endpoint image-to-video.
// NB: se fal cambia uno slug, l'errore lo segnala e si corregge QUI (1 file).
export const VIDEO_MODELS = [
  { id: 'luma-ray2-flash', name: 'Luma Ray 2 Flash', credits: 20, badge: 'Veloce',
    t2v: 'fal-ai/luma-dream-machine/ray-2-flash', i2v: 'fal-ai/luma-dream-machine/ray-2-flash/image-to-video', envKey: 'FAL_KEY' },
  { id: 'luma-ray2', name: 'Luma Ray 2', credits: 35, badge: 'Cinematic',
    t2v: 'fal-ai/luma-dream-machine/ray-2', i2v: 'fal-ai/luma-dream-machine/ray-2/image-to-video', envKey: 'FAL_KEY' },
  { id: 'kling-2.1', name: 'Kling 2.1 Master', credits: 50, badge: 'Premium',
    t2v: 'fal-ai/kling-video/v2.1/master/text-to-video', i2v: 'fal-ai/kling-video/v2.1/master/image-to-video', envKey: 'FAL_KEY' },
  { id: 'hailuo-02', name: 'MiniMax Hailuo 02', credits: 25, badge: 'Espressivo',
    t2v: 'fal-ai/minimax/hailuo-02/standard/text-to-video', i2v: 'fal-ai/minimax/hailuo-02/standard/image-to-video', envKey: 'FAL_KEY' },
]

export function getVideoModel(id) {
  return VIDEO_MODELS.find(m => m.id === id) || null
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

// Stili "one-click" (ispirati a Kive): impostano scena/luce/mood. La stringa
// `prompt` viene passata come `style` all'enhancer.
export const STYLE_PRESETS = [
  { id: 'studio',     label: 'Studio',      prompt: 'professional studio product photography, seamless background, soft diffused lighting, high detail, commercial' },
  { id: 'lifestyle',  label: 'Lifestyle',   prompt: 'lifestyle photography, real environment, natural candid scene, shallow depth of field, authentic' },
  { id: 'golden',     label: 'Golden hour', prompt: 'golden hour outdoor photography, warm sunlight, long soft shadows, cinematic, aspirational' },
  { id: 'minimal',    label: 'Minimal',     prompt: 'minimal aesthetic, clean negative space, pastel palette, soft shadows, editorial, premium' },
  { id: 'flatlay',    label: 'Flat-lay',    prompt: 'top-down flat-lay composition, neatly arranged props, even lighting, styled surface' },
  { id: 'ugc',        label: 'UGC',         prompt: 'authentic UGC style, handheld phone photo look, natural light, relatable, slightly imperfect' },
]
