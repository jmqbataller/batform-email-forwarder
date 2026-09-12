create extension if not exists pg_cron with schema pg_catalog;

create index if not exists email_events_created_at_idx
  on public.email_events (created_at);

delete from public.email_events
where created_at < now() - interval '30 days';

do $$
declare
  existing_job_id bigint;
begin
  select jobid
    into existing_job_id
  from cron.job
  where jobname = 'delete-email-events-older-than-30-days'
  limit 1;

  if existing_job_id is not null then
    perform cron.unschedule(existing_job_id);
  end if;

  perform cron.schedule(
    'delete-email-events-older-than-30-days',
    '15 18 * * *',
    $retention$
      delete from public.email_events
      where created_at < now() - interval '30 days';
    $retention$
  );
end;
$$;

comment on index public.email_events_created_at_idx is
  'Supports daily cleanup of email events after the 30-day retention period.';
