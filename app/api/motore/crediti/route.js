import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// Il saldo crediti del generatore di immagini.
//
// Non lo si può leggere dall'app: la chiave Higgsfield non è configurata qui e
// la generazione passa dal canale MCP. Quindi il saldo viene SCRITTO da chi
// genera e letto dal banner. La conseguenza è che il valore ha un'età: il
// banner la mostra, perché un saldo vecchio di due giorni presentato come
// attuale è esattamente il modo in cui una pipeline si blocca a metà.
async function GET__() {
  try {
    const ws = wsMotore()
    if (!ws) return NextResponse.json({ error: 'CE_WORKSPACE_ID non configurato' }, { status: 500 })

    const { data, error } = await db().from('ce_crediti')
      .select('*').eq('workspace_id', ws).eq('provider', 'higgsfield').maybeSingle()
    if (error) throw new Error(error.message)
    if (!data) return NextResponse.json({ noto: false })

    const costo = Number(data.costo_scena) || 3
    const saldo = Number(data.saldo) || 0
    // Ogni scena diventa DUE creatività (1:1 e 9:16) ma costa una sola
    // generazione: la composizione dei due formati avviene in locale.
    const scene = Math.floor(saldo / costo)
    return NextResponse.json({
      noto: true, saldo, costoScena: costo, scene, creativita: scene * 2,
      // "stimato" appena il motore ha speso qualcosa dopo l'ultima impostazione
      // manuale: il numero è una sottrazione, non una lettura.
      // Quale motore genera davvero. Da gpt-image-2 in poi i crediti Higgsfield
      // non si consumano piu': lasciare il banner a parlare di crediti sarebbe
      // dire una cosa che non e' piu' vera, e il banner esiste per evitarlo.
      motore: process.env.MOTORE_IMMAGINI || 'openai',
      stimato: Number(data.spesi_dal_motore || 0) > 0,
      spesiDalMotore: Number(data.spesi_dal_motore || 0),
      impostatoIl: data.impostato_il,
      aggiornatoIl: data.aggiornato_il,
      oreFa: (Date.now() - new Date(data.aggiornato_il).getTime()) / 3600000,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

async function POST__(req) {
  try {
    const ws = wsMotore()
    const b = await req.json()
    if (b.saldo == null || Number.isNaN(Number(b.saldo))) {
      return NextResponse.json({ error: 'saldo mancante' }, { status: 400 })
    }
    const riga = {
      workspace_id: ws, provider: 'higgsfield',
      saldo: Number(b.saldo),
      costo_scena: b.costoScena != null ? Number(b.costoScena) : 3,
      // Impostare il saldo a mano vuol dire "ho appena ricaricato": il
      // contatore della spesa riparte da lì, o il banner resterebbe indietro
      // di tutta la spesa precedente.
      spesi_dal_motore: 0,
      impostato_il: new Date().toISOString(),
      aggiornato_il: new Date().toISOString(),
    }
    const { error } = await db().from('ce_crediti').upsert(riga, { onConflict: 'workspace_id,provider' })
    if (error) throw new Error(error.message)
    return NextResponse.json({ ok: true, ...riga })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
export const POST = conMotore(POST__)
