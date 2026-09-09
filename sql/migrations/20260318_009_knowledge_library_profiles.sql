-- Biblioteca y configuracion por perfil de trabajo juridico
create table if not exists public.knowledge_profiles (
  id uuid primary key default gen_random_uuid(),
  nombre varchar(120) not null,
  descripcion text,
  activo boolean not null default true,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now(),
  unique(nombre)
);

drop trigger if exists trg_knowledge_profiles_updated_at on public.knowledge_profiles;
create trigger trg_knowledge_profiles_updated_at
before update on public.knowledge_profiles
for each row
execute function public.set_updated_at();

create table if not exists public.knowledge_profile_settings (
  profile_id uuid primary key references public.knowledge_profiles(id) on delete cascade,
  checklist_items jsonb not null default '[]'::jsonb,
  critical_fields text[] not null default '{}',
  minimum_confidence text not null default 'medio',
  block_on_missing boolean not null default false,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

drop trigger if exists trg_knowledge_profile_settings_updated_at on public.knowledge_profile_settings;
create trigger trg_knowledge_profile_settings_updated_at
before update on public.knowledge_profile_settings
for each row
execute function public.set_updated_at();

create table if not exists public.knowledge_folders (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.knowledge_profiles(id) on delete cascade,
  nombre varchar(150) not null,
  descripcion text,
  orden integer not null default 100,
  created_at timestamp not null default now(),
  unique(profile_id, nombre)
);

create table if not exists public.knowledge_documents (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.knowledge_profiles(id) on delete cascade,
  folder_id uuid references public.knowledge_folders(id) on delete set null,
  case_id uuid references public.cases(id) on delete set null,
  titulo varchar(180) not null,
  tipo_documento varchar(80) not null,
  etiquetas text[] not null default '{}',
  contenido_texto text,
  metadata_json jsonb not null default '{}'::jsonb,
  activo boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

drop trigger if exists trg_knowledge_documents_updated_at on public.knowledge_documents;
create trigger trg_knowledge_documents_updated_at
before update on public.knowledge_documents
for each row
execute function public.set_updated_at();

create index if not exists idx_knowledge_profiles_activo on public.knowledge_profiles(activo);
create index if not exists idx_knowledge_folders_profile on public.knowledge_folders(profile_id, orden);
create index if not exists idx_knowledge_documents_profile on public.knowledge_documents(profile_id, activo, updated_at desc);
create index if not exists idx_knowledge_documents_folder on public.knowledge_documents(folder_id);
create index if not exists idx_knowledge_documents_case on public.knowledge_documents(case_id);
