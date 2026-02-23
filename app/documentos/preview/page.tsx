import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { DecisionRepository, DecisionService } from "@/modules/decisions";
import {
  buildDocumentPreview,
  buildInstitutionalTemplateHtml,
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

  const template = await templateRepository.findActiveByDecision(decision.tipo_decision);
  const preview =
    institutionalPreview ??
    buildDocumentPreview(template?.contenido_html ?? DEFAULT_TEMPLATE, {
      radicado: caseRecord.radicado,
      despacho: caseRecord.despacho ?? "Despacho por definir",
      demandante: caseRecord.demandante_nombre,
      demandado: caseRecord.demandado_nombre,
      fundamento: decision.fundamento_juridico,
      decision: decision.tipo_decision,
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