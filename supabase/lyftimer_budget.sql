-- ============================================================================
-- Lyftimer — Budget & costi progetto
-- Tariffa oraria per membro, budget (ore/€) per progetto, flag billable sulle voci.
-- ============================================================================

alter table team_members add column if not exists hourly_rate numeric;       -- €/ora
alter table projects     add column if not exists budget_hours numeric;       -- budget ore
alter table projects     add column if not exists budget_amount numeric;      -- budget €
alter table time_entries add column if not exists billable boolean default true;
