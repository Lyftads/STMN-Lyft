import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { classificaLotto } from '../../../../../lib/motore/classify'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  const url = new URL(req.url)
  const force = url.searchParams.get('force') === '1'
  const quante = Number(url.searchParams.get('limit') || 40)

  try {
    // Angoli già in uso: si passano al modello perché RIUSI le etichette
    // invece di inventarne una nuova per ogni creatività. Se ognuna ha il suo
    // angolo, l'aggregazione per angolo non serve più a niente.
    const { data: angoli } = await db().from('ce_angles').select('id, slug').eq('workspace_id', ws)
    // Solo i prodotti che vendono davvero: un catalogo di 43 voci nel prompt
    // fa più danno che bene, e la coda lunga non riceve produzione comunque.
    const { data: prodotti } = await db().from('ce_products')
      .select('id, slug, name, revenue_30d').eq('workspace_id', ws)
      .order('revenue_30d', { ascending: false, nullsFirst: false }).limit(14)
    const perSlug = new Map((prodotti || []).map(p => [p.slug, p.id]))
    const noti = (angoli || []).map(a => a.slug)
    const mappaAngoli = new Map((angoli || []).map(a => [a.slug, a.id]))

    let q = db().from('ce_creatives')
      .select('id, name, headline, body, description, cta, media_type, storage_url, thumb_url, product_id')
      .eq('workspace_id', ws)
    if (!force) q = q.is('classified_at', null)
    const { data: da, error } = await q.limit(quante)
    if (error) throw new Error(error.message)
    if (!da?.length) return NextResponse.json({ ok: true, nota: 'niente da classificare', rimaste: 0 })

    const esiti = await classificaLotto(da, noti, prodotti || [])

    let aggiornate = 0, nuoviAngoli = 0, senzaEsito = 0
    const motivi = {}
    for (const e of esiti) {
      if (!e.angolo) {
        senzaEsito++; if (e.motivo) motivi[e.motivo] = (motivi[e.motivo] || 0) + 1
        // NON si marca come classificata: se la lettura è fallita (immagine
        // irraggiungibile, errore API) va ritentata al giro dopo. Marcarla
        // significherebbe perderla per sempre con un buco silenzioso.
        continue
      }
      let angleId = mappaAngoli.get(e.angolo)
      if (!angleId) {
        const { data: ins } = await db().from('ce_angles')
          .upsert({ workspace_id: ws, name: e.angolo, slug: e.angolo, source: 'scraped' },
                  { onConflict: 'workspace_id,slug' }).select('id').maybeSingle()
        if (ins?.id) { angleId = ins.id; mappaAngoli.set(e.angolo, angleId); noti.push(e.angolo); nuoviAngoli++ }
      }
      // Il PRODOTTO non si sovrascrive se già lo sappiamo.
      //
      // Le creatività importate portano il prodotto dalla cartella di origine:
      // è informazione di prima mano. Il classificatore lo deduce guardando
      // l'immagine, e su questo catalogo sbaglia spesso — confonde la bag
      // singola col formato da due e l'Angelino col Fruttato. Lasciandolo
      // scrivere ha riattribuito 86 creatività su 182, quasi la metà, e la
      // board mostrava prodotti che non c'entravano.
      //
      // Regola: la deduzione riempie i buchi, non corregge ciò che è certo.
      const riga = da.find(x => x.id === e.id)
      const prodottoDedotto = perSlug.get(e.prodotto) || null
      const teniamoIlSuo = !!riga?.product_id
      await db().from('ce_creatives').update({
        angle_id: angleId || null, format: e.formato, funnel: e.funnel, persona: e.persona,
        ...(teniamoIlSuo ? {} : { product_id: prodottoDedotto }),
        angle_confidence: e.confidenza, visual_desc: e.descrizione, classify_base: e.base,
        classified_at: new Date().toISOString(),
      }).eq('id', e.id).eq('workspace_id', wsMotore())
      aggiornate++
    }

    const { count } = await db().from('ce_creatives')
      .select('id', { count: 'exact', head: true }).eq('workspace_id', ws).is('classified_at', null)

    // Aver LETTO 12 creatività e non averne classificata nessuna non è un
    // successo: è un fallimento con un bel riepilogo. Dichiararlo ok fa passare
    // il ciclo giornaliero oltre, e il motore produce sull'ultima
    // classificazione buona come se fosse di oggi.
    const ok = da.length === 0 || aggiornate > 0
    return NextResponse.json({ ok, lette: da.length, aggiornate, senzaEsito, motivi, nuoviAngoli, rimaste: count ?? null,
      ...(ok ? {} : { error: `nessuna delle ${da.length} creatività è stata classificata` }) },
      { status: ok ? 200 : 207 })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'classificazione fallita' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
