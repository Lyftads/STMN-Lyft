import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { documento, templateTutti, idMatriceDa } from '../../../../lib/motore/matrice'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// La matrice per la scheda dell'app: segmenti, cluster, avatar, le 360 righe e
// le regole. Il catalogo dei template pesa mezzo megabyte e si chiede a parte
// (?parte=template), solo quando si apre quella vista.
//
// Accanto ai dati fissi arriva cio' che il motore ha GIA' prodotto per ogni
// riga: una matrice che non dice cosa e' stato fatto e' un documento, non uno
// strumento di lavoro.
async function GET__(req) {
  const parte = new URL(req.url).searchParams.get('parte')
  if (parte === 'template') {
    return NextResponse.json({ template: templateTutti().filter(t => t.adatto !== 'B') })
  }
  const ws = wsMotore()
  const prodotte = {}
  let avviso = null
  try {
    const { data, error } = await db().from('ce_creatives')
      .select('id, name, ratio, storage_url, thumb_url, brief_motivo, flag_lanciata, created_at')
      .eq('workspace_id', ws).eq('origin', 'generated').ilike('brief_motivo', '%[matrice %')
      .order('created_at', { ascending: false }).limit(1000)
    if (error) throw new Error(error.message)
    for (const c of data || []) {
      const id = idMatriceDa(c); if (!id) continue
      ;(prodotte[id] || (prodotte[id] = [])).push({
        id: c.id, nome: c.name, ratio: c.ratio, url: c.thumb_url || c.storage_url || null,
        lanciata: !!c.flag_lanciata, il: c.created_at,
      })
    }
  } catch (e) {
    // La scheda si apre comunque: i dati della matrice non dipendono dal DB.
    avviso = `non riesco a leggere cosa e' gia' stato prodotto: ${String(e.message || e).slice(0, 120)}`
  }
  return NextResponse.json({ ...documento(), prodotte, ...(avviso ? { avviso } : {}) })
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
