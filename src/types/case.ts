export type CaseStatus = "pendiente" | "en_revision" | "decidido";

export interface CaseRecord {
  id: string;
  profile_id: string | null;
  radicado: string;
  demandante_nombre: string;
  demandado_nombre: string;
  tipo_proceso: string;
  subtipo_proceso: string | null;
  cuantia: number | null;
  competencia_territorial: string | null;
  despacho: string | null;
  pretensiones_resumen: string | null;
  hechos_resumen: string | null;
  fecha_demanda: string | null;
  parte_motiva_borrador: string | null;
  llm_extraccion_json: Record<string, unknown> | null;
  llm_confianza_promedio: "alto" | "medio" | "bajo" | null;
  estado: CaseStatus;
  decision_sugerida: DecisionType | null;
  decision_final: DecisionType | null;
  created_at: string;
  updated_at: string;
}

export interface CaseRequirementsCheck {
  id: string;
  case_id: string;
  cumple_art_82: boolean;
  anexos_completos: boolean;
  poder_aportado: boolean;
  legitimacion_causa: boolean;
  competencia_valida: boolean;
  titulo_ejecutivo_valido: boolean;
  indebida_acumulacion: boolean;
  caducidad: boolean;
  prescripcion: boolean;
  observaciones: string | null;
  created_at: string;
}

export type DecisionType =
  | "auto_admisorio"
  | "auto_inadmisorio"
  | "mandamiento_pago"
  | "auto_rechaza_demanda";

export interface CaseAiSuggestionRecord {
  id: string;
  case_id: string;
  decision_sugerida: DecisionType;
  confianza: "alto" | "medio" | "bajo";
  fundamento_json: Array<{ articulo: string; texto_relevante: string }> | null;
  analisis_checklist: string | null;
  parte_motiva_borrador: string | null;
  defectos_json: string[] | null;
  casos_similares_usados: number;
  biblioteca_contexto_json: Array<{
    titulo: string;
    tipo_documento: string;
    etiquetas: string[];
    score: number;
  }> | null;
  fue_correcta: boolean | null;
  decision_final_real: DecisionType | null;
  created_at: string;
}