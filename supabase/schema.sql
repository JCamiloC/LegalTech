create extension if not exists "pgcrypto";

do $$
begin
	if not exists (select 1 from pg_type where typname = 'decision_type') then
		create type decision_type as enum (
			'auto_admisorio',
			'auto_inadmisorio',
			'mandamiento_pago',
			'auto_rechaza_demanda'
		);
	end if;

	if not exists (select 1 from pg_type where typname = 'case_status') then
		create type case_status as enum (
			'pendiente',
			'en_revision',
			'decidido'
		);
	end if;

	if not exists (select 1 from pg_type where typname = 'app_role') then
		create type app_role as enum (
			'admin',
			'operador_juridico',
			'revisor'
		);
	end if;
end
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
	new.updated_at = now();
	return new;
end;
$$;

create table if not exists public.profiles (
	id uuid primary key references auth.users(id) on delete cascade,
	email varchar(255) not null unique,
	full_name varchar(255),
	role app_role not null default 'operador_juridico',
	active boolean not null default true,
	created_at timestamp not null default now(),
	updated_at timestamp not null default now()
);

drop trigger if exists trg_profiles_updated_at on public.profiles;
create trigger trg_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
	insert into public.profiles (id, email, full_name)
	values (new.id, coalesce(new.email, ''), coalesce(new.raw_user_meta_data->>'full_name', null))
	on conflict (id) do update
		set email = excluded.email,
				full_name = coalesce(excluded.full_name, public.profiles.full_name),
				updated_at = now();

	return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

create table if not exists public.cases (
	id uuid primary key default gen_random_uuid(),
	radicado varchar(50) not null,
	demandante_nombre varchar(255) not null,
	demandado_nombre varchar(255) not null,
	tipo_proceso varchar(100) not null,
	subtipo_proceso varchar(100),
	cuantia numeric,
	competencia_territorial varchar(255),
	despacho varchar(255),
	estado case_status not null default 'pendiente',
	decision_sugerida decision_type,
	decision_final decision_type,
	created_at timestamp not null default now(),
	updated_at timestamp not null default now(),
	unique (radicado)
);

drop trigger if exists trg_cases_updated_at on public.cases;
create trigger trg_cases_updated_at
before update on public.cases
for each row
execute function public.set_updated_at();

create table if not exists public.case_requirements_check (
	id uuid primary key default gen_random_uuid(),
	case_id uuid not null references public.cases(id) on delete cascade,
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

create table if not exists public.decisions (
	id uuid primary key default gen_random_uuid(),
	case_id uuid not null references public.cases(id) on delete cascade,
	tipo_decision decision_type not null,
	fundamento_juridico text not null,
	motivacion text not null,
	articulos_aplicados text not null,
	fecha_generacion timestamp not null default now(),
	documento_url text,
	created_at timestamp not null default now()
);

create table if not exists public.legal_articles (
	id uuid primary key default gen_random_uuid(),
	codigo varchar(20) not null unique,
	nombre varchar(255) not null,
	descripcion text not null,
	aplica_a varchar(100) not null,
	created_at timestamp not null default now()
);

create table if not exists public.rule_definitions (
	id uuid primary key default gen_random_uuid(),
	nombre varchar(255) not null,
	descripcion text not null,
	condicion_json jsonb not null,
	resultado decision_type not null,
	fundamento text not null,
	prioridad integer not null,
	activo boolean not null default true,
	created_at timestamp not null default now()
);

create table if not exists public.document_templates (
	id uuid primary key default gen_random_uuid(),
	nombre varchar(255) not null,
	tipo_decision decision_type not null,
	contenido_html text not null,
	activo boolean not null default true,
	created_at timestamp not null default now(),
	updated_at timestamp not null default now()
);

drop trigger if exists trg_document_templates_updated_at on public.document_templates;
create trigger trg_document_templates_updated_at
before update on public.document_templates
for each row
execute function public.set_updated_at();

create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_cases_estado on public.cases(estado);
create index if not exists idx_cases_tipo_proceso on public.cases(tipo_proceso);
create index if not exists idx_case_requirements_case_id on public.case_requirements_check(case_id);
create index if not exists idx_decisions_case_id on public.decisions(case_id);
create index if not exists idx_legal_articles_aplica_a on public.legal_articles(aplica_a);
create index if not exists idx_rule_definitions_activo_prioridad on public.rule_definitions(activo, prioridad);
create index if not exists idx_document_templates_decision on public.document_templates(tipo_decision, activo);

insert into storage.buckets (id, name, public)
values ('decision-documents', 'decision-documents', false)
on conflict (id) do nothing;
