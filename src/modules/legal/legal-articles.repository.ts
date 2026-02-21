import type { SupabaseClient } from "@supabase/supabase-js";
import type { LegalArticleRecord } from "@/types";

export class LegalArticlesRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async listAll(): Promise<LegalArticleRecord[]> {
    const { data } = await this.supabase.from("legal_articles").select("*").order("codigo", { ascending: true });
    return (data ?? []) as LegalArticleRecord[];
  }

  async listByCategory(aplicaA: string): Promise<LegalArticleRecord[]> {
    const { data } = await this.supabase
      .from("legal_articles")
      .select("*")
      .eq("aplica_a", aplicaA)
      .order("codigo", { ascending: true });

    return (data ?? []) as LegalArticleRecord[];
  }

  async create(input: {
    codigo: string;
    nombre: string;
    descripcion: string;
    aplica_a: string;
  }): Promise<LegalArticleRecord | null> {
    const { data, error } = await this.supabase
      .from("legal_articles")
      .insert(input)
      .select("*")
      .single();

    if (error) {
      return null;
    }

    return data as LegalArticleRecord;
  }

  async update(
    articleId: string,
    input: Partial<{
      codigo: string;
      nombre: string;
      descripcion: string;
      aplica_a: string;
    }>
  ): Promise<LegalArticleRecord | null> {
    const { data, error } = await this.supabase
      .from("legal_articles")
      .update(input)
      .eq("id", articleId)
      .select("*")
      .single();

    if (error) {
      return null;
    }

    return data as LegalArticleRecord;
  }

  async delete(articleId: string): Promise<boolean> {
    const { error } = await this.supabase.from("legal_articles").delete().eq("id", articleId);
    return !error;
  }
}