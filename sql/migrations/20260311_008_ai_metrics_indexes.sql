-- Optimizar consultas de historico y metricas
create index if not exists idx_cases_tipo_proceso_estado
  on public.cases(tipo_proceso, estado);

create index if not exists idx_case_ai_suggestions_fue_correcta
  on public.case_ai_suggestions(fue_correcta);
