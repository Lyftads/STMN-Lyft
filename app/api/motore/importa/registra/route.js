import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { conMotore, wsMotore, clienteMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// Registra le righe dei file già caricati dal browser sullo storage.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const { caricati, prodotto, angleId, angolo, funnel, testi } = await req.json().catch(() => ({}))
    const t = testi || {}
    const pulisci = (v) => (typeof v === 'string' && v.trim() ? v.trim() : null)
    if (!Array.isArray(caricati) || !caricati.length) return NextResponse.json({ error: 'niente da registrare' }, { status: 400 })

    const fatte = [], errori = []
    for (const c of caricati) {
      try {
        const { data: pub } = db().storage.from('creativita').getPublicUrl(c.percorso)
        const { error } = await db().from('ce_creatives').insert({
          workspace_id: ws, product_id: prodotto?.id || null, angle_id: angleId || null,
          name: c.nome, ratio: c.ratio, funnel: funnel || null,
          origin: 'manuale', status: 'draft', media_type: 'image',
          // Il link scritto a mano vince su quello dedotto dall'handle: chi
          // importa puo' avere una collezione, una landing, un link con UTM
          // suoi, e dedurlo dal prodotto sarebbe indovinare sopra una scelta.
          link_url: pulisci(t.link_url) || (prodotto?.handle && clienteMotore()?.sito ? `${clienteMotore().sito}/products/${prodotto.handle}` : null),
          primary_text: pulisci(t.primary_text), headline: pulisci(t.headline),
          sub: pulisci(t.sub), cta: pulisci(t.cta),
          link_handle: prodotto?.handle || null, link_tipo: prodotto?.handle ? 'prodotto' : null,
          storage_url: pub?.publicUrl || null, thumb_url: pub?.publicUrl || null,
          // Angolo e prodotto li ha detti una persona: il classificatore non
          // deve ripensarci sopra.
          classified_at: new Date().toISOString(), classify_base: 'manuale',
          brief_tipo: 'importata', brief_motivo: 'Caricata a mano dalla board.',
        })
        if (error) throw new Error(error.message)
        fatte.push(c.nome)
      } catch (e) { errori.push(`${c.nome}: ${String(e.message).slice(0, 90)}`) }
    }
    const ok = fatte.length > 0
    return NextResponse.json({ ok, caricate: fatte.length, nomi: fatte, errori,
      prodotto: prodotto?.nome, angolo,
      ...(ok ? {} : { error: 'nessuna riga registrata' }) }, { status: ok ? 200 : 207 })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
