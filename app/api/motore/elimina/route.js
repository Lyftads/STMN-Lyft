import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { registraScarti } from '../../../../lib/motore/scarti'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Cancellare una creatività. Si tolgono ANCHE i file dallo storage: lasciarli
// significa pagare storage per immagini che nessuno vedrà più, e ritrovarsele
// in un elenco di file orfani fra sei mesi senza sapere a cosa servissero.
//
// Le inserzioni ATTIVE su Meta non si cancellano da qui: portano lo storico di
// spesa dell'account, e toglierle falserebbe i totali e le soglie che vi sono
// ancorate. Se una va tolta va tolta su Meta, e l'ingest la seguirà.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const { ids, forzaAttive } = await req.json().catch(() => ({}))
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'nessun id' }, { status: 400 })
    }
    const { data: righe, error } = await db().from('ce_creatives')
      .select('id, name, origin, storage_url, meta_ad_id, product_id, angle_id, variante_seme, qualita, qualita_motivo, scena_desc')
      .eq('workspace_id', ws).in('id', ids)
    if (error) throw new Error(error.message)

    const attive = righe.filter(r => r.origin === 'existing')
    const cancellabili = forzaAttive ? righe : righe.filter(r => r.origin !== 'existing')
    if (!cancellabili.length) {
      return NextResponse.json({
        ok: false, cancellate: 0, protette: attive.length,
        error: `sono tutte inserzioni attive su Meta: portano lo storico di spesa e non si tolgono da qui`,
      }, { status: 409 })
    }

    // Prima i file, poi le righe: se si cancella prima la riga e lo storage
    // fallisce, il file resta e non si sa più a chi apparteneva.
    const percorsi = cancellabili.map(r => {
      const m = String(r.storage_url || '').match(/\/creativita\/(.+)$/)
      return m ? decodeURIComponent(m[1].split('?')[0]) : null
    }).filter(Boolean)
    let fileTolti = 0
    if (percorsi.length) {
      const { data: rimossi } = await db().storage.from('creativita').remove(percorsi)
      fileTolti = rimossi?.length || 0
    }

    // Si ricorda cosa si butta PRIMA di buttarlo. Senza, sparivano insieme alla
    // riga anche il seme della varianza ("questa combinazione l'hai gia' usata")
    // e il voto di qualita' ("quest'ingrediente non funziona"): restava un buco,
    // il generatore lo riempiva, e la creativita' tornava identica il giorno
    // dopo. Buttare qualcosa e' un'informazione, non l'assenza di una.
    const { registrati, tabellaMancante } = await registraScarti(db, ws, cancellabili)

    const { error: eDel } = await db().from('ce_creatives')
      .delete().eq('workspace_id', ws).in('id', cancellabili.map(r => r.id))
    if (eDel) throw new Error(eDel.message)

    return NextResponse.json({
      ok: true, cancellate: cancellabili.length, fileTolti, ricordate: registrati,
      ...(tabellaMancante ? { avviso: 'manca la tabella ce_scarti: senza, il motore puo\' rigenerare quello che hai buttato. Va eseguito scarti.sql' } : {}),
      protette: forzaAttive ? 0 : attive.length,
      nota: (!forzaAttive && attive.length)
        ? `${attive.length} inserzioni attive su Meta non sono state toccate: portano lo storico di spesa.`
        : undefined,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
