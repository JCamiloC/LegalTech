import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { CaseRepository, CaseService } from "@/modules/cases";
import { logoutAction } from "../login/actions";

const CHECKLIST_FIELDS = [
  "cumple_art_82",
  "anexos_completos",
  "poder_aportado",
  "legitimacion_causa",
  "competencia_valida",
  "titulo_ejecutivo_valido",
  "indebida_acumulacion",
  "caducidad",
  "prescripcion",
] as const;

function getStatusStyles(estado: string) {
  if (estado === "pendiente") {
    return "bg-amber-50 text-amber-700 border-amber-200";
  }

  if (estado === "en_revision") {
    return "bg-blue-50 text-blue-700 border-blue-200";
  }

  return "bg-emerald-50 text-emerald-700 border-emerald-200";
}

function getNextAction(estado: string) {
  if (estado === "pendiente") {
    return "Completar checklist y ejecutar reglas";
  }

  if (estado === "en_revision") {
    return "Revisar sugerencia y guardar decisión final";
  }

  return "Generar documento y validar salida";
}

function getChecklistCompliance(checklist: Record<string, unknown> | null) {
  if (!checklist) {
    return null;
  }

  const trueCount = CHECKLIST_FIELDS.filter((field) => checklist[field] === true).length;
  const percent = Math.round((trueCount / CHECKLIST_FIELDS.length) * 100);

  return {
    trueCount,
    total: CHECKLIST_FIELDS.length,
    percent,
  };
}

interface CasosPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export default async function CasosPage({
  searchParams,
}: CasosPageProps) {
  const supabase = await createSupabaseServerClient();
  const caseService = new CaseService(new CaseRepository(supabase));
  const cases = await caseService.listCases();
  const checklists = await Promise.all(cases.map((item) => caseService.getLatestChecklist(item.id)));
  const resolvedSearchParams = (await searchParams) ?? {};
  const statusFilterRaw = resolvedSearchParams.estado;
  const statusFilter = Array.isArray(statusFilterRaw) ? statusFilterRaw[0] : statusFilterRaw;

  const pendingCount = cases.filter((item) => item.estado === "pendiente").length;
  const reviewCount = cases.filter((item) => item.estado === "en_revision").length;
  const decidedCount = cases.filter((item) => item.estado === "decidido").length;

  const filteredCases =
    statusFilter && ["pendiente", "en_revision", "decidido"].includes(statusFilter)
      ? cases.filter((item) => item.estado === statusFilter)
      : cases;

  const visibleCases = filteredCases.map((item) => ({
    item,
    checklist: checklists[cases.findIndex((entry) => entry.id === item.id)] as Record<string, unknown> | null,
  }));

  const filterOptions = [
    { label: "Todos", value: "" },
    { label: "Pendientes", value: "pendiente" },
    { label: "En revisión", value: "en_revision" },
    { label: "Decididos", value: "decidido" },
  ];

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Casos</h1>
          <p className="mt-1 text-sm text-slate-600">
            Registro de demandas, checklist procesal y resultado de decisión.
          </p>
        </div>
        <div className="flex gap-2">
          <Link href="/casos/nuevo" className="theme-btn-primary">
            Nuevo caso
          </Link>
          <Link href="/reglas" className="theme-btn-rules">
            Reglas
          </Link>
          <Link href="/plantillas" className="theme-btn-templates">
            Plantillas
          </Link>
          <Link href="/articulos" className="theme-btn-legal">
            Artículos
          </Link>
          <form action={logoutAction}>
            <button type="submit" className="theme-btn-logout">
              Cerrar sesión
            </button>
          </form>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Link href="/casos/nuevo" className="theme-quick-card theme-quick-card-primary">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Crear caso</p>
          <p className="mt-1 text-xs">Inicia una nueva radicación.</p>
        </Link>
        <Link href="/reglas" className="theme-quick-card theme-quick-card-rules">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Gestionar reglas</p>
          <p className="mt-1 text-xs">Configura motor de decisión.</p>
        </Link>
        <Link href="/plantillas" className="theme-quick-card theme-quick-card-templates">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Gestionar plantillas</p>
          <p className="mt-1 text-xs">Edita formatos de autos.</p>
        </Link>
        <Link href="/articulos" className="theme-quick-card theme-quick-card-legal">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Base legal</p>
          <p className="mt-1 text-xs">Administra artículos jurídicos.</p>
        </Link>
      </section>

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-amber-700">Pendientes</p>
          <p className="mt-1 text-2xl font-semibold text-amber-800">{pendingCount}</p>
        </article>
        <article className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-blue-700">En revisión</p>
          <p className="mt-1 text-2xl font-semibold text-blue-800">{reviewCount}</p>
        </article>
        <article className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">Decididos</p>
          <p className="mt-1 text-2xl font-semibold text-emerald-800">{decidedCount}</p>
        </article>
      </section>

      <section className="flex flex-wrap gap-2">
        {filterOptions.map((option) => {
          const isActive = (statusFilter ?? "") === option.value;
          const href = option.value ? `/casos?estado=${option.value}` : "/casos";

          return (
            <Link
              key={option.label}
              href={href}
              className={`rounded-md border px-3 py-1 text-xs ${
                isActive ? "border-slate-900 bg-slate-900 text-white" : "border-slate-300 text-slate-700"
              }`}
            >
              {option.label}
            </Link>
          );
        })}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        {visibleCases.length === 0 ? (
          <p className="text-sm text-slate-600">No hay casos registrados.</p>
        ) : (
          <ul className="space-y-3">
            {visibleCases.map(({ item, checklist }) => {
              const compliance = getChecklistCompliance(checklist);

              return (
                <li key={item.id} className="rounded-lg border border-slate-200 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{item.radicado}</p>
                      <p className="text-xs text-slate-600">
                        {item.demandante_nombre} vs {item.demandado_nombre}
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-md border px-2 py-0.5 text-[11px] font-medium ${getStatusStyles(item.estado)}`}
                        >
                          {item.estado}
                        </span>
                        <span className="text-[11px] text-slate-500">Siguiente paso: {getNextAction(item.estado)}</span>
                      </div>

                      {compliance ? (
                        <div className="mt-2 w-full max-w-xs">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Nivel de cumplimiento checklist</span>
                            <span>{compliance.percent}%</span>
                          </div>
                          <div className="h-2 rounded-full bg-slate-100">
                            <div className="h-2 rounded-full bg-slate-700" style={{ width: `${compliance.percent}%` }} />
                          </div>
                        </div>
                      ) : (
                        <p className="mt-2 text-[11px] text-slate-500">Checklist aún no diligenciado.</p>
                      )}
                    </div>
                    <Link href={`/casos/${item.id}`} className="rounded-md border border-slate-300 px-3 py-1 text-xs">
                      Abrir
                    </Link>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}