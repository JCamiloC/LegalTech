import Link from "next/link";
import { createCaseAction, parseDemandDocumentAction } from "../actions";
import FeedbackToast from "@/components/FeedbackToast";
import { PROCESS_TYPE_OPTIONS } from "@/modules/cases/process-options";

interface NuevoCasoPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function NuevoCasoPage({ searchParams }: NuevoCasoPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const errorMessage = normalizeMessage(resolvedSearchParams.error);
  const okMessage = normalizeMessage(resolvedSearchParams.ok);

  const defaults = {
    radicado: normalizeMessage(resolvedSearchParams.radicado) ?? "",
    tipo_proceso: normalizeMessage(resolvedSearchParams.tipo_proceso) ?? "",
    demandante_nombre: normalizeMessage(resolvedSearchParams.demandante_nombre) ?? "",
    demandado_nombre: normalizeMessage(resolvedSearchParams.demandado_nombre) ?? "",
    subtipo_proceso: normalizeMessage(resolvedSearchParams.subtipo_proceso) ?? "",
    cuantia: normalizeMessage(resolvedSearchParams.cuantia) ?? "",
    competencia_territorial: normalizeMessage(resolvedSearchParams.competencia_territorial) ?? "",
    despacho: normalizeMessage(resolvedSearchParams.despacho) ?? "",
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <FeedbackToast message={errorMessage} tone="error" />
      <FeedbackToast
        message={okMessage === "expediente_importado" ? "Expediente leído. Verifica y corrige antes de guardar." : undefined}
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
          Carga la demanda principal y, opcionalmente, anexos para mejorar el autollenado del caso.
        </p>
        <form action={parseDemandDocumentAction} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-indigo-900">Demanda principal (obligatorio)</label>
            <input
              type="file"
              name="demanda_principal"
              accept=".pdf,application/pdf"
              required
              className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-indigo-900">Anexos (opcional, múltiples)</label>
            <input
              type="file"
              name="anexos_files"
              accept=".pdf,application/pdf"
              multiple
              className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
            />
          </div>
          <div className="sm:col-span-2">
            <p className="mb-2 text-xs text-indigo-700">
              El sistema leerá todos los PDFs cargados para inferir radicado, partes, tipo de proceso, cuantía y competencia.
            </p>
          </div>
          <div className="sm:col-span-2">
            <button type="submit" className="theme-btn-primary whitespace-nowrap">
              Analizar expediente
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <form action={createCaseAction} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            Radicado
            <input
              name="radicado"
              defaultValue={defaults.radicado}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Tipo de proceso
            <select
              name="tipo_proceso"
              defaultValue={defaults.tipo_proceso}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
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
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Demandado
            <input
              name="demandado_nombre"
              defaultValue={defaults.demandado_nombre}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Subtipo de proceso
            <input
              name="subtipo_proceso"
              defaultValue={defaults.subtipo_proceso}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Cuantía
            <input
              name="cuantia"
              defaultValue={defaults.cuantia}
              type="number"
              step="0.01"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Competencia territorial
            <input
              name="competencia_territorial"
              defaultValue={defaults.competencia_territorial}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Despacho
            <input
              name="despacho"
              defaultValue={defaults.despacho}
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <button type="submit" className="rounded-lg bg-slate-900 px-4 py-2 text-sm text-white">
              Crear caso
            </button>
          </div>
        </form>
      </section>
    </main>
  );
}