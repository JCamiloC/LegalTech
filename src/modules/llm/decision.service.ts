import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CaseRecord, CaseRequirementsCheck, LegalArticleRecord, RuleDefinitionRecord } from "@/types";
import { buildDecisionPrompt } from "./decision-prompt";
import { callLlm } from "./llm-client";
import type { LlmConfidence, LlmDecisionResult } from "./types";

interface SimilarCaseRow {
  id: string;
  tipo_proceso: string;
  decision_final: CaseRecord["decision_final"];
  updated_at: string;
}

interface SimilarCaseContext {
  case_id: string;
  tipo_proceso: string;
  decision_final: CaseRecord["decision_final"];
  updated_at: string;
  checklist: CaseRequirementsCheck | null;
  ai_was_correct: boolean | null;
}

interface KnowledgeDocumentRow {
  id: string;
  titulo: string;
  tipo_documento: string;
  etiquetas: string[] | null;
  contenido_texto: string | null;
  updated_at: string;
}

function scoreKnowledgeDocument(row: KnowledgeDocumentRow, tipoProceso: string): number {
  const process = tipoProceso.trim().toLowerCase();
  const tags = (row.etiquetas ?? []).map((item) => item.trim().toLowerCase());
  const content = String(row.contenido_texto ?? "").toLowerCase();
  let score = 0;

  if (tags.includes(process)) {
    score += 3;
  }

  if (content.includes(process)) {
    score += 2;
  }

  if (row.tipo_documento.toLowerCase().includes("exito")) {
    score += 1;
  }

  return score;
}

function asConfidence(value: unknown): LlmConfidence {
  const normalized = String(value ?? "").toLowerCase().trim();
  if (normalized === "alto" || normalized === "medio" || normalized === "bajo") {
    return normalized;
  }
  return "bajo";
}

function asDecision(value: unknown): LlmDecisionResult["decision_sugerida"] {
  const normalized = String(value ?? "").trim();
  if (
    normalized === "auto_admisorio" ||
    normalized === "auto_inadmisorio" ||
    normalized === "mandamiento_pago" ||
    normalized === "auto_rechaza_demanda"
  ) {
    return normalized;
  }

  return "auto_inadmisorio";
}

function extractJson(raw: string): unknown | null {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");

  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first < 0 || last <= first) {
      return null;
    }

    try {
      return JSON.parse(cleaned.slice(first, last + 1));
    } catch {
      return null;
    }
  }
}

function normalizeDecisionResult(raw: unknown): LlmDecisionResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as {
    decision_sugerida?: unknown;
    confianza?: unknown;
    fundamento_normativo?: unknown;
    analisis_checklist?: unknown;
    parte_motiva_borrador?: unknown;
    defectos_identificados?: unknown;
    casos_similares_usados?: unknown;
  };

  const fundamento = Array.isArray(source.fundamento_normativo)
    ? source.fundamento_normativo
        .map((item) => {
          const row = item as { articulo?: unknown; texto_relevante?: unknown };
          const articulo = String(row?.articulo ?? "").trim();
          const texto = String(row?.texto_relevante ?? "").trim();
          if (!articulo && !texto) {
            return null;
          }
          return { articulo, texto_relevante: texto };
        })
        .filter((item): item is { articulo: string; texto_relevante: string } => Boolean(item))
    : [];

  const defectos = Array.isArray(source.defectos_identificados)
    ? source.defectos_identificados.map((item) => String(item ?? "").trim()).filter(Boolean)
    : [];

  return {
    decision_sugerida: asDecision(source.decision_sugerida),
    confianza: asConfidence(source.confianza),
    fundamento_normativo: fundamento,
    analisis_checklist: String(source.analisis_checklist ?? "").trim(),
    parte_motiva_borrador: String(source.parte_motiva_borrador ?? "").trim(),
    defectos_identificados: defectos,
    casos_similares_usados: Number(source.casos_similares_usados ?? 0) || 0,
    biblioteca_contexto_usado: [],
  };
}

