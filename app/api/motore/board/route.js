import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../lib/motore/db'
import { soglieSegmento, segmentoDiRiferimento, fascia, fasciaMista, trattieni, CALDI } from '../../../../lib/motore/soglie'
import { dallaRichiesta, precedente } from '../../../../lib/motore/periodo'
import { quoteNuovo, trattieniApripista } from '../../../../lib/motore/apripista'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// PostgREST tronca a 1.000 righe per richiesta, in silenzio: senza paginare si
// calcolano medie e totali su un pezzo dei dati e sembrano corretti. Va sempre
// letto tutto, a pagine.
async function tutte(build, pagina = 1000) {
  let out = [], da = 0
  for (;;) {
    const { data, error } = await build().range(da, da + pagina - 1)
    if (error) throw new Error(error.message)
    out = out.concat(data || [])
    if (!data || data.length < pagina) return out
    da += pagina
  }
}

// Quanto serve per poter dire qualcosa. Espliciti e in un posto solo.
const eur = (n) => '€' + Math.round(n || 0).toLocaleString('it-IT')
const GIORNI_MINIMI = 7      // sotto: troppo giovane, non si spegne
// Quante volte il costo di un ordine può bruciare una creatività senza portarne
// nemmeno uno prima di spegnerla, a prescindere dall'età.
const SPESA_A_VUOTO = 4
const IMPR_GIUDIZIO = 1000   // sotto: il ROAS non è leggibile
const IMPR_SERVITA  = 500    // oltre 7gg e sotto questo: Meta non la serve

