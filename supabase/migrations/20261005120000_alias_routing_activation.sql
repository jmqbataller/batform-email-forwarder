alter table public.aliases add column routing_ready_at timestamptz;

-- Existing addresses have already been provisioned. Only new or reprovisioned
-- addresses need the activation wait introduced by this change.
update public.aliases set routing_ready_at = created_at;

comment on column public.aliases.routing_ready_at is
  'UI activation deadline after email routing succeeds; null means not provisioned.';
