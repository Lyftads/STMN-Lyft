// ============================================================================
//  IL GLOSSARIO — che cosa vuol dire ogni metrica dell'app e come si calcola.
//
//  Serve alle spiegazioni al passaggio del mouse (app/components/ui/Spiegazioni.jsx): l'etichetta che
//  si legge a schermo (intestazione di una tabella, nome di un riquadro, prima cella di una riga) si
//  cerca qui; se c'e', la nuvoletta mostra il testo `gl.<id>` nella lingua dell'utente.
//  Cosi' UNA definizione vale per tutte le tab: niente testi ripetuti, niente tab dimenticate.
//  Le espressioni lavorano sul testo NORMALIZZATO (minuscolo, senza accenti, senza frecce e segni
//  davanti). L'ordine conta: le voci piu' specifiche stanno prima di quelle generiche ("spesa meta"
//  prima di "spesa", "ctr link" prima di "ctr"). `tabs` limita una voce ad alcune tab, dove la
//  stessa sigla vuol dire un'altra cosa (in Email "CR" e' il click rate).
//  Generato da uno script (i testi in 5 lingue sono nei dizionari): per aggiungere una voce si
//  aggiunge qui l'espressione e nei dizionari la chiave gl.<id>.
//
//  PERCHE' QUI NON SERVE NIENTE PER CLIENTE. Questo elenco non filtra dati e non legge niente: mette
//  in corrispondenza un'ETICHETTA che si legge a schermo con una definizione. Se un cliente non ha
//  quella colonna, l'espressione non combacia mai e non succede niente — che e' esattamente il
//  comportamento voluto quando un'impostazione e' vuota: nessun filtro, nessun effetto. Per questo
//  restano anche le voci nate su un negozio solo (di cui marketplace, drive to store, i costi fissi
//  del conto economico): per chi non ha quella riga sono inerti, per chi ce l'ha spiegano un numero
//  che altrimenti nessuno sa leggere. Nessuna delle voci mostra dati: solo testo tradotto.
//  NON RIORDINARE: l'ordine e' la regola di precedenza. Se "spesa" salisse sopra "spesa meta", la
//  colonna "Spesa Meta" verrebbe spiegata come la spesa totale — una spiegazione SBAGLIATA, che e'
//  peggio di nessuna spiegazione.
// ============================================================================
export const VOCI = [
  { id: "revenuePiattaforma", re: /^(revenue|fatturato|ricavi|entrate)$/, tabs: ["metaKpi", "metaDetail", "creative", "creativeFatigue", "metaLeadgen", "googleKpi", "googleDetail", "googleProducts"] },
  { id: "unita", re: /^(unita|pezzi|units)$/ },
  { id: "netto", re: /^netto$/ },
  { id: "adsProdotto", re: /^ads$/ },
  { id: "margineOp", re: /^margine op\.?$/ },
  { id: "deltaNetto", re: /^. netto$/ },
  { id: "bandaCosti", re: /^costi$/ },
  // "mer" NON sta qui: e' l'abbreviazione di mercoledi' ma anche la metrica piu' importante del
  // prodotto (fatturato / spesa), e questa voce viene prima — "MER" finiva spiegato come un giorno
  // della settimana. I giorni si riconoscono per esteso e con le abbreviazioni non ambigue.
  { id: "giornoSettimana", re: /^(lun|mar|gio|ven|sab|dom|mon|tue|wed|thu|fri|sat|sun|luned[ìi]|marted[ìi]|mercoled[ìi]|gioved[ìi]|venerd[ìi]|sabato|domenica)$/ },
  { id: "fatturatoIva", re: /^fatturato (\(?incl\.? ?iva\)?|iva inclusa)/ },
  { id: "ricaviNetti", re: /^(ricavi netti|fatturato netto)/ },
  { id: "fattKoongo", re: /^(fatturato koongo|di cui marketplace)/ },
  { id: "fattNC", re: /^fatt\.? ?nc$/ },
  { id: "fattRC", re: /^fatt\.? ?rc$/ },
  { id: "fatturato", re: /^(fatturato|revenue|ricavi|vendite totali|vendite|finora|umsatz|chiffre d.affaires|facturacion|ingresos|ventas|sales)$/ },
  { id: "ordini", re: /^(ordini|orders|pedidos|commandes|bestellungen)$/ },
  { id: "aovNC", re: /^aov nc$/ },
  { id: "aovRC", re: /^aov rc$/ },
  { id: "aov", re: /^(aov|aov medio|aov netto|scontrino medio( \(aov\))?|average order value|ticket medio|panier moyen)$/ },
  { id: "sessioni", re: /^(sessioni|sessions|sesiones|sitzungen)$/ },
  { id: "cro", re: /^(cro|cro%|conversione|conversion rate|tasso di conversione)$/ },
  { id: "nuoviClienti", re: /^(nuovi clienti|new customers|nc|clientes nuevos|nouveaux clients|neukunden)$/ },
  { id: "clientiRitorno", re: /^(clienti di ritorno|clienti ritorno|returning customers|rc)$/ },
  { id: "clienti", re: /^(clienti|customers|clientes|clients|kunden)$/ },
  { id: "ret", re: /^(ret%|repeat rate|riacquisto|retention)$/ },
  { id: "ltvLordo", re: /^ltv lordo$/ },
  { id: "ltvNetto", re: /^ltv netto$/ },
  { id: "ltv", re: /^(ltv|valore cliente( \(clv\))?|clv)$/ },
  { id: "cac", re: /^cac$/ },
  { id: "ratio", re: /^ratio ltv ?: ?cac$/ },
  { id: "amer", re: /^amer$/ },
  { id: "mer", re: /^(mer|mer blended)$/ },
  { id: "cpo", re: /^(cpo|costo per ordine)$/ },
  { id: "breakEven", re: /^break.?even roas$/ },
  { id: "roas", re: /^roas$/ },
  { id: "poas", re: /^poas$/ },
  { id: "spesaMeta", re: /^(spesa meta|di cui meta)$/ },
  { id: "spesaGoogle", re: /^(spesa google|di cui google)$/ },
  { id: "driveToStore", re: /^di cui drive to store/ },
  { id: "spesaFineMese", re: /^spesa a fine mese$/ },
  { id: "spesa", re: /^(spesa|speso|importo speso|spend|spesa adv|spesa totale|adv|advertising|costo|pubblicita|gasto|depense|ausgaben)$/ },
  { id: "budget", re: /^(budget|budget\/g)$/ },
  { id: "cpa", re: /^(cpa|costo\/conv\.?|costo risultato|costo per risultato)$/ },
  { id: "cpcLink", re: /^cpc link$/ },
  { id: "cpc", re: /^(cpc|cpc medio)$/ },
  { id: "cpm", re: /^cpm$/ },
  { id: "ctrLink", re: /^ctr link$/ },
  { id: "ctr", re: /^ctr$/ },
  { id: "impressioni", re: /^(impressioni|impr\.?|impression|impressions|impresiones|impressionen)$/ },
  { id: "clicLink", re: /^(click link|clic link)$/ },
  { id: "clic", re: /^(clic|click|clicks|clics|klicks)$/ },
  { id: "copertura", re: /^(copertura|reach|alcance|couverture|reichweite)$/ },
  { id: "frequenza", re: /^(frequenza|freq\.?|frequency)$/ },
  { id: "tassoConv", re: /^(tasso conv\.?|conv\. acq\.?)$/ },
  { id: "valoreConv", re: /^(valore conv\.?|conversion value)$/ },
  { id: "risultati", re: /^risultati$/ },
  { id: "conversioni", re: /^(conversioni|conv\.?|acquisti|purchases|conversions)$/ },
  { id: "stato", re: /^(stato|status)$/ },
  { id: "stock", re: /^(stock|giacenza)$/ },
  { id: "venditeG", re: /^vendite\/g$/ },
  { id: "giorniCopertura", re: /^giorni$/, tabs: ["inventory"] },
  { id: "valoreInventario", re: /^valore inventario/ },
  { id: "rischio", re: /^taglie a rischio/ },
  { id: "esaurite", re: /^taglie esaurite/ },
  { id: "taglia", re: /^taglia ?\/ ?sku$/ },
  { id: "venduto", re: /^(venduto|incassato)$/ },
  { id: "vendutoVero", re: /^venduto vero$/ },
  // l'aliquota era scritta a mano ("iva 22%"): nel SaaS i clienti non hanno tutti la stessa, e con
  // "IVA 10%" in intestazione la spiegazione spariva. Ora vale qualunque aliquota, virgola compresa.
  { id: "iva", re: /^(iva|iva ?\d+([.,]\d+)? ?%.*|vat|tva|mwst\.?)$/ },
  { id: "merce", re: /^(merce|cogs|cogs \(costo prodotti\)|cogs totale)$/ },
  { id: "guadagno", re: /^guadagno$/ },
  { id: "cosaTogliamo", re: /^cosa togliamo$/ },
  { id: "cosaResta", re: /^cosa resta$/ },
  { id: "controllo", re: /^controllo$/ },
  { id: "doveVa", re: /^dove va ogni euro$/ },
  { id: "idArticolo", re: /^id articolo$/ },
  { id: "openRate", re: /^(open rate|or)$/, tabs: ["klaviyo"] },
  { id: "clickRate", re: /^(click rate|cr)$/, tabs: ["klaviyo"] },
  { id: "convEmail", re: /^conv$/, tabs: ["klaviyo"] },
  { id: "ctor", re: /^ctor$/ },
  { id: "emailRicevute", re: /^email ricevute$/ },
  { id: "aperte", re: /^aperte$/ },
  { id: "cliccate", re: /^cliccate$/ },
  { id: "bounce", re: /^bounce$/ },
  { id: "unsub", re: /^unsub$/ },
  { id: "entrateEmail", re: /^(entrate email|entrate)$/ },
  { id: "perDest", re: /^.\/dest$/ },
  { id: "dataInvio", re: /^data invio$/ },
  { id: "flusso", re: /^flusso$/ },
  { id: "segmento", re: /^segmento$/ },
  { id: "ordiniMedi", re: /^(ordini medi|ordini per cliente|ordini\/cl\.?)$/ },
  { id: "giorniTraOrdini", re: /^giorni tra (gli )?ordini$/ },
  { id: "coorte", re: /^coorte$/ },
  { id: "query", re: /^query$/ },
  { id: "posizione", re: /^pos\.?$/ },
  { id: "margineLordo", re: /^margine lordo$/ },
  { id: "margineContribuzione", re: /^margine (di )?contribuzione$/ },
  { id: "ebit", re: /^ebit( \(utile\))?$/ },
  { id: "ebitPct", re: /^ebit %$/ },
  { id: "feeGateway", re: /^fee gateway/ },
  { id: "commMarketplace", re: /^commissioni marketplace/ },
  { id: "costiFissi", re: /^costi fissi/ },
  { id: "packaging", re: /^packaging$/ },
  { id: "spedizione", re: /^spedizione/ },
  { id: "costoFisso", re: /^(shopify \(piano\)|app shopify|klaviyo|server plan)$/, tabs: ["pnl"] },
  { id: "voce", re: /^(voce|metrica)$/ },
  { id: "incidenza", re: /^(%|% fatt\.?)$/ },
  { id: "prec", re: /^prec\.?$/ },
  { id: "totale", re: /^totale$/ },
  { id: "lordo", re: /^lordo$/ },
  { id: "imponibile", re: /^imponibile$/ },
  { id: "aliquota", re: /^aliquota$/ },
  { id: "regime", re: /^regime$/ },
  { id: "resi", re: /^resi( .)?$/ },
  { id: "perimetro", re: /^perimetro$/ },
  { id: "venditeReport", re: /^vendite da report$/ },
  { id: "rettificaGift", re: /^rettifica gift card$/ },
  { id: "corrispettivo", re: /^corrispettivo$/ },
  { id: "giornoPaese", re: /^giorno e paese$/ },
  { id: "scenario", re: /^(conservativo|base|aggressivo)$/ },
  { id: "marginePerOrdine", re: /^margine per ordine$/ },
  { id: "marginePct", re: /^(margine %|net margin %.*)$/ },
  { id: "profittoLordo", re: /^profitto lordo/ },
  { id: "profittoNetto", re: /^profitto netto/ },
  { id: "fasciaOraria", re: /^\d\d-\d\d$/ },
  { id: "migliore", re: /^migliore$/ },
  { id: "regione", re: /^(regione|provincia)$/ },
  { id: "periodo", re: /^((gennaio|febbraio|marzo|aprile|maggio|giugno|luglio|agosto|settembre|ottobre|novembre|dicembre|january|february|march|april|may|june|july|august|september|october|november|december) \d{4}|q[1-4] \d{4}|\d{4}|\d\d\/\d\d . \d\d\/\d\d|(gen|feb|mar|apr|mag|giu|lug|ago|set|ott|nov|dic) \d\d)$/ },
  { id: "annoPrima", re: /^\d\d$/, tabs: ["weekly", "monthly", "quarter", "year", "pnl"] },
  { id: "prodotto", re: /^(prodotto|articolo|product)$/ },
  { id: "campagna", re: /^(campagna|campagne|nome|campaign)$/ },
  { id: "anteprima", re: /^anteprima$/ },
  { id: "data", re: /^(data|date)$/ },
  { id: "valore", re: /^valore$/ },
  { id: "bandaVendite", re: /^vendite$/, tabs: ["kpiBrain"] },
  { id: "bandaTraffico", re: /^traffico$/ },
  { id: "bandaResa", re: /^resa$/ },
]

export function normalizza(testo) {
  return String(testo || '').split('\n')[0].toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[▾▴↑↓›]/g, '').replace(/stima$/i, '').replace(/^[\s−–\-=+×·•]+/, '').replace(/\s+/g, ' ').trim()
}

// → { id } della prima voce che combacia, oppure null
export function trovaVoce(testo, tab) {
  const n = normalizza(testo)
  if (!n || n.length > 60) return null
  for (const v of VOCI) { if (v.tabs && !v.tabs.includes(tab)) continue; if (v.re.test(n)) return v }
  return null
}
