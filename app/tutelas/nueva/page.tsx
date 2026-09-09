import Link from "next/link";
import FeedbackToast from "@/components/FeedbackToast";
import AppShell from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { KnowledgeRepository } from "@/modules/knowledge";

interface NuevaTutelaPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) return value[0];
  return value;
}

function parseObject(value: string | undefined): Record<string, unknown> | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

function fieldClass(confidenceMap: Record<string, unknown> | null, key: string): string {
  const confidence = String(confidenceMap?.[key] ?? "").toLowerCase();
  if (confidence === "bajo") return "border-amber-400 bg-amber-50";
  if (confidence === "medio") return "border-yellow-300 bg-yellow-50/50";
  return "border-slate-300";
}

export default async function NuevaTutelaPage({ searchParams }: NuevaTutelaPageProps) {
  const resolved = (await searchParams) ?? {};
  const errorMessage = normalizeMessage(resolved.error);
  const okMessage = normalizeMessage(resolved.ok);
  const warningMessage = normalizeMessage(resolved.warn);
  const docsOk = normalizeMessage(resolved.docs_ok);

  const defaults = {
    profile_id: normalizeMessage(resolved.profile_id) ?? "",
    radicado: normalizeMessage(resolved.radicado) ?? "",
    demandante_nombre: normalizeMessage(resolved.demandante_nombre) ?? "",
    demandado_nombre: normalizeMessage(resolved.demandado_nombre) ?? "",
    despacho: normalizeMessage(resolved.despacho) ?? "",
    pretensiones_resumen: normalizeMessage(resolved.pretensiones_resumen) ?? "",
    hechos_resumen: normalizeMessage(resolved.hechos_resumen) ?? "",
    checklist_json: normalizeMessage(resolved.checklist_json) ?? "",
    inventario_json: normalizeMessage(resolved.inventario_json) ?? "",
    llm_confianza_json: normalizeMessage(resolved.llm_confianza_json) ?? "",
    llm_extraccion_json: normalizeMessage(resolved.llm_extraccion_json) ?? "",
  };

  const supabase = await createSupabaseServerClient();
  const profiles = await new KnowledgeRepository(supabase).listProfiles();
  const activeProfileId = defaults.profile_id || profiles.find((p) => p.activo)?.id || profiles[0]?.id || "";
  const confidenceMap = parseObject(defaults.llm_confianza_json);

  return (
    <AppShell
      title="Nueva tutela"
      subtitle="Paso 1 de 2 — Carga los PDFs y revisa el contexto extraído."
    >
      <FeedbackToast message={errorMessage} tone="error" />
      <FeedbackToast message={warningMessage} tone="warning" durationMs={7000} />
      <FeedbackToast
        message={
          okMessage === "expediente_importado"
            ? `PDFs procesados (${docsOk ?? "?"} archivo(s)). Revisa los campos resaltados en ámbar.`
            : undefined
        }
        tone="success"
      />

      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full bg-indigo-600 px-3 py-1 font-medium text-white">1 Contexto</span>
        <span className="text-slate-400">→</span>
        <span className="rounded-full border border-slate-300 px-3 py-1 text-slate-500">2 Decisión</span>
      </div>

      <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="font-semibold text-indigo-900">Cargar PDFs del expediente</h2>
        <p className="mt-1 text-sm text-indigo-700">
          Sube la tutela y anexos tal como llegaron al juzgado. La IA extraerá accionante, accionados, hechos y pretensiones.
        </p>
        <form action="/api/casos/parse-expediente" method="post" encType="multipart/form-data" className="mt-4 space-y-3">
          <input type="hidden" name="redirect_base" value="/tutelas/nueva" />
          {activeProfileId ? <input type="hidden" name="profile_id" value={activeProfileId} /> : null}
          <input
            type="file"
            name="expediente_files"
            accept=".pdf,application/pdf"
            multiple
            required
            className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" className="theme-btn-primary">
            Analizar PDFs
          </button>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Contexto de la tutela</h2>
        <p className="mt-1 text-sm text-slate-600">Completa o corrige lo que la extracción no capturó bien.</p>

        <form action="/api/casos/create" method="post" className="mt-4 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tipo_proceso" value="tutela" />
          <input type="hidden" name="redirect_base" value="/tutelas" />
          {activeProfileId ? <input type="hidden" name="profile_id" value={activeProfileId} /> : null}
          <input type="hidden" name="checklist_json" defaultValue={defaults.checklist_json} />
          <input type="hidden" name="inventario_json" defaultValue={defaults.inventario_json} />
          <input type="hidden" name="llm_confianza_json" defaultValue={defaults.llm_confianza_json} />
          <input type="hidden" name="llm_extraccion_json" defaultValue={defaults.llm_extraccion_json} />

          <label className="block text-sm sm:col-span-2">
            Radicado
            <input
              name="radicado"
              defaultValue={defaults.radicado}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "radicado")}`}
            />
          </label>

          <label className="block text-sm">
            Accionante
            <input
              name="demandante_nombre"
              defaultValue={defaults.demandante_nombre}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "demandante_nombre")}`}
            />
          </label>

          <label className="block text-sm">
            Accionado(s)
            <input
              name="demandado_nombre"
              defaultValue={defaults.demandado_nombre}
              required
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "demandado_nombre")}`}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            Juzgado / despacho
            <input
              name="despacho"
              defaultValue={defaults.despacho}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "despacho")}`}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            Hechos relevantes
            <textarea
              name="hechos_resumen"
              rows={4}
              defaultValue={defaults.hechos_resumen}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "hechos_resumen")}`}
            />
          </label>

          <label className="block text-sm sm:col-span-2">
            Pretensiones
            <textarea
              name="pretensiones_resumen"
              rows={3}
              defaultValue={defaults.pretensiones_resumen}
              className={`mt-1 w-full rounded-lg border px-3 py-2 text-sm ${fieldClass(confidenceMap, "pretensiones_resumen")}`}
            />
          </label>

          <div className="flex flex-wrap gap-3 sm:col-span-2">
            <button type="submit" className="theme-btn-primary">
              Guardar y continuar a decisión
            </button>
            <Link href="/tutelas" className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700">
              Cancelar
            </Link>
          </div>
        </form>
      </section>

      <p className="text-xs text-slate-500">
        Campos en ámbar = baja confianza de la extracción. Revísalos antes de continuar.
      </p>
    </AppShell>
  );
}
