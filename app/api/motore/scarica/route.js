import { NextResponse } from 'next/server'
import JSZip from 'jszip'
import { db } from '../../../../lib/motore/db'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Nome file pronto per il caricamento su Meta: è la nomenclatura del motore,
// non un uuid. Se il file scaricato non porta con sé l'angolo e il formato,
// la nomenclatura si perde nel momento esatto in cui serve di più.
function nomeFile(c) {
  const est = (c.storage_url.split('?')[0].match(/\.(jpe?g|png|webp|mp4)$/i) || [null, 'jpg'])[1]
  const base = (c.name || c.id).replace(/[^A-Za-z0-9_.-]/g, '_')
  return `${base}.${est.toLowerCase()}`
}

async function scarica(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error(`HTTP ${r.status} su ${url}`)
  return Buffer.from(await r.arrayBuffer())
}

async function righe(ids) {
  const ws = wsMotore()
  if (!ws) throw new Error('CE_WORKSPACE_ID non configurato')
  const { data, error } = await db().from('ce_creatives')
    .select('id, name, ratio, storage_url').eq('workspace_id', ws).in('id', ids)
  if (error) throw new Error(error.message)
  // Una creatività senza file non è un errore fatale: è una riga ancora da
  // comporre. Si scarta e si dice quante ne sono state saltate, invece di far
  // fallire tutto lo zip per una sola mancante.
  return (data || []).filter(c => c.storage_url)
}

// Singola: il browser non può forzare il download di un file cross-origin con
// l'attributo download, quindi il file passa da qui e riceve il Content-Disposition.
async function GET__(req) {
  try {
    const id = new URL(req.url).searchParams.get('id')
    if (!id) return NextResponse.json({ error: 'id mancante' }, { status: 400 })
    const [c] = await righe([id])
    if (!c) return NextResponse.json({ error: 'creatività senza file' }, { status: 404 })
    const buf = await scarica(c.storage_url)
    return new NextResponse(buf, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${nomeFile(c)}"`,
        'Content-Length': String(buf.length),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// In blocco: uno zip solo, con le creatività raggruppate per prodotto.
async function POST__(req) {
  try {
    const { ids } = await req.json()
    if (!Array.isArray(ids) || !ids.length) return NextResponse.json({ error: 'nessun id' }, { status: 400 })
    const rows = await righe(ids)
    if (!rows.length) return NextResponse.json({ error: 'nessuna delle creatività scelte ha un file' }, { status: 404 })

    const zip = new JSZip()
    const visti = new Set()
    // A blocchi: aprire cento richieste in parallelo verso lo storage fa
    // scattare il throttling e torna uno zip pieno di buchi.
    for (let i = 0; i < rows.length; i += 6) {
      const lotto = rows.slice(i, i + 6)
      const buf = await Promise.all(lotto.map(c => scarica(c.storage_url).catch(() => null)))
      lotto.forEach((c, k) => {
        if (!buf[k]) return
        let n = nomeFile(c)
        while (visti.has(n)) n = n.replace(/(\.[^.]+)$/, '_b$1')   // nomi duplicati: mai sovrascrivere
        visti.add(n)
        zip.file(n, buf[k])
      })
    }

    const out = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE', compressionOptions: { level: 3 } })
    const data = new Date().toISOString().slice(0, 10)
    return new NextResponse(out, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="creativita_${data}_${visti.size}.zip"`,
        'Content-Length': String(out.length),
        'X-Scaricate': String(visti.size),
        'X-Saltate': String(ids.length - visti.size),
      },
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
export const POST = conMotore(POST__)
