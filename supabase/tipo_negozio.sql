-- Che tipo di negozio e' questo cliente. Decide quali funzioni gli si mostrano.
--
-- Marino, 20 set 2026: «Koongo, il drivetostore e la parte dei brand + venduti, compresa la sezione
-- prezzi del merchant, deve funzionare solo se e' un brand che vende altri brand. Ad esempio in
-- Saracino1925 questa cosa non serve a nulla perche' e' un brand che vende solo i suoi prodotti e
-- quindi non ha senso neanche analizzare gli stessi SKU online perche' nessuno li ha.»
--
-- Non basta un interruttore solo, perche' sono tre domande DIVERSE e un cliente puo' rispondere
-- si' a una e no alle altre:
--   multimarca      = vende marchi di altri?        -> "Brand piu' venduti", "Prezzi" (confronto coi
--                     concorrenti: se nessun altro vende i tuoi articoli non c'e' niente da
--                     confrontare, e Google non ha proprio il dato)
--   canali_esclusi  = vende anche sui marketplace?  -> il fatturato Amazon & simili si mostra a
--                     parte e sta fuori dai conti di efficienza (non l'ha generato la pubblicita')
--   negozi_fisici   = ha negozi fisici?             -> le campagne che portano gente in negozio
--                     restano fuori da ROAS e MER, e si contano a parte
-- Un monomarca puo' benissimo vendere su Amazon, e Saracino1925 potrebbe avere negozi.
--
-- Di serie TUTTE SPENTE. Oggi nessuna di queste funzioni esiste in questo repo, quindi il giorno
-- del rilascio nessun cliente puo' perdere qualcosa che gia' usa. Mostrarle a chi non serve invece
-- costa per sempre: pannelli con una barra sola al 100%, una tab che dice "nessun concorrente vende
-- i tuoi articoli", e chiamate a Shopify bruciate per una risposta vuota (il tetto e' ~30 al minuto
-- per negozio, condiviso con tutto il resto).
--
-- multimarca resta NULL finche' non si sa: null non e' "no", e' "non deciso". Serve a distinguere
-- il cliente a cui non l'abbiamo ancora chiesto da quello che ha risposto di no.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS multimarca boolean;
-- Quanti marchi diversi hanno venduto negli ultimi 90 giorni, e quanto pesa il primo: e' la PROVA
-- che si mostra al cliente quando gli si chiede conferma, non un valore da usare di nascosto.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS marchi_rilevati integer;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS quota_primo_marchio numeric;
-- I canali di vendita che stanno fuori dai conti di efficienza. Lista, non booleano: il nome del
-- canale cambia da negozio a negozio (su Anna Virgili e' 'Koongo: Sell on Marketplaces', altrove
-- sara' un'altra app). Vuota = nessuna esclusione.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS canali_esclusi jsonb NOT NULL DEFAULT '[]'::jsonb;
-- Le campagne che portano gente in negozio si riconoscono dal nome. Spento di serie E PER FORZA:
-- un cliente con una campagna chiamata per caso "Drive to Store Launch" se la vedrebbe sparire dal
-- ROAS senza un errore e senza accorgersene.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS negozi_fisici boolean NOT NULL DEFAULT false;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS etichetta_negozi_fisici text;
