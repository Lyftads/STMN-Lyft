-- Migrazione 21 — giudizio di QUALITÀ sulla generazione.
--
-- È una cosa diversa dal verdetto sulle performance. Il verdetto (scala/tieni/
-- spegni) dice come ha reso una creatività una volta lanciata; la qualità dice
-- se il MOTORE l'ha prodotta bene — se la scena regge, se il prodotto è fedele,
-- se il copy sta in piedi. Una creatività può essere fatta benissimo e rendere
-- male, e viceversa: tenerle sullo stesso campo renderebbe impossibile capire
-- quale delle due cose migliorare.
--
-- Serve a chiudere l'anello: la firma della combinazione (variante_seme) dice
-- quali ambiente, soggetto, luce, inquadratura e palette hanno prodotto quel
-- risultato, quindi dal giudizio si risale a COSA ha funzionato.
alter table ce_creatives add column if not exists qualita    text;
alter table ce_creatives add column if not exists qualita_il timestamptz;

alter table ce_creatives drop constraint if exists ce_creatives_qualita_chk;
alter table ce_creatives add  constraint ce_creatives_qualita_chk
  check (qualita is null or qualita in ('male','buona','ottima'));

create index if not exists ce_creatives_qualita_idx on ce_creatives(workspace_id, qualita);
