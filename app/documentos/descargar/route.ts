import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { DecisionRepository, DecisionService } from "@/modules/decisions";
import {
  buildInstitutionalTemplateHtml,
  createDocxBufferFromTemplate,
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

export async function GET(request: NextRequest) {
  const caseId = request.nextUrl.searchParams.get("caseId");

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

  if (!caseRecord || !decision) {
    return NextResponse.json(
      { error: "No existe información suficiente para generar el documento" },
      { status: 404 }
    );
  }

  if (caseRecord.estado !== "decidido") {
    return NextResponse.json(
      { error: "El caso debe estar en estado decidido para descargar DOCX" },
      { status: 409 }
    );
  }

  const variables = {
    radicado: caseRecord.radicado,
    despacho: caseRecord.despacho ?? "Despacho por definir",
    demandante: caseRecord.demandante_nombre,
    demandado: caseRecord.demandado_nombre,
    fundamento: decision.fundamento_juridico,
    decision: decision.tipo_decision,
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

  const template = await templateRepository.findActiveByDecision(decision.tipo_decision);
  const selectedTemplate = institutionalPreview ?? template?.contenido_html ?? DEFAULT_TEMPLATE;
  const docxBuffer = await createDocxBufferFromTemplate(selectedTemplate, variables);

  const fileName = `decision-${safeFileSegment(caseRecord.radicado || caseRecord.id)}.docx`;

  return new NextResponse(new Uint8Array(docxBuffer), {
    status: 200,
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "Content-Disposition": `attachment; filename="${fileName}"`,
      "Cache-Control": "no-store",
    },
  });
}
