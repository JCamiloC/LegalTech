import type { SupabaseClient } from "@supabase/supabase-js";
import type { DecisionRecord } from "@/types";

export class DecisionRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listByCaseId(caseId: string): Promise<DecisionRecord[]> {
    const { data } = await this.supabase
      .from("decisions")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false });

    return (data ?? []) as DecisionRecord[];
  }

  async findLatestByCaseId(caseId: string): Promise<DecisionRecord | null> {
    const { data, error } = await this.supabase
      .from("decisions")
      .select("*")
      .eq("case_id", caseId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as DecisionRecord;
  }

  async create(payload: Omit<DecisionRecord, "id" | "created_at">): Promise<DecisionRecord | null> {
    const { data, error } = await this.supabase.from("decisions").insert(payload).select("*").single();

    if (error || !data) {
      return null;
    }

    return data as DecisionRecord;
  }

  async updateDocumentUrl(decisionId: string, documentUrl: string): Promise<void> {
    await this.supabase.from("decisions").update({ documento_url: documentUrl }).eq("id", decisionId);
  }

  async updateMotivation(decisionId: string, motivacion: string): Promise<void> {
    await this.supabase.from("decisions").update({ motivacion }).eq("id", decisionId);
  }

  async updateDecision(
    decisionId: string,
    payload: {
      tipo_decision: DecisionRecord["tipo_decision"];
      fundamento_juridico: string;
      motivacion: string;
      articulos_aplicados: string;
    }
  ): Promise<void> {
    await this.supabase.from("decisions").update(payload).eq("id", decisionId);
  }
}