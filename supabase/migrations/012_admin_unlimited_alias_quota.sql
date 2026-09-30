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
  if private.is_subscription_admin() then
    return new;
  end if;

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