async function getSupabaseClient(supabase?: SupabaseClient): Promise<SupabaseClient> {
  if (supabase) {
    return supabase;
  }

  return createSupabaseServerClient();
}

export class LlmDecisionService {
  async suggestDecision(params: {
    caseRecord: CaseRecord;
    checklist: CaseRequirementsCheck;
    supabase?: SupabaseClient;
  }): Promise<LlmDecisionResult | null> {
    const supabase = await getSupabaseClient(params.supabase);

    const [rulesResult, legalResult, similarCasesResult, knowledgeResult] = await Promise.all([
      supabase.from("rule_definitions").select("*").eq("activo", true).order("prioridad", { ascending: true }),
      supabase.from("legal_articles").select("*").order("codigo", { ascending: true }).limit(100),
      supabase
        .from("cases")
        .select("id,tipo_proceso,decision_final,updated_at")
        .eq("tipo_proceso", params.caseRecord.tipo_proceso)
        .not("decision_final", "is", null)
        .neq("id", params.caseRecord.id)
        .order("updated_at", { ascending: false })
        .limit(10),
        params.caseRecord.profile_id
        ? supabase
          .from("knowledge_documents")
          .select("id,titulo,tipo_documento,etiquetas,contenido_texto,updated_at")
          .eq("profile_id", params.caseRecord.profile_id)
          .eq("activo", true)
          .order("updated_at", { ascending: false })
          .limit(20)
        : Promise.resolve({ data: [] as KnowledgeDocumentRow[] }),
    ]);

    const similarRows = (similarCasesResult.data ?? []) as SimilarCaseRow[];
    const similarCaseContexts: SimilarCaseContext[] = await Promise.all(
      similarRows.map(async (row) => {
        const [checklistResult, suggestionResult] = await Promise.all([
          supabase
            .from("case_requirements_check")
            .select("*")
            .eq("case_id", row.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("case_ai_suggestions")
            .select("fue_correcta")
            .eq("case_id", row.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
        ]);

        return {
          case_id: row.id,
          tipo_proceso: row.tipo_proceso,
          decision_final: row.decision_final,
          updated_at: row.updated_at,
          checklist: (checklistResult.data as CaseRequirementsCheck | null) ?? null,
          ai_was_correct: (suggestionResult.data as { fue_correcta: boolean | null } | null)?.fue_correcta ?? null,
        };
      })
    );

    const rankedKnowledge = ((knowledgeResult.data ?? []) as KnowledgeDocumentRow[])
      .map((row) => ({
        ...row,
        score: scoreKnowledgeDocument(row, params.caseRecord.tipo_proceso),
      }))
      .sort((a, b) => {
        if (a.score !== b.score) {
          return b.score - a.score;
        }

        return b.updated_at.localeCompare(a.updated_at);
      })
      .slice(0, 12)
      .map((row) => ({
        id: row.id,
        titulo: row.titulo,
        tipo_documento: row.tipo_documento,
        etiquetas: row.etiquetas ?? [],
        score: row.score,
        contenido_texto: String(row.contenido_texto ?? "").trim().slice(0, 1200),
      }));

    const prompt = buildDecisionPrompt({
      caseRecord: params.caseRecord,
      checklist: params.checklist,
      activeRules: (rulesResult.data ?? []) as RuleDefinitionRecord[],
      legalArticles: (legalResult.data ?? []) as LegalArticleRecord[],
      similarCases: similarCaseContexts,
      knowledgeLibrary: rankedKnowledge,
    });

    const raw = await callLlm(prompt, { expectJson: true });
    if (!raw) {
      return null;
    }

    const normalized = normalizeDecisionResult(extractJson(raw));
    if (!normalized) {
      return null;
    }

    normalized.biblioteca_contexto_usado = rankedKnowledge.slice(0, 5).map((item) => ({
      titulo: item.titulo,
      tipo_documento: item.tipo_documento,
      etiquetas: item.etiquetas,
      score: item.score,
    }));

    return normalized;
  }
}
