export interface TemplateVariables {
  radicado: string;
  demandante: string;
  demandado: string;
  fundamento: string;
  decision: string;
  despacho?: string;
}

const TEMPLATE_KEYS: Array<keyof TemplateVariables> = [
  "radicado",
  "demandante",
  "demandado",
  "fundamento",
  "decision",
  "despacho",
];

export function renderTemplate(template: string, variables: TemplateVariables): string {
  return TEMPLATE_KEYS.reduce((accumulator, key) => {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    return accumulator.replace(placeholder, variables[key] ?? "");
  }, template);
}