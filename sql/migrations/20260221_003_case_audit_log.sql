create table if not exists public.case_audit_log (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  event_type varchar(100) not null,
  event_data jsonb,
  created_at timestamp not null default now()
);

create index if not exists idx_case_audit_log_case_id_created_at
  on public.case_audit_log(case_id, created_at desc);