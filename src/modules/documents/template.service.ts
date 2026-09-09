export interface TemplateVariables {
  [key: string]: string | undefined;
  radicado: string;
  demandante: string;
  demandado: string;
  fundamento: string;
  decision: string;
  despacho?: string;
  pretensiones_resumen?: string;
  hechos_resumen?: string;
  fecha_demanda?: string;
  parte_motiva?: string;
  defectos_identificados?: string;
  fundamento_normativo?: string;
}

const PLACEHOLDER_REGEX = /{{\s*([a-zA-Z0-9_]+)\s*}}/g;

export function renderTemplate(template: string, variables: TemplateVariables): string {
  return Object.keys(variables).reduce((accumulator, key) => {
    const placeholder = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    return accumulator.replace(placeholder, variables[key as keyof TemplateVariables] ?? "");
  }, template);
}

export function getUnresolvedTemplatePlaceholders(renderedTemplate: string): string[] {
  const found = new Set<string>();
  let match: RegExpExecArray | null = PLACEHOLDER_REGEX.exec(renderedTemplate);

  while (match) {
    const key = String(match[1] ?? "").trim();
    if (key.length > 0) {
      found.add(key);
    }
    match = PLACEHOLDER_REGEX.exec(renderedTemplate);
  }

  return Array.from(found);
}

export function renderTemplateStrict(template: string, variables: TemplateVariables): {
  rendered: string;
  unresolved: string[];
} {
  // Strict legal mode: do not rewrite punctuation or accents, only placeholder substitution.
  const rendered = renderTemplate(template, variables);
  const unresolved = getUnresolvedTemplatePlaceholders(rendered);

  return {
    rendered,
    unresolved,
  };
}