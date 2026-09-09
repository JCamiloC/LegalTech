export type LlmConfidence = "alto" | "medio" | "bajo";

export interface LlmCaseField<T> {
  valor: T;
  confianza: LlmConfidence;
}

export interface LlmChecklistItem {
  valor: boolean;
  razon: string;
}

export interface LlmExtractionResult {
  campos_caso: {
    radicado: LlmCaseField<string>;
    tipo_proceso: LlmCaseField<string>;
    subtipo_proceso: LlmCaseField<string | null>;
    demandante_nombre: LlmCaseField<string>;
    demandado_nombre: LlmCaseField<string>;
    cuantia: LlmCaseField<number | null>;
    competencia_territorial: LlmCaseField<string | null>;
    despacho: LlmCaseField<string | null>;
    pretensiones_resumen: LlmCaseField<string | null>;
    hechos_resumen: LlmCaseField<string | null>;
    fecha_demanda: LlmCaseField<string | null>;
  };
  checklist: {
    cumple_art_82: LlmChecklistItem;
    anexos_completos: LlmChecklistItem;
    poder_aportado: LlmChecklistItem;
    legitimacion_causa: LlmChecklistItem;
    competencia_valida: LlmChecklistItem;
    titulo_ejecutivo_valido: LlmChecklistItem;
    indebida_acumulacion: LlmChecklistItem;
    caducidad: LlmChecklistItem;
    prescripcion: LlmChecklistItem;
  };
  inventario_documentos: {
    encontrados: string[];
    faltantes: string[];
    requeridos_por_tipo_proceso: string[];
  };
}

export interface LlmExtractionFormFields {
  radicado?: string;
  tipo_proceso?: string;
  subtipo_proceso?: string;
  demandante_nombre?: string;
  demandado_nombre?: string;
  cuantia?: string;
  competencia_territorial?: string;
  despacho?: string;
  pretensiones_resumen?: string;
  hechos_resumen?: string;
  fecha_demanda?: string;
  checklist_json?: string;
  inventario_json?: string;
  llm_confianza_json?: string;
  critical_eval_json?: string;
  llm_extraccion_json?: string;
}

export interface LlmDecisionNormativeReference {
  articulo: string;
  texto_relevante: string;
}

export interface LlmDecisionKnowledgeReference {
  titulo: string;
  tipo_documento: string;
  etiquetas: string[];
  score: number;
}

export interface LlmDecisionResult {
  decision_sugerida: "auto_admisorio" | "auto_inadmisorio" | "mandamiento_pago" | "auto_rechaza_demanda";
  confianza: LlmConfidence;
  fundamento_normativo: LlmDecisionNormativeReference[];
  analisis_checklist: string;
  parte_motiva_borrador: string;
  defectos_identificados: string[];
  casos_similares_usados: number;
  biblioteca_contexto_usado: LlmDecisionKnowledgeReference[];
}
