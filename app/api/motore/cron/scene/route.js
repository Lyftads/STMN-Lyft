import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { promptDaRiga } from '../../../../../lib/motore/scena'
import { analizza, daEvitare, leggiGiudizi } from '../../../../../lib/motore/apprendimento'
import { avviaScena, attendiScena, COSTO_SCENA } from '../../../../../lib/motore/higgsfield'
import { misuraScala, giudicaScala } from '../../../../../lib/motore/misura'
import { generaScena as generaOpenAI, costoStimato } from '../../../../../lib/motore/openaiImg'
import { salvaImmagine } from '../../../../../lib/motore/scena'
import { riferimentiPacco } from '../../../../../lib/motore/matrice'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Quante volte si ripaga una scena fuori scala. Il 1:1 ne ha uno in piu'
// perche' e' li' che il difetto e' sistematico: la cornice quadrata spinge il
// modello a riempirla, e il primo ritentativo spesso non basta.
const RITENTATIVI = { '1x1': 2, '9x16': 1 }

// Si smette di aprire lavoro nuovo prima del tetto della funzione: meglio due
// coppie finite e verificate che quattro tagliate a meta' dal timeout.
const RESPIRO_MS = 55000

// Chi genera le scene. gpt-image-2 dal 3 settembre 2026: sullo stesso prodotto e
// con lo stesso prompt fa uscire la cima della bag chiusa invece che con la
// maniglia inventata, due scatole quando il prodotto e' un due pezzi, il testo
// stampato giusto e la scala corretta al primo colpo — a 0,025 dollari contro 3
// crediti. Il 9:16 lo fa esatto (1008x1792), che era il punto in cui poteva
// rompersi. Higgsfield resta raggiungibile con MOTORE_IMMAGINI=higgsfield.
const MOTORE = process.env.MOTORE_IMMAGINI || 'openai'

// Quanto una scena e' fuori banda, per tenere la meno peggio se nessun
// tentativo rientra: buttare via tutto vorrebbe dire aver speso i crediti per
// niente.
function scarto(g, ratio) {
  if (g.ok) return 0
  const b = { '1x1': 2.2, '9x16': 2.2 }[ratio] || 2.2
  return (g.rapportoVolto != null ? Math.max(0, g.rapportoVolto - b) : 0) + Math.max(0, (g.frazione || 0) - 0.6)
}

// Genera, MISURA, e se la scala e' fuori banda rigenera dicendo di quanto ha
// sbagliato. La correzione entra in coda al prompt: il prompt di partenza non
// si tocca, cosi' un ritentativo resta la stessa scena vista da piu' lontano e
// non un'altra scena.
async function scenaVerificata({ prompt, riferimenti, ratio, borsa, scadenza }) {
  const tentativi = []
  let correzione = '', migliore = null
  for (let i = 0; i <= (RITENTATIVI[ratio] ?? 1); i++) {
    if (!borsa.puoiSpendere()) break
    if (i > 0 && Date.now() > scadenza) break
    const p = correzione ? `${prompt}\n\n${correzione}` : prompt
    let url
    if (MOTORE === 'openai') {
      // gpt-image-2 restituisce i byte, non un URL: l'immagine va messa su
      // Storage qui, altrimenti la composizione non avrebbe cosa scaricare.
      const g = await generaOpenAI({ prompt: p, riferimenti, ratio })
      borsa.spendiOpenAI(g.costo)
      url = await salvaImmagine({
        db: db(), percorso: `${wsMotore()}/scene/${Date.now()}-${ratio}-${i}.png`,
        buffer: g.buffer,
      })
      if (!url) throw new Error('scena generata ma non salvata su Storage')
    } else {
      url = await attendiScena(await avviaScena({ prompt: p, riferimenti, ratio }))
      borsa.spendi()
    }
    let g
    try {
      g = giudicaScala(await misuraScala(url), ratio)
    } catch (e) {
      // La verifica non deve poter bloccare la produzione: se il misuratore
      // non risponde si tiene la scena e lo si dichiara, non si finge che sia
      // stata controllata.
      tentativi.push({ url, esito: `non verificata: ${String(e.message || e).slice(0, 90)}` })
      return { url, tentativi, verificata: false }
    }
    tentativi.push({
      url, esito: g.ok ? (g.misurato ? 'in banda' : g.nota) : g.motivi.join('; '),
      ...(g.misurato ? { frazione: Number(g.frazione.toFixed(2)), rapportoVolto: g.rapportoVolto ? Number(g.rapportoVolto.toFixed(1)) : null } : {}),
    })
    if (g.ok) return { url, tentativi, verificata: g.misurato, corretta: i > 0 }
    const s = scarto(g, ratio)
    if (!migliore || s < migliore.s) migliore = { url, s }
    correzione = g.correzione
  }
  // Nessun tentativo e' rientrato: si tiene il meno sbagliato e lo si dice.
  return { url: migliore?.url || null, tentativi, verificata: true, fuoriBanda: true }
}

// ============================================================================
//  L'anello che mancava: dalle bozze alle immagini, senza una persona in mezzo.
//
//  Ogni creatività nasce in DUE righe, una per formato. Si generano DUE scene
//  distinte — non una ritagliata — perché il ritaglio è il modo in cui il
//  prodotto finisce tagliato, ed è il difetto che il cliente ha già segnalato.
//
//  Si lavora a COPPIE e si conta prima: ogni coppia costa 2 generazioni. Se i
//  crediti bastano per tre coppie e mezzo, se ne fanno tre — mai tre e mezzo,
//  perché una coppia a metà è una creatività che non esiste in un formato.
// ============================================================================

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  const url = new URL(req.url)
  const tetto = Number(url.searchParams.get('max') || 4)   // coppie per giro

  try {
    // Le bozze 9x16 senza file: sono le capofila, la gemella 1x1 le segue.
    const { data: bozze, error } = await db().from('ce_creatives')
      .select('id, name, scena_desc, product_id, ratio')
      .eq('workspace_id', ws).eq('ratio', '9x16').eq('origin', 'generated')
      .is('storage_url', null).not('scena_desc', 'is', null)
      .order('created_at', { ascending: true }).limit(tetto)
    if (error) throw new Error(error.message)
    if (!bozze?.length) return NextResponse.json({ ok: true, nota: 'nessuna bozza in attesa di scena', coppie: 0 })

    // Cosa è stato bocciato: entra nel prompt come vincolo esplicito.
    const { righe: giudicate } = await leggiGiudizi(db, ws)
    const evitare = daEvitare(analizza(giudicate || []))

    const { data: prodotti } = await db().from('ce_products').select('*').eq('workspace_id', ws)
    const perId = new Map((prodotti || []).map(p => [p.id, p]))

    // Il saldo si legge PRIMA di generare, non dopo: con i ritentativi il
    // costo di un giro non e' piu' prevedibile (una coppia puo' costarne due),
    // e senza un tetto la verifica di scala potrebbe prosciugare i crediti
    // dentro un solo lotto.
    const { data: cr } = await db().from('ce_crediti')
      .select('saldo, spesi_dal_motore').eq('workspace_id', ws).eq('provider', 'higgsfield').maybeSingle()
    const disponibili = Number(cr?.saldo ?? 0)
    const borsa = {
      spesi: 0, dollari: 0,
      // Con OpenAI non ci sono crediti da esaurire: si paga a consumo, quindi
      // il tetto non e' il saldo ma il tempo della funzione. Con Higgsfield
      // invece il saldo e' un muro e va contato prima.
      puoiSpendere: () => MOTORE === 'openai' || !cr || disponibili - borsa.spesi >= COSTO_SCENA,
      spendi: () => { borsa.spesi += COSTO_SCENA },
      spendiOpenAI: (c) => { borsa.dollari += c || 0 },
    }
    const scadenza = Date.now() + (maxDuration * 1000 - RESPIRO_MS)

    const fatte = [], falliti = []
    for (const b of bozze) {
      const prodotto = perId.get(b.product_id)
      // Senza packshot il modello disegna un prodotto generico: meglio non
      // spendere crediti per un'immagine che andrà buttata.
      if (!prodotto?.packshot_url) {
        falliti.push({ nome: b.name, errore: 'prodotto senza packshot: niente riferimento visivo' })
        continue
      }
      if (!borsa.puoiSpendere()) {
        falliti.push({ nome: b.name, errore: `crediti esauriti: ${disponibili - borsa.spesi} rimasti` })
        continue
      }
      if (Date.now() > scadenza) {
        falliti.push({ nome: b.name, errore: 'tempo della funzione esaurito: rinviata al giro successivo' })
        continue
      }
      try {
        // Le due scene procedono INSIEME: sono indipendenti e in serie
        // raddoppiavano l'attesa contro il tetto della funzione. Ognuna ora si
        // porta dietro la propria verifica di scala e i propri ritentativi.
        const [v9, v1] = await Promise.all(['9x16', '1x1'].map(r =>
          scenaVerificata({
            prompt: promptDaRiga({ scenaDesc: b.scena_desc, prodotto, ratio: r, evitare }),
            // Se la scena mostra un pacco, accanto al packshot vanno le foto
            // VERE della scatola di spedizione gialla: senza, il modello
            // disegna un cartone marrone anonimo.
            riferimenti: [prodotto.packshot_url, ...riferimentiPacco(b.scena_desc)], ratio: r, borsa, scadenza,
          })))
        const s9 = v9.url, s1 = v1.url
        if (!s9 || !s1) throw new Error('una delle due scene non e\' stata prodotta')
        // Si conservano gli URL delle scene: se la composizione va corretta,
        // ricomporre non deve costare una nuova generazione.
        await db().from('ce_creatives').update({ scena_url: s9 }).eq('id', b.id)
        const nome1 = b.name.replace('_9x16_', '_1x1_')
        await db().from('ce_creatives').update({ scena_url: s1 })
          .eq('workspace_id', ws).eq('name', nome1)
        fatte.push({
          id9x16: b.id, nome: b.name, scena9x16: s9, scena1x1: s1,
          scala: {
            '9x16': { tentativi: v9.tentativi.length, ...(v9.fuoriBanda ? { fuoriBanda: true } : {}), ...(v9.verificata ? {} : { nonVerificata: true }), esiti: v9.tentativi },
            '1x1': { tentativi: v1.tentativi.length, ...(v1.fuoriBanda ? { fuoriBanda: true } : {}), ...(v1.verificata ? {} : { nonVerificata: true }), esiti: v1.tentativi },
          },
        })
      } catch (e) {
        falliti.push({ nome: b.name, errore: String(e.message || e).slice(0, 150) })
      }
    }

    // Si scala il saldo stimato. L'API non lo espone e le sue generazioni non
    // compaiono nelle transazioni dell'abbonamento: senza questo contatore
    // l'avviso non scatterebbe mai e la produzione si fermerebbe a metà lotto.
    // Il conteggio arriva dalla borsa e non da `fatte.length * 2`: coi
    // ritentativi le generazioni sono piu' delle scene consegnate, e anche una
    // coppia fallita a meta' ha comunque speso.
    const spesi = borsa.spesi
    if (spesi && cr) {
      await db().from('ce_crediti').update({
        saldo: Math.max(0, disponibili - spesi),
        spesi_dal_motore: Number(cr.spesi_dal_motore || 0) + spesi,
        aggiornato_il: new Date().toISOString(),
      }).eq('workspace_id', ws).eq('provider', 'higgsfield')
    }

    const ok = fatte.length > 0 || bozze.length === 0
    return NextResponse.json({
      ok, coppie: fatte.length, motore: MOTORE, creditiSpesi: spesi,
      ...(MOTORE === 'openai' ? { costoStimato: Number(borsa.dollari.toFixed(3)) } : {}),
      scaleCorrette: fatte.reduce((n, f) => n + ['9x16', '1x1'].filter(r => f.scala?.[r]?.tentativi > 1 && !f.scala[r].fuoriBanda).length, 0),
      scaleFuoriBanda: fatte.reduce((n, f) => n + ['9x16', '1x1'].filter(r => f.scala?.[r]?.fuoriBanda).length, 0),
      scaleNonVerificate: fatte.reduce((n, f) => n + ['9x16', '1x1'].filter(r => f.scala?.[r]?.nonVerificata).length, 0),
      evitati: evitare.map(e => `${e.asse}:${e.id}`),
      coppieDaComporre: fatte, falliti,
      ...(ok ? {} : { error: `nessuna delle ${bozze.length} bozze ha ottenuto una scena` }),
    }, { status: ok ? 200 : 207 })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'generazione scene fallita' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
