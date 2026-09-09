import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { DecisionRepository, DecisionService } from "@/modules/decisions";
import {
  buildDocumentPreview,
  buildInstitutionalTemplateHtml,
  normalizeDecisionType,
  TemplateRepository,
} from "@/modules/documents";

const DEFAULT_TEMPLATE = `<h1>{{despacho}}</h1>
<p>Radicado: {{radicado}}</p>
<p>Demandante: {{demandante}}</p>
<p>Demandado: {{demandado}}</p>
<p>Decisión sugerida: {{decision}}</p>
<p>Fundamento: {{fundamento}}</p>`;

interface DocumentPreviewPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
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
}): Promise<string | null> {
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
  return String((exact ?? general ?? candidates[0]).contenido_texto ?? "");
}

export default async function DocumentPreviewPage({ searchParams }: DocumentPreviewPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const caseIdParam = resolvedSearchParams.caseId;
  const caseId = Array.isArray(caseIdParam) ? caseIdParam[0] : caseIdParam;
  const sourceParam = resolvedSearchParams.source;
  const source = Array.isArray(sourceParam) ? sourceParam[0] : sourceParam;

  if (!caseId) {
    const fallback = buildDocumentPreview(DEFAULT_TEMPLATE, {
      radicado: "N/A",
      despacho: "Despacho por definir",
      demandante: "N/A",
      demandado: "N/A",
      fundamento: "Sin información",
      decision: "auto_inadmisorio",
    });

    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
        <h1 className="text-xl font-semibold text-slate-900">Preview sin caso asociado</h1>
        <div className="prose prose-sm mt-4 max-w-none rounded-xl border border-slate-200 bg-white p-5" dangerouslySetInnerHTML={{ __html: fallback }} />
      </main>
    );
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
    return (
      <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
        <p className="rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-800">
          No existe información suficiente para el preview de documento.
        </p>
        <Link href="/casos" className="mt-4 inline-block text-sm underline">
          Volver a casos
        </Link>
      </main>
    );
  }

  const institutionalPreview =
    source === "word"
      ? await buildInstitutionalTemplateHtml({
          radicado: caseRecord.radicado,
          demandante: caseRecord.demandante_nombre,
          demandado: caseRecord.demandado_nombre,
          tipoProceso: caseRecord.tipo_proceso,
          decision: decision.tipo_decision,
          fundamento: decision.fundamento_juridico,
          cuantia: caseRecord.cuantia,
        })
      : null;

  const profileTemplate = await resolveProfileStrictTemplate({
    profileId: caseRecord.profile_id,
    decisionType: decision.tipo_decision,
    supabase,
  });
  const template = await templateRepository.findActiveByDecision(decision.tipo_decision);
  const preview =
    buildDocumentPreview(profileTemplate ?? institutionalPreview ?? template?.contenido_html ?? DEFAULT_TEMPLATE, {
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
    });

  return (
    <main className="mx-auto min-h-screen w-full max-w-4xl px-6 py-10">
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl font-semibold text-slate-900">Preview del documento</h1>
        <Link href={`/casos/${caseId}`} className="text-sm underline">
          Volver al caso
        </Link>
      </div>
      <div className="prose prose-sm max-w-none break-words rounded-xl border border-slate-200 bg-white p-5" dangerouslySetInnerHTML={{ __html: preview }} />
    </main>
  );
}