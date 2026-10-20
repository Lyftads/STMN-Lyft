// Il Cervello dentro LyftTalk: come si chiama nelle 5 lingue e come lo si riconosce.
// Condiviso fra la chat (chi lo chiama) e /api/team/channel-reply (chi risponde).
export const NOMI_CERVELLO = { it: 'Cervello', en: 'Brain', es: 'Cerebro', fr: 'Cerveau', de: 'Gehirn' }
export const AVATAR_CERVELLO = '/icon-192.png'

export const nomeCervello = (lingua) => NOMI_CERVELLO[String(lingua || '').slice(0, 2)] || NOMI_CERVELLO.it

// Il nome dell'autore di un messaggio e' uno dei nomi del Cervello?
export const eCervello = (nome) => Object.values(NOMI_CERVELLO).includes(String(nome || '').trim())

// "@Cervello", "@Brain"… in qualsiasi lingua, anche col nome di un'altra lingua.
export const chiamaIlCervello = (testo) => new RegExp(`@\\s*(${Object.values(NOMI_CERVELLO).join('|')})\\b`, 'i').test(String(testo || ''))
