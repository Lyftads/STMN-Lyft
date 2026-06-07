-- Per-client UI language binding.
-- Each company (1 row per registered owner, PK = user_id) stores its preferred
-- interface language. The dashboard reads it on load so each client starts in
-- their own language; the language switcher writes it back here.
--
-- Allowed values mirror lib/i18n/locales.js LOCALES: 'it' | 'en' | 'es' | 'fr' | 'de'.
-- NULL = "not chosen yet" → the dashboard auto-detects (browser language, then
-- IP country) until the client (or an admin) sets a language explicitly.

alter table public.companies
  add column if not exists language text;

-- If the column was previously created as NOT NULL DEFAULT 'it', relax it so that
-- "never chosen" can be distinguished from an explicit Italian choice.
alter table public.companies alter column language drop default;
do $$
begin
  begin
    alter table public.companies alter column language drop not null;
  exception when others then null;
  end;
end $$;

-- Light guard against unexpected values (kept permissive: unknown codes fall back
-- to Italian client-side anyway via the i18n fallback chain). NULL stays allowed.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'companies_language_check'
  ) then
    alter table public.companies
      add constraint companies_language_check
      check (language is null or language in ('it','en','es','fr','de'));
  end if;
end $$;
