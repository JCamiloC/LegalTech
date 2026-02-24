import type { CaseRecord, CaseRequirementsCheck, LegalArticleRecord, RuleDefinitionRecord } from "@/types";

interface ExpertAssistantDeps {
  getCaseById(caseId: string): Promise<CaseRecord | null>;
  getChecklist(caseId: string): Promise<CaseRequirementsCheck | null>;
  listActiveRules(): Promise<RuleDefinitionRecord[]>;
  listLegalArticles(): Promise<LegalArticleRecord[]>;
}

export interface ExpertAssistantResponse {
  resumen: string;
  recomendaciones: string[];
  camposSugeridos: string[];
  articulosRelevantes: Array<{ codigo: string; nombre: string }>;
  reglasRelevantes: Array<{ nombre: string; prioridad: number; resultado: string }>;
  siguientePaso: string;
}

const CHECKLIST_FIELD_HELP: Record<string, string> = {
  cumple_art_82: "Verifique que la demanda cumpla requisitos formales del artículo 82 del CGP.",
  anexos_completos: "Confirme que los anexos obligatorios estén cargados y legibles.",
  poder_aportado: "Valide poder cuando actúa apoderado judicial.",
  legitimacion_causa: "Revise legitimación por activa y pasiva conforme a las partes.",
  competencia_valida: "Compruebe competencia territorial y funcional del despacho.",
  titulo_ejecutivo_valido: "En ejecutivos, confirme título con mérito ejecutivo.",
  indebida_acumulacion: "Verifique ausencia de acumulación indebida de pretensiones.",
  caducidad: "Revise términos legales de caducidad.",
  prescripcion: "Revise posible configuración de prescripción.",
};

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 2);
}

function scoreByQuery(text: string, tokens: string[]): number {
  const normalized = text.toLowerCase();
  return tokens.reduce((score, token) => score + (normalized.includes(token) ? 1 : 0), 0);
}

function buildCaseRecommendations(caseRecord: CaseRecord | null, checklist: CaseRequirementsCheck | null): {
  recomendaciones: string[];
  siguientePaso: string;
  camposSugeridos: string[];
} {
  const recomendaciones: string[] = [];
  const camposSugeridos: string[] = [];

  if (!caseRecord) {
    return {
      recomendaciones: [
        "Cargue o seleccione un caso para recibir orientación contextual.",
        "Diligencie radicado, tipo de proceso y partes antes de evaluar reglas.",
      ],
      siguientePaso: "Complete el formulario base del caso y luego consulte nuevamente.",
      camposSugeridos: ["radicado", "tipo_proceso", "demandante_nombre", "demandado_nombre"],
    };
  }

  if (caseRecord.estado === "pendiente") {
    recomendaciones.push("El caso está en estado pendiente: complete y guarde checklist para habilitar evaluación.");
  }

  if (caseRecord.estado === "en_revision") {
    recomendaciones.push("El caso está en revisión: valide fundamento y motivación antes de decisión final.");
  }

  if (caseRecord.estado === "decidido") {
    recomendaciones.push("El caso está decidido: revise coherencia entre decisión final y plantilla seleccionada.");
  }

  if (!checklist) {
    recomendaciones.push("Aún no hay checklist guardado. Diligéncielo para activar el motor de reglas.");
    return {
      recomendaciones,
      siguientePaso: "Guardar checklist procesal.",
      camposSugeridos: Object.keys(CHECKLIST_FIELD_HELP),
    };
  }

  const missingFields = Object.entries(CHECKLIST_FIELD_HELP)
    .filter(([key]) => checklist[key as keyof CaseRequirementsCheck] === false)
    .map(([key, message]) => ({ key, message }));

  if (missingFields.length > 0) {
    recomendaciones.push(...missingFields.slice(0, 4).map((item) => item.message));
    camposSugeridos.push(...missingFields.map((item) => item.key));
  } else {
    recomendaciones.push("Checklist sin alertas negativas explícitas. Puede ejecutar evaluación de reglas.");
  }

  const siguientePaso =
    caseRecord.estado === "pendiente"
      ? "Ejecutar motor de reglas para obtener decisión sugerida."
      : caseRecord.estado === "en_revision"
      ? "Guardar decisión final y descargar documento."
      : "Validar documento final descargado y cerrar trámite.";

  return {
    recomendaciones,
    siguientePaso,
    camposSugeridos,
  };
}

export class ExpertAssistantService {
  constructor(private readonly deps: ExpertAssistantDeps) {}

  async answer(params: { question: string; caseId?: string }): Promise<ExpertAssistantResponse> {
    const question = params.question.trim();
    const tokens = tokenize(question);

    const [rules, articles, caseRecord, checklist] = await Promise.all([
      this.deps.listActiveRules(),
      this.deps.listLegalArticles(),
      params.caseId ? this.deps.getCaseById(params.caseId) : Promise.resolve(null),
      params.caseId ? this.deps.getChecklist(params.caseId) : Promise.resolve(null),
    ]);

    const rankedRules = rules
      .map((rule) => ({
        rule,
        score:
          scoreByQuery(`${rule.nombre} ${rule.descripcion} ${rule.fundamento} ${rule.resultado}`, tokens) +
          Math.max(0, 10 - rule.prioridad),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map((item) => ({
        nombre: item.rule.nombre,
        prioridad: item.rule.prioridad,
        resultado: item.rule.resultado,
      }));

    const rankedArticles = articles
      .map((article) => ({
        article,
        score: scoreByQuery(`${article.codigo} ${article.nombre} ${article.descripcion} ${article.aplica_a}`, tokens),
      }))
      .filter((item) => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
      .map((item) => ({
        codigo: item.article.codigo,
        nombre: item.article.nombre,
      }));

    const caseGuidance = buildCaseRecommendations(caseRecord, checklist);

    const resumen = caseRecord
      ? `Asistente offline activo para el caso ${caseRecord.radicado}. Respuesta basada en reglas y base legal local.`
      : "Asistente offline activo. Respuesta basada en reglas y base legal local del proyecto.";

    const recomendaciones = [
      ...caseGuidance.recomendaciones,
      rankedRules.length > 0
        ? `Reglas potencialmente relevantes: ${rankedRules.map((item) => item.nombre).join(", ")}.`
        : "No se identificaron reglas claramente relacionadas con la pregunta; refine el texto o valide campos del caso.",
      rankedArticles.length > 0
        ? `Artículos potencialmente relacionados: ${rankedArticles.map((item) => item.codigo).join(", ")}.`
        : "No se detectaron artículos directamente coincidentes en el catálogo actual.",
    ];

    return {
      resumen,
      recomendaciones,
      camposSugeridos: caseGuidance.camposSugeridos,
      articulosRelevantes: rankedArticles,
      reglasRelevantes: rankedRules,
      siguientePaso: caseGuidance.siguientePaso,
    };
  }
}
