-- Messaggi vocali: url dell'audio caricato su Storage.
alter table channel_messages add column if not exists audio_url text;
-- Reazioni emoji: { "👍": ["memberId", ...], ... }
alter table channel_messages add column if not exists reactions jsonb default '{}'::jsonb;
-- Allegati (foto, pdf, file generici)
alter table channel_messages add column if not exists file_url text;
alter table channel_messages add column if not exists file_name text;
alter table channel_messages add column if not exists file_type text;
