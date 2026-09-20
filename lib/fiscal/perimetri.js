// ============================================================================
//  Perimetri fiscali e aliquote IVA per il registro corrispettivi.
//
//  Ogni riga di vendita viene classificata in un perimetro in base al PAESE DI
//  SPEDIZIONE (verificato: ShopifyQL espone `shipping_country`, e differisce da
//  `billing_country` in modo tutt'altro che marginale — su un negozio vero, in
//  settembre 2026, Italia valeva 16.693 € per spedizione contro 18.567 € per
//  fatturazione. Su un registro IVA scambiarli sposta vendite fra Italia e OSS).
//
//  L'imponibile si ricava scorporando dal LORDO con l'aliquota ordinaria del
//  paese, non con l'IVA riportata da Shopify: e' la logica del corrispettivo
//  fiscale, dove conta il regime applicabile e non il dato gestionale.
// ============================================================================

// Nome paese inglese (come lo restituisce ShopifyQL) → ISO 3166-1 alpha-2.
// Base ripresa da /api/shopify-countries per non avere due tabelle divergenti.
export const NOME_A_ISO = {
  'Italy': 'IT', 'France': 'FR', 'Spain': 'ES', 'Germany': 'DE', 'Portugal': 'PT',
  'Switzerland': 'CH', 'Austria': 'AT', 'Belgium': 'BE', 'Netherlands': 'NL', 'Luxembourg': 'LU',
  'United Kingdom': 'GB', 'Ireland': 'IE', 'Denmark': 'DK', 'Sweden': 'SE', 'Norway': 'NO',
  'Finland': 'FI', 'Iceland': 'IS', 'Poland': 'PL', 'Czechia': 'CZ', 'Czech Republic': 'CZ',
  'Slovakia': 'SK', 'Slovenia': 'SI', 'Hungary': 'HU', 'Romania': 'RO', 'Bulgaria': 'BG',
  'Croatia': 'HR', 'Greece': 'GR', 'Cyprus': 'CY', 'Malta': 'MT', 'Estonia': 'EE',
  'Latvia': 'LV', 'Lithuania': 'LT', 'United States': 'US', 'Canada': 'CA', 'Mexico': 'MX',
  'Brazil': 'BR', 'Argentina': 'AR', 'Chile': 'CL', 'Colombia': 'CO', 'Australia': 'AU',
  'New Zealand': 'NZ', 'Japan': 'JP', 'China': 'CN', 'Hong Kong SAR': 'HK', 'Hong Kong': 'HK',
  'Singapore': 'SG', 'South Korea': 'KR', 'India': 'IN', 'United Arab Emirates': 'AE',
  'Saudi Arabia': 'SA', 'Israel': 'IL', 'Turkey': 'TR', 'South Africa': 'ZA', 'Russia': 'RU',
  'Ukraine': 'UA', 'Serbia': 'RS', 'Monaco': 'MC', 'Andorra': 'AD', 'San Marino': 'SM',
  'Thailand': 'TH', 'Vietnam': 'VN', 'Indonesia': 'ID', 'Malaysia': 'MY', 'Philippines': 'PH',
  'Albania': 'AL', 'Bosnia and Herzegovina': 'BA', 'Montenegro': 'ME', 'North Macedonia': 'MK',
  'Moldova': 'MD', 'Georgia': 'GE', 'Armenia': 'AM', 'Kazakhstan': 'KZ', 'Qatar': 'QA',
  'Kuwait': 'KW', 'Bahrain': 'BH', 'Oman': 'OM', 'Egypt': 'EG', 'Morocco': 'MA', 'Tunisia': 'TN',
  'Taiwan': 'TW', 'Macao SAR': 'MO', 'Liechtenstein': 'LI', 'Gibraltar': 'GI', 'Jersey': 'JE',
  'Guernsey': 'GG', 'Isle of Man': 'IM', 'Peru': 'PE', 'Uruguay': 'UY', 'Ecuador': 'EC',
  'Panama': 'PA', 'Costa Rica': 'CR', 'Dominican Republic': 'DO', 'Puerto Rico': 'PR',
}
export const ISO_A_NOME = Object.fromEntries(Object.entries(NOME_A_ISO).map(([n, c]) => [c, n]))

// Nomi italiani per la pagina e per l'export del commercialista.
export const ISO_A_ITALIANO = {
  IT: 'Italia', FR: 'Francia', ES: 'Spagna', DE: 'Germania', PT: 'Portogallo', CH: 'Svizzera',
  AT: 'Austria', BE: 'Belgio', NL: 'Paesi Bassi', LU: 'Lussemburgo', GB: 'Regno Unito',
  IE: 'Irlanda', DK: 'Danimarca', SE: 'Svezia', NO: 'Norvegia', FI: 'Finlandia', IS: 'Islanda',
  PL: 'Polonia', CZ: 'Cechia', SK: 'Slovacchia', SI: 'Slovenia', HU: 'Ungheria', RO: 'Romania',
  BG: 'Bulgaria', HR: 'Croazia', GR: 'Grecia', CY: 'Cipro', MT: 'Malta', EE: 'Estonia',
  LV: 'Lettonia', LT: 'Lituania', US: 'Stati Uniti', CA: 'Canada', JP: 'Giappone',
  CN: 'Cina', HK: 'Hong Kong', SG: 'Singapore', KR: 'Corea del Sud', AU: 'Australia',
  NZ: 'Nuova Zelanda', AE: 'Emirati Arabi Uniti', IL: 'Israele', TR: 'Turchia', RU: 'Russia',
  UA: 'Ucraina', RS: 'Serbia', MC: 'Monaco', AD: 'Andorra', SM: 'San Marino', BR: 'Brasile',
  MX: 'Messico', IN: 'India', ZA: 'Sudafrica', TW: 'Taiwan', LI: 'Liechtenstein',
}

