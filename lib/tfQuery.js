// Helper per il selettore periodo BmTimeframe: costruisce la query string e la
// cache-key da un oggetto tf = { preset, since, until }.
// Per i preset noti basta `preset=...`; per 'custom' passa since/until.

export function tfQuery(tf) {
  const preset = tf?.preset || 'last_28d'
  if (preset === 'custom' && tf?.since && tf?.until) {
    return `preset=custom&since=${encodeURIComponent(tf.since)}&until=${encodeURIComponent(tf.until)}`
  }
  return `preset=${encodeURIComponent(preset)}`
}

export function tfKey(tf) {
  return `${tf?.preset || ''}:${tf?.since || ''}:${tf?.until || ''}`
}

// ── Preset GLOBALE (string) ⇄ tf object ─────────────────────────────────────
// Il preset globale (page.js → /api/metrics) è una stringa. I range custom del
// date-picker li codifichiamo come "custom_<since>_<until>" così viaggiano nella
// stringa senza toccare fetchLive. /api/metrics getPresetRange li sa parsare.
export function globalPresetToTf(preset) {
  if (typeof preset === 'string' && preset.startsWith('custom_')) {
    const parts = preset.split('_')
    if (parts[1] && parts[2]) return { preset: 'custom', since: parts[1], until: parts[2] }
  }
  return { preset: preset || 'last_28d' }
}

export function tfToGlobalPreset(v) {
  if (v?.preset === 'custom' && v.since && v.until) return `custom_${v.since}_${v.until}`
  return v?.preset || 'last_28d'
}
