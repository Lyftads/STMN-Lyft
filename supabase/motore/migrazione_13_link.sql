-- Migrazione 13 — dove porta ogni creatività.
-- Il link è anche il segnale più affidabile per capire QUALE prodotto
-- pubblicizza: l'handle sta nell'URL, non serve riconoscerlo da una foto.
alter table ce_creatives add column if not exists link_tipo    text;  -- prodotto|collezione|home|altro
alter table ce_creatives add column if not exists link_handle  text;  -- handle Shopify di destinazione
alter table ce_creatives add column if not exists link_finale  text;  -- dopo i redirect
alter table ce_creatives add column if not exists link_stato   int;   -- HTTP finale
alter table ce_creatives add column if not exists link_utm     jsonb;
