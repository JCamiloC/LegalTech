alter table public.case_ai_suggestions
  add column if not exists biblioteca_contexto_json jsonb;

create index if not exists idx_case_ai_suggestions_case_created
  on public.case_ai_suggestions(case_id, created_at desc);