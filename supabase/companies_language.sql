-- Per-client UI language binding.
-- Each company (1 row per registered owner, PK = user_id) stores its preferred
-- interface language. The dashboard reads it on load so each client starts in
-- their own language; the language switcher writes it back here.
--
-- Allowed values mirror lib/i18n/locales.js LOCALES: 'it' | 'en' | 'es' | 'fr' | 'de'.
-- Default 'it' keeps existing clients on the original source strings (no change).

alter table public.companies
  add column if not exists language text not null default 'it';

-- Light guard against unexpected values (kept permissive: unknown codes fall back
-- to Italian client-side anyway via the i18n fallback chain).
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_language_check'
  ) then
    alter table public.companies
      add constraint companies_language_check
      check (language in ('it','en','es','fr','de'));
  end if;
end $$;
