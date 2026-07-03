-- Gate piano per volume ordini (onboarding step 1 + verifica Shopify).
-- declared_monthly_orders  = fascia dichiarata dal cliente nello step 1 (valore
--                            rappresentativo della fascia scelta).
-- verified_monthly_orders  = media mensile REALE ricavata da Shopify (ordini
--                            ultimi 90 giorni / 3). È la "prova del 9": ha
--                            priorità sul dichiarato per stabilire il piano minimo.
ALTER TABLE companies ADD COLUMN IF NOT EXISTS declared_monthly_orders integer;
ALTER TABLE companies ADD COLUMN IF NOT EXISTS verified_monthly_orders integer;
