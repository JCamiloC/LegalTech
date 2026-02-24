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
  saveChecklistAction,
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

  if (!caseRecord) {
    notFound();
  }

  const checklistAction = saveChecklistAction.bind(null, id);
  const evaluateAction = evaluateCaseAction.bind(null, id);
  const saveDecision = saveDecisionAction.bind(null, id);
  const generateDocument = generateDecisionDocumentAction.bind(null, id);
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
          <Link href={`/asistente?caseId=${id}`} className="rounded-lg border border-slate-300 px-4 py-2 text-sm">
            Consultar asistente
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