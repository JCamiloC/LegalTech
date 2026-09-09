import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  KnowledgeDocumentRecord,
  KnowledgeFolderRecord,
  KnowledgeProfileRecord,
  KnowledgeProfileSettingsRecord,
} from "@/types/knowledge";

const DEFAULT_SETTINGS: Omit<KnowledgeProfileSettingsRecord, "profile_id" | "created_at" | "updated_at"> = {
  checklist_items: [],
  critical_fields: [
    "radicado",
    "demandante_nombre",
    "demandado_nombre",
    "tipo_proceso",
    "cuantia",
    "competencia_territorial",
  ],
  minimum_confidence: "medio",
  block_on_missing: false,
};

export class KnowledgeRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  private mapProfileCreateError(error: { code?: string; message?: string; details?: string | null; hint?: string | null }): string {
    if (error.code === "23505") {
      return "Ya existe un perfil con ese nombre. Usa un nombre distinto.";
    }

    if (error.code === "42P01") {
      return "Falta esquema de conocimiento. Ejecuta migraciones: 20260318_009_knowledge_library_profiles.sql, 20260318_010_cases_profile_context.sql y 20260318_011_ai_suggestion_library_trace.sql.";
    }

    if (error.code === "42501") {
      return "No hay permisos para crear perfiles (RLS/políticas). Revisa la configuración de Supabase.";
    }

