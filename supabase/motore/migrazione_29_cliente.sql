-- ============================================================================
--  Migrazione 29 — la scheda del cliente (18 novembre 2026).
--
--  Il Motore Creativo passa da un cliente solo a un prodotto per piu' clienti.
--  Sito, logo, matrice e descrizione dell'attivita' erano scritti nel codice
--  per Saracino 1925: diventano colonne di ce_brand, una riga per workspace.
--
--  Solo colonne in piu', nessuna tolta: l'app motore-creativo.vercel.app che
--  gira oggi sulle stesse tabelle continua a funzionare identica.
-- ============================================================================
alter table ce_brand add column if not exists sito        text;   -- https://www.esempio.it (per i link ai prodotti)
alter table ce_brand add column if not exists logo        text;   -- URL https del logo chiaro, o nome di un file in assets/motore/logo
alter table ce_brand add column if not exists logo_scuro  text;   -- variante per gli sfondi chiari
alter table ce_brand add column if not exists matrice     text;   -- insieme di segmenti/avatar/template (lib/motore/dati/<nome>)
alter table ce_brand add column if not exists descrizione text;   -- una riga: che cosa vende e a chi

-- Saracino 1925: gli stessi valori che erano nel codice.
update ce_brand set
  sito = coalesce(sito, 'https://www.saracino1925.com'),
  logo = coalesce(logo, 'saracino_bianco.png'),
  matrice = coalesce(matrice, 'saracino'),
  descrizione = coalesce(descrizione, 'un produttore di olio extravergine che vende diretto online')
where workspace_id = 'bf13a806-4c11-45fd-a94a-03bd38cca324';
