import { NextResponse } from 'next/server'
import { db, kpiDi } from '../../../../lib/motore/db'
import { generaBrief, nomina, siglaProdotto } from '../../../../lib/motore/brief'
import { generaCopy } from '../../../../lib/motore/copyGen'
import { combinazioni } from '../../../../lib/motore/varianza'
import { leggiScarti } from '../../../../lib/motore/scarti'
import { cadenza, tempoDiProdurre } from '../../../../lib/motore/cadenza'
import { analizza, pesi as pesiDaGiudizi, daEvitare } from '../../../../lib/motore/apprendimento'
import { funnelDiFormato } from '../../../../lib/motore/formati'
import { scegliRiga, usateDa, scenaDaRiga, direzioneCreativa, templatePer, avatarDi, clusterDi, segnoMatrice, segnoTemplate, idTemplateDa } from '../../../../lib/motore/matrice'
import { conMotore, wsMotore, clienteMotore } from '../../../../lib/motore/workspace'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

// Sotto tre creativita' un lotto non e' un test: e' anche il minimo del calendario (lib/cadenza).
const MINIMO_LOTTO = 3

async function tutte(build, pagina = 1000) {
  let out = [], da = 0
  for (;;) {
    const { data, error } = await build().range(da, da + pagina - 1)
    if (error) throw new Error(error.message)
    out = out.concat(data || []); if (!data || data.length < pagina) return out; da += pagina
  }
}

