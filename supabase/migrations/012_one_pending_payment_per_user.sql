create unique index if not exists payment_submissions_one_pending_per_user
on public.payment_submissions (user_id)
where status = 'pending';
