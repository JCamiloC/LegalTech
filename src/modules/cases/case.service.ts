import { CaseRepository } from "./case.repository";
import type { DecisionType } from "@/types";

interface CreateCasePayload {
  radicado: string;
  demandante_nombre: string;
  demandado_nombre: string;
  tipo_proceso: string;
  subtipo_proceso?: string | null;
  cuantia?: number | null;
  competencia_territorial?: string | null;
  despacho?: string | null;
}

interface ChecklistPayload {
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
}

export class CaseService {
  constructor(private readonly repository: CaseRepository) {}

  listCases() {
    return this.repository.list();
  }

  createCase(input: CreateCasePayload) {
    return this.repository.create(input);
  }

  updateCase(caseId: string, input: Partial<CreateCasePayload>) {
    return this.repository.update(caseId, input);
  }

  getCaseById(caseId: string) {
    return this.repository.findById(caseId);
  }

  getLatestChecklist(caseId: string) {
    return this.repository.findChecklistByCaseId(caseId);
  }

  saveChecklist(caseId: string, checklist: ChecklistPayload) {
    return this.repository.upsertChecklist(caseId, checklist);
  }

  setSuggestedDecision(caseId: string, decision: DecisionType) {
    return this.repository.setSuggestedDecision(caseId, decision);
  }

  setFinalDecision(caseId: string, decision: DecisionType) {
    return this.repository.setFinalDecision(caseId, decision);
  }
  
  async deleteCase(caseId: string): Promise<boolean> {
    return this.repository.delete(caseId);
  }
}