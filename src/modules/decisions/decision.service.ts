import type { DecisionRecord } from "@/types";
import { DecisionRepository } from "./decision.repository";

export class DecisionService {
  constructor(private readonly repository: DecisionRepository) {}

  listByCaseId(caseId: string) {
    return this.repository.listByCaseId(caseId);
  }

  getLatestByCaseId(caseId: string) {
    return this.repository.findLatestByCaseId(caseId);
  }

  saveDecision(payload: Omit<DecisionRecord, "id" | "created_at">) {
    return this.repository.create(payload);
  }

  attachDocument(decisionId: string, documentUrl: string) {
    return this.repository.updateDocumentUrl(decisionId, documentUrl);
  }

  updateMotivation(decisionId: string, motivation: string) {
    return this.repository.updateMotivation(decisionId, motivation);
  }

  updateDecision(
    decisionId: string,
    payload: {
      tipo_decision: DecisionRecord["tipo_decision"];
      fundamento_juridico: string;
      motivacion: string;
      articulos_aplicados: string;
    }
  ) {
    return this.repository.updateDecision(decisionId, payload);
  }
}