async function POST__(req) {
  const auth = req.headers.get('authorization') || ''
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'non autorizzato' }, { status: 401 })
  }
  const ws = wsMotore()
  const body = await req.json().catch(() => ({}))
  // `quanti` a mano resta possibile, ma il numero giusto lo decide la cadenza:
  // vedi sotto. `forza` salta il controllo del calendario, per quando si vuole
  // produrre comunque.
  const quantiAMano = body.quanti ? Math.min(Number(body.quanti), 20) : null
  const forza = body.forza === true
  // La matrice si puo' restringere a mano: { cluster: ['1A','5B'] } o
  // { avatar: ['1A-2'] } producono solo per quelle persone — e' il modo di
  // dire "fammi il lotto di Carmela e Pino". { matrice: false } la spegne e
  // torna alle scene generiche di prima.
  const lista = (x) => (Array.isArray(x) ? x : x ? [x] : []).map(String)
  const soloCluster = new Set(lista(body.cluster)), soloAvatar = new Set(lista(body.avatar))
  const conMatrice = body.matrice !== false && process.env.MATRICE !== 'off'

  try {
    const [cre, kpi, ang, prod, brandRes, temiRows] = await Promise.all([
      tutte(() => db().from('ce_creatives').select('id, name, angle_id, format, funnel, persona, product_id, variante_seme, qualita, qualita_motivo, origin, created_at, storage_url, flag_lanciata, flag_lanciata_il, uploaded_at, ad_created_at, brief_motivo').eq('workspace_id', ws)),
      // La frequenza serve al brief RINNOVA: è l'unico indicatore anticipato
      // di stanchezza, e senza di essa il motore se ne accorge solo quando il
      // ROAS è già sceso — cioè quando i soldi sono già stati spesi male.
      tutte(() => kpiDi('ce_kpi_daily', 'creative_id, spend, purchases, purchase_value, frequency, day')),
      tutte(() => db().from('ce_angles').select('id, slug').eq('workspace_id', ws)),
      tutte(() => db().from('ce_products').select('*').eq('workspace_id', ws)),
      db().from('ce_brand').select('*').eq('workspace_id', ws).maybeSingle(),
      // I temi delle recensioni: da qui esce l'angolo che i clienti nominano e
      // che noi non stiamo dicendo.
      tutte(() => db().from('ce_temi').select('*').eq('workspace_id', ws)),
    ])
    const brand = brandRes?.data || null
    const slug = new Map(ang.map(a => [a.id, a.slug]))
    const perSlug = new Map(ang.map(a => [a.slug, a.id]))
    // Frequenza per creatività: si prende la PIÙ RECENTE, non la media. La
    // media di trenta giorni diluisce la stanchezza di oggi in tre settimane
    // in cui la creativa era fresca, e la soglia non scatta mai.
    const freqUltima = new Map()
    for (const k of kpi) {
      const p = freqUltima.get(k.creative_id)
      if (!p || k.day > p.day) freqUltima.set(k.creative_id, { day: k.day, f: +k.frequency || 0 })
    }
    const creativita = cre.map(c => ({
      ...c, angolo: slug.get(c.angle_id) || null,
      frequenza: freqUltima.get(c.id)?.f || 0,
    }))
    // Cosa si è imparato dai giudizi di qualità: pesa gli ingredienti della
    // varianza verso quelli che hanno prodotto risultati migliori.
    // Cio' che e' stato buttato conta quanto cio' che c'e': un voto "male" su
    // una creativita' cancellata e' il segnale piu' netto che esista, e
    // sparirebbe proprio perche' la riga non c'e' piu'.
    const scarti = await leggiScarti(db, ws)
    const analisi = analizza([...creativita, ...scarti])
    const pesi = analisi.giudicate ? pesiDaGiudizi(analisi) : null
    const evitare = analisi.giudicate ? daEvitare(analisi) : []

    // ---- il calendario ----------------------------------------------------
    //
    // Prima si produceva ogni notte, a prescindere. Con quarantasei creativita'
    // contemporaneamente in attesa non si capisce piu' cosa sta rendendo cosa,
    // ed e' esattamente la cecita' che un account che deve scalare non si puo'
    // permettere. Quante e ogni quanto NON si decidono: si calcolano dal budget
    // e dal costo per ordine.
    const perGiorno = {}
    for (const k of kpi) perGiorno[k.day] = (perGiorno[k.day] || 0) + (+k.spend || 0)
    const giorni = Object.keys(perGiorno).sort()
    const ultimi7 = giorni.slice(-7).map(g => perGiorno[g])
    const budgetGiornaliero = ultimi7.length ? ultimi7.reduce((a, b) => a + b, 0) / ultimi7.length : 0
    const spesaTot = kpi.reduce((t, k) => t + (+k.spend || 0), 0)
    const ordTot = kpi.reduce((t, k) => t + (+k.purchases || 0), 0)
    const cad = cadenza({ budgetGiornaliero, cpa: ordTot ? spesaTot / ordTot : 0 })

    // La data che conta e' quella del LANCIO. Prima usavo la creazione della
    // riga: misurava da quando il motore aveva fabbricato la creativita', non
    // da quando aveva cominciato a spendere — e in mezzo ci puo' stare una
    // settimana di magazzino.
    // Tre sorgenti, e la piu' affidabile e' la prima: `ad_created_at` e' la data
    // in cui l'inserzione e' nata SU META, quindi e' un fatto e non dipende dal
    // fatto che qualcuno si ricordi di spuntare "lanciata".
    const ultimoLancio = creativita
      .map(c => c.ad_created_at || c.flag_lanciata_il || c.uploaded_at)
      .filter(Boolean).sort().pop() || null
    // Il magazzino del motore: sue, con il file pronto, mai lanciate. Solo le
    // sue — le importate a mano possono essere un archivio, non una coda.
    const pronteNonLanciate = creativita
      .filter(c => c.origin === 'generated' && c.storage_url && !c.flag_lanciata && !c.uploaded_at).length
    const momento = tempoDiProdurre(cad, ultimoLancio, Date.now(), { pronteNonLanciate })

    if (!forza && !quantiAMano && !momento.produci) {
      // Non e' un errore: e' il calendario che dice di aspettare. Marcarlo come
      // fallimento farebbe risultare rotto ogni ciclo fra un lotto e l'altro.
      return NextResponse.json({
        ok: true, prodotte: 0, inAttesa: true, cadenza: cad,
        nota: momento.motivo, pronteNonLanciate,
        prossimoLotto: cad && ultimoLancio
          ? new Date(new Date(ultimoLancio).getTime() + cad.cadenzaGiorni * 86400000).toISOString().slice(0, 10)
          : null,
      })
    }
    const quanti = quantiAMano || momento.quante || cad?.lotto || 6

    const totRec = (temiRows || []).reduce((m, t) => Math.max(m, t.quota ? Math.round(t.n / t.quota) : 0), 0)
    const temi = (temiRows || []).map(t => ({ ...t, totale: totRec }))
    const { brief } = generaBrief({ creativita, kpi, prodotti: prod, brand, maxBrief: quanti, temi })
    // Alla copy vanno i temi POSITIVI piu' frequenti, con la citazione: sono le
    // parole dei clienti. I negativi restano fuori: dicono cosa non promettere,
    // non come parlare.
    const temiPerCopy = temi
      .filter(t => t.sentiment !== 'negativo' && (t.quota || 0) >= 0.05)
      .sort((a, b) => (b.n || 0) - (a.n || 0)).slice(0, 4)
    if (!brief.length) return NextResponse.json({ ok: true, nota: 'nessun brief da produrre' })

    // ---- la matrice -------------------------------------------------------
    //
    // Il brief ha deciso COSA produrre, dai numeri. Ora ogni brief riceve una
    // riga della matrice: una persona con un nome e un momento preciso, la
    // scena, la leva. Senza, la copy parla "a FAMIGLIA" e la scena mostra "una
    // signora in una cucina": con, parla a Rita che ha quattro figli e sta
    // confrontando il prezzo al litro al discount.
    //
    // Le righe gia' usate non si rifanno, e dentro lo stesso lotto non si
    // ripete un avatar: e' la regola "ogni creativita' completamente diversa
    // dalle altre" (lib/matrice.js).
    const usateMatrice = usateDa([...creativita, ...scarti])
    const templateUsati = new Set([...creativita].map(idTemplateDa).filter(Boolean))
    const lottoMatrice = []
    if (conMatrice) {
      const ammesse = (soloCluster.size || soloAvatar.size)
        ? (r) => (!soloCluster.size || soloCluster.has(r.cluster)) && (!soloAvatar.size || soloAvatar.has(r.avatar))
        : null
      for (const b of brief) {
        const riga = scegliRiga({ brief: b, usate: usateMatrice, lotto: lottoMatrice, ammesse })
        if (!riga) continue
        usateMatrice.add(riga.id); lottoMatrice.push(riga)
        b.matrice = riga
        b.direzione = direzioneCreativa(riga)
        // La persona diventa il SEGMENTO: e' il pezzo del nome che torna
        // indietro da Meta, e da qui in poi gli insights arrivano gia' divisi
        // per i sei segmenti invece che per le quattro persone dedotte.
        b.persona = riga.segmento
        // Angolo e formato li tiene il brief se li aveva scelti dai numeri;
        // dove non aveva deciso, li porta la riga.
        b.angolo = b.angolo || riga.angolo_motore
        b.formato = b.formato || riga.formato_motore
        const t = templatePer(riga.formato, templateUsati, riga.id)
        if (t) { b.template = t.id; templateUsati.add(t.id) }
      }
    }

    // Il prodotto: quello con la quota di produzione più alta che ha ancora
    // margine di lavoro. Senza, si produrrebbe sempre per il più grande.
    const perQuota = [...prod].sort((a, b) => (b.quota_creativita || 0) - (a.quota_creativita || 0))
    // Varianti già usate: si evita di rigenerare la stessa combinazione.
    // I semi degli scarti restano occupati: e' l'unica cosa che impedisce di
    // rigenerare identica una creativita' che il cliente ha buttato.
    // Gli angoli che la matrice porta e che l'account non ha mai avuto (REGALO,
    // per dire) si creano qui. Senza la riga in ce_angles la creativita'
    // nascerebbe con l'angolo nel nome ma senza angle_id — cioe' fuori da ogni
    // aggregazione per angolo, che e' l'unita' su cui il motore decide.
    for (const slugNuovo of new Set(brief.filter(b => b.matrice && b.angolo && !perSlug.has(b.angolo)).map(b => b.angolo))) {
      const nomeAngolo = slugNuovo.charAt(0) + slugNuovo.slice(1).toLowerCase()
      const { data: nuovo, error: eAng } = await db().from('ce_angles')
        .upsert({ workspace_id: ws, slug: slugNuovo, name: nomeAngolo, source: 'manual', description: 'Dalla matrice dei cluster (6 nov 2026)' }, { onConflict: 'workspace_id,slug' })
        .select('id, slug').maybeSingle()
      if (!eAng && nuovo) perSlug.set(nuovo.slug, nuovo.id)
    }
    const semi = [...creativita, ...scarti].map(c => c.variante_seme).filter(Boolean)
    const combo = combinazioni(brief.length, semi, pesi)

    // I nomi gia' presi. La versione era cablata a 1 e il nome collideva con una
    // creativita' gia' esistente: l'insert falliva, l'errore veniva inghiottito
    // e il motore rispondeva "ok" con zero prodotte e nessuna spiegazione.
    const nomiPresi = new Set(creativita.map(c => c.name).filter(Boolean))

    const prodotte = [], errori = []
    const prodottoDi = (i) => perQuota[i % Math.max(1, Math.min(4, perQuota.length))] || prod[0]
    // La copy passa tre cancelli prima di costare un'immagine: i vincoli del
    // brand, i difetti che si contano (lunghezze, attacco, cifre inventate) e
    // il punteggio del giudice. Sotto soglia non si produce, e si dice perche'.
    // Ogni copy ora vale fino a otto chiamate (quattro tentativi, ognuno con il
    // suo giudizio): in fila, dieci brief sfondavano i 300 secondi della
    // funzione. Le copy si scrivono tutte insieme; in fila resta solo la
    // scrittura a DB, che ha bisogno dei nomi gia' presi.
    const copie = await Promise.all(brief.map((b, i) =>
      generaCopy({ brief: b, prodotto: prodottoDi(i), brand, temi: temiPerCopy, variante: i })
        .catch(e => ({ scartata: true, motivo: String(e?.message || e).slice(0, 140) }))))
    // La soglia del giudice ha due modi, e la differenza e' una decisione.
    //
    // MORBIDA (predefinita): chi passa i vincoli ma resta sotto soglia dopo i
    // tentativi si produce lo stesso, MARCATO sotto soglia. Misurato il 17 set
    // 2026 su Saracino con gpt-4o: una copy su dieci superava 15/25, sempre
    // per il gancio. Bloccare avrebbe lasciato il conto senza creativita'
    // nuove per un giudizio che nessun dato aveva ancora confermato. Le
    // marcate contano nella taratura (lib/calibrazione): e' l'unico modo per
    // sapere se il giudice predice il rendimento o e' solo severo.
    //
    // RIGIDA (COPY_SOGLIA=rigida): sotto soglia non si produce, salvo tenere
    // un minimo di tre per non lasciare il lotto vuoto — la regola dei pesi
    // della varianza: se il filtro scarta troppo, allenta. Da accendere quando
    // la taratura mostra che le copy sopra soglia rendono davvero di piu'.
    const rigida = process.env.COPY_SOGLIA === 'rigida'
    const minimoPromosse = rigida ? MINIMO_LOTTO : brief.length
    let promosse = copie.filter(c => c && !c.scartata).length
    if (promosse < minimoPromosse) {
      const ripescabili = copie.map((c, i) => ({ c, i })).filter(x => x.c?.scartata && x.c.migliore?.punteggio)
        .sort((a, b) => b.c.migliore.punteggio.totale - a.c.migliore.punteggio.totale)
      for (const { c, i } of ripescabili) {
        if (promosse >= minimoPromosse) break
        copie[i] = { ...c.migliore, punteggio: { ...c.migliore.punteggio, sottoSoglia: true }, ripescata: true }
        promosse++
      }
    }
    for (let i = 0; i < brief.length; i++) {
      const b = brief[i]
      const p = prodottoDi(i)
      const c = combo[i] || combo[0]
      const copy = copie[i]
      if (!copy || copy.scartata) { prodotte.push({ brief: b.tipo, esito: `copy scartata: ${copy?.motivo || 'violava i vincoli'}` }); continue }

      // La prima versione libera: si prova finche' entrambi i formati sono
      // liberi, perche' una coppia con un formato solo e' una creativita' che
      // non esiste in verticale.
      const nomeDi = (v) => nomina({
        cliente: 'SAR', prodotto: siglaProdotto(p), angolo: b.angolo || 'LIBERO',
        persona: b.persona || copy.persona || null, ratio: '1x1', versione: v,
      })
      let v = 1, nome = nomeDi(v)
      while (v < 200 && ['1x1', '9x16'].some(r => nomiPresi.has(nome.replace('_1x1_', `_${r}_`)))) {
        v++; nome = nomeDi(v)
      }
      const base = {
        workspace_id: ws, product_id: p?.id || null,
        angle_id: b.angolo ? perSlug.get(b.angolo) || null : null,
        format: b.formato || null,
        // La fase la porta il brief se l'ha scelta lui, altrimenti la deduce il
        // formato: una creatività senza fase è cieca per il motore di copertura.
        funnel: b.funnel || funnelDiFormato(b.formato) || null,
        persona: b.persona || null, origin: 'generated', status: 'draft',
        headline: copy.headline, sub: copy.sub, cta: copy.cta, primary_text: copy.primary_text,
        // Il link di destinazione entra SUBITO, costruito dall'handle Shopify:
        // una creatività senza link non è pronta e va rifinita a mano, che è
        // esattamente ciò che il motore deve evitare.
        link_url: p?.handle && clienteMotore()?.sito ? `${clienteMotore().sito}/products/${p.handle}` : null,
        link_tipo: p?.handle ? 'prodotto' : null,
        link_handle: p?.handle || null,
        palette: c.palette.id,
        // Con la matrice la scena e' quella della riga — la situazione di
        // quella persona — e dagli assi restano solo luce e stile della casa,
        // che sono cio' che la riga non dice e che deve cambiare ogni volta.
        scena_desc: b.matrice
          ? scenaDaRiga({ riga: b.matrice, stile: c.stile, luce: c.luce })
          : `${c.ambiente.desc}, ${c.stile?.desc || ''}; ${c.soggetto.desc}; ${c.luce.desc}; ${c.quadro.desc}`,
        brief_tipo: b.tipo,
        // Il segno della riga sta nel motivo: e' cio' che permette di non
        // rifarla, anche prima che la migrazione 28 aggiunga le colonne.
        brief_motivo: b.matrice
          ? `${b.motivo} Per ${avatarDi(b.matrice.avatar)?.nome || 'un avatar'} (${clusterDi(b.matrice.cluster)?.nome || b.matrice.cluster}). ${segnoMatrice(b.matrice.id)}${b.template ? ' ' + segnoTemplate(b.template) : ''}`
          : b.motivo,
        variante_seme: b.matrice ? `${c.firma}|${b.matrice.id}` : c.firma,
      }
      // Le colonne della matrice (migrazione 28). Finche' mancano si scrive
      // senza: la riga resta rintracciabile dal segno nel motivo.
      const colonneMatrice = b.matrice ? {
        matrice_id: b.matrice.id, segmento: b.matrice.segmento, cluster: b.matrice.cluster,
        avatar: b.matrice.avatar, template_id: b.template || null,
      } : {}
      // Due righe: una per formato. La nomenclatura le distingue sul ratio.
      for (const ratio of ['1x1', '9x16']) {
        const n2 = nome.replace('_1x1_', `_${ratio}_`)
        // Il punteggio si salva con la riga: e' cio' che permette, fra qualche
        // settimana, di confrontare il giudizio con il rendimento vero. La
        // colonna arriva con la migrazione 27: finche' manca si scrive senza.
        const conPunteggio = copy.punteggio ? { punteggio_copy: copy.punteggio } : {}
        let { data, error } = await db().from('ce_creatives')
          .insert({ ...base, ...conPunteggio, ...colonneMatrice, ratio, name: n2 }).select('id, name').maybeSingle()
        if (error && /matrice_id|segmento|cluster|avatar|template_id/.test(error.message || '')) {
          ;({ data, error } = await db().from('ce_creatives')
            .insert({ ...base, ...conPunteggio, ratio, name: n2 }).select('id, name').maybeSingle())
        }
        if (error && copy.punteggio && /punteggio_copy/.test(error.message || '')) {
          ;({ data, error } = await db().from('ce_creatives')
            .insert({ ...base, ratio, name: n2 }).select('id, name').maybeSingle())
        }
        // L'errore si DICHIARA. Prima veniva inghiottito da un `if (!error &&
        // data)`, e il motore rispondeva ok con zero prodotte: un fallimento
        // che non si vedeva ne' dal codice di stato ne' dal corpo.
        if (error) { errori.push({ nome: n2, errore: String(error.message).slice(0, 140) }); continue }
        if (data) { nomiPresi.add(data.name); prodotte.push({ id: data.id, nome: data.name, brief: b.tipo, ...(b.matrice ? { matrice: b.matrice.id, avatar: avatarDi(b.matrice.avatar)?.nome, template: b.template || null } : {}), palette: c.palette.id, attacco: copy.apertura, punteggio: copy.punteggio?.totale ?? null, ...(copy.ripescata ? { nota: `sotto soglia (${copy.punteggio?.totale}/25): prodotta in modalita' ${rigida ? 'rigida, per non lasciare il lotto vuoto' : 'morbida'}` } : {}) }) }
      }
    }
    const ok = prodotte.length > 0 || brief.length === 0
    return NextResponse.json({ ok, brief: brief.length, prodotte, errori,
      copy: { soglia: rigida ? 'rigida' : 'morbida', sopraSoglia: copie.filter(c => c && !c.scartata && !c.ripescata).length, sottoSoglia: copie.filter(c => c?.ripescata).length, scartate: copie.filter(c => !c || c.scartata).length },
      ...(ok ? {} : { error: `nessuna delle ${brief.length} bozze e' stata scritta` }),
      // Si dichiara su cosa si è basata questa tornata: un motore che si
      // autoregola senza mostrare su cosa si regola è una scatola nera.
      matrice: { attiva: conMatrice, righe: lottoMatrice.map(r => r.id), usateFinora: usateMatrice.size },
      apprendimento: { giudizi: analisi.giudicate, evitati: evitare.map(e => `${e.asse}:${e.id}`) } },
      { status: ok ? 200 : 207 })
  } catch (e) {
    return NextResponse.json({ error: e?.message || 'generazione fallita' }, { status: 502 })
  }
}

// Ogni chiamata passa da conMotore: decide di quale cliente sono i dati (sessione o cron) prima di toccarli.
export const POST = conMotore(POST__)
