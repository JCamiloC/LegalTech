create table if not exists public.case_documents (
  id uuid primary key default gen_random_uuid(),
  case_id uuid not null references public.cases(id) on delete cascade,
  file_name text not null,
  mime_type text not null default 'application/pdf',
  source_type text not null default 'uploaded_pdf',
  storage_path text,
  extracted_text text,
  uploaded_by uuid references public.profiles(id) on delete set null,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.case_document_extractions (
  id uuid primary key default gen_random_uuid(),
  case_document_id uuid not null references public.case_documents(id) on delete cascade,
  extractor_engine text not null,
  extraction_json jsonb not null,
  confidence_score numeric,
  created_at timestamp not null default now()
);

create table if not exists public.library_sources (
  id uuid primary key default gen_random_uuid(),
  nombre text not null,
  tipo text not null,
  descripcion text,
  activo boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.library_documents (
  id uuid primary key default gen_random_uuid(),
  source_id uuid references public.library_sources(id) on delete set null,
  titulo text not null,
  tipo_documento text,
  storage_path text,
  content_text text,
  metadata_json jsonb,
  activo boolean not null default true,
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.library_chunks (
  id uuid primary key default gen_random_uuid(),
  library_document_id uuid not null references public.library_documents(id) on delete cascade,
  chunk_index integer not null,
  chunk_text text not null,
  embedding_json jsonb,
  metadata_json jsonb,
  created_at timestamp not null default now(),
  unique (library_document_id, chunk_index)
);

create table if not exists public.assistant_sessions (
  id uuid primary key default gen_random_uuid(),
  case_id uuid references public.cases(id) on delete set null,
  profile_id uuid references public.profiles(id) on delete set null,
  titulo text,
  status text not null default 'active',
  created_at timestamp not null default now(),
  updated_at timestamp not null default now()
);

create table if not exists public.assistant_messages (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.assistant_sessions(id) on delete cascade,
  role text not null,
  content text not null,
  source_json jsonb,
  created_at timestamp not null default now()
);

create table if not exists public.assistant_feedback_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references public.assistant_sessions(id) on delete set null,
  interaction_id uuid,
  helpful boolean,
  notes text,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamp not null default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'public'
      and table_name = 'assistant_interactions'
  ) then
    if not exists (
      select 1
      from information_schema.table_constraints
      where table_schema = 'public'
        and table_name = 'assistant_feedback_events'
        and constraint_name = 'fk_assistant_feedback_interaction'
    ) then
      alter table public.assistant_feedback_events
      add constraint fk_assistant_feedback_interaction
      foreign key (interaction_id)
      references public.assistant_interactions(id)
      on delete set null;
    end if;
  end if;
end $$;

create index if not exists idx_case_documents_case_id on public.case_documents(case_id);
create index if not exists idx_case_documents_created_at on public.case_documents(created_at desc);
create index if not exists idx_case_document_extractions_doc_id on public.case_document_extractions(case_document_id);
create index if not exists idx_library_documents_source_id on public.library_documents(source_id);
create index if not exists idx_library_documents_activo on public.library_documents(activo);
create index if not exists idx_library_chunks_document_id on public.library_chunks(library_document_id);
create index if not exists idx_assistant_sessions_case_id on public.assistant_sessions(case_id);
create index if not exists idx_assistant_messages_session_id on public.assistant_messages(session_id);
create index if not exists idx_assistant_feedback_interaction_id on public.assistant_feedback_events(interaction_id);

drop trigger if exists trg_case_documents_updated_at on public.case_documents;
create trigger trg_case_documents_updated_at
before update on public.case_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_library_sources_updated_at on public.library_sources;
create trigger trg_library_sources_updated_at
before update on public.library_sources
for each row execute function public.set_updated_at();

drop trigger if exists trg_library_documents_updated_at on public.library_documents;
create trigger trg_library_documents_updated_at
before update on public.library_documents
for each row execute function public.set_updated_at();

drop trigger if exists trg_assistant_sessions_updated_at on public.assistant_sessions;
create trigger trg_assistant_sessions_updated_at
before update on public.assistant_sessions
for each row execute function public.set_updated_at();
