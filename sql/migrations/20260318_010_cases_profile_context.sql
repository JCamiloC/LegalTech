-- Vincular casos a perfil de configuracion/biblioteca
alter table public.cases
  add column if not exists profile_id uuid references public.knowledge_profiles(id) on delete set null;

create index if not exists idx_cases_profile_id on public.cases(profile_id);
