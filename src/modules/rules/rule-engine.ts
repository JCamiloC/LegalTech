import type { SupabaseClient } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type {
  CaseRecord,
  CaseRequirementsCheck,
  DecisionSuggestion,
  DecisionType,
  RuleCondition,
  RuleDefinitionRecord,
  RuleEvaluationResult,
} from "@/types";
import { CaseRepository } from "@/modules/cases/case.repository";
import { RuleRepository } from "./rule.repository";

type EvaluationContext = Record<string, string | number | boolean | null | undefined>;

interface RuleEngineDependencies {
  caseRepository: CaseRepository;
  ruleRepository: RuleRepository;
}

const DEFAULT_DECISION: DecisionType = "auto_inadmisorio";

function toContext(caseRecord: CaseRecord, checklist: CaseRequirementsCheck | null): EvaluationContext {
  return {
    ...caseRecord,
    ...(checklist ?? {}),
  };
}

function getFieldValue(context: EvaluationContext, field: string) {
  return context[field];
}

function isNumericComparable(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const numericValue = Number(value);
  return !Number.isNaN(numericValue);
}

function countConditionComplexity(condition: RuleCondition): number {
  switch (condition.op) {
    case "and":
    case "or":
      return 1 + condition.conditions.reduce((total, item) => total + countConditionComplexity(item), 0);
    case "not":
      return 1 + countConditionComplexity(condition.condition);
    default:
      return 1;
  }
}

function describeCondition(condition: RuleCondition, context: EvaluationContext): string {
  switch (condition.op) {
    case "and":
      return `AND(${condition.conditions.map((item) => describeCondition(item, context)).join("; ")})`;
    case "or":
      return `OR(${condition.conditions.map((item) => describeCondition(item, context)).join("; ")})`;
    case "not":
      return `NOT(${describeCondition(condition.condition, context)})`;
    case "is_true":
    case "is_false": {
      const currentValue = Boolean(getFieldValue(context, condition.field));
      return `${condition.field}=${currentValue}`;
    }
    case "in": {
      const currentValue = getFieldValue(context, condition.field);
      return `${condition.field}=${String(currentValue)} IN [${condition.value.join(", ")}]`;
    }
    default: {
      const currentValue = getFieldValue(context, condition.field);
      return `${condition.field}(${String(currentValue)}) ${condition.op} ${String(condition.value)}`;
    }
  }
}

function evaluateCondition(condition: RuleCondition, context: EvaluationContext): boolean {
  switch (condition.op) {
    case "and":
      return condition.conditions.every((nestedCondition) => evaluateCondition(nestedCondition, context));
    case "or":
      return condition.conditions.some((nestedCondition) => evaluateCondition(nestedCondition, context));
    case "not":
      return !evaluateCondition(condition.condition, context);
    case "is_true":
      return Boolean(getFieldValue(context, condition.field)) === true;
    case "is_false":
      return Boolean(getFieldValue(context, condition.field)) === false;
    case "in": {
      const currentValue = getFieldValue(context, condition.field);
      return condition.value.includes(currentValue as string | number | boolean);
    }
    case "eq":
    case "neq":
    case "gte":
    case "lte":
    case "gt":
    case "lt": {
      const currentValue = getFieldValue(context, condition.field) as string | number | boolean | null | undefined;
      const targetValue = condition.value;

      switch (condition.op) {
        case "eq":
          return currentValue === targetValue;
        case "neq":
          return currentValue !== targetValue;
        case "gte":
          if (!isNumericComparable(currentValue) || !isNumericComparable(targetValue)) return false;
          return Number(currentValue) >= Number(targetValue);
        case "lte":
          if (!isNumericComparable(currentValue) || !isNumericComparable(targetValue)) return false;
          return Number(currentValue) <= Number(targetValue);
        case "gt":
          if (!isNumericComparable(currentValue) || !isNumericComparable(targetValue)) return false;
          return Number(currentValue) > Number(targetValue);
        case "lt":
          if (!isNumericComparable(currentValue) || !isNumericComparable(targetValue)) return false;
          return Number(currentValue) < Number(targetValue);
        default:
          return false;
      }
    }
    default:
      return false;
  }
}