    const detail = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
    return detail || "No fue posible crear el perfil por un error de base de datos.";
  }

  private mapFolderCreateError(error: { code?: string; message?: string; details?: string | null; hint?: string | null }): string {
    if (error.code === "23505") {
      return "Ya existe una carpeta con ese nombre en este perfil.";
    }

    if (error.code === "23503") {
      return "El perfil seleccionado no existe o no está disponible para crear carpetas.";
    }

    if (error.code === "42P01") {
      return "Falta esquema de conocimiento (tabla knowledge_folders). Ejecuta las migraciones 20260318_009, 20260318_010, 20260318_011 y 20260319_012.";
    }

    if (error.code === "42501") {
      return "No hay permisos para crear carpetas (RLS/políticas).";
    }

    const detail = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
    return detail || "No fue posible crear la carpeta por un error de base de datos.";
  }

  private mapDocumentCreateError(error: { code?: string; message?: string; details?: string | null; hint?: string | null }): string {
    if (error.code === "23503") {
      return "El perfil/carpeta/caso relacionado no existe para guardar el documento.";
    }

    if (error.code === "42P01") {
      return "Falta esquema de conocimiento (tabla knowledge_documents). Ejecuta las migraciones 20260318_009, 20260318_010, 20260318_011 y 20260319_012.";
    }

    if (error.code === "42501") {
      return "No hay permisos para guardar documentos en biblioteca (RLS/políticas).";
    }

    const detail = [error.message, error.details, error.hint].filter(Boolean).join(" | ");
    return detail || "No fue posible guardar el documento por un error de base de datos.";
  }

  async listProfiles(): Promise<KnowledgeProfileRecord[]> {
    const { data } = await this.supabase
      .from("knowledge_profiles")
      .select("*")
      .order("updated_at", { ascending: false });

    return (data ?? []) as KnowledgeProfileRecord[];
  }

  async createProfile(input: {
    nombre: string;
    descripcion?: string | null;
    created_by?: string | null;
  }): Promise<KnowledgeProfileRecord | null> {
    const { data, error } = await this.supabase
      .from("knowledge_profiles")
      .insert({
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        created_by: input.created_by ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(this.mapProfileCreateError(error));
    }

    return data as KnowledgeProfileRecord;
  }

  async getProfileSettings(profileId: string): Promise<KnowledgeProfileSettingsRecord | null> {
    const { data } = await this.supabase
      .from("knowledge_profile_settings")
      .select("*")
      .eq("profile_id", profileId)
      .maybeSingle();

    if (!data) {
      return null;
    }

    return data as KnowledgeProfileSettingsRecord;
  }

  async upsertProfileSettings(
    profileId: string,
    input: Partial<Omit<KnowledgeProfileSettingsRecord, "profile_id" | "created_at" | "updated_at">>
  ): Promise<boolean> {
    const payload = {
      profile_id: profileId,
      checklist_items: input.checklist_items ?? DEFAULT_SETTINGS.checklist_items,
      critical_fields: input.critical_fields ?? DEFAULT_SETTINGS.critical_fields,
      minimum_confidence: input.minimum_confidence ?? DEFAULT_SETTINGS.minimum_confidence,
      block_on_missing: input.block_on_missing ?? DEFAULT_SETTINGS.block_on_missing,
    };

    const { error } = await this.supabase
      .from("knowledge_profile_settings")
      .upsert(payload, { onConflict: "profile_id" });

    return !error;
  }

  async listFoldersByProfile(profileId: string): Promise<KnowledgeFolderRecord[]> {
    const { data } = await this.supabase
      .from("knowledge_folders")
      .select("*")
      .eq("profile_id", profileId)
      .order("orden", { ascending: true })
      .order("created_at", { ascending: true });

    return (data ?? []) as KnowledgeFolderRecord[];
  }

  async createFolder(input: {
    profile_id: string;
    nombre: string;
    descripcion?: string | null;
    orden?: number;
  }): Promise<KnowledgeFolderRecord | null> {
    const { data, error } = await this.supabase
      .from("knowledge_folders")
      .insert({
        profile_id: input.profile_id,
        nombre: input.nombre,
        descripcion: input.descripcion ?? null,
        orden: input.orden ?? 100,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(this.mapFolderCreateError(error));
    }

    return data as KnowledgeFolderRecord;
  }

  async listDocumentsByProfile(profileId: string): Promise<KnowledgeDocumentRecord[]> {
    const { data } = await this.supabase
      .from("knowledge_documents")
      .select("*")
      .eq("profile_id", profileId)
      .eq("activo", true)
      .order("updated_at", { ascending: false });

    return (data ?? []) as KnowledgeDocumentRecord[];
  }

  async createDocument(input: {
    profile_id: string;
    folder_id?: string | null;
    case_id?: string | null;
    titulo: string;
    tipo_documento: string;
    etiquetas?: string[];
    contenido_texto?: string | null;
    resumen_texto?: string | null;
    source_file_name?: string | null;
    source_file_path?: string | null;
    source_file_mime?: string | null;
    source_file_size?: number | null;
    decision_type_normalized?: string | null;
    decision_type_alias?: string | null;
    replaceable_fields?: string[];
    processing_status?: string;
    metadata_json?: Record<string, unknown>;
  }): Promise<KnowledgeDocumentRecord | null> {
    const { data, error } = await this.supabase
      .from("knowledge_documents")
      .insert({
        profile_id: input.profile_id,
        folder_id: input.folder_id ?? null,
        case_id: input.case_id ?? null,
        titulo: input.titulo,
        tipo_documento: input.tipo_documento,
        etiquetas: input.etiquetas ?? [],
        contenido_texto: input.contenido_texto ?? null,
        resumen_texto: input.resumen_texto ?? null,
        source_file_name: input.source_file_name ?? null,
        source_file_path: input.source_file_path ?? null,
        source_file_mime: input.source_file_mime ?? null,
        source_file_size: input.source_file_size ?? null,
        decision_type_normalized: input.decision_type_normalized ?? null,
        decision_type_alias: input.decision_type_alias ?? null,
        replaceable_fields: input.replaceable_fields ?? [],
        processing_status: input.processing_status ?? "processed",
        metadata_json: input.metadata_json ?? {},
        activo: true,
      })
      .select("*")
      .single();

    if (error) {
      throw new Error(this.mapDocumentCreateError(error));
    }

    return data as KnowledgeDocumentRecord;
  }

  async archiveDocument(documentId: string): Promise<boolean> {
    const { error } = await this.supabase
      .from("knowledge_documents")
      .update({ activo: false })
      .eq("id", documentId);

    return !error;
  }
}
