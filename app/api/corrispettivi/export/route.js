export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'
export const maxDuration = 60

import { NextResponse } from 'next/server'
import ExcelJS from 'exceljs'
import { withTenantContext } from '../../../../lib/tenant/credentials'
import { calcolaRegistro } from '../../../../lib/fiscal/registro'

// ============================================================================
//  Export XLSX del registro corrispettivi, per il commercialista.
//
//  Stesso calcolo della pagina (lib/fiscal/registro.js): il file non deve
//  poter dire numeri diversi da quelli visti a schermo.
//
//  Il foglio DA VERIFICARE esiste apposta: le righe senza paese non vengono
//  nascoste ne' infilate in Italia per far quadrare il totale. Chi prepara la
//  dichiarazione deve vederle e decidere.
//
//  GET ?mese=YYYY-MM  →  corrispettivi-shopify-YYYY-MM.xlsx
// ============================================================================

const EURO = '#,##0.00'
const ETICHETTA = {
  ITALIA: 'Corrispettivi Italia',
  OSS: 'IVA OSS',
  EXTRA_UE: 'Extra-UE',
  SENZA_PAESE: 'Da verificare',
}

function intesta(foglio, colonne) {
  foglio.columns = colonne
  const riga = foglio.getRow(1)
  riga.font = { bold: true, size: 10 }
  riga.alignment = { vertical: 'middle' }
  riga.height = 20
  riga.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEDEDF0' } }
    c.border = { bottom: { style: 'thin', color: { argb: 'FFBFBFC6' } } }
  })
  foglio.views = [{ state: 'frozen', ySplit: 1 }]
}

function totali(foglio, etichetta, valori) {
  const riga = foglio.addRow(valori)
  riga.font = { bold: true }
  riga.eachCell(c => {
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF5F5F7' } }
    c.border = { top: { style: 'thin', color: { argb: 'FF9999A2' } } }
  })
  return riga
}

