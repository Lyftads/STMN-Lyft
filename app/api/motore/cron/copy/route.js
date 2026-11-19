import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { copyDaImmagine } from '../../../../../lib/motore/copyGen'
import { conMotore, wsMotore, clienteMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// ============================================================================
//  Riempie la copy delle creativita' importate.
//
//  Una creativita' importata entra come file e basta: nel motore c'era il pixel
//  e nemmeno una riga di testo, e al momento di caricarla su Meta il copy si
//  andava a cercare altrove. Erano 176 su 196.
//
//  Gira nel ciclo, quindi vale anche per quelle che verranno importate domani:
//  chi carica dei file puo' compilare i testi a mano nel modulo, e se non lo fa
//  ci pensa questo passaggio la notte dopo.
//
//  Cosa scrive e cosa NON tocca:
//    · il testo primario lo scrive sempre (non e' nell'immagine, su Meta sta
//      sopra)
//    · headline, sub e cta li scrive SOLO se mancano: dove ci sono gia' sono
//      stati letti dall'immagine e riscriverli vorrebbe dire sovrascrivere un
//      fatto con una generazione
//    · il link lo mette dall'handle del prodotto se manca
// ============================================================================

const INSIEME = 4        // quante alla volta: oltre, OpenAI inizia a rifiutare
const RESPIRO_MS = 45000 // si smette di aprire lavoro prima del tetto della funzione

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  if (!ws) return NextResponse.json({ error: 'CE_WORKSPACE_ID mancante' }, { status: 500 })
  const tetto = Number(new URL(req.url).searchParams.get('max') || 40)

  try {
    const { data: da, error } = await db().from('ce_creatives')
      .select('id, name, storage_url, product_id, angle_id, persona, funnel, headline, sub, cta, link_url, visual_desc')
      .eq('workspace_id', ws).neq('origin', 'existing')
      .is('primary_text', null).not('storage_url', 'is', null)
      .order('created_at', { ascending: true }).limit(tetto)
    if (error) throw new Error(error.message)
    if (!da?.length) return NextResponse.json({ ok: true, nota: 'nessuna creativita senza copy', scritte: 0 })

    const [{ data: prod }, { data: ang }, { data: brand }] = await Promise.all([
      db().from('ce_products').select('id, name, nome_breve, handle').eq('workspace_id', ws),
      db().from('ce_angles').select('id, slug').eq('workspace_id', ws),
      db().from('ce_brand').select('*').eq('workspace_id', ws).maybeSingle(),
    ])
    const perProd = new Map((prod || []).map(p => [p.id, p]))
    const perAng = new Map((ang || []).map(a => [a.id, a.slug]))
    const SITO = clienteMotore()?.sito || null

    const scritte = [], falliti = []
    const scadenza = Date.now() + (maxDuration * 1000 - RESPIRO_MS)

    for (let i = 0; i < da.length; i += INSIEME) {
      if (Date.now() > scadenza) {
        falliti.push({ nome: '(rimanenti)', errore: `tempo esaurito: ${da.length - i} rinviate al giro successivo` })
        break
      }
      await Promise.all(da.slice(i, i + INSIEME).map(async (c) => {
        const p = perProd.get(c.product_id)
        try {
          const copy = await copyDaImmagine({
            immagine: c.storage_url, prodotto: p, brand,
            angolo: perAng.get(c.angle_id), persona: c.persona, funnel: c.funnel, seme: c.id,
          })
          if (!copy) { falliti.push({ nome: c.name, errore: 'nessun tentativo ha rispettato i vincoli del brand' }); return }
          const patch = { primary_text: copy.primary_text }
          // Solo i buchi: dove il testo c'e' gia' e' stato letto dall'immagine,
          // e un fatto non si sovrascrive con una generazione.
          if (!c.headline && copy.headline) patch.headline = copy.headline
          if (!c.sub && copy.sub) patch.sub = copy.sub
          if (!c.cta && copy.cta) patch.cta = copy.cta
          if (!c.visual_desc && copy.cosa_si_vede) patch.visual_desc = copy.cosa_si_vede
          if (!c.link_url && p?.handle && SITO) patch.link_url = `${SITO}/products/${p.handle}`
          const { error: e2 } = await db().from('ce_creatives').update(patch).eq('id', c.id).eq('workspace_id', wsMotore())
          if (e2) throw new Error(e2.message)
          scritte.push(c.name)
        } catch (e) {
          falliti.push({ nome: c.name, errore: String(e.message || e).slice(0, 120) })
        }
      }))
    }

    // Il conto di quante ne restano: senza, un giro che ne fa 40 su 176
    // sembrerebbe aver finito il lavoro.
    const { count: restano } = await db().from('ce_creatives')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', ws).neq('origin', 'existing')
      .is('primary_text', null).not('storage_url', 'is', null)

    const ok = scritte.length > 0 || da.length === 0
    return NextResponse.json({
      ok, scritte: scritte.length, restano: restano ?? null, falliti,
      ...(ok ? {} : { error: `nessuna delle ${da.length} ha ottenuto una copy` }),
    }, { status: ok ? 200 : 207 })
  } catch (e) {
    return NextResponse.json({ error: String(e?.message || e) }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
