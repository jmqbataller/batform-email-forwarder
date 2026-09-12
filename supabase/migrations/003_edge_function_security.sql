create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create table if not exists private.allowed_accounts (
  email extensions.citext primary key,
  created_at timestamptz not null default now()
);

alter table private.allowed_accounts enable row level security;
revoke all on private.allowed_accounts from public, anon, authenticated;

create or replace function public.is_signup_allowed(candidate_email text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from private.allowed_accounts
    where email = lower(candidate_email)
  );
$$;

revoke all on function public.is_signup_allowed(text) from public;
revoke all on function public.is_signup_allowed(text) from anon;
revoke all on function public.is_signup_allowed(text) from authenticated;
grant execute on function public.is_signup_allowed(text) to anon, authenticated;

drop policy if exists "Users can create aliases for themselves" on public.aliases;
create policy "Users can create aliases for themselves"
  on public.aliases for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and destination = lower((select auth.jwt()) ->> 'email')
    and public.is_signup_allowed((select auth.jwt()) ->> 'email')
  );

drop policy if exists "Users can update their aliases" on public.aliases;
create policy "Users can update their aliases"
  on public.aliases for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and destination = lower((select auth.jwt()) ->> 'email')
    and public.is_signup_allowed((select auth.jwt()) ->> 'email')
  );

create or replace function public.get_batmail_secret(secret_name text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret
  from vault.decrypted_secrets
  where name = secret_name
  limit 1;
$$;

revoke all on function public.get_batmail_secret(text) from public;
revoke all on function public.get_batmail_secret(text) from anon;
revoke all on function public.get_batmail_secret(text) from authenticated;
grant execute on function public.get_batmail_secret(text) to service_role;
