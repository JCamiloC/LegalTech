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
          return Number(currentValue) >= Number(targetValue);
        case "lte":
          return Number(currentValue) <= Number(targetValue);
        case "gt":
          return Number(currentValue) > Number(targetValue);
        case "lt":
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
  return {
    ruleId: rule.id,
    nombre: rule.nombre,
    matched,
    prioridad: rule.prioridad,
    resultado: rule.resultado,
    fundamento: rule.fundamento,
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
      },
    };
  }

  const context = toContext(caseRecord, checklist);
  const evaluations: RuleEvaluationResult[] = [];
  let matchedRule: RuleDefinitionRecord | null = null;

  for (const rule of rules) {
    const matched = evaluateCondition(rule.condicion_json, context);
    evaluations.push(toEvaluation(rule, matched));

    if (matched && matchedRule === null) {
      matchedRule = rule;
      break;
    }
  }

  if (!matchedRule) {
    return {
      tipoDecision: DEFAULT_DECISION,
      fundamento: "No se activó ninguna regla específica. Se sugiere revisión manual.",
      explicacion: {
        resumen: "Sin coincidencias en reglas activas; aplicar revisión jurídica del despacho.",
        reglasEvaluadas: evaluations,
      },
    };
  }

  return {
    tipoDecision: mapResultToDecision(matchedRule.resultado),
    fundamento: matchedRule.fundamento,
    explicacion: {
      resumen: `Regla aplicada: ${matchedRule.nombre} (prioridad ${matchedRule.prioridad}).`,
      reglasEvaluadas: evaluations,
    },
  };
}