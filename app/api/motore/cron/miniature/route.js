import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { getMetaCreds, fetchFullCreatives } from '../../../../../lib/motore/meta'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// ============================================================================
//  Rinnovo delle miniature delle inserzioni importate da Meta.
//
//  Gli URL delle immagini che Meta restituisce sono FIRMATI e scadono in pochi
//  giorni (parametro `oe`). L'ingest li scrive quando vede l'inserzione per la
//  prima volta e poi non li tocca piu' — giusto per la copy e i metadati, che
//  non cambiano, sbagliato per un URL che muore. Il 17 settembre 2026 la board
//  aveva tutte e 171 le miniature a 403, scadute dal 3 settembre: la tab
//  Performance senza una sola immagine, e nessun errore da nessuna parte.
//
//  Qui si rinnovano SOLO gli URL, ogni notte, dai `meta_creative_id` gia'
//  salvati: niente insights, niente copy, lotti da 20 con la pausa che il
//  limite di Meta pretende. Se il limite scatta si aggiorna quello che si e'
//  ottenuto e si dichiara il parziale — il resto lo prende la notte dopo.
// ============================================================================
async function tutte(build, pagina = 1000) {
  let out = [], da = 0
  for (;;) {
    const { data, error } = await build().range(da, da + pagina - 1)
    if (error) throw new Error(error.message)
    out = out.concat(data || []); if (!data || data.length < pagina) return out; da += pagina
  }
}

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  if (!ws) return NextResponse.json({ error: 'CE_WORKSPACE_ID mancante' }, { status: 500 })
  try {
    const creds = await getMetaCreds(ws)
    const righe = await tutte(() => db().from('ce_creatives')
      .select('id, meta_creative_id')
      .eq('workspace_id', ws).eq('origin', 'existing').not('meta_creative_id', 'is', null))
    const cids = [...new Set(righe.map(r => r.meta_creative_id))]
    const full = cids.length ? await fetchFullCreatives(cids, creds.accessToken) : {}

    let rinnovate = 0, senzaImmagine = 0, nonOttenute = 0
    const errori = []
    // Gli update in gruppi da 20: in fila 171 scritture erano il tempo di un
    // altro passo intero.
    for (let i = 0; i < righe.length; i += 20) {
      await Promise.all(righe.slice(i, i + 20).map(async r => {
        const c = full[r.meta_creative_id]
        if (!c) { nonOttenute++; return }
        // Stessa scelta dell'ingest: piena risoluzione come immagine, miniatura
        // come miniatura. Senza immagine NON si scrive: un campo vuoto al posto
        // di un URL scaduto non e' un miglioramento.
        if (!(c.image_url || c.thumbnail_url)) { senzaImmagine++; return }
        const { error } = await db().from('ce_creatives').update({
          storage_url: c.image_url || c.thumbnail_url,
          thumb_url: c.thumbnail_url || c.image_url,
        }).eq('id', r.id).eq('workspace_id', wsMotore())
        if (error) errori.push(String(error.message).slice(0, 120)); else rinnovate++
      }))
    }
    const parziale = !!full.__limite || errori.length > 0
    return NextResponse.json({
      ok: !parziale, righe: righe.length, rinnovate, senzaImmagine, nonOttenute,
      ...(full.__limite ? { limiteMeta: true } : {}), ...(errori.length ? { errori: errori.slice(0, 5) } : {}),
    }, { status: parziale ? 207 : 200 })
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e?.message || e) }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
