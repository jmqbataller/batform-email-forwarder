alter table public.email_events
  add column if not exists text_body text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'email_events_text_body_length_check'
      and conrelid = 'public.email_events'::regclass
  ) then
    alter table public.email_events
      add constraint email_events_text_body_length_check
      check (text_body is null or char_length(text_body) <= 500000);
  end if;
end;
$$;

comment on column public.email_events.text_body is
  'Plain-text email content stored for the authenticated BatMail inbox.';
