import type { DecisionType } from "@/types";
import { TemplateRepository } from "./template.repository";

export class TemplateManagementService {
  constructor(private readonly repository: TemplateRepository) {}

  listTemplates() {
    return this.repository.listAll();
  }

  createTemplate(input: {
    nombre: string;
    tipo_decision: DecisionType;
    contenido_html: string;
    activo: boolean;
  }) {
    return this.repository.create(input);
  }

  updateTemplate(
    templateId: string,
    input: {
      nombre: string;
      tipo_decision: DecisionType;
      contenido_html: string;
      activo: boolean;
    }
  ) {
    return this.repository.update(templateId, input);
  }

  setTemplateActive(templateId: string, active: boolean) {
    return this.repository.setActive(templateId, active);
  }
}