import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 120

// Legare fra loro le due versioni della stessa creatività, 1:1 e 9:16.
//
// Dentro un angolo le creatività escono ordinate per nome, e i due formati
// della stessa idea finiscono lontani quando i nomi non combaciano — importate
// da cartelle diverse, rinominate, spostate. Confrontarli diventa impossibile,
// ed è il confronto che serve per decidere quale formato tenere.
//
// Il legame sta su un campo `coppia` condiviso e non su un ordinamento: un
// ordine si rompe al primo inserimento, un legame no.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const body = await req.json().catch(() => ({}))

    // --- accoppiamento automatico per nome ---------------------------------
    // I nomi generati differiscono solo per il ratio: SAR_..._1x1_V1 e
    // SAR_..._9x16_V1. Dove combaciano, l'accoppiamento è certo e non serve
    // farlo a mano.
    if (body.auto) {
      const { data, error } = await db().from('ce_creatives')
        .select('id, name, ratio, coppia').eq('workspace_id', ws).neq('origin', 'existing')
      if (error) throw new Error(error.message)
      const per = {}
      for (const c of data) {
        const base = c.name.replace(/_(1x1|9x16)_/, '_@_')
        ;(per[base] = per[base] || []).push(c)
      }
      let fatte = 0
      for (const [base, righe] of Object.entries(per)) {
        if (righe.length !== 2) continue
        const r = righe.map(x => x.ratio).sort().join('+')
        if (r !== '1x1+9x16') continue
        if (righe.every(x => x.coppia === base)) continue
        for (const x of righe) await db().from('ce_creatives').update({ coppia: base }).eq('id', x.id).eq('workspace_id', wsMotore())
        fatte++
      }
      const spaiate = Object.values(per).filter(v => v.length === 1).length
      return NextResponse.json({ ok: true, coppie: fatte, spaiate,
        nota: spaiate ? `${spaiate} restano spaiate: i nomi non combaciano, vanno accoppiate a mano.` : undefined })
    }

    // --- accoppiamento manuale fra due creatività ---------------------------
    if (body.a && body.b) {
      const { data, error } = await db().from('ce_creatives')
        .select('id, name, ratio').eq('workspace_id', ws).in('id', [body.a, body.b])
      if (error) throw new Error(error.message)
      if (data.length !== 2) return NextResponse.json({ error: 'creatività non trovate' }, { status: 404 })
      const [x, y] = data
      // Due formati UGUALI non sono una coppia: sarebbe come dire che la stessa
      // creatività esiste due volte in verticale.
      if (x.ratio === y.ratio) {
        return NextResponse.json({
          error: `sono entrambe ${x.ratio}: una coppia è un 1:1 con un 9:16`,
        }, { status: 400 })
      }
      const chiave = `manuale:${[x.id, y.id].sort().join('~')}`
      for (const c of data) await db().from('ce_creatives').update({ coppia: chiave }).eq('id', c.id).eq('workspace_id', wsMotore())
      return NextResponse.json({ ok: true, coppie: 1, chiave })
    }

    // --- sciogliere ---------------------------------------------------------
    if (Array.isArray(body.scoppia) && body.scoppia.length) {
      const { data } = await db().from('ce_creatives')
        .select('coppia').eq('workspace_id', ws).in('id', body.scoppia)
      const chiavi = [...new Set((data || []).map(c => c.coppia).filter(Boolean))]
      if (!chiavi.length) return NextResponse.json({ ok: true, sciolte: 0 })
      // Si scioglie l'INTERA coppia, non solo la scheda su cui si è cliccato:
      // lasciarne una legata a una chiave che non lega più niente è uno stato
      // che nessuno saprebbe leggere.
      const { data: tolte } = await db().from('ce_creatives')
        .update({ coppia: null }).eq('workspace_id', ws).in('coppia', chiavi).select('id')
      return NextResponse.json({ ok: true, sciolte: tolte?.length || 0 })
    }

    return NextResponse.json({ error: 'serve auto, oppure a+b, oppure scoppia' }, { status: 400 })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
