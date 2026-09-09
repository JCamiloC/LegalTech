import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { DecisionRepository, DecisionService } from "@/modules/decisions";
import {
  buildInstitutionalTemplateHtml,
  createDocxBufferFromTemplate,
  normalizeDecisionType,
  TemplateRepository,
} from "@/modules/documents";

export const runtime = "nodejs";

const DEFAULT_TEMPLATE = `<h1>{{despacho}}</h1>
<p>Radicado: {{radicado}}</p>
<p>Demandante: {{demandante}}</p>
<p>Demandado: {{demandado}}</p>
<p>Decisión: {{decision}}</p>
<p>Fundamento: {{fundamento}}</p>`;

function safeFileSegment(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9-_]+/g, "-")
    .replace(/-{2,}/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

interface ProfileTemplateRow {
  titulo: string;
  contenido_texto: string | null;
  decision_type_normalized: string | null;
  decision_type_alias: string | null;
  metadata_json: Record<string, unknown>;
  updated_at: string;
}

function parseDecisionTypeFromMetadata(metadata: Record<string, unknown>): string {
  return normalizeDecisionType(String(metadata.tipo_decision ?? "general")).normalized;
}

async function resolveProfileStrictTemplate(params: {
  profileId: string | null;
  decisionType: string;
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>;
}): Promise<{ template: string; templateName: string } | null> {
  if (!params.profileId) {
    return null;
  }

  const result = await params.supabase
    .from("knowledge_documents")
    .select("titulo,contenido_texto,decision_type_normalized,decision_type_alias,metadata_json,updated_at")
    .eq("profile_id", params.profileId)
    .eq("tipo_documento", "plantilla_legal")
    .eq("activo", true)
    .order("updated_at", { ascending: false })
    .limit(50);

  const candidates = ((result.data ?? []) as ProfileTemplateRow[]).filter(
    (item) => String(item.contenido_texto ?? "").trim().length > 0
  );

  if (candidates.length === 0) {
    return null;
  }

  const exact = candidates.find(
    (item) => {
      const rowDecision = normalizeDecisionType(
        item.decision_type_normalized ?? item.decision_type_alias ?? parseDecisionTypeFromMetadata(item.metadata_json)
      ).normalized;
      return rowDecision === normalizeDecisionType(params.decisionType).normalized;
    }
  );
  const general = candidates.find((item) => {
    const rowDecision = normalizeDecisionType(
      item.decision_type_normalized ?? item.decision_type_alias ?? parseDecisionTypeFromMetadata(item.metadata_json)
    ).normalized;
    return rowDecision === "general";
  });
  const selected = exact ?? general ?? candidates[0];

  return {
    template: String(selected.contenido_texto ?? ""),
    templateName: selected.titulo,
  };
}

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId");
  const kind = request.nextUrl.searchParams.get("kind");
  const isCorrectionReport = kind === "acta_correcciones";

  if (!caseId) {
    return NextResponse.json({ error: "caseId es requerido" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const decisionService = new DecisionService(new DecisionRepository(supabase));
  const templateRepository = new TemplateRepository(supabase);

  const [caseRecord, decision] = await Promise.all([
    caseService.getCaseById(caseId),
    decisionService.getLatestByCaseId(caseId),
  ]);

  const latestSuggestionResult = await supabase
    .from("case_ai_suggestions")
    .select("fundamento_json,defectos_json")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestSuggestion = latestSuggestionResult.data as
    | {
        fundamento_json: Array<{ articulo: string; texto_relevante: string }> | null;
        defectos_json: string[] | null;
      }
    | null;

  if (!caseRecord || !decision) {
    return NextResponse.json(
      { error: "No existe información suficiente para generar el documento" },
      { status: 404 }
    );
  }

  if (!isCorrectionReport && caseRecord.estado !== "decidido") {
    return NextResponse.json(
      { error: "El caso debe estar en estado decidido para descargar DOCX" },
      { status: 409 }
    );
  }

  if (isCorrectionReport && caseRecord.estado === "pendiente") {
    return NextResponse.json(
      { error: "El caso debe estar en revisión o decidido para generar acta de correcciones" },
      { status: 409 }
    );
  }

  const latestChecklistResult = await supabase
    .from("case_requirements_check")
    .select("*")
    .eq("case_id", caseId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestChecklist = latestChecklistResult.data as Record<string, unknown> | null;

  const correctionItems: string[] = [
    ...(latestSuggestion?.defectos_json ?? []),
    ...[
      ["cumple_art_82", "Ajustar requisitos del artículo 82 del CGP"],
      ["anexos_completos", "Completar anexos requeridos del proceso"],
      ["poder_aportado", "Aportar poder del apoderado"],
      ["legitimacion_causa", "Acreditar legitimación en la causa"],
      ["competencia_valida", "Aclarar competencia territorial"],
      ["titulo_ejecutivo_valido", "Aportar título ejecutivo válido"],
      ["indebida_acumulacion", "Corregir indebida acumulación de pretensiones"],
      ["caducidad", "Subsanar observación relacionada con caducidad"],
      ["prescripcion", "Subsanar observación relacionada con prescripción"],
    ]
      .filter(([field]) => latestChecklist && latestChecklist[field] === false)
      .map(([, message]) => String(message)),
  ];

  const uniqueCorrectionItems = Array.from(new Set(correctionItems.map((item) => item.trim()).filter(Boolean)));

  const variables = {
    radicado: caseRecord.radicado,
    despacho: caseRecord.despacho ?? "Despacho por definir",
    demandante: caseRecord.demandante_nombre,
    demandado: caseRecord.demandado_nombre,
    fundamento: decision.fundamento_juridico,
    decision: decision.tipo_decision,
    pretensiones_resumen: caseRecord.pretensiones_resumen ?? "",
    hechos_resumen: caseRecord.hechos_resumen ?? "",
    fecha_demanda: caseRecord.fecha_demanda ?? "",
    parte_motiva: caseRecord.parte_motiva_borrador ?? "",
    defectos_identificados: (latestSuggestion?.defectos_json ?? []).join("; "),
    fundamento_normativo: (latestSuggestion?.fundamento_json ?? [])
      .map((item) => `${item.articulo}: ${item.texto_relevante}`)
      .join("\n"),
  };

  const institutionalPreview = await buildInstitutionalTemplateHtml({
    radicado: caseRecord.radicado,
    demandante: caseRecord.demandante_nombre,
    demandado: caseRecord.demandado_nombre,
    tipoProceso: caseRecord.tipo_proceso,
    decision: decision.tipo_decision,
    fundamento: decision.fundamento_juridico,
    cuantia: caseRecord.cuantia,
  });

  const profileTemplate = await resolveProfileStrictTemplate({
    profileId: caseRecord.profile_id,
    decisionType: decision.tipo_decision,
    supabase,
  });

  const template = await templateRepository.findActiveByDecision(decision.tipo_decision);
  const selectedTemplate = profileTemplate?.template ?? institutionalPreview ?? template?.contenido_html ?? DEFAULT_TEMPLATE;
  const correctionTemplate = `<h1>Acta de correcciones</h1>
<p>Radicado: {{radicado}}</p>
<p>Despacho: {{despacho}}</p>
<p>Demandante: {{demandante}}</p>
<p>Demandado: {{demandado}}</p>
<p>Fecha demanda: {{fecha_demanda}}</p>
<p><strong>Defectos y correcciones requeridas:</strong></p>
<p>{{defectos_identificados}}</p>
<p><strong>Fundamento normativo sugerido:</strong></p>
<p>{{fundamento_normativo}}</p>
<p><strong>Parte motiva base:</strong></p>
<p>{{parte_motiva}}</p>`;

  const selectedDocumentTemplate = isCorrectionReport ? correctionTemplate : selectedTemplate;
  const variablesForDoc = {
    ...variables,
    defectos_identificados:
      uniqueCorrectionItems.length > 0
        ? uniqueCorrectionItems.map((item) => `- ${item}`).join("\n")
        : "Sin defectos reportados por IA.",
  };

  let docxBuffer: Buffer;
  try {
    docxBuffer = await createDocxBufferFromTemplate(selectedDocumentTemplate, variablesForDoc, { strict: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Error validando plantilla legal",
        plantilla_usada: profileTemplate?.templateName ?? template?.nombre ?? "default",
        modo: "estricto",
      },
      { status: 422 }
    );
  }

  const fileName = `${isCorrectionReport ? "acta-correcciones" : "decision"}-${safeFileSegment(caseRecord.radicado || caseRecord.id)}.docx`;

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
