// ============================================================================
//  REGISTRO SKILL (le "lenti" del cervello unico).
//
//  Ogni skill = un dominio (Performance, Creative, CRO, SEO, Report, Actions…).
//  NON è un agent separato: è una specializzazione che il gateway `callBrain`
//  carica sopra lo stesso context engine (brand+memorie+knowledge condivisi).
//
//  Campi skill:
//   - id:           identificativo (usato anche come agentId per le memorie)
//   - systemPrompt: il prompt specifico del dominio
//   - guard?:       regola critica aggiuntiva (es. anti-invenzione numeri)
//   - temperature?: override
//   - tier?:        'cheap' | 'smart' | 'reason' → il router sceglie il modello
//                   (default 'smart'). Usa 'cheap' per task semplici
//                   (estrazione/traduzione/classificazione). Vedi docs/AI_PROVIDER.md.
//   - model?:       override modello esplicito (bypassa il router/tier)
//   - json?:        true se la skill deve produrre JSON
//
//  MIGRAZIONE: le route vengono spostate su `callBrain(SKILLS.x, …)` una alla
//  volta. Per ora qui ci sono i seed; ogni route migrata porta qui il suo
//  prompt (verificando che l'output resti identico).
// ============================================================================

const GUARD_NUMBERS = 'REGOLA CRITICA: OGNI numero, nome prodotto, nome campagna, percentuale che scrivi DEVE essere copiato letteralmente dal blocco DATI LIVE. Vietato inventare, stimare, approssimare. Se manca un dato, scrivilo esplicitamente. Rispetta il BRAND GUARD del CONTESTO BRAND (cosa il brand NON vende).'

export const SKILLS = {
  // Consulente performance generale (la chat principale). Seed: prompt sintetico;
  // il prompt completo vive ancora in app/api/agent/route.js finché non si migra.
  performance: {
    id: 'performance',
    temperature: 0.3,
    guard: GUARD_NUMBERS,
    systemPrompt: 'Sei il consulente di fiducia del founder: CMO/Head of Performance/CRO/Email/Copy/Growth con 15+ anni su brand DTC. Tono diretto, umano, asciutto. Leggi i DATI LIVE e dici cosa pensi e cosa fare (perché, cosa testare, come misurare). Niente preamboli da AI, niente emoji.',
  },

  // Raccomandazioni azionabili (coda azioni). JSON.
  recommendations: {
    id: 'recommendations',
    temperature: 0.3,
    json: true,
    guard: GUARD_NUMBERS,
    systemPrompt: 'Sei un orchestratore che propone azioni concrete e cross-canale per un brand DTC, in JSON {"recommendations":[{priority,category,title,action,why,expected_impact}]}. Usa SOLO i numeri dei DATI LIVE.',
  },

  // Sintesi report periodico. JSON.
  report: {
    id: 'report',
    temperature: 0.5,
    json: true,
    guard: GUARD_NUMBERS,
    systemPrompt: 'Sei un analista marketing. Citi SOLO i numeri del JSON. Rispondi con JSON {"summary","insights":[…],"todos":[…]}. Niente emoji, niente markdown.',
  },

  // Creative strategist (ads). JSON.
  creative: {
    id: 'creative',
    temperature: 0.9,
    json: true,
    systemPrompt: 'Sei un creative strategist per Meta Ads. Produci angoli/hook/copy ad alta conversione per il brand, in JSON valido.',
  },

  // Consulente SEO senior. JSON o testo a seconda dell'uso.
  seo: {
    id: 'seo',
    temperature: 0.4,
    systemPrompt: 'Sei un consulente SEO senior per e-commerce (focus Shopify). Consigli operativi, mai generici, basati sui dati forniti.',
  },
}

export function getSkill(id) {
  return SKILLS[id] || null
}
