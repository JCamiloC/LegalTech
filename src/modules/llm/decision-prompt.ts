import type { CaseRecord, CaseRequirementsCheck, RuleDefinitionRecord, LegalArticleRecord } from "@/types";
import type { LlmDecisionResult } from "./types";

interface KnowledgeSnippet {
  titulo: string;
  tipo_documento: string;
  etiquetas: string[];
  contenido_texto: string;
}

interface SimilarCaseInput {
  case_id: string;
  tipo_proceso: string;
  decision_final: CaseRecord["decision_final"];
  updated_at: string;
  checklist: CaseRequirementsCheck | null;
  ai_was_correct: boolean | null;
}

interface BuildDecisionPromptInput {
  caseRecord: CaseRecord;
  checklist: CaseRequirementsCheck;
  activeRules: RuleDefinitionRecord[];
  legalArticles: LegalArticleRecord[];
  similarCases: SimilarCaseInput[];
  knowledgeLibrary: KnowledgeSnippet[];
}

function clip(input: string, maxChars = 24000): string {
  return input.length <= maxChars ? input : `${input.slice(0, maxChars)}\n[TRUNCADO]`;
}

export function buildDecisionPrompt(input: BuildDecisionPromptInput): string {
  const payload = {
    caseRecord: input.caseRecord,
    checklist: input.checklist,
    activeRules: input.activeRules.slice(0, 30),
    legalArticles: input.legalArticles.slice(0, 60),
    similarCases: input.similarCases.slice(0, 10),
    knowledgeLibrary: input.knowledgeLibrary.slice(0, 12),
  };

  const contextJson = clip(JSON.stringify(payload, null, 2));

  return [
    "Eres un asistente juridico colombiano para apoyo a despacho judicial.",
    "Debes sugerir una decision motivada con base en datos estructurados del caso.",
    "Responde UNICAMENTE JSON valido. No uses markdown ni texto adicional.",
    "",
    "Salida obligatoria:",
    JSON.stringify(
      {
        decision_sugerida: "auto_inadmisorio",
        confianza: "alto",
        fundamento_normativo: [
          { articulo: "Art. 82 CGP", texto_relevante: "..." },
        ],
        analisis_checklist: "...",
        parte_motiva_borrador: "...",
        defectos_identificados: ["..."],
        casos_similares_usados: 0,
        biblioteca_contexto_usado: [],
      } satisfies LlmDecisionResult,
      null,
      2
    ),
    "",
    "Reglas de salida:",
    "- decision_sugerida debe ser uno de: auto_admisorio, auto_inadmisorio, mandamiento_pago, auto_rechaza_demanda.",
    "- confianza debe ser: alto, medio o bajo.",
    "- fundamento_normativo debe citar articulos relevantes disponibles en contexto.",
    "- parte_motiva_borrador debe quedar lista para edicion por la abogada.",
    "- Usa knowledgeLibrary para mantener el criterio del despacho cuando sea pertinente al caso.",
    "",
    "=== CONTEXTO ESTRUCTURADO ===",
    contextJson,
  ].join("\n");
}