export async function GET(req) {
  return withTenantContext(req, async () => {
    const mese = new URL(req.url).searchParams.get('mese') || ''
    let dati
    try { dati = await calcolaRegistro(mese) } catch (e) {
      return NextResponse.json({ ok: false, error: e?.message || 'Errore' }, { status: 200 })
    }

    const wb = new ExcelJS.Workbook()
    wb.creator = 'LyftAI'
    wb.created = new Date()

    // ── LEGENDA ────────────────────────────────────────────────────────────
    const legenda = wb.addWorksheet('LEGENDA')
    legenda.columns = [{ width: 26 }, { width: 110 }]
    const voci = [
      ['Registro corrispettivi', `Periodo ${dati.periodo.mese} (${dati.periodo.since} → ${dati.periodo.until})`],
      ['Fonte', 'Shopify Analytics (ShopifyQL), dataset vendite, per giorno e paese di spedizione'],
      ['Canali inclusi', 'Tutti i canali di vendita, marketplace compresi'],
      ['Paese fiscale', 'Paese di spedizione; dove manca si usa quello di fatturazione, dato che diversi clienti inseriscono li i dati di spedizione'],
      ['Imponibile e IVA', 'Scorporati dal lordo con l\'aliquota ordinaria del paese in vigore quel giorno'],
      ['Differenza con Shopify', 'L\'IVA qui è quella del regime applicabile, non quella registrata da Shopify'],
      ['Italia', 'Vendite domestiche, aliquota ordinaria italiana'],
      ['IVA OSS', 'Paesi UE non italiani, aliquota del paese di destinazione'],
      ['Extra-UE', 'Fuori Unione Europea: IVA 0%'],
      ['Da verificare', 'Nessuno dei due paesi presente: la riga non viene attribuita a un regime'],
      ['Limite noto', 'Aliquote ridotte e territori speciali (Livigno, Campione, Canarie) non sono distinguibili dal solo paese'],
      ['Gift card', dati.rettificaValida
        ? 'Incluse: tassate all\'emissione, neutralizzate al riscatto. Dettaglio nel foglio GIFT CARD'
        : 'NON incluse: manca il permesso per leggere i riscatti, sommare le emissioni tasserebbe due volte'],
      ['Corrispettivo fiscale', 'Vendite da report + emissioni gift card - riscatti neutralizzati + riaccrediti'],
      ['Vendite da report', 'Shopify Analytics ESCLUDE le emissioni gift card dal totale vendite: per questo vengono riaggiunte'],
      ['Mese chiuso', dati.periodo.completo ? 'Sì' : 'NO — mese ancora in corso, il registro cambierà'],
      ['Quadratura', `${dati.quadratura.nettoOk && dati.quadratura.totaleOk ? 'Superata' : 'NON superata: registro non consegnabile'}`],
      ['Generato il', new Date().toLocaleString('it-IT')],
    ]
    intesta(legenda, [{ header: 'Voce', key: 'v', width: 26 }, { header: 'Contenuto', key: 'c', width: 110 }])
    voci.forEach(([v, c]) => legenda.addRow({ v, c }))
    legenda.getColumn(1).font = { bold: true, size: 10 }

    // ── RIEPILOGO ──────────────────────────────────────────────────────────
    const riep = wb.addWorksheet('RIEPILOGO')
    intesta(riep, [
      { header: 'Regime fiscale', key: 'regime', width: 22 },
      { header: 'Paesi', key: 'paesi', width: 8 },
      { header: 'Ordini', key: 'ordini', width: 10 },
      { header: 'Vendite da report', key: 'lordo', width: 17, style: { numFmt: EURO } },
      { header: 'Rettifica gift card', key: 'gift', width: 17, style: { numFmt: EURO } },
      { header: 'Corrispettivo', key: 'corrispettivo', width: 16, style: { numFmt: EURO } },
      { header: 'Imponibile', key: 'imponibile', width: 15, style: { numFmt: EURO } },
      { header: 'IVA', key: 'iva', width: 14, style: { numFmt: EURO } },
    ])
    // Quando la rettifica gift card e' calcolabile il riepilogo espone i
    // totali FISCALI per regime: sono quelli che il commercialista usa.
    const regimi = (dati.rettificaValida && dati.perPerimetroFiscale) ? dati.perPerimetroFiscale : dati.perPerimetro
    for (const p of regimi) {
      riep.addRow({
        regime: ETICHETTA[p.perimetro] || p.perimetro,
        paesi: p.paesi, ordini: p.ordini, lordo: p.lordo,
        gift: p.rettificaGift || null,
        corrispettivo: p.corrispettivo != null ? p.corrispettivo : p.lordo,
        imponibile: p.perimetro === 'SENZA_PAESE' ? null : (p.imponibileFiscale != null ? p.imponibileFiscale : p.imponibile),
        iva: p.perimetro === 'SENZA_PAESE' ? null : (p.ivaFiscale != null ? p.ivaFiscale : p.iva),
      })
    }
    totali(riep, 'TOTALE', {
      regime: 'TOTALE', paesi: dati.perPaese.length, ordini: dati.totali.ordini,
      lordo: dati.totali.lordo,
      gift: dati.rettificaValida ? dati.gift.rettifica : null,
      corrispettivo: dati.corrispettivoFiscale,
      imponibile: dati.totali.imponibile, iva: dati.totali.iva,
    })
    riep.addRow({})
    riep.addRow({ regime: 'Per paese' }).font = { bold: true }
    const intestaPaese = riep.addRow({ regime: 'Paese', paesi: 'Regime', ordini: 'Ordini', lordo: 'Lordo', imponibile: 'Imponibile', iva: 'IVA' })
    intestaPaese.font = { bold: true, size: 10 }
    for (const p of dati.perPaese) {
      riep.addRow({
        regime: p.paese, paesi: ETICHETTA[p.perimetro] || p.perimetro, ordini: p.ordini,
        lordo: p.lordo, imponibile: p.perimetro === 'SENZA_PAESE' ? null : p.imponibile,
        iva: p.perimetro === 'SENZA_PAESE' ? null : p.iva,
      })
    }

    // ── DETTAGLIO ──────────────────────────────────────────────────────────
    const colonneDettaglio = [
      { header: 'Giorno', key: 'giorno', width: 12 },
      { header: 'Regime', key: 'regime', width: 20 },
      { header: 'Paese', key: 'paese', width: 22 },
      { header: 'ISO', key: 'iso', width: 7 },
      { header: 'Aliquota %', key: 'aliquota', width: 11 },
      { header: 'Ordini', key: 'ordini', width: 9 },
      { header: 'Vendite lorde', key: 'vendite', width: 15, style: { numFmt: EURO } },
      { header: 'Sconti', key: 'sconti', width: 13, style: { numFmt: EURO } },
      { header: 'Resi', key: 'resi', width: 13, style: { numFmt: EURO } },
      { header: 'Spedizioni', key: 'spedizioni', width: 13, style: { numFmt: EURO } },
      { header: 'Comm. reso', key: 'commissioniReso', width: 12, style: { numFmt: EURO } },
      { header: 'Lordo fiscale', key: 'lordo', width: 15, style: { numFmt: EURO } },
      { header: 'Imponibile', key: 'imponibile', width: 15, style: { numFmt: EURO } },
      { header: 'IVA', key: 'iva', width: 14, style: { numFmt: EURO } },
    ]
    const det = wb.addWorksheet('DETTAGLIO')
    intesta(det, colonneDettaglio)
    const righeOrdinate = [...dati.righe].sort((a, b) => a.giorno.localeCompare(b.giorno) || (b.lordo - a.lordo))
    for (const r of righeOrdinate) {
      det.addRow({ ...r, regime: ETICHETTA[r.perimetro] || r.perimetro, iso: r.iso || '' })
    }
    det.autoFilter = { from: 'A1', to: { row: 1, column: colonneDettaglio.length } }

    // ── Fogli per regime ───────────────────────────────────────────────────
    const perRegime = (nome, id) => {
      const righe = dati.righe.filter(r => r.perimetro === id)
      const f = wb.addWorksheet(nome)
      intesta(f, colonneDettaglio)
      for (const r of righe.sort((a, b) => a.giorno.localeCompare(b.giorno))) {
        f.addRow({ ...r, regime: ETICHETTA[r.perimetro] || r.perimetro, iso: r.iso || '' })
      }
      const s = righe.reduce((a, r) => ({
        ordini: a.ordini + r.ordini, lordo: a.lordo + r.lordo,
        imponibile: a.imponibile + (r.imponibile || 0), iva: a.iva + (r.iva || 0),
      }), { ordini: 0, lordo: 0, imponibile: 0, iva: 0 })
      totali(f, 'TOTALE', {
        giorno: 'TOTALE', ordini: s.ordini,
        lordo: Math.round(s.lordo * 100) / 100,
        imponibile: id === 'SENZA_PAESE' ? null : Math.round(s.imponibile * 100) / 100,
        iva: id === 'SENZA_PAESE' ? null : Math.round(s.iva * 100) / 100,
      })
      return f
    }
    perRegime('CORRISPETTIVI IT', 'ITALIA')
    perRegime('IVA OSS', 'OSS')
    perRegime('EXTRA-UE', 'EXTRA_UE')
    const daVerificare = perRegime('DA VERIFICARE', 'SENZA_PAESE')
    daVerificare.getRow(1).eachCell(c => {
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE8CC' } }
    })

    // ── GIFT CARD ──────────────────────────────────────────────────────────
    // Foglio separato perche' sono l'unica voce che NON viene dal report
    // vendite: Shopify esclude le emissioni dal totale, e senza questo foglio
    // il commercialista non potrebbe ricostruire da dove nasce la differenza.
    if (dati.gift?.leggibili) {
      const gc = wb.addWorksheet('GIFT CARD')
      intesta(gc, [
        { header: 'Giorno', key: 'giorno', width: 12 },
        { header: 'Movimento', key: 'tipo', width: 14 },
        { header: 'Ordine', key: 'ordine', width: 14 },
        { header: 'Paese', key: 'paese', width: 18 },
        { header: 'Regime', key: 'regime', width: 20 },
        { header: 'Aliquota %', key: 'aliquota', width: 11 },
        { header: 'Importo', key: 'importo', width: 14, style: { numFmt: EURO } },
        { header: 'Effetto sul corrispettivo', key: 'effetto', width: 22, style: { numFmt: EURO } },
        { header: 'Imponibile', key: 'imponibile', width: 14, style: { numFmt: EURO } },
        { header: 'IVA', key: 'iva', width: 13, style: { numFmt: EURO } },
      ])
      const NOME = { emissione: 'Emissione', riscatto: 'Riscatto (neutralizzato)', accredito: 'Riaccredito' }
      for (const m of (dati.gift.movimenti || [])) {
        gc.addRow({
          giorno: m.giorno, tipo: NOME[m.tipo] || m.tipo, ordine: m.ordine || '',
          paese: m.paese || 'non attribuito', regime: ETICHETTA[m.perimetro] || m.perimetro,
          aliquota: m.aliquota, importo: m.importo, effetto: m.effetto,
          imponibile: m.imponibile, iva: m.iva,
        })
      }
      totali(gc, 'TOTALE', {
        giorno: 'TOTALE', effetto: dati.gift.rettifica,
        imponibile: (dati.gift.perPerimetro || []).reduce((a, x) => a + x.imponibile, 0),
        iva: (dati.gift.perPerimetro || []).reduce((a, x) => a + x.iva, 0),
      })
      if (!dati.gift.riscattiLeggibili) {
        gc.addRow({})
        gc.addRow({ giorno: 'ATTENZIONE', tipo: 'Riscatti non leggibili: manca il permesso read_gift_card_transactions. Le emissioni NON sono sommate al corrispettivo.' })
      }
    }

    // ── QUADRATURA ─────────────────────────────────────────────────────────
    const quad = wb.addWorksheet('QUADRATURA')
    intesta(quad, [
      { header: 'Controllo', key: 'controllo', width: 52 },
      { header: 'Atteso', key: 'atteso', width: 16, style: { numFmt: EURO } },
      { header: 'Rilevato', key: 'rilevato', width: 16, style: { numFmt: EURO } },
      { header: 'Scarto', key: 'scarto', width: 14, style: { numFmt: EURO } },
      { header: 'Esito', key: 'esito', width: 12 },
    ])
    const qd = dati.quadratura
    quad.addRow({ controllo: 'Lordo + sconti + resi = netto', atteso: qd.nettoAtteso, rilevato: qd.nettoRilevato, scarto: qd.scartoNetto, esito: qd.nettoOk ? 'OK' : 'FUORI' })
    quad.addRow({ controllo: 'Netto + spedizioni + IVA + commissioni di reso = totale', atteso: qd.totaleAtteso, rilevato: qd.totaleRilevato, scarto: qd.scartoTotale, esito: qd.totaleOk ? 'OK' : 'FUORI' })
    quad.addRow({})
    quad.addRow({ controllo: 'Lordo senza paese di spedizione', rilevato: dati.qualita.lordoSenzaPaese, esito: dati.qualita.lordoSenzaPaese > 0 ? 'DA SISTEMARE' : 'OK' })
    quad.addRow({ controllo: 'Quota del mese senza paese (%)', rilevato: dati.qualita.quotaSenzaPaesePct })
    quad.addRow({ controllo: 'Mese chiuso', esito: dati.periodo.completo ? 'SI' : 'NO' })

    const buffer = await wb.xlsx.writeBuffer()
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="corrispettivi-shopify-${dati.periodo.mese}.xlsx"`,
        'Cache-Control': 'no-store',
      },
    })
  })
}
