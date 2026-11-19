import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../lib/motore/db'
import { generaBrief } from '../../../../lib/motore/brief'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

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

async function GET__() {
  const ws = wsMotore()
  try {
    const [cre, kpi, ang, prod, brand, temiRows] = await Promise.all([
      tutte(() => db().from('ce_creatives').select('id, angle_id, format, funnel, persona, audience_type').eq('workspace_id', ws)),
      tutte(() => kpiDi('ce_kpi_daily', 'creative_id, spend, purchases, purchase_value')),
      tutte(() => db().from('ce_angles').select('id, slug').eq('workspace_id', ws)),
      tutte(() => db().from('ce_products').select('*').eq('workspace_id', ws)),
      db().from('ce_brand').select('*').eq('workspace_id', ws).maybeSingle(),
      // I temi delle recensioni: senza, questa rotta mostrava un elenco di
      // brief diverso da quello che la generazione avrebbe davvero prodotto.
      tutte(() => db().from('ce_temi').select('*').eq('workspace_id', ws)),
    ])
    const slug = new Map(ang.map(a => [a.id, a.slug]))
    const creativita = cre.map(c => ({ ...c, angolo: slug.get(c.angle_id) || null }))
    const totRec = (temiRows || []).reduce((m, t) => Math.max(m, t.quota ? Math.round(t.n / t.quota) : 0), 0)
    const temi = (temiRows || []).map(t => ({ ...t, totale: totRec }))
    const r = generaBrief({ creativita, kpi, prodotti: prod, brand: brand?.data || null, temi })
    return NextResponse.json(r)
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'brief falliti' }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
