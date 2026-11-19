// ============================================================================
//  I periodi, risolti in UN SOLO POSTO.
//
//  Su LyftAI questa cosa e' gia' costata un bug: ogni rotta aveva il suo
//  risolutore e i preset non gestiti cadevano nel default, cosi' "questo mese"
//  mostrava novanta giorni. Un periodo sbagliato non si vede — i numeri ci
//  sono, sono solo di un altro intervallo — ed e' il tipo di errore su cui si
//  prendono decisioni di budget senza accorgersi di niente.
//
//  Quindi: un elenco, un risolutore, e chi non riconosce un preset lo DICE
//  invece di ripiegare in silenzio.
// ============================================================================

export const PRESET = [
  { id: 'oggi',              nome: 'Oggi' },
  { id: 'ieri',              nome: 'Ieri' },
  { id: 'oggi-ieri',         nome: 'Oggi e ieri' },
  { id: 'ultimi-7',          nome: 'Ultimi 7 giorni' },
  { id: 'ultimi-14',         nome: 'Ultimi 14 giorni' },
  { id: 'ultimi-28',         nome: 'Ultimi 28 giorni' },
  { id: 'ultimi-30',         nome: 'Ultimi 30 giorni' },
  { id: 'ultimi-90',         nome: 'Ultimi 90 giorni' },
  { id: 'questa-settimana',  nome: 'Questa settimana' },
  { id: 'settimana-scorsa',  nome: 'Settimana scorsa' },
  { id: 'questo-mese',       nome: 'Questo mese' },
  { id: 'mese-scorso',       nome: 'Mese scorso' },
  { id: 'anno',              nome: "Quest'anno" },
  { id: 'sempre',            nome: 'Sempre' },
]

export const PRESET_DEFAULT = 'ultimi-30'

const giorno = (d) => d.toISOString().slice(0, 10)
const meno = (d, n) => new Date(d.getTime() - n * 86400000)

// Lunedi' come primo giorno: e' la settimana con cui si ragiona sui lanci.
function lunedi(d) {
  const g = new Date(d)
  const w = (g.getUTCDay() + 6) % 7
  return meno(g, w)
}

// Un intervallo scelto a mano sul calendario. Resta un preset come gli altri,
// cosi' tutto il resto della catena non deve sapere che esiste un caso speciale.
export function personalizzato(since, until) {
  const a = String(since || '').slice(0, 10), b = String(until || '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(a) || !/^\d{4}-\d{2}-\d{2}$/.test(b)) return null
  return a <= b
    ? { preset: 'personalizzato', since: a, until: b }
    : { preset: 'personalizzato', since: b, until: a }
}

// Il periodo immediatamente PRECEDENTE, della stessa lunghezza. Serve al
// confronto: "meglio o peggio di prima" ha senso solo contro un intervallo
// lungo uguale, altrimenti si confronta una settimana con un mese.
export function precedente(r) {
  const g = giorniDi(r)
  const fine = new Date(new Date(r.since).getTime() - 86400000)
  const inizio = new Date(fine.getTime() - (g - 1) * 86400000)
  return { preset: 'precedente', since: giorno(inizio), until: giorno(fine), giorni: g }
}

export function risolvi(preset = PRESET_DEFAULT, adesso = new Date()) {
  const oggi = new Date(Date.UTC(adesso.getUTCFullYear(), adesso.getUTCMonth(), adesso.getUTCDate()))
  const ieri = meno(oggi, 1)
  const fascia = (since, until) => ({ preset, since: giorno(since), until: giorno(until) })

  switch (preset) {
    case 'oggi':             return fascia(oggi, oggi)
    case 'ieri':             return fascia(ieri, ieri)
    case 'oggi-ieri':        return fascia(ieri, oggi)
    // "ultimi N" include oggi: N giorni in tutto, oggi compreso. E' la
    // convenzione che si legge meglio a voce ("gli ultimi sette giorni").
    case 'ultimi-7':         return fascia(meno(oggi, 6), oggi)
    case 'ultimi-14':        return fascia(meno(oggi, 13), oggi)
    case 'ultimi-28':        return fascia(meno(oggi, 27), oggi)
    case 'ultimi-30':        return fascia(meno(oggi, 29), oggi)
    case 'ultimi-90':        return fascia(meno(oggi, 89), oggi)
    case 'questa-settimana': return fascia(lunedi(oggi), oggi)
    case 'settimana-scorsa': {
      const l = meno(lunedi(oggi), 7)
      return fascia(l, meno(lunedi(oggi), 1))
    }
    case 'questo-mese':      return fascia(new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), 1)), oggi)
    case 'mese-scorso': {
      const primo = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth() - 1, 1))
      const ultimo = new Date(Date.UTC(oggi.getUTCFullYear(), oggi.getUTCMonth(), 0))
      return fascia(primo, ultimo)
    }
    case 'anno':             return fascia(new Date(Date.UTC(oggi.getUTCFullYear(), 0, 1)), oggi)
    case 'sempre':           return { preset, since: '2000-01-01', until: giorno(oggi) }
    default:
      // Non si ripiega in silenzio: un preset sconosciuto e' un errore di chi
      // chiama, e mostrargli i dati di un altro intervallo e' il modo migliore
      // di fargli prendere una decisione sbagliata senza accorgersene.
      return { ...risolvi(PRESET_DEFAULT, adesso), sconosciuto: preset }
  }
}

// Quanti giorni copre, per le medie giornaliere.
export function giorniDi(r) {
  return Math.max(1, Math.round((new Date(r.until) - new Date(r.since)) / 86400000) + 1)
}

// Il periodo ricavato dai parametri di una richiesta. Sta qui e non nelle
// rotte: erano proprio i risolutori sparsi a far cadere i preset nel default.
export function dallaRichiesta(url) {
  const q = url.searchParams
  const p = q.get('preset') || undefined
  if (p === 'personalizzato') {
    const c = personalizzato(q.get('since'), q.get('until'))
    if (c) return { ...c, confronta: q.get('confronta') === '1' }
  }
  return { ...risolvi(p), confronta: q.get('confronta') === '1' }
}
