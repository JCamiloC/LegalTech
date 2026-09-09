import Link from "next/link";
import FeedbackToast from "@/components/FeedbackToast";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { PROCESS_TYPE_OPTIONS } from "@/modules/cases/process-options";
import { KnowledgeRepository } from "@/modules/knowledge";

interface CriticalIssueView {
  field: string;
  reason: "missing" | "low_confidence";
  confidence: string;
  minimum_required: string;
  blocking: boolean;
}

interface CriticalEvaluationView {
  required_fields: string[];
  minimum_confidence: string;
  blocking_mode: "alert" | "block";
  is_ready_for_submission: boolean;
  issues: CriticalIssueView[];
}

interface NuevoCasoPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

function parseObject(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return null;
    }
    return parsed as Record<string, unknown>;
  } catch {
    return null;
  }
}

function fieldClass(confidenceMap: Record<string, unknown> | null, key: string): string {
  const confidence = String(confidenceMap?.[key] ?? "").toLowerCase();
  if (confidence === "bajo") {
    return "border-amber-400 bg-amber-50";
  }

  return "border-slate-300";
}

function parseCriticalEvaluation(value: string | undefined): CriticalEvaluationView | null {
  const parsed = parseObject(value);
  if (!parsed) {
    return null;
  }

  const requiredFields = Array.isArray(parsed.required_fields)
    ? parsed.required_fields.map((item) => String(item)).filter((item) => item.length > 0)
    : [];

  const issues = Array.isArray(parsed.issues)
    ? parsed.issues
        .map((raw): CriticalIssueView | null => {
          if (!raw || typeof raw !== "object") {
            return null;
          }

          const issue = raw as Record<string, unknown>;
          const reason = issue.reason === "missing" ? "missing" : issue.reason === "low_confidence" ? "low_confidence" : null;

          if (!reason) {
            return null;
          }

          return {
            field: String(issue.field ?? "").trim(),
            reason,
            confidence: String(issue.confidence ?? "").trim(),
            minimum_required: String(issue.minimum_required ?? "").trim(),
            blocking: Boolean(issue.blocking),
          };
        })
        .filter((item): item is CriticalIssueView => Boolean(item?.field))
    : [];

  return {
    required_fields: requiredFields,
    minimum_confidence: String(parsed.minimum_confidence ?? "medio"),
    blocking_mode: parsed.blocking_mode === "block" ? "block" : "alert",
    is_ready_for_submission: Boolean(parsed.is_ready_for_submission),
    issues,
  };
}

