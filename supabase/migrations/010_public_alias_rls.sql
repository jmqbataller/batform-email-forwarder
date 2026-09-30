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