// ── Aliquote ordinarie UE, CON DATA DI VALIDITA' ───────────────────────────
// Le aliquote cambiano, e un registro che ricostruisce mesi passati deve usare
// quella in vigore ALLORA: applicare l'aliquota di oggi a un mese vecchio
// produce un imponibile sbagliato che poi finisce in dichiarazione. Ogni voce
// e' una lista ordinata { da: 'YYYY-MM-DD', aliquota }.
const ALIQUOTE_UE = {
  AT: [{ da: '2000-01-01', aliquota: 20 }],
  BE: [{ da: '2000-01-01', aliquota: 21 }],
  BG: [{ da: '2000-01-01', aliquota: 20 }],
  CY: [{ da: '2000-01-01', aliquota: 19 }],
  CZ: [{ da: '2000-01-01', aliquota: 21 }],
  DE: [{ da: '2000-01-01', aliquota: 19 }],
  DK: [{ da: '2000-01-01', aliquota: 25 }],
  EE: [{ da: '2000-01-01', aliquota: 20 }, { da: '2024-01-01', aliquota: 22 }, { da: '2025-07-01', aliquota: 24 }],
  ES: [{ da: '2000-01-01', aliquota: 21 }],
  FI: [{ da: '2000-01-01', aliquota: 24 }, { da: '2024-09-01', aliquota: 25.5 }],
  FR: [{ da: '2000-01-01', aliquota: 20 }],
  GR: [{ da: '2000-01-01', aliquota: 24 }],
  HR: [{ da: '2000-01-01', aliquota: 25 }],
  HU: [{ da: '2000-01-01', aliquota: 27 }],
  IE: [{ da: '2000-01-01', aliquota: 23 }],
  IT: [{ da: '2000-01-01', aliquota: 22 }],
  LT: [{ da: '2000-01-01', aliquota: 21 }],
  LU: [{ da: '2000-01-01', aliquota: 17 }],
  LV: [{ da: '2000-01-01', aliquota: 21 }],
  MT: [{ da: '2000-01-01', aliquota: 18 }],
  NL: [{ da: '2000-01-01', aliquota: 21 }],
  PL: [{ da: '2000-01-01', aliquota: 23 }],
  PT: [{ da: '2000-01-01', aliquota: 23 }],
  RO: [{ da: '2000-01-01', aliquota: 19 }, { da: '2025-08-01', aliquota: 21 }],
  SE: [{ da: '2000-01-01', aliquota: 25 }],
  SI: [{ da: '2000-01-01', aliquota: 22 }],
  SK: [{ da: '2000-01-01', aliquota: 20 }, { da: '2025-01-01', aliquota: 23 }],
}

export const PAESI_UE = Object.keys(ALIQUOTE_UE)

export const PERIMETRI = {
  ITALIA: { id: 'ITALIA', etichettaExport: 'Corrispettivi' },
  OSS: { id: 'OSS', etichettaExport: 'IVA OSS' },
  EXTRA_UE: { id: 'EXTRA_UE', etichettaExport: 'Extra-UE' },
  SENZA_PAESE: { id: 'SENZA_PAESE', etichettaExport: 'Da verificare' },
}

/** Codice ISO dal nome inglese di ShopifyQL. Null quando il paese manca. */
export function isoDaNome(nome) {
  const n = String(nome ?? '').trim()
  if (!n) return null
  if (NOME_A_ISO[n]) return NOME_A_ISO[n]
  // Alcuni nomi arrivano con suffissi ("Hong Kong SAR China"): si prova il
  // prefisso piu' lungo che conosciamo, invece di perdere la riga.
  const trovato = Object.keys(NOME_A_ISO).find(k => n.startsWith(k))
  return trovato ? NOME_A_ISO[trovato] : null
}

/**
 * Aliquota ordinaria in vigore in quel paese A QUELLA DATA.
 * Fuori UE ritorna 0 (cessione non imponibile IVA italiana).
 * Paese sconosciuto ritorna null: chi chiama NON deve inventare uno zero,
 * perche' zero significherebbe "extra-UE" e sposterebbe imponibile.
 */
export function aliquotaOrdinaria(iso, dataISO) {
  if (!iso) return null
  const scaglioni = ALIQUOTE_UE[iso]
  if (!scaglioni) return 0
  const d = String(dataISO || '').slice(0, 10)
  let vigente = scaglioni[0].aliquota
  for (const s of scaglioni) { if (d >= s.da) vigente = s.aliquota }
  return vigente
}

/** Perimetro fiscale della riga. */
export function perimetroDi(iso) {
  if (!iso) return 'SENZA_PAESE'
  if (iso === 'IT') return 'ITALIA'
  if (ALIQUOTE_UE[iso]) return 'OSS'
  return 'EXTRA_UE'
}

/**
 * Scorporo dell'IVA dal corrispettivo lordo.
 * Ritorna imponibile e imposta, oppure imponibile null quando l'aliquota non
 * e' determinabile: una riga senza paese non deve comparire come se fosse
 * interamente imponibile a IVA zero.
 */
export function scorpora(lordo, aliquota) {
  const l = Number(lordo) || 0
  if (aliquota == null) return { imponibile: null, iva: null }
  const imponibile = Math.round((l / (1 + aliquota / 100)) * 100) / 100
  return { imponibile, iva: Math.round((l - imponibile) * 100) / 100 }
}

/** Nome leggibile: italiano se lo conosciamo, altrimenti quello di Shopify. */
export function nomePaese(iso, nomeOriginale) {
  if (iso && ISO_A_ITALIANO[iso]) return ISO_A_ITALIANO[iso]
  return nomeOriginale || 'Paese mancante'
}
