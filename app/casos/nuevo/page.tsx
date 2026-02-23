import Link from "next/link";
import { createCaseAction, parseDemandDocumentAction } from "../actions";
import FeedbackToast from "@/components/FeedbackToast";

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
        message={okMessage === "documento_importado" ? "Documento leído. Verifica y corrige antes de guardar." : undefined}
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
        <h2 className="text-lg font-semibold text-indigo-900">Importar demanda desde PDF (.pdf)</h2>
        <p className="mt-1 text-sm text-indigo-700">
          Sube la demanda en PDF y el sistema intentará prellenar el formulario automáticamente.
        </p>
        <form action={parseDemandDocumentAction} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center">
          <input
            type="file"
            name="demanda_file"
            accept=".pdf,application/pdf"
            required
            className="w-full rounded-lg border border-indigo-300 bg-white px-3 py-2 text-sm"
          />
          <button type="submit" className="theme-btn-primary whitespace-nowrap">
            Leer documento
          </button>
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
            <input
              name="tipo_proceso"
              defaultValue={defaults.tipo_proceso}
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
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