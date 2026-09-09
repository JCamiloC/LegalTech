import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { readTutelaFlow } from "@/modules/llm";

function getProgress(estado: string, confirmed: boolean) {
  if (confirmed || estado === "decidido") {
    return { label: "Lista para Word", hint: "Generar borrador", className: "bg-emerald-100 text-emerald-800" };
  }
  if (estado === "en_revision") {
    return { label: "En decisión", hint: "Continuar el chat", className: "bg-slate-900 text-white" };
  }
  return { label: "Por revisar", hint: "Abrir análisis", className: "bg-amber-100 text-amber-900" };
}

export default async function TutelasPage() {
  const supabase = await createSupabaseServerClient();
  const cases = await new CaseService(new CaseRepository(supabase)).listCases();

  return (
    <AppShell
      title="Tutelas"
      subtitle="Un flujo: cargar, decidir, redactar. La IA propone; tú confirmas."
      action={
        <Link href="/tutelas/nueva" className="theme-btn-primary">
          Nueva tutela
        </Link>
      }
    >
      {cases.length === 0 ? (
        <section className="rounded-3xl border border-stone-200 bg-white p-10 shadow-sm sm:p-14">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Empezar</p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight">Aún no hay tutelas en el despacho</h2>
          <p className="mt-3 max-w-lg text-sm leading-6 text-slate-600">
            Carga los PDF tal como llegaron. Revisas el contexto, conversas el veredicto y bajas un Word con el formato del juez.
          </p>
          <Link href="/tutelas/nueva" className="theme-btn-primary mt-8 inline-flex">
            Crear la primera
          </Link>
        </section>
      ) : (
        <section className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-sm">
          <ul className="divide-y divide-stone-100">
            {cases.map((item) => {
              const flow = readTutelaFlow(item.llm_extraccion_json);
              const progress = getProgress(item.estado, flow.veredicto_confirmado);
              return (
                <li key={item.id}>
                  <Link
                    href={`/tutelas/${item.id}`}
                    className="flex flex-col gap-3 px-5 py-4 transition hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                  >
                    <div className="min-w-0">
                      <p className="font-medium tracking-tight text-slate-900">{item.radicado || "Sin radicado"}</p>
                      <p className="mt-1 truncate text-sm text-slate-500">
                        {item.demandante_nombre} vs {item.demandado_nombre}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${progress.className}`}>
                        {progress.label}
                      </span>
                      <span className="text-sm text-slate-400">{progress.hint} →</span>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </AppShell>
  );
}
