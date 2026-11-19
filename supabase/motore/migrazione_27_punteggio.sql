-- ============================================================================
--  Migrazione 27 — punteggio della copy e brief di brand.
--
--  PUNTEGGIO. Ogni copy generata viene giudicata PRIMA di pagare l'immagine su
--  cinque dimensioni da 1 a 5 (gancio, lingua del cliente, obiezione sciolta,
--  chiarezza del prodotto, chiusura). Sotto 15/25 non si produce. Il voto si
--  conserva per una ragione sola: fra qualche settimana i numeri veri diranno
--  se le copy da 22 hanno reso piu' di quelle da 16. Se no, e' il giudice a
--  sbagliare, e lib/calibrazione.js mostra su quali dimensioni.
--
--  BRIEF DI BRAND. Tre cose che il motore non sapeva e che la copy deve avere:
--    · differenziatore — cio' che i concorrenti NON possono dire
--    · obiezioni       — le esitazioni vere di chi compra ("e' tanto olio,
--                        va a male?"), da sciogliere una per copy
--    · prove           — le uniche cifre citabili: {"stelle":4.8,
--                        "recensioni":1240,"numeri":["oltre 30.000 famiglie"],
--                        "testimonianza":"..."}
--  Finche' restano vuote la copy non le usa e non le inventa.
-- ============================================================================
alter table ce_creatives add column if not exists punteggio_copy jsonb;

alter table ce_brand add column if not exists differenziatore text;
alter table ce_brand add column if not exists obiezioni       text[] default '{}';
alter table ce_brand add column if not exists prove           jsonb;
