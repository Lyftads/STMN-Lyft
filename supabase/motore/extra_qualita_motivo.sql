-- Il motivo della bocciatura, accanto al voto.
--
-- Senza, il motore impara la lezione sbagliata. Le creativita' della bag in box
-- sono state segnate MALE perche' il modello disegnava una maniglia che sporge
-- dalla scatola — un difetto del PRODOTTO — e l'apprendimento, che ragiona per
-- assi di scena, ne ha dedotto che frantoio, dispensa, tramonto e tre-quarti
-- fossero ambientazioni sbagliate. Sono quattro scene ottime, condannate per
-- colpa di un manico.
--
--   'prodotto' = la confezione e' resa male (dettagli inventati, scala, colori)
--                → NON insegna niente sulla scena: si corregge la specifica
--   'scena'    = l'ambientazione, la luce o l'inquadratura non funzionano
--                → questo si', pesa sugli assi
--
-- NULL = motivo non indicato: si comporta come 'scena', cioe' come prima.

ALTER TABLE ce_creatives
  ADD COLUMN IF NOT EXISTS qualita_motivo text;

ALTER TABLE ce_creatives
  DROP CONSTRAINT IF EXISTS ce_creatives_qualita_motivo_chk;

ALTER TABLE ce_creatives
  ADD CONSTRAINT ce_creatives_qualita_motivo_chk
  CHECK (qualita_motivo IS NULL OR qualita_motivo IN ('prodotto', 'scena'));

-- Le otto gia' bocciate lo sono per il prodotto: maniglia inventata sulla bag,
-- tappo e retino inventati sulle lattine. Verificate una per una contro le foto
-- vere del sito.
UPDATE ce_creatives
   SET qualita_motivo = 'prodotto'
 WHERE qualita = 'male' AND qualita_motivo IS NULL;
