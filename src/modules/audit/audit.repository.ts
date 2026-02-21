import type { SupabaseClient } from "@supabase/supabase-js";

export class AuditRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async logCaseEvent(params: {
    caseId: string;
    eventType: string;
    eventData?: Record<string, unknown> | null;
  }) {
    try {
      await this.supabase.from("case_audit_log").insert({
        case_id: params.caseId,
        event_type: params.eventType,
        event_data: params.eventData ?? null,
      });
    } catch {
      return;
    }
  }
}