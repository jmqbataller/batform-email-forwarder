create or replace function public.get_admin_customers()
returns table (
  user_id uuid,
  name text,
  email text,
  plan text,
  status text,
  current_period_end timestamptz,
  created_at timestamptz,
  alias_count integer
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_subscription_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  return query
  select
    u.id,
    coalesce(
      nullif(trim(concat_ws(' ', u.raw_user_meta_data ->> 'first_name', u.raw_user_meta_data ->> 'last_name')), ''),
      nullif(u.raw_user_meta_data ->> 'full_name', ''),
      nullif(u.raw_user_meta_data ->> 'name', ''),
      split_part(coalesce(u.email, 'customer'), '@', 1)
    )::text as name,
    coalesce(u.email, '')::text as email,
    coalesce(s.plan, 'free')::text as plan,
    coalesce(s.status, 'active')::text as status,
    s.current_period_end,
    u.created_at,
    (select count(*)::integer from public.aliases a where a.user_id = u.id) as alias_count
  from auth.users u
  left join public.user_subscriptions s on s.user_id = u.id
  order by u.created_at desc;
end;
$$;

revoke all on function public.get_admin_customers() from public, anon;
grant execute on function public.get_admin_customers() to authenticated;

create or replace function public.admin_manage_subscription(
  p_user_id uuid,
  p_action text,
  p_plan text default null,
  p_days integer default 30
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_plan text;
  current_end timestamptz;
  next_end timestamptz;
begin
  if not private.is_subscription_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users where id = p_user_id) then
    raise exception 'CUSTOMER_NOT_FOUND';
  end if;

  if p_days < 1 or p_days > 3650 then
    raise exception 'INVALID_DURATION';
  end if;

  select s.plan, s.current_period_end
    into current_plan, current_end
  from public.user_subscriptions s
  where s.user_id = p_user_id;

  if p_action = 'activate' then
    if p_plan is null or p_plan not in ('starter', 'pro', 'business') then
      raise exception 'INVALID_PLAN';
    end if;

    next_end := now() + make_interval(days => p_days);

    insert into public.user_subscriptions (
      user_id, plan, status, provider, provider_customer_id,
      provider_subscription_id, current_period_end, created_at, updated_at
    ) values (
      p_user_id, p_plan, 'active', 'admin_manual', null,
      null, next_end, now(), now()
    )
    on conflict (user_id) do update set
      plan = excluded.plan,
      status = 'active',
      provider = 'admin_manual',
      provider_customer_id = null,
      provider_subscription_id = null,
      current_period_end = excluded.current_period_end,
      updated_at = now();

  elsif p_action = 'renew' then
    if current_plan is null or current_plan = 'free' then
      raise exception 'NO_PAID_SUBSCRIPTION_TO_RENEW';
    end if;

    next_end := greatest(coalesce(current_end, now()), now()) + make_interval(days => p_days);

    update public.user_subscriptions
    set status = 'active',
        provider = case when provider is null then 'admin_manual' else provider end,
        current_period_end = next_end,
        updated_at = now()
    where user_id = p_user_id;

  elsif p_action = 'revoke' then
    insert into public.user_subscriptions (
      user_id, plan, status, provider, provider_customer_id,
      provider_subscription_id, current_period_end, created_at, updated_at
    ) values (
      p_user_id, 'free', 'active', 'admin_revoked', null,
      null, null, now(), now()
    )
    on conflict (user_id) do update set
      plan = 'free',
      status = 'active',
      provider = 'admin_revoked',
      provider_customer_id = null,
      provider_subscription_id = null,
      current_period_end = null,
      updated_at = now();

  else
    raise exception 'INVALID_ACTION';
  end if;

  return (
    select jsonb_build_object(
      'user_id', s.user_id,
      'plan', s.plan,
      'status', s.status,
      'current_period_end', s.current_period_end,
      'action', p_action
    )
    from public.user_subscriptions s
    where s.user_id = p_user_id
  );
end;
$$;

revoke all on function public.admin_manage_subscription(uuid, text, text, integer) from public, anon;
grant execute on function public.admin_manage_subscription(uuid, text, text, integer) to authenticated;