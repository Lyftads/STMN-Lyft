'use client'

import { avvisa } from '../../../lib/client/avviso'
import { useI18n } from '../../../lib/i18n/I18nProvider'

// Un codice (ID articolo, SKU) che si copia con un clic. Si usa dove il valore serve
// altrove — Merchant Center, Shopify, un foglio — e riscriverlo a mano vuol dire sbagliarlo.
export default function Copia({ testo, children, style }) {
  const { t } = useI18n()
  if (!testo) return children ?? null
  const copia = async (e) => {
    e.stopPropagation()
    try { await navigator.clipboard.writeText(String(testo)); avvisa(t('ui.copied', null, 'Copiato'), 'ok') }
    catch { avvisa(t('ui.copyFailed', null, 'Non sono riuscito a copiare'), 'errore') }
  }
  return (
    <span role="button" tabIndex={0} className="ly-copia" style={style} title={t('ui.clickToCopy', null, 'Clic per copiare')}
      onClick={copia} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); copia(e) } }}>
      {children ?? testo}
    </span>
  )
}
