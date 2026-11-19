-- Migrazione 22 — ordine manuale dentro l'angolo, e accoppiamento dei formati.
--
-- Perché serve: dentro un angolo le creatività escono ordinate per nome, e le
-- due versioni della STESSA creatività (1:1 e 9:16) finiscono lontane fra loro
-- quando i nomi non combaciano — importate da cartelle diverse, rinominate,
-- spostate. Confrontare un formato con l'altro diventa impossibile.
--
-- `coppia` lega le due versioni: è l'informazione vera. `ordine` serve a
-- disporre i gruppi a mano quando l'accoppiamento automatico non basta.
alter table ce_creatives add column if not exists ordine integer;
alter table ce_creatives add column if not exists coppia text;

create index if not exists ce_creatives_coppia_idx on ce_creatives(workspace_id, coppia);
