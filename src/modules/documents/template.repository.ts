import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionType } from "@/types";

export interface DocumentTemplateRecord {
  id: string;
  nombre: string;
  tipo_decision: DecisionType;
  contenido_html: string;
  activo: boolean;
  created_at: string;
  updated_at: string;
}

export class TemplateRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAll(): Promise<DocumentTemplateRecord[]> {
    const { data } = await this.supabase
      .from("document_templates")
      .select("*")
      .order("updated_at", { ascending: false });

    return (data ?? []) as DocumentTemplateRecord[];
  }

  async create(input: {
    nombre: string;
    tipo_decision: DecisionType;
    contenido_html: string;
    activo: boolean;
  }): Promise<void> {
    await this.supabase.from("document_templates").insert(input);
  }

  async update(
    templateId: string,
    input: {
      nombre: string;
      tipo_decision: DecisionType;
      contenido_html: string;
      activo: boolean;
    }
  ): Promise<void> {
    await this.supabase.from("document_templates").update(input).eq("id", templateId);
  }

  async setActive(templateId: string, active: boolean): Promise<void> {
    await this.supabase.from("document_templates").update({ activo: active }).eq("id", templateId);
  }

  async findActiveByDecision(decision: DecisionType): Promise<DocumentTemplateRecord | null> {
    const { data, error } = await this.supabase
      .from("document_templates")
      .select("*")
      .eq("tipo_decision", decision)
      .eq("activo", true)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as DocumentTemplateRecord;
  }
}