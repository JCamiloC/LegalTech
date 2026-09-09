-- Campos adicionales para extraccion LLM
alter table public.cases
  add column if not exists pretensiones_resumen text,
  add column if not exists hechos_resumen text,
  add column if not exists fecha_demanda date,
  add column if not exists llm_extraccion_json jsonb,
  add column if not exists llm_confianza_promedio text;
