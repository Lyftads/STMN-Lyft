-- ============================================================================
--  Lyft Studio — le chiavi che ogni cliente inserisce dalla tab Integrazioni
--  (18 novembre 2026): ChatGPT (OpenAI), Claude (Anthropic), Higgsfield e la
--  casella di posta (IMAP/SMTP).
--
--  Il valore e' SEMPRE cifrato dall'app (AES-256-GCM, chiave nella variabile
--  STUDIO_CHIAVE_SEGRETI): chi legge la tabella non legge le chiavi. In chiaro
--  resta solo `etichetta`, la coda mascherata che si mostra nell'interfaccia.
--
--  Accesso solo con la service-role (RLS accesa, nessuna policy).
-- ============================================================================
create table if not exists studio_chiavi (
  workspace_id   uuid not null,                 -- companies.user_id
  servizio       text not null check (servizio in ('openai', 'anthropic', 'higgsfield', 'posta')),
  dati_cifrati   text not null,
  etichetta      text,                          -- es. "sk-…a1B2" oppure l'indirizzo della casella
  verificata_il  timestamptz,                   -- null = salvata senza poterla provare
  aggiornata_il  timestamptz not null default now(),
  aggiornata_da  uuid,
  primary key (workspace_id, servizio)
);
alter table studio_chiavi enable row level security;
