import { NextResponse } from 'next/server'
import path from 'node:path'
import { db } from '../../../../lib/motore/db'
import { componi } from '../../../../lib/motore/componi'
import { salvaImmagine } from '../../../../lib/motore/scena'
import { analizzaCreativita, cancelloQualita } from '../../../../lib/motore/mcpAiAds'
import { PALETTE } from '../../../../lib/motore/varianza'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'
import { logoDi } from '../../../../lib/motore/cliente'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Compone il layer brandizzato su una scena e salva le DUE versioni.
// Riceve la scena già generata (URL) e la applica a tutte le righe che
// condividono lo stesso brief: 1:1 e 9:16 nascono dallo stesso scatto, così
// la coppia resta riconoscibile come una sola creatività in due formati.
async function POST__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const { coppie } = await req.json().catch(() => ({}))
  if (!Array.isArray(coppie) || !coppie.length) {
    return NextResponse.json({ error: 'serve coppie: [{ id9x16, scena9x16, scena1x1 }]' }, { status: 400 })
  }
  // Il logo e' quello del cliente della richiesta (scheda in ce_brand); senza, si compone senza logo.
  const logo = await logoDi(clienteMotore()?.logo)
  const logoScuro = await logoDi(clienteMotore()?.logoScuro)
  const fatte = []

  for (const c of coppie) {
    try {
      const { data: rif } = await db().from('ce_creatives').select('*').eq('id', c.id9x16).eq('workspace_id', wsMotore()).maybeSingle()
      if (!rif) { fatte.push({ id: c.id9x16, errore: 'riga non trovata' }); continue }
      // La riga gemella: stesso nome, altro ratio.
      const nome1 = rif.name.replace('_9x16_', '_1x1_')
      const { data: gemella } = await db().from('ce_creatives')
        .select('id, name').eq('workspace_id', rif.workspace_id).eq('name', nome1).maybeSingle()

      // Una scena PER FORMATO: è l'unico modo per non tagliare mai il prodotto.
      const scarica = async (u) => {
        const r = await fetch(u, { signal: AbortSignal.timeout(40000) })
        if (!r.ok) throw new Error(`scena HTTP ${r.status}`)
        return Buffer.from(await r.arrayBuffer())
      }
      const buf9 = await scarica(c.scena9x16 || c.scenaUrl)
      const buf1 = c.scena1x1 ? await scarica(c.scena1x1) : null
      const palette = PALETTE.find(p => p.id === rif.palette) || PALETTE[0]

      for (const [id, ratio, nome, buf] of [
        [rif.id, '9x16', rif.name, buf9],
        [gemella?.id, '1x1', nome1, buf1 || buf9],
      ]) {
        if (!id) continue
        const png = await componi({
          scena: buf, ratio, palette, logo, logoScuro,
          headline: rif.headline, sub: rif.sub, cta: rif.cta,
          // Il telaio si ricava dal seme della creativita': un lotto esce con
          // layout diversi, e ricomporre la stessa creativita' da' lo stesso
          // telaio invece di trasformarla in un'altra.
          seme: rif.variante_seme || rif.name,
        })
        const url = await salvaImmagine({
          db: db(), percorso: `${rif.workspace_id}/${nome}.png`, buffer: png,
        })

        // Il cancello di qualita': un secondo parere indipendente sulla
        // creativita' finita, dal server MCP creative-engine-os. Guarda cose
        // che il nostro verificatore non guarda — safe zone di Meta, contrasto
        // del testo, gerarchia, adattamento al posizionamento — e alla prima
        // prova ha trovato un difetto che avevamo da sempre: logo dentro
        // l'header di Instagram e bottone dentro la barra di risposta.
        //
        // Costa circa due centesimi a creativita' e NON blocca niente: se il
        // server non risponde si consegna comunque e lo si dichiara. Un
        // giudizio in meno e' meglio di una creativita' in meno.
        let qualita = null
        if (url && process.env.MCP_QUALITA !== 'off') {
          try {
            const a = await analizzaCreativita({
              url, ratio,
              obiettivo: `acquisto da ${clienteMotore()?.descrizione || 'un negozio online'}, pubblico freddo`,
              copy: { headline: rif.headline, sub: rif.sub, cta: rif.cta },
            })
            const sc = a?.teardown?.scorecard
            const g = sc ? await cancelloQualita(sc) : null
            qualita = {
              verdetto: g?.verdetto || null,
              composito: sc?.composite_score ?? null,
              problemi: g?.problemi || [],
              safeZone: a?.teardown?.meta_compliance?.safe_zone_respected ?? null,
              migliorie: (a?.strategic_analysis?.priority_improvements || []).slice(0, 3),
              costo: a?.analysis_meta?.cost_usd ?? null,
              il: new Date().toISOString(),
            }
          } catch (e) {
            qualita = { verdetto: null, errore: String(e.message || e).slice(0, 140), il: new Date().toISOString() }
          }
        }
        // La scena si salva insieme al risultato: e' cio' che permette di
        // ricomporre senza rigenerare quando il compositore cambia.
        const patch = { storage_url: url, thumb_url: url, scena_url: ratio === '9x16' ? (c.scena9x16 || c.scenaUrl) : (c.scena1x1 || c.scena9x16 || c.scenaUrl) }
        let { error: eUp } = await db().from('ce_creatives').update({ ...patch, qualita_mcp: qualita }).eq('id', id).eq('workspace_id', wsMotore())
        if (eUp && /qualita_mcp/.test(eUp.message || '')) {
          // La colonna arriva con una migrazione: finche' non c'e' si consegna
          // la creativita' e si perde il solo giudizio, non il lavoro.
          ;({ error: eUp } = await db().from('ce_creatives').update(patch).eq('id', id).eq('workspace_id', wsMotore()))
        }
        if (eUp) throw new Error(eUp.message)
        fatte.push({ id, ratio, nome, url, qualita: qualita?.verdetto || null, composito: qualita?.composito ?? null })
      }
    } catch (e) {
      fatte.push({ id: c.id9x16, errore: e?.message?.slice(0, 120) })
    }
  }
  return NextResponse.json({ ok: true, fatte })
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
