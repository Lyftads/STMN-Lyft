-- Migrazione 23 — conservare l'URL della scena generata.
--
-- Perché: il livello di brand si compone SOPRA la scena, e finora la scena
-- veniva buttata via subito dopo. Quando la composizione è uscita sbagliata —
-- il testo ridotto a quadratini perché il font non si risolveva su Vercel —
-- ricomporre è stato impossibile: l'unico modo era RIGENERARE le scene, a 6
-- crediti a creatività, per un difetto che non c'entrava niente con la scena.
--
-- Con l'URL salvato, correggere il compositore e ricomporre costa zero.
alter table ce_creatives add column if not exists scena_url text;
