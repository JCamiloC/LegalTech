export interface LegalArticleRecord {
  id: string;
  codigo: string;
  nombre: string;
  descripcion: string;
  aplica_a: string;
  created_at: string;
}

export type RuleCondition =
  | {
      op: "and" | "or";
      conditions: RuleCondition[];
    }
  | {
      op: "not";
      condition: RuleCondition;
    }
  | {
      op: "eq" | "neq" | "gte" | "lte" | "gt" | "lt";
      field: string;
      value: string | number | boolean | null;
    }
  | {
      op: "in";
      field: string;
      value: Array<string | number | boolean>;
    }
  | {
      op: "is_true" | "is_false";
      field: string;
    };

export interface RuleDefinitionRecord {
  id: string;
  nombre: string;
  descripcion: string;
  condicion_json: RuleCondition;
  resultado: string;
  fundamento: string;
  prioridad: number;
  activo: boolean;
  created_at: string;
}