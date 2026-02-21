export type CaseStatus = "pendiente" | "en_revision" | "decidido";

export interface CaseRecord {
  id: string;
  radicado: string;
  demandante_nombre: string;
  demandado_nombre: string;
  tipo_proceso: string;
  subtipo_proceso: string | null;
  cuantia: number | null;
  competencia_territorial: string | null;
  despacho: string | null;
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