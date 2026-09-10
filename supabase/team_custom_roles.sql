-- ============================================================================
-- Ruoli personalizzati del team
--
-- I quattro ruoli di serie (CRO Specialist, E-commerce Manager, Advertising,
-- Data Analyst) restano nel codice. Qui si aggiungono quelli che ogni azienda
-- si crea da sé — "Magazzino", "Store manager", "Grafico" — che nel codice non
-- possono stare perché cambiano da cliente a cliente.
--
-- Formato: [{ "id": "store_manager", "label": "Store manager" }]
-- Stesso schema di companies.team_hidden_tabs: impostazione del workspace,
-- non una tabella a sé.
-- ============================================================================

alter table companies
  add column if not exists team_custom_roles jsonb default '[]'::jsonb;
