create table if not exists public.assistant_interactions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete set null,
  question text not null,
  normalized_question text not null,
  response_json jsonb not null,
  helpful boolean,
  feedback_notes text,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create index if not exists idx_assistant_interactions_case_id
  on public.assistant_interactions(case_id);

create index if not exists idx_assistant_interactions_created_at
  on public.assistant_interactions(created_at desc);

create index if not exists idx_assistant_interactions_helpful
  on public.assistant_interactions(helpful);

drop trigger if exists trg_assistant_interactions_updated_at on public.assistant_interactions;
create trigger trg_assistant_interactions_updated_at
before update on public.assistant_interactions
for each row
execute function public.set_updated_at();
