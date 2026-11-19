import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { trovaTemi, assegnaTemi, temiScoperti, mappaSuAngoli } from '../../../../../lib/motore/recensioni'
import { conMotore, wsMotore, chiaveCliente } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Rilegge le recensioni già salvate e ne ricava i temi.
//
// Lo SCARICAMENTO non sta qui: Trustpilot risponde 403 a tutto ciò che non è
// un browser vero, quindi la raccolta si fa a parte (scripts/scarica-recensioni)
// e questa rotta lavora su ciò che è già a DB. Fingere di scaricare e trovare
// zero recensioni sarebbe il solito fallimento silenzioso.
async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  const chiave = chiaveCliente('openai')?.chiave
  if (!chiave) return NextResponse.json({ error: 'ChatGPT non collegato: inserisci la chiave nella tab Integrazioni' }, { status: 500 })

  try {
    const { data: rec, error } = await db().from('ce_recensioni')
      .select('id, stelle, titolo, testo').eq('workspace_id', ws).order('pubblicata_il', { ascending: false })
    if (error) throw new Error(error.message)
    if (!rec?.length) {
      return NextResponse.json({ ok: false,
        error: 'nessuna recensione a DB: vanno raccolte con scripts/scarica-recensioni.mjs' }, { status: 409 })
    }

    const temi = await trovaTemi(rec, chiave)
    if (!temi.length) throw new Error("l'analisi non ha prodotto temi")

    const per = await assegnaTemi(rec, temi, chiave)
    // Conteggi VERI: quante recensioni toccano ogni tema, non una stima.
    const conta = {}
    for (const [id, slugs] of per) {
      for (const s of slugs) conta[s] = (conta[s] || 0) + 1
      await db().from('ce_recensioni').update({ temi: slugs }).eq('id', id).eq('workspace_id', wsMotore())
    }

    // Quale angolo esistente copre già ciascun tema: lo decide il modello,
    // perché "OLIO-DI-ALTA-QUALITA" e "QUALITA" sono la stessa cosa e nessun
    // confronto fra stringhe se ne accorge.
    const { data: angPrima } = await db().from('ce_angles').select('id, slug').eq('workspace_id', ws)
    // Per ogni angolo si portano anche alcune headline reali: la copertura si
    // giudica su cosa le creatività dicono, non sul nome dell'angolo.
    const { data: conTesto } = await db().from('ce_creatives')
      .select('angle_id, headline').eq('workspace_id', ws).not('headline', 'is', null)
    const esempiPer = {}
    for (const c of (conTesto || [])) {
      if (!c.angle_id || /\{\{/.test(c.headline)) continue   // niente segnaposto
      ;(esempiPer[c.angle_id] = esempiPer[c.angle_id] || []).push(c.headline)
    }
    const angoli = (angPrima || []).map(a => ({
      slug: a.slug, esempi: [...new Set(esempiPer[a.id] || [])].slice(0, 3),
    }))
    const conCopertura = await mappaSuAngoli(temi, angoli, chiave)

    const righe = conCopertura.map(t => ({
      workspace_id: ws, slug: t.slug, nome: t.nome, descrizione: t.descrizione,
      sentiment: t.sentiment, citazione: t.citazione, angolo: t.angolo || null,
      // Quale angolo esistente lo copre già: senza questo campo il motore
      // di brief non sa distinguere un tema nuovo da uno che stiamo già
      // dicendo, e annuncia buchi che non esistono.
      coperto_da: t.copertoDa || null,
      n: conta[t.slug] || 0,
      quota: rec.length ? +((conta[t.slug] || 0) / rec.length).toFixed(3) : 0,
      aggiornato_il: new Date().toISOString(),
    })).sort((a, b) => b.n - a.n)
    const { error: eUp } = await db().from('ce_temi').upsert(righe, { onConflict: 'workspace_id,slug' })
    if (eUp) throw new Error(eUp.message)
    // I temi del giro precedente vanno via: la tassonomia si rigenera ogni
    // volta con slug leggermente diversi, e senza pulizia il DB accumulava tre
    // varianti dello stesso tema (FEDELTA-CLIENTI, FIDELIZZAZIONE,
    // FIDUCIA-E-FEDELTA) che si contendevano lo stesso posto.
    const vivi = righe.map(r => r.slug)
    const { data: rimossi } = await db().from('ce_temi')
      .delete().eq('workspace_id', ws).not('slug', 'in', `(${vivi.map(v => `"${v}"`).join(',')})`).select('slug')

    // Si allinea per SLUG e non per indice: `righe` viene ordinata per n dopo
    // la costruzione, quindi conCopertura[i] non corrisponde più a righe[i].
    // Con l'indice, la copertura finiva sul tema sbagliato — e un tema scoperto
    // spariva perché ereditava la copertura di un altro.
    const coperturaPer = new Map(conCopertura.map(c => [c.slug, c.copertoDa || null]))
    const scoperti = temiScoperti(righe.map(r => ({ ...r, copertoDa: coperturaPer.get(r.slug) ?? null })))

    return NextResponse.json({
      ok: true, recensioni: rec.length, temi: righe.length, temiVecchiRimossi: rimossi?.length || 0,
      classificate: per.size,
      temiPrincipali: righe.slice(0, 8).map(t => `${t.slug} ${t.n} (${Math.round(t.quota * 100)}%)`),
      daNonPromettere: righe.filter(t => t.sentiment === 'negativo').map(t => `${t.slug} ${t.n}`),
      scoperti: scoperti.map(t => ({ angolo: t.angolo, tema: t.slug, n: t.n, citazione: t.citazione })),
      giaCoperti: righe.filter(r => coperturaPer.get(r.slug))
        .map(r => `${r.slug} → ${coperturaPer.get(r.slug)}`),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
