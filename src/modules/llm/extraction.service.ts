import { buildExtractionPrompt } from "./extraction-prompt";
import { evaluateCriticalFields, type CriticalFieldConfig } from "./critical-fields";
import { callLlm } from "./llm-client";
import type {
  LlmChecklistItem,
  LlmConfidence,
  LlmExtractionFormFields,
  LlmExtractionResult,
} from "./types";

const CONFIDENCE_LEVELS: LlmConfidence[] = ["alto", "medio", "bajo"];

interface HeuristicExtraction {
  radicado?: string;
  tipo_proceso?: string;
  demandante_nombre?: string;
  demandado_nombre?: string;
  cuantia?: number;
  competencia_territorial?: string;
  despacho?: string;
  fecha_demanda?: string;
}

function sanitizeJsonBlock(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed.startsWith("```") ) {
    return trimmed;
  }

  return trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonSafely(raw: string): unknown | null {
  const cleaned = sanitizeJsonBlock(raw);

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

function asConfidence(value: unknown): LlmConfidence {
  const normalized = String(value ?? "").toLowerCase().trim() as LlmConfidence;
  return CONFIDENCE_LEVELS.includes(normalized) ? normalized : "bajo";
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNullableString(value: unknown): string | null {
  const normalized = asString(value);
  return normalized.length > 0 ? normalized : null;
}

function asNullableNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.replace(/[\.,](?=\d{3}(\D|$))/g, "").replace(",", ".").trim();
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function asChecklistItem(raw: unknown): LlmChecklistItem {
  const source = raw as { valor?: unknown; razon?: unknown } | null;

  return {
    valor: Boolean(source?.valor),
    razon: asString(source?.razon),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => asString(item))
    .filter((item) => item.length > 0);
}

function findFirstMatch(text: string, patterns: RegExp[]): string | null {
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) {
      const value = match[1].trim();
      if (value.length > 0) {
        return value;
      }
    }
  }

  return null;
}

