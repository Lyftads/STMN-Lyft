// ============================================================================
//  I giorni, in UN posto solo.
//
//  Ogni route si era scritta le sue tre funzioncine (oggi, piu'/meno N giorni,
//  fine del mese scorso), e quasi tutte con lo stesso doppio difetto:
//   · "oggi" = il giorno UTC: fra mezzanotte e le due di notte italiane e' ancora
//     IERI, e "Oggi" mostrava i dati di ieri (il negozio e' in Europe/Rome);
//   · i giorni si sommavano partendo dalla mezzanotte LOCALE e poi si leggeva la
//     data in UTC (toISOString): con un fuso a est di Greenwich il risultato slitta
//     di un giorno. Su Vercel (UTC) non si vedeva; su un computer italiano "ultimi 7
//     giorni" ne copriva 9 — lo stesso preset, due periodi diversi.
//  Qui l'aritmetica e' tutta in UTC su date "nude" (YYYY-MM-DD) e oggi e' il giorno
//  del negozio. Chi ha ancora la sua copia delega a queste.
// ============================================================================
// Il fuso del NEGOZIO, non quello del server ne' quello di chi guarda. Sul fork era una costante:
// il negozio era uno solo. Qui i clienti sono tanti e possono stare altrove, quindi si puo' passare
// da fuori — `oggiNegozio('America/New_York')`. Chi non lo passa resta su Roma, che e' il fuso della
// quasi totalita' dei clienti: un valore di ripiego dichiarato, non una verita'.
// ATTENZIONE: sbagliare fuso non da' nessun errore, sposta solo i giorni — e di notte "Oggi" mostra
// ieri. Quando una route ha il fuso del negozio sottomano, deve passarlo.
export const FUSO_PREDEFINITO = 'Europe/Rome'
const FUSO_NEGOZIO = FUSO_PREDEFINITO

export const oggiNegozio = (fuso = FUSO_NEGOZIO) => new Intl.DateTimeFormat('en-CA', { timeZone: fuso || FUSO_NEGOZIO }).format(new Date())

export function piuGiorni(iso, n) {
  const d = new Date(`${String(iso).slice(0, 10)}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + n)
  return d.toISOString().slice(0, 10)
}
export const giorniFra = (da, a) => Math.round((Date.parse(`${a}T00:00:00Z`) - Date.parse(`${da}T00:00:00Z`)) / 86_400_000)
export const inizioMese = (iso) => `${String(iso).slice(0, 7)}-01`
export const fineMeseScorso = (iso) => piuGiorni(inizioMese(iso), -1)
export const lunediDi = (iso) => { const g = (new Date(`${iso}T00:00:00Z`).getUTCDay() + 6) % 7; return piuGiorni(iso, -g) }

// Il periodo precedente di pari lunghezza: 1–7 maggio → 24–30 aprile.
export function periodoPrima(range) {
  if (!range?.since || !range?.until) return null
  const giorni = giorniFra(range.since, range.until) + 1
  const until = piuGiorni(range.since, -1)
  return { since: piuGiorni(until, -(giorni - 1)), until }
}

// L'istante in cui comincia il giorno `iso` nel fuso del negozio (mezzanotte a Roma = 22:00 o 23:00
// UTC del giorno prima). Serve alle API che vogliono un orario, non una data: "da mezzanotte" fatto
// con setHours(0) sul server (UTC) partiva alle 2 di notte italiane.
export function mezzanotteNegozio(iso = oggiNegozio(), fuso = FUSO_NEGOZIO) {
  const t = Date.parse(`${iso}T00:00:00Z`)
  const v = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: fuso, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
    .formatToParts(new Date(t)).map(x => [x.type, x.value]))
  const comeLocale = Date.parse(`${v.year}-${v.month}-${v.day}T${v.hour}:${v.minute}:00Z`)
  return new Date(t - (comeLocale - t))
}
