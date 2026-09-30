create table if not exists public.payment_submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  requested_plan text not null check (requested_plan in ('starter','pro','business')),
  amount_php integer not null check (amount_php > 0),
  receipt_path text not null,
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  submitted_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  admin_note text
);

alter table public.payment_submissions enable row level security;

create or replace function private.is_subscription_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.allowed_accounts a
    where lower(a.email) = lower((select auth.jwt()->>'email'))
  );
$$;

create or replace function public.is_subscription_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select private.is_subscription_admin(); $$;

revoke all on function public.is_subscription_admin() from public, anon;
grant execute on function public.is_subscription_admin() to authenticated;

create policy "Users can view own payment submissions"
on public.payment_submissions for select to authenticated
using (user_id = (select auth.uid()) or private.is_subscription_admin());

create policy "Users can submit own payments"
on public.payment_submissions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and status = 'pending'
  and amount_php = case requested_plan when 'starter' then 149 when 'pro' then 349 when 'business' then 749 end
);

create policy "Admins can review payment submissions"
on public.payment_submissions for update to authenticated
using (private.is_subscription_admin())
with check (private.is_subscription_admin());

create or replace function private.activate_manual_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.status = 'pending' and new.status = 'approved' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
    insert into public.user_subscriptions (user_id, plan, status, provider, provider_subscription_id, current_period_end, updated_at)
    values (new.user_id, new.requested_plan, 'active', 'manual_gcash', new.id::text, now() + interval '30 days', now())
    on conflict (user_id) do update set
      plan = excluded.plan,
      status = 'active',
      provider = 'manual_gcash',
      provider_subscription_id = excluded.provider_subscription_id,
      current_period_end = excluded.current_period_end,
      updated_at = now();
  elsif old.status = 'pending' and new.status = 'rejected' then
    new.reviewed_at := coalesce(new.reviewed_at, now());
    new.reviewed_by := coalesce(new.reviewed_by, auth.uid());
  end if;
  return new;
end;
$$;

create trigger activate_manual_subscription_after_review
before update of status on public.payment_submissions
for each row execute function private.activate_manual_subscription();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payment-receipts', 'payment-receipts', false, 5242880, array['image/png','image/jpeg','image/webp','application/pdf'])
on conflict (id) do nothing;

create policy "Users upload own payment receipts"
on storage.objects for insert to authenticated
with check (bucket_id = 'payment-receipts' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "Users view own payment receipts"
on storage.objects for select to authenticated
using (bucket_id = 'payment-receipts' and (owner_id = (select auth.uid())::text or private.is_subscription_admin()));

create policy "Users delete own payment receipts"
on storage.objects for delete to authenticated
using (bucket_id = 'payment-receipts' and owner_id = (select auth.uid())::text);
