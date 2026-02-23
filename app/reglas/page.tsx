import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import FeedbackToast from "@/components/FeedbackToast";
import { RuleRepository, RuleService } from "@/modules/rules";
import { createRuleAction, toggleRuleAction, updateRuleAction } from "./actions";

interface ReglasPageProps {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

function normalizeMessage(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0];
  }

  return value;
}

export default async function ReglasPage({ searchParams }: ReglasPageProps) {
  const resolvedSearchParams = (await searchParams) ?? {};
  const okMessage = normalizeMessage(resolvedSearchParams.ok);
  const errorMessage = normalizeMessage(resolvedSearchParams.error);

  const supabase = await createSupabaseServerClient();
  const ruleService = new RuleService(new RuleRepository(supabase));
  const rules = await ruleService.listRules();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-4 py-8 sm:px-6 sm:py-10">
      <FeedbackToast message={okMessage} tone="success" />
      <FeedbackToast message={errorMessage} tone="error" />
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">Gestión de reglas</h1>
          <p className="mt-1 text-sm text-slate-600">Configura prioridad, condición JSON y estado de ejecución.</p>
        </div>
        <Link href="/casos" className="theme-btn-rules">
          Volver a casos
        </Link>
      </header>

      <section className="grid gap-3 md:grid-cols-4">
        <Link href="/casos/nuevo" className="theme-quick-card theme-quick-card-primary">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Crear caso</p>
          <p className="mt-1 text-xs">Registrar nueva demanda.</p>
        </Link>
        <Link href="/reglas" className="theme-quick-card theme-quick-card-rules">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Reglas</p>
          <p className="mt-1 text-xs">Ajustar condiciones y prioridad.</p>
        </Link>
        <Link href="/plantillas" className="theme-quick-card theme-quick-card-templates">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Plantillas</p>
          <p className="mt-1 text-xs">Editar documentos base.</p>
        </Link>
        <Link href="/articulos" className="theme-quick-card theme-quick-card-legal">
          <p className="text-xs font-semibold uppercase tracking-wide">Acceso rápido</p>
          <p className="mt-1 text-sm font-semibold">Artículos</p>
          <p className="mt-1 text-xs">Gestionar base normativa.</p>
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Nueva regla</h2>
        <details className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <summary className="cursor-pointer text-sm font-medium text-slate-700">Plantillas JSON rápidas</summary>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Booleano simple</p>
              <textarea
                readOnly
                className="h-20 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"is_true","field":"caducidad"}'
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Condición OR</p>
              <textarea
                readOnly
                className="h-20 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"or","conditions":[{"op":"is_false","field":"cumple_art_82"},{"op":"is_false","field":"anexos_completos"}]}'
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Condición AND</p>
              <textarea
                readOnly
                className="h-24 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"and","conditions":[{"op":"eq","field":"tipo_proceso","value":"ejecutivo"},{"op":"is_true","field":"titulo_ejecutivo_valido"}]}'
              />
            </div>
            <div>
              <p className="mb-1 text-xs font-medium text-slate-600">Comparador numérico</p>
              <textarea
                readOnly
                className="h-24 w-full rounded-md border border-slate-300 bg-white p-2 font-mono text-xs"
                value='{"op":"gte","field":"cuantia","value":10000000}'
              />
            </div>
          </div>
        </details>
        <form action={createRuleAction} className="mt-4 grid gap-3">
          <input name="nombre" placeholder="Nombre de regla" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          <input
            name="descripcion"
            placeholder="Descripción funcional"
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            required
          />
          <textarea
            name="condicion_json"
            placeholder='{"op":"is_true","field":"caducidad"}'
            className="h-24 rounded-lg border border-slate-300 px-3 py-2 font-mono text-xs"
            required
          />
          <div className="grid gap-3 md:grid-cols-3">
            <input name="resultado" placeholder="auto_inadmisorio" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input name="prioridad" type="number" min={1} placeholder="Prioridad" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
            <input name="fundamento" placeholder="Fundamento jurídico" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
          </div>
          <div>
            <button type="submit" className="theme-btn-primary">
              Crear regla
            </button>
          </div>
        </form>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-lg font-semibold text-slate-900">Reglas actuales</h2>
        <div className="mt-4 space-y-4">
          {rules.length === 0 ? <p className="text-sm text-slate-600">No hay reglas registradas.</p> : null}

          {rules.map((rule) => {
            const updateAction = updateRuleAction.bind(null, rule.id);
            const switchAction = toggleRuleAction.bind(null, rule.id, rule.activo);

            return (
              <article key={rule.id} className="rounded-lg border border-slate-200 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <p className="text-sm font-semibold text-slate-900">
                    {rule.nombre} · prioridad {rule.prioridad}
                  </p>
                  <form action={switchAction}>
                    <button type="submit" className="rounded-md border border-slate-300 px-3 py-1 text-xs">
                      {rule.activo ? "Desactivar" : "Activar"}
                    </button>
                  </form>
                </div>

                <form action={updateAction} className="grid gap-2">
                  <input name="nombre" defaultValue={rule.nombre} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                  <input
                    name="descripcion"
                    defaultValue={rule.descripcion}
                    className="rounded-md border border-slate-300 px-2 py-1 text-sm"
                    required
                  />
                  <textarea
                    name="condicion_json"
                    defaultValue={JSON.stringify(rule.condicion_json)}
                    className="h-20 rounded-md border border-slate-300 px-2 py-1 font-mono text-xs"
                    required
                  />
                  <div className="grid gap-2 md:grid-cols-3">
                    <input name="resultado" defaultValue={rule.resultado} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                    <input name="prioridad" type="number" min={1} defaultValue={rule.prioridad} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                    <input name="fundamento" defaultValue={rule.fundamento} className="rounded-md border border-slate-300 px-2 py-1 text-sm" required />
                  </div>
                  <div>
                    <button type="submit" className="theme-btn-primary px-3 py-1 text-xs">
                      Guardar cambios
                    </button>
                  </div>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </main>
  );
}