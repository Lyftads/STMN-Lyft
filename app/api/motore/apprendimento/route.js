import { NextResponse } from 'next/server'
import { db } from '../../../../lib/motore/db'
import { analizza, riepilogo, daEvitare, GIUDIZI_MINIMI, leggiGiudizi } from '../../../../lib/motore/apprendimento'
import { leggiCalibrazione } from '../../../../lib/motore/calibrazione'
import { conMotore, wsMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'

// Cosa ha imparato il motore dai giudizi di qualità. Esiste per poterlo
// contestare: se pesa verso l'ambiente sbagliato, lo si vede qui e si può
// cambiare idea, invece di scoprirlo fra venti creatività storte.
async function GET__() {
  try {
    const ws = wsMotore()
    const { righe, conMotivo } = await leggiGiudizi(db, ws)
    const analisi = analizza(righe)
    return NextResponse.json({
      ok: true, giudiziMinimi: GIUDIZI_MINIMI,
      // Dichiarato: se la colonna del motivo non c'e' ancora, le bocciature per
      // difetto del prodotto stanno ancora pesando sugli assi della scena.
      motivoDisponibile: conMotivo,
      scartatiPerProdotto: righe.filter(r => r.qualita_motivo === 'prodotto').length,
      ...riepilogo(analisi), daEvitare: daEvitare(analisi),
      // Il giudice della copy messo a confronto col rendimento vero. Se la
      // lettura fallisce si dichiara, non si nasconde il resto della pagina.
      calibrazione: await leggiCalibrazione(db, ws).catch(e => ({ disponibile: false, nota: String(e.message || e) })),
    })
  } catch (e) {
    return NextResponse.json({ error: String(e.message || e) }, { status: 500 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
