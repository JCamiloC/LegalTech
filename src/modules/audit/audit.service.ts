import { AuditRepository } from "./audit.repository";

export class AuditService {
  constructor(private readonly repository: AuditRepository) {}

  logCaseEvent(caseId: string, eventType: string, eventData?: Record<string, unknown> | null) {
    return this.repository.logCaseEvent({ caseId, eventType, eventData });
  }
}