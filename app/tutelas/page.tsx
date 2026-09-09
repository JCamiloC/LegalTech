import Link from "next/link";
import AppShell from "@/components/AppShell";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";

function getStatusLabel(estado: string) {
  if (estado === "pendiente") return { label: "En contexto", className: "bg-amber-50 text-amber-800 border-amber-200" };
  if (estado === "en_revision") return { label: "En decisión", className: "bg-blue-50 text-blue-800 border-blue-200" };
  return { label: "Resuelta", className: "bg-emerald-50 text-emerald-800 border-emerald-200" };
}

export default async function TutelasPage() {
  const supabase = await createSupabaseServerClient();
  const cases = await new CaseService(new CaseRepository(supabase)).listCases();

  return (
    <AppShell
      title="Mis tutelas"
      subtitle="Carga el expediente, revisa el contexto, conversa con el asistente y genera el borrador de respuesta."
      action={
        <Link href="/tutelas/nueva" className="theme-btn-primary">
          + Nueva tutela
        </Link>
      }
    >
      {cases.length === 0 ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="text-base font-medium text-slate-900">Aún no tienes tutelas</p>
          <p className="mt-2 text-sm text-slate-600">
            Comienza cargando los PDFs tal como llegaron al juzgado. El sistema extraerá el contexto y podrás completarlo.
          </p>
          <Link href="/tutelas/nueva" className="theme-btn-primary mt-6 inline-block">
            Crear primera tutela
          </Link>
        </section>
      ) : (
        <section className="rounded-xl border border-slate-200 bg-white">
          <ul className="divide-y divide-slate-100">
            {cases.map((item) => {
              const status = getStatusLabel(item.estado);
              return (
                <li key={item.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-900">{item.radicado || "Sin radicado"}</p>
                    <p className="mt-0.5 text-sm text-slate-600">
                      {item.demandante_nombre} vs {item.demandado_nombre}
                    </p>
                    <span className={`mt-2 inline-block rounded-md border px-2 py-0.5 text-xs font-medium ${status.className}`}>
                      {status.label}
                    </span>
                  </div>
                  <Link
                    href={`/tutelas/${item.id}`}
                    className="rounded-lg border border-slate-300 px-4 py-2 text-center text-sm font-medium text-slate-700"
                  >
                    Continuar
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <p className="text-xs text-slate-500">
        Antes de analizar tutelas, carga las normas de referencia en{" "}
        <Link href="/biblioteca" className="underline">
          Biblioteca
        </Link>
        .
      </p>
    </AppShell>
  );
}
