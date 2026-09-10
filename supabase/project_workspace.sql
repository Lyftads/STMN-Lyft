-- ============================================================================
-- Progetto come spazio di lavoro: membri, lead, chat e task multi-assegnatario
--
-- Tre cose che prima non c'erano:
--  1) i progetti hanno membri propri e UN lead (prima "le persone" di un
--     progetto erano solo i responsabili delle sue task: un numero derivato,
--     non una scelta);
--  2) ogni progetto ha la sua chat, appoggiata ai canali già esistenti — così
--     allegati, menzioni e reazioni funzionano senza riscriverli;
--  3) una task può essere assegnata a più persone.
--
-- Workspace-scoped, niente RLS: le route usano la service-role key e filtrano
-- per workspace_id a partire dall'utente loggato.
-- ============================================================================

-- 1) Membri del progetto ------------------------------------------------------
create table if not exists project_members (
  id           uuid primary key default gen_random_uuid(),
  workspace_id uuid not null,
  project_id   uuid not null references projects(id) on delete cascade,
  member_id    uuid not null,              -- team_members.id
  is_lead      boolean not null default false,
  added_by     uuid,
  created_at   timestamptz default now(),
  unique (project_id, member_id)
);

create index if not exists idx_project_members_ws      on project_members(workspace_id);
create index if not exists idx_project_members_project on project_members(project_id);

-- Il lead è UNO per progetto: se lo si garantisce qui, nessuna corsa fra due
-- salvataggi può lasciarne due (in UI si limita a spostare la spunta).
create unique index if not exists idx_project_one_lead
  on project_members(project_id) where is_lead;

-- 2) Descrizione e periodo del progetto --------------------------------------
-- Nell'intestazione servono le righe sotto il titolo ("28 Agosto - 2 Settembre
-- B2B"): description esiste già, mancavano le date.
alter table projects add column if not exists start_date date;
alter table projects add column if not exists end_date   date;

-- 3) Chat di progetto ---------------------------------------------------------
-- Il canale del progetto È un canale di LyftTalk: stessa conversazione, vista
-- da due punti. Compare nell'elenco dei canali come gli altri e si apre anche
-- dalla tab Chat del progetto; messaggi, allegati, menzioni e reazioni sono
-- gli stessi. project_id serve solo a sapere quale canale appartiene a quale
-- progetto, non a nasconderlo.
alter table channels add column if not exists project_id uuid references projects(id) on delete cascade;
create index if not exists idx_channels_project on channels(project_id);

-- 4) Task assegnate a più persone --------------------------------------------
-- `assignee_id` resta e continua a indicare il responsabile principale (lo
-- usano board, filtri e promemoria); `assignees` contiene tutti, incluso lui.
-- Tenere entrambi evita di riscrivere ogni query esistente per una funzione in
-- più, e le task già create restano valide.
alter table tasks add column if not exists assignees uuid[] default '{}';

-- Allinea lo storico: chi aveva un responsabile entra anche nel nuovo elenco.
update tasks
   set assignees = array[assignee_id]
 where assignee_id is not null
   and (assignees is null or cardinality(assignees) = 0);
