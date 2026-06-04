// Centroidi approssimati dei Paesi (ISO 3166-1 alpha-2 → { lat, lng, name }).
// Usati per posizionare i punti "visitatori live" sul globo a partire dal
// dimension `countryId` di GA4 Realtime. Lista pragmatica: copre praticamente
// tutto il traffico reale e-commerce (EU, Americhe, principali Asia/MEA/Oceania).
const COUNTRY_CENTROIDS = {
  IT: { lat: 41.87, lng: 12.57, name: 'Italy' },
  FR: { lat: 46.23, lng: 2.21, name: 'France' },
  DE: { lat: 51.17, lng: 10.45, name: 'Germany' },
  ES: { lat: 40.46, lng: -3.75, name: 'Spain' },
  PT: { lat: 39.40, lng: -8.22, name: 'Portugal' },
  GB: { lat: 55.38, lng: -3.44, name: 'United Kingdom' },
  IE: { lat: 53.41, lng: -8.24, name: 'Ireland' },
  NL: { lat: 52.13, lng: 5.29, name: 'Netherlands' },
  BE: { lat: 50.50, lng: 4.47, name: 'Belgium' },
  LU: { lat: 49.82, lng: 6.13, name: 'Luxembourg' },
  CH: { lat: 46.82, lng: 8.23, name: 'Switzerland' },
  AT: { lat: 47.52, lng: 14.55, name: 'Austria' },
  DK: { lat: 56.26, lng: 9.50, name: 'Denmark' },
  SE: { lat: 60.13, lng: 18.64, name: 'Sweden' },
  NO: { lat: 60.47, lng: 8.47, name: 'Norway' },
  FI: { lat: 61.92, lng: 25.75, name: 'Finland' },
  IS: { lat: 64.96, lng: -19.02, name: 'Iceland' },
  PL: { lat: 51.92, lng: 19.15, name: 'Poland' },
  CZ: { lat: 49.82, lng: 15.47, name: 'Czechia' },
  SK: { lat: 48.67, lng: 19.70, name: 'Slovakia' },
  HU: { lat: 47.16, lng: 19.50, name: 'Hungary' },
  RO: { lat: 45.94, lng: 24.97, name: 'Romania' },
  BG: { lat: 42.73, lng: 25.49, name: 'Bulgaria' },
  GR: { lat: 39.07, lng: 21.82, name: 'Greece' },
  HR: { lat: 45.10, lng: 15.20, name: 'Croatia' },
  SI: { lat: 46.15, lng: 14.99, name: 'Slovenia' },
  RS: { lat: 44.02, lng: 21.01, name: 'Serbia' },
  BA: { lat: 43.92, lng: 17.68, name: 'Bosnia and Herzegovina' },
  AL: { lat: 41.15, lng: 20.17, name: 'Albania' },
  MK: { lat: 41.61, lng: 21.75, name: 'North Macedonia' },
  ME: { lat: 42.71, lng: 19.37, name: 'Montenegro' },
  EE: { lat: 58.60, lng: 25.01, name: 'Estonia' },
  LV: { lat: 56.88, lng: 24.60, name: 'Latvia' },
  LT: { lat: 55.17, lng: 23.88, name: 'Lithuania' },
  UA: { lat: 48.38, lng: 31.17, name: 'Ukraine' },
  BY: { lat: 53.71, lng: 27.95, name: 'Belarus' },
  RU: { lat: 61.52, lng: 105.32, name: 'Russia' },
  TR: { lat: 38.96, lng: 35.24, name: 'Türkiye' },
  CY: { lat: 35.13, lng: 33.43, name: 'Cyprus' },
  MT: { lat: 35.94, lng: 14.38, name: 'Malta' },
  US: { lat: 39.78, lng: -100.45, name: 'United States' },
  CA: { lat: 56.13, lng: -106.35, name: 'Canada' },
  MX: { lat: 23.63, lng: -102.55, name: 'Mexico' },
  BR: { lat: -14.24, lng: -51.93, name: 'Brazil' },
  AR: { lat: -38.42, lng: -63.62, name: 'Argentina' },
  CL: { lat: -35.68, lng: -71.54, name: 'Chile' },
  CO: { lat: 4.57, lng: -74.30, name: 'Colombia' },
  PE: { lat: -9.19, lng: -75.02, name: 'Peru' },
  UY: { lat: -32.52, lng: -55.77, name: 'Uruguay' },
  VE: { lat: 6.42, lng: -66.59, name: 'Venezuela' },
  EC: { lat: -1.83, lng: -78.18, name: 'Ecuador' },
  CR: { lat: 9.75, lng: -83.75, name: 'Costa Rica' },
  PA: { lat: 8.54, lng: -80.78, name: 'Panama' },
  DO: { lat: 18.74, lng: -70.16, name: 'Dominican Republic' },
  GT: { lat: 15.78, lng: -90.23, name: 'Guatemala' },
  MA: { lat: 31.79, lng: -7.09, name: 'Morocco' },
  DZ: { lat: 28.03, lng: 1.66, name: 'Algeria' },
  TN: { lat: 33.89, lng: 9.54, name: 'Tunisia' },
  EG: { lat: 26.82, lng: 30.80, name: 'Egypt' },
  ZA: { lat: -30.56, lng: 22.94, name: 'South Africa' },
  NG: { lat: 9.08, lng: 8.68, name: 'Nigeria' },
  KE: { lat: -0.02, lng: 37.91, name: 'Kenya' },
  GH: { lat: 7.95, lng: -1.02, name: 'Ghana' },
  CI: { lat: 7.54, lng: -5.55, name: "Côte d'Ivoire" },
  SN: { lat: 14.50, lng: -14.45, name: 'Senegal' },
  ET: { lat: 9.15, lng: 40.49, name: 'Ethiopia' },
  TZ: { lat: -6.37, lng: 34.89, name: 'Tanzania' },
  AE: { lat: 23.42, lng: 53.85, name: 'United Arab Emirates' },
  SA: { lat: 23.89, lng: 45.08, name: 'Saudi Arabia' },
  QA: { lat: 25.35, lng: 51.18, name: 'Qatar' },
  KW: { lat: 29.31, lng: 47.48, name: 'Kuwait' },
  BH: { lat: 26.07, lng: 50.56, name: 'Bahrain' },
  OM: { lat: 21.51, lng: 55.92, name: 'Oman' },
  IL: { lat: 31.05, lng: 34.85, name: 'Israel' },
  JO: { lat: 30.59, lng: 36.24, name: 'Jordan' },
  LB: { lat: 33.85, lng: 35.86, name: 'Lebanon' },
  IN: { lat: 20.59, lng: 78.96, name: 'India' },
  PK: { lat: 30.38, lng: 69.35, name: 'Pakistan' },
  BD: { lat: 23.68, lng: 90.36, name: 'Bangladesh' },
  LK: { lat: 7.87, lng: 80.77, name: 'Sri Lanka' },
  CN: { lat: 35.86, lng: 104.20, name: 'China' },
  HK: { lat: 22.32, lng: 114.17, name: 'Hong Kong' },
  TW: { lat: 23.70, lng: 120.96, name: 'Taiwan' },
  JP: { lat: 36.20, lng: 138.25, name: 'Japan' },
  KR: { lat: 35.91, lng: 127.77, name: 'South Korea' },
  TH: { lat: 15.87, lng: 100.99, name: 'Thailand' },
  VN: { lat: 14.06, lng: 108.28, name: 'Vietnam' },
  PH: { lat: 12.88, lng: 121.77, name: 'Philippines' },
  ID: { lat: -0.79, lng: 113.92, name: 'Indonesia' },
  MY: { lat: 4.21, lng: 101.98, name: 'Malaysia' },
  SG: { lat: 1.35, lng: 103.82, name: 'Singapore' },
  AU: { lat: -25.27, lng: 133.78, name: 'Australia' },
  NZ: { lat: -40.90, lng: 174.89, name: 'New Zealand' },
}

// Jitter deterministico (in gradi) basato sull'hash della città, così più città
// dello stesso Paese non si sovrappongono in un unico punto sul globo.
function cityJitter(city) {
  if (!city) return { dLat: 0, dLng: 0 }
  let h = 0
  for (let i = 0; i < city.length; i++) h = (h * 31 + city.charCodeAt(i)) >>> 0
  const dLat = ((h % 1000) / 1000 - 0.5) * 6 // ±3°
  const dLng = (((h >> 10) % 1000) / 1000 - 0.5) * 6
  return { dLat, dLng }
}

export function locateByCountry(countryId, city) {
  const c = COUNTRY_CENTROIDS[(countryId || '').toUpperCase()]
  if (!c) return null
  const { dLat, dLng } = cityJitter(city)
  return { lat: c.lat + dLat, lng: c.lng + dLng, countryName: c.name }
}

export default COUNTRY_CENTROIDS
