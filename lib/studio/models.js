// Registry modelli Creative Studio + pacchetti crediti.
// Dati puri (nessun segreto): importabili sia client sia server.
// Costo in CREDITI per immagine generata = costo reale API x margine (~2-3x).
// Fase 1 = solo immagini. Video/UGC arrivano nelle fasi successive (type video/ugc).

export const FORMATS = [
  { id: 'square',    label: '1:1',  falSize: 'square_hd',     openaiSize: '1024x1024' },
  { id: 'portrait',  label: '4:5',  falSize: 'portrait_4_3',  openaiSize: '1024x1536' },
  { id: 'vertical',  label: '9:16', falSize: 'portrait_16_9', openaiSize: '1024x1536' },
  { id: 'landscape', label: '16:9', falSize: 'landscape_16_9', openaiSize: '1536x1024' },
]

// provider: 'fal' (gateway, 1 sola FAL_KEY) | 'fal-kontext' (immagine prodotto fedele)
// Solo modelli ad ALTA FEDELTÀ (rimossi flux1.1/ideogram/recraft/imagen/gpt-image).
export const IMAGE_MODELS = [
  { id: 'flux2-pro',   name: 'FLUX.2 Pro',    provider: 'fal',    falModel: 'fal-ai/flux-2-pro',           credits: 3, badge: 'Super realistico', envKey: 'FAL_KEY' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', provider: 'fal', falModel: 'fal-ai/nano-banana-pro',  credits: 5, badge: 'SOTA · testo 4K', envKey: 'FAL_KEY', useAspect: true },
  { id: 'seedream-4',  name: 'Seedream 4',    provider: 'fal',    falModel: 'fal-ai/bytedance/seedream/v4/text-to-image', credits: 2, badge: 'Realismo persone', envKey: 'FAL_KEY' },
  { id: 'nano-banana', name: 'Nano Banana',   provider: 'fal',    falModel: 'fal-ai/nano-banana',          credits: 2, badge: 'Coerenza / edit', envKey: 'FAL_KEY', useAspect: true },
  { id: 'flux-kontext', name: 'Prodotto fedele (Kontext)', provider: 'fal-kontext', falModel: 'fal-ai/flux-pro/kontext/max', falModelMulti: 'fal-ai/flux-pro/kontext/max/multi', credits: 3, badge: 'Fedeltà prodotto', envKey: 'FAL_KEY', needsRef: true },
]

// Virtual Try-On (prodotto indossato) — FASHN su fal.
export const TRYON_CREDITS = 4
export const TRYON_FAL = 'fal-ai/fashn/tryon/v1.5'

export function getImageModel(id) {
  return IMAGE_MODELS.find(m => m.id === id) || null
}

// Editing immagini (FLUX Kontext = edit descrittivo, reframe = cambio formato).
export const EDIT_CREDITS = 2
export const EDIT_FAL = {
  edit: 'fal-ai/flux-pro/kontext',        // prompt + image_url → immagine modificata
  reframe: 'fal-ai/image-editing/reframe', // image_url + aspect_ratio → nuovo formato
}

// ── creativo: Upscaler creativo + Relight ─────────────────────────────
// Upscaler creativo (avanzato): alza risoluzione e RIGENERA micro-dettaglio
// coerente (pelle, tessuti, capelli). Su fal = Clarity Upscaler.
export const UPSCALE_FAL = 'fal-ai/clarity-upscaler'
export const UPSCALE_OPTIONS = [
  { id: '2x', label: '2×', scale: 2, credits: 4 },
  { id: '4x', label: '4×', scale: 4, credits: 6 },
]
export function getUpscaleOption(id) {
  return UPSCALE_OPTIONS.find(o => o.id === id) || UPSCALE_OPTIONS[0]
}

// Relight (à la Relight): cambia l'illuminazione mantenendo il soggetto.
// Su fal = IC-Light v2. La luce può venire da un prompt o da uno Studio (ambiente).
export const RELIGHT_FAL = 'fal-ai/iclight-v2'
export const RELIGHT_CREDITS = 4

// Enhance/Restore (avanzato Enhance): nitidezza, ripristino sfocato, texture
// pelle/tessuti — senza cambiare composizione. Usa Clarity con creatività mirata.
export const ENHANCE_CREDITS = 5

// ── Model Training LoRA (di personaggi custom) ───────────────────────
// Addestra un modello su prodotto/personaggio/stile (3-20 foto) → coerenza.
// Training async su fal (coda); inferenza con la LoRA prodotta.
export const TRAIN_FAL = 'fal-ai/flux-lora-fast-training'
export const TRAIN_CREDITS = 40           // training (one-time, costoso)
export const LORA_FAL = 'fal-ai/flux-lora' // inferenza con la LoRA
export const LORA_CREDITS = 3             // per immagine generata col modello
export const TRAIN_KINDS = [
  { id: 'product',   label: 'Prodotto' },
  { id: 'character', label: 'Personaggio' },
  { id: 'style',     label: 'Stile' },
]

// ── con maschera: Inpainting con maschera + Camera angle + Recipes ────────────
// Inpainting (à la compositing): rigenera SOLO l'area dipinta dalla maschera.
// Su fal = FLUX Fill (image_url + mask_url + prompt; bianco = area da rigenerare).
export const INPAINT_FAL = 'fal-ai/flux-pro/v1/fill'
export const INPAINT_CREDITS = 3

// Camera angle: stessa identica scena/soggetto, nuovo angolo camera (via Kontext edit).
export const CAMERA_ANGLES = [
  { id: 'front',   label: 'Frontale',   instr: 'show the exact same subject from a straight front camera angle' },
  { id: 'three-q', label: '3/4',        instr: 'show the exact same subject from a 3/4 (three-quarter) camera angle' },
  { id: 'side',    label: 'Profilo',    instr: 'show the exact same subject from a side profile camera angle' },
  { id: 'back',    label: 'Retro',      instr: 'show the exact same subject from behind (back view)' },
  { id: 'top',     label: 'Dall’alto',  instr: 'show the exact same subject from a top-down (overhead) camera angle' },
  { id: 'low',     label: 'Dal basso',  instr: 'show the exact same subject from a low angle looking up' },
]

// Recipes (workflow concatenati): incatena operazioni 1-click su un'immagine.
// op: 'upscale'(scale) | 'relight'(useStudio|prompt) | 'reframe'(format)
export const RECIPES = [
  { id: 'product-hero', label: 'Product Hero', desc: 'Relight studio → Upscale 4×',
    steps: [{ op: 'relight', useStudio: true, prompt: 'clean premium studio lighting, soft key light, gentle reflection' }, { op: 'upscale', scale: '4x' }] },
  { id: 'social-story', label: 'Social Story', desc: 'Reframe 9:16 → Upscale 2×',
    steps: [{ op: 'reframe', format: 'vertical' }, { op: 'upscale', scale: '2x' }] },
  { id: 'hi-res-clean', label: 'Hi-Res Clean', desc: 'Upscale 4× dettaglio',
    steps: [{ op: 'upscale', scale: '4x' }] },
  { id: 'golden-ad', label: 'Golden Ad', desc: 'Relight golden hour → Upscale 2×',
    steps: [{ op: 'relight', prompt: 'warm golden-hour light, long soft shadows, cinematic glow' }, { op: 'upscale', scale: '2x' }] },
]

// Modelli VIDEO (Fase 2) — solo text->video e image->video, via fal.ai.
// Costo crediti alto (il video costa molto di più: ~$0.25-1.0 per 5s).
// t2v = endpoint text-to-video, i2v = endpoint image-to-video.
// NB: se fal cambia uno slug, l'errore lo segnala e si corregge QUI (1 file).
export const VIDEO_MODELS = [
  { id: 'veo3', name: 'Google Veo 3', credits: 80, badge: 'Super realistico',
    t2v: 'fal-ai/veo3', i2v: 'fal-ai/veo3/image-to-video', envKey: 'FAL_KEY' },
  { id: 'luma-ray2-flash', name: 'Luma Ray 2 Flash', credits: 20, badge: 'Veloce',
    t2v: 'fal-ai/luma-dream-machine/ray-2-flash', i2v: 'fal-ai/luma-dream-machine/ray-2-flash/image-to-video', envKey: 'FAL_KEY' },
  { id: 'luma-ray2', name: 'Luma Ray 2', credits: 35, badge: 'Cinematic',
    t2v: 'fal-ai/luma-dream-machine/ray-2', i2v: 'fal-ai/luma-dream-machine/ray-2/image-to-video', envKey: 'FAL_KEY' },
  { id: 'kling-2.1', name: 'Kling 2.1 Master', credits: 50, badge: 'Premium',
    t2v: 'fal-ai/kling-video/v2.1/master/text-to-video', i2v: 'fal-ai/kling-video/v2.1/master/image-to-video', envKey: 'FAL_KEY' },
  { id: 'hailuo-02', name: 'MiniMax Hailuo 02', credits: 25, badge: 'Espressivo',
    t2v: 'fal-ai/minimax/hailuo-02/standard/text-to-video', i2v: 'fal-ai/minimax/hailuo-02/standard/image-to-video', envKey: 'FAL_KEY' },
  { id: 'kling-2.5', name: 'Kling 2.5 Turbo Pro', credits: 45, badge: 'Top realismo',
    t2v: 'fal-ai/kling-video/v2.5-turbo/pro/text-to-video', i2v: 'fal-ai/kling-video/v2.5-turbo/pro/image-to-video', envKey: 'FAL_KEY' },
  { id: 'seedance-1', name: 'Seedance 1 Pro', credits: 30, badge: 'Dinamico',
    t2v: 'fal-ai/bytedance/seedance/v1/pro/text-to-video', i2v: 'fal-ai/bytedance/seedance/v1/pro/image-to-video', envKey: 'FAL_KEY' },
  { id: 'wan-2.2', name: 'Wan 2.2', credits: 22, badge: 'Veloce / economico',
    t2v: 'fal-ai/wan/v2.2-a14b/text-to-video', i2v: 'fal-ai/wan/v2.2-a14b/image-to-video', envKey: 'FAL_KEY' },
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

// Stili "one-click" (a libreria asset): impostano scena/luce/mood. La stringa
// `prompt` viene passata come `style` all'enhancer.
export const STYLE_PRESETS = [
  { id: 'studio',     label: 'Studio',      prompt: 'professional studio product photography, seamless background, soft diffused lighting, high detail, commercial' },
  { id: 'lifestyle',  label: 'Lifestyle',   prompt: 'lifestyle photography, real environment, natural candid scene, shallow depth of field, authentic' },
  { id: 'golden',     label: 'Golden hour', prompt: 'golden hour outdoor photography, warm sunlight, long soft shadows, cinematic, aspirational' },
  { id: 'minimal',    label: 'Minimal',     prompt: 'minimal aesthetic, clean negative space, pastel palette, soft shadows, editorial, premium' },
  { id: 'flatlay',    label: 'Flat-lay',    prompt: 'top-down flat-lay composition, neatly arranged props, even lighting, styled surface' },
  { id: 'ugc',        label: 'UGC',         prompt: 'authentic UGC style, handheld phone photo look, natural light, relatable, slightly imperfect' },
]

// ── STUDIOS (a libreria asset) ───────────────────────────────────────────────
// Ambienti completi e selezionabili che impostano scena, set, luce e mood.
// Si applicano al PRODOTTO (via Kontext) e al PROMPT come `style`/environment.
// `swatch` = anteprima CSS (gradiente) che riproduce la palette dell'ambiente,
// così la UI mostra un preview senza dover ospitare immagini.
// category: portrait | product | lifestyle | home | street | nature
export const STUDIO_CATEGORIES = [
  { id: 'portrait', label: 'Portrait' },
  { id: 'product',  label: 'Product' },
  { id: 'lifestyle',label: 'Lifestyle' },
  { id: 'home',     label: 'Home' },
  { id: 'street',   label: 'Street' },
  { id: 'nature',   label: 'Nature' },
]

export const STUDIO_PRESETS = [
  // ── Portrait ───────────────────────────────────────────────
  { id: 'blue-flower-portrait', label: 'Blue Flower Studio Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 35% 30%, #4f6bd6 0%, #25357e 45%, #0c1230 100%)',
    prompt: 'editorial studio portrait, subject framed by deep-blue cornflower florals in soft focus, moody cinematic side light, shallow depth of field, fashion magazine aesthetic' },
  { id: 'red-flower-portrait', label: 'Red Flower Studio Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 40% 35%, #e0506a 0%, #9c1f33 50%, #2a0810 100%)',
    prompt: 'editorial studio portrait surrounded by blurred crimson flowers, dramatic warm light, blooming bokeh foreground, high-fashion mood' },
  { id: 'yellow-flower-portrait', label: 'Yellow Flower Studio Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 50% 45%, #f4d24a 0%, #c79a1f 55%, #4a3608 100%)',
    prompt: 'portrait standing in a field of bright yellow rapeseed flowers, soft daylight, vivid saturated color, dreamy editorial fashion look' },
  { id: 'cobalt-studio-portrait', label: 'Cobalt Studio Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 50% 40%, #2f6bff 0%, #123aa6 50%, #050a1e 100%)',
    prompt: 'striking studio portrait on a vivid cobalt-blue backdrop, sharp directional rim light, futuristic high-contrast editorial fashion' },
  { id: 'burgundy-portrait', label: 'Burgundy Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 45% 40%, #7a2233 0%, #4a1320 55%, #1c0710 100%)',
    prompt: 'studio portrait on a deep burgundy fabric drape, warm low-key lighting, rich shadows, intimate fashion editorial mood' },
  { id: 'wet-portrait', label: 'Wet Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 50% 35%, #3a4a55 0%, #1c272e 55%, #070b0e 100%)',
    prompt: 'high-fashion wet-look studio portrait, glossy skin and damp hair, dark slate backdrop, hard glossy specular light, cinematic' },
  { id: 'grass-green-portrait', label: 'Grass Green Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 45% 40%, #5e8f5a 0%, #355a32 55%, #0f2110 100%)',
    prompt: 'studio portrait on a muted grass-green seamless backdrop, soft even light, calm minimal sportswear editorial' },
  { id: 'editorial-studio-portrait', label: 'Editorial Studio Portrait', category: 'portrait',
    swatch: 'radial-gradient(circle at 50% 40%, #d9d4cb 0%, #aaa49a 55%, #4d4942 100%)',
    prompt: 'classic editorial studio portrait on a neutral grey seamless backdrop, soft beauty-dish lighting, clean fashion catalogue look' },
  { id: 'white-studio', label: 'White Studio', category: 'portrait',
    swatch: 'radial-gradient(circle at 50% 40%, #ffffff 0%, #ededed 55%, #b8b8b8 100%)',
    prompt: 'bright high-key white studio, seamless white cyclorama, soft wraparound lighting, clean minimal commercial fashion' },
  { id: 'blue-hour-portrait', label: 'Blue Hour Portrait', category: 'portrait',
    swatch: 'linear-gradient(160deg, #14264a 0%, #0a1430 55%, #05070f 100%)',
    prompt: 'cinematic blue-hour portrait, cool twilight ambient light with a single warm accent, moody atmospheric fashion editorial' },

  // ── Product ────────────────────────────────────────────────
  { id: 'ghost-mannequin', label: 'Ghost Mannequin White', category: 'product',
    swatch: 'radial-gradient(circle at 50% 45%, #f6f6f4 0%, #e2e2de 60%, #c2c2bc 100%)',
    prompt: 'ghost-mannequin product photography, garment shot on invisible mannequin, pure white seamless background, even soft light, ecommerce catalogue' },
  { id: 'cobalt-float', label: 'Cobalt Float', category: 'product',
    swatch: 'radial-gradient(circle at 45% 35%, #3a7bff 0%, #1747c9 55%, #0a1740 100%)',
    prompt: 'product floating mid-air on a vivid cobalt-blue gradient, fresh florals and fruit suspended around it, glossy reflections, premium beauty advertising' },
  { id: 'x-ray', label: 'X-Ray', category: 'product',
    swatch: 'radial-gradient(circle at 50% 45%, #2b6fb0 0%, #123a63 55%, #03070f 100%)',
    prompt: 'product on a dark backdrop lit with a single cold spotlight, x-ray blue glow, dramatic minimal high-end tech product photography' },
  { id: 'clothing-line-shaded', label: 'Clothing Line Shaded', category: 'product',
    swatch: 'linear-gradient(155deg, #d8a86a 0%, #b07c3f 50%, #6a4416 100%)',
    prompt: 'garment hanging on a clothing line against a warm terracotta wall, dappled leaf shadows, golden afternoon sun, sun-drenched lifestyle still life' },
  { id: 'desert-rocks', label: 'Desert Rocks', category: 'product',
    swatch: 'linear-gradient(160deg, #d2a96f 0%, #9a7140 55%, #4a3018 100%)',
    prompt: 'product resting on sunlit desert rocks, warm golden light, long shadows, raw natural luxury still life' },
  { id: 'terracotta', label: 'Terracotta', category: 'product',
    swatch: 'radial-gradient(circle at 45% 40%, #e07a3e 0%, #b34d1c 55%, #4a1d09 100%)',
    prompt: 'product on a burnt-orange terracotta backdrop with weathered driftwood, warm directional light, earthy editorial fragrance still life' },
  { id: 'golden', label: 'Golden', category: 'product',
    swatch: 'radial-gradient(circle at 45% 40%, #f0c25a 0%, #c98a2a 55%, #5a3a10 100%)',
    prompt: 'product glowing in warm golden backlight, soft halo flare, luminous amber tones, premium fragrance advertising' },
  { id: 'shoreglow', label: 'Shoreglow', category: 'product',
    swatch: 'linear-gradient(165deg, #f3c98a 0%, #e09a55 50%, #9a5a2a 100%)',
    prompt: 'product on soft sand lit by a glowing peach sunset gradient, gentle long shadow, serene warm minimal still life' },
  { id: 'brown-ledge-studio', label: 'Brown Ledge Studio', category: 'product',
    swatch: 'linear-gradient(160deg, #cdb79a 0%, #9c7f5e 55%, #574330 100%)',
    prompt: 'product placed on a warm brown plinth in a beige studio, soft neutral light, calm muted tones, refined commercial still life' },
  { id: 'microgreens', label: 'Microgreens', category: 'product',
    swatch: 'radial-gradient(circle at 45% 45%, #c98a4a 0%, #7a8a3a 55%, #2a3a14 100%)',
    prompt: 'product exploding with flying flower petals, moss and microgreens, dynamic natural botanical splash, vivid premium fragrance hero shot' },
  { id: 'cream', label: 'Cream', category: 'product',
    swatch: 'radial-gradient(circle at 50% 45%, #efe2cb 0%, #d8c4a3 60%, #a98f68 100%)',
    prompt: 'product on a soft cream seamless backdrop, gentle gradient shadow, warm minimal premium ecommerce still life' },
  { id: 'minimal-fashion-studio', label: 'Minimal Fashion Studio', category: 'product',
    swatch: 'radial-gradient(circle at 50% 45%, #e7e1d7 0%, #c3bcae 60%, #7e7868 100%)',
    prompt: 'minimal fashion studio, warm beige seamless backdrop, soft sculpted light, clean negative space, premium editorial garment shot' },

  // ── Lifestyle / Home ───────────────────────────────────────
  { id: 'greenhouse', label: 'Greenhouse', category: 'home',
    swatch: 'linear-gradient(160deg, #8fae7a 0%, #5c7d4e 55%, #24351c 100%)',
    prompt: 'scene inside a lush sunlit greenhouse, hanging plants and glass panes, soft diffused daylight, fresh organic lifestyle mood' },
  { id: 'designer-home', label: 'Designer Home', category: 'home',
    swatch: 'linear-gradient(160deg, #d8cdbb 0%, #b6a48a 55%, #6a5b46 100%)',
    prompt: 'modern designer living room, mid-century furniture and large plants, warm natural window light, aspirational interior lifestyle' },
  { id: 'bohemian-home', label: 'Bohemian Home', category: 'home',
    swatch: 'linear-gradient(160deg, #c79a64 0%, #8f6a3f 55%, #4a3016 100%)',
    prompt: 'cozy bohemian home with vinyl records, books and warm wood, soft golden window light, relaxed authentic lifestyle' },
  { id: 'brutalist-home', label: 'Brutalist Home', category: 'home',
    swatch: 'linear-gradient(160deg, #c9c6bf 0%, #97948c 55%, #4e4c47 100%)',
    prompt: 'minimal brutalist concrete interior, raw textured walls, single wooden chair, hard daylight casting strong shadows, architectural editorial' },
  { id: 'sunny-home', label: 'Sunny Home', category: 'home',
    swatch: 'linear-gradient(160deg, #ecdcc0 0%, #c9b48e 55%, #7e6a48 100%)',
    prompt: 'calm sunny home interior, plant on a wooden table, soft warm sunlight through the window, serene minimal lifestyle still life' },
  { id: 'dry-studio', label: 'Dry Studio', category: 'lifestyle',
    swatch: 'radial-gradient(circle at 50% 45%, #ece6da 0%, #cfc6b2 60%, #968c74 100%)',
    prompt: 'styled still life on smooth pebbles with dried botanicals, bright airy daylight, soft neutral palette, organic minimal set design' },

  // ── Street ─────────────────────────────────────────────────
  { id: 'americana-streetstyle', label: 'Americana Streetstyle', category: 'street',
    swatch: 'linear-gradient(160deg, #c98f5a 0%, #8a5c34 55%, #3a2414 100%)',
    prompt: 'retro americana street scene by a vintage diner and motel, classic car, warm late-afternoon sun, candid streetstyle fashion' },
  { id: 'everyday-barcelona', label: 'Everyday Barcelona', category: 'street',
    swatch: 'linear-gradient(160deg, #b88a5a 0%, #7e5f3a 55%, #322516 100%)',
    prompt: 'narrow Barcelona street with plants and warm stone facades, soft Mediterranean daylight, relaxed everyday streetstyle' },
  { id: 'parisian-stairs', label: 'Everyday Parisian Stairs', category: 'street',
    swatch: 'linear-gradient(160deg, #b9b3a6 0%, #837d70 55%, #3a362e 100%)',
    prompt: 'candid moment on classic Parisian stone stairs, Haussmann architecture, soft overcast daylight, effortless French streetstyle' },
  { id: 'soho-streetstyle', label: 'Soho Streetstyle', category: 'street',
    swatch: 'linear-gradient(160deg, #a9a097 0%, #6f675d 55%, #2a261f 100%)',
    prompt: 'urban Soho street with brick buildings and shopfronts, busy candid daylight, documentary streetstyle fashion' },
  { id: 'nyc-night-streetstyle', label: 'NYC Night Streetstyle', category: 'street',
    swatch: 'linear-gradient(160deg, #2a3a55 0%, #16203a 55%, #060a14 100%)',
    prompt: 'neon-lit NYC street at night, glowing signage bokeh, cool cinematic ambient light, edgy nightlife streetstyle' },
  { id: 'nyc-bridge', label: 'NYC Bridge', category: 'street',
    swatch: 'linear-gradient(160deg, #6a7a86 0%, #3e4a55 55%, #141a20 100%)',
    prompt: 'industrial NYC steel bridge with red girders, gritty urban backdrop, dynamic daylight, athletic streetstyle energy' },

  // ── Nature ─────────────────────────────────────────────────
  { id: 'mediterranean-cliffs', label: 'Mediterranean Cliffs', category: 'nature',
    swatch: 'linear-gradient(160deg, #3f7da6 0%, #9a6a4a 55%, #3a2417 100%)',
    prompt: 'rugged Mediterranean coastal cliffs over deep blue sea, bright natural sunlight, raw escapist outdoor editorial' },
  { id: 'scottish-highland', label: 'Scottish Highland', category: 'nature',
    swatch: 'linear-gradient(160deg, #44525a 0%, #2c3a34 55%, #10160f 100%)',
    prompt: 'moody Scottish highland landscape, misty mountains and heather, cool overcast light, cinematic outdoor adventure mood' },
  { id: 'blue-hour-beach', label: 'Blue Hour Beach', category: 'nature',
    swatch: 'linear-gradient(160deg, #355a8a 0%, #6a4a55 55%, #1a1424 100%)',
    prompt: 'serene beach at blue hour, calm sea and cool twilight sky, soft glow, motion-blur fashion editorial atmosphere' },
  { id: 'joshua-tree', label: 'Joshua Tree', category: 'nature',
    swatch: 'linear-gradient(160deg, #cbb489 0%, #9a7e54 55%, #4a3820 100%)',
    prompt: 'sunny Joshua Tree desert with airstream trailer and dry shrubs, warm golden light, road-trip lifestyle editorial' },
  { id: 'coastline', label: 'Coastline', category: 'nature',
    swatch: 'linear-gradient(160deg, #9aa6a0 0%, #5e6a6a 55%, #20282a 100%)',
    prompt: 'standing on a concrete pier by a calm coastline, soft hazy daylight, muted serene palette, quiet outdoor editorial' },
  { id: 'outdoor-court', label: 'Outdoor Court', category: 'nature',
    swatch: 'linear-gradient(160deg, #6a8a86 0%, #45625f 55%, #182826 100%)',
    prompt: 'empty outdoor stadium with weathered seats, overcast daylight, candid athletic streetstyle on the bleachers' },
]

export function getStudio(id) {
  return STUDIO_PRESETS.find(s => s.id === id) || null
}
