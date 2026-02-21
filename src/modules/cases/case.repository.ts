import type { SupabaseClient } from "@supabase/supabase-js";
import type { CaseRecord, CaseRequirementsCheck } from "@/types";

interface CreateCaseInput {
  radicado: string;
  demandante_nombre: string;
  demandado_nombre: string;
  tipo_proceso: string;
  subtipo_proceso?: string | null;
  cuantia?: number | null;
  competencia_territorial?: string | null;
  despacho?: string | null;
}

type UpdateCaseInput = Partial<CreateCaseInput>;

type ChecklistInput = Omit<CaseRequirementsCheck, "id" | "case_id" | "created_at">;

export class CaseRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async list(): Promise<CaseRecord[]> {
    const { data } = await this.supabase.from("cases").select("*").order("created_at", { ascending: false });
    return (data ?? []) as CaseRecord[];
  }

  async create(input: CreateCaseInput): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase.from("cases").insert(input).select("*").single();

    if (error || !data) {
      return null;
    }

    return data as CaseRecord;
  }

  async update(caseId: string, input: UpdateCaseInput): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase.from("cases").update(input).eq("id", caseId).select("*").single();

    if (error || !data) {
      return null;
    }

    return data as CaseRecord;
  }

  async delete(caseId: string): Promise<boolean> {
    const { error } = await this.supabase.from("cases").delete().eq("id", caseId);
    return !error;
  }

  async findById(caseId: string): Promise<CaseRecord | null> {
    const { data, error } = await this.supabase.from("cases").select("*").eq("id", caseId).single();

    if (error || !data) {
      return null;
    }

    return data as CaseRecord;
  }

  async findChecklistByCaseId(caseId: string): Promise<CaseRequirementsCheck | null> {
    const { data, error } = await this.supabase
      .from("case_requirements_check")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as CaseRequirementsCheck;
  }

  async upsertChecklist(caseId: string, checklist: ChecklistInput): Promise<CaseRequirementsCheck | null> {
    const { data, error } = await this.supabase
      .from("case_requirements_check")
      .insert({
        case_id: caseId,
        ...checklist,
      })
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }

    return data as CaseRequirementsCheck;
  }

  async setSuggestedDecision(caseId: string, decision: CaseRecord["decision_sugerida"]): Promise<void> {
    await this.supabase.from("cases").update({ decision_sugerida: decision, estado: "en_revision" }).eq("id", caseId);
  }

  async setFinalDecision(caseId: string, decision: CaseRecord["decision_final"]): Promise<void> {
    await this.supabase.from("cases").update({ decision_final: decision, estado: "decidido" }).eq("id", caseId);
  }
}