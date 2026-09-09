-- Biblioteca file-first: metadatos de archivo fuente, plantillas normalizadas y trazabilidad.

alter table public.knowledge_documents
  add column if not exists resumen_texto text,
  add column if not exists source_file_name text,
  add column if not exists source_file_path text,
  add column if not exists source_file_mime text,
  add column if not exists source_file_size bigint,
  add column if not exists decision_type_normalized varchar(80),
  add column if not exists decision_type_alias text,
  add column if not exists replaceable_fields text[] not null default '{}',
  add column if not exists processing_status varchar(32) not null default 'processed';

update public.knowledge_documents
set
  replaceable_fields = coalesce(replaceable_fields, '{}'),
  processing_status = coalesce(nullif(processing_status, ''), 'processed')
where true;

create index if not exists idx_knowledge_documents_decision_type
  on public.knowledge_documents(profile_id, decision_type_normalized, updated_at desc)
  where activo = true;

create index if not exists idx_knowledge_documents_replaceable_fields
  on public.knowledge_documents using gin(replaceable_fields);

create index if not exists idx_knowledge_documents_source_file_path
  on public.knowledge_documents(source_file_path)
  where source_file_path is not null;

insert into storage.buckets (id, name, public)
values ('decision-documents', 'decision-documents', false)
on conflict (id) do nothing;
