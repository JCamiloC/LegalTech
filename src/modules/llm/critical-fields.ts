import type { LlmConfidence, LlmExtractionResult } from "./types";

export type CriticalCaseField = keyof LlmExtractionResult["campos_caso"];

export interface CriticalFieldIssue {
  field: CriticalCaseField;
  reason: "missing" | "low_confidence";
  confidence: LlmConfidence;
  minimum_required: LlmConfidence;
  blocking: boolean;
}

export interface CriticalFieldEvaluation {
  required_fields: CriticalCaseField[];
  minimum_confidence: LlmConfidence;
  blocking_mode: "alert" | "block";
  is_ready_for_submission: boolean;
  issues: CriticalFieldIssue[];
  evaluated_at: string;
}

export interface CriticalFieldConfig {
  required_fields?: string[];
  minimum_confidence?: string;
  block_on_missing?: boolean;
}

const DEFAULT_REQUIRED_FIELDS: CriticalCaseField[] = [
  "radicado",
  "demandante_nombre",
  "demandado_nombre",
  "tipo_proceso",
  "cuantia",
  "competencia_territorial",
];

const ALL_FIELDS: CriticalCaseField[] = [
  "radicado",
  "tipo_proceso",
  "subtipo_proceso",
  "demandante_nombre",
  "demandado_nombre",
  "cuantia",
  "competencia_territorial",
  "despacho",
  "pretensiones_resumen",
  "hechos_resumen",
  "fecha_demanda",
];

const CONFIDENCE_SCORES: Record<LlmConfidence, number> = {
  alto: 3,
  medio: 2,
  bajo: 1,
};

function parseConfidence(raw: string | undefined): LlmConfidence {
  const normalized = String(raw ?? "").trim().toLowerCase();
  if (normalized === "alto" || normalized === "medio" || normalized === "bajo") {
    return normalized;
  }

  return "medio";
}

function parseRequiredFields(raw: string | undefined): CriticalCaseField[] {
  if (!raw?.trim()) {
    return DEFAULT_REQUIRED_FIELDS;
  }

  const parsed = raw
    .split(",")
    .map((item) => item.trim())
    .filter((item): item is CriticalCaseField => ALL_FIELDS.includes(item as CriticalCaseField));

  if (parsed.length === 0) {
    return DEFAULT_REQUIRED_FIELDS;
  }

  return [...new Set(parsed)];
}

function normalizeRequiredFields(rawFields: string[] | undefined): CriticalCaseField[] {
  if (!rawFields || rawFields.length === 0) {
    return [];
  }

  return [...new Set(rawFields.filter((item): item is CriticalCaseField => ALL_FIELDS.includes(item as CriticalCaseField)))];
}

function hasMeaningfulValue(value: string | number | null): boolean {
  if (typeof value === "number") {
    return Number.isFinite(value);
  }

  if (typeof value === "string") {
    return value.trim().length > 0;
  }

  return false;
}

function getBlockingMode(blockOnMissing: boolean | undefined): "alert" | "block" {
  if (typeof blockOnMissing === "boolean") {
    return blockOnMissing ? "block" : "alert";
  }

  const enabled = String(process.env.LEGAL_CRITICAL_BLOCK_ON_MISSING ?? "false").toLowerCase();
  return enabled === "true" ? "block" : "alert";
}

export function evaluateCriticalFields(
  result: LlmExtractionResult,
  config?: CriticalFieldConfig
): CriticalFieldEvaluation {
  const requiredFields =
    normalizeRequiredFields(config?.required_fields).length > 0
      ? normalizeRequiredFields(config?.required_fields)
      : parseRequiredFields(process.env.LEGAL_CRITICAL_FIELDS);
  const minConfidence = parseConfidence(
    typeof config?.minimum_confidence === "string" ? config.minimum_confidence : process.env.LEGAL_CRITICAL_MIN_CONFIDENCE
  );
  const minScore = CONFIDENCE_SCORES[minConfidence];
  const blockingMode = getBlockingMode(config?.block_on_missing);

  const issues: CriticalFieldIssue[] = [];

  for (const fieldName of requiredFields) {
    const current = result.campos_caso[fieldName];
    const hasValue = hasMeaningfulValue(current.valor);
    const meetsConfidence = CONFIDENCE_SCORES[current.confianza] >= minScore;

    if (!hasValue) {
      issues.push({
        field: fieldName,
        reason: "missing",
        confidence: current.confianza,
        minimum_required: minConfidence,
        blocking: blockingMode === "block",
      });
      continue;
    }

    if (!meetsConfidence) {
      issues.push({
        field: fieldName,
        reason: "low_confidence",
        confidence: current.confianza,
        minimum_required: minConfidence,
        blocking: blockingMode === "block",
      });
    }
  }

  return {
    required_fields: requiredFields,
    minimum_confidence: minConfidence,
    blocking_mode: blockingMode,
    is_ready_for_submission: issues.every((item) => !item.blocking),
    issues,
    evaluated_at: new Date().toISOString(),
  };
}

export function parseCriticalFieldEvaluation(raw: unknown): CriticalFieldEvaluation | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const source = raw as {
    required_fields?: unknown;
    minimum_confidence?: unknown;
    blocking_mode?: unknown;
    is_ready_for_submission?: unknown;
    issues?: unknown;
    evaluated_at?: unknown;
  };

  const requiredFields = Array.isArray(source.required_fields)
    ? source.required_fields.filter(
        (item): item is CriticalCaseField => typeof item === "string" && ALL_FIELDS.includes(item as CriticalCaseField)
      )
    : [];

  if (requiredFields.length === 0) {
    return null;
  }

  const minimumConfidence = parseConfidence(
    typeof source.minimum_confidence === "string" ? source.minimum_confidence : undefined
  );

  const blockingMode = source.blocking_mode === "block" ? "block" : "alert";
  const issues = Array.isArray(source.issues)
    ? source.issues
        .map((item) => {
          if (!item || typeof item !== "object") {
            return null;
          }

          const issue = item as {
            field?: unknown;
            reason?: unknown;
            confidence?: unknown;
            minimum_required?: unknown;
            blocking?: unknown;
          };

          if (typeof issue.field !== "string" || !ALL_FIELDS.includes(issue.field as CriticalCaseField)) {
            return null;
          }

          const reason = issue.reason === "missing" ? "missing" : issue.reason === "low_confidence" ? "low_confidence" : null;
          if (!reason) {
            return null;
          }

          return {
            field: issue.field as CriticalCaseField,
            reason,
            confidence: parseConfidence(typeof issue.confidence === "string" ? issue.confidence : undefined),
            minimum_required: parseConfidence(
              typeof issue.minimum_required === "string" ? issue.minimum_required : undefined
            ),
            blocking: Boolean(issue.blocking),
          } satisfies CriticalFieldIssue;
        })
        .filter((item): item is CriticalFieldIssue => Boolean(item))
    : [];

  return {
    required_fields: requiredFields,
    minimum_confidence: minimumConfidence,
    blocking_mode: blockingMode,
    is_ready_for_submission: Boolean(source.is_ready_for_submission),
    issues,
    evaluated_at:
      typeof source.evaluated_at === "string" && source.evaluated_at.trim().length > 0
        ? source.evaluated_at
        : new Date().toISOString(),
  };
}
