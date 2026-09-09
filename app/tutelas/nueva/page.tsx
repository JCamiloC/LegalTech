import Link from "next/link";
import FeedbackToast from "@/components/FeedbackToast";
import AppShell from "@/components/AppShell";
import FlowStepper from "@/components/FlowStepper";
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

function fieldTone(confidenceMap: Record<string, unknown> | null, key: string) {
  const confidence = String(confidenceMap?.[key] ?? "").toLowerCase();
  if (confidence === "bajo") {
    return { className: "border-amber-400 bg-amber-50", hint: "Revisar: baja confianza" };
  }
  if (confidence === "medio") {
    return { className: "border-stone-300 bg-white", hint: "Revisar si hace falta" };
  }
  if (confidence === "alto") {
    return { className: "border-emerald-200 bg-white", hint: "" };
  }
  return { className: "border-stone-300 bg-white", hint: "" };
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
  const extracted = Boolean(defaults.radicado || defaults.demandante_nombre || defaults.hechos_resumen);

  return (
    <AppShell title="Nueva tutela" subtitle="Primero los PDF. Después corriges solo lo necesario.">
      <FeedbackToast message={errorMessage} tone="error" />
      <FeedbackToast message={warningMessage} tone="warning" durationMs={7000} />
      <FeedbackToast
        message={
          okMessage === "expediente_importado"
            ? `Listo: ${docsOk ?? "?"} archivo(s). Revisa lo marcado en ámbar.`
            : undefined
        }
        tone="success"
      />

      <FlowStepper current={1} />

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Paso A</p>
        <h2 className="mt-1 text-lg font-semibold">Cargar expediente</h2>
        <p className="mt-1 text-sm text-slate-600">Tutela y anexos, como llegaron al juzgado. Un clic y se extrae el contexto.</p>
        <form action="/api/casos/parse-expediente" method="post" encType="multipart/form-data" className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-end">
          <input type="hidden" name="redirect_base" value="/tutelas/nueva" />
          {activeProfileId ? <input type="hidden" name="profile_id" value={activeProfileId} /> : null}
          <label className="flex-1">
            <span className="mb-1 block text-xs font-medium text-slate-500">Archivos PDF</span>
            <input
              type="file"
              name="expediente_files"
              accept=".pdf,application/pdf"
              multiple
              required
              className="w-full rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-3 text-sm file:mr-3 file:rounded-full file:border-0 file:bg-slate-900 file:px-3 file:py-1 file:text-xs file:text-white"
            />
          </label>
          <button type="submit" className="theme-btn-primary shrink-0">
            Analizar
          </button>
        </form>
      </section>

      <section className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Paso B</p>
        <h2 className="mt-1 text-lg font-semibold">Revisar contexto</h2>
        <p className="mt-1 text-sm text-slate-600">
          {extracted
            ? "Corrige nombres, hechos y pretensiones si hace falta. Lo ámbar es lo más dudoso."
            : "Puedes llenarlo a mano si todavía no cargas PDF."}
        </p>

        <form action="/api/casos/create" method="post" className="mt-5 grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="tipo_proceso" value="tutela" />
          <input type="hidden" name="redirect_base" value="/tutelas" />
          {activeProfileId ? <input type="hidden" name="profile_id" value={activeProfileId} /> : null}
          <input type="hidden" name="checklist_json" defaultValue={defaults.checklist_json} />
          <input type="hidden" name="inventario_json" defaultValue={defaults.inventario_json} />
          <input type="hidden" name="llm_confianza_json" defaultValue={defaults.llm_confianza_json} />
          <input type="hidden" name="llm_extraccion_json" defaultValue={defaults.llm_extraccion_json} />

          {(
            [
              ["radicado", "Radicado", "text", true, "sm:col-span-2"],
              ["demandante_nombre", "Accionante", "text", true, ""],
              ["demandado_nombre", "Accionado(s)", "text", true, ""],
              ["despacho", "Juzgado / despacho", "text", false, "sm:col-span-2"],
            ] as const
          ).map(([name, label, , required, span]) => {
            const tone = fieldTone(confidenceMap, name);
            return (
              <label key={name} className={`block text-sm ${span}`}>
                <span className="flex items-center justify-between gap-2">
                  <span className="font-medium text-slate-700">{label}</span>
                  {tone.hint ? <span className="text-[11px] text-amber-700">{tone.hint}</span> : null}
                </span>
                <input
                  name={name}
                  defaultValue={defaults[name]}
                  required={required}
                  className={`mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm outline-none ring-slate-900/10 focus:ring-2 ${tone.className}`}
                />
              </label>
            );
          })}

          {(["hechos_resumen", "pretensiones_resumen"] as const).map((name) => {
            const tone = fieldTone(confidenceMap, name);
            return (
              <label key={name} className="block text-sm sm:col-span-2">
                <span className="flex items-center justify-between">
                  <span className="font-medium text-slate-700">
                    {name === "hechos_resumen" ? "Hechos relevantes" : "Pretensiones"}
                  </span>
                  {tone.hint ? <span className="text-[11px] text-amber-700">{tone.hint}</span> : null}
                </span>
                <textarea
                  name={name}
                  rows={name === "hechos_resumen" ? 5 : 3}
                  defaultValue={defaults[name]}
                  className={`mt-1 w-full rounded-2xl border px-3 py-2.5 text-sm outline-none ring-slate-900/10 focus:ring-2 ${tone.className}`}
                />
              </label>
            );
          })}

          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
            <button type="submit" className="theme-btn-primary">
              Continuar a la decisión
            </button>
            <Link href="/tutelas" className="text-sm text-slate-500 hover:text-slate-800">
              Cancelar
            </Link>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
