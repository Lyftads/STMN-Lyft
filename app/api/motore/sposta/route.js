import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { siglaProdotto } from '../../../../lib/motore/brief'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// La sigla del prodotto e' UNA parola: la stessa di lib/brief, perche' due
// versioni diverse rimettevano i trattini a ogni spostamento.
const sigla = (b) => siglaProdotto({ nome_breve: b })

// Spostare una creatività a mano: di angolo, di prodotto, o entrambi.
//
// Serve perché il classificatore sbaglia e la cartella d'origine non copre
// tutto. Ma spostare NON è solo cambiare una colonna: se cambia il prodotto
// devono seguire il NOME e il LINK, altrimenti restano a puntare al prodotto
// vecchio e il prossimo ripristino dal nome riporta tutto indietro — è già
// successo con le creatività di giugno.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const { ids, angolo, prodottoId } = await req.json().catch(() => ({}))
    if (!Array.isArray(ids) || !ids.length) {
      return NextResponse.json({ error: 'nessun id' }, { status: 400 })
    }
    if (angolo === undefined && !prodottoId) {
      return NextResponse.json({ error: 'niente da spostare: serve un angolo o un prodotto' }, { status: 400 })
    }

    // --- angolo -------------------------------------------------------------
    let angleId
    if (angolo !== undefined) {
      if (angolo === null) angleId = null
      else {
        const { data: a } = await db().from('ce_angles')
          .select('id').eq('workspace_id', ws).eq('slug', angolo).maybeSingle()
        if (a?.id) angleId = a.id
        else {
          // Un angolo nuovo si crea: la tassonomia la fa chi lavora, non un
          // elenco fisso deciso a tavolino.
          const { data: ins, error } = await db().from('ce_angles')
            .upsert({ workspace_id: ws, name: angolo, slug: angolo, source: 'manuale' },
                    { onConflict: 'workspace_id,slug' }).select('id').maybeSingle()
          if (error) throw new Error(error.message)
          angleId = ins?.id
        }
      }
    }

    // --- prodotto -----------------------------------------------------------
    let prodotto = null
    if (prodottoId) {
      const { data: p } = await db().from('ce_products')
        .select('id, name, nome_breve, handle').eq('workspace_id', ws).eq('id', prodottoId).maybeSingle()
      if (!p) return NextResponse.json({ error: 'prodotto non trovato' }, { status: 404 })
      prodotto = p
    }

    const { data: righe, error: eSel } = await db().from('ce_creatives')
      .select('id, name, origin').eq('workspace_id', ws).in('id', ids)
    if (eSel) throw new Error(eSel.message)

    let spostate = 0
    const rinominate = []
    for (const r of righe) {
      const patch = {}
      if (angolo !== undefined) {
        patch.angle_id = angleId ?? null
        // Spostato a mano: il classificatore non deve ripensarci sopra.
        patch.classify_base = 'manuale'
      }
      if (prodotto) {
        patch.product_id = prodotto.id
        patch.link_handle = prodotto.handle || null
        patch.link_url = prodotto.handle && clienteMotore()?.sito ? `${clienteMotore().sito}/products/${prodotto.handle}` : null
        patch.link_tipo = prodotto.handle ? 'prodotto' : null
        // Il nome porta la sigla del prodotto: se non segue, nome e prodotto
        // dicono cose diverse. Solo sulle nostre — quelle di Meta hanno il
        // nome dell'inserzione, che non si tocca.
        const breve = prodotto.nome_breve || prodotto.name
        if (r.origin !== 'existing' && breve) {
          const parti = r.name.split('_')
          if (parti.length >= 3) {
            parti[1] = sigla(breve)
            patch.name = parti.join('_')
            rinominate.push(patch.name)
          }
        }
      }
      const { error } = await db().from('ce_creatives').update(patch).eq('id', r.id).eq('workspace_id', wsMotore())
      if (!error) spostate++
    }

    return NextResponse.json({ ok: true, spostate, rinominate: rinominate.length })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
