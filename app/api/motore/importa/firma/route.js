import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { nomina, siglaProdotto } from '../../../../../lib/motore/brief'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// La sigla del prodotto e' UNA parola: la stessa di lib/brief, perche' due
// versioni diverse rimettevano i trattini a ogni spostamento.
const sigla = (b) => siglaProdotto({ nome_breve: b })

// Prepara i permessi di caricamento, uno per file.
//
// I file NON passano dal server: Vercel accetta al massimo 4,5 MB per
// richiesta e quattro creatività ne pesano otto, quindi il caricamento moriva
// con un 413 travestito da errore JSON. Il browser carica direttamente sullo
// storage con un permesso a tempo, e al server resta solo da registrare le
// righe — che è anche più veloce, perché i byte fanno un salto in meno.
async function POST__(req) {
  try {
    const ws = wsMotore()
    const { file, prodottoId, prodottoNuovo, prodottoHandle, angolo, angoloNuovo } = await req.json().catch(() => ({}))
    if (!Array.isArray(file) || !file.length) return NextResponse.json({ error: 'nessun file' }, { status: 400 })

    // --- prodotto ------------------------------------------------------------
    let prodotto = null
    if (prodottoId) {
      const { data } = await db().from('ce_products')
        .select('id, name, nome_breve, handle').eq('workspace_id', ws).eq('id', prodottoId).maybeSingle()
      prodotto = data
    } else if (prodottoNuovo?.trim()) {
      const { data, error } = await db().from('ce_products').upsert({
        workspace_id: ws, name: prodottoNuovo.trim(), nome_breve: prodottoNuovo.trim(),
        slug: sigla(prodottoNuovo), handle: prodottoHandle?.trim() || null,
      }, { onConflict: 'workspace_id,slug' }).select('id, name, nome_breve, handle').maybeSingle()
      if (error) throw new Error(`prodotto: ${error.message}`)
      prodotto = data
    }
    if (!prodotto) return NextResponse.json({ error: 'serve un prodotto: scegline uno o creane uno nuovo' }, { status: 400 })

    // --- angolo --------------------------------------------------------------
    const raw = (angolo || angoloNuovo || '').trim()
    if (!raw) return NextResponse.json({ error: 'serve un angolo: scegline uno o creane uno nuovo' }, { status: 400 })
    const slugAng = sigla(raw)
    let angleId
    const { data: a } = await db().from('ce_angles')
      .select('id').eq('workspace_id', ws).eq('slug', slugAng).maybeSingle()
    if (a?.id) angleId = a.id
    else {
      const { data: ins, error } = await db().from('ce_angles')
        .upsert({ workspace_id: ws, name: slugAng, slug: slugAng, source: 'manuale' },
                { onConflict: 'workspace_id,slug' }).select('id').maybeSingle()
      if (error) throw new Error(`angolo: ${error.message}`)
      angleId = ins?.id
    }

    const { data: giaCi } = await db().from('ce_creatives').select('name').eq('workspace_id', ws)
    const esistenti = new Set((giaCi || []).map(c => c.name))
    const breve = prodotto.nome_breve || prodotto.name

    const permessi = []
    for (let i = 0; i < file.length; i++) {
      const f = file[i]
      // Il rapporto lo misura il BROWSER sul file vero: il server non vede più
      // i byte, e chiederlo a chi carica darebbe metà creatività col formato
      // sbagliato quando nella selezione ci sono quadrate e verticali.
      const ratio = (f.altezza / Math.max(1, f.larghezza)) > 1.2 ? '9x16' : '1x1'
      let n = i + 1
      let nome = nomina({ cliente: 'SAR', prodotto: sigla(breve), angolo: slugAng, ratio, versione: n })
      while (esistenti.has(nome)) { n++; nome = nome.replace(/_V\d+$/, `_V${n}`) }
      esistenti.add(nome)
      const percorso = `${ws}/importate/${nome}.png`
      const { data: firma, error } = await db().storage.from('creativita').createSignedUploadUrl(percorso, { upsert: true })
      if (error) throw new Error(`firma: ${error.message}`)
      permessi.push({ nome, ratio, percorso, url: firma.signedUrl, token: firma.token })
    }

    return NextResponse.json({
      ok: true, permessi,
      prodotto: { id: prodotto.id, nome: breve, handle: prodotto.handle || null },
      angolo: slugAng, angleId,
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
