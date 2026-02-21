import type { DecisionType } from "./case";

export interface DecisionRecord {
  id: string;
  case_id: string;
  tipo_decision: DecisionType;
  fundamento_juridico: string;
  motivacion: string;
  articulos_aplicados: string;
  fecha_generacion: string;
  documento_url: string | null;
  created_at: string;
}

export interface DecisionSuggestion {
  tipoDecision: DecisionType;
  fundamento: string;
  explicacion: {
    resumen: string;
    reglasEvaluadas: RuleEvaluationResult[];
  };
}

export interface RuleEvaluationResult {
  ruleId: string;
  nombre: string;
  matched: boolean;
  prioridad: number;
  resultado: string;
  fundamento: string;
}