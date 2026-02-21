import type { RuleCondition } from "@/types";
import { RuleRepository } from "./rule.repository";

export class RuleService {
  constructor(private readonly repository: RuleRepository) {}

  listRules() {
    return this.repository.listAllRules();
  }

  createRule(input: {
    nombre: string;
    descripcion: string;
    condicion_json: RuleCondition;
    resultado: string;
    fundamento: string;
    prioridad: number;
    activo: boolean;
  }) {
    return this.repository.createRule(input);
  }

  updateRule(
    ruleId: string,
    input: {
      nombre: string;
      descripcion: string;
      condicion_json: RuleCondition;
      resultado: string;
      fundamento: string;
      prioridad: number;
    }
  ) {
    return this.repository.updateRule(ruleId, input);
  }

  setRuleActive(ruleId: string, active: boolean) {
    return this.repository.setRuleActive(ruleId, active);
  }
}