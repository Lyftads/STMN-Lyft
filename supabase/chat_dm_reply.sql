-- Messaggi diretti (canali is_dm) + risposte a un messaggio.
alter table channels add column if not exists is_dm boolean default false;
alter table channel_messages add column if not exists reply_to uuid;
alter table channel_messages add column if not exists reply_author text;
alter table channel_messages add column if not exists reply_excerpt text;
