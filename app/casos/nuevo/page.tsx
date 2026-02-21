import Link from "next/link";
import { createCaseAction } from "../actions";
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

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <FeedbackToast message={errorMessage} tone="error" />
      <header>
        <h1 className="text-2xl font-semibold text-slate-900">Nuevo caso</h1>
        <p className="mt-1 text-sm text-slate-600">
          Registre la demanda para iniciar flujo de checklist, reglas, decisión y documento.
        </p>
        <Link href="/casos" className="mt-2 inline-block text-sm underline">
          Volver a casos
        </Link>
      </header>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <form action={createCaseAction} className="grid gap-4 sm:grid-cols-2">
          <label className="text-sm text-slate-700">
            Radicado
            <input name="radicado" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="text-sm text-slate-700">
            Tipo de proceso
            <input name="tipo_proceso" required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="text-sm text-slate-700">
            Demandante
            <input
              name="demandante_nombre"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Demandado
            <input
              name="demandado_nombre"
              required
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Subtipo de proceso
            <input name="subtipo_proceso" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="text-sm text-slate-700">
            Cuantía
            <input name="cuantia" type="number" step="0.01" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </label>

          <label className="text-sm text-slate-700">
            Competencia territorial
            <input
              name="competencia_territorial"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
          </label>

          <label className="text-sm text-slate-700">
            Despacho
            <input name="despacho" className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
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