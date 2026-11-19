import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../../lib/motore/db'
import { invia, corpoLotto, destinatari } from '../../../../../lib/motore/email'
import { saldo, COSTO_SCENA } from '../../../../../lib/motore/higgsfield'
// I passi si chiamano come FUNZIONI, non via HTTP. Passare dalla rete voleva
// dire due timeout annidati (quello della funzione chiamata e quello della
// fetch che la chiama) e un abort a 50s che uccideva l'ingest a meta': un
// fallimento che non dipendeva dal lavoro ma dal modo in cui lo si invocava.
import { GET as ingestGET }   from '../ingest/route'
import { GET as businessGET } from '../business/route'
import { GET as googleGET }   from '../google/route'
import { GET as prodottiGET } from '../prodotti/route'
import { GET as timingGET }   from '../timing/route'
import { GET as linkGET }     from '../link/route'
import { GET as classifyGET } from '../classify/route'
import { GET as copyGET }     from '../copy/route'
import { GET as miniatureGET } from '../miniature/route'
import { POST as generaPOST } from '../../genera/route'
import { GET as sceneGET }     from '../scene/route'
import { POST as componiPOST } from '../../componi/route'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 800

// ============================================================================
//  Il ciclo giornaliero. È il motore che gira da solo.
//
//  Ordine non negoziabile: prima si MISURA, poi si decide, poi si produce.
//  Generare creatività prima di aver aggiornato i KPI significa produrre sulla
//  base di ieri l'altro, cioè inseguire un account che nel frattempo è cambiato.
//
//  Ogni passo è indipendente e registra il proprio esito. Un passo che fallisce
//  NON ferma quelli che non dipendono da lui — ma i passi a valle che dipendono
//  da un passo fallito vengono saltati esplicitamente, non eseguiti su dati
//  vecchi fingendo che vada bene. È la differenza fra un motore che si ferma e
//  uno che continua a produrre spazzatura plausibile.
// ============================================================================

const PASSI = [
  // chiave       handler       rotta finta        dipende da   perché
  ['ingest',   ingestGET,   '/api/motore/cron/ingest',   [],         'KPI per creatività da Meta'],
  ['business', businessGET, '/api/motore/cron/business', [],         'fatturato, ordini e CR da Shopify'],
  ['google',   googleGET,   '/api/motore/cron/google',   [],         'spesa Google Ads per il MER vero'],
  ['prodotti', prodottiGET, '/api/motore/cron/prodotti', [],         'vendite per prodotto e packshot'],
  ['timing',   timingGET,   '/api/motore/cron/timing',   [],         'giorni e fasce orarie migliori'],
  ['classify', classifyGET, '/api/motore/cron/classify', ['ingest'], 'angolo e formato dalle immagini'],
  // Non dipende da nessuno: guarda le immagini che sono gia' a magazzino. Sta
  // qui e non nell'importazione perche' chi carica dei file spesso il copy non
  // ce l'ha ancora, e aspettare che lo scriva vorrebbe dire non scriverlo mai.
  ['copy',     copyGET,     '/api/motore/cron/copy',     [],         'copy delle importate, letto e scritto dall\'immagine'],
  // Dopo l'ingest, cosi' rinnova anche le inserzioni entrate stanotte. Gli URL
  // del CDN di Meta scadono in pochi giorni: senza questo passo la board
  // perde tutte le miniature senza che nessun errore lo dica.
  ['miniature', miniatureGET, '/api/motore/cron/miniature', ['ingest'], 'URL delle miniature Meta rinnovati'],
]

// `link` sta in testa alla PRODUZIONE, non nella misura. Non per capriccio:
// insieme a `ingest` sono i due passi pesanti (103s e 117s) e dipendono l'uno
// dall'altro, quindi in una fase sola facevano 220s contro un tetto di 300 —
// un margine che il primo mese un po' più lento si mangia. L'ordine logico
// resta (ingest → link → brief), perché l'attribuzione dei link ai prodotti
// alimenta l'allocazione della produzione: deve solo precederla, non stare
// per forza nella stessa richiesta.
const PASSO_LINK = ['link', linkGET, '/api/motore/cron/link', 'dove portano le creatività attive']

async function passo(handler, base, rotta, segreto, metodo = 'GET') {
  const t0 = Date.now()
  try {
    // Ogni handler si aspetta una Request con il proprio bearer: gliene si
    // costruisce una, invece di fargliela arrivare dalla rete.
    const richiesta = new Request(base + rotta, {
      method: metodo,
      headers: {
        ...(segreto ? { authorization: `Bearer ${segreto}` } : {}),
        ...(metodo === 'POST' ? { 'content-type': 'application/json' } : {}),
      },
      ...(metodo === 'POST' ? { body: '{}' } : {}),
    })
    const r = await handler(richiesta)
    const j = await r.json().catch(() => ({}))
    // Un 207 è un successo parziale e il ciclo lo deve trattare come un
    // fallimento del passo: metà lavoro fatto non è lavoro fatto.
    const ok = r.ok && r.status !== 207 && j.ok !== false
    return { ok, stato: r.status, ms: Date.now() - t0,
      ...(ok ? { esito: j } : { errore: j.error || `HTTP ${r.status}`, esito: j }) }
  } catch (e) {
    return { ok: false, ms: Date.now() - t0, errore: String(e.message || e) }
  }
}

async function GET__(req) {
  const auth = req.headers.get('authorization') || ''
  const segreto = process.env.CRON_SECRET
  if (segreto && auth !== `Bearer ${segreto}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const url = new URL(req.url)
  const base = process.env.CE_BASE_URL || url.origin
  // Due fasi separate perché in produzione il ciclo intero ha impiegato 291s
  // contro un tetto di 300: un solo secondo in più di ingest e il cron muore
  // a metà, lasciando l'account misurato per metà. La misura gira alle 05:00,
  // la produzione alle 05:30, e la seconda controlla la freschezza dei dati a
  // DB invece di fidarsi di uno stato che non condivide.
  const fase = url.searchParams.get('fase')
    || (url.searchParams.get('soloAnalisi') === '1' ? 'misura' : 'tutto')
  const ws = wsMotore()

  const esiti = {}
  const bloccati = []

  if (fase === 'misura' || fase === 'tutto') {
    // I passi senza dipendenze girano INSIEME: in serie erano 168s di attesa
    // per lavori che non si parlano fra loro.
    const liberi = PASSI.filter(([, , , d]) => !d.length)
    const legati = PASSI.filter(([, , , d]) => d.length)
    const out = await Promise.all(liberi.map(([, h, rotta]) => passo(h, base, rotta, segreto)))
    liberi.forEach(([chiave], i) => { esiti[chiave] = out[i] })

    const out2 = await Promise.all(legati.map(([chiave, h, rotta, dipende]) => {
      const mancante = dipende.find(d => !esiti[d]?.ok)
      if (mancante) {
        bloccati.push(chiave)
        return Promise.resolve({ ok: false, saltato: true, errore: `saltato: dipende da "${mancante}" che è fallito` })
      }
      return passo(h, base, rotta, segreto)
    }))
    legati.forEach(([chiave], i) => { esiti[chiave] = out2[i] })
  }

  if (fase === 'misura') {
    const ok = Object.values(esiti).every(v => v.ok)
    return NextResponse.json({ ok, fase, esiti, bloccati }, { status: ok ? 200 : 207 })
  }

  // ---- 2. la produzione parte solo su dati freschi -------------------------
  // In un cron separato la produzione non ha visto la misura: la freschezza si
  // verifica a DB. Produrre brief su KPI di ieri l'altro è il modo migliore
  // per moltiplicare l'angolo sbagliato.
  let fresco = esiti.ingest?.ok || false
  if (fase === 'produci') {
    const { data } = await kpiDi('ce_kpi_daily', 'day').order('day', { ascending: false }).limit(1)
    const ultimo = data?.[0]?.day
    fresco = !!ultimo && (Date.now() - new Date(ultimo).getTime()) < 3 * 86400000
    esiti.freschezza = fresco
      ? { ok: true, ultimoGiornoKpi: ultimo }
      : { ok: false, errore: `KPI fermi a ${ultimo || 'mai'}: la misura di stamattina non è andata` }
  }

  // Attribuzione dei link ai prodotti: alimenta l'allocazione, quindi precede
  // i brief.
  esiti.link = fresco
    ? await passo(PASSO_LINK[1], base, PASSO_LINK[2], segreto)
    : { ok: false, saltato: true, errore: 'saltato: KPI non aggiornati' }

  // ---- 3. i crediti si guardano PRIMA di produrre --------------------------
  // Scoprire di essere a zero a metà lotto lascia creatività composte a metà e
  // brief già consumati. Il controllo va fatto quando costa ancora niente.
  let crediti = null
  try {
    const s = await saldo()
    crediti = s.crediti
    await db().from('ce_crediti').upsert({
      workspace_id: ws, provider: 'higgsfield', saldo: crediti,
      costo_scena: COSTO_SCENA, aggiornato_il: new Date().toISOString(),
    }, { onConflict: 'workspace_id,provider' })
    esiti.crediti = { ok: true, saldo: crediti, scene: Math.floor(crediti / COSTO_SCENA) }
  } catch (e) {
    // NON sapere il saldo non è un fallimento del ciclo: è un limite noto e
    // dichiarato (Higgsfield non espone un endpoint crediti, il saldo si
    // aggiorna a mano da /api/crediti). Marcarlo come errore farebbe risultare
    // fallita ogni notte, e un allarme che suona sempre non è più un allarme.
    // Quello che NON si può fare è tacerlo: senza saldo la produzione parte
    // alla cieca e può fermarsi a metà lotto.
    esiti.crediti = { ok: true, noto: false, nota: String(e.message || e) }
  }

  // ---- 4. produci ----------------------------------------------------------
  if (!fresco) {
    esiti.produzione = { ok: false, saltato: true,
      errore: 'saltata: senza KPI aggiornati i brief sarebbero calcolati su dati vecchi' }
  } else if (process.env.MOTORE_IMMAGINI !== 'higgsfield') {
    // Con gpt-image-2 non ci sono crediti da esaurire: si paga a consumo. Il
    // gate sul saldo Higgsfield fermerebbe la produzione per un motivo che non
    // esiste piu'.
    esiti.produzione = await passo(generaPOST, base, '/api/motore/genera', segreto, 'POST')
  } else if (esiti.crediti?.noto !== false && esiti.crediti?.scene < 2) {
    esiti.produzione = { ok: false, saltato: true,
      errore: `saltata: ${crediti} crediti rimasti, meno di 2 scene. Ricarica prima di produrre.` }
  } else {
    esiti.produzione = await passo(generaPOST, base, '/api/motore/genera', segreto, 'POST')
  }

  // ---- 5. le bozze diventano immagini --------------------------------------
  // Senza questo passo il motore scrive brief e copy ma non produce nulla di
  // caricabile: era l'unico anello che richiedeva una persona.
  if (esiti.produzione?.ok || fresco) {
    esiti.scene = await passo(sceneGET, base, '/api/motore/cron/scene', segreto)
    const coppie = esiti.scene?.esito?.coppieDaComporre || []
    if (coppie.length) {
      // componi vuole il corpo: si costruisce a mano la Request, come per gli
      // altri passi, ma con le coppie dentro.
      const t0 = Date.now()
      try {
        const r = await componiPOST(new Request(base + '/api/motore/componi', {
          method: 'POST',
          headers: { 'content-type': 'application/json', ...(segreto ? { authorization: `Bearer ${segreto}` } : {}) },
          body: JSON.stringify({ coppie }),
        }))
        const j = await r.json().catch(() => ({}))
        const riuscite = (j.fatte || []).filter(x => !x.errore).length
        esiti.composizione = { ok: r.ok && riuscite > 0, ms: Date.now() - t0, riuscite, esito: j,
          ...(riuscite ? {} : { errore: 'nessuna creatività composta' }) }
      } catch (e) {
        esiti.composizione = { ok: false, ms: Date.now() - t0, errore: String(e.message || e) }
      }
    } else {
      esiti.composizione = { ok: true, riuscite: 0, nota: 'nessuna scena da comporre' }
    }
  }

  // ---- 4. avvisa -----------------------------------------------------------
  // Il lotto di oggi: quello che ha davvero un file, non quello che è stato
  // solo pianificato.
  let lotto = []
  try {
    const inizio = new Date(Date.now() - 20 * 3600000).toISOString()
    // Solo le creatività PRODOTTE dal motore. Senza questo filtro il lotto
    // pescava anche le inserzioni importate da Meta — la prima notte l'email
    // ha annunciato 146 creatività nuove quando ne erano state prodotte 12.
    const { data } = await db().from('ce_creatives')
      .select('name, format, funnel, brief_motivo, storage_url, angle_id')
      .eq('workspace_id', ws).neq('origin', 'existing')
      .gte('created_at', inizio).order('created_at', { ascending: false })
    lotto = (data || []).map(c => ({
      name: c.name, formato: c.format, funnel: c.funnel,
      briefMotivo: c.brief_motivo, pronta: !!c.storage_url,
    }))
  } catch { /* l'avviso non deve far fallire il ciclo */ }

  const pronte = lotto.filter(c => c.pronta)
  const problemi = Object.entries(esiti).filter(([, v]) => !v.ok).map(([k, v]) => `${k}: ${v.errore}`)

  let email = { inviata: false, perche: 'nessun lotto nuovo' }
  if (pronte.length || problemi.length) {
    email = await invia({
      oggetto: pronte.length
        ? `Motore Creativo — ${pronte.length} creatività nuove`
        : `Motore Creativo — nessuna produzione oggi (${problemi.length} problemi)`,
      html: corpoLotto({ lotto: pronte, crediti, saltati: problemi }),
      testo: pronte.length
        ? pronte.map(c => c.name).join('\n')
        : problemi.join('\n'),
    })
  }

  const tutto = Object.values(esiti).every(v => v.ok)
  return NextResponse.json({
    ok: tutto, prodotte: pronte.length, crediti,
    email, destinatari: destinatari(), esiti, bloccati,
  }, { status: tutto ? 200 : 207 })
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
