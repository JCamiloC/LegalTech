import type { SupabaseClient } from "@supabase/supabase-js";
import type { AssistantStoredInteraction } from "@/types/assistant";

export class AssistantMemoryRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async create(input: {
    case_id: string | null;
    question: string;
    normalized_question: string;
    response_json: AssistantStoredInteraction["response_json"];
  }): Promise<AssistantStoredInteraction | null> {
    const { data, error } = await this.supabase
      .from("assistant_interactions")
      .insert(input)
      .select("*")
      .single();

    if (error || !data) {
      return null;
    }

    return data as AssistantStoredInteraction;
  }

  async findById(interactionId: string): Promise<AssistantStoredInteraction | null> {
    const { data, error } = await this.supabase
      .from("assistant_interactions")
      .select("*")
      .eq("id", interactionId)
      .maybeSingle();

    if (error || !data) {
      return null;
    }

    return data as AssistantStoredInteraction;
  }

  async listRecent(limit = 150): Promise<AssistantStoredInteraction[]> {
    const { data } = await this.supabase
      .from("assistant_interactions")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(limit);

    return (data ?? []) as AssistantStoredInteraction[];
  }

  async updateFeedback(interactionId: string, helpful: boolean, feedbackNotes?: string | null): Promise<void> {
    await this.supabase
      .from("assistant_interactions")
      .update({
        helpful,
        feedback_notes: feedbackNotes ?? null,
      })
      .eq("id", interactionId);
  }
}
