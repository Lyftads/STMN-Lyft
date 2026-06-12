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
