create or replace function public.enforce_alias_update_window()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_paid_recent boolean;
begin
  if auth.uid() is null then
    return new;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'ALIAS_NOT_OWNED';
  end if;

  if new.user_id is distinct from old.user_id
     or new.destination is distinct from old.destination
     or new.created_at is distinct from old.created_at
     or new.forwarded_count is distinct from old.forwarded_count
     or new.last_used_at is distinct from old.last_used_at then
    raise exception 'ALIAS_IMMUTABLE_FIELD';
  end if;

  if new.local_part is distinct from old.local_part
     or new.label is distinct from old.label then
    select exists (
      select 1
      from public.user_subscriptions s
      where s.user_id = auth.uid()
        and s.plan in ('starter', 'pro', 'business')
        and s.status in ('active', 'trialing')
        and now() < old.created_at + interval '3 minutes'
    ) into is_paid_recent;

    if not is_paid_recent then
      raise exception 'ALIAS_EDIT_LOCKED';
    end if;
  end if;

  return new;
end;
$$;

create or replace function public.enforce_alias_delete_window()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
declare
  is_paid_recent boolean;
begin
  if auth.uid() is null then
    return old;
  end if;

  if old.user_id <> auth.uid() then
    raise exception 'ALIAS_NOT_OWNED';
  end if;

  select exists (
    select 1
    from public.user_subscriptions s
    where s.user_id = auth.uid()
      and s.plan in ('starter', 'pro', 'business')
      and s.status in ('active', 'trialing')
      and now() < old.created_at + interval '3 minutes'
  ) into is_paid_recent;

  if not is_paid_recent then
    raise exception 'ALIAS_DELETE_LOCKED';
  end if;

  return old;
end;
$$;

drop trigger if exists enforce_alias_update_window on public.aliases;
create trigger enforce_alias_update_window
before update on public.aliases
for each row execute function public.enforce_alias_update_window();

drop trigger if exists enforce_alias_delete_window on public.aliases;
create trigger enforce_alias_delete_window
before delete on public.aliases
for each row execute function public.enforce_alias_delete_window();
