-- Migrazione 17 — tracciare la spesa del motore sui crediti immagini.
--
-- Perché serve: l'API di generazione (platform.higgsfield.ai) NON espone il
-- saldo, e le sue generazioni non compaiono fra le transazioni
-- dell'abbonamento — sono due borsellini diversi. Senza un contatore locale
-- l'avviso "stai finendo i crediti" non scatterebbe MAI, e la pipeline si
-- fermerebbe a metà lotto senza preavviso: esattamente ciò che il banner
-- doveva impedire.
alter table ce_crediti add column if not exists spesi_dal_motore numeric not null default 0;
alter table ce_crediti add column if not exists impostato_il timestamptz;
