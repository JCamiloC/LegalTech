-- Campo para guardar borrador editable de la parte motiva
alter table public.cases
  add column if not exists parte_motiva_borrador text;

-- Historico de sugerencias de IA por caso
create table if not exists public.case_ai_suggestions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  decision_sugerida text not null,
  confianza text not null,
  fundamento_json jsonb,
  analisis_checklist text,
  parte_motiva_borrador text,
  defectos_json jsonb,
  casos_similares_usados integer not null default 0,
  fue_correcta boolean,
  decision_final_real text,
  created_at timestamp not null default now()
);

create index if not exists idx_case_ai_suggestions_case_id
  on public.case_ai_suggestions(case_id);

create index if not exists idx_case_ai_suggestions_created_at
  on public.case_ai_suggestions(created_at desc);
