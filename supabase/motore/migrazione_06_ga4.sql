-- Migrazione 06 — marca i giorni GA4 ancora in elaborazione.
-- Senza questo flag il freno del CR scambia la latenza di GA4 (24-48h) per un
-- crollo del tasso di conversione e blocca gli aumenti di budget ogni notte.
alter table ce_business_daily add column if not exists ga4_provvisorio boolean;
