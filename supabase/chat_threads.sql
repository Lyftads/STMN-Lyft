-- Thread: risposte in conversazione. thread_root = id del messaggio radice.
alter table channel_messages add column if not exists thread_root uuid;
alter table channel_messages add column if not exists reply_count int default 0;
create index if not exists idx_channel_messages_thread on channel_messages(thread_root);
