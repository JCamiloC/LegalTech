import Link from "next/link";
import { notFound } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FeedbackToast from "@/components/FeedbackToast";
import { CaseRepository, CaseService } from "@/modules/cases";
import { PROCESS_TYPE_OPTIONS } from "@/modules/cases/process-options";
import { DecisionRepository, DecisionService } from "@/modules/decisions";
import {
  deleteCaseAction,
  evaluateCaseAction,
  generateDecisionDocumentAction,
  generateCorrectionReportAction,
  saveChecklistAction,
  suggestDecisionAction,
  updateCaseAction,
  saveDecisionAction,
} from "../actions";

interface CasoDetallePageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function CasoDetallePage({ params, searchParams }: CasoDetallePageProps) {
  const { id } = await params;
  const resolvedSearchParams = (await searchParams) ?? {};
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const decisionService = new DecisionService(new DecisionRepository(supabase));

  const [caseRecord, checklist, latestDecision] = await Promise.all([
    caseService.getCaseById(id),
    caseService.getLatestChecklist(id),
    decisionService.getLatestByCaseId(id),
  ]);

  const latestAiSuggestionResult = await supabase
    .from("case_ai_suggestions")
    .select("*")
    .eq("case_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const latestAiSuggestion = latestAiSuggestionResult.data as
    | {
        decision_sugerida: string;
        confianza: string;
        fundamento_json: Array<{ articulo: string; texto_relevante: string }> | null;
        analisis_checklist: string | null;
        parte_motiva_borrador: string | null;
        defectos_json: string[] | null;
        biblioteca_contexto_json:
          | Array<{ titulo: string; tipo_documento: string; etiquetas: string[]; score: number }>
          | null;
      }
    | null;

  if (!caseRecord) {
    notFound();
  }

  const checklistAction = saveChecklistAction.bind(null, id);
  const evaluateAction = evaluateCaseAction.bind(null, id);
  const suggestDecision = suggestDecisionAction.bind(null, id);
  const saveDecision = saveDecisionAction.bind(null, id);
  const generateDocument = generateDecisionDocumentAction.bind(null, id);
  const generateCorrectionReport = generateCorrectionReportAction.bind(null, id);
  const updateCase = updateCaseAction.bind(null, id);
  const deleteCase = deleteCaseAction.bind(null, id);
  const hasChecklist = Boolean(checklist);
  const isPending = caseRecord.estado === "pendiente";
  const isReview = caseRecord.estado === "en_revision";
  const isDecided = caseRecord.estado === "decidido";
  const currentStepLabel = isPending
    ? hasChecklist
      ? "Paso actual: ejecutar motor de reglas"
      : "Paso actual: completar checklist"
    : isReview
      ? "Paso actual: guardar decisión final"
      : "Paso actual: generar documento";
  const nextStepMessage = isPending
    ? hasChecklist
      ? "Siguiente paso: ejecutar motor de reglas."
      : "Siguiente paso: diligenciar y guardar checklist."
    : isReview
      ? "Siguiente paso: validar sugerencia y guardar decisión final."
      : "Siguiente paso: generar y descargar documento definitivo.";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <FeedbackToast message={okMessage} tone="success" />
      <FeedbackToast message={errorMessage} tone="error" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs uppercase tracking-wide text-slate-500">Detalle del caso</p>
          <h1 className="text-2xl font-semibold text-slate-900">Radicado {caseRecord.radicado}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {caseRecord.demandante_nombre} vs. {caseRecord.demandado_nombre}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/casos" className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Volver a casos
          </Link>
          <form action={deleteCase}>
            <button type="submit" className="rounded-lg border border-red-300 px-4 py-2 text-sm text-red-700">
              Eliminar caso
            </button>
          </form>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[260px_1fr] lg:items-start">
        <aside className="lg:sticky lg:top-6">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Ruta del caso</h2>
            <p className="mt-2 text-xs text-slate-600">{currentStepLabel}</p>
            <ul className="mt-4 space-y-2 text-sm">
              <li>
                <a href="#progreso" className="flex items-center gap-2 text-slate-700 hover:underline">
                  <span className="h-2 w-2 rounded-full bg-emerald-500" />
                  Estado general
                </a>
              </li>
              <li>
                <a href="#checklist" className="flex items-center gap-2 text-slate-700 hover:underline">
                  <span className={`h-2 w-2 rounded-full ${hasChecklist ? "bg-emerald-500" : "bg-amber-500"}`} />
                  Checklist
                </a>
              </li>
              <li>
                <a href="#decision" className="flex items-center gap-2 text-slate-700 hover:underline">
                  <span className={`h-2 w-2 rounded-full ${isReview || isDecided ? "bg-emerald-500" : "bg-slate-300"}`} />
                  Decisión final
                </a>
              </li>
              <li>
                <a href="#documento" className="flex items-center gap-2 text-slate-700 hover:underline">
                  <span className={`h-2 w-2 rounded-full ${isDecided ? "bg-emerald-500" : "bg-slate-300"}`} />
                  Documento
                </a>
              </li>
            </ul>
          </section>
        </aside>

        <div className="space-y-6">
          <section className="grid gap-4 rounded-xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Datos del proceso</h2>
          <form action={updateCase} className="mt-2 grid gap-2">
            <input name="radicado" defaultValue={caseRecord.radicado} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <select name="tipo_proceso" defaultValue={caseRecord.tipo_proceso} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required>
              {PROCESS_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <input name="subtipo_proceso" defaultValue={caseRecord.subtipo_proceso ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input name="demandante_nombre" defaultValue={caseRecord.demandante_nombre} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input name="demandado_nombre" defaultValue={caseRecord.demandado_nombre} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input name="cuantia" defaultValue={caseRecord.cuantia ?? ""} type="number" step="0.01" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input name="competencia_territorial" defaultValue={caseRecord.competencia_territorial ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input name="despacho" defaultValue={caseRecord.despacho ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <input name="fecha_demanda" defaultValue={caseRecord.fecha_demanda ?? ""} type="date" className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <textarea name="pretensiones_resumen" defaultValue={caseRecord.pretensiones_resumen ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <textarea name="hechos_resumen" defaultValue={caseRecord.hechos_resumen ?? ""} className="rounded-md border border-slate-300 px-2 py-1 text-sm" />
            <div>
              <button type="submit" className="rounded-md border border-slate-300 px-3 py-1 text-xs">
                Guardar datos del caso
              </button>
            </div>
          </form>
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Decisiones</h2>
          <p className="mt-2 text-sm text-slate-700">Sugerida: {caseRecord.decision_sugerida ?? "Sin evaluar"}</p>
          <p className="text-sm text-slate-700">Final: {caseRecord.decision_final ?? "Pendiente"}</p>
          <p className="text-sm text-slate-700">Documento: descarga bajo demanda en formato DOCX (sin almacenamiento)</p>
        </div>
          </section>

      <section id="progreso" className="rounded-xl border border-slate-200 bg-white p-5 scroll-mt-6">
        <h2 className="text-lg font-semibold text-slate-900">Progreso del caso</h2>
        <div className="mt-3 grid gap-2 md:grid-cols-3">
          <div className={`rounded-lg border px-3 py-2 text-sm ${hasChecklist ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
            1. Checklist {hasChecklist ? "completado" : "pendiente"}
          </div>
          <div className={`rounded-lg border px-3 py-2 text-sm ${isReview || isDecided ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
            2. Decisión sugerida {isReview || isDecided ? "lista" : "pendiente"}
          </div>
          <div className={`rounded-lg border px-3 py-2 text-sm ${isDecided ? "border-emerald-300 bg-emerald-50 text-emerald-700" : "border-slate-200 text-slate-500"}`}>
            3. Decisión final y documento {isDecided ? "habilitado" : "pendiente"}
          </div>
        </div>
        <p className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-700">{nextStepMessage}</p>
      </section>

      <section id="checklist" className="rounded-xl border border-slate-200 bg-white p-5 scroll-mt-6">
        <details open={isPending}>
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">Checklist procesal</summary>
          <form action={checklistAction} className="mt-4 grid gap-3 md:grid-cols-2">
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="cumple_art_82" defaultChecked={Boolean(checklist?.cumple_art_82)} />
            Cumple artículo 82
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="anexos_completos" defaultChecked={Boolean(checklist?.anexos_completos)} />
            Anexos completos
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="poder_aportado" defaultChecked={Boolean(checklist?.poder_aportado)} />
            Poder aportado
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="legitimacion_causa" defaultChecked={Boolean(checklist?.legitimacion_causa)} />
            Legitimación en la causa
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="competencia_valida" defaultChecked={Boolean(checklist?.competencia_valida)} />
            Competencia válida
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="titulo_ejecutivo_valido"
              defaultChecked={Boolean(checklist?.titulo_ejecutivo_valido)}
            />
            Título ejecutivo válido
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              name="indebida_acumulacion"
              defaultChecked={Boolean(checklist?.indebida_acumulacion)}
            />
            Indebida acumulación
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="caducidad" defaultChecked={Boolean(checklist?.caducidad)} />
            Caducidad
          </label>
          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" name="prescripcion" defaultChecked={Boolean(checklist?.prescripcion)} />
            Prescripción
          </label>

          <label className="md:col-span-2 text-sm text-slate-700">
            Observaciones
            <textarea
              name="observaciones"
              defaultValue={checklist?.observaciones ?? ""}
              className="mt-1 h-24 w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

            <div className="md:col-span-2">
              <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
                Guardar checklist
              </button>
            </div>
          </form>

          <form action={evaluateAction} className="mt-3">
            <button
              type="submit"
              disabled={!hasChecklist || !isPending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              title={!hasChecklist ? "Primero guarda checklist" : !isPending ? "Ya se ejecutó la evaluación" : ""}
            >
              Ejecutar motor de reglas
            </button>
          </form>
          {!isPending ? (
            <p className="mt-2 text-xs text-slate-500">
              Esta etapa ya fue completada. Puedes reabrirla para consulta.
            </p>
          ) : null}
        </details>
      </section>

      <section id="decision" className="rounded-xl border border-slate-200 bg-white p-5 scroll-mt-6">
        <details open={isReview}>
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">Decisión final</summary>

          <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50 p-3">
            <p className="text-sm font-medium text-slate-900">Sugerencia de decisión con IA</p>
            <p className="mt-1 text-xs text-slate-600">
              Usa checklist, reglas activas, base legal y casos similares del histórico.
            </p>
            <form action={suggestDecision} className="mt-3">
              <button
                type="submit"
                disabled={!hasChecklist}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                title={!hasChecklist ? "Primero guarda checklist" : "Ejecutar análisis IA"}
              >
                Analizar con IA
              </button>
            </form>

            {latestAiSuggestion ? (
              <div className="mt-4 space-y-3 text-sm">
                <p>
                  <span className="font-medium text-slate-900">Decisión sugerida:</span>{" "}
                  <span className="text-slate-700">{latestAiSuggestion.decision_sugerida}</span>
                </p>
                <p>
                  <span className="font-medium text-slate-900">Confianza:</span>{" "}
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-medium ${
                      latestAiSuggestion.confianza === "alto"
                        ? "bg-emerald-100 text-emerald-700"
                        : latestAiSuggestion.confianza === "medio"
                          ? "bg-amber-100 text-amber-700"
                          : "bg-rose-100 text-rose-700"
                    }`}
                  >
                    {latestAiSuggestion.confianza}
                  </span>
                </p>
                {latestAiSuggestion.fundamento_json && latestAiSuggestion.fundamento_json.length > 0 ? (
                  <div>
                    <p className="font-medium text-slate-900">Fundamento normativo</p>
                    <ul className="mt-1 space-y-1 text-slate-700">
                      {latestAiSuggestion.fundamento_json.map((item, index) => (
                        <li key={`${item.articulo}-${index}`}>
                          {item.articulo}: {item.texto_relevante}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {latestAiSuggestion.defectos_json && latestAiSuggestion.defectos_json.length > 0 ? (
                  <div>
                    <p className="font-medium text-slate-900">Defectos identificados</p>
                    <ul className="mt-1 space-y-1 text-slate-700">
                      {latestAiSuggestion.defectos_json.map((item, index) => (
                        <li key={`${item}-${index}`}>- {item}</li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {latestAiSuggestion.biblioteca_contexto_json && latestAiSuggestion.biblioteca_contexto_json.length > 0 ? (
                  <div>
                    <p className="font-medium text-slate-900">Trazabilidad de biblioteca usada</p>
                    <ul className="mt-1 space-y-2 text-slate-700">
                      {latestAiSuggestion.biblioteca_contexto_json.map((item, index) => (
                        <li key={`${item.titulo}-${index}`} className="rounded-md border border-slate-200 bg-white px-2 py-1">
                          <p className="text-sm font-medium text-slate-900">{item.titulo}</p>
                          <p className="text-xs text-slate-600">
                            {item.tipo_documento} · score {item.score}
                          </p>
                          {item.etiquetas.length > 0 ? (
                            <p className="text-xs text-slate-500">Etiquetas: {item.etiquetas.join(", ")}</p>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="mt-3 text-xs text-slate-500">Aún no hay sugerencia de IA para este caso.</p>
            )}
          </div>

          <form action={saveDecision} className="mt-4 grid gap-3">
          <label className="text-sm text-slate-700">
            Tipo de decisión
            <select
              name="tipo_decision"
              defaultValue={latestDecision?.tipo_decision ?? caseRecord.decision_sugerida ?? "auto_inadmisorio"}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="auto_admisorio">Auto admisorio</option>
              <option value="auto_inadmisorio">Auto inadmisorio</option>
              <option value="mandamiento_pago">Mandamiento de pago</option>
              <option value="auto_rechaza_demanda">Auto que rechaza demanda</option>
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Fundamento jurídico
            <textarea
              name="fundamento_juridico"
              defaultValue={latestDecision?.fundamento_juridico ?? ""}
              className="mt-1 h-24 w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Motivación
            <textarea
              name="motivacion"
              defaultValue={latestDecision?.motivacion ?? ""}
              className="mt-1 h-24 w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Parte motiva (borrador IA editable)
            <textarea
              name="parte_motiva_borrador"
              defaultValue={caseRecord.parte_motiva_borrador ?? latestAiSuggestion?.parte_motiva_borrador ?? ""}
              className="mt-1 h-36 w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

          <label className="text-sm text-slate-700">
            Artículos aplicados
            <textarea
              name="articulos_aplicados"
              defaultValue={latestDecision?.articulos_aplicados ?? ""}
              className="mt-1 h-20 w-full rounded-lg border border-slate-300 p-2"
            />
          </label>

            <div className="flex flex-wrap gap-2">
              <button
                type="submit"
                disabled={!isReview}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white disabled:cursor-not-allowed disabled:opacity-50"
                title={isReview ? "Guardar decisión final" : "Disponible al terminar evaluación"}
              >
                Guardar decisión final
              </button>
            </div>
          </form>
          {!isReview ? <p className="mt-2 text-xs text-slate-500">Esta etapa está cerrada para edición.</p> : null}
        </details>
      </section>

      <section id="documento" className="rounded-xl border border-slate-200 bg-white p-5 scroll-mt-6">
        <details open={isDecided}>
          <summary className="cursor-pointer text-lg font-semibold text-slate-900">Documento final</summary>

          <div className="mt-3 grid gap-2">
            {!caseRecord.parte_motiva_borrador ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Advertencia: falta parte motiva borrador.
              </p>
            ) : null}
            {!caseRecord.pretensiones_resumen ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                Advertencia: falta pretensiones_resumen.
              </p>
            ) : null}
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <form action={generateDocument}>
              <button
                type="submit"
                disabled={!isDecided}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  isDecided
                    ? "Genera y descarga el DOCX final usando la plantilla institucional"
                    : "Disponible cuando el caso esté en estado decidido"
                }
              >
                Generar y descargar DOCX
              </button>
            </form>
            <form action={generateCorrectionReport}>
              <button
                type="submit"
                disabled={!isReview && !isDecided}
                className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-800 disabled:cursor-not-allowed disabled:opacity-50"
                title={
                  isReview || isDecided
                    ? "Genera acta de correcciones con defectos identificados"
                    : "Disponible cuando el caso esté en revisión o decidido"
                }
              >
                Generar acta de correcciones
              </button>
            </form>
            <Link href={`/documentos/preview?caseId=${id}&source=word`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
              Ver preview
            </Link>
          </div>
          {!isDecided ? (
            <p className="mt-2 text-xs text-slate-500">
              Flujo sugerido: guarda checklist → ejecuta reglas → guarda decisión final → genera documento.
            </p>
          ) : null}
        </details>
      </section>
        </div>
      </div>
    </main>
  );
}