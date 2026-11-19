import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

const GIUDIZI = ['kill', 'good', 'scale']
// La QUALITÀ è un'altra cosa dal verdetto: dice se il motore l'ha prodotta
// bene, non come ha reso una volta lanciata.
const QUALITA = ['male', 'buona', 'ottima']
// Perche' e' venuta male. 'prodotto' = la confezione e' resa male: non insegna
// niente sulla scena e si corregge nella specifica del prodotto. 'scena' =
// l'ambientazione o l'inquadratura non funzionano, e quello si' che pesa sugli
// assi. Senza questa distinzione il motore aveva imparato a evitare quattro
// ottime ambientazioni per colpa di una maniglia disegnata male.
const MOTIVI = ['prodotto', 'scena']

// Segna a mano cosa è stato lanciato e che verdetto gli abbiamo dato.
// I due flag sono indipendenti: si può lanciare senza giudicare (il caso
// normale nei primi giorni) e si può giudicare "kill" qualcosa che non è mai
// partito, perché lo abbiamo scartato prima del caricamento.
async function POST__(req) {
  try {
    const ws = wsMotore()
    if (!ws) return NextResponse.json({ error: 'CE_WORKSPACE_ID non configurato' }, { status: 500 })

    const body = await req.json()
    const ids = Array.isArray(body.ids) ? body.ids : (body.id ? [body.id] : [])
    if (!ids.length) return NextResponse.json({ error: 'nessun id' }, { status: 400 })

    const patch = {}
    if ('lanciata' in body) {
      patch.flag_lanciata = !!body.lanciata
      // La data si scrive solo accendendo il flag: spegnendolo si azzera,
      // altrimenti resterebbe una data di lancio su qualcosa di non lanciato.
      patch.flag_lanciata_il = body.lanciata ? new Date().toISOString() : null
    }
    if ('giudizio' in body) {
      const g = body.giudizio
      if (g !== null && !GIUDIZI.includes(g)) {
        return NextResponse.json({ error: `giudizio non valido: ${g}` }, { status: 400 })
      }
      patch.giudizio = g
      patch.giudizio_il = g ? new Date().toISOString() : null
    }
    if ('qualita' in body) {
      const q = body.qualita
      if (q !== null && !QUALITA.includes(q)) {
        return NextResponse.json({ error: `qualità non valida: ${q}` }, { status: 400 })
      }
      patch.qualita = q
      patch.qualita_il = q ? new Date().toISOString() : null
      // Il motivo viaggia col voto: se si toglie il voto si toglie anche il
      // motivo, altrimenti resterebbe una spiegazione senza niente da spiegare.
      if (!q) patch.qualita_motivo = null
    }
    if ('qualitaMotivo' in body) {
      const m = body.qualitaMotivo
      if (m !== null && !MOTIVI.includes(m)) {
        return NextResponse.json({ error: `motivo non valido: ${m}` }, { status: 400 })
      }
      patch.qualita_motivo = m
    }
    if ('nota' in body) patch.nota = body.nota || null

    // I TESTI dell'inserzione. Le creativita' importate a mano nascevano senza:
    // il file c'era e il copy no, quindi al momento di caricarle su Meta si
    // andava a cercare il testo da un'altra parte — o lo si riscriveva.
    // Passano da qui e non da una rotta loro perche' e' gia' il posto dove si
    // modifica una creativita', e su piu' id insieme: un lotto che condivide il
    // copy si compila una volta sola.
    for (const campo of ['primary_text', 'headline', 'sub', 'cta', 'link_url']) {
      if (!(campo in body)) continue
      const v = typeof body[campo] === 'string' ? body[campo].trim() : body[campo]
      if (campo === 'link_url' && v && !/^https?:\/\//i.test(v)) {
        return NextResponse.json({ error: `il link deve iniziare con http:// o https:// — ricevuto "${String(v).slice(0, 60)}"` }, { status: 400 })
      }
      patch[campo] = v || null
    }
    if (!Object.keys(patch).length) return NextResponse.json({ error: 'niente da aggiornare' }, { status: 400 })

    // La colonna del motivo arriva con una migrazione. Finche' non e' stata
    // eseguita si scrive tutto il resto invece di rifiutare il salvataggio: chi
    // sta segnando una creativita' non deve accorgersi di una ALTER TABLE.
    const scrivi = (p, campi) => db().from('ce_creatives')
      .update(p).eq('workspace_id', ws).in('id', ids).select(campi)
    const CAMPI = 'id, flag_lanciata, flag_lanciata_il, giudizio, giudizio_il, qualita, qualita_il, nota, primary_text, headline, sub, cta, link_url'
    let { data, error } = await scrivi(patch, CAMPI + ', qualita_motivo')
    let motivoIgnorato = false
    if (error && /qualita_motivo/.test(error.message || '')) {
      const senza = { ...patch }; delete senza.qualita_motivo
      motivoIgnorato = 'qualita_motivo' in patch
      ;({ data, error } = await scrivi(senza, CAMPI))
    }
    if (error) throw new Error(error.message)

    return NextResponse.json({ ok: true, aggiornate: data?.length || 0, righe: data || [],
      ...(motivoIgnorato ? { avviso: 'motivo non salvato: manca la colonna qualita_motivo, va eseguito qualita_motivo.sql' } : {}) })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
