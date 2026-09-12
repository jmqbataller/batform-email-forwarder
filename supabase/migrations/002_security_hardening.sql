create schema if not exists extensions;
alter extension citext set schema extensions;

drop policy if exists "Users can create aliases for themselves" on public.aliases;
create policy "Users can create aliases for themselves"
  on public.aliases for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and destination = lower((select auth.jwt()) ->> 'email')
  );

drop policy if exists "Users can update their aliases" on public.aliases;
create policy "Users can update their aliases"
  on public.aliases for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and destination = lower((select auth.jwt()) ->> 'email')
  );

create policy "No direct client access to reverse aliases"
  on public.reverse_aliases for all to anon, authenticated
  using (false)
  with check (false);
