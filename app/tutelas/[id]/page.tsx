import Link from "next/link";
import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import FeedbackToast from "@/components/FeedbackToast";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";

interface TutelaDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TutelaDetailPage({ params, searchParams }: TutelaDetailPageProps) {
  const { id } = await params;
  const resolved = (await searchParams) ?? {};
  const ok = Array.isArray(resolved.ok) ? resolved.ok[0] : resolved.ok;

  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const tutela = await caseService.getCaseById(id);

  if (!tutela) {
    notFound();
  }

  return (
    <AppShell
      title={tutela.radicado || "Tutela"}
      subtitle={`${tutela.demandante_nombre} vs ${tutela.demandado_nombre}`}
    >
      <FeedbackToast
        message={ok === "tutela_creada" ? "Contexto guardado. Continúa con el análisis de decisión." : undefined}
        tone="success"
      />

      <div className="flex items-center gap-2 text-sm">
        <span className="rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1 text-emerald-800">1 Contexto ✓</span>
        <span className="text-slate-400">→</span>
        <span className="rounded-full bg-indigo-600 px-3 py-1 font-medium text-white">2 Decisión</span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-900">Resumen del contexto</h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-slate-500">Accionante</dt>
            <dd className="font-medium text-slate-900">{tutela.demandante_nombre}</dd>
          </div>
          <div>
            <dt className="text-slate-500">Accionado(s)</dt>
            <dd className="font-medium text-slate-900">{tutela.demandado_nombre}</dd>
          </div>
          {tutela.despacho ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Despacho</dt>
              <dd className="font-medium text-slate-900">{tutela.despacho}</dd>
            </div>
          ) : null}
          {tutela.hechos_resumen ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Hechos</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{tutela.hechos_resumen}</dd>
            </div>
          ) : null}
          {tutela.pretensiones_resumen ? (
            <div className="sm:col-span-2">
              <dt className="text-slate-500">Pretensiones</dt>
              <dd className="whitespace-pre-wrap text-slate-800">{tutela.pretensiones_resumen}</dd>
            </div>
          ) : null}
        </dl>
        <Link href={`/tutelas/nueva?radicado=${encodeURIComponent(tutela.radicado)}`} className="mt-4 inline-block text-sm underline">
          Editar contexto
        </Link>
      </section>

      <section className="rounded-xl border border-indigo-200 bg-indigo-50 p-5">
        <h2 className="font-semibold text-indigo-900">Asistente de decisión</h2>
        <p className="mt-2 text-sm text-indigo-800">
          El chat con análisis jurídico y generación de borrador Word se activa en la siguiente fase. Mientras tanto puedes
          usar la vista avanzada temporal.
        </p>
        <Link
          href={`/casos/${tutela.id}`}
          className="mt-4 inline-block rounded-lg border border-indigo-400 bg-white px-4 py-2 text-sm font-medium text-indigo-900"
        >
          Abrir vista avanzada (temporal)
        </Link>
      </section>

      <Link href="/tutelas" className="text-sm text-slate-600 underline">
        ← Volver a mis tutelas
      </Link>
    </AppShell>
  );
}