function mapResultToDecision(result: string): DecisionType {
  switch (result) {
    case "auto_admisorio":
    case "auto_inadmisorio":
    case "mandamiento_pago":
    case "auto_rechaza_demanda":
      return result;
    default:
      return DEFAULT_DECISION;
  }
}

function toEvaluation(rule: RuleDefinitionRecord, matched: boolean): RuleEvaluationResult {
  const complejidad = countConditionComplexity(rule.condicion_json);
  const score = matched ? Math.max(1, 1000 - rule.prioridad * 10 + complejidad * 3) : 0;

  return {
    ruleId: rule.id,
    nombre: rule.nombre,
    matched,
    prioridad: rule.prioridad,
    resultado: rule.resultado,
    fundamento: rule.fundamento,
    score,
    complejidad,
    razones: [],
  };
}

function getChecklistMissingItems(context: EvaluationContext): string[] {
  const fields: Array<{ key: string; label: string }> = [
    { key: "cumple_art_82", label: "Cumplimiento del artículo 82" },
    { key: "anexos_completos", label: "Anexos completos" },
    { key: "poder_aportado", label: "Poder aportado" },
    { key: "legitimacion_causa", label: "Legitimación en la causa" },
    { key: "competencia_valida", label: "Competencia válida" },
    { key: "titulo_ejecutivo_valido", label: "Título ejecutivo válido" },
    { key: "indebida_acumulacion", label: "Ausencia de indebida acumulación" },
    { key: "caducidad", label: "Ausencia de caducidad" },
    { key: "prescripcion", label: "Ausencia de prescripción" },
  ];

  return fields.filter((item) => context[item.key] === false).map((item) => item.label);
}

function buildStandardArgument(params: {
  caseRecord: CaseRecord;
  selectedRule: RuleDefinitionRecord | null;
  decision: DecisionType;
  context: EvaluationContext;
  evaluations: RuleEvaluationResult[];
  defaultFundamento: string;
}): {
  resumen: string;
  hechosRelevantes: string[];
  analisis: string[];
  conclusion: string;
  argumentoEstandar: string;
} {
  const { caseRecord, selectedRule, decision, context, evaluations, defaultFundamento } = params;

  const matchedRules = evaluations.filter((item) => item.matched);
  const missingChecklist = getChecklistMissingItems(context);

  const hechosRelevantes = [
    `Radicado: ${caseRecord.radicado}.`,
    `Proceso: ${caseRecord.tipo_proceso}${caseRecord.subtipo_proceso ? ` (${caseRecord.subtipo_proceso})` : ""}.`,
    `Partes: ${caseRecord.demandante_nombre} vs ${caseRecord.demandado_nombre}.`,
    caseRecord.cuantia ? `Cuantía reportada: ${caseRecord.cuantia}.` : "Cuantía no informada en el expediente.",
  ];

  const analisis = [
    matchedRules.length > 0
      ? `Se evaluaron ${evaluations.length} reglas activas y coincidieron ${matchedRules.length}.`
      : `Se evaluaron ${evaluations.length} reglas activas sin coincidencias concluyentes.`,
    selectedRule
      ? `Regla prevalente aplicada: ${selectedRule.nombre} (prioridad ${selectedRule.prioridad}).`
      : "No se identificó regla prevalente; aplica criterio de revisión jurídica manual.",
    missingChecklist.length > 0
      ? `Aspectos críticos a revisar: ${missingChecklist.join(", ")}.`
      : "No se detectaron incumplimientos explícitos en los ítems del checklist diligenciado.",
  ];

  const conclusion = selectedRule
    ? `Con fundamento en la regla prevalente y el análisis del contexto procesal, se sugiere ${decision}.`
    : `Ante ausencia de regla concluyente, se sugiere ${decision} con revisión reforzada por el operador jurídico.`;

  const argumentoEstandar = [
    "I. Hechos relevantes",
    ...hechosRelevantes.map((item) => `- ${item}`),
    "",
    "II. Análisis jurídico",
    ...analisis.map((item) => `- ${item}`),
    selectedRule ? `- Fundamento de regla aplicada: ${selectedRule.fundamento}.` : `- Fundamento base: ${defaultFundamento}.`,
    "",
    "III. Subsumción y decisión",
    `- ${conclusion}`,
  ].join("\n");

  return {
    resumen: selectedRule
      ? `Se sugiere ${decision} por aplicación prevalente de ${selectedRule.nombre}.`
      : `Sin regla prevalente. Se sugiere ${decision} sujeto a validación del despacho.`,
    hechosRelevantes,
    analisis,
    conclusion,
    argumentoEstandar,
  };
}

