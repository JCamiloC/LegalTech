import type { ExpertAssistantResponse } from "@/modules/expert";
import type { LegalArticleRecord, RuleDefinitionRecord } from "@/types";

interface LegalLlmCaseContext {
  caseId?: string;
  question: string;
  baseResponse: ExpertAssistantResponse;
  rules: RuleDefinitionRecord[];
  articles: LegalArticleRecord[];
}

interface LegalLlmResponse {
  resumen?: string;
  recomendaciones?: string[];
  siguientePaso?: string;
}

function isEnabled(): boolean {
  const value = String(process.env.LEGAL_LLM_ENABLED ?? "false").toLowerCase();
  return value === "1" || value === "true" || value === "yes";
}

function buildPrompt(context: LegalLlmCaseContext): string {
  const rules = context.rules.slice(0, 5).map((rule) => ({
    nombre: rule.nombre,
    descripcion: rule.descripcion,
    fundamento: rule.fundamento,
    prioridad: rule.prioridad,
    resultado: rule.resultado,
  }));

  const articles = context.articles.slice(0, 8).map((article) => ({
    codigo: article.codigo,
    nombre: article.nombre,
    descripcion: article.descripcion,
    aplica_a: article.aplica_a,
  }));

  const input = {
    question: context.question,
    caseId: context.caseId ?? null,
    deterministicSummary: context.baseResponse,
    legalRules: rules,
    legalArticles: articles,
  };

  return [
    "Eres un asistente legal colombiano para apoyo a abogados civiles municipales.",
    "No inventes normas. Si no hay evidencia suficiente, dilo explícitamente.",
    "Responde SOLO en JSON válido con esta estructura:",
    '{"resumen":"...","recomendaciones":["..."],"siguientePaso":"..."}',
    "No incluyas markdown ni texto adicional.",
    "",
    "Contexto de entrada:",
    JSON.stringify(input),
  ].join("\n");
}

function sanitizeList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0).slice(0, 8);
}

function extractJsonPayload(raw: string): LegalLlmResponse | null {
  try {
    return JSON.parse(raw) as LegalLlmResponse;
  } catch {
    const firstBrace = raw.indexOf("{");
    const lastBrace = raw.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) {
      return null;
    }

    const candidate = raw.slice(firstBrace, lastBrace + 1);

    try {
      return JSON.parse(candidate) as LegalLlmResponse;
    } catch {
      return null;
    }
  }
}

export class LocalLegalLlmService {
  static async enrichResponse(context: LegalLlmCaseContext): Promise<ExpertAssistantResponse | null> {
    if (!isEnabled()) {
      return null;
    }

    const endpoint = process.env.LEGAL_LLM_ENDPOINT ?? "http://127.0.0.1:11434/api/generate";
    const model = process.env.LEGAL_LLM_MODEL ?? "qwen2.5:14b-instruct-q4_K_M";
    const timeoutMs = Number(process.env.LEGAL_LLM_TIMEOUT_MS ?? 45000);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const prompt = buildPrompt(context);

      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          prompt,
          stream: false,
          options: {
            temperature: 0.2,
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        return null;
      }

      const payload = (await response.json()) as { response?: string };
      const parsed = extractJsonPayload(String(payload.response ?? ""));

      if (!parsed) {
        return null;
      }

      return {
        ...context.baseResponse,
        resumen: parsed.resumen?.trim() || context.baseResponse.resumen,
        recomendaciones:
          sanitizeList(parsed.recomendaciones).length > 0
            ? sanitizeList(parsed.recomendaciones)
            : context.baseResponse.recomendaciones,
        siguientePaso: parsed.siguientePaso?.trim() || context.baseResponse.siguientePaso,
      };
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }
}
