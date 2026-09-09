import { notFound } from "next/navigation";
import AppShell from "@/components/AppShell";
import FeedbackToast from "@/components/FeedbackToast";
import FlowStepper from "@/components/FlowStepper";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { readTutelaFlow } from "@/modules/llm";
import TutelaWorkspace from "./TutelaWorkspace";

interface TutelaDetailPageProps {
  params: Promise<{ id: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function TutelaDetailPage({ params, searchParams }: TutelaDetailPageProps) {
  const { id } = await params;
  const resolved = (await searchParams) ?? {};
  const ok = Array.isArray(resolved.ok) ? resolved.ok[0] : resolved.ok;

  const supabase = await createSupabaseServerClient();
  const tutela = await new CaseService(new CaseRepository(supabase)).getCaseById(id);

  if (!tutela) {
    notFound();
  }

  const flow = readTutelaFlow(tutela.llm_extraccion_json);

  return (
    <AppShell title={tutela.radicado || "Tutela"} subtitle={`${tutela.demandante_nombre}  ·  ${tutela.demandado_nombre}`}>
      <FeedbackToast
        message={ok === "tutela_creada" ? "Contexto listo. El asistente empieza el análisis." : undefined}
        tone="success"
      />

      <FlowStepper current={flow.veredicto_confirmado ? 3 : 2} />

      <TutelaWorkspace tutelaId={tutela.id} initialFlow={flow} />

      <details className="rounded-3xl border border-stone-200 bg-white px-5 py-4 shadow-sm">
        <summary className="cursor-pointer text-sm font-medium text-slate-800">Ver contexto extraído</summary>
        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-400">Accionante</dt>
            <dd className="mt-1 font-medium">{tutela.demandante_nombre}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-stone-400">Accionado(s)</dt>
            <dd className="mt-1 font-medium">{tutela.demandado_nombre}</dd>
          </div>
          {tutela.despacho ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-stone-400">Despacho</dt>
              <dd className="mt-1">{tutela.despacho}</dd>
            </div>
          ) : null}
          {tutela.hechos_resumen ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-stone-400">Hechos</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{tutela.hechos_resumen}</dd>
            </div>
          ) : null}
          {tutela.pretensiones_resumen ? (
            <div className="sm:col-span-2">
              <dt className="text-xs uppercase tracking-wide text-stone-400">Pretensiones</dt>
              <dd className="mt-1 whitespace-pre-wrap leading-6 text-slate-700">{tutela.pretensiones_resumen}</dd>
            </div>
          ) : null}
        </dl>
      </details>
    </AppShell>
  );
}
