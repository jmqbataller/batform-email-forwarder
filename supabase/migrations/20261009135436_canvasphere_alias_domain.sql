alter table public.aliases drop constraint aliases_domain_check;
alter table public.aliases add constraint aliases_domain_check
  check (domain in ('dnd.cspro.space', 'cspro.space', 'beng.canvasphere.cyou'));
