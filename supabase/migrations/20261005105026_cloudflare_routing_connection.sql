-- Only the authenticated Edge Function's service role may save Cloudflare credentials.
-- Browser/user RPC calls cannot invoke this helper or read Vault secrets.
create or replace function public.set_batmail_cloudflare_configuration(api_token text, zone_id text)
returns void language plpgsql security definer set search_path = ''
as $$
declare
  token_secret_id uuid;
  zone_secret_id uuid;
begin
  if (select auth.jwt()->>'role') is distinct from 'service_role' then
    raise exception 'SERVICE_ROLE_REQUIRED';
  end if;
  if length(api_token) < 20 or length(api_token) > 500 or zone_id !~ '^[a-f0-9]{32}$' then
    raise exception 'INVALID_CLOUDFLARE_CONFIGURATION';
  end if;
  perform pg_advisory_xact_lock(1791197400);
  select id into token_secret_id from vault.secrets where name = 'batmail_cloudflare_api_token';
  select id into zone_secret_id from vault.secrets where name = 'batmail_cloudflare_zone_id';
  if token_secret_id is null then
    perform vault.create_secret(api_token, 'batmail_cloudflare_api_token', 'Cloudflare token for BatMail alias routing');
  else
    perform vault.update_secret(token_secret_id, api_token);
  end if;
  if zone_secret_id is null then
    perform vault.create_secret(zone_id, 'batmail_cloudflare_zone_id', 'Cloudflare zone for cspro.space');
  else
    perform vault.update_secret(zone_secret_id, zone_id);
  end if;
end;
$$;
revoke all on function public.set_batmail_cloudflare_configuration(text,text) from public, anon, authenticated;
grant execute on function public.set_batmail_cloudflare_configuration(text,text) to service_role;
