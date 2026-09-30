create or replace function public.get_admin_dashboard_stats()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result jsonb;
begin
  if not private.is_subscription_admin() then
    raise exception 'ADMIN_REQUIRED' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'total_aliases', (select count(*) from public.aliases),
    'total_customers', (select count(*) from public.user_subscriptions),
    'free', (select count(*) from public.user_subscriptions where plan = 'free'),
    'starter', (select count(*) from public.user_subscriptions where plan = 'starter'),
    'pro', (select count(*) from public.user_subscriptions where plan = 'pro'),
    'business', (select count(*) from public.user_subscriptions where plan = 'business')
  ) into result;

  return result;
end;
$$;

revoke all on function public.get_admin_dashboard_stats() from public, anon;
grant execute on function public.get_admin_dashboard_stats() to authenticated;
