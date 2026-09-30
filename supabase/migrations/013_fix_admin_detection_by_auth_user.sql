create or replace function private.is_subscription_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from auth.users u
    join private.allowed_accounts a
      on lower(a.email) = lower(u.email)
    where u.id = auth.uid()
  );
$$;

create or replace function public.is_subscription_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.is_subscription_admin();
$$;

grant execute on function public.is_subscription_admin() to authenticated;
