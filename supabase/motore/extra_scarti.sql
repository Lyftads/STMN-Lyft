-- Memoria di cio' che e' stato buttato.
--
-- Cancellare una creativita' cancellava anche le due cose che servivano a non
-- rifarla: il suo `variante_seme`, che dice al generatore "questa combinazione
-- l'hai gia' usata", e il voto di qualita', che dice "quest'ingrediente non
-- funziona". Restava un buco, il generatore lo riempiva, e la creativita'
-- tornava identica il giorno dopo.
--
-- Buttare qualcosa e' un'informazione, la piu' netta che il cliente possa dare.

CREATE TABLE IF NOT EXISTS ce_scarti (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   uuid NOT NULL,
  creative_id    uuid,
  name           text,
  product_id     uuid,
  angle_id       uuid,
  variante_seme  text,
  qualita        text,
  qualita_motivo text,
  scena_desc     text,
  eliminata_il   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ce_scarti_ws_idx   ON ce_scarti (workspace_id);
CREATE INDEX IF NOT EXISTS ce_scarti_seme_idx ON ce_scarti (workspace_id, variante_seme);

ALTER TABLE ce_scarti ENABLE ROW LEVEL SECURITY;
