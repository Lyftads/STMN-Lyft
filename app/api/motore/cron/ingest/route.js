import { NextResponse } from 'next/server'
import { db } from '../../../../../lib/motore/db'
import { getMetaCreds, fetchAdInsights, fetchAdSegmentInsights, fetchAdCreatives, fetchFullCreatives, extractCopy, fetchAdStatuses, accesa } from '../../../../../lib/motore/meta'
import { conMotore, wsMotore } from '../../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

const day = (d) => d.toISOString().slice(0, 10)

// Somma le righe che condividono la stessa chiave primaria PRIMA di scrivere.
// Meta può restituire più righe per la stessa (inserzione, giorno, segmento):
// chiavi user_segment_key diverse collassano sullo stesso segmento, e la stessa
// creativa può comparire sotto più adset. Un upsert con chiavi ripetute nello
// stesso batch fallisce ("ON CONFLICT DO UPDATE command cannot affect row a
// second time"), quindi si aggrega qui invece di sperare che non capiti.
function aggrega(righe, chiavi, somme, max = []) {
  const m = new Map()
  for (const r of righe) {
    const k = chiavi.map(c => r[c]).join('|')
    const cur = m.get(k)
    if (!cur) { m.set(k, { ...r }); continue }
    for (const f of somme) cur[f] = (+cur[f] || 0) + (+r[f] || 0)
    for (const f of max)   cur[f] = Math.max(+cur[f] || 0, +r[f] || 0)
  }
  return [...m.values()]
}

