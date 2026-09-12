create policy "No direct client access to allowed accounts"
  on private.allowed_accounts for all to anon, authenticated
  using (false)
  with check (false);
