// Le foto dei prodotti arrivano dal CDN di Shopify a grandezza piena (spesso
// 2000 pixel) e nelle tabelle si mostrano a 36-56. Il CDN ridimensiona da solo
// se glielo si chiede: con cento righe per pagina sono decine di megabyte in
// meno. Si chiedono TRE volte i pixel mostrati: e' la densita' degli schermi
// piu' fitti (iPhone), cosi' la miniatura resta nitida ovunque — a 2x sui
// telefoni risultava morbida. Costa 3-5 KB invece di 1: sempre niente contro 500.
// Un URL che non e' di Shopify torna com'e'.
export function miniatura(url, lato = 40) {
  if (!url || typeof url !== 'string') return url || null
  if (!/cdn\.shopify\.com|\/cdn\/shop\//.test(url)) return url
  if (/[?&]width=\d+/.test(url)) return url
  return `${url}${url.includes('?') ? '&' : '?'}width=${Math.round(lato * 3)}`
}