async function GET__(req) {
  // ?force=1 → rifetcha i metadati di TUTTE le creatività, non solo di quelle
  // a cui manca qualcosa. Serve ogni volta che cambia la logica di estrazione:
  // altrimenti le righe già popolate (magari male) restano com'erano.
  const q = new URL(req.url).searchParams
  const force = q.get('force') === '1'
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }

  const workspaceId = wsMotore()
  if (!workspaceId) return NextResponse.json({ error: 'CE_WORKSPACE_ID mancante' }, { status: 500 })

  // Finestra riscritta ogni notte: Meta rivede i dati per qualche giorno dopo,
  // quindi non ci si fida del solo ieri. Deve coincidere con quella di
  // /api/cron/business, altrimenti MER e CAC dividono periodi diversi.
  //
  // ?giorni=N la accorcia, per il controllo orario. Ventiquattro volte al
  // giorno una finestra di trenta giorni sarebbe quasi tutta riscrittura di
  // dati che non cambiano piu', e trenta volte il traffico verso Meta per
  // niente: il limite per applicazione (errore 17) e' gia' costato un blocco
  // su un altro account. Le scritture sono tutte upsert per (creativa, giorno),
  // quindi una finestra corta aggiorna i giorni recenti e non tocca lo storico.
  const GIORNI = Math.max(1, Number(q.get('giorni') || process.env.CE_FINESTRA_GIORNI || 30))
  // ?oggi=1 tira dentro anche il giorno in corso.
  //
  // Senza, un'inserzione lanciata ieri sera resta INVISIBILE: la sua spesa e'
  // quasi tutta di oggi, oggi non e' nella finestra, e siccome le inserzioni
  // entrano in banca dati solo se hanno dati di spesa non entra nemmeno la
  // riga. Il cliente ne ha caricate 31 il 1 settembre e il software non ne
  // vedeva nessuna. Un controllo che gira ogni ora e non vede oggi non e' un
  // controllo orario.
  //
  // Il giro NOTTURNO resta fermo a ieri: e' quello su cui si misurano MER e
  // CAC insieme ai dati Shopify, e mezza giornata di spesa contro mezza
  // giornata di ordini darebbe rapporti sbagliati.
  const conOggi = q.get('oggi') === '1'
  const until = conOggi ? new Date() : new Date(Date.now() - 86400000)
  const since = new Date(until.getTime() - (GIORNI - 1) * 86400000)

  try {
    const creds = await getMetaCreds(workspaceId)
    if (!creds.accessToken) return NextResponse.json({ error: 'Meta non collegato' }, { status: 400 })
    if (!creds.adAccountId) return NextResponse.json({ error: 'Ad account non impostato' }, { status: 400 })

    const acct = creds.adAccountId.startsWith('act_') ? creds.adAccountId : `act_${creds.adAccountId}`
    const rows = await fetchAdInsights({
      accessToken: creds.accessToken, adAccountId: acct, since: day(since), until: day(until),
    })
    if (!rows.length) {
      return NextResponse.json({ ok: true, viaNango: creds.viaNango, ads: 0, kpi: 0, nota: 'nessuna riga nella finestra' })
    }

    // 1) le inserzioni che non conosciamo entrano in ce_creatives come 'existing':
    //    sono le creative gia' vive nell'account, il punto di partenza dell'analisi.
    const adIds = [...new Set(rows.map(r => r.ad_id))]
    const { data: known } = await db()
      .from('ce_creatives').select('id, meta_ad_id, ad_created_at, storage_url, media_type')
      .eq('workspace_id', workspaceId).in('meta_ad_id', adIds)
    const byAdId = new Map((known || []).map(k => [k.meta_ad_id, k.id]))
    // Righe già presenti a cui manca ancora un metadato: vanno colmate, non
    // ignorate. Senza ad_created_at non si distingue una creativa appena nata
    // da una che gira da mesi, e si finisce per spegnere le giovani.
    const daColmare = force ? (known || []) : (known || []).filter(k => !k.ad_created_at || !k.storage_url || k.media_type == null)

    // I nomi delle inserzioni Meta NON sono unici (stessa creativa in piu' adset):
    // l'identita' e' meta_ad_id, e adIds e' gia' deduplicato.
    // Lo stato di TUTTE le inserzioni che conosciamo, non solo di quelle nella
    // finestra: una spenta la settimana scorsa smette di produrre insights e
    // senza questo passaggio resterebbe "attiva" per sempre, continuando a
    // comparire fra quelle da spegnere. E' il difetto segnalato dal cliente:
    // le spegneva su Meta e il software gliele riproponeva il giorno dopo.
    const { data: nostre } = await db().from('ce_creatives')
      .select('id, meta_ad_id, status').eq('workspace_id', workspaceId).not('meta_ad_id', 'is', null)
    const daStatare = [...new Set([...adIds, ...(nostre || []).map(n => n.meta_ad_id)])]
    let stati = {}, statiOk = true, statiErrore = null
    try {
      stati = await fetchAdStatuses(daStatare, creds.accessToken)
    } catch (e) {
      // Dichiarato, non nascosto: senza gli stati le decisioni restano quelle
      // di ieri, e va detto invece di far finta di aver sincronizzato.
      statiOk = false
      statiErrore = String(e.message || e).slice(0, 160)
    }
    let spente = 0, riaccese = 0, senzaStato = 0, senzaData = false
    if (statiOk) {
      for (const n of nostre || []) {
        const st = stati[n.meta_ad_id]
        // Assente NON vuol dire spenta. Un'inserzione cancellata sparisce dalla
        // risposta, ma sparisce anche una che Meta ha semplicemente omesso dal
        // batch, e questo giro passa ogni ora: interpretare l'assenza come uno
        // spegnimento vorrebbe dire far sparire dalla board delle creative vive
        // per un errore di trasporto. Si cambia stato solo su un'informazione
        // esplicita; l'assenza si conta e si dichiara.
        if (!st) { senzaStato++; continue }
        const nuovo = accesa(st) ? 'active' : 'spenta'
        if (n.status === nuovo) continue
        // La DATA dello spegnimento, non solo lo stato. Serve a misurare cosa
        // succede al conto dopo: e' l'unico modo di sapere se una creativita'
        // che sembrava da spegnere stesse in realta' reggendo le altre, e con
        // dati a ultimo clic non c'e' altra strada. Senza la data, quella
        // domanda resta senza risposta per sempre.
        const conData = { status: nuovo, spenta_il: nuovo === 'spenta' ? new Date().toISOString() : null }
        let { error: eSt } = await db().from('ce_creatives').update(conData).eq('id', n.id).eq('workspace_id', wsMotore())
        if (eSt && /spenta_il/.test(eSt.message || '')) {
          // La colonna arriva con una migrazione: finche' non c'e' si scrive
          // lo stato e basta. Questo giro passa ogni ora e non deve fermarsi
          // per una ALTER TABLE non ancora eseguita.
          senzaData = true
          ;({ error: eSt } = await db().from('ce_creatives').update({ status: nuovo }).eq('id', n.id).eq('workspace_id', wsMotore()))
        }
        if (eSt) continue
        if (nuovo === 'spenta') spente++; else riaccese++
      }
    }
    const missing = adIds.filter(id => !byAdId.has(id))
    if (missing.length) {
      const meta = await fetchAdCreatives(missing, creds.accessToken).catch(() => ({}))
      const cids = [...new Set(missing.map(id => meta[id]?.creative?.id).filter(Boolean))]
      const full = await fetchFullCreatives(cids, creds.accessToken).catch(() => ({}))
      const first = new Map()
      for (const r of rows) if (!first.has(r.ad_id)) first.set(r.ad_id, r)
      const toInsert = missing.map(id => {
        const r = first.get(id) || {}
        const cid = meta[id]?.creative?.id || null
        const c = full[cid] || meta[id]?.creative || {}
        return {
          workspace_id: workspaceId,
          name: r.ad_name || id,
          ratio: '1x1',                          // ignoto finche' non lo classifichiamo
          origin: 'existing',
          // Lo stato arriva da Meta. Prima era cablato ad 'active' e ogni
          // ingest riportava in vita le spente.
          status: accesa(stati[id]) ? 'active' : 'spenta',
          meta_ad_id: id,
          meta_adset_id: r.adset_id || null,
          meta_creative_id: cid,
          storage_url: c.image_url || c.thumbnail_url || null,
          thumb_url: c.thumbnail_url || c.image_url || null,
          ad_created_at: meta[id]?.created_time || null,
          ...extractCopy(c),
        }
      })
      const { data: ins, error } = await db()
        .from('ce_creatives').upsert(toInsert, { onConflict: 'workspace_id,meta_ad_id' })
        .select('id, meta_ad_id')
      if (error) throw new Error(`insert creatives: ${error.message}`)
      for (const k of ins || []) byAdId.set(k.meta_ad_id, k.id)
    }

    // Backfill dei metadati mancanti sulle righe già esistenti.
    let colmate = 0, limiteMeta = false
    if (daColmare.length) {
      const meta2 = await fetchAdCreatives(daColmare.map(k => k.meta_ad_id), creds.accessToken).catch(() => ({}))
      const cids2 = [...new Set(daColmare.map(k => meta2[k.meta_ad_id]?.creative?.id).filter(Boolean))]
      const full2 = await fetchFullCreatives(cids2, creds.accessToken).catch(() => ({}))
      if (full2.__limite) limiteMeta = true
      for (const k of daColmare) {
        const m = meta2[k.meta_ad_id]; if (!m) continue
        const cid = m.creative?.id || null
        const c = full2[cid] || m.creative || {}
        // Se il creative non è arrivato (limite raggiunto) NON si aggiorna:
        // scrivere campi vuoti cancellerebbe dati già buoni.
        if (!cid || !full2[cid]) continue
        const patch = { meta_creative_id: cid, ...extractCopy(c) }
        if (m.created_time) patch.ad_created_at = m.created_time
        if (c.image_url || c.thumbnail_url) {
          patch.storage_url = c.image_url || c.thumbnail_url
          patch.thumb_url = c.thumbnail_url || c.image_url
        }
        await db().from('ce_creatives').update(patch).eq('id', k.id).eq('workspace_id', wsMotore())
        colmate++
      }
    }

    // 2) serie KPI giornaliera
    const kpi = rows
      .filter(r => byAdId.has(r.ad_id))
      .map(r => ({
        creative_id: byAdId.get(r.ad_id),
        day: r.day,
        spend: r.spend, impressions: r.impressions, link_clicks: r.link_clicks,
        ctr: r.ctr, cpm: r.cpm, cpc: r.cpc, frequency: r.frequency,
        purchases: r.purchases, purchase_value: r.purchase_value, roas: r.roas,
        video_plays: r.video_plays, video_views_3s: r.video_views_3s, video_p25: r.video_p25, video_p50: r.video_p50,
        video_p75: r.video_p75, video_p100: r.video_p100,
        video_thruplay: r.video_thruplay, video_secondi_medi: r.video_secondi_medi,
      }))
    const kpiAgg = aggrega(kpi, ['creative_id','day'],
      // I conteggi video si sommano; i secondi medi no — sono una media, e
      // sommarli darebbe video da minuti quando durano venti secondi.
      ['spend','impressions','link_clicks','purchases','purchase_value',
       'video_plays','video_views_3s','video_p25','video_p50','video_p75','video_p100','video_thruplay'],
      ['frequency','video_secondi_medi'])
    // Le derivate si RICALCOLANO dopo la somma: sommare CTR o CPM non ha senso.
    for (const r of kpiAgg) {
      r.ctr  = r.impressions ? (r.link_clicks / r.impressions) * 100 : 0
      r.cpm  = r.impressions ? (r.spend / r.impressions) * 1000 : 0
      r.cpc  = r.link_clicks ? r.spend / r.link_clicks : 0
      r.roas = r.spend ? r.purchase_value / r.spend : 0
    }
    const { error: kErr } = await db()
      .from('ce_kpi_daily').upsert(kpiAgg, { onConflict: 'creative_id,day' })
    if (kErr) throw new Error(`upsert kpi: ${kErr.message}`)

    // 3) segmenti di pubblico REALI (breakdown user_segment_key), non dedotti
    const segRows = await fetchAdSegmentInsights({
      accessToken: creds.accessToken, adAccountId: acct, since: day(since), until: day(until),
    })
    const seg = segRows.filter(r => byAdId.has(r.ad_id)).map(r => ({
      creative_id: byAdId.get(r.ad_id), day: r.day, segment: r.segment,
      spend: r.spend, impressions: r.impressions, link_clicks: r.link_clicks,
      purchases: r.purchases, purchase_value: r.purchase_value, roas: r.roas,
    }))
    const segAgg = aggrega(seg, ['creative_id','day','segment'],
      ['spend','impressions','link_clicks','purchases','purchase_value'])
    for (const r of segAgg) r.roas = r.spend ? r.purchase_value / r.spend : 0
    if (segAgg.length) {
      const { error: sErr } = await db()
        .from('ce_kpi_segment_daily').upsert(segAgg, { onConflict: 'creative_id,day,segment' })
      if (sErr) throw new Error(`upsert segmenti: ${sErr.message}`)
    }

    // 4) audience_type = segmento DOMINANTE PER SPESA, misurato non indovinato.
    //    Si aggiorna a ogni ingest: una creativa puo' cambiare pubblico nel tempo.
    const spendBySeg = new Map()
    for (const r of segAgg) {
      const m = spendBySeg.get(r.creative_id) || {}
      m[r.segment] = (m[r.segment] || 0) + r.spend
      spendBySeg.set(r.creative_id, m)
    }
    for (const [cid, m] of spendBySeg) {
      const tot = Object.values(m).reduce((a, b) => a + b, 0)
      if (!tot) continue
      const [top, val] = Object.entries(m).sort((a, b) => b[1] - a[1])[0]
      // Sotto il 60% di spesa nessun segmento domina davvero: si lascia 'mixed'
      // invece di etichettare a caso una creativa che serve piu' pubblici.
      const label = val / tot >= 0.6 ? top : 'mixed'
      await db().from('ce_creatives').update({ audience_type: label }).eq('id', cid).eq('workspace_id', wsMotore())
    }

    return NextResponse.json({
      ok: true,
      viaNango: creds.viaNango,
      finestra: { since: day(since), until: day(until), conOggi },
      ads: adIds.length, nuove: missing.length, colmate, limiteMeta, kpi: kpiAgg.length, segmenti: segAgg.length,
      stati: { letti: Object.keys(stati).length, spente, riaccese, senzaStato, ok: statiOk,
        ...(senzaData ? { avviso: 'manca la colonna spenta_il: senza, non si potra' + String.fromCharCode(39) + ' misurare l' + String.fromCharCode(39) + 'effetto degli spegnimenti. Va eseguito spenta_il.sql' } : {}), ...(statiErrore ? { errore: statiErrore } : {}) },
    })
  } catch (e) {
    // Errore propagato, non nascosto: un ingest muto riempie la board di zeri.
    return NextResponse.json({ error: e?.message || 'ingest fallito', code: e?.code }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const GET = conMotore(GET__)
