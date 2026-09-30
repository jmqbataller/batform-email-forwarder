create or replace function public.enforce_alias_update_window()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  is_paid_recent boolean;
  is_admin boolean;
begin
  if auth.uid() is null then return new; end if;
  if old.user_id <> auth.uid() then raise exception 'ALIAS_NOT_OWNED'; end if;

  select public.is_subscription_admin() into is_admin;

  if new.user_id is distinct from old.user_id
     or new.destination is distinct from old.destination
     or new.created_at is distinct from old.created_at
     or new.forwarded_count is distinct from old.forwarded_count
     or new.last_used_at is distinct from old.last_used_at then
    raise exception 'ALIAS_IMMUTABLE_FIELD';
  end if;

  if new.local_part is distinct from old.local_part or new.label is distinct from old.label then
    if is_admin then return new; end if;

    select exists (
      select 1 from public.user_subscriptions s
      where s.user_id = auth.uid()
        and s.plan in ('starter','pro','business')
        and s.status in ('active','trialing')
        and now() < old.created_at + interval '3 minutes'
    ) into is_paid_recent;

    if not is_paid_recent then raise exception 'ALIAS_EDIT_LOCKED'; end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_alias_delete_window()
returns trigger
language plpgsql
set search_path to 'public'
as $$
declare
  is_paid_recent boolean;
  is_admin boolean;
begin
  if auth.uid() is null then return old; end if;
  if old.user_id <> auth.uid() then raise exception 'ALIAS_NOT_OWNED'; end if;

  select public.is_subscription_admin() into is_admin;
  if is_admin then return old; end if;

  select exists (
    select 1 from public.user_subscriptions s
    where s.user_id = auth.uid()
      and s.plan in ('starter','pro','business')
      and s.status in ('active','trialing')
      and now() < old.created_at + interval '3 minutes'
  ) into is_paid_recent;

  if not is_paid_recent then raise exception 'ALIAS_DELETE_LOCKED'; end if;
  return old;
end;
$$;