export default async function NuevoCasoPage({ searchParams }: NuevoCasoPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const warningMessage = normalizeMessage(resolvedSearchParams.warn);
  const warningScopeMessage = normalizeMessage(resolvedSearchParams.warn_llm_scope);
  const docsOk = normalizeMessage(resolvedSearchParams.docs_ok);

  const defaults = {
    profile_id: normalizeMessage(resolvedSearchParams.profile_id) ?? "",
    radicado: normalizeMessage(resolvedSearchParams.radicado) ?? "",
    tipo_proceso: normalizeMessage(resolvedSearchParams.tipo_proceso) ?? "",
    demandante_nombre: normalizeMessage(resolvedSearchParams.demandante_nombre) ?? "",
    demandado_nombre: normalizeMessage(resolvedSearchParams.demandado_nombre) ?? "",
    subtipo_proceso: normalizeMessage(resolvedSearchParams.subtipo_proceso) ?? "",
    cuantia: normalizeMessage(resolvedSearchParams.cuantia) ?? "",
    competencia_territorial: normalizeMessage(resolvedSearchParams.competencia_territorial) ?? "",
    despacho: normalizeMessage(resolvedSearchParams.despacho) ?? "",
    pretensiones_resumen: normalizeMessage(resolvedSearchParams.pretensiones_resumen) ?? "",
    hechos_resumen: normalizeMessage(resolvedSearchParams.hechos_resumen) ?? "",
    fecha_demanda: normalizeMessage(resolvedSearchParams.fecha_demanda) ?? "",
    checklist_json: normalizeMessage(resolvedSearchParams.checklist_json) ?? "",
    inventario_json: normalizeMessage(resolvedSearchParams.inventario_json) ?? "",
    llm_confianza_json: normalizeMessage(resolvedSearchParams.llm_confianza_json) ?? "",
    critical_eval_json: normalizeMessage(resolvedSearchParams.critical_eval_json) ?? "",
    llm_extraccion_json: normalizeMessage(resolvedSearchParams.llm_extraccion_json) ?? "",
  };

  const supabase = await createSupabaseServerClient();
  const profiles = await new KnowledgeRepository(supabase).listProfiles();
  const activeProfileId =
    defaults.profile_id ||
    profiles.find((item) => item.activo)?.id ||
    profiles[0]?.id ||
    "";

  const checklistPrefilled = parseObject(defaults.checklist_json);
  const inventoryPrefilled = parseObject(defaults.inventario_json);
  const confidenceMap = parseObject(defaults.llm_confianza_json);
  const criticalEvaluation = parseCriticalEvaluation(defaults.critical_eval_json);
  const criticalRequiredSet = new Set(criticalEvaluation?.required_fields ?? []);

  const checklistEntries = checklistPrefilled
    ? Object.entries(checklistPrefilled).map(([key, value]) => {
        const row = value as { valor?: unknown; razon?: unknown };
        return {
          key,
          valor: Boolean(row?.valor),
          razon: String(row?.razon ?? "").trim(),
        };
      })
    : [];

  const encontrados = Array.isArray(inventoryPrefilled?.encontrados)
    ? (inventoryPrefilled.encontrados as unknown[]).map((item) => String(item))
    : [];
  const faltantes = Array.isArray(inventoryPrefilled?.faltantes)
    ? (inventoryPrefilled.faltantes as unknown[]).map((item) => String(item))
    : [];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <FeedbackToast message={errorMessage} tone="error" />
      <FeedbackToast message={warningMessage} tone="warning" durationMs={7000} />
      <FeedbackToast message={warningScopeMessage} tone="warning" durationMs={9000} />
      <FeedbackToast
        message={
          okMessage === "expediente_importado"
            ? `Expediente leído (${docsOk ?? "?"} archivo(s) procesado(s)). Verifica y corrige antes de guardar.`
            : undefined
        }
        tone="success"
      />
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Nuevo caso</h1>
        <p className="mt-1 text-sm text-slate-600">
          Registre la demanda para iniciar flujo de checklist, reglas, decisión y documento.
        </p>
        <Link href="/casos" className="mt-2 inline-block text-sm underline">
          Volver a casos
        </Link>
      </header>

      <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="text-lg font-semibold text-indigo-900">Importar expediente desde PDF (.pdf)</h2>
        <p className="mt-1 text-sm text-indigo-700">
          Carga todos los PDFs del expediente en un solo envío para análisis integral con IA.
        </p>
        <form action="/api/casos/parse-expediente" method="post" encType="multipart/form-data" className="mt-4 grid gap-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-indigo-900">Perfil de configuración</label>
            <select
              name="profile_id"
              defaultValue={activeProfileId}
              className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
            >
              <option value="">Sin perfil</option>
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.nombre}
                </option>
              ))}
            </select>
            {profiles.length === 0 ? (
              <p className="mt-1 text-xs text-indigo-800">
                No hay perfiles creados. Configúralos en <Link href="/configuracion" className="underline">Configuración</Link>.
              </p>
            ) : null}
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-indigo-900">Expediente completo (PDF múltiples)</label>
            <input
              type="file"
              name="expediente_files"
              accept=".pdf,application/pdf"
              multiple
              required
              className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <p className="mb-2 text-xs text-indigo-700">
              Puedes cargar demanda y anexos juntos; el sistema leerá todo para inferir radicado, partes, tipo de proceso, cuantía y competencia.
            </p>
            <p className="text-xs text-indigo-700">
              Recomendado: máximo 25 PDFs por envío y 20MB por archivo. Si un anexo falla, se omite y el análisis continúa.
            </p>
          </div>
          <div>
            <button type="submit" className="theme-btn-primary whitespace-nowrap">
              Analizar expediente
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <form action="/api/casos/create" method="post" className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="profile_id" defaultValue={activeProfileId} />
          <input type="hidden" name="checklist_json" defaultValue={defaults.checklist_json} />
          <input type="hidden" name="inventario_json" defaultValue={defaults.inventario_json} />
          <input type="hidden" name="llm_confianza_json" defaultValue={defaults.llm_confianza_json} />
          <input type="hidden" name="critical_eval_json" defaultValue={defaults.critical_eval_json} />
          <input type="hidden" name="llm_extraccion_json" defaultValue={defaults.llm_extraccion_json} />

          {criticalEvaluation && criticalEvaluation.issues.length > 0 ? (
            <div
              className={`sm:col-span-2 rounded-lg border p-3 text-sm ${
                criticalEvaluation.blocking_mode === "block"
                  ? "border-red-300 bg-red-50 text-red-800"
                  : "border-amber-300 bg-amber-50 text-amber-800"
              }`}
            >
              <p className="font-semibold">
                Validación de campos críticos: {criticalEvaluation.blocking_mode === "block" ? "bloqueante" : "alerta"}
              </p>
              <ul className="mt-2 space-y-1">
                {criticalEvaluation.issues.map((item, index) => (
                  <li key={`${item.field}-${index}`}>
                    - {item.field}: {item.reason === "missing" ? "faltante" : "confianza baja"} (confianza {item.confidence}, mínima {item.minimum_required}).
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <label className="text-sm text-slate-700">
            Radicado
            <input
              name="radicado"
              defaultValue={defaults.radicado}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "radicado")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Tipo de proceso
            <select
              name="tipo_proceso"
              defaultValue={defaults.tipo_proceso}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "tipo_proceso")}`}
            >
              <option value="" disabled>
                Seleccione tipo de proceso
              </option>
              {PROCESS_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="text-sm text-slate-700">
            Demandante
            <input
              name="demandante_nombre"
              defaultValue={defaults.demandante_nombre}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "demandante_nombre")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Demandado
            <input
              name="demandado_nombre"
              defaultValue={defaults.demandado_nombre}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "demandado_nombre")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Subtipo de proceso
            <input
              name="subtipo_proceso"
              defaultValue={defaults.subtipo_proceso}
              required={criticalRequiredSet.has("subtipo_proceso")}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "subtipo_proceso")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Cuantía
            <input
              name="cuantia"
              defaultValue={defaults.cuantia}
              type="number"
              step="0.01"
              required={criticalRequiredSet.has("cuantia")}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "cuantia")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Competencia territorial
            <input
              name="competencia_territorial"
              defaultValue={defaults.competencia_territorial}
              required={criticalRequiredSet.has("competencia_territorial")}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "competencia_territorial")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Despacho
            <input
              name="despacho"
              defaultValue={defaults.despacho}
              required={criticalRequiredSet.has("despacho")}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "despacho")}`}
            />
          </label>

          <label className="sm:col-span-2 text-sm text-slate-700">
            Pretensiones (resumen IA)
            <textarea
              name="pretensiones_resumen"
              defaultValue={defaults.pretensiones_resumen}
              required={criticalRequiredSet.has("pretensiones_resumen")}
              className={`mt-1 h-24 w-full rounded-lg border p-2 text-sm ${fieldClass(confidenceMap, "pretensiones_resumen")}`}
            />
          </label>

          <label className="sm:col-span-2 text-sm text-slate-700">
            Hechos (resumen IA)
            <textarea
              name="hechos_resumen"
              defaultValue={defaults.hechos_resumen}
              required={criticalRequiredSet.has("hechos_resumen")}
              className={`mt-1 h-24 w-full rounded-lg border p-2 text-sm ${fieldClass(confidenceMap, "hechos_resumen")}`}
            />
          </label>

          <label className="text-sm text-slate-700">
            Fecha de demanda
            <input
              name="fecha_demanda"
              type="date"
              defaultValue={defaults.fecha_demanda}
              required={criticalRequiredSet.has("fecha_demanda")}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "fecha_demanda")}`}
            />
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              Crear caso
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Checklist pre-evaluado por IA</h2>
        {checklistEntries.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">Se mostrará aquí cuando la importación venga del LLM.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {checklistEntries.map((item) => (
              <li key={item.key} className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="font-medium text-slate-900">{item.key}</p>
                <p className={item.valor ? "text-emerald-700" : "text-amber-700"}>{item.valor ? "Cumple" : "No cumple"}</p>
                {item.razon ? <p className="mt-1 text-slate-600">{item.razon}</p> : null}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Inventario de documentos</h2>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm font-medium text-emerald-700">Encontrados</p>
            {encontrados.length === 0 ? <p className="text-sm text-slate-500">Sin datos</p> : null}
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {encontrados.map((item, index) => (
                <li key={`${item}-${index}`}>- {item}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-sm font-medium text-amber-700">Faltantes</p>
            {faltantes.length === 0 ? <p className="text-sm text-slate-500">Sin faltantes detectados</p> : null}
            <ul className="mt-1 space-y-1 text-sm text-slate-700">
              {faltantes.map((item, index) => (
                <li key={`${item}-${index}`}>- {item}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}