async function GET__(req) {
  const per = dallaRichiesta(new URL(req.url))
  const prec = per.confronta ? precedente(per) : null
  const ws = wsMotore()
  if (!ws) return NextResponse.json({ error: 'CE_WORKSPACE_ID mancante' }, { status: 500 })

  let creRows, kpiRows, segRows, vitaRows, precRows, prodRows, angRows, bizRows
  try {
    ;[creRows, kpiRows, segRows, vitaRows, precRows, prodRows, angRows, bizRows] = await Promise.all([
      tutte(() => db().from('ce_creatives').select('*').eq('workspace_id', ws)),
      tutte(() => kpiDi('ce_kpi_daily', '*').gte('day', per.since).lte('day', per.until)),
      tutte(() => kpiDi('ce_kpi_segment_daily', '*').gte('day', per.since).lte('day', per.until)),
      // La spesa di SEMPRE, per creativita': serve alla sola regola che parla
      // della vita intera di una creativita' — "ha avuto abbastanza occasioni
      // di fallire". Su una finestra di sette giorni una creativita' che gira
      // da tre mesi sembrerebbe non aver mai speso, e verrebbe trattenuta come
      // se fosse appena nata.
      tutte(() => kpiDi('ce_kpi_daily', 'creative_id, spend')),
      // Il periodo precedente, solo se si sta confrontando: e' una lettura in
      // piu' e non si fa quando nessuno la guarda.
      prec ? tutte(() => kpiDi('ce_kpi_daily', 'spend, purchases, purchase_value, impressions, link_clicks')
        .gte('day', prec.since).lte('day', prec.until)) : Promise.resolve([]),
      tutte(() => db().from('ce_products').select('*').eq('workspace_id', ws)),
      tutte(() => db().from('ce_angles').select('id, slug').eq('workspace_id', ws)),
      tutte(() => db().from('ce_business_daily').select('*').eq('workspace_id', ws).order('day', { ascending: false })),
    ])
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
  const cre = { data: creRows }, kpi = { data: kpiRows }, seg = { data: segRows }, biz = { data: bizRows }

  const byId = new Map((cre.data || []).map(c => [c.id, c]))
  // Spesa di SEMPRE per creativita'. Serve a una regola sola: "ha avuto
  // abbastanza occasioni di fallire". Quella domanda riguarda la vita intera
  // della creativita', non la finestra che si sta guardando — su sette giorni
  // una che gira da tre mesi sembrerebbe non aver mai speso.
  const spesaDiSempre = new Map()
  for (const k of vitaRows || []) {
    spesaDiSempre.set(k.creative_id, (spesaDiSempre.get(k.creative_id) || 0) + (+k.spend || 0))
  }

  // --- aggregati per creatività -------------------------------------------
  const agg = new Map()
  for (const k of kpi.data || []) {
    if (!byId.has(k.creative_id)) continue
    const a = agg.get(k.creative_id) || { spend:0, impressions:0, clicks:0, purchases:0, value:0,
      freq:0, giorni:0, plays:0, views3:0, thru:0, p100:0 }
    a.spend += +k.spend||0; a.impressions += +k.impressions||0; a.clicks += +k.link_clicks||0
    a.purchases += +k.purchases||0; a.value += +k.purchase_value||0
    a.plays += +k.video_plays||0; a.views3 += +k.video_views_3s||0; a.thru += +k.video_thruplay||0; a.p100 += +k.video_p100||0
    a.freq = Math.max(a.freq, +k.frequency||0); a.giorni++
    agg.set(k.creative_id, a)
  }

  // --- base per segmento (da cui si ancorano le soglie) --------------------
  const perSeg = {}
  let segSpendTot = 0
  for (const s of seg.data || []) {
    if (!byId.has(s.creative_id)) continue
    const p = perSeg[s.segment] || (perSeg[s.segment] = { spend:0, value:0, purchases:0 })
    p.spend += +s.spend||0; p.value += +s.purchase_value||0; p.purchases += +s.purchases||0
    segSpendTot += +s.spend||0
  }
  for (const k of Object.keys(perSeg)) {
    perSeg[k].roas = perSeg[k].spend ? perSeg[k].value / perSeg[k].spend : 0
  }
  const caldi = CALDI.reduce((acc, k) => {
    const p = perSeg[k]; if (p) { acc.spend += p.spend; acc.value += p.value; acc.purchases += p.purchases } return acc
  }, { spend:0, value:0, purchases:0 })
  caldi.roas = caldi.spend ? caldi.value / caldi.spend : 0

  const spesaTot = [...agg.values()].reduce((s,a)=>s+a.spend,0)
  const valTot   = [...agg.values()].reduce((s,a)=>s+a.value,0)
  const acqTot   = [...agg.values()].reduce((s,a)=>s+a.purchases,0)
  const roasAcc  = spesaTot ? valTot / spesaTot : 0

  const soglie = {
    new:   soglieSegmento(perSeg.new?.roas, roasAcc),
    caldi: soglieSegmento(caldi.roas, roasAcc),
  }

  // --- riquadro e-commerce -------------------------------------------------
  // MER e CAC si calcolano SOLO sui giorni in cui esiste ANCHE la spesa:
  // dividere 30 giorni di fatturato per i giorni in cui si è investito dà un
  // numero plausibile e falso. Il margine di contribuzione (60%) e il repeat
  // rate danno il tetto del CAC: sul primo ordine si lavora in pareggio, si
  // rientra sul secondo.
  const MARGINE = Number(process.env.CE_MARGINE || 0.60)
  // Anche i dati di negozio seguono il periodo scelto: MER e CAC in cima
  // devono parlare dello stesso intervallo della tabella sotto, altrimenti sono
  // due verita' nella stessa schermata.
  const B = (biz.data || []).filter(r => r.day >= per.since && r.day <= per.until)
  const conSpesa = B.filter(r => (+r.ad_spend_total || 0) > 0)
  const sum = (arr, f) => arr.reduce((a, r) => a + (+r[f] || 0), 0)
  const revTot = sum(B, 'revenue'), ordTot = sum(B, 'orders')
  const nuoviTot = sum(B, 'new_customers'), ritTot = sum(B, 'returning_customers')
  const revSovr = sum(conSpesa, 'revenue'), spesaSovr = sum(conSpesa, 'ad_spend_total')
  const nuoviSovr = sum(conSpesa, 'new_customers'), ordSovr = sum(conSpesa, 'orders')
  const aov = ordTot ? revTot / ordTot : 0
  const repeat = (nuoviTot + ritTot) ? ritTot / (nuoviTot + ritTot) : 0
  // Il CR di riferimento si calcola SOLO sui giorni consolidati: GA4 ha 24-48h
  // di latenza e i giorni freschi sono parziali. Usarli farebbe sembrare che il
  // sito stia peggiorando ogni giorno.
  const crGiorni = B.filter(r => !r.ga4_provvisorio && (+r.sessions || 0) > 0)
  const crMedio = crGiorni.length
    ? crGiorni.reduce((a, r) => a + (+r.conversion_rate || 0), 0) / crGiorni.length : null
  const crRecente = crGiorni.slice(0, 7)
  const crUltimi7 = crRecente.length
    ? crRecente.reduce((a, r) => a + (+r.conversion_rate || 0), 0) / crRecente.length : null

  const bizAgg = B.length ? {
    giorni: B.length, giorniConSpesa: conSpesa.length,
    revenue: revTot, orders: ordTot, aov,
    new_customers: nuoviTot, returning_customers: ritTot, repeatRate: repeat,
    merSoloMeta: spesaSovr ? revSovr / spesaSovr : null,
    // ATTENZIONE: è un CAC BLENDED e per giunta incompleto. Al numeratore c'è
    // solo la spesa Meta; al denominatore TUTTI i nuovi clienti, compresi quelli
    // arrivati da organico, email, diretto e Google Ads. Sottostima il CAC vero.
    // Salirà quando Google entrerà nell'ingest. Non confrontarlo con il pareggio
    // per ordine come se fosse un CAC di canale.
    cac: nuoviSovr ? spesaSovr / nuoviSovr : null,
    cacBlended: true,
    cpo: ordSovr ? spesaSovr / ordSovr : null,
    cacPareggioPrimoOrdine: aov * MARGINE,
    cacTetto: aov * MARGINE * (1 + repeat),
    cr: crUltimi7, crMedio30: crMedio,
    // Il freno: se il CR recente è sotto la media di oltre il 15%, gli aumenti
    // di budget si fermano anche sulle creatività sopra soglia.
    crInCalo: (crUltimi7 != null && crMedio) ? (crUltimi7 < crMedio * 0.85) : null,
    giorniGa4Provvisori: B.filter(r => r.ga4_provvisorio).length,
    googleMancante: true,
  } : null

  // --- mix nuovo/caldo per creatività --------------------------------------
  // Serve a giudicare le creatività a pubblico misto sulla parte che conta:
  // la quota su pubblico nuovo. Il numero fuso nasconde il caso in cui due
  // acquisti caldi reggono la media di una creatività che non acquisisce.
  // Lo spaccato per pubblico, creativita' per creativita': quanto ha speso sul
  // NUOVO, quanto su chi ha gia' interagito, quanto su chi ha gia' comprato.
  // Sono tre economie diverse — sul returning il ROAS e' alto per costruzione,
  // perche' quella gente sarebbe tornata comunque — e leggerle sommate nasconde
  // se una creativita' sta davvero acquisendo o sta solo raccogliendo.
  const PUBBLICI = ['new', 'engaged', 'returning', 'unknown']
  const segDi = new Map()

  // Quanta parte della copertura sul pubblico nuovo porta ogni creativita'.
  // Serve alla protezione delle apripista: una che porta una fetta grossa del
  // pubblico nuovo non si spegne alla cieca, perche' con dati a ultimo clic non
  // si sa quante vendite chiuse da altre partano da li'.
  const vivo = (id) => byId.has(id) && byId.get(id).status !== 'spenta'
  const copertura = quoteNuovo(seg.data, vivo)

  const mixDi = new Map()
  for (const r of (seg.data || [])) {
    const p = segDi.get(r.creative_id) || Object.fromEntries(PUBBLICI.map(k => [k, { spesa:0, valore:0, ordini:0 }]))
    if (p[r.segment]) {
      p[r.segment].spesa  += +r.spend || 0
      p[r.segment].valore += +r.purchase_value || 0
      p[r.segment].ordini += +r.purchases || 0
    }
    segDi.set(r.creative_id, p)

    const m = mixDi.get(r.creative_id) || { new:{spend:0,value:0,purchases:0}, caldo:{spend:0,value:0,purchases:0} }
    // 'unknown' resta fuori dal mix: non sapere di che pubblico si tratta non
    // è una ragione per contarlo come caldo.
    const dove = r.segment === 'new' ? 'new' : CALDI.includes(r.segment) ? 'caldo' : null
    if (dove) {
      m[dove].spend     += +r.spend || 0
      m[dove].value     += +r.purchase_value || 0
      m[dove].purchases += +r.purchases || 0
    }
    mixDi.set(r.creative_id, m)
  }

  const angoloDi = new Map((angRows || []).map(a => [a.id, a.slug]))
  // I prodotti nascosti spariscono dalla board: restano a DB e l'ingest
  // continua ad aggiornarne i numeri, ma non ingombrano il lavoro.
  const visibili = (prodRows || []).filter(p => !p.nascosto)
  const nascosti = new Set((prodRows || []).filter(p => p.nascosto).map(p => p.id))
  const prodottoDi = new Map((prodRows || []).map(p => [p.id, p]))

  // --- righe della tabella -------------------------------------------------
  const righe = []
  for (const [id, a] of agg) {
    const c = byId.get(id)
    const roas = a.spend ? a.value / a.spend : 0
    const rif = segmentoDiRiferimento(c.audience_type)
    const s = soglie[rif]
    // Quando si può giudicare, e quando no.
    //  · sotto i 7 giorni di vita NON si spegne mai: una creativa appena
    //    partita che ha speso poco non ha fallito, deve ancora iniziare;
    //  · sotto la soglia di impression il ROAS non è leggibile: è rumore;
    //  · oltre i 7 giorni con impression quasi nulle, Meta ha già deciso di
    //    non servirla — quello sì è un segnale, ed è uno spegnimento.
    const eta = c.ad_created_at
      ? Math.floor((Date.now() - new Date(c.ad_created_at).getTime()) / 86400000)
      : null
    let f
    // Spesa a vuoto: si spegne SUBITO, anche se è giovane.
    //
    // La protezione dei primi 7 giorni esiste perché una creativa appena
    // partita non ha fallito, deve ancora iniziare. Ma se ha già bruciato
    // quattro volte il costo di un ordine senza portarne nemmeno uno, non sta
    // iniziando: sta perdendo. Tenerla accesa per rispetto del calendario è il
    // modo piu' silenzioso di buttare budget.
    const cpoAccount = acqTot ? spesaTot / acqTot : 0
    const bruciata = !a.purchases && cpoAccount > 0 && a.spend >= SPESA_A_VUOTO * cpoAccount
    if (bruciata) {
      f = { key: 'kill', label: 'SPEGNI', cls: 'b-kill',
        perche: `${eur(a.spend)} spesi senza un solo acquisto: ${(a.spend / cpoAccount).toFixed(1)} volte `
          + `il costo di un ordine sull'account (${eur(cpoAccount)}). Non sta iniziando, sta perdendo.` }
    } else if (eta !== null && eta < GIORNI_MINIMI) {
      f = { key:'attesa', label:'IN ATTESA', cls:'b-none' }
    } else if (eta !== null && eta >= GIORNI_MINIMI && a.impressions < IMPR_SERVITA) {
      // Non e' un giudizio di merito ma una diagnosi di consegna: Meta non la
      // sta servendo. Tenerla marcata 'kill' voleva dire farla sparire dietro
      // la regola della spesa minima — che qui non si applica, perche' non si
      // sta dicendo che e' brutta — e perdere l'unica informazione utile.
      f = { key:'nonservita', label:'NON SERVITA', cls:'b-kill',
        perche: `Ha ${eta} giorni e solo ${a.impressions} impression: Meta non la sta servendo. `
          + `Non e' un problema di rendimento, e' un problema di consegna: va sostituita o rilanciata in un altro adset.` }
    } else if (a.impressions < IMPR_GIUDIZIO || a.spend < 10) {
      f = { key:'nodata', label:'POCHI DATI', cls:'b-none' }
    } else if (c.audience_type === 'mixed' && mixDi.get(id)
               && (mixDi.get(id).new.spend + mixDi.get(id).caldo.spend) > 0) {
      // Pubblico misto: si giudica la quota su pubblico nuovo, non il totale.
      f = fasciaMista(mixDi.get(id), roas, soglie.new, soglie.caldi)
    } else {
      f = fascia(roas, s)
    }
    // La mano che trattiene: nessuno spegnimento sotto due volte il costo di
    // un ordine. Sta qui, dopo tutti i rami, cosi' vale per ogni strada che
    // porta a SPEGNI e non solo per quella del rendimento.
    f = trattieni(f, spesaDiSempre.get(id) ?? a.spend, cpoAccount)
    // Dopo la spesa minima: prima si guarda se ha avuto occasioni di fallire,
    // poi se spegnerla toglie copertura al resto del conto.
    f = trattieniApripista(f, copertura.quota.get(id), copertura.quotaNuovoAccount)
    righe.push({
      id, name: c.name, thumb: c.thumb_url || c.storage_url, full: c.storage_url,
      mediaType: c.media_type, videoId: c.video_id,
      audience: c.audience_type, status: c.status,
      // Lo spaccato per pubblico viaggia con la riga, gia' con quota e ROAS
      // calcolati: farlo fare al client vorrebbe dire rifare le stesse
      // divisioni in un altro posto e poterle sbagliare in modo diverso.
      pubblici: (() => {
        const p = segDi.get(id)
        if (!p) return null
        const tot = PUBBLICI.reduce((n, k) => n + p[k].spesa, 0)
        if (!tot) return null
        return Object.fromEntries(PUBBLICI
          .filter(k => p[k].spesa > 0 || p[k].ordini > 0)
          .map(k => [k, {
            spesa: p[k].spesa, ordini: p[k].ordini, valore: p[k].valore,
            roas: p[k].spesa ? p[k].valore / p[k].spesa : 0,
            cpo: p[k].ordini ? p[k].spesa / p[k].ordini : 0,
            quota: p[k].spesa / tot,
          }]))
      })(),
      // Gli assi sulle righe: il motore ragiona per angolo/formato/fase e
      // senza questi campi la tabella non poteva aggregare per la stessa
      // dimensione su cui decide.
      angolo: angoloDi.get(c.angle_id) || null,
      formato: c.format || null, funnel: c.funnel || null, persona: c.persona || null,
      prodotto: prodottoDi.get(c.product_id)?.nome_breve || prodottoDi.get(c.product_id)?.name || null,
      origine: c.origin || null,
      body: c.body, headline: c.headline, description: c.description, cta: c.cta, link_url: c.link_url,
      metaAdId: c.meta_ad_id, adCreatedAt: c.ad_created_at,
      spend: a.spend, impressions: a.impressions, clicks: a.clicks,
      ctr: a.impressions ? (a.clicks/a.impressions)*100 : 0,
      cpm: a.impressions ? (a.spend/a.impressions)*1000 : 0,
      cpc: a.clicks ? a.spend/a.clicks : 0,
      frequency: a.freq, purchases: a.purchases, value: a.value, roas,
      // Hook e hold sono DUE domande diverse: l'attacco ferma lo scroll, e il
      // contenuto tiene chi si è fermato. Un hook alto con hold basso è un
      // video che promette e non mantiene — rifargli l'attacco lo peggiora.
      videoPlays: a.plays,
      // Solo per i video: su un'immagine hook e hold sarebbero sempre zero, e
      // uno zero in colonna si legge come "pessimo" invece che "non pertinente".
      hookRate: (a.views3 && a.impressions) ? (a.views3 / a.impressions) * 100 : null,
      holdRate: a.views3 ? (a.thru / a.views3) * 100 : null,
      completamento: a.views3 ? (a.p100 / a.views3) * 100 : null,
      cpo: a.purchases ? a.spend/a.purchases : 0,
      eta, banda: f.key, bandaLabel: f.label, bandaCls: f.cls,
      // Il perché del verdetto viaggia con la riga: un giudizio che sposta
      // budget senza dire su quale numero si regge non è verificabile.
      soglieUsate: f.base || rif, perche: f.perche || null,
    })
  }
  // Le SPENTE escono dalla vista operativa.
  //
  // Il cliente spegne su Meta le creativita' che il motore gli ha detto di
  // spegnere, e il giorno dopo se le ritrovava ancora in elenco marcate
  // "SPEGNI": una lista di cose da fare che non si svuota mai smette di essere
  // una lista di cose da fare. Restano dentro fino a qui, pero', perche' la
  // loro spesa e i loro ordini fanno parte del costo-ordine dell'account su
  // cui si giudicano tutte le altre — toglierle prima falserebbe le soglie.
  // La loro storia resta intera nelle Analitiche.
  const nascoste = righe.filter(r => r.status === 'spenta').length
  const attive = righe.filter(r => r.status !== 'spenta')
  attive.sort((x,y)=>y.spend-x.spend)

  // --- creatività prodotte da noi -----------------------------------------
  // Le creatività PRODOTTE dal motore, con tutto ciò che serve a caricarle.

  const prodotte = (cre.data || [])
    .filter(c => c.origin !== 'existing')
    .filter(c => !nascosti.has(c.product_id))
    .map(c => ({
      id: c.id, name: c.name, ratio: c.ratio, status: c.status,
      formato: c.format, funnel: c.funnel, persona: c.persona,
      angolo: angoloDi.get(c.angle_id) || null,
      // Il nome breve dettato dal cliente, non il titolo Shopify: nel menu
      // laterale i titoli lunghi si troncavano tutti allo stesso punto e due
      // prodotti diversi sembravano lo stesso.
      prodotto: prodottoDi.get(c.product_id)?.nome_breve || prodottoDi.get(c.product_id)?.name || null,
      prodottoId: c.product_id || null,
      prodottoImg: prodottoDi.get(c.product_id)?.packshot_url || null,
      prodottoLink: prodottoDi.get(c.product_id)?.handle || null,
      headline: c.headline, sub: c.sub, cta: c.cta, primary_text: c.primary_text,
      link_url: c.link_url, palette: c.palette, scena: c.scena_desc,
      briefTipo: c.brief_tipo, briefMotivo: c.brief_motivo,
      creataIl: c.created_at,
      // Il lancio manuale VINCE su uploaded_at: uploaded_at lo scrive il
      // caricamento automatico, che oggi non c'è. Chi ha lanciato lo sa solo
      // chi l'ha fatto a mano.
      lanciataIl: c.flag_lanciata_il || (c.flag_lanciata ? c.created_at : null) || c.uploaded_at,
      lanciata: !!c.flag_lanciata || !!c.uploaded_at,
      giudizio: c.giudizio || null, giudizioIl: c.giudizio_il || null,
      qualita: c.qualita || null, qualitaIl: c.qualita_il || null,
      coppia: c.coppia || null, ordine: c.ordine ?? null,
      nota: c.nota || null,
      anteprima: c.storage_url, file: c.storage_url,
    }))

  return NextResponse.json({
    periodo: per,
    copertura: { quotaNuovoAccount: copertura.quotaNuovoAccount, impressioniNuovo: copertura.impNuovo },
    // Il confronto: gli stessi conti sull'intervallo precedente, lungo uguale.
    // Solo i totali di conto — la variazione per singola creativita' sarebbe
    // rumore su finestre corte.
    confronto: prec ? (() => {
      const s2 = (f) => (precRows || []).reduce((t, k) => t + (+k[f] || 0), 0)
      const sp = s2('spend'), val = s2('purchase_value'), acq = s2('purchases')
      return {
        periodo: prec, spesa: sp, valore: val, acquisti: acq,
        roas: sp ? val / sp : 0, cpo: acq ? sp / acq : 0,
        impressioni: s2('impressions'), click: s2('link_clicks'),
      }
    })() : null,
    cliente: { nome: clienteMotore()?.nome || null, matrice: !!clienteMotore()?.matrice },
    account: {
      spesa: spesaTot, valore: valTot, acquisti: acqTot, roas: roasAcc,
      cpo: acqTot ? spesaTot/acqTot : 0,
      coperturaSegmenti: spesaTot ? segSpendTot/spesaTot : 0,
    },
    segmenti: perSeg, caldi, soglie,
    business: bizAgg,
    righe: attive, spente: nascoste, prodotte,
    // Gli elenchi servono ai selettori: spostare una creatività di angolo o di
    // prodotto richiede sapere quali esistono.
    elenchi: {
      angoli: (angRows || []).map(a => a.slug).filter(Boolean).sort(),
      prodotti: visibili
        .map(p => ({ id: p.id, nome: p.nome_breve || p.name, ricavo: p.revenue_30d || 0 }))
        .sort((a, b) => b.ricavo - a.ricavo),
      nascosti: (prodRows || []).filter(p => p.nascosto)
        .map(p => ({ id: p.id, nome: p.nome_breve || p.name })),
    },
  })
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
