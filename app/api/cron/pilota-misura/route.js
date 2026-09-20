export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 300

import { NextResponse } from 'next/server'
import { getAdminSupabase } from '../../../../lib/supabase/server'
import { leggiRegistro, scriviRegistro, GIORNI_MISURA } from '../../../../lib/pilota/registro'
import { misuraGoogle } from '../../../../lib/pilota/proposte'

// ============================================================================
//  LA MISURA — ogni notte: le mosse eseguite da almeno GIORNI_MISURA giorni si giudicano sugli
//  stessi dati che le avevano fatte nascere, nella finestra DOPO l'esecuzione. Da qui nasce la
//  riga "prevedevo +150 €/mese, e' stato +145": il software che si da' il voto da solo.
//  ?prova=1 → calcola e risponde senza scrivere.
//
//  ── Da un negozio solo a tutti i clienti ────────────────────────────────────────────────────
//  Sul fork questo giro girava su un workspace fisso. Qui deve girare su TUTTI i clienti, con
//  lo stesso modello del cron del mattino (app/api/cron/prewarm): l'elenco dei workspace esce da
//  `companies`, e a ogni chiamata interna si passano INSIEME il segreto e `x-lyft-workspace` —
//  senza il secondo la route chiamata risolverebbe un altro tenant.
//
//  IL TEMPO. Un giro per cliente su decine di clienti non sta dentro i 300 secondi se ognuno
//  costasse una lettura dei verdetti. Per fortuna quasi tutti, quasi ogni notte, non hanno
//  NESSUNA mossa matura: per loro il giro e' una sola lettura di tab_snapshots (pochi ms), e si
//  passa oltre. Il costo vero sono le mosse da misurare, e per quelle valgono due regole:
//   · non si parte mai con una chiamata che non ci sta nel tempo rimasto (l'attesa massima si
//     accorcia da sola); sotto la soglia si smette e si scrive "rimandata";
//   · l'elenco dei clienti si SCORRE A SCAGLIONI: il punto di partenza ruota col giorno, cosi'
//     chi resta fuori stanotte e' il primo a essere servito domani. Nessuna mossa si perde —
//     matura resta matura finche' non viene misurata.
// ============================================================================
function isAuthorized(req) {
  const secret = process.env.CRON_SECRET
  if (!secret) return false
  return (req.headers.get('authorization') || '') === `Bearer ${secret}` || req.headers.get('x-internal-cron') === secret
}
const giorno = (ms) => new Date(ms).toISOString().slice(0, 10)

const BUDGET_MS = 270_000        // si lascia margine ai 300 della funzione
const MINIMO_PER_PARTIRE = 20_000 // sotto questo non si apre una chiamata nuova
const ATTESA_MAX = 120_000        // una lettura dei verdetti a freddo puo' durare parecchio
const MAX_CLIENTI = 500

// I workspace in ordine stabile (serve perche' la rotazione abbia senso), ruotati col giorno.
async function workspaceDelGiro() {
  const admin = getAdminSupabase()
  if (!admin) return []
  let tutti = []
  try {
    const { data } = await admin.from('companies').select('user_id').not('shopify_store_url', 'is', null).limit(MAX_CLIENTI)
    tutti = (data || []).map(c => c.user_id).filter(Boolean).sort()
  } catch { return [] }
  if (tutti.length < 2) return tutti
  const giorniDall1970 = Math.floor(Date.now() / 86_400_000)
  const da = giorniDall1970 % tutti.length
  return [...tutti.slice(da), ...tutti.slice(0, da)]
}

export async function GET(req) {
  if (!isAuthorized(req)) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
  const prova = new URL(req.url).searchParams.get('prova') === '1'
  const origin = process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin
  const inizio = Date.now()
  const rimasto = () => BUDGET_MS - (Date.now() - inizio)

  const workspaces = await workspaceDelGiro()
  const esiti = []
  let mature = 0, misurate = 0, clientiVisti = 0, clientiSaltati = 0

  for (const ws of workspaces) {
    if (rimasto() < MINIMO_PER_PARTIRE) { clientiSaltati++; continue }
    clientiVisti++
    let reg
    try { reg = await leggiRegistro(ws) } catch { esiti.push({ ws, rimandata: 'registro illeggibile' }); continue }
    const daMisurare = reg.mosse.filter(m => m.stato === 'eseguita' && m.misuraDal && Date.parse(m.misuraDal) <= Date.now())
    if (!daMisurare.length) continue
    mature += daMisurare.length
    let cambiato = false
    for (const m of daMisurare) {
      if (m.canale !== 'google') { esiti.push({ ws, id: m.id, saltata: 'canale senza misura' }); continue }
      // Non si apre una chiamata che non ci sta: meglio rimandarla a domani che farsi uccidere
      // a meta' scrittura.
      const attesa = Math.min(ATTESA_MAX, rimasto() - 5_000)
      if (attesa < MINIMO_PER_PARTIRE) { esiti.push({ ws, id: m.id, rimandata: 'tempo finito' }); continue }
      const da = giorno(Date.parse(m.eseguitaIl) + 86_400_000), a = giorno(Date.parse(m.eseguitaIl) + GIORNI_MISURA * 86_400_000)
      try {
        const res = await fetch(`${origin}/api/google-product-verdicts?since=${da}&until=${a}`, { headers: { 'x-internal-cron': process.env.CRON_SECRET || '', 'x-lyft-workspace': ws }, cache: 'no-store', signal: AbortSignal.timeout(attesa) })
        const dopo = await res.json().catch(() => null)
        // un dato parziale o mancante NON e' una misura: si riprova domani
        if (!res.ok || !dopo || dopo.ok === false || dopo.datiParziali || !Array.isArray(dopo.righe)) { esiti.push({ ws, id: m.id, rimandata: dopo?.error || `HTTP ${res.status}` }); continue }
        m.misura = misuraGoogle(m, dopo); m.stato = 'misurata'
        cambiato = true; misurate++
        esiti.push({ ws, id: m.id, misura: m.misura })
      } catch (e) { esiti.push({ ws, id: m.id, rimandata: String(e?.message || e).slice(0, 100) }) }
    }
    // Si scrive UN cliente alla volta, appena finito: se il tempo scade dopo, quello che e' stato
    // misurato resta misurato invece di andare perso tutto insieme.
    if (cambiato && !prova) { try { await scriviRegistro(ws, reg) } catch (e) { esiti.push({ ws, errore: `registro non salvato: ${String(e?.message || e).slice(0, 80)}` }) } }
  }

  return NextResponse.json({ ok: true, prova, clienti: workspaces.length, clientiVisti, clientiSaltati, mature, misurate, durataMs: Date.now() - inizio, esiti })
}