async function getDependencies(supabase?: SupabaseClient): Promise<RuleEngineDependencies> {
  const resolvedSupabase = supabase ?? (await createSupabaseServerClient());

  return {
    caseRepository: new CaseRepository(resolvedSupabase),
    ruleRepository: new RuleRepository(resolvedSupabase),
  };
}

export async function evaluateCase(caseId: string, supabase?: SupabaseClient): Promise<DecisionSuggestion> {
  const dependencies = await getDependencies(supabase);

  const [caseRecord, checklist, rules] = await Promise.all([
    dependencies.caseRepository.findById(caseId),
    dependencies.caseRepository.findChecklistByCaseId(caseId),
    dependencies.ruleRepository.listActiveRules(),
  ]);

  if (!caseRecord) {
    return {
      tipoDecision: DEFAULT_DECISION,
      fundamento: "No fue posible cargar el caso solicitado.",
      explicacion: {
        resumen: "Caso no encontrado para evaluación.",
        reglasEvaluadas: [],
        hechosRelevantes: [],
        analisis: [],
        conclusion: "No es posible concluir sin información del caso.",
        argumentoEstandar: "Caso no encontrado para evaluación.",
      },
    };
  }

  const context = toContext(caseRecord, checklist);
  const evaluations: RuleEvaluationResult[] = rules.map((rule) => {
    const matched = evaluateCondition(rule.condicion_json, context);
    const evaluation = toEvaluation(rule, matched);
    evaluation.razones = [describeCondition(rule.condicion_json, context)];
    return evaluation;
  });

  const matchedRules = rules
    .map((rule, index) => ({ rule, evaluation: evaluations[index] }))
    .filter((item) => item.evaluation.matched)
    .sort((a, b) => {
      if (a.rule.prioridad !== b.rule.prioridad) {
        return a.rule.prioridad - b.rule.prioridad;
      }

      return b.evaluation.complejidad - a.evaluation.complejidad;
    });

  const matchedRule = matchedRules.length > 0 ? matchedRules[0].rule : null;

  if (!matchedRule) {
    const robustExplanation = buildStandardArgument({
      caseRecord,
      selectedRule: null,
      decision: DEFAULT_DECISION,
      context,
      evaluations,
      defaultFundamento: "No se activó regla concluyente. Requiere valoración del operador jurídico.",
    });

    return {
      tipoDecision: DEFAULT_DECISION,
      fundamento: "No se activó ninguna regla específica. Se sugiere revisión manual.",
      explicacion: {
        resumen: robustExplanation.resumen,
        reglasEvaluadas: evaluations,
        hechosRelevantes: robustExplanation.hechosRelevantes,
        analisis: robustExplanation.analisis,
        conclusion: robustExplanation.conclusion,
        argumentoEstandar: robustExplanation.argumentoEstandar,
      },
    };
  }

  const suggestedDecision = mapResultToDecision(matchedRule.resultado);
  const robustExplanation = buildStandardArgument({
    caseRecord,
    selectedRule: matchedRule,
    decision: suggestedDecision,
    context,
    evaluations,
    defaultFundamento: matchedRule.fundamento,
  });

  return {
    tipoDecision: suggestedDecision,
    fundamento: matchedRule.fundamento,
    explicacion: {
      resumen: robustExplanation.resumen,
      reglasEvaluadas: evaluations,
      hechosRelevantes: robustExplanation.hechosRelevantes,
      analisis: robustExplanation.analisis,
      conclusion: robustExplanation.conclusion,
      argumentoEstandar: robustExplanation.argumentoEstandar,
    },
  };
}