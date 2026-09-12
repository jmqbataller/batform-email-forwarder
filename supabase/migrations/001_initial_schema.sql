create extension if not exists citext;

create table public.aliases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  local_part citext not null unique check (local_part ~ '^[a-z0-9][a-z0-9._-]{5,47}$'),
  destination citext not null,
  label text check (char_length(label) <= 60),
  enabled boolean not null default true,
  forwarded_count bigint not null default 0 check (forwarded_count >= 0),
  last_used_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.reverse_aliases (
  id uuid primary key default gen_random_uuid(),
  alias_id uuid not null references public.aliases(id) on delete cascade,
  sender_email citext not null,
  token citext not null unique check (token ~ '^[a-z0-9]{20}$'),
  created_at timestamptz not null default now(),
  unique(alias_id, sender_email)
);

create table public.email_events (
  id uuid primary key default gen_random_uuid(),
  alias_id uuid references public.aliases(id) on delete set null,
  provider_email_id text not null unique,
  direction text not null check (direction in ('inbound', 'reply')),
  original_from citext,
  original_to citext,
  masked_sender citext,
  subject text,
  status text not null check (status in ('processing', 'forwarded', 'blocked', 'failed')),
  error text,
  created_at timestamptz not null default now()
);

create index aliases_user_id_idx on public.aliases(user_id);
create index reverse_aliases_alias_id_idx on public.reverse_aliases(alias_id);
create index email_events_alias_id_created_at_idx on public.email_events(alias_id, created_at desc);

alter table public.aliases enable row level security;
alter table public.reverse_aliases enable row level security;
alter table public.email_events enable row level security;

create policy "Users can view their aliases"
  on public.aliases for select to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can create aliases for themselves"
  on public.aliases for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and destination = lower((select auth.jwt()->>'email'))
  );

create policy "Users can update their aliases"
  on public.aliases for update to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and destination = lower((select auth.jwt()->>'email'))
  );

create policy "Users can delete their aliases"
  on public.aliases for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Users can view activity for their aliases"
  on public.email_events for select to authenticated
  using (
    exists (
      select 1 from public.aliases
      where aliases.id = email_events.alias_id
        and aliases.user_id = (select auth.uid())
    )
  );

create or replace function public.increment_alias_forwarded(target_alias_id uuid)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.aliases
  set forwarded_count = forwarded_count + 1, last_used_at = now()
  where id = target_alias_id;
$$;

revoke all on function public.increment_alias_forwarded(uuid) from public;
revoke all on function public.increment_alias_forwarded(uuid) from anon;
revoke all on function public.increment_alias_forwarded(uuid) from authenticated;
grant execute on function public.increment_alias_forwarded(uuid) to service_role;
