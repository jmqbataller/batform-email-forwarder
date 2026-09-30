create table public.user_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'starter', 'pro', 'business')),
  status text not null default 'active' check (status in ('active', 'trialing', 'past_due', 'canceled', 'paused')),
  provider text,
  provider_customer_id text,
  provider_subscription_id text,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.user_subscriptions enable row level security;

create policy "Users can view their own subscription"
  on public.user_subscriptions for select to authenticated
  using (user_id = (select auth.uid()));

revoke insert, update, delete on public.user_subscriptions from anon, authenticated;
grant select on public.user_subscriptions to authenticated;

insert into public.user_subscriptions (user_id, plan, status)
select id, 'free', 'active'
from auth.users
on conflict (user_id) do nothing;

create or replace function private.create_default_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.user_subscriptions (user_id, plan, status)
  values (new.id, 'free', 'active')
  on conflict (user_id) do nothing;
  return new;
end;
$$;

revoke all on function private.create_default_subscription() from public, anon, authenticated;

drop trigger if exists on_auth_user_created_subscription on auth.users;
create trigger on_auth_user_created_subscription
after insert on auth.users
for each row execute function private.create_default_subscription();

create or replace function private.enforce_alias_quota()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  current_plan text;
  current_status text;
  alias_limit integer;
  alias_count integer;
begin
  select plan, status
    into current_plan, current_status
  from public.user_subscriptions
  where user_id = new.user_id;

  if current_plan is null then
    current_plan := 'free';
    current_status := 'active';
  end if;

  if current_status not in ('active', 'trialing') then
    current_plan := 'free';
  end if;

  alias_limit := case current_plan
    when 'starter' then 20
    when 'pro' then 100
    when 'business' then 1000
    else 3
  end;

  select count(*) into alias_count
  from public.aliases
  where user_id = new.user_id;

  if alias_count >= alias_limit then
    raise exception 'ALIAS_QUOTA_REACHED';
  end if;

  return new;
end;
$$;

revoke all on function private.enforce_alias_quota() from public, anon, authenticated;

drop trigger if exists enforce_alias_quota_before_insert on public.aliases;
create trigger enforce_alias_quota_before_insert
before insert on public.aliases
for each row execute function private.enforce_alias_quota();
