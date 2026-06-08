-- =====================================================================
-- AI Credits — sistema crediti per Creative Studio (generazione immagini/video)
-- I clienti acquistano crediti (Stripe Checkout one-time) e li spendono per
-- generare. Lo scalo e' ATOMICO (RPC security definer) con rimborso se la
-- generazione fallisce. Saldo per utente (companies PK = user_id).
-- Esegui una volta su Supabase (SQL editor).
-- =====================================================================

-- Saldo corrente per utente
create table if not exists public.ai_credits (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  balance    integer not null default 0 check (balance >= 0),
  updated_at timestamptz not null default now()
);

-- Ledger completo (acquisti, spese, rimborsi, grant gratuiti)
create table if not exists public.credit_transactions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users(id) on delete cascade,
  delta      integer not null,                 -- +acquisto / -spesa
  reason     text not null,                    -- purchase | spend | refund | grant
  model      text,                             -- id modello (per spend/refund)
  ref        text,                             -- riferimento (stripe session / generazione)
  balance_after integer,
  created_at timestamptz not null default now()
);

create index if not exists credit_tx_user_idx on public.credit_transactions(user_id, created_at desc);

alter table public.ai_credits enable row level security;
alter table public.credit_transactions enable row level security;

-- L'utente vede SOLO il proprio saldo e storico. Le scritture passano dalle
-- RPC security definer (eseguite con privilegi elevati), mai dal client.
drop policy if exists ai_credits_select_own on public.ai_credits;
create policy ai_credits_select_own on public.ai_credits
  for select using (auth.uid() = user_id);

drop policy if exists credit_tx_select_own on public.credit_transactions;
create policy credit_tx_select_own on public.credit_transactions
  for select using (auth.uid() = user_id);

-- ---------------------------------------------------------------------
-- spend_credits: scala in modo atomico. Ritorna il nuovo saldo, oppure
-- -1 se i crediti sono insufficienti (nessuna modifica).
-- ---------------------------------------------------------------------
create or replace function public.spend_credits(
  p_user uuid, p_amount integer, p_model text default null, p_ref text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.ai_credits(user_id, balance) values (p_user, 0)
    on conflict (user_id) do nothing;

  -- lock della riga del saldo
  select balance into v_balance from public.ai_credits where user_id = p_user for update;

  if v_balance < p_amount then
    return -1;
  end if;

  v_balance := v_balance - p_amount;
  update public.ai_credits set balance = v_balance, updated_at = now() where user_id = p_user;
  insert into public.credit_transactions(user_id, delta, reason, model, ref, balance_after)
    values (p_user, -p_amount, 'spend', p_model, p_ref, v_balance);
  return v_balance;
end;
$$;

-- ---------------------------------------------------------------------
-- add_credits: accredita (acquisto / rimborso / grant). Ritorna nuovo saldo.
-- ---------------------------------------------------------------------
create or replace function public.add_credits(
  p_user uuid, p_amount integer, p_reason text default 'purchase', p_ref text default null, p_model text default null
) returns integer
language plpgsql security definer set search_path = public as $$
declare
  v_balance integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be positive';
  end if;

  insert into public.ai_credits(user_id, balance) values (p_user, p_amount)
    on conflict (user_id) do update set balance = public.ai_credits.balance + p_amount, updated_at = now()
    returning balance into v_balance;

  insert into public.credit_transactions(user_id, delta, reason, model, ref, balance_after)
    values (p_user, p_amount, p_reason, p_model, p_ref, v_balance);
  return v_balance;
end;
$$;

-- Idempotenza acquisti Stripe: evita doppio accredito se il webhook ritenta.
create unique index if not exists credit_tx_purchase_ref_uniq
  on public.credit_transactions(ref) where reason = 'purchase';
