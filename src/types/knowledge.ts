export interface KnowledgeProfileRecord {
  id: string;
  nombre: string;
  descripcion: string | null;
  activo: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeProfileSettingsRecord {
  profile_id: string;
  checklist_items: Array<{ key: string; label: string; required: boolean }>;
  critical_fields: string[];
  minimum_confidence: "alto" | "medio" | "bajo";
  block_on_missing: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeFolderRecord {
  id: string;
  profile_id: string;
  nombre: string;
  descripcion: string | null;
  orden: number;
  created_at: string;
}

export interface KnowledgeDocumentRecord {
  id: string;
  profile_id: string;
  folder_id: string | null;
  case_id: string | null;
  titulo: string;
  tipo_documento: string;
  etiquetas: string[];
  contenido_texto: string | null;
  resumen_texto: string | null;
  source_file_name: string | null;
  source_file_path: string | null;
  source_file_mime: string | null;
  source_file_size: number | null;
  decision_type_normalized: string | null;
  decision_type_alias: string | null;
  replaceable_fields: string[];
  processing_status: string;
  metadata_json: Record<string, unknown>;
  activo: boolean;
  created_at: string;
  updated_at: string;
}
