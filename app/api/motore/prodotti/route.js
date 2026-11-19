import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Togliere un prodotto dalla board.
//
// NASCONDERE, non cancellare: tutti i prodotti arrivano dall'ingest delle
// vendite Shopify, e uno cancellato torna al primo giro del cron — entro
// ventiquattr'ore. Un pulsante che sembra funzionare e non funziona è peggio
// di nessun pulsante.
//
// La cancellazione vera resta, ma solo dove ha senso: sui prodotti creati a
// mano, che nessun ingest ricrea. Sugli altri si rifiuta e si spiega perché.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const { id, azione, creativita, destinazioneId } = await req.json().catch(() => ({}))
    if (!id || !azione) return NextResponse.json({ error: 'servono id e azione' }, { status: 400 })

    const { data: p, error } = await db().from('ce_products')
      .select('id, name, nome_breve, revenue_30d, shopify_id').eq('workspace_id', ws).eq('id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!p) return NextResponse.json({ error: 'prodotto non trovato' }, { status: 404 })
    const nome = p.nome_breve || p.name

    if (azione === 'nascondi' || azione === 'mostra') {
      const { error: e2 } = await db().from('ce_products')
        .update({ nascosto: azione === 'nascondi' }).eq('id', id).eq('workspace_id', wsMotore())
      if (e2) throw new Error(e2.message)
      return NextResponse.json({ ok: true, azione, nome,
        nota: azione === 'nascondi'
          ? 'Fuori dalla board e dall\'allocazione della produzione. I numeri continuano ad aggiornarsi.'
          : undefined })
    }

    if (azione !== 'elimina') return NextResponse.json({ error: `azione sconosciuta: ${azione}` }, { status: 400 })

    // --- cancellazione vera -------------------------------------------------
    const daShopify = !!p.shopify_id || (p.revenue_30d || 0) > 0
    if (daShopify) {
      return NextResponse.json({
        ok: false, nome,
        error: `"${nome}" arriva dalle vendite Shopify: cancellandolo tornerebbe al prossimo giro dell'ingest. Nascondilo invece.`,
        suggerimento: 'nascondi',
      }, { status: 409 })
    }

    const { data: cre } = await db().from('ce_creatives')
      .select('id, origin, storage_url').eq('workspace_id', ws).eq('product_id', id)
    if (cre?.length && !creativita) {
      return NextResponse.json({
        ok: false, nome, creativita: cre.length,
        error: `"${nome}" ha ${cre.length} creatività: dimmi cosa farne (sposta, elimina o stacca).`,
      }, { status: 409 })
    }

    let mosse = 0, tolte = 0
    if (cre?.length) {
      if (creativita === 'sposta') {
        if (!destinazioneId) return NextResponse.json({ error: 'serve il prodotto di destinazione' }, { status: 400 })
        const { data: d } = await db().from('ce_products')
          .select('id, handle').eq('workspace_id', ws).eq('id', destinazioneId).maybeSingle()
        if (!d) return NextResponse.json({ error: 'prodotto di destinazione non trovato' }, { status: 404 })
        const { data: m } = await db().from('ce_creatives').update({
          product_id: d.id, link_handle: d.handle || null,
          link_url: d.handle && clienteMotore()?.sito ? `${clienteMotore().sito}/products/${d.handle}` : null,
        }).eq('workspace_id', ws).eq('product_id', id).select('id')
        mosse = m?.length || 0
      } else if (creativita === 'elimina') {
        // Prima i file, poi le righe: al contrario resterebbero orfani senza
        // che nessuno sappia più a cosa appartenevano.
        const percorsi = cre.map(c => {
          const m = String(c.storage_url || '').match(/\/creativita\/(.+)$/)
          return m ? decodeURIComponent(m[1].split('?')[0]) : null
        }).filter(Boolean)
        if (percorsi.length) await db().storage.from('creativita').remove(percorsi)
        const { data: t } = await db().from('ce_creatives')
          .delete().eq('workspace_id', ws).eq('product_id', id).select('id')
        tolte = t?.length || 0
      } else {
        // 'stacca': restano nella board senza prodotto, da riassegnare.
        const { data: s } = await db().from('ce_creatives')
          .update({ product_id: null }).eq('workspace_id', ws).eq('product_id', id).select('id')
        mosse = s?.length || 0
      }
    }

    const { error: eDel } = await db().from('ce_products').delete().eq('workspace_id', ws).eq('id', id)
    if (eDel) throw new Error(eDel.message)
    return NextResponse.json({ ok: true, azione: 'elimina', nome, creativitaSpostate: mosse, creativitaEliminate: tolte })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
