import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// La sigla del prodotto e' UNA parola: la stessa di lib/brief, perche' due
// versioni diverse rimettevano i trattini a ogni spostamento.
const sigla = (b) => siglaProdotto({ nome_breve: b })

// Importa creatività caricate a mano dalla board.
//
// Angolo e prodotto si scelgono al momento del caricamento, e se non esistono
// si creano: sono i due campi senza i quali una creatività entra nella board e
// non serve a niente — non si può aggregare per asse, non si può allocare
// produzione, e il classificatore proverebbe a indovinarli sbagliando.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const form = await req.formData()
    const file = form.getAll('file')
    if (!file.length) return NextResponse.json({ error: 'nessun file' }, { status: 400 })

    // --- prodotto: esistente o nuovo ---------------------------------------
    let prodotto = null
    const prodottoId = form.get('prodottoId')
    const prodottoNuovo = (form.get('prodottoNuovo') || '').toString().trim()
    if (prodottoId) {
      const { data } = await db().from('ce_products')
        .select('id, name, nome_breve, handle').eq('workspace_id', ws).eq('id', prodottoId).maybeSingle()
      prodotto = data
    } else if (prodottoNuovo) {
      const handle = (form.get('prodottoHandle') || '').toString().trim() || null
      const { data, error } = await db().from('ce_products').upsert({
        workspace_id: ws, name: prodottoNuovo, nome_breve: prodottoNuovo,
        slug: sigla(prodottoNuovo), handle,
      }, { onConflict: 'workspace_id,slug' }).select('id, name, nome_breve, handle').maybeSingle()
      if (error) throw new Error(`prodotto: ${error.message}`)
      prodotto = data
    }
    if (!prodotto) return NextResponse.json({ error: 'serve un prodotto: scegline uno o creane uno nuovo' }, { status: 400 })

    // --- angolo: esistente o nuovo -----------------------------------------
    const angoloRaw = ((form.get('angolo') || form.get('angoloNuovo') || '').toString()).trim()
    if (!angoloRaw) return NextResponse.json({ error: 'serve un angolo: scegline uno o creane uno nuovo' }, { status: 400 })
    const angolo = sigla(angoloRaw)
    let angleId
    const { data: a } = await db().from('ce_angles')
      .select('id').eq('workspace_id', ws).eq('slug', angolo).maybeSingle()
    if (a?.id) angleId = a.id
    else {
      const { data: ins, error } = await db().from('ce_angles')
        .upsert({ workspace_id: ws, name: angolo, slug: angolo, source: 'manuale' },
                { onConflict: 'workspace_id,slug' }).select('id').maybeSingle()
      if (error) throw new Error(`angolo: ${error.message}`)
      angleId = ins?.id
    }

    const funnel = (form.get('funnel') || '').toString().trim().toUpperCase() || null
    const { data: giaCi } = await db().from('ce_creatives').select('name').eq('workspace_id', ws)
    const esistenti = new Set((giaCi || []).map(c => c.name))

    const caricate = [], errori = []
    let n = 0
    for (const f of file) {
      n++
      try {
        const buf = Buffer.from(await f.arrayBuffer())
        // Il rapporto si legge dal file, non si chiede: nella stessa selezione
        // convivono quadrate e verticali, e farlo scegliere a mano una volta
        // sola produrrebbe metà creatività col formato sbagliato.
        const dim = misuraPng(buf) || misuraJpeg(buf)
        const ratio = dim && (dim.h / dim.w) > 1.2 ? '9x16' : '1x1'
        const breve = prodotto.nome_breve || prodotto.name
        let nome = nomina({ cliente: 'SAR', prodotto: sigla(breve), angolo, ratio, versione: n })
        let k = n
        while (esistenti.has(nome)) { k++; nome = nome.replace(/_V\d+$/, `_V${k}`) }
        const percorso = `${ws}/importate/${nome}.png`
        const { error: eUp } = await db().storage.from('creativita')
          .upload(percorso, buf, { contentType: f.type || 'image/png', upsert: true })
        if (eUp) throw new Error(`storage: ${eUp.message}`)
        const { data: pub } = db().storage.from('creativita').getPublicUrl(percorso)
        const { error: eIns } = await db().from('ce_creatives').insert({
          workspace_id: ws, product_id: prodotto.id, angle_id: angleId,
          name: nome, ratio, funnel, origin: 'manuale', status: 'draft', media_type: 'image',
          link_url: prodotto.handle && clienteMotore()?.sito ? `${clienteMotore().sito}/products/${prodotto.handle}` : null,
          link_handle: prodotto.handle || null, link_tipo: prodotto.handle ? 'prodotto' : null,
          storage_url: pub?.publicUrl || null, thumb_url: pub?.publicUrl || null,
          // Angolo e prodotto li ha detti una persona: il classificatore non
          // deve ripensarci sopra.
          classified_at: new Date().toISOString(), classify_base: 'manuale',
          brief_tipo: 'importata', brief_motivo: 'Caricata a mano dalla board.',
        })
        if (eIns) throw new Error(eIns.message)
        esistenti.add(nome); caricate.push(nome)
      } catch (e) { errori.push(`${f.name}: ${String(e.message).slice(0, 90)}`) }
    }

    const ok = caricate.length > 0
    return NextResponse.json({
      ok, caricate: caricate.length, nomi: caricate, errori,
      prodotto: prodotto.nome_breve || prodotto.name, angolo,
      ...(ok ? {} : { error: 'nessun file caricato' }),
    }, { status: ok ? 200 : 207 })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Dimensioni senza dipendenze: bastano i primi byte dell'intestazione.
function misuraPng(b) {
  if (b.length < 24 || b.readUInt32BE(0) !== 0x89504e47) return null
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}
function misuraJpeg(b) {
  if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return null
  let i = 2
  while (i < b.length - 9) {
    if (b[i] !== 0xff) { i++; continue }
    const m = b[i + 1]
    if (m >= 0xc0 && m <= 0xcf && m !== 0xc4 && m !== 0xc8 && m !== 0xcc) {
      return { h: b.readUInt16BE(i + 5), w: b.readUInt16BE(i + 7) }
    }
    i += 2 + b.readUInt16BE(i + 2)
  }
  return null
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
