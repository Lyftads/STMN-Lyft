-- Visibilità tab per i membri del team: l'Admin del workspace può nascondere
-- singole tab ai membri (modello "tutti vedono tutto" + override admin).
-- Salvato sulla riga companies del workspace owner. Array di id-tab nascosti.

alter table companies
  add column if not exists team_hidden_tabs jsonb not null default '[]'::jsonb;
