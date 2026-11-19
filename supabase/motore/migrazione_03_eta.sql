-- ============================================================================
--  Migrazione 03 — età dell'inserzione.
--  Serve a non spegnere creatività giovani: nella finestra di 7 giorni una
--  nata ieri e una che gira da sei mesi sono indistinguibili. Senza questo
--  dato "poca spesa" si confonde con "appena partita".
-- ============================================================================
alter table ce_creatives add column if not exists ad_created_at timestamptz;