function asNullableNumberFromRaw(value: string | null): number | null {
  if (!value) {
    return null;
  }

  const normalized = value
    .replace(/[^\d,\.]/g, "")
    .replace(/[\.,](?=\d{3}(\D|$))/g, "")
    .replace(",", ".")
    .trim();

  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function inferTipoProceso(text: string, extracted: string | null): string | null {
  if (extracted) {
    return extracted.trim().toLowerCase();
  }

  const lower = text.toLowerCase();
  if (lower.includes("proceso ejecutivo")) return "ejecutivo";
  if (lower.includes("demanda ejecutiva para la efectividad de la garant")) return "ejecutivo con garantía real";
  if (lower.includes("proceso verbal")) return "verbal";
  if (lower.includes("proceso monitorio")) return "monitorio";
  if (lower.includes("proceso ordinario")) return "ordinario";
  return null;
}

function parseIsoDate(raw: string | null): string | null {
  if (!raw) {
    return null;
  }

  const trimmed = raw.trim();
  const iso = trimmed.match(/(20\d{2})-(0[1-9]|1[0-2])-([0-2]\d|3[01])/);
  if (iso) {
    return iso[0];
  }

  const dmy = trimmed.match(/([0-2]?\d|3[01])[\/\-.](0?[1-9]|1[0-2])[\/\-.](20\d{2})/);
  if (!dmy) {
    return null;
  }

  const day = dmy[1].padStart(2, "0");
  const month = dmy[2].padStart(2, "0");
  const year = dmy[3];
  return `${year}-${month}-${day}`;
}

function extractHeuristicFields(documentText: string): HeuristicExtraction {
  const radicado = findFirstMatch(documentText, [
    /radicado\s*(?:no\.?|n\.?|número|num\.?|#)?\s*[:\-]?\s*([A-Z0-9\-\.\/]{6,})/i,
    /referencia\s*[:\-]\s*([A-Z0-9\-\.\/]{6,})/i,
  ]);
  const demandante = findFirstMatch(documentText, [
    /dte\s*[:\-]\s*([^\n]{3,140})/i,
    /demandante(?:s)?\s*[:\-]\s*([^\n]{3,140})/i,
    /actor(?:a)?\s*[:\-]\s*([^\n]{3,140})/i,
  ]);
  const demandado = findFirstMatch(documentText, [
    /ddo\s*[:\-]\s*([^\n]{3,140})/i,
    /demandado(?:s)?\s*[:\-]\s*([^\n]{3,140})/i,
    /convocado(?:s)?\s*[:\-]\s*([^\n]{3,140})/i,
  ]);
  const tipoProcesoRaw = findFirstMatch(documentText, [
    /tipo\s+de\s+proceso\s*[:\-]\s*([^\n]{3,140})/i,
    /proceso\s*[:\-]\s*([^\n]{3,140})/i,
  ]);
  const cuantiaRaw = findFirstMatch(documentText, [
    /cuant[ií]a\s*[:\-]?\s*\$?\s*([^\n]{1,40})/i,
    /pretensiones\s*[:\-]?\s*\$?\s*([^\n]{1,40})/i,
  ]);
  const competencia = findFirstMatch(documentText, [
    /competencia\s+territorial\s*[:\-]\s*([^\n]{3,160})/i,
    /competencia\s*[:\-]\s*([^\n]{3,160})/i,
  ]);
  const despacho = findFirstMatch(documentText, [
    /juzgado\s*[:\-]\s*([^\n]{3,160})/i,
    /despacho\s*[:\-]\s*([^\n]{3,160})/i,
  ]);
  const fechaRaw = findFirstMatch(documentText, [
    /fecha\s+de\s+demanda\s*[:\-]\s*([^\n]{8,30})/i,
    /fecha\s*[:\-]\s*([^\n]{8,30})/i,
  ]);

  return {
    radicado: radicado ?? undefined,
    tipo_proceso: inferTipoProceso(documentText, tipoProcesoRaw) ?? undefined,
    demandante_nombre: demandante ?? undefined,
    demandado_nombre: demandado ?? undefined,
    cuantia: asNullableNumberFromRaw(cuantiaRaw) ?? undefined,
    competencia_territorial: competencia ?? undefined,
    despacho: despacho ?? undefined,
    fecha_demanda: parseIsoDate(fechaRaw) ?? undefined,
  };
}

function mergeWithHeuristics(result: LlmExtractionResult, heuristics: HeuristicExtraction): LlmExtractionResult {
  const merged = structuredClone(result);

  const fillStringField = (
    field: keyof LlmExtractionResult["campos_caso"],
    value: string | undefined,
    confidence: LlmConfidence = "medio"
  ) => {
    if (!value || value.trim().length === 0) {
      return;
    }

    const current = merged.campos_caso[field];
    if (typeof current.valor === "string" && current.valor.trim().length > 0) {
      return;
    }

    if (current.valor === null || typeof current.valor === "string") {
      (current as { valor: string | null; confianza: LlmConfidence }).valor = value.trim();
      current.confianza = confidence;
    }
  };

  fillStringField("radicado", heuristics.radicado);
  fillStringField("tipo_proceso", heuristics.tipo_proceso);
  fillStringField("demandante_nombre", heuristics.demandante_nombre);
  fillStringField("demandado_nombre", heuristics.demandado_nombre);
  fillStringField("competencia_territorial", heuristics.competencia_territorial);
  fillStringField("despacho", heuristics.despacho);
  fillStringField("fecha_demanda", heuristics.fecha_demanda);

  if (
    typeof heuristics.cuantia === "number" &&
    Number.isFinite(heuristics.cuantia) &&
    merged.campos_caso.cuantia.valor === null
  ) {
    merged.campos_caso.cuantia.valor = heuristics.cuantia;
    merged.campos_caso.cuantia.confianza = "medio";
  }

  return merged;
}

function normalizeExtraction(raw: unknown): LlmExtractionResult | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as {
    campos_caso?: Record<string, { valor?: unknown; confianza?: unknown }>;
    checklist?: Record<string, { valor?: unknown; razon?: unknown }>;
    inventario_documentos?: {
      encontrados?: unknown;
      faltantes?: unknown;
      requeridos_por_tipo_proceso?: unknown;
    };
  };

  const campos = source.campos_caso;
  const checklist = source.checklist;

  if (!campos || !checklist) {
    return null;
  }

  return {
    campos_caso: {
      radicado: { valor: asString(campos.radicado?.valor), confianza: asConfidence(campos.radicado?.confianza) },
      tipo_proceso: {
        valor: asString(campos.tipo_proceso?.valor).toLowerCase(),
        confianza: asConfidence(campos.tipo_proceso?.confianza),
      },
      subtipo_proceso: {
        valor: asNullableString(campos.subtipo_proceso?.valor),
        confianza: asConfidence(campos.subtipo_proceso?.confianza),
      },
      demandante_nombre: {
        valor: asString(campos.demandante_nombre?.valor),
        confianza: asConfidence(campos.demandante_nombre?.confianza),
      },
      demandado_nombre: {
        valor: asString(campos.demandado_nombre?.valor),
        confianza: asConfidence(campos.demandado_nombre?.confianza),
      },
      cuantia: {
        valor: asNullableNumber(campos.cuantia?.valor),
        confianza: asConfidence(campos.cuantia?.confianza),
      },
      competencia_territorial: {
        valor: asNullableString(campos.competencia_territorial?.valor),
        confianza: asConfidence(campos.competencia_territorial?.confianza),
      },
      despacho: {
        valor: asNullableString(campos.despacho?.valor),
        confianza: asConfidence(campos.despacho?.confianza),
      },
      pretensiones_resumen: {
        valor: asNullableString(campos.pretensiones_resumen?.valor),
        confianza: asConfidence(campos.pretensiones_resumen?.confianza),
      },
      hechos_resumen: {
        valor: asNullableString(campos.hechos_resumen?.valor),
        confianza: asConfidence(campos.hechos_resumen?.confianza),
      },
      fecha_demanda: {
        valor: asNullableString(campos.fecha_demanda?.valor),
        confianza: asConfidence(campos.fecha_demanda?.confianza),
      },
    },
    checklist: {
      cumple_art_82: asChecklistItem(checklist.cumple_art_82),
      anexos_completos: asChecklistItem(checklist.anexos_completos),
      poder_aportado: asChecklistItem(checklist.poder_aportado),
      legitimacion_causa: asChecklistItem(checklist.legitimacion_causa),
      competencia_valida: asChecklistItem(checklist.competencia_valida),
      titulo_ejecutivo_valido: asChecklistItem(checklist.titulo_ejecutivo_valido),
      indebida_acumulacion: asChecklistItem(checklist.indebida_acumulacion),
      caducidad: asChecklistItem(checklist.caducidad),
      prescripcion: asChecklistItem(checklist.prescripcion),
    },
    inventario_documentos: {
      encontrados: asStringArray(source.inventario_documentos?.encontrados),
      faltantes: asStringArray(source.inventario_documentos?.faltantes),
      requeridos_por_tipo_proceso: asStringArray(source.inventario_documentos?.requeridos_por_tipo_proceso),
    },
  };
}

function buildConfidenceMap(result: LlmExtractionResult): Record<string, LlmConfidence> {
  return {
    radicado: result.campos_caso.radicado.confianza,
    tipo_proceso: result.campos_caso.tipo_proceso.confianza,
    subtipo_proceso: result.campos_caso.subtipo_proceso.confianza,
    demandante_nombre: result.campos_caso.demandante_nombre.confianza,
    demandado_nombre: result.campos_caso.demandado_nombre.confianza,
    cuantia: result.campos_caso.cuantia.confianza,
    competencia_territorial: result.campos_caso.competencia_territorial.confianza,
    despacho: result.campos_caso.despacho.confianza,
    pretensiones_resumen: result.campos_caso.pretensiones_resumen.confianza,
    hechos_resumen: result.campos_caso.hechos_resumen.confianza,
    fecha_demanda: result.campos_caso.fecha_demanda.confianza,
  };
}

export class LlmExtractionService {
  async extractFromText(documentText: string): Promise<LlmExtractionResult | null> {
    const heuristics = extractHeuristicFields(documentText);
    const prompt = buildExtractionPrompt(documentText, {
      radicado: heuristics.radicado,
      tipo_proceso: heuristics.tipo_proceso,
      demandante_nombre: heuristics.demandante_nombre,
      demandado_nombre: heuristics.demandado_nombre,
      cuantia: typeof heuristics.cuantia === "number" ? String(heuristics.cuantia) : undefined,
      competencia_territorial: heuristics.competencia_territorial,
      despacho: heuristics.despacho,
      fecha_demanda: heuristics.fecha_demanda,
    });
    const raw = await callLlm(prompt, { expectJson: true });

    if (!raw) {
      return null;
    }

    const parsed = parseJsonSafely(raw);
    const normalized = normalizeExtraction(parsed);
    if (!normalized) {
      return null;
    }

    return mergeWithHeuristics(normalized, heuristics);
  }

  extractionToFormFields(result: LlmExtractionResult, criticalConfig?: CriticalFieldConfig): LlmExtractionFormFields {
    const criticalEvaluation = evaluateCriticalFields(result, criticalConfig);
    const fields: LlmExtractionFormFields = {
      radicado: result.campos_caso.radicado.valor || undefined,
      tipo_proceso: result.campos_caso.tipo_proceso.valor || undefined,
      subtipo_proceso: result.campos_caso.subtipo_proceso.valor ?? undefined,
      demandante_nombre: result.campos_caso.demandante_nombre.valor || undefined,
      demandado_nombre: result.campos_caso.demandado_nombre.valor || undefined,
      cuantia:
        typeof result.campos_caso.cuantia.valor === "number"
          ? String(result.campos_caso.cuantia.valor)
          : undefined,
      competencia_territorial: result.campos_caso.competencia_territorial.valor ?? undefined,
      despacho: result.campos_caso.despacho.valor ?? undefined,
      pretensiones_resumen: result.campos_caso.pretensiones_resumen.valor ?? undefined,
      hechos_resumen: result.campos_caso.hechos_resumen.valor ?? undefined,
      fecha_demanda: result.campos_caso.fecha_demanda.valor ?? undefined,
      checklist_json: JSON.stringify(result.checklist),
      inventario_json: JSON.stringify(result.inventario_documentos),
      llm_confianza_json: JSON.stringify(buildConfidenceMap(result)),
      critical_eval_json: JSON.stringify(criticalEvaluation),
      llm_extraccion_json: JSON.stringify(result),
    };

    return fields;
  }
}
