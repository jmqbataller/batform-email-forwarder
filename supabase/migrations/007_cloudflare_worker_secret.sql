do $$
begin
  if not exists (
    select 1
    from vault.secrets
    where name = 'batmail_cloudflare_worker_secret'
  ) then
    perform vault.create_secret(
      encode(gen_random_bytes(32), 'hex'),
      'batmail_cloudflare_worker_secret',
      'Shared authentication secret for the BatMail Cloudflare Email Worker'
    );
  end if;
end;
$$;
