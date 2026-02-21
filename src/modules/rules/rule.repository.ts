import type { SupabaseClient } from "@supabase/supabase-js";
import type { RuleDefinitionRecord } from "@/types";

export class RuleRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAllRules(): Promise<RuleDefinitionRecord[]> {
    const { data } = await this.supabase.from("rule_definitions").select("*").order("prioridad", { ascending: true });
    return (data ?? []) as RuleDefinitionRecord[];
  }

  async listActiveRules(): Promise<RuleDefinitionRecord[]> {
    const { data } = await this.supabase
      .from("rule_definitions")
      .select("*")
      .eq("activo", true)
      .order("prioridad", { ascending: true });

    return (data ?? []) as RuleDefinitionRecord[];
  }

  async createRule(input: {
    nombre: string;
    descripcion: string;
    condicion_json: RuleDefinitionRecord["condicion_json"];
    resultado: RuleDefinitionRecord["resultado"];
    fundamento: string;
    prioridad: number;
    activo: boolean;
  }): Promise<void> {
    await this.supabase.from("rule_definitions").insert(input);
  }

  async updateRule(ruleId: string, input: {
    nombre: string;
    descripcion: string;
    condicion_json: RuleDefinitionRecord["condicion_json"];
    resultado: RuleDefinitionRecord["resultado"];
    fundamento: string;
    prioridad: number;
  }): Promise<void> {
    await this.supabase.from("rule_definitions").update(input).eq("id", ruleId);
  }

  async setRuleActive(ruleId: string, active: boolean): Promise<void> {
    await this.supabase.from("rule_definitions").update({ activo: active }).eq("id", ruleId);
  }
}