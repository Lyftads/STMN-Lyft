// Dal periodo scelto (la stringa del selettore BmTimeframe) alle due date.
// STESSE REGOLE di getPresetRange in /api/metrics («ultimi N giorni» = da oggi-N a oggi, come
// nel report di Shopify): la Dashboard generale somma il suo fatturato alla spesa che arriva da
// /api/metrics, e i due periodi devono essere lo stesso. Se la' cambia una regola, cambia qui.
import { oggiNegozio, piuGiorni, inizioMese, fineMeseScorso, lunediDi } from '../periodi'

const DATA = /^\d{4}-\d{2}-\d{2}$/

export function periodoDa(preset, oggi = oggiNegozio()) {
  const p = String(preset || 'today')
  if (p.startsWith('custom_')) {
    const [, since, until] = p.split('_')
    if (DATA.test(since) && DATA.test(until) && since <= until) return { since, until: until > oggi ? oggi : until }
    return { since: oggi, until: oggi }
  }
  const ultimi = /^last_(\d+)d$/.exec(p)
  if (ultimi) return { since: piuGiorni(oggi, -Number(ultimi[1])), until: oggi }
  switch (p) {
    case 'yesterday': { const i = piuGiorni(oggi, -1); return { since: i, until: i } }
    case 'today_yesterday': return { since: piuGiorni(oggi, -1), until: oggi }
    case 'this_week': return { since: lunediDi(oggi), until: oggi }
    case 'last_week': { const fine = piuGiorni(lunediDi(oggi), -1); return { since: piuGiorni(fine, -6), until: fine } }
    case 'this_month': case 'current_month': case 'mtd': return { since: inizioMese(oggi), until: oggi }
    case 'last_month': { const fine = fineMeseScorso(oggi); return { since: inizioMese(fine), until: fine } }
    case 'ytd': return { since: `${oggi.slice(0, 4)}-01-01`, until: oggi }
    default: return { since: oggi, until: oggi }
  }
}
