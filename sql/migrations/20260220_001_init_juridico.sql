create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists cases (
  id uuid primary key default gen_random_uuid(),
  radicado varchar(50) not null,
  demandante_nombre varchar(255) not null,
  demandado_nombre varchar(255) not null,
  tipo_proceso varchar(100) not null,
  subtipo_proceso varchar(100),
  cuantia numeric,
  competencia_territorial varchar(255),
  despacho varchar(255),
  estado varchar(50) not null default 'pendiente',
  decision_sugerida varchar(50),
  decision_final varchar(50),
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create trigger trg_cases_updated_at
before update on cases
for each row
execute function set_updated_at();

create table if not exists case_requirements_check (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  cumple_art_82 boolean not null default false,
  anexos_completos boolean not null default false,
  poder_aportado boolean not null default false,
  legitimacion_causa boolean not null default false,
  competencia_valida boolean not null default false,
  titulo_ejecutivo_valido boolean not null default false,
  indebida_acumulacion boolean not null default false,
  caducidad boolean not null default false,
  prescripcion boolean not null default false,
  observaciones text,
  created_at timestamp not null default now()
);

create table if not exists decisions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references cases(id) on delete cascade,
  tipo_decision varchar(50) not null,
  fundamento_juridico text not null,
  motivacion text not null,
  articulos_aplicados text not null,
  fecha_generacion timestamp not null default now(),
  documento_url text,
  created_at timestamp not null default now()
);

create table if not exists legal_articles (
  id uuid primary key default gen_random_uuid(),
  codigo varchar(20) not null,
  nombre varchar(255) not null,
  descripcion text not null,
  aplica_a varchar(100) not null,
  created_at timestamp not null default now(),
  unique(codigo)
);

create table if not exists rule_definitions (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(255) not null,
  descripcion text not null,
  condicion_json jsonb not null,
  resultado varchar(50) not null,
  fundamento text not null,
  prioridad integer not null,
  activo boolean not null default true,
  created_at timestamp not null default now()
);

create index if not exists idx_cases_estado on cases(estado);
create index if not exists idx_cases_radicado on cases(radicado);
create index if not exists idx_case_requirements_case_id on case_requirements_check(case_id);
create index if not exists idx_decisions_case_id on decisions(case_id);
create index if not exists idx_legal_articles_aplica_a on legal_articles(aplica_a);
create index if not exists idx_rule_definitions_activo_prioridad on rule_definitions(activo, prioridad);