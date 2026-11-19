import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../lib/motore/db'
import { dallaRichiesta, giorniDi } from '../../../../lib/motore/periodo'
import { ASSI, PUBBLICI, incrocio, frase } from '../../../../lib/motore/incrocio'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

// ============================================================================
//  La griglia: due assi a scelta (angolo, formato, persona, fase, prodotto),
//  letta su UN pubblico alla volta, con le creativita' dietro ogni cella.
//
//  ?righe=angolo&colonne=formato&pubblico=tutti|new|engaged|returning
//  + il periodo come tutte le altre rotte (lib/periodo).
//
//  Tutte le divisioni si fanno qui: rifarle nel client vorrebbe dire poterle
//  sbagliare in modo diverso. Le regole stanno in lib/incrocio.js.
// ============================================================================

export const dynamic = 'force-dynamic'
export const maxDuration = 60

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

const KPI = 'creative_id, spend, impressions, link_clicks, purchases, purchase_value'

async function GET__(req) {
  try {
    const ws = wsMotore()
    const url = new URL(req.url)
    const per = dallaRichiesta(url)
    const q = url.searchParams
    let righe = ASSI[q.get('righe')] ? q.get('righe') : 'angolo'
    let colonne = ASSI[q.get('colonne')] ? q.get('colonne') : 'formato'
    // Lo stesso asse su entrambi i lati non e' una griglia: si ripiega sulla
    // coppia classica invece di rispondere con una diagonale.
    if (righe === colonne) colonne = righe === 'formato' ? 'angolo' : 'formato'
    const pubblico = PUBBLICI.includes(q.get('pubblico')) ? q.get('pubblico') : 'tutti'

    const [cre, kpi, ang, prod, azienda] = await Promise.all([
      tutte(() => db().from('ce_creatives')
        .select('id, name, status, format, funnel, persona, angle_id, product_id, meta_ad_id')
        .eq('workspace_id', ws)),
      // "Tutti" legge la tabella giornaliera intera; un pubblico legge SOLO le
      // sue righe, cosi' anche il metro (CPA del conto) e' quello del pubblico.
      pubblico === 'tutti'
        ? tutte(() => kpiDi('ce_kpi_daily', KPI).gte('day', per.since).lte('day', per.until))
        : tutte(() => kpiDi('ce_kpi_segment_daily', KPI).eq('segment', pubblico).gte('day', per.since).lte('day', per.until)),
      tutte(() => db().from('ce_angles').select('id, slug').eq('workspace_id', ws)),
      tutte(() => db().from('ce_products').select('*').eq('workspace_id', ws)),
      db().from('companies').select('meta_account_id').eq('user_id', ws).maybeSingle()
        .then(r => r.data || null, () => null),
    ])
    const slug = new Map(ang.map(a => [a.id, a.slug]))
    const nomeProd = new Map(prod.map(p => [p.id, p.nome_breve || p.name]))
    const perCreativa = new Map(cre.map(c => [c.id, {
      ...c, angolo: slug.get(c.angle_id) || null, prodotto: nomeProd.get(c.product_id) || null,
    }]))
    // Solo i KPI di creativita' che esistono ancora: le righe orfane
    // gonfierebbero i totali senza comparire da nessuna parte.
    const kpiVivi = kpi.filter(k => perCreativa.has(k.creative_id))

    // Il metro: il conto del conto SU QUESTO PUBBLICO. Il ROAS sul nuovo va
    // confrontato col ROAS dell'account sul nuovo, non col complessivo gonfiato
    // dal returning: col metro sbagliato l'acquisizione esce tutta rossa.
    const acc = { spesa: 0, ordini: 0, valore: 0, impressioni: 0, click: 0 }
    const perId = new Map()
    for (const k of kpiVivi) {
      const v = perId.get(k.creative_id) || { spesa: 0, ordini: 0, valore: 0 }
      v.spesa += +k.spend || 0; v.ordini += +k.purchases || 0; v.valore += +k.purchase_value || 0
      perId.set(k.creative_id, v)
      acc.spesa += +k.spend || 0; acc.ordini += +k.purchases || 0; acc.valore += +k.purchase_value || 0
      acc.impressioni += +k.impressions || 0; acc.click += +k.link_clicks || 0
    }
    const rif = { ...acc, cpa: acc.ordini ? acc.spesa / acc.ordini : 0, roas: acc.spesa ? acc.valore / acc.spesa : 0 }

    const g = incrocio({ kpi: kpiVivi, perCreativa, righe, colonne, rif })
    // La frase in cima chiude sempre con i formati: se la coppia scelta e' gia'
    // angolo x formato non c'e' niente da aggiungere.
    const eFormati = (righe === 'angolo' && colonne === 'formato') || (righe === 'formato' && colonne === 'angolo')
    const gFormati = eFormati ? null : incrocio({ kpi: kpiVivi, perCreativa, righe: 'angolo', colonne: 'formato', rif })

    // Le creativita' dietro le celle, col loro conto sul pubblico scelto.
    const creativita = {}
    for (const r of Object.values(g.celle)) for (const x of Object.values(r)) for (const id of x.creativita) {
      if (creativita[id]) continue
      const c = perCreativa.get(id), v = perId.get(id) || { spesa: 0, ordini: 0, valore: 0 }
      creativita[id] = {
        nome: c.name, stato: c.status, adId: c.meta_ad_id || null,
        angolo: c.angolo, formato: c.format, persona: c.persona, funnel: c.funnel, prodotto: c.prodotto,
        spesa: v.spesa, ordini: v.ordini, valore: v.valore,
        roas: v.spesa ? v.valore / v.spesa : 0, cpa: v.ordini ? v.spesa / v.ordini : null,
      }
    }

    const distinti = (di) => new Set([...perCreativa.values()].map(di).filter(Boolean)).size
    const actId = String(azienda?.meta_account_id || process.env.META_AD_ACCOUNT_ID || '')
      .split(',')[0].trim().replace(/^act_/, '') || null

    return NextResponse.json({
      periodo: { ...per, giorni: giorniDi(per) },
      pubblico,
      griglia: g,
      frase: frase(g, gFormati),
      creativita,
      conto: {
        creativita: cre.length, spesa: rif.spesa, ordini: rif.ordini,
        assi: { persone: distinti(ASSI.persona.di), angoli: distinti(ASSI.angolo.di), formati: distinti(ASSI.formato.di) },
      },
      account: { actId },
    })
  } catch (e) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
