export const dynamic = 'force-dynamic'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { getServerSupabase, getAdminSupabase } from '../../../lib/supabase/server'
import { APP_DEDICATE, CHI_PUO } from '../../../lib/generale/app'

// ============================================================================
//  La porta della «Dashboard generale» (/generale): una pagina sola coi numeri
//  di TUTTI i clienti dell'agenzia. Il browser chiede qui i dati di un cliente
//  alla volta; questa route gira la domanda all'app giusta (quella dedicata del
//  cliente, se ne ha una, altrimenti questa stessa app sul suo workspace)
//  CON L'ACCESSO DI CHI STA GUARDANDO.
//
//  La pagina e' SOLO del titolare dell'agenzia (CHI_PUO): chiunque altro, anche
//  con un account valido, riceve 403 e non vede nemmeno l'elenco dei clienti.
//
//  Nessun permesso in piu': chi risponde riconosce la stessa persona e rifa'
//  i suoi controlli (agency_clients). In piu' qui si controlla subito che il
//  workspace chiesto sia un cliente di chi guarda.
//
//  Si passa solo il gettone d'accesso, MAI quello di rinnovo: se chi risponde
//  lo rinnovasse, quello nel browser smetterebbe di valere e la persona si
//  ritroverebbe fuori dall'app.
//
//  Sola lettura, e solo le letture elencate sotto.
// ============================================================================

const LETTURE = new Set(['metrics', 'google', 'oggi-vs-ieri', 'ordini-live', 'realtime'])
// Queste si leggono SEMPRE da questa app, anche per chi ha un'app dedicata: sono gli ordini e i
// visitatori in diretta dello schermo generale, uguali per tutti i negozi e scritti una volta sola.
const SEMPRE_QUI = new Set(['ordini-live', 'realtime'])
const PEZZO = 3180   // un cookie non regge di piu': @supabase/ssr lo spezza cosi'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(req) {
  const url = new URL(req.url)
  const sb = getServerSupabase()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  if (!CHI_PUO.includes(user.id)) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })
  const admin = getAdminSupabase()
  if (!admin) return NextResponse.json({ error: 'Non disponibile' }, { status: 503 })

  // L'elenco dei negozi: i clienti dell'agenzia che hanno Shopify collegato.
  // Un cliente nuovo compare da solo appena collega il negozio.
  if (url.searchParams.get('elenco')) {
    const { data: clienti } = await admin.from('agency_clients').select('client_user_id, label').eq('agency_user_id', user.id)
    const ids = (clienti || []).map(c => c.client_user_id)
    const { data: aziende } = ids.length ? await admin.from('companies').select('user_id, company_name, shopify_store_url, nango_connections').in('user_id', ids) : { data: [] }
    const negozi = (clienti || []).map(c => {
      const a = (aziende || []).find(x => x.user_id === c.client_user_id)
      const collegato = !!(a?.shopify_store_url || a?.nango_connections?.shopify)
      return { id: c.client_user_id, nome: c.label || a?.company_name || 'Cliente', collegato }
    }).sort((x, y) => x.nome.localeCompare(y.nome, 'it'))
    return NextResponse.json({ negozi: negozi.filter(n => n.collegato), daCollegare: negozi.filter(n => !n.collegato).map(n => n.nome) }, { headers: { 'cache-control': 'no-store' } })
  }

  const ws = url.searchParams.get('ws') || ''
  const lettura = url.searchParams.get('lettura') || ''
  if (!UUID.test(ws) || !LETTURE.has(lettura)) return NextResponse.json({ error: 'Richiesta non valida' }, { status: 400 })

  // il workspace deve essere un cliente di chi guarda
  const { data: legame } = await admin.from('agency_clients').select('client_user_id')
    .eq('agency_user_id', user.id).eq('client_user_id', ws).maybeSingle()
  if (!legame) return NextResponse.json({ error: 'Non autorizzato' }, { status: 403 })

  const { data: { session } } = await sb.auth.getSession()
  const nome = cookies().getAll().map(c => c.name).find(n => /^sb-.+-auth-token(\.\d+)?$/.test(n))?.replace(/\.\d+$/, '')
  if (!session?.access_token || !nome) return NextResponse.json({ error: 'Non autenticato' }, { status: 401 })
  const valore = 'base64-' + Buffer.from(JSON.stringify({
    access_token: session.access_token, refresh_token: '', token_type: 'bearer',
    expires_at: session.expires_at, expires_in: session.expires_in, user: { id: user.id, email: user.email },
  })).toString('base64')
  const pezzi = []
  if (valore.length <= PEZZO) pezzi.push(`${nome}=${valore}`)
  else for (let i = 0, k = 0; i < valore.length; i += PEZZO, k++) pezzi.push(`${nome}.${k}=${valore.slice(i, i + PEZZO)}`)

  // App dedicata: il workspace e' fisso li'. Questa app: il workspace si sceglie col cookie,
  // lo stesso che mette il cambio di azienda (e chi risponde ricontrolla che sia permesso).
  const dedicata = SEMPRE_QUI.has(lettura) ? null : (APP_DEDICATE[ws] || null)
  // GENERALE_APP_BASE serve solo in locale, dove questa app non risolve i negozi dei clienti:
  // la si punta alla produzione per collaudare. In produzione non va impostata.
  const base = SEMPRE_QUI.has(lettura) ? url.origin : (dedicata || process.env.GENERALE_APP_BASE || url.origin)
  if (!dedicata) pezzi.push(`active_workspace=${ws}`)

  const domanda = new URLSearchParams(url.searchParams)
  domanda.delete('ws'); domanda.delete('lettura')
  const q = domanda.toString()
  try {
    const r = await fetch(`${base}/api/${lettura}${q ? '?' + q : ''}`, {
      headers: { cookie: pezzi.join('; ') }, cache: 'no-store', signal: AbortSignal.timeout(55_000),
    })
    const testo = await r.text()
    let dati
    try { dati = JSON.parse(testo) } catch { return NextResponse.json({ error: 'Risposta non leggibile' }, { status: 502 }) }
    return NextResponse.json(dati, { status: r.status, headers: { 'cache-control': 'no-store' } })
  } catch {
    return NextResponse.json({ error: 'Il negozio non risponde' }, { status: 504 })
  }
}
