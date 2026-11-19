import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../lib/motore/db'
import { perAsse, derivate, vuoto, accumula, insight, pubbliciPerAsse } from '../../../../lib/motore/analitiche'
import { soglieSegmento, segmentoDiRiferimento, fascia, fasciaMista, trattieni, CALDI } from '../../../../lib/motore/soglie'
import { cadenza } from '../../../../lib/motore/cadenza'
import { effettoSpegnimenti } from '../../../../lib/motore/spegnimenti'
import { dallaRichiesta, giorniDi, precedente } from '../../../../lib/motore/periodo'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

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

async function GET__(req) {
  try {
    const ws = wsMotore()
    const url = new URL(req.url)
    // Il periodo lo risolve lib/periodo, uno solo per tutte le rotte: risolutori
    // separati sono gia' costati un bug in cui "questo mese" mostrava novanta
    // giorni, e un periodo sbagliato non si vede.
    const per = dallaRichiesta(url)
    const giorni = giorniDi(per)
    const da = per.since

    const [cre, kpi, ang, prod, temi] = await Promise.all([
      tutte(() => db().from('ce_creatives').select('*').eq('workspace_id', ws)),
      tutte(() => kpiDi('ce_kpi_daily', '*').gte('day', da).lte('day', per.until)),
      tutte(() => db().from('ce_angles').select('id, slug').eq('workspace_id', ws)),
      tutte(() => db().from('ce_products').select('*').eq('workspace_id', ws)),
      tutte(() => db().from('ce_temi').select('*').eq('workspace_id', ws).order('n', { ascending: false })),
    ])
    const slug = new Map(ang.map(a => [a.id, a.slug]))
    const nomeProd = new Map(prod.map(p => [p.id, p.nome_breve || p.name]))
    const perCreativa = new Map(cre.map(c => [c.id, {
      ...c, angolo: slug.get(c.angle_id) || null, prodotto: nomeProd.get(c.product_id) || null,
    }]))
    // Solo i KPI di creatività che esistono ancora: le righe orfane
    // gonfierebbero i totali senza comparire da nessuna parte.
    const kpiVivi = kpi.filter(k => perCreativa.has(k.creative_id))

    // --- conto dell'account -------------------------------------------------
    const acc = kpiVivi.reduce((a, k) => accumula(a, k), vuoto())
    const account = { ...derivate(acc), cpo: acc.acquisti ? acc.spesa / acc.acquisti : 0, giorni }

    // --- assi ---------------------------------------------------------------
    const angoli   = perAsse(kpiVivi, perCreativa, c => c.angolo)
    const funnel   = perAsse(kpiVivi, perCreativa, c => c.funnel)
    const prodotti = perAsse(kpiVivi, perCreativa, c => c.prodotto)
    const formati  = perAsse(kpiVivi, perCreativa, c => c.format)

    // --- per creatività, con il verdetto ------------------------------------
    const perId = new Map()
    for (const k of kpiVivi) {
      if (!perId.has(k.creative_id)) perId.set(k.creative_id, { ...vuoto(), freq: 0 })
      const a = perId.get(k.creative_id); accumula(a, k)
      a.freq = Math.max(a.freq, +k.frequency || 0)
    }
    // Le soglie per segmento, come nella tab Performance: un ROAS si giudica
    // sul pubblico che ha comprato, non su una soglia unica.
    const seg = await tutte(() => kpiDi('ce_kpi_segment_daily', '*').gte('day', da).lte('day', per.until))
    const perSeg = {}
    for (const s of seg) {
      const p = perSeg[s.segment] || (perSeg[s.segment] = { spesa: 0, valore: 0 })
      p.spesa += +s.spend || 0; p.valore += +s.purchase_value || 0
    }
    for (const k of Object.keys(perSeg)) perSeg[k].roas = perSeg[k].spesa ? perSeg[k].valore / perSeg[k].spesa : 0

    // Lo spaccato per pubblico degli angoli. Si attacca qui e non dentro
    // perAsse perche' le righe dei segmenti si leggono piu' avanti nel file:
    // spostare la lettura solo per fare la fusione un rigo prima non varrebbe
    // il rischio di scomporre l'ordine dei conti.

    const pubbAngoli = pubbliciPerAsse(seg, perCreativa, c => c.angolo)
    for (const a of angoli) a.pubblici = pubbAngoli.get(a.chiave) || null
    const caldi = CALDI.reduce((a, k) => {
      const p = perSeg[k]; if (p) { a.spesa += p.spesa; a.valore += p.valore } return a
    }, { spesa: 0, valore: 0 })
    caldi.roas = caldi.spesa ? caldi.valore / caldi.spesa : 0
    const soglie = {
      new:   soglieSegmento(perSeg.new?.roas, account.roas),
      caldi: soglieSegmento(caldi.roas, account.roas),
    }

    const righe = []
    for (const [id, a] of perId) {
      const c = perCreativa.get(id)
      const d = derivate(a, account.spesa)
      const rif = segmentoDiRiferimento(c.audience_type)
      // Stessa mano che trattiene della board: due schermate che danno
      // verdetti diversi sulla stessa creativita' non se ne fa credere nessuna.
      const f = trattieni(fascia(d.roas, soglie[rif]), d.spesa, account.cpo)
      righe.push({
        id, name: c.name, angolo: c.angolo, formato: c.format, funnel: c.funnel,
        thumb: c.thumb_url || c.storage_url || null, ratio: c.ratio,
        // Il pubblico serve al cervello per applicare la soglia GIUSTA: senza,
        // giudica tutto sulla soglia dei caldi e sbaglia di un punto e mezzo.
        pubblico: c.audience_type || 'sconosciuto', soglieUsate: rif,
        prodotto: c.prodotto, origin: c.origin, giudizio: c.giudizio || null,
        spend: d.spesa, impressions: d.impressioni, clicks: d.click,
        purchases: d.acquisti, value: d.valore,
        roas: d.roas, cpa: d.cpa, ctr: d.ctr, cpc: d.cpc, freq: a.freq,
        bandaLabel: f.label, bandaCls: f.cls,
      })
    }

    // --- ciclo di vita delle creatività -------------------------------------
    const nostre = cre.filter(c => c.origin !== 'existing')
    const inizio = new Date(Date.now() - giorni * 86400000)
    const prodotteNelPeriodo = nostre.filter(c => new Date(c.created_at) >= inizio)
    const ciclo = {
      totali: cre.length,
      prodotte: nostre.length,
      prodotteNelPeriodo: prodotteNelPeriodo.length,
      conFile: nostre.filter(c => c.storage_url).length,
      lanciate: nostre.filter(c => c.flag_lanciata || c.uploaded_at).length,
      daLanciare: nostre.filter(c => !(c.flag_lanciata || c.uploaded_at)).length,
      // Verdetto MANUALE (quello che hai dato tu) e verdetto CALCOLATO dalle
      // performance: sono due cose diverse e tenerle insieme nasconderebbe
      // quante decisioni sono state prese davvero.
      killateAMano: cre.filter(c => c.giudizio === 'kill').length,
      scalateAMano: cre.filter(c => c.giudizio === 'scale').length,
      buoneAMano:   cre.filter(c => c.giudizio === 'good').length,
      senzaVerdetto: cre.filter(c => !c.giudizio).length,
      daSpegnere: righe.filter(r => r.bandaLabel === 'SPEGNI').length,
      daScalare:  righe.filter(r => r.bandaLabel === 'SCALA').length,
    }

    // Soglia di significatività per le classifiche.
    //
    // Senza, "le migliori per ROAS" erano le creatività che avevano speso 4
    // euro: un acquisto su spiccioli dà ROAS 18 e finisce in cima. Una
    // classifica che mette in testa il rumore non è una classifica, è un
    // invito a scalare la cosa sbagliata. Serve almeno l'equivalente di tre
    // ordini di spesa E almeno tre acquisti.
    const spesaMinima = Math.max(30, (account.cpo || 0) * 3)
    const ACQUISTI_MINIMI = 3
    const significative = righe.filter(r => r.spend >= spesaMinima && r.purchases >= ACQUISTI_MINIMI)

    const top = (campo, crescente = false) => [...significative]
      .filter(r => r.spend > 0 && (campo !== 'cpa' || r.purchases > 0))
      .sort((a, b) => crescente ? (a[campo] ?? 1e9) - (b[campo] ?? 1e9) : (b[campo] ?? 0) - (a[campo] ?? 0))
      .slice(0, 10)

    // --- serie giornaliera --------------------------------------------------
    // Due misure diverse non stanno mai sullo stesso grafico con due assi: si
    // restituiscono insieme e si disegnano come due grafici affiancati che
    // condividono l'asse dei giorni.
    const perGiorno = new Map()
    for (const k of kpiVivi) {
      if (!perGiorno.has(k.day)) perGiorno.set(k.day, { giorno: k.day, ...vuoto() })
      accumula(perGiorno.get(k.day), k)
    }
    const serie = [...perGiorno.values()].sort((x, y) => x.giorno < y.giorno ? -1 : 1)
      .map(g => ({
        giorno: g.giorno, spesa: g.spesa, acquisti: g.acquisti, valore: g.valore,
        roas: g.spesa ? g.valore / g.spesa : 0,
        cpa: g.acquisti ? g.spesa / g.acquisti : null,
      }))

    return NextResponse.json({
      ok: true, periodo: { giorni, da, ...per }, account, serie, soglie,
      // Il conto dell'account per pubblico. Serve come metro: un ROAS sul
      // pubblico nuovo va confrontato col nuovo dell'account, non col ROAS
      // complessivo — quello e' gonfiato dal returning e farebbe sembrare
      // sotto media anche gli angoli che acquisiscono meglio di tutti.
      pubblici: perSeg,
      // Cosa ha fatto il conto dopo ogni spegnimento. Si legge su TUTTI i KPI
      // e non sul periodo scelto: uno spegnimento del mese scorso va misurato
      // coi giorni che gli stanno attorno, non con quelli che si sta guardando.
      spegnimenti: effettoSpegnimenti({ creativita: cre, kpi, cpaAccount: account.cpo }),
      // Il calendario dei test: quante creativita' nuove per volta e ogni
      // quanto. Calcolato dal budget recente, non dalla media del periodo:
      // un account in rampa deve testare col ritmo di adesso.
      cadenza: cadenza({
        budgetGiornaliero: serie.slice(-7).reduce((t, g) => t + g.spesa, 0) / Math.max(1, serie.slice(-7).length),
        cpa: account.cpo,
      }),
      angoli, funnel, prodotti, formati, ciclo,
      soglia: { spesaMinima: +spesaMinima.toFixed(2), acquistiMinimi: ACQUISTI_MINIMI, candidate: significative.length, su: righe.length },
      migliori: {
        roas: top('roas'), acquisti: top('purchases'), spesa: top('spend'),
        cpa: top('cpa', true), ctr: top('ctr'), cpc: top('cpc', true), valore: top('value'),
      },
      // I peggiori con spesa vera: servono al cervello per dire cosa spegnere.
      peggiori: [...significative].sort((x, y) => x.roas - y.roas).slice(0, 8),
      temi: temi.map(t => ({ slug: t.slug, n: t.n, quota: t.quota, sentiment: t.sentiment,
        coperto_da: t.coperto_da, citazione: t.citazione })),
      insight: insight({ angoli, funnel, prodotti, ciclo, account, righe }),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
