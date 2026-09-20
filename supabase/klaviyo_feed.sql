-- Le due convenzioni di catalogo che la ricostruzione dei blocchi prodotto delle email Klaviyo
-- (lib/klaviyo/feedRicostruito.js) leggeva come costanti nel fork a cliente singolo.
--
-- Nel fork stavano scritte nel codice perche' il negozio era uno solo. Qui i clienti sono tanti e
-- hanno cataloghi diversi: una tabella di alias tarata su un negozio, applicata a un altro, riempie
-- il blocco di un'email con i prodotti del marchio SBAGLIATO — e il blocco, nell'anteprima, sembra
-- l'email vera. E' il modo peggiore di sbagliare: silenzioso e credibile.
--
-- Entrambe VUOTE di serie, e vuote vogliono dire "nessun filtro":
--   alias vuoti     -> il feed si aggancia al marchio solo se il nome combacia col vendor
--   metafield vuoto -> la categoria non esiste, e il blocco si riempie col marchio soltanto
-- Nessun cliente perde qualcosa il giorno del rilascio, perche' oggi questa funzione non c'e'.

-- Dal marchio COMMERCIALE usato nel nome del feed al vendor scritto a catalogo.
-- Esempio: {"alviero": "1ª CLASSE", "alvieromartini": "1ª CLASSE"}.
-- La chiave si confronta normalizzata (minuscole, senza spazi ne' punteggiatura), quindi
-- "Alviero Martini" e "alvieromartini" sono la stessa chiave.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS klaviyo_alias_marchi jsonb NOT NULL DEFAULT '{}'::jsonb;

-- Il metafield di prodotto da cui si legge la categoria, nella forma "namespace.chiave"
-- (sul negozio del fork: "pdp.categoria"). Serve a riconoscere nel nome del feed la categoria
-- oltre al marchio. Vuoto = la categoria non si legge e non si filtra.
-- NULL e non stringa vuota: NULL e' "non chiesto", e si distingue da "chiesto, non ce l'ho".
ALTER TABLE companies ADD COLUMN IF NOT EXISTS metafield_categoria text;
