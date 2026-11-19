-- Migrazione 19 — metriche video per creatività.
--
-- Perché servono: un video oggi si giudica solo sul ROAS, cioè quando ha già
-- speso. Hook rate e hold rate dicono MOLTO prima se il problema c'è e dove
-- sta, e sono due problemi diversi:
--   hook rate = riproduzioni / impression → l'ATTACCO ferma lo scroll?
--   hold rate = thruplay / riproduzioni   → il CONTENUTO regge chi si è fermato?
-- Un hook alto con hold basso è un video che promette e non mantiene: rifarne
-- l'attacco lo peggiora. Confonderli porta a rifare la cosa sbagliata.
alter table ce_kpi_daily add column if not exists video_plays        bigint  default 0;
alter table ce_kpi_daily add column if not exists video_p25          bigint  default 0;
alter table ce_kpi_daily add column if not exists video_p50          bigint  default 0;
alter table ce_kpi_daily add column if not exists video_p75          bigint  default 0;
alter table ce_kpi_daily add column if not exists video_p100         bigint  default 0;
alter table ce_kpi_daily add column if not exists video_thruplay     bigint  default 0;
alter table ce_kpi_daily add column if not exists video_secondi_medi numeric default 